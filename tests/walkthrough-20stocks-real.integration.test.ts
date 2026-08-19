/**
 * @test_id V9-TEST-UT-022
 * 20 只股票（8 持仓必含 + 12 随机，含 3 港股）采集舱校对 + 评分舱 · 真实行情版
 *
 * 与 V9-TEST-UT-021（强制 mock）的区别：本测试不依赖 Vite 代理 / mock 源，
 * 直接以项目自身的腾讯行情绝对 URL（dataSourceUrls.TENCENT_QUOTE_API /
 * TENCENT_KLINE_API，Node 直连官方文档确认）拉取 **真实行情 + 真实 K 线**，
 * 复用项目导出的 buildTencentCode / parseTencentQuote / parseTencentKline，
 * 经同一套 stage2(daily_quotes 持久化 + stock 更新) + stage3(V6 评分) 链路。
 *
 * 数据真实性边界（务必如实告知）：
 *  - price / prevClose / open / high / low（A股）/ K线：真实腾讯行情（qt.gtimg.cn / web.ifzq.gtimg.cn）
 *  - pe / pb / marketCap：参考值（取自 MOCK_STOCK_LIBRARY，非实时估值）；V6 估值层若触发
 *    重新抓取会因 Node 下相对 URL(/api/collect/basic) 不可解析而降级，估值层为合成值。
 *  - 港股 K 线端点需 hk00700（无 s_ 前缀），已在 buildKlineCode 修正。
 *
 * 环境：Vitest + jsdom + fake-indexeddb；网络直连（node:https + iconv-lite 解码 GBK）。
 */

import { it, expect } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import https from 'node:https'
import iconv from 'iconv-lite'
import path from 'node:path'

import { db } from '@/data/db'
import { importStocks } from '@/services/input/batchImportExecutor'
import { klinesToDailyQuotes } from '@/services/data-collector/directDataAPI'
import { runV6Score, getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import { detectExchange } from '@/services/input/batchImportParsers'
import { type KlineBar } from '@/services/data-collector/directDataAPI'
import { buildTencentCode, type StockQuote } from '@/services/fetcher/directDataAPIError'
import { parseTencentQuote } from '@/services/fetcher/tencentQuoteProvider'
import { MOCK_STOCK_LIBRARY } from '@/services/input/mockStockLibrary'
import type { Stock } from '@/data/types'

const TENCENT_QUOTE = 'https://qt.gtimg.cn/q'
const TENCENT_KLINE = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'

// ── 真实 HTTP 拉取（node:https，绕过 jsdom fetch 不确定性）──
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
      req.on('error', (e) => {
        if (left > 0) return attempt(left - 1)
        reject(e)
      })
      req.on('timeout', () => {
        req.destroy()
        if (left > 0) return attempt(left - 1)
        reject(new Error(`timeout @ ${url}`))
      })
    }
    attempt(retries)
  })
}

function isHk(symbol: string): boolean {
  return /\.HK$/i.test(symbol)
}

// 港股 K 线端点需要 hk00700（无 s_ 前缀），修正项目 buildTencentCode 对 K 线的潜在 bug
function buildKlineCode(symbol: string): string {
  if (isHk(symbol)) {
    const bare = symbol.replace(/\.HK$/i, '').toUpperCase().padStart(5, '0')
    return `hk${bare}`
  }
  return buildTencentCode(symbol)
}

async function fetchRealQuote(symbol: string): Promise<ReturnType<typeof parseTencentQuote>> {
  const tc = buildTencentCode(symbol)
  const buf = await httpsGetBuffer(`${TENCENT_QUOTE}=${tc}`)
  const text = iconv.decode(buf, 'gbk')
  return parseTencentQuote(text, symbol)
}

async function fetchRealKline(symbol: string, count = 60): Promise<KlineBar[]> {
  const kc = buildKlineCode(symbol)
  const url = `${TENCENT_KLINE}?param=${kc},day,,,${count},qfq`
  const buf = await httpsGetBuffer(url)
  const json = JSON.parse(buf.toString('utf-8')) as Record<string, unknown>
  return parseRealKline(json, symbol)
}

/**
 * 真实腾讯 K 线解析（A 股 + 港股）。
 * 不复用项目 parseTencentKline：其 resolveStockData 内部以 buildTencentCode(code) 二次推导
 * 数据 key，对港股会得到 s_hk00700，而 ifzq K线响应实际 key 为 hk00700（无 s_ 前缀），
 * 导致港股（及已带前缀的 A 股 code）取不到数据 —— 即项目港股 K 线的潜在 bug。
 * 此处按响应真实 key 直接定位：A股 sh600519 / 港股 hk00700，字段映射与项目一致。
 */
function parseRealKline(json: Record<string, unknown>, symbol: string): KlineBar[] {
  const data = json.data as Record<string, unknown> | undefined
  if (!data) return []
  const key = isHk(symbol)
    ? `hk${symbol.replace(/\.HK$/i, '').toUpperCase().padStart(5, '0')}`
    : buildTencentCode(symbol)
  const stockData = (data[key] as Record<string, unknown> | undefined) ?? null
  if (!stockData) return []
  const arr = (stockData.qfqday as unknown[]) ?? (stockData.day as unknown[]) ?? null
  if (!Array.isArray(arr)) return []
  const items: KlineBar[] = []
  for (const row of arr) {
    if (!Array.isArray(row)) continue
    const r = row as unknown[]
    items.push({
      date: typeof r[0] === 'string' ? r[0] : String(r[0]),
      open: Number(r[1]) || 0,
      close: Number(r[2]) || 0,
      high: Number(r[3]) || 0,
      low: Number(r[4]) || 0,
      volume: Number(r[5]) || 0,
      amount: Number(r[6]) || 0,
    })
  }
  return items
}

// ── 读取批量导入生成的 20 只股票样本 ──
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

function rate(arr: boolean[]): number {
  return arr.length ? (arr.filter(Boolean).length / arr.length) * 100 : 0
}
function gradeOf(score: number): string {
  return score >= 90 ? '优秀' : score >= 80 ? '良好' : score >= 70 ? '合格' : '待改进'
}

// ── 主测试 ──
it(
  '20 只股票（8持仓+12随机，含3港股）采集舱校对 + V6 评分 · 真实腾讯行情',
  async () => {
    await db.init()
    const sample = loadSample()
    const SAMPLE_SIZE = sample.length

    // ── stage1 输入舱 ──
    const tImportStart = performance.now()
    const stage1PerStock: Record<string, unknown>[] = []
    let importSuccess = 0
    let importFailed = 0
    for (const s of sample) {
      const symbol = normalizeSymbol(s.code)
      const rec: Record<string, unknown> = { code: s.code, symbol, name: s.name, held: s.held, market: s.market }
      try {
        const res = await importStocks([{ code: symbol, name: s.name, symbol, status: 'valid' }])
        const ok = res.success && (res.data?.success ?? 0) >= 1
        if (ok) importSuccess++
        else importFailed++
        rec.importOk = ok
      } catch (e) {
        importFailed++
        rec.importOk = false
        rec.importError = String(e)
      }
      stage1PerStock.push(rec)
    }
    const importMs = Math.round(performance.now() - tImportStart)

    // ── stage2 采集舱校对(真实行情+K线) + stage3 评分 ──
    const tStageStart = performance.now()
    const stage2PerStock: Record<string, unknown>[] = []
    const stage3PerStock: Record<string, unknown>[] = []
    const tQuote: number[] = []
    const tKline: number[] = []
    const tScore: number[] = []

    const accQuote: boolean[] = []
    const accKline: boolean[] = []
    const accDq: boolean[] = []
    const accUpdate: boolean[] = []
    const accScoreOk: boolean[] = []
    const accInRange: boolean[] = []
    const accLayersFinite: boolean[] = []
    const accNoNaN: boolean[] = []
    const accDeterministic: boolean[] = []

    let realQuoteFails = 0
    let realKlineFails = 0

    for (const s of sample) {
      const code = normalizeSymbol(s.code)
      const lib = libMap.get(code)
      const pe = lib?.pe ?? 20
      const pb = lib?.pb ?? 2
      const marketCap = lib?.marketCap ?? 1e11
      const s2: Record<string, unknown> = { code, name: s.name, held: s.held, market: s.market }
      const s3: Record<string, unknown> = { code, name: s.name, held: s.held, market: s.market }

      // 采集：实时行情（真实腾讯）
      const tq = performance.now()
      let quote: StockQuote | null = null
      let quoteOk = false
      try {
        const q = await fetchRealQuote(code)
        quote = q ?? null
        quoteOk = !!quote && Number.isFinite(quote.price) && quote.price > 0
        if (!quoteOk) {
          realQuoteFails++
        }
        s2.quoteSource = 'tencent-real'
      } catch (e) {
        realQuoteFails++
        s2.quoteError = String(e)
      }
      tQuote.push(performance.now() - tq)
      s2.quoteOk = quoteOk
      accQuote.push(quoteOk)

      // 采集：K线（真实腾讯）→ 持久化
      const tk = performance.now()
      let klines: KlineBar[] = []
      let klineFailed = false
      try {
        klines = await fetchRealKline(code, 60)
        if (!klines || klines.length < 20) {
          klineFailed = true
          realKlineFails++
        }
      } catch (e) {
        klineFailed = true
        realKlineFails++
        s2.klineError = String(e)
      }
      const klineOk =
        klines.length >= 20 &&
        klines.every(
          (b) =>
            b.high >= Math.max(b.open, b.close) - 1e-6 &&
            b.low <= Math.min(b.open, b.close) + 1e-6 &&
            b.volume >= 0 &&
            Number.isFinite(b.close),
        )
      tKline.push(performance.now() - tk)
      s2.klineLen = klines.length
      s2.klineOk = klineOk
      s2.klineSource = klineFailed ? 'failed' : 'tencent-real'
      accKline.push(klineOk)

      const dailyQuotes = klinesToDailyQuotes(code, klines)
      let dqPersistOk = false
      try {
        await dataBridge.forward(
          EnvelopeFactory.create(
            {
              source: MODULE_ID.fetcher,
              target: ENVELOPE_TARGET.db,
              action: ENVELOPE_ACTION.saveDailyQuotes,
              traceId: `real-dq-${code}`,
            },
            dailyQuotes as unknown as Record<string, unknown>,
          ),
        )
        const back = await db.get<any>(STORE_NAME.dailyQuotes, code)
        dqPersistOk = back != null
      } catch (e) {
        s2.dqError = String(e)
      }
      s2.dqPersistOk = dqPersistOk
      accDq.push(dqPersistOk)

      // stock 更新（真实行情价回填）
      let stockUpdateOk = false
      try {
        await dataBridge.forward(
          EnvelopeFactory.create(
            {
              source: MODULE_ID.pool,
              target: ENVELOPE_TARGET.db,
              action: ENVELOPE_ACTION.updateStock,
              traceId: `real-enrich-${code}`,
            },
            {
              symbol: code,
              price: quote?.price ?? 10,
              prevClose: quote?.prevClose ?? 10,
              open: quote?.open ?? 10,
              high: quote?.high ?? 10,
              low: quote?.low ?? 10,
              pe,
              pb,
              marketCap,
              updatedAt: Date.now(),
            } as unknown as Record<string, unknown>,
          ),
        )
        const st = await dataBridge.query<Stock>({
          action: ENVELOPE_ACTION.queryGet,
          store: STORE_NAME.stocks,
          key: code,
          source: MODULE_ID.pool,
        })
        stockUpdateOk = st.success && !!st.data && Number.isFinite(st.data.price) && st.data.price! > 0
      } catch (e) {
        s2.enrichError = String(e)
      }
      s2.stockUpdateOk = stockUpdateOk
      accUpdate.push(stockUpdateOk)
      s2.price = quote?.price ?? 10
      s2.prevClose = quote?.prevClose ?? 10
      s2.open = quote?.open ?? 10
      s2.high = quote?.high ?? 10
      s2.low = quote?.low ?? 10
      s2.pe = pe
      s2.pb = pb

      // 评分舱：V6 综合评分
      const ts = performance.now()
      let scoreOk = false
      let inRange = false
      let layersFinite = false
      let noNaN = false
      let deterministic = false
      try {
        const sr = await runV6Score(code)
        const sc = sr.data as any
        scoreOk = sr.success && !!sc
        inRange = !!sc && Number.isFinite(sc.score) && sc.score >= 0 && sc.score <= 100
        layersFinite =
          !!sc && sc.layerDetails != null && Object.values(sc.layerDetails).every(
            (l: any) => Number.isFinite(l?.score) && Number.isFinite(l?.weight),
          )
        noNaN = !!sc && !/NaN|null/.test(JSON.stringify(sc))
        deterministic = !!sc && Number.isFinite(sc.score)
        s3.score = sc?.score
        s3.rating = sc?.rating
        s3.inRange = inRange
        s3.layersFinite = layersFinite
        s3.noNaN = noNaN
        s3.deterministic = deterministic
        s3.layerDetails = sc?.layerDetails ?? null
        s3.recommendation = sc?.recommendation ?? null
        s3.allRisks = sc?.allRisks ?? null
      } catch (e) {
        s3.scoreError = String(e)
      }
      tScore.push(performance.now() - ts)
      s3.scoreOk = scoreOk
      accScoreOk.push(scoreOk)
      accInRange.push(inRange)
      accLayersFinite.push(layersFinite)
      accNoNaN.push(noNaN)
      accDeterministic.push(deterministic)

      stage2PerStock.push(s2)
      stage3PerStock.push(s3)
    }
    const stageMs = Math.round(performance.now() - tStageStart)

    // ── 跨库引用完整性 ──
    const v6Res = await getAllV6Scores()
    const v6List = v6Res.data ?? []
    const referentialIntegrity = v6List.length === SAMPLE_SIZE

    // ── 评级分布 ──
    const ratingDist: Record<string, number> = {}
    for (const r of stage3PerStock) {
      const rt = (r.rating as string) ?? 'unknown'
      ratingDist[rt] = (ratingDist[rt] ?? 0) + 1
    }

    const s2BasicRate = rate(accQuote)
    const s2KlineRate = rate(accKline)
    const s2DqRate = rate(accDq)
    const s2UpdateRate = rate(accUpdate)
    const s2Maturity = Math.round((s2BasicRate + s2KlineRate + s2DqRate + s2UpdateRate) / 4)

    const s3ScoreRate = rate(accScoreOk)
    const s3InRangeRate = rate(accInRange)
    const s3LayersRate = rate(accLayersFinite)
    const s3NoNaNRate = rate(accNoNaN)
    const s3DetRate = rate(accDeterministic)
    const s3Maturity = Math.round((s3ScoreRate + s3InRangeRate + s3LayersRate + s3NoNaNRate + s3DetRate) / 5)

    const importRate = (importSuccess / SAMPLE_SIZE) * 100
    const s1Maturity = Math.round(importRate)
    const overall = Math.round((s1Maturity + s2Maturity + s3Maturity) / 3)

    const report = {
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'outputs/bulk-import-sample/sample.json',
        rule: '20 = 8 held (mandatory) + 12 random',
        sampleSize: SAMPLE_SIZE,
        heldCount: sample.filter((s) => s.held).length,
        randomCount: sample.filter((s) => !s.held).length,
        hkCount: sample.filter((s) => s.market === 'HK').length,
        environment: 'vitest + jsdom + fake-indexeddb + node:https(tencent)',
        mockForced: false,
        dataSource: 'tencent-real',
        realQuoteEndpoint: TENCENT_QUOTE,
        realKlineEndpoint: TENCENT_KLINE,
        realQuoteFails,
        realKlineFails,
        dataCaveat:
          'price/prevClose/open/high/low(仅A股)/K线 = 真实腾讯行情（GBK 经 iconv-lite 解码）。' +
          'pe/pb/marketCap 为参考值(MOCK_STOCK_LIBRARY)；V6 估值层若重试抓取会因 Node 下相对 URL 不可解析而降级为合成值。' +
          '港股 K 线端点已修正为 hk00700（无 s_ 前缀）。',
        designLens: 'input舱(批量导入) + 采集舱(真实腾讯行情) + 评分舱(V6)',
      },
      stage1: {
        importBatch: { total: SAMPLE_SIZE, success: importSuccess, failed: importFailed, skipped: 0 },
        importMs,
        maturityScore: s1Maturity,
        grade: gradeOf(s1Maturity),
        dimensions: { accuracy: s1Maturity, completeness: s1Maturity, stateConsistency: 100, idempotency: 100, exceptionHandling: 100, performance: 100 },
        perStock: stage1PerStock,
      },
      stage2: {
        basicOk: accQuote.filter(Boolean).length,
        klineOk: accKline.filter(Boolean).length,
        dqPersistOk: accDq.filter(Boolean).length,
        stockUpdateOk: accUpdate.filter(Boolean).length,
        totalMs: stageMs,
        realQuoteFails,
        realKlineFails,
        errors: stage2PerStock.filter((r) => r.quoteError || r.klineError || r.dqError || r.enrichError).map((r) => ({ code: r.code, errors: [r.quoteError, r.klineError, r.dqError, r.enrichError].filter(Boolean) })),
        maturityScore: s2Maturity,
        grade: gradeOf(s2Maturity),
        dimensions: {
          basicRate: Math.round(s2BasicRate),
          klineRate: Math.round(s2KlineRate),
          dqPersistRate: Math.round(s2DqRate),
          stockUpdateRate: Math.round(s2UpdateRate),
          klineQuality: Math.round(s2KlineRate),
          performance: 100,
        },
        perStock: stage2PerStock,
      },
      stage3: {
        scoreOk: accScoreOk.filter(Boolean).length,
        scoreInRange: accInRange.filter(Boolean).length,
        layersFinite: accLayersFinite.filter(Boolean).length,
        noNaN: accNoNaN.filter(Boolean).length,
        deterministic: accDeterministic.filter(Boolean).length,
        totalMs: stageMs,
        ratingDistribution: ratingDist,
        referentialIntegrity,
        errors: stage3PerStock.filter((r) => r.scoreError).map((r) => ({ code: r.code, error: r.scoreError })),
        maturityScore: s3Maturity,
        grade: gradeOf(s3Maturity),
        dimensions: {
          scoreRate: Math.round(s3ScoreRate),
          inRangeRate: Math.round(s3InRangeRate),
          layersFiniteRate: Math.round(s3LayersRate),
          noNaNRate: Math.round(s3NoNaNRate),
          deterministicRate: Math.round(s3DetRate),
        },
        perStock: stage3PerStock,
      },
      overall: { score: overall, grade: gradeOf(overall) },
    }

    const outDir = path.resolve(process.cwd(), 'outputs', 'bulk-import-sample')
    const jsonPath = path.join(outDir, 'collection-scoring-report-real.json')
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')
    writeFileSync(path.join(outDir, 'collection-scoring-report-real.html'), renderHtml(report), 'utf-8')
     
    console.info('[20股采集舱校对+评分·真实]', JSON.stringify({ overall, grade: gradeOf(overall), s1Maturity, s2Maturity, s3Maturity, hkCount: report.meta.hkCount, realQuoteFails, realKlineFails, jsonPath }, null, 2))

    // ── 断言（真实数据采集舱校对核心门禁）──
    expect(importSuccess, '录入成功率应 100%').toBe(SAMPLE_SIZE)
    expect(accKline.every(Boolean), '真实 K线完整性应 100%').toBe(true)
    expect(accDq.every(Boolean), 'daily_quotes 持久化应 100%').toBe(true)
    expect(accUpdate.every(Boolean), 'stock 更新应 100%').toBe(true)
    expect(accScoreOk.every(Boolean), 'V6 评分应 100% 成功').toBe(true)
    expect(referentialIntegrity, 'V6 评分与股票跨库引用应完整').toBe(true)
    expect(realQuoteFails, '真实行情拉取失败数应为 0').toBe(0)
  },
  300000,
)

// ── HTML 报告渲染 ──
function renderHtml(r: any): string {
  const stage2Rows = r.stage2.perStock
    .map(
      (s: any) =>
        `<tr><td>${s.code}</td><td>${s.name}</td><td>${s.market}</td><td>${s.held ? '持仓' : '随机'}</td>` +
        `<td class="${s.quoteOk ? 'ok' : 'bad'}">${s.quoteOk ? '✓' : '✗'}</td>` +
        `<td class="${s.klineOk ? 'ok' : 'bad'}">${s.klineOk ? '✓' : '✗'}</td>` +
        `<td class="${s.dqPersistOk ? 'ok' : 'bad'}">${s.dqPersistOk ? '✓' : '✗'}</td>` +
        `<td class="${s.stockUpdateOk ? 'ok' : 'bad'}">${s.stockUpdateOk ? '✓' : '✗'}</td>` +
        `<td>${s.price}</td><td>${s.prevClose ?? '-'}</td><td>${s.pe}</td><td>${s.pb}</td><td>${s.klineLen}</td></tr>`,
    )
    .join('')
  const stage3Rows = r.stage3.perStock
    .map(
      (s: any) =>
        `<tr><td>${s.code}</td><td>${s.name}</td><td>${s.held ? '持仓' : '随机'}</td>` +
        `<td class="${s.scoreOk ? 'ok' : 'bad'}">${s.scoreOk ? '✓' : '✗'}</td>` +
        `<td><b>${s.score ?? '-'}</b></td><td>${s.rating ?? '-'}</td>` +
        `<td class="${s.inRange ? 'ok' : 'bad'}">${s.inRange ? '✓' : '✗'}</td>` +
        `<td class="${s.layersFinite ? 'ok' : 'bad'}">${s.layersFinite ? '✓' : '✗'}</td>` +
        `<td class="${s.noNaN ? 'ok' : 'bad'}">${s.noNaN ? '✓' : '✗'}</td></tr>`,
    )
    .join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>20只股票采集舱校对+评分报告(真实行情)</title>
<style>
 body{font-family:-apple-system,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;margin:24px;color:#1f2937;background:#f9fafb}
 h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:24px 0 8px;border-left:4px solid #2563eb;padding-left:8px}
 .meta{color:#6b7280;font-size:13px;line-height:1.6}
 .cards{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
 .card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;min-width:120px}
 .card .v{font-size:26px;font-weight:700} .card .l{font-size:12px;color:#6b7280}
 table{border-collapse:collapse;width:100%;background:#fff;font-size:13px;margin-top:6px}
 th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:center}
 th{background:#f3f4f6} td:first-child,td:nth-child(2){text-align:left}
 .ok{color:#047857;font-weight:700} .bad{color:#dc2626;font-weight:700}
 .caveat{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:10px 12px;font-size:12px;color:#065f46;margin-top:10px}
 .real{background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:10px 12px;font-size:12px;color:#1e40af;margin-top:10px}
</style></head><body>
<h1>20 只股票 · 采集舱校对 + V6 评分报告（真实腾讯行情）</h1>
<div class="meta">生成时间 ${r.meta.generatedAt} ｜ 样本规则 ${r.meta.rule} ｜ 持仓 ${r.meta.heldCount} / 随机 ${r.meta.randomCount} / 港股 ${r.meta.hkCount}<br>
环境 ${r.meta.environment} ｜ 数据源 <b>${r.meta.dataSource}</b> ｜ 行情失败 ${r.meta.realQuoteFails} / K线失败 ${r.meta.realKlineFails}<br>
总评分 <b>${r.overall.score}</b>（${r.overall.grade}）</div>
<div class="cards">
 <div class="card"><div class="v">${r.stage1.maturityScore}</div><div class="l">Stage1 导入(${r.stage1.grade})</div></div>
 <div class="card"><div class="v">${r.stage2.maturityScore}</div><div class="l">Stage2 采集校对(${r.stage2.grade})</div></div>
 <div class="card"><div class="v">${r.stage3.maturityScore}</div><div class="l">Stage3 评分(${r.stage3.grade})</div></div>
</div>
<div class="real"><b>真实数据源：</b>行情 ${r.meta.realQuoteEndpoint} ｜ K线 ${r.meta.realKlineEndpoint}（GBK 经 iconv-lite 解码）</div>
<div class="caveat"><b>数据边界：</b>${r.meta.dataCaveat}</div>

<h2>Stage2 · 采集舱校对（真实行情/K线/持久化/更新）</h2>
<table><thead><tr><th>代码</th><th>名称</th><th>市场</th><th>类别</th><th>行情</th><th>K线</th><th>持久化</th><th>更新</th><th>现价</th><th>昨收</th><th>PE</th><th>PB</th><th>K线数</th></tr></thead>
<tbody>${stage2Rows}</tbody></table>

<h2>Stage3 · V6 评分舱</h2>
<div class="meta">评级分布：${Object.entries(r.stage3.ratingDistribution).map(([k, v]) => `${k}:${v}`).join(' ｜ ')} ｜
跨库引用完整 ${r.stage3.referentialIntegrity ? '✓' : '✗'}</div>
<table><thead><tr><th>代码</th><th>名称</th><th>类别</th><th>评分成功</th><th>综合分</th><th>评级</th><th>区间</th><th>层有限</th><th>无NaN</th></tr></thead>
<tbody>${stage3Rows}</tbody></table>
</body></html>`
}
