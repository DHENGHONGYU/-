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
  const now = Date.now()

  logger.info('[CollectionWizardPersistence] saveWizardConfig - 开始', {
    traceId,
    name: config.name,
    dimensions: config.selectedDimensions,
  })

  const persistedConfig: PersistedWizardConfig = {
    ...config,
    id: generateConfigId(),
    createdAt: now,
    updatedAt: now,
  }

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

    await dataBridge.forward(envelope)

    logger.info('[CollectionWizardPersistence] saveWizardConfig - 成功', {
      traceId,
      configId: persistedConfig.id,
    })

    return persistedConfig
  } catch (error) {
    logger.error('[CollectionWizardPersistence] saveWizardConfig - 失败', {
      traceId,
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
  const now = Date.now()

  logger.info('[CollectionWizardPersistence] updateWizardConfig - 开始', {
    traceId,
    configId,
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

    const updatedConfig: PersistedWizardConfig = {
      ...existing,
      ...updates,
      id: configId,
      createdAt: existing.createdAt,
      updatedAt: now,
    }

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveCollectConfig,
        traceId,
      },
      updatedConfig,
    )

    await dataBridge.forward(envelope)

    logger.info('[CollectionWizardPersistence] updateWizardConfig - 成功', {
      traceId,
      configId,
    })

    return updatedConfig
  } catch (error) {
    logger.error('[CollectionWizardPersistence] updateWizardConfig - 失败', {
      traceId,
      configId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * 加载单个配置模板
 */
export async function loadWizardConfig(configId: string): Promise<PersistedWizardConfig | null> {
  const traceId = `trace_load_${Date.now()}`

  logger.info('[CollectionWizardPersistence] loadWizardConfig - 开始', {
    traceId,
    configId,
  })

  try {
    const result = await dataBridge.query<PersistedWizardConfig>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.collectConfig,
      key: configId,
      source: MODULE_ID.fetcher,
    })

    if (!result.success || !result.data) {
      logger.warn('[CollectionWizardPersistence] loadWizardConfig - 未找到配置', {
        traceId,
        configId,
      })
      return null
    }

    logger.info('[CollectionWizardPersistence] loadWizardConfig - 完成', {
      traceId,
      configId,
      found: true,
    })

    return result.data
  } catch (error) {
    logger.error('[CollectionWizardPersistence] loadWizardConfig - 失败', {
      traceId,
      configId,
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

  logger.info('[CollectionWizardPersistence] loadAllWizardConfigs - 开始', { traceId })

  try {
    const result = await dataBridge.query<PersistedWizardConfig[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.collectConfig,
      source: MODULE_ID.fetcher,
    })

    if (!result.success || !result.data) {
      logger.warn('[CollectionWizardPersistence] loadAllWizardConfigs - 查询失败', {
        traceId,
        error: result.error,
      })
      return []
    }

    // 过滤出向导配置模板（以 wizard_config_ 开头）
    const wizardConfigs = result.data
      .filter((c) => c.id.startsWith(CONFIG_ID_PREFIX))
      .sort((a, b) => b.updatedAt - a.updatedAt)

    logger.info('[CollectionWizardPersistence] loadAllWizardConfigs - 完成', {
      traceId,
      totalConfigs: result.data.length,
      wizardConfigCount: wizardConfigs.length,
    })

    return wizardConfigs
  } catch (error) {
    logger.error('[CollectionWizardPersistence] loadAllWizardConfigs - 失败', {
      traceId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/**
 * 删除配置模板
 */
export async function deleteWizardConfig(configId: string): Promise<boolean> {
  const traceId = `trace_delete_${Date.now()}`

  logger.info('[CollectionWizardPersistence] deleteWizardConfig - 开始', {
    traceId,
    configId,
  })

  try {
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

    await dataBridge.forward(envelope)

    logger.info('[CollectionWizardPersistence] deleteWizardConfig - 成功', {
      traceId,
      configId,
    })

    return true
  } catch (error) {
    logger.error('[CollectionWizardPersistence] deleteWizardConfig - 失败', {
      traceId,
      configId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
