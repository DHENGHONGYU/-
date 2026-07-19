/**
 * @module services/skills/industryScoreMappingSkill
 * @description S-06 行业评分映射 SKILL（Batch B 确定性计算）
 *
 * 从 V6 sectorSkillData 中提取行业 SKILL-C / SKILL-N 评分，
 * 按个股代码/业务关键词匹配所属行业，计算关联度与 L-1 注入得分。
  * @doc [V9-DOC-BACK-005, V9-DOC-ARCH-008, V9-DOC-PROJ-002, V9-DOC-PROJ-003, V9-DOC-BACK-010]
*/

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import {
  SECTOR_SKILL_ANALYSIS,
  SECTOR_SKILL_MAP,
  SW1_TO_SECTOR,
  type SectorSkillAnalysis,
} from '@/data/sectorSkillData'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

const logger = getLogger()

/**
 * IndustryScoreMappingInputSchema
 */
export const IndustryScoreMappingInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 申万1级行业 */
    swLevel1: z.string().optional(),
    /** 业务关键词 */
    keywords: z.array(z.string()).optional(),
    /** 是否强制使用关键词匹配（忽略精确代码匹配） */
    forceKeywordMatch: z.boolean().optional(),
  }).optional(),
})

export type IndustryScoreMappingInput = z.infer<typeof IndustryScoreMappingInputSchema>

/**
 * IndustryScoreMappingOutputSchema
 */
export const IndustryScoreMappingOutputSchema = z.object({
  matched: z.boolean(),
  symbol: z.string(),
  stockName: z.string().optional(),
  sectorCode: z.string().optional(),
  sectorName: z.string().optional(),
  relevance: z.number().min(0).max(1),
  skillCScore: z.number().optional(),
  skillCRating: z.string().optional(),
  skillNScore: z.number().optional(),
  allocationBias: z.string().optional(),
  l1Score: z.number().optional(),
  l1Weight: z.number().optional(),
  matchSource: z.enum(['exact', 'sector', 'keyword', 'none']),
  evidence: z.array(z.string()),
})

export type IndustryScoreMappingOutput = z.infer<typeof IndustryScoreMappingOutputSchema>

const ALLOCATION_BIAS_BONUS: Record<string, number> = {
  '极度超配': 0.30,
  '战略超配': 0.30,
  '超配': 0.15,
  '重点配置': 0.15,
  '标配': 0.00,
  '标准配置': 0.00,
  '观察布局': -0.10,
}

/** 在核心标的列表中精确匹配股票代码或名称 */
function matchByExactSymbol(
  symbol: string,
  stockName: string | undefined,
): { sector: SectorSkillAnalysis; relevance: number } | null {
  for (const sector of SECTOR_SKILL_ANALYSIS) {
    const keyStocks = sector.keyStocks ?? []
    for (const stock of keyStocks) {
      if (stock.symbol === symbol || stock.name === stockName) {
        return { sector, relevance: 1.0 }
      }
    }
  }
  return null
}

/** 按申万1级行业匹配赛道 */
function matchBySector(swLevel1: string | undefined): { sector: SectorSkillAnalysis; relevance: number } | null {
  if (!swLevel1) return null
  const codes = SW1_TO_SECTOR[swLevel1]
  if (!codes || codes.length === 0) return null

  // 取第一个匹配赛道；若多个则取综合分最高者
  let best: SectorSkillAnalysis | null = null
  for (const code of codes) {
    const sector = SECTOR_SKILL_MAP[code]
    if (!sector) continue
    if (!best || sector.composite > best.composite) {
      best = sector
    }
  }

  return best ? { sector: best, relevance: 0.7 } : null
}

/** 按关键词匹配赛道 */
function matchByKeywords(keywords: string[] | undefined): { sector: SectorSkillAnalysis; relevance: number } | null {
  if (!keywords || keywords.length === 0) return null

  const keywordSet = new Set(keywords.map(k => k.toLowerCase()))
  let best: { sector: SectorSkillAnalysis; relevance: number } | null = null

  for (const sector of SECTOR_SKILL_ANALYSIS) {
    const sectorKeywords = sector.keywords.map(k => k.toLowerCase())
    const relatedConcepts = sector.relatedConcepts.map(c => c.toLowerCase())
    const subTrackNames = sector.subTracks.map(t => t.name.toLowerCase())

    let matchedCount = 0
    for (const kw of keywordSet) {
      if (
        sectorKeywords.some(sk => sk.includes(kw) || kw.includes(sk))
        || relatedConcepts.some(rc => rc.includes(kw) || kw.includes(rc))
        || subTrackNames.some(st => st.includes(kw) || kw.includes(st))
      ) {
        matchedCount++
      }
    }

    if (matchedCount === 0) continue

    // 关键词匹配越强，关联度越高，上限 0.9
    const relevance = Math.min(0.9, 0.5 + matchedCount * 0.2)
    if (!best || relevance > best.relevance) {
      best = { sector, relevance }
    }
  }

  return best
}

function calculateL1Score(sector: SectorSkillAnalysis, relevance: number): number {
  const skillC = sector.skillC.composite
  const allocationBias = sector.recommendation
  const bonus = ALLOCATION_BIAS_BONUS[allocationBias] ?? 0

  // L-1得分 = SKILL-C总分 × 关联度系数 + SKILL-N额外加分
  return Math.round((skillC * relevance + bonus) * 100) / 100
}

/**
 * executeIndustryScoreMappingSkill
 */
export async function executeIndustryScoreMappingSkill(
  ctx: SkillContext,
): Promise<SkillResult<IndustryScoreMappingOutput>> {
  const startedAt = Date.now()
  const params = (ctx.params ?? {}) as IndustryScoreMappingInput['params']
  const swLevel1 = params?.swLevel1
  const keywords = params?.keywords
  const forceKeywordMatch = params?.forceKeywordMatch

  logger.info('[industryScoreMappingSkill] 开始行业评分映射', {
    symbol: ctx.symbol,
    stockName: ctx.stockName,
    swLevel1,
    keywords,
  })

  let match: { sector: SectorSkillAnalysis; relevance: number } | null = null
  let matchSource: IndustryScoreMappingOutput['matchSource'] = 'none'

  // 第一步：精确代码匹配
  if (!forceKeywordMatch) {
    match = matchByExactSymbol(ctx.symbol, ctx.stockName)
    if (match) matchSource = 'exact'
  }

  // 第二步：申万行业匹配
  if (!match && swLevel1) {
    match = matchBySector(swLevel1)
    if (match) matchSource = 'sector'
  }

  // 第三步：关键词匹配
  if (!match && keywords && keywords.length > 0) {
    match = matchByKeywords(keywords)
    if (match) matchSource = 'keyword'
  }

  if (!match) {
    logger.warn('[industryScoreMappingSkill] 未匹配到行业', {
      symbol: ctx.symbol,
      swLevel1,
      keywords,
    })
    return {
      skillId: industryScoreMappingSkill.name,
      status: 'success',
      data: {
        matched: false,
        symbol: ctx.symbol,
        stockName: ctx.stockName,
        relevance: 0,
        matchSource: 'none',
        evidence: ['未在 sectorSkillData 中匹配到覆盖行业'],
      },
      evidence: ['no-match'],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const { sector, relevance } = match
  const l1Score = calculateL1Score(sector, relevance)
  const l1Weight = 0.10 // V6 v3.0 L-1 权重 10%

  const output: IndustryScoreMappingOutput = {
    matched: true,
    symbol: ctx.symbol,
    stockName: ctx.stockName,
    sectorCode: sector.code,
    sectorName: sector.name,
    relevance,
    skillCScore: sector.skillC.composite,
    skillCRating: sector.skillC.grade,
    skillNScore: sector.skillN.composite,
    allocationBias: sector.recommendation,
    l1Score,
    l1Weight,
    matchSource,
    evidence: [
      `匹配来源: ${matchSource}`,
      `赛道: ${sector.name}(${sector.code})`,
      `SKILL-C: ${sector.skillC.composite}(${sector.skillC.grade})`,
      `SKILL-N: ${sector.skillN.composite}`,
      `配置建议: ${sector.recommendation}`,
    ],
  }

  logger.info('[industryScoreMappingSkill] 行业评分映射完成', {
    symbol: ctx.symbol,
    sectorCode: sector.code,
    sectorName: sector.name,
    relevance,
    l1Score,
    matchSource,
  })

  return {
    skillId: industryScoreMappingSkill.name,
    status: 'success',
    data: output,
    evidence: output.evidence,
    meta: { startedAt, durationMs: Date.now() - startedAt },
  }
}

/**
 * industryScoreMappingSkill
 */
export const industryScoreMappingSkill: SkillDefinition<IndustryScoreMappingOutput> = {
  name: 'industry-score-mapping',
  title: '行业评分映射',
  description: '按个股代码/行业/关键词匹配 sectorSkillData，提取 SKILL-C/SKILL-N 评分并计算 L-1 注入得分',
  inputSchema: IndustryScoreMappingInputSchema,
  outputSchema: IndustryScoreMappingOutputSchema,
  executor: executeIndustryScoreMappingSkill,
  requiresLlm: false,
  version: '1.0.0',
}
