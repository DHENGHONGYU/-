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
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
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

type ScoreLoader<T> = () => Promise<{ success: boolean; data?: T[]; error?: string }>

async function loadOrCalculate<T>(
  label: string,
  queryResult: { success: boolean; data?: T[]; error?: string },
  calculateDefault: ScoreLoader<T>,
): Promise<{ success: false; error: string } | { success: true; data: T[] }> {
  if (!queryResult.success) {
    logger.error(`[fetchSectorAnalysisUseCase] ${label}查询失败`, { error: queryResult.error })
    return { success: false, error: queryResult.error ?? `${label}查询失败` }
  }

  if (queryResult.data && queryResult.data.length > 0) {
    logger.info(`[fetchSectorAnalysisUseCase] 加载${label}`, { count: queryResult.data.length })
    return { success: true, data: queryResult.data }
  }

  logger.info(`[fetchSectorAnalysisUseCase] ${label}为空，计算默认数据`)
  const calcResult = await calculateDefault()
  if (calcResult.success && calcResult.data) {
    logger.info(`[fetchSectorAnalysisUseCase] 默认${label}计算成功`, { count: calcResult.data.length })
    return { success: true, data: calcResult.data }
  }

  const error = calcResult.error ?? `${label}默认计算失败`
  logger.error(`[fetchSectorAnalysisUseCase] 计算默认${label}失败`, { error })
  return { success: false, error }
}

function compareIndustryByScoredAt(a: IndustryScore, b: IndustryScore): number {
  const aTime = a.scoredAt ?? 0
  const bTime = b.scoredAt ?? 0
  if (aTime === 0 && bTime === 0) return 0
  if (aTime === 0) return 1
  if (bTime === 0) return -1
  return bTime - aTime
}

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

    // 2. 处理板块轮动评分
    const rotationLoad = await loadOrCalculate('板块轮动评分', rotationResult, calculateAndSaveDefaultRotationScores)
    if (!rotationLoad.success) {
      return {
        success: false,
        rotationScores: [],
        industryScores: [],
        error: rotationLoad.error,
      }
    }

    // 3. 处理行业评分
    const industryLoad = await loadOrCalculate('行业评分', industryResult, calculateAndSaveDefaultIndustryScores)
    if (!industryLoad.success) {
      return {
        success: false,
        rotationScores: [],
        industryScores: [],
        error: industryLoad.error,
      }
    }

    // 4. 排序
    const rotation = rotationLoad.data
    const industry = industryLoad.data
    const sortedRotation = [...rotation].sort((a, b) => b.total - a.total)
    const sortedIndustry = [...industry].sort(compareIndustryByScoredAt)

    const missingTimestampIndustry = industry.filter((i) => i.scoredAt == null)
    if (missingTimestampIndustry.length > 0) {
      logger.warn('[fetchSectorAnalysisUseCase] scoredAt 缺失，条目排至末尾', {
        missingCount: missingTimestampIndustry.length,
        totalCount: industry.length,
      })
    }

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
