/**
 * @fileoverview 测试数据种子化工具
 * @description
 *   将采集链路测试中反复出现的 store 种子化模式固化为公共函数，
 *   避免每个测试文件重复手写 `useIntentionPoolStore.setState({...})`。
 *
 * 设计原则：
 *   - 函数纯工具化，不引入任何副作用
 *   - 返回最小合法对象（满足 resolveDefaultSymbols 需求即可）
 *   - 支持链式/批量种子化
 *
 * 使用示例：
 * ```typescript
 * import { seedIntentionPool } from '../utils/seedTestData'
 *
 * beforeEach(() => {
 *   seedIntentionPool(['000001', '600519', '300750'])
 * })
 * ```
 */

import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import type { IntentionPoolItem } from '@/types/modules/pool.types'

// ============================================================
// 常量
// ============================================================

/** 测试用股票基础列表 */
export const TEST_SYMBOLS = {
  /** 银行股 */
  BANK: '000001',
  /** 白酒 */
  LIQUOR: '600519',
  /** 新能源电池 */
  BATTERY: '300750',
  /** 家电 */
  HOME_APPLIANCE: '000333',
  /** 保险 */
  INSURANCE: '601318',
} as const

// ============================================================
// 工厂函数
// ============================================================

/**
 * 创建最小合法 IntentionPoolItem（仅含 resolveDefaultSymbols 需要的字段）。
 */
export function createPoolItem(
  symbol: string,
  name?: string,
): Partial<IntentionPoolItem> {
  return {
    symbol: symbol.trim().toUpperCase(),
    name: name ?? `测试股票${symbol}`,
    pool: 'intention' as const,
    status: 'watchlist' as const,
    source: 'manual' as const,
    dataVersion: 1,
  }
}

// ============================================================
// 种子函数
// ============================================================

/**
 * 种子化意向池。
 *
 * @param symbols - 股票代码列表（如 ['000001', '600519']）
 * @param preserveExisting - 是否保留已有条目（默认 false，覆盖）
 *
 * @example
 * ```typescript
 * // 用默认名称种子化
 * seedIntentionPool(['000001', '600519'])
 *
 * // 带自定义名称
 * seedIntentionPool([
 *   { symbol: '000001', name: '平安银行' },
 *   { symbol: '600519', name: '贵州茅台' },
 * ])
 * ```
 */
export function seedIntentionPool(
  symbols: Array<string | { symbol: string; name: string }>,
  preserveExisting = false,
): void {
  const items = symbols.map((s) => {
    if (typeof s === 'string') {
      return createPoolItem(s)
    }
    return createPoolItem(s.symbol, s.name)
  })

  useIntentionPoolStore.setState({
    items: preserveExisting
      ? [...useIntentionPoolStore.getState().items, ...(items as unknown as PoolItem[])]
      : (items as unknown as PoolItem[]),
  })
}

/**
 * 快速种子化常用测试股票（平安银行 + 贵州茅台）。
 *
 * @example
 * ```typescript
 * seedDefaultPool()
 * // 等价于 seedIntentionPool(['000001', '600519'])
 * ```
 */
export function seedDefaultPool(): void {
  seedIntentionPool([TEST_SYMBOLS.BANK, TEST_SYMBOLS.LIQUOR], false)
}

/**
 * 清空意向池（用于测试空池场景）。
 */
export function clearIntentionPool(): void {
  useIntentionPoolStore.setState({ items: [] })
}

// ============================================================
// 通用种子辅助
// ============================================================

/**
 * 创建 Store 的通用种子器（类型安全的 setState 封装）。
 *
 * @param setStateFn - Zustand store 的 setState 方法
 * @returns 返回一个接受 Partial<State> 的函数
 *
 * @example
 * ```typescript
 * const seedMyStore = createStoreSeeder(useMyStore.setState)
 * seedMyStore({ key: 'value' })
 * ```
 */
export function createStoreSeeder<State extends Record<string, unknown>>(
  setStateFn: (partial: Partial<State>) => void,
): (partial: Partial<State>) => void {
  return (partial) => setStateFn(partial)
}
