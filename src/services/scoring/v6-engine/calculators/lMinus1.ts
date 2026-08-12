/**
 * L-1 行业评分估值 计算器
 *
 * v2.9.0 升级：三级行业分类体系 + V4 维度分析框架
 *
 * 计算优先级：
 * 1. 外部传入 V4 分析结果 → 使用 V4 综合分（最高优先级）
 * 2. 外部传入行业评分数据 → 使用 SKILL-C 评分
 * 3. 匹配三级行业分类 + V4 维度估算
 * 4. 匹配硬编码速查表（降级方案）
 *
 * 权重：10%
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from '../types'
import type { LayerId } from '../types'
import { LAYER_LABELS } from '../types'
import { matchStockIndustry, getIndustryPath } from '@/data/industryHierarchy'
import type { IndustryV4Analysis } from '@/data/types/types.sector'

const logger = getLogger()

/** 行业评分速查表（降级方案，11 个行业） */
const INDUSTRY_SCORES: Record<string, { skillC: number; skillCRating: string; skillN: number; allocationBias: string }> = {
  'CoWoS先进封装': { skillC: 4.90, skillCRating: 'S级', skillN: 4.83, allocationBias: '极度超配' },
  '芯片设计': { skillC: 4.19, skillCRating: 'A级', skillN: 4.00, allocationBias: '超配' },
  '机器人': { skillC: 4.14, skillCRating: 'A级', skillN: 4.17, allocationBias: '超配' },
  '量子计算': { skillC: 3.96, skillCRating: 'A级', skillN: 3.50, allocationBias: '标配' },
  'AI应用及平台': { skillC: 3.84, skillCRating: 'A级', skillN: 3.67, allocationBias: '超配(择机)' },
  '航天星链': { skillC: 3.75, skillCRating: 'B+级', skillN: 3.50, allocationBias: '标配' },
  '创新药': { skillC: 3.73, skillCRating: 'B+级', skillN: 4.00, allocationBias: '超配' },
  '医疗服务': { skillC: 3.20, skillCRating: 'B+级', skillN: 3.00, allocationBias: '标配' },
  '消费': { skillC: 3.50, skillCRating: 'A级', skillN: 3.20, allocationBias: '标配' },
  '金融': { skillC: 3.00, skillCRating: 'B+级', skillN: 2.80, allocationBias: '低配' },
  '新能源': { skillC: 3.80, skillCRating: 'A级', skillN: 3.50, allocationBias: '标配' },
}

/** 核心标的→行业映射表（17只标的） */
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
  '002044': { sector: '医疗服务', relevance: 1.0 },
}

/** 关键词→行业匹配表（速查表用） */
const KEYWORD_SECTOR_MAP: Array<{ keywords: string[]; sector: string; relevance: number }> = [
  { keywords: ['光模块', '光通信', 'CPO', '封装', 'CoWoS', '先进封装'], sector: 'CoWoS先进封装', relevance: 0.9 },
  { keywords: ['芯片', '半导体', 'IC', '集成电路', 'EDA', 'IP', 'FPGA'], sector: '芯片设计', relevance: 0.9 },
  { keywords: ['机器人', '伺服', '减速器', '人形', '自动化'], sector: '机器人', relevance: 0.9 },
  { keywords: ['量子', '量子计算', '超导'], sector: '量子计算', relevance: 0.9 },
  { keywords: ['AI', '人工智能', '大模型', '应用', '平台', '云', '社交'], sector: 'AI应用及平台', relevance: 0.7 },
  { keywords: ['航天', '卫星', '星链', '火箭', '空间'], sector: '航天星链', relevance: 0.9 },
  { keywords: ['创新药', 'CXO', 'ADC', '双抗', '基因', 'mRNA'], sector: '创新药', relevance: 0.9 },
  { keywords: ['体检', '医院', '医疗服务', '诊疗', '眼科', '牙科', '医美'], sector: '医疗服务', relevance: 0.9 },
  { keywords: ['食品', '饮料', '白酒', '家电', '零售', '消费'], sector: '消费', relevance: 0.8 },
  { keywords: ['银行', '保险', '证券', '金融', '信托', '期货'], sector: '金融', relevance: 0.9 },
  { keywords: ['新能源', '光伏', '锂电', '储能', '风电', '电动车', '动力电池'], sector: '新能源', relevance: 0.9 },
]

/**
 * 旧版匹配函数（保留用于向后兼容）
 */
export function matchIndustry(symbol: string, sector = '', name = ''): { sectorName: string; relevance: number } | null {
  const coreMatch = CORE_STOCK_MAP[symbol]
  if (coreMatch) return { sectorName: coreMatch.sector, relevance: coreMatch.relevance }

  const searchText = `${sector} ${name}`.toLowerCase()
  for (const entry of KEYWORD_SECTOR_MAP) {
    if (entry.keywords.some((kw) => searchText.includes(kw.toLowerCase()))) {
      return { sectorName: entry.sector, relevance: entry.relevance }
    }
  }

  return null
}

/**
 * 计算 SKILL-N 额外加分
 */
export function calcSkillNBonus(allocationBias: string): number {
  if (allocationBias.includes('极度超配')) return 0.30
  if (allocationBias.includes('超配')) return 0.15
  return 0.00
}

/**
 * 获取 V4 评级标签
 */
function getV4Rating(score: number): string {
  if (score >= 4.2) return 'S级'
  if (score >= 3.6) return 'A级'
  if (score >= 3.0) return 'B+级'
  if (score >= 2.4) return 'B级'
  if (score >= 1.8) return 'C级'
  return 'D级'
}

/**
 * 获取配置建议
 */
function getAllocationAdvice(score: number): string {
  if (score >= 4.2) return '超配'
  if (score >= 3.6) return '标配偏多'
  if (score >= 3.0) return '标配'
  if (score >= 2.4) return '标配偏空'
  return '低配'
}

/**
 * LMinus1Calculator
 *
 * v2.9.0 支持三级行业分类和 V4 维度分析
 */
export const LMinus1Calculator: LayerCalculator & {
  matchIndustry: typeof matchIndustry
  calcSkillNBonus: typeof calcSkillNBonus
} = {
  layerId: 'lMinus1',

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, industryScore, config } = input
    const weight = config.weights.lMinus1

    // 优先级 1：外部已传入 V4 行业分析数据
    const v4Analysis = (input as LayerInput & { industryV4Analysis?: IndustryV4Analysis }).industryV4Analysis
    if (v4Analysis && v4Analysis.v4Composite !== null) {
      const v4Score = v4Analysis.v4Composite
      const rating = getV4Rating(v4Score)
      const advice = getAllocationAdvice(v4Score)
      const bonus = calcSkillNBonus(advice)
      const finalScore = Math.min(5, v4Score + bonus)

      const tierLabel = v4Analysis.tier === 'tier3' ? '三级' : v4Analysis.tier === 'tier2' ? '二级' : '一级'

      logger.info(`[L-1] ${stock.symbol}: V4行业分析, score=${finalScore.toFixed(2)}`)

      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1 ?? 'L-1 行业评分估值',
        score: Math.round(finalScore * 100) / 100,
        summary: `${v4Analysis.industryName}(${tierLabel}) | V4综合分 ${v4Score.toFixed(2)} | ${rating} | ${advice}`,
        risks: v4Analysis.dataCompleteness < 0.5 ? ['行业数据完整度较低，评分参考性有限'] : [],
        evidence: [
          `V4综合分: ${v4Score.toFixed(2)}/5 (${rating})`,
          `景气度: ${v4Analysis.dimensions.prosperity.score?.toFixed(1) ?? 'N/A'}`,
          `竞争格局: ${v4Analysis.dimensions.competition.score?.toFixed(1) ?? 'N/A'}`,
          `政策环境: ${v4Analysis.dimensions.policy.score?.toFixed(1) ?? 'N/A'}`,
          `技术成熟度: ${v4Analysis.dimensions.technology.score?.toFixed(1) ?? 'N/A'}`,
          `成分股: ${v4Analysis.constituentCount}只`,
          `配置建议: ${advice}`,
        ],
        weight,
        weightedScore: finalScore * weight,
        dataSources: ['V4 行业分析', '个股数据聚合'],
        participated: true,
      }
    }

    // 优先级 2：外部已传入行业评分数据
    if (industryScore) {
      const bonus = LMinus1Calculator.calcSkillNBonus(industryScore.allocationBias ?? '')
      const score = Math.min(5, industryScore.skillCScore * industryScore.relevance + bonus)

      logger.info(`[L-1] ${stock.symbol}: 外部行业评分, score=${score.toFixed(2)}`)

      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1 ?? 'L-1 行业评分估值',
        score: Math.round(score * 100) / 100,
        summary: `${industryScore.sectorName} | SKILL-C ${industryScore.skillCRating}(${industryScore.skillCScore}) | SKILL-N ${industryScore.skillNScore} | 关联度 ${industryScore.relevance}`,
        risks: [],
        evidence: [
          `SKILL-C: ${industryScore.skillCRating}(${industryScore.skillCScore})`,
          `SKILL-N: ${industryScore.skillNScore}`,
          `关联度: ${industryScore.relevance}`,
        ],
        weight,
        weightedScore: score * weight,
        dataSources: ['行业 SKILL 分析报告'],
        participated: true,
      }
    }

    // 优先级 3：旧版速查表匹配（已验证的硬编码评分）
    const matched = LMinus1Calculator.matchIndustry(stock.symbol, stock.sector, stock.name)

    if (matched) {
      // 尝试匹配三级行业分类，用于补充行业路径信息
      let industryPathInfo = ''
      const industryMatch = matchStockIndustry({
        name: stock.name,
        sector: stock.sector,
      })
      if (industryMatch.tier3 || industryMatch.tier2) {
        const path = getIndustryPath((industryMatch.tier3 ?? industryMatch.tier2)!.code)
        industryPathInfo = path.map((p) => p.name).join(' → ') + ' | '
      }

      const sectorData = INDUSTRY_SCORES[matched.sectorName]
      if (!sectorData) {
        logger.warn(`[L-1] ${stock.symbol}: 匹配到行业 ${matched.sectorName} 但无评分数据`)
        return {
          layerId: 'lMinus1' as LayerId,
          layerName: LAYER_LABELS.lMinus1 ?? 'L-1 行业评分估值',
          score: Number.NaN,
          summary: `匹配到行业 ${matched.sectorName} 但无评分数据，L-1不纳入`,
          risks: [],
          evidence: [],
          weight,
          weightedScore: Number.NaN,
          dataSources: [],
          participated: false,
        }
      }

      const bonus = LMinus1Calculator.calcSkillNBonus(sectorData.allocationBias ?? '')
      const score = Math.min(5, sectorData.skillC * matched.relevance + bonus)

      logger.info(`[L-1] ${stock.symbol}: 速查表匹配 ${matched.sectorName}, score=${score.toFixed(2)}`)

      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1 ?? 'L-1 行业评分估值',
        score: Math.round(score * 100) / 100,
        summary: `${industryPathInfo}${matched.sectorName} | SKILL-C ${sectorData.skillCRating}(${sectorData.skillC}) | SKILL-N ${sectorData.skillN} | 关联度 ${matched.relevance}`,
        risks: [],
        evidence: [
          `SKILL-C: ${sectorData.skillCRating}(${sectorData.skillC})`,
          `SKILL-N: ${sectorData.skillN}`,
          `关联度: ${matched.relevance}`,
        ],
        weight,
        weightedScore: score * weight,
        dataSources: ['行业 SKILL 分析速查表'],
        participated: true,
      }
    }

    // 优先级 4：三级行业分类启发式估算（最细粒度降级方案）
    const industryMatch = matchStockIndustry({
      name: stock.name,
      sector: stock.sector,
    })

    if (industryMatch.tier3 || industryMatch.tier2 || industryMatch.tier1) {
      const matchedIndustry = industryMatch.tier3 ?? industryMatch.tier2 ?? industryMatch.tier1!
      const path = getIndustryPath(matchedIndustry.code)
      const pathNames = path.map((p) => p.name).join(' → ')

      let baseScore = 3.0
      let relevance = 0.7

      if (industryMatch.tier3) {
        relevance = 0.9
        baseScore = 3.2
      } else if (industryMatch.tier2) {
        relevance = 0.8
        baseScore = 3.0
      } else {
        relevance = 0.6
        baseScore = 2.8
      }

      const { financials } = input
      if (financials.revenueYoY !== undefined && financials.revenueYoY > 20) {
        baseScore += 0.3
      }
      if (financials.rdRatio !== undefined && financials.rdRatio > 0.1) {
        baseScore += 0.2
      }
      if (financials.grossMargin !== undefined && financials.grossMargin > 0.4) {
        baseScore += 0.2
      }

      baseScore = Math.max(1, Math.min(5, baseScore))
      const finalScore = baseScore * relevance
      const rating = getV4Rating(finalScore)
      const advice = getAllocationAdvice(finalScore)

      logger.info(`[L-1] ${stock.symbol}: 三级行业估算 ${matchedIndustry.name}, score=${finalScore.toFixed(2)}`)

      return {
        layerId: 'lMinus1' as LayerId,
        layerName: LAYER_LABELS.lMinus1 ?? 'L-1 行业评分估值',
        score: Math.round(finalScore * 100) / 100,
        summary: `${pathNames} | 匹配度 ${(relevance * 100).toFixed(0)}% | 估算分 ${finalScore.toFixed(2)} | ${rating}`,
        risks: [
          '行业评分为基于分类的启发式估算，非完整V4分析',
          '建议补充行业数据采集以获得更准确评分',
        ],
        evidence: [
          `行业路径: ${pathNames}`,
          `匹配度: ${(relevance * 100).toFixed(0)}%`,
          `估算分: ${finalScore.toFixed(2)}/5 (${rating})`,
          `配置建议: ${advice}`,
          `数据来源: 三级行业分类体系`,
        ],
        weight,
        weightedScore: finalScore * weight,
        dataSources: ['三级行业分类体系', '个股财务数据'],
        participated: true,
      }
    }

    // 未匹配到任何行业
    logger.info(`[L-1] ${stock.symbol}: 未匹配到行业评分覆盖范围，L-1不纳入`)

    return {
      layerId: 'lMinus1' as LayerId,
      layerName: LAYER_LABELS.lMinus1 ?? 'L-1 行业评分估值',
      score: Number.NaN,
      summary: '未匹配到行业评分覆盖范围，L-1不纳入综合评分',
      risks: [],
      evidence: [],
      weight,
      weightedScore: Number.NaN,
      dataSources: [],
      participated: false,
    }
  },

  matchIndustry,
  calcSkillNBonus,
}