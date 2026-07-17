// Port of eden/scm/lib/renderdag/src/pad.rs, plus a helper reproducing
// Rust's `str::lines()` semantics exactly.

/// Reproduce Rust's `str::lines()`:
/// - splits on `\n`,
/// - strips a trailing `\r` from each line,
/// - a final trailing newline does not produce a trailing empty line,
/// - the empty string yields no lines.
export function rustLines(s: string): string[] {
  if (s === '') {
    return [];
  }
  const lines = s.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

/// Pad `lines` to have `min_count` lines at least.
/// (Rust: `pad_lines` returning the `PadLines` iterator.)
export function* padLines(
  lines: Iterable<string>,
  minCount: number,
): Generator<string, void, void> {
  let index = 0;
  for (const line of lines) {
    index += 1;
    yield line;
  }
  while (index < minCount) {
    index += 1;
    yield '';
  }
}
