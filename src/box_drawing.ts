// Port of eden/scm/lib/renderdag/src/box_drawing.rs.
//
// PORT NOTE: the Rust phantom-type glyph selection becomes an internal
// glyph-table swap; `withSquareGlyphs()` / `withDecGraphicsGlyphs()` return
// the same renderer object with the glyph table replaced (the Rust versions
// consume `self` and rebuild, preserving inner state — equivalent behavior).

import { PrefixLinesToText } from './pipeline/prefix_lines_to_text.js';
import { BoxDrawingPrefixLineRenderer } from './pipeline/row_shape_to_prefix_lines/box_drawing.js';
import type { GraphRowShape } from './pipeline/types.js';
import type { Ancestor } from './pipeline/types.js';
import type { OutputRendererOptions } from './output.js';
import type { GraphRow, Renderer } from './render.js';

export class BoxDrawingRenderer<N> implements Renderer<N, string> {
  private inner: Renderer<N, GraphRow<N>>;
  private prefixLines = new BoxDrawingPrefixLineRenderer();
  private text = new PrefixLinesToText();

  constructor(inner: Renderer<N, GraphRow<N>>) {
    this.inner = inner;
  }

  withSquareGlyphs(): this {
    this.prefixLines = this.prefixLines.withSquareGlyphs();
    return this;
  }

  withDecGraphicsGlyphs(): this {
    this.prefixLines = this.prefixLines.withDecGraphicsGlyphs();
    return this;
  }

  private options(): OutputRendererOptions {
    return this.inner.outputOptions();
  }

  width(node: N | null | undefined, parents: readonly Ancestor<N>[] | null | undefined): number {
    return this.inner.width(node, parents) * 2 + 1;
  }

  reserve(node: N): void {
    this.inner.reserve(node);
  }

  nextRow(node: N, parents: Ancestor<N>[], glyph: string, message: string): string {
    const line = this.inner.nextRow(node, parents, glyph, message);
    const separatorLine = line.separatorLine;
    const rowShape: GraphRowShape<N> = {
      node: line.node,
      merge: line.merge,
      separatorLine,
      nodeLine: line.nodeLine,
      linkLine: line.linkLine,
      termLine: line.termLine,
      padLines: line.padLines,
    };
    const prefixLines = this.prefixLines.nextPrefixLines(rowShape);
    return this.text.nextText(
      prefixLines,
      separatorLine,
      line.glyph,
      line.message,
      this.options().minRowHeight,
    );
  }

  outputOptions(): OutputRendererOptions {
    return this.inner.outputOptions();
  }
}
