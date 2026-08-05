/**
 * @finsightv9/safe-format 业务场景演示
 *
 * 演示如何在真实金融 UI 业务中引入并调用 @finsightv9/safe-format 包。
 * 运行方式：npx tsx packages/safe-format/examples/demo.ts
 */

import {
  safeFormatNumber,
  safeFormatPercent,
  safeFormatCurrency,
  DEFAULT_FALLBACK,
} from '@finsightv9/safe-format'

// ─── 模拟金融数据类型 ─────────────────────────────────────────────────

interface StockQuote {
  name: string
  price: number | undefined
  change: number | null
  changePercent: number | undefined
  volume: number | null
  turnover: number | undefined
  peRatio: number | undefined
  marketCap: number | null
}

interface PortfolioHolding {
  stock: string
  shares: number
  costPrice: number | undefined
  currentPrice: number | null
  returnRate: number | undefined
}

// ─── 模拟真实业务数据（含各种异常值） ───────────────────────────────────

const stockQuotes: StockQuote[] = [
  { name: '贵州茅台', price: 1688.88, change: 12.35, changePercent: 0.74, volume: 2580000, turnover: 4365000000, peRatio: 28.5, marketCap: 2120000000000 },
  { name: '宁德时代', price: undefined, change: null, changePercent: undefined, volume: null, turnover: undefined, peRatio: undefined, marketCap: null },
  { name: '比亚迪', price: 245.6, change: -3.2, changePercent: -1.29, volume: 8900000, turnover: 2186000000, peRatio: NaN, marketCap: 715000000000 },
  { name: '中国平安', price: 48.12, change: 0, changePercent: 0, volume: 56700000, turnover: 2730000000, peRatio: 8.3, marketCap: 876000000000 },
  { name: '停牌股票', price: undefined, change: undefined, changePercent: undefined, volume: 0, turnover: 0, peRatio: undefined, marketCap: undefined },
]

const portfolio: PortfolioHolding[] = [
  { stock: '贵州茅台', shares: 100, costPrice: 1580.0, currentPrice: 1688.88, returnRate: 6.89 },
  { stock: '宁德时代', shares: 200, costPrice: 210.0, currentPrice: null, returnRate: undefined },
  { stock: '比亚迪', shares: 500, costPrice: 260.0, currentPrice: 245.6, returnRate: -5.54 },
  { stock: '中国平安', shares: 1000, costPrice: undefined, currentPrice: 48.12, returnRate: Infinity },
]

// ─── 场景一：股票行情列表 ───────────────────────────────────────────────

function renderStockList(quotes: StockQuote[]): void {
  console.log('\n' + '═'.repeat(80))
  console.log('  场景一：股票行情列表（含停牌/异常数据）')
  console.log('═'.repeat(80))
  console.log(
    '名称'.padEnd(12) +
    '最新价'.padStart(12) +
    '涨跌'.padStart(12) +
    '涨跌幅'.padStart(12) +
    '成交量'.padStart(14) +
    '成交额'.padStart(16) +
    '市盈率'.padStart(10)
  )
  console.log('─'.repeat(80))

  for (const q of quotes) {
    console.log(
      q.name.padEnd(12) +
      safeFormatNumber(q.price, 2).padStart(12) +
      safeFormatNumber(q.change, 2).padStart(12) +
      safeFormatPercent(q.changePercent, 2).padStart(12) +
      safeFormatCurrency(q.volume, 0).padStart(14) +
      safeFormatCurrency(q.turnover, 0).padStart(16) +
      safeFormatNumber(q.peRatio, 2).padStart(10)
    )
  }
}

// ─── 场景二：持仓收益分析 ───────────────────────────────────────────────

function renderPortfolio(holdings: PortfolioHolding[]): void {
  console.log('\n' + '═'.repeat(80))
  console.log('  场景二：持仓收益分析（含空值/Infinity 异常）')
  console.log('═'.repeat(80))
  console.log(
    '股票'.padEnd(14) +
    '持仓'.padStart(8) +
    '成本价'.padStart(12) +
    '现价'.padStart(12) +
    '收益率'.padStart(12) +
    '持仓市值'.padStart(16)
  )
  console.log('─'.repeat(80))

  for (const h of holdings) {
    const marketValue = h.currentPrice !== null && h.currentPrice !== undefined
      ? h.currentPrice * h.shares
      : undefined
    console.log(
      h.stock.padEnd(14) +
      String(h.shares).padStart(8) +
      safeFormatNumber(h.costPrice, 2).padStart(12) +
      safeFormatNumber(h.currentPrice, 2).padStart(12) +
      safeFormatPercent(h.returnRate, 2).padStart(12) +
      safeFormatCurrency(marketValue, 2).padStart(16)
    )
  }
}

// ─── 场景三：极端边界值防护演示 ─────────────────────────────────────────

function renderEdgeCases(): void {
  console.log('\n' + '═'.repeat(80))
  console.log('  场景三：极端边界值防护（对比原生 toFixed 的崩溃风险）')
  console.log('═'.repeat(80))
  console.log('─'.repeat(80))

  const cases: Array<{ label: string; raw: unknown; decimals: number }> = [
    { label: 'null 值', raw: null, decimals: 2 },
    { label: 'undefined 值', raw: undefined, decimals: 2 },
    { label: 'NaN 值', raw: NaN, decimals: 2 },
    { label: 'Infinity 值', raw: Infinity, decimals: 2 },
    { label: '负 Infinity', raw: -Infinity, decimals: 2 },
    { label: 'decimals 为负数', raw: 3.14159, decimals: -5 },
    { label: 'decimals 超大', raw: 3.14159, decimals: 100 },
    { label: 'decimals 为 NaN', raw: 3.14159, decimals: NaN },
    { label: 'decimals 为小数', raw: 3.14159, decimals: 2.7 },
    { label: '正常值', raw: 1688.88, decimals: 2 },
  ]

  console.log('场景'.padEnd(22) + '原生 toFixed'.padStart(18) + 'safeFormatNumber'.padStart(20))
  console.log('─'.repeat(60))

  for (const c of cases) {
    let rawResult: string
    try {
      const val = c.raw as number | null | undefined
      if (val === null || val === undefined) {
        rawResult = 'TypeError 崩溃'
      } else {
        rawResult = (val as number).toFixed(c.decimals)
      }
    } catch (e) {
      rawResult = `${(e as Error).name}`
    }

    const safeResult = safeFormatNumber(c.raw as number | null | undefined, c.decimals)
    const rawDisplay = rawResult.length > 16 ? rawResult.slice(0, 13) + '...' : rawResult

    console.log(c.label.padEnd(22) + rawDisplay.padStart(18) + safeResult.padStart(20))
  }
}

// ─── 场景四：自定义 fallback 与 React 组件模拟 ──────────────────────────

function renderComponentSimulations(): void {
  console.log('\n' + '═'.repeat(80))
  console.log('  场景四：自定义 fallback 与组件级用法')
  console.log('═'.repeat(80))

  // 自定义 fallback 场景
  console.log('\n  自定义 fallback：')
  console.log(`    默认 fallback:     safeFormatNumber(null, 2)            = '${safeFormatNumber(null, 2)}'`)
  console.log(`    N/A fallback:      safeFormatNumber(null, 2, 'N/A')     = '${safeFormatNumber(null, 2, 'N/A')}'`)
  console.log(`    零值 fallback:     safeFormatNumber(undefined, 2, '0.00') = '${safeFormatNumber(undefined, 2, '0.00')}'`)
  console.log(`    空字符串 fallback: safeFormatPercent(NaN, 2, '')         = '${safeFormatPercent(NaN, 2, '')}'`)

  // 模拟 React 组件渲染输出
  console.log('\n  模拟 React 组件渲染：')
  const priceData: number | undefined = undefined
  const changeData: number | null = null

  const priceDisplay = safeFormatNumber(priceData, 2)
  const changeDisplay = safeFormatPercent(changeData, 2)
  console.log(`    <span className="price">{safeFormatNumber(price, 2)}</span>`)
  console.log(`    → <span className="price">${priceDisplay}</span>`)
  console.log(`    <span className="change">{safeFormatPercent(change, 2)}</span>`)
  console.log(`    → <span className="change">${changeDisplay}</span>`)

  // DEFAULT_FALLBACK 常量使用
  console.log(`\n  DEFAULT_FALLBACK 常量: '${DEFAULT_FALLBACK}'`)
  console.log(`    可用于组件条件渲染: {price === '${DEFAULT_FALLBACK}' ? <Skeleton /> : <Price />}`)
}

// ─── 主入口 ─────────────────────────────────────────────────────────────

console.log('\n' + '╔' + '═'.repeat(78) + '╗')
console.log('║' + '  @finsightv9/safe-format v1.0.0 — 业务场景演示'.padEnd(78) + '║')
console.log('║' + '  从私有 Verdaccio 仓库安装，零运行时依赖'.padEnd(78) + '║')
console.log('╚' + '═'.repeat(78) + '╝')

renderStockList(stockQuotes)
renderPortfolio(portfolio)
renderEdgeCases()
renderComponentSimulations()

console.log('\n' + '═'.repeat(80))
console.log('  演示完成 — 所有异常值均被安全处理，无 TypeError / RangeError / Infinity 显示')
console.log('═'.repeat(80) + '\n')
