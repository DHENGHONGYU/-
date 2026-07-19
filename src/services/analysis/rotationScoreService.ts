/**
 * 板块轮动量化服务（V6 Pro 迁移）
 *
 * 本文件仅保留编排逻辑：
 * - 配置与计算逻辑已下沉至 rotationConfig / rotationCalculator / rotationSignalGrader
 * - 写操作统一经 DataBridge.forward() 转发，确保 ACL 校验与审计日志
  * @doc [V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-PROJ-066, V9-DOC-PROJ-079, V9-DOC-PROJ-113]
*/

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { DEFAULT_SECTORS, ROTATION_FACTORS } from '@/config/rotationConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { SECTOR_DEFINITIONS } from '@/data/sectorDefinitions'
import type {
  DataLayerResult,
  RotationFactor,
  RotationSectorScore,
} from '@/data/types'
import { getLogger } from '@/lib/logger'
import {
  calculateResonance,
  calculateRotationScore,
  calculateSectorScore,
  determineDeclineNature,
  getAlertLevel,
  getScoreBucket,
  validateSubScores,
} from '@/services/analysis/rotation/rotationCalculator'
import { getSignalGrade } from '@/services/analysis/rotation/rotationSignalGrader'
import { detectBySector, type RotationSignal } from '@/services/scoring/rotationSignalDetector'

import { nanoid } from 'nanoid'
const logger = getLogger()

// ============================================================
// P1-S3: 板块轮动真实数据接入层
// ============================================================

/**
 * 板块轮动数据提供者接口
 *
 * 允许外部注入真实量价/资金/估值数据源；默认实现基于 rotationSignalDetector
 * 从 dataLayer 聚合板块内股票行情计算轮动信号。
 */
export interface RotationDataProvider {
  /** 提供者名称（用于日志与 modelUsed 标记） */
  readonly name: string
  /** 获取指定板块的轮动信号 */
  getSignal(sectorCode: string): Promise<RotationSignal | null>
}

/**
 * 默认数据提供者：基于 rotationSignalDetector 检测板块轮动信号
 */
export class DefaultRotationDataProvider implements RotationDataProvider {
  readonly name = 'rotationSignalDetector'

  async getSignal(sectorCode: string): Promise<RotationSignal | null> {
    return detectBySector(sectorCode)
  }
}

/** 全局默认提供者实例 */
let globalRotationDataProvider: RotationDataProvider = new DefaultRotationDataProvider()

/**
 * 设置全局板块轮动数据提供者
 */
export function setRotationDataProvider(provider: RotationDataProvider): void {
  globalRotationDataProvider = provider
  logger.info('[rotationScoreService] 全局 RotationDataProvider 已更新', { provider: provider.name })
}

/**
 * 获取当前全局板块轮动数据提供者
 */
export function getRotationDataProvider(): RotationDataProvider {
  return globalRotationDataProvider
}

// Re-export public helpers to keep existing consumers/test imports working
export {
  calculateResonance,
  calculateSectorScore,
  determineDeclineNature,
  getAlertLevel,
  getScoreBucket,
  getSignalGrade,
}

export { ROTATION_FACTORS, DEFAULT_SECTORS }
export type { RotationFactor }

function createTraceId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`
}

async function saveRotationScoreViaDataBridge(score: RotationSectorScore): Promise<DataLayerResult<void>> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.rotation,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveRotationScores,
        traceId: createTraceId('rot'),
      },
      score,
    )
    await dataBridge.forward(envelope)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('DataBridge.forward 保存板块轮动评分失败', { sectorCode: score.sectorCode, error: message })
    return { success: false, error: message }
  }
}

/** 计算并保存单板块轮动评分 */
export async function saveRotationScore(input: {
  sectorCode: string
  sectorName: string
  scoreDate: string
  subScores: Record<string, number>
  poolStocks?: Array<{ symbol: string; name: string; v6Composite?: number }>
  analysisReport?: string
  modelUsed?: string
}): Promise<DataLayerResult<RotationSectorScore>> {
  const validation = validateSubScores(input.subScores)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') }
  }

  const score = calculateRotationScore(input)
  const saveResult = await saveRotationScoreViaDataBridge(score)
  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }
  return { success: true, data: score }
}

/**
 * 批量计算并保存十五五规划板块的轮动评分
 *
 * P1-S3：优先使用 RotationDataProvider 获取真实轮动信号增强子指标；
 * 当信号缺失或数据不足时，回退到板块综合分推导的兜底方案。
 */
export async function saveDefaultRotationScores(
  scoreDate?: string,
  provider: RotationDataProvider = globalRotationDataProvider,
): Promise<DataLayerResult<RotationSectorScore[]>> {
  const date = scoreDate ?? new Date().toISOString().slice(0, 10)
  const results: RotationSectorScore[] = []

  for (const sector of SECTOR_DEFINITIONS) {
    // 1. 兜底子指标：由板块综合分推导
    const fallbackSubScores: Record<string, number> = {
      F1A: Math.round(sector.composite * 3),
      F1B: Math.round(sector.composite * 1.6),
      F1C: Math.round(sector.composite * 1.4),
      F1D: Math.round(sector.composite),
      F1E: Math.round(sector.composite),
      F2A: Math.round(sector.composite * 2),
      F2B: Math.round(sector.composite * 2),
      F2C: Math.round(sector.composite),
      F2D: Math.round(sector.composite),
      F3A: Math.round((5 - sector.composite) * 1.6),
      F3B: Math.round((5 - sector.composite) * 0.8),
      F3C: Math.round((5 - sector.composite) * 0.6),
      F4A: Math.round(sector.composite),
      F4B: Math.round(sector.composite),
      F5A: 2,
      F5B: 1,
    }

    // 2. 尝试接入真实轮动信号
    let signal: RotationSignal | null = null
    try {
      signal = await provider.getSignal(sector.code)
    } catch (err) {
      logger.warn(`[rotationScoreService] 板块 ${sector.code} 轮动信号获取失败，使用兜底`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    const subScores: Record<string, number> = { ...fallbackSubScores }
    if (signal?.triggered) {
      // 信号触发：增强景气、资金、量能因子
      const strengthMultiplier = signal.strength === 'strong' ? 1.5 : signal.strength === 'medium' ? 1.2 : 1.0
      subScores.F1A = Math.min(15, Math.round((subScores.F1A ?? 0) * strengthMultiplier))
      subScores.F2A = Math.min(10, Math.round((subScores.F2A ?? 0) * (1 + 0.3 * strengthMultiplier)))
      subScores.F2B = Math.min(10, Math.round((subScores.F2B ?? 0) * (1 + 0.2 * strengthMultiplier)))
      subScores.F5A = Math.min(5, Math.round((subScores.F5A ?? 0) + 2 * strengthMultiplier))
      logger.info(`[rotationScoreService] 板块 ${sector.code} 轮动信号触发`, {
        strength: signal.strength,
        conditions: signal.conditions,
      })
    }

    const result = await saveRotationScore({
      sectorCode: sector.code,
      sectorName: sector.name,
      scoreDate: date,
      subScores,
      poolStocks: sector.keyStocks.map((s) => ({ ...s, v6Composite: sector.composite })),
      analysisReport: `${sector.name}：${sector.description}${signal ? ` | 轮动信号: ${signal.triggered ? signal.strength : '无'}` : ''}`,
      modelUsed: `rotation-v3.1-${provider.name}`,
    })

    if (result.success && result.data) {
      results.push(result.data)
    }
  }

  return { success: true, data: results }
}

/** 查询板块轮动评分 */
export async function getRotationScores(sectorCode?: string): Promise<DataLayerResult<RotationSectorScore[]>> {
  try {
    if (sectorCode) {
      const result = await dataBridge.query<RotationSectorScore[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.rotationScores,
        indexName: 'by-sector',
        indexValue: sectorCode,
      })
      return { success: result.success, data: result.success ? (result.data ?? []) : undefined }
    }
    const result = await dataBridge.query<RotationSectorScore[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.rotationScores,
    })
    return { success: result.success, data: result.success ? (result.data ?? []) : undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

/** 查询全部板块轮动评分（只读 Service 接口） */
export async function listRotationScores(): Promise<DataLayerResult<RotationSectorScore[]>> {
  return getRotationScores()
}

/** 导出看板数据为 CSV */
export function exportRotationCsv(
  data: Array<{
    name: string
    style: string
    scores: Record<string, number>
    f1: number
    f2: number
    f3: number
    f4: number
    f5: number
    total: number
    resonance: number
    signal: string
    alert: string
    decline: string
  }>,
): string {
  const headers = [
    '板块名称',
    '风格',
    '景气合成(15)',
    '利润环比(8)',
    '竞争格局(7)',
    'ROE质量(5)',
    '前瞻拐点(5)',
    '北向资金(10)',
    '主力资金(10)',
    '融资余额(5)',
    'ETF资金(5)',
    'PE/PB分位(8)',
    '股息率(4)',
    '复合回报(3)',
    'β偏离(5)',
    'ρ相关(5)',
    '量比(3)',
    '换手率(2)',
    '景气小计',
    '资金小计',
    '估值小计',
    'β小计',
    '量能小计',
    '综合总分',
    '共振强度',
    '信号标签',
    '预警等级',
    '下跌性质',
  ]
  const rows = data.map((d) => [
    d.name,
    d.style,
    d.scores.F1A ?? 0,
    d.scores.F1B ?? 0,
    d.scores.F1C ?? 0,
    d.scores.F1D ?? 0,
    d.scores.F1E ?? 0,
    d.scores.F2A ?? 0,
    d.scores.F2B ?? 0,
    d.scores.F2C ?? 0,
    d.scores.F2D ?? 0,
    d.scores.F3A ?? 0,
    d.scores.F3B ?? 0,
    d.scores.F3C ?? 0,
    d.scores.F4A ?? 0,
    d.scores.F4B ?? 0,
    d.scores.F5A ?? 0,
    d.scores.F5B ?? 0,
    d.f1,
    d.f2,
    d.f3,
    d.f4,
    d.f5,
    d.total,
    d.resonance,
    d.signal,
    d.alert,
    d.decline,
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
