/**
 * 八域资料体系 - 端到端测试脚本
 *
 * 使用真实/模拟的财务数据跑通完整链路：
 * 1. 衍生指标计算（杜邦/估值/成长/风险）
 * 2. 资料条目创建 + 自动打标
 * 3. 资料包统计与完整度计算
 * 4. 评分证据链构建（derived_metric + profile_item 两类）
 * 5. Markdown 导出
 * 6. 输出测试报告
 *
 * 运行方式：npx tsx scripts/test/profile-e2e-test.ts
 *
 * @updated 2026-07-20
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 测试输出目录
const OUTPUT_DIR = join(__dirname, '../../.test-output/profile-e2e')

// ============================================================
// 1. 测试数据：贵州茅台（600519）典型财务数据
// ============================================================

const testStock = {
  symbol: '600519',
  name: '贵州茅台',
  pe: 28.5,
  pb: 8.2,
  industryCode: '白酒',
  price: 1680,
}

// 2025 年报数据（真实量级的模拟数据）
const testFinancial = {
  symbol: '600519',
  reportDate: '2025-12-31',
  reportType: 'annual' as const,

  // 利润表
  revenue: 1600e8,           // 1600亿营收
  revenueYoY: 0.165,         // +16.5%
  operatingCost: 200e8,      // 200亿成本
  grossProfit: 1400e8,       // 1400亿毛利
  grossMargin: 0.875,        // 87.5% 毛利率
  operatingExpense: 500e8,   // 500亿费用
  operatingProfit: 900e8,    // 900亿营业利润
  operatingProfitYoY: 0.18,
  totalProfit: 920e8,
  totalProfitYoY: 0.175,
  netProfit: 750e8,          // 750亿净利润
  netProfitYoY: 0.172,       // +17.2%
  netMargin: 0.469,          // 46.9% 净利率
  rdExpense: 30e8,
  rdRatio: 0.0188,           // 1.88% 研发占比

  // 资产负债表
  totalAssets: 2800e8,
  totalAssetsYoY: 0.12,
  currentAssets: 1800e8,
  nonCurrentAssets: 1000e8,
  totalLiabilities: 600e8,
  totalLiabilitiesYoY: 0.08,
  currentLiabilities: 400e8,
  nonCurrentLiabilities: 200e8,
  netAssets: 2200e8,
  netAssetsYoY: 0.135,
  receivables: 50e8,
  receivablesYoY: 0.10,
  inventory: 300e8,
  inventoryYoY: 0.05,
  fixedAssets: 200e8,
  intangibleAssets: 20e8,
  goodwill: 10e8,
  interestBearingDebt: 0,     // 无有息负债
  shortTermDebt: 0,
  longTermDebt: 0,
  shareholderPledge: 0.002,   // 0.2% 质押

  // 现金流
  operatingCF: 850e8,         // 850亿经营现金流
  operatingCFYoY: 0.20,
  investingCF: -100e8,
  financingCF: -500e8,        // 分红
  netCF: 250e8,

  // 财务比率
  eps: 59.8,
  epsYoY: 0.17,
  dilutedEps: 59.5,
  bps: 175.3,
  inventoryTurnoverDays: 1200, // 存货周转天数（白酒行业特性）
  receivablesTurnoverDays: 15,
  assetTurnover: 0.571,        // 资产周转率
  roa: 0.268,                  // ROA 26.8%
  roe: 0.341,                  // ROE 34.1%
  debtToAssetRatio: 0.214,     // 资产负债率 21.4%
  currentRatio: 4.5,           // 流动比率 4.5
  quickRatio: 3.75,            // 速动比率 3.75
  dividendYield: 0.018,        // 股息率 1.8%
  payoutRatio: 0.52,

  updatedAt: Date.now(),
}

// 上期数据（用于同比/环比）
const testPrevFinancial = {
  ...testFinancial,
  revenue: 1373e8,
  revenueYoY: 0.14,
  netProfit: 640e8,
  netProfitYoY: 0.15,
  grossMargin: 0.865,
  netMargin: 0.466,
  totalAssets: 2500e8,
  netAssets: 1938e8,
  inventoryTurnoverDays: 1150,
  inventory: 285e8,
}

// 模拟资料条目（研报/新闻等）
const testProfileItems = [
  {
    symbol: '600519',
    domain: 'D3' as const,
    itemType: 'report' as const,
    title: '贵州茅台2025年报点评：业绩超预期，量价齐升',
    summary: '公司2025年实现营收1600亿元，同比增长16.5%；净利润750亿元，同比增长17.2%，超出市场一致预期。直销渠道占比提升至45%，产品结构持续优化。',
    source: '中信证券',
    sourceUrl: 'https://example.com/report/1',
    author: '食品饮料团队',
    publishedAt: Date.now() - 86400000 * 5,
    keyPoints: [
      '营收净利双位数增长，超市场预期',
      '直销占比提升至45%，吨价持续上行',
      '系列酒高速增长，成长曲线清晰',
    ],
    topicTags: ['白酒', '消费'],
    sentiment: 'positive' as const,
    qualityScore: 90,
    dataQuality: 'high' as const,
    relatedLayers: ['l1', 'l3f'],
    evidenceWeight: 0.8,
    isUserGenerated: false,
  },
  {
    symbol: '600519',
    domain: 'D5' as const,
    itemType: 'notice' as const,
    title: '贵州茅台2025年年度报告',
    summary: '公司发布2025年年报，营业收入1600亿元，同比增长16.5%；归属于上市公司股东的净利润750亿元，同比增长17.2%。拟每10股派发现金红利2500元。',
    source: '上交所',
    sourceUrl: 'https://example.com/notice/1',
    publishedAt: Date.now() - 86400000 * 3,
    qualityScore: 95,
    dataQuality: 'high' as const,
    relatedLayers: ['l3f', 'l3v'],
    evidenceWeight: 0.9,
    isUserGenerated: false,
  },
  {
    symbol: '600519',
    domain: 'D7' as const,
    itemType: 'news' as const,
    title: '茅台1935价格倒挂，渠道库存压力上升',
    summary: '近期茅台1935批价持续走低，部分渠道价格已跌破指导价。分析师认为系列酒面临增长压力，公司可能加大控量保价力度。',
    source: '酒业家',
    publishedAt: Date.now() - 86400000 * 2,
    sentiment: 'negative' as const,
    qualityScore: 60,
    dataQuality: 'medium' as const,
    relatedLayers: ['l4', 'l7'],
    evidenceWeight: 0.4,
    isUserGenerated: false,
  },
  {
    symbol: '600519',
    domain: 'D6' as const,
    itemType: 'analysis' as const,
    title: '茅台估值分析：PEG 1.65，处于合理区间上沿',
    summary: '当前PE 28.5倍，对应净利增速17.2%，PEG约1.65。历史PE分位约60%，行业分位约70%。综合判断估值处于合理偏高水平，建议等待回调。',
    source: 'FinSight内部',
    publishedAt: Date.now() - 86400000,
    qualityScore: 75,
    dataQuality: 'high' as const,
    relatedLayers: ['l3v'],
    evidenceWeight: 0.6,
    isUserGenerated: true,
  },
]

// ============================================================
// 2. 测试运行
// ============================================================

async function runE2ETest() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  八域资料体系 - 端到端测试')
  console.log('═══════════════════════════════════════════════════')
  console.log()

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const results: Array<{ test: string; passed: boolean; detail: string }> = []

  function assert(test: string, condition: boolean, detail: string) {
    results.push({ test, passed: condition, detail })
    console.log(`  ${condition ? '✅' : '❌'} ${test}`)
    if (!condition) console.log(`     └─ ${detail}`)
  }

  // ── 测试 1：衍生指标计算 ────────────────────────
  console.log('\n📊 测试 1：衍生指标计算引擎')
  console.log('─'.repeat(50))

  // 动态导入
  const {
    calculateDupont,
    calculateValuation,
    calculateGrowth,
    calculateRisk,
    calculateAllDerivedMetrics,
  } = await import('../../src/services/derived-metrics/derivedMetricsEngine.js')

  const dupont = calculateDupont(testFinancial)
  console.log(`  ROE: ${(dupont.roe * 100).toFixed(2)}%`)
  console.log(`  净利率: ${(dupont.netMargin * 100).toFixed(2)}%`)
  console.log(`  资产周转率: ${dupont.assetTurnover.toFixed(3)}`)
  console.log(`  权益乘数: ${dupont.equityMultiplier.toFixed(2)}`)
  console.log(`  主导因素: ${JSON.stringify(dupont.decomposition)}`)

  assert('ROE 在合理范围', dupont.roe > 0.1 && dupont.roe < 0.5, `实际: ${dupont.roe}`)
  assert('权益乘数 > 1', dupont.equityMultiplier > 1, `实际: ${dupont.equityMultiplier}`)
  assert('三因素贡献和 ≈ 1', Math.abs(
    dupont.decomposition.netMarginContribution +
    dupont.decomposition.turnoverContribution +
    dupont.decomposition.leverageContribution - 1
  ) < 0.01, `和为: ${
    dupont.decomposition.netMarginContribution +
    dupont.decomposition.turnoverContribution +
    dupont.decomposition.leverageContribution
  }`)

  const valuation = calculateValuation(testStock, testFinancial, { industryCode: '消费' })
  console.log(`\n  PE: ${valuation.pe}`)
  console.log(`  PEG: ${valuation.peg.toFixed(2)}`)
  console.log(`  估值评级: ${valuation.rating}`)
  console.log(`  估值评分: ${valuation.score}/100`)

  assert('PEG > 0', valuation.peg > 0, `实际: ${valuation.peg}`)
  assert('估值评级合法', ['undervalued', 'reasonable', 'overvalued'].includes(valuation.rating), valuation.rating)
  assert('评分 0-100', valuation.score >= 0 && valuation.score <= 100, `实际: ${valuation.score}`)

  const growth = calculateGrowth(testFinancial, testPrevFinancial)
  console.log(`\n  净利增速: ${(growth.netProfitYoY * 100).toFixed(1)}%`)
  console.log(`  一致性: ${growth.consistency.toFixed(2)}`)
  console.log(`  现金流质量: ${growth.cashFlowQuality.toFixed(2)}`)
  console.log(`  成长评分: ${growth.score}/100`)

  assert('成长评分 0-100', growth.score >= 0 && growth.score <= 100, `实际: ${growth.score}`)
  assert('增收增利一致性 > 0', growth.consistency > 0, `实际: ${growth.consistency}`)

  const risk = calculateRisk(testFinancial, testPrevFinancial)
  console.log(`\n  资产负债率: ${(risk.debtToAssetRatio * 100).toFixed(1)}%`)
  console.log(`  流动比率: ${risk.currentRatio.toFixed(2)}`)
  console.log(`  风险等级: ${risk.warningLevel}`)
  console.log(`  风险评分: ${risk.score}/100`)

  assert('风险等级合法', ['safe', 'yellow', 'red'].includes(risk.warningLevel), risk.warningLevel)
  assert('风险评分 0-100', risk.score >= 0 && risk.score <= 100, `实际: ${risk.score}`)
  assert('茅台风险等级为 safe', risk.warningLevel === 'safe', `实际: ${risk.warningLevel}`)

  const allMetrics = calculateAllDerivedMetrics(testStock.symbol, testFinancial, testStock, testPrevFinancial)
  console.log(`\n  综合衍生指标评分: ${allMetrics.overallScore}/100`)
  assert('综合评分 0-100', allMetrics.overallScore >= 0 && allMetrics.overallScore <= 100, `实际: ${allMetrics.overallScore}`)

  // 保存衍生指标结果
  writeFileSync(
    join(OUTPUT_DIR, 'derived-metrics.json'),
    JSON.stringify(allMetrics, null, 2),
  )

  // ── 测试 2：自动打标 ────────────────────────────
  console.log('\n\n🏷️  测试 2：标签系统 + 自动打标')
  console.log('─'.repeat(50))

  const { autoTagItem } = await import('../../src/services/profile/tagService.js')

  let taggedCount = 0
  for (const itemData of testProfileItems) {
    const item = autoTagItem({
      id: `test_${Math.random().toString(36).slice(2, 8)}`,
      dataHash: 'testhash',
      collectedAt: Date.now(),
      schemaVersion: 1,
      version: 1,
      isUserGenerated: itemData.isUserGenerated,
      ...itemData,
    } as any)

    console.log(`  [${item.domain}] ${item.title.slice(0, 30)}...`)
    console.log(`    情绪: ${item.sentiment} | 质量: ${item.qualityScore} | 标签: ${item.topicTags?.join(', ') || '无'}`)

    if (item.sentiment && item.qualityScore !== undefined) taggedCount++
  }

  assert('所有条目完成打标', taggedCount === testProfileItems.length, `已打标: ${taggedCount}/${testProfileItems.length}`)

  // ── 测试 3：衍生指标 → 证据链 ──────────────────
  console.log('\n\n🔗 测试 3：衍生指标 → 评分证据链')
  console.log('─'.repeat(50))

  const { derivedMetricsToEvidence } = await import('../../src/services/derived-metrics/derivedMetricsEvidence.js')

  const evidences = derivedMetricsToEvidence(testStock.symbol, allMetrics)
  console.log(`  生成证据数: ${evidences.length} 条`)

  const evidenceByLayer: Record<string, number> = {}
  const evidenceByType: Record<string, number> = {}
  for (const ev of evidences) {
    evidenceByLayer[ev.layerId] = (evidenceByLayer[ev.layerId] ?? 0) + 1
    evidenceByType[ev.evidenceType] = (evidenceByType[ev.evidenceType] ?? 0) + 1
  }

  console.log(`  按层分布: ${JSON.stringify(evidenceByLayer)}`)
  console.log(`  按类型分布: ${JSON.stringify(evidenceByType)}`)

  assert('证据数量 > 10', evidences.length > 10, `实际: ${evidences.length}`)
  assert('包含 derived_metric 型证据', (evidenceByType['derived_metric'] ?? 0) > 0, '未找到 derived_metric 证据')
  assert('覆盖 L1 层', (evidenceByLayer['l1'] ?? 0) > 0, 'L1 层无证据')
  assert('覆盖 L3f 层', (evidenceByLayer['l3f'] ?? 0) > 0, 'L3f 层无证据')
  assert('覆盖 L3v 层', (evidenceByLayer['l3v'] ?? 0) > 0, 'L3v 层无证据')

  // 保存证据链结果
  writeFileSync(
    join(OUTPUT_DIR, 'score-evidence.json'),
    JSON.stringify(evidences, null, 2),
  )

  // ── 测试 4：Markdown 导出 ──────────────────────
  console.log('\n\n📄 测试 4：Markdown 导出')
  console.log('─'.repeat(50))

  const {
    profileItemToMarkdown,
    evidenceLayerToMarkdown,
  } = await import('../../src/services/profile/profileExportService.js')

  // 导出单条资料 Markdown
  const sampleItem = autoTagItem({
    id: 'test_item_001',
    dataHash: 'testhash001',
    collectedAt: Date.now(),
    schemaVersion: 1,
    version: 1,
    isUserGenerated: false,
    ...testProfileItems[0],
  } as any)
  const itemMd = profileItemToMarkdown(sampleItem)
  writeFileSync(join(OUTPUT_DIR, 'sample-profile-item.md'), itemMd)
  console.log(`  资料条目 Markdown: ${itemMd.length} 字符`)
  assert('包含 Front Matter', itemMd.startsWith('---'), '未找到 Front Matter 标记')
  assert('包含标题', itemMd.includes('# ' + sampleItem.title), '未找到标题')

  // 导出证据链 Markdown
  const l3fEvidences = evidences.filter((e) => e.layerId === 'l3f')
  const evidenceMd = evidenceLayerToMarkdown('L3a 财务健康', 4.2, l3fEvidences)
  writeFileSync(join(OUTPUT_DIR, 'sample-evidence-layer.md'), evidenceMd)
  console.log(`  证据层 Markdown: ${evidenceMd.length} 字符`)
  assert('包含得分信息', evidenceMd.includes('得分：'), '未找到得分信息')
  assert('包含正向证据', evidenceMd.includes('正向证据'), '未找到正向证据部分')

  // ── 测试 5：分位计算 ────────────────────────────
  console.log('\n\n📈 测试 5：百分位计算')
  console.log('─'.repeat(50))

  const { calculatePercentile } = await import('../../src/services/derived-metrics/derivedMetricsEngine.js')

  const testData = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  const p30 = calculatePercentile(30, testData)
  const p50 = calculatePercentile(55, testData)
  const pMin = calculatePercentile(5, testData)
  const pMax = calculatePercentile(105, testData)

  console.log(`  值=30 分位: ${p30.toFixed(3)} (期望 ~0.222)`)
  console.log(`  值=55 分位: ${p50.toFixed(3)} (期望 ~0.5)`)
  console.log(`  值=5 分位: ${pMin} (期望 0)`)
  console.log(`  值=105 分位: ${pMax} (期望 1)`)

  assert('最小值分位 = 0', pMin === 0, `实际: ${pMin}`)
  assert('最大值分位 = 1', pMax === 1, `实际: ${pMax}`)
  assert('中间值分位 ≈ 0.5', Math.abs(p50 - 0.5) < 0.1, `实际: ${p50}`)

  // ============================================================
  // 测试汇总
  // ============================================================

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  console.log('\n')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  测试结果：${passed}/${total} 通过`)
  console.log('═══════════════════════════════════════════════════')

  if (passed < total) {
    console.log('\n❌ 失败用例：')
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.test}: ${r.detail}`)
    })
  } else {
    console.log('\n🎉 全部通过！')
  }

  console.log(`\n📁 测试输出目录: ${OUTPUT_DIR}`)
  console.log()

  return passed === total
}

// 运行
runE2ETest()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((err) => {
    console.error('\n💥 测试异常：', err)
    process.exit(1)
  })
