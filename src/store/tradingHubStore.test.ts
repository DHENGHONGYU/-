import { describe, it, expect, beforeEach } from 'vitest'
import { useTradingHubStore } from './tradingHubStore'

beforeEach(() => {
  useTradingHubStore.setState({ activeModule: '', loading: false })
})

describe('useTradingHubStore', () => {
  it('初始状态验证', () => {
    const state = useTradingHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
  })

  it('setActiveModule: 更新当前模块路径', () => {
    useTradingHubStore.getState().setActiveModule('/trading/signals')
    expect(useTradingHubStore.getState().activeModule).toBe('/trading/signals')
  })

  it('setLoading: 切换加载状态', () => {
    useTradingHubStore.getState().setLoading(true)
    expect(useTradingHubStore.getState().loading).toBe(true)
    useTradingHubStore.getState().setLoading(false)
    expect(useTradingHubStore.getState().loading).toBe(false)
  })

  it('reset: 重置所有状态', () => {
    useTradingHubStore.getState().setActiveModule('/x')
    useTradingHubStore.getState().setLoading(true)
    useTradingHubStore.getState().reset()
    const state = useTradingHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
  })
})
