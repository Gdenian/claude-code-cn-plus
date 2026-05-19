#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ARGS=( "$SCRIPT_DIR/bin/cccn.js" uninstall --yes --install-dir "$SCRIPT_DIR" )
if [ -n "${CLAUDE_CONFIG_DIR:-}" ]; then
  ARGS+=( --claude-dir "$CLAUDE_CONFIG_DIR" )
fi
node "${ARGS[@]}"
