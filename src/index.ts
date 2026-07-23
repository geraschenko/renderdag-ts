// Port of eden/scm/lib/renderdag/src/lib.rs.

/// `pipeline` module provides more flexible APIs.
/// It's the main implementation.
/// See module docstring for details.
export * as pipeline from './pipeline.js';

// Original APIs for compatibility.
// Delegate to pipeline APIs.
export { AsciiRenderer } from './ascii.js';
export { AsciiLargeRenderer } from './ascii_large.js';
export { BoxDrawingRenderer } from './box_drawing.js';
export { OutputRendererBuilder, defaultOutputRendererOptions } from './output.js';
export type { OutputRendererOptions, StrBuf } from './output.js';
export { Ancestor, LinkLine } from './pipeline/types.js';
export type { NodeLine, PadLine } from './pipeline/types.js';
export { GraphRowRenderer } from './render.js';
export type { GraphRow, Renderer } from './render.js';

// TS-side ergonomic additions; not mirrored in lib.rs.
// Rust consumers name these as `renderdag::pipeline::types::*`. npm consumers
// expect to import types used in their signatures from the package root, so
// the pipeline types are additionally re-exported here.
export { isRepeatable } from './pipeline/types.js';
export type {
  GraphRowShape,
  GraphRowShapeOptions,
  PrefixLine,
  PrefixLineKind,
  PrefixLinePart,
} from './pipeline/types.js';
