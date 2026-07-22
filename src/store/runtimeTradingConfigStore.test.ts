/**
 * @test_id V9-TEST-ST-RUNTIME-CONFIG
 * @fileoverview runtimeTradingConfigStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证（effective 为默认配置，hydrated=false）
 * 2. applyOverride —— 更新 effective 配置
 * 3. resetToDefault —— 恢复默认配置
 * 4. refresh —— 重新读取 effective
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

// 使用真实的 tradingConfig 函数，但将 localStorage mock 掉
// 这样 we don't need to mock the actual config functions
const mockSetTradingConfigOverride = vi.hoisted(() => vi.fn())
const mockResetTradingConfigOverride = vi.hoisted(() => vi.fn())
const mockGetDefaultTradingConfig = vi.hoisted(() => vi.fn())
const mockGetEffectiveTradingConfig = vi.hoisted(() => vi.fn())

vi.mock('@/config/tradingConfig', () => ({
  setTradingConfigOverride: mockSetTradingConfigOverride,
  resetTradingConfigOverride: mockResetTradingConfigOverride,
  getDefaultTradingConfig: mockGetDefaultTradingConfig,
  getEffectiveTradingConfig: mockGetEffectiveTradingConfig,
  // RUNTIME_TRADING_CONFIG_DEFAULTS is derived from getDefaultTradingConfig
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useRuntimeTradingConfigStore } from './runtimeTradingConfigStore'
import type { TradingConfig, TradingConfigOverride } from '@/config/tradingConfig'

// ============================================================
// Helpers
// ============================================================

function buildDefaultConfig(): TradingConfig {
  return {
    version: '0.9.3',
    signalThresholds: {
      peMax: 80,
      pbMax: 15,
      dipToMA20Pct: -10,
      dipRsi14Max: 35,
      pivotVolumeRatioMin: 1.2,
      profitTakingToMA20Pct: 15,
      profitTakingRsi14Min: 65,
      fixedStopLossPct: 8,
      trailingStopDrawdownPct: 12,
    },
    kelly: {
      fraction: 0.5,
      defaultWinRate: 0.55,
      defaultProfitLossRatio: 2,
      minPositionPct: 0.02,
      maxPositionPct: 0.2,
      roundLot: 100,
    },
    risk: {
      maxSinglePositionPct: 0.1,
      maxTotalPositionPct: 0.5,
      maxTradesPerDay: 3,
      sameSymbolCooldownHours: 4,
      dataFreshnessHours: 24,
      portfolioValue: 1000000,
    },
  }
}

// ============================================================
// Setup
// ============================================================

const defaultConfig = buildDefaultConfig()

beforeEach(() => {
  mockGetDefaultTradingConfig.mockReturnValue(defaultConfig)
  mockGetEffectiveTradingConfig.mockReturnValue(defaultConfig)
  mockSetTradingConfigOverride.mockReset()
  mockResetTradingConfigOverride.mockReset()

  // 重置 store 状态
  useRuntimeTradingConfigStore.setState({
    effective: defaultConfig,
    hydrated: false,
  })

  vi.clearAllMocks()
  mockGetDefaultTradingConfig.mockReturnValue(defaultConfig)
  mockGetEffectiveTradingConfig.mockReturnValue(defaultConfig)
})

// ============================================================
// Tests
// ============================================================

describe('useRuntimeTradingConfigStore', () => {
  describe('初始状态', () => {
    it('effective 应为默认配置，hydrated 应为 false', () => {
      const state = useRuntimeTradingConfigStore.getState()
      expect(state.effective).toEqual(defaultConfig)
      expect(state.hydrated).toBe(false)
    })
  })

  describe('applyOverride', () => {
    it('应调用 setTradingConfigOverride 并更新 effective', () => {
      const override: TradingConfigOverride = {
        risk: { portfolioValue: 2000000 },
      }
      const overriddenConfig = {
        ...defaultConfig,
        risk: { ...defaultConfig.risk, portfolioValue: 2000000 },
      }
      mockGetEffectiveTradingConfig.mockReturnValue(overriddenConfig)

      useRuntimeTradingConfigStore.getState().applyOverride(override)

      expect(mockSetTradingConfigOverride).toHaveBeenCalledWith(override)
      expect(useRuntimeTradingConfigStore.getState().effective).toEqual(overriddenConfig)
    })
  })

  describe('resetToDefault', () => {
    it('应调用 resetTradingConfigOverride 并将 effective 恢复为默认', () => {
      // 先设置一个覆盖
      const overriddenConfig = {
        ...defaultConfig,
        risk: { ...defaultConfig.risk, portfolioValue: 2000000 },
      }
      useRuntimeTradingConfigStore.setState({ effective: overriddenConfig })

      useRuntimeTradingConfigStore.getState().resetToDefault()

      expect(mockResetTradingConfigOverride).toHaveBeenCalled()
      expect(useRuntimeTradingConfigStore.getState().effective).toEqual(defaultConfig)
    })
  })

  describe('refresh', () => {
    it('应重新读取 effective 并更新状态', () => {
      const newConfig = {
        ...defaultConfig,
        risk: { ...defaultConfig.risk, maxTradesPerDay: 5 },
      }
      mockGetEffectiveTradingConfig.mockReturnValue(newConfig)

      useRuntimeTradingConfigStore.getState().refresh()

      expect(useRuntimeTradingConfigStore.getState().effective).toEqual(newConfig)
    })
  })

  describe('hydrateFromConfigApp', () => {
    it('无 localStorage 数据时仅设置 hydrated=true', () => {
      // 清除 localStorage
      localStorage.removeItem('v9-app-config')

      useRuntimeTradingConfigStore.setState({ hydrated: false })
      useRuntimeTradingConfigStore.getState().hydrateFromConfigApp()

      expect(useRuntimeTradingConfigStore.getState().hydrated).toBe(true)
      // 未调用 setTradingConfigOverride（无数据可还原）
      expect(mockSetTradingConfigOverride).not.toHaveBeenCalled()
    })

    it('有 localStorage 数据时应用覆盖并设置 hydrated=true', () => {
      localStorage.setItem('v9-app-config', JSON.stringify({
        portfolioValue: 3000000,
        maxSinglePositionPct: 0.15,
        stopLossPct: 7,
      }))

      const overriddenConfig = {
        ...defaultConfig,
        risk: { ...defaultConfig.risk, portfolioValue: 3000000, maxSinglePositionPct: 0.15 },
        signalThresholds: { ...defaultConfig.signalThresholds, fixedStopLossPct: 7, trailingStopDrawdownPct: 7 },
      }
      mockGetEffectiveTradingConfig.mockReturnValue(overriddenConfig)

      useRuntimeTradingConfigStore.setState({ hydrated: false })
      useRuntimeTradingConfigStore.getState().hydrateFromConfigApp()

      expect(useRuntimeTradingConfigStore.getState().hydrated).toBe(true)
      expect(mockSetTradingConfigOverride).toHaveBeenCalled()
      expect(useRuntimeTradingConfigStore.getState().effective).toEqual(overriddenConfig)

      // 清理
      localStorage.removeItem('v9-app-config')
    })

    it('applyOverride 使用空覆盖对象不崩溃', () => {
      mockGetEffectiveTradingConfig.mockReturnValue(defaultConfig)

      useRuntimeTradingConfigStore.getState().applyOverride({})

      expect(mockSetTradingConfigOverride).toHaveBeenCalledWith({})
      expect(useRuntimeTradingConfigStore.getState().effective).toEqual(defaultConfig)
    })
  })
})
