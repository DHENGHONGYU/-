#!/bin/sh
# V9 提交作用域守卫（Commit Scope Guard）
# 规则 1：暂存 > 50 文件 -> WARN（提示复核）
# 规则 2：src/ + docs/ 大量删除（>30 项）混入提交 -> BLOCK
#
# 注意：此脚本必须可在最小 git-sh 环境（无 Node 依赖）下运行，
#      因为它在 pre-commit 阶段最先执行。

STAGED_COUNT=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
echo "[scope-guard] 暂存文件数: $STAGED_COUNT"

# 规则 1：> 50 文件警告（不阻断）
if [ "$STAGED_COUNT" -gt 50 ]; then
  echo "  ⚠️  [WARN] 本次提交暂存 $STAGED_COUNT 个文件，建议复核是否混入无关变更。"
fi

# 规则 2：src/ + docs/ 目录删除项 > 30 阻断
DEL_COUNT=$(git diff --cached --name-status 2>/dev/null \
  | awk '$1 == "D" && ($2 ~ /^src\// || $2 ~ /^docs\//) { c++ } END { print c+0 }')
echo "[scope-guard] src/docs 目录删除项: $DEL_COUNT"

if [ "$DEL_COUNT" -gt 30 ]; then
  echo "  ❌ [BLOCK] 本次提交包含 $DEL_COUNT 项 src/docs 目录下的删除操作。"
  echo "     为防止误删大面积代码/文档，超过阈值(30)的删除操作已被拦截。"
  echo "     请：1) 将删除操作拆分为多批提交，或 2) 确认无风险后分段执行。"
  exit 1
fi

echo "  ✅ 提交作用域校验通过。"
exit 0
