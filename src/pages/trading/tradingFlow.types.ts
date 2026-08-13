/**
 * TradingFlowPage 本地类型定义
 * 从 TradingFlowPage.tsx 提取，供页面、hooks、子组件共享
 */

/** 持仓数据结构（由订单派生或来自 mock 数据） */
export interface TradingPosition {
  symbol: string
  name: string
  quantity: number
  costPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

/** 风控规则 */
export interface RiskRules {
  stopLossPercent: number
  takeProfitPercent: number
}

/** 创建订单表单（来自 OrderExecutionPanel） */
export interface CreateOrderForm {
  symbol: string
  side: string
  quantity: number
  price: number
  type: string
}

/** 从信号创建订单的最小信号结构（来自 TradingSignalPanel） */
export interface SignalOrderInput {
  symbol: string
  direction: string
}
