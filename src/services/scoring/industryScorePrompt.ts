import type { LlmMessage } from '@/services/llm/llmTypes'
import type { SectorSkillAnalysis } from '@/data/sectorSkillData'
import { INDUSTRY_SCORE_SKILL } from './industryScoreSkill'

export interface IndustryScorePromptInput {
  sector: SectorSkillAnalysis
  supplementaryTexts: string[]
  reportText: string
}

function summarizeSector(sector: SectorSkillAnalysis): string {
  return JSON.stringify({
    code: sector.code,
    name: sector.name,
    swLevel1: sector.swLevel1,
    swLevel2: sector.swLevel2,
    swLevel3: sector.swLevel3,
    keywords: sector.keywords,
    planAlignment: sector.planAlignment,
    policySupport: sector.policySupport,
    usChinaParity: sector.usChinaParity,
    skillC: {
      composite: sector.skillC.composite,
      grade: sector.skillC.grade,
      techAdvancement: sector.skillC.techAdvancement,
      structuralScarcity: sector.skillC.structuralScarcity,
      localizationBarrier: sector.skillC.localizationBarrier,
      overtakingPotential: sector.skillC.overtakingPotential,
    },
    skillA: sector.skillA,
    skillN: sector.skillN,
    composite: sector.composite,
    recommendation: sector.recommendation,
    positionPct: sector.positionPct,
    subTracks: sector.subTracks,
    relatedConcepts: sector.relatedConcepts,
  }, null, 2)
}

export function buildIndustryScorePrompt(input: IndustryScorePromptInput): LlmMessage[] {
  const { sector, supplementaryTexts, reportText } = input

  const userContent = [
    `行业/赛道: ${sector.name} (${sector.code})`,
    `已有 SKILL 量化评分:\n${summarizeSector(sector)}`,
    `补充文件资料 (${supplementaryTexts.length} 份):`,
    ...supplementaryTexts.map((text, idx) => `[文件${idx + 1}]\n${text}`),
    `行业分析报告/资料:\n${reportText || '未提供'}`,
    '请严格按照 system 指令中的 JSON 格式返回行业多维度评分结果。',
  ].join('\n\n')

  return [
    { role: 'system', content: INDUSTRY_SCORE_SKILL },
    { role: 'user', content: userContent },
  ]
}
