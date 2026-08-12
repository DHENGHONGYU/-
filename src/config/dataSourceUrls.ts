/**
 * 外部数据源 URL 集中配置（绝对 URL — Node 环境 / Electron 主进程直连）
 *
 * @description
 * 所有第三方金融数据 API 的绝对基地址必须从此文件导入，
 * 禁止在 services 层硬编码外部 URL。
 *
 * ⚠️ **配置源分工说明（消除混淆）**：
 *   - 本文件（dataSourceUrls.ts）：**绝对 URL**，用于 Node 环境 / Electron 主进程 fetch 直连
 *     （如 Tushare Pro HTTPS、东方财富直连、新闻源、LLM API、WebSocket）
 *   - `@/config/marketDataEndpoints`：**Vite proxy 路径**（/api/proxy/*），用于浏览器 fetch
 *     （经 Vite dev server 代理转发至真实 URL，解决 CORS 限制）
 *   - 两者**不可混用**：浏览器代码用 marketDataEndpoints，Node 代码用 dataSourceUrls
 *
 * ⚠️ **MOCK_* 命名说明**：
 *   `MOCK_NEWS_URL_PREFIX` / `MOCK_WIZARD_API_BASE_URL` 确实是 Mock 占位 URL。
 *   已删除的 `MOCK_TENCENT/SINA/NETEASE_BASE_URL` 历史上含 MOCK 前缀但实际值是真实地址，
 *   经 TD-015 治理确认无消费者，已删除（2026-08-09）。
 *   `MOCK_AKSHARE_BASE_URL` 已重命名为 `AKSHARE_LOCAL_BASE_URL`（运行时直连本地 Python 服务）。
 *
 * @module config/dataSourceUrls
 * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
 */
export const TENCENT_QUOTE_API = 'https://qt.gtimg.cn/q'

/** 腾讯财经 K 线 API */
export const TENCENT_KLINE_API = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'

/** 新浪财经实时行情 API */
export const SINA_QUOTE_API = 'https://hq.sinajs.cn/list'

/** 网易财经历史数据 API */
export const NETEASE_HISTORY_API = 'https://quotes.163.com/service/chddata.html'

/** Tushare 金融数据 API */
export const TUSHARE_API = 'http://api.tushare.pro'

/** Mock 新闻 URL 前缀 */
export const MOCK_NEWS_URL_PREFIX = 'https://mock.news'

// ============================================================
// 数据源基地址（运行时使用）
//
// TD-015 治理说明（2026-08-09）：
// - 已删除 MOCK_TENCENT/SINA/NETEASE_BASE_URL（死代码，无消费者）
// - MOCK_AKSHARE_BASE_URL 重命名为 AKSHARE_LOCAL_BASE_URL（运行时直连本地 Python 服务）
// - FetcherConfigPage 使用 @/config/dataSourceRegistry 的 DATA_SOURCE_ENDPOINTS，不依赖此处的 MOCK_* 常量
// ============================================================

/** AKShare 本地 Python 采集服务基地址（运行时直连，端口 8000） */
export const AKSHARE_LOCAL_BASE_URL = 'http://localhost:8000'

/** 采集向导 Mock API 基地址（占位符，仅用于开发阶段示例） */
export const MOCK_WIZARD_API_BASE_URL = 'https://api.example.com'

// ============================================================
// P2 硬编码消除：直连 URL / WebSocket / LLM API 端点
// ============================================================

/** Tushare Pro 直连 URL（Node 环境 fallback，浏览器走 Vite 代理） */
export const TUSHARE_DIRECT_URL = 'https://api.tushare.pro'

/** 默认 WebSocket 地址（Mock 采集器使用） */
export const DEFAULT_WS_URL = 'ws://localhost:8000/ws'

/** 阿里云百炼 DashScope API 端点（Qwen-Plus 联网搜索） */
export const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

// ============================================================
// 新闻来源 URL（NewsCrawler 使用）
// ============================================================

/** 新浪财经新闻源 */
export const NEWS_SOURCE_SINA = 'https://finance.sina.com.cn'

/** 证券时报新闻源 */
export const NEWS_SOURCE_STCN = 'https://www.stcn.com'

/** 东方财富新闻源 */
export const NEWS_SOURCE_EASTMONEY = 'https://www.eastmoney.com'

/** 雪球新闻源 */
export const NEWS_SOURCE_XUEQIU = 'https://xueqiu.com'

// ============================================================
// 测试用 Mock URL（test-utils 使用）
// ============================================================

/** 测试用新闻 URL */
export const TEST_MOCK_NEWS_URL = 'https://example.com/news/1'

/** 测试用 LLM baseURL */
export const TEST_MOCK_LLM_BASE_URL = 'http://localhost'
