# renderdag (TypeScript)

[![GitHub](https://img.shields.io/badge/github-geraschenko%2Frenderdag--ts-blue?logo=github)](https://github.com/geraschenko/renderdag-ts)
[![npm](https://img.shields.io/npm/v/@geraschenko/renderdag.svg)](https://www.npmjs.com/package/@geraschenko/renderdag)

A TypeScript port of Meta's [`sapling-renderdag`](https://github.com/facebook/sapling/tree/main/eden/scm/lib/renderdag) Rust crate: render a commit DAG into ASCII or Unicode text, one row at a time. Zero runtime dependencies.

This repo is almost entirely bot-generated, and I (human person) haven't carefully reviewed the ported code. It was ported from **facebook/sapling commit [`6ced9affa5ad992104f0cf798b7aab8928a56258`](https://github.com/facebook/sapling/commit/6ced9affa5ad992104f0cf798b7aab8928a56258)** (2026-07-16, the most recent commit touching `eden/scm/lib/renderdag` at the time of porting). The port is deliberately mechanical — file-for-file, function-for-function — so that updating it is a matter of reading `git diff <pinned>..<new> -- eden/scm/lib/renderdag` on the sapling side and mirroring the changes here. The pinned commit is also recorded in `vendor/SAPLING_COMMIT`.

## Usage

### Simple: the pipeline `GraphTextRenderer`

```ts
import { Ancestor, pipeline } from '@geraschenko/renderdag';

const renderer = new pipeline.GraphTextRenderer<string>(); // box drawing, curved
let out = '';
out += renderer.nextText('D', [Ancestor.parent('B'), Ancestor.parent('C')], 'o', 'commit D');
out += renderer.nextText('C', [Ancestor.parent('A')], 'o', 'commit C');
out += renderer.nextText('B', [Ancestor.parent('A')], 'o', 'commit B');
out += renderer.nextText('A', [], 'o', 'commit A');
```

`out` is now:

```
o    commit D
├─╮
│ o  commit C
│ │
o │  commit B
├─╯
o  commit A
```

Nodes are fed child-first (like `git log`). Parents are `Ancestor.parent(n)` (direct parent, solid edge), `Ancestor.ancestor(n)` (indirect ancestor, dotted edge), or `Ancestor.anonymous()` (edge terminated with `~`). Other prefix styles: `new pipeline.GraphTextRenderer(new pipeline.Ascii())`, `new pipeline.AsciiLarge()`, `new pipeline.BoxDrawing(SQUARE_GLYPHS | DEC_GLYPHS)`.

### Classic API (mirrors the Rust crate's compatibility surface)

```ts
import { Ancestor, GraphRowRenderer } from '@geraschenko/renderdag';

const renderer = new GraphRowRenderer<string>()
  .output()
  .withMinRowHeight(1)
  .withStaggerConsecutiveDisconnectedNodes(false)
  .buildBoxDrawing(); // or .buildAscii() / .buildAsciiLarge() / ...withSquareGlyphs()

renderer.reserve('G');                       // optionally pin a column
const w = renderer.width('C', parents);      // text width of the graph prefix
const row = renderer.nextRow('C', parents, 'o', 'commit C'); // -> string
```

### Structured output & custom renderers

The pipeline has three decoupled stages, and you can tap any of them:

1. `pipeline.GraphRowShaper` — `(node, parents)` stream → `GraphRowShape` (abstract columns: `nodeLine`, `linkLine` bitflags, `termLine`, `padLines`). This is the layout engine; use it directly if you want to render to HTML/SVG/canvas or your own cell grid.
2. A `PrefixLineRenderer` — `GraphRowShape` → `PrefixLine[]` (left-side graph prefixes with a glyph *slot*, no message yet). Implement this interface to define your own text style; `Ascii`, `AsciiLarge`, and `BoxDrawing` are the built-ins.
3. `pipeline.PrefixLinesToText` — `PrefixLine[]` + glyph + message → final text lines.

```ts
import { GraphRowRenderer, LinkLine } from '@geraschenko/renderdag';

const graph = new GraphRowRenderer<string>();
const row = graph.nextRow('C', parents, 'o', 'commit C'); // GraphRow<string>
// row.nodeLine: ('blank'|'ancestor'|'parent'|'node')[]
// row.linkLine: number[] | null — LinkLine bitflags, e.g.:
if (row.linkLine?.some((l) => LinkLine.intersects(l, LinkLine.ANY_MERGE))) { /* ... */ }
```

Node identity defaults to `===` (fine for string/number IDs). For object nodes, pass a custom equality function to the `GraphRowShaper` / `GraphRowRenderer` / `GraphTextRenderer` constructors.

## File mapping

Every `.ts` under `src/` is a port of the `.rs` of the same name under
`eden/scm/lib/renderdag/src/`, with functions in the same order. The exact
source file is named in a `// Port of …` comment at the top of each `.ts`. The
only rename is `lib.rs` → `index.ts`:

```
src/
├─ index.ts            (← lib.rs — the sole rename)
├─ render.ts
├─ column.ts
├─ output.ts
├─ pad.ts
├─ ascii.ts
├─ ascii_large.ts
├─ box_drawing.ts
├─ pipeline.ts
└─ pipeline/
   ├─ types.ts
   ├─ graph_to_row_shape.ts
   ├─ prefix_lines_to_text.ts
   ├─ graph_text_renderer.ts
   ├─ row_shape_to_prefix_lines.ts
   └─ row_shape_to_prefix_lines/
      ├─ ascii.ts
      ├─ ascii_large.ts
      └─ box_drawing.ts
```

(`test_fixtures.rs` / `test_utils.rs` are not ported; their content lives in `fixture-gen/src/main.rs`, which drives the real Rust crate instead.)

Intentional deviations, each marked with a `PORT NOTE` comment at the top of the affected file:

- `Ancestor`, `NodeLine`, `PadLine`, `LinkLine` are *defined* in `pipeline/types.ts` and re-exported by `render.ts` — the reverse of Rust — to avoid a circular ES-module dependency.
- Rust enums become discriminated unions (`Ancestor`, `Column`, `PrefixLinePart`) or string unions (`NodeLine`, `PadLine`, `PrefixLineKind`); the `LinkLine` bitflags become a plain `number` with a constants object (`LinkLine.intersects(a, b)` replaces `a.intersects(b)`).
- `BTreeMap<usize, _>` becomes `Map` + explicit key-sorted iteration (`sortedEntries`).
- The box-drawing phantom-type glyph selection (`Curved`/`Square`/`DecGraphics`) becomes a glyph-table constructor argument plus `withSquareGlyphs()` / `withDecGraphicsGlyphs()`.
- `output_options()` / `output_options_mut()` collapse into one `outputOptions()` returning the mutable options object; `&mut String` output parameters become a `StrBuf` (`{ value: string }`) holder.
- `str::lines()` and `str::trim_end()` are reproduced exactly (`rustLines`, `rustTrimEnd`) rather than using the subtly-different JS equivalents.

## How the port is verified

The point of this repo's structure is that "does the port behave exactly like the Rust crate?" is a *mechanical* question:

- `vendor/renderdag` + `vendor/drawdag` — verbatim copies of the Rust crates at the pinned commit (`vendor/SAPLING_COMMIT`; only `BUCK` files and `[dev-dependencies]` stripped).
- `fixture-gen/` — a small Rust binary that runs the **real vendored crate** over a corpus: the crate's own named test fixtures under a 7-way option matrix (including the explicit-order and missing-node variants from its unit tests) plus 200 seeded pseudo-random DAGs (merges up to 4 parents, ancestor/anonymous edges, reserved columns, staggered/dense modes, multi-line and empty messages, shuffled emission orders). It records every input and every output — rendered text for all five styles (`ascii`, `asciiLarge`, `boxCurved`, `boxSquare`, `boxDec`), `width()` results, and the structured `GraphRow` (link lines as raw bitflag numbers) — into `tests/fixtures/*.json`.
- `tests/fixtures.test.ts` — replays every step through the TypeScript port and asserts byte-identical text, identical widths, identical structured rows, and that the pipeline `GraphTextRenderer` agrees with the classic wrappers row-for-row.

Current corpus: 284 cases / 3,224 rendered rows. As a sanity check on the harness itself, a one-character mutation in the ASCII link-line renderer fails 185 of 284 cases.

```sh
npm test                 # replay golden fixtures against the TS port
npm run regen-fixtures   # re-run the Rust crate to regenerate them (needs cargo)
```

To eyeball the corpus itself, `scripts/dump-fixtures.mjs` renders every case in a
fixture file as a readable gallery (reconstructed from the recorded output — it
runs no rendering of its own):

```sh
node scripts/dump-fixtures.mjs random ascii   # or: named; style ∈ ascii|asciiLarge|boxCurved|boxSquare|boxDec
```

## Updating the port when upstream changes

1. Find the new target commit on the sapling side:
   `git log --format='%H %s' -- eden/scm/lib/renderdag`
2. Read the upstream change: `git diff <old-pinned>..<new> -- eden/scm/lib/renderdag`
   (old pinned hash is in `vendor/SAPLING_COMMIT`).
3. `[SAPLING_REPO=/path/to/repo] scripts/update-vendor.sh <new-commit>` — re-vendors the crates and updates the pin.
4. Mirror the Rust diff into the corresponding `src/*.ts` files (the file-for-file layout makes this near-mechanical).
5. `npm run regen-fixtures && npm test` — the fixtures are regenerated from the *new* Rust code, so any behavioral divergence in the port fails the suite.
6. Update the pinned commit hash at the top of this README.

## License

MIT, same as the upstream crate. This is a derivative work of
[facebook/sapling](https://github.com/facebook/sapling)'s `sapling-renderdag`;
see `LICENSE`.
