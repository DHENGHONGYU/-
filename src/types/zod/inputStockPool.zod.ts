/**
 * @fileoverview 输入舱 · 股票池 DTO Zod Schema（InputStockPool）
 *
 * 对应 TS 类型: {@link @/types/modules/input.types.ts → MockStock | StockSearchResult}
 * 设计原则: 1. 与 TS interface 字段级双射（z.infer 天然类型一致）
 *         2. number 字段带 finite 守卫（防 NaN/Infinity 写 DB）
 *         3. symbol 强制 6 位数字（沪深 A 股主规则 + 可选 B 股后缀）
 *
 * 纯新增窄化扩展 (方案 A): 对 src/types/modules/input.types.ts 零侵入
 */

import { z } from 'zod'

// ---------- 1. 原子 schema ----------
export const Z_SYMBOL = z.string().regex(/^\d{6}(?:\.[A-Z]{1,2})?$/, 'symbol 必须为 6 位数字 + 可选交易所后缀 (例 000001.SZ)')
export const Z_PE = z.number().finite().positive().optional()
export const Z_PB = z.number().finite().positive().optional()
export const Z_MARKET_CAP = z.number().finite().nonnegative().optional()
export const Z_SW_LEVEL = z.string().min(1).optional()

// ---------- 2. DTO: MockStock / StockSearchResult (别名同一 schema) ----------
export const Z_MOCK_STOCK = z.object({
  symbol: Z_SYMBOL,
  name: z.string().min(1, 'name 不得为空'),
  industry: z.string().min(1, 'industry 不得为空'),
  pe: Z_PE,
  pb: Z_PB,
  marketCap: Z_MARKET_CAP,
  swL1: Z_SW_LEVEL,
  swL2: Z_SW_LEVEL,
  swL3: Z_SW_LEVEL,
}).strict()
.strict() // ⭐ DTO 严格模式：未知字段立刻失败（防止 API 漂移）

/** @deprecated 对外别名，和 input.types.ts 中 `type StockSearchResult = MockStock` 对齐 */
export const Z_STOCK_SEARCH_RESULT = Z_MOCK_STOCK

// ---------- 3. 顶层容器: 股票池输入 DTO（单股票 + 批量） ----------
export const Z_INPUT_STOCK_POOL_DTO = z.object({
  requestId: z.string().uuid().optional(),
  source: z.enum(['search', 'import', 'clipboard', 'watchlist', 'manual']),
  createdAt: z.string().datetime({ offset: true }),
  items: z.array(Z_MOCK_STOCK).min(1, '股票池必须至少 1 只').max(500, '单次输入不得超过 500 只（性能守卫）'),
}).strict()

// ---------- 4. TS 类型反推（保证 TS interface ↔ Zod 双射闭环） ----------
export type MockStockZod = z.infer<typeof Z_MOCK_STOCK>
export type StockSearchResultZod = z.infer<typeof Z_STOCK_SEARCH_RESULT>
export type InputStockPoolDto = z.infer<typeof Z_INPUT_STOCK_POOL_DTO>
