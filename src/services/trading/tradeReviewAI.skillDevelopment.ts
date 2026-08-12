/**
 * 技能发展路径生成器
 *
 * 根据错误分类结果计算技能维度评分，生成技能发展建议
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import type { ErrorClassificationResult } from './tradeErrorClassifier'
import type { SkillDevelopment, SkillDimensionCode } from './tradeReviewAI.types'
import { SKILL_DIMENSIONS, scoreToSkillLevel, getTargetLevel, getTargetScore } from './tradeReviewAI.dimensions'
import { TRADE_REVIEW_AI_THRESHOLDS } from '@/config/thresholds'
import { MAX_SCORE } from '@/constants/trade.constants'
import { MS_PER_DAY } from '@/constants/math.constants'

import { nanoid } from 'nanoid'
const logger = getLogger()

/**
 * 根据检测到的错误，计算每个技能维度的得分
 * @returns code → score(0-100)
 */
function calculateSkillDimensionScores(
  classification: ErrorClassificationResult,
): Map<SkillDimensionCode, number> {
  logger.info('[TradeReviewAI] 计算技能维度评分')

  const scores = new Map<SkillDimensionCode, number>()

  // 初始默认分数：无错误时 85 分，有错误时按错误扣分
  for (const dim of SKILL_DIMENSIONS) {
    scores.set(dim.code, TRADE_REVIEW_AI_THRESHOLDS.DIMENSION_DEFAULT_SCORE)
  }

  for (const error of classification.errors) {
    for (const dim of SKILL_DIMENSIONS) {
      // 使用 indexOf() 避免 readonly tuple 上 includes() 的类型推断问题
      if (dim.relatedErrors.indexOf(error.type) === -1) continue
      const current = scores.get(dim.code) ?? TRADE_REVIEW_AI_THRESHOLDS.DIMENSION_DEFAULT_SCORE
      const penalty =
        error.severity === 'critical'
          ? TRADE_REVIEW_AI_THRESHOLDS.ERROR_PENALTY_CRITICAL
          : error.severity === 'major'
            ? TRADE_REVIEW_AI_THRESHOLDS.ERROR_PENALTY_MAJOR
            : TRADE_REVIEW_AI_THRESHOLDS.ERROR_PENALTY_MINOR
      scores.set(dim.code, Math.max(0, current - penalty * error.count))
    }
  }

  return scores
}

/**
 * 生成技能发展建议
 * @remarks 重构后与 tradeReview.types.ts 的 SkillDevelopment 结构对齐
 */
export function generateSkillDevelopment(
  classification: ErrorClassificationResult,
  _orders: Order[],
): SkillDevelopment {
  logger.info('[TradeReviewAI] 生成技能发展路径')

  // 1. 兼容旧 UI 的当前水平文本
  let currentLevelText = '中级交易者'
  if (classification.disciplineScore >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_EXPERT_THRESHOLD) currentLevelText = '高级交易者'
  else if (classification.disciplineScore < TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_PRIMARY_THRESHOLD) currentLevelText = '初级交易者'

  // 2. 计算每个技能维度得分
  const dimensionScores = calculateSkillDimensionScores(classification)

  // 3. 构建 dimensions（与类型定义对齐）
  const dimensions: SkillDevelopment['dimensions'] = SKILL_DIMENSIONS.map((dim) => {
    const score = Math.round(dimensionScores.get(dim.code) ?? TRADE_REVIEW_AI_THRESHOLDS.DIMENSION_DEFAULT_SCORE)
    const currentLevel = scoreToSkillLevel(score)
    const targetLevel = getTargetLevel(currentLevel)
    const targetScore = getTargetScore(targetLevel)
    return {
      code: dim.code,
      name: dim.name,
      description: dim.description,
      currentLevel,
      targetLevel,
      score,
      gap: Math.max(0, targetScore - score),
    }
  })

  // 4. 构建优先技能排序（按 score 升序，gap 越大越优先）
  const prioritySkills: SkillDevelopment['prioritySkills'] = [...dimensions]
    .filter((d) => d.score < TRADE_REVIEW_AI_THRESHOLDS.PRIORITY_SKILL_SCORE_THRESHOLD)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5)
    .map((d) => ({
      skill: d.name,
      importance: d.gap >= TRADE_REVIEW_AI_THRESHOLDS.GAP_HIGH_THRESHOLD ? 'high' : d.gap >= TRADE_REVIEW_AI_THRESHOLDS.GAP_MEDIUM_THRESHOLD ? 'medium' : 'low',
      reason: `${d.name}当前评分 ${d.score}，距离目标等级 ${d.targetLevel} 还有 ${d.gap} 分差距`,
    }))

  // 兜底：如果没有低分技能，保持基础建议
  if (prioritySkills.length === 0) {
    prioritySkills.push(
      { skill: '仓位管理', importance: 'medium', reason: '合理的仓位管理是控制风险的基础' },
      { skill: '情绪控制', importance: 'medium', reason: '情绪稳定是长期盈利的关键' },
    )
  }

  // 5. 推荐学习资源
  const recommendedResources: SkillDevelopment['recommendedResources'] = [
    {
      type: 'book',
      title: '《交易心理分析》',
      description: 'Mark Douglas 经典著作，帮助理解交易心理和纪律的重要性',
    },
    {
      type: 'book',
      title: '《股票大作手回忆录》',
      description: 'Jesse Livermore 的交易哲学，理解市场情绪和人性弱点',
    },
    {
      type: 'article',
      title: '每日交易日志',
      description: '记录每笔交易的决策逻辑、情绪状态和结果，定期复盘',
    },
    {
      type: 'video',
      title: 'V6 Pro 复盘工具',
      description: '使用 AI 驱动的交易复盘系统，自动分析交易行为模式',
    },
  ]

  // 6. 里程碑（与 tradeReview.types.ts 对齐）
  const milestones: SkillDevelopment['milestones'] = dimensions.map((d, idx) => ({
    id: `milestone_${d.code}_${nanoid(8)}_${idx}`,
    title: `${d.name}达到${d.targetLevel === 'intermediate' ? '进阶' : d.targetLevel === 'advanced' ? '高级' : d.targetLevel === 'expert' ? '专家' : '大师'}水平`,
    description: d.name,
    skillDimension: d.code,
    targetLevel: d.targetLevel,
    criteria: [
      `${d.name}连续 10 笔交易无相关错误`,
      `${d.name}评分从 ${d.score} 提升到 ${Math.min(MAX_SCORE, d.score + d.gap)}`,
      `完成对应学习路径中的练习任务`,
    ],
    achieved: d.score >= TRADE_REVIEW_AI_THRESHOLDS.MILESTONE_ACHIEVED_THRESHOLD,
    targetDate: new Date(Date.now() + 30 * MS_PER_DAY).toISOString().slice(0, 10),
  }))

  // 7. 学习路径（与 tradeReview.types.ts 对齐）
  const learningPath: SkillDevelopment['learningPath'] = [
    {
      order: 1,
      title: '建立交易纪律基础',
      description: '从止损执行和交易计划入手，建立可重复的交易纪律',
      resources: [
        { type: 'book', title: '《交易心理分析》' },
        { type: 'course', title: '交易纪律训练营' },
      ],
      exercises: ['连续 5 个交易日填写交易计划表', '为所有持仓设置条件止损单'],
      estimatedHours: 10,
      completed: classification.disciplineScore >= TRADE_REVIEW_AI_THRESHOLDS.LEARNING_PATH_STEP_1_COMPLETE_THRESHOLD,
    },
    {
      order: 2,
      title: '优化仓位与情绪管理',
      description: '学习仓位管理公式，建立情绪冷却机制',
      resources: [
        { type: 'article', title: '凯利公式与仓位管理' },
        { type: 'video', title: '情绪管理 Meditation for Traders' },
      ],
      exercises: ['单笔仓位不超过总资金 20%', '亏损后强制休息 30 分钟'],
      estimatedHours: 8,
      completed: classification.disciplineScore >= TRADE_REVIEW_AI_THRESHOLDS.LEARNING_PATH_STEP_2_COMPLETE_THRESHOLD,
    },
    {
      order: 3,
      title: '提升入场与出场时机',
      description: '通过买卖点复盘分析和K线标注工具优化进出场信号',
      resources: [
        { type: 'course', title: '技术分析进阶' },
        { type: 'course', title: 'V6 Pro 回测工具实战' },
        { type: 'tool', title: 'K线买卖点标注系统' },
      ],
      exercises: [
        '对最近 20 笔交易进行买卖点复盘，使用K线markers标注实际买卖点',
        '根据买卖点分析报告调整止盈止损参数',
        '建立个人交易信号 checklist，验证买卖点参数有效性',
        '每周复盘最优/最差买卖点策略，迭代入场出场规则',
      ],
      estimatedHours: 15,
      completed: classification.disciplineScore >= TRADE_REVIEW_AI_THRESHOLDS.LEARNING_PATH_STEP_3_COMPLETE_THRESHOLD,
    },
    {
      order: 4,
      title: '系统化交易系统',
      description: '整合技能维度，形成完整的个人交易系统',
      resources: [
        { type: 'book', title: '《通向财务自由之路》' },
        { type: 'article', title: '季度深度复盘指南' },
      ],
      exercises: ['撰写个人交易 SOP', '完成一次季度 AI 深度复盘'],
      estimatedHours: 12,
      completed: classification.disciplineScore >= TRADE_REVIEW_AI_THRESHOLDS.LEARNING_PATH_STEP_4_COMPLETE_THRESHOLD,
    },
  ]

  // 8. 总体技能等级
  const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
  const overallLevel = scoreToSkillLevel(Math.round(avgScore))

  return {
    currentLevel: currentLevelText,
    prioritySkills,
    recommendedResources,
    userId: 'local_user',
    dimensions,
    milestones,
    learningPath,
    overallLevel,
    updatedAt: Date.now(),
  }
}
