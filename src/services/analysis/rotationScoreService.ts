/**
 * 板块轮动量化服务（V6 Pro 迁移）
 *
 * 本文件仅保留编排逻辑：
 * - 配置与计算逻辑已下沉至 rotationConfig / rotationCalculator / rotationSignalGrader
 * - 写操作统一经 DataBridge.forward() 转发，确保 ACL 校验与审计日志
 */

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { DEFAULT_SECTORS, ROTATION_FACTORS } from '@/config/rotationConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { SECTOR_DEFINITIONS } from '@/data/sectorDefinitions'
import { dataLayer } from '@/data/dataLayer'
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

const logger = getLogger()

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
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
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

/** 批量计算并保存十五五规划板块的轮动评分（使用板块定义中的静态数据作为兜底） */
export async function saveDefaultRotationScores(scoreDate?: string): Promise<DataLayerResult<RotationSectorScore[]>> {
  const date = scoreDate ?? new Date().toISOString().slice(0, 10)
  const results: RotationSectorScore[] = []

  for (const sector of SECTOR_DEFINITIONS) {
    // 使用板块综合分映射到五因子（兜底方案，真实场景应由外部数据填充）
    const subScores: Record<string, number> = {
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

    const result = await saveRotationScore({
      sectorCode: sector.code,
      sectorName: sector.name,
      scoreDate: date,
      subScores,
      poolStocks: sector.keyStocks.map((s) => ({ ...s, v6Composite: sector.composite })),
      analysisReport: `${sector.name}：${sector.description}`,
      modelUsed: 'rotation-v3.1-default',
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
      const list = await dataLayer.rotationScores.listBySector(sectorCode)
      return { success: true, data: list }
    }
    const list = await dataLayer.rotationScores.list()
    return { success: true, data: list }
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
    d.scores.F1A || 0,
    d.scores.F1B || 0,
    d.scores.F1C || 0,
    d.scores.F1D || 0,
    d.scores.F1E || 0,
    d.scores.F2A || 0,
    d.scores.F2B || 0,
    d.scores.F2C || 0,
    d.scores.F2D || 0,
    d.scores.F3A || 0,
    d.scores.F3B || 0,
    d.scores.F3C || 0,
    d.scores.F4A || 0,
    d.scores.F4B || 0,
    d.scores.F5A || 0,
    d.scores.F5B || 0,
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
