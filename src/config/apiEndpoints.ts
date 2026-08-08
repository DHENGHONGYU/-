/**
 * API 端点配置
 *
 * @description
 * 集中管理外部 AI 服务与后端 embedding 服务的 API 路径，
 * 禁止在 services / components 层硬编码这些路径字符串。
 *
 * 注：腾讯 Smartbox 搜索代理路径已存在于 `marketDataEndpoints.ts`
 * 的 `TENCENT_SMARTBOX_API`，此处不重复定义。
 *
 * @module config/apiEndpoints
 * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033]
 */

/** 向量嵌入 API 基础路径（通过 Vite proxy 转发到 localhost:8001） */
export const EMBEDDING_API_BASE_PATH = '/api/embed' as const

/** 通义千问 DashScope 原生 API 端点（阿里云百炼，支持 enable_search 联网搜索） */
export const DASHSCOPE_API_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' as const

/** 通义千问代理路径（浏览器环境通过 Vite proxy 转发至 DashScope） */
export const QWEN_PROXY_PATH =
  '/api/proxy/qwen/api/v1/services/aigc/text-generation/generation' as const
