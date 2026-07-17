// Port of eden/scm/lib/renderdag/src/ascii_large.rs.

import { PrefixLinesToText } from './pipeline/prefix_lines_to_text.js';
import { AsciiLargePrefixLineRenderer } from './pipeline/row_shape_to_prefix_lines/ascii_large.js';
import type { GraphRowShape } from './pipeline/types.js';
import type { Ancestor } from './pipeline/types.js';
import type { OutputRendererOptions } from './output.js';
import type { GraphRow, Renderer } from './render.js';

export class AsciiLargeRenderer<N> implements Renderer<N, string> {
  private inner: Renderer<N, GraphRow<N>>;
  private prefixLines = new AsciiLargePrefixLineRenderer();
  private text = new PrefixLinesToText();

  constructor(inner: Renderer<N, GraphRow<N>>) {
    this.inner = inner;
  }

  private options(): OutputRendererOptions {
    return this.inner.outputOptions();
  }

  width(node: N | null | undefined, parents: readonly Ancestor<N>[] | null | undefined): number {
    // The first column is only 2 characters wide.
    return Math.max(0, this.inner.width(node, parents) * 3 - 1) + 1;
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
