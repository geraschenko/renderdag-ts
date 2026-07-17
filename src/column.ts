// Port of eden/scm/lib/renderdag/src/column.rs.
//
// PORT NOTE: Rust implements the `ColumnsExt` trait on `Vec<Column<N>>`;
// here the trait methods are free functions taking a `Column<N>[]`.
// `Column::merge` mutates in place in Rust; here `mergeColumn` returns the
// winning value and the caller assigns it back into the array.

export type Column<N> =
  | { kind: 'empty' }
  | { kind: 'blocked' }
  | { kind: 'reserved'; node: N }
  | { kind: 'ancestor'; node: N }
  | { kind: 'parent'; node: N };

export const EMPTY_COLUMN: Column<never> = { kind: 'empty' };
const BLOCKED_COLUMN: Column<never> = { kind: 'blocked' };

export const Column = {
  empty<N>(): Column<N> {
    return EMPTY_COLUMN;
  },
  blocked<N>(): Column<N> {
    return BLOCKED_COLUMN;
  },
  reserved<N>(node: N): Column<N> {
    return { kind: 'reserved', node };
  },
  ancestor<N>(node: N): Column<N> {
    return { kind: 'ancestor', node };
  },
  parent<N>(node: N): Column<N> {
    return { kind: 'parent', node };
  },
} as const;

export type Eq<N> = (a: N, b: N) => boolean;

/// Rust: `Column::matches`
export function columnMatches<N>(column: Column<N>, n: N, eq: Eq<N>): boolean {
  switch (column.kind) {
    case 'empty':
    case 'blocked':
      return false;
    case 'reserved':
    case 'ancestor':
    case 'parent':
      return eq(n, column.node);
  }
}

/// Rust: `Column::variant`
function columnVariant<N>(column: Column<N>): number {
  switch (column.kind) {
    case 'empty':
      return 0;
    case 'blocked':
      return 1;
    case 'reserved':
      return 2;
    case 'ancestor':
      return 3;
    case 'parent':
      return 4;
  }
}

/// Rust: `Column::merge` (returns the merged value instead of mutating).
export function mergeColumn<N>(column: Column<N>, other: Column<N>): Column<N> {
  return columnVariant(other) > columnVariant(column) ? other : column;
}

/// Rust: `Column::reset` (returns the reset value instead of mutating).
function resetColumn<N>(column: Column<N>): Column<N> {
  return column.kind === 'blocked' ? EMPTY_COLUMN : column;
}

/// Rust: `ColumnsExt::find`
export function columnsFind<N>(columns: readonly Column<N>[], node: N, eq: Eq<N>): number | null {
  for (let index = 0; index < columns.length; index++) {
    if (columnMatches(columns[index], node, eq)) {
      return index;
    }
  }
  return null;
}

/// Rust: `ColumnsExt::find_empty`
export function columnsFindEmpty<N>(columns: readonly Column<N>[], index: number): number | null {
  if (index < columns.length && columns[index].kind === 'empty') {
    return index;
  }
  return columnsFirstEmpty(columns);
}

/// Rust: `ColumnsExt::first_empty`
export function columnsFirstEmpty<N>(columns: readonly Column<N>[]): number | null {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].kind === 'empty') {
      return i;
    }
  }
  return null;
}

/// Rust: `ColumnsExt::new_empty`
export function columnsNewEmpty<N>(columns: Column<N>[]): number {
  columns.push(EMPTY_COLUMN);
  return columns.length - 1;
}

/// Rust: `ColumnsExt::reset`
export function columnsReset<N>(columns: Column<N>[]): void {
  for (let i = 0; i < columns.length; i++) {
    columns[i] = resetColumn(columns[i]);
  }
  while (columns.length > 0 && columns[columns.length - 1].kind === 'empty') {
    columns.pop();
  }
}
