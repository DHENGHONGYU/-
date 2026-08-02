/**
 * @fileoverview 全局时序/防抖/节流常量集合。
 *
 * 各模块共享的时间相关魔法数字统一沉淀至此，禁止在业务代码中写死数字。
 * 命名规范：`<用途>_<粒度>_MS = <毫秒数>`。
 *
 * @module constants/timing.constants
 */

// ============================================================
// 防抖（Debounce）—— 输入/保存/刷新等高频事件聚合
// ============================================================

/** 输入框搜索防抖（极轻量，<100ms 体验接近实时） */
export const DEBOUNCE_INPUT_LIGHT_MS = 80

/** 通用 Store 订阅者刷新防抖（默认 100ms，兼顾实时性与性能） */
export const DEBOUNCE_MS = 100

/** 表单/筛选防抖（用户连续打字场景） */
export const DEBOUNCE_FORM_INPUT_MS = 250

/** Store 持久化写入防抖（防止频繁写入 IndexedDB） */
export const DEBOUNCE_STORE_PERSIST_MS = 500

/** LLM/打分触发防抖（重量级操作，避免用户多次点击） */
export const DEBOUNCE_SCORE_TRIGGER_MS = 5000

// ============================================================
// 节流（Throttle）—— 滚动/重绘/批量进度等周期事件
// ============================================================

/** 滚动/Resize 节流 */
export const THROTTLE_SCROLL_MS = 16

/** UI 进度条刷新节流（60fps 的 1/2 ≈ 32ms 已足够平滑） */
export const THROTTLE_PROGRESS_UI_MS = 32

// ============================================================
// 超时与重试
// ============================================================

/** 市场行情 HTTP 请求超时（AKShare 偶发慢查询） */
export const TIMEOUT_MARKET_HTTP_MS = 30_000

/** LLM 请求超时（大模型长生成场景） */
export const TIMEOUT_LLM_GENERATE_MS = 120_000

/** 默认最大重试次数 */
export const RETRY_MAX_ATTEMPTS = 3

/** 指数退避初始间隔（ms） */
export const RETRY_BACKOFF_BASE_MS = 500

// ============================================================
// 本地缓存与轮询
// ============================================================

/** 前台行情轮询间隔（用户查看页面时） */
export const POLL_MARKET_FOREGROUND_MS = 10_000

/** 后台行情轮询间隔（页面挂起时降低频率） */
export const POLL_MARKET_BACKGROUND_MS = 60_000
