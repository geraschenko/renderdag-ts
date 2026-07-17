// Port of eden/scm/lib/renderdag/src/pipeline/graph_text_renderer.rs.
//
// PORT NOTE: Rust's `GraphTextRenderer::new::<P>()` turbofish becomes an
// optional constructor argument (default: box-drawing, curved glyphs), and
// Rust's `Box<dyn PrefixLineRenderer>` is simply the interface value.

import type { Eq } from '../column.js';
import { GraphRowShaper } from './graph_to_row_shape.js';
import { PrefixLinesToText } from './prefix_lines_to_text.js';
import { BoxDrawingPrefixLineRenderer } from './row_shape_to_prefix_lines/box_drawing.js';
import type { Ancestor, GraphRowShapeOptions, PrefixLine, PrefixLineRenderer } from './types.js';
import type { StrBuf } from '../output.js';

/// A convenience renderer that runs all text rendering pipeline stages.
///
/// This keeps the individual pipeline stages available for callers that need
/// to cache or replace one stage, while keeping the common streaming text path
/// short.
export class GraphTextRenderer<N> {
  private rowShaper: GraphRowShaper<N>;
  private prefixLines: PrefixLineRenderer<N>;
  private text = new PrefixLinesToText();

  /// Create a text renderer.
  /// (Rust: `new::<P>()` / `with_prefix_lines(prefix_lines)` / `default()`.)
  constructor(prefixLines?: PrefixLineRenderer<N>, eq?: Eq<N>) {
    this.rowShaper = new GraphRowShaper<N>(undefined, eq);
    this.prefixLines = prefixLines ?? new BoxDrawingPrefixLineRenderer();
  }

  /// Configure options.
  configure(func: (options: GraphRowShapeOptions) => void): this {
    func(this.rowShaper.optionsMut());
    return this;
  }

  /// Reserve a column for a node before it is rendered.
  reserve(node: N): void {
    this.rowShaper.reserve(node);
  }

  /// Render the next node into text.
  nextText(node: N, parents: Ancestor<N>[], glyph: string, message: string): string {
    const out: StrBuf = { value: '' };
    this.writeNextText(out, node, parents, glyph, message);
    return out.value;
  }

  /// Write the next rendered node into `out`.
  writeNextText(
    out: StrBuf,
    node: N,
    parents: Ancestor<N>[],
    glyph: string,
    message: string,
  ): void {
    const rowShape = this.rowShaper.nextRowShape(node, parents);
    const separatorLine = rowShape.separatorLine;
    const prefixLines = this.prefixLines.nextPrefixLines(rowShape);
    this.text.writeNextText(
      out,
      prefixLines,
      separatorLine,
      glyph,
      message,
      this.rowShaper.options().minRowHeight,
    );
  }

  /// Calculate the next prefix lines.
  nextPrefixLines(node: N, parents: Ancestor<N>[]): PrefixLine[] {
    const rowShape = this.rowShaper.nextRowShape(node, parents);
    return this.prefixLines.nextPrefixLines(rowShape);
  }
}
