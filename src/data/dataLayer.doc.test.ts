/**
 * @fileoverview dataLayer — Document 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：scoreDocStore(5) / strategySnapshotStore(5) / localDocStore(4) 共 14 个用例
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockQuery,
  mockQueryGetSuccess,
  mockQueryListSuccess,
  mockForwardSuccess,
  makeScoreDoc,
  makeStrategySnapshot,
  makeLocalDoc,
} from './dataLayer.test-utils'
import { scoreDocStore, strategySnapshotStore, localDocStore } from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('scoreDocStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await scoreDocStore.save(makeScoreDoc())
    expect(result.success).toBe(true)
  })

  it('get: 查询到文档', async () => {
    mockQueryGetSuccess(makeScoreDoc())

    const result = await scoreDocStore.get('600519__1__1700000000000')
    expect(result?.composite).toBe(85)
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeScoreDoc()])

    const result = await scoreDocStore.list()
    expect(result).toHaveLength(1)
  })

  it('listBySymbol: 按股票查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeScoreDoc()] })

    const result = await scoreDocStore.listBySymbol('600519')
    expect(result).toHaveLength(1)
  })

  it('getLatestBySymbol: 返回最高版本', async () => {
    const docs = [
      makeScoreDoc({ version: 1 }),
      makeScoreDoc({ docId: '600519__3__1700000000003', version: 3 }),
      makeScoreDoc({ docId: '600519__2__1700000000002', version: 2 }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: docs })

    const result = await scoreDocStore.getLatestBySymbol('600519')
    expect(result?.version).toBe(3)
  })
})

describe('strategySnapshotStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await strategySnapshotStore.save(makeStrategySnapshot())
    expect(result.success).toBe(true)
  })

  it('get: 查询到快照', async () => {
    mockQueryGetSuccess(makeStrategySnapshot())

    const result = await strategySnapshotStore.get('snap-001')
    expect(result?.stockCount).toBe(50)
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeStrategySnapshot()])

    const result = await strategySnapshotStore.list()
    expect(result).toHaveLength(1)
  })

  it('getLatest: 返回最新快照', async () => {
    const snaps = [
      makeStrategySnapshot({ timestamp: 1000 }),
      makeStrategySnapshot({ id: 'snap-003', timestamp: 3000 }),
      makeStrategySnapshot({ id: 'snap-002', timestamp: 2000 }),
    ]
    mockQueryListSuccess(snaps)

    const result = await strategySnapshotStore.getLatest()
    expect(result?.timestamp).toBe(3000)
  })

  it('getLatest: 空列表返回 undefined', async () => {
    mockQueryListSuccess([])

    const result = await strategySnapshotStore.getLatest()
    expect(result).toBeUndefined()
  })
})

describe('localDocStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await localDocStore.save(makeLocalDoc())
    expect(result.success).toBe(true)
  })

  it('get: 查询到文档', async () => {
    mockQueryGetSuccess(makeLocalDoc())

    const result = await localDocStore.get('doc-001')
    expect(result?.name).toBe('贵州茅台')
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeLocalDoc()])

    const result = await localDocStore.list()
    expect(result).toHaveLength(1)
  })

  it('listBySymbol: 按股票查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeLocalDoc()] })

    const result = await localDocStore.listBySymbol('600519')
    expect(result).toHaveLength(1)
  })
})
