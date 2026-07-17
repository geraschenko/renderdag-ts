// Render every fixture case in tests/fixtures/<file>.json as a human-readable
// gallery, so the corpus can be eyeballed. Each case's graph is reconstructed
// by concatenating the per-row `out` the harness already recorded (no
// rendering happens here — this shows exactly what the golden fixtures assert).
//
// Usage:
//   node scripts/dump-fixtures.mjs [random|named] [style] > gallery.txt
//   style ∈ ascii | asciiLarge | boxCurved | boxSquare | boxDec   (default ascii)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? 'random';
const style = process.argv[3] ?? 'ascii';

const cases = JSON.parse(
  readFileSync(join(here, '..', 'tests', 'fixtures', `${file}.json`), 'utf8'),
);

function describeParents(parents) {
  if (!parents || parents.length === 0) return '(root)';
  return parents
    .map((p) => (p[0] === 'anonymous' ? '~' : p[0] === 'ancestor' ? `${p[1]}(anc)` : p[1]))
    .join(', ');
}

for (const c of cases) {
  const rows = c.steps.filter((s) => s.type === 'row');
  const reserves = c.steps.filter((s) => s.type === 'reserve');
  const edges = rows.reduce((n, r) => n + (r.parents?.length ?? 0), 0);
  const merges = rows.filter((r) => (r.parents?.length ?? 0) >= 2).length;

  const header =
    `### ${c.name}  ` +
    `[minRowHeight=${c.options.minRowHeight} stagger=${c.options.stagger}]  ` +
    `${rows.length} nodes, ${edges} edges, ${merges} merges` +
    (reserves.length ? `, ${reserves.length} reserves` : '');
  process.stdout.write(`${header}\n`);
  process.stdout.write(`${'-'.repeat(header.length)}\n`);

  for (const s of c.steps) {
    if (s.type === 'reserve') {
      process.stdout.write(`    · reserve ${s.node}\n`);
      continue;
    }
    process.stdout.write(s.expect.text[style].out);
  }
  process.stdout.write('\n');
}
