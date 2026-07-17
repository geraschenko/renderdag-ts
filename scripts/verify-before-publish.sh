#!/usr/bin/env bash
set -euo pipefail

# Pre-publish verification for the `@geraschenko/renderdag` npm package. Runs everything that
# must pass before publishing an update: a clean lockfile-faithful install, the
# full gate (build/typecheck, format check, fixture tests), and a dry-run pack so
# the tarball contents can be inspected. It then prints the publish commands.
#
# It deliberately stops short of `npm publish`: published npm versions are
# immutable, so the irreversible step stays a manual decision the human makes
# after eyeballing the dry-run file list.

# Run from the repository root regardless of the caller's cwd.
cd "$(dirname "$0")/.."

PKG_NAME="$(node -p "require('./package.json').name")"
PKG_VERSION="$(node -p "require('./package.json').version")"

echo "==> Verifying ${PKG_NAME}@${PKG_VERSION} before publish"

# Guard against forgetting to bump the version: refuse if this exact version is
# already on the registry (a 404 — not yet published — is fine and proceeds).
published="$(npm view "${PKG_NAME}@${PKG_VERSION}" version 2>/dev/null || true)"
if [[ -n "${published}" ]]; then
  echo "ERROR: ${PKG_NAME}@${PKG_VERSION} is already published." >&2
  echo "       Bump \"version\" in package.json before publishing." >&2
  exit 1
fi

# Clean, lockfile-faithful install so a stale node_modules cannot mask a problem
# and the build is reproducible from package-lock.json.
npm ci

# Full gate: build (also typechecks src), format check, and the fixture tests.
npm run presubmit

# Show the exact tarball contents without publishing. `npm pack` runs `prepare`,
# so this packs a fresh clean build. Inspect for the expected files (compiled JS
# and .d.ts under dist/, the src/ sources, LICENSE, README) and no stray local
# files or secrets.
npm pack --dry-run

cat <<MSG

If the dry-run file list looks correct, publish with:

  git tag "v${PKG_VERSION}" && git push --tags
  npm publish

Then verify:
  npm view ${PKG_NAME} version
MSG
