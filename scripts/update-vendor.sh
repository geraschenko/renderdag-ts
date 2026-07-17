#!/usr/bin/env bash
# Re-vendor the Rust sapling-renderdag (and drawdag test helper) crates from
# the facebook/sapling repository at a specific commit.
#
# Usage:
#   scripts/update-vendor.sh [COMMIT]
#   SAPLING_REPO=/path/to/local/sapling scripts/update-vendor.sh [COMMIT]
#
# COMMIT defaults to the currently pinned commit in vendor/SAPLING_COMMIT.
# SAPLING_REPO is the source to fetch from (a local clone or a URL); it
# defaults to the public facebook/sapling repo. Pointing it at a local clone
# avoids re-fetching over the network (the COMMIT must exist in that clone).
# To update the port: pick the latest commit touching eden/scm/lib/renderdag
#   git log -1 --format=%H -- eden/scm/lib/renderdag
# then run this script with it, review `git diff vendor/`, mirror the changes
# into src/, and run `npm run regen-fixtures && npm test`.
set -euo pipefail

cd "$(dirname "$0")/.."

COMMIT="${1:-$(cat vendor/SAPLING_COMMIT)}"
SAPLING_REPO="${SAPLING_REPO:-https://github.com/facebook/sapling.git}"
# A relative local path would be resolved against $WORK by git fetch; make it
# absolute so it still refers to the intended clone.
if [ -d "$SAPLING_REPO" ]; then
  SAPLING_REPO="$(cd "$SAPLING_REPO" && pwd)"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching sapling at ${COMMIT} from ${SAPLING_REPO}..."
git -C "$WORK" init -q
git -C "$WORK" remote add origin "$SAPLING_REPO"
git -C "$WORK" fetch -q --depth 1 --filter=blob:none origin "$COMMIT"
git -C "$WORK" sparse-checkout set eden/scm/lib/renderdag eden/scm/lib/drawdag
git -C "$WORK" checkout -q FETCH_HEAD

rm -rf vendor/renderdag vendor/drawdag
cp -r "$WORK/eden/scm/lib/renderdag" vendor/renderdag
cp -r "$WORK/eden/scm/lib/drawdag" vendor/drawdag
rm -f vendor/renderdag/BUCK vendor/drawdag/BUCK

# Strip [dev-dependencies] (they reference path crates outside the vendor dir
# and are not needed to build the library for fixture generation).
python3 - <<'EOF'
import re
for name in ['renderdag', 'drawdag']:
    p = f'vendor/{name}/Cargo.toml'
    s = open(p).read()
    s = re.sub(r'\n\[dev-dependencies\][^[]*', '\n', s)
    open(p, 'w').write(s)
EOF

echo "$COMMIT" > vendor/SAPLING_COMMIT
echo "Vendored sapling commit $COMMIT into vendor/."
echo "Next: review the diff, mirror changes into src/, then:"
echo "  npm run regen-fixtures && npm test"
