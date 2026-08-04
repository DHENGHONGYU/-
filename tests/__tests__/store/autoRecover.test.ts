/**
 * @test_id V9-TEST-UT-R1
 * @status known-failing
 * @reason autoRecovery 功能已从 sevenDimConfigStore 中移除，属性 isRecovering/recoveryAttempted/cancelRecovery 不再存在。
 *               若未来需要自动恢复功能，应重新设计并更新此测试。
 *
 * sevenDimConfigStore 自动恢复逻辑（autoRecover）单元测试
 *
 * 覆盖场景（R1 组）：
 * 1. R1-1 全量失败后 30s 自动恢复，恢复成功 → error 清空，isRecovering=false
 * 2. R1-2 全量失败后 30s 自动恢复，恢复仍失败 → 不再重试（recoveryAttempted 保持 true）
 * 3. R1-3 用户手动触发采集时取消待执行的自动恢复
 *
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-ARCH-009]
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { runBatchTrace } from '@/services/data-collector/collectionPipeline'
import { seedIntentionPool, clearIntentionPool } from '../../utils/seedTestData'

// autoRecovery 字段已在 sevenDimConfigStore 中实现

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
  return {
    ...actual,
    runBatchTrace: vi.fn(),
  }
})

vi.mock('@/store/collectionRuntimeStore', async () => {
  const actual = await vi.importActual<typeof import('@/store/collectionRuntimeStore')>(
    '@/store/collectionRuntimeStore',
  )
  return { ...actual }
})

const mockRunBatchTrace = vi.mocked(runBatchTrace)

// ============================================================
// 测试
// ============================================================

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  useSevenDimConfigStore.getState().reset()
  seedIntentionPool(['600519.SH'])
})

afterEach(() => {
  vi.useRealTimers()
  clearIntentionPool()
})

describe('R1 组：sevenDimConfigStore 自动恢复逻辑（autoRecover）', () => {
  it('R1-1 全量失败后 30s 自动恢复，恢复成功 → error 清空，isRecovering=false', async () => {
    const store = useSevenDimConfigStore.getState()

    // 第 1 轮：全部维度 reject（模拟数据源全量宕机）
    mockRunBatchTrace.mockRejectedValue(new Error('网络异常，全部维度挂了'))

    await store.runCollection()

    // 验证失败后进入恢复等待状态
    let state = useSevenDimConfigStore.getState()
    expect(state.error).toContain('个维度采集失败')
    expect(state.isCollecting).toBe(false)
    expect(state.isRecovering).toBe(true)
    expect(state.recoveryAttempted).toBe(true)

    // 第 2 轮（恢复）：全部成功
    mockRunBatchTrace.mockResolvedValue([{
      success: true,
      symbol: '600519.SH',
      dimensionCode: '01',
      latency: 100,
      fallbackCount: 0,
    }])

    // 推进 30s 触发自动恢复
    await vi.advanceTimersByTimeAsync(30_000)
    // 确保恢复采集的微任务全部完成
    await vi.advanceTimersByTimeAsync(0)

    // 验证恢复成功
    state = useSevenDimConfigStore.getState()
    expect(state.error).toBeNull()
    expect(state.isCollecting).toBe(false)
    expect(state.isRecovering).toBe(false)
    expect(state.recoveryAttempted).toBe(false)
  })

  it('R1-2 全量失败后 30s 自动恢复，恢复仍失败 → 不再重试（recoveryAttempted 保持 true）', async () => {
    const store = useSevenDimConfigStore.getState()

    // 全部失败
    mockRunBatchTrace.mockRejectedValue(new Error('网络异常'))

    await store.runCollection()

    let state = useSevenDimConfigStore.getState()
    expect(state.isRecovering).toBe(true)
    expect(state.recoveryAttempted).toBe(true)

    // 推进 30s 触发恢复（仍失败）
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(0)

    // 恢复失败后：isRecovering=false（回调中已设置），recoveryAttempted 保持 true
    state = useSevenDimConfigStore.getState()
    expect(state.error).toContain('个维度采集失败')
    expect(state.isRecovering).toBe(false)
    expect(state.recoveryAttempted).toBe(true)

    // 验证不再有第二次恢复：再推进 60s，调用次数不应增加
    const callCountAfterRecovery = mockRunBatchTrace.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockRunBatchTrace.mock.calls.length).toBe(callCountAfterRecovery)
  })

  it('R1-3 用户手动触发采集时取消待执行的自动恢复', async () => {
    const store = useSevenDimConfigStore.getState()

    // 第 1 轮失败，进入恢复等待
    mockRunBatchTrace.mockRejectedValue(new Error('网络异常'))

    await store.runCollection()

    let state = useSevenDimConfigStore.getState()
    expect(state.isRecovering).toBe(true)
    expect(state.recoveryAttempted).toBe(true)

    // 用户手动触发采集（runCollection 开头会 cancelRecovery）
    mockRunBatchTrace.mockResolvedValue([{
      success: true,
      symbol: '600519.SH',
      dimensionCode: '01',
      latency: 100,
      fallbackCount: 0,
    }])

    await store.runCollection()

    // 验证恢复已取消，采集成功
    state = useSevenDimConfigStore.getState()
    expect(state.isRecovering).toBe(false)
    expect(state.recoveryAttempted).toBe(false)
    expect(state.error).toBeNull()

    // 推进 30s，不应触发任何恢复
    const callCountBefore = mockRunBatchTrace.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockRunBatchTrace.mock.calls.length).toBe(callCountBefore)
  })

  it('R1-4 cancelRecovery 直接调用 → 清除定时器并重置状态', async () => {
    const store = useSevenDimConfigStore.getState()

    // 触发失败，进入恢复等待
    mockRunBatchTrace.mockRejectedValue(new Error('网络异常'))
    await store.runCollection()

    let state = useSevenDimConfigStore.getState()
    expect(state.isRecovering).toBe(true)

    // 直接调用 cancelRecovery
    store.cancelRecovery?.()

    state = useSevenDimConfigStore.getState()
    expect(state.isRecovering).toBe(false)
    expect(state.recoveryAttempted).toBe(false)

    // 推进 30s，不应触发恢复
    const callCountBefore = mockRunBatchTrace.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockRunBatchTrace.mock.calls.length).toBe(callCountBefore)
  })

  it('R1-5 采集成功后不触发自动恢复', async () => {
    const store = useSevenDimConfigStore.getState()

    // 全部成功
    mockRunBatchTrace.mockResolvedValue([{
      success: true,
      symbol: '600519.SH',
      dimensionCode: '01',
      latency: 100,
      fallbackCount: 0,
    }])

    await store.runCollection()

    const state = useSevenDimConfigStore.getState()
    expect(state.error).toBeNull()
    expect(state.isRecovering).toBe(false)
    expect(state.recoveryAttempted).toBe(false)

    // 推进 30s，不应有任何额外调用
    const callCountBefore = mockRunBatchTrace.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockRunBatchTrace.mock.calls.length).toBe(callCountBefore)
  })
})

// ============================================================
// P1 补充：runCollection 前置守卫与部分失败场景
// ============================================================

describe('P1 补充：runCollection 前置守卫', () => {
  it('R2 采集进行中再次调用 runCollection → 直接返回（防重入）', async () => {
    // 手动设置采集进行中状态
    useSevenDimConfigStore.setState({ collectingDimensions: ['01'] })

    const store = useSevenDimConfigStore.getState()
    await store.runCollection()

    // 不应触发任何采集（防重入直接返回）
    expect(mockRunBatchTrace).not.toHaveBeenCalled()
  })

  it('R3 意向池为空 → 跳过采集，不触发 runBatchTrace', async () => {
    clearIntentionPool()

    const store = useSevenDimConfigStore.getState()
    await store.runCollection()

    expect(mockRunBatchTrace).not.toHaveBeenCalled()
  })

  it('R4 维度就绪度检查未通过 → 设置 error 并返回', async () => {
    const store = useSevenDimConfigStore.getState()
    // 设置维度 01 的 sources 为空
    store.setDimensionSources('01', [])

    await store.runCollection()

    const state = useSevenDimConfigStore.getState()
    expect(state.error).toContain('维度配置不完整')
    expect(state.isCollecting).toBe(false)
    // 不应触发任何采集
    expect(mockRunBatchTrace).not.toHaveBeenCalled()
  })
})

describe('P1 补充：部分维度失败', () => {
  it('R5 部分维度失败（非全量）→ 仍触发自动恢复', async () => {
    const store = useSevenDimConfigStore.getState()

    // 部分维度失败，部分成功
    mockRunBatchTrace.mockImplementation((params: { dimensionCode: string }) => {
      if (params.dimensionCode === '01' || params.dimensionCode === '02') {
        return Promise.reject(new Error('维度 01/02 采集失败'))
      }
      return Promise.resolve([{
        success: true,
        symbol: '600519.SH',
        dimensionCode: params.dimensionCode,
        latency: 100,
        fallbackCount: 0,
      }])
    })

    await store.runCollection()

    const state = useSevenDimConfigStore.getState()
    // 有失败 → error 非空
    expect(state.error).toContain('个维度采集失败')
    // 部分失败也触发自动恢复
    expect(state.isRecovering).toBe(true)
    expect(state.recoveryAttempted).toBe(true)

    // 取消恢复，避免影响后续测试
    store.cancelRecovery?.()
  })
})
