/**
 * @test_id V9-TEST-UT-086
 * sevenDimConfigStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. 策略模板切换（5个模板 × 维度数验证）
 * 3. 维度开关（toggleDimension）
 * 4. 维度频率/数据源修改
 * 5. 全局参数（标的数/历史天数）边界值
 * 6. 派生计算（enabledCount / monthlyCallEstimate / isClickable）
 * 7. 异步操作（saveConfig / runCollection）
 * 8. reset / clearError
  * @covers_docs [V9-DOC-BACK-006, V9-DOC-ARCH-009, V9-DOC-BACK-010, V9-DOC-BACK-003]
*/

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { STRATEGY_TEMPLATES, GLOBAL_LIMITS, DIMENSION_COUNT } from '@/config/collectConfig'
import { seedDefaultPool, clearIntentionPool } from '../utils/seedTestData'

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
    runBatchTrace: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/store/collectionRuntimeStore', async () => {
  const actual = await vi.importActual<typeof import('@/store/collectionRuntimeStore')>(
    '@/store/collectionRuntimeStore',
  )
  return {
    ...actual,
    // runCollection 只调用 getState().setRunning()
  }
})

beforeEach(() => {
  useSevenDimConfigStore.getState().reset()
})

describe('sevenDimConfigStore - 初始状态', () => {
  it('activeTemplate 初始为 "full"', () => {
    expect(useSevenDimConfigStore.getState().activeTemplate).toBe('full')
  })

  it(`dimensions 包含 ${DIMENSION_COUNT} 个维度`, () => {
    expect(useSevenDimConfigStore.getState().dimensions).toHaveLength(DIMENSION_COUNT)
  })

  it('symbolCount 初始为 40', () => {
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(40)
  })

  it('historyDays 初始为 252', () => {
    expect(useSevenDimConfigStore.getState().historyDays).toBe(252)
  })

  it('isDirty 初始为 false', () => {
    expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
  })

  it('isSaving / isCollecting 初始为 false', () => {
    const state = useSevenDimConfigStore.getState()
    expect(state.isSaving).toBe(false)
    expect(state.isCollecting).toBe(false)
  })

  it('error 初始为 null', () => {
    expect(useSevenDimConfigStore.getState().error).toBe(null)
  })

  it('collectProgress 初始为 0', () => {
    expect(useSevenDimConfigStore.getState().collectProgress).toBe(0)
  })
})

describe('sevenDimConfigStore - 策略模板切换', () => {
  it(`full 模板启用 ${DIMENSION_COUNT} 个维度 (01-16)`, () => {
    const state = useSevenDimConfigStore.getState()
    expect(state.enabledCount()).toBe(DIMENSION_COUNT)
    const enabledCodes = state.dimensions.filter((d) => d.enabled).map((d) => d.code)
    const fullTemplate = STRATEGY_TEMPLATES.find((t) => t.id === 'full')!
    // DEFAULT_DIMENSIONS 与 full 模板的 code 顺序不同，按集合比较
    expect([...enabledCodes].sort()).toEqual([...fullTemplate.dimensions].sort())
  })

  it('切换到 growth 模板启用 5 个维度', () => {
    useSevenDimConfigStore.getState().applyTemplate('growth')
    const state = useSevenDimConfigStore.getState()
    expect(state.activeTemplate).toBe('growth')
    expect(state.enabledCount()).toBe(5)
  })

  it('切换到 defense 模板启用 4 个维度', () => {
    useSevenDimConfigStore.getState().applyTemplate('defense')
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(4)
  })

  it('切换到 cycle 模板启用对应维度', () => {
    useSevenDimConfigStore.getState().applyTemplate('cycle')
    const cycleTemplate = STRATEGY_TEMPLATES.find((t) => t.id === 'cycle')!
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(cycleTemplate.dimensions.length)
  })

  it(`切换到 full 模板启用全部 ${DIMENSION_COUNT} 个维度`, () => {
    useSevenDimConfigStore.getState().applyTemplate('full')
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(DIMENSION_COUNT)
  })

  it('切换模板后 isDirty 变为 true', () => {
    useSevenDimConfigStore.getState().applyTemplate('growth')
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
  })

  it('切换模板后 historyDays 同步更新', () => {
    useSevenDimConfigStore.getState().applyTemplate('full')
    const fullTemplate = STRATEGY_TEMPLATES.find((t) => t.id === 'full')!
    expect(useSevenDimConfigStore.getState().historyDays).toBe(fullTemplate.historyDays)
  })

  it('切换到 defense 后 historyDays 为 504', () => {
    useSevenDimConfigStore.getState().applyTemplate('defense')
    expect(useSevenDimConfigStore.getState().historyDays).toBe(504)
  })

  it('无效模板ID不修改状态', () => {
    const beforeState = useSevenDimConfigStore.getState().activeTemplate
    useSevenDimConfigStore.getState().applyTemplate('invalid' as never)
    expect(useSevenDimConfigStore.getState().activeTemplate).toBe(beforeState)
  })
})

describe('sevenDimConfigStore - 维度开关', () => {
  it('禁用已启用维度 (01)', () => {
    useSevenDimConfigStore.getState().toggleDimension('01')
    const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')
    expect(dim?.enabled).toBe(false)
  })

  it('切换维度开关 (01)', () => {
    // full 模板默认全部启用，切换 01 会禁用它
    const wasEnabled = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')!.enabled
    useSevenDimConfigStore.getState().toggleDimension('01')
    const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')
    expect(dim?.enabled).toBe(!wasEnabled)
  })

  it('切换后 isDirty 变为 true', () => {
    useSevenDimConfigStore.getState().toggleDimension('01')
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
  })

  it('连续切换同一维度恢复原状', () => {
    const original = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')!.enabled
    useSevenDimConfigStore.getState().toggleDimension('01')
    useSevenDimConfigStore.getState().toggleDimension('01')
    const restored = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')!.enabled
    expect(restored).toBe(original)
  })

  it('切换不存在的维度code不影响其他维度', () => {
    const beforeCount = useSevenDimConfigStore.getState().enabledCount()
    useSevenDimConfigStore.getState().toggleDimension('99')
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(beforeCount)
  })

  it('full 模板下禁用全部维度后 enabledCount 为 0', () => {
    useSevenDimConfigStore.getState().applyTemplate('full')
    const allCodes = useSevenDimConfigStore.getState().dimensions.map((d) => d.code)
    for (const code of allCodes) {
      useSevenDimConfigStore.getState().toggleDimension(code)
    }
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(0)
  })
})

describe('sevenDimConfigStore - 维度频率与数据源', () => {
  it('设置维度频率', () => {
    useSevenDimConfigStore.getState().setDimensionFrequency('01', 'weekly')
    const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')
    expect(dim?.frequency).toBe('weekly')
  })

  it('设置频率后 isDirty 变为 true', () => {
    useSevenDimConfigStore.getState().setDimensionFrequency('01', 'daily')
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
  })

  it('设置维度数据源', () => {
    useSevenDimConfigStore.getState().setDimensionSources('02', ['akshare', 'yahoo'])
    const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '02')
    expect(dim?.sources).toEqual(['akshare', 'yahoo'])
  })

  it('设置数据源后 isDirty 变为 true', () => {
    useSevenDimConfigStore.getState().setDimensionSources('03', ['ifind'])
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
  })

  it('修改不存在的维度频率不影响其他维度', () => {
    const beforeFreq = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')!.frequency
    useSevenDimConfigStore.getState().setDimensionFrequency('99', 'realtime')
    const afterFreq = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === '01')!.frequency
    expect(afterFreq).toBe(beforeFreq)
  })
})

describe('sevenDimConfigStore - 全局参数', () => {
  it('设置标的数为 100', () => {
    useSevenDimConfigStore.getState().setSymbolCount(100)
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(100)
  })

  it('标的数设置后 isDirty 变为 true', () => {
    useSevenDimConfigStore.getState().setSymbolCount(50)
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
  })

  it('标的数下限为 1（传入 0 被钳制）', () => {
    useSevenDimConfigStore.getState().setSymbolCount(0)
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(1)
  })

  it('标的数下限为 1（传入负数被钳制）', () => {
    useSevenDimConfigStore.getState().setSymbolCount(-10)
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(1)
  })

  it('标的数上限为 maxSymbols', () => {
    useSevenDimConfigStore.getState().setSymbolCount(GLOBAL_LIMITS.maxSymbols + 100)
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(GLOBAL_LIMITS.maxSymbols)
  })

  it('设置历史天数为 500', () => {
    useSevenDimConfigStore.getState().setHistoryDays(500)
    expect(useSevenDimConfigStore.getState().historyDays).toBe(500)
  })

  it('历史天数下限为 1', () => {
    useSevenDimConfigStore.getState().setHistoryDays(0)
    expect(useSevenDimConfigStore.getState().historyDays).toBe(1)
  })

  it('历史天数上限为 1000', () => {
    useSevenDimConfigStore.getState().setHistoryDays(2000)
    expect(useSevenDimConfigStore.getState().historyDays).toBe(1000)
  })
})

describe('sevenDimConfigStore - 派生计算', () => {
  it('enabledCount 正确反映启用维度数', () => {
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(DIMENSION_COUNT)
    useSevenDimConfigStore.getState().toggleDimension('01')
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(DIMENSION_COUNT - 1)
  })

  it('monthlyCallEstimate 大于 0（有启用维度时）', () => {
    expect(useSevenDimConfigStore.getState().monthlyCallEstimate()).toBeGreaterThan(0)
  })

  it('monthlyCallEstimate 为 0（全部禁用时）', () => {
    useSevenDimConfigStore.getState().applyTemplate('value')
    const dims = useSevenDimConfigStore.getState().dimensions
    for (const dim of dims) {
      if (dim.enabled) useSevenDimConfigStore.getState().toggleDimension(dim.code)
    }
    expect(useSevenDimConfigStore.getState().monthlyCallEstimate()).toBe(0)
  })

  it('isClickable 初始为 true', () => {
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(true)
  })

  it('isClickable 在 isSaving 时为 false', () => {
    useSevenDimConfigStore.setState({ isSaving: true })
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)
  })

  it('isClickable 在 isCollecting 时为 false', () => {
    useSevenDimConfigStore.setState({ collectingDimensions: ['01'] })
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)
  })

  it('tooltipText 在 isSaving 时返回保存提示', () => {
    useSevenDimConfigStore.setState({ isSaving: true, isCollecting: false })
    expect(useSevenDimConfigStore.getState().tooltipText()).toContain('保存')
  })

  it('tooltipText 在 isCollecting 时返回采集提示', () => {
    useSevenDimConfigStore.setState({ isSaving: false, collectingDimensions: ['01'] })
    expect(useSevenDimConfigStore.getState().tooltipText()).toContain('采集')
  })

  it('tooltipText 在空闲时返回空字符串', () => {
    useSevenDimConfigStore.setState({ isSaving: false, isCollecting: false })
    expect(useSevenDimConfigStore.getState().tooltipText()).toBe('')
  })
})

describe('sevenDimConfigStore - reset', () => {
  it('reset 恢复 activeTemplate 为 full', () => {
    useSevenDimConfigStore.getState().applyTemplate('value')
    useSevenDimConfigStore.getState().reset()
    expect(useSevenDimConfigStore.getState().activeTemplate).toBe('full')
  })

  it('reset 恢复 symbolCount 为 40', () => {
    useSevenDimConfigStore.getState().setSymbolCount(200)
    useSevenDimConfigStore.getState().reset()
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(40)
  })

  it('reset 恢复 historyDays 为 252', () => {
    useSevenDimConfigStore.getState().setHistoryDays(756)
    useSevenDimConfigStore.getState().reset()
    expect(useSevenDimConfigStore.getState().historyDays).toBe(252)
  })

  it('reset 恢复 isDirty 为 false', () => {
    useSevenDimConfigStore.getState().toggleDimension('01') // 禁用 01（full 模板默认启用）
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    useSevenDimConfigStore.getState().reset()
    expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
  })

  it('reset 清除 error', () => {
    useSevenDimConfigStore.setState({ error: '测试错误' })
    useSevenDimConfigStore.getState().reset()
    expect(useSevenDimConfigStore.getState().error).toBe(null)
  })

  it(`reset 恢复 enabledCount 为 ${DIMENSION_COUNT}（full 模板）`, () => {
    useSevenDimConfigStore.getState().applyTemplate('value')
    useSevenDimConfigStore.getState().reset()
    expect(useSevenDimConfigStore.getState().enabledCount()).toBe(DIMENSION_COUNT)
  })
})

describe('sevenDimConfigStore - saveConfig', () => {
  it('保存成功后 isSaving 恢复 false', async () => {
    await useSevenDimConfigStore.getState().saveConfig()
    expect(useSevenDimConfigStore.getState().isSaving).toBe(false)
  })

  it('保存成功后 isDirty 恢复 false', async () => {
    useSevenDimConfigStore.getState().toggleDimension('01')
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    await useSevenDimConfigStore.getState().saveConfig()
    expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
  })

  it('isSaving 时重复调用不执行', async () => {
    useSevenDimConfigStore.setState({ isSaving: true })
    await useSevenDimConfigStore.getState().saveConfig()
    // 仍然 isSaving=true，因为被拦截
    expect(useSevenDimConfigStore.getState().isSaving).toBe(true)
  })
})

describe('sevenDimConfigStore - runCollection', () => {
  beforeEach(() => {
    seedDefaultPool()
  })

  it('采集完成后 isCollecting 恢复 false', async () => {
    await useSevenDimConfigStore.getState().runCollection()
    expect(useSevenDimConfigStore.getState().isCollecting).toBe(false)
  })

  it('采集完成后 collectProgress 为 100', async () => {
    await useSevenDimConfigStore.getState().runCollection()
    expect(useSevenDimConfigStore.getState().collectProgress).toBe(100)
  })

  it('isCollecting 时重复调用不执行', async () => {
    useSevenDimConfigStore.setState({ isCollecting: true, collectingDimensions: ['01'] })
    await useSevenDimConfigStore.getState().runCollection()
    expect(useSevenDimConfigStore.getState().isCollecting).toBe(true)
  })
})

describe('sevenDimConfigStore - clearError', () => {
  it('clearError 清除错误信息', () => {
    useSevenDimConfigStore.setState({ error: '测试错误' })
    useSevenDimConfigStore.getState().clearError()
    expect(useSevenDimConfigStore.getState().error).toBe(null)
  })
})

describe('联动测试 — 数据链路 ↔ 按钮状态 (S1)', () => {
  beforeEach(() => {
    useSevenDimConfigStore.getState().reset()
    seedDefaultPool()
  })

  // === S1.1: 采集中全局按钮不可点击，完成后恢复 ===
  it('S1.1 采集中全局按钮不可点击，完成后恢复', async () => {
    const collectPromise = useSevenDimConfigStore.getState().runCollection()

    // 采集启动后按钮应立即锁定
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)

    await collectPromise

    // 采集完成后按钮应恢复
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(true)
    expect(useSevenDimConfigStore.getState().collectProgress).toBe(100)
    expect(useSevenDimConfigStore.getState().isCollecting).toBe(false)
  })

  // === S1.2: 维度级锁定 ===
  it('S1.2 维度级锁定：01 采集时不影响 02 按钮', () => {
    useSevenDimConfigStore.setState({ collectingDimensions: ['01'] })

    expect(useSevenDimConfigStore.getState().isClickable('01')).toBe(false)
    expect(useSevenDimConfigStore.getState().isClickable('02')).toBe(true)
    // 无参查询应返回 false（有维度在采集中）
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)
  })

  // === S1.3: tooltipText 维度级提示 ===
  it('S1.3 tooltipText 按维度显示不同提示', () => {
    useSevenDimConfigStore.setState({ collectingDimensions: ['01', '03'] })

    const text01 = useSevenDimConfigStore.getState().tooltipText('01')
    const text02 = useSevenDimConfigStore.getState().tooltipText('02')
    const textNoArg = useSevenDimConfigStore.getState().tooltipText()

    expect(text01).toContain('01')
    expect(text01).toContain('采集')
    expect(text02).toBe('')
    expect(textNoArg).toContain('01')
    expect(textNoArg).toContain('03')
  })

  // === S1.4: 空意向池不锁定按钮 ===
  it('S1.4 空意向池时按钮不被错误锁定', async () => {
    clearIntentionPool()
    await useSevenDimConfigStore.getState().runCollection()

    // 无标的可采集，应保持未锁定
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(true)
    expect(useSevenDimConfigStore.getState().isCollecting).toBe(false)
  })

  // === S1.5: 无启用维度时不锁定 ===
  it('S1.5 无启用维度时不锁定按钮', async () => {
    // 关闭所有维度
    const state = useSevenDimConfigStore.getState()
    state.dimensions.forEach((d) => {
      if (d.enabled) useSevenDimConfigStore.getState().toggleDimension(d.code)
    })

    await useSevenDimConfigStore.getState().runCollection()

    // 无可用维度，应保持未锁定
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(true)
    expect(useSevenDimConfigStore.getState().isCollecting).toBe(false)
  })
})

describe('联动测试 — 异常边界 (S3)', () => {
  beforeEach(() => {
    useSevenDimConfigStore.getState().reset()
  })

  // === S3.1: isSaving 优先级 ===
  it('S3.1 isSaving 优先级高于采集 — 按钮不可点击', () => {
    useSevenDimConfigStore.setState({ isSaving: true, collectingDimensions: [] })
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)
    expect(useSevenDimConfigStore.getState().tooltipText()).toContain('保存')
  })

  // === S3.2: 全局锁定 ===
  it('S3.2 collectingDimensions 全满时全局 isClickable 返回 false', () => {
    useSevenDimConfigStore.setState({ collectingDimensions: ['01', '02', '03', '04'] })
    expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)
    // 但具体维度仍是维度级锁定
    expect(useSevenDimConfigStore.getState().isClickable('01')).toBe(false)
    expect(useSevenDimConfigStore.getState().isClickable('05')).toBe(true)
  })

  // === S3.3: 守卫拦截 ===
  it('S3.3 采集进行中重复调用 runCollection 被守卫拦截', () => {
    useSevenDimConfigStore.setState({ collectingDimensions: ['01'], isCollecting: true })

    const beforeDims = [...useSevenDimConfigStore.getState().collectingDimensions]
    useSevenDimConfigStore.getState().runCollection()

    // 状态不应改变（被守卫拦截）
    expect(useSevenDimConfigStore.getState().collectingDimensions).toEqual(beforeDims)
    expect(useSevenDimConfigStore.getState().isCollecting).toBe(true)
  })

  // === S3.4: 并发维度解锁时序 ===
  it('S3.4 维度 01 采集完成 → 维度 02 仍在进行 → 01 按钮即时解锁', () => {
    // 模拟 01 完成，02 仍在进行
    useSevenDimConfigStore.setState({ collectingDimensions: ['02'] })

    expect(useSevenDimConfigStore.getState().isClickable('01')).toBe(true)
    expect(useSevenDimConfigStore.getState().isClickable('02')).toBe(false)
  })

  // === S3.5: 全维度完成后状态完全恢复 ===
  it('S3.5 全维度完成后 collectingDimensions 清空且所有按钮恢复', () => {
    useSevenDimConfigStore.setState({ collectingDimensions: [] })

    expect(useSevenDimConfigStore.getState().isClickable()).toBe(true)
    expect(useSevenDimConfigStore.getState().isClickable('01')).toBe(true)
    expect(useSevenDimConfigStore.getState().isClickable('08')).toBe(true)
    expect(useSevenDimConfigStore.getState().tooltipText()).toBe('')
  })

  // === S3.6: isClickable 在 isSaving 对特定维度也返回 false ===
  it('S3.6 isSaving 时即使指定维度码也返回 false', () => {
    useSevenDimConfigStore.setState({
      isSaving: true,
      collectingDimensions: [],
    })
    expect(useSevenDimConfigStore.getState().isClickable('01')).toBe(false)
    expect(useSevenDimConfigStore.getState().isClickable('08')).toBe(false)
  })

  // === S3.7: tooltipText 在 isSaving 时忽略 dimensionCode ===
  it('S3.7 tooltipText 在 isSaving 时忽略维度参数，统一返回保存提示', () => {
    useSevenDimConfigStore.setState({
      isSaving: true,
      collectingDimensions: ['01'],  // 边缘：isSaving + 有维度采集中
    })
    const text = useSevenDimConfigStore.getState().tooltipText('01')
    // isSaving 优先级最高，应返回保存提示而非采集提示
    expect(text).toContain('保存')
  })
})

describe('sevenDimConfigStore - Store 订阅', () => {
  it('toggleDimension 触发订阅回调', () => {
    const callback = vi.fn()
    const unsubscribe = useSevenDimConfigStore.subscribe(callback)
    useSevenDimConfigStore.getState().toggleDimension('01')
    expect(callback).toHaveBeenCalled()
    unsubscribe()
  })

  it('applyTemplate 触发订阅回调', () => {
    const callback = vi.fn()
    const unsubscribe = useSevenDimConfigStore.subscribe(callback)
    useSevenDimConfigStore.getState().applyTemplate('growth')
    expect(callback).toHaveBeenCalled()
    unsubscribe()
  })

  it('unsubscribe 后不再接收回调', () => {
    const callback = vi.fn()
    const unsubscribe = useSevenDimConfigStore.subscribe(callback)
    unsubscribe()
    useSevenDimConfigStore.getState().toggleDimension('01')
    expect(callback).not.toHaveBeenCalled()
  })
})
