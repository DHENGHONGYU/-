import { getLogger } from '@/lib/logger'
import { BaseCollector } from './BaseCollector'
import type { RawMarketData, DataSourceConfig, CollectorConfig } from '@/types/modules/widget.types'
import { WEBSOCKET_COLLECTOR_CONFIG } from '@/constants/cockpit.constants'

const logger = getLogger()

/**
 * WebSocket 数据采集器
 * @description 用于长连接实时推流，支持自动重连
 * @remarks 当环境变量 VITE_DATA_SOURCE_TYPE=websocket 时启用
 * @todo 内部逻辑可根据实际 WebSocket 服务端协议补充实现
 */
export class WebSocketCollector extends BaseCollector {
  private ws: WebSocket | null = null
  private reconnectCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private messageQueue: string[] = []
  private onMessageCallback: ((data: RawMarketData) => void) | null = null

  constructor(config?: Partial<CollectorConfig>) {
    super(config)
  }

  /**
   * 执行 WebSocket 连接（预留扩展接口）
   * @param dataSource 数据源配置
   * @remarks 当前为预留接口，内部逻辑待后续补充
   */
  async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
    const { endpoint = '' } = dataSource
    logger.info(`[WebSocketCollector] 初始化连接: ${WEBSOCKET_COLLECTOR_CONFIG.WS_URL}${endpoint}`)

    // 预留：建立 WebSocket 连接
    // this.connect(endpoint)

    // 返回占位数据（实际应通过消息回调推送）
    return this.wrapData('indices', { message: 'WebSocket 连接预留接口' }, 'websocket')
  }

  /**
   * 建立 WebSocket 连接
   * @param endpoint 端点路径
   */
  connect(endpoint: string): void {
    const url = `${WEBSOCKET_COLLECTOR_CONFIG.WS_URL}${endpoint}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        logger.info(`[WebSocketCollector] 连接成功: ${url}`)
        this.reconnectCount = 0
        this.flushMessageQueue()
      }

      this.ws.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data as string)
          const dataType = this.inferDataType(endpoint)
          const wrappedData = this.wrapData(dataType, rawData, 'websocket')
          this.onMessageCallback?.(wrappedData)
        } catch (error) {
          logger.error('[WebSocketCollector] 消息解析失败', { error })
        }
      }

      this.ws.onclose = () => {
        logger.warn('[WebSocketCollector] 连接关闭')
        this.handleReconnect(endpoint)
      }

      this.ws.onerror = (error) => {
        logger.error('[WebSocketCollector] 连接错误', { error })
      }
    } catch (error) {
      logger.error(`[WebSocketCollector] 连接失败: ${url}`, { error })
      this.handleReconnect(endpoint)
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    logger.info('[WebSocketCollector] 连接已断开')
  }

  /**
   * 发送消息
   * @param message 消息内容
   */
  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message)
    } else {
      this.messageQueue.push(message)
    }
  }

  /**
   * 设置消息接收回调
   * @param callback 回调函数
   */
  onMessage(callback: (data: RawMarketData) => void): void {
    this.onMessageCallback = callback
  }

  /**
   * 处理重连逻辑
   * @param endpoint 端点路径
   */
  private handleReconnect(endpoint: string): void {
    const { RECONNECT_INTERVAL, MAX_RECONNECT_COUNT } = WEBSOCKET_COLLECTOR_CONFIG

    if (this.reconnectCount < MAX_RECONNECT_COUNT) {
      this.reconnectCount++
      logger.info(`[WebSocketCollector] ${RECONNECT_INTERVAL}ms 后重连 (${this.reconnectCount}/${MAX_RECONNECT_COUNT})`)

      this.reconnectTimer = setTimeout(() => {
        this.connect(endpoint)
      }, RECONNECT_INTERVAL)
    } else {
      logger.error('[WebSocketCollector] 已达到最大重连次数')
    }
  }

  /**
   * 刷新消息队列
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()
      if (message) this.ws.send(message)
    }
  }

  /**
   * 根据 endpoint 推断数据类型
   * @param endpoint 端点路径
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

  /**
   * 取消采集（断开连接）
   */
  override cancel(): void {
    this.disconnect()
    super.cancel()
  }
}
