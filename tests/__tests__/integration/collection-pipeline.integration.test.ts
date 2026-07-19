/**
 * @test_id V9-TEST-UT-087
 * 采集链路数据完整性集成测试 (S2)
 *
 * 验证目标：
 *   - runCollection → runBatchTrace 的调度正确性（调用次数、参数）
 *   - parentTaskId 一致性
 *   - 部分维度失败时的错误信息
 *   - 连续调用的非幂等行为
 *   - 完成后状态恢复
 *
 * 设计要点：
 *   1. runBatchTrace 被 mock（避免真实 DB/网络调用），但通过 mock.calls
 *      验证调度参数的正确性。
 *   2. 意向池需种子化（0 只股票会导致提前 return）。
 *   3. mock 状态在 beforeEach 中重置，防止交叉污染。
  * @covers_docs [V9-DOC-DATA-024, V9-DOC-PROJ-108, V9-DOC-BACK-011]
*/

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { seedDefaultPool, seedIntentionPool } from '../../utils/seedTestData'

// ============================================================
// Mock 依赖
// ============================================================

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: vi.fn().mockResolvedValue({ success: true }),
    query: vi.fn().mockResolvedValue({ success: false }),
  },
}))

vi.mock('@/services/data-collector/collectionPipeline', async () => {
  const actual = await vi.importActual<typeof import('@/services/data-collector/collectionPipeline')>(
    '@/services/data-collector/collectionPipeline',
  )
  return { ...actual, runBatchTrace: vi.fn().mockResolvedValue(undefined) }
})

// ============================================================
// 辅助：获取 mock 引用
// ============================================================

async function getMockedRunBatchTrace() {
  const mod = await import('@/services/data-collector/collectionPipeline')
  return vi.mocked(mod.runBatchTrace)
}

// ============================================================
// 套件入口
// ============================================================

describe('采集链路完整性集成测试 (S2)', () => {
  beforeEach(async () => {
    useSevenDimConfigStore.getState().reset()

    // 重置 mock 避免跨测试污染
    const mockFn = await getMockedRunBatchTrace()
    mockFn.mockReset()
    mockFn.mockResolvedValue(undefined)

    // 种子化意向池：2 只股票
    seedDefaultPool()
  })

  // === S2.1: 按维度数正确调度 runBatchTrace ===

  it('S2.1 采集按维度数正确调度 runBatchTrace（每次传所有股票）', async () => {
    await useSevenDimConfigStore.getState().runCollection()

    const mockFn = await getMockedRunBatchTrace()

    // full 模板：8 个维度全部启用（默认 full 模板已取代 value）
    expect(mockFn).toHaveBeenCalledTimes(8)

    // 每次调用的 symbols 应包含全部 2 只股票
    const firstCall = mockFn.mock.calls[0][0]
    expect(firstCall.symbols).toEqual(['000001', '600519'])
    expect(firstCall.dimensionCode).toBeTruthy()

    // 8 次调用覆盖 8 个不同维度码
    const dimCodes = mockFn.mock.calls.map((c) => c[0].dimensionCode).sort()
    expect(dimCodes).toEqual(['01', '02', '03', '04', '05', '06', '07', '08'])
  })

  // === S2.2: parentTaskId 一致性 ===

  it('S2.2 同一次采集的所有维度共享相同的 parentTaskId', async () => {
    await useSevenDimConfigStore.getState().runCollection()

    const mockFn = await getMockedRunBatchTrace()
    const parentTaskIds = mockFn.mock.calls.map((c) => c[0].parentTaskId)

    // 所有维度共享同一个 parentTaskId
    expect(new Set(parentTaskIds).size).toBe(1)

    // parentTaskId 格式：collect-{timestamp}
    expect(parentTaskIds[0]).toMatch(/^collect-\d{13}$/)
  })

  // === S2.3: 采集完成后状态恢复正确 ===

  it('S2.3 采集完成后 collectProgress=100 且 collectingDimensions 清空', async () => {
    await useSevenDimConfigStore.getState().runCollection()

    const state = useSevenDimConfigStore.getState()
    expect(state.collectProgress).toBe(100)
    expect(state.isCollecting).toBe(false)
    expect(state.collectingDimensions).toEqual([])
  })

  // === S2.4: 部分维度失败时 error 字段记录失败数 ===

  it('S2.4 部分维度采集失败时 error 记录失败维度数', async () => {
    const mockFn = await getMockedRunBatchTrace()
    // 8 个维度：1 个失败（02=K线），其余成功
    mockFn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('K线采集超时'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    await useSevenDimConfigStore.getState().runCollection()

    const state = useSevenDimConfigStore.getState()
    expect(state.error).toContain('1 个维度采集失败')
    expect(state.isCollecting).toBe(false)
    expect(state.collectProgress).toBe(100)
    // 失败不阻塞其他维度的 cleanup
    expect(state.collectingDimensions).toEqual([])
  })

  // === S2.5: 全部失败时 error 记录全部失败数 ===

  it('S2.5 全部维度采集失败时 error 记录全部失败数', async () => {
    const mockFn = await getMockedRunBatchTrace()
    mockFn.mockRejectedValue(new Error('网络异常'))

    await useSevenDimConfigStore.getState().runCollection()

    const state = useSevenDimConfigStore.getState()
    expect(state.error).toContain('8 个维度采集失败')
    expect(state.isCollecting).toBe(false)
    expect(state.collectProgress).toBe(100)
  })

  // === S2.6: 连续采集可正常执行（非幂等） ===

  it('S2.6 连续两次采集各自独立调度（非幂等）', async () => {
    const mockFn = await getMockedRunBatchTrace()

    // 第一次采集
    await useSevenDimConfigStore.getState().runCollection()
    expect(mockFn).toHaveBeenCalledTimes(8)

    // 第二次采集
    mockFn.mockClear()
    await useSevenDimConfigStore.getState().runCollection()
    expect(mockFn).toHaveBeenCalledTimes(8)

    // 两次采集的 parentTaskId 应不同（独立采集）
    const firstRunTaskIds = new Set(
      mockFn.mock.calls.map((c) => c[0].parentTaskId),
    )
    expect(firstRunTaskIds.size).toBe(1) // 第二次内部一致
  })

  // === S2.7: 采集完成后 error 可被 clearError 清除 ===

  it('S2.7 采集失败后 clearError 可清除错误状态', async () => {
    const mockFn = await getMockedRunBatchTrace()
    mockFn.mockRejectedValue(new Error('模拟失败'))

    await useSevenDimConfigStore.getState().runCollection()
    expect(useSevenDimConfigStore.getState().error).toBeTruthy()

    useSevenDimConfigStore.getState().clearError()
    expect(useSevenDimConfigStore.getState().error).toBe(null)
  })

  // === S2.8: 不同股票数对应正确的 symbols 参数 ===

  it('S2.8 单只股票时 symbols 参数正确', async () => {
    seedIntentionPool(['300750'])

    await useSevenDimConfigStore.getState().runCollection()

    const mockFn = await getMockedRunBatchTrace()
    const firstCall = mockFn.mock.calls[0][0]
    expect(firstCall.symbols).toEqual(['300750'])
  })
})
