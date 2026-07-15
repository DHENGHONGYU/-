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
import type { DataLayerResult, IndustryDimensionScore, IndustryScore, RotationSectorScore, SectorDefinition } from '@/data/types'
import { SECTORS_WITH_SCORES } from '@/data/sectorDefinitions'
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
 * 六维度板块分析框架评分卡权重
 *
 * 按 sector-analysis-framework SKILL：轮动信号 / 政策环境 / 外部竞争 /
 * 技术跃迁 / 下游市场 / 基金估值，六维等权。
 */
const SECTOR_DIMENSION_WEIGHT = 1 / 6

/**
 * 根据板块 category 推断下游市场景气度得分
 */
function getDownstreamScore(category: SectorDefinition['category']): number {
  switch (category) {
    case '新兴产业':
      return 4.2
    case '未来产业':
      return 3.8
    case '战略基础':
      return 3.5
    default:
      return 3.5
  }
}

/**
 * 根据综合分推断基金估值水位（高综合分通常对应高估值）
 */
function getFundValuationScore(composite: number): number {
  if (composite >= 4.5) return 3.0
  if (composite >= 4.0) return 3.5
  if (composite >= 3.5) return 4.0
  return 4.5
}

/**
 * 为单个板块生成六维度评分卡
 */
function buildSectorDimensionScores(sector: SectorDefinition): IndustryDimensionScore[] {
  const { dimensions, composite, category } = sector

  const dims: IndustryDimensionScore[] = [
    {
      name: '板块轮动信号',
      score: composite,
      weight: SECTOR_DIMENSION_WEIGHT,
      rationale: '基于板块综合稀缺度与资金关注度的轮动信号 proxy',
      evidence: [`板块综合分 ${composite.toFixed(2)}`],
    },
    {
      name: '政策环境',
      score: dimensions.policySupport,
      weight: SECTOR_DIMENSION_WEIGHT,
      rationale: '政策支持力度，来自十五五规划三维度评分',
      evidence: [`政策支持力度 ${dimensions.policySupport.toFixed(2)}`],
    },
    {
      name: '外部竞争',
      score: dimensions.usChinaParity,
      weight: SECTOR_DIMENSION_WEIGHT,
      rationale: '中美同等热度与国产替代空间',
      evidence: [`中美同等热度 ${dimensions.usChinaParity.toFixed(2)}`],
    },
    {
      name: '技术跃迁',
      score: dimensions.planAlignment,
      weight: SECTOR_DIMENSION_WEIGHT,
      rationale: '规划契合度反映技术路线与国家战略的匹配程度',
      evidence: [`规划契合度 ${dimensions.planAlignment.toFixed(2)}`],
    },
    {
      name: '下游市场',
      score: getDownstreamScore(category),
      weight: SECTOR_DIMENSION_WEIGHT,
      rationale: `基于板块分类（${category}）推断下游需求景气度`,
      evidence: [`板块分类: ${category}`],
    },
    {
      name: '基金估值',
      score: getFundValuationScore(composite),
      weight: SECTOR_DIMENSION_WEIGHT,
      rationale: '基于板块综合分推断估值水位，综合分越高估值越拥挤',
      evidence: [`综合分 ${composite.toFixed(2)} → 估值水位 ${getFundValuationScore(composite).toFixed(2)}`],
    },
  ]

  return dims
}

/**
 * 计算并保存默认行业评分
 *
 * P2-S1：覆盖 sectorDefinitions 中全部 20 个板块。
 * P1-S2：落地六维度板块分析框架评分卡。
 */
export async function calculateAndSaveDefaultIndustryScores(): Promise<DataLayerResult<IndustryScore[]>> {
  const results: IndustryScore[] = []
  const now = Date.now()

  logger.info(`[sectorAnalysisEngine] 开始计算默认行业评分，共 ${SECTORS_WITH_SCORES.length} 个板块`)

  for (const sector of SECTORS_WITH_SCORES) {
    const dimensionScores = buildSectorDimensionScores(sector)
    const overallScore = dimensionScores.reduce((sum, d) => sum + (d.score ?? 0) * d.weight, 0)
    const recommendation = overallScore >= 4.2 ? '超配' : overallScore >= 3.5 ? '标配' : '低配'

    const score: IndustryScore = {
      id: now,
      code: sector.code,
      name: sector.name,
      overallScore: Math.round(overallScore * 100) / 100,
      dimensionScores,
      summary: `${sector.name} 六维度综合评分 ${overallScore.toFixed(2)}，建议${recommendation}`,
      basis: 'sectorDefinitions 三维度 + 六维度板块分析框架',
      missingFields: [],
      sectorSnapshot: {
        composite: sector.composite,
        recommendation,
        positionPct: sector.isCore ? '15-20%' : '5-10%',
        subTracks: [sector.code, ...sector.relatedConcepts.slice(0, 3)],
      },
      configSnapshot: {
        model: 'sector-analysis-framework-v1.0',
        baseURL: 'local',
      },
      modelResponse: `${sector.name} 行业评分 ${overallScore.toFixed(2)}，${recommendation}`,
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
      logger.info(`[sectorAnalysisEngine] ${sector.name} 行业评分完成: score=${score.overallScore?.toFixed(2)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[sectorAnalysisEngine] ${sector.name} 行业评分持久化失败: ${message}`)
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
