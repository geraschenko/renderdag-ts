// Port of eden/scm/lib/renderdag/src/render.rs.
//
// PORT NOTE: `Ancestor`, `NodeLine`, `PadLine` and `LinkLine` are defined in
// pipeline/types.ts and re-exported here (the reverse of the Rust source) to
// avoid a circular ES-module dependency. Rust's associated `type Output` on
// the `Renderer` trait becomes the second type parameter `O`, and the
// `output_options` / `output_options_mut` pair becomes a single
// `outputOptions()` returning the mutable options object.

import { OutputRendererBuilder, defaultOutputRendererOptions } from './output.js';
import type { OutputRendererOptions } from './output.js';
import { GraphRowShaper } from './pipeline/graph_to_row_shape.js';
import type { Ancestor, LinkLine, NodeLine, PadLine } from './pipeline/types.js';
import type { Eq } from './column.js';

export type { Ancestor, LinkLine, NodeLine, PadLine } from './pipeline/types.js';

export interface Renderer<N, O> {
  /** Returns the width of the graph line, possibly including another node. */
  width(node: N | null | undefined, parents: readonly Ancestor<N>[] | null | undefined): number;

  /** Reserve a column for the given node. */
  reserve(node: N): void;

  /** Render the next row. */
  nextRow(node: N, parents: Ancestor<N>[], glyph: string, message: string): O;

  /** Get the (mutable) output options. */
  outputOptions(): OutputRendererOptions;
}

/// An output graph row.
///
/// This "Row" contains a "node" and its surrounding edges. It does not define
/// precisely how many lines this row should have. Lines characters are abstract
/// so the actual rendering logic (svg, box drawing, etc) can decide what to
/// use.
///
/// ```plain
///                          // separator line
///  o      F                // node line
///  ├─┬─╮  long message 1   // link line
///  ╷ │ ~  long message 2   // term line
///  ╷ │    long message 3   // pad line
///  ╷ │    long message 4   // pad line
/// ```
export interface GraphRow<N> {
  /** The name of the node for this row. */
  node: N;

  /** The glyph for this node. */
  glyph: string;

  /** The message for this row. */
  message: string;

  /** True if this row is for a merge commit. */
  merge: boolean;

  /** True if this row needs a blank-line separator from the previous row. */
  separatorLine: boolean;

  /** The node columns for this row. */
  nodeLine: NodeLine[];

  /** The link columns for this row, if a link row is necessary. */
  linkLine: LinkLine[] | null;

  /**
   * The location of any terminators, if necessary. Other columns should be
   * filled in with pad lines.
   */
  termLine: boolean[] | null;

  /** The pad columns for this row. */
  padLines: PadLine[];
}

/// Renderer for a DAG.
///
/// Converts a sequence of DAG node descriptions into rendered graph rows.
export class GraphRowRenderer<N> implements Renderer<N, GraphRow<N>> {
  private inner: GraphRowShaper<N>;
  private outputOptions_: OutputRendererOptions;

  /// Create a new renderer.
  constructor(eq?: Eq<N>) {
    this.inner = new GraphRowShaper<N>(undefined, eq);
    this.outputOptions_ = defaultOutputRendererOptions();
  }

  /// Build an output renderer from this renderer.
  output(): OutputRendererBuilder<N, GraphRowRenderer<N>> {
    return new OutputRendererBuilder(this);
  }

  width(node: N | null | undefined, parents: readonly Ancestor<N>[] | null | undefined): number {
    return this.inner.widthWithOptions(node, parents, this.outputOptions_);
  }

  reserve(node: N): void {
    this.inner.reserve(node);
  }

  nextRow(node: N, parents: Ancestor<N>[], glyph: string, message: string): GraphRow<N> {
    Object.assign(this.inner.optionsMut(), this.outputOptions_);
    const row = this.inner.nextRowShape(node, parents);

    return {
      node: row.node,
      glyph,
      message,
      merge: row.merge,
      nodeLine: row.nodeLine,
      linkLine: row.linkLine,
      termLine: row.termLine,
      padLines: row.padLines,
      separatorLine: row.separatorLine,
    };
  }

  outputOptions(): OutputRendererOptions {
    return this.outputOptions_;
  }
}
