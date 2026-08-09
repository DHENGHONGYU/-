/**
 * 外部数据源 URL 集中配置
 *
 * @description
 * 所有第三方金融数据 API 的基地址必须从此文件导入，
 * 禁止在 services 层硬编码外部 URL。
 *
 * @module config/dataSourceUrls
/** 腾讯财经实时行情 API  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
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
// 数据源基地址（用于 FetcherConfigPage 展示与默认 baseURL）
//
// v1.1.0（阶段 A-2）说明：
// - 历史上 `MOCK_*_BASE_URL` 用作 "MOCK 占位"，但实际值就是真实金融数据源地址。
// - FetcherConfigPage 用它们作为「数据源列表」的展示项。
// - 运行时真实请求走 `getDefaultFetcherServiceConfig().baseURL`（fetcherConfig）。
// - 两者需在 UI 上标注区别（"展示地址" vs "实际请求地址"），避免误以为已配置。
// ============================================================

/** 腾讯财经数据源基地址（用于 FetcherConfigPage 展示） */
export const MOCK_TENCENT_BASE_URL = 'https://proxy.finance.qq.com'

/** 新浪财经数据源基地址（用于 FetcherConfigPage 展示） */
export const MOCK_SINA_BASE_URL = 'https://hq.sinajs.cn'

/** 网易财经数据源基地址（用于 FetcherConfigPage 展示） */
export const MOCK_NETEASE_BASE_URL = 'https://api.money.126.net'

/** AKShare 本地服务基地址（用于 FetcherConfigPage 展示；运行时取 fetcherConfig.service.baseURL） */
export const MOCK_AKSHARE_BASE_URL = 'http://localhost:8000'

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
