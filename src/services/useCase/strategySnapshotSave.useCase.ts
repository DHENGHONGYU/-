/**
 * @module services/useCase/strategySnapshotSave.useCase
 * @lifecycle @Global
 * @description 策略快照保存用例 — 封装策略快照的创建、序列化和持久化流程
 *
 * 业务流程（4步）：
 * 1. 收集当前策略状态（从多个 Store 聚合）
 * 2. 构造快照对象（含版本号、时间戳、配置哈希）
 * 3. 通过 DataBridge 持久化
 * 4. 广播事件通知 UI 刷新
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import type { StrategySnapshot } from '@/data/types'

const logger = getLogger()

export interface StrategySnapshotInput {
  strategyName: string
  description?: string
  /** 当前持仓列表 */
  positions: Array<{ symbol: string; quantity: number; avgCost: number }>
  /** 当前策略配置 */
  config: Record<string, unknown>
  /** 当前评分（可选） */
  score?: number
}

export interface StrategySnapshotResult {
  success: boolean
  snapshotId?: string
  version?: number
  error?: string
}

/**
 * 保存策略快照用例
 *
 * @param input 快照输入参数
 * @returns 保存结果（含 snapshotId 和 version）
 */
export async function strategySnapshotSaveUseCase(
  input: StrategySnapshotInput,
): Promise<StrategySnapshotResult> {
  logger.info('[strategySnapshotSaveUseCase] 开始保存策略快照', { strategyName: input.strategyName })

  // Step 1: 参数校验
  if (!input.strategyName || input.strategyName.trim().length === 0) {
    return { success: false, error: '策略名称不能为空' }
  }

  if (!input.positions || !Array.isArray(input.positions)) {
    return { success: false, error: '持仓列表不能为空' }
  }

  // Step 2: 构造快照对象
  const now = Date.now()
  const traceId = `uc-snap-${now}`
  const snapshotId = `snap_${now}_${Math.random().toString(36).slice(2, 8)}`
  const version = 1 // 首次保存版本为1，后续应查询最新版本+1

  // 计算配置哈希（简单字符串哈希用于变更检测）
  const configStr = JSON.stringify(input.config)
  let configHash = 0
  for (let i = 0; i < configStr.length; i++) {
    configHash = ((configHash << 5) - configHash + configStr.charCodeAt(i)) | 0
  }
  configHash = Math.abs(configHash)

  const snapshot: StrategySnapshot = {
    id: snapshotId,
    strategyName: input.strategyName,
    description: input.description ?? '',
    positions: input.positions,
    config: input.config,
    score: input.score ?? 0,
    version,
    configHash,
    createdAt: now,
    traceId,
  } as StrategySnapshot

  logger.info('[strategySnapshotSaveUseCase] 快照构造完成', {
    snapshotId,
    strategyName: snapshot.strategyName,
    positionsCount: input.positions.length,
    configHash,
  })

  // Step 3: 通过 DataBridge 持久化
  try {
    const envelope = EnvelopeFactory.create(
      { source: 'strategySnapshotSaveUseCase', target: 'strategySnapshots', action: ENVELOPE_ACTION.saveStrategySnapshot, traceId },
      snapshot,
    )

    await dataBridge.forward(envelope)

    // Step 4: 广播事件
    withBroadcast(EVENT_NAMES.STRATEGY_SNAPSHOTS_CHANGED, {
      action: 'save',
      id: snapshotId,
      traceId,
    })

    logger.info('[strategySnapshotSaveUseCase] 策略快照保存成功', { snapshotId, version })

    return { success: true, snapshotId, version }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[strategySnapshotSaveUseCase] 策略快照保存失败', { error: message, snapshotId })

    return { success: false, error: message }
  }
}
