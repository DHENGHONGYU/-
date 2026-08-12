/**
 * 超时值集中配置
 *
 * @description
 * 所有服务层超时值必须从此文件导入，禁止在业务代码中硬编码毫秒数。
 * 修改超时策略只需修改本文件。
 *
 * @module config/timeouts
/** 股票分析引擎超时（ms）  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/
export const ANALYSIS_ENGINE_TIMEOUT_MS = 30_000

/** 数据采集超时（ms） */
export const DATA_COLLECTION_TIMEOUT_MS = 10_000

/** 默认请求超时（ms） */
export const DEFAULT_REQUEST_TIMEOUT_MS = 5_000

/** LLM 调用超时（ms） */
export const LLM_CALL_TIMEOUT_MS = 60_000

/** LLM 搜索请求超时（ms）— llmSearchAgent 使用 */
export const LLM_SEARCH_TIMEOUT_MS = 15_000

/** 直连行情 API 请求超时（ms）— fetcher/directDataAPI 使用 */
export const DIRECT_DATA_API_TIMEOUT_MS = 30_000

/** 降级链退避基础延迟（ms）— ResilienceChain 源切换间隔，高并发下避免 thundering herd */
export const RESILIENCE_BACKOFF_BASE_MS = 200

/** 降级链退避最大延迟（ms）— 指数退避上限 */
export const RESILIENCE_BACKOFF_MAX_MS = 2_000
