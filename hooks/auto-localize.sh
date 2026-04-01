#!/bin/bash
# auto-localize.sh - 自动检测插件版本变化并汉化
# 由 PostToolUse hook 触发，每个 Claude 会话只运行一次
# License: MIT

# 每个会话只检查一次（通过父进程 PID 追踪）
MARKER="/tmp/claude-localize-${PPID}"
[ -f "$MARKER" ] && exit 0
touch "$MARKER" 2>/dev/null

# 定位 localize 目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCALIZE_DIR=""

# 1. 从 hooks 目录向上找 localize/
if [ -f "$SCRIPT_DIR/../localize/auto-localize.js" ]; then
    LOCALIZE_DIR="$SCRIPT_DIR/../localize"
# 2. 从安装记录中查找（install.sh 会写入）
elif [ -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/localize-install-path" ]; then
    INSTALL_PATH=$(cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/localize-install-path" 2>/dev/null)
    if [ -f "$INSTALL_PATH/localize/auto-localize.js" ]; then
        LOCALIZE_DIR="$INSTALL_PATH/localize"
    fi
fi

[ -z "$LOCALIZE_DIR" ] && exit 0

# 执行自动检测（后台运行，不阻塞）
node "${LOCALIZE_DIR}/auto-localize.js" 2>/dev/null &

exit 0
