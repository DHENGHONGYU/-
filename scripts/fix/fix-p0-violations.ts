#!/usr/bin/env tsx
/**
 * P0 级别警告自动化修复脚本
 * 
 * 修复目标：
 * 1. Core层依赖违规（8个）- 通过接口注入方式解耦
 * 2. 超高圈复杂度（2个）- 提取复杂条件分支为独立函数
 * 
 * 使用方法：
 *   npx tsx scripts/fix-p0-violations.ts              # 查看修复计划
 *   npx tsx scripts/fix-p0-violations.ts --execute    # 执行修复
 *   npx tsx scripts/fix-p0-violations.ts --dry-run    # 模拟执行（默认）
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const RESET = '\x1b[0m'

interface FixAction {
  id: string
  description: string
  file: string
  type: 'interface' | 'inject' | 'extract' | 'remove'
  severity: 'CRITICAL' | 'MAJOR'
  before?: string
  after?: string
  context?: string
}

const fixActions: FixAction[] = [
  {
    id: 'P0-001',
    description: 'databridgeStrategyRouter.ts: 创建策略分析器接口',
    file: 'src/core/databridgeStrategyRouter.ts',
    type: 'interface',
    severity: 'CRITICAL',
    context: 'core层禁止直接import services层，需通过接口注入'
  },
  {
    id: 'P0-002',
    description: 'databridgeStrategyRouter.ts: 移除services层直接导入',
    file: 'src/core/databridgeStrategyRouter.ts',
    type: 'remove',
    severity: 'CRITICAL',
    before: `import { analyze as analyzeHotSector, type HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import { detect as detectRotation, type RotationSignalInput } from '@/services/scoring/rotationSignalDetector'
import { analyze as analyzeValuePit, type ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'`,
    after: `import type { HotSectorAnalyzerInput, RotationSignalInput, ValuePitAnalyzerInput } from '@/types/modules/strategy.types'`
  },
  {
    id: 'P0-003',
    description: 'feedbackOrchestrator.ts: 创建服务接口',
    file: 'src/core/feedbackOrchestrator.ts',
    type: 'interface',
    severity: 'CRITICAL',
    context: 'core层禁止直接import services层，需通过接口注入'
  },
  {
    id: 'P0-004',
    description: 'feedbackOrchestrator.ts: 移除services层直接导入',
    file: 'src/core/feedbackOrchestrator.ts',
    type: 'remove',
    severity: 'CRITICAL',
    before: `import { runV6Score, getV6ScoreQuality } from '@/services/scoring/v6ScoreService'
import { fetchStockBasic, fetchStockKline, fetchFinancial } from '@/services/fetcher/fetcherService'`,
    after: `import type { V6ScoreService, FetcherService } from '@/types/modules/service.types'`
  },
  {
    id: 'P0-005',
    description: 'pipelineScheduler.ts: 创建调度接口',
    file: 'src/core/pipelineScheduler.ts',
    type: 'interface',
    severity: 'CRITICAL',
    context: 'core层禁止直接import services层，需通过接口注入'
  },
  {
    id: 'P0-006',
    description: 'pipelineScheduler.ts: 移除services层直接导入',
    file: 'src/core/pipelineScheduler.ts',
    type: 'remove',
    severity: 'CRITICAL',
    before: `import { runV6Score } from '@/services/scoring/v6ScoreService'`,
    after: `import type { V6ScoreService } from '@/types/modules/service.types'`
  },
  {
    id: 'P0-007',
    description: '创建策略类型定义文件',
    file: 'src/types/modules/strategy.types.ts',
    type: 'interface',
    severity: 'CRITICAL',
    context: '为策略分析器创建类型定义，支持core/services层解耦'
  },
  {
    id: 'P0-008',
    description: '创建服务类型定义文件',
    file: 'src/types/modules/service.types.ts',
    type: 'interface',
    severity: 'CRITICAL',
    context: '为评分服务和抓取服务创建类型定义，支持core/services层解耦'
  },
]

function logInfo(msg: string): void {
  console.log(`${BLUE}ℹ${RESET} ${msg}`)
}

function logWarn(msg: string): void {
  console.log(`${YELLOW}⚠${RESET} ${msg}`)
}

function logError(msg: string): void {
  console.log(`${RED}✗${RESET} ${msg}`)
}

function logSuccess(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}

function readFile(filePath: string): string {
  return readFileSync(join(ROOT, filePath), 'utf-8')
}

function writeFile(filePath: string, content: string): void {
  writeFileSync(join(ROOT, filePath), content, 'utf-8')
}

function applyFix(fix: FixAction, execute: boolean): boolean {
  const filePath = join(ROOT, fix.file)
  
  if (fix.type === 'interface') {
    if (fix.file === 'src/types/modules/strategy.types.ts') {
      return createStrategyTypesFile(fix, execute)
    }
    if (fix.file === 'src/types/modules/service.types.ts') {
      return createServiceTypesFile(fix, execute)
    }
    if (!existsSync(filePath)) {
      logError(`文件不存在: ${fix.file}`)
      return false
    }
    return createInterfaceInFile(fix, execute)
  }

  if (!existsSync(filePath)) {
    logError(`文件不存在: ${fix.file}`)
    return false
  }

  if (fix.type === 'remove' && fix.before && fix.after) {
    const content = readFile(fix.file)
    if (!content.includes(fix.before)) {
      logWarn(`匹配失败（可能已修复）: ${fix.id} - ${fix.description}`)
      return false
    }
    const newContent = content.replace(fix.before, fix.after)
    
    if (execute) {
      writeFile(fix.file, newContent)
      logSuccess(`已修复: ${fix.id} - ${fix.description}`)
    } else {
      logInfo(`[模拟] 将修复: ${fix.id} - ${fix.description}`)
    }
    return true
  }

  logWarn(`未实现的修复类型: ${fix.type} - ${fix.id}`)
  return false
}

function createStrategyTypesFile(fix: FixAction, execute: boolean): boolean {
  const content = `/**
 * 策略分析器类型定义
 * 
 * 用于 core/services 层解耦：
 * - core 层引用此类型定义
 * - services 层实现具体逻辑
 * - 通过依赖注入在 main.tsx 启动时注册实现
 */

export interface HotSectorAnalyzerInput {
  sectorCodes: string[]
  date?: string
}

export interface HotSectorAnalyzerOutput {
  sectorCode: string
  score: number
  dimensionScores: Record<string, number>
  timestamp: number
}

export interface RotationSignalInput {
  sectorCodes: string[]
  days?: number
}

export interface RotationSignalOutput {
  sectorCode: string
  signal: 'bullish' | 'bearish' | 'neutral'
  strength: number
  factors: Record<string, number>
  timestamp: number
}

export interface ValuePitAnalyzerInput {
  stockCodes: string[]
  date?: string
}

export interface ValuePitAnalyzerOutput {
  stockCode: string
  score: number
  valueScore: number
  momentumScore: number
  timestamp: number
}

export interface StrategyAnalyzers {
  analyzeHotSector: (input: HotSectorAnalyzerInput) => Promise<HotSectorAnalyzerOutput[]>
  detectRotation: (input: RotationSignalInput) => Promise<RotationSignalOutput[]>
  analyzeValuePit: (input: ValuePitAnalyzerInput) => Promise<ValuePitAnalyzerOutput[]>
}
`
  if (execute) {
    writeFile(fix.file, content)
    logSuccess(`已创建: ${fix.id} - ${fix.description}`)
  } else {
    logInfo(`[模拟] 将创建: ${fix.id} - ${fix.description}`)
  }
  return true
}

function createServiceTypesFile(fix: FixAction, execute: boolean): boolean {
  const content = `/**
 * 服务层类型定义
 * 
 * 用于 core/services 层解耦：
 * - core 层引用此类型定义
 * - services 层实现具体逻辑
 * - 通过依赖注入在 main.tsx 启动时注册实现
 */

import type { V6Score } from '@/data/types'
import type { StockBasic, StockKline, FinancialReport } from '@/data/types'

export interface V6ScoreService {
  runV6Score(symbol: string): Promise<V6Score | null>
  getV6ScoreQuality(score: V6Score): number
}

export interface FetcherService {
  fetchStockBasic(symbol: string): Promise<StockBasic | null>
  fetchStockKline(symbol: string, days: number): Promise<StockKline[] | null>
  fetchFinancial(symbol: string): Promise<FinancialReport | null>
}
`
  if (execute) {
    writeFile(fix.file, content)
    logSuccess(`已创建: ${fix.id} - ${fix.description}`)
  } else {
    logInfo(`[模拟] 将创建: ${fix.id} - ${fix.description}`)
  }
  return true
}

function createInterfaceInFile(fix: FixAction, execute: boolean): boolean {
  const content = readFile(fix.file)
  
  if (fix.file === 'src/core/databridgeStrategyRouter.ts') {
    const interfaceCode = `
export interface StrategyAnalyzers {
  analyzeHotSector: (input: HotSectorAnalyzerInput) => Promise<unknown[]>
  detectRotation: (input: RotationSignalInput) => Promise<unknown[]>
  analyzeValuePit: (input: ValuePitAnalyzerInput) => Promise<unknown[]>
}

export interface StrategyRouterOptions {
  analyzers?: StrategyAnalyzers
}
`
    if (!content.includes('StrategyAnalyzers')) {
      if (execute) {
        writeFile(fix.file, content + interfaceCode)
        logSuccess(`已添加接口: ${fix.id} - ${fix.description}`)
      } else {
        logInfo(`[模拟] 将添加接口: ${fix.id} - ${fix.description}`)
      }
      return true
    }
    logWarn(`接口已存在: ${fix.id} - ${fix.description}`)
    return false
  }

  if (fix.file === 'src/core/feedbackOrchestrator.ts') {
    const interfaceCode = `
export interface FeedbackServices {
  runV6Score: (symbol: string) => Promise<V6Score | null>
  getV6ScoreQuality: (score: V6Score) => number
  fetchStockBasic: (symbol: string) => Promise<unknown>
  fetchStockKline: (symbol: string, days: number) => Promise<unknown>
  fetchFinancial: (symbol: string) => Promise<unknown>
}

export interface FeedbackOrchestratorOptions {
  services?: FeedbackServices
}
`
    if (!content.includes('FeedbackServices')) {
      if (execute) {
        writeFile(fix.file, content + interfaceCode)
        logSuccess(`已添加接口: ${fix.id} - ${fix.description}`)
      } else {
        logInfo(`[模拟] 将添加接口: ${fix.id} - ${fix.description}`)
      }
      return true
    }
    logWarn(`接口已存在: ${fix.id} - ${fix.description}`)
    return false
  }

  if (fix.file === 'src/core/pipelineScheduler.ts') {
    const interfaceCode = `
export interface PipelineServices {
  runV6Score: (symbol: string) => Promise<unknown>
}

export interface PipelineSchedulerOptions {
  services?: PipelineServices
}
`
    if (!content.includes('PipelineServices')) {
      if (execute) {
        writeFile(fix.file, content + interfaceCode)
        logSuccess(`已添加接口: ${fix.id} - ${fix.description}`)
      } else {
        logInfo(`[模拟] 将添加接口: ${fix.id} - ${fix.description}`)
      }
      return true
    }
    logWarn(`接口已存在: ${fix.id} - ${fix.description}`)
    return false
  }

  logWarn(`未实现的接口创建: ${fix.file}`)
  return false
}

function main(): void {
  const execute = process.argv.includes('--execute')
  const dryRun = process.argv.includes('--dry-run') || !execute

  console.log('\n' + '='.repeat(80))
  console.log('P0 级别警告自动化修复脚本')
  console.log('='.repeat(80) + '\n')

  if (dryRun) {
    logInfo('模式: 模拟执行（使用 --execute 参数执行实际修复）')
  } else {
    logWarn('模式: 实际执行，将修改文件！')
  }

  console.log('\n' + '修复计划:')
  console.log('-'.repeat(80))

  const criticalFixes = fixActions.filter(f => f.severity === 'CRITICAL')
  const majorFixes = fixActions.filter(f => f.severity === 'MAJOR')

  console.log(`\n${RED}[CRITICAL] Core层依赖违规修复（${criticalFixes.length}项）${RESET}`)
  for (const fix of criticalFixes) {
    console.log(`  ${fix.id}: ${fix.description}`)
    if (fix.context) {
      console.log(`      ${YELLOW}原因: ${fix.context}${RESET}`)
    }
  }

  if (majorFixes.length > 0) {
    console.log(`\n${YELLOW}[MAJOR] 圈复杂度修复（${majorFixes.length}项）${RESET}`)
    for (const fix of majorFixes) {
      console.log(`  ${fix.id}: ${fix.description}`)
    }
  }

  if (dryRun) {
    console.log('\n' + '-'.repeat(80))
    logInfo('如需执行修复，请运行: npx tsx scripts/fix-p0-violations.ts --execute')
    return
  }

  console.log('\n' + '-'.repeat(80))
  console.log('开始执行修复...\n')

  let successCount = 0
  let failCount = 0

  for (const fix of fixActions) {
    const result = applyFix(fix, execute)
    if (result) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log('\n' + '-'.repeat(80))
  console.log('修复结果汇总:')
  console.log(`  ${GREEN}成功: ${successCount}${RESET}`)
  console.log(`  ${RED}失败: ${failCount}${RESET}`)
  console.log(`  ${YELLOW}总计: ${fixActions.length}${RESET}`)

  if (failCount > 0) {
    logWarn('部分修复失败，请手动检查并修复')
  } else {
    logSuccess('所有修复已完成！')
  }

  console.log('\n' + '后续步骤:')
  console.log('  1. 在 main.tsx 中注册服务实现')
  console.log('  2. 修改 core 层代码使用注入的服务')
  console.log('  3. 运行 npm run audit:split-quality 验证')
  console.log('  4. 运行 npm run test 确保测试通过')
}

main()
