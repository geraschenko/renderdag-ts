// Port of eden/scm/lib/renderdag/src/pipeline/row_shape_to_prefix_lines/box_drawing.rs.
//
// PORT NOTE: Rust selects the glyph table with a phantom type parameter
// (`Curved` / `Square` / `DecGraphics`). Here the glyph table is a plain
// constructor argument (defaulting to `CURVED_GLYPHS`); the
// `withSquareGlyphs()` / `withDecGraphicsGlyphs()` methods return a renderer
// using the corresponding table.

import type { GraphRowShape, PadLine, PrefixLine, PrefixLineRenderer } from '../types.js';
import { LinkLine } from '../types.js';

export const glyph = {
  SPACE: 0,
  HORIZONTAL: 1,
  PARENT: 2,
  ANCESTOR: 3,
  MERGE_LEFT: 4,
  MERGE_RIGHT: 5,
  MERGE_BOTH: 6,
  FORK_LEFT: 7,
  FORK_RIGHT: 8,
  FORK_BOTH: 9,
  JOIN_LEFT: 10,
  JOIN_RIGHT: 11,
  JOIN_BOTH: 12,
  TERMINATION: 13,
  COUNT: 14,
} as const;

/// Glyph table used by box-drawing prefix line renderers.
export type BoxDrawingGlyphSet = readonly string[];

export const SQUARE_GLYPHS: BoxDrawingGlyphSet = [
  '  ',
  '──',
  '│ ',
  '· ',
  '┘ ',
  '└─',
  '┴─',
  '┐ ',
  '┌─',
  '┬─',
  '┤ ',
  '├─',
  '┼─',
  '~ ',
];

export const CURVED_GLYPHS: BoxDrawingGlyphSet = [
  '  ',
  '──',
  '│ ',
  '╷ ',
  '╯ ',
  '╰─',
  '┴─',
  '╮ ',
  '╭─',
  '┬─',
  '┤ ',
  '├─',
  '┼─',
  '~ ',
];

export const DEC_GLYPHS: BoxDrawingGlyphSet = [
  '  ',
  '\x1B(0qq\x1B(B',
  '\x1B(0x \x1B(B',
  '\x1B(0~ \x1B(B',
  '\x1B(0j \x1B(B',
  '\x1B(0mq\x1B(B',
  '\x1B(0vq\x1B(B',
  '\x1B(0k \x1B(B',
  '\x1B(0lq\x1B(B',
  '\x1B(0wq\x1B(B',
  '\x1B(0u \x1B(B',
  '\x1B(0tq\x1B(B',
  '\x1B(0nq\x1B(B',
  '~ ',
];

/// Converts abstract row shapes into box-drawing graph prefix lines.
export class BoxDrawingPrefixLineRenderer implements PrefixLineRenderer<unknown> {
  private readonly glyphs: BoxDrawingGlyphSet;

  /// Create a renderer that uses the given glyph table (default: curved).
  constructor(glyphs: BoxDrawingGlyphSet = CURVED_GLYPHS) {
    this.glyphs = glyphs;
  }

  /// Use square box-drawing glyphs.
  withSquareGlyphs(): BoxDrawingPrefixLineRenderer {
    return new BoxDrawingPrefixLineRenderer(SQUARE_GLYPHS);
  }

  /// Use DEC special graphics glyphs.
  withDecGraphicsGlyphs(): BoxDrawingPrefixLineRenderer {
    return new BoxDrawingPrefixLineRenderer(DEC_GLYPHS);
  }

  /// Convert the next graph row shape into prefix lines.
  nextPrefixLines<N>(line: GraphRowShape<N>): PrefixLine[] {
    const glyphs = this.glyphs;
    const lines: PrefixLine[] = [];

    // Render the nodeline
    const nodeLine: PrefixLine = { parts: [], kind: 'node' };
    for (const entry of line.nodeLine) {
      switch (entry) {
        case 'node':
          nodeLine.parts.push({ type: 'nodeGlyph' });
          nodeLine.parts.push({ type: 'text', text: ' ' });
          break;
        case 'parent':
          pushText(nodeLine, glyphs[glyph.PARENT]);
          break;
        case 'ancestor':
          pushText(nodeLine, glyphs[glyph.ANCESTOR]);
          break;
        case 'blank':
          pushText(nodeLine, glyphs[glyph.SPACE]);
          break;
      }
    }
    lines.push(nodeLine);

    // Render the link line
    if (line.linkLine !== null) {
      let linkLine = '';
      for (const cur of line.linkLine) {
        if (LinkLine.intersects(cur, LinkLine.HORIZONTAL)) {
          if (LinkLine.intersects(cur, LinkLine.CHILD)) {
            linkLine += glyphs[glyph.JOIN_BOTH];
          } else if (
            LinkLine.intersects(cur, LinkLine.ANY_FORK) &&
            LinkLine.intersects(cur, LinkLine.ANY_MERGE)
          ) {
            linkLine += glyphs[glyph.JOIN_BOTH];
          } else if (
            LinkLine.intersects(cur, LinkLine.ANY_FORK) &&
            LinkLine.intersects(cur, LinkLine.VERT_PARENT) &&
            !line.merge
          ) {
            linkLine += glyphs[glyph.JOIN_BOTH];
          } else if (LinkLine.intersects(cur, LinkLine.ANY_FORK)) {
            linkLine += glyphs[glyph.FORK_BOTH];
          } else if (LinkLine.intersects(cur, LinkLine.ANY_MERGE)) {
            linkLine += glyphs[glyph.MERGE_BOTH];
          } else {
            linkLine += glyphs[glyph.HORIZONTAL];
          }
        } else if (LinkLine.intersects(cur, LinkLine.VERT_PARENT) && !line.merge) {
          const left = LinkLine.intersects(cur, LinkLine.LEFT_MERGE | LinkLine.LEFT_FORK);
          const right = LinkLine.intersects(cur, LinkLine.RIGHT_MERGE | LinkLine.RIGHT_FORK);
          if (left && right) {
            linkLine += glyphs[glyph.JOIN_BOTH];
          } else if (left) {
            linkLine += glyphs[glyph.JOIN_LEFT];
          } else if (right) {
            linkLine += glyphs[glyph.JOIN_RIGHT];
          } else {
            linkLine += glyphs[glyph.PARENT];
          }
        } else if (
          LinkLine.intersects(cur, LinkLine.VERT_PARENT | LinkLine.VERT_ANCESTOR) &&
          !LinkLine.intersects(cur, LinkLine.LEFT_FORK | LinkLine.RIGHT_FORK)
        ) {
          const left = LinkLine.intersects(cur, LinkLine.LEFT_MERGE);
          const right = LinkLine.intersects(cur, LinkLine.RIGHT_MERGE);
          if (left && right) {
            linkLine += glyphs[glyph.JOIN_BOTH];
          } else if (left) {
            linkLine += glyphs[glyph.JOIN_LEFT];
          } else if (right) {
            linkLine += glyphs[glyph.JOIN_RIGHT];
          } else {
            if (LinkLine.intersects(cur, LinkLine.VERT_ANCESTOR)) {
              linkLine += glyphs[glyph.ANCESTOR];
            } else {
              linkLine += glyphs[glyph.PARENT];
            }
          }
        } else if (
          LinkLine.intersects(cur, LinkLine.LEFT_FORK) &&
          LinkLine.intersects(cur, LinkLine.LEFT_MERGE | LinkLine.CHILD)
        ) {
          linkLine += glyphs[glyph.JOIN_LEFT];
        } else if (
          LinkLine.intersects(cur, LinkLine.RIGHT_FORK) &&
          LinkLine.intersects(cur, LinkLine.RIGHT_MERGE | LinkLine.CHILD)
        ) {
          linkLine += glyphs[glyph.JOIN_RIGHT];
        } else if (
          LinkLine.intersects(cur, LinkLine.LEFT_MERGE) &&
          LinkLine.intersects(cur, LinkLine.RIGHT_MERGE)
        ) {
          linkLine += glyphs[glyph.MERGE_BOTH];
        } else if (
          LinkLine.intersects(cur, LinkLine.LEFT_FORK) &&
          LinkLine.intersects(cur, LinkLine.RIGHT_FORK)
        ) {
          linkLine += glyphs[glyph.FORK_BOTH];
        } else if (LinkLine.intersects(cur, LinkLine.LEFT_FORK)) {
          linkLine += glyphs[glyph.FORK_LEFT];
        } else if (LinkLine.intersects(cur, LinkLine.LEFT_MERGE)) {
          linkLine += glyphs[glyph.MERGE_LEFT];
        } else if (LinkLine.intersects(cur, LinkLine.RIGHT_FORK)) {
          linkLine += glyphs[glyph.FORK_RIGHT];
        } else if (LinkLine.intersects(cur, LinkLine.RIGHT_MERGE)) {
          linkLine += glyphs[glyph.MERGE_RIGHT];
        } else {
          linkLine += glyphs[glyph.SPACE];
        }
      }
      lines.push({ parts: [{ type: 'text', text: linkLine }], kind: 'link' });
    }

    // Render the term line
    if (line.termLine !== null) {
      const termRow = line.termLine;
      const termStrs = [glyphs[glyph.PARENT], glyphs[glyph.TERMINATION]];
      for (const termStr of termStrs) {
        let termLine = '';
        for (let i = 0; i < termRow.length; i++) {
          if (termRow[i]) {
            termLine += termStr;
          } else {
            termLine += glyphs[padLineToGlyph(line.padLines[i])];
          }
        }
        lines.push({ parts: [{ type: 'text', text: termLine }], kind: 'term' });
      }
    }

    let basePadLine = '';
    for (const entry of line.padLines) {
      basePadLine += glyphs[padLineToGlyph(entry)];
    }
    lines.push({ parts: [{ type: 'text', text: basePadLine }], kind: 'postAncestry' });

    return lines;
  }
}

function pushText(line: PrefixLine, text: string): void {
  line.parts.push({ type: 'text', text });
}

function padLineToGlyph(line: PadLine): number {
  switch (line) {
    case 'parent':
      return glyph.PARENT;
    case 'ancestor':
      return glyph.ANCESTOR;
    case 'blank':
      return glyph.SPACE;
  }
}
