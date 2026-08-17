/**
 * @test_id V9-TEST-UT-024
 * 观察池定期自动复盘调度（投研全链路 spec 缺口②）· 真实腾讯行情端到端
 *
 * 复用 walkthrough-20stocks-real 的 node:https + iconv-lite 真实采集 harness：
 *   1) 先跑 ResearchPipelineOrchestrator（采集→评分→策略三分类→选股入研究池 + 纳入长期观察池）
 *   2) 再对长期观察池(intent.watchlist) 跑 ObservationPoolReviewer：
 *        读取观察池 → 真实 V6 重评分 → 计算评分漂移 → 标记「可晋升研究池」候选
 *   3) 二次复盘（模拟评分变化）演示「定期复盘校对分析」的漂移与晋升机制
 *   4) 产出 observation-review-report.json / .html（spec 要求「所有相关内容输出」）
 *
 * 环境：Vitest + jsdom + fake-indexeddb + node:https(tencent-real)。
 */

import { it, expect } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import https from 'node:https'
import iconv from 'iconv-lite'
import path from 'node:path'

import { db } from '@/data/db'
import { runV6Score, getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { runStrategy } from '@/services/trading/strategyEngine'
import { transitionPoolItem } from '@/services/pool/poolService'
import { detectExchange } from '@/services/input/batchImportParsers'
import { buildTencentCode } from '@/services/fetcher/directDataAPIError'
import type { RealtimeQuote } from '@/services/fetcher/directDataAPI'
import type { KlineBar } from '@/data/types/types.marketData'
import { parseTencentQuote } from '@/services/fetcher/tencentQuoteProvider'
import { MOCK_STOCK_LIBRARY } from '@/services/input/mockStockLibrary'
import { runResearchPipeline, type ResearchPipelineDeps } from '@/services/orchestration/researchPipelineOrchestrator'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import { getDefaultStrategyRuleConfig } from '@/config/strategyRules'
import { ObservationPoolReviewer } from '@/services/orchestration/observationPoolReviewer'
import { getIntentionWatchlistStocks } from '@/services/trading/tradingService'
import { rotationScoreStore } from '@/data/dataLayerScoreStores'
import type { RotationSectorScore } from '@/data/types'

const TENCENT_QUOTE = 'https://qt.gtimg.cn/q'
const TENCENT_KLINE = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'

function httpsGetBuffer(url: string, retries = 1): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const attempt = (left: number) => {
      const req = https.get(
        url,
        { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 FinSightV9' } },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c as Buffer))
          res.on('end', () => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              if (left > 0) return attempt(left - 1)
              return reject(new Error(`HTTP ${res.statusCode} @ ${url}`))
            }
            resolve(Buffer.concat(chunks))
          })
        },
      )
      req.on('error', (e) => (left > 0 ? attempt(left - 1) : reject(e)))
      req.on('timeout', () => {
        req.destroy()
        if (left > 0) return attempt(left - 1)
        reject(new Error(`timeout @ ${url}`))
      })
    }
    attempt(retries)
  })
}

const isHk = (s: string) => /\.HK$/i.test(s)
function buildKlineCode(symbol: string): string {
  if (isHk(symbol)) {
    const bare = symbol.replace(/\.HK$/i, '').toUpperCase().padStart(5, '0')
    return `hk${bare}`
  }
  return buildTencentCode(symbol)
}

async function fetchRealQuote(symbol: string): Promise<RealtimeQuote | null> {
  const buf = await httpsGetBuffer(`${TENCENT_QUOTE}=${buildTencentCode(symbol)}`)
  const text = iconv.decode(buf, 'gbk')
  return (parseTencentQuote(text, symbol) as unknown as RealtimeQuote) ?? null
}

async function fetchRealKline(symbol: string, count = 60): Promise<KlineBar[]> {
  const url = `${TENCENT_KLINE}?param=${buildKlineCode(symbol)},day,,,${count},qfq`
  const buf = await httpsGetBuffer(url)
  const json = JSON.parse(buf.toString('utf-8')) as Record<string, unknown>
  const data = json.data as Record<string, unknown> | undefined
  if (!data) return []
  const key = isHk(symbol)
    ? `hk${symbol.replace(/\.HK$/i, '').toUpperCase().padStart(5, '0')}`
    : buildTencentCode(symbol)
  const stockData = (data[key] as Record<string, unknown> | undefined) ?? null
  if (!stockData) return []
  const arr = (stockData.qfqday as unknown[]) ?? (stockData.day as unknown[]) ?? null
  if (!Array.isArray(arr)) return []
  return arr.map((row) => {
    const r = row as unknown[]
    return {
      date: String(r[0]),
      open: Number(r[1]) || 0,
      close: Number(r[2]) || 0,
      high: Number(r[3]) || 0,
      low: Number(r[4]) || 0,
      volume: Number(r[5]) || 0,
      amount: Number(r[6]) || 0,
    }
  })
}

function loadSample(): { code: string; name: string; market: string; held: boolean }[] {
  const p = path.resolve(process.cwd(), 'outputs', 'bulk-import-sample', 'sample.json')
  const raw = JSON.parse(readFileSync(p, 'utf-8')) as {
    sample: { code: string; name: string; market: string; held: boolean; importable: boolean }[]
  }
  return raw.sample
}

function normalizeSymbol(code: string): string {
  const t = code.trim()
  if (/^\d{4,5}\.HK$/i.test(t)) return t.toUpperCase()
  if (/^\d{6}$/.test(t)) return `${t}.${detectExchange(t)}`
  return t.toUpperCase()
}

const libMap = new Map(MOCK_STOCK_LIBRARY.map((s) => [s.symbol, s]))

it(
  '观察池定期复盘（缺口②）：管线落地观察池 → 真实V6复盘 → 漂移/晋升候选 → 报告',
  async () => {
    await db.init()
    const sample = loadSample()
    const input = sample.map((s) => ({
      code: normalizeSymbol(s.code),
      name: s.name,
      held: s.held,
      market: s.market,
    }))

    // ── 演示夹具：让策略三分类在真实行情数据上可被确定性触发 ──
    const hotSectors: RotationSectorScore[] = [
      {
        id: '801120.SW__2026-08-16', sectorCode: '801120.SW', sectorName: '电气设备',
        scoreDate: '2026-08-16', f1Jingqi: 88, f2Zijin: 85, f3Guzhi: 80, f4Beta: 82, f5Nengliang: 90,
        total: 88, resonance: 8, signal: '强', alertLevel: 'none', declineType: 'none',
        poolStocks: [], modelUsed: 'test', createdAt: new Date().toISOString(),
      },
      {
        id: '801150.SW__2026-08-16', sectorCode: '801150.SW', sectorName: '医药生物',
        scoreDate: '2026-08-16', f1Jingqi: 80, f2Zijin: 78, f3Guzhi: 76, f4Beta: 74, f5Nengliang: 82,
        total: 80, resonance: 7, signal: '中', alertLevel: 'none', declineType: 'none',
        poolStocks: [], modelUsed: 'test', createdAt: new Date().toISOString(),
      },
    ]
    for (const hs of hotSectors) {
      const r = await rotationScoreStore.save(hs)
      if (!r.success) throw new Error(`seed rotationScores 失败: ${hs.sectorCode} ${r.error}`)
    }

    const hotCandidates = input.filter((s) => !s.held).slice(0, 2).map((s) => s.code)
    const hotSet = new Set(hotCandidates)
    const sectorMap = new Map<string, { sector: string; industryCode: string }>()
    if (hotCandidates[0]) sectorMap.set(hotCandidates[0], { sector: '电气设备', industryCode: '801120.SW' })
    if (hotCandidates[1]) sectorMap.set(hotCandidates[1], { sector: '医药生物', industryCode: '801150.SW' })

    const demoTheme = { ...CORE_RESOURCE_THEME, minCompositeScore: 2.0 }
    const demoRule = {
      ...getDefaultStrategyRuleConfig(),
      compositeMin: 1.8,
      valueBargainCompositeMin: 1.8,
      valueBargainValuationMin: 4.0,
      hotMomentumMinMomentum: 0.0,
      lowValuationThreshold: 1.0,
      lowValuationCompositeExempt: 0.5,
      selectedMaxCount: 13,
    }

    const deps: ResearchPipelineDeps = {
      collector: { fetchQuote: fetchRealQuote, fetchKline: (s, c) => fetchRealKline(s, c) },
      scorer: { run: (s) => runV6Score(s) as Promise<{ success: boolean; data?: never }> },
      strategy: { run: (stocks, opts) => runStrategy(stocks, opts as never) },
      pool: { transition: (symbol, target) => transitionPoolItem(symbol, target) },
      calibrator: {
        calibrate: async (symbol) => {
          const sr = await runV6Score(symbol)
          return { triggered: true, reFetched: false, reScored: !!sr.success, backtrackPlan: [] }
        },
      },
      scoreCalibrationThreshold: 3.0,
      referenceValue: (symbol) => {
        const isHot = hotSet.has(symbol)
        const lib = libMap.get(symbol)
        return {
          pe: isHot ? 200 : lib?.pe ?? 6,
          pb: isHot ? 12 : lib?.pb ?? 1.2,
          marketCap: lib?.marketCap ?? 1e11,
        }
      },
      sectorResolver: (symbol) => sectorMap.get(symbol) ?? {},
      theme: demoTheme,
      ruleConfig: demoRule,
      momentumMap: Object.fromEntries(hotCandidates.map((s) => [s, 0.12])),
      klineCount: 60,
    }

    // ── Stage A：跑投研全链路，落地研究池 + 长期观察池 ──
    const pipeline = await runResearchPipeline(input, deps)
    const v6 = await getAllV6Scores()
    const referentialIntegrity = (v6.data ?? []).length === input.length
    const researchSet = new Set(
      pipeline.stage6.perStock.filter((r) => r.destination === 'research').map((r) => r.code),
    )

    // ── Stage B：观察池定期复盘（缺口②核心）──
    const promotionThreshold = 2.2 // 演示阈值（低于真实综合分 ~2.5，使晋升候选可见）；生产默认 3.0
    const reviewer = new ObservationPoolReviewer({ promotionThreshold })

    const realScorer = async (symbol: string) => {
      const r = await runV6Score(symbol)
      return { success: r.success, data: r.data ?? undefined }
    }
    // 二次复盘用「模拟评分上调 +0.3」的评分器，演示「定期复盘校对分析」的漂移与晋升变化
    const boostedScorer = async (symbol: string) => {
      const r = await runV6Score(symbol)
      const base = r.data?.score ?? 0
      return {
        success: r.success,
        data: r.data ? { ...r.data, score: Math.min(5, base + 0.3) } : undefined,
      }
    }

    const reviewerDeps = {
      getWatchlist: async () => {
        const res = await getIntentionWatchlistStocks()
        return (res.data ?? []).map((s) => ({ symbol: s.symbol, name: s.name }))
      },
      scorer: { run: realScorer },
      isInResearchPool: (symbol: string) => researchSet.has(symbol),
      promotionThreshold,
    }

    const cycle1 = await reviewer.run(reviewerDeps)
    const cycle2 = await reviewer.run({ ...reviewerDeps, scorer: { run: boostedScorer } })

    // ── 报告 ──
    const outDir = path.resolve(process.cwd(), 'outputs', 'bulk-import-sample')
    const report = {
      meta: {
        generatedAt: new Date().toISOString(),
        promotionThreshold,
        sampleSize: input.length,
        researchCount: pipeline.stage6.researchCount,
        observationCount: pipeline.stage6.observationCount,
        observationPoolReadFrom: 'intention.watchlist',
      },
      pipelinePlacement: {
        research: pipeline.stage6.perStock.filter((r) => r.destination === 'research').map((r) => r.code),
        observation: pipeline.stage6.perStock.filter((r) => r.destination === 'observation').map((r) => r.code),
      },
      cycle1,
      cycle2,
      referentialIntegrity,
    }
    writeFileSync(path.join(outDir, 'observation-review-report.json'), JSON.stringify(report, null, 2), 'utf-8')
    writeFileSync(path.join(outDir, 'observation-review-report.html'), renderObservationHtml(report), 'utf-8')

    console.info(
      '[观察池复盘]',
      JSON.stringify(
        {
          observationPool: pipeline.stage6.observationCount,
          researchPool: pipeline.stage6.researchCount,
          cycle1_total: cycle1.summary.total,
          cycle1_promotionEligible: cycle1.summary.promotionEligible,
          cycle1_promotionCandidates: cycle1.promotionCandidates,
          cycle2_total: cycle2.summary.total,
          cycle2_promotionEligible: cycle2.summary.promotionEligible,
          cycle2_improved: cycle2.summary.improved,
          cycle2_declined: cycle2.summary.declined,
          referentialIntegrity,
        },
        null,
        2,
      ),
    )

    // ── 门禁断言 ──
    // 管线落地完整性
    expect(referentialIntegrity, 'V6 评分与股票跨库引用应完整').toBe(true)
    expect(pipeline.stage6.researchCount + pipeline.stage6.observationCount, '研究池+观察池应覆盖全部样本').toBe(input.length)

    // 缺口②：观察池复盘应从 intention.watchlist 读到与管线落地一致的数量
    expect(cycle1.summary.total, '观察池复盘的标的应等于管线落地的观察池数量').toBe(pipeline.stage6.observationCount)
    expect(cycle1.items.length, '复盘条目应覆盖观察池全部标的').toBe(pipeline.stage6.observationCount)

    // 定期复盘应检出「可晋升研究池」候选（演示阈值下）
    expect(cycle1.summary.promotionEligible, '应检出晋升研究池候选').toBeGreaterThan(0)
    expect(cycle1.promotionCandidates.length, '晋升候选列表应非空').toBe(cycle1.summary.promotionEligible)

    // 二次复盘应计算评分漂移（首次 previousScore=null，二次应有数值）
    for (const item of cycle2.items) {
      expect(item.previousScore, '二次复盘 previousScore 应非空（漂移计算）').not.toBeNull()
    }
    // 模拟评分上调 → 应有「评分上升」项，且无下降项（boostedScorer 全量 +0.3）
    expect(cycle2.summary.improved, '模拟评分上调应产生评分上升项').toBe(cycle2.summary.total)
    expect(cycle2.summary.declined, '模拟评分上调不应产生下降项').toBe(0)
    // 上调后晋升候选应不少于首次（门槛不变，分数更高）
    expect(cycle2.summary.promotionEligible, '评分上调后晋升候选不应减少').toBeGreaterThanOrEqual(cycle1.summary.promotionEligible)

    // 每个复盘条目都应给出推荐动作
    for (const item of cycle1.items) {
      expect(['promote', 'hold', 'watch']).toContain(item.recommendation)
    }
  },
  300000,
)

function renderObservationHtml(r: any): string {
  const obsRows = (r.cycle1.items as any[])
    .map((i) => {
      const c2 = (r.cycle2.items as any[]).find((x) => x.symbol === i.symbol)
      return (
        `<tr><td>${i.symbol}</td><td>${i.name}</td>` +
        `<td><b>${i.currentScore.toFixed(2)}</b></td>` +
        `<td>${i.previousScore === null ? '—' : i.previousScore.toFixed(2)}</td>` +
        `<td>${c2 ? (c2.scoreDelta === null ? '—' : c2.scoreDelta.toFixed(2)) : '—'}</td>` +
        `<td class="${i.meetsResearchThreshold ? 'ok' : 'bad'}">${i.meetsResearchThreshold ? '✓' : '✗'}</td>` +
        `<td class="${i.promotionEligible ? 'ok' : ''}">${i.promotionEligible ? '可晋升' : '—'}</td>` +
        `<td>${i.recommendation}</td></tr>`
      )
    })
    .join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>观察池定期复盘报告</title>
<style>
 body{font-family:-apple-system,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;margin:24px;color:#1f2937;background:#f9fafb}
 h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:24px 0 8px;border-left:4px solid #2563eb;padding-left:8px}
 .meta{color:#6b7280;font-size:13px;line-height:1.6}
 .cards{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
 .card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;min-width:120px}
 .card .v{font-size:24px;font-weight:700} .card .l{font-size:12px;color:#6b7280}
 table{border-collapse:collapse;width:100%;background:#fff;font-size:13px;margin-top:6px}
 th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:center}
 th{background:#f3f4f6} td:first-child,td:nth-child(2){text-align:left}
 .ok{color:#047857;font-weight:700} .bad{color:#dc2626;font-weight:700}
 .note{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;font-size:13px;margin-top:8px}
</style></head><body>
<h1>观察池定期复盘报告（真实腾讯行情 · 缺口②）</h1>
<div class="meta">生成 ${r.meta.generatedAt} ｜ 样本 ${r.meta.sampleSize} ｜ 晋升阈值 ${r.meta.promotionThreshold}（演示值，生产默认 3.0）｜ 观察池读取自 ${r.meta.observationPoolReadFrom}</div>
<div class="cards">
 <div class="card"><div class="v">${r.meta.researchCount}</div><div class="l">研究池(入选)</div></div>
 <div class="card"><div class="v">${r.meta.observationCount}</div><div class="l">长期观察池</div></div>
 <div class="card"><div class="v">${r.cycle1.summary.total}</div><div class="l">复盘标的</div></div>
 <div class="card"><div class="v">${r.cycle1.summary.promotionEligible}</div><div class="l">首次·晋升候选</div></div>
 <div class="card"><div class="v">${r.cycle2.summary.promotionEligible}</div><div class="l">二次·晋升候选</div></div>
 <div class="card"><div class="v">${r.cycle2.summary.improved}</div><div class="l">二次·评分上升</div></div>
</div>
<div class="note"><b>机制说明：</b>观察池（intention.watchlist）标的定期重新执行 V6 评分，计算相较上次复盘的评分漂移，
并标记「可晋升研究池」（评分越过门槛且当前不在研究池）。二次复盘以「模拟评分上调 +0.3」演示漂移与晋升变化；
真实环境由 ObservationPoolReviewer 定时器（默认 24h）或手动触发驱动。</div>

<h2>观察池定期复盘明细（首次 / 二次漂移）</h2>
<table><thead><tr><th>代码</th><th>名称</th><th>首次评分</th><th>上次评分</th><th>二次漂移</th><th>达研究门槛</th><th>晋升候选</th><th>推荐</th></tr></thead><tbody>${obsRows}</tbody></table>
</body></html>`
}
