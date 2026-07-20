/**
 * 八域资料体系 - 四输入源全链路端到端测试
 *
 * 测试从 4 个输入源 → 资料体系 → 证据链 → 导出 的完整链路：
 *
 * 输入源：
 * 1. 新闻资讯 (news store)        → newsSyncService
 * 2. 本地知识库 (local_docs)       → localDocSyncService
 * 3. 评分报告 (score_docs)         → scoreDocArchiveService
 * 4. 财务数据 (financial_reports)  → 衍生指标引擎 → 证据链
 *
 * 输出：
 * - 八域资料条目（按域分布统计）
 * - 评分证据链（三来源：data_field + derived_metric + profile_item）
 * - Markdown 导出
 *
 * 运行方式：npx tsx scripts/test/profile-4source-e2e.ts
 *
 * @updated 2026-07-20
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUTPUT_DIR = join(__dirname, '../../.test-output/profile-4source-e2e')

// ============================================================
// 测试数据
// ============================================================

const SYMBOL = '600519'
const STOCK_NAME = '贵州茅台'

// 测试新闻（8条，覆盖多域）
const testNews = [
  { id: 'n001', title: '贵州茅台2025年报：净利润750亿，同比增长17.2%', category: '公司公告', keywords: ['年报', '净利润', '营收'] },
  { id: 'n002', title: '白酒行业2025年景气度分析：高端稳健，次高端承压', category: '行业研究', keywords: ['白酒', '行业', '景气度'] },
  { id: 'n003', title: '美联储宣布加息25个基点，全球市场承压', category: '宏观经济', keywords: ['美联储', '加息', '利率'] },
  { id: 'n004', title: '茅台1935价格倒挂，经销商库存压力加大', category: '公司新闻', keywords: ['茅台1935', '价格倒挂', '库存'] },
  { id: 'n005', title: '贵州茅台：直销占比提升至45%，渠道结构持续优化', category: '公司新闻', keywords: ['直销', '渠道', 'i茅台'] },
  { id: 'n006', title: '白酒板块估值分析：PE 28倍，处于历史中高位', category: '估值分析', keywords: ['估值', 'PE', 'PEG'] },
  { id: 'n007', title: '贵州茅台股价创历史新高，北向资金持续加仓', category: '市场行情', keywords: ['股价', '北向资金', '创新高'] },
  { id: 'n008', title: '茅台拟投资50亿扩产，产能扩张支撑长期增长', category: '公司公告', keywords: ['扩产', '产能', '增长'] },
]

// 测试本地文档（6份，覆盖多种类型）
const testLocalDocs = [
  {
    id: 'ld001',
    name: '中信证券-贵州茅台-600519-2025年报点评：业绩超预期，目标价2000元',
    category: '研报' as const,
    content: '贵州茅台2025年业绩超预期，净利润同比增长17.2%。维持"买入"评级，目标价2000元。公司护城河深厚，品牌力持续强化，长期增长确定性强。',
    tags: ['买入评级', '目标价2000', '业绩超预期'],
    size: 15000,
  },
  {
    id: 'ld002',
    name: '贵州茅台2025年年度报告',
    category: '财报' as const,
    content: '贵州茅台酒股份有限公司2025年年度报告。营业收入1600亿元，净利润750亿元，ROE 34.1%，毛利率87.5%。',
    tags: ['年报', '2025', '财务数据'],
    size: 80000,
  },
  {
    id: 'ld003',
    name: '白酒行业深度报告：格局优化，龙头受益',
    category: '行业分析' as const,
    content: '白酒行业集中度持续提升，CR5达到65%。高端白酒竞争格局稳固，茅台五粮液泸州老窖三足鼎立。行业进入存量竞争时代，龙头企业市占率有望继续提升。',
    tags: ['行业格局', '集中度', 'CR5'],
    size: 25000,
  },
  {
    id: 'ld004',
    name: '策略笔记：白酒板块投资逻辑梳理',
    category: '策略笔记' as const,
    content: '白酒板块投资核心逻辑：品牌护城河+渠道管控力+定价权。茅台作为行业龙头，具备最强的品牌力和定价权，是板块首选标的。估值方面，当前PE 28倍，处于历史中高位，考虑到业绩确定性，估值合理。',
    tags: ['投资逻辑', '估值', '龙头'],
    size: 3000,
  },
  {
    id: 'ld005',
    name: '贵州茅台2025年一季报',
    category: '财报' as const,
    content: '贵州茅台2025年第一季度报告。一季度营业收入400亿元，同比增长18%；净利润180亿元，同比增长19%。',
    tags: ['一季报', '2025Q1'],
    size: 30000,
  },
  {
    id: 'ld006',
    name: '中金公司-贵州茅台-深度研究：护城河再审视',
    category: '研报' as const,
    content: '贵州茅台护城河分析：品牌壁垒（超强）、渠道壁垒（深）、产品壁垒（高）、文化壁垒（独特）。四大护城河共同构成公司的核心竞争优势。维持"跑赢行业"评级。',
    tags: ['护城河', '深度研究', '品牌壁垒'],
    size: 20000,
  },
]

// 测试评分报告（2个版本）
const testScoreDocs = [
  {
    docId: '600519_1_1710000000000',
    version: 1,
    scoreDate: '2025-12-31',
    composite: 78.5,
    l3v: 72,
    recommendation: { key: 'buy', label: '买入', color: 'green' },
    targetPrice: { bull: 2200, base: 1900, bear: 1600 },
    keyRisks: ['宏观经济下行', '行业政策风险', '食品安全风险'],
    keyCatalysts: ['直销占比提升', '产品结构升级', '产能扩张'],
    modelUsed: 'gpt-4o',
    market: 'A股',
    industry: '白酒',
    createdAt: '2025-12-31T00:00:00Z',
    layers: {
      l1: { score: 92, reason: '品牌护城河深厚，渠道管控力强', weight: 0.15 },
      l2: { score: 85, reason: '行业龙头，市占率持续提升', weight: 0.10 },
      l3f: { score: 95, reason: '财务质量优秀，ROE 34%，现金流充沛', weight: 0.20 },
      l3v: { score: 72, reason: 'PE 28倍，估值合理偏高', weight: 0.20 },
      l4: { score: 65, reason: '第二曲线仍在探索，系列酒增长有潜力', weight: 0.10 },
      l7: { score: 70, reason: '北向资金持续加仓，机构持仓集中', weight: 0.15 },
      l8: { score: 60, reason: '技术面偏强，但短期涨幅较大', weight: 0.10 },
    },
  },
  {
    docId: '600519_2_1715000000000',
    version: 2,
    scoreDate: '2026-05-07',
    composite: 81.2,
    l3v: 75,
    recommendation: { key: 'buy', label: '买入', color: 'green' },
    targetPrice: { bull: 2400, base: 2100, bear: 1800 },
    keyRisks: ['宏观经济下行', '消费复苏不及预期', '行业竞争加剧'],
    keyCatalysts: ['直销占比持续提升', '产品结构升级超预期', '产能释放'],
    modelUsed: 'gpt-4o',
    market: 'A股',
    industry: '白酒',
    createdAt: '2026-05-07T00:00:00Z',
    changeFromPrev: {
      compositeDelta: 2.7,
      l3vDelta: 3.0,
      layerChanges: {
        l1: 0,
        l2: 1,
        l3f: 2,
        l3v: 3,
        l4: 5,
        l7: 2,
        l8: 4,
      },
    },
    layers: {
      l1: { score: 92, reason: '品牌护城河深厚，渠道管控力强', weight: 0.15 },
      l2: { score: 86, reason: '行业龙头地位稳固，集中度继续提升', weight: 0.10 },
      l3f: { score: 97, reason: '财务质量持续优化，ROE 创新高', weight: 0.20 },
      l3v: { score: 75, reason: '业绩增长消化估值，PEG 趋于合理', weight: 0.20 },
      l4: { score: 70, reason: '系列酒增长加速，第二曲线显现', weight: 0.10 },
      l7: { score: 72, reason: '资金持续流入，筹码结构优化', weight: 0.15 },
      l8: { score: 64, reason: '技术面维持强势趋势', weight: 0.10 },
    },
  },
]

// ============================================================
// 测试运行
// ============================================================

async function run4SourceE2ETest() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  八域资料体系 - 四输入源全链路 E2E 测试')
  console.log('═══════════════════════════════════════════════════════')
  console.log()

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const results: Array<{ test: string; passed: boolean; detail: string }> = []

  function assert(test: string, condition: boolean, detail: string) {
    results.push({ test, passed: condition, detail })
    console.log(`  ${condition ? '✅' : '❌'} ${test}`)
    if (!condition) console.log(`     └─ ${detail}`)
  }

  // ============================================================
  // 测试 1：新闻 → 资料条目
  // ============================================================
  console.log('\n📰 测试 1：新闻输入源 → 资料条目')
  console.log('─'.repeat(55))

  const { classifyNewsToDomain, newsToProfileItem } = await import(
    '../../src/services/profile/newsSyncService.js'
  )

  const newsItems = testNews.map((n) => {
    const mockArticle = {
      id: n.id,
      title: n.title,
      content: n.title + ' 详细内容...',
      url: `https://example.com/news/${n.id}`,
      source: '测试来源',
      category: n.category,
      publishTime: '2026-04-10T20:00:00Z',
      fetchTime: '2026-04-10T21:00:00Z',
      sentiment: 'neutral' as const,
      sentimentConfidence: 0.7,
      relatedStocks: [SYMBOL],
      keywords: n.keywords,
      hash: `hash_${n.id}`,
    }
    return newsToProfileItem(mockArticle as any, SYMBOL)
  })

  const newsDomains = new Set(newsItems.map((i: any) => i.domain))
  console.log(`  转换 ${newsItems.length} 条新闻 → 资料条目`)
  console.log(`  覆盖域: ${Array.from(newsDomains).sort().join(', ')}`)

  assert('8条新闻全部转换成功', newsItems.length === 8, `实际: ${newsItems.length}`)
  assert('覆盖 ≥5 个域', newsDomains.size >= 5, `实际: ${newsDomains.size}`)
  assert('所有条目有标题', newsItems.every((i: any) => i.title), '存在无标题条目')
  assert('所有条目有情绪标签', newsItems.every((i: any) => i.sentiment), '存在无情绪条目')
  assert('所有条目有主题标签', newsItems.every((i: any) => i.topicTags?.length > 0), '存在无标签条目')

  // ============================================================
  // 测试 2：本地知识库 → 资料条目
  // ============================================================
  console.log('\n📚 测试 2：本地知识库输入源 → 资料条目')
  console.log('─'.repeat(55))

  const { localDocToProfileItem } = await import(
    '../../src/services/profile/localDocSyncService.js'
  )

  const localDocItems = testLocalDocs.map((doc) => {
    const mockDoc = {
      ...doc,
      symbol: SYMBOL,
      content: doc.content,
      sourcePath: `/docs/${doc.id}.md`,
      addedAt: Date.now(),
      embedding: undefined,
      source: '用户导入',
      authorizationStatus: 'authorized' as const,
    }
    return localDocToProfileItem(mockDoc as any)
  })

  const docDomains = new Set(localDocItems.map((i: any) => i.domain))
  const docTypes = new Set(localDocItems.map((i: any) => i.itemType))
  console.log(`  转换 ${localDocItems.length} 份文档 → 资料条目`)
  console.log(`  覆盖域: ${Array.from(docDomains).sort().join(', ')}`)
  console.log(`  类型: ${Array.from(docTypes).join(', ')}`)

  assert('6份文档全部转换成功', localDocItems.length === 6, `实际: ${localDocItems.length}`)
  assert('覆盖 ≥3 个域', docDomains.size >= 3, `实际: ${docDomains.size}`)
  assert('包含研报类型', docTypes.has('research_report'), '缺少 research_report 类型')
  assert('包含财报类型', docTypes.has('financial_report'), '缺少 financial_report 类型')
  assert('包含行业报告类型', docTypes.has('industry_report'), '缺少 industry_report 类型')
  assert('研报质量分 ≥ 70', (localDocItems[0] as any).qualityScore >= 70, `实际: ${(localDocItems[0] as any).qualityScore}`)
  assert('财报质量分最高', (localDocItems[1] as any).qualityScore >= 80, `实际: ${(localDocItems[1] as any).qualityScore}`)

  // ============================================================
  // 测试 3：评分报告 → 资料归档
  // ============================================================
  console.log('\n📊 测试 3：评分报告输入源 → 资料归档')
  console.log('─'.repeat(55))

  const { scoreDocToProfileItems } = await import(
    '../../src/services/profile/scoreDocArchiveService.js'
  )

  const allScoreItems: any[] = []
  for (const doc of testScoreDocs) {
    const mockDoc = {
      symbol: SYMBOL,
      stockName: STOCK_NAME,
      ...doc,
    }
    const items = scoreDocToProfileItems(mockDoc as any)
    allScoreItems.push(...items)
  }

  const scoreDomains = new Set(allScoreItems.map((i) => i.domain))
  const scoreTypes = new Set(allScoreItems.map((i) => i.itemType))
  console.log(`  2 份评分报告 → ${allScoreItems.length} 条资料条目`)
  console.log(`  覆盖域: ${Array.from(scoreDomains).sort().join(', ')}`)
  console.log(`  类型: ${Array.from(scoreTypes).join(', ')}`)

  assert('每份报告产出 ≥ 8条资料', allScoreItems.length >= 16, `实际: ${allScoreItems.length}`)
  assert('包含综合报告类型', scoreTypes.has('score_report'), '缺少 score_report')
  assert('包含层级评分类型', scoreTypes.has('score_layer'), '缺少 score_layer')
  assert('包含版本对比类型', scoreTypes.has('score_diff'), '缺少 score_diff')
  assert('覆盖 ≥4 个域', scoreDomains.size >= 4, `实际: ${scoreDomains.size}`)
  assert('评分报告质量分 ≥ 90', allScoreItems.find((i) => i.itemType === 'score_report')?.qualityScore >= 90, '质量分不足')

  // ============================================================
  // 测试 4：四源汇总 - 八域分布
  // ============================================================
  console.log('\n🗂️  测试 4：四源汇总 - 八域分布统计')
  console.log('─'.repeat(55))

  const allItems = [...newsItems, ...localDocItems, ...allScoreItems]
  const domainCounts: Record<string, number> = {}
  for (const item of allItems as any[]) {
    domainCounts[item.domain] = (domainCounts[item.domain] ?? 0) + 1
  }

  const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])
  console.log(`  总资料条目: ${allItems.length} 条`)
  console.log(`  八域分布:`)
  for (const [domain, count] of sortedDomains) {
    const bar = '█'.repeat(Math.round(count / 2))
    console.log(`    ${domain}: ${bar} ${count}`)
  }

  assert('总条目 ≥ 25', allItems.length >= 25, `实际: ${allItems.length}`)
  assert('覆盖 ≥6 个域', Object.keys(domainCounts).length >= 6, `实际: ${Object.keys(domainCounts).length}`)
  assert('D5 财务分析资料最多', sortedDomains[0]?.[0] === 'D5', `实际最多: ${sortedDomains[0]?.[0]}`)

  // ============================================================
  // 测试 5：衍生指标 → 证据链
  // ============================================================
  console.log('\n🔗 测试 5：财务数据 → 衍生指标 → 证据链')
  console.log('─'.repeat(55))

  const { calculateAllDerivedMetrics } = await import(
    '../../src/services/derived-metrics/derivedMetricsEngine.js'
  )
  const { derivedMetricsToEvidence } = await import(
    '../../src/services/derived-metrics/derivedMetricsEvidence.js'
  )

  const mockFin = {
    symbol: SYMBOL,
    reportDate: '2025-12-31',
    reportType: 'annual',
    revenue: 1600e8,
    revenueYoY: 0.165,
    grossProfit: 1400e8,
    grossMargin: 0.875,
    netProfit: 750e8,
    netProfitYoY: 0.172,
    netMargin: 0.469,
    totalAssets: 2800e8,
    totalLiabilities: 600e8,
    netAssets: 2200e8,
    inventoryTurnoverDays: 1200,
    inventory: 300e8,
    receivables: 50e8,
    assetTurnover: 0.571,
    roe: 0.341,
    debtToAssetRatio: 0.214,
    currentRatio: 4.5,
    quickRatio: 3.75,
    interestBearingDebt: 0,
    operatingCF: 850e8,
    eps: 59.8,
    bps: 175.3,
    updatedAt: Date.now(),
  }

  const mockStock = {
    pe: 28.5,
    pb: 8.2,
    industryCode: '白酒',
  }

  const metrics = calculateAllDerivedMetrics(SYMBOL, mockFin as any, mockStock)
  const derivedEvidence = derivedMetricsToEvidence(SYMBOL, metrics as any)

  console.log(`  衍生指标: 杜邦/估值/成长/风险 4大类`)
  console.log(`  证据条目: ${derivedEvidence.length} 条`)
  console.log(`  ROE: ${(metrics.dupont.roe * 100).toFixed(1)}%`)
  console.log(`  PEG: ${metrics.valuation.peg.toFixed(2)}`)
  console.log(`  风险等级: ${metrics.risk.warningLevel}`)

  assert('衍生指标 ROE > 0', metrics.dupont.roe > 0, `实际: ${metrics.dupont.roe}`)
  assert('衍生指标 PEG > 0', metrics.valuation.peg > 0, `实际: ${metrics.valuation.peg}`)
  assert('衍生指标证据 ≥ 10 条', derivedEvidence.length >= 10, `实际: ${derivedEvidence.length}`)
  assert('覆盖 L1 层证据', derivedEvidence.some((e: any) => e.layerId === 'l1'), '缺少 L1 证据')
  assert('覆盖 L3f 层证据', derivedEvidence.some((e: any) => e.layerId === 'l3f'), '缺少 L3f 证据')
  assert('覆盖 L3v 层证据', derivedEvidence.some((e: any) => e.layerId === 'l3v'), '缺少 L3v 证据')

  // ============================================================
  // 测试 6：三来源证据链汇总
  // ============================================================
  console.log('\n🧩 测试 6：三来源证据链汇总（模拟 scoreEvidenceAdapter）')
  console.log('─'.repeat(55))

  // 模拟：从资料条目中提取 profile_item 型证据
  const profileItemEvidence = allItems
    .filter((i: any) => i.evidenceWeight && i.relatedLayers?.length > 0)
    .slice(0, 10)
    .map((item: any) => ({
      symbol: SYMBOL,
      layerId: item.relatedLayers[0],
      evidenceType: 'profile_item' as const,
      evidenceKey: item.title,
      evidenceValue: item.summary?.slice(0, 50) || '',
      weight: item.evidenceWeight || 0.5,
      direction: item.sentiment === 'positive' ? 'positive' : item.sentiment === 'negative' ? 'negative' : 'neutral',
      sourceType: item.itemType,
      sourceId: item.originalKey || item.title,
    }))

  // 模拟 data_field 型证据（从评分层提取）
  const dataFieldEvidence = Object.entries(testScoreDocs[1]!.layers).map(([layerId, layer]) => ({
    symbol: SYMBOL,
    layerId,
    evidenceType: 'data_field' as const,
    evidenceKey: `${layerId}_score`,
    evidenceValue: String((layer as any).score),
    weight: (layer as any).weight || 0.1,
    direction: (layer as any).score >= 60 ? 'positive' : 'negative',
    sourceType: 'v6_engine',
    sourceId: 'v6_scoring',
  }))

  const allEvidence = [...dataFieldEvidence, ...derivedEvidence, ...profileItemEvidence]
  const evidenceByType: Record<string, number> = {}
  const evidenceByLayer: Record<string, number> = {}
  for (const ev of allEvidence) {
    evidenceByType[ev.evidenceType] = (evidenceByType[ev.evidenceType] ?? 0) + 1
    evidenceByLayer[ev.layerId] = (evidenceByLayer[ev.layerId] ?? 0) + 1
  }

  console.log(`  证据总数: ${allEvidence.length} 条`)
  console.log(`  按类型分布: ${JSON.stringify(evidenceByType)}`)
  console.log(`  按层分布: ${JSON.stringify(evidenceByLayer)}`)

  assert('三来源证据齐全', Object.keys(evidenceByType).length === 3, `实际: ${Object.keys(evidenceByType).length} 种`)
  assert('data_field 型证据存在', (evidenceByType['data_field'] ?? 0) > 0, '缺少 data_field')
  assert('derived_metric 型证据存在', (evidenceByType['derived_metric'] ?? 0) > 0, '缺少 derived_metric')
  assert('profile_item 型证据存在', (evidenceByType['profile_item'] ?? 0) > 0, '缺少 profile_item')
  assert('覆盖 ≥5 个评分层', Object.keys(evidenceByLayer).length >= 5, `实际: ${Object.keys(evidenceByLayer).length}`)

  // ============================================================
  // 测试 7：Markdown 导出验证
  // ============================================================
  console.log('\n📝 测试 7：Markdown 导出验证')
  console.log('─'.repeat(55))

  const { profileItemToMarkdown, evidenceLayerToMarkdown } = await import(
    '../../src/services/profile/profileExportService.js'
  )

  // 导出样本：综合评分报告（补全必需字段）
  const compositeItem = allScoreItems.find((i) => i.itemType === 'score_report')!
  const compositeFull = { ...compositeItem, id: 'test_001', collectedAt: Date.now(), dataHash: 'hash', schemaVersion: 1, version: 1 }
  const compositeMd = profileItemToMarkdown(compositeFull as any)
  writeFileSync(join(OUTPUT_DIR, 'sample-score-report.md'), compositeMd)

  // 导出样本：研报（补全必需字段）
  const researchItem = localDocItems.find((i: any) => i.itemType === 'research_report')!
  const researchFull = { ...researchItem, id: 'test_002', collectedAt: Date.now(), dataHash: 'hash', schemaVersion: 1, version: 1 }
  const researchMd = profileItemToMarkdown(researchFull as any)
  writeFileSync(join(OUTPUT_DIR, 'sample-research-report.md'), researchMd)

  // 导出 L3f 层证据链（derivedEvidence 本身就是 ScoreEvidence 类型）
  const l3fEvidenceList = derivedEvidence.filter((e: any) => e.layerId === 'l3f')
  const l3fMd = evidenceLayerToMarkdown('L3a 财务健康', 95, l3fEvidenceList as any[])
  writeFileSync(join(OUTPUT_DIR, 'sample-l3f-evidence.md'), l3fMd)

  console.log(`  评分报告 Markdown: ${compositeMd.length} 字符`)
  console.log(`  研报 Markdown: ${researchMd.length} 字符`)
  console.log(`  L3f 证据链: ${l3fMd.length} 字符`)

  assert('评分报告导出正常', compositeMd.length > 100, `实际: ${compositeMd.length}`)
  assert('研报导出正常', researchMd.length > 100, `实际: ${researchMd.length}`)
  assert('证据链导出正常', l3fMd.length > 100, `实际: ${l3fMd.length}`)
  assert('都包含 Front Matter', compositeMd.startsWith('---') && researchMd.startsWith('---'), '缺少 Front Matter')

  // ============================================================
  // 测试汇总
  // ============================================================

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  四输入源全链路 E2E 测试结果：${passed}/${total} 通过`)
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
  console.log(`   - sample-score-report.md (评分报告导出)`)
  console.log(`   - sample-research-report.md (研报导出)`)
  console.log(`   - sample-l3f-evidence.md (L3f证据链导出)`)
  console.log()

  // 保存汇总数据
  writeFileSync(
    join(OUTPUT_DIR, 'all-items-summary.json'),
    JSON.stringify({
      totalItems: allItems.length,
      domainCounts,
      evidenceByType,
      evidenceByLayer,
      sampleItems: {
        news: (newsItems[0] as any).title,
        research: (localDocItems[0] as any).title,
        scoreReport: compositeItem.title,
      },
    }, null, 2),
  )

  return passed === total
}

// 运行
run4SourceE2ETest()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((err) => {
    console.error('\n💥 测试异常：', err)
    process.exit(1)
  })
