/**
 * @fileoverview 注册编排器 — 监听批量导入完成事件，自动触发数据采集管道
 *
 * 断点位置：batchImportExecutor.ts emit('BATCH_IMPORT_COMPLETED') 无消费者
 * 本模块消费该事件，调用 collectionPipeline.runBatchTrace 启动 8 维度采集。
 *
 * @module services/orchestration/registrationOrchestrator
 * @created 2026-07-25 - P0 数据链路打通
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { runBatchTrace, createDefaultCollectionConfig } from '@/services/data-collector/collectionPipeline'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 采集维度代码 */
const COLLECTION_DIMENSIONS = [
  'quote',
  'kline',
  'news',
  'research',
  'competitor',
  'index',
  'chip',
  'research-detail',
] as const

export type CollectionDimensionCode = (typeof COLLECTION_DIMENSIONS)[number]

/** 编排器配置 */
export interface RegistrationOrchestratorConfig {
  /** 是否自动触发采集（默认 true） */
  autoCollect?: boolean
  /** 采集维度白名单（默认全部 8 个维度） */
  dimensions?: CollectionDimensionCode[]
}

/** 注册编排器 — 监听 BATCH_IMPORT_COMPLETED 事件，自动触发采集管道 */
export class RegistrationOrchestrator {
  private config: { autoCollect: boolean; dimensions: CollectionDimensionCode[] }
  private unsubscribers: (() => void)[] = []
  private _active = false

  constructor(config?: RegistrationOrchestratorConfig) {
    this.config = {
      autoCollect: config?.autoCollect ?? true,
      dimensions: config?.dimensions ?? [...COLLECTION_DIMENSIONS],
    }
  }

  /** 启动编排器 — 订阅 BATCH_IMPORT_COMPLETED 事件 */
  start(): void {
    if (this._active) return
    this._active = true

    const unsub = eventBus.on(
      'BATCH_IMPORT_COMPLETED',
      (payload: unknown) => {
        if (!this.config.autoCollect) return
        void this.handleBatchImport(payload as BatchImportCompletedPayload)
      },
    )
    this.unsubscribers.push(unsub)
    logger.info('[RegistrationOrchestrator] 已启动，监听 BATCH_IMPORT_COMPLETED')
  }

  /** 停止编排器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[RegistrationOrchestrator] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  /** 处理批量导入完成事件 */
  private async handleBatchImport(payload: BatchImportCompletedPayload): Promise<void> {
    const symbols: string[] = payload.successSymbols ?? []
    if (symbols.length === 0) {
      logger.warn('[RegistrationOrchestrator] 无成功导入的股票代码，跳过采集')
      return
    }

    const dimensions = this.config.dimensions
    logger.info('[RegistrationOrchestrator] 触发采集')

    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_START, {
      symbols,
      dimensions,
      timestamp: Date.now(),
    })

    const collectionConfig = createDefaultCollectionConfig()

    const results = await Promise.allSettled(
      dimensions.map((dim) =>
        runBatchTrace({
          symbols,
          dimensionCode: dim,
          config: collectionConfig,
        }),
      ),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    logger.info('[RegistrationOrchestrator] 采集完成')

    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, {
      symbols,
      dimensions,
      totalDimensions: dimensions.length,
      succeeded,
      failed,
      timestamp: Date.now(),
    })
  }

  /** 手动触发采集 */
  async triggerCollect(
    symbols: string[],
    dimensions?: CollectionDimensionCode[],
  ): Promise<{ triggered: boolean; symbols: string[]; dimensions: CollectionDimensionCode[]; timestamp: number }> {
    const dims = dimensions ?? this.config.dimensions
    const collectionConfig = createDefaultCollectionConfig()

    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_START, {
      symbols,
      dimensions: dims,
      timestamp: Date.now(),
    })

    await Promise.allSettled(
      dims.map((dim) => runBatchTrace({ symbols, dimensionCode: dim, config: collectionConfig })),
    )

    return { triggered: true, symbols, dimensions: dims, timestamp: Date.now() }
  }
}

/** 批量导入完成事件载荷 */
interface BatchImportCompletedPayload {
  total: number
  success: number
  failed: number
  successSymbols?: string[]
}

// ---- 全局单例 ----
let _instance: RegistrationOrchestrator | null = null

export function getRegistrationOrchestrator(
  config?: RegistrationOrchestratorConfig,
): RegistrationOrchestrator {
  if (!_instance) _instance = new RegistrationOrchestrator(config)
  return _instance
}

export function startRegistrationOrchestrator(
  config?: RegistrationOrchestratorConfig,
): RegistrationOrchestrator {
  const orchestrator = getRegistrationOrchestrator(config)
  orchestrator.start()
  return orchestrator
}
