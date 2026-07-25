/**
 * @fileoverview Profile Store 测试数据夹具
 * @description 提供 profileStore minQuality 筛选逻辑的边界测试数据，便于其他测试用例复用
 *
 * 测试场景覆盖：
 * 1. 超大分值 (200+) 筛选与排序
 * 2. 边界等值 (qualityScore === minQuality)
 * 3. 负分 minQuality 阈值
 * 4. evidenceWeight 默认值处理
 * 5. 混合筛选条件组合
 * 6. 多次 setFilter 累积效果
 *
 * 使用示例：
 * ```typescript
 * import { superHighScoreFilterScenario, toProfileItem } from '../fixtures'
 *
 * it('应正确筛选超大分值', () => {
 *   const items = superHighScoreFilterScenario.items.map(toProfileItem)
 *   // ...
 * })
 * ```
 *
 * @test_id V9-TEST-ST-211-DATA
 * @owner profileStore
 */

import type { ProfileItem, ProfileDomain } from '@/data/types/types.profile'

export interface MinQualityTestItem {
  id: string
  qualityScore: number | null | undefined
  evidenceWeight: number | null | undefined
  itemType?: string
  sentiment?: string
  title?: string
  summary?: string
  topicTags?: string[]
}

export interface MinQualityTestScenario {
  /** 测试场景描述 */
  description: string
  /** 筛选条件 */
  filter: {
    itemType?: string
    sentiment?: string
    minQuality?: number
    keyword?: string
    source?: string
  }
  /** 输入数据 */
  items: MinQualityTestItem[]
  /** 预期保留的条目 ID */
  expectedIds: string[]
  /** 预期排序（若指定则验证排序结果） */
  expectedOrder?: string[]
}

export interface AccumulativeFilterStep {
  step: number
  filterUpdate: Record<string, unknown>
  expectedMinQuality?: number
  expectedItemType?: string
  expectedSentiment?: string
}

// ============================================================
// 数据工厂
// ============================================================

let idCounter = 0

function createItem(overrides: Partial<MinQualityTestItem> = {}): MinQualityTestItem {
  idCounter++
  return {
    id: `test-item-${idCounter}`,
    qualityScore: 80,
    evidenceWeight: 0.6,
    itemType: 'news',
    sentiment: 'positive',
    title: '测试资料标题',
    summary: '测试资料摘要内容',
    topicTags: ['AI', '科技'],
    ...overrides,
  }
}

// ============================================================
// 场景 1: 超大分值筛选与排序
// ============================================================

export const superHighScoreFilterScenario: MinQualityTestScenario = {
  description: '超大分值 qualityScore=200 能正确参与筛选',
  filter: { minQuality: 150 },
  items: [
    createItem({ id: 'super-high', qualityScore: 200, evidenceWeight: 0.5 }),
    createItem({ id: 'normal', qualityScore: 80, evidenceWeight: 0.9 }),
    createItem({ id: 'low', qualityScore: 30, evidenceWeight: 0.5 }),
  ],
  expectedIds: ['super-high'],
}

export const superHighScoreSortScenario: MinQualityTestScenario = {
  description: '超大分值在排序中优先于普通分值',
  filter: { minQuality: undefined },
  items: [
    createItem({ id: 'normal-high', qualityScore: 90, evidenceWeight: 0.9 }),
    createItem({ id: 'super-high', qualityScore: 200, evidenceWeight: 0.5 }),
  ],
  expectedIds: ['normal-high', 'super-high'],
  expectedOrder: ['super-high', 'normal-high'],
}

// ============================================================
// 场景 2: 边界等值测试
// ============================================================

export const exactMatchScenario: MinQualityTestScenario = {
  description: 'qualityScore 等于 minQuality 时被保留（>= 语义）',
  filter: { minQuality: 60 },
  items: [
    createItem({ id: 'exact-match', qualityScore: 60, evidenceWeight: 0.8 }),
    createItem({ id: 'above', qualityScore: 61, evidenceWeight: 0.8 }),
    createItem({ id: 'below', qualityScore: 59, evidenceWeight: 0.8 }),
  ],
  expectedIds: ['exact-match', 'above'],
}

// ============================================================
// 场景 3: 负分 minQuality 阈值
// ============================================================

export const negativeMinQualityScenario: MinQualityTestScenario = {
  description: 'minQuality 为负数时，所有>=该值的条目都被保留',
  filter: { minQuality: -50 },
  items: [
    createItem({ id: 'high', qualityScore: 90, evidenceWeight: 0.9 }),
    createItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.5 }),
    createItem({ id: 'neg-50', qualityScore: -50, evidenceWeight: 0.3 }),
    createItem({ id: 'neg-100', qualityScore: -100, evidenceWeight: 0.2 }),
  ],
  expectedIds: ['high', 'zero', 'neg-50'],
}

// ============================================================
// 场景 4: evidenceWeight 默认值处理
// ============================================================

export const nullEvidenceWeightSortScenario: MinQualityTestScenario = {
  description: 'evidenceWeight 为 null/undefined 时使用默认值 0.5 参与排序',
  filter: { minQuality: undefined },
  items: [
    createItem({ id: 'null-weight', qualityScore: 80, evidenceWeight: null as unknown as undefined }),
    createItem({ id: 'undefined-weight', qualityScore: 80, evidenceWeight: undefined }),
    createItem({ id: 'normal', qualityScore: 80, evidenceWeight: 1.0 }),
  ],
  expectedIds: ['null-weight', 'undefined-weight', 'normal'],
  expectedOrder: ['normal', 'null-weight', 'undefined-weight'],
}

// ============================================================
// 场景 5: 混合筛选条件组合
// ============================================================

export const itemTypeAndMinQualityScenario: MinQualityTestScenario = {
  description: '混合筛选条件: itemType + minQuality 同时生效',
  filter: { itemType: 'news', minQuality: 60 },
  items: [
    createItem({ id: 'news-high', itemType: 'news', qualityScore: 90, evidenceWeight: 0.9 }),
    createItem({ id: 'news-low', itemType: 'news', qualityScore: 30, evidenceWeight: 0.5 }),
    createItem({ id: 'research-high', itemType: 'research_report', qualityScore: 90, evidenceWeight: 0.9 }),
    createItem({ id: 'research-low', itemType: 'research_report', qualityScore: 30, evidenceWeight: 0.5 }),
  ],
  expectedIds: ['news-high'],
}

export const sentimentMinQualityKeywordScenario: MinQualityTestScenario = {
  description: '混合筛选条件: sentiment + minQuality + keyword 同时生效',
  filter: { sentiment: 'positive', minQuality: 50, keyword: 'AI' },
  items: [
    createItem({ id: 'pos-ai', sentiment: 'positive', qualityScore: 90, title: 'AI 突破', summary: 'AI 技术突破', topicTags: ['AI', '科技'], evidenceWeight: 0.9 }),
    createItem({ id: 'neg-ai', sentiment: 'negative', qualityScore: 90, title: 'AI 危机', summary: 'AI 风险', topicTags: ['AI'], evidenceWeight: 0.9 }),
    createItem({ id: 'pos-other', sentiment: 'positive', qualityScore: 90, title: '市场分析', summary: '市场走势', topicTags: ['财经'], evidenceWeight: 0.9 }),
  ],
  expectedIds: ['pos-ai'],
}

// ============================================================
// 场景 6: 多次 setFilter 累积效果
// ============================================================

export const accumulativeFilterSteps: AccumulativeFilterStep[] = [
  {
    step: 1,
    filterUpdate: { minQuality: 50 },
    expectedMinQuality: 50,
    expectedItemType: undefined,
  },
  {
    step: 2,
    filterUpdate: { itemType: 'news' },
    expectedMinQuality: 50,
    expectedItemType: 'news',
  },
  {
    step: 3,
    filterUpdate: { sentiment: 'positive' },
    expectedMinQuality: 50,
    expectedItemType: 'news',
    expectedSentiment: 'positive',
  },
]

// ============================================================
// 场景汇总
// ============================================================

export const ALL_MIN_QUALITY_SCENARIOS: MinQualityTestScenario[] = [
  superHighScoreFilterScenario,
  superHighScoreSortScenario,
  exactMatchScenario,
  negativeMinQualityScenario,
  nullEvidenceWeightSortScenario,
  itemTypeAndMinQualityScenario,
  sentimentMinQualityKeywordScenario,
]

// ============================================================
// 数据转换工具（辅助函数）
// ============================================================

export function toProfileItem(testItem: MinQualityTestItem): ProfileItem {
  return {
    id: testItem.id,
    symbol: 'AAPL',
    domain: 'D1' as ProfileDomain,
    itemType: (testItem.itemType as ProfileItem['itemType']) ?? 'news',
    title: testItem.title ?? '测试资料标题',
    summary: testItem.summary ?? '测试资料摘要内容',
    source: '东方财富',
    publishedAt: Date.now(),
    collectedAt: Date.now(),
    sentiment: (testItem.sentiment as ProfileItem['sentiment']) ?? 'positive',
    qualityScore: testItem.qualityScore as ProfileItem['qualityScore'],
    evidenceWeight: testItem.evidenceWeight as ProfileItem['evidenceWeight'],
    relatedLayers: ['l1'],
    topicTags: testItem.topicTags ?? ['AI', '科技'],
    dataHash: 123456,
  }
}
