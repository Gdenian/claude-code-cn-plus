#!/usr/bin/env bash
# install.sh - Claude Code 一键汉化安装脚本
# GitHub: https://github.com/Gdenian/claude-code-cn-plus
# License: MIT
#
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/Gdenian/claude-code-cn-plus/main/install.sh | bash
#   或: git clone ... && cd claude-code-cn-plus && bash install.sh

set -euo pipefail

# ========== 颜色 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
MAGENTA='\033[38;5;206m'
NC='\033[0m'

# ========== 检查前置条件 ==========
echo -e "${MAGENTA}==============================================${NC}"
echo -e "${MAGENTA}  Claude Code 中文汉化 一键安装${NC}"
echo -e "${MAGENTA}==============================================${NC}"
echo ""

# 检查 Node.js
if ! command -v node &>/dev/null; then
    echo -e "${RED}错误: 未安装 Node.js${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node --version)"

# 检查 Claude Code (npm)
PKG_NAME="@anthropic-ai/claude-code"
NPM_ROOT=$(npm root -g 2>/dev/null || true)
CLI_PATH="${NPM_ROOT}/${PKG_NAME}/cli.js"
CLI_BAK="${NPM_ROOT}/${PKG_NAME}/cli.bak.js"

if [ ! -f "$CLI_PATH" ]; then
    echo -e "${RED}错误: 未找到 Claude Code (npm 全局安装)${NC}"
    echo ""
    echo "如果你使用的是独立版 (standalone binary)，请先安装 npm 版本："
    echo "  npm install -g @anthropic-ai/claude-code"
    echo ""
    echo "两个版本可以共存，独立版不受影响。"
    exit 1
fi
echo -e "${GREEN}✓${NC} Claude Code: $CLI_PATH"

# ========== 定位脚本目录 ==========
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCALIZE_DIR="${SCRIPT_DIR}/localize"
HOOKS_DIR="${SCRIPT_DIR}/hooks"

if [ ! -f "${LOCALIZE_DIR}/localize.js" ]; then
    echo -e "${RED}错误: 找不到 localize/localize.js${NC}"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# ========== 获取 Claude 配置目录 ==========
CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
echo -e "${GREEN}✓${NC} Claude 配置目录: $CLAUDE_CONFIG_DIR"

# ========== Step 1: 备份 ==========
echo ""
echo -e "${MAGENTA}[1/5] 备份原始文件...${NC}"

if [ -f "$CLI_BAK" ]; then
    echo "  备份已存在，跳过"
else
    cp "$CLI_PATH" "$CLI_BAK"
    echo -e "  ${GREEN}✓${NC} 已创建备份: cli.bak.js"
fi

# ========== Step 2: 运行关键词汉化 ==========
echo ""
echo -e "${MAGENTA}[2/5] 运行关键词汉化 (keyword.js)...${NC}"

# 先从备份恢复
cp "$CLI_BAK" "$CLI_PATH"
echo "  已从 cli.bak.js 恢复原始文件"

cd "$LOCALIZE_DIR"
node localize.js 2>&1 | tail -5

# ========== Step 3: 叠加额外 UI 汉化 ==========
echo ""
echo -e "${MAGENTA}[3/5] 叠加额外 UI 汉化...${NC}"

node "${LOCALIZE_DIR}/extra-ui.js" "$CLI_PATH"

# ========== Step 4: 安装 Hooks ==========
echo ""
echo -e "${MAGENTA}[4/5] 安装工具提示钩子...${NC}"

# 复制 hook 脚本到 Claude 配置目录
HOOK_TARGET_DIR="${CLAUDE_CONFIG_DIR}/hooks"
mkdir -p "$HOOK_TARGET_DIR"

if [ -f "${HOOKS_DIR}/tool-tips-post.sh" ]; then
    cp "${HOOKS_DIR}/tool-tips-post.sh" "${HOOK_TARGET_DIR}/tool-tips-post.sh"
    chmod +x "${HOOK_TARGET_DIR}/tool-tips-post.sh"
    echo -e "  ${GREEN}✓${NC} 已安装 tool-tips-post.sh"

    # 更新 settings.json 中的 hooks 配置
    SETTINGS_FILE="${CLAUDE_CONFIG_DIR}/settings.json"
    if [ -f "$SETTINGS_FILE" ]; then
        # 使用 node 来安全地更新 JSON
        node -e "
const fs = require('fs');
const settingsPath = '${SETTINGS_FILE}';
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

const hookConfig = {
    matcher: 'Bash|Read|Write|Edit|Glob|Grep|mcp__*',
    hooks: [{
        type: 'command',
        command: '${HOOK_TARGET_DIR}/tool-tips-post.sh'
    }]
};

// 检查是否已存在
const exists = settings.hooks.PostToolUse.some(h =>
    h.hooks && h.hooks.some(hook => hook.command && hook.command.includes('tool-tips-post.sh'))
);

if (!exists) {
    settings.hooks.PostToolUse.push(hookConfig);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('  ✓ 已更新 settings.json 中的 hooks 配置');
} else {
    console.log('  hooks 配置已存在，跳过');
}
" 2>&1 || echo -e "  ${YELLOW}⚠${NC} 无法自动更新 settings.json，请手动添加 hooks 配置"
    else
        echo -e "  ${YELLOW}⚠${NC} 未找到 settings.json，请手动配置 hooks"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} 未找到 hooks/tool-tips-post.sh，跳过"
fi

# ========== Step 5: 配置语言设置 ==========
echo ""
echo -e "${MAGENTA}[5/5] 配置语言设置...${NC}"

# 更新 settings.json 中的 language 字段
if [ -f "$SETTINGS_FILE" ]; then
    node -e "
const fs = require('fs');
const settingsPath = '${SETTINGS_FILE}';
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
if (settings.language !== 'chinese') {
    settings.language = 'chinese';
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('  ✓ 已设置 language: chinese');
} else {
    console.log('  语言已设置为 chinese，跳过');
}
" 2>&1 || echo -e "  ${YELLOW}⚠${NC} 无法自动设置语言"
fi

# 创建 CLAUDE.md (如果不存在)
CLAUDE_MD="${CLAUDE_CONFIG_DIR}/CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ]; then
    echo -e "" >> "$CLAUDE_MD"
    echo -e "  ${GREEN}✓${NC} 已创建 CLAUDE.md"
else
    # 检查是否已有语言配置
    if ! grep -q "始终使用中文" "$CLAUDE_MD" 2>/dev/null; then
        echo "" >> "$CLAUDE_MD"
        echo "## 语言" >> "$CLAUDE_MD"
        echo "- 始终使用中文回复用户" >> "$CLAUDE_MD"
        echo -e "  ${GREEN}✓${NC} 已在 CLAUDE.md 中添加中文语言配置"
    else
        echo "  CLAUDE.md 已包含语言配置，跳过"
    fi
fi

# ========== 验证 ==========
echo ""
echo -e "${MAGENTA}验证安装...${NC}"

# 检查 cli.js 是否有效
if node -e "
const fs = require('fs');
try {
    const content = fs.readFileSync('${CLI_PATH}', 'utf8');
    // 检查是否有明显的语法损坏（简单检查中文字符存在）
    const hasChinese = /[\u4e00-\u9fff]/.test(content);
    if (hasChinese) {
        console.log('  ✓ cli.js 包含中文翻译');
    } else {
        console.log('  ⚠ cli.js 未检测到中文翻译');
    }
} catch(e) {
    console.error('  ✗ 读取 cli.js 失败:', e.message);
    process.exit(1);
}
" 2>&1; then
    echo ""
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}  汉化安装完成!${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo ""
    echo "请重启 Claude Code 使所有更改生效。"
    echo ""
    echo "如果使用 npm 版本: claude"
    echo "如果使用独立版:    请先用 npm 版本启动"
    echo ""
    echo "卸载: bash uninstall.sh"
    echo "重新汉化（Claude Code 更新后）: bash install.sh"
else
    echo -e "${RED}验证失败!${NC}"
    echo "正在恢复原始文件..."
    cp "$CLI_BAK" "$CLI_PATH"
    echo "已恢复原始文件，请检查错误信息"
    exit 1
fi
