/**
 * 内部 API 路径集中配置
 *
 * @description
 * 所有内部 API 端点路径必须从此文件导入，
 * 禁止在 constants / services / components 层硬编码 API 路径字符串。
 *
 * @module config/apiPaths
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
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

/** 板块轮动评分采集 API（申万二级，按 hot-momentum-strategy.md §2.5） */
export const API_COLLECT_SECTORS = '/api/collect/sectors'

/** 筹码分布采集 API（CYQ 模型，P1 阶段） */
export const API_COLLECT_CHIP = '/api/collect/chip'

/** LLM Key 同步到 Python 服务配置端点（供 .secrets/ 读取） */
export const API_COLLECT_CONFIG_LLM_KEY = '/api/collect/config/llm-key'

// ============================================================
// 代理 API 路径（Vite proxy 转发）
// ============================================================

/** Qwen/DashScope LLM 代理路径（浏览器环境经 Vite proxy 转发） */
export const API_PROXY_QWEN_GENERATION = '/api/proxy/qwen/api/v1/services/aigc/text-generation/generation'

/** 腾讯 Smartbox 搜索代理路径（Vite proxy 转发） */
export const API_PROXY_SMARTBOX = '/api/proxy/smartbox/'

// ============================================================
// 外部规范 URL（非内部 API，但需集中管理避免硬编码）
// ============================================================

/** JSON Schema draft-07 规范标识符 URL（用于 $schema 字段） */
export const JSON_SCHEMA_DRAFT_07_URL = 'http://json-schema.org/draft-07/schema#'

// ============================================================
// 外部服务地址（非 API 路径，但需集中管理避免硬编码）
// ============================================================

/** 后端 Embedding Service 地址（向量维度迁移用） */
export const EMBEDDING_SERVICE_URL = 'http://localhost:8001'
