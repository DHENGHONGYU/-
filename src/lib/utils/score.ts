/**
 * 跨模块共享评分工具函数（单一真相源）
 *
 * 从 `src/cockpit/shared/score.ts` 提升而来，供 cockpit / services / components
 * 跨模块复用，消除评分逻辑在模块间的重复。
 *
 * 评分阈值与色板以 `src/constants/cockpit.constants` 的 `SCORE_LEVELS` 为权威来源。
 *
 * @doc [V9-DOC-ARCH-050]
 */
import { SCORE_LEVELS } from '@/constants/cockpit.constants'

// ---- 类型 ----

type ScoreLevelKey = keyof typeof SCORE_LEVELS

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface ActionLabelResult {
  label: string
  variant: BadgeVariant
}

export interface ActionLabelMap {
  [action: string]: ActionLabelResult | undefined
}

// ---- 等级判定（100 分制）----

/**
 * 百分制评分 → 等级对象（含 label/color/bgClass/min）
 * 阈值：80 / 60 / 40 / 20
 */
export function getScoreLevel(score: number): (typeof SCORE_LEVELS)[ScoreLevelKey] {
  if (score >= SCORE_LEVELS.EXCELLENT.min) return SCORE_LEVELS.EXCELLENT
  if (score >= SCORE_LEVELS.GOOD.min) return SCORE_LEVELS.GOOD
  if (score >= SCORE_LEVELS.AVERAGE.min) return SCORE_LEVELS.AVERAGE
  if (score >= SCORE_LEVELS.POOR.min) return SCORE_LEVELS.POOR
  return SCORE_LEVELS.BAD
}

// ---- 颜色映射 ----

/**
 * 100 分制评分 → Tailwind bgClass
 * 与 `SCORE_LEVELS` 5 档对齐，替代 `services/stock-analysis/scoringStrategy.ts`
 * 中内联的 `private getScoreColor`（原实现缺 20–40 橙档，此处补全）。
 */
export function getScoreColorClass(score: number): string {
  return getScoreLevel(score).bgClass
}

/**
 * 5 分制评分（score / 20）→ 颜色 hex
 * 阈值：EXCELLENT/GOOD/AVERAGE/POOR/BAD 的 min 各除以 20
 */
export function getScoreColor5(score: number): string {
  if (score >= SCORE_LEVELS.EXCELLENT.min / 20) return SCORE_LEVELS.EXCELLENT.color
  if (score >= SCORE_LEVELS.GOOD.min / 20) return SCORE_LEVELS.GOOD.color
  if (score >= SCORE_LEVELS.AVERAGE.min / 20) return SCORE_LEVELS.AVERAGE.color
  if (score >= SCORE_LEVELS.POOR.min / 20) return SCORE_LEVELS.POOR.color
  return SCORE_LEVELS.BAD.color
}

// ---- 动作标签（参数化配置版）----

/**
 * 通用动作标签映射
 * @param action - 动作标识符
 * @param labelMap - action → { label, variant } 映射表
 * @param fallback - 未匹配时的默认值
 */
export function getActionLabel(
  action: string,
  labelMap: ActionLabelMap,
  fallback: ActionLabelResult = { label: '—', variant: 'outline' },
): ActionLabelResult {
  return labelMap[action] ?? fallback
}

// ---- 预定义标签映射 ----

/** 热门板块动作标签 */
export const HOT_SECTOR_ACTION_MAP: ActionLabelMap = {
  immediate: { label: '立即跟进', variant: 'default' },
  probe: { label: '试探', variant: 'secondary' },
  ignore: { label: '不追', variant: 'outline' },
}

/** 价值洼地动作标签 */
export const VALUE_PIT_ACTION_MAP: ActionLabelMap = {
  immediate: { label: '立即建仓', variant: 'default' },
  probe: { label: '试探', variant: 'secondary' },
  wait: { label: '等轮动', variant: 'outline' },
  ignore: { label: '不建', variant: 'destructive' },
}
