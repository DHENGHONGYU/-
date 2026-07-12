import { describe, it, expect, beforeEach } from 'vitest'
import { useInputHubStore } from './inputHubStore'

beforeEach(() => {
  useInputHubStore.setState({
    activeModule: '',
    loading: false,
    searchResults: [],
    isAddingStock: false,
  })
})

describe('useInputHubStore', () => {
  it('初始状态验证', () => {
    const state = useInputHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
    expect(state.searchResults).toEqual([])
    expect(state.isAddingStock).toBe(false)
  })

  it('setActiveModule: 更新当前模块路径', () => {
    useInputHubStore.getState().setActiveModule('/input/bulk-import')
    expect(useInputHubStore.getState().activeModule).toBe('/input/bulk-import')
  })

  it('setLoading: 切换加载状态', () => {
    useInputHubStore.getState().setLoading(true)
    expect(useInputHubStore.getState().loading).toBe(true)
    useInputHubStore.getState().setLoading(false)
    expect(useInputHubStore.getState().loading).toBe(false)
  })

  it('searchStocks: 搜索股票并更新搜索结果', () => {
    const results = useInputHubStore.getState().searchStocks('600')
    expect(results).toBeInstanceOf(Array)
    expect(useInputHubStore.getState().searchResults).toBe(results)
  })

  it('reset: 重置所有状态', () => {
    useInputHubStore.getState().setActiveModule('/x')
    useInputHubStore.getState().setLoading(true)
    useInputHubStore.getState().searchStocks('600')
    useInputHubStore.getState().reset()
    const state = useInputHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
    expect(state.searchResults).toEqual([])
    expect(state.isAddingStock).toBe(false)
  })
})
