/**
 * 数据采集模块配置
 *
 * 原则：
 * - 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
 * - 所有默认值可通过环境变量覆盖。
  * @doc [V9-DOC-PROJ-092, V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/

import { isLlmApiKeyConfigured } from './llmConfig'

export type FetcherFrequency =
  | 'realtime'
  | '1h'
  | '3h'
  | 'daily'
  | '3d'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'manual'

export const FETCHER_FREQUENCY_LABELS: Record<FetcherFrequency, string> = {
  realtime: '实时',
  '1h': '1小时',
  '3h': '3小时',
  daily: '日收盘后',
  '3d': '3日',
  weekly: '每周',
  biweekly: '双周',
  monthly: '月度',
  quarterly: '季度',
  manual: '手动',
}

export const FETCHER_FREQUENCY_MINUTES: Record<FetcherFrequency, number | null> = {
  realtime: 5,
  '1h': 60,
  '3h': 180,
  daily: 1440,
  '3d': 4320,
  weekly: 10080,
  biweekly: 20160,
  monthly: 43200,
  quarterly: 129600,
  manual: null,
}

export interface FetcherServiceConfig {
  baseURL: string
  timeoutMs: number
  retries: number
}

export interface FetcherDimensionConfig {
  code: string
  name: string
  enabled: boolean
  frequency: FetcherFrequency
  sources: string[]
  cacheTtlMinutes: number
  fields: string[]
}

export interface FetcherGlobalConfig {
  maxSymbols: number
  batchSize: number
  defaultFrequency: FetcherFrequency
  rateLimitPerMinute: number
  rateLimitPerHour: number
  rateLimitPerDay: number
  notifyOnComplete: boolean
  notifyOnError: boolean
}

export interface FetcherConfig {
  version: string
  service: FetcherServiceConfig
  global: FetcherGlobalConfig
  dimensions: FetcherDimensionConfig[]
}

export function getDefaultFetcherServiceConfig(): FetcherServiceConfig {
  return {
    baseURL: import.meta.env.VITE_AKSHARE_BASE_URL ?? 'http://localhost:8000',
    timeoutMs: 30000,
    retries: 3,
  }
}

export function getDefaultFetcherGlobalConfig(): FetcherGlobalConfig {
  return {
    maxSymbols: 40,
    batchSize: 10,
    defaultFrequency: 'daily',
    rateLimitPerMinute: 10,
    rateLimitPerHour: 200,
    rateLimitPerDay: 1000,
    notifyOnComplete: true,
    notifyOnError: true,
  }
}

export function getDefaultFetcherDimensions(): FetcherDimensionConfig[] {
  return [
    {
      code: '01',
      name: '基本信息',
      enabled: true,
      frequency: 'monthly',
      sources: ['akshare'],
      cacheTtlMinutes: 43200,
      fields: ['name', 'price', 'pe', 'pb', 'roe', 'market_cap'],
    },
    {
      code: '02',
      name: 'K线数据',
      enabled: true,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['open', 'high', 'low', 'close', 'volume', 'amount'],
    },
    {
      code: '03',
      name: '筹码分布',
      enabled: false,
      frequency: '3d',
      sources: ['akshare'],
      cacheTtlMinutes: 4320,
      fields: ['股东户数', '户均持股', '机构持仓', '十大流通股东'],
    },
    {
      code: '04',
      name: '重大事项',
      enabled: false,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['公告标题', '公告类型', '发布日期', 'PDF链接'],
    },
    {
      code: '05',
      name: '热点新闻',
      enabled: false,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['标题', '摘要', '来源', '日期', '链接'],
    },
    {
      code: '06',
      name: '行业竞品',
      enabled: false,
      frequency: 'weekly',
      sources: ['akshare'],
      cacheTtlMinutes: 10080,
      fields: ['行业排名', '竞品对比', 'ETF规模'],
    },
    {
      code: '07',
      name: '关联指数',
      enabled: false,
      frequency: 'weekly',
      sources: ['akshare'],
      cacheTtlMinutes: 10080,
      fields: ['所属指数', 'ETF代码', 'ETF规模'],
    },
    {
      code: '08',
      name: '研报中心',
      enabled: false,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['标题', '作者', '评级', '目标价', '摘要'],
    },
  ]
}

export function getDefaultFetcherConfig(): FetcherConfig {
  return {
    version: '0.9.1',
    service: getDefaultFetcherServiceConfig(),
    global: getDefaultFetcherGlobalConfig(),
    dimensions: getDefaultFetcherDimensions(),
  }
}

// ──────────────────────────────────────────────
// 外部 API 配置健康检查（仅检查配置完整性，不发网络请求）
// ──────────────────────────────────────────────

/** 单个 API 供应商的配置健康状态 */
export interface ApiConfigHealthStatus {
  /** 供应商标识（如 akshare、rest_collector、websocket_collector、llm） */
  id: string
  /** 供应商中文名称 */
  name: string
  /** 配置是否完整可用 */
  configured: boolean
  /** 各字段配置明细 */
  checks: Array<{
    field: string
    value: string
    ok: boolean
    hint: string
  }>
  /** 总体状态摘要 */
  summary: string
}

/** 全部外部 API 配置健康报告 */
export interface ApiHealthReport {
  /** 检查时间（ISO 8601） */
  checkedAt: string
  /** 各供应商健康状态 */
  providers: ApiConfigHealthStatus[]
  /** 已配置（完整）的供应商数量 */
  configuredCount: number
  /** 供应商总数 */
  totalCount: number
  /** 是否全部就绪 */
  allConfigured: boolean
}

/**
 * 获取所有外部 API 供应商的配置健康状态。
 *
 * **设计原则**：
 * - 仅检查配置完整性（baseURL、apiKey、timeout 等是否设置），不发起网络请求
 * - 覆盖 4 个外部 API：AkShare（fetcher）、REST Collector、WebSocket Collector、LLM
 * - 返回结构化报告，方便前端展示或日志记录
 */
export function getApiHealthStatus(): ApiHealthReport {
  const providers: ApiConfigHealthStatus[] = []

  // 1. AkShare 数据采集服务
  const akshareConfig = getDefaultFetcherServiceConfig()
  const akshareChecks = [
    {
      field: 'baseURL',
      value: akshareConfig.baseURL,
      ok: !!akshareConfig.baseURL && akshareConfig.baseURL !== 'http://localhost:8000',
      hint: 'VITE_AKSHARE_BASE_URL — 应指向远程 AkShare 服务（非 localhost）',
    },
    {
      field: 'timeoutMs',
      value: String(akshareConfig.timeoutMs),
      ok: akshareConfig.timeoutMs > 0,
      hint: '请求超时时间（ms），默认 30000',
    },
    {
      field: 'retries',
      value: String(akshareConfig.retries),
      ok: akshareConfig.retries >= 0,
      hint: '失败重试次数，默认 3',
    },
  ]
  providers.push({
    id: 'akshare',
    name: 'AkShare 数据采集',
    configured: akshareChecks.every(c => c.ok),
    checks: akshareChecks,
    summary: akshareChecks.every(c => c.ok)
      ? 'AkShare 服务配置完整'
      : 'AkShare 服务配置不完整，baseURL 仍指向 localhost 或未设置',
  })

  // 2. REST Collector（行情 REST API）
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const restBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  const restChecks = [
    {
      field: 'baseURL',
      value: restBaseUrl,
      ok: !!restBaseUrl && restBaseUrl !== '/api',
      hint: 'VITE_API_BASE_URL — REST 行情数据服务地址',
    },
  ]
  providers.push({
    id: 'rest_collector',
    name: 'REST 行情采集',
    configured: restChecks.every(c => c.ok),
    checks: restChecks,
    summary: restChecks.every(c => c.ok)
      ? 'REST 行情服务配置完整'
      : 'REST 行情服务使用默认 /api（可能为 mock 模式）',
  })

  // 3. WebSocket Collector（实时行情推送）
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
  const wsChecks = [
    {
      field: 'wsUrl',
      value: wsUrl,
      ok: !!wsUrl && !wsUrl.includes('localhost'),
      hint: 'VITE_WS_URL — WebSocket 实时行情推送地址',
    },
  ]
  providers.push({
    id: 'websocket_collector',
    name: 'WebSocket 实时行情',
    configured: wsChecks.every(c => c.ok),
    checks: wsChecks,
    summary: wsChecks.every(c => c.ok)
      ? 'WebSocket 实时行情服务配置完整'
      : 'WebSocket 服务仍指向 localhost 或未配置',
  })

  // 4. LLM 大模型服务
  // P0-01 安全修复：API Key 从加密 localStorage 读取，不再从 VITE_ 环境变量读取
  const llmBaseUrl = import.meta.env.VITE_LLM_BASE_URL ?? ''
  const llmModel = import.meta.env.VITE_LLM_MODEL ?? 'deepseek-chat'
  const llmApiKeyConfigured = isLlmApiKeyConfigured()
  const llmChecks = [
    {
      field: 'baseURL',
      value: llmBaseUrl,
      ok: !!llmBaseUrl,
      hint: 'VITE_LLM_BASE_URL — LLM 服务地址',
    },
    {
      field: 'apiKey',
      value: llmApiKeyConfigured ? '已配置（加密存储）' : '(未配置)',
      ok: llmApiKeyConfigured,
      hint: 'API Key 通过 UI 配置页加密存储于 localStorage，不再使用环境变量',
    },
    {
      field: 'model',
      value: llmModel,
      ok: !!llmModel,
      hint: 'VITE_LLM_MODEL — 模型名称，默认 deepseek-chat',
    },
  ]
  providers.push({
    id: 'llm',
    name: 'LLM 大模型',
    configured: llmChecks.every(c => c.ok),
    checks: llmChecks,
    summary: llmChecks.every(c => c.ok)
      ? 'LLM 服务配置完整'
      : 'LLM 服务配置不完整，缺少 baseURL 或 apiKey',
  })

  const configuredCount = providers.filter(p => p.configured).length
  return {
    checkedAt: new Date().toISOString(),
    providers,
    configuredCount,
    totalCount: providers.length,
    allConfigured: configuredCount === providers.length,
  }
}
