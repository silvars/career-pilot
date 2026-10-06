#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> typecheck"
npm run typecheck

echo "==> test"
npm test

echo "==> build"
npm run build

echo "==> validate: all green"
