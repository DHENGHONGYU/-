/**
 * @module collectionWizardPersistence
 * @description 数据采集向导配置持久化服务
 *
 * 职责：
 * - 将向导配置保存到 IndexedDB collectConfig store（通过 DataBridge）
 * - 从 IndexedDB 加载已保存的配置模板
 * - 管理配置模板的 CRUD 操作
 *
 * 依赖方向：services/ → core/ (DataBridge) + data/ (types)
 * @compliance AGENTS.md §一：services 层通过 DataBridge.forward() 写入数据
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import type { PersistedWizardConfig } from '@/types/modules/collection.types'

const logger = getLogger()

/** 配置模板 ID 前缀 */
const CONFIG_ID_PREFIX = 'wizard_config_'

/**
 * 生成唯一的配置模板 ID
 */
const generateConfigId = (): string => {
  return `${CONFIG_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 保存向导配置到 IndexedDB
 *
 * @param config 要保存的配置（不含 id/createdAt/updatedAt，由本函数填充）
 * @returns 保存后的完整配置（含生成的 id 和时间戳）
 */
export async function saveWizardConfig(
  config: Omit<PersistedWizardConfig, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PersistedWizardConfig> {
  const traceId = `trace_save_${Date.now()}`
  const startTime = Date.now()
  const now = startTime

  logger.info('[CollectionWizardPersistence] saveWizardConfig - 开始', {
    traceId,
    name: config.name,
    dimensionsCount: config.selectedDimensions.length,
    dimensions: config.selectedDimensions,
    frequency: config.frequency,
    priority: config.priority,
  })

  const persistedConfig: PersistedWizardConfig = {
    ...config,
    id: generateConfigId(),
    createdAt: now,
    updatedAt: now,
  }

  logger.debug('[CollectionWizardPersistence] saveWizardConfig - 生成配置对象', {
    traceId,
    configId: persistedConfig.id,
    createdAt: new Date(persistedConfig.createdAt).toISOString(),
  })

  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveCollectConfig,
        traceId,
      },
      persistedConfig,
    )

    const envelopeSize = JSON.stringify(envelope).length
    logger.debug('[CollectionWizardPersistence] saveWizardConfig - 发送数据到 DataBridge', {
      traceId,
      envelopeSize,
      action: ENVELOPE_ACTION.saveCollectConfig,
      store: STORE_NAME.collectConfig,
    })

    await dataBridge.forward(envelope)

    const duration = Date.now() - startTime
    logger.info('[CollectionWizardPersistence] saveWizardConfig - 成功', {
      traceId,
      configId: persistedConfig.id,
      configName: persistedConfig.name,
      dimensionsCount: persistedConfig.selectedDimensions.length,
      envelopeSize,
      durationMs: duration,
    })

    return persistedConfig
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[CollectionWizardPersistence] saveWizardConfig - 失败', {
      traceId,
      configId: persistedConfig.id,
      configName: persistedConfig.name,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * 更新已有的配置模板
 */
export async function updateWizardConfig(
  configId: string,
  updates: Partial<Omit<PersistedWizardConfig, 'id' | 'createdAt'>>,
): Promise<PersistedWizardConfig | null> {
  const traceId = `trace_update_${Date.now()}`
  const startTime = Date.now()
  const now = startTime

  logger.info('[CollectionWizardPersistence] updateWizardConfig - 开始', {
    traceId,
    configId,
    updateKeys: Object.keys(updates),
    updates,
  })

  try {
    // 先查询现有配置
    const existing = await loadWizardConfig(configId)
    if (!existing) {
      logger.warn('[CollectionWizardPersistence] updateWizardConfig - 配置不存在', {
        traceId,
        configId,
      })
      return null
    }

    logger.debug('[CollectionWizardPersistence] updateWizardConfig - 加载现有配置成功', {
      traceId,
      configId,
      existingName: existing.name,
      existingDimensions: existing.selectedDimensions,
      existingUpdatedAt: new Date(existing.updatedAt).toISOString(),
    })

    const updatedConfig: PersistedWizardConfig = {
      ...existing,
      ...updates,
      id: configId,
      createdAt: existing.createdAt,
      updatedAt: now,
    }

    // 记录更新前后的对比
    const changes: Record<string, { before: unknown; after: unknown }> = {}
    for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
      if (existing[key] !== updates[key]) changes[key] = { before: existing[key], after: updates[key] }
    }

    logger.debug('[CollectionWizardPersistence] updateWizardConfig - 配置变更对比', {
      traceId,
      configId,
      changes,
      hasChanges: Object.keys(changes).length > 0,
    })

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveCollectConfig,
        traceId,
      },
      updatedConfig,
    )

    const envelopeSize = JSON.stringify(envelope).length
    logger.debug('[CollectionWizardPersistence] updateWizardConfig - 发送更新到 DataBridge', {
      traceId,
      configId,
      envelopeSize,
      action: ENVELOPE_ACTION.saveCollectConfig,
    })

    await dataBridge.forward(envelope)

    const duration = Date.now() - startTime
    logger.info('[CollectionWizardPersistence] updateWizardConfig - 成功', {
      traceId,
      configId,
      configName: updatedConfig.name,
      changedFields: Object.keys(changes),
      envelopeSize,
      durationMs: duration,
    })

    return updatedConfig
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[CollectionWizardPersistence] updateWizardConfig - 失败', {
      traceId,
      configId,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * 加载单个配置模板
 */
export async function loadWizardConfig(configId: string): Promise<PersistedWizardConfig | null> {
  const traceId = `trace_load_${Date.now()}`
  const startTime = Date.now()

  logger.info('[CollectionWizardPersistence] loadWizardConfig - 开始', {
    traceId,
    configId,
    store: STORE_NAME.collectConfig,
    action: ENVELOPE_ACTION.queryGet,
  })

  try {
    const result = await dataBridge.query<PersistedWizardConfig>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.collectConfig,
      key: configId,
      source: MODULE_ID.fetcher,
    })

    const queryDuration = Date.now() - startTime

    if (!result.success || !result.data) {
      logger.warn('[CollectionWizardPersistence] loadWizardConfig - 未找到配置', {
        traceId,
        configId,
        queryDurationMs: queryDuration,
        success: result.success,
        error: result.error,
      })
      return null
    }

    logger.info('[CollectionWizardPersistence] loadWizardConfig - 完成', {
      traceId,
      configId,
      configName: result.data.name,
      dimensionsCount: result.data.selectedDimensions.length,
      updatedAt: new Date(result.data.updatedAt).toISOString(),
      queryDurationMs: queryDuration,
      found: true,
    })

    return result.data
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[CollectionWizardPersistence] loadWizardConfig - 失败', {
      traceId,
      configId,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * 加载所有向导配置模板（按 updatedAt 降序）
 */
export async function loadAllWizardConfigs(): Promise<PersistedWizardConfig[]> {
  const traceId = `trace_loadAll_${Date.now()}`
  const startTime = Date.now()

  logger.info('[CollectionWizardPersistence] loadAllWizardConfigs - 开始', {
    traceId,
    store: STORE_NAME.collectConfig,
    action: ENVELOPE_ACTION.queryList,
  })

  try {
    const result = await dataBridge.query<PersistedWizardConfig[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.collectConfig,
      source: MODULE_ID.fetcher,
    })

    const queryDuration = Date.now() - startTime
    logger.debug('[CollectionWizardPersistence] loadAllWizardConfigs - 查询完成', {
      traceId,
      queryDurationMs: queryDuration,
      success: result.success,
      hasData: !!result.data,
    })

    if (!result.success || !result.data) {
      logger.warn('[CollectionWizardPersistence] loadAllWizardConfigs - 查询失败', {
        traceId,
        error: result.error,
        queryDurationMs: queryDuration,
      })
      return []
    }

    // 过滤出向导配置模板（以 wizard_config_ 开头）
    const wizardConfigs = result.data
      .filter((c) => c.id.startsWith(CONFIG_ID_PREFIX))
      .sort((a, b) => b.updatedAt - a.updatedAt)

    const totalDuration = Date.now() - startTime
    logger.info('[CollectionWizardPersistence] loadAllWizardConfigs - 完成', {
      traceId,
      totalConfigs: result.data.length,
      wizardConfigCount: wizardConfigs.length,
      filteredOutCount: result.data.length - wizardConfigs.length,
      configIds: wizardConfigs.map((c) => c.id),
      configNames: wizardConfigs.map((c) => c.name),
      queryDurationMs: queryDuration,
      totalDurationMs: totalDuration,
    })

    return wizardConfigs
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[CollectionWizardPersistence] loadAllWizardConfigs - 失败', {
      traceId,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return []
  }
}

/**
 * 删除配置模板
 */
export async function deleteWizardConfig(configId: string): Promise<boolean> {
  const traceId = `trace_delete_${Date.now()}`
  const startTime = Date.now()

  logger.info('[CollectionWizardPersistence] deleteWizardConfig - 开始', {
    traceId,
    configId,
    store: STORE_NAME.collectConfig,
    action: ENVELOPE_ACTION.deleteCollectConfig,
  })

  try {
    // 删除前加载配置快照用于日志记录
    const configSnapshot = await loadWizardConfig(configId)
    if (configSnapshot) {
      logger.debug('[CollectionWizardPersistence] deleteWizardConfig - 配置快照', {
        traceId,
        configId,
        configName: configSnapshot.name,
        dimensions: configSnapshot.selectedDimensions,
        createdAt: new Date(configSnapshot.createdAt).toISOString(),
        updatedAt: new Date(configSnapshot.updatedAt).toISOString(),
      })
    } else {
      logger.warn('[CollectionWizardPersistence] deleteWizardConfig - 配置不存在，继续删除', {
        traceId,
        configId,
      })
    }

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.deleteCollectConfig,
        traceId,
      },
      {
        store: STORE_NAME.collectConfig,
        id: configId,
      },
    )

    logger.debug('[CollectionWizardPersistence] deleteWizardConfig - 发送删除请求到 DataBridge', {
      traceId,
      configId,
      envelopeSize: JSON.stringify(envelope).length,
    })

    await dataBridge.forward(envelope)

    const duration = Date.now() - startTime
    logger.info('[CollectionWizardPersistence] deleteWizardConfig - 成功', {
      traceId,
      configId,
      configName: configSnapshot?.name ?? 'unknown',
      durationMs: duration,
    })

    return true
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[CollectionWizardPersistence] deleteWizardConfig - 失败', {
      traceId,
      configId,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return false
  }
}
