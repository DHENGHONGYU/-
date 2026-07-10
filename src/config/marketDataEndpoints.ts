/**
 * 外部行情数据源端点配置
 *
 * @description
 * 直连腾讯/新浪/网易等公开行情 API 的基础 URL 与 Referer 集中管理。
 * 采集服务从此文件导入，禁止在 services/ 层硬编码外部 URL。
 *
 * @module config/marketDataEndpoints
/** 腾讯财经实时行情 API 基础地址 */
export const TENCENT_API_BASE = 'https://qt.gtimg.cn/q='

/** 腾讯财经 API Referer（部分代理场景需要） */
export const TENCENT_REFERER = 'https://finance.qq.com'

/** 新浪实时行情 API 基础地址 */
export const SINA_API_BASE = 'https://hq.sinajs.cn/list='

/** 网易历史行情 API 地址 */
export const NETEASE_API_BASE = 'https://quotes.163.com/service/chddata.html'
