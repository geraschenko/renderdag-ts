// Port of eden/scm/lib/renderdag/src/pipeline/row_shape_to_prefix_lines/ascii_large.rs.

import type { GraphRowShape, PrefixLine, PrefixLineRenderer } from '../types.js';
import { LinkLine } from '../types.js';

/// Converts abstract row shapes into large ASCII graph prefix lines.
export class AsciiLargePrefixLineRenderer implements PrefixLineRenderer<unknown> {
  /// Convert the next graph row shape into prefix lines.
  nextPrefixLines<N>(line: GraphRowShape<N>): PrefixLine[] {
    const lines: PrefixLine[] = [];

    // Render the nodeline
    const nodeLine: PrefixLine = { parts: [], kind: 'node' };
    for (let i = 0; i < line.nodeLine.length; i++) {
      const entry = line.nodeLine[i];
      switch (entry) {
        case 'node':
          if (i > 0) {
            nodeLine.parts.push({ type: 'text', text: ' ' });
          }
          nodeLine.parts.push({ type: 'nodeGlyph' });
          nodeLine.parts.push({ type: 'text', text: ' ' });
          break;
        case 'parent':
          pushText(nodeLine, i > 0 ? ' | ' : '| ');
          break;
        case 'ancestor':
          pushText(nodeLine, i > 0 ? ' . ' : '. ');
          break;
        case 'blank':
          pushText(nodeLine, i > 0 ? '   ' : '  ');
          break;
      }
    }
    lines.push(nodeLine);

    // Render the link line
    if (line.linkLine !== null) {
      const linkRow = line.linkLine;
      let topLinkLine = '';
      let botLinkLine = '';
      for (let i = 0; i < linkRow.length; i++) {
        const cur = linkRow[i];
        // Top left
        if (i > 0) {
          if (LinkLine.intersects(cur, LinkLine.LEFT_MERGE_PARENT)) {
            topLinkLine += '/';
          } else if (LinkLine.intersects(cur, LinkLine.LEFT_MERGE_ANCESTOR)) {
            topLinkLine += '.';
          } else if (LinkLine.intersects(cur, LinkLine.HORIZ_PARENT)) {
            topLinkLine += '_';
          } else if (LinkLine.intersects(cur, LinkLine.HORIZ_ANCESTOR)) {
            topLinkLine += '.';
          } else {
            topLinkLine += ' ';
          }
        }

        // Top center
        if (LinkLine.intersects(cur, LinkLine.VERT_PARENT)) {
          topLinkLine += '|';
        } else if (LinkLine.intersects(cur, LinkLine.VERT_ANCESTOR)) {
          topLinkLine += '.';
        } else if (LinkLine.intersects(cur, LinkLine.ANY_MERGE)) {
          topLinkLine += ' ';
        } else if (LinkLine.intersects(cur, LinkLine.HORIZ_PARENT)) {
          topLinkLine += '_';
        } else if (LinkLine.intersects(cur, LinkLine.HORIZ_ANCESTOR)) {
          topLinkLine += '.';
        } else {
          topLinkLine += ' ';
        }

        // Top right
        if (LinkLine.intersects(cur, LinkLine.RIGHT_MERGE_PARENT)) {
          topLinkLine += '\\';
        } else if (LinkLine.intersects(cur, LinkLine.RIGHT_MERGE_ANCESTOR)) {
          topLinkLine += '.';
        } else if (LinkLine.intersects(cur, LinkLine.HORIZ_PARENT)) {
          topLinkLine += '_';
        } else if (LinkLine.intersects(cur, LinkLine.HORIZ_ANCESTOR)) {
          topLinkLine += '.';
        } else {
          topLinkLine += ' ';
        }

        // Bottom left
        if (i > 0) {
          if (LinkLine.intersects(cur, LinkLine.LEFT_FORK_PARENT)) {
            botLinkLine += '\\';
          } else if (LinkLine.intersects(cur, LinkLine.LEFT_FORK_ANCESTOR)) {
            botLinkLine += '.';
          } else {
            botLinkLine += ' ';
          }
        }

        // Bottom center
        if (LinkLine.intersects(cur, LinkLine.VERT_PARENT)) {
          botLinkLine += '|';
        } else if (LinkLine.intersects(cur, LinkLine.VERT_ANCESTOR)) {
          botLinkLine += '.';
        } else {
          botLinkLine += ' ';
        }

        // Bottom Right
        if (LinkLine.intersects(cur, LinkLine.RIGHT_FORK_PARENT)) {
          botLinkLine += '/';
        } else if (LinkLine.intersects(cur, LinkLine.RIGHT_FORK_ANCESTOR)) {
          botLinkLine += '.';
        } else {
          botLinkLine += ' ';
        }
      }
      lines.push({ parts: [{ type: 'text', text: topLinkLine }], kind: 'link' });
      lines.push({ parts: [{ type: 'text', text: botLinkLine }], kind: 'link' });
    }

    // Render the term line
    if (line.termLine !== null) {
      const termRow = line.termLine;
      const termStrs = ['| ', '~ '];
      for (const termStr of termStrs) {
        let termLine = '';
        for (let i = 0; i < termRow.length; i++) {
          if (i > 0) {
            termLine += ' ';
          }
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
    for (let i = 0; i < line.padLines.length; i++) {
      switch (line.padLines[i]) {
        case 'parent':
          basePadLine += i > 0 ? ' | ' : '| ';
          break;
        case 'ancestor':
          basePadLine += i > 0 ? ' . ' : '. ';
          break;
        case 'blank':
          basePadLine += i > 0 ? '   ' : '  ';
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
