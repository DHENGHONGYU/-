/**
 * @module fix-layer-violations
 * @description 自动化修复跨层调用违规
 * 
 * 修复策略:
 * 1. constants层违规: 提取被依赖的类型到独立类型文件
 * 2. services层违规: 迁移类型定义到types/modules/,重构依赖注入
 * 
 * 使用方式:
 *   tsx scripts/fix-layer-violations.ts [--dry-run]
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Violation {
  file: string
  line: number
  type: 'constants-import' | 'services-import'
  importPath: string
  importedTypes: string[]
}

interface FixPlan {
  violations: Violation[]
  actions: FixAction[]
}

interface FixAction {
  type: 'extract-type' | 'migrate-type' | 'update-import' | 'refactor-dep'
  source: string
  target?: string
  description: string
  code?: string
}

// 检测所有跨层违规
async function detectViolations(): Promise<Violation[]> {
  const violations: Violation[] = []
  
  // constants层违规检测
  const constantsFiles = [
    'src/constants/backtest.constants.ts',
    'src/constants/execution.constants.ts',
    'src/constants/score.constants.ts',
  ]
  
  for (const file of constantsFiles) {
    const content = await fs.readFile(path.join(__dirname, '..', file), 'utf-8')
    const lines = content.split('\n')
    
    lines.forEach((line, idx) => {
      const match = line.match(/import\s+type\s+\{([^}]+)\}\s+from\s+['"](@\/store\/|@\/data\/|@\/services\/)[^'"]+['"]/)
      if (match) {
        violations.push({
          file,
          line: idx + 1,
          type: 'constants-import',
          importPath: match[2],
          importedTypes: match[1].split(',').map(s => s.trim()),
        })
      }
    })
  }
  
  // services层违规检测
  const servicesFiles = [
    'src/services/backtest/BacktestEngine.ts',
    'src/services/export/backtestExportService.ts',
    'src/services/system/architectureService.ts',
    'src/services/useCase/submitOrder.useCase.ts',
  ]
  
  for (const file of servicesFiles) {
    const content = await fs.readFile(path.join(__dirname, '..', file), 'utf-8')
    const lines = content.split('\n')
    
    lines.forEach((line, idx) => {
      const match = line.match(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]@\/store\/[^'"]+['"]/)
      if (match) {
        violations.push({
          file,
          line: idx + 1,
          type: 'services-import',
          importPath: '@/store/',
          importedTypes: match[1].split(',').map(s => s.trim()),
        })
      }
    })
  }
  
  return violations
}

// 生成修复计划
function generateFixPlan(violations: Violation[]): FixPlan {
  const actions: FixAction[] = []
  
  // constants层修复: 提取类型定义
  const backtestViolation = violations.find(v => v.file === 'src/constants/backtest.constants.ts')
  if (backtestViolation) {
    actions.push({
      type: 'extract-type',
      source: 'src/store/backtestStore.ts',
      target: 'src/types/modules/backtest.types.ts',
      description: '提取BacktestStrategy类型到types/modules/backtest.types.ts',
      code: `export type BacktestStrategy = 'hot_sector' | 'value_pit' | 'composite'`,
    })
    actions.push({
      type: 'update-import',
      source: 'src/constants/backtest.constants.ts',
      description: '更新backtest.constants.ts的import路径',
      code: `import type { BacktestStrategy } from '@/types/modules/backtest.types'`,
    })
  }
  
  const executionViolation = violations.find(v => v.file === 'src/constants/execution.constants.ts')
  if (executionViolation) {
    actions.push({
      type: 'extract-type',
      source: 'src/data/types.ts',
      target: 'src/types/modules/execution.types.ts',
      description: '提取ExecutionPhase类型到types/modules/execution.types.ts',
      code: `export type ExecutionPhase = 'plan' | 'confirmed' | 'pending' | 'executed' | 'cancelled' | 'reviewed'`,
    })
    actions.push({
      type: 'update-import',
      source: 'src/constants/execution.constants.ts',
      description: '更新execution.constants.ts的import路径',
      code: `import type { ExecutionPhase } from '@/types/modules/execution.types'`,
    })
  }
  
  const scoreViolation = violations.find(v => v.file === 'src/constants/score.constants.ts')
  if (scoreViolation) {
    actions.push({
      type: 'extract-type',
      source: 'src/services/analysis/scoreTrendService.ts',
      target: 'src/types/modules/score.types.ts',
      description: '提取ScoreTrendPeriod类型到types/modules/score.types.ts',
      code: `export type ScoreTrendPeriod = 'week' | 'month' | 'quarter'`,
    })
    actions.push({
      type: 'update-import',
      source: 'src/constants/score.constants.ts',
      description: '更新score.constants.ts的import路径',
      code: `import type { ScoreTrendPeriod } from '@/types/modules/score.types'`,
    })
  }
  
  // services层修复: 迁移backtest类型
  const backtestEngineViolation = violations.find(v => v.file === 'src/services/backtest/BacktestEngine.ts')
  if (backtestEngineViolation) {
    actions.push({
      type: 'migrate-type',
      source: 'src/store/backtestStore.ts',
      target: 'src/types/modules/backtest.types.ts',
      description: '迁移BacktestResult/BacktestTrade/BacktestConfig到types/modules/backtest.types.ts',
    })
    actions.push({
      type: 'update-import',
      source: 'src/services/backtest/BacktestEngine.ts',
      description: '更新BacktestEngine.ts的import路径',
      code: `import type { BacktestStrategy, BacktestResult, BacktestTrade } from '@/types/modules/backtest.types'`,
    })
  }
  
  const backtestExportViolation = violations.find(v => v.file === 'src/services/export/backtestExportService.ts')
  if (backtestExportViolation) {
    actions.push({
      type: 'update-import',
      source: 'src/services/export/backtestExportService.ts',
      description: '更新backtestExportService.ts的import路径',
      code: `import type { BacktestConfig, BacktestResult, BacktestTrade } from '@/types/modules/backtest.types'`,
    })
  }
  
  const architectureViolation = violations.find(v => v.file === 'src/services/system/architectureService.ts')
  if (architectureViolation) {
    actions.push({
      type: 'refactor-dep',
      source: 'src/services/system/architectureService.ts',
      description: '重构architectureService.ts,移除对useEngineStore的直接依赖,改为通过参数注入',
    })
  }
  
  const submitOrderViolation = violations.find(v => v.file === 'src/services/useCase/submitOrder.useCase.ts')
  if (submitOrderViolation) {
    actions.push({
      type: 'migrate-type',
      source: 'src/store/helpers/withBroadcast.ts',
      target: 'src/lib/eventBus.ts',
      description: '将withBroadcast工具函数迁移到lib/eventBus.ts',
    })
    actions.push({
      type: 'update-import',
      source: 'src/services/useCase/submitOrder.useCase.ts',
      description: '更新submitOrder.useCase.ts的import路径',
      code: `import { withBroadcast } from '@/lib/eventBus'`,
    })
  }
  
  return { violations, actions }
}

// 执行修复
async function executeFix(plan: FixPlan, dryRun: boolean) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`跨层调用违规修复计划`)
  console.log(`${'='.repeat(60)}\n`)
  
  console.log(`检测到 ${plan.violations.length} 处违规:\n`)
  plan.violations.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.file}:${v.line}`)
    console.log(`     类型: ${v.type}`)
    console.log(`     导入: ${v.importedTypes.join(', ')}`)
    console.log(`     来源: ${v.importPath}\n`)
  })
  
  console.log(`\n修复动作 (${plan.actions.length} 步):\n`)
  plan.actions.forEach((action, i) => {
    console.log(`  ${i + 1}. [${action.type}] ${action.description}`)
    if (action.target) {
      console.log(`     目标: ${action.target}`)
    }
  })
  
  if (dryRun) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[DRY RUN] 未执行实际修复`)
    console.log(`${'='.repeat(60)}\n`)
    return
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`开始执行修复...`)
  console.log(`${'='.repeat(60)}\n`)
  
  // 实际修复逻辑将在批次1中手动实现
  console.log(`请执行批次1修复脚本: fix-batch1-layer-violations.ts\n`)
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  
  try {
    const violations = await detectViolations()
    const plan = generateFixPlan(violations)
    await executeFix(plan, dryRun)
  } catch (err) {
    console.error('修复失败:', err)
    process.exit(1)
  }
}

main()
