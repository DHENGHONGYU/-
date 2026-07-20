/**
 * 综合数据采集验证测试
 * 验证 6 个维度的真实数据可用性（全部用真实网络请求，不用 Mock）
 *
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/test-all-dimensions.ts
 */

const TEST_STOCKS = [
  { code: '600519.SH', name: '贵州茅台' },
  { code: '000858.SZ', name: '五粮液' },
  { code: '300750.SZ', name: '宁德时代' },
  { code: '601318.SH', name: '中国平安' },
  { code: '000001.SZ', name: '平安银行' },
]

interface TestResult {
  dimension: string
  name: string
  status: 'pass' | 'fail' | 'partial'
  stocks: number
  total: number
  detail: string
}

// ── 工具函数 ──

function toTencentCode(code: string): string {
  const upper = code.toUpperCase()
  const clean = code.replace(/\.(SH|SZ|BJ)$/i, '')
  if (upper.endsWith('.SH') || clean.startsWith('6') || clean.startsWith('9')) return `sh${clean}`
  if (upper.endsWith('.SZ') || clean.startsWith('0') || clean.startsWith('3')) return `sz${clean}`
  return `sh${clean}`
}

function toSinaCode(code: string): string {
  return toTencentCode(code)
}

function extractSixDigitCode(code: string): string {
  return code.replace(/\.(SH|SZ|BJ)$/i, '')
}

// ── 维度 03: 筹码分析（东财 datacenter） ──
// 注：datacenter 需要 proxy，Node 端直接请求会有 CORS 问题，
// 此处在 Node 环境下跳过，由浏览器端验证。

// ── 维度 04: 公告（东财公告 API） ──
async function testAnnouncements(code: string): Promise<number> {
  const sixCode = extractSixDigitCode(code)
  const url = `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=10&page_index=1&ann_type=A&client_source=web&stock_list=${sixCode}&f_node=0&s_node=0`
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://data.eastmoney.com/' },
    })
    if (!resp.ok) return 0
    const json: any = await resp.json()
    return json?.data?.list?.length ?? 0
  } catch {
    return 0
  }
}

// ── 维度 05: 热点新闻（新浪财经 HTML） ──
async function testHotNews(code: string): Promise<number> {
  const sinaCode = toSinaCode(code)
  const url = `https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllNewsStock/symbol/${sinaCode}.phtml`
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/' },
    })
    if (!resp.ok) return 0
    const buffer = Buffer.from(await resp.arrayBuffer())
    const text = new TextDecoder('gbk').decode(buffer)
    const datelistMatch = text.match(/<div class="datelist">([\s\S]*?)<\/div>/i)
    if (!datelistMatch || !datelistMatch[1]) return 0
    const itemPattern = /(\d{4}-\d{2}-\d{2})&nbsp;(\d{2}:\d{2})[\s\S]*?<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi
    let count = 0
    while (itemPattern.exec(datelistMatch[1]) !== null) count++
    return count
  } catch {
    return 0
  }
}

// ── 维度 06: 行业竞品（东财 F10 行业分析） ──
async function testIndustry(code: string): Promise<number> {
  const sixCode = extractSixDigitCode(code)
  const market = code.toUpperCase().endsWith('.SH') || sixCode.startsWith('6') ? 'SH' : 'SZ'
  const url = `https://emweb.securities.eastmoney.com/PC_HSF10/IndustryAnalysis/PageAjax?code=${market}${sixCode}`
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://emweb.securities.eastmoney.com/' },
    })
    if (!resp.ok) return 0
    const json: any = await resp.json()
    const gzList = json?.gzbj ?? []
    const peers = gzList.filter((p: any) => {
      const name = p.CORRE_SECURITY_NAME ?? ''
      return !name.includes('平均') && !name.includes('中值') && p.CORRE_SECURITY_CODE && p.CORRE_SECURITY_CODE !== sixCode
    })
    return peers.length
  } catch {
    return 0
  }
}

// ── 维度 07: 关联指数（腾讯 K 线 + Pearson） ──
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

async function tencentKline(code: string, days = 60): Promise<Array<{ date: string; close: number }>> {
  const tencentCode = toTencentCode(code)
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${tencentCode},day,,,${days},qfq`
  try {
    const resp = await fetch(url, { headers: { 'Referer': 'https://finance.qq.com' } })
    if (!resp.ok) return []
    const parsed: any = await resp.json()
    if (parsed.code !== 0 || !parsed.data) return []
    const stockData = parsed.data[tencentCode]
    const klineData = stockData?.qfqday?.length > 0 ? stockData.qfqday : stockData?.day
    if (!klineData || klineData.length === 0) return []
    return klineData
      .map((row: string[]) => ({ date: row[0] ?? '', close: parseFloat(row[2] ?? '0') || 0 }))
      .filter((k: any) => k.date && k.close > 0)
  } catch {
    return []
  }
}

async function testIndexCorrelation(code: string): Promise<number> {
  const indices = ['000300.SH', '000905.SH', '399006.SZ']
  const stockKlines = await tencentKline(code, 60)
  if (stockKlines.length < 10) return 0
  const stockMap = new Map<string, number>()
  stockKlines.forEach(k => { if (k.date && k.close > 0) stockMap.set(k.date, k.close) })
  let nonZero = 0
  for (const idx of indices) {
    const idxKlines = await tencentKline(idx, 60)
    const pairs: Array<[number, number]> = []
    idxKlines.forEach(k => {
      if (k.date && k.close > 0 && stockMap.has(k.date)) {
        pairs.push([stockMap.get(k.date)!, k.close])
      }
    })
    const corr = pairs.length > 5 ? calculatePearson(pairs) : 0
    if (corr !== 0) nonZero++
  }
  return nonZero
}

// ── 维度 08: 研报（东财 reportapi） ──
async function testResearch(code: string): Promise<number> {
  const sixCode = extractSixDigitCode(code)
  const today = new Date().toISOString().slice(0, 10)
  const url = `https://reportapi.eastmoney.com/report/list?industryCode=*&pageSize=10&industry=*&rating=*&beginTime=2025-01-01&endTime=${today}&pageNo=1&qType=0&code=${sixCode}`
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://data.eastmoney.com/' },
    })
    if (!resp.ok) return 0
    const json: any = await resp.json()
    const list = json?.data ?? []
    // 二次校验
    const filtered = list.filter((item: any) => item.stockCode === sixCode)
    return filtered.length
  } catch {
    return 0
  }
}

// ── 主测试流程 ──
async function main() {
  console.log('='.repeat(70))
  console.log('FinSightV9 数据采集综合验证（真实网络数据，无 Mock）')
  console.log(`测试股票: ${TEST_STOCKS.map(s => s.name).join('、')}`)
  console.log('='.repeat(70))

  const dimensions = [
    { code: '04', name: '公告（东财）', fn: testAnnouncements, min: 1 },
    { code: '05', name: '热点新闻（新浪）', fn: testHotNews, min: 1 },
    { code: '06', name: '行业竞品（东财F10）', fn: testIndustry, min: 1 },
    { code: '07', name: '关联指数（腾讯+Pearson）', fn: testIndexCorrelation, min: 1 },
    { code: '08', name: '研报（东财reportapi）', fn: testResearch, min: 1 },
  ]

  const results: TestResult[] = []

  for (const dim of dimensions) {
    console.log(`\n[维度 ${dim.code}] ${dim.name}`)
    let passCount = 0
    const details: string[] = []

    for (const stock of TEST_STOCKS) {
      const count = await dim.fn(stock.code)
      const pass = count >= dim.min
      if (pass) passCount++
      const status = pass ? '✅' : '❌'
      details.push(`  ${status} ${stock.name.padEnd(6)}: ${count} 条`)
    }

    console.log(details.join('\n'))

    const status = passCount === TEST_STOCKS.length ? 'pass' : passCount > 0 ? 'partial' : 'fail'
    const statusText = status === 'pass' ? '✅ 全部通过' : status === 'partial' ? '⚠️ 部分通过' : '❌ 全部失败'
    console.log(`  ${statusText} (${passCount}/${TEST_STOCKS.length})`)

    results.push({
      dimension: dim.code,
      name: dim.name,
      status: status as TestResult['status'],
      stocks: passCount,
      total: TEST_STOCKS.length,
      detail: `${passCount}/${TEST_STOCKS.length}`,
    })
  }

  // 总结
  console.log('\n' + '='.repeat(70))
  console.log('汇总结果')
  console.log('='.repeat(70))
  console.log(`${'维度'.padEnd(4)} ${'名称'.padEnd(20)} ${'状态'.padEnd(10)} ${'通过率'.padEnd(10)}`)
  console.log(`${'-'.repeat(4)} ${'-'.repeat(20)} ${'-'.repeat(10)} ${'-'.repeat(10)}`)

  let allPass = true
  for (const r of results) {
    const statusText = r.status === 'pass' ? '✅ 通过' : r.status === 'partial' ? '⚠️ 部分' : '❌ 失败'
    console.log(`${r.dimension.padEnd(4)} ${r.name.padEnd(20)} ${statusText.padEnd(10)} ${r.detail.padEnd(10)}`)
    if (r.status !== 'pass') allPass = false
  }

  console.log('='.repeat(70))
  const passCount = results.filter(r => r.status === 'pass').length
  console.log(allPass
    ? `🎉 全部 ${results.length} 个维度验证通过！所有真实数据源工作正常。`
    : `📊 ${passCount}/${results.length} 个维度完全通过，${results.length - passCount} 个维度部分通过或失败。`)
  console.log('='.repeat(70))

  process.exit(allPass ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
