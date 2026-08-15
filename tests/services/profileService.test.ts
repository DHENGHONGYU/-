/**
 * @test_id V9-TEST-UT-094
 * profileService 单元测试
 *
 * 覆盖场景：
 * 1. 工具函数：domainToLayers / layerToDomain
 * 2. CRUD 操作：saveProfileItem / bulkSaveProfileItems / getProfileItem / listByDomain / listByType
 * 3. 资料包：getOrCreateProfile / updateProfileStats
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
  updateProfileStats,
} from '@/services/profile/profileService'

// ============================================================
// Mock 设置
// ============================================================

// 实现 import 自 @/data/dataLayerHelpers（re-export @/core/databridgeQueries）
vi.mock('@/data/dataLayerHelpers', () => ({
  sendWriteEnvelope: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  queryGet: vi.fn().mockResolvedValue(undefined),
  queryByIndex: vi.fn().mockResolvedValue([]),
  queryList: vi.fn().mockResolvedValue([]),
  createTraceId: vi.fn().mockReturnValue('test-trace-id'),
}))

// 保留 @/core/databridge mock 以兼容（databridgeQueries 内部调用 dataBridge）
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

import { sendWriteEnvelope, queryGet, queryByIndex } from '@/data/dataLayerHelpers'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// 辅助函数
// ============================================================

/** 创建完整的 mock ProfileItem（补全所有必填字段） */
function createMockItem(overrides: Partial<ProfileItem> & Pick<ProfileItem, 'id'>): ProfileItem {
  return {
    symbol: '600519',
    domain: 'D3',
    itemType: 'news',
    title: '测试标题',
    summary: '测试摘要',
    source: '测试来源',
    publishedAt: Date.now(),
    collectedAt: Date.now(),
    sentiment: 'neutral',
    relatedLayers: ['l1'],
    dataHash: 12345,
    schemaVersion: 1,
    version: 1,
    isUserGenerated: false,
    ...overrides,
  }
}

/** 等待 fire-and-forget 操作完成 */
async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

// ============================================================
// 1. 工具函数测试（纯函数，无需 mock）
// ============================================================

describe('domainToLayers - 域 → 评分层映射', () => {
  it('D1 应映射到 lMinus1 和 l0', () => {
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
    // D1 有 2 个层（lMinus1, l0），D7 有 3 个层，D8 有 2 个层，不参与此测试
    const singleLayerDomains: ProfileDomain[] = ['D2', 'D3', 'D4', 'D5', 'D6']
    for (const d of singleLayerDomains) {
      const layers = domainToLayers(d)
      expect(layers.length).toBe(1)
      expect(layerToDomain(layers[0]!)).toBe(d)
    }
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
    // id 格式：${symbol}_${domain}_${itemType}_${dataHash}
    expect(result.id).toContain('600519')
    expect(result.id).toContain('D3')
    expect(result.id).toContain('news')
    expect(result.dataHash).toBeDefined()
    expect(typeof result.dataHash).toBe('number')
    expect(result.dataHash).toBeGreaterThan(0)
    expect(result.collectedAt).toBeDefined()
    expect(result.schemaVersion).toBe(1)
    expect(result.version).toBe(1)
    expect(result.sentiment).toBe('neutral')
    expect(result.relatedLayers).toEqual(['l1'])

    // 验证原始字段保留
    expect(result.symbol).toBe('600519')
    expect(result.title).toBe('测试标题')

    // 验证 sendWriteEnvelope 被调用
    expect(sendWriteEnvelope).toHaveBeenCalledTimes(1)
  })

  it('相同标题和摘要应生成相同的 dataHash（去重基础）', async () => {
    const item = {
      symbol: '600519',
      domain: 'D3' as ProfileDomain,
      itemType: 'news' as const,
      title: '测试标题',
      summary: '测试摘要',
    }

    const result1 = await saveProfileItem(item)
    const result2 = await saveProfileItem(item)

    // FNV-1a 哈希是确定性的，相同输入应生成相同 dataHash 和 id
    expect(result1.dataHash).toBe(result2.dataHash)
    expect(result1.id).toBe(result2.id)
  })
})

describe('bulkSaveProfileItems - 批量保存资料条目', () => {
  it('应批量补全字段并返回 SyncResult', async () => {
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

    // bulkSaveProfileItems 返回 SyncResult 对象，不是数组
    expect(result.saved).toBe(2)
    expect(result.skippedDuplicates).toBe(0)
    expect(result.failed).toBe(0)

    // 验证 sendWriteEnvelope 被调用（批量保存）
    expect(sendWriteEnvelope).toHaveBeenCalledWith(
      'bulkSaveProfileItems',
      expect.any(Array),
      'analyzer',
    )

    // 等待 fire-and-forget 的 updateProfileStats 完成
    await flushPromises()
  })

  it('空数组应返回空结果且不调用 sendWriteEnvelope', async () => {
    const result = await bulkSaveProfileItems([])

    // 空数组直接返回，result.saved === 0，不触发 updateProfileStats
    expect(result.saved).toBe(0)
    expect(result.failed).toBe(0)
    expect(sendWriteEnvelope).not.toHaveBeenCalled()
  })
})

describe('getProfileItem - 获取单条资料', () => {
  it('存在时应返回资料条目', async () => {
    const mockItem = createMockItem({ id: 'item-001' })

    vi.mocked(queryGet).mockResolvedValueOnce(mockItem)

    const result = await getProfileItem('item-001')
    expect(result).toEqual(mockItem)
    expect(queryGet).toHaveBeenCalledTimes(1)
  })

  it('不存在时应返回 undefined', async () => {
    vi.mocked(queryGet).mockResolvedValueOnce(undefined)

    const result = await getProfileItem('nonexistent')
    expect(result).toBeUndefined()
  })
})

describe('listProfileItemsByDomain - 按域查询资料', () => {
  it('应返回指定域的资料条目列表', async () => {
    const mockItems: ProfileItem[] = [
      createMockItem({ id: 'item-001', domain: 'D3' }),
      createMockItem({ id: 'item-002', domain: 'D3', itemType: 'research_report' }),
    ]

    vi.mocked(queryByIndex).mockResolvedValueOnce(mockItems)

    const result = await listProfileItemsByDomain('600519', 'D3')
    expect(result.length).toBe(2)
    expect(result[0]!.domain).toBe('D3')
    expect(result[1]!.domain).toBe('D3')
  })

  it('应遵守 limit 限制', async () => {
    const mockItems: ProfileItem[] = Array.from({ length: 30 }, (_, i) =>
      createMockItem({
        id: `item-${i}`,
        domain: 'D3' as ProfileDomain,
        title: `条目${i}`,
        summary: `摘要${i}`,
        dataHash: i,
      }),
    )

    vi.mocked(queryByIndex).mockResolvedValueOnce(mockItems)

    // limit 是第三个参数，直接传数字（不是对象）
    const result = await listProfileItemsByDomain('600519', 'D3', 10)
    expect(result.length).toBe(10)
  })

  it('查询失败时应返回空数组', async () => {
    vi.mocked(queryByIndex).mockResolvedValueOnce([])

    const result = await listProfileItemsByDomain('600519', 'D3')
    expect(result).toEqual([])
  })
})

describe('listProfileItemsByType - 按类型查询资料', () => {
  it('应返回指定类型的资料条目列表', async () => {
    const mockItems: ProfileItem[] = [
      createMockItem({ id: 'item-001', itemType: 'research_report' }),
    ]

    vi.mocked(queryByIndex).mockResolvedValueOnce(mockItems)

    const result = await listProfileItemsByType('600519', 'research_report')
    expect(result.length).toBe(1)
    expect(result[0]!.itemType).toBe('research_report')
  })
})

// ============================================================
// 3. 资料包与统计测试
// ============================================================

describe('getOrCreateProfile - 获取或创建资料包', () => {
  it('已存在时应返回现有资料包', async () => {
    const mockProfile: StockProfile = {
      symbol: '600519',
      stockName: '贵州茅台',
      totalItems: 10,
      domainCounts: {
        D1: 0, D2: 0, D3: 5, D4: 0, D5: 2, D6: 1, D7: 3, D8: 0,
      },
      typeCounts: { news: 5, research_report: 3 },
      totalEvidence: 0,
      layerEvidenceCounts: {
        lMinus1: 0, l0: 0, l1: 0, l2: 0, l3f: 0, l3v: 0,
        l4: 0, l5: 0, l6: 0, l7: 0, l8: 0,
      },
      evidenceCoverage: 0.375,
      lastUpdatedAt: Date.now() - 3600000,
      lastSyncSources: ['新浪财经'],
      avgQualityScore: 65,
    }

    vi.mocked(queryGet).mockResolvedValueOnce(mockProfile)

    const result = await getOrCreateProfile('600519', '贵州茅台')
    expect(result.symbol).toBe('600519')
    expect(result.stockName).toBe('贵州茅台')
    expect(result.totalItems).toBe(10)
    // 存在时不调用 sendWriteEnvelope（不保存）
    expect(sendWriteEnvelope).not.toHaveBeenCalled()
  })

  it('不存在时应创建空壳资料包', async () => {
    // queryGet 返回 undefined（不存在）
    vi.mocked(queryGet).mockResolvedValueOnce(undefined)

    const result = await getOrCreateProfile('000001', '平安银行')

    expect(result.symbol).toBe('000001')
    expect(result.stockName).toBe('平安银行')
    expect(result.totalItems).toBe(0)
    expect(result.evidenceCoverage).toBe(0)
    expect(Object.keys(result.domainCounts).length).toBe(8)

    // 验证调用了 save（sendWriteEnvelope 被调用）
    expect(sendWriteEnvelope).toHaveBeenCalledTimes(1)
  })
})

describe('updateProfileStats - 更新资料包统计', () => {
  it('资料包不存在时应创建空壳并返回', async () => {
    // getOrCreateProfile → getStockProfile → queryGet 返回 undefined
    vi.mocked(queryGet).mockResolvedValueOnce(undefined)

    // getDomainCounts, getTypeCounts, listProfileItemsBySymbol 都返回空
    // queryByIndex 默认返回 []

    const result = await updateProfileStats('600519')

    // updateProfileStats 总是返回 StockProfile（不返回 null）
    expect(result).toBeDefined()
    expect(result.symbol).toBe('600519')
    expect(result.totalItems).toBe(0)
    expect(result.avgQualityScore).toBeUndefined()

    // sendWriteEnvelope 应被调用（创建空壳 + 更新统计）
    expect(sendWriteEnvelope).toHaveBeenCalled()
  })

  it('应正确计算各域统计和总条目数', async () => {
    // 模拟已存在的资料包
    const mockProfile: StockProfile = {
      symbol: '600519',
      stockName: '贵州茅台',
      totalItems: 0,
      domainCounts: { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0 },
      typeCounts: {},
      totalEvidence: 0,
      layerEvidenceCounts: {
        lMinus1: 0, l0: 0, l1: 0, l2: 0, l3f: 0, l3v: 0,
        l4: 0, l5: 0, l6: 0, l7: 0, l8: 0,
      },
      evidenceCoverage: 0,
      lastUpdatedAt: Date.now(),
      lastSyncSources: [],
    }

    // getStockProfile → queryGet 返回 mockProfile
    vi.mocked(queryGet).mockResolvedValueOnce(mockProfile)

    // 模拟资料条目（D3 有 5 条，D5 有 3 条，D7 有 8 条，其余 0 条）
    const createMockItems = (domain: string, count: number, quality: number): ProfileItem[] =>
      Array.from({ length: count }, (_, i) =>
        createMockItem({
          id: `${domain}-${i}`,
          domain: domain as ProfileDomain,
          title: `${domain} 条目 ${i}`,
          qualityScore: quality,
          dataHash: i,
        }),
      )

    const allItems = [
      ...createMockItems('D3', 5, 70),
      ...createMockItems('D5', 3, 80),
      ...createMockItems('D7', 8, 60),
    ]

    // updateProfileStats 依次调用：
    // 1. getDomainCounts → queryByIndex（by-symbol）
    // 2. getTypeCounts → queryByIndex（by-symbol）
    // 3. listProfileItemsBySymbol → queryByIndex（by-symbol）
    vi.mocked(queryByIndex).mockResolvedValueOnce(allItems) // getDomainCounts
    vi.mocked(queryByIndex).mockResolvedValueOnce(allItems) // getTypeCounts
    vi.mocked(queryByIndex).mockResolvedValueOnce(allItems) // listProfileItemsBySymbol

    const result = await updateProfileStats('600519')

    expect(result).toBeDefined()
    expect(result.totalItems).toBe(16)
    expect(result.domainCounts.D3).toBe(5)
    expect(result.domainCounts.D5).toBe(3)
    expect(result.domainCounts.D7).toBe(8)

    // 平均质量分 = (5*70 + 3*80 + 8*60) / 16 = 1070 / 16 = 66.875
    expect(result.avgQualityScore).toBeCloseTo(66.875, 2)

    // sendWriteEnvelope 应被调用（更新资料包统计）
    expect(sendWriteEnvelope).toHaveBeenCalled()
  })
})
