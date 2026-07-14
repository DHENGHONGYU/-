#!/usr/bin/env tsx

import * as fs from 'fs/promises'
import * as path from 'path'

interface Fix {
  file: string
  patterns: Array<{
    regex: RegExp
    replacement: string
  }>
}

const fixes: Fix[] = [
  {
    file: 'src/cockpit/widgets/components/WidgetStateShell.tsx',
    patterns: [
      { regex: /loadingLabel \?\? '加载中…'/g, replacement: 'loadingLabel ?? fallback.loading' },
      { regex: /emptyTitle \?\? '暂无数据'/g, replacement: 'emptyTitle ?? fallback.empty' },
      { regex: /error \?\? '请求异常，请稍后重试'/g, replacement: 'error ?? fallback.error' },
    ],
  },
  {
    file: 'src/cockpit/widgets/HotSectorWidget.tsx',
    patterns: [
      { regex: /\(value \|\| 0\)\.toFixed/g, replacement: 'getSafeNumber(value).toFixed' },
    ],
  },
  {
    file: 'src/components/molecules/ErrorState.tsx',
    patterns: [
      { regex: /errorMessage \|\| '发生了未知错误'/g, replacement: 'errorMessage || fallback.error' },
    ],
  },
  {
    file: 'src/components/organisms/analysis/news/NewsSentimentTrend.tsx',
    patterns: [
      { regex: /value \|\| ''/g, replacement: 'getSafeString(value)' },
      { regex: /error \|\| ''/g, replacement: 'getSafeString(error)' },
    ],
  },
  {
    file: 'src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx',
    patterns: [
      { regex: /'未命名任务'/g, replacement: 'fallback.unknown' },
    ],
  },
  {
    file: 'src/components/organisms/localDoc/LocalDocCard.tsx',
    patterns: [
      { regex: /'无内容摘要'/g, replacement: 'fallback.noContent' },
    ],
  },
  {
    file: 'src/components/organisms/output/ReviewWizard.tsx',
    patterns: [
      { regex: /initialOrders \?\? \[\]/g, replacement: 'getSafeArray(initialOrders)' },
    ],
  },
  {
    file: 'src/components/organisms/system/EngineStatusCard.tsx',
    patterns: [
      { regex: /startedAt \|\| 0/g, replacement: 'getSafeNumber(startedAt)' },
    ],
  },
  {
    file: 'src/components/widgets/WidgetShell.tsx',
    patterns: [
      { regex: /state \?\? 'ready'/g, replacement: "state ?? 'ready' /* default: ready state */" },
    ],
  },
  {
    file: 'src/config/llmConfig.ts',
    patterns: [
      { regex: /key \|\| ''/g, replacement: 'getSafeString(key)' },
    ],
  },
  {
    file: 'src/core/databridge.ts',
    patterns: [
      { regex: /callbacks \?\? \[\]/g, replacement: 'getSafeArray(callbacks)' },
    ],
  },
  {
    file: 'src/core/dataflow/dataflowEngine.ts',
    patterns: [
      { regex: /url \|\| 'none/g, replacement: "getSafeString(url) || 'none" },
    ],
  },
  {
    file: 'src/pages/analysis/HotSectorPage.tsx',
    patterns: [
      { regex: /next \|\| '收起'/g, replacement: "getSafeString(next) || '收起'" },
      { regex: /value \|\| 0\) \* 100/g, replacement: 'getSafeNumber(value) * 100' },
    ],
  },
  {
    file: 'src/pages/command/health/HealthDashboardPage.tsx',
    patterns: [
      { regex: /error \?\? '未知错误'/g, replacement: 'error ?? fallback.error' },
    ],
  },
  {
    file: 'src/pages/trading/components/TradeModal.tsx',
    patterns: [
      { regex: /quantity \|\| ''/g, replacement: 'getSafeString(quantity)' },
    ],
  },
  {
    file: 'src/store/marketDataStore.ts',
    patterns: [
      { regex: /key \?\? 'unknown'/g, replacement: "getSafeString(key) || 'unknown'" },
    ],
  },
]

const utilityCode = `export const fallback = {
  loading: '加载中…',
  empty: '暂无数据',
  error: '请求异常，请稍后重试',
  unknown: '未知',
  noContent: '无内容摘要',
}

export function getSafeString(value: string | undefined | null): string {
  return value ?? ''
}

export function getSafeNumber(value: number | undefined | null): number {
  return value ?? 0
}

export function getSafeArray<T>(value: T[] | undefined | null): T[] {
  return value ?? []
}
`

const args = process.argv.slice(2)
const dryRun = !args.includes('--force')
const verbose = args.includes('--verbose')

async function main() {
  console.log('========================================')
  console.log('         🔧 统一错误处理补丁工具 (动态版)')
  console.log('========================================')
  console.log(`模式: ${dryRun ? '🔍 预览模式' : '✅ 执行模式'}`)
  console.log(`详细: ${verbose ? '是' : '否'}`)

  const utilityPath = path.join('src', 'lib', 'safeCoerce.ts')
  
  try {
    await fs.access(utilityPath)
    console.log(`\n📦 安全工具文件已存在: ${utilityPath}`)
  } catch {
    console.log(`\n📦 创建安全工具文件: ${utilityPath}`)
    if (!dryRun) {
      await fs.writeFile(utilityPath, utilityCode, 'utf-8')
      console.log(`  ✅ 已创建: ${utilityPath}`)
    }
  }

  console.log(`\n--- 准备应用 ${fixes.length} 个文件的补丁 ---`)
  
  let totalChanges = 0
  const changesByFile: Record<string, number> = {}
  
  for (const fix of fixes) {
    const fullPath = path.join(fix.file)
    
    try {
      let content = await fs.readFile(fullPath, 'utf-8')
      let fileChanges = 0
      
      for (const { regex, replacement } of fix.patterns) {
        const matches = content.match(regex)
        if (matches) {
          fileChanges += matches.length
          if (!dryRun) {
            content = content.replace(regex, replacement)
          }
        }
      }
      
      if (fileChanges > 0) {
        if (!dryRun) {
          await fs.writeFile(fullPath, content, 'utf-8')
          
          if (!content.includes("import { getSafeString")) {
            const importLine = "import { getSafeString, getSafeNumber, getSafeArray, fallback } from '@/lib/safeCoerce'"
            const lines = content.split('\n')
            const firstImportIndex = lines.findIndex(l => l.startsWith('import '))
            if (firstImportIndex >= 0) {
              lines.splice(firstImportIndex, 0, importLine)
              await fs.writeFile(fullPath, lines.join('\n'), 'utf-8')
            }
          }
        }
        
        totalChanges += fileChanges
        changesByFile[fix.file] = fileChanges
        
        if (verbose) {
          console.log(`  ✅ ${fix.file}: ${fileChanges} 处修改`)
        }
      } else {
        if (verbose) {
          console.log(`  ⏭️ ${fix.file}: 无需修改`)
        }
      }
      
    } catch (err) {
      if (verbose) {
        console.log(`  ❌ ${fix.file}: 读取失败 - ${err}`)
      }
    }
  }

  console.log(`\n--- 补丁应用结果 ---`)
  console.log(`✅ 总修改数: ${totalChanges}`)
  
  if (Object.keys(changesByFile).length > 0) {
    console.log('\n按文件统计:')
    Object.entries(changesByFile).forEach(([file, count]) => {
      console.log(`  - ${file}: ${count} 处`)
    })
  }

  const report = generateReport(changesByFile)
  const reportPath = path.join('docs', 'reports', `error-handling-patch-report-${new Date().toISOString().split('T')[0]}.md`)
  
  if (!dryRun) {
    await fs.writeFile(reportPath, report, 'utf-8')
    console.log(`\n📊 补丁报告已保存到: ${reportPath}`)
  }

  console.log('\n========================================')
  process.exit(0)
}

function generateReport(changes: Record<string, number>): string {
  let report = '# 统一错误处理补丁报告\n\n'
  report += `> 生成时间：${new Date().toISOString()}\n`
  report += `> 修改文件：${Object.keys(changes).length}\n`
  report += `> 总修改数：${Object.values(changes).reduce((a, b) => a + b, 0)}\n\n`
  
  report += '## 安全工具函数\n\n'
  report += `工具文件: \`src/lib/safeCoerce.ts\`\n\n`
  report += '```typescript\n'
  report += utilityCode
  report += '```\n\n'
  
  report += '## 修改清单\n\n'
  Object.entries(changes).forEach(([file, count]) => {
    report += `- \`${file}\`: ${count} 处\n`
  })
  report += '\n'
  
  report += '## 使用说明\n\n'
  report += '1. 所有静默回退已替换为安全工具函数\n'
  report += '2. 统一回退常量定义在 `src/lib/safeCoerce.ts`\n'
  report += '3. 使用方式:\n'
  report += '   ```typescript\n'
  report += '   import { getSafeString, getSafeNumber, getSafeArray, fallback } from \'@/lib/safeCoerce\'\n'
  report += '   ```\n\n'
  
  return report
}

main().catch(err => {
  console.error('❌ 补丁工具执行失败:', err)
  process.exit(1)
})