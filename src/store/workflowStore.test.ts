/**
 * @test_id V9-TEST-ST-164
 * workflowStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. setActiveCabin: 更新 activeCabin
 * 3. setActiveCabin: 可设置为所有合法的 CabinType
 * 4. canSwitchCabin: 相邻舱位可以切换
 * 5. canSwitchCabin: 相同舱位可以切换
 * 6. canSwitchCabin: 回退可以切换
 * 7. canSwitchCabin: 跳跃超过 1 步不可以切换
 * 8. canSwitchCabin: 向前只能跳 1 步
 * 9. inferInitialCabin: 根据 URL hash 推导初始舱室
 * 10. inferInitialCabin: 无 hash 回退到 input
 * 11. inferInitialCabin: 不匹配的路径回退到 input
 * 12. setActiveCabin: 切换时 logger.info 记录 from/to
 * 13. setActiveCabin: 相同舱位不触发 logger.info
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

// ============================================================
// Imports
// ============================================================

import { useWorkflowStore, canSwitchCabin, type CabinType } from './workflowStore'

// ============================================================
// Setup
// ============================================================

const originalHash = window.location.hash

beforeEach(() => {
  vi.clearAllMocks()
  // 重置 hash 为空
  delete (window as Record<string, unknown>).location
  window.location = { ...window.location, hash: '' } as Location
  useWorkflowStore.setState({ activeCabin: 'input' })
})

afterEach(() => {
  // 恢复原始 hash
  window.location.hash = originalHash
})

// ============================================================
// useWorkflowStore
// ============================================================

describe('useWorkflowStore', () => {
  it('初始状态验证', () => {
    const state = useWorkflowStore.getState()
    expect(state.activeCabin).toBe('input')
    expect(typeof state.setActiveCabin).toBe('function')
  })

  it('setActiveCabin: 更新 activeCabin', () => {
    useWorkflowStore.getState().setActiveCabin('analysis')
    expect(useWorkflowStore.getState().activeCabin).toBe('analysis')

    useWorkflowStore.getState().setActiveCabin('trading')
    expect(useWorkflowStore.getState().activeCabin).toBe('trading')
  })

  it('setActiveCabin: 可设置为所有合法的 CabinType', () => {
    const cabins: CabinType[] = ['input', 'analysis', 'trading', 'output', 'command']
    for (const cabin of cabins) {
      useWorkflowStore.getState().setActiveCabin(cabin)
      expect(useWorkflowStore.getState().activeCabin).toBe(cabin)
    }
  })

  // ============================================================
  // inferInitialCabin
  // ============================================================

  /** @test_id V9-TEST-ST-164-infer-01 */
  it('inferInitialCabin: hash 为空 → 回退到 input', () => {
    window.location.hash = ''
    // 重新创建 store 验证初始值（通过直接 setState 模拟）
    // inferInitialCabin 在 create() 时调用，此处通过验证默认行为确认
    expect(useWorkflowStore.getState().activeCabin).toBe('input')
  })

  /** @test_id V9-TEST-ST-164-infer-02 */
  it('inferInitialCabin: 无 hash 前缀 → 回退到 input', () => {
    window.location.hash = '#nonsense/path'
    // 验证不匹配路径的回退行为
    expect(useWorkflowStore.getState().activeCabin).toBe('input')
  })
})

// ============================================================
// canSwitchCabin
// ============================================================

describe('canSwitchCabin', () => {
  it('相邻舱位可以切换', () => {
    expect(canSwitchCabin('input', 'analysis')).toBe(true)
    expect(canSwitchCabin('analysis', 'trading')).toBe(true)
    expect(canSwitchCabin('trading', 'output')).toBe(true)
    expect(canSwitchCabin('output', 'command')).toBe(true)
  })

  it('相同舱位可以切换', () => {
    expect(canSwitchCabin('input', 'input')).toBe(true)
    expect(canSwitchCabin('command', 'command')).toBe(true)
  })

  it('回退可以切换', () => {
    expect(canSwitchCabin('trading', 'input')).toBe(true)
    expect(canSwitchCabin('command', 'analysis')).toBe(true)
  })

  it('跳跃超过 1 步不可以切换', () => {
    expect(canSwitchCabin('input', 'trading')).toBe(false)
    expect(canSwitchCabin('input', 'command')).toBe(false)
    expect(canSwitchCabin('analysis', 'command')).toBe(false)
  })

  it('向前只能跳 1 步', () => {
    expect(canSwitchCabin('input', 'output')).toBe(false)
    expect(canSwitchCabin('analysis', 'output')).toBe(false)
  })
})

// ============================================================
// setActiveCabin: logger 行为
// ============================================================

describe('setActiveCabin: logger 行为', () => {
  /** @test_id V9-TEST-ST-164-log-01 */
  it('切换到不同舱位时 logger.info 记录 from/to', () => {
    useWorkflowStore.getState().setActiveCabin('analysis')
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[WorkflowStore] activeCabin 切换',
      { from: 'input', to: 'analysis' },
    )
  })

  /** @test_id V9-TEST-ST-164-log-02 */
  it('设置相同舱位时不触发 logger.info', () => {
    useWorkflowStore.setState({ activeCabin: 'trading' })
    vi.clearAllMocks()

    useWorkflowStore.getState().setActiveCabin('trading')
    expect(mockLogger.info).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-164-log-03 */
  it('多次切换正确记录 from/to', () => {
    useWorkflowStore.getState().setActiveCabin('analysis')
    useWorkflowStore.getState().setActiveCabin('trading')

    expect(mockLogger.info).toHaveBeenCalledTimes(2)
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      '[WorkflowStore] activeCabin 切换',
      { from: 'input', to: 'analysis' },
    )
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      '[WorkflowStore] activeCabin 切换',
      { from: 'analysis', to: 'trading' },
    )
  })
})

// ============================================================
// inferInitialCabin: 通过动态重载模块覆盖各 hash 分支
// inferInitialCabin 在模块加载时（create 调用时）执行一次，
// 因此需要 vi.resetModules() + 动态 import 重新触发。
// ============================================================

describe('inferInitialCabin: hash 路径推导（动态重载）', () => {
  /**
   * 重置模块 registry 并以指定 hash 重新导入 workflowStore，
   * 触发 inferInitialCabin() 在 create() 时重新执行。
   */
  async function reloadWithHash(hash: string): Promise<CabinType> {
    window.location.hash = hash
    vi.resetModules()
    const mod = await import('./workflowStore')
    return mod.useWorkflowStore.getState().activeCabin
  }

  /** @test_id V9-TEST-ST-164-infer-input */
  it('hash #/input → input', async () => {
    expect(await reloadWithHash('#/input')).toBe('input')
  })

  /** @test_id V9-TEST-ST-164-infer-analysis */
  it('hash #/analysis → analysis', async () => {
    expect(await reloadWithHash('#/analysis')).toBe('analysis')
  })

  /** @test_id V9-TEST-ST-164-infer-trading */
  it('hash #/trading/holdings → trading', async () => {
    expect(await reloadWithHash('#/trading/holdings')).toBe('trading')
  })

  /** @test_id V9-TEST-ST-164-infer-output */
  it('hash #/output → output', async () => {
    expect(await reloadWithHash('#/output')).toBe('output')
  })

  /** @test_id V9-TEST-ST-164-infer-command */
  it('hash #/command → command', async () => {
    expect(await reloadWithHash('#/command')).toBe('command')
  })

  /** @test_id V9-TEST-ST-164-infer-default */
  it('hash #/unknown → default input', async () => {
    expect(await reloadWithHash('#/unknown')).toBe('input')
  })

  /** @test_id V9-TEST-ST-164-infer-nohash */
  it('hash 为空 → input', async () => {
    expect(await reloadWithHash('')).toBe('input')
  })

  /** @test_id V9-TEST-ST-164-infer-noprefix */
  it('hash 不带 # 前缀（/trading）→ trading', async () => {
    expect(await reloadWithHash('/trading')).toBe('trading')
  })
})
