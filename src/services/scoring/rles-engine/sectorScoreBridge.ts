/**
 * 股票 → 板块轮动评分桥接（symbol → RotationSectorScore）
 *
 * V6Score 不含 industryCode，无法直接取申万数字 sectorCode。改用 getSwIndustry 得到
 * 申万三级行业**名称**（swL1/swL2/swL3），再与板块轮动五因子的 swLevel1/2/3 名称匹配，
 * 取最新一期 RotationSectorScore。
 *
 * 接入 RLES：
 *  - D2 策略适配度 → f1Jingqi（板块景气）
 *  - D3 时机成熟度 → f2Zijin（板块资金）
 */

import { getSwIndustry } from '@/services/stock/industryLookup'
import { getRotationScores } from '@/services/analysis/rotationScoreService'
import type { RotationSectorScore } from '@/data/types/types.rotation'

/** 模块级缓存：轮动评分全量（按 sectorCode 查询较重，5 分钟内复用） */
let _allScoresCache: RotationSectorScore[] | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

function latestByDate(list: RotationSectorScore[]): RotationSectorScore {
  return [...list].sort((a, b) => b.scoreDate.localeCompare(a.scoreDate))[0]!
}

function matchSector(
  scores: RotationSectorScore[],
  sw: { swL1?: string; swL2?: string; swL3?: string },
): RotationSectorScore | null {
  const exact = scores.filter(
    (s) =>
      s.swLevel1 === sw.swL1 &&
      (s.swLevel2 ?? '') === (sw.swL2 ?? '') &&
      (s.swLevel3 ?? '') === (sw.swL3 ?? ''),
  )
  if (exact.length > 0) return latestByDate(exact)
  // 退而求其次：仅按一级行业匹配
  const byL1 = scores.filter((s) => s.swLevel1 === sw.swL1)
  return byL1.length > 0 ? latestByDate(byL1) : null
}

/**
 * 给定股票代码，返回其所属申万行业的轮动五因子评分（最新一期）。
 * 无行业匹配 / 轮动数据缺失返回 null（RLES 自动中性降级）。
 */
export async function fetchSectorScoreForStock(symbol: string): Promise<RotationSectorScore | null> {
  const sw = getSwIndustry(symbol)
  if (!sw) return null
  try {
    const now = Date.now()
    if (!_allScoresCache || now - _cacheTime > CACHE_TTL) {
      const res = await getRotationScores()
      _allScoresCache = res.success ? (res.data ?? []) : []
      _cacheTime = now
    }
    return matchSector(_allScoresCache, sw)
  } catch {
    return null
  }
}
