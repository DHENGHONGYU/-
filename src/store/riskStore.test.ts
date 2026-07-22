/**
 * @test_id V9-TEST-ST-151
 * riskStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. checkRisk 执行风控检查并更新三态
 * 3. checkRisk 阻塞时自动触发回路开路
 * 4. setCircuitState 手动设置回路状态
 * 5. clearVerdicts 清空裁决记录
 * 6. recentVerdicts 派生查询
 * 7. verdictsBySymbol 按标的查询
 * 8. 裁决记录上限淘汰
 * 9. checkRisk 异常处理
  * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-DATA-046]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCheckOrderRisk } = vi.hoisted(() => {
  const mockCheckOrderRisk = vi.fn()
  return { mockCheckOrderRisk }
})

vi.mock('@/services/trading/riskEngine', () => ({
  checkOrderRisk: mockCheckOrderRisk,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { useRiskStore, recentVerdicts, verdictsBySymbol } from './riskStore'
import type { OrderRiskInput } from '@/services/trading/riskEngine'

function createMockInput(overrides: Partial<OrderRiskInput> = {}): OrderRiskInput {
  return {
    symbol: '000001',
    direction: 'buy',
    quantity: 100,
    price: 10,
    portfolioValue: 100000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useRiskStore.setState({
    triState: 'normal',
    circuitState: 'closed',
    verdicts: [],
    loading: false,
    error: null,
    lastChecked: 0,
  })
})

describe('riskStore', () => {
  it('初始状态正确', () => {
    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.circuitState).toBe('closed')
    expect(state.verdicts).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('checkRisk 正常通过 → triState=normal', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    const input = createMockInput()
    const result = await useRiskStore.getState().checkRisk(input)

    expect(result.ok).toBe(true)
    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.verdicts).toHaveLength(1)
    expect(state.verdicts[0]!.triState).toBe('normal')
    expect(state.loading).toBe(false)
  })

  it('checkRisk 有警告 → triState=warning', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: ['仓位接近上限'], blocks: [] })
    const input = createMockInput()
    await useRiskStore.getState().checkRisk(input)

    const state = useRiskStore.getState()
    expect(state.triState).toBe('warning')
    expect(state.verdicts[0]!.triState).toBe('warning')
  })

  it('checkRisk 有阻塞 → triState=blocked，回路切换为 open', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: false, warnings: [], blocks: ['价格或数量非法'] })
    const input = createMockInput()
    await useRiskStore.getState().checkRisk(input)

    const state = useRiskStore.getState()
    expect(state.triState).toBe('blocked')
    expect(state.circuitState).toBe('open')
  })

  it('checkRisk 异常时返回 fallback 结果', async () => {
    mockCheckOrderRisk.mockRejectedValue(new Error('网络超时'))
    const input = createMockInput()
    const result = await useRiskStore.getState().checkRisk(input)

    expect(result.ok).toBe(false)
    expect(result.blocks).toContain('网络超时')
    const state = useRiskStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('网络超时')
  })

  it('setCircuitState 手动设置回路状态', () => {
    useRiskStore.getState().setCircuitState('half-open')
    expect(useRiskStore.getState().circuitState).toBe('half-open')
  })

  it('clearVerdicts 清空裁决记录', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    await useRiskStore.getState().checkRisk(createMockInput())
    expect(useRiskStore.getState().verdicts).toHaveLength(1)

    useRiskStore.getState().clearVerdicts()
    expect(useRiskStore.getState().verdicts).toHaveLength(0)
  })

  it('reset 将所有关键状态字段重置为初始值', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: false, warnings: [], blocks: ['测试阻塞'] })
    await useRiskStore.getState().checkRisk(createMockInput())
    useRiskStore.getState().setCircuitState('half-open')

    expect(useRiskStore.getState().triState).toBe('blocked')
    expect(useRiskStore.getState().circuitState).toBe('half-open')
    expect(useRiskStore.getState().verdicts).toHaveLength(1)
    expect(useRiskStore.getState().loading).toBe(false)
    expect(useRiskStore.getState().error).toBeNull()
    expect(useRiskStore.getState().lastChecked).toBeGreaterThan(0)

    useRiskStore.getState().reset()

    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.circuitState).toBe('closed')
    expect(state.verdicts).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastChecked).toBe(0)
  })

  it('recentVerdicts 返回最近 N 条', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000001' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000002' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000003' }))

    const recent = recentVerdicts(2)
    expect(recent).toHaveLength(2)
    expect(recent[0]!.symbol).toBe('000003')
  })

  it('verdictsBySymbol 按标的筛选', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000001' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000002' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000001' }))

    const filtered = verdictsBySymbol('000001')
    expect(filtered).toHaveLength(2)
  })

  it('裁决记录超过上限时淘汰最早的', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    for (let i = 0; i < 55; i++) {
      await useRiskStore.getState().checkRisk(createMockInput({ symbol: `SYM-${i}` }))
    }
    expect(useRiskStore.getState().verdicts).toHaveLength(50)
    expect(useRiskStore.getState().verdicts[0]!.symbol).toBe('SYM-54')
  })
})
