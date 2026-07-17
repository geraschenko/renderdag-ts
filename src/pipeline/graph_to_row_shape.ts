// Port of eden/scm/lib/renderdag/src/pipeline/graph_to_row_shape.rs.
//
// PORT NOTE: Rust's `BTreeMap<usize, &Ancestor<N>>` becomes a plain `Map`
// plus `sortedEntries()` (which sorts numeric keys ascending) wherever the
// Rust code relies on key-ordered iteration.

import type { Column, Eq } from '../column.js';
import {
  Column as Col,
  EMPTY_COLUMN,
  columnsFind,
  columnsFindEmpty,
  columnsFirstEmpty,
  columnsNewEmpty,
  columnsReset,
  mergeColumn,
} from '../column.js';
import { defaultOutputRendererOptions } from '../output.js';
import type { Ancestor, GraphRowShape, GraphRowShapeOptions, NodeLine, PadLine } from './types.js';
import { LinkLine } from './types.js';

function sortedEntries<V>(map: Map<number, V>): Array<[number, V]> {
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

/// Stateful renderer for the first pipeline stage.
///
/// It consumes a stream of `(node, parents)` entries and produces one
/// `GraphRowShape` per node. The output is purely structural: it describes
/// column placement and abstract edge shapes, without choosing glyph
/// characters or attaching message text.
export class GraphRowShaper<N> {
  private columns: Column<N>[] = [];
  private options_: GraphRowShapeOptions;
  private previousNodeColumn: number | null = null;
  private readonly eq: Eq<N>;

  /// Rust: `new()` / `with_options()`.
  /// `eq` is the node equality function (Rust: the `N: Eq` bound); defaults
  /// to `===`, which is correct for string/number node names.
  constructor(options?: GraphRowShapeOptions, eq: Eq<N> = (a, b) => a === b) {
    this.options_ = options ?? defaultOutputRendererOptions();
    this.eq = eq;
  }

  /// Return the graph-shape options used by this renderer.
  options(): GraphRowShapeOptions {
    return this.options_;
  }

  /// Return mutable graph-shape options used by this renderer.
  /// (Same object as `options()`; kept for symmetry with Rust.)
  optionsMut(): GraphRowShapeOptions {
    return this.options_;
  }

  /// Reserve a column for a node before it is rendered.
  reserve(node: N): void {
    if (columnsFind(this.columns, node, this.eq) === null) {
      const index = columnsFirstEmpty(this.columns);
      if (index !== null) {
        this.columns[index] = Col.reserved(node);
      } else {
        this.columns.push(Col.reserved(node));
      }
    }
  }

  /// Return the number of graph columns needed after optionally considering
  /// the next node and its parents.
  width(node: N | null | undefined, parents: readonly Ancestor<N>[] | null | undefined): number {
    return this.widthWithOptions(node, parents, this.options_);
  }

  /// Return the number of graph columns needed with explicit graph-shape
  /// options.
  widthWithOptions(
    node: N | null | undefined,
    parents: readonly Ancestor<N>[] | null | undefined,
    options: GraphRowShapeOptions,
  ): number {
    let width = this.columns.length;
    let emptyColumns = this.columns.filter((column) => column.kind === 'empty').length;
    if (node !== null && node !== undefined) {
      // If the node is not already allocated, and there is no
      // space for the node, then adding the new node would create
      // a new column.
      if (columnsFind(this.columns, node, this.eq) === null) {
        if (options.minRowHeight <= 1 && options.staggerConsecutiveDisconnectedNodes) {
          const previousNodeColumn = this.previousNodeColumn;
          if (previousNodeColumn !== null) {
            if (
              previousNodeColumn < this.columns.length &&
              this.columns[previousNodeColumn].kind === 'empty'
            ) {
              // Dense stagger mode cannot use the previous node's column for an
              // unallocated node, so do not count that empty column as available.
              emptyColumns = Math.max(0, emptyColumns - 1);
            } else if (previousNodeColumn === this.columns.length) {
              // The previous node's column was trimmed from the end of the column
              // list. To keep the new node out of that column, rendering it requires
              // a blank placeholder column plus a new column for the node.
              width += 1;
            }
          }
        }
        if (emptyColumns === 0) {
          width += 1;
        } else {
          emptyColumns = Math.max(0, emptyColumns - 1);
        }
      }
    }
    if (parents !== null && parents !== undefined) {
      // Non-allocated parents will also need a new column (except
      // for one, which can take the place of the node, and any that could be
      // allocated to empty columns).
      const unallocatedCount = parents.filter((parent) => {
        const id = ancestorId(parent);
        return id === null || columnsFind(this.columns, id.node, this.eq) === null;
      }).length;
      const unallocatedParents = Math.max(0, unallocatedCount - emptyColumns);
      width += Math.max(0, unallocatedParents - 1);
    }
    return width;
  }

  /// Render the next node into an abstract graph row shape.
  nextRowShape(node: N, parents: Ancestor<N>[]): GraphRowShape<N> {
    const existingColumn = columnsFind(this.columns, node, this.eq);
    const column = existingColumn !== null ? existingColumn : this.findColumnForUnallocatedNode();
    this.columns[column] = EMPTY_COLUMN;

    const merge = parents.length > 1;

    const nodeLine: NodeLine[] = this.columns.map(columnToNodeLine);
    nodeLine[column] = 'node';

    const linkLine: LinkLine[] = this.columns.map(columnToLinkLine);
    let needLinkLine = false;

    const termLine: boolean[] = this.columns.map(() => false);
    let needTermLine = false;

    const padLines: PadLine[] = this.columns.map(columnToPadLine);

    const parentColumns = new Map<number, Ancestor<N>>();
    for (const parent of parents) {
      const parentId = ancestorId(parent);
      if (parentId !== null) {
        const index = columnsFind(this.columns, parentId.node, this.eq);
        if (index !== null) {
          this.columns[index] = mergeColumn(this.columns[index], ancestorToColumn(parent));
          parentColumns.set(index, parent);
          continue;
        }
      }

      const index = columnsFindEmpty(this.columns, column);
      if (index !== null) {
        this.columns[index] = mergeColumn(this.columns[index], ancestorToColumn(parent));
        parentColumns.set(index, parent);
        continue;
      }

      parentColumns.set(this.columns.length, parent);
      nodeLine.push('blank');
      padLines.push('blank');
      linkLine.push(LinkLine.EMPTY);
      termLine.push(false);
      this.columns.push(ancestorToColumn(parent));
    }

    for (const [index, parent] of sortedEntries(parentColumns)) {
      if (ancestorId(parent) === null) {
        termLine[index] = true;
        needTermLine = true;
      }
    }

    const separatorLine =
      existingColumn === null &&
      this.options_.minRowHeight <= 1 &&
      !this.options_.staggerConsecutiveDisconnectedNodes &&
      column === this.previousNodeColumn &&
      !needTermLine;

    if (parents.length === 1) {
      const first = sortedEntries(parentColumns)[0];
      if (first !== undefined) {
        const parentColumn = first[0];
        if (parentColumn > column) {
          const tmp = this.columns[column];
          this.columns[column] = this.columns[parentColumn];
          this.columns[parentColumn] = tmp;
          const parent = parentColumns.get(parentColumn);
          if (parent !== undefined) {
            parentColumns.delete(parentColumn);
            parentColumns.set(column, parent);
          }

          const wasDirect = LinkLine.contains(linkLine[parentColumn], LinkLine.VERT_PARENT);
          linkLine[column] |= wasDirect ? LinkLine.RIGHT_FORK_PARENT : LinkLine.RIGHT_FORK_ANCESTOR;
          for (let i = column + 1; i < parentColumn; i++) {
            linkLine[i] |= wasDirect ? LinkLine.HORIZ_PARENT : LinkLine.HORIZ_ANCESTOR;
          }
          linkLine[parentColumn] = wasDirect
            ? LinkLine.LEFT_MERGE_PARENT
            : LinkLine.LEFT_MERGE_ANCESTOR;
          needLinkLine = true;
          padLines[parentColumn] = 'blank';
        }
      }
    }

    const bounds = AncestorColumnBounds.new_(parentColumns, column);
    if (bounds !== null) {
      const range = bounds.range();
      for (let i = range.start; i < range.end; i++) {
        linkLine[i] |= bounds.horizontalLine(i);
        needLinkLine = true;
      }

      if (bounds.maxParent > column) {
        linkLine[column] |= LinkLine.RIGHT_MERGE_PARENT;
        needLinkLine = true;
      } else if (bounds.maxAncestor > column) {
        linkLine[column] |= LinkLine.RIGHT_MERGE_ANCESTOR;
        needLinkLine = true;
      }

      if (bounds.minParent < column) {
        linkLine[column] |= LinkLine.LEFT_MERGE_PARENT;
        needLinkLine = true;
      } else if (bounds.minAncestor < column) {
        linkLine[column] |= LinkLine.LEFT_MERGE_ANCESTOR;
        needLinkLine = true;
      }

      for (const [index, parent] of sortedEntries(parentColumns)) {
        padLines[index] = columnToPadLine(this.columns[index]);
        if (index < column) {
          linkLine[index] |= ancestorToLinkLine(
            parent,
            LinkLine.RIGHT_FORK_PARENT,
            LinkLine.RIGHT_FORK_ANCESTOR,
          );
        } else if (index === column) {
          linkLine[index] |=
            LinkLine.CHILD |
            ancestorToLinkLine(parent, LinkLine.VERT_PARENT, LinkLine.VERT_ANCESTOR);
        } else {
          linkLine[index] |= ancestorToLinkLine(
            parent,
            LinkLine.LEFT_FORK_PARENT,
            LinkLine.LEFT_FORK_ANCESTOR,
          );
        }
      }
    }

    columnsReset(this.columns);
    this.previousNodeColumn = column;

    return {
      node,
      merge,
      nodeLine,
      linkLine: needLinkLine ? linkLine : null,
      termLine: needTermLine ? termLine : null,
      padLines,
      separatorLine,
    };
  }

  private findColumnForUnallocatedNode(): number {
    if (this.options_.minRowHeight <= 1 && this.options_.staggerConsecutiveDisconnectedNodes) {
      for (let index = 0; index < this.columns.length; index++) {
        if (this.columns[index].kind === 'empty' && index !== this.previousNodeColumn) {
          return index;
        }
      }
      if (this.previousNodeColumn === this.columns.length) {
        this.columns.push(EMPTY_COLUMN);
      }
      return columnsNewEmpty(this.columns);
    } else {
      const index = columnsFirstEmpty(this.columns);
      return index !== null ? index : columnsNewEmpty(this.columns);
    }
  }
}

class AncestorColumnBounds {
  private constructor(
    readonly target: number,
    readonly minAncestor: number,
    readonly minParent: number,
    readonly maxParent: number,
    readonly maxAncestor: number,
  ) {}

  /// Rust: `AncestorColumnBounds::new`
  static new_<N>(columns: Map<number, Ancestor<N>>, target: number): AncestorColumnBounds | null {
    if (columns.size === 0) {
      return null;
    }
    const entries = sortedEntries(columns);
    const minAncestor = Math.min(entries[0][0], target);
    const maxAncestor = Math.max(entries[entries.length - 1][0], target);
    const firstDirect = entries.find(([, ancestor]) => ancestorIsDirect(ancestor));
    const minParent = Math.min(firstDirect !== undefined ? firstDirect[0] : target, target);
    const lastDirect = [...entries].reverse().find(([, ancestor]) => ancestorIsDirect(ancestor));
    const maxParent = Math.max(lastDirect !== undefined ? lastDirect[0] : target, target);
    return new AncestorColumnBounds(target, minAncestor, minParent, maxParent, maxAncestor);
  }

  range(): { start: number; end: number } {
    if (this.minAncestor < this.maxAncestor) {
      return { start: this.minAncestor + 1, end: this.maxAncestor };
    } else {
      return { start: 0, end: 0 };
    }
  }

  horizontalLine(index: number): LinkLine {
    if (index === this.target) {
      return LinkLine.EMPTY;
    } else if (index > this.minParent && index < this.maxParent) {
      return LinkLine.HORIZ_PARENT;
    } else if (index > this.minAncestor && index < this.maxAncestor) {
      return LinkLine.HORIZ_ANCESTOR;
    } else {
      return LinkLine.EMPTY;
    }
  }
}

function ancestorToColumn<N>(ancestor: Ancestor<N>): Column<N> {
  switch (ancestor.type) {
    case 'ancestor':
      return Col.ancestor(ancestor.node);
    case 'parent':
      return Col.parent(ancestor.node);
    case 'anonymous':
      return Col.blocked();
  }
}

function ancestorId<N>(ancestor: Ancestor<N>): { node: N } | null {
  switch (ancestor.type) {
    case 'ancestor':
    case 'parent':
      return { node: ancestor.node };
    case 'anonymous':
      return null;
  }
}

function ancestorIsDirect<N>(ancestor: Ancestor<N>): boolean {
  switch (ancestor.type) {
    case 'ancestor':
      return false;
    case 'parent':
    case 'anonymous':
      return true;
  }
}

function ancestorToLinkLine<N>(
  ancestor: Ancestor<N>,
  direct: LinkLine,
  indirect: LinkLine,
): LinkLine {
  return ancestorIsDirect(ancestor) ? direct : indirect;
}

function columnToNodeLine<N>(column: Column<N>): NodeLine {
  switch (column.kind) {
    case 'ancestor':
      return 'ancestor';
    case 'parent':
      return 'parent';
    default:
      return 'blank';
  }
}

function columnToLinkLine<N>(column: Column<N>): LinkLine {
  switch (column.kind) {
    case 'ancestor':
      return LinkLine.VERT_ANCESTOR;
    case 'parent':
      return LinkLine.VERT_PARENT;
    default:
      return LinkLine.EMPTY;
  }
}

function columnToPadLine<N>(column: Column<N>): PadLine {
  switch (column.kind) {
    case 'ancestor':
      return 'ancestor';
    case 'parent':
      return 'parent';
    default:
      return 'blank';
  }
}
