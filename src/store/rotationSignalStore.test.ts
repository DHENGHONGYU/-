import { describe, test, expect, beforeEach } from 'vitest'
import { useRotationSignalStore, triggeredSignals, bySector } from './rotationSignalStore'

describe('rotationSignalStore', () => {
  beforeEach(() => {
    useRotationSignalStore.getState().clearSignals()
  })

  // ============================================================
  // 初始状态
  // ============================================================

  test('初始状态为空', () => {
    const state = useRotationSignalStore.getState()
    expect(state.signals).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // fetchSignals
  // ============================================================

  test('fetchSignals 使用默认样本数据', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const state = useRotationSignalStore.getState()
    expect(state.signals.length).toBeGreaterThan(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  test('fetchSignals 中银行板块应触发强信号', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const bankSignal = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '银行')
    expect(bankSignal).toBeDefined()
    expect(bankSignal!.triggered).toBe(true)
    expect(bankSignal!.strength).toBe('strong')
    expect(bankSignal!.conditions.volumeBreakthrough).toBe(true)
    expect(bankSignal!.conditions.capitalInflow).toBe(true)
    expect(bankSignal!.conditions.goldenCross).toBe(true)
  })

  test('fetchSignals 中钢铁板块应未触发', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const steelSignal = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '钢铁')
    expect(steelSignal).toBeDefined()
    expect(steelSignal!.triggered).toBe(false)
  })

  test('fetchSignals 中每个信号包含完整条件', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const { signals } = useRotationSignalStore.getState()
    for (const signal of signals) {
      expect(signal.sectorId).toBeTruthy()
      expect(typeof signal.triggered).toBe('boolean')
      expect(typeof signal.conditions.volumeBreakthrough).toBe('boolean')
      expect(typeof signal.conditions.capitalInflow).toBe('boolean')
      expect(typeof signal.conditions.goldenCross).toBe('boolean')
      expect(signal.strength).toMatch(/^(weak|medium|strong)$/)
      expect(signal.detectedAt).toBeGreaterThan(0)
    }
  })

  test('fetchSignals 支持自定义输入', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals([
      {
        sectorId: 'TEST_SECTOR',
        volume: { history: [...Array(50).fill(1000), 5000, 5000, 5000, 5000, 5000] },
        capitalFlow: { dailyNetFlow: [10, 20, 30] },
        goldenCross: { closes: [...Array(25).fill(100), 105, 110, 110, 110, 110] },
      },
    ])

    const { signals } = useRotationSignalStore.getState()
    expect(signals).toHaveLength(1)
    expect(signals[0]!.sectorId).toBe('TEST_SECTOR')
  })

  // ============================================================
  // detectSignal
  // ============================================================

  test('detectSignal 更新指定板块', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const before = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '银行')
    expect(before).toBeDefined()

    store.detectSignal('银行')
    const after = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '银行')
    expect(after!.triggered).toBe(before!.triggered)
  })

  test('detectSignal 不存在的板块无影响', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()
    const beforeCount = useRotationSignalStore.getState().signals.length

    store.detectSignal('不存在的板块')
    const afterCount = useRotationSignalStore.getState().signals.length
    expect(afterCount).toBe(beforeCount)
  })

  // ============================================================
  // clearSignals
  // ============================================================

  test('clearSignals 清空所有数据', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()
    expect(useRotationSignalStore.getState().signals.length).toBeGreaterThan(0)

    store.clearSignals()
    const state = useRotationSignalStore.getState()
    expect(state.signals).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // Getters
  // ============================================================

  test('triggeredSignals 只返回已触发的信号', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const triggered = triggeredSignals()
    for (const signal of triggered) {
      expect(signal.triggered).toBe(true)
    }
  })

  test('bySector 按板块ID查找', () => {
    const store = useRotationSignalStore.getState()
    store.fetchSignals()

    const found = bySector('银行')
    expect(found).toBeDefined()
    expect(found!.sectorId).toBe('银行')

    const notFound = bySector('不存在的')
    expect(notFound).toBeUndefined()
  })
})