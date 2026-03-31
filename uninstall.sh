#!/usr/bin/env bash
# uninstall.sh - 卸载 Claude Code 汉化
# License: MIT

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${YELLOW}Claude Code 汉化卸载${NC}"
echo ""

# 查找 cli.js
NPM_ROOT=$(npm root -g 2>/dev/null || true)
CLI_PATH="${NPM_ROOT}/@anthropic-ai/claude-code/cli.js"
CLI_BAK="${NPM_ROOT}/@anthropic-ai/claude-code/cli.bak.js"

if [ -f "$CLI_BAK" ]; then
    cp "$CLI_BAK" "$CLI_PATH"
    rm "$CLI_BAK"
    echo -e "${GREEN}✓${NC} 已恢复原始英文 cli.js"
else
    echo -e "${YELLOW}⚠${NC} 未找到备份文件，可能已是英文版本"
fi

# 移除 hooks
CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOK_FILE="${CLAUDE_CONFIG_DIR}/hooks/tool-tips-post.sh"

if [ -f "$HOOK_FILE" ]; then
    rm "$HOOK_FILE"
    echo -e "${GREEN}✓${NC} 已移除 tool-tips-post.sh"
fi

# 从 settings.json 中移除 hooks 配置
SETTINGS_FILE="${CLAUDE_CONFIG_DIR}/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('${SETTINGS_FILE}', 'utf8'));
if (s.hooks && s.hooks.PostToolUse) {
    s.hooks.PostToolUse = s.hooks.PostToolUse.filter(h =>
        !(h.hooks && h.hooks.some(hook => hook.command && hook.command.includes('tool-tips-post.sh')))
    );
    if (s.hooks.PostToolUse.length === 0) delete s.hooks.PostToolUse;
    if (Object.keys(s.hooks).length === 0) delete s.hooks;
    fs.writeFileSync('${SETTINGS_FILE}', JSON.stringify(s, null, 2));
    console.log('✓ 已清理 settings.json 中的 hooks 配置');
}
" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}卸载完成。请重启 Claude Code。${NC}"
