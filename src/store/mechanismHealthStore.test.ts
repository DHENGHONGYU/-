/**
 * @test_id V9-TEST-ST-MECH-HEALTH
 * @fileoverview mechanismHealthStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. runScan 成功 —— 更新 latest / history / lastUpdated
 * 3. runScan 异常 —— 设置 lastError
 * 4. startMonitoring / stopMonitoring
 * 5. history 封顶 MECHANISM_HISTORY_CAP
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076]
*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const { mockEventBusOn, allUnsubscribers } = vi.hoisted(() => {
  const allUnsubscribers: Array<ReturnType<typeof vi.fn>> = []
  const mockEventBusOn = vi.fn(() => {
    const unsubscribe = vi.fn()
    allUnsubscribers.push(unsubscribe)
    return unsubscribe
  })
  return { mockEventBusOn, allUnsubscribers }
})
vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: mockEventBusOn,
    emit: vi.fn(),
    off: vi.fn(),
    getStats: vi.fn(),
  },
}))

const mockRunMechanismScan = vi.hoisted(() => vi.fn())
const mockMechanismAlertEvent = vi.hoisted(() => 'mechanism:alert')
vi.mock('@/services/system/mechanismMonitorService', () => ({
  runMechanismScan: mockRunMechanismScan,
  MECHANISM_ALERT_EVENT: mockMechanismAlertEvent,
}))

vi.mock('@/types/modules/collection.types', () => ({
  COLLECTION_EVENTS: { COMPLETE: 'collection:complete' },
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useMechanismHealthStore, initMechanismSubscriptions } from './mechanismHealthStore'
import type { MechanismHealthSnapshot } from '@/services/system/mechanismMonitorService'

// ============================================================
// Helpers
// ============================================================

function buildSnapshot(overrides: Partial<MechanismHealthSnapshot> = {}): MechanismHealthSnapshot {
  return {
    timestamp: Date.now(),
    probes: [],
    summary: {
      total: 19,
      active: 18,
      activatedRatio: 18 / 19,
      byCategory: {} as Record<string, unknown>,
    },
    ...overrides,
  } as MechanismHealthSnapshot
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  useMechanismHealthStore.setState({
    latest: null,
    history: [],
    isMonitoring: false,
    lastError: null,
    lastUpdated: 0,
    lastAlertAt: 0,
  }, false)

  vi.clearAllMocks()
  mockRunMechanismScan.mockReset()
  mockEventBusOn.mockClear()
  allUnsubscribers.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  // 确保监控已停止，防止定时器泄漏
  useMechanismHealthStore.getState().stopMonitoring()
  vi.useRealTimers()
})

// ============================================================
// Tests
// ============================================================

describe('useMechanismHealthStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = useMechanismHealthStore.getState()
      expect(state.latest).toBeNull()
      expect(state.history).toEqual([])
      expect(state.isMonitoring).toBe(false)
      expect(state.lastError).toBeNull()
      expect(state.lastUpdated).toBe(0)
      expect(state.lastAlertAt).toBe(0)
    })
  })

  describe('runScan', () => {
    it('成功：应更新 latest、history 和 lastUpdated，清除 lastError', () => {
      const snapshot = buildSnapshot()
      mockRunMechanismScan.mockReturnValue(snapshot)

      useMechanismHealthStore.getState().runScan()

      const state = useMechanismHealthStore.getState()
      expect(state.latest).toEqual(snapshot)
      expect(state.history).toHaveLength(1)
      expect(state.history[0]).toEqual(snapshot)
      expect(state.lastUpdated).toBeGreaterThan(0)
      expect(state.lastError).toBeNull()
    })

    it('异常：应设置 lastError', () => {
      mockRunMechanismScan.mockImplementation(() => {
        throw new Error('扫描服务故障')
      })

      useMechanismHealthStore.getState().runScan()

      expect(useMechanismHealthStore.getState().lastError).toBe('扫描服务故障')
    })

    it('多次扫描后 history 应封顶在 20 条', () => {
      for (let i = 0; i < 25; i++) {
        mockRunMechanismScan.mockReturnValue(buildSnapshot({ timestamp: i }))
        useMechanismHealthStore.getState().runScan()
      }

      // history 最多保留 20 条
      expect(useMechanismHealthStore.getState().history).toHaveLength(20)
      // 最后一条应是 timestamp=24 的快照
      expect(useMechanismHealthStore.getState().history[19]!.timestamp).toBe(24)
    })
  })

  describe('startMonitoring / stopMonitoring', () => {
    it('startMonitoring 应设置 isMonitoring=true 并立即执行一次扫描', () => {
      const snapshot = buildSnapshot()
      mockRunMechanismScan.mockReturnValue(snapshot)

      useMechanismHealthStore.getState().startMonitoring(1000)

      expect(useMechanismHealthStore.getState().isMonitoring).toBe(true)
      // 应立即执行一次 runScan
      expect(mockRunMechanismScan).toHaveBeenCalledTimes(1)
    })

    it('startMonitoring 重复调用应跳过', () => {
      useMechanismHealthStore.setState({ isMonitoring: true })

      useMechanismHealthStore.getState().startMonitoring(1000)

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('stopMonitoring 应清除定时器并设置 isMonitoring=false', () => {
      mockRunMechanismScan.mockReturnValue(buildSnapshot())
      useMechanismHealthStore.getState().startMonitoring(1000)
      expect(useMechanismHealthStore.getState().isMonitoring).toBe(true)

      useMechanismHealthStore.getState().stopMonitoring()

      expect(useMechanismHealthStore.getState().isMonitoring).toBe(false)
    })

    it('startMonitoring 应按间隔定期执行扫描', () => {
      mockRunMechanismScan.mockReturnValue(buildSnapshot())

      useMechanismHealthStore.getState().startMonitoring(5000)

      // 立即执行 1 次
      expect(mockRunMechanismScan).toHaveBeenCalledTimes(1)

      // 推进 5 秒
      vi.advanceTimersByTime(5000)
      expect(mockRunMechanismScan).toHaveBeenCalledTimes(2)

      // 再推进 5 秒
      vi.advanceTimersByTime(5000)
      expect(mockRunMechanismScan).toHaveBeenCalledTimes(3)
    })
  })

  // ============================================================
  // EventBus 订阅（initMechanismSubscriptions）
  // 未覆盖行 134-135, 140-141
  // ============================================================

  describe('initMechanismSubscriptions', () => {
    /** @test_id V9-TEST-ST-MECH-HEALTH-SUB-01 */
    it('订阅 MECHANISM_ALERT_EVENT 后应更新 lastAlertAt', () => {
      // 重新初始化订阅（beforeEach 中 clearAllMocks 已清除之前的调用记录）
      initMechanismSubscriptions()

      const alertCallback = mockEventBusOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'mechanism:alert',
      )?.[1] as (() => void) | undefined
      expect(alertCallback).toBeDefined()

      alertCallback!()

      expect(useMechanismHealthStore.getState().lastAlertAt).toBeGreaterThan(0)
    })

    /** @test_id V9-TEST-ST-MECH-HEALTH-SUB-02 */
    it('订阅 COLLECTION_EVENTS.COMPLETE 后应触发 runScan', () => {
      // 重新初始化订阅
      initMechanismSubscriptions()

      // 查找 collection:complete 事件回调
      const completeCallback = mockEventBusOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'collection:complete',
      )?.[1] as (() => void) | undefined
      expect(completeCallback).toBeDefined()

      mockRunMechanismScan.mockReturnValue(buildSnapshot())

      completeCallback!()

      // 应触发 runScan，latest 被更新
      expect(mockRunMechanismScan).toHaveBeenCalled()
      expect(useMechanismHealthStore.getState().latest).toBeDefined()
    })

    /** @test_id V9-TEST-ST-MECH-HEALTH-SUB-03 */
    it('返回的清理函数应取消所有订阅', () => {
      const cleanup = initMechanismSubscriptions()
      expect(typeof cleanup).toBe('function')
      expect(allUnsubscribers.length).toBeGreaterThanOrEqual(2)

      cleanup()

      // 验证所有 unsubscribe 函数被调用
      allUnsubscribers.forEach((unsub) => {
        expect(unsub).toHaveBeenCalledTimes(1)
      })
    })
  })
})
