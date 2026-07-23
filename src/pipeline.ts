// Port of eden/scm/lib/renderdag/src/pipeline.rs.
//
// Render a DAG into text using a pipeline:
//
// 1. Node stream `(node, parents)` -> `GraphRowShape`.
//    Computes edge shapes and column layout.
// 2. `GraphRowShape`s -> `PrefixLine`s.
//    Converts abstract graph rows into left-side graph prefixes.
//    Does not know about messages or node glyphs.
// 3. `PrefixLine`s + glyph + message -> text.
//    Produces the final lines by filling the glyph, repeating prefixes,
//    and placing message text.
//
// Design principle: minimal coupling -> reusable, cacheable.

export * as graph_text_renderer from './pipeline/graph_text_renderer.js';
export * as graph_to_row_shape from './pipeline/graph_to_row_shape.js';
export * as prefix_lines_to_text from './pipeline/prefix_lines_to_text.js';
export * as row_shape_to_prefix_lines from './pipeline/row_shape_to_prefix_lines.js';
export * as types from './pipeline/types.js';

// re-export
export { GraphTextRenderer } from './pipeline/graph_text_renderer.js';
export { GraphRowShaper } from './pipeline/graph_to_row_shape.js';
export { PrefixLinesToText } from './pipeline/prefix_lines_to_text.js';
export { AsciiPrefixLineRenderer as Ascii } from './pipeline/row_shape_to_prefix_lines/ascii.js';
export { AsciiLargePrefixLineRenderer as AsciiLarge } from './pipeline/row_shape_to_prefix_lines/ascii_large.js';
export { BoxDrawingPrefixLineRenderer as BoxDrawing } from './pipeline/row_shape_to_prefix_lines/box_drawing.js';
export type { PrefixLineRenderer } from './pipeline/types.js';

// PORT NOTE: The following re-exports have no counterpart in pipeline.rs.
// In Rust these are all nameable as `pipeline::types::*` because `types` is a
// `pub mod`; they are re-exported here so the types mentioned in the public
// signatures above (`PrefixLineRenderer`, `GraphRowShaper`) are nameable
// without reaching through the `types` namespace. `isRepeatable` is a free
// function in this port (an inherent method on `PrefixLineKind` in Rust), so
// it must be exported as a value explicitly.
export { isRepeatable } from './pipeline/types.js';
export type {
  GraphRowShape,
  GraphRowShapeOptions,
  PrefixLine,
  PrefixLineKind,
  PrefixLinePart,
} from './pipeline/types.js';
