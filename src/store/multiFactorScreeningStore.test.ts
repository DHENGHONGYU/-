/**
 * @module multiFactorScreeningStore.test
 * @description 多因子筛选 Store 单元测试。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMultiFactorScreeningStore } from './multiFactorScreeningStore'
import type {
  ScreeningConditionGroup,
  ScreenableStockData,
  ScreeningResultItem,
} from '@/types/modules/screening.types'

const loadScreenableStocksMock = vi.fn()
const runScreeningMock = vi.fn()
const exportScreeningResultsMock = vi.fn()

vi.mock('@/services/screening/multiFactorScreeningEngine', () => ({
  loadScreenableStocks: () => loadScreenableStocksMock(),
  runScreening: (stocks: ScreenableStockData[], groups: ScreeningConditionGroup[]) =>
    runScreeningMock(stocks, groups),
  createTemplateFromGroups: vi.fn((name: string, groups: ScreeningConditionGroup[]) => ({
    id: `template_${Date.now()}`,
    name,
    groups,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
  exportScreeningResults: (items: unknown[], prefix: string) =>
    exportScreeningResultsMock(items, prefix),
}))

function firstGroup() {
  return useMultiFactorScreeningStore.getState().conditionGroups[0]!
}

describe('multiFactorScreeningStore', () => {
  beforeEach(() => {
    useMultiFactorScreeningStore.setState({ templates: [], results: [], error: null })
    useMultiFactorScreeningStore.getState().resetGroups()
    vi.clearAllMocks()
  })

  it('默认包含一个条件组', () => {
    const { conditionGroups } = useMultiFactorScreeningStore.getState()
    expect(conditionGroups).toHaveLength(1)
    expect(conditionGroups[0]!.criteria).toHaveLength(1)
  })

  it('添加/删除条件组', () => {
    const { addGroup, removeGroup } = useMultiFactorScreeningStore.getState()
    addGroup()
    expect(useMultiFactorScreeningStore.getState().conditionGroups).toHaveLength(2)
    const groupId = useMultiFactorScreeningStore.getState().conditionGroups[0]!.id
    removeGroup(groupId)
    expect(useMultiFactorScreeningStore.getState().conditionGroups).toHaveLength(1)
  })

  it('添加/删除条件', () => {
    const { addCriterion, removeCriterion } = useMultiFactorScreeningStore.getState()
    const groupId = firstGroup().id
    addCriterion(groupId)
    expect(firstGroup().criteria).toHaveLength(2)
    const criterionId = firstGroup().criteria[0]!.id
    removeCriterion(groupId, criterionId)
    expect(firstGroup().criteria).toHaveLength(1)
  })

  it('更新条件', () => {
    const { updateCriterion } = useMultiFactorScreeningStore.getState()
    const groupId = firstGroup().id
    const criterionId = firstGroup().criteria[0]!.id
    updateCriterion(groupId, criterionId, { value: 30 })
    expect(firstGroup().criteria[0]!.value).toBe(30)
  })

  it('runScreening 更新结果', async () => {
    const mockStock = { symbol: 'A', name: 'A公司', pe: 10 } as ScreenableStockData
    loadScreenableStocksMock.mockResolvedValue([mockStock])
    runScreeningMock.mockReturnValue({ items: [mockStock], total: 1, elapsedMs: 1 })

    await useMultiFactorScreeningStore.getState().runScreening()

    expect(loadScreenableStocksMock).toHaveBeenCalled()
    expect(runScreeningMock).toHaveBeenCalled()
    expect(useMultiFactorScreeningStore.getState().results).toHaveLength(1)
    expect(useMultiFactorScreeningStore.getState().loading).toBe(false)
  })

  it('runScreening 失败时设置 error', async () => {
    loadScreenableStocksMock.mockRejectedValue(new Error('加载失败'))
    await useMultiFactorScreeningStore.getState().runScreening()
    expect(useMultiFactorScreeningStore.getState().error).toBe('加载失败')
    expect(useMultiFactorScreeningStore.getState().loading).toBe(false)
  })

  it('保存/加载/删除模板', () => {
    const { saveTemplate, loadTemplate, deleteTemplate } = useMultiFactorScreeningStore.getState()
    const template = saveTemplate('测试模板')
    expect(template).not.toBeNull()
    expect(useMultiFactorScreeningStore.getState().templates).toHaveLength(1)

    if (template) {
      loadTemplate(template.id)
      expect(useMultiFactorScreeningStore.getState().error).toBeNull()
      deleteTemplate(template.id)
      expect(useMultiFactorScreeningStore.getState().templates).toHaveLength(0)
    }
  })

  it('保存空名称模板返回 null 并设置 error', () => {
    const { saveTemplate } = useMultiFactorScreeningStore.getState()
    const template = saveTemplate('  ')
    expect(template).toBeNull()
    expect(useMultiFactorScreeningStore.getState().error).not.toBeNull()
  })

  it('exportResults 调用引擎导出', () => {
    const mockResult = { symbol: 'A', name: 'A公司', matchedGroups: [] } as unknown as ScreeningResultItem
    useMultiFactorScreeningStore.setState({ results: [mockResult] })
    useMultiFactorScreeningStore.getState().exportResults()
    expect(exportScreeningResultsMock).toHaveBeenCalledWith(
      [mockResult],
      expect.any(String),
    )
  })
})
