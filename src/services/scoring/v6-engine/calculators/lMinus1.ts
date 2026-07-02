/**
 * L-1 行业评分估值 计算器
 *
 * 按 SKILL v4.3：从行业分析报告中提取 SKILL-C/SKILL-N 评分
 * 公式：L-1得分 = SKILL-C总分 × 关联度系数 + SKILL-N额外加分
 * 权重：10%
 */

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from '../types'
import type { LayerId } from '../types'
import { LAYER_LABELS } from '../types'

const logger = getLogger()

/** 7行业评分速查表（来自 industry-score-mapping SKILL） */
const INDUSTRY_SCORES: Record<string, { skillC: number; skillCRating: string; skillN: number; allocationBias: string }> = {
  'CoWoS先进封装': { skillC: 4.90, skillCRating: 'S级', skillN: 4.83, allocationBias: '极度超配' },
  '芯片设计': { skillC: 4.19, skillCRating: 'A级', skillN: 4.00, allocationBias: '超配' },
  '机器人': { skillC: 4.14, skillCRating: 'A级', skillN: 4.17, allocationBias: '超配' },
  '量子计算': { skillC: 3.96, skillCRating: 'A级', skillN: 3.50, allocationBias: '标配' },
  'AI应用及平台': { skillC: 3.84, skillCRating: 'A级', skillN: 3.67, allocationBias: '超配(择机)' },
  '航天星链': { skillC: 3.75, skillCRating: 'B+级', skillN: 3.50, allocationBias: '标配' },
  '创新药': { skillC: 3.73, skillCRating: 'B+级', skillN: 4.00, allocationBias: '超配' },
}

/** 核心标的→行业映射表（16只标的） */
const CORE_STOCK_MAP: Record<string, { sector: string; relevance: number }> = {
  '6160.HK': { sector: '创新药', relevance: 1.0 },
  '9926.HK': { sector: '创新药', relevance: 1.0 },
  '1801.HK': { sector: '创新药', relevance: 1.0 },
  '603259': { sector: '创新药', relevance: 1.0 },
  '0700.HK': { sector: 'AI应用及平台', relevance: 1.0 },
  '9988.HK': { sector: 'AI应用及平台', relevance: 1.0 },
  '9888.HK': { sector: 'AI应用及平台', relevance: 1.0 },
  '688521': { sector: '芯片设计', relevance: 1.0 },
  '688256': { sector: '芯片设计', relevance: 1.0 },
  '603501': { sector: '芯片设计', relevance: 1.0 },
  '002156': { sector: 'CoWoS先进封装', relevance: 1.0 },
  '600584': { sector: 'CoWoS先进封装', relevance: 1.0 },
  '688037': { sector: 'CoWoS先进封装', relevance: 1.0 },
  '688017': { sector: '机器人', relevance: 1.0 },
  '600118': { sector: '航天星链', relevance: 1.0 },
  '688027': { sector: '量子计算', relevance: 1.0 },
}

/** 关键词→行业匹配表 */
const KEYWORD_SECTOR_MAP: Array<{ keywords: string[]; sector: string; relevance: number }> = [
  { keywords: ['光模块', '光通信', 'CPO', '封装', 'CoWoS', '先进封装'], sector: 'CoWoS先进封装', relevance: 0.9 },
  { keywords: ['芯片', '半导体', 'IC', '集成电路', 'EDA', 'IP', 'FPGA'], sector: '芯片设计', relevance: 0.9 },
  { keywords: ['机器人', '伺服', '减速器', '人形', '自动化'], sector: '机器人', relevance: 0.9 },
  { keywords: ['量子', '量子计算', '超导'], sector: '量子计算', relevance: 0.9 },
  { keywords: ['AI', '人工智能', '大模型', '应用', '平台', '云', '社交'], sector: 'AI应用及平台', relevance: 0.7 },
  { keywords: ['航天', '卫星', '星链', '火箭', '空间'], sector: '航天星链', relevance: 0.9 },
  { keywords: ['创新药', 'CXO', '生物', 'ADC', '双抗', '基因', 'mRNA'], sector: '创新药', relevance: 0.9 },
]

export function matchIndustry(symbol: string, sector?: string, name?: string): { sectorName: string; relevance: number } | null {
  // 1. 精确代码匹配
  const coreMatch = CORE_STOCK_MAP[symbol]
  if (coreMatch) return { sectorName: coreMatch.sector, relevance: coreMatch.relevance }

  // 2. 关键词匹配
  const searchText = `${sector ?? ''} ${name ?? ''}`.toLowerCase()
  for (const entry of KEYWORD_SECTOR_MAP) {
    if (entry.keywords.some((kw) => searchText.includes(kw.toLowerCase()))) {
      return { sectorName: entry.sector, relevance: entry.relevance }
    }
  }

  return null
}

export function calcSkillNBonus(allocationBias: string): number {
  if (allocationBias.includes('极度超配')) return 0.30
  if (allocationBias.includes('超配')) return 0.15
  return 0.00
}

export const LMinus1Calculator: LayerCalculator & { matchIndustry: typeof matchIndustry; calcSkillNBonus: typeof calcSkillNBonus } = {
  layerId: 'lMinus1' as LayerId,

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, industryScore, config } = input
    const weight = config.weights.lMinus1

    // 如果外部已传入行业评分数据，直接使用
    if (industryScore) {
      const bonus = LMinus1Calculator.calcSkillNBonus(industryScore.allocationBias ?? '')
      const score = Math.min(5, industryScore.skillCScore * industryScore.relevance + bonus)

      logger.info(`[L-1] ${stock.symbol}: 外部行业评分, score=${score.toFixed(2)}`)

      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1,
        score: Math.round(score * 100) / 100,
        summary: `${industryScore.sectorName} | SKILL-C ${industryScore.skillCRating}(${industryScore.skillCScore}) | SKILL-N ${industryScore.skillNScore} | 关联度 ${industryScore.relevance}`,
        risks: [],
        evidence: [`SKILL-C: ${industryScore.skillCRating}(${industryScore.skillCScore})`, `SKILL-N: ${industryScore.skillNScore}`, `关联度: ${industryScore.relevance}`],
        weight,
        weightedScore: score * weight,
        dataSources: ['行业 SKILL 分析报告'],
      }
    }

    // 尝试匹配行业
    const matched = LMinus1Calculator.matchIndustry(stock.symbol, stock.sector, stock.name)
    if (!matched) {
      logger.info(`[L-1] ${stock.symbol}: 不在7行业覆盖范围，L-1不纳入`)
      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1,
        score: 0,
        summary: '不在7行业覆盖范围（CoWoS/芯片设计/机器人/量子计算/AI应用/航天星链/创新药），L-1不纳入综合评分',
        risks: [],
        evidence: [],
        weight,
        weightedScore: 0,
        dataSources: [],
      }
    }

    const sectorData = INDUSTRY_SCORES[matched.sectorName]
    if (!sectorData) {
      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1,
        score: 0,
        summary: `匹配到行业 ${matched.sectorName} 但无评分数据`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: 0,
        dataSources: [],
      }
    }

    const bonus = LMinus1Calculator.calcSkillNBonus(sectorData.allocationBias)
    const score = Math.min(5, sectorData.skillC * matched.relevance + bonus)

    logger.info(`[L-1] ${stock.symbol}: ${matched.sectorName}, SKILL-C=${sectorData.skillC}, 关联度=${matched.relevance}, bonus=${bonus}, score=${score.toFixed(2)}`)

    return {
      layerId: 'lMinus1' as LayerId,
      layerName: LAYER_LABELS.lMinus1,
      score: Math.round(score * 100) / 100,
      summary: `${matched.sectorName} | ${sectorData.skillCRating} | SKILL-C ${sectorData.skillC} | SKILL-N ${sectorData.skillN} | ${sectorData.allocationBias}`,
      risks: [],
      evidence: [
        `行业: ${matched.sectorName}`,
        `SKILL-C: ${sectorData.skillCRating}(${sectorData.skillC})`,
        `SKILL-N: ${sectorData.skillN}`,
        `关联度: ${matched.relevance}`,
        `配置建议: ${sectorData.allocationBias}`,
      ],
      weight,
      weightedScore: score * weight,
      dataSources: ['行业 SKILL 分析报告'],
    }
  },

  matchIndustry,
  calcSkillNBonus,
}