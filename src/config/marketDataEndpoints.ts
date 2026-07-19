/**
 * 外部行情数据源端点配置
 *
 * @description
 * 直连腾讯/新浪/网易等公开行情 API 的基础 URL 与 Referer 集中管理。
 * 采集服务从此文件导入，禁止在 services/ 层硬编码外部 URL。
 *
 * 注：2026-07-13 改为 Vite dev server 代理路径（/api/proxy/*），
 * 配合 vite.config.ts server.proxy 规则解决浏览器 CORS 限制。
 *
 * 注：2026-07-19 为 crawlerProvider 新增东财直连端点（绝对 URL），
 * Node 环境 fetch 不走 Vite 代理，直接请求东财公开 API。
 *
 * @module config/marketDataEndpoints
 */

/** 腾讯财经实时行情 API 基础地址（经 Vite proxy 转发） */
export const TENCENT_API_BASE = '/api/proxy/tencent/'

/** 腾讯 Smartbox 搜索 API 基础地址（经 Vite proxy 转发，免费无需 Key） */
export const TENCENT_SMARTBOX_API = '/api/proxy/smartbox/'

/** 腾讯历史 K 线 API 基础地址（经 Vite proxy 转发至 web.ifzq.gtimg.cn） */
export const TENCENT_KLINE_API_BASE = '/api/proxy/tencent-kline/'

/** 新浪财经数据 API 基础地址（经 Vite proxy 转发至 vip.stock.finance.sina.com.cn，用于筹码/公告/新闻等非行情端点） */
export const SINA_FINANCE_API_BASE = '/api/proxy/sina-finance/'

/** 腾讯财经数据 API 基础地址（经 Vite proxy 转发，用于行业/板块等非行情端点） */
export const TENCENT_FINANCE_API_BASE = '/api/proxy/tencent-finance/'

/** 腾讯财经 API Referer（Vite proxy 自动添加） */
export const TENCENT_REFERER = 'https://finance.qq.com'

/** 新浪实时行情 API 基础地址（经 Vite proxy 转发） */
export const SINA_API_BASE = '/api/proxy/sina/'

/** 新浪 API Referer */
export const SINA_REFERER = 'https://finance.sina.com.cn'

/** 网易历史行情 API 地址。当前已不可用（DNS 不可达），保留占位以维持数据源注册表完整性。Phase 2 待替换为可用端点后移除。 */
export const NETEASE_API_BASE = '/api/proxy/netease'

/** 网易 API Referer */
export const NETEASE_REFERER = 'https://quotes.163.com'

/** Tushare Pro API 基础地址（经后端/Vite proxy 转发，由服务端持有 Token） */
export const TUSHARE_API_BASE = '/api/proxy/tushare/'

/** Mock 数据占位 URL（非真实端点，仅用于 _mock:true 示例数据） */
export const MOCK_NEWS_URL_TEMPLATE = 'https://example.com/news'

// ── 东方财富直连公开 API（Node 环境 fetch 绝对 URL，不依赖 Vite 代理）──

/** 东方财富 F10 股东研究 API 基础地址（2026-07-19 curl 验证可用） */
export const EASTMONEY_F10_SHAREHOLDER_API =
  'https://emweb.securities.eastmoney.com/PC_HSF10/ShareholderResearch/PageAjax'

/** 东方财富公告 API 基础地址（2026-07-19 curl 验证可用，返回 1068 条真实公告） */
export const EASTMONEY_ANNOUNCEMENT_API =
  'https://np-anotice-stock.eastmoney.com/api/security/ann'

/**
 * 东方财富新闻 API（push2）。
 *
 * 2026-07-19 curl 验证：push2.eastmoney.com/api/qt/stock/news/get 始终返回空响应，
 * 疑似需要浏览器 Cookie / 反爬令牌。标记为 UNAVAILABLE，crawlerProvider 将直接返回空数组。
 */
export const EASTMONEY_NEWS_API_UNAVAILABLE = true

/**
 * 东方财富研报 API（reportapi）。
 *
 * 2026-07-19 curl 验证：reportapi.eastmoney.com/report/list 端点可返回数据，
 * 但 stockCode 过滤参数不生效（返回全市场研报，无法按股票筛选）。
 * 标记为 UNAVAILABLE，crawlerProvider 将直接返回空数组。
 */
export const EASTMONEY_RESEARCH_API_UNAVAILABLE = true

/**
 * 东方财富行业竞品 API。
 *
 * 2026-07-19 curl 验证：push2.eastmoney.com 同行业股票查询返回 rc:102（疑似反爬拦截），
 * F10 IndustryAnalysis 端点无同行业股票数据。
 * 标记为 UNAVAILABLE，crawlerProvider 将直接返回空数组。
 */
export const EASTMONEY_INDUSTRY_API_UNAVAILABLE = true
