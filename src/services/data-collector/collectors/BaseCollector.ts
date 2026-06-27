import { getLogger } from '@/lib/logger'
import type { RawMarketData, DataSourceConfig, CollectorConfig } from '@/types/modules/widget.types'
import { COLLECTOR_DEFAULT_CONFIG } from '@/constants/cockpit.constants'

const logger = getLogger()

/**
 * 采集器基类
 * @description 提供全局超时中断、统一错误捕获、重试机制等通用能力
 * @abstract 所有具体采集器必须继承此类
 */
export abstract class BaseCollector {
  protected config: CollectorConfig
  protected abortController: AbortController | null = null
  protected isRunning = false

  constructor(config?: Partial<CollectorConfig>) {
    this.config = {
      timeout: config?.timeout ?? COLLECTOR_DEFAULT_CONFIG.TIMEOUT,
      retryCount: config?.retryCount ?? COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT,
      retryInterval: config?.retryInterval ?? COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL,
      headers: config?.headers,
    }
  }

  /**
   * 执行数据采集
   * @param dataSource 数据源配置
   * @returns 原始市场数据
   * @abstract 子类必须实现此方法
   */
  abstract collect(dataSource: DataSourceConfig): Promise<RawMarketData>

  /**
   * 带超时和重试的采集包装器
   * @param dataSource 数据源配置
   * @returns 原始市场数据
   */
  async collectWithRetry(dataSource: DataSourceConfig): Promise<RawMarketData> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        // 每次重试创建新的 AbortController
        this.abortController = new AbortController()

        const result = await this.executeWithTimeout(dataSource)
        this.isRunning = false
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        logger.warn(
          `[BaseCollector] 采集失败 (attempt ${attempt + 1}/${this.config.retryCount + 1}): ${lastError.message}`
        )

        if (attempt < this.config.retryCount) {
          logger.info(`[BaseCollector] ${this.config.retryInterval}ms 后重试...`)
          await this.delay(this.config.retryInterval)
        }
      }
    }

    this.isRunning = false
    throw lastError ?? new Error('采集失败，已达到最大重试次数')
  }

  /**
   * 执行带超时的采集
   * @param dataSource 数据源配置
   * @returns 原始市场数据
   */
  private async executeWithTimeout(dataSource: DataSourceConfig): Promise<RawMarketData> {
    return new Promise((resolve, reject) => {
      if (!this.abortController) {
        reject(new Error('AbortController 未初始化'))
        return
      }

      // 设置超时定时器
      const timeoutId = setTimeout(() => {
        this.abortController?.abort()
        reject(new Error(`采集超时 (${this.config.timeout}ms)`))
      }, this.config.timeout)

      this.isRunning = true

      // 执行实际采集
      this.collect(dataSource)
        .then((result) => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * 取消当前采集任务
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
      this.isRunning = false
      logger.info('[BaseCollector] 采集任务已取消')
    }
  }

  /**
   * 获取当前运行状态
   */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * 延迟工具方法
   * @param ms 延迟毫秒数
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 生成统一的数据包装格式
   * @param dataType 数据类型
   * @param payload 原始数据
   * @param source 数据来源标识
   */
  protected wrapData(
    dataType: RawMarketData['dataType'],
    payload: unknown,
    source: string
  ): RawMarketData {
    return {
      timestamp: Date.now(),
      dataType,
      payload,
      source,
    }
  }
}
