// Port of eden/scm/lib/renderdag/src/pipeline/types.rs.
//
// PORT NOTE: In the Rust source, `Ancestor`, `NodeLine`, `PadLine` and
// `LinkLine` are defined in `render.rs` and re-exported here. In this port
// the definitions live *here* and `render.ts` re-exports them, to avoid a
// circular ES-module dependency. Everything else is 1:1.

import type { OutputRendererOptions } from '../output.js';

/// Ancestor type indication for an ancestor or parent node.
/// (Rust: `enum Ancestor<N> { Ancestor(N), Parent(N), Anonymous }` in render.rs)
export type Ancestor<N> =
  /** The node is an eventual ancestor. */
  | { type: 'ancestor'; node: N }
  /** The node is an immediate parent. */
  | { type: 'parent'; node: N }
  /** The node is an anonymous ancestor. */
  | { type: 'anonymous' };

/** Convenience constructors mirroring the Rust enum variants. */
export const Ancestor = {
  ancestor<N>(node: N): Ancestor<N> {
    return { type: 'ancestor', node };
  },
  parent<N>(node: N): Ancestor<N> {
    return { type: 'parent', node };
  },
  anonymous<N>(): Ancestor<N> {
    return { type: 'anonymous' };
  },
} as const;

/// A column in the node row.
/// (Rust: `enum NodeLine { Blank, Ancestor, Parent, Node }` in render.rs)
export type NodeLine = 'blank' | 'ancestor' | 'parent' | 'node';

/// A column in a padding row.
/// (Rust: `enum PadLine { Blank, Ancestor, Parent }` in render.rs)
export type PadLine = 'blank' | 'ancestor' | 'parent';

/// A column in a linking row.
/// (Rust: `bitflags! struct LinkLine: u16` in render.rs)
export type LinkLine = number;

export const LinkLine = {
  EMPTY: 0,

  /** This cell contains a horizontal line that connects to a parent. */
  HORIZ_PARENT: 0b0_0000_0000_0001,

  /** This cell contains a horizontal line that connects to an ancestor. */
  HORIZ_ANCESTOR: 0b0_0000_0000_0010,

  /** The descendent of this cell is connected to the parent. */
  VERT_PARENT: 0b0_0000_0000_0100,

  /** The descendent of this cell is connected to an ancestor. */
  VERT_ANCESTOR: 0b0_0000_0000_1000,

  /** The parent of this cell is linked in this link row and the child is to the left. */
  LEFT_FORK_PARENT: 0b0_0000_0001_0000,

  /** The ancestor of this cell is linked in this link row and the child is to the left. */
  LEFT_FORK_ANCESTOR: 0b0_0000_0010_0000,

  /** The parent of this cell is linked in this link row and the child is to the right. */
  RIGHT_FORK_PARENT: 0b0_0000_0100_0000,

  /** The ancestor of this cell is linked in this link row and the child is to the right. */
  RIGHT_FORK_ANCESTOR: 0b0_0000_1000_0000,

  /** The child of this cell is linked to parents on the left. */
  LEFT_MERGE_PARENT: 0b0_0001_0000_0000,

  /** The child of this cell is linked to ancestors on the left. */
  LEFT_MERGE_ANCESTOR: 0b0_0010_0000_0000,

  /** The child of this cell is linked to parents on the right. */
  RIGHT_MERGE_PARENT: 0b0_0100_0000_0000,

  /** The child of this cell is linked to ancestors on the right. */
  RIGHT_MERGE_ANCESTOR: 0b0_1000_0000_0000,

  /**
   * The target node of this link line is the child of this column.
   * This disambiguates between the node that is connected in this link
   * line, and other nodes that are also connected vertically.
   */
  CHILD: 0b1_0000_0000_0000,

  HORIZONTAL: 0,
  VERTICAL: 0,
  LEFT_FORK: 0,
  RIGHT_FORK: 0,
  LEFT_MERGE: 0,
  RIGHT_MERGE: 0,
  ANY_MERGE: 0,
  ANY_FORK: 0,
  ANY_FORK_OR_MERGE: 0,

  /** Rust: `flags.intersects(other)` */
  intersects(flags: LinkLine, other: LinkLine): boolean {
    return (flags & other) !== 0;
  },

  /** Rust: `flags.contains(other)` */
  contains(flags: LinkLine, other: LinkLine): boolean {
    return (flags & other) === other;
  },
};

LinkLine.HORIZONTAL = LinkLine.HORIZ_PARENT | LinkLine.HORIZ_ANCESTOR;
LinkLine.VERTICAL = LinkLine.VERT_PARENT | LinkLine.VERT_ANCESTOR;
LinkLine.LEFT_FORK = LinkLine.LEFT_FORK_PARENT | LinkLine.LEFT_FORK_ANCESTOR;
LinkLine.RIGHT_FORK = LinkLine.RIGHT_FORK_PARENT | LinkLine.RIGHT_FORK_ANCESTOR;
LinkLine.LEFT_MERGE = LinkLine.LEFT_MERGE_PARENT | LinkLine.LEFT_MERGE_ANCESTOR;
LinkLine.RIGHT_MERGE = LinkLine.RIGHT_MERGE_PARENT | LinkLine.RIGHT_MERGE_ANCESTOR;
LinkLine.ANY_MERGE = LinkLine.LEFT_MERGE | LinkLine.RIGHT_MERGE;
LinkLine.ANY_FORK = LinkLine.LEFT_FORK | LinkLine.RIGHT_FORK;
LinkLine.ANY_FORK_OR_MERGE = LinkLine.ANY_MERGE | LinkLine.ANY_FORK;

/// Options that affect the graph row shape produced from the input node stream.
///
/// These options belong to the first pipeline stage. They may affect column
/// allocation, separator rows, and the abstract edge shape. They do not choose
/// glyph characters or place message text.
export type GraphRowShapeOptions = OutputRendererOptions;

/// An abstract graph row shape for one rendered node.
///
/// This is the output of the graph-to-rows stage. It captures the node's
/// current column, the edge shape around it, and any row-level facts needed by
/// later stages. It intentionally does not contain glyphs or message text.
export interface GraphRowShape<N> {
  /** The node represented by this row. */
  node: N;

  /** True if this row connects to multiple parents. */
  merge: boolean;

  /**
   * True if this row needs a blank separator before its graph lines.
   * Only emitted when `minRowHeight <= 1`; see `GraphRowShapeOptions`.
   */
  separatorLine: boolean;

  /** Abstract columns for the line containing the node. */
  nodeLine: NodeLine[];

  /**
   * Abstract columns for the line connecting the node to its parents.
   * This is absent (`null`) when the node and its parents can be represented
   * without an explicit link line.
   */
  linkLine: LinkLine[] | null;

  /**
   * Terminator columns for anonymous parents.
   * A `true` entry marks a column where the edge should terminate. Other
   * columns should be rendered using the row's padding columns.
   */
  termLine: boolean[] | null;

  /** Abstract columns for repeatable padding below this row. */
  padLines: PadLine[];
}

/// A left-side graph prefix line before message text is attached.
///
/// This is the output of the row-shapes-to-prefix-lines stage. A prefix line
/// may contain a node glyph slot, but it does not know what glyph will fill
/// that slot and it does not contain any right-side message text.
export interface PrefixLine {
  /** The ordered pieces that make up the graph prefix. */
  parts: PrefixLinePart[];

  /** The semantic role of this line within the rendered row. */
  kind: PrefixLineKind;
}

/// A piece of a graph prefix line.
export type PrefixLinePart =
  /** Literal graph text. */
  | { type: 'text'; text: string }
  /**
   * Placeholder for the rendered node glyph.
   * Keeping the glyph as a slot lets callers cache prefix lines and fill in
   * status-dependent glyphs later.
   */
  | { type: 'nodeGlyph' };

/// The semantic role of a prefix line.
///
/// The text-output stage can use this to decide where messages should attach,
/// which lines may repeat, and which lines are meaningful for consumers that do
/// not render plain text.
export type PrefixLineKind =
  /** A blank line separating disconnected one-line rows. */
  | 'separator'
  /** A repeatable line before the node line. */
  | 'preNode'
  /** The line containing the rendered node glyph. */
  | 'node'
  /** A repeatable line after the node line and before edge links. */
  | 'postNode'
  /** A line connecting the node to parent or ancestor columns. */
  | 'link'
  /** A line terminating an anonymous parent edge. */
  | 'term'
  /** A line continuing ancestry or parent edges. */
  | 'ancestry'
  /** A repeatable line after ancestry continuation. */
  | 'postAncestry';

/// True if this line kind can be repeated to carry additional message lines.
/// (Rust: `PrefixLineKind::is_repeatable`)
export function isRepeatable(kind: PrefixLineKind): boolean {
  return kind === 'preNode' || kind === 'postNode' || kind === 'postAncestry';
}

/// Converts graph row shapes into prefix lines.
export interface PrefixLineRenderer<N> {
  /** Convert the next graph row shape into prefix lines. */
  nextPrefixLines(rowShape: GraphRowShape<N>): PrefixLine[];
}
