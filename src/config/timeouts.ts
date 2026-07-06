/**
 * 超时值集中配置
 *
 * @description
 * 所有服务层超时值必须从此文件导入，禁止在业务代码中硬编码毫秒数。
 * 修改超时策略只需修改本文件。
 *
 * @module config/timeouts
 */

/** 股票分析引擎超时（ms） */
export const ANALYSIS_ENGINE_TIMEOUT_MS = 30_000

/** 数据采集超时（ms） */
export const DATA_COLLECTION_TIMEOUT_MS = 10_000

/** 默认请求超时（ms） */
export const DEFAULT_REQUEST_TIMEOUT_MS = 5_000

/** LLM 调用超时（ms） */
export const LLM_CALL_TIMEOUT_MS = 60_000
