# 踩坑记录 — Claude Code 汉化开发中的经验教训

## 1. 短字符串是地雷

**问题**: 尝试翻译 `"None"` → `"无"`, `"Default"` → `"默认"` 等"显而易见"的短字符串。

**结果**: `cli.js` 崩溃，出现 `SyntaxError`。原因是这些短字符串不仅出现在 UI 文本中，还出现在代码逻辑里：

```javascript
// 原始代码
allowedValues: ["Strict", "Lax", "None"]

// 替换后 → 语法错误
allowedValues: ["Strict", "Lax", "无"]  // ❌ 破坏了 cookie 属性值
```

**规则**: 只翻译 **足够长且唯一** 的字符串。经验阈值：6 个字符以下不碰。

## 2. 正则位置替换的偏移灾难

**问题**: 使用 `re.finditer()` 找到所有匹配位置，然后逐个替换。

```python
# 错误做法
for match in re.finditer(pattern, content):
    pos = match.start() + offset
    content = content[:pos] + replacement + content[pos+len(old):]
    offset += len(replacement) - len(old)
```

**结果**: 当一个字符串在文件中出现多次时，第一次替换后所有后续位置偏移，导致：
- 替换内容被插入到错误位置
- 文件被严重损坏
- 出现乱码

**解决**: 使用 `str.replace()`（Python）或 `String.split().join()`（JS），避免位置计算：

```python
# 正确做法
content = content.replace(f'"{eng}"', f'"{chn}"')
```

## 3. 看似安全的字符串不一定安全

**问题**: `"Do you want to proceed?"` 和 `"and tell Claude what to do differently"` 看起来是纯 UI 文本。

**结果**: 它们在 `cli.js` 中被用于非 UI 的代码上下文，替换后导致崩溃。

**规则**: 每条翻译都必须 **单独测试** — 在 cli.js 上只替换这一条，然后运行 `claude --version` 验证。

## 4. 独立版 vs npm 版

**问题**: Claude Code 有两种安装方式：
- **独立版 (standalone)**: 二进制文件，没有 `cli.js`
- **npm 版**: `npm install -g @anthropic-ai/claude-code`，有 `cli.js`

**影响**: 汉化只能修改 `cli.js`，所以独立版用户需要额外安装 npm 版本。

**解决**: 两种版本可以共存。安装脚本会检测 npm 版是否存在。

## 5. 备份是生命线

**问题**: 没有备份就修改 `cli.js`，出问题后无法恢复。

**规则**:
- 首次运行自动创建 `cli.bak.js`
- 每次汉化前从备份恢复原始文件
- 验证失败时自动回滚

## 6. skill/插件描述不在 cli.js 中

**问题**: 斜杠命令的描述（如 GSD 系列命令、superpowers 技能）不在 `cli.js` 里，而是：
- 插件技能: 在 `~/.claude/plugins/cache/` 下的 SKILL.md frontmatter 中
- 自定义命令: 在 `~/.claude/commands/` 下的 `.md` 文件中

**影响**: keyword.js 无法覆盖这些文本，需要单独的翻译流程。

**注意**: 技能翻译时要保留 TRIGGER 等英文关键词（AI 依赖这些关键词来决定何时激活技能）。

## 7. 逐条测试法

**方法**: 添加新翻译条目时：

```bash
# 1. 只添加一条翻译
# 2. 运行汉化
# 3. 验证
claude --version

# 4. 如果成功 → 保留，继续下一条
# 5. 如果失败 → 移除该条，记录原因
```

虽然慢，但这是唯一可靠的方法。批量添加翻译时，一条出错就会导致整个文件损坏，很难定位问题。

## 8. 引号匹配很关键

`cli.js` 是压缩后的 JS 代码，字符串用双引号或单引号包裹。替换时必须精确匹配引号：

```javascript
// 正确 — 只替换双引号包裹的
content = content.replace(`"${eng}"`, `"${chn}"`)

// 危险 — 可能替换到变量名、属性名等
content = content.replace(eng, chn)
```

## 9. 可靠性硬化原则

- 安装器默认值必须指向当前真实存在的发布产物。README 的一键命令不能依赖尚未推送的 tag。
- 备份文件是恢复根。重复 patch 可以更新 manifest，但不能覆盖第一次 patch 前的原始备份。
- manifest 的写入方和读取方必须共享同一套版本状态 schema。
- 诊断命令打印失败状态时必须返回非 0，避免 CI 或用户把失败误判为成功。
