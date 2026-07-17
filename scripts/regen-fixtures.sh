#!/usr/bin/env bash
# Regenerate the golden test fixtures by running the vendored Rust
# sapling-renderdag crate over the fixture corpus. Requires a Rust toolchain.
set -euo pipefail
cd "$(dirname "$0")/.."
cargo run --manifest-path fixture-gen/Cargo.toml --release -- tests/fixtures
echo "Fixtures regenerated from vendored sapling commit $(cat vendor/SAPLING_COMMIT)."
