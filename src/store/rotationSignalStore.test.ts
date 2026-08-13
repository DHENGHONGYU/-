/**
 * @test_id V9-TEST-ST-152
 * @covers_docs [V9-DOC-ARCH-007, V9-DOC-BACK-015, V9-DOC-BACK-012]
 */
import { describe, test, expect, beforeEach } from 'vitest'
import { useRotationSignalStore, triggeredSignals, bySector } from './rotationSignalStore'

/** 测试用输入数据（独立于 Mock 数据） */
const TEST_INPUTS = [
  {
    sectorId: '银行',
    volume: { history: [...Array(50).fill(60000), 100000, 110000, 120000, 115000, 105000] },
    capitalFlow: { dailyNetFlow: [10, 20, 15, 30, 25] },
    goldenCross: { closes: [...Array(20).fill(105), 100, 100, 100, 100, 130] },
  },
  {
    sectorId: '钢铁',
    volume: { history: [...Array(50).fill(30000), 35000, 32000, 31000, 33000, 34000] },
    capitalFlow: { dailyNetFlow: [5, 3, -2, 8, 2] },
    goldenCross: { closes: [...Array(25).fill(100)] },
  },
]

/** 辅助函数：加载测试数据 */
function loadTestSignals() {
   
  useRotationSignalStore.getState().fetchSignals(TEST_INPUTS as any)
}

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

  test('fetchSignals 无输入返回空结果（不 fallback 到 Mock）', () => {
    useRotationSignalStore.getState().fetchSignals()
    const state = useRotationSignalStore.getState()
    expect(state.signals).toHaveLength(0)
    expect(state.loading).toBe(false)
  })

  test('fetchSignals 中银行板块应触发强信号', () => {
    loadTestSignals()
    const bankSignal = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '银行')
    expect(bankSignal).toBeDefined()
    expect(bankSignal!.triggered).toBe(true)
    expect(bankSignal!.strength).toBe('strong')
  })

  test('fetchSignals 中钢铁板块应未触发', () => {
    loadTestSignals()
    const steelSignal = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '钢铁')
    expect(steelSignal).toBeDefined()
    expect(steelSignal!.triggered).toBe(false)
  })

  test('fetchSignals 中每个信号包含完整条件', () => {
    loadTestSignals()
    const { signals } = useRotationSignalStore.getState()
    expect(signals.length).toBeGreaterThan(0)
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
    useRotationSignalStore.getState().fetchSignals([
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
    loadTestSignals()
    const before = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '银行')
    expect(before).toBeDefined()

    useRotationSignalStore.getState().detectSignal('银行', TEST_INPUTS as any)
    const after = useRotationSignalStore.getState().signals.find((s) => s.sectorId === '银行')
    expect(after!.triggered).toBe(before!.triggered)
  })

  test('detectSignal 不存在的板块无影响', () => {
    loadTestSignals()
    const beforeCount = useRotationSignalStore.getState().signals.length
    useRotationSignalStore.getState().detectSignal('不存在的板块', TEST_INPUTS as any)
    const afterCount = useRotationSignalStore.getState().signals.length
    expect(afterCount).toBe(beforeCount)
  })

  // ============================================================
  // clearSignals
  // ============================================================

  test('clearSignals 清空所有数据', () => {
    loadTestSignals()
    expect(useRotationSignalStore.getState().signals.length).toBeGreaterThan(0)
    useRotationSignalStore.getState().clearSignals()
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
    loadTestSignals()
    const triggered = triggeredSignals()
    for (const signal of triggered) {
      expect(signal.triggered).toBe(true)
    }
  })

  test('bySector 按板块ID查找', () => {
    loadTestSignals()
    const found = bySector('银行')
    expect(found).toBeDefined()
    expect(found!.sectorId).toBe('银行')

    const notFound = bySector('不存在的')
    expect(notFound).toBeUndefined()
  })
})

describe('rotationSignalStore clearSignals', () => {
  test('clearSignals 清空 signals 并恢复初始状态', () => {
    // 先填充数据
    loadTestSignals()
    const now = Date.now()
    useRotationSignalStore.setState({ loading: true, error: 'test error', lastUpdated: now })

    // 验证状态已填充
    const before = useRotationSignalStore.getState()
    expect(before.signals.length).toBeGreaterThan(0)
    expect(before.loading).toBe(true)
    expect(before.error).toBe('test error')
    expect(before.lastUpdated).toBe(now)

    // 执行 clearSignals
    useRotationSignalStore.getState().clearSignals()

    const after = useRotationSignalStore.getState()
    expect(after.signals).toHaveLength(0)
    expect(after.loading).toBe(false)
    expect(after.error).toBeNull()
    expect(after.lastUpdated).toBe(0)
  })
})