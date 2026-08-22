/**
 * @fileoverview 采集管线 Dry-Run 静态校验门禁（GAP-4 治理工具链补实现，2026-08-22）
 *
 * 对 5 个策略模板 × 16 个维度做「不触网」的接线完整性 + 预算双校验：
 * 1. mode 解析：resolveDimensionMode(code) ≠ 'unsupported'
 * 2. dispatch 覆盖：mode ∈ {quote,kline,financial} ∪ NON_QUOTE_MODES（防 GAP-1 复发）
 * 3. 写入链路：DIMENSION_TO_ACTION → ENVELOPE_ACTION → STORE_NAME → ACL_MATRIX[fetcher].write
 *    四环齐备（防 GAP-2 复发；ACTION_TO_STORE_MAP 与 PutHandler 注册由 audit:acl-consistency 覆盖）
 * 4. 预算校验：MonthlyBudgetGuard.evaluate() 计划量 ≤ 月度预算且非 exceeded
 *
 * 每次运行将报告落盘 outputs/collection-dry-run.json（供 CI  artifact 与趋势比对）。
 * 通过阈值：接线得分 = 1.0（≥ Skill 要求的 0.92）；预算 status ≠ exceeded。
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_DIMENSIONS,
  STRATEGY_TEMPLATES,
  estimateTotalMonthlyCalls,
} from '@/config/collectConfig'
import { ENVELOPE_ACTION, STORE_NAME, ACL_MATRIX, MODULE_ID } from '@/config/dbConfig'
import {
  resolveDimensionMode,
  NON_QUOTE_MODES,
  DIMENSION_TO_ACTION,
} from '@/services/data-collector/collectionPipeline'
import { monthlyBudgetGuard } from '@/services/data-collector/MonthlyBudgetGuard'
import type { DimensionConfig, StrategyTemplate } from '@/types/modules/collection.types'

// ── 采集域 ENVELOPE_ACTION → STORE_NAME 映射（与 databridge.ts ACTION_TO_STORE_MAP 对齐；
//    若漂移本套件 FAIL，即为防漂移设计意图） ──
const COLLECTION_ACTION_STORE: Readonly<Record<string, string>> = {
  [ENVELOPE_ACTION.saveNews]: STORE_NAME.news,
  [ENVELOPE_ACTION.saveSectorScores]: STORE_NAME.sectorScores,
  [ENVELOPE_ACTION.saveResearchLog]: STORE_NAME.researchLogs,
  [ENVELOPE_ACTION.saveLocalDocs]: STORE_NAME.localDocs,
  [ENVELOPE_ACTION.saveSectorCollectData]: STORE_NAME.sectorCollectData,
  // v38（2026-08-23 遗留问题整改 P2）：维度 11-14 通用专用存储，与 ACTION_TO_STORE_MAP 对齐
  [ENVELOPE_ACTION.saveDimensionCollectData]: STORE_NAME.dimensionCollectData,
}

/** dispatch 分支实际覆盖的 mode 全集（与 runSingleTraceImpl 对齐） */
const DISPATCHED_MODES: ReadonlySet<string> = new Set(['quote', 'kline', 'financial', ...NON_QUOTE_MODES])

interface DimensionDryRunResult {
  code: string
  name: string
  enabled: boolean
  mode: string
  wired: boolean
  failures: string[]
}

interface TemplateDryRunResult {
  templateId: string
  templateName: string
  enabledCount: number
  wiredCount: number
  wiringScore: number
  monthlyPlanned: number
  monthlyBudget: number
  budgetStatus: string
  budgetReasons: string[]
  dimensions: DimensionDryRunResult[]
}

/** 复刻 sevenDimConfigStore.generateDimensionsFromTemplate 的纯配置展开（不触 store/IndexedDB） */
function expandTemplate(template: StrategyTemplate): DimensionConfig[] {
  return DEFAULT_DIMENSIONS.map((dim) => ({
    ...dim,
    enabled: template.dimensions.includes(dim.code),
    frequency: template.dimensions.includes(dim.code) ? template.updateInterval : dim.frequency,
    sources: template.sources,
  }))
}

/** 单维度四环接线校验，返回失败原因列表（空数组 = 接线完整） */
function validateDimensionWiring(dim: DimensionConfig): string[] {
  const failures: string[] = []

  // 环 1+2：mode 解析与 dispatch 覆盖
  const mode = resolveDimensionMode(dim.code)
  if (mode === 'unsupported') {
    failures.push(`mode=unsupported：DIMENSION_TO_MODE 未注册维度 ${dim.code}`)
    return failures
  }
  if (!DISPATCHED_MODES.has(mode)) {
    failures.push(`mode=${mode} 无 dispatch 分支（GAP-1 型「已注册未接线」）`)
    return failures
  }

  // 环 3+4：非行情维度的写入链路（quote/kline 写 stocks/dailyQuotes 由 ACL 既有覆盖；
  // financial 经 fetcherService 内部写 financial_reports，均不在 DIMENSION_TO_ACTION 内）
  if (NON_QUOTE_MODES.has(mode)) {
    const action = DIMENSION_TO_ACTION[dim.code]
    if (!action) {
      failures.push(`DIMENSION_TO_ACTION 缺维度 ${dim.code} 的写入动作`)
      return failures
    }
    const store = COLLECTION_ACTION_STORE[action]
    if (!store) {
      failures.push(`动作 ${action} 未登记采集域 action→store 映射`)
      return failures
    }
    const fetcherWrite: readonly string[] = ACL_MATRIX[MODULE_ID.fetcher].write
    if (!fetcherWrite.includes(store)) {
      failures.push(`ACL_MATRIX[fetcher].write 未授权 ${store}（GAP-2 型写入拒绝）`)
    }
  }

  return failures
}

function dryRunTemplate(template: StrategyTemplate, symbolCount: number): TemplateDryRunResult {
  const dims = expandTemplate(template)
  const enabledDims = dims.filter((d) => d.enabled)

  const dimensions: DimensionDryRunResult[] = dims.map((dim) => {
    const mode = resolveDimensionMode(dim.code)
    const failures = dim.enabled ? validateDimensionWiring(dim) : []
    return {
      code: dim.code,
      name: dim.name,
      enabled: dim.enabled,
      mode,
      wired: !dim.enabled || failures.length === 0,
      failures,
    }
  })

  const wiredCount = dimensions.filter((d) => d.enabled && d.wired).length
  const evaluation = monthlyBudgetGuard.evaluate(enabledDims, symbolCount, 0)

  return {
    templateId: template.id,
    templateName: template.name,
    enabledCount: enabledDims.length,
    wiredCount,
    wiringScore: enabledDims.length > 0 ? wiredCount / enabledDims.length : 1,
    monthlyPlanned: estimateTotalMonthlyCalls(enabledDims, symbolCount),
    monthlyBudget: evaluation.budget,
    budgetStatus: evaluation.status,
    budgetReasons: evaluation.reasons,
    dimensions,
  }
}

describe('采集管线 Dry-Run · 静态接线与预算门禁', () => {
  const SYMBOL_COUNT = 40 // 与 sevenDimConfigStore 默认值对齐
  const results = STRATEGY_TEMPLATES.map((t) => dryRunTemplate(t, SYMBOL_COUNT))

  it('所有模板的启用维度接线得分 = 1.0（≥ Skill 阈值 0.92）', () => {
    for (const r of results) {
      const broken = r.dimensions.filter((d) => d.enabled && !d.wired)
      expect(
        r.wiringScore,
        `模板 ${r.templateId}（${r.templateName}）接线断裂: ${JSON.stringify(broken.map((d) => [d.code, d.failures]))}`,
      ).toBe(1)
    }
  })

  it('所有模板计划调用量 ≤ 月度预算且状态非 exceeded', () => {
    for (const r of results) {
      expect(
        r.monthlyPlanned <= r.monthlyBudget,
        `模板 ${r.templateId} 计划 ${r.monthlyPlanned} 次/月 > 预算 ${r.monthlyBudget} 次/月`,
      ).toBe(true)
      expect(r.budgetStatus, `模板 ${r.templateId} 预算超额: ${r.budgetReasons.join('; ')}`).not.toBe('exceeded')
    }
  })

  it('MonthlyBudgetGuard 自检通过', () => {
    const sanity = monthlyBudgetGuard.sanityCheck()
    expect(sanity.ok, sanity.issues.join('; ')).toBe(true)
  })

  it('dry-run 报告落盘 outputs/collection-dry-run.json', () => {
    const report = {
      generatedAt: new Date().toISOString(),
      symbolCount: SYMBOL_COUNT,
      thresholds: { wiringScore: 0.92, budgetStatus: 'not-exceeded' },
      summary: {
        templates: results.length,
        allWired: results.every((r) => r.wiringScore === 1),
        maxPlanned: Math.max(...results.map((r) => r.monthlyPlanned)),
        budget: results[0]?.monthlyBudget ?? 0,
      },
      templates: results,
    }

    const outDir = resolve(process.cwd(), 'outputs')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'collection-dry-run.json'), JSON.stringify(report, null, 2), 'utf-8')

    // 控制台速览（CI 日志可读）
    for (const r of results) {
       
      console.log(
        `[dry-run] ${r.templateId}(${r.templateName}) 启用 ${r.enabledCount} 维 | 接线 ${r.wiredCount}/${r.enabledCount} ` +
        `| 计划 ${r.monthlyPlanned}/月 | 预算 ${r.monthlyBudget}/月 | ${r.budgetStatus}`,
      )
    }

    expect(report.summary.allWired).toBe(true)
  })
})
