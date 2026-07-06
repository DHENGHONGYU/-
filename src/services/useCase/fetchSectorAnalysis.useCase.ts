/**
 * @module services/useCase/fetchSectorAnalysis.useCase
 * @description 板块分析数据加载用例 — 从 sectorAnalysisStore.fetchSectorAnalysis 提取的业务编排逻辑
 *
 * 业务流程（4步）：
 * 1. 并行查询板块轮动评分 + 行业评分
 * 2. 空数据时触发默认计算（calculateAndSaveDefault*）
 * 3. 排序（轮动按 total 降序，行业按 scoredAt 降序）
 * 4. 返回合并结果
 *
 * @see Clean Architecture Use Case Interactor 模式
 */

import { getLogger } from '@/lib/logger'
import type { RotationSectorScore, IndustryScore } from '@/data/types'
import {
  calculateAndSaveDefaultRotationScores,
  calculateAndSaveDefaultIndustryScores,
  getRotationScores,
  getIndustryScores,
} from '@/services/analysis/sectorAnalysisEngine'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface FetchSectorAnalysisInput {
  /** 预留：未来可扩展过滤条件（如日期范围、行业筛选等） */
  _filter?: undefined
}

export interface FetchSectorAnalysisResult {
  /** 是否成功 */
  success: boolean
  /** 板块轮动评分列表（按 total 降序） */
  rotationScores: RotationSectorScore[]
  /** 行业评分列表（按 scoredAt 降序） */
  industryScores: IndustryScore[]
  /** 错误信息（成功时为 undefined） */
  error?: string
}

// ============================================================
// UseCase
// ============================================================

/**
 * 板块分析数据加载用例
 *
 * 并行查询板块轮动评分和行业评分，空数据时自动触发默认计算，
 * 排序后返回合并结果。
 *
 * @param _input 查询参数（预留扩展）
 * @returns 合并后的板块分析数据
 */
export async function fetchSectorAnalysisUseCase(
  _input: FetchSectorAnalysisInput = {},
): Promise<FetchSectorAnalysisResult> {
  logger.info('[fetchSectorAnalysisUseCase] 开始加载板块分析数据')

  try {
    // 1. 并行查询板块轮动评分 + 行业评分
    logger.info('[fetchSectorAnalysisUseCase] 发起并行查询', {
      channels: ['rotation_scores', 'industry_scores'],
    })
    const [rotationResult, industryResult] = await Promise.all([
      getRotationScores(),
      getIndustryScores(),
    ])
    logger.info('[fetchSectorAnalysisUseCase] 并行查询返回', {
      rotationSuccess: rotationResult.success,
      rotationCount: rotationResult.data?.length ?? 0,
      industrySuccess: industryResult.success,
      industryCount: industryResult.data?.length ?? 0,
    })

    let rotation: RotationSectorScore[] = []
    let industry: IndustryScore[] = []

    // 2a. 处理板块轮动评分
    if (!rotationResult.success) {
      logger.error('[fetchSectorAnalysisUseCase] 板块轮动评分查询失败', {
        error: rotationResult.error,
      })
      return {
        success: false,
        rotationScores: [],
        industryScores: [],
        error: rotationResult.error ?? '板块轮动评分查询失败',
      }
    }

    if (rotationResult.data && rotationResult.data.length > 0) {
      rotation = rotationResult.data
      const sample = rotation[0]
      logger.info('[fetchSectorAnalysisUseCase] 加载板块轮动评分', {
        count: rotation.length,
        sample: sample
          ? { id: sample.id, sectorName: sample.sectorName, total: sample.total, alertLevel: sample.alertLevel }
          : null,
      })
    } else {
      // 数据为空时，计算并保存默认评分
      logger.info('[fetchSectorAnalysisUseCase] 板块轮动评分为空，计算默认数据')
      const calcResult = await calculateAndSaveDefaultRotationScores()
      if (calcResult.success && calcResult.data) {
        rotation = calcResult.data
        const sample = rotation[0]
        logger.info('[fetchSectorAnalysisUseCase] 默认板块轮动评分计算成功', {
          count: rotation.length,
          sample: sample
            ? { id: sample.id, sectorName: sample.sectorName, total: sample.total }
            : null,
        })
      } else if (calcResult.error) {
        logger.error('[fetchSectorAnalysisUseCase] 计算默认板块轮动评分失败', {
          error: calcResult.error,
        })
        return {
          success: false,
          rotationScores: [],
          industryScores: [],
          error: calcResult.error,
        }
      }
    }

    // 2b. 处理行业评分
    if (!industryResult.success) {
      logger.error('[fetchSectorAnalysisUseCase] 行业评分查询失败', {
        error: industryResult.error,
      })
      return {
        success: false,
        rotationScores: [],
        industryScores: [],
        error: industryResult.error ?? '行业评分查询失败',
      }
    }

    if (industryResult.data && industryResult.data.length > 0) {
      industry = industryResult.data
      const sample = industry[0]
      logger.info('[fetchSectorAnalysisUseCase] 加载行业评分', {
        count: industry.length,
        sample: sample
          ? { id: sample.id, name: sample.name, overallScore: sample.overallScore, model: sample.configSnapshot.model }
          : null,
      })
    } else {
      // 数据为空时，计算并保存默认评分
      logger.info('[fetchSectorAnalysisUseCase] 行业评分为空，计算默认数据')
      const calcResult = await calculateAndSaveDefaultIndustryScores()
      if (calcResult.success && calcResult.data) {
        industry = calcResult.data
        const sample = industry[0]
        logger.info('[fetchSectorAnalysisUseCase] 默认行业评分计算成功', {
          count: industry.length,
          sample: sample
            ? { id: sample.id, name: sample.name, overallScore: sample.overallScore }
            : null,
        })
      } else if (calcResult.error) {
        logger.error('[fetchSectorAnalysisUseCase] 计算默认行业评分失败', {
          error: calcResult.error,
        })
        return {
          success: false,
          rotationScores: [],
          industryScores: [],
          error: calcResult.error,
        }
      }
    }

    // 3. 排序
    // 板块轮动按 total 降序
    const sortedRotation = [...rotation].sort((a, b) => b.total - a.total)

    // 行业评分按 scoredAt 降序（无时间戳的条目排至末尾）
    const missingTimestampIndustry = industry.filter((i) => i.scoredAt == null)
    if (missingTimestampIndustry.length > 0) {
      logger.warn('[fetchSectorAnalysisUseCase] scoredAt 缺失，条目排至末尾', {
        missingCount: missingTimestampIndustry.length,
        totalCount: industry.length,
      })
    }
    const sortedIndustry = [...industry].sort((a, b) => {
      const aTime = a.scoredAt ?? 0
      const bTime = b.scoredAt ?? 0
      if (aTime === 0 && bTime === 0) return 0
      if (aTime === 0) return 1
      if (bTime === 0) return -1
      return bTime - aTime
    })

    logger.info('[fetchSectorAnalysisUseCase] 排序完成', {
      rotationTop: sortedRotation[0]
        ? { sectorName: sortedRotation[0].sectorName, total: sortedRotation[0].total }
        : null,
      rotationBottom: sortedRotation[sortedRotation.length - 1]
        ? { sectorName: sortedRotation[sortedRotation.length - 1]!.sectorName, total: sortedRotation[sortedRotation.length - 1]!.total }
        : null,
      industryLatest: sortedIndustry[0]
        ? { name: sortedIndustry[0].name, scoredAt: sortedIndustry[0].scoredAt }
        : null,
    })

    logger.info('[fetchSectorAnalysisUseCase] 数据加载完成', {
      rotation: sortedRotation.length,
      industry: sortedIndustry.length,
    })

    return {
      success: true,
      rotationScores: sortedRotation,
      industryScores: sortedIndustry,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logger.error('[fetchSectorAnalysisUseCase] 数据加载失败', { error: message, stack })
    return {
      success: false,
      rotationScores: [],
      industryScores: [],
      error: message,
    }
  }
}
