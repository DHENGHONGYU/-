/**
 * 外部数据源 URL 集中配置
 *
 * @description
 * 所有第三方金融数据 API 的基地址必须从此文件导入，
 * 禁止在 services 层硬编码外部 URL。
 *
 * @module config/dataSourceUrls
 */

/** 腾讯财经实时行情 API */
export const TENCENT_QUOTE_API = 'https://qt.gtimg.cn/q'

/** 腾讯财经 K 线 API */
export const TENCENT_KLINE_API = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'

/** 新浪财经实时行情 API */
export const SINA_QUOTE_API = 'https://hq.sinajs.cn/list'

/** 网易财经历史数据 API */
export const NETEASE_HISTORY_API = 'https://quotes.163.com/service/chddata.html'

/** Mock 新闻 URL 前缀 */
export const MOCK_NEWS_URL_PREFIX = 'https://mock.news'

// ============================================================
// Mock / Demo 数据源基地址（用于 FetcherConfigPage 展示）
// ============================================================

/** 腾讯财经 Mock 数据源基地址 */
export const MOCK_TENCENT_BASE_URL = 'https://proxy.finance.qq.com'

/** 新浪财经 Mock 数据源基地址 */
export const MOCK_SINA_BASE_URL = 'https://hq.sinajs.cn'

/** 网易财经 Mock 数据源基地址 */
export const MOCK_NETEASE_BASE_URL = 'https://api.money.126.net'

/** AKShare 本地服务基地址 */
export const MOCK_AKSHARE_BASE_URL = 'http://localhost:8000'
