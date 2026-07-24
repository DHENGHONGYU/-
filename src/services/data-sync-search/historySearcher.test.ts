/**
 * historySearcher.test.ts
 * 历史记录检索器单元测试
 *
 * 覆盖：
 * - searchHistory: 历史记录检索
 *   - 关键词搜索（symbols/fileName/errorMessage/channel）
 *   - 时间范围过滤
 *   - 通道筛选
 *   - 标的筛选
 *   - 维度筛选
 *   - 状态筛选
 *   - 排序（timestamp/channel/status，asc/desc）
 *   - 分页
 *   - 空记录 → 空结果
 */
import { describe, it, expect, vi } from 'vitest'
import { searchHistory } from './historySearcher'
import type { CollectionHistoryEntry, CollectionChannel } from '@/types/modules/data-sync.types'

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

function makeRecords(): CollectionHistoryEntry[] {
  return [
    {
      id: 'h1',
      channel: 'file-import',
      status: 'success',
      timestamp: '2026-07-10T10:00:00Z',
      collectionInfo: {
        symbols: ['600519', '000858'],
        dimensions: ['price', 'finance'],
        fileName: '白酒股票.csv',
        source: 'local',
      },
      updateInfo: {
        recordsAdded: 80,
        recordsUpdated: 20,
        recordsDeleted: 0,
        conflictsDetected: 0,
      },
      recordCount: 100,
      errorMessage: '',
      createdAt: Date.now(),
    },
    {
      id: 'h2',
      channel: 'auto-collect',
      status: 'success',
      timestamp: '2026-07-12T10:00:00Z',
      collectionInfo: {
        symbols: ['601318'],
        dimensions: ['price'],
        source: 'api',
      },
      updateInfo: {
        recordsAdded: 50,
        recordsUpdated: 0,
        recordsDeleted: 0,
        conflictsDetected: 0,
      },
      recordCount: 50,
      errorMessage: '',
      createdAt: Date.now(),
    },
    {
      id: 'h3',
      channel: 'file-import',
      status: 'failed',
      timestamp: '2026-07-15T10:00:00Z',
      collectionInfo: {
        symbols: ['600519'],
        dimensions: ['finance'],
        fileName: '财务数据.xlsx',
        source: 'local',
      },
      updateInfo: {
        recordsAdded: 0,
        recordsUpdated: 0,
        recordsDeleted: 0,
        conflictsDetected: 0,
      },
      recordCount: 0,
      errorMessage: '格式错误：第 5 行数据异常',
      createdAt: Date.now(),
    },
  ] as unknown as CollectionHistoryEntry[]
}

describe('searchHistory — 关键词搜索', () => {
  it('按 symbol 匹配', () => {
    const result = searchHistory({ keyword: '600519' }, makeRecords())
    expect(result.length).toBe(2) // h1, h3
  })

  it('按 fileName 匹配', () => {
    const result = searchHistory({ keyword: '白酒' }, makeRecords())
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe('h1')
  })

  it('按 errorMessage 匹配', () => {
    const result = searchHistory({ keyword: '格式错误' }, makeRecords())
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe('h3')
  })

  it('按 channel 匹配', () => {
    const result = searchHistory({ keyword: 'auto-collect' }, makeRecords())
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe('h2')
  })

  it('关键词不区分大小写', () => {
    const r1 = searchHistory({ keyword: 'CSV' }, makeRecords())
    const r2 = searchHistory({ keyword: 'csv' }, makeRecords())
    expect(r1.length).toBe(r2.length)
  })

  it('无匹配 → 空数组', () => {
    const result = searchHistory({ keyword: 'nonexistent' }, makeRecords())
    expect(result).toEqual([])
  })
})

describe('searchHistory — 时间范围', () => {
  it('start 过滤', () => {
    const result = searchHistory({ dateRange: { start: '2026-07-12T00:00:00Z' } }, makeRecords())
    expect(result.length).toBe(2) // h2(07-12), h3(07-15)
  })

  it('end 过滤', () => {
    const result = searchHistory({ dateRange: { end: '2026-07-11T00:00:00Z' } }, makeRecords())
    expect(result.length).toBe(1) // h1(07-10)
  })

  it('start + end 范围', () => {
    const result = searchHistory({
      dateRange: { start: '2026-07-11T00:00:00Z', end: '2026-07-14T00:00:00Z' },
    }, makeRecords())
    expect(result.length).toBe(1) // h2(07-12)
  })
})

describe('searchHistory — 通道筛选', () => {
  it('单通道筛选', () => {
    const result = searchHistory({ channels: ['file-import'] }, makeRecords())
    expect(result.length).toBe(2) // h1, h3
  })

  it('多通道筛选', () => {
    const result = searchHistory({ channels: ['file-import', 'auto-collect'] }, makeRecords())
    expect(result.length).toBe(3)
  })

  it('未知通道 → 空数组', () => {
    const result = searchHistory({ channels: ['manual-trigger' as CollectionChannel] }, makeRecords())
    expect(result).toEqual([])
  })
})

describe('searchHistory — 标的筛选', () => {
  it('单标的筛选', () => {
    const result = searchHistory({ symbols: ['600519'] }, makeRecords())
    expect(result.length).toBe(2) // h1, h3
  })

  it('多标的筛选（任一匹配即可）', () => {
    const result = searchHistory({ symbols: ['600519', '601318'] }, makeRecords())
    expect(result.length).toBe(3)
  })

  it('无匹配标的 → 空数组', () => {
    const result = searchHistory({ symbols: ['000001'] }, makeRecords())
    expect(result).toEqual([])
  })
})

describe('searchHistory — 维度筛选', () => {
  it('单维度筛选', () => {
    const result = searchHistory({ dimensions: ['finance'] }, makeRecords())
    expect(result.length).toBe(2) // h1, h3
  })

  it('多维度筛选（任一匹配即可）', () => {
    const result = searchHistory({ dimensions: ['price', 'finance'] }, makeRecords())
    expect(result.length).toBe(3)
  })
})

describe('searchHistory — 状态筛选', () => {
  it('success 状态', () => {
    const result = searchHistory({ statuses: ['success'] }, makeRecords())
    expect(result.length).toBe(2) // h1, h2
  })

  it('failed 状态', () => {
    const result = searchHistory({ statuses: ['failed'] }, makeRecords())
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe('h3')
  })
})

describe('searchHistory — 排序', () => {
  it('默认按 timestamp 降序', () => {
    const result = searchHistory({}, makeRecords())
    expect(result[0]?.timestamp).toBe('2026-07-15T10:00:00Z')
    expect(result[result.length - 1]?.timestamp).toBe('2026-07-10T10:00:00Z')
  })

  it('sortOrder=asc 升序', () => {
    const result = searchHistory({ sortOrder: 'asc' }, makeRecords())
    expect(result[0]?.timestamp).toBe('2026-07-10T10:00:00Z')
  })

  it('sortBy=channel 按通道排序', () => {
    const result = searchHistory({ sortBy: 'channel', sortOrder: 'asc' }, makeRecords())
    // auto-collect < file-import 字母序
    expect(result[0]?.id).toBe('h2') // auto-collect 排在最前
  })

  it('sortBy=status 按状态排序', () => {
    const result = searchHistory({ sortBy: 'status', sortOrder: 'asc' }, makeRecords())
    // failed < success 字母序
    expect(result[0]?.id).toBe('h3') // failed
  })
})

describe('searchHistory — 分页', () => {
  it('page=1 pageSize=2 → 前 2 条', () => {
    const result = searchHistory({ pageSize: 2, page: 1 }, makeRecords())
    expect(result.length).toBe(2)
  })

  it('page=2 pageSize=2 → 第 2 页', () => {
    const result = searchHistory({ pageSize: 2, page: 2 }, makeRecords())
    expect(result.length).toBe(1) // 总共 3 条，第 2 页 1 条
  })

  it('超页 → 空数组', () => {
    const result = searchHistory({ pageSize: 10, page: 10 }, makeRecords())
    expect(result).toEqual([])
  })
})

describe('searchHistory — 边界情况', () => {
  it('空记录 → 空数组', () => {
    const result = searchHistory({}, [])
    expect(result).toEqual([])
  })

  it('空条件 → 返回全部', () => {
    const records = makeRecords()
    const result = searchHistory({}, records)
    expect(result.length).toBe(records.length)
  })
})
