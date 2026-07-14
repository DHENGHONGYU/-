#!/usr/bin/env node
/**
 * @module scripts/workflow-rule-engine
 * @description 工作流规则引擎 — 基于代码变更特征自动判断决策级别
 *
 * 决策级别：
 * - auto_execute: 自主执行（低风险、单模块、完全可逆）
 * - request_approval: 人工确认（中风险、跨模块、部分可逆）
 * - request_decision: 人工决策（高风险、系统级、不可逆）
 *
 * 用法：
 *   npx tsx scripts/workflow-rule-engine.ts [--json] [--verbose]
 */

import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()

// ANSI 颜色码
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

type DecisionAction = 'auto_execute' | 'request_approval' | 'request_decision'

interface WorkflowRule {
  id: string
  name: string
  description: string
  condition: (context: ChangeContext) => boolean
  action: DecisionAction
  priority: number
  rationale: string
}

interface ChangeContext {
  changedFiles: string[]
  affectedModules: Set<string>
  isRefactor: boolean
  isCodeFix: boolean
  isTypeChange: boolean
  isInterfaceChange: boolean
  isConfigChange: boolean
  isCoreAlgorithmChange: boolean
  isDatabaseSchemaChange: boolean
  affectedFileCount: number
}

interface RuleEvaluationResult {
  rule: WorkflowRule
  matched: boolean
  context: ChangeContext
}

interface DecisionResult {
  action: DecisionAction
  rule: WorkflowRule
  context: ChangeContext
  recommendations: string[]
}

// ─── 规则定义 ─────────────────────────────────────────────────────────────────

const WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: 'R001',
    name: '单模块代码修复',
    description: '单个模块内的代码修复、格式化、注释更新',
    condition: (ctx) => {
      return ctx.affectedModules.size === 1 && ctx.isCodeFix && !ctx.isRefactor
    },
    action: 'auto_execute',
    priority: 1,
    rationale: '低风险、完全可逆、影响范围可控',
  },
  {
    id: 'R002',
    name: '单元测试补充',
    description: '为现有代码补充单元测试（覆盖率 < 80%）',
    condition: (ctx) => {
      return ctx.changedFiles.some((f) => f.includes('.test.') || f.includes('__tests__'))
    },
    action: 'auto_execute',
    priority: 2,
    rationale: '测试补充不会改变业务逻辑，完全可逆',
  },
  {
    id: 'R003',
    name: '文档同步更新',
    description: '类型定义变更时同步更新数据字典',
    condition: (ctx) => {
      return ctx.isTypeChange && ctx.affectedModules.size <= 2
    },
    action: 'auto_execute',
    priority: 3,
    rationale: '文档更新是必要的同步操作，低风险',
  },
  {
    id: 'R004',
    name: '架构合规性修复',
    description: '修复分层调用违规、硬编码问题',
    condition: (ctx) => {
      return ctx.changedFiles.some((f) => f.includes('constants/') || f.includes('config/'))
    },
    action: 'auto_execute',
    priority: 4,
    rationale: '合规性修复是必要的维护工作',
  },
  {
    id: 'R005',
    name: '跨模块重构',
    description: '涉及 3 个以上模块的重构操作',
    condition: (ctx) => {
      return ctx.affectedModules.size >= 3 && ctx.isRefactor
    },
    action: 'request_approval',
    priority: 10,
    rationale: '跨模块重构影响范围广，需要人工评估影响',
  },
  {
    id: 'R006',
    name: '数据库 Schema 变更',
    description: '修改 DB_VERSION 或新增 IndexedDB Store',
    condition: (ctx) => {
      return ctx.isDatabaseSchemaChange
    },
    action: 'request_approval',
    priority: 11,
    rationale: '数据库变更影响数据持久化，需要谨慎评估',
  },
  {
    id: 'R007',
    name: '接口签名变更',
    description: '修改 Service 或 Store 的公开接口',
    condition: (ctx) => {
      return ctx.isInterfaceChange && ctx.affectedModules.size >= 2
    },
    action: 'request_approval',
    priority: 12,
    rationale: '接口变更可能影响多个调用方',
  },
  {
    id: 'R008',
    name: '配置参数调整',
    description: '修改引擎配置、阈值参数',
    condition: (ctx) => {
      return ctx.isConfigChange && !ctx.isCoreAlgorithmChange
    },
    action: 'request_approval',
    priority: 13,
    rationale: '配置参数影响业务逻辑，需要验证正确性',
  },
  {
    id: 'R009',
    name: '技术栈更换',
    description: '替换核心依赖（如 Zustand → Redux）',
    condition: (ctx) => {
      return ctx.changedFiles.some((f) => f.includes('package.json')) && ctx.affectedModules.size >= 5
    },
    action: 'request_decision',
    priority: 20,
    rationale: '技术栈更换是战略性决策，影响深远',
  },
  {
    id: 'R010',
    name: '核心算法重构',
    description: '修改 V6 评分引擎、数据融合算法',
    condition: (ctx) => {
      return ctx.isCoreAlgorithmChange
    },
    action: 'request_decision',
    priority: 21,
    rationale: '核心算法变更影响业务核心逻辑',
  },
  {
    id: 'R011',
    name: '安全策略变更',
    description: '修改认证、授权、加密相关代码',
    condition: (ctx) => {
      return ctx.changedFiles.some(
        (f) =>
          f.includes('auth') ||
          f.includes('security') ||
          f.includes('encrypt') ||
          f.includes('acl'),
      )
    },
    action: 'request_decision',
    priority: 22,
    rationale: '安全策略变更风险极高，需要专家评审',
  },
]

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function getChangedFiles(since = 'HEAD~1'): string[] {
  try {
    const output = execSync(`git diff --name-only ${since} HEAD`, {
      encoding: 'utf-8',
      cwd: ROOT,
    })
    return output.split('\n').filter((line) => line.trim().length > 0)
  } catch {
    console.warn(`${C.yellow}⚠️  无法获取 git diff，使用空变更列表${C.reset}`)
    return []
  }
}

function analyzeChangeContext(changedFiles: string[]): ChangeContext {
  const affectedModules = new Set<string>()
  let isRefactor = false
  let isCodeFix = false
  let isTypeChange = false
  let isInterfaceChange = false
  let isConfigChange = false
  let isCoreAlgorithmChange = false
  let isDatabaseSchemaChange = false

  for (const file of changedFiles) {
    // 提取模块名
    const parts = file.split('/')
    if (parts.length >= 2 && parts[0] === 'src') {
      affectedModules.add(parts[1] ?? '')
    }

    // 检测变更类型
    if (file.includes('refactor') || file.includes('Refactor')) {
      isRefactor = true
    }
    if (file.includes('fix') || file.includes('Fix') || file.includes('patch')) {
      isCodeFix = true
    }
    if (file.includes('types.ts') || file.includes('types/')) {
      isTypeChange = true
    }
    if (file.includes('index.ts') && file.includes('services/')) {
      isInterfaceChange = true
    }
    if (file.includes('config.ts') || file.includes('constants/')) {
      isConfigChange = true
    }
    if (file.includes('v6-engine') || file.includes('scoring')) {
      isCoreAlgorithmChange = true
    }
    if (file.includes('dbConfig.ts') || file.includes('dataLayer.ts')) {
      isDatabaseSchemaChange = true
    }
  }

  return {
    changedFiles,
    affectedModules,
    isRefactor,
    isCodeFix,
    isTypeChange,
    isInterfaceChange,
    isConfigChange,
    isCoreAlgorithmChange,
    isDatabaseSchemaChange,
    affectedFileCount: changedFiles.length,
  }
}

function evaluateRules(context: ChangeContext): RuleEvaluationResult[] {
  const results: RuleEvaluationResult[] = []

  for (const rule of WORKFLOW_RULES) {
    const matched = rule.condition(context)
    results.push({ rule, matched, context })
  }

  return results
}

function determineDecision(results: RuleEvaluationResult[]): DecisionResult | null {
  // 按优先级排序（数字越小优先级越高）
  const matchedRules = results
    .filter((r) => r.matched)
    .sort((a, b) => a.rule.priority - b.rule.priority)

  if (matchedRules.length === 0) {
    return null
  }

  // 选择优先级最高的规则
  const highestPriorityRule = matchedRules[0].rule
  const context = matchedRules[0].context

  // 生成建议
  const recommendations: string[] = []
  for (const result of matchedRules) {
    recommendations.push(`[${result.rule.id}] ${result.rule.name}: ${result.rule.rationale}`)
  }

  return {
    action: highestPriorityRule.action,
    rule: highestPriorityRule,
    context,
    recommendations,
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

interface CliArgs {
  json: boolean
  verbose: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { json: false, verbose: false }

  for (const arg of argv.slice(2)) {
    if (arg === '--json') {
      args.json = true
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
${C.bold}workflow-rule-engine${C.reset} — 工作流规则引擎

${C.bold}用法:${C.reset}
  npx tsx scripts/workflow-rule-engine.ts [选项]

${C.bold}选项:${C.reset}
  ${C.cyan}--json${C.reset}           以 JSON 格式输出
  ${C.cyan}--verbose${C.reset}        显示详细评估过程
  ${C.cyan}--help${C.reset}           显示此帮助信息

${C.bold}决策级别:${C.reset}
  ${C.green}auto_execute${C.reset}       自主执行（低风险、单模块、完全可逆）
  ${C.yellow}request_approval${C.reset}  人工确认（中风险、跨模块、部分可逆）
  ${C.red}request_decision${C.reset}   人工决策（高风险、系统级、不可逆）
`)
      process.exit(0)
    } else {
      console.error(`${C.red}未知参数: ${arg}${C.reset}`)
      process.exit(1)
    }
  }

  return args
}

function formatAction(action: DecisionAction): string {
  switch (action) {
    case 'auto_execute':
      return `${C.green}✓ 自主执行${C.reset}`
    case 'request_approval':
      return `${C.yellow}◐ 人工确认${C.reset}`
    case 'request_decision':
      return `${C.red}✗ 人工决策${C.reset}`
  }
}

function main(): void {
  const args = parseArgs(process.argv)

  if (!args.json) {
    console.log('')
    console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
    console.log(`${C.bold}${C.cyan}║  工作流规则引擎 — workflow-rule-engine.ts                ║${C.reset}`)
    console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
    console.log('')
  }

  // 获取变更文件
  const changedFiles = getChangedFiles()
  if (changedFiles.length === 0) {
    if (args.json) {
      console.log(JSON.stringify({ action: 'auto_execute', reason: '无代码变更' }, null, 2))
    } else {
      console.log(`${C.yellow}未检测到代码变更${C.reset}`)
    }
    return
  }

  // 分析变更上下文
  const context = analyzeChangeContext(changedFiles)

  if (args.verbose && !args.json) {
    console.log(`${C.bold}变更上下文分析:${C.reset}`)
    console.log(`  变更文件数: ${context.changedFiles.length}`)
    console.log(`  影响模块数: ${context.affectedModules.size}`)
    console.log(`  影响模块: ${Array.from(context.affectedModules).join(', ')}`)
    console.log(`  是否重构: ${context.isRefactor ? '是' : '否'}`)
    console.log(`  是否修复: ${context.isCodeFix ? '是' : '否'}`)
    console.log(`  是否类型变更: ${context.isTypeChange ? '是' : '否'}`)
    console.log(`  是否接口变更: ${context.isInterfaceChange ? '是' : '否'}`)
    console.log(`  是否配置变更: ${context.isConfigChange ? '是' : '否'}`)
    console.log(`  是否核心算法变更: ${context.isCoreAlgorithmChange ? '是' : '否'}`)
    console.log(`  是否数据库变更: ${context.isDatabaseSchemaChange ? '是' : '否'}`)
    console.log('')
  }

  // 评估规则
  const results = evaluateRules(context)

  if (args.verbose && !args.json) {
    console.log(`${C.bold}规则评估结果:${C.reset}`)
    for (const result of results) {
      const status = result.matched ? `${C.green}✓${C.reset}` : `${C.dim}✗${C.reset}`
      console.log(`  ${status} [${result.rule.id}] ${result.rule.name} (优先级: ${result.rule.priority})`)
    }
    console.log('')
  }

  // 确定决策
  const decision = determineDecision(results)

  if (!decision) {
    if (args.json) {
      console.log(JSON.stringify({ action: 'auto_execute', reason: '未匹配任何规则' }, null, 2))
    } else {
      console.log(`${C.green}✓ 未匹配任何规则，默认自主执行${C.reset}`)
    }
    return
  }

  // 输出结果
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          action: decision.action,
          rule: {
            id: decision.rule.id,
            name: decision.rule.name,
            description: decision.rule.description,
            rationale: decision.rule.rationale,
          },
          context: {
            changedFiles: decision.context.changedFiles,
            affectedModules: Array.from(decision.context.affectedModules),
            affectedFileCount: decision.context.affectedFileCount,
          },
          recommendations: decision.recommendations,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`${C.bold}═══════════════════════════════════════════════════════════${C.reset}`)
    console.log(`${C.bold}决策结果:${C.reset}`)
    console.log('')
    console.log(`  ${C.bold}决策级别:${C.reset} ${formatAction(decision.action)}`)
    console.log(`  ${C.bold}匹配规则:${C.reset} [${decision.rule.id}] ${decision.rule.name}`)
    console.log(`  ${C.bold}规则描述:${C.reset} ${decision.rule.description}`)
    console.log(`  ${C.bold}决策依据:${C.reset} ${decision.rule.rationale}`)
    console.log('')

    if (decision.recommendations.length > 1) {
      console.log(`${C.bold}其他匹配规则:${C.reset}`)
      for (let i = 1; i < decision.recommendations.length; i++) {
        console.log(`  ${C.dim}-${C.reset} ${decision.recommendations[i]}`)
      }
      console.log('')
    }

    console.log(`${C.bold}建议:${C.reset}`)
    console.log('')
    if (decision.action === 'auto_execute') {
      console.log(`  ${C.cyan}1.${C.reset} 可以直接执行变更`)
      console.log(`  ${C.cyan}2.${C.reset} 运行 ${C.bold}npm run audit${C.reset} 验证架构合规性`)
      console.log(`  ${C.cyan}3.${C.reset} 生成结构化日志记录变更`)
    } else if (decision.action === 'request_approval') {
      console.log(`  ${C.cyan}1.${C.reset} 生成影响分析报告`)
      console.log(`  ${C.cyan}2.${C.reset} 提交人工审批`)
      console.log(`  ${C.cyan}3.${C.reset} 获得批准后分步执行`)
      console.log(`  ${C.cyan}4.${C.reset} 每步完成后验证`)
    } else {
      console.log(`  ${C.cyan}1.${C.reset} 生成技术选型报告`)
      console.log(`  ${C.cyan}2.${C.reset} 列出候选方案优劣`)
      console.log(`  ${C.cyan}3.${C.reset} 提交技术评审委员会`)
      console.log(`  ${C.cyan}4.${C.reset} 获得决策结论`)
      console.log(`  ${C.cyan}5.${C.reset} 制定迁移计划`)
    }
    console.log('')
    console.log(`${C.bold}${C.green}✓ 规则引擎评估完成${C.reset}`)
  }
}

main()
