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
 * @module config/marketDataEndpoints

/** 腾讯财经实时行情 API 基础地址（经 Vite proxy 转发） */
export const TENCENT_API_BASE = '/api/proxy/tencent/'

/** 腾讯财经 API Referer（Vite proxy 自动添加） */
export const TENCENT_REFERER = 'https://finance.qq.com'

/** 新浪实时行情 API 基础地址（经 Vite proxy 转发） */
export const SINA_API_BASE = '/api/proxy/sina/'

/** 新浪 API Referer */
export const SINA_REFERER = 'https://finance.sina.com.cn'

/** 网易历史行情 API 地址（已不可用，DNS 不可达，保留占位） */
export const NETEASE_API_BASE = '/api/proxy/netease'
