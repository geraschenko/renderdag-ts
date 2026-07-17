// Port of eden/scm/lib/renderdag/src/pipeline/prefix_lines_to_text.rs.

import { OutputRendererState } from '../output.js';
import type { StrBuf } from '../output.js';
import { padLines, rustLines } from '../pad.js';
import type { PrefixLine } from './types.js';
import { isRepeatable } from './types.js';

/// Stateful renderer for the final pipeline stage.
///
/// It fills node glyph slots, attaches message lines, and writes complete text
/// lines for one rendered graph row at a time.
export class PrefixLinesToText {
  private state = new OutputRendererState();

  /// Render the next row of prefix lines into a string.
  nextText(
    prefixLines: PrefixLine[],
    separatorLine: boolean,
    glyph: string,
    message: string,
    minRowHeight: number,
  ): string {
    const out: StrBuf = { value: '' };
    this.writeNextText(out, prefixLines, separatorLine, glyph, message, minRowHeight);
    return out.value;
  }

  /// Write the next row of prefix lines into `out`.
  writeNextText(
    out: StrBuf,
    prefixLines: PrefixLine[],
    separatorLine: boolean,
    glyph: string,
    message: string,
    minRowHeight: number,
  ): void {
    const messageLines = padLines(rustLines(message), minRowHeight);
    let repeatableLine: PrefixLine | null = null;
    let hasTermRow = false;

    this.state.beginRow(out, separatorLine);

    for (const prefixLine of prefixLines) {
      if (isRepeatable(prefixLine.kind)) {
        repeatableLine = prefixLine;
        continue;
      }
      hasTermRow = hasTermRow || prefixLine.kind === 'term';
      const text = renderPrefixLine(prefixLine, glyph);
      const next = messageLines.next();
      this.state.pushLineWithMessage(out, text, next.done ? undefined : next.value);
    }

    if (repeatableLine !== null) {
      const baseLine = renderPrefixLine(repeatableLine, glyph);
      if (!this.state.pushPadLines(out, baseLine, messageLines) && hasTermRow) {
        this.state.queuePadLine(baseLine);
      }
    }
  }
}

function renderPrefixLine(prefixLine: PrefixLine, glyph: string): string {
  let out = '';
  for (const part of prefixLine.parts) {
    switch (part.type) {
      case 'text':
        out += part.text;
        break;
      case 'nodeGlyph':
        out += glyph;
        break;
    }
  }
  return out;
}
