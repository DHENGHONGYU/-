/**
 * 维度 07 关联指数集成测试（Node 直连版）
 *
 * 用与项目源码相同的逻辑直接请求腾讯 API 验证。
 * 运行方式: node ./node_modules/tsx/dist/cli.mjs scripts/test-index-correlation-int.ts
 */

// 与 directDataAPI.ts 相同的逻辑
const TENCENT_KLINE_BASE = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
const TENCENT_REFERER = 'https://finance.qq.com'

// 与 stockCodeUtils.ts 相同的逻辑
function toTencentCode(code: string): string {
  const upper = code.toUpperCase()
  const clean = code.replace(/\.(SH|SZ|BJ)$/i, '')
  if (upper.endsWith('.SH') || clean.startsWith('6') || clean.startsWith('9')) {
    return `sh${clean}`
  }
  if (upper.endsWith('.SZ') || clean.startsWith('0') || clean.startsWith('3')) {
    return `sz${clean}`
  }
  if (upper.endsWith('.BJ') || clean.startsWith('8') || clean.startsWith('4')) {
    return `bj${clean}`
  }
  return `sh${clean}`
}

interface KlineBar {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

// 与 directDataAPI.ts 相同的逻辑
async function tencentKline(code: string, days = 60): Promise<KlineBar[]> {
  const tencentCode = toTencentCode(code)
  const url = `${TENCENT_KLINE_BASE}?param=${tencentCode},day,,,${days},qfq`
  try {
    const resp = await fetch(url, { headers: { 'Referer': TENCENT_REFERER } })
    if (!resp.ok) return []
    const parsed = await resp.json() as any
    if (parsed.code !== 0 || !parsed.data) return []
    const stockData = parsed.data[tencentCode]
    // 个股前复权在 qfqday，指数在 day
    const klineData = stockData?.qfqday?.length > 0 ? stockData.qfqday : stockData?.day
    if (!klineData || klineData.length === 0) return []
    return klineData
      .map((row: string[]) => ({
        date: row[0] ?? '',
        open: parseFloat(row[1] ?? '0') || 0,
        close: parseFloat(row[2] ?? '0') || 0,
        high: parseFloat(row[3] ?? '0') || 0,
        low: parseFloat(row[4] ?? '0') || 0,
        volume: parseInt(row[5] ?? '0') || 0,
      }))
      .filter((k: KlineBar) => k.date && k.close > 0)
  } catch {
    return []
  }
}

// 与 multiSourceFetcher.ts 相同的计算逻辑
function calculatePearson(pairs: Array<[number, number]>): number {
  const n = pairs.length
  if (n < 2) return 0
  const sumX = pairs.reduce((s, [x]) => s + x, 0)
  const sumY = pairs.reduce((s, [, y]) => s + y, 0)
  const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0)
  const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0)
  const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0)
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denominator === 0) return 0
  return (n * sumXY - sumX * sumY) / denominator
}

function calculateBeta(pairs: Array<[number, number]>): number {
  const returns: Array<[number, number]> = []
  for (let i = 1; i < pairs.length; i++) {
    const prev = pairs[i - 1]
    const curr = pairs[i]
    if (!prev || !curr) continue
    const [prevX, prevY] = prev
    const [x, y] = curr
    if (prevX !== 0 && prevY !== 0) {
      returns.push([(x - prevX) / prevX, (y - prevY) / prevY])
    }
  }
  if (returns.length < 2) return 0
  const sumX = returns.reduce((s, [x]) => s + x, 0)
  const sumY = returns.reduce((s, [, y]) => s + y, 0)
  const sumXY = returns.reduce((s, [x, y]) => s + x * y, 0)
  const sumX2 = returns.reduce((s, [x]) => s + x * x, 0)
  const denominator = sumX2 - (sumX * sumX) / returns.length
  if (denominator === 0) return 0
  return (sumXY - (sumX * sumY) / returns.length) / denominator
}

// 与 multiSourceFetcher.ts 相同的主逻辑
async function fetchIndexCorrelation(symbol: string) {
  const indices = [
    { code: '000300.SH', name: '沪深300' },
    { code: '000905.SH', name: '中证500' },
    { code: '399006.SZ', name: '创业板指' },
  ]

  // L2: 腾讯日K线 + 本地 Pearson 计算
  const stockKlines = await tencentKline(symbol, 60)
  if (stockKlines.length > 10) {
    const stockMap = new Map<string, number>()
    stockKlines.forEach(k => { if (k.date && k.close > 0) stockMap.set(k.date, k.close) })

    const results = await Promise.all(
      indices.map(async (idx) => {
        const idxKlines = await tencentKline(idx.code, 60)
        const pairs: Array<[number, number]> = []
        idxKlines.forEach(k => {
          if (k.date && k.close > 0 && stockMap.has(k.date)) {
            pairs.push([stockMap.get(k.date)!, k.close])
          }
        })
        const correlation = pairs.length > 5 ? calculatePearson(pairs) : 0
        return {
          indexCode: idx.code,
          indexName: idx.name,
          correlation: Number(correlation.toFixed(4)),
          beta: pairs.length > 5 ? Number(calculateBeta(pairs).toFixed(4)) : undefined,
          _source: 'tencent',
          pairs: pairs.length,
        }
      }),
    )
    return results
  }
  return indices.map(i => ({ indexCode: i.code, indexName: i.name, correlation: 0, beta: undefined, _source: 'fallback' }))
}

async function main() {
  console.log('='.repeat(60))
  console.log('维度 07 关联指数集成测试（与项目源码同逻辑）')
  console.log('='.repeat(60))

  // 测试1: 代码格式转换
  console.log('\n[1/5] 代码格式转换验证')
  const testCases = [
    ['600519', 'sh600519'],
    ['600519.SH', 'sh600519'],
    ['000001.SZ', 'sz000001'],
    ['000300.SH', 'sh000300'],
    ['399006.SZ', 'sz399006'],
    ['300750.SZ', 'sz300750'],
  ]
  let codePass = true
  for (const [input, expected] of testCases) {
    const result = toTencentCode(input)
    const ok = result === expected
    if (!ok) codePass = false
    console.log(`  ${ok ? '✅' : '❌'} ${input} → ${result} (expected: ${expected})`)
  }

  // 测试2: 个股K线
  console.log('\n[2/5] 个股 K 线: 600519.SH')
  const stockKlines = await tencentKline('600519.SH', 60)
  console.log(`  ${stockKlines.length > 0 ? '✅' : '❌'} 获取 ${stockKlines.length} 条`)
  if (stockKlines.length > 0) {
    console.log(`     最新: ${stockKlines[stockKlines.length - 1].date} 收 ${stockKlines[stockKlines.length - 1].close}`)
  }

  // 测试3: 指数K线
  console.log('\n[3/5] 指数 K 线')
  const indices = ['000300.SH', '000905.SH', '399006.SZ']
  let idxPass = true
  for (const idx of indices) {
    const klines = await tencentKline(idx, 60)
    const ok = klines.length > 0
    if (!ok) idxPass = false
    console.log(`  ${ok ? '✅' : '❌'} ${idx}: ${klines.length} 条`)
  }

  // 测试4: 相关性计算
  console.log('\n[4/5] Pearson + Beta 计算（600519.SH）')
  const result = await fetchIndexCorrelation('600519.SH')
  let corrPass = false
  for (const r of result) {
    console.log(`  ${r.indexName}: corr=${r.correlation}, beta=${r.beta ?? 'N/A'}, 样本=${(r as any).pairs}天, src=${r._source}`)
    if (r.correlation !== 0) corrPass = true
  }
  console.log(`  ${corrPass ? '✅' : '❌'} 存在非零相关性`)

  // 测试5: 多股票验证
  console.log('\n[5/5] 多股票验证（与沪深300）')
  const stocks = [
    { code: '600519.SH', name: '贵州茅台' },
    { code: '000858.SZ', name: '五粮液' },
    { code: '300750.SZ', name: '宁德时代' },
    { code: '601318.SH', name: '中国平安' },
    { code: '000001.SZ', name: '平安银行' },
    { code: '688981.SH', name: '中芯国际' },
  ]
  let multiPass = true
  for (const stock of stocks) {
    const res = await fetchIndexCorrelation(stock.code)
    const hs300 = res.find(r => r.indexCode === '000300.SH')
    const corr = hs300?.correlation ?? 0
    const ok = corr !== 0
    if (!ok) multiPass = false
    console.log(`  ${ok ? '✅' : '❌'} ${stock.name.padEnd(6)}(${stock.code}): 沪深300 corr=${corr.toFixed(4)}`)
  }

  // 总结
  console.log('\n' + '='.repeat(60))
  const allPass = codePass && stockKlines.length > 0 && idxPass && corrPass && multiPass
  console.log(allPass ? '✅ 全部测试通过' : '❌ 部分测试失败')
  console.log('='.repeat(60))
  process.exit(allPass ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
