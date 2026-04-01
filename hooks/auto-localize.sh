#!/bin/bash
# auto-localize.sh - 自动检测插件版本变化并汉化
# 由 PostToolUse hook 触发，每个 Claude 会话只运行一次
# License: MIT

# 每个会话只检查一次（通过父进程 PID 追踪）
MARKER="/tmp/claude-localize-${PPID}"
[ -f "$MARKER" ] && exit 0
touch "$MARKER" 2>/dev/null

# 定位 localize 目录（多重回退策略）
LOCALIZE_DIR=""

# 策略1: 从安装记录中查找（install.sh 写入，最可靠）
INSTALL_PATH_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/localize-install-path"
if [ -f "$INSTALL_PATH_FILE" ]; then
    INSTALL_PATH=$(cat "$INSTALL_PATH_FILE" 2>/dev/null)
    if [ -n "$INSTALL_PATH" ] && [ -f "$INSTALL_PATH/localize/auto-localize.js" ]; then
        LOCALIZE_DIR="$INSTALL_PATH/localize"
    fi
fi

# 策略2: 从 hooks 目录向上找（适用于开发目录结构）
if [ -z "$LOCALIZE_DIR" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$SCRIPT_DIR/../localize/auto-localize.js" ]; then
        LOCALIZE_DIR="$SCRIPT_DIR/../localize"
    fi
fi

# 策略3: 在常见位置搜索
if [ -z "$LOCALIZE_DIR" ]; then
    for candidate in \
        "$HOME/vibe coding/claude-code-cn-plus/localize" \
        "$HOME/claude-code-cn-plus/localize"
    do
        if [ -f "$candidate/auto-localize.js" ]; then
            LOCALIZE_DIR="$candidate"
            break
        fi
    done
fi

[ -z "$LOCALIZE_DIR" ] && exit 0

# 执行自动检测（后台运行，不阻塞）
# 注意：路径加引号以正确处理空格和中文
node "${LOCALIZE_DIR}/auto-localize.js" 2>/dev/null &

exit 0
