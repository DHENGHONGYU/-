/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { getLogger } from '@/lib/logger'
import { BaseCollector } from './BaseCollector'
import type { RawMarketData, DataSourceConfig, CollectorConfig } from '@/types/modules/widget.types'
import { REST_COLLECTOR_CONFIG } from '@/constants/cockpit.constants'

const logger = getLogger()

/**
 * REST API 数据采集器
 * @description 通过 HTTP 轮询获取数据，支持 GET/POST 请求
 * @remarks 当环境变量 VITE_DATA_SOURCE_TYPE=rest 时启用
 */
export class RestCollector extends BaseCollector {
  private baseUrl: string

  constructor(config?: Partial<CollectorConfig>) {
    super(config)
    this.baseUrl = REST_COLLECTOR_CONFIG.BASE_URL
  }

  /**
   * 执行 REST API 数据采集
   * @param dataSource 数据源配置
   */
  async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
    const { endpoint = '' } = dataSource
    const url = `${this.baseUrl}${endpoint}`

    logger.debug(`[RestCollector] 请求 API: ${url}`)

    const signal = this.abortController?.signal

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...REST_COLLECTOR_CONFIG.DEFAULT_HEADERS,
        ...this.config.headers,
      },
      signal,
    })

    if (!response.ok) {
      throw new Error(`[RestCollector] HTTP ${response.status}: ${response.statusText}`)
    }

    const rawData: unknown = await response.json()
    logger.debug(`[RestCollector] 数据获取成功: ${url}`)

    // 根据 endpoint 推断数据类型
    const dataType = this.inferDataType(endpoint)

    return this.wrapData(dataType, rawData, 'rest')
  }

  /**
   * 发送 POST 请求（用于需要请求体的场景）
   * @param dataSource 数据源配置
   * @param body 请求体
   */
  async collectPost(dataSource: DataSourceConfig, body?: Record<string, unknown>): Promise<RawMarketData> {
    const { endpoint = '' } = dataSource
    const url = `${this.baseUrl}${endpoint}`

    logger.debug(`[RestCollector] POST 请求: ${url}`)

    const signal = this.abortController?.signal

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...REST_COLLECTOR_CONFIG.DEFAULT_HEADERS,
        ...this.config.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })

    if (!response.ok) {
      throw new Error(`[RestCollector] HTTP ${response.status}: ${response.statusText}`)
    }

    const rawData: unknown = await response.json()
    const dataType = this.inferDataType(endpoint)

    return this.wrapData(dataType, rawData, 'rest')
  }

  /**
   * 根据 endpoint 推断数据类型
   * @param endpoint API 端点
   */
  private inferDataType(endpoint: string): RawMarketData['dataType'] {
    if (endpoint.includes('indices')) return 'indices'
    if (endpoint.includes('sectors')) return 'sectors'
    if (endpoint.includes('fund-flow')) return 'fundFlow'
    if (endpoint.includes('sentiment')) return 'sentiment'
    if (endpoint.includes('watchlist')) return 'watchlist'
    if (endpoint.includes('portfolio')) return 'portfolio'
    if (endpoint.includes('trade-review')) return 'tradeReview'
    return 'indices'
  }
}
