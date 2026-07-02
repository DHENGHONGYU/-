/**
 * @module services/useCase/strategySnapshotSave.useCase
 * @lifecycle @Global
 * @description 策略快照保存用例 — 将策略运行时的配置、持仓、评分等关键状态持久化到本地数据库
 *
 * 业务流程（3步）：
 * 1. 参数校验与默认值填充
 * 2. 构造策略快照 payload（含 configHash、version、traceId）
 * 3. 通过 DataBridge 信封协议持久化到 strategySnapshots store
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'

const logger = getLogger()

export interface StrategySnapshotPosition {
  symbol: string
  quantity: number
  avgCost: number
}

export interface SaveStrategySnapshotInput {
  strategyName: string
  description?: string
  positions: StrategySnapshotPosition[]
  config?: Record<string, unknown>
  score?: number
  version?: number
}

export interface SaveStrategySnapshotResult {
  success: boolean
  snapshotId?: string
  error?: string
}

interface StrategySnapshotPayload {
  id: string
  strategyName: string
  description: string
  positions: StrategySnapshotPosition[]
  config: Record<string, unknown>
  score: number
  version: number
  configHash: number
  createdAt: number
  traceId: string
}

function computeConfigHash(config: Record<string, unknown>): number {
  const str = JSON.stringify(config, Object.keys(config).sort())
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return hash
}

/**
 * 保存策略快照用例
 *
 * @param input 策略快照输入参数
 * @returns 保存结果（含 snapshotId 或 error）
 */
export async function strategySnapshotSaveUseCase(
  input: SaveStrategySnapshotInput,
): Promise<SaveStrategySnapshotResult> {
  logger.info('[strategySnapshotSaveUseCase] 开始保存策略快照', { strategyName: input.strategyName })

  // Step 1: 参数校验
  if (!input.strategyName || input.strategyName.trim().length === 0) {
    return { success: false, error: '策略名称不能为空' }
  }

  if (!Array.isArray(input.positions)) {
    return { success: false, error: 'positions 必须是数组' }
  }

  for (const pos of input.positions) {
    if (!pos.symbol || pos.symbol.trim().length === 0) {
      return { success: false, error: '持仓股票代码不能为空' }
    }
    if (pos.quantity < 0 || !Number.isFinite(pos.quantity)) {
      return { success: false, error: `持仓数量无效: ${pos.symbol}` }
    }
    if (pos.avgCost < 0 || !Number.isFinite(pos.avgCost)) {
      return { success: false, error: `持仓成本无效: ${pos.symbol}` }
    }
  }

  // Step 2: 构造 payload
  const now = Date.now()
  const traceId = `uc-snapshot-${now}-${input.strategyName}`
  const snapshotId = `snap_${now}_${Math.random().toString(36).slice(2, 8)}`
  const config = input.config ?? {}
  const configHash = computeConfigHash(config)

  const snapshot: StrategySnapshotPayload = {
    id: snapshotId,
    strategyName: input.strategyName,
    description: input.description ?? '',
    positions: input.positions,
    config,
    score: input.score ?? 0,
    version: input.version ?? 1,
    configHash,
    createdAt: now,
    traceId,
  }

  logger.info('[strategySnapshotSaveUseCase] 快照构造完成', { snapshotId, strategyName: snapshot.strategyName })

  // Step 3: 通过 DataBridge 持久化
  try {
    const envelope = EnvelopeFactory.create(
      { source: MODULE_ID.strategy, target: ENVELOPE_TARGET.db, action: ENVELOPE_ACTION.saveStrategySnapshots, traceId },
      snapshot,
    )

    await dataBridge.forward(envelope)

    logger.info('[strategySnapshotSaveUseCase] 策略快照保存成功', { snapshotId })

    return { success: true, snapshotId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[strategySnapshotSaveUseCase] 策略快照保存失败', { error: message, snapshotId })

    return { success: false, error: message }
  }
}
