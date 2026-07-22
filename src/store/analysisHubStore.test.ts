/**
 * @test_id V9-TEST-ST-???
 * @covers_docs []
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useAnalysisHubStore } from './analysisHubStore'

describe('useAnalysisHubStore', () => {
  beforeEach(() => {
    useAnalysisHubStore.getState().reset()
  })

  it('初始状态验证', () => {
    const state = useAnalysisHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
  })

  it('setActiveModule: 设置当前选中模块', () => {
    useAnalysisHubStore.getState().setActiveModule('stock-analysis')
    expect(useAnalysisHubStore.getState().activeModule).toBe('stock-analysis')

    useAnalysisHubStore.getState().setActiveModule('')
    expect(useAnalysisHubStore.getState().activeModule).toBe('')
  })

  it('setLoading: 设置加载状态', () => {
    useAnalysisHubStore.getState().setLoading(true)
    expect(useAnalysisHubStore.getState().loading).toBe(true)

    useAnalysisHubStore.getState().setLoading(false)
    expect(useAnalysisHubStore.getState().loading).toBe(false)
  })

  it('reset: 重置到初始状态', () => {
    useAnalysisHubStore.getState().setActiveModule('some-module')
    useAnalysisHubStore.getState().setLoading(true)

    useAnalysisHubStore.getState().reset()

    const state = useAnalysisHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
  })

  it('setActiveModule: 支持特殊字符路径', () => {
    useAnalysisHubStore.getState().setActiveModule('/analysis/stock?code=000001&tab=overview')
    expect(useAnalysisHubStore.getState().activeModule).toBe('/analysis/stock?code=000001&tab=overview')
  })

  it('reset: 多次操作后重置不影响后续使用', () => {
    useAnalysisHubStore.getState().setActiveModule('module-A')
    useAnalysisHubStore.getState().setLoading(true)
    useAnalysisHubStore.getState().reset()

    useAnalysisHubStore.getState().setActiveModule('module-B')
    useAnalysisHubStore.getState().setLoading(false)
    useAnalysisHubStore.getState().reset()

    const state = useAnalysisHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
  })
})
