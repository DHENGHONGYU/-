/**
 * 八域资料体系 - 完整端到端测试
 *
 * 测试全链路：
 * 1. 准备测试数据（新闻 + 财务 + 行情）
 * 2. 新闻分类 → 八域
 * 3. 新闻 → 资料条目（自动打标）
 * 4. 衍生指标计算（杜邦/估值/成长/风险）
 * 5. 三来源证据链构建（引擎evidence + 衍生指标 + 资料条目）
 * 6. Markdown 导出（资料条目 + 证据链 + 总览）
 * 7. 验证输出格式和数据正确性
 *
 * 运行方式：npx tsx scripts/test/profile-full-e2e.ts
 *
 * @updated 2026-07-20
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUTPUT_DIR = join(__dirname, '../../.test-output/profile-full-e2e')

// ============================================================
// 测试数据
// ============================================================

const testStock = {
  symbol: '600519',
  name: '贵州茅台',
  pe: 28.5,
  pb: 8.2,
  industryCode: '白酒',
  price: 1680,
}

// 财务数据（2025年报）
const testFinancial = {
  symbol: '600519',
  reportDate: '2025-12-31',
  reportType: 'annual' as const,
  revenue: 1600e8,
  revenueYoY: 0.165,
  operatingCost: 200e8,
  grossProfit: 1400e8,
  grossMargin: 0.875,
  operatingExpense: 500e8,
  operatingProfit: 900e8,
  operatingProfitYoY: 0.18,
  totalProfit: 920e8,
  totalProfitYoY: 0.175,
  netProfit: 750e8,
  netProfitYoY: 0.172,
  netMargin: 0.469,
  rdExpense: 30e8,
  rdRatio: 0.0188,
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
  interestBearingDebt: 0,
  shortTermDebt: 0,
  longTermDebt: 0,
  shareholderPledge: 0.002,
  operatingCF: 850e8,
  operatingCFYoY: 0.20,
  investingCF: -100e8,
  financingCF: -500e8,
  netCF: 250e8,
  eps: 59.8,
  epsYoY: 0.17,
  dilutedEps: 59.5,
  bps: 175.3,
  inventoryTurnoverDays: 1200,
  receivablesTurnoverDays: 15,
  assetTurnover: 0.571,
  roa: 0.268,
  roe: 0.341,
  debtToAssetRatio: 0.214,
  currentRatio: 4.5,
  quickRatio: 3.75,
  dividendYield: 0.018,
  payoutRatio: 0.52,
  updatedAt: Date.now(),
}

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

// 模拟新闻数据（10条，覆盖各域）
const testNews = [
  {
    id: 'news_001',
    title: '贵州茅台2025年报：净利润750亿，同比增长17.2%',
    content: '贵州茅台发布2025年年报，实现营业收入1600亿元，同比增长16.5%；归属于上市公司股东的净利润750亿元，同比增长17.2%。基本每股收益59.8元。',
    url: 'https://example.com/news/001',
    source: '上海证券报',
    category: '公司公告',
    publishTime: '2026-04-10T20:00:00Z',
    fetchTime: '2026-04-10T21:00:00Z',
    sentiment: 'positive' as const,
    sentimentConfidence: 0.92,
    relatedStocks: ['600519'],
    keywords: ['年报', '净利润', '营收'],
    hash: 'hash_001',
  },
  {
    id: 'news_002',
    title: '白酒行业2025年景气度分析：高端稳健，次高端承压',
    content: '2025年白酒行业整体呈现分化态势，高端白酒凭借品牌力和渠道优势保持稳健增长，行业CR5集中度进一步提升至65%。次高端白酒面临库存压力和价格倒挂问题。',
    url: 'https://example.com/news/002',
    source: '中信建投',
    category: '行业研究',
    publishTime: '2026-03-15T10:00:00Z',
    fetchTime: '2026-03-15T11:00:00Z',
    sentiment: 'neutral' as const,
    sentimentConfidence: 0.78,
    relatedStocks: ['600519', '000858'],
    keywords: ['白酒', '行业', '景气度', '集中度'],
    hash: 'hash_002',
  },
  {
    id: 'news_003',
    title: '美联储宣布加息25个基点，全球市场承压',
    content: '美联储宣布将联邦基金利率目标区间上调25个基点到5.25%-5.5%，为2001年以来最高水平。美元指数走强，人民币汇率面临贬值压力。',
    url: 'https://example.com/news/003',
    source: '新华社',
    category: '宏观经济',
    publishTime: '2026-03-20T02:00:00Z',
    fetchTime: '2026-03-20T03:00:00Z',
    sentiment: 'negative' as const,
    sentimentConfidence: 0.88,
    relatedStocks: [],
    keywords: ['美联储', '加息', '利率', '汇率'],
    hash: 'hash_003',
  },
  {
    id: 'news_004',
    title: '茅台1935价格倒挂，经销商库存压力加大',
    content: '近期茅台1935批价持续走低，部分渠道价格已跌破指导价1188元。分析师认为系列酒面临增长压力，公司可能加大控量保价力度。',
    url: 'https://example.com/news/004',
    source: '酒业家',
    category: '公司新闻',
    publishTime: '2026-04-05T14:00:00Z',
    fetchTime: '2026-04-05T15:00:00Z',
    sentiment: 'negative' as const,
    sentimentConfidence: 0.75,
    relatedStocks: ['600519'],
    keywords: ['茅台1935', '价格倒挂', '库存'],
    hash: 'hash_004',
  },
  {
    id: 'news_005',
    title: '贵州茅台：直销占比提升至45%，渠道结构持续优化',
    content: '公司2025年直销渠道收入占比提升至45%，同比提升8个百分点。i茅台平台注册用户突破5000万，数字渠道成为重要增长引擎。',
    url: 'https://example.com/news/005',
    source: '第一财经',
    category: '公司新闻',
    publishTime: '2026-04-12T09:00:00Z',
    fetchTime: '2026-04-12T10:00:00Z',
    sentiment: 'positive' as const,
    sentimentConfidence: 0.82,
    relatedStocks: ['600519'],
    keywords: ['直销', '渠道', 'i茅台'],
    hash: 'hash_005',
  },
  {
    id: 'news_006',
    title: '白酒板块估值分析：PE 28倍，处于历史中高位',
    content: '当前白酒板块PE约28倍，处于近5年60%分位。龙头公司估值溢价明显，茅台PE 28.5倍、五粮液PE 22倍。考虑到业绩增速，PEG约1.6-1.8倍，估值偏合理。',
    url: 'https://example.com/news/006',
    source: '华泰证券',
    category: '估值分析',
    publishTime: '2026-04-08T16:00:00Z',
    fetchTime: '2026-04-08T17:00:00Z',
    sentiment: 'neutral' as const,
    sentimentConfidence: 0.7,
    relatedStocks: ['600519', '000858'],
    keywords: ['估值', 'PE', 'PEG', '白酒'],
    hash: 'hash_006',
  },
  {
    id: 'news_007',
    title: '贵州茅台股价创历史新高，北向资金持续加仓',
    content: '贵州茅台今日大涨3.5%，股价突破1700元创历史新高。北向资金当日净买入超10亿元，近一个月累计增持超50亿元。',
    url: 'https://example.com/news/007',
    source: '东方财富',
    category: '市场行情',
    publishTime: '2026-04-15T15:00:00Z',
    fetchTime: '2026-04-15T16:00:00Z',
    sentiment: 'positive' as const,
    sentimentConfidence: 0.85,
    relatedStocks: ['600519'],
    keywords: ['股价', '北向资金', '创新高', '成交量'],
    hash: 'hash_007',
  },
  {
    id: 'news_008',
    title: '茅台拟投资50亿扩产，产能扩张支撑长期增长',
    content: '公司公告拟投资50亿元建设茅台酒技改扩能项目，建成后将新增产能约2万吨。分析师认为产能扩张将支撑未来5-10年的增长空间。',
    url: 'https://example.com/news/008',
    source: '证券时报',
    category: '公司公告',
    publishTime: '2026-03-28T08:00:00Z',
    fetchTime: '2026-03-28T09:00:00Z',
    sentiment: 'positive' as const,
    sentimentConfidence: 0.8,
    relatedStocks: ['600519'],
    keywords: ['扩产', '产能', '投资', '增长'],
    hash: 'hash_008',
  },
]

// ============================================================
// 测试运行
// ============================================================

async function runFullE2ETest() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  八域资料体系 - 完整端到端测试')
  console.log('═══════════════════════════════════════════════════════')
  console.log()

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const results: Array<{ test: string; passed: boolean; detail: string }> = []

  function assert(test: string, condition: boolean, detail: string) {
    results.push({ test, passed: condition, detail })
    console.log(`  ${condition ? '✅' : '❌'} ${test}`)
    if (!condition) console.log(`     └─ ${detail}`)
  }

  // ── 测试 1：新闻分类器 ───────────────────────────────
  console.log('\n🏷️  测试 1：新闻 → 八域分类器')
  console.log('─'.repeat(55))

  const { classifyNewsToDomain } = await import(
    '../../src/services/profile/newsSyncService.js'
  )

  const domainResults: Record<string, string> = {}
  for (const news of testNews) {
    const domain = classifyNewsToDomain(news)
    domainResults[news.id] = domain
    console.log(`  [${domain}] ${news.title.slice(0, 35)}...`)
  }

  assert('年报新闻 → D3 公司基本面', domainResults['news_001'] === 'D3', `实际: ${domainResults['news_001']}`)
  assert('行业新闻 → D1 行业产业', domainResults['news_002'] === 'D1', `实际: ${domainResults['news_002']}`)
  assert('宏观新闻 → D2 宏观环境', domainResults['news_003'] === 'D2', `实际: ${domainResults['news_003']}`)
  assert('估值新闻 → D6 估值定价', domainResults['news_006'] === 'D6', `实际: ${domainResults['news_006']}`)
  assert('行情新闻 → D8 市场信号', domainResults['news_007'] === 'D8', `实际: ${domainResults['news_007']}`)

  const domainsHit = new Set(Object.values(domainResults))
  assert('覆盖 ≥5 个不同域', domainsHit.size >= 5, `实际覆盖: ${domainsHit.size} 个域`)

  // ── 测试 2：新闻 → 资料条目转换 ──────────────────────
  console.log('\n📄 测试 2：新闻 → 资料条目转换 + 自动打标')
  console.log('─'.repeat(55))

  const { newsArticleToProfileItem } = await import(
    '../../src/services/profile/newsSyncService.js'
  )

  const profileItems = testNews.map((news) =>
    newsArticleToProfileItem(news, testStock.symbol, { relevanceScore: 0.8 }),
  )

  console.log(`  共转换 ${profileItems.length} 条资料`)
  const domains = new Set(profileItems.map((p) => p.domain))
  console.log(`  分布域: ${Array.from(domains).join(', ')}`)

  assert('所有条目都有情绪标签', profileItems.every((p) => p.sentiment), '存在无情绪条目')
  assert('所有条目都有质量评分', profileItems.every((p) => p.qualityScore !== undefined), '存在无质量评分条目')
  assert('所有条目都有主题标签', profileItems.every((p) => p.topicTags && p.topicTags.length > 0), '存在无标签条目')
  assert('所有条目都关联评分层', profileItems.every((p) => p.relatedLayers && p.relatedLayers.length > 0), '存在无关联层条目')

  // 保存到输出目录
  writeFileSync(
    join(OUTPUT_DIR, 'profile-items.json'),
    JSON.stringify(profileItems, null, 2),
  )

  // ── 测试 3：衍生指标计算 ───────────────────────────
  console.log('\n📊 测试 3：衍生指标计算（4大类）')
  console.log('─'.repeat(55))

  const { calculateAllDerivedMetrics } = await import(
    '../../src/services/derived-metrics/derivedMetricsEngine.js'
  )

  const metrics = calculateAllDerivedMetrics(
    testStock.symbol,
    testFinancial as any,
    testStock,
    testPrevFinancial as any,
  )

  console.log(`  杜邦 ROE: ${(metrics.dupont.roe * 100).toFixed(2)}%`)
  console.log(`  估值 PEG: ${metrics.valuation.peg < 100 ? metrics.valuation.peg.toFixed(2) : 'N/A'}`)
  console.log(`  成长评分: ${metrics.growth.score}/100`)
  console.log(`  风险评分: ${metrics.risk.score}/100 (${metrics.risk.warningLevel})`)
  console.log(`  综合评分: ${metrics.overallScore}/100`)

  assert('ROE > 0', metrics.dupont.roe > 0, `实际: ${metrics.dupont.roe}`)
  assert('权益乘数 > 1', metrics.dupont.equityMultiplier > 1, `实际: ${metrics.dupont.equityMultiplier}`)
  assert('PEG > 0', metrics.valuation.peg > 0, `实际: ${metrics.valuation.peg}`)
  assert('风险等级为 safe', metrics.risk.warningLevel === 'safe', `实际: ${metrics.risk.warningLevel}`)
  assert('综合评分 0-100', metrics.overallScore >= 0 && metrics.overallScore <= 100, `实际: ${metrics.overallScore}`)

  writeFileSync(
    join(OUTPUT_DIR, 'derived-metrics.json'),
    JSON.stringify(metrics, null, 2),
  )

  // ── 测试 4：衍生指标 → 证据链 ──────────────────────
  console.log('\n🔗 测试 4：衍生指标 → 评分证据链（derived_metric 型）')
  console.log('─'.repeat(55))

  const { derivedMetricsToEvidence } = await import(
    '../../src/services/derived-metrics/derivedMetricsEvidence.js'
  )

  const derivedEvidence = derivedMetricsToEvidence(testStock.symbol, metrics as any)
  console.log(`  生成证据数: ${derivedEvidence.length} 条`)

  const evidenceByLayer: Record<string, number> = {}
  const evidenceByType: Record<string, number> = {}
  for (const ev of derivedEvidence) {
    evidenceByLayer[ev.layerId] = (evidenceByLayer[ev.layerId] ?? 0) + 1
    evidenceByType[ev.evidenceType] = (evidenceByType[ev.evidenceType] ?? 0) + 1
  }

  console.log(`  按层分布: ${JSON.stringify(evidenceByLayer)}`)
  console.log(`  按类型分布: ${JSON.stringify(evidenceByType)}`)

  assert('证据数量 ≥ 10', derivedEvidence.length >= 10, `实际: ${derivedEvidence.length}`)
  assert('全部为 derived_metric 型', (evidenceByType['derived_metric'] ?? 0) === derivedEvidence.length, '类型不统一')
  assert('覆盖 L1 层', (evidenceByLayer['l1'] ?? 0) > 0, 'L1 层无证据')
  assert('覆盖 L3f 层', (evidenceByLayer['l3f'] ?? 0) > 0, 'L3f 层无证据')
  assert('覆盖 L3v 层', (evidenceByLayer['l3v'] ?? 0) > 0, 'L3v 层无证据')
  assert('所有权重 > 0', derivedEvidence.every((e) => e.weight > 0), '存在零权重证据')

  writeFileSync(
    join(OUTPUT_DIR, 'derived-evidence.json'),
    JSON.stringify(derivedEvidence, null, 2),
  )

  // ── 测试 5：Markdown 导出 ──────────────────────────
  console.log('\n📝 测试 5：Markdown 导出')
  console.log('─'.repeat(55))

  const {
    profileItemToMarkdown,
    evidenceLayerToMarkdown,
  } = await import('../../src/services/profile/profileExportService.js')

  // 导出样本资料条目
  const sampleItem = {
    id: 'sample_001',
    dataHash: 'sample_hash',
    collectedAt: Date.now(),
    schemaVersion: 1,
    version: 1,
    ...profileItems[0],
  }
  const itemMd = profileItemToMarkdown(sampleItem as any)
  writeFileSync(join(OUTPUT_DIR, 'sample-item.md'), itemMd)
  console.log(`  资料条目 Markdown: ${itemMd.length} 字符`)
  assert('资料条目包含 Front Matter', itemMd.startsWith('---'), '缺少 Front Matter')
  assert('资料条目包含标题', itemMd.includes('# ' + sampleItem.title), '缺少标题')

  // 导出 L3f 层证据链
  const l3fEvidence = derivedEvidence.filter((e) => e.layerId === 'l3f')
  const evidenceMd = evidenceLayerToMarkdown('L3a 财务健康', 4.2, l3fEvidence as any)
  writeFileSync(join(OUTPUT_DIR, 'sample-evidence.md'), evidenceMd)
  console.log(`  证据层 Markdown: ${evidenceMd.length} 字符`)
  assert('证据链包含得分信息', evidenceMd.includes('得分：'), '缺少得分信息')
  assert('证据链包含正向证据', evidenceMd.includes('正向证据'), '缺少正向证据部分')

  // ── 测试 6：数据完整性校验 ────────────────────────
  console.log('\n🔍 测试 6：数据完整性校验')
  console.log('─'.repeat(55))

  // 验证衍生指标的输入输出一致性
  const inputRoe = testFinancial.roe
  const outputRoe = metrics.dupont.roe
  assert('ROE 输入输出一致', Math.abs(inputRoe - outputRoe) < 0.001, `输入: ${inputRoe}, 输出: ${outputRoe}`)

  // 验证三因素分解
  const { netMargin, assetTurnover, equityMultiplier } = metrics.dupont
  const computedRoe = netMargin * assetTurnover * equityMultiplier
  assert('ROE ≈ 净利率 × 周转率 × 杠杆', Math.abs(computedRoe - outputRoe) < 0.01,
    `计算: ${computedRoe.toFixed(4)}, 实际: ${outputRoe.toFixed(4)}`)

  // 验证资料条目的原始引用
  const firstItem = profileItems[0]
  assert('保留原始来源引用', firstItem.originalStore === 'news', `实际: ${firstItem.originalStore}`)
  assert('保留原始来源 key', firstItem.originalKey === testNews[0]!.id, `实际: ${firstItem.originalKey}`)

  // ============================================================
  // 测试汇总
  // ============================================================

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  完整 E2E 测试结果：${passed}/${total} 通过`)
  console.log('═══════════════════════════════════════════════════════')

  if (passed < total) {
    console.log('\n❌ 失败用例：')
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.test}: ${r.detail}`)
    })
  } else {
    console.log('\n🎉 全部通过！')
  }

  console.log(`\n📁 测试输出目录: ${OUTPUT_DIR}`)
  console.log(`   - profile-items.json (${profileItems.length} 条资料)`)
  console.log(`   - derived-metrics.json (4大类衍生指标)`)
  console.log(`   - derived-evidence.json (${derivedEvidence.length} 条证据)`)
  console.log(`   - sample-item.md (资料 Markdown 示例)`)
  console.log(`   - sample-evidence.md (证据链 Markdown 示例)`)
  console.log()

  return passed === total
}

// 运行
runFullE2ETest()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((err) => {
    console.error('\n💥 测试异常：', err)
    process.exit(1)
  })
