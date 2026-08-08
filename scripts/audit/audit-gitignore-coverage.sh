#!/bin/sh
# V9 .gitignore 覆盖率审计（IDE/环境部署追踪治理）
# 规则 1：暂存区包含 IDE 私有路径文件 -> BLOCK
# 规则 2：必须忽略的路径未被 .gitignore 覆盖 -> BLOCK
# 规则 3：保留追踪的 .trae/ 被误加入 .gitignore -> BLOCK
#
# 依据：FILE-MANAGEMENT-GUIDE.md §2.2 IDE/环境部署追踪治理
# 关联约束：project_memory.md「环境部署追踪治理」
#
# 注意：此脚本必须可在最小 git-sh 环境（无 Node 依赖）下运行，
#      因为它在 pre-commit 阶段执行。

# 必须忽略的 IDE/环境部署路径（对应 .gitignore line 263-268）
IGNORE_PATHS="
.codebuddy/
.cursorrules
.workbuddy/
.trae-cn/
.vscode/
.idea/
"

# 必须保留追踪的团队共享资产目录
PRESERVE_PATHS=".trae/"

echo "[gitignore-coverage] IDE/环境部署追踪治理审计..."

EXIT_CODE=0

# ---------------------------------------------------------------------------
# 检查 1：暂存区是否包含必须忽略的 IDE 路径文件
# ---------------------------------------------------------------------------
echo "  [1/3] 检查暂存区是否包含 IDE 私有路径文件..."

# 清理 IGNORE_PATHS（去除空行），构造 grep 正则
IGNORE_PATTERN=$(echo "$IGNORE_PATHS" | grep -v '^$' | sed 's|/$||' | sed 's|\.|\\.|g' | paste -sd'|' -)

if [ -n "$IGNORE_PATTERN" ]; then
  # 检查暂存区是否有匹配的文件
  STAGED_HITS=$(git diff --cached --name-only 2>/dev/null | grep -E "^($IGNORE_PATTERN)(/|$)" || true)
  if [ -n "$STAGED_HITS" ]; then
    echo "  ❌ [BLOCK] 暂存区包含必须忽略的 IDE/环境部署路径文件："
    echo "$STAGED_HITS" | sed 's/^/    - /'
    echo "  依据：FILE-MANAGEMENT-GUIDE.md §2.2（仅 .trae/ 保留追踪）"
    echo "  修复：git rm --cached <file> 并确认 .gitignore 已包含对应规则"
    EXIT_CODE=1
  else
    echo "  ✅ 暂存区无 IDE 私有路径文件"
  fi
fi

# ---------------------------------------------------------------------------
# 检查 2：必须忽略的路径是否被 .gitignore 覆盖
# ---------------------------------------------------------------------------
echo "  [2/3] 检查 .gitignore 覆盖率..."

MISSING_RULES=""
for path in $IGNORE_PATHS; do
  # 去除末尾 /
  bare=$(echo "$path" | sed 's|/$||')
  # 用 git check-ignore -v 验证；退出码 0 表示被忽略
  if ! git check-ignore -v "$bare/test-file" >/dev/null 2>&1; then
    # 对于文件类规则（如 .cursorrules），用自身测试
    if [ "$bare" = ".cursorrules" ]; then
      if ! git check-ignore -v "$bare" >/dev/null 2>&1; then
        MISSING_RULES="$MISSING_RULES $bare"
      fi
    else
      MISSING_RULES="$MISSING_RULES $bare"
    fi
  fi
done

if [ -n "$MISSING_RULES" ]; then
  echo "  ❌ [BLOCK] 以下路径未被 .gitignore 覆盖："
  for r in $MISSING_RULES; do
    echo "    - $r"
  done
  echo "  修复：在 .gitignore 添加对应规则（参考 §2.2 表格）"
  EXIT_CODE=1
else
  echo "  ✅ 6 个 IDE 路径全部被 .gitignore 覆盖"
fi

# ---------------------------------------------------------------------------
# 检查 3：保留追踪的 .trae/ 不应被 .gitignore 忽略
# ---------------------------------------------------------------------------
echo "  [3/3] 检查保留追踪路径未被误忽略..."

for path in $PRESERVE_PATHS; do
  bare=$(echo "$path" | sed 's|/$||')
  # git check-ignore 退出码 0 表示被忽略（不应发生）
  if git check-ignore -v "$bare/skill-registry.json" >/dev/null 2>&1; then
    echo "  ❌ [BLOCK] 保留追踪路径 $bare 被 .gitignore 误忽略"
    echo "  修复：从 .gitignore 移除 $bare 相关规则（团队共享资产必须追踪）"
    EXIT_CODE=1
  else
    echo "  ✅ $bare 未被忽略（保留追踪正确）"
  fi
done

# ---------------------------------------------------------------------------
# 汇总
# ---------------------------------------------------------------------------
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  ✅ .gitignore 覆盖率审计通过"
  echo "  依据：FILE-MANAGEMENT-GUIDE.md §2.2 IDE/环境部署追踪治理"
else
  echo ""
  echo "❌ .gitignore 覆盖率审计失败：请按上述提示修复后再提交。"
  echo "   依据：FILE-MANAGEMENT-GUIDE.md §2.2 / project_memory.md「环境部署追踪治理」"
fi

exit $EXIT_CODE
