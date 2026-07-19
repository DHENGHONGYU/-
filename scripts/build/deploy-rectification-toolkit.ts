#!/usr/bin/env tsx

/**
 * @file deploy-rectification-toolkit.ts
 * @description 部署整改工具包到目标目录（含验证脚本、补丁工具、安全函数模板）
 * @status 孤立脚本（未在 package.json 中引用）
 * @category 部署/运维 — 保留
 * @maintainer 待定
 * @lastVerified 2026-07-13
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const args = process.argv.slice(2)
const targetDir = args[0] || path.join(rootDir, 'toolkit')

const toolkitFiles = [
  {
    name: 'auto-register-scripts.js',
    source: path.join(rootDir, 'file-management-system', 'scripts', 'auto-register-scripts.js'),
  },
  {
    name: 'patch-error-handling-dynamic.ts',
    source: path.join(rootDir, 'scripts', 'patch-error-handling-dynamic.ts'),
  },
  {
    name: 'safeCoerce.ts',
    source: path.join(rootDir, 'src', 'lib', 'safeCoerce.ts'),
  },
]

const verificationScripts = `#!/usr/bin/env bash

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
`

const verificationScriptsWin = `@echo off
chcp 65001 >nul

:: V9 智能投研复盘系统 - 整改验证脚本 (Windows)
:: 用于新项目快速验证整改效果

echo =========================================
echo     V9 整改验证脚本 v1.0 (Windows)
echo =========================================

:: 1. TypeScript 类型检查
echo.
echo [1/5] 运行 TypeScript 类型检查...
npx tsc --noEmit
if %errorlevel% equ 0 (
  echo ✅ TypeScript 类型检查通过
) else (
  echo ❌ TypeScript 类型检查失败
  exit /b 1
)

:: 2. 硬编码审计
echo.
echo [2/5] 运行硬编码审计...
npm run audit:hardcode
if %errorlevel% equ 0 (
  echo ✅ 硬编码审计通过
) else (
  echo ⚠️  硬编码审计存在警告
)

:: 3. 架构分层审计
echo.
echo [3/5] 运行架构分层审计...
npm run audit:layers
if %errorlevel% equ 0 (
  echo ✅ 架构分层审计通过
) else (
  echo ❌ 架构分层审计失败
  exit /b 1
)

:: 4. 死代码审计
echo.
echo [4/5] 运行死代码审计...
npm run audit:deadcode
if %errorlevel% equ 0 (
  echo ✅ 死代码审计通过
) else (
  echo ⚠️  死代码审计存在警告
)

:: 5. 单元测试
echo.
echo [5/5] 运行单元测试...
npm test -- --run
if %errorlevel% equ 0 (
  echo ✅ 单元测试全部通过
) else (
  echo ⚠️  部分测试失败，请检查
)

echo.
echo =========================================
echo     验证完成
echo =========================================
`

const readmeContent = `# V9 整改工具包

本工具包包含整改过程中使用的补丁脚本和验证命令，可在新项目中直接复用。

## 目录结构

\`\`\`
toolkit/
├── auto-register-scripts.js    # 未注册脚本自动注册工具
├── patch-error-handling-dynamic.ts  # 统一错误处理补丁工具
├── safeCoerce.ts                # 安全工具函数模板
├── verify.sh                    # Linux/macOS 验证脚本
├── verify.bat                   # Windows 验证脚本
└── README.md                    # 本说明文件
\`\`\`

## 使用说明

### 1. 脚本自动注册

运行以下命令将未注册脚本添加到 package.json：

\`\`\`bash
node auto-register-scripts.js
\`\`\`

### 2. 统一错误处理补丁

运行以下命令修复静默回退模式：

\`\`\`bash
npx tsx patch-error-handling-dynamic.ts --force --verbose
\`\`\`

### 3. 安全工具函数

将 safeCoerce.ts 复制到项目的 src/lib/ 目录：

\`\`\`bash
cp safeCoerce.ts ../src/lib/
\`\`\`

### 4. 验证脚本

**Linux/macOS：**
\`\`\`bash
chmod +x verify.sh
./verify.sh
\`\`\`

**Windows：**
\`\`\`cmd
verify.bat
\`\`\`

## 验证命令说明

| 命令 | 用途 | 预期结果 |
|------|------|---------|
| \`npx tsc --noEmit\` | TypeScript 类型检查 | 零错误 |
| \`npm run audit:hardcode\` | 硬编码审计 | 零违规 |
| \`npm run audit:layers\` | 架构分层审计 | 零违规 |
| \`npm run audit:deadcode\` | 死代码审计 | 零违规 |
| \`npm test -- --run\` | 单元测试 | 全部通过 |

## 安全工具函数

\`\`\`typescript
import { getSafeString, getSafeNumber, getSafeArray, fallback } from '@/lib/safeCoerce'

// 使用示例
const name = getSafeString(data.name)      // 安全获取字符串
const count = getSafeNumber(data.count)    // 安全获取数字
const list = getSafeArray(data.items)      // 安全获取数组
const msg = fallback.error                 // 使用统一回退消息
\`\`\`

## 回退常量

\`\`\`typescript
fallback = {
  loading: '加载中…',
  empty: '暂无数据',
  error: '请求异常，请稍后重试',
  unknown: '未知',
  noContent: '无内容摘要',
}
\`\`\`

## 注意事项

1. 运行补丁脚本前建议先运行 \`--dry-run\` 预览效果
2. 确保项目已安装 jsPDF 依赖（用于 PDF 报告生成）
3. 验证脚本需要 Node.js 18+ 和 npm 环境
4. 建议在执行补丁前备份代码或提交 Git
`

async function main() {
  console.log('========================================')
  console.log('         📦 整改工具包部署脚本')
  console.log('========================================')

  try {
    await fs.mkdir(targetDir, { recursive: true })
    console.log(`\n📁 创建目标目录: ${targetDir}`)

    for (const file of toolkitFiles) {
      const destPath = path.join(targetDir, file.name)
      try {
        const content = await fs.readFile(file.source, 'utf-8')
        await fs.writeFile(destPath, content, 'utf-8')
        console.log(`  ✅ ${file.name}`)
      } catch (err) {
        console.log(`  ⏭️ ${file.name} - 读取失败`)
      }
    }

    const verifyShPath = path.join(targetDir, 'verify.sh')
    await fs.writeFile(verifyShPath, verificationScripts, 'utf-8')
    console.log(`  ✅ verify.sh`)

    const verifyBatPath = path.join(targetDir, 'verify.bat')
    await fs.writeFile(verifyBatPath, verificationScriptsWin, 'utf-8')
    console.log(`  ✅ verify.bat`)

    const readmePath = path.join(targetDir, 'README.md')
    await fs.writeFile(readmePath, readmeContent, 'utf-8')
    console.log(`  ✅ ${path.basename(readmePath)}`)

    console.log(`\n✅ 工具包已部署到: ${targetDir}`)

    console.log(`\n📋 工具包内容:`)
    const files = await fs.readdir(targetDir)
    files.forEach(f => console.log(`  - ${f}`))

    console.log(`\n========================================`)

  } catch (err) {
    console.error('❌ 工具包部署失败:', err)
    process.exit(1)
  }
}

main()