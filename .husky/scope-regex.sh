#!/bin/sh
# ============================================================
# 共享脚本: scope-regex.sh
#
# 提供统一的 scope 正则校验函数，供 commit-msg、pre-push 和
# prepare-commit-msg 钩子引用，确保三处使用完全相同的校验逻辑。
#
# 使用方式:
#   . "$(dirname "$0")/scope-regex.sh"
#
# 提供的函数:
#   extract_scope(subject)  — 从 conventional commit subject 提取 scope
#   is_scope_invalid(scope)  — 检查 scope 是否包含内部编号（p0-p6）
#   validate_scope(subject) — 一站式校验（提取 + 检查），返回 0=合规 / 1=不合规
# ============================================================

set -eu

# ── scope 提取正则 ──
# 匹配: feat(scope): desc, fix(scope): desc, docs(scope): desc 等
SCOPE_EXTRACT_REGEX='^(feat|fix|docs|chore|refactor|test|ci|style|perf|build|revert)\((.+)\): .*'

# ── scope 内部编号校验正则 ──
# 匹配: p0, P0, p1-2, P1-2, p6 等（不区分大小写）
# 不匹配: app0 (p前有字母), FIN-P0 (p前有连字符)
SCOPE_INVALID_REGEX='(^|[^a-zA-Z-])p[0-6]([^0-9a-zA-Z-]|$)|(^|[^a-zA-Z-])p[0-6]-[0-9]+'

# ── 合规 scope 示例（用于错误提示）──
SCOPE_VALID_EXAMPLES="fix(FIN-P0), fix(auth), fix(store), feat(app)"

# ============================================================
# extract_scope: 从 conventional commit subject 提取 scope
# 参数: $1 = subject (如 "fix(p0): 不合规提交")
# 输出: stdout 输出 scope 名称；如果不是 conventional commit 格式，输出空
# ============================================================
extract_scope() {
  _subject="$1"
  echo "$_subject" | sed -nE "s/${SCOPE_EXTRACT_REGEX}/\\2/p"
}

# ============================================================
# is_scope_invalid: 检查 scope 是否包含内部编号
# 参数: $1 = scope (如 "p0" 或 "FIN-P0")
# 返回: 0 = 包含内部编号（不合规），1 = 不包含（合规）
# ============================================================
is_scope_invalid() {
  _scope="$1"
  if [ -z "$_scope" ]; then
    return 1  # 空 scope 视为合规
  fi
  echo "$_scope" | grep -qiE "$SCOPE_INVALID_REGEX"
  # grep 返回 0 = 匹配到（不合规），1 = 未匹配（合规）
}

# ============================================================
# validate_scope: 一站式校验
# 参数: $1 = subject (如 "fix(p0): 不合规提交")
# 返回: 0 = 合规或无 scope，1 = 不合规
# 副作用: 设置全局变量 SCOPE (提取到的 scope 值)
# ============================================================
validate_scope() {
  _subject="$1"
  SCOPE=$(extract_scope "$_subject")

  if [ -z "$SCOPE" ]; then
    return 0  # 非 conventional commit 或无 scope，视为合规
  fi

  if is_scope_invalid "$SCOPE"; then
    return 1  # 不合规
  fi

  return 0  # 合规
}
