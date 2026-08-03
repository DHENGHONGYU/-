/**
 * @test_id V9-TEST-UT-094
 * profileService 单元测试
 *
 * 覆盖场景：
 * 1. 工具函数：domainToLayers / layerToDomain / inferSentiment
 * 2. CRUD 操作：saveProfileItem / bulkSaveProfileItems / getProfileItem / listByDomain / listByType
 * 3. 资料包操作：getOrCreateProfile
 *
 * @covers_docs [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ProfileItem, ProfileDomain, StockProfile } from '@/data/types'
import {
  domainToLayers,
  layerToDomain,
  saveProfileItem,
  bulkSaveProfileItems,
  getProfileItem,
  listProfileItemsByDomain,
  listProfileItemsByType,
  getOrCreateProfile,
  inferSentiment,
} from '@/services/profile/profileService'

// ============================================================
// Mock 设置
// ============================================================

// Mock dataLayerHelpers（profileService 实际调用的模块）
const mockQueryGet = vi.fn().mockResolvedValue(undefined)
const mockQueryByIndex = vi.fn().mockResolvedValue([])
const mockSendWriteEnvelope = vi.fn().mockResolvedValue(undefined)
vi.mock('@/data/dataLayerHelpers', () => ({
  sendWriteEnvelope: (...args: unknown[]) => mockSendWriteEnvelope(...args),
  queryGet: (...args: unknown[]) => mockQueryGet(...args),
  queryByIndex: (...args: unknown[]) => mockQueryByIndex(...args),
  queryList: (...args: unknown[]) => vi.fn().mockResolvedValue([])(...args),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ success: false, data: null }),
    subscribe: vi.fn(() => () => {}),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, payload: unknown) => ({ meta, payload })),
  },
}))

// Mock tagService 以隔离 autoTagItem 的 fire-and-forget 副作用
// （incrementTagUsage 会异步调用 sendWriteEnvelope/queryByIndex，干扰调用计数断言）
vi.mock('@/services/profile/tagService', () => ({
  autoTagItem: vi.fn((item: ProfileItem) => Promise.resolve(item)),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// 1. 工具函数测试（纯函数，无需 mock）
// ============================================================

describe('domainToLayers - 域 → 评分层映射', () => {
  it('D1 应映射到 lMinus1 和 l0（行业产业 → 行业评分 + 宏观环境）', () => {
    expect(domainToLayers('D1')).toEqual(['lMinus1', 'l0'])
  })

  it('D2 应映射到 l0', () => {
    expect(domainToLayers('D2')).toEqual(['l0'])
  })

  it('D3 应映射到 l1', () => {
    expect(domainToLayers('D3')).toEqual(['l1'])
  })

  it('D4 应映射到 l2', () => {
    expect(domainToLayers('D4')).toEqual(['l2'])
  })

  it('D5 应映射到 l3f', () => {
    expect(domainToLayers('D5')).toEqual(['l3f'])
  })

  it('D6 应映射到 l3v', () => {
    expect(domainToLayers('D6')).toEqual(['l3v'])
  })

  it('D7 应映射到 l4/l5/l6', () => {
    expect(domainToLayers('D7')).toEqual(['l4', 'l5', 'l6'])
  })

  it('D8 应映射到 l7/l8', () => {
    expect(domainToLayers('D8')).toEqual(['l7', 'l8'])
  })

  it('所有 8 个域都有对应的评分层', () => {
    const domains: ProfileDomain[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']
    for (const d of domains) {
      const layers = domainToLayers(d)
      expect(layers.length).toBeGreaterThan(0)
    }
  })
})

describe('layerToDomain - 评分层 → 域映射', () => {
  it('lMinus1 应映射到 D1', () => {
    expect(layerToDomain('lMinus1')).toBe('D1')
  })

  it('l0 应映射到 D2', () => {
    expect(layerToDomain('l0')).toBe('D2')
  })

  it('l1 应映射到 D3', () => {
    expect(layerToDomain('l1')).toBe('D3')
  })

  it('l2 应映射到 D4', () => {
    expect(layerToDomain('l2')).toBe('D4')
  })

  it('l3f 应映射到 D5', () => {
    expect(layerToDomain('l3f')).toBe('D5')
  })

  it('l3v 应映射到 D6', () => {
    expect(layerToDomain('l3v')).toBe('D6')
  })

  it('l4/l5/l6 应都映射到 D7', () => {
    expect(layerToDomain('l4')).toBe('D7')
    expect(layerToDomain('l5')).toBe('D7')
    expect(layerToDomain('l6')).toBe('D7')
  })

  it('l7/l8 应都映射到 D8', () => {
    expect(layerToDomain('l7')).toBe('D8')
    expect(layerToDomain('l8')).toBe('D8')
  })

  it('domainToLayers 和 layerToDomain 应互为逆映射（单一层）', () => {
    // 对于只有一个层的域，两次映射应返回原值
    // 注意：D1 映射到 ['lMinus1', 'l0'] 两个层，不再属于单一层域
    const singleLayerDomains: ProfileDomain[] = ['D2', 'D3', 'D4', 'D5', 'D6']
    for (const d of singleLayerDomains) {
      const layers = domainToLayers(d)
      expect(layers.length).toBe(1)
      expect(layerToDomain(layers[0]!)).toBe(d)
    }
  })
})

describe('inferSentiment - 情绪推断', () => {
  it('正面文本应推断为 positive', () => {
    const result = inferSentiment('公司业绩大增，市场看好')
    expect(result.sentiment).toBe('positive')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('负面文本应推断为 negative', () => {
    const result = inferSentiment('公司亏损扩大，业绩下滑')
    expect(result.sentiment).toBe('negative')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('中性文本应推断为 neutral', () => {
    const result = inferSentiment('今天天气不错')
    expect(result.sentiment).toBe('neutral')
  })
})

// ============================================================
// 2. CRUD 操作测试（mock dataLayerHelpers）
// ============================================================

describe('saveProfileItem - 保存单条资料条目', () => {
  it('应补全缺失字段并调用 sendWriteEnvelope', async () => {
    const item = {
      symbol: '600519',
      domain: 'D3' as ProfileDomain,
      itemType: 'news' as const,
      title: '测试标题',
      summary: '测试摘要',
      source: '测试来源',
      publishedAt: Date.now(),
      isUserGenerated: false,
    }

    const result = await saveProfileItem(item)

    // 验证补全字段
    expect(result.id).toBeDefined()
    // ID 格式: ${symbol}_${domain}_${itemType}_${dataHash}
    expect(result.id).toMatch(/^600519_D3_news_\d+$/)
    expect(result.dataHash).toBeDefined()
    expect(typeof result.dataHash).toBe('number')
    expect(result.collectedAt).toBeDefined()
    expect(result.schemaVersion).toBe(1)
    expect(result.version).toBe(1)

    // 验证原始字段保留
    expect(result.symbol).toBe('600519')
    expect(result.title).toBe('测试标题')

    // 验证 sendWriteEnvelope 被调用（profileService 使用 dataLayerHelpers）
    expect(mockSendWriteEnvelope).toHaveBeenCalledTimes(1)
  })
})

describe('bulkSaveProfileItems - 批量保存资料条目', () => {
  it('应批量补全字段并调用 sendWriteEnvelope 保存', async () => {
    const items = [
      {
        symbol: '600519',
        domain: 'D3' as ProfileDomain,
        itemType: 'news' as const,
        title: '条目1',
        summary: '摘要1',
        source: '来源1',
        publishedAt: Date.now(),
        isUserGenerated: false,
      },
      {
        symbol: '600519',
        domain: 'D7' as ProfileDomain,
        itemType: 'analysis_note' as const,
        title: '条目2',
        summary: '摘要2',
        source: '来源2',
        publishedAt: Date.now(),
        isUserGenerated: false,
      },
    ]

    const result = await bulkSaveProfileItems(items)

    // bulkSaveProfileItems 返回 SyncResult，不是数组
    expect(result.saved).toBe(2)
    expect(result.failed).toBe(0)

    // 验证 sendWriteEnvelope 被调用以保存批量条目
    // 注意：updateProfileStats 是 fire-and-forget，可能额外调用 saveStockProfile
    const bulkCall = mockSendWriteEnvelope.mock.calls.find(
      (call) => call[0] === 'bulkSaveProfileItems',
    )
    expect(bulkCall, '应调用 sendWriteEnvelope 保存批量条目').toBeDefined()
    expect((bulkCall![1] as ProfileItem[]).length).toBe(2)
    // 验证每条都补全了 id 和 dataHash
    const savedItems = bulkCall![1] as ProfileItem[]
    expect(savedItems[0]!.id).toBeDefined()
    expect(savedItems[1]!.id).toBeDefined()
    expect(savedItems[0]!.dataHash).toBeDefined()
    expect(savedItems[1]!.dataHash).toBeDefined()
  })

  it('空数组应返回空 SyncResult 且不调用 sendWriteEnvelope', async () => {
    const result = await bulkSaveProfileItems([])
    expect(result.saved).toBe(0)
    expect(mockSendWriteEnvelope).not.toHaveBeenCalled()
  })
})

describe('getProfileItem - 获取单条资料', () => {
  it('存在时应返回资料条目', async () => {
    const mockItem: ProfileItem = {
      id: 'item-001',
      symbol: '600519',
      domain: 'D3',
      itemType: 'news',
      title: '测试',
      summary: '摘要',
      source: '测试',
      publishedAt: Date.now(),
      collectedAt: Date.now(),
      isUserGenerated: false,
      dataHash: 123456,
      schemaVersion: 1,
      version: 1,
    }

    mockQueryGet.mockResolvedValueOnce(mockItem)

    const result = await getProfileItem('item-001')
    expect(result).toEqual(mockItem)
    expect(mockQueryGet).toHaveBeenCalledTimes(1)
  })

  it('不存在时应返回 undefined', async () => {
    mockQueryGet.mockResolvedValueOnce(undefined)

    const result = await getProfileItem('nonexistent')
    expect(result).toBeUndefined()
  })
})

describe('listProfileItemsByDomain - 按域查询资料', () => {
  it('应返回指定域的资料条目列表', async () => {
    const mockItems: ProfileItem[] = [
      {
        id: 'item-001',
        symbol: '600519',
        domain: 'D3',
        itemType: 'news',
        title: '条目1',
        summary: '摘要1',
        source: '来源1',
        publishedAt: Date.now(),
        collectedAt: Date.now(),
        isUserGenerated: false,
        dataHash: 111111,
        schemaVersion: 1,
        version: 1,
      },
      {
        id: 'item-002',
        symbol: '600519',
        domain: 'D3',
        itemType: 'research_report',
        title: '条目2',
        summary: '摘要2',
        source: '来源2',
        publishedAt: Date.now() - 1000,
        collectedAt: Date.now(),
        isUserGenerated: false,
        dataHash: 222222,
        schemaVersion: 1,
        version: 1,
      },
    ]

    mockQueryByIndex.mockResolvedValueOnce(mockItems)

    const result = await listProfileItemsByDomain('600519', 'D3')
    expect(result.length).toBe(2)
    expect(result[0]!.domain).toBe('D3')
    expect(result[1]!.domain).toBe('D3')
  })

  it('应遵守 limit 限制', async () => {
    const mockItems: ProfileItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i}`,
      symbol: '600519',
      domain: 'D3' as const,
      itemType: 'news' as const,
      title: `条目${i}`,
      summary: `摘要${i}`,
      source: '来源',
      publishedAt: Date.now() - i * 1000,
      collectedAt: Date.now(),
      isUserGenerated: false,
      dataHash: i,
      schemaVersion: 1,
      version: 1,
    }))

    mockQueryByIndex.mockResolvedValueOnce(mockItems)

    // listProfileItemsByDomain 第三参数为 limit?: number（非 options 对象）
    const result = await listProfileItemsByDomain('600519', 'D3', 10)
    expect(result.length).toBe(10)
  })

  it('查询失败时应返回空数组', async () => {
    mockQueryByIndex.mockResolvedValueOnce([])

    const result = await listProfileItemsByDomain('600519', 'D3')
    expect(result).toEqual([])
  })
})

describe('listProfileItemsByType - 按类型查询资料', () => {
  it('应返回指定类型的资料条目列表', async () => {
    const mockItems: ProfileItem[] = [
      {
        id: 'item-001',
        symbol: '600519',
        domain: 'D3',
        itemType: 'research_report',
        title: '研报1',
        summary: '摘要1',
        source: '券商A',
        publishedAt: Date.now(),
        collectedAt: Date.now(),
        isUserGenerated: false,
        dataHash: 333333,
        schemaVersion: 1,
        version: 1,
      },
    ]

    mockQueryByIndex.mockResolvedValueOnce(mockItems)

    const result = await listProfileItemsByType('600519', 'research_report')
    expect(result.length).toBe(1)
    expect(result[0]!.itemType).toBe('research_report')
  })
})

// ============================================================
// 3. 资料包操作测试
// ============================================================

describe('getOrCreateProfile - 获取或创建资料包', () => {
  it('已存在时应返回现有资料包', async () => {
    const mockProfile: StockProfile = {
      symbol: '600519',
      stockName: '贵州茅台',
      totalItems: 11,
      domainCounts: {
        D1: 0, D2: 0, D3: 5, D4: 0,
        D5: 2, D6: 1, D7: 3, D8: 0,
      },
      typeCounts: { news: 5, research_report: 2, analysis_note: 1 },
      totalEvidence: 0,
      layerEvidenceCounts: {
        lMinus1: 0, l0: 0, l1: 0, l2: 0, l3f: 0, l3v: 0,
        l4: 0, l5: 0, l6: 0, l7: 0, l8: 0,
      },
      evidenceCoverage: 0,
      lastUpdatedAt: Date.now() - 3600000,
      lastSyncSources: [],
    }

    mockQueryGet.mockResolvedValueOnce(mockProfile)

    const result = await getOrCreateProfile('600519', '贵州茅台')
    expect(result.symbol).toBe('600519')
    expect(result.stockName).toBe('贵州茅台')
    expect(result.totalItems).toBe(11)
    // 存在时不调用 sendWriteEnvelope（不保存）
    expect(mockSendWriteEnvelope).not.toHaveBeenCalled()
  })

  it('不存在时应创建空壳资料包', async () => {
    // getStockProfile → queryGet 返回 undefined（不存在）
    mockQueryGet.mockResolvedValueOnce(undefined)

    const result = await getOrCreateProfile('000001', '平安银行')

    expect(result.symbol).toBe('000001')
    expect(result.stockName).toBe('平安银行')
    expect(result.totalItems).toBe(0)
    expect(result.evidenceCoverage).toBe(0)
    expect(Object.keys(result.domainCounts).length).toBe(8)

    // 验证调用了 save（sendWriteEnvelope 被调用）
    expect(mockSendWriteEnvelope).toHaveBeenCalledTimes(1)
  })
})
