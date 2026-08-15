/**
 * scripts/audit/audit-eslint-disable.ts
 *
 * ESLint-disable 注释审计工具
 *
 * 功能：
 *   扫描项目中所有 eslint-disable / eslint-disable-next-line 注释，
 *   生成统计报告和手动验证指南。
 *
 * 用法：
 *   npx tsx scripts/audit/audit-eslint-disable.ts
 *
 * 输出：
 *   1. disable 注释统计（按规则、按文件）
 *   2. 生成审计报告到 outputs/audit/eslint-disable-audit.md
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface DisableEntry {
  file: string
  line: number
  rule: string
  description?: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')

function walkDir(dir: string): string[] {
  const results: string[] = []
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      results.push(fullPath)
    }
  }
  return results
}

function collectDisables(): DisableEntry[] {
  const srcDir = join(projectRoot, 'src')
  const files = walkDir(srcDir)
  const entries: DisableEntry[] = []

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const relPath = filePath.replace(projectRoot + '\\', '').replace(/\\/g, '/')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(/eslint-disable(?:-next-line)?\s+([\w\-,\s/]+)/)
        if (!match) continue

        const rules = match[1].split(',').map((r) => r.trim()).filter(Boolean)
        const descMatch = line.match(/[—#]\s*(.+)/)
        const description = descMatch ? descMatch[1].trim() : undefined

        for (const rule of rules) {
          entries.push({
            file: relPath,
            line: i + 1,
            rule,
            description,
          })
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return entries
}

function main(): void {
  console.log('🔍 扫描 ESLint-disable 注释...')
  const entries = collectDisables()
  console.log(`  发现 ${entries.length} 处注释`)

  const byRule: Record<string, number> = {}
  const byFile: Record<string, number> = {}
  for (const entry of entries) {
    byRule[entry.rule] = (byRule[entry.rule] || 0) + 1
    byFile[entry.file] = (byFile[entry.file] || 0) + 1
  }

  console.log('\n📊 按规则分布:')
  for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule}: ${count}`)
  }

  console.log('\n📁 按文件分布:')
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1] - a[1])
  for (const [file, count] of sortedFiles) {
    console.log(`  ${file}: ${count}`)
  }

  const outputDir = resolve(projectRoot, 'outputs/audit')
  mkdirSync(outputDir, { recursive: true })
  const reportPath = resolve(outputDir, 'eslint-disable-audit.md')

  let report = `# ESLint-Disable 注释审计报告\n\n`
  report += `> 生成时间：${new Date().toISOString()}\n\n`
  report += `## 统计概览\n\n`
  report += `| 指标 | 数量 |\n|------|------|\n`
  report += `| 总注释数 | ${entries.length} |\n\n`

  report += `## 按规则分布\n\n`
  report += `| 规则 | 数量 |\n|------|------|\n`
  for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    report += `| \`${rule}\` | ${count} |\n`
  }
  report += '\n'

  report += `## 按文件分布\n\n`
  report += `| 文件 | 注释数 |\n|------|--------|\n`
  for (const [file, count] of sortedFiles) {
    report += `| \`${file}\` | ${count} |\n`
  }
  report += '\n'

  report += `## 手动验证指南\n\n`
  report += `### 验证步骤\n\n`
  report += `1. **逐个验证**：对每条注释，暂时删除后运行 \`npx eslint <file>\`\n`
  report += `2. **判定规则**：\n`
  report += `   - 删除后无新警告 → 注释可安全删除（stale）\n`
  report += `   - 删除后有新警告 → 注释仍必要（necessary）\n\n`

  report += `### 优先级建议\n\n`
  report += `| 优先级 | 文件 | 注释数 | 建议 |\n`
  report += `|--------|------|--------|------|\n`
  report += `| P0 | cloudSyncClient.ts | 8 | 最多注释，优先审计 |\n`
  report += `| P0 | ruleEngine.ts | 5 | 规则引擎，验证复杂度 |\n`
  report += `| P1 | DensityContext.tsx | 4 | 上下文 Provider |\n`
  report += `| P1 | Dialog.tsx | 3 | 通用组件 |\n`
  report += `| P1 | zIndexDebugLogger.ts | 3 | 调试工具 |\n`
  report += `| P2 | 其他分散文件 | 33 | 逐个验证 |\n\n`

  report += `### 快速验证脚本（PowerShell）\n\n`
  report += `\`\`\`powershell\n# 对单个文件验证所有 eslint-disable 注释\n$file = "src/lib/cloudSyncClient.ts"\n$lines = Select-String -Path $file -Pattern "eslint-disable" | ForEach-Object { $_.LineNumber }\nforeach ($line in $lines) {\n  Write-Host "Checking line $line..."\n  # 暂时注释掉该行\n  $content = Get-Content $file\n  $content[$line-1] = "# STALE_CHECK: " + $content[$line-1]\n  Set-Content $file $content\n  \n  # 运行 ESLint\n  $result = npx eslint $file --format json 2>&1\n  \n  # 恢复\n  $content = Get-Content $file\n  $content[$line-1] = $content[$line-1] -replace '^# STALE_CHECK: ', ''\n  Set-Content $file $content\n  \n  Write-Host "  Result: $result"\n}\n\`\`\`\n`

  report += `## 完整注释清单\n\n`
  report += `| 文件 | 行号 | 规则 | 说明 |\n|------|------|------|------|\n`
  for (const entry of entries.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    report += `| \`${entry.file}\` | ${entry.line} | \`${entry.rule}\` | ${entry.description || '-'} |\n`
  }

  writeFileSync(reportPath, report, 'utf-8')
  console.log(`\n📄 审计报告已生成: ${reportPath}`)
}

main()
