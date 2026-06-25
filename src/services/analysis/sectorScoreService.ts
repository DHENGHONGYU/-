/**
 * 十五五板块评分服务（V6 Pro 迁移）
 *
 * 基于 `src/data/sectorDefinitions.ts` 中的 20 大新兴行业定义，
 * 生成板块评分记录并持久化到 IndexedDB。
 */

import { dataLayer } from '@/data/dataLayer'
import { CORE_SECTOR_THRESHOLD, SECTOR_DEFINITIONS } from '@/data/sectorDefinitions'
import type { DataLayerResult, SectorDefinition, SectorScoreRecord } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

function makeSectorScoreId(sectorCode: string, scoreDate: string): string {
  return `${sectorCode}__${scoreDate}`
}

/** 计算板块综合分 */
export function calculateSectorComposite(definition: SectorDefinition): number {
  const { planAlignment, policySupport, usChinaParity } = definition.dimensions
  const { plan, policy, parity } = definition.weight
  const composite = planAlignment * plan + policySupport * policy + usChinaParity * parity
  return Math.round(composite * 100) / 100
}

/** 判断是否为核心稀缺板块 */
export function isCoreSector(definition: SectorDefinition): boolean {
  return calculateSectorComposite(definition) >= CORE_SECTOR_THRESHOLD
}

/** 保存单个板块评分记录 */
export async function saveSectorScore(
  definition: SectorDefinition,
  scoreDate?: string,
  modelUsed = 'sector-v4-static',
): Promise<DataLayerResult<SectorScoreRecord>> {
  const date = scoreDate ?? new Date().toISOString().slice(0, 10)
  const composite = calculateSectorComposite(definition)

  const record: SectorScoreRecord = {
    id: makeSectorScoreId(definition.code, date),
    sectorCode: definition.code,
    scoreDate: date,
    dimensions: { ...definition.dimensions },
    composite,
    isCore: composite >= CORE_SECTOR_THRESHOLD,
    modelUsed,
    createdAt: new Date().toISOString(),
  }

  try {
    await dataLayer.sectorScores.save(record)
    return { success: true, data: record }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('保存板块评分失败', { sectorCode: definition.code, error: message })
    return { success: false, error: message }
  }
}

/** 批量保存所有十五五板块评分 */
export async function saveAllSectorScores(
  scoreDate?: string,
  modelUsed = 'sector-v4-static',
): Promise<DataLayerResult<SectorScoreRecord[]>> {
  const date = scoreDate ?? new Date().toISOString().slice(0, 10)
  const results: SectorScoreRecord[] = []

  for (const definition of SECTOR_DEFINITIONS) {
    const result = await saveSectorScore(definition, date, modelUsed)
    if (result.success && result.data) {
      results.push(result.data)
    }
  }

  return { success: true, data: results }
}

/** 查询板块评分 */
export async function getSectorScores(sectorCode?: string): Promise<DataLayerResult<SectorScoreRecord[]>> {
  try {
    if (sectorCode) {
      const list = await dataLayer.sectorScores.listBySector(sectorCode)
      return { success: true, data: list }
    }
    const list = await dataLayer.sectorScores.list()
    return { success: true, data: list }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

/** 获取核心稀缺板块 */
export async function getCoreSectorScores(): Promise<DataLayerResult<SectorScoreRecord[]>> {
  const result = await getSectorScores()
  if (!result.success || !result.data) return result
  return { success: true, data: result.data.filter((s) => s.isCore) }
}
