#!/bin/sh
# .husky/setup-stash-guard.sh — 配置 git stash alias 包装 pre-stash 检查
#
# 用法: sh .husky/setup-stash-guard.sh
#
# 原理: Git 不原生支持 pre-stash 钩子，通过 alias 包装 git stash 命令:
#   1. 先执行 .husky/pre-stash 检查（拦截 gitignore 大文件）
#   2. 检查通过后调用真正的 git-stash（绕过 alias 递归）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# 设置 alias: git stash -> pre-stash 检查 + 真正的 git-stash
# 注意: 必须单行书写，不能使用反斜杠续行（git config 会存储字面 \）
git config alias.stash '!f() { echo "STASH-GUARD: args=$@" >&2; .husky/pre-stash "$@" && "$(git --exec-path)/git-stash" "$@"; }; f'

if [ $? -eq 0 ]; then
  echo "[setup-stash-guard] Git alias configured successfully."
  echo "[setup-stash-guard] 'git stash' now runs pre-stash check before stashing."
  echo "[setup-stash-guard] Test: git stash -u (should block if build artifacts exist)"
  echo "[setup-stash-guard] Bypass: git -c core.hooksPath=/dev/null stash -u"
else
  echo "[setup-stash-guard] ERROR: Failed to configure Git alias." >&2
  exit 1
fi
