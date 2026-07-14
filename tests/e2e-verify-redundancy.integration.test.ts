/**
 * 冗余设计专项端到端验证（R1–R5）
 *
 * 目标：在「软件冗余设计」维度上验证系统是否具备
 *   - 单点故障可降级（R2）
 *   - 重复写入不污染（R3 幂等）
 *   - 局部异常不蔓延（R4 故障隔离）
 *   - 配置层具备 mock 终端安全网（R1）
 *   - 未知数据源被安全跳过、mock 兜底（R5）
 *
 * 环境：Vitest + jsdom + fake-indexeddb（tests/setup.ts 已注入）
 * 关键：it() 开头必须 await db.init()，否则 dataBridge.query 卡在 db.ready()。
 */

import { it, expect, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { db } from '@/data/db'
import { importStocks } from '@/services/input/batchImportExecutor'
import { getQuoteWithConfig, getKlineWithConfig } from '@/services/data-collector/dataSourceOrchestrator'
import {
  resolveQuoteChain,
  resolveKlineChain,
} from '@/services/data-collector/collectionPipeline'
import { klinesToDailyQuotes } from '@/services/data-collector/directDataAPI'
import { runV6Score, getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { MOCK_STOCK_LIBRARY } from '@/services/input/mockStockLibrary'
import { CORE_RESOURCE_SYMBOL_WHITELIST } from '@/config/symbols'
import type { KlineBar } from '@/data/types'

// ── 强制真实源失败：保留其余导出（含 klinesToDailyQuotes），仅让真实源 getter 抛错 ──
vi.mock('@/services/data-collector/directDataAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/data-collector/directDataAPI')>()
  const fail = () => Promise.reject(new Error('simulated upstream down'))
  return {
    ...actual,
    tencentQuote: fail,
    sinaQuote: fail,
    akshareQuote: fail,
    tencentBatchQuotes: fail,
    sinaBatchQuotes: fail,
    neteaseHistory: fail,
  }
})

// ── 工具：种子随机 ───────────────────────────────────────
function createRng(seed: number) {
  let state = seed >>> 0
  return function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}
function shuffle<T>(array: T[], seed: number): T[] {
  const rng = createRng(seed)
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
interface Cand {
  code: string
  name: string
  pe?: number
  pb?: number
  marketCap?: number
}
function buildUniverse(): Cand[] {
  const libMap = new Map(MOCK_STOCK_LIBRARY.map((s) => [s.symbol, s]))
  const codes = new Set<string>()
  const out: Cand[] = []
  const push = (code: string, name: string, pe?: number, pb?: number, mc?: number) => {
    if (!/^\d{6}\.(SH|SZ|HK)$/i.test(code)) return
    if (codes.has(code)) return
    codes.add(code)
    out.push({ code, name, pe, pb, marketCap: mc })
  }
  for (const s of MOCK_STOCK_LIBRARY) push(s.symbol, s.name, s.pe, s.pb, s.marketCap)
  for (const code of CORE_RESOURCE_SYMBOL_WHITELIST) {
    const lib = libMap.get(code)
    push(code, lib?.name ?? code, lib?.pe, lib?.pb, lib?.marketCap)
  }
  return out
}
// 确定性 K 线（规避 Math.random，仅供幂等/隔离用例构造合法结构）
function deterministicKlines(sym: string, n = 60): KlineBar[] {
  const bars: KlineBar[] = []
  let price = 50
  for (let i = 0; i < n; i++) {
    const open = price
    const close = open + Math.sin(i / 5) * 1.5
    const high = Math.max(open, close) + 0.5
    const low = Math.min(open, close) - 0.5
    const day = String((i % 28) + 1).padStart(2, '0')
    const month = String(Math.floor(i / 28) + 1).padStart(2, '0')
    bars.push({
      date: `2024${month}${day}`,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: 1_000_000 + i * 1000,
      amount: 50_000_000 + i * 1000,
    })
    price = close
  }
  return bars
}

const RANDOM_SEED = 20260714
const SAMPLE_SIZE = 25

it('冗余设计 E2E 验证（R1 配置冗余 / R2 降级 / R3 幂等 / R4 隔离 / R5 兜底）', async () => {
  await db.init()

  const report: Record<string, unknown> = { meta: { seed: RANDOM_SEED, scope: '冗余设计专项', generatedAt: new Date().toISOString() } }
  const findings: unknown[] = []
  const checks: { id: string; pass: boolean; detail: string }[] = []
  const mark = (id: string, pass: boolean, detail: string) => {
    checks.push({ id, pass, detail })
    return pass
  }

  // ── R1：配置层冗余（静态，采集链解析契约） ──
  const multiSourceDim = {
    sourcePriority: [
      { id: 'tencent', priority: 1, enabled: true },
      { id: 'sina', priority: 2, enabled: true },
      { id: 'mock', priority: 3, enabled: true },
    ],
  } as any
  const qChain = resolveQuoteChain(multiSourceDim)
  const kChain = resolveKlineChain(multiSourceDim)
  const r1QuoteOk = qChain.length >= 2 && qChain[qChain.length - 1] === 'mock'
  // K 线解析链恒为 ['mock'] —— 无真实源冗余（冗余缺口 F4）
  const r1KlineMockOnly = kChain.length === 1 && kChain[0] === 'mock'
  mark('R1-config-redundancy', r1QuoteOk, `quote链=${JSON.stringify(qChain)}; kline链=${JSON.stringify(kChain)}`)
  if (r1KlineMockOnly) {
    findings.push({
      id: 'F4-kline-mock-only',
      severity: '中',
      cabin: 'input/analysis',
      title: 'K 线采集链恒为 mock 单源，无真实源冗余/降级深度',
      detail:
        'resolveKlineChain(dimension) 取 quote 链中 id==="mock" 的子集，而 buildDefaultSourcePriority 永远注入 mock，' +
        '故 K 线解析链恒为 ["mock"]。tryKlineSource 仅支持 netease/mock 两种源，tencent/sina/akshare 直接 warn "不支持 K 线" 并跳过。' +
        '结果是 K 线数据永远走单一 mock 源，没有"真实源→mock"的降级深度，属冗余设计缺口（单点 mock）。',
      evidence: `resolveKlineChain(多源维度) === ${JSON.stringify(kChain)}`,
      suggestion:
        '若 K 线仅需 mock，请显式将 resolveKlineChain 标注为"有意单源"并在文档声明；' +
        '若需冗余，应为 K 线接入真实源（如 AKShare/网易历史）形成多源降级链。',
    })
  }

  // ── R2：降级可用性（动态，强制真实源失败） ──
  let r2QuoteOk = false
  let r2KlineOk = false
  let r2Detail = ''
  try {
    const q = await getQuoteWithConfig('R2QUOTE.SH', { sourcePriority: ['tencent', 'sina', 'mock'] })
    r2QuoteOk = q.success === true && q.source === 'mock' && JSON.stringify(q.fallbackChain) === JSON.stringify(['tencent', 'sina', 'mock'])
    r2Detail += `quote:success=${q.success},source=${q.source},fallback=${JSON.stringify(q.fallbackChain)}; `

    const k = await getKlineWithConfig('R2KLINE.SH', 30, { sourcePriority: ['netease', 'mock'] })
    r2KlineOk = k.success === true && k.source === 'mock' && (k.data?.length ?? 0) > 0 && JSON.stringify(k.fallbackChain) === JSON.stringify(['netease', 'mock'])
    r2Detail += `kline:success=${k.success},source=${k.source},len=${(k.data ?? []).length},fallback=${JSON.stringify(k.fallbackChain)}`
  } catch (e) {
    r2Detail += `THREW:${String(e)}`
  }
  const r2Ok = mark('R2-degradation', r2QuoteOk && r2KlineOk, r2Detail)

  // ── R3：写入幂等性（动态，同 symbol ×3） ──
  const sym = 'REDUNDANCY001.SH'
  await importStocks([{ code: sym, name: '冗余测试', symbol: sym, status: 'valid' }])
  const dq = klinesToDailyQuotes(sym, deterministicKlines(sym))
  for (let i = 0; i < 3; i++) {
    await db.put(STORE_NAME.dailyQuotes, dq as unknown as Record<string, unknown>)
  }
  const dqList = (await dataBridge.query<any[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.dailyQuotes })).data ?? []
  const dqCount = dqList.filter((d) => d.symbol === sym).length

  for (let i = 0; i < 3; i++) {
    await runV6Score(sym)
  }
  const v6List = (await getAllV6Scores()).data ?? []
  const v6Count = v6List.filter((v) => v.symbol === sym).length
  const r3Ok = mark('R3-idempotency', dqCount === 1 && v6Count === 1, `dailyQuotes记录数=${dqCount}(期望1); v6Score记录数=${v6Count}(期望1)`)

  // ── R4：故障隔离（动态，25 股注入 1 只强制异常） ──
  const universe = buildUniverse()
  const sample = shuffle(universe, RANDOM_SEED).slice(0, SAMPLE_SIZE)
  const faultCode = sample[0]!.code
  let completed = 0
  let tainted = 0
  let crashed = false
  for (const c of sample) {
    try {
      const code = c.code
      await importStocks([{ code, name: c.name, symbol: code, status: 'valid' }])
      if (code === faultCode) throw new Error('injected processing fault')
      const q = await getQuoteWithConfig(code, { sourcePriority: ['mock'] })
      const k = await getKlineWithConfig(code, 60, { sourcePriority: ['mock'] })
      const d = klinesToDailyQuotes(code, k.data ?? [])
      await db.put(STORE_NAME.dailyQuotes, d as unknown as Record<string, unknown>)
      const sc = await runV6Score(code)
      if (sc.success) completed++
    } catch (e) {
      if (c.code === faultCode) tainted++
      else crashed = true
    }
  }
  const r4Ok = mark('R4-fault-isolation', completed === SAMPLE_SIZE - 1 && tainted === 1 && crashed === false, `完成=${completed}/25; 被隔离=${tainted}; 非预期崩溃=${crashed}`)

  // ── R5：未知/不支持数据源安全跳过 + mock 兜底（动态） ──
  let r5Ok = false
  let r5Detail = ''
  try {
    const r = await getQuoteWithConfig('R5UNK.SH', { sourcePriority: ['unknownX', 'netease_bad', 'mock'] })
    r5Ok = r.success === true && r.source === 'mock' && (r.fallbackChain ?? []).includes('mock')
    r5Detail = `success=${r.success},source=${r.source},fallback=${JSON.stringify(r.fallbackChain)}`
  } catch (e) {
    r5Detail = `THREW:${String(e)}`
  }
  mark('R5-collector-fallback', r5Ok, r5Detail)

  // ── 评分：冗余维度分 = R1–R5 均值 ──
  const rScores = [r1QuoteOk, r2Ok, r3Ok, r4Ok, r5Ok].map((b) => (b ? 100 : 0))
  const redundancyScore = Math.round(rScores.reduce((a, b) => a + b, 0) / rScores.length)
  const grade = redundancyScore >= 90 ? '优秀' : redundancyScore >= 80 ? '良好' : redundancyScore >= 70 ? '合格' : '待改进'

  report.redundancy = {
    R1_configRedundancy: { pass: r1QuoteOk, quoteChain: qChain, klineChain: kChain, klineMockOnly: r1KlineMockOnly },
    R2_degradation: { pass: r2Ok, quoteOk: r2QuoteOk, klineOk: r2KlineOk, detail: r2Detail },
    R3_idempotency: { pass: r3Ok, dqCount, v6Count },
    R4_faultIsolation: { pass: r4Ok, completed, tainted, crashed },
    R5_collectorFallback: { pass: r5Ok, detail: r5Detail },
  }
  report.score = redundancyScore
  report.grade = grade
  report.findings = findings
  report.checks = checks

  // 断言（让 CI 在违反时失败）
  expect(r1QuoteOk, 'R1 quote 链需≥2源且末端为mock').toBe(true)
  expect(r2Ok, `R2 降级需成功落到 mock: ${r2Detail}`).toBe(true)
  expect(r3Ok, `R3 幂等失败: dq=${dqCount}, v6=${v6Count}`).toBe(true)
  expect(r4Ok, `R4 故障隔离失败: completed=${completed}, tainted=${tainted}, crashed=${crashed}`).toBe(true)
  expect(r5Ok, `R5 兜底失败: ${r5Detail}`).toBe(true)
  expect(redundancyScore, `冗余维度分过低: ${redundancyScore}`).toBeGreaterThanOrEqual(70)

  const outPath = path.resolve('outputs', 'e2e-verify-redundancy.report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8')
  // eslint-disable-next-line no-console
  console.log(`[冗余设计验证] 得分=${redundancyScore}(${grade}) R1-5=${JSON.stringify(rScores)} findings=${findings.length}`)
})
