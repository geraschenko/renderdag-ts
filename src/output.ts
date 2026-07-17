// Port of eden/scm/lib/renderdag/src/output.rs.
//
// PORT NOTE: Rust's `&mut String` output parameter becomes a `StrBuf`
// holder object (`{ value: string }`). Rust's `output_options_mut()` /
// `output_options()` pair becomes a single `outputOptions()` returning the
// mutable options object.

import { AsciiRenderer } from './ascii.js';
import { AsciiLargeRenderer } from './ascii_large.js';
import { BoxDrawingRenderer } from './box_drawing.js';
import type { GraphRow, Renderer } from './render.js';

export const DEFAULT_MIN_ROW_HEIGHT = 2;

export interface OutputRendererOptions {
  minRowHeight: number;
  staggerConsecutiveDisconnectedNodes: boolean;
}

/// Rust: `OutputRendererOptions::default()`
export function defaultOutputRendererOptions(): OutputRendererOptions {
  return {
    minRowHeight: DEFAULT_MIN_ROW_HEIGHT,
    staggerConsecutiveDisconnectedNodes: false,
  };
}

/// Mutable string output buffer (stand-in for Rust's `&mut String`).
export interface StrBuf {
  value: string;
}

/// Reproduce Rust's `str::trim_end()` exactly (Unicode `White_Space`
/// property). Note this differs slightly from JS `String.prototype.trimEnd`,
/// which also trims U+FEFF but not U+0085.
const RUST_TRIM_END_RE =
  /[\t\n\u000B\f\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/;

export function rustTrimEnd(s: string): string {
  return s.replace(RUST_TRIM_END_RE, '');
}

/// Common stateful string line output utilities shared by ASCII and
/// box-drawing renderers.
export class OutputRendererState {
  private queuedPadLine: string | null = null;
  /// If > 1, no need for an extra separator for the next row.
  /// Separator is only needed for adjacent single-line node lines.
  /// If there are link, pad, term, or other kinds of node lines,
  /// no need to draw separator.
  private rowHeight = 0;

  beginRow(out: StrBuf, separatorLine: boolean): void {
    this.flushQueuedPadLine(out);
    if (separatorLine && this.rowHeight === 1) {
      this.pushLine(out, '');
    }
    this.rowHeight = 0;
  }

  pushLineWithMessage(out: StrBuf, line: string, message: string | undefined): void {
    if (message !== undefined) {
      line = line + ' ' + message;
    }
    this.pushLine(out, line);
  }

  pushPadLines(out: StrBuf, basePadLine: string, messageLines: Iterator<string>): boolean {
    let emitted = false;
    for (let next = messageLines.next(); !next.done; next = messageLines.next()) {
      const padLine = basePadLine + ' ' + next.value;
      this.pushLine(out, padLine);
      emitted = true;
    }
    return emitted;
  }

  queuePadLine(padLine: string): void {
    this.queuedPadLine = padLine;
  }

  private pushLine(out: StrBuf, line: string): void {
    out.value += rustTrimEnd(line);
    out.value += '\n';
    this.rowHeight += 1;
  }

  private flushQueuedPadLine(out: StrBuf): void {
    if (this.queuedPadLine !== null) {
      const padLine = this.queuedPadLine;
      this.queuedPadLine = null;
      this.pushLine(out, padLine);
    }
  }
}

export class OutputRendererBuilder<N, R extends Renderer<N, GraphRow<N>>> {
  private inner: R;

  constructor(inner: R) {
    this.inner = inner;
  }

  withOptions(options: OutputRendererOptions): this {
    Object.assign(this.inner.outputOptions(), options);
    return this;
  }

  withMinRowHeight(minRowHeight: number): this {
    this.inner.outputOptions().minRowHeight = minRowHeight;
    return this;
  }

  withStaggerConsecutiveDisconnectedNodes(stagger: boolean): this {
    this.inner.outputOptions().staggerConsecutiveDisconnectedNodes = stagger;
    return this;
  }

  buildAscii(): AsciiRenderer<N> {
    return new AsciiRenderer<N>(this.inner);
  }

  buildAsciiLarge(): AsciiLargeRenderer<N> {
    return new AsciiLargeRenderer<N>(this.inner);
  }

  buildBoxDrawing(): BoxDrawingRenderer<N> {
    return new BoxDrawingRenderer<N>(this.inner);
  }
}
