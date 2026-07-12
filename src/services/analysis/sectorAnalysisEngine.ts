/**
 * SectorAnalysisEngine — 板块分析引擎
 *
 * 负责编排板块轮动评分（RotationSectorScore）和行业评分的计算与加载。
 * 计算逻辑委托给 rotationScoreService，自身只负责编排和持久化。
 *
 * @module services/analysis/sectorAnalysisEngine
 * @created 2026-06-30 - 基于检索功能与引擎映射整改
 */

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import type { DataLayerResult, IndustryScore, RotationSectorScore } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { saveDefaultRotationScores, listRotationScores } from '@/services/analysis/rotationScoreService'

import { nanoid } from 'nanoid'
const logger = getLogger()

/** scoreDate 未指定时的默认日志标签 */
const DEFAULT_DATE_LABEL = '今天'

// ============================================================
// 板块轮动评分计算
// ============================================================

/**
 * 计算并保存默认板块轮动评分
 *
 * 委托给 rotationScoreService.saveDefaultRotationScores 执行。
 */
export async function calculateAndSaveDefaultRotationScores(
  scoreDate?: string,
): Promise<DataLayerResult<RotationSectorScore[]>> {
  logger.info(`[sectorAnalysisEngine] 开始计算默认板块轮动评分: ${scoreDate ?? DEFAULT_DATE_LABEL}`)

  try {
    const result = await saveDefaultRotationScores(scoreDate)
    if (result.success && result.data) {
      logger.info(`[sectorAnalysisEngine] 板块轮动评分计算完成: ${result.data.length} 个板块`)
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[sectorAnalysisEngine] 板块轮动评分计算失败: ${message}`)
    return { success: false, error: message }
  }
}

// ============================================================
// 行业评分计算
// ============================================================

/**
 * 计算并保存默认行业评分
 *
 * 使用简单的静态数据生成方案。
 */
export async function calculateAndSaveDefaultIndustryScores(): Promise<DataLayerResult<IndustryScore[]>> {
  const results: IndustryScore[] = []
  const now = Date.now()

  logger.info('[sectorAnalysisEngine] 开始计算默认行业评分')

  // 生成默认行业评分数据
  const defaultIndustries = [
    { code: 'AI', name: '人工智能', composite: 4.5 },
    { code: 'CHIP', name: '半导体', composite: 4.2 },
    { code: 'ENERGY', name: '新能源', composite: 3.8 },
    { code: 'BIO', name: '生物医药', composite: 3.5 },
    { code: 'AERO', name: '航空航天', composite: 4.0 },
  ]

  for (const industry of defaultIndustries) {
    const score: IndustryScore = {
      id: now,
      code: industry.code,
      name: industry.name,
      overallScore: industry.composite,
      dimensionScores: [],
      summary: `${industry.name} 行业分析完成`,
      basis: '系统自动生成',
      missingFields: [],
      sectorSnapshot: {
        composite: industry.composite,
        recommendation: industry.composite >= 4 ? '推荐关注' : '中性观望',
        positionPct: '20%',
        subTracks: [industry.code],
      },
      configSnapshot: {
        model: 'system',
        baseURL: 'local',
      },
      modelResponse: `${industry.name} 行业评分 ${industry.composite}`,
      scoredAt: now,
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.analyzer,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveIndustryScores,
          traceId: `industry-${nanoid(8)}`,
        },
        score,
      )
      await dataBridge.forward(envelope)
      results.push(score)
      logger.info(`[sectorAnalysisEngine] ${industry.name} 行业评分完成: score=${industry.composite}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[sectorAnalysisEngine] ${industry.name} 行业评分持久化失败: ${message}`)
    }
  }

  logger.info(`[sectorAnalysisEngine] 行业评分计算完成: ${results.length} 个行业`)
  return { success: true, data: results }
}

// ============================================================
// 数据获取
// ============================================================

/**
 * 获取板块轮动评分列表
 */
export async function getRotationScores(): Promise<DataLayerResult<RotationSectorScore[]>> {
  try {
    const result = await listRotationScores()
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[sectorAnalysisEngine] 获取板块轮动评分失败: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * 获取行业评分列表
 */
export async function getIndustryScores(): Promise<DataLayerResult<IndustryScore[]>> {
  try {
    const result = await dataBridge.query<IndustryScore[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.industryScores,
    })
    return { success: result.success, data: result.success ? result.data ?? [] : undefined, error: result.error }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[sectorAnalysisEngine] 获取行业评分失败: ${message}`)
    return { success: false, error: message }
  }
}
