#!/usr/bin/env tsx

import * as fs from 'fs/promises'
import * as path from 'path'

interface Patch {
  file: string
  line: number
  oldCode: string
  newCode: string
  comment: string
}

const patches: Patch[] = [
  {
    file: 'src/cockpit/widgets/components/WidgetStateShell.tsx',
    line: 67,
    oldCode: 'return skeleton ?? <Loading label={loadingLabel ?? \'加载中…\'} />',
    newCode: 'return skeleton ?? <Loading label={loadingLabel ?? fallback.loading} />',
    comment: '使用统一回退常量',
  },
  {
    file: 'src/cockpit/widgets/components/WidgetStateShell.tsx',
    line: 74,
    oldCode: 'title={emptyTitle ?? \'暂无数据\'}',
    newCode: 'title={emptyTitle ?? fallback.empty}',
    comment: '使用统一回退常量',
  },
  {
    file: 'src/cockpit/widgets/components/WidgetStateShell.tsx',
    line: 86,
    oldCode: 'description={error ?? \'请求异常，请稍后重试\'}',
    newCode: 'description={error ?? fallback.error}',
    comment: '使用统一回退常量',
  },
  {
    file: 'src/cockpit/widgets/HotSectorWidget.tsx',
    line: 102,
    oldCode: '<Progress value={(value || 0) * 20} className="h-1.5" />',
    newCode: '<Progress value={(getSafeNumber(value) * 20)} className="h-1.5" />',
    comment: '使用 getSafeNumber 工具函数',
  },
  {
    file: 'src/cockpit/widgets/HotSectorWidget.tsx',
    line: 104,
    oldCode: '<div className="text-xs font-medium text-right">{(value || 0).toFixed(1)}</div>',
    newCode: '<div className="text-xs font-medium text-right">{getSafeNumber(value).toFixed(1)}</div>',
    comment: '使用 getSafeNumber 工具函数',
  },
  {
    file: 'src/components/molecules/ErrorState.tsx',
    line: 110,
    oldCode: 'defaultMessage: errorMessage || \'发生了未知错误\',',
    newCode: 'defaultMessage: errorMessage || fallback.error,',
    comment: '使用统一回退常量',
  },
  {
    file: 'src/components/organisms/analysis/news/NewsSentimentTrend.tsx',
    line: 66,
    oldCode: 'value: value || \'\',',
    newCode: 'value: getSafeString(value),',
    comment: '使用 getSafeString 工具函数',
  },
  {
    file: 'src/components/organisms/analysis/news/NewsSentimentTrend.tsx',
    line: 140,
    oldCode: 'errorProps={{ error: error || \'\' }}',
    newCode: 'errorProps={{ error: getSafeString(error) }}',
    comment: '使用 getSafeString 工具函数',
  },
  {
    file: 'src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx',
    line: 188,
    oldCode: '<div className="font-medium mt-1">{taskName || taskId || \'未命名任务\'}</div>',
    newCode: '<div className="font-medium mt-1">{taskName || taskId || fallback.unknown}</div>',
    comment: '使用统一回退常量',
  },
  {
    file: 'src/components/organisms/localDoc/LocalDocCard.tsx',
    line: 37,
    oldCode: '{summary || \'无内容摘要\'}',
    newCode: '{getSafeString(summary) || fallback.noContent}',
    comment: '使用 getSafeString 和统一回退常量',
  },
  {
    file: 'src/components/organisms/output/ReviewWizard.tsx',
    line: 47,
    oldCode: 'const [orders, setOrders] = useState<Order[]>(initialOrders ?? [])',
    newCode: 'const [orders, setOrders] = useState<Order[]>(getSafeArray(initialOrders))',
    comment: '使用 getSafeArray 工具函数',
  },
  {
    file: 'src/components/organisms/system/EngineStatusCard.tsx',
    line: 128,
    oldCode: 'const uptime = formatUptime(started, startedAt || 0, now)',
    newCode: 'const uptime = formatUptime(started, getSafeNumber(startedAt), now)',
    comment: '使用 getSafeNumber 工具函数',
  },
  {
    file: 'src/components/widgets/WidgetShell.tsx',
    line: 90,
    oldCode: "const visualState: WidgetVisualState = state ?? 'ready'",
    newCode: "const visualState: WidgetVisualState = state ?? 'ready' /* default: ready state */",
    comment: '添加注释说明默认值',
  },
  {
    file: 'src/config/llmConfig.ts',
    line: 190,
    oldCode: 'cachedApiKey = key || \'\'',
    newCode: 'cachedApiKey = getSafeString(key)',
    comment: '使用 getSafeString 工具函数',
  },
  {
    file: 'src/core/databridge.ts',
    line: 497,
    oldCode: 'return new Set(callbacks ?? [])',
    newCode: 'return new Set(getSafeArray(callbacks))',
    comment: '使用 getSafeArray 工具函数',
  },
  {
    file: 'src/core/dataflow/dataflowEngine.ts',
    line: 101,
    oldCode: "logger.info(`[DataFlowEngine] connect() called, url=${url || 'none (polling mode)'}`)",
    newCode: "logger.info(`[DataFlowEngine] connect() called, url=${getSafeString(url) || 'none (polling mode)'}`)",
    comment: '使用 getSafeString 工具函数',
  },
  {
    file: 'src/pages/analysis/HotSectorPage.tsx',
    line: 72,
    oldCode: "logger.info(`[HotSectorPage] 切换展开: ${symbol} → ${next || '收起'}`)",
    newCode: "logger.info(`[HotSectorPage] 切换展开: ${symbol} → ${getSafeString(next) || '收起'}`)",
    comment: '使用 getSafeString 工具函数',
  },
  {
    file: 'src/pages/analysis/HotSectorPage.tsx',
    line: 181,
    oldCode: 'score: (value || 0) * 100,',
    newCode: 'score: (getSafeNumber(value) * 100),',
    comment: '使用 getSafeNumber 工具函数',
  },
  {
    file: 'src/pages/command/health/HealthDashboardPage.tsx',
    line: 112,
    oldCode: '<span>加载健康报告失败：{error ?? \'未知错误\'}</span>',
    newCode: '<span>加载健康报告失败：{error ?? fallback.error}</span>',
    comment: '使用统一回退常量',
  },
  {
    file: 'src/pages/trading/components/TradeModal.tsx',
    line: 137,
    oldCode: 'value={quantity || \'\'}',
    newCode: 'value={getSafeString(quantity)}',
    comment: '使用 getSafeString 工具函数',
  },
  {
    file: 'src/store/marketDataStore.ts',
    line: 462,
    oldCode: "logger.debug(`[marketDataStore] 数据已更新: taskId=${taskId}, key=${key ?? 'unknown'}`)",
    newCode: "logger.debug(`[marketDataStore] 数据已更新: taskId=${taskId}, key=${getSafeString(key) || 'unknown'}`)",
    comment: '使用 getSafeString 工具函数',
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
  console.log('         🔧 统一错误处理补丁工具')
  console.log('========================================')
  console.log(`模式: ${dryRun ? '🔍 预览模式' : '✅ 执行模式'}`)
  console.log(`详细: ${verbose ? '是' : '否'}`)

  const utilityPath = path.join('src', 'lib', 'safeCoerce.ts')
  let utilityExists = false
  
  try {
    await fs.access(utilityPath)
    utilityExists = true
    console.log(`\n📦 安全工具文件已存在: ${utilityPath}`)
  } catch {
    console.log(`\n📦 创建安全工具文件: ${utilityPath}`)
    if (!dryRun) {
      await fs.writeFile(utilityPath, utilityCode, 'utf-8')
      console.log(`  ✅ 已创建: ${utilityPath}`)
    }
  }

  console.log(`\n--- 准备应用 ${patches.length} 个补丁 ---`)
  
  const appliedPatches: Patch[] = []
  const failedPatches: Patch[] = []
  
  for (const patch of patches) {
    const fullPath = path.join(patch.file)
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      const lines = content.split('\n')
      const targetLine = lines[patch.line - 1]
      
      if (!targetLine || !targetLine.includes(patch.oldCode)) {
        failedPatches.push({ ...patch, comment: '目标代码未找到' })
        if (verbose) {
          console.log(`  ❌ ${patch.file}:${patch.line} - 目标代码未找到`)
          console.log(`     期望: ${patch.oldCode}`)
          console.log(`     实际: ${targetLine?.trim()}`)
        }
        continue
      }
      
      if (!dryRun) {
        lines[patch.line - 1] = targetLine.replace(patch.oldCode, patch.newCode)
        await fs.writeFile(fullPath, lines.join('\n'), 'utf-8')
        
        const hasImport = content.includes("import { getSafeString, getSafeNumber, getSafeArray, fallback } from '@/lib/safeCoerce'")
        if (!hasImport) {
          const importLine = "import { getSafeString, getSafeNumber, getSafeArray, fallback } from '@/lib/safeCoerce'"
          const firstImportIndex = lines.findIndex(l => l.startsWith('import '))
          if (firstImportIndex >= 0) {
            lines.splice(firstImportIndex, 0, importLine)
            await fs.writeFile(fullPath, lines.join('\n'), 'utf-8')
          }
        }
      }
      
      appliedPatches.push(patch)
      if (verbose) {
        console.log(`  ✅ ${patch.file}:${patch.line} - ${patch.comment}`)
      }
      
    } catch (err) {
      failedPatches.push({ ...patch, comment: `读取文件失败: ${err}` })
      if (verbose) {
        console.log(`  ❌ ${patch.file}:${patch.line} - 读取文件失败`)
      }
    }
  }

  console.log(`\n--- 补丁应用结果 ---`)
  console.log(`✅ 成功: ${appliedPatches.length}`)
  if (failedPatches.length > 0) {
    console.log(`❌ 失败: ${failedPatches.length}`)
    failedPatches.forEach(p => {
      console.log(`   - ${p.file}:${p.line} - ${p.comment}`)
    })
  }

  const report = generateReport(appliedPatches, failedPatches, utilityExists)
  const reportPath = path.join('docs', 'reports', `error-handling-patch-report-${new Date().toISOString().split('T')[0]}.md`)
  
  if (!dryRun) {
    await fs.writeFile(reportPath, report, 'utf-8')
    console.log(`\n📊 补丁报告已保存到: ${reportPath}`)
  }

  console.log('\n========================================')
  
  if (failedPatches.length > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

function generateReport(applied: Patch[], failed: Patch[], utilityExists: boolean): string {
  let report = '# 统一错误处理补丁报告\n\n'
  report += `> 生成时间：${new Date().toISOString()}\n`
  report += `> 补丁总数：${applied.length + failed.length}\n`
  report += `> 成功：${applied.length}\n`
  report += `> 失败：${failed.length}\n\n`
  
  report += '## 安全工具函数\n\n'
  report += `工具文件: \`src/lib/safeCoerce.ts\`\n\n`
  report += `状态: ${utilityExists ? '已存在' : '新增'}\n\n`
  report += '```typescript\n'
  report += utilityCode
  report += '```\n\n'
  
  if (applied.length > 0) {
    report += '## 已应用补丁\n\n'
    applied.forEach(p => {
      report += `- \`${p.file}:${p.line}\`: ${p.comment}\n`
    })
    report += '\n'
  }
  
  if (failed.length > 0) {
    report += '## 失败补丁\n\n'
    failed.forEach(p => {
      report += `- \`${p.file}:${p.line}\`: ${p.comment}\n`
    })
    report += '\n'
  }
  
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