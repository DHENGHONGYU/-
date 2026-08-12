#!/bin/sh
# V9 提交作用域守卫（Commit Scope Guard）v2
# 规则 1：单次提交文件数 ≤ 30（BLOCK）
# 规则 2：禁止跨层混合提交（≥3 个顶层域 → BLOCK）
# 规则 3：src/ + docs/ 大量删除（>30 项）→ BLOCK
# 规则 4：禁止临时产物混入（test-output.txt / audit-out.txt 等 → BLOCK）
#
# 注意：此脚本必须可在最小 git-sh 环境（无 Node 依赖）下运行，
#      因为它在 pre-commit 阶段最先执行。
#      临时文件使用 /tmp + PID 命名，避免 mktemp 在部分环境不可用。

set -e

# ── 临时文件（固定路径 + PID，避免依赖 mktemp） ──
TMP_BASE="/tmp/v9-scope-guard-$$"
DOMAIN_MAP_FILE="$TMP_BASE-domain-map"
ROOT_MATCH_FILE="$TMP_BASE-root-match"
AFFECTED_DOMAINS="$TMP_BASE-affected"
STAGED_FILES_FILE="$TMP_BASE-staged"
ARTIFACT_MARKER="$TMP_BASE-artifact"

cleanup() {
  rm -f "$DOMAIN_MAP_FILE" "$ROOT_MATCH_FILE" "$AFFECTED_DOMAINS" "$STAGED_FILES_FILE" "$ARTIFACT_MARKER"
}
trap cleanup EXIT

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)
if [ -z "$STAGED_FILES" ]; then
  STAGED_COUNT=0
else
  STAGED_COUNT=$(echo "$STAGED_FILES" | grep -c . || echo 0)
fi
echo "[scope-guard] 暂存文件数: $STAGED_COUNT"

# ── 规则 1：单次提交文件数 ≤ 30（BLOCK） ──
MAX_FILES=30
if [ "$STAGED_COUNT" -gt "$MAX_FILES" ]; then
  echo "  ❌ [BLOCK] 本次提交包含 $STAGED_COUNT 个文件，超过上限 $MAX_FILES。"
  echo "     单次提交文件数过多会导致 review 困难、回滚风险增大。"
  echo "     请拆分为多个原子提交，建议每次聚焦单一变更主题。"
  exit 1
fi

# ── 规则 2：跨层混合提交检测（≥3 个顶层域 → BLOCK） ──
# 定义顶层域分组（路径前缀 → 域名称）
DOMAIN_MAP="src/components|components
src/hooks|hooks
src/services|services
src/store|store
src/lib|lib
src/utils|utils
src/types|types
src/constants|constants
src/config|config
src/styles|styles
src/apps|apps
src/pages|pages
src/assets|assets
src/i18n|i18n
src/__tests__|tests
docs|docs
scripts|scripts
tests|tests
playwright|e2e
.cypress|e2e
public|public
vite.config|build_config
eslint|lint_config
tsconfig|ts_config
.husky|husky
package.json|package_config
README|docs_root
CHANGELOG|docs_root
AGENTS|agents_root
"

# 根级文件精确匹配（格式: 文件名|域名称）
ROOT_FILE_MATCHES="package.json|config_root
tsconfig.json|config_root
tsconfig.prod.json|config_root
tsconfig.test.json|config_root
vite.config.ts|config_root
eslint.config.js|config_root
eslint.colors.config.js|config_root
.gitignore|config_root
.gitattributes|config_root
.dockerignore|config_root
AGENTS.md|agents_root
CHANGELOG.md|docs_root
README.md|docs_root
playwright.config.ts|e2e_config
vitest.config.ts|config_root
.editorconfig|config_root
.husky/pre-commit|husky
.husky/pre-push|husky
.husky/commit-msg|husky
"

# 写入映射表（预创建 affected 文件，防止无匹配域时 sort 报错）
echo "$DOMAIN_MAP" > "$DOMAIN_MAP_FILE"
echo "$ROOT_FILE_MATCHES" > "$ROOT_MATCH_FILE"
echo "$STAGED_FILES" > "$STAGED_FILES_FILE"
: > "$AFFECTED_DOMAINS"
: > "$ARTIFACT_MARKER"

# 逐文件检测所属域
while IFS= read -r file; do
  [ -z "$file" ] && continue

  # 根级文件精确匹配
  domain=$(grep -F "$file|" "$ROOT_MATCH_FILE" 2>/dev/null | head -1 | cut -d'|' -f2)
  if [ -n "$domain" ]; then
    echo "$domain" >> "$AFFECTED_DOMAINS"
    continue
  fi

  # 路径前缀匹配：遍历域映射表，找到第一个匹配的模式
  domain=""
  while IFS='|' read -r pattern domain_name; do
    case "$file" in
      ${pattern}/*)
        domain="$domain_name"
        break
        ;;
    esac
  done < "$DOMAIN_MAP_FILE"

  if [ -n "$domain" ]; then
    echo "$domain" >> "$AFFECTED_DOMAINS"
  fi
done < "$STAGED_FILES_FILE"

DOMAINS_SORTED=$(sort -u "$AFFECTED_DOMAINS" 2>/dev/null)
DOMAIN_COUNT=0
if [ -n "$DOMAINS_SORTED" ]; then
  DOMAIN_COUNT=$(echo "$DOMAINS_SORTED" | grep -c . 2>/dev/null || echo 0)
fi

echo "[scope-guard] 涉及域数: $DOMAIN_COUNT"
if [ "$DOMAIN_COUNT" -ge 3 ]; then
  echo "  ❌ [BLOCK] 本次提交跨 $DOMAIN_COUNT 个顶层域（$(echo "$DOMAINS_SORTED" | tr '\n' ', ' | sed 's/,$//')），超过上限 2 个。"
  echo "     跨层混合提交违反单一职责原则，增加 review 和回滚难度。"
  echo "     请拆分为原子提交，每个提交聚焦单一层级/域的变更。"
  exit 1
fi

# ── 规则 3：src/ + docs/ 目录删除项 > 30 阻断 ──
DEL_COUNT=$(git diff --cached --name-status 2>/dev/null \
  | awk '$1 == "D" && ($2 ~ /^src\// || $2 ~ /^docs\//) { c++ } END { print c+0 }')
echo "[scope-guard] src/docs 目录删除项: $DEL_COUNT"

if [ "$DEL_COUNT" -gt 30 ]; then
  echo "  ❌ [BLOCK] 本次提交包含 $DEL_COUNT 项 src/docs 目录下的删除操作。"
  echo "     为防止误删大面积代码/文档，超过阈值(30)的删除操作已被拦截。"
  echo "     请：1) 将删除操作拆分为多批提交，或 2) 确认无风险后分段执行。"
  exit 1
fi

# ── 规则 4：临时产物检测 ──
ARTIFACT_PATTERNS="test-output.txt
audit-out.txt
.tmp-
draft-
WIP
_temp
debug-output
"

while IFS= read -r file; do
  [ -z "$file" ] && continue
  BASENAME=$(basename "$file")
  for pattern in $ARTIFACT_PATTERNS; do
    case "$BASENAME" in
      *"$pattern"*)
        echo "  ❌ [BLOCK] 检测到临时产物文件: $file"
        echo "     请从暂存区移除该文件（git reset HEAD $file），或加入 .gitignore。"
        echo "$file" >> "$ARTIFACT_MARKER"
        break
        ;;
    esac
  done
done < "$STAGED_FILES_FILE"

if [ -s "$ARTIFACT_MARKER" ]; then
  exit 1
fi

echo "  ✅ 提交作用域校验通过（$STAGED_COUNT 文件，$DOMAIN_COUNT 个域）。"
exit 0
