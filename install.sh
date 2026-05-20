#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
MAGENTA='\033[38;5;206m'
NC='\033[0m'

DEFAULT_VERSION="v0.1.0"
REPO_URL="${REPO_URL:-https://github.com/Gdenian/claude-code-cn-plus}"
CHANNEL="${CHANNEL:-stable}"
VERSION="${VERSION:-$DEFAULT_VERSION}"
DRY_RUN="${DRY_RUN:-0}"

echo -e "${MAGENTA}Claude Code CN Plus 安装器${NC}"

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}错误: 未安装 Node.js${NC}"
  echo "请先安装 Node.js 24+: https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo -e "${RED}错误: Node.js 版本过低: $(node --version)${NC}"
  echo "Claude Code CN Plus 需要 Node.js 24+。"
  exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node --version)"

if [ "$CHANNEL" != "stable" ] && [ "$CHANNEL" != "main" ]; then
  echo -e "${RED}错误: CHANNEL 只能是 stable 或 main${NC}"
  exit 1
fi

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

CURRENT_SOURCE=0
SOURCE_DIR="$(pwd -P)"
if [ -f "$SOURCE_DIR/package.json" ] && [ -f "$SOURCE_DIR/bin/cccn.js" ]; then
  CURRENT_SOURCE=1
fi

if [ "$CURRENT_SOURCE" = "1" ]; then
  INSTALL_DIR="$SOURCE_DIR"
  echo -e "${GREEN}✓${NC} 使用当前源码: $INSTALL_DIR"
else
  INSTALL_DIR="${INSTALL_DIR:-$HOME/.claude-code-cn-plus}"
  TMP_DIR="$(mktemp -d)"
  if [ "$CHANNEL" = "main" ]; then
    ARCHIVE_URL="${REPO_URL%.git}/archive/refs/heads/main.tar.gz"
  else
    ARCHIVE_URL="${REPO_URL%.git}/archive/refs/tags/${VERSION}.tar.gz"
  fi
  echo -e "${GREEN}✓${NC} 下载版本: ${CHANNEL} ${VERSION}"
  echo "  $ARCHIVE_URL"
  run_cmd mkdir -p "$INSTALL_DIR"
  if [ "$DRY_RUN" = "1" ]; then
    run_cmd curl -fsSL "$ARCHIVE_URL" -o "$TMP_DIR/source.tar.gz"
    run_cmd tar -xzf "$TMP_DIR/source.tar.gz" -C "$INSTALL_DIR" --strip-components=1
  else
    curl -fsSL "$ARCHIVE_URL" -o "$TMP_DIR/source.tar.gz"
    rm -rf "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    tar -xzf "$TMP_DIR/source.tar.gz" -C "$INSTALL_DIR" --strip-components=1
    rm -rf "$TMP_DIR"
  fi
fi

echo -e "${MAGENTA}安装依赖...${NC}"
run_cmd npm ci --omit=dev --prefix "$INSTALL_DIR"

ARGS=( "$INSTALL_DIR/bin/cccn.js" install --yes --install-dir "$INSTALL_DIR" )
if [ -n "${CLAUDE_CONFIG_DIR:-}" ]; then
  ARGS+=( --claude-dir "$CLAUDE_CONFIG_DIR" )
fi
if [ "$DRY_RUN" = "1" ]; then
  ARGS+=( --dry-run )
fi

echo -e "${MAGENTA}运行 cccn install...${NC}"
run_cmd node "${ARGS[@]}"
