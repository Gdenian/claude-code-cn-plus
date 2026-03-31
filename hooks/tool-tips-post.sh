#!/bin/bash
# tool-tips-post.sh - 工具执行后中文提示（带解释）
# 基于 cute-claude-hooks (https://github.com/gugug168/cute-claude-hooks)
# License: MIT

input=$(cat)

# 提取 JSON 字段
extract_field() {
    local key="$1"
    local clean
    clean=$(printf '%s' "$input" | sed 's/\\"/__DQ__/g')
    local val
    val=$(printf '%s' "$clean" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1)
    val=$(printf '%s' "$val" | sed 's/__DQ__/"/g; s/\\n/\n/g')
    printf '%s' "$val"
}

tool_name=$(extract_field "tool_name")
file_path=$(extract_field "file_path")
pattern=$(extract_field "pattern")
bash_cmd=$(extract_field "command")

# 路径简化
short_path() {
    echo "$1" | sed 's/.*[\\/]//' | head -c 50
}

# 翻译 Bash 命令为中文解释
explain_cmd() {
    local cmd="$1"
    local first=$(echo "$cmd" | awk '{print $1}')
    local rest=$(echo "$cmd" | awk '{$1=""; print}' | sed 's/^ *//')

    case "$first" in
        git)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                status)       echo "查看代码仓库状态" ;;
                log)          echo "查看代码提交历史" ;;
                diff)         echo "查看代码的具体修改" ;;
                add)          echo "把修改的文件加入待提交列表" ;;
                commit)       echo "保存提交代码变更" ;;
                push)         echo "把本地代码上传到远程仓库" ;;
                pull)         echo "从远程仓库下载最新代码" ;;
                fetch)        echo "获取远程仓库的最新信息" ;;
                checkout|switch) echo "切换代码分支" ;;
                branch)       echo "查看或管理代码分支" ;;
                merge)        echo "合并分支代码" ;;
                rebase)       echo "整理提交历史（变基）" ;;
                stash)        echo "临时保存未提交的修改" ;;
                clone)        echo "从远程复制代码仓库" ;;
                init)         echo "初始化新的代码仓库" ;;
                reset)        echo "撤销提交或恢复文件" ;;
                revert)       echo "撤销之前的修改" ;;
                cherry-pick)  echo "把特定提交应用到当前分支" ;;
                show)         echo "查看提交的详细内容" ;;
                tag)          echo "管理代码版本标签" ;;
                *)            echo "Git 版本控制操作" ;;
            esac
            ;;
        npm|npx)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                install|i)    echo "安装项目依赖包" ;;
                run)          echo "运行项目脚本" ;;
                init)         echo "初始化新项目" ;;
                build)        echo "构建/编译项目" ;;
                test)         echo "运行项目测试" ;;
                start)        echo "启动项目" ;;
                *)            echo "Node.js 包管理操作" ;;
            esac
            ;;
        yarn)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                add)          echo "添加依赖包" ;;
                install)      echo "安装项目依赖" ;;
                run)          echo "运行项目脚本" ;;
                build)        echo "构建项目" ;;
                *)            echo "Yarn 包管理操作" ;;
            esac
            ;;
        pnpm)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                add)          echo "添加依赖包" ;;
                install)      echo "安装项目依赖" ;;
                run)          echo "运行项目脚本" ;;
                *)            echo "pnpm 包管理操作" ;;
            esac
            ;;
        pip|pip3)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                install)      echo "安装 Python 包" ;;
                uninstall)    echo "卸载 Python 包" ;;
                list)         echo "列出已安装的包" ;;
                show)         echo "查看包详细信息" ;;
                freeze)       echo "导出依赖列表" ;;
                *)            echo "Python 包管理操作" ;;
            esac
            ;;
        python|python3)  echo "运行 Python 程序" ;;
        pytest)           echo "运行 Python 测试" ;;
        ls|dir)           echo "查看目录文件列表" ;;
        cat|bat)          echo "查看文件内容" ;;
        head)             echo "查看文件开头" ;;
        tail)             echo "查看文件末尾" ;;
        rm)               echo "删除文件或目录" ;;
        mkdir)            echo "创建新文件夹" ;;
        cp)               echo "复制文件" ;;
        mv)               echo "移动或重命名文件" ;;
        touch)            echo "创建空文件" ;;
        chmod)            echo "修改文件权限" ;;
        find)             echo "搜索文件或目录" ;;
        curl)             echo "请求网络资源" ;;
        wget)             echo "从网络下载文件" ;;
        docker)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                build)  echo "构建 Docker 镜像" ;;
                run)    echo "运行 Docker 容器" ;;
                ps)     echo "查看运行中的容器" ;;
                stop)   echo "停止 Docker 容器" ;;
                rm)     echo "删除 Docker 容器" ;;
                images) echo "查看 Docker 镜像" ;;
                *)      echo "Docker 容器操作" ;;
            esac
            ;;
        make)    echo "编译构建项目" ;;
        cargo)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                build) echo "编译 Rust 项目" ;;
                run)   echo "运行 Rust 程序" ;;
                test)  echo "运行 Rust 测试" ;;
                *)     echo "Rust 构建操作" ;;
            esac
            ;;
        go)
            local sub=$(echo "$rest" | awk '{print $1}')
            case "$sub" in
                build) echo "编译 Go 程序" ;;
                run)   echo "运行 Go 程序" ;;
                test)  echo "运行 Go 测试" ;;
                mod)   echo "管理 Go 模块" ;;
                *)     echo "Go 语言操作" ;;
            esac
            ;;
        code)           echo "用 VS Code 打开" ;;
        vim|vi|nano)    echo "用终端编辑器打开" ;;
        tar)            echo "打包或解压文件" ;;
        zip)            echo "压缩文件" ;;
        unzip)          echo "解压 ZIP 文件" ;;
        ps)             echo "查看运行中的进程" ;;
        kill)           echo "终止进程" ;;
        *)
            if [ ${#cmd} -le 20 ]; then
                echo "执行命令: $cmd"
            else
                echo "执行系统命令"
            fi
            ;;
    esac
}

# 生成提示
get_tip() {
    case "$1" in
        "Read")
            if [ -n "$file_path" ]; then
                echo "📖 读取: $(short_path "$file_path") — 查看文件内容"
            else
                echo "📖 读取完成"
            fi
            ;;
        "Write")
            if [ -n "$file_path" ]; then
                echo "📝 写入: $(short_path "$file_path") — 创建或覆盖文件"
            else
                echo "📝 写入完成"
            fi
            ;;
        "Edit"|"MultiEdit")
            if [ -n "$file_path" ]; then
                echo "✏️ 编辑: $(short_path "$file_path") — 修改文件内容"
            else
                echo "✏️ 编辑完成"
            fi
            ;;
        "Bash")
            if [ -n "$bash_cmd" ]; then
                real_cmd=$(echo "$bash_cmd" | grep -v '^[[:space:]]*#' | grep -v '^[[:space:]]*$' | head -1)
                if [ -z "$real_cmd" ]; then
                    echo "🖥️ 命令执行完成"
                else
                    split_cmd=$(echo "$real_cmd" | sed 's/ && /\n/g; s/ || /\n/g; s/; /\n/g')
                    split_cmd=$(echo "$split_cmd" | grep -v '^[[:space:]]*$')
                    cmd_count=$(echo "$split_cmd" | grep -c .)
                    if [ "$cmd_count" -le 1 ]; then
                        explain=$(explain_cmd "$real_cmd")
                        echo "🖥️ 执行: $real_cmd — $explain"
                    else
                        echo "🖥️ 共${cmd_count}条命令:"
                        idx=1
                        while IFS= read -r line; do
                            [ -z "$line" ] && continue
                            [ "$idx" -gt 3 ] && break
                            explain=$(explain_cmd "$line")
                            echo "  $idx. $line — $explain"
                            idx=$((idx+1))
                        done <<< "$split_cmd"
                        [ "$cmd_count" -gt 3 ] && echo "  ...(还有$((cmd_count-3))条)"
                    fi
                fi
            else
                echo "🖥️ 命令执行完成"
            fi
            ;;
        "Glob")
            if [ -n "$pattern" ]; then
                echo "🔍 搜索文件: \"$pattern\" — 按名称模式查找"
            else
                echo "🔍 文件搜索完成"
            fi
            ;;
        "Grep")
            if [ -n "$pattern" ]; then
                echo "🔎 搜索内容: \"$pattern\" — 在文件中搜索"
            else
                echo "🔎 内容搜索完成"
            fi
            ;;
        "Agent")
            echo "🤖 AI助手完成任务 — 派了一个AI助手去独立处理"
            ;;
        "Skill")
            echo "⚡ 技能执行完成 — 使用了预设的专业技能"
            ;;
        "Task"|"TaskCreate"|"TaskUpdate"|"TaskGet"|"TaskList")
            echo "📋 任务管理 — 管理和跟踪工作进度"
            ;;
        "EnterPlanMode")
            echo "🤔 进入规划模式 — AI正在思考解决方案"
            ;;
        "ExitPlanMode")
            echo "✅ 规划完成 — AI想好了方案，准备执行"
            ;;
        *)
            if [[ "$1" == mcp__* ]]; then
                srv=$(echo "$1" | sed -n 's/mcp__\([^_]*\)__.*/\1/p')
                tool=$(echo "$1" | sed 's/mcp__[^_]*__//')
                if [ -z "$srv" ]; then
                    echo "🔌 外部工具: $1 — 调用第三方扩展"
                else
                    case "$srv" in
                        "context7")       echo "📚 查询文档: $tool" ;;
                        "exa")            echo "🌐 网络搜索: $tool" ;;
                        "basic-memory")   echo "🧠 记忆操作: $tool" ;;
                        "Playwright")     echo "🎭 浏览器: $tool" ;;
                        "web_reader")     echo "📖 网页阅读: $tool" ;;
                        *)                echo "🔌 $srv: $tool — 第三方工具" ;;
                    esac
                fi
            else
                echo "✅ $1 — 操作完成"
            fi
            ;;
    esac
}

# JSON 转义
json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\r'/\\r}"
    echo "$s"
}

# 主逻辑
if [ -n "$tool_name" ]; then
    tip=$(get_tip "$tool_name")
    if [ -n "$tip" ]; then
        escaped_tip=$(json_escape "🌸 ${tip} 🌸")
        printf '{"systemMessage":"%s"}\n' "$escaped_tip"
    fi
fi

exit 0
