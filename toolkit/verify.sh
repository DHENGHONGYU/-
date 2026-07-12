#!/usr/bin/env bash

# V9 智能投研复盘系统 - 整改验证脚本
# 用于新项目快速验证整改效果

echo "========================================="
echo "    V9 整改验证脚本 v1.0"
echo "========================================="

# 1. TypeScript 类型检查
echo ""
echo "[1/5] 运行 TypeScript 类型检查..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "✅ TypeScript 类型检查通过"
else
  echo "❌ TypeScript 类型检查失败"
  exit 1
fi

# 2. 硬编码审计
echo ""
echo "[2/5] 运行硬编码审计..."
npm run audit:hardcode
if [ $? -eq 0 ]; then
  echo "✅ 硬编码审计通过"
else
  echo "⚠️  硬编码审计存在警告"
fi

# 3. 架构分层审计
echo ""
echo "[3/5] 运行架构分层审计..."
npm run audit:layers
if [ $? -eq 0 ]; then
  echo "✅ 架构分层审计通过"
else
  echo "❌ 架构分层审计失败"
  exit 1
fi

# 4. 死代码审计
echo ""
echo "[4/5] 运行死代码审计..."
npm run audit:deadcode
if [ $? -eq 0 ]; then
  echo "✅ 死代码审计通过"
else
  echo "⚠️  死代码审计存在警告"
fi

# 5. 单元测试
echo ""
echo "[5/5] 运行单元测试..."
npm test -- --run
if [ $? -eq 0 ]; then
  echo "✅ 单元测试全部通过"
else
  echo "⚠️  部分测试失败，请检查"
fi

echo ""
echo "========================================="
echo "    验证完成"
echo "========================================="
