// Port of eden/scm/lib/renderdag/src/pipeline/row_shape_to_prefix_lines/ascii.rs.

import type { GraphRowShape, PrefixLine, PrefixLineRenderer } from '../types.js';
import { LinkLine } from '../types.js';

/// Converts abstract row shapes into ASCII graph prefix lines.
export class AsciiPrefixLineRenderer implements PrefixLineRenderer<unknown> {
  /// Convert the next graph row shape into prefix lines.
  nextPrefixLines<N>(line: GraphRowShape<N>): PrefixLine[] {
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
          pushText(nodeLine, '| ');
          break;
        case 'ancestor':
          pushText(nodeLine, '. ');
          break;
        case 'blank':
          pushText(nodeLine, '  ');
          break;
      }
    }
    lines.push(nodeLine);

    // Render the link line
    if (line.linkLine !== null) {
      const linkRow = line.linkLine;
      let linkLine = '';
      const anyHorizontal = linkRow.some((cur) => LinkLine.intersects(cur, LinkLine.HORIZONTAL));
      for (let i = 0; i < linkRow.length; i++) {
        const cur = linkRow[i];
        const next = i + 1 < linkRow.length ? linkRow[i + 1] : LinkLine.EMPTY;
        // Draw the parent/ancestor line.
        if (LinkLine.intersects(cur, LinkLine.HORIZONTAL)) {
          if (LinkLine.intersects(cur, LinkLine.CHILD | LinkLine.ANY_FORK_OR_MERGE)) {
            linkLine += '+';
          } else {
            linkLine += '-';
          }
        } else if (LinkLine.intersects(cur, LinkLine.VERTICAL)) {
          if (LinkLine.intersects(cur, LinkLine.ANY_FORK_OR_MERGE) && anyHorizontal) {
            linkLine += '+';
          } else if (LinkLine.intersects(cur, LinkLine.VERT_PARENT)) {
            linkLine += '|';
          } else {
            linkLine += '.';
          }
        } else if (LinkLine.intersects(cur, LinkLine.ANY_MERGE) && anyHorizontal) {
          linkLine += "'";
        } else if (LinkLine.intersects(cur, LinkLine.ANY_FORK) && anyHorizontal) {
          linkLine += '.';
        } else {
          linkLine += ' ';
        }

        // Draw the connecting line.
        if (LinkLine.intersects(cur, LinkLine.HORIZONTAL)) {
          linkLine += '-';
        } else if (LinkLine.intersects(cur, LinkLine.RIGHT_MERGE)) {
          if (LinkLine.intersects(next, LinkLine.LEFT_FORK) && !anyHorizontal) {
            linkLine += '\\';
          } else {
            linkLine += '-';
          }
        } else if (LinkLine.intersects(cur, LinkLine.RIGHT_FORK)) {
          if (LinkLine.intersects(next, LinkLine.LEFT_MERGE) && !anyHorizontal) {
            linkLine += '/';
          } else {
            linkLine += '-';
          }
        } else {
          linkLine += ' ';
        }
      }
      lines.push({ parts: [{ type: 'text', text: linkLine }], kind: 'link' });
    }

    // Render the term line
    if (line.termLine !== null) {
      const termRow = line.termLine;
      const termStrs = ['| ', '~ '];
      for (const termStr of termStrs) {
        let termLine = '';
        for (let i = 0; i < termRow.length; i++) {
          if (termRow[i]) {
            termLine += termStr;
          } else {
            switch (line.padLines[i]) {
              case 'parent':
                termLine += '| ';
                break;
              case 'ancestor':
                termLine += '. ';
                break;
              case 'blank':
                termLine += '  ';
                break;
            }
          }
        }
        lines.push({ parts: [{ type: 'text', text: termLine }], kind: 'term' });
      }
    }

    let basePadLine = '';
    for (const entry of line.padLines) {
      switch (entry) {
        case 'parent':
          basePadLine += '| ';
          break;
        case 'ancestor':
          basePadLine += '. ';
          break;
        case 'blank':
          basePadLine += '  ';
          break;
      }
    }
    lines.push({ parts: [{ type: 'text', text: basePadLine }], kind: 'postAncestry' });

    return lines;
  }
}

function pushText(line: PrefixLine, text: string): void {
  line.parts.push({ type: 'text', text });
}
