/**
 * @module useRuntimeTradingConfigStore
 * @description 运行时交易配置覆盖（阶段 A-1）
 *
 * ## 职责
 * - 提供 React 端订阅「交易配置覆盖」的入口
 * - 提供 applyOverride / reset / loadFromConfigApp 三组 action
 * - 底层调用 `setTradingConfigOverride()`（来自 `@/config/tradingConfig`），
 *   7 个高频消费文件（positionSizer / portfolioBuilder / riskEngine / signalGenerator
 *   / tradingService / createExecutionPlan / thresholds）通过 `getEffectiveTradingConfig()`
 *   自动感知变更
 *
 * ## 数据流
 * - 启动时：调用 `hydrateFromConfigApp()` 从 `localStorage['v9-app-config']` 读取
 *   ConfigApp 写入的旧值并应用为覆盖（兼容迁移）
 * - UI 提交（ConfigApp）：调 `applyOverride()` → setTradingConfigOverride → 下游生效
 * - 跨刷新：覆盖存在 process 内存 + localStorage 双轨；下次启动 hydrate 还原
 *
 * ## 配套
 * - `src/config/tradingConfig.ts` → `setTradingConfigOverride` / `getEffectiveTradingConfig` / `resetTradingConfigOverride`
 * - `src/apps/command/ConfigApp.tsx` → 提交时调 `useRuntimeTradingConfigStore.getState().applyOverride(...)`
 */
import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  setTradingConfigOverride,
  resetTradingConfigOverride,
  getDefaultTradingConfig,
  getEffectiveTradingConfig,
  type TradingConfigOverride,
  type TradingConfig,
} from '@/config/tradingConfig'

const logger = getLogger()

/** ConfigApp 写 localStorage 的 key（与 ConfigApp.tsx 保持一致） */
const APP_CONFIG_STORAGE_KEY = 'v9-app-config'

/** ConfigApp 写入的字段（仅取可覆盖部分） */
interface ConfigAppStored {
  portfolioValue?: number
  maxSinglePositionPct?: number
  maxDailyLossPct?: number
  stopLossPct?: number
  enablePaperTrading?: boolean
  // 其他字段（refreshInterval/autoRefresh/theme/language）不在 tradingConfig 覆盖范围
}

function loadFromConfigAppStorage(): ConfigAppStored | null {
  try {
    const raw = localStorage.getItem(APP_CONFIG_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ConfigAppStored
  } catch {
    return null
  }
}

/** 把 ConfigApp 字段映射为 tradingConfig 覆盖 */
function mapConfigAppToOverride(stored: ConfigAppStored): TradingConfigOverride {
  return {
    risk: {
      ...(typeof stored.portfolioValue === 'number' && stored.portfolioValue > 0
        ? { portfolioValue: stored.portfolioValue }
        : {}),
      ...(typeof stored.maxSinglePositionPct === 'number'
        ? { maxSinglePositionPct: stored.maxSinglePositionPct }
        : {}),
    },
    signalThresholds: {
      ...(typeof stored.stopLossPct === 'number'
        ? { fixedStopLossPct: stored.stopLossPct, trailingStopDrawdownPct: stored.stopLossPct }
        : {}),
    },
    // maxDailyLossPct 暂无对应 tradingConfig 字段（已映射到 risk.maxTradesPerDay 之外，保留未来扩展）
  }
}

interface RuntimeTradingConfigState {
  /** 当前生效配置（含默认 ∪ 覆盖） */
  effective: TradingConfig
  /** 标记已 hydrate（避免重复读取 localStorage） */
  hydrated: boolean

  /** 从 ConfigApp 写入的 localStorage 还原覆盖（应用启动时调用一次） */
  hydrateFromConfigApp: () => void
  /** 应用新的覆盖（部分字段） */
  applyOverride: (override: TradingConfigOverride) => void
  /** 重置为默认 */
  resetToDefault: () => void
  /** 刷新 effective（用于订阅 setTradingConfigOverride 后的手动重读） */
  refresh: () => void
}

export const useRuntimeTradingConfigStore = create<RuntimeTradingConfigState>((set) => ({
  effective: getEffectiveTradingConfig(),
  hydrated: false,

  hydrateFromConfigApp: () => {
    const stored = loadFromConfigAppStorage()
    if (!stored) {
      set({ hydrated: true })
      return
    }
    const override = mapConfigAppToOverride(stored)
    if (Object.keys(override.signalThresholds ?? {}).length > 0 || Object.keys(override.kelly ?? {}).length > 0 || Object.keys(override.risk ?? {}).length > 0) {
      setTradingConfigOverride(override)
      logger.info('[useRuntimeTradingConfigStore] hydrate 从 ConfigApp localStorage 还原覆盖', {
        keys: Object.keys(override),
      })
    } else {
      logger.info('[useRuntimeTradingConfigStore] hydrate 未发现可还原字段')
    }
    set({ effective: getEffectiveTradingConfig(), hydrated: true })
  },

  applyOverride: (override) => {
    setTradingConfigOverride(override)
    const next = getEffectiveTradingConfig()
    logger.info('[useRuntimeTradingConfigStore] applyOverride 完成', {
      riskDelta: { portfolioValue: next.risk.portfolioValue },
    })
    set({ effective: next })
  },

  resetToDefault: () => {
    resetTradingConfigOverride()
    const next = getDefaultTradingConfig()
    logger.info('[useRuntimeTradingConfigStore] resetToDefault 完成')
    set({ effective: next })
  },

  refresh: () => {
    set({ effective: getEffectiveTradingConfig() })
  },
}))

/** 调试用：导出默认配置 + 覆盖键名，方便 IDE 跳转 */
export const RUNTIME_TRADING_CONFIG_DEFAULTS = getDefaultTradingConfig()
