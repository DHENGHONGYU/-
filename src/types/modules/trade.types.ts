/**
 * @module TradeTypes
 * @lifecycle @Route
 * @description 交易持仓管理模块类型定义。所有接口必须在此声明，组件中禁止内联定义数据结构。
 */

import type { HoldingAction, StrategyType, TradeDirection } from '@/constants/trade.constants'

// ============================================================
// 持仓数据项
// ============================================================

/** 持仓明细项 */
export interface HoldingItem {
  /** 证券代码 */
  code: string
  /** 证券名称 */
  name: string
  /** 持仓数量（股） */
  quantity: number
  /** 当前价格 */
  currentPrice: number
  /** 成本均价 */
  avgCost: number
  /** 浮动盈亏金额 */
  floatingPnl: number
  /** 浮动盈亏百分比 */
  floatingPnlPercent: number
  /** 市值占比（0-1） */
  marketValueRatio: number
  /** 关联策略ID */
  strategyId: string
  /** 策略类型 */
  strategyType: StrategyType
}

// ============================================================
// 查询参数
// ============================================================

/** 持仓列表查询参数 */
export interface HoldingsQueryParams {
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 开始日期（ISO 日期字符串） */
  startDate: string
  /** 结束日期（ISO 日期字符串） */
  endDate: string
  /** 交易方向 */
  direction: TradeDirection
  /** 搜索关键词（证券代码或名称模糊匹配） */
  keyword: string
}

// ============================================================
// API 响应结构
// ============================================================

/** 持仓列表 API 响应数据 */
export interface HoldingsListData {
  /** 总条数 */
  total: number
  /** 持仓列表 */
  list: HoldingItem[]
}

/** 统一 API 响应包装 */
export interface HoldingsApiResponse<T = HoldingsListData> {
  /** 状态码 */
  code: number
  /** 响应数据 */
  data: T
  /** 错误信息 */
  message?: string
}

/** 交易操作请求参数 */
export interface TradeActionRequest {
  /** 证券代码 */
  code: string
  /** 操作类型 */
  action: HoldingAction
  /** 操作数量（股） */
  quantity: number
}

/** 交易操作响应 */
export interface TradeActionResponse {
  /** 状态码 */
  code: number
  /** 是否成功 */
  success: boolean
  /** 提示信息 */
  message: string
}

// ============================================================
// 分页状态
// ============================================================

/** 分页状态 */
export interface PaginationState {
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 总条数 */
  total: number
}

/** 分页操作回调 */
export interface PaginationHandlers {
  /** 翻页 */
  onPageChange: (page: number) => void
  /** 切换每页条数 */
  onPageSizeChange: (pageSize: number) => void
}

// ============================================================
// 筛选状态
// ============================================================

/** 筛选条件 */
export interface FilterState {
  /** 开始日期 */
  startDate: string
  /** 结束日期 */
  endDate: string
  /** 交易方向 */
  direction: TradeDirection
  /** 搜索关键词 */
  keyword: string
}

/** 筛选操作回调 */
export interface FilterHandlers {
  /** 执行搜索 */
  onSearch: () => void
  /** 重置筛选 */
  onReset: () => void
  /** 导出 Excel */
  onExport: () => void
}

// ============================================================
// 数据加载状态
// ============================================================

/** 数据加载状态 */
export interface HoldingsLoadingState {
  /** 列表数据是否加载中 */
  isListLoading: boolean
  /** 操作是否执行中 */
  isActionLoading: boolean
  /** 导出是否进行中 */
  isExporting: boolean
}

// ============================================================
// 交易弹窗状态
// ============================================================

/** 交易操作弹窗状态 */
export interface TradeModalState {
  /** 是否打开 */
  open: boolean
  /** 操作类型 */
  action: HoldingAction | null
  /** 目标持仓项 */
  holding: HoldingItem | null
}