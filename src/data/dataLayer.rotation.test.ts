/**
 * @fileoverview dataLayer — Rotation & Sector 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：rotationScoreStore(5) / hotSectorScoreStore(3) / valuePitScoreStore(3) / sectorScoreStore(5)
 *       共 16 个用例
 */
import {
  mockQueryGetSuccess,
  mockQueryListSuccess,
  mockForwardSuccess,
  mockQuery,
  makeRotationScore,
  makeHotSectorScore,
  makeValuePitScore,
  makeSectorScore,
} from './dataLayer.test-utils'
import {
  rotationScoreStore,
  hotSectorScoreStore,
  valuePitScoreStore,
  sectorScoreStore,
} from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rotationScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await rotationScoreStore.save(makeRotationScore())
    expect(result.success).toBe(true)
  })

  it('get: 查询到记录', async () => {
    mockQueryGetSuccess(makeRotationScore())

    const result = await rotationScoreStore.get('SW801__20260701')
    expect(result?.sectorCode).toBe('SW801')
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeRotationScore()])

    const result = await rotationScoreStore.list()
    expect(result).toHaveLength(1)
  })

  it('listBySector: 按板块查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeRotationScore()] })

    const result = await rotationScoreStore.listBySector('SW801')
    expect(result).toHaveLength(1)
  })

  it('getLatestBySector: 返回最新记录', async () => {
    const records = [
      makeRotationScore({ scoreDate: '2026-06-01' }),
      makeRotationScore({ id: 'SW801__20260702', scoreDate: '2026-07-02' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: records })

    const result = await rotationScoreStore.getLatestBySector('SW801')
    expect(result?.scoreDate).toBe('2026-07-02')
  })
})

describe('hotSectorScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await hotSectorScoreStore.save(makeHotSectorScore())
    expect(result.success).toBe(true)
  })

  it('get: 查询到记录', async () => {
    mockQueryGetSuccess(makeHotSectorScore())

    const result = await hotSectorScoreStore.get('SW801')
    expect(result?.score).toBe(82)
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeHotSectorScore()])

    const result = await hotSectorScoreStore.list()
    expect(result).toHaveLength(1)
  })
})

describe('valuePitScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await valuePitScoreStore.save(makeValuePitScore())
    expect(result.success).toBe(true)
  })

  it('get: 查询到记录', async () => {
    mockQueryGetSuccess(makeValuePitScore())

    const result = await valuePitScoreStore.get('SW801')
    expect(result?.score).toBe(78)
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeValuePitScore()])

    const result = await valuePitScoreStore.list()
    expect(result).toHaveLength(1)
  })
})

describe('sectorScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await sectorScoreStore.save(makeSectorScore())
    expect(result.success).toBe(true)
  })

  it('get: 查询到记录', async () => {
    mockQueryGetSuccess(makeSectorScore())

    const result = await sectorScoreStore.get('SW801__2026-07-01')
    expect(result?.composite).toBe(80)
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeSectorScore()])

    const result = await sectorScoreStore.list()
    expect(result).toHaveLength(1)
  })

  it('listBySector: 按板块查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeSectorScore()] })

    const result = await sectorScoreStore.listBySector('SW801')
    expect(result).toHaveLength(1)
  })

  it('getLatestBySector: 返回最新记录', async () => {
    const records = [
      makeSectorScore({ scoreDate: '2026-06-01' }),
      makeSectorScore({ id: 'SW801__2026-07-15', scoreDate: '2026-07-15' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: records })

    const result = await sectorScoreStore.getLatestBySector('SW801')
    expect(result?.scoreDate).toBe('2026-07-15')
  })
})
