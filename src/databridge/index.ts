/**
 * @module DataBridgeAdapter
 * @lifecycle @Global
 * @description DataBridge 扩展适配层，提供面向模块的便捷数据访问接口
 */

import { DataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { StandardEnvelope } from '@/core/envelope'
import type { DataBridgeAdapterConfig, DataAction, BridgeQueryOptions, BridgeQueryResult } from '@/types/modules/databridge.types'

const logger = getLogger()

export type { DataBridgeAdapterConfig, DataAction, BridgeQueryOptions, BridgeQueryResult } from '@/types/modules/databridge.types'

export class DataBridgeAdapter {
  private bridge: DataBridge
  private config: DataBridgeAdapterConfig
  private pendingQueries = new Map<string, { resolve: (r: BridgeQueryResult) => void; reject: (e: Error) => void }>()

  constructor(config: DataBridgeAdapterConfig = {}) {
    this.config = {
      enableFallbackQueue: true,
      defaultTimeout: 10000,
      ...config,
    }
    this.bridge = new DataBridge()
    logger.info('[DataBridgeAdapter] Initialized')
  }

  async query<T = unknown>(
    action: DataAction,
    payload: Record<string, unknown> = {},
    options: BridgeQueryOptions = {},
  ): Promise<BridgeQueryResult<T>> {
    const traceId = `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const timeout = options.timeout ?? this.config.defaultTimeout ?? 10000

    logger.info(`[DataBridgeAdapter] query() action="${action}", traceId="${traceId}"`)

    const envelope = EnvelopeFactory.create(
      {
        action: action as unknown as import('@/config/dbConfig').EnvelopeAction,
        source: 'system' as import('@/config/dbConfig').ModuleId,
        target: 'db' as import('@/config/dbConfig').EnvelopeTarget,
        traceId,
      },
      payload,
    )

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingQueries.delete(traceId)
        logger.warn(`[DataBridgeAdapter] Query timeout: action="${action}", traceId="${traceId}"`)
        resolve({
          success: false,
          error: `Query timeout after ${timeout}ms`,
          traceId,
        })
      }, timeout)

      this.pendingQueries.set(traceId, {
        resolve: (result: BridgeQueryResult<unknown>) => {
          clearTimeout(timer)
          this.pendingQueries.delete(traceId)
          resolve(result as BridgeQueryResult<T>)
        },
        reject: (err: Error) => {
          clearTimeout(timer)
          this.pendingQueries.delete(traceId)
          reject(err)
        },
      })

      this.bridge
        .forward(envelope)
        .then(() => {
          logger.debug(`[DataBridgeAdapter] Query forwarded: traceId="${traceId}"`)
          const result: BridgeQueryResult<T> = {
            success: true,
            data: envelope.payload as T,
            traceId,
          }
          this.pendingQueries.get(traceId)?.resolve(result)
        })
        .catch((err) => {
          logger.error(`[DataBridgeAdapter] Query failed: traceId="${traceId}", error="${err.message}"`)
          const result: BridgeQueryResult<T> = {
            success: false,
            error: err.message,
            traceId,
          }
          this.pendingQueries.get(traceId)?.resolve(result)
        })
    })
  }

  subscribe(channel: string, callback: (envelope: StandardEnvelope) => void): () => void {
    logger.debug(`[DataBridgeAdapter] subscribe() channel="${channel}"`)
    return eventBus.on(channel, callback as (payload: unknown) => void)
  }

  getStats() {
    return {
      pendingQueries: this.pendingQueries.size,
      enableFallbackQueue: this.config.enableFallbackQueue,
    }
  }
}

// Singleton
let adapterInstance: DataBridgeAdapter | null = null

export function createDataBridgeAdapter(config?: DataBridgeAdapterConfig): DataBridgeAdapter {
  if (adapterInstance) return adapterInstance
  adapterInstance = new DataBridgeAdapter(config)
  return adapterInstance
}

export function getDataBridgeAdapter(): DataBridgeAdapter {
  if (!adapterInstance) {
    throw new Error('DataBridgeAdapter not initialized. Call createDataBridgeAdapter() first.')
  }
  return adapterInstance
}

export function destroyDataBridgeAdapter(): void {
  adapterInstance = null
  logger.info('[DataBridgeAdapter] Instance destroyed')
}
