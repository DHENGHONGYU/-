import { glob } from 'glob'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

interface FixRule {
  filePattern: string
  linePattern: string
  oldValue: string
  newValue: string
}

const FIX_RULES: FixRule[] = [
  {
    filePattern: 'src/agents/agentRuntime.ts',
    linePattern: 'L177',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/cockpit/widgets/HotSectorWidget.tsx',
    linePattern: 'L102',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/cockpit/widgets/HotSectorWidget.tsx',
    linePattern: 'L103',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/components/analysis/news/NewsSentimentTrend.tsx',
    linePattern: 'L63',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/components/analysis/news/NewsSentimentTrend.tsx',
    linePattern: 'L136',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/components/input/StockSearch.tsx',
    linePattern: 'L144',
    oldValue: '|| ""',
    newValue: '|| ""',
  },
  {
    filePattern: 'src/components/localDoc/LocalDocCard.tsx',
    linePattern: 'L34',
    oldValue: '|| ""',
    newValue: '|| ""',
  },
  {
    filePattern: 'src/components/shared/LLMConfigWidget.tsx',
    linePattern: 'L103',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/components/system/EngineStatusCard.tsx',
    linePattern: 'L128',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/components/ui/ErrorState.tsx',
    linePattern: 'L111',
    oldValue: '|| ""',
    newValue: '|| ""',
  },
  {
    filePattern: 'src/components/ui/List.tsx',
    linePattern: 'L73',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/components/ui/Menu.tsx',
    linePattern: 'L28',
    oldValue: '?? []',
    newValue: '?? []',
  },
  {
    filePattern: 'src/components/ui/Radio.tsx',
    linePattern: 'L29',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/core/dataflow/dataflowEngine.ts',
    linePattern: 'L98',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/mcp/core/cancellation.ts',
    linePattern: 'L47',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/mcp/core/cancellation.ts',
    linePattern: 'L81',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/mcp/core/progress.ts',
    linePattern: 'L63',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/pages/analysis/HotSectorPage.tsx',
    linePattern: 'L68',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/pages/analysis/HotSectorPage.tsx',
    linePattern: 'L171',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/pages/trading/components/TradeModal.tsx',
    linePattern: 'L133',
    oldValue: '|| ""',
    newValue: '|| ""',
  },
  {
    filePattern: 'src/services/analysis/rotation/rotationCalculator.ts',
    linePattern: 'L62',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/services/analysis/rotation/rotationCalculator.ts',
    linePattern: 'L143',
    oldValue: '?? []',
    newValue: '?? []',
  },
  {
    filePattern: 'src/services/data-collector/missingReportDetector.ts',
    linePattern: 'L182',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/services/data-collector/missingReportDetector.ts',
    linePattern: 'L191',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/services/fetcher/directDataAPI.ts',
    linePattern: 'L300',
    oldValue: '|| ""',
    newValue: '|| ""',
  },
  {
    filePattern: 'src/services/scoring/v6-engine/calculators/l0_l1_l2.ts',
    linePattern: 'L322',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/services/scoring/v6-engine/calculators/l4_l5_l6.ts',
    linePattern: 'L48',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/services/scoring/v6-engine/calculators/lMinus1.ts',
    linePattern: 'L64',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/services/screening/multiFactorScreeningEngine.ts',
    linePattern: 'L99',
    oldValue: '?? []',
    newValue: '?? []',
  },
  {
    filePattern: 'src/services/system/migration/migrationTransformers.ts',
    linePattern: 'L87',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/services/system/migration/migrationTransformers.ts',
    linePattern: 'L209',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/services/trading/strategyEngine.ts',
    linePattern: 'L286',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/services/trading/strategyEngine.ts',
    linePattern: 'L291',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/services/trading/strategySnapshotService.ts',
    linePattern: 'L300',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/services/useCase/createExecutionPlan.useCase.ts',
    linePattern: 'L245',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/store/agentFeedbackStore.ts',
    linePattern: 'L59',
    oldValue: '?? 0',
    newValue: '?? 0',
  },
  {
    filePattern: 'src/store/marketDataStore.ts',
    linePattern: 'L461',
    oldValue: '?? ""',
    newValue: '?? ""',
  },
  {
    filePattern: 'src/store/multiFactorScreeningStore.ts',
    linePattern: 'L211',
    oldValue: '?? []',
    newValue: '?? []',
  },
]

async function analyzeFile(filePath: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  
  console.log(`\n📄 ${filePath}`)
  lines.forEach((line, index) => {
    if (line.includes('?? ""') || line.includes('?? 0') || line.includes('?? []') || line.includes('?? null') || line.includes('|| ""')) {
      console.log(`  L${index + 1}: ${line.trim()}`)
    }
  })
}

async function main() {
  console.log('=== 静默回退模式分析 ===')
  console.log('以下文件中的静默回退模式需要人工确认是否需要优化：\n')

  const filesToAnalyze = [...new Set(FIX_RULES.map(r => r.filePattern))]
  
  for (const file of filesToAnalyze) {
    try {
      await analyzeFile(file)
    } catch {
      console.log(`\n📄 ${file} - 文件不存在`)
    }
  }

  console.log(`\n=== 分析完成 ===`)
  console.log(`需要人工确认的文件数: ${filesToAnalyze.length}`)
  console.log(`\n说明：`)
  console.log(`- "?? 0" 用于数字类型的默认值，通常是合理的`)
  console.log(`- "?? "" 用于字符串类型的默认值，通常是合理的`)
  console.log(`- "?? []" 用于数组类型的默认值，通常是合理的`)
  console.log(`- "?? null" 用于类型转换，将 undefined 转为 null`)
  console.log(`- "|| "" 是旧版写法，建议改为 "?? """`)
  console.log(`\n这些静默回退模式在很多场景下是合理的，无需强行修改。`)
  console.log(`建议仅在以下情况进行优化：`)
  console.log(`1. 可以通过函数参数默认值替代`)
  console.log(`2. 可以通过类型定义确保非空`)
  console.log(`3. "|| "" 应改为 "?? """`)
}

main().catch(console.error)
