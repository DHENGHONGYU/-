#!/usr/bin/env node
/**
 * @module scripts/docs-tool/doc-proofread
 * @description 自动文档校对策略执行器（doc:proofread）
 *
 * 依据 doc-proofreading-strategy.ts 运行三类交叉引用检查（doc-to-code /
 * code-to-doc / doc-to-doc），但仅对策略适用范围（默认 core + important）内的
 * 文档执行并统计。打印按类型拆解的"范围内总数 / 断裂数"，并按策略 blocking
 * 标志决定退出码：
 *   - 若某检查 blocking=true 且存在范围内断裂 → 退出 1（阻断）
 *   - 否则 → 退出 0（仅上报，不阻断）
 *
 * 用法：
 *   npx tsx scripts/docs-tool/doc-proofread.ts [--json] [--output <path>]
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFullAudit, type Reference, type ReferenceType } from './cross-ref-engine'
import {
  PROOFREADING_STRATEGY,
  resolveDocTier,
  getCheckPolicy,
  type DocTier,
} from './doc-proofreading-strategy'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS_ROOT = join(ROOT, 'docs')
const REPORTS_DIR = join(ROOT, 'scripts', 'docs', 'reports', 'proofread')

interface CliOptions {
  json: boolean
  output?: string
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--output' && i + 1 < argv.length) opts.output = argv[++i]
  }
  return opts
}

/** 计算某条引用"受策略约束的文档"的 tier */
function refScopeTier(ref: Reference): DocTier {
  let docPath: string
  if (ref.type === 'code-to-doc') {
    // 目标文档决定范围
    docPath = ref.target.startsWith('docs/')
      ? resolve(ROOT, ref.target)
      : resolve(ROOT, dirname(ref.source), ref.target)
  } else {
    // doc-to-code / doc-to-doc：源文档决定范围
    docPath = ref.target.startsWith('docs/')
      ? resolve(ROOT, ref.target)
      : resolve(ROOT, dirname(ref.source), ref.target)
  }
  return resolveDocTier(docPath.replace(/\\/g, '/'), DOCS_ROOT)
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2))
  const result = runFullAudit(ROOT)
  const inScope = new Set<DocTier>(PROOFREADING_STRATEGY.appliesToTiers)

  const types: ReferenceType[] = ['doc-to-code', 'code-to-doc', 'doc-to-doc']
  const scopeStats: Record<ReferenceType, { total: number; broken: number }> = {
    'doc-to-code': { total: 0, broken: 0 },
    'code-to-doc': { total: 0, broken: 0 },
    'doc-to-doc': { total: 0, broken: 0 },
  }

  // 范围内总数（含有效），用于评估覆盖率
  for (const ref of result.validReferences) {
    if (inScope.has(refScopeTier(ref))) {
      scopeStats[ref.type].total++
    }
  }
  // 范围内断裂
  for (const ref of result.brokenReferences) {
    if (inScope.has(refScopeTier(ref))) {
      scopeStats[ref.type].total++
      scopeStats[ref.type].broken++
    }
  }

  const wouldBlock = types.some(
    (t) => getCheckPolicy(t).blocking && scopeStats[t].broken > 0,
  )

  const report = {
    meta: {
      scriptName: 'doc-proofread',
      strategyVersion: PROOFREADING_STRATEGY.version,
      appliesToTiers: PROOFREADING_STRATEGY.appliesToTiers,
      timestamp: new Date().toISOString(),
    },
    scopeStats,
    wouldBlock,
    fullSummary: result.summary,
  }

  if (!opts.json) {
    console.log('🔍 自动文档校对策略执行（范围：%s）', PROOFREADING_STRATEGY.appliesToTiers.join(' + '))
    console.log('─'.repeat(60))
    for (const t of types) {
      const p = getCheckPolicy(t)
      const mark = scopeStats[t].broken > 0 ? (p.blocking ? '❌' : '⚠️ ') : '✅'
      console.log(
        '  %s [%s] %s: 范围内 %d 条，断裂 %d（%s）',
        mark,
        p.id,
        p.name,
        scopeStats[t].total,
        scopeStats[t].broken,
        p.blocking ? '阻断' : '仅上报',
      )
    }
    console.log('─'.repeat(60))
    const totalBroken = types.reduce((s, t) => s + scopeStats[t].broken, 0)
    if (totalBroken === 0) {
      console.log('✅ 核心/重要文档范围内无断裂交叉引用')
    } else if (wouldBlock) {
      console.log('❌ 存在阻断级断裂引用，门禁应失败')
    } else {
      console.log('⚠️  发现 %d 条范围内断裂引用（当前策略为仅上报，不阻断）', totalBroken)
    }
  } else {
    console.log(JSON.stringify(report, null, 2))
  }

  // 持久化报告
  try {
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true })
    const out = opts.output ?? join(REPORTS_DIR, `proofread-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8')
    if (!opts.json) console.log('📄 报告已持久化: %s', out)
  } catch {
    /* 持久化失败不影响退出码 */
  }

  process.exit(wouldBlock ? 1 : 0)
}

main()
