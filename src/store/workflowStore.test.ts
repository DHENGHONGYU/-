/**
 * @test_id V9-TEST-ST-164
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

beforeEach(() => {
  vi.clearAllMocks()
  useWorkflowStore.setState({ activeCabin: 'input' })
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
