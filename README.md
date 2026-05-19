# Claude Code CN Plus

Claude Code 中文汉化增强包。

当前形态是 `curl` 一键 bootstrap + `cccn` Node CLI。默认面向 Node.js 20+，依赖安装到 `~/.claude-code-cn-plus`，并保留旧版 `cli.js` 兼容、插件描述汉化、Translation Memory、工具提示、自动维护、语言配置和卸载恢复能力。

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Gdenian/claude-code-cn-plus/main/install.sh | bash
```

可选环境变量：

```bash
VERSION=v0.1.0
CHANNEL=stable   # 或 main
INSTALL_DIR=~/.claude-code-cn-plus
DRY_RUN=1
```

仓库内开发时，`install.sh` 会直接使用当前源码。

## 命令

```bash
cccn install --yes
cccn uninstall --yes
cccn doctor
cccn localize --auto
cccn restore
```

通用参数：

```bash
--dry-run
--claude-dir <path>
--install-dir <path>
--verbose
```

## 产品行为

- 新版 native Claude Code 优先通过 `tweakcc@4.0.13` 适配层处理。
- 旧版 npm `cli.js` 继续走备份 + 字符串替换。
- native patch 失败时会回滚 CLI，并让安装返回非零。
- 插件翻译只改 frontmatter 的 `description`。
- 自动维护 hook 每会话检查版本变化后再决定是否重汉化。
- `cccn doctor` 用于检查 Node、安装形态、hooks、插件缓存、备份和 manifest。

## 开发

```bash
npm install
npm test
npm run check
```

## 结构

```
bin/cccn.js              # CLI 入口
src/                     # 核心实现
localize/                # 兼容旧入口与翻译资源
hooks/                   # 兼容旧 hook 包装
install.sh               # bootstrap
uninstall.sh             # 卸载包装
test/                    # node:test
```

## 许可证

MIT
