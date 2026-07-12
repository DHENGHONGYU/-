#!/usr/bin/env node
/**
 * @module scripts/doc-update-trigger
 * @description 文档自动更新触发器 — 监控代码变更并提示需要更新的文档
 *
 * 触发器类型：
 * - T1: 类型定义变更 → 更新数据字典
 * - T2: 接口变更 → 更新 API 契约文档
 * - T3: 架构调整 → 更新架构标准文档
 * - T4: 配置参数变更 → 更新引擎规格文档
 *
 * 用法：
 *   npx tsx scripts/doc-update-trigger.ts [--check] [--auto-update]
 *
 * 选项：
 *   --check          仅检查，不生成更新建议
 *   --auto-update    自动生成文档更新补丁（需人工确认）
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const DOCS_DIR = join(ROOT, 'docs')

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

// ─── 触发器规则 ───────────────────────────────────────────────────────────────

interface TriggerRule {
  id: string
  name: string
  patterns: string[]
  docsToUpdate: string[]
  description: string
}

const TRIGGER_RULES: TriggerRule[] = [
  {
    id: 'T1',
    name: '类型定义变更',
    patterns: [
      'src/data/types.ts',
      'src/types/modules/*.ts',
      'src/services/scoring/v6-engine/types.ts',
      'src/core/types.ts',
    ],
    docsToUpdate: [
      'docs/DATA_DICTIONARY_INDEX.md',
      'docs/《V9核心数据字典与类型定义（整合版）》.md',
      'docs/cockpit/DATA_DEFINITION.md',
      'docs/news/DATA_DEFINITION.md',
    ],
    description: '类型定义变更时，需更新数据字典文档',
  },
  {
    id: 'T2',
    name: '接口变更',
    patterns: [
      'src/services/**/index.ts',
      'src/core/databridge.ts',
      'src/data/dataLayer.ts',
      'src/services/fetcher/index.ts',
      'src/services/analysis/index.ts',
    ],
    docsToUpdate: [
      'docs/trade/API_CONTRACT.md',
      'docs/《DataBridge端点与数据映射清单》.md',
      'docs/《功能模块数据契约》.md',
    ],
    description: '接口签名变更时，需更新 API 契约文档',
  },
  {
    id: 'T3',
    name: '架构调整',
    patterns: [
      'src/config/routes.ts',
      'src/config/dbConfig.ts',
      'AGENTS.md',
      'src/config/thresholds.ts',
    ],
    docsToUpdate: [
      'docs/03-architecture-standards.md',
      'docs/06-routing-specs.md',
      'ARCHITECTURE.md',
    ],
    description: '架构调整时，需更新架构标准文档',
  },
  {
    id: 'T4',
    name: '配置参数变更',
    patterns: [
      'src/constants/*.ts',
      'src/config/thresholds.ts',
      'src/services/scoring/v6-engine/config.ts',
    ],
    docsToUpdate: [
      'docs/05-engine-specs.md',
      'docs/09-quality-gates.md',
    ],
    description: '配置参数变更时，需更新引擎规格文档',
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
    console.warn(`${C.yellow}⚠️  无法获取 git diff，尝试扫描全部 src 文件${C.reset}`)
    return []
  }
}

function matchPattern(filePath: string, pattern: string): boolean {
  // 简单的通配符匹配
  if (pattern.includes('**')) {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
    return regex.test(filePath)
  } else if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]*') + '$')
    return regex.test(filePath)
  }
  return filePath === pattern
}

function findTriggeredRules(changedFiles: string[]): Map<TriggerRule, string[]> {
  const triggered = new Map<TriggerRule, string[]>()

  for (const rule of TRIGGER_RULES) {
    const matchedFiles: string[] = []
    for (const file of changedFiles) {
      for (const pattern of rule.patterns) {
        if (matchPattern(file, pattern)) {
          matchedFiles.push(file)
          break
        }
      }
    }
    if (matchedFiles.length > 0) {
      triggered.set(rule, matchedFiles)
    }
  }

  return triggered
}

function checkDocExists(docPath: string): boolean {
  try {
    const fullPath = join(ROOT, docPath)
    statSync(fullPath)
    return true
  } catch {
    return false
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

interface CliArgs {
  check: boolean
  autoUpdate: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { check: false, autoUpdate: false }

  for (const arg of argv.slice(2)) {
    if (arg === '--check') {
      args.check = true
    } else if (arg === '--auto-update') {
      args.autoUpdate = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
${C.bold}doc-update-trigger${C.reset} — 文档自动更新触发器

${C.bold}用法:${C.reset}
  npx tsx scripts/doc-update-trigger.ts [选项]

${C.bold}选项:${C.reset}
  ${C.cyan}--check${C.reset}          仅检查，不生成更新建议
  ${C.cyan}--auto-update${C.reset}    自动生成文档更新补丁（需人工确认）
  ${C.cyan}--help${C.reset}           显示此帮助信息

${C.bold}触发器类型:${C.reset}
  ${C.green}T1${C.reset} 类型定义变更 → 更新数据字典
  ${C.green}T2${C.reset} 接口变更 → 更新 API 契约文档
  ${C.green}T3${C.reset} 架构调整 → 更新架构标准文档
  ${C.green}T4${C.reset} 配置参数变更 → 更新引擎规格文档
`)
      process.exit(0)
    } else {
      console.error(`${C.red}未知参数: ${arg}${C.reset}`)
      process.exit(1)
    }
  }

  return args
}

function main(): void {
  const args = parseArgs(process.argv)

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║  文档自动更新触发器 — doc-update-trigger.ts              ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  // 获取变更文件
  const changedFiles = getChangedFiles()
  if (changedFiles.length === 0) {
    console.log(`${C.yellow}未检测到代码变更${C.reset}`)
    return
  }

  console.log(`${C.bold}检测到 ${changedFiles.length} 个文件变更:${C.reset}`)
  for (const file of changedFiles.slice(0, 10)) {
    console.log(`  ${C.dim}-${C.reset} ${file}`)
  }
  if (changedFiles.length > 10) {
    console.log(`  ${C.dim}... 还有 ${changedFiles.length - 10} 个文件${C.reset}`)
  }
  console.log('')

  // 查找触发的规则
  const triggeredRules = findTriggeredRules(changedFiles)

  if (triggeredRules.size === 0) {
    console.log(`${C.green}✓ 未触发任何文档更新规则${C.reset}`)
    return
  }

  console.log(`${C.bold}${C.yellow}⚠️  触发 ${triggeredRules.size} 个文档更新规则:${C.reset}`)
  console.log('')

  const docsToUpdate = new Set<string>()

  for (const [rule, matchedFiles] of triggeredRules) {
    console.log(`${C.bold}${C.cyan}[${rule.id}] ${rule.name}${C.reset}`)
    console.log(`  ${C.dim}${rule.description}${C.reset}`)
    console.log(`  ${C.bold}匹配文件:${C.reset}`)
    for (const file of matchedFiles) {
      console.log(`    ${C.dim}-${C.reset} ${file}`)
    }
    console.log(`  ${C.bold}需要更新的文档:${C.reset}`)
    for (const doc of rule.docsToUpdate) {
      const exists = checkDocExists(doc)
      const status = exists ? `${C.green}✓${C.reset}` : `${C.red}✗ 不存在${C.reset}`
      console.log(`    ${status} ${doc}`)
      if (exists) {
        docsToUpdate.add(doc)
      }
    }
    console.log('')
  }

  if (docsToUpdate.size === 0) {
    console.log(`${C.yellow}没有需要更新的文档${C.reset}`)
    return
  }

  console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════${C.reset}`)
  console.log(`${C.bold}需要更新 ${docsToUpdate.size} 个文档:${C.reset}`)
  console.log('')

  for (const doc of docsToUpdate) {
    console.log(`  ${C.cyan}→${C.reset} ${doc}`)
  }
  console.log('')

  if (args.check) {
    console.log(`${C.dim}（仅检查模式，不生成更新建议）${C.reset}`)
    return
  }

  // 生成更新建议
  console.log(`${C.bold}更新建议:${C.reset}`)
  console.log('')
  console.log(`  ${C.cyan}1.${C.reset} 手动更新上述文档，确保与代码变更保持一致`)
  console.log(`  ${C.cyan}2.${C.reset} 运行 ${C.bold}npm run audit:docs${C.reset} 验证文档同步状态`)
  console.log(`  ${C.cyan}3.${C.reset} 提交文档变更时，在 commit message 中说明关联的代码变更`)
  console.log('')

  if (args.autoUpdate) {
    console.log(`${C.yellow}⚠️  自动更新功能尚未实现，请手动更新文档${C.reset}`)
  }

  console.log(`${C.bold}${C.green}✓ 文档更新触发器执行完成${C.reset}`)
}

main()
