#!/bin/bash
# Type-check 脚本：仅检查非测试文件的 TypeScript 错误
# 使用方式：bash scripts/check-types.sh
# 退出码：0 = 无非测试文件错误，非 0 = 有非测试文件错误

set -euo pipefail

OUTPUT=$(npx tsc --noEmit 2>&1) || true

# 过滤掉测试文件（.test.ts, .test.tsx, __tests__/）的错误
NON_TEST_ERRORS=$(echo "$OUTPUT" | grep "error TS" | grep -v "\.test\." | grep -v "__tests__" || true)

if [ -z "$NON_TEST_ERRORS" ]; then
  echo "✅ 非测试文件类型检查通过（0 errors）"
  exit 0
else
  COUNT=$(echo "$NON_TEST_ERRORS" | wc -l | tr -d ' ')
  echo "❌ 非测试文件类型检查未通过（${COUNT} errors）："
  echo "$NON_TEST_ERRORS"
  exit 1
fi