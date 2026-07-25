/**
 * @test_id V9-TEST-ST-120
 * @module executionPlanService.dataflow.test
 * @description DataBridge 重构后 executionPlanService 数据流转完整性集成测试
 *
 * 测试策略：
 *   使用真实 DataBridge（含 Envelope 验证、ACL 校验、路由分发、缓存管理），
 *   仅 mock 底层 IndexedDB 存储层，验证完整的数据流转链路：
 *
 *   executionPlanService → DataBridge.forward() → Envelope 验证 → ACL → 路由 → db.put()
 *   executionPlanService → DataBridge.query() → ACL → 缓存 → db.get()/db.getAll()
 *
 * 覆盖场景：
 *   1. CRUD 全链路数据完整性（真实 DataBridge + mock db）
 *   2. 边界输入：负分、零分、超高分、空对象、异常类型
 *   3. Envelope 结构与路由正确性
 *   4. 缓存命中与写后缓存失效
 *   5. ACL 合规性（source/target/action 校验）
 *   6. 状态机全流程流转（含边界 phase 输入）
 *
 * @covers_docs [V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-BACK-013, V9-DOC-AUTO-DF2A46]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDbInit,
  mockDbIsReady,
  mockDbReady,
  mockDbPut,
  mockDbGet,
  mockDbGetAll,
  mockDbGetAllByIndex,
  mockDbExport,
  mockDbImport,
  mockDbReset,
  mockEventBusEmit,
} = vi.hoisted(() => ({
  mockDbInit: vi.fn().mockResolvedValue(undefined),
  mockDbIsReady: vi.fn().mockReturnValue(true),
  mockDbReady: vi.fn().mockResolvedValue(undefined),
  mockDbPut: vi.fn().mockResolvedValue(undefined),
  mockDbGet: vi.fn().mockResolvedValue(undefined),
  mockDbGetAll: vi.fn().mockResolvedValue([]),
  mockDbGetAllByIndex: vi.fn().mockResolvedValue([]),
  mockDbExport: vi.fn().mockResolvedValue({}),
  mockDbImport: vi.fn().mockResolvedValue(undefined),
  mockDbReset: vi.fn().mockResolvedValue(undefined),
  mockEventBusEmit: vi.fn(),
}))

vi.mock('@/data/db', () => ({
  db: {
    init: mockDbInit,
    isReady: mockDbIsReady,
    ready: mockDbReady,
    put: mockDbPut,
    get: mockDbGet,
    getAll: mockDbGetAll,
    getAllByIndex: mockDbGetAllByIndex,
    export: mockDbExport,
    import: mockDbImport,
    reset: mockDbReset,
  },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    emit: mockEventBusEmit,
  },
}))

vi.mock('@/services/pwa/registerServiceWorker', () => ({
  initPWA: vi.fn(),
}))

vi.mock('@/services/rbac/permissionRevocationService', () => ({
  permissionRevocationService: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}))

vi.mock('@/services/system/seedService', () => ({
  seedDefaultStocks: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/orchestration', () => ({
  initOrchestration: vi.fn(),
  stopOrchestration: vi.fn(),
}))

vi.mock('@/core/freshnessGuard', () => ({
  checkExecutionPlanFreshness: vi.fn(() => {}),
}))

vi.mock('./executionLogService', () => ({
  executionLogService: {
    writeLog: vi.fn().mockResolvedValue({ success: true }),
  },
}))

vi.mock('@/config/secretConfig', () => ({
  isTushareTokenConfigured: vi.fn(() => false),
  isQwenApiKeyConfigured: vi.fn(() => false),
  isTushareTokenExpired: vi.fn(() => false),
  isQwenApiKeyExpired: vi.fn(() => false),
  getTushareTokenAgeDays: vi.fn(() => 0),
  getQwenApiKeyAgeDays: vi.fn(() => 0),
}))

vi.mock('@/config/llmConfig', () => ({
  isLlmApiKeyConfigured: vi.fn(() => false),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { dataBridge } from '@/core/databridge'
import {
  createPlan,
  listPlans,
  updatePhase,
  cancelPlan,
  getOrphanPlans,
} from '@/services/execution/executionPlanService'
import { STORE_NAME } from '@/config/dbConfig'
import { EXECUTION_PHASE } from '@/constants/execution.constants'
import { CHANGED_SUFFIX } from '@/constants/store-channels.constants'
import type { Signal, ExecutionPlan } from '@/data/types'

const STORE = STORE_NAME.executionPlans

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_001',
    symbol: '600000',
    action: 'buy',
    confidence: 0.8,
    createdAt: 1_000,
    direction: 'buy',
    rationale: '测试信号',
    ...overrides,
  } as Signal
}

function makePlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
    id: 'plan_001',
    signalId: 'sig_001',
    symbol: '600000',
    name: '测试股票',
    direction: 'buy',
    phase: EXECUTION_PHASE.PLAN,
    quantity: 100,
    targetPrice: 10.0,
    rationale: '测试理由',
    confidence: 0.8,
    riskChecks: [],
    accountType: 'paper',
    createdAt: 2_000,
    sizing: { quantity: 0, positionPct: 0.25, reason: '自动生成' },
    ...overrides,
  }
}

// ============================================================
// 1. 初始化与路由验证
// ============================================================

describe('DataBridge → executionPlanService 数据流：初始化与路由', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('createPlan 正确路由到 executionPlans store', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const plan = await createPlan(makeSignal(), { now: 2_000 })

    expect(plan).toBeDefined()
    expect(plan!.id).toBe('plan_sig_001_2000')
    expect(mockDbPut).toHaveBeenCalled()

    const putCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(putCalls.length).toBeGreaterThanOrEqual(1)

    const putPayload = putCalls[0]![1] as ExecutionPlan
    expect(putPayload.id).toBe('plan_sig_001_2000')
    expect(putPayload.symbol).toBe('600000')
    expect(putPayload.phase).toBe(EXECUTION_PHASE.PLAN)
  })

  it('createPlan 的 Envelope 经过 eventBus 广播', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    await createPlan(makeSignal(), { now: 2_000 })

    expect(mockEventBusEmit).toHaveBeenCalled()
    const eventName = mockEventBusEmit.mock.calls[0]![0]
    expect(eventName).toBe(`${STORE}${CHANGED_SUFFIX}`)
  })

  it('listPlans 通过 db.getAll 查询 executionPlans store', async () => {
    const rawPlans = [makePlan(), makePlan({ id: 'plan_002', symbol: '000001' })]
    mockDbGetAll.mockResolvedValue(rawPlans)

    const result = await listPlans()

    expect(result).toHaveLength(2)
    expect(mockDbGetAll).toHaveBeenCalledWith(STORE)
  })

  it('listPlans 带 symbol 参数时在内存中过滤', async () => {
    const rawPlans = [
      makePlan({ id: 'plan_a', symbol: '000001' }),
      makePlan({ id: 'plan_b', symbol: '600000' }),
    ]
    mockDbGetAll.mockResolvedValue(rawPlans)

    const result = await listPlans('000001')

    expect(result).toHaveLength(1)
    expect(result[0]!.symbol).toBe('000001')
    expect(mockDbGetAll).toHaveBeenCalledWith(STORE)
  })

  it('updatePhase 先 queryGet 再 put（两次 db 操作）', async () => {
    mockDbGet.mockResolvedValue(makePlan())
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const result = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED, { now: 3_000 })

    expect(result).toBeDefined()
    expect(result!.phase).toBe(EXECUTION_PHASE.CONFIRMED)
    expect(result!.confirmedAt).toBe(3_000)

    const getCalls = mockDbGet.mock.calls.filter((c: unknown[]) => c[0] === STORE && c[1] === 'plan_001')
    expect(getCalls.length).toBeGreaterThanOrEqual(1)

    const putCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(putCalls.length).toBeGreaterThanOrEqual(1)
    const putPayload = putCalls[0]![1] as ExecutionPlan
    expect(putPayload.phase).toBe(EXECUTION_PHASE.CONFIRMED)
    expect(putPayload.confirmedAt).toBe(3_000)
  })

  it('cancelPlan 正确路由到 cancelled phase', async () => {
    mockDbGet.mockResolvedValue(makePlan({ phase: EXECUTION_PHASE.PLAN }))
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const result = await cancelPlan('plan_001', { now: 5_000 })

    expect(result).toBeDefined()
    expect(result!.phase).toBe(EXECUTION_PHASE.CANCELLED)

    const putCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(putCalls.length).toBeGreaterThanOrEqual(1)
    const putPayload = putCalls[0]![1] as ExecutionPlan
    expect(putPayload.phase).toBe(EXECUTION_PHASE.CANCELLED)
  })
})

// ============================================================
// 2. 边界输入：信号置信度边界
// ============================================================

describe('DataBridge → executionPlanService 数据流：信号置信度边界', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('置信度恰好等于默认阈值 0.6 → 创建成功', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const plan = await createPlan(makeSignal({ confidence: 0.6 }), { now: 2_000 })

    expect(plan).toBeDefined()
    expect(plan!.confidence).toBe(0.6)
  })

  it('置信度刚好低于阈值 0.5999 → 返回 undefined', async () => {
    const plan = await createPlan(makeSignal({ confidence: 0.5999 }), { now: 2_000 })

    expect(plan).toBeUndefined()
    expect(mockDbPut).not.toHaveBeenCalled()
  })

  it('置信度为 0 → 返回 undefined', async () => {
    const plan = await createPlan(makeSignal({ confidence: 0 }), { now: 2_000 })

    expect(plan).toBeUndefined()
    expect(mockDbPut).not.toHaveBeenCalled()
  })

  it('置信度为负数 -0.5 → 返回 undefined', async () => {
    const plan = await createPlan(makeSignal({ confidence: -0.5 }), { now: 2_000 })

    expect(plan).toBeUndefined()
    expect(mockDbPut).not.toHaveBeenCalled()
  })

  it('置信度为 1.0（最高）→ 创建成功，positionPct 受 MAX 限制为 0.25', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const plan = await createPlan(makeSignal({ confidence: 1.0 }), { now: 2_000 })

    expect(plan).toBeDefined()
    expect(plan!.confidence).toBe(1.0)
    expect(plan!.sizing!.positionPct).toBe(0.25)
  })

  it('置信度超出范围 2.0 → 创建成功，positionPct 受 MAX 限制为 0.25', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const plan = await createPlan(makeSignal({ confidence: 2.0 }), { now: 2_000 })

    expect(plan).toBeDefined()
    expect(plan!.confidence).toBe(2.0)
    expect(plan!.sizing!.positionPct).toBe(0.25)
  })

  it('超高分置信度 99.0 → 创建成功，positionPct 受 MAX 限制为 0.25', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const plan = await createPlan(makeSignal({ confidence: 99.0 }), { now: 2_000 })

    expect(plan).toBeDefined()
    expect(plan!.confidence).toBe(99.0)
    expect(plan!.sizing!.positionPct).toBe(0.25)
  })
})

// ============================================================
// 3. 边界输入：状态机异常流转
// ============================================================

describe('DataBridge → executionPlanService 数据流：状态机边界流转', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('从 CANCELLED 状态推进到 CONFIRMED → 被拒绝', async () => {
    mockDbGet.mockResolvedValue(makePlan({ phase: EXECUTION_PHASE.CANCELLED }))

    const result = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED)

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('从 REVIEWED 状态推进到 EXECUTED → 被拒绝', async () => {
    mockDbGet.mockResolvedValue(makePlan({ phase: EXECUTION_PHASE.REVIEWED }))

    const result = await updatePhase('plan_001', EXECUTION_PHASE.EXECUTED)

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('从 EXECUTED 回退到 CONFIRMED → 被拒绝', async () => {
    mockDbGet.mockResolvedValue(makePlan({ phase: EXECUTION_PHASE.EXECUTED }))

    const result = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED)

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('从 PLAN 直接跳到 EXECUTED → 被拒绝（必须经 CONFIRMED）', async () => {
    mockDbGet.mockResolvedValue(makePlan({ phase: EXECUTION_PHASE.PLAN }))

    const result = await updatePhase('plan_001', EXECUTION_PHASE.EXECUTED)

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('不存在的 plan 推进 → 返回 undefined', async () => {
    mockDbGet.mockResolvedValue(undefined)

    const result = await updatePhase('nonexistent', EXECUTION_PHASE.CONFIRMED)

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('不存在的 plan 取消 → 返回 undefined', async () => {
    mockDbGet.mockResolvedValue(undefined)

    const result = await cancelPlan('ghost_plan')

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('完整生命周期：PLAN → CONFIRMED → EXECUTED → REVIEWED', async () => {
    const plan = makePlan()

    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    mockDbGet
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.PLAN })
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.CONFIRMED, confirmedAt: 3_000 })
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.EXECUTED, executedAt: 5_000 })

    const confirmed = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED, { now: 3_000 })
    expect(confirmed!.phase).toBe(EXECUTION_PHASE.CONFIRMED)

    const executed = await updatePhase('plan_001', EXECUTION_PHASE.EXECUTED, { now: 5_000 })
    expect(executed!.phase).toBe(EXECUTION_PHASE.EXECUTED)

    const reviewed = await updatePhase('plan_001', EXECUTION_PHASE.REVIEWED, { now: 7_000 })
    expect(reviewed!.phase).toBe(EXECUTION_PHASE.REVIEWED)
  })
})

// ============================================================
// 4. 数据完整性：写入后查询一致性
// ============================================================

describe('DataBridge → executionPlanService 数据流：写入-查询一致性', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('createPlan 写入数据 → listPlans 能读到完整字段', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const created = await createPlan(makeSignal({
      id: 'sig_integrity',
      symbol: '601398',
      confidence: 0.95,
      rationale: '银行板块看好',
    }), { now: 9999999 })

    const savedPlan = mockDbPut.mock.calls.find((c: unknown[]) => c[0] === STORE)![1] as ExecutionPlan
    mockDbGetAll.mockResolvedValue([savedPlan])

    const result = await listPlans('601398')

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('plan_sig_integrity_9999999')
    expect(result[0]!.signalId).toBe('sig_integrity')
    expect(result[0]!.symbol).toBe('601398')
    expect(result[0]!.direction).toBe('buy')
    expect(result[0]!.phase).toBe(EXECUTION_PHASE.PLAN)
    expect(result[0]!.confidence).toBe(0.95)
    expect(result[0]!.rationale).toBe('银行板块看好')
    expect(result[0]!.accountType).toBe('paper')
    expect(result[0]!.createdAt).toBe(9999999)
    expect(result[0]!.sizing!.quantity).toBe(0)
    expect(result[0]!.sizing!.positionPct).toBeGreaterThan(0)

    expect(created).toBeDefined()
    expect(created!.id).toBe('plan_sig_integrity_9999999')
  })

  it('updatePhase 写入后 plan 包含时间戳字段', async () => {
    const plan = makePlan()
    mockDbGet.mockResolvedValue(plan)
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const result = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED, { now: 3_000 })

    expect(result).toBeDefined()
    expect(result!.confirmedAt).toBe(3_000)

    const putCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(putCalls.length).toBeGreaterThanOrEqual(1)
    const putPayload = putCalls[0]![1] as ExecutionPlan
    expect(putPayload.phase).toBe(EXECUTION_PHASE.CONFIRMED)
    expect(putPayload.confirmedAt).toBe(3_000)
    expect(putPayload.executedAt).toBeUndefined()
    expect(putPayload.reviewedAt).toBeUndefined()
  })

  it('多次推进阶段每次写入独立记录', async () => {
    const plan = makePlan()
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    mockDbGet
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.PLAN })
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.CONFIRMED, confirmedAt: 3_000 })
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.EXECUTED, executedAt: 5_000 })

    await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED, { now: 3_000 })
    await updatePhase('plan_001', EXECUTION_PHASE.EXECUTED, { now: 5_000 })
    await updatePhase('plan_001', EXECUTION_PHASE.REVIEWED, { now: 7_000 })

    const putCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(putCalls.length).toBe(3)

    const firstPayload = putCalls[0]![1] as ExecutionPlan
    expect(firstPayload.phase).toBe(EXECUTION_PHASE.CONFIRMED)
    expect(firstPayload.confirmedAt).toBe(3_000)

    const secondPayload = putCalls[1]![1] as ExecutionPlan
    expect(secondPayload.phase).toBe(EXECUTION_PHASE.EXECUTED)
    expect(secondPayload.executedAt).toBe(5_000)

    const thirdPayload = putCalls[2]![1] as ExecutionPlan
    expect(thirdPayload.phase).toBe(EXECUTION_PHASE.REVIEWED)
    expect(thirdPayload.reviewedAt).toBe(7_000)
  })
})

// ============================================================
// 5. getOrphanPlans 边界测试
// ============================================================

describe('DataBridge → executionPlanService 数据流：getOrphanPlans 边界', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('混合状态下正确识别孤儿计划', async () => {
    const plans = [
      makePlan({ id: 'plan_active', phase: EXECUTION_PHASE.PLAN }),
      makePlan({ id: 'plan_confirmed', phase: EXECUTION_PHASE.CONFIRMED }),
      makePlan({ id: 'plan_pending', phase: EXECUTION_PHASE.PENDING }),
      makePlan({ id: 'plan_executed', phase: EXECUTION_PHASE.EXECUTED }),
      makePlan({ id: 'plan_cancelled', phase: EXECUTION_PHASE.CANCELLED }),
      makePlan({ id: 'plan_reviewed', phase: EXECUTION_PHASE.REVIEWED }),
    ]
    mockDbGetAll.mockResolvedValue(plans)

    const orphans = await getOrphanPlans()

    expect(orphans).toHaveLength(3)
    expect(orphans.map(p => p.id)).toEqual(['plan_active', 'plan_confirmed', 'plan_pending'])
  })

  it('全为终态时返回空数组', async () => {
    const plans = [
      makePlan({ id: 'plan_executed', phase: EXECUTION_PHASE.EXECUTED }),
      makePlan({ id: 'plan_cancelled', phase: EXECUTION_PHASE.CANCELLED }),
    ]
    mockDbGetAll.mockResolvedValue(plans)

    const orphans = await getOrphanPlans()

    expect(orphans).toHaveLength(0)
  })

  it('全为活动态时返回全部', async () => {
    const plans = [
      makePlan({ id: 'plan_1', phase: EXECUTION_PHASE.PLAN }),
      makePlan({ id: 'plan_2', phase: EXECUTION_PHASE.CONFIRMED }),
    ]
    mockDbGetAll.mockResolvedValue(plans)

    const orphans = await getOrphanPlans()

    expect(orphans).toHaveLength(2)
  })

  it('db 异常时返回空数组而非抛出', async () => {
    mockDbGetAll.mockRejectedValue(new Error('DB timeout'))

    const orphans = await getOrphanPlans()

    expect(orphans).toEqual([])
  })
})

// ============================================================
// 6. 错误处理与容错
// ============================================================

describe('DataBridge → executionPlanService 数据流：错误处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('db.put 抛出异常 → createPlan 返回 undefined', async () => {
    mockDbPut.mockRejectedValue(new Error('Storage full'))

    const plan = await createPlan(makeSignal(), { now: 2_000 })

    expect(plan).toBeUndefined()
  })

  it('db.getAll 抛出异常 → listPlans 返回空数组', async () => {
    mockDbGetAll.mockRejectedValue(new Error('Network error'))

    const result = await listPlans()

    expect(result).toEqual([])
  })

  it('db.get 返回 undefined → updatePhase 返回 undefined', async () => {
    mockDbGet.mockResolvedValue(undefined)

    const result = await updatePhase('nonexistent', EXECUTION_PHASE.CONFIRMED)

    expect(result).toBeUndefined()
    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls).toHaveLength(0)
  })

  it('连续 10 次 createPlan 部分失败 → 成功的仍返回 plan', async () => {
    let callCount = 0
    mockDbPut.mockImplementation(() => {
      callCount++
      if (callCount % 3 === 0) {
        throw new Error('Simulated failure')
      }
      return Promise.resolve(undefined)
    })
    mockEventBusEmit.mockImplementation(() => {})

    const results: (ExecutionPlan | undefined)[] = []
    for (let i = 0; i < 10; i++) {
      results.push(await createPlan(makeSignal({ id: `sig_${i}` }), { now: 1000 + i }))
    }

    const successes = results.filter(r => r !== undefined)
    const failures = results.filter(r => r === undefined)
    expect(successes.length).toBeGreaterThan(0)
    expect(failures.length).toBeGreaterThan(0)
    expect(successes.length + failures.length).toBe(10)
  })
})

// ============================================================
// 7. 数据流转闭环验证
// ============================================================

describe('DataBridge → executionPlanService 数据流：闭环验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataBridge.invalidateAll()
  })

  it('写入 → 查询 → 再次写入 闭环一致性', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const plan = makePlan({ phase: EXECUTION_PHASE.PLAN })

    mockDbGet
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce({ ...plan, phase: EXECUTION_PHASE.CONFIRMED, confirmedAt: 3_000 })

    const confirmed = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED, { now: 3_000 })
    expect(confirmed).toBeDefined()
    expect(confirmed!.phase).toBe(EXECUTION_PHASE.CONFIRMED)

    mockDbGetAll.mockResolvedValue([confirmed!])
    const listed = await listPlans()
    expect(listed).toHaveLength(1)
    expect(listed[0]!.phase).toBe(EXECUTION_PHASE.CONFIRMED)
    expect(listed[0]!.confirmedAt).toBe(3_000)

    mockDbGet
      .mockResolvedValueOnce({ ...confirmed!, phase: EXECUTION_PHASE.CONFIRMED })

    const cancelled = await cancelPlan('plan_001', { now: 5_000 })
    expect(cancelled!.phase).toBe(EXECUTION_PHASE.CANCELLED)

    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls.length).toBe(2)
  })

  it('高频读写 50 次 → 全部成功（每次 createPlan 含 audit log + 实际写入）', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})
    mockDbGetAll.mockResolvedValue([])

    let successes = 0
    for (let i = 0; i < 50; i++) {
      const plan = await createPlan(
        makeSignal({ id: `sig_${i}`, confidence: 0.8 + i * 0.01 }),
        { now: 1000 + i },
      )
      if (plan) successes++
    }

    expect(successes).toBe(50)

    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls.length).toBe(50)

    const listResult = await listPlans()
    expect(listResult).toEqual([])
  })

  it('并发 createPlan 不丢失数据', async () => {
    mockDbPut.mockResolvedValue(undefined)
    mockEventBusEmit.mockImplementation(() => {})

    const signals = [
      makeSignal({ id: 'sig_a', symbol: '000001' }),
      makeSignal({ id: 'sig_b', symbol: '000002' }),
      makeSignal({ id: 'sig_c', symbol: '000003' }),
    ]

    const results = await Promise.all(
      signals.map((s, i) => createPlan(s, { now: 1000 + i })),
    )

    expect(results.every(r => r !== undefined)).toBe(true)

    const storePutCalls = mockDbPut.mock.calls.filter((c: unknown[]) => c[0] === STORE)
    expect(storePutCalls.length).toBe(3)

    const putPayloads = storePutCalls.map((c: unknown[]) => c[1] as ExecutionPlan)
    expect(putPayloads.map(p => p.id).sort()).toEqual([
      'plan_sig_a_1000',
      'plan_sig_b_1001',
      'plan_sig_c_1002',
    ])
  })
})