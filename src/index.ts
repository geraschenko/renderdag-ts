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
