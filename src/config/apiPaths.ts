/**
 * 内部 API 路径集中配置
 *
 * @description
 * 所有内部 API 端点路径必须从此文件导入，
 * 禁止在 constants / services / components 层硬编码 API 路径字符串。
 *
 * @module config/apiPaths
 */

// ============================================================
// 系统监控 API 路径
// ============================================================

/** Agent 健康检查 API */
export const API_SYSTEM_AGENT_HEALTH = '/api/system/agent-health'

/** 引擎状态 API */
export const API_SYSTEM_ENGINE_STATUS = '/api/system/engine-status'

/** 系统架构 API */
export const API_SYSTEM_ARCHITECTURE = '/api/system/architecture'

/** 风险监控 API */
export const API_SYSTEM_RISK_MONITOR = '/api/system/risk-monitor'

// ============================================================
// 交易 API 路径
// ============================================================

/** 盈亏分析 API */
export const API_TRADE_PNL_ANALYSIS = '/api/trade/pnl-analysis'

/** 持仓查询 API */
export const API_TRADE_POSITIONS = '/api/trade/positions'

/** 交易信号 API */
export const API_TRADE_SIGNALS = '/api/trade/signals'

/** 持仓列表 API (v1) */
export const API_TRADE_HOLDINGS = '/api/v1/trade/holdings'

/** 补仓操作 API (v1) */
export const API_TRADE_ADD_POSITION = '/api/v1/trade/add-position'

/** 平仓操作 API (v1) */
export const API_TRADE_CLOSE_POSITION = '/api/v1/trade/close-position'

/** 持仓导出 Excel API (v1) */
export const API_TRADE_HOLDINGS_EXPORT = '/api/v1/trade/holdings/export'

// ============================================================
// 数据采集 API 路径
// ============================================================

/** 基础数据采集 API */
export const API_COLLECT_BASIC = '/api/collect/basic'

/** K 线数据采集 API */
export const API_COLLECT_KLINE = '/api/collect/kline'

/** 财务数据采集 API */
export const API_COLLECT_FINANCIAL = '/api/collect/financial'
