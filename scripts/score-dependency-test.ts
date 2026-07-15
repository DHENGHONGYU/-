import { createV6Engine, stockToBasicData, quotesToQuoteData, ALL_LAYER_IDS, LAYER_LABELS } from '@/services/scoring/v6-engine'
import type { CompositeScore, LayerScore, V6ScoreInput, StockBasicData, FinancialData, QuoteData } from '@/services/scoring/v6-engine/types'
import { LLMScoreEnhancer } from '@/services/scoring/v6-engine/enhancer'

const logger = console

interface TestStock {
  symbol: string
  name: string
  sector: string
  price: number
  pe: number | undefined
  pb: number | undefined
  roe: number | undefined
  marketCap: number | undefined
  revenue: number | undefined
  revenueYoY: number | undefined
  netProfit: number | undefined
  netProfitYoY: number | undefined
  grossMargin: number | undefined
  rdRatio: number | undefined
  historyLength: number
  trend: 'up' | 'down' | 'sideways'
}

const TEST_STOCKS: TestStock[] = [
  { symbol: '000001.SZ', name: '平安银行', sector: '金融', price: 12.5, pe: 6.8, pb: 0.85, roe: 0.12, marketCap: 2.5e11, revenue: 1800, revenueYoY: 0.05, netProfit: 360, netProfitYoY: 0.08, grossMargin: 0.35, rdRatio: 0.02, historyLength: 60, trend: 'sideways' },
  { symbol: '600519.SH', name: '贵州茅台', sector: '消费', price: 1650, pe: 28, pb: 8.5, roe: 0.35, marketCap: 2.1e12, revenue: 1600, revenueYoY: 0.12, netProfit: 850, netProfitYoY: 0.15, grossMargin: 0.91, rdRatio: 0.01, historyLength: 60, trend: 'up' },
  { symbol: '000858.SZ', name: '五粮液', sector: '消费', price: 145, pe: 22, pb: 5.2, roe: 0.28, marketCap: 8e11, revenue: 850, revenueYoY: 0.10, netProfit: 320, netProfitYoY: 0.12, grossMargin: 0.75, rdRatio: 0.02, historyLength: 60, trend: 'up' },
  { symbol: '601318.SH', name: '中国平安', sector: '金融', price: 48, pe: 5.5, pb: 0.75, roe: 0.09, marketCap: 1.2e12, revenue: 13000, revenueYoY: 0.03, netProfit: 1050, netProfitYoY: 0.06, grossMargin: 0.22, rdRatio: 0.01, historyLength: 60, trend: 'sideways' },
  { symbol: '300750.SZ', name: '宁德时代', sector: '新能源', price: 185, pe: 25, pb: 4.5, roe: 0.20, marketCap: 1.5e12, revenue: 3500, revenueYoY: 0.45, netProfit: 420, netProfitYoY: 0.55, grossMargin: 0.18, rdRatio: 0.08, historyLength: 60, trend: 'up' },
  { symbol: '002594.SZ', name: '比亚迪', sector: '新能源', price: 268, pe: 45, pb: 6.2, roe: 0.15, marketCap: 8e11, revenue: 4200, revenueYoY: 0.38, netProfit: 220, netProfitYoY: 0.85, grossMargin: 0.14, rdRatio: 0.06, historyLength: 60, trend: 'up' },
  { symbol: '600036.SH', name: '招商银行', sector: '金融', price: 32, pe: 7.2, pb: 1.05, roe: 0.16, marketCap: 1.1e12, revenue: 3200, revenueYoY: 0.06, netProfit: 1300, netProfitYoY: 0.08, grossMargin: 0.38, rdRatio: 0.03, historyLength: 60, trend: 'down' },
  { symbol: '600030.SH', name: '中信证券', sector: '金融', price: 24, pe: 15, pb: 1.3, roe: 0.10, marketCap: 3.5e11, revenue: 650, revenueYoY: 0.15, netProfit: 210, netProfitYoY: 0.20, grossMargin: 0.45, rdRatio: 0.02, historyLength: 60, trend: 'sideways' },
  { symbol: '300059.SZ', name: '东方财富', sector: '金融', price: 18, pe: 38, pb: 3.8, roe: 0.14, marketCap: 4.5e11, revenue: 160, revenueYoY: 0.25, netProfit: 95, netProfitYoY: 0.30, grossMargin: 0.72, rdRatio: 0.08, historyLength: 60, trend: 'up' },
  { symbol: '601398.SH', name: '工商银行', sector: '金融', price: 5.2, pe: 5.0, pb: 0.65, roe: 0.11, marketCap: 2.2e12, revenue: 7200, revenueYoY: 0.02, netProfit: 3500, netProfitYoY: 0.04, grossMargin: 0.28, rdRatio: 0.01, historyLength: 60, trend: 'down' },
]

function generateKlineHistory(basePrice: number, days: number, trend: 'up' | 'down' | 'sideways'): { close: number; volume: number }[] {
  const history: { close: number; volume: number }[] = []
  let price = basePrice
  const trendFactor = trend === 'up' ? 0.0015 : trend === 'down' ? -0.0015 : 0
  for (let i = 0; i < days; i++) {
    const volatility = (Math.random() - 0.5) * 0.02
    price = price * (1 + trendFactor + volatility)
    history.push({ close: Number(price.toFixed(2)), volume: 1_000_000 + Math.floor(Math.random() * 500_000) })
  }
  return history
}

function buildStockData(stock: TestStock): StockBasicData {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
  }
}

function buildFinancialData(stock: TestStock): FinancialData {
  return {
    revenue: stock.revenue,
    revenueYoY: stock.revenueYoY,
    netProfit: stock.netProfit,
    netProfitYoY: stock.netProfitYoY,
    grossMargin: stock.grossMargin,
    rdRatio: stock.rdRatio,
  }
}

function buildQuoteData(stock: TestStock): QuoteData {
  const history = generateKlineHistory(stock.price, stock.historyLength, stock.trend)
  return {
    latestClose: history[history.length - 1]?.close,
    history: history.map(h => h.close),
    volumeHistory: history.map(h => h.volume),
  }
}

function buildEngineInput(stock: TestStock): V6ScoreInput {
  return {
    symbol: stock.symbol,
    stock: buildStockData(stock),
    financials: buildFinancialData(stock),
    quotes: buildQuoteData(stock),
  }
}

interface ScoreDependencyAnalysis {
  symbol: string
  name: string
  sector: string
  compositeScore: number
  rating: string
  coverageRate: number
  skippedLayers: string[]
  layerDetails: Record<string, { score: number; dataSources: string[]; evidenceCount: number; hasData: boolean }>
  dataDependency: {
    hasBasicData: boolean
    hasFinancialData: boolean
    hasQuoteData: boolean
    dataCompleteness: number
  }
  llmEnhanceableLayers: string[]
}

async function analyzeStock(stock: TestStock, useLlmEnhancer: boolean): Promise<ScoreDependencyAnalysis> {
  const engine = createV6Engine({ llmEnabled: useLlmEnhancer })
  
  if (useLlmEnhancer) {
    const enhancer = new LLMScoreEnhancer()
    enhancer.disable()
  }
  
  const input = buildEngineInput(stock)
  const composite: CompositeScore = await engine.calculateAll(input)
  
  const layerDetails: Record<string, { score: number; dataSources: string[]; evidenceCount: number; hasData: boolean }> = {}
  const skippedLayers: string[] = []
  const llmEnhanceable = ['l0', 'l1', 'l2', 'l4', 'l5', 'l6', 'l7']
  
  for (const layerId of ALL_LAYER_IDS) {
    const layer = composite.layers[layerId]
    if (!layer) {
      skippedLayers.push(layerId)
      continue
    }
    
    const hasData = Number.isFinite(layer.score) && layer.score >= 0
    if (!hasData) {
      skippedLayers.push(layerId)
    }
    
    layerDetails[layerId] = {
      score: hasData ? layer.score : NaN,
      dataSources: layer.dataSources || [],
      evidenceCount: (layer.evidence || []).length,
      hasData,
    }
  }
  
  const hasBasicData = stock.price !== undefined && stock.pe !== undefined && stock.pb !== undefined
  const hasFinancialData = stock.revenue !== undefined && stock.revenueYoY !== undefined && stock.netProfit !== undefined
  const hasQuoteData = input.quotes.history.length > 0
  
  const dataFields = [stock.price, stock.pe, stock.pb, stock.roe, stock.marketCap, stock.revenue, stock.revenueYoY, stock.netProfit, stock.netProfitYoY, stock.grossMargin, stock.rdRatio]
  const dataCompleteness = dataFields.filter(v => v !== undefined).length / dataFields.length
  
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    compositeScore: composite.score,
    rating: composite.rating,
    coverageRate: composite.coverageRate || 0,
    skippedLayers,
    layerDetails,
    dataDependency: { hasBasicData, hasFinancialData, hasQuoteData, dataCompleteness },
    llmEnhanceableLayers: llmEnhanceable,
  }
}

function printAnalysis(analysis: ScoreDependencyAnalysis): void {
  console.log('\n' + '='.repeat(80))
  console.log(`股票: ${analysis.name} (${analysis.symbol})`)
  console.log(`行业: ${analysis.sector}`)
  console.log(`综合评分: ${analysis.compositeScore.toFixed(2)}/5.00`)
  console.log(`评级: ${analysis.rating}`)
  console.log(`覆盖率: ${(analysis.coverageRate * 100).toFixed(0)}%`)
  console.log(`被跳过的层: ${analysis.skippedLayers.length > 0 ? analysis.skippedLayers.join(', ') : '无'}`)
  console.log('---')
  console.log('数据依赖性:')
  console.log(`  - 基础数据: ${analysis.dataDependency.hasBasicData ? '✅ 完整' : '❌ 缺失'}`)
  console.log(`  - 财务数据: ${analysis.dataDependency.hasFinancialData ? '✅ 完整' : '❌ 缺失'}`)
  console.log(`  - K线数据: ${analysis.dataDependency.hasQuoteData ? '✅ 完整' : '❌ 缺失'}`)
  console.log(`  - 数据完整度: ${(analysis.dataDependency.dataCompleteness * 100).toFixed(0)}%`)
  console.log('---')
  console.log('各层评分明细:')
  
  for (const layerId of ALL_LAYER_IDS) {
    const detail = analysis.layerDetails[layerId]
    if (!detail) continue
    
    const status = detail.hasData ? '✅' : '❌'
    const score = detail.hasData ? detail.score.toFixed(2) : 'NaN'
    const label = LAYER_LABELS[layerId as keyof typeof LAYER_LABELS] || layerId
    const isLlm = analysis.llmEnhanceableLayers.includes(layerId) ? '(LLM可增强)' : '(确定性)'
    
    console.log(`  ${status} ${label} ${isLlm}`)
    console.log(`    得分: ${score} | 数据源: ${detail.dataSources.join(', ') || '无'}`)
    console.log(`    证据数: ${detail.evidenceCount}`)
  }
}

function printSummary(analyses: ScoreDependencyAnalysis[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('【评分数据依赖性测试汇总】')
  console.log('='.repeat(80))
  
  const avgScore = analyses.reduce((sum, a) => sum + a.compositeScore, 0) / analyses.length
  const avgCoverage = analyses.reduce((sum, a) => sum + a.coverageRate, 0) / analyses.length
  const avgCompleteness = analyses.reduce((sum, a) => sum + a.dataDependency.dataCompleteness, 0) / analyses.length
  
  console.log(`\n测试股票数: ${analyses.length}`)
  console.log(`平均综合评分: ${avgScore.toFixed(2)}/5.00`)
  console.log(`平均覆盖率: ${(avgCoverage * 100).toFixed(0)}%`)
  console.log(`平均数据完整度: ${(avgCompleteness * 100).toFixed(0)}%`)
  
  console.log('\n【评分依据分析】')
  
  const dataDrivenLayers = ['lMinus1', 'l3f', 'l3v', 'l8']
  const llmEnhanceableLayers = ['l0', 'l1', 'l2', 'l4', 'l5', 'l6', 'l7']
  
  console.log('\n确定性层（纯规则计算，不依赖LLM）:')
  for (const layer of dataDrivenLayers) {
    const label = LAYER_LABELS[layer as keyof typeof LAYER_LABELS] || layer
    const weights: Record<string, number> = {
      lMinus1: 0.10, l3f: 0.10, l3v: 0.08, l8: 0.04,
    }
    console.log(`  - ${label}: 权重 ${(weights[layer] * 100).toFixed(0)}%`)
    console.log(`    依赖数据: 行业评分(lMinus1)、财务指标(l3f)、估值指标(l3v)、K线量价(l8)`)
  }
  
  console.log('\nLLM可增强层（规则计算基础分，LLM可复核）:')
  for (const layer of llmEnhanceableLayers) {
    const label = LAYER_LABELS[layer as keyof typeof LAYER_LABELS] || layer
    const weights: Record<string, number> = {
      l0: 0.08, l1: 0.15, l2: 0.10, l4: 0.08, l5: 0.05, l6: 0.07, l7: 0.15,
    }
    console.log(`  - ${label}: 权重 ${(weights[layer] * 100).toFixed(0)}%`)
  }
  
  console.log('\n【关键发现】')
  console.log('1. V6评分引擎采用"因子骨架 + LLM增强"的混合架构')
  console.log('2. 确定性层（L-1/L3f/L3v/L8）占总权重约32%，完全依赖采集数据')
  console.log('3. LLM可增强层占总权重约68%，规则引擎给出基础分，LLM仅做补充增强')
  console.log('4. LLM增强时必须提供citations（引用依据），无依据的评分调整会被拒绝')
  console.log('5. 离线模式或LLM不可用时，直接透传规则引擎结果')
  
  console.log('\n【可能遗漏的评分依据】')
  console.log('1. L0宏观扫描：当前仅基于行业名称做规则判断，缺少实时宏观数据')
  console.log('2. L1护城河：缺少客户粘性、转换成本等定性指标的数据支撑')
  console.log('3. L2竞品格局：缺少市场份额、技术代差的量化数据')
  console.log('4. L5 T-M矩阵：技术成熟度主要依赖行业规则判断，缺少研发进度数据')
  console.log('5. L6 Hype周期：缺少舆情热度、搜索指数等数据')
  console.log('6. L7第二曲线：缺少订单覆盖率、在手订单等详细数据')
  
  console.log('\n【建议改进方向】')
  console.log('1. 增加宏观经济数据采集（GDP、CPI、货币政策等）')
  console.log('2. 补充行业竞争格局数据（市场份额、市占率变化）')
  console.log('3. 接入舆情/搜索指数数据用于情绪指标')
  console.log('4. 增加订单数据（在手订单、新签订单）采集')
  console.log('5. 完善研发投入明细数据（专利数量、研发人员占比）')
}

async function main() {
  console.log('='.repeat(80))
  console.log('股票分析模型评分数据依赖性测试')
  console.log('='.repeat(80))
  
  const analyses: ScoreDependencyAnalysis[] = []
  
  for (let i = 0; i < TEST_STOCKS.length; i++) {
    console.log(`\n正在分析第 ${i + 1}/${TEST_STOCKS.length} 只股票...`)
    const analysis = await analyzeStock(TEST_STOCKS[i], false)
    analyses.push(analysis)
    printAnalysis(analysis)
  }
  
  printSummary(analyses)
}

main().catch(console.error)