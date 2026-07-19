/**
 * @test_id V9-TEST-ST-144
 * @module multiFactorScreeningStore.test
 * @description 多因子筛选 Store 单元测试。
  * @covers_docs [V9-DOC-DATA-022, V9-DOC-DATA-011, V9-DOC-DATA-009, V9-DOC-BACK-004, V9-DOC-ARCH-007]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMultiFactorScreeningStore } from './multiFactorScreeningStore'
import { nanoid } from 'nanoid'
import type {
  ScreeningConditionGroup,
  ScreenableStockData,
  ScreeningResultItem,
} from '@/types/modules/screening.types'

const loadScreenableStocksMock = vi.fn()
const runMultiFactorScreeningMock = vi.fn()
const exportScreeningResultsMock = vi.fn()

vi.mock('@/services/screening/multiFactorScreeningEngine', () => ({
  loadScreenableStocks: () => loadScreenableStocksMock(),
  runMultiFactorScreening: (stocks: ScreenableStockData[], groups: ScreeningConditionGroup[]) =>
    runMultiFactorScreeningMock(stocks, groups),
  createTemplateFromGroups: vi.fn((name: string, groups: ScreeningConditionGroup[]) => ({
    id: `template_${nanoid(8)}`,
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
    runMultiFactorScreeningMock.mockReturnValue({ items: [mockStock], total: 1, elapsedMs: 1 })

    await useMultiFactorScreeningStore.getState().runScreening()

    expect(loadScreenableStocksMock).toHaveBeenCalled()
    expect(runMultiFactorScreeningMock).toHaveBeenCalled()
    expect(useMultiFactorScreeningStore.getState().results).toHaveLength(1)
    expect(useMultiFactorScreeningStore.getState().loading).toBe(false)
  })

  it('runScreening 失败时设置 error', async () => {
    loadScreenableStocksMock.mockRejectedValue(new Error('加载失败'))
    await useMultiFactorScreeningStore.getState().runScreening()
    expect(useMultiFactorScreeningStore.getState().error).toBe('加载失败')
    expect(useMultiFactorScreeningStore.getState().loading).toBe(false)
  })

  it('runScreening 引擎失败时设置 error', async () => {
    loadScreenableStocksMock.mockResolvedValue([])
    runMultiFactorScreeningMock.mockImplementation(() => {
      throw new Error('筛选失败')
    })
    await useMultiFactorScreeningStore.getState().runScreening()
    expect(useMultiFactorScreeningStore.getState().error).toBe('筛选失败')
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

  it('resetGroups 重置条件组和结果', () => {
    useMultiFactorScreeningStore.setState({
      conditionGroups: [
        { id: 'g1', logic: 'and', criteria: [] },
        { id: 'g2', logic: 'or', criteria: [] },
      ],
      results: [{ symbol: 'A', name: 'A公司', matchedGroups: [], sector: '', pe: 0, pb: 0, roe: 0, marketCap: 0, revenueGrowth: null, profitGrowth: null }] as ScreeningResultItem[],
    })
    useMultiFactorScreeningStore.getState().resetGroups()
    expect(useMultiFactorScreeningStore.getState().conditionGroups).toHaveLength(1)
    expect(useMultiFactorScreeningStore.getState().results).toHaveLength(0)
  })

  it('setGroups 设置条件组', () => {
    const newGroups: ScreeningConditionGroup[] = [
      { id: 'new1', logic: 'and', criteria: [] },
    ]
    useMultiFactorScreeningStore.getState().setGroups(newGroups)
    expect(useMultiFactorScreeningStore.getState().conditionGroups).toEqual(newGroups)
  })

  it('clearResults 清空结果', () => {
    useMultiFactorScreeningStore.setState({
      results: [{ symbol: 'A', name: 'A公司', matchedGroups: [], sector: '', pe: 0, pb: 0, roe: 0, marketCap: 0, revenueGrowth: 0, profitGrowth: 0 }] as ScreeningResultItem[],
      error: '之前的错误',
    })
    useMultiFactorScreeningStore.getState().clearResults()
    expect(useMultiFactorScreeningStore.getState().results).toHaveLength(0)
    expect(useMultiFactorScreeningStore.getState().error).toBeNull()
  })

  it('saveTemplate 超长名称返回 null', () => {
    const longName = 'a'.repeat(101)
    const result = useMultiFactorScreeningStore.getState().saveTemplate(longName)
    expect(result).toBeNull()
    expect(useMultiFactorScreeningStore.getState().error).toContain('模板名称长度')
  })

  it('loadTemplate 不存在的模板设置 error', () => {
    useMultiFactorScreeningStore.getState().loadTemplate('non-existent-id')
    expect(useMultiFactorScreeningStore.getState().error).toContain('未找到模板')
  })

  it('deleteTemplate 删除模板并持久化', () => {
    const template = useMultiFactorScreeningStore.getState().saveTemplate('测试模板')
    expect(template).not.toBeNull()
    if (template) {
      useMultiFactorScreeningStore.getState().deleteTemplate(template.id)
      expect(useMultiFactorScreeningStore.getState().templates).toHaveLength(0)
    }
  })

  it('loadSavedTemplates 读取失败时清空模板', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('读取失败')
    })
    useMultiFactorScreeningStore.getState().loadSavedTemplates()
    expect(useMultiFactorScreeningStore.getState().templates).toHaveLength(0)
    vi.restoreAllMocks()
  })
})
