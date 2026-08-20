/**
 * @fileoverview 交易舱 · 持仓盈亏 DTO Zod Schema（TradingPnL）
 *
 * 对应 TS 类型: {@link @/types/modules/trade.types.ts → HoldingItem / HoldingsApiResponse / HoldingsListData / HoldingsQueryParams}
 * 关联常量: {@link @/constants/trade.constants.ts → TRADE_DIRECTION / STRATEGY_TYPE / HOLDING_ACTION}
 * 设计原则: 1. 盈亏/百分比 finite + 合理范围（防止异常数据写 DB）
 *         2. TradeDirection 对 BUY/SELL/ALL 3 值 enum 双射（避免新增常量漂移）
 *         3. StrategyType 对 VALUE/HOTSPOT/RESILIENCE/ROTATION 4 值双射
 *
 * 纯新增窄化扩展 (方案 A): 对 src/types/modules/trade.types.ts / trade.constants.ts 零侵入
 */

import { z } from 'zod'

// ---------- 1. enum 与 constants 双射（此处镜像值：若未来常量漂移，z.enum 在 schema 验证层率先拦截） ----------
export const Z_TRADE_DIRECTION = z.enum(['BUY', 'SELL', 'ALL'])
export const Z_STRATEGY_TYPE = z.enum(['VALUE', 'HOTSPOT', 'RESILIENCE', 'ROTATION'])
export const Z_HOLDING_ACTION = z.enum(['ADD', 'REDUCE', 'CLOSE', 'ADJUST_COST'])

// ---------- 2. 数字边界 ----------
const Z_PRICE = z.number().finite().min(0, '价格不得 < 0') // 0 表示停牌未获取
const Z_QUANTITY = z.number().int().finite().nonnegative('数量必须 ≥ 0')
const Z_PNL_AMOUNT = z.number().finite()
const Z_PNL_PERCENT = z.number().finite().min(-1)  // -100% ~ +∞（理论上无上限但最少 -100% 破产）
const Z_RATIO_0_1 = z.number().finite().min(0).max(1)
const Z_DATE_YYYY_MM_DD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 格式必选')
const Z_SYMBOL = z.string().regex(/^\d{6}(?:\.[A-Z]{1,2})?$/, '证券代码: 6 位数字 + 可选交易所后缀')

// ---------- 3. 子 schema ----------
export const Z_HOLDING_ITEM = z.object({
  code: Z_SYMBOL,
  name: z.string().min(1, '证券名称必填'),
  quantity: Z_QUANTITY,
  currentPrice: Z_PRICE,
  avgCost: Z_PRICE,
  floatingPnl: Z_PNL_AMOUNT,
  floatingPnlPercent: Z_PNL_PERCENT,
  marketValueRatio: Z_RATIO_0_1,
  strategyId: z.string().uuid(),
  strategyType: Z_STRATEGY_TYPE,
}).strict()

export const Z_HOLDINGS_QUERY_PARAMS = z.object({
  page: z.number().int().finite().positive(),
  pageSize: z.number().int().finite().positive().max(500, '单次分页 ≤ 500'),
  startDate: Z_DATE_YYYY_MM_DD,
  endDate: Z_DATE_YYYY_MM_DD,
  direction: Z_TRADE_DIRECTION,
  keyword: z.string().max(32, '搜索关键词 ≤ 32 字'),
}).strict().refine((p) => new Date(p.endDate) >= new Date(p.startDate), {
  message: 'endDate 必须 >= startDate',
  path: ['endDate'],
})

export const Z_HOLDINGS_LIST_DATA = z.object({
  total: z.number().int().nonnegative().finite(),
  list: z.array(Z_HOLDING_ITEM),
}).strict()

/** HoldingsApiResponse<T> 默认 T = HoldingsListData；zod 使用泛型时显式 default */
export const Z_HOLDINGS_API_RESPONSE = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.number().int().finite(),  // 200/4xx/5xx
    data: dataSchema,
    message: z.string().optional(),
  }).strict()

// ---------- 4. 顶层 DTO: Trading PnL 聚合 ----------
export const Z_TRADING_PNL_DTO = z.object({
  snapshotId: z.string().uuid(),
  capturedAt: z.string().datetime({ offset: true }),
  /** 总资产 */
  totalAsset: z.number().finite().positive(),
  /** 可用现金 */
  availableCash: z.number().finite().nonnegative(),
  /** 总浮动盈亏（所有 HoldingItem 之和校验） */
  totalFloatingPnl: Z_PNL_AMOUNT,
  /** 持仓占比 0-1 */
  holdingsRatio: Z_RATIO_0_1,
  /** 明细项 */
  holdings: z.array(Z_HOLDING_ITEM),
}).strict()
.refine((p) => Math.abs(p.holdings.reduce((s, h) => s + h.floatingPnl, 0) - p.totalFloatingPnl) < 0.01, {
  message: 'totalFloatingPnl 必须等于所有持仓 floatingPnl 之和（精度 0.01）',
  path: ['totalFloatingPnl'],
})
.refine((p) => {
  const sumRatio = p.holdings.reduce((s, h) => s + h.marketValueRatio, 0)
  return Math.abs(sumRatio - 1) < 0.005 || sumRatio <= 1 + 1e-9
}, {
  message: '所有持仓 marketValueRatio 之和 ≈ 1 (±0.005)（否则仪表盘环形图会显示异常）',
  path: ['holdingsRatio'],
})

// ---------- 5. TS 类型反推 ----------
export type HoldingItemZod = z.infer<typeof Z_HOLDING_ITEM>
export type HoldingsQueryParamsZod = z.infer<typeof Z_HOLDINGS_QUERY_PARAMS>
export type HoldingsListDataZod = z.infer<typeof Z_HOLDINGS_LIST_DATA>
export type HoldingsApiResponseZod<T = HoldingsListDataZod> = z.infer<ReturnType<typeof Z_HOLDINGS_API_RESPONSE<z.ZodType<T>>>>
export type TradingPnlDto = z.infer<typeof Z_TRADING_PNL_DTO>
