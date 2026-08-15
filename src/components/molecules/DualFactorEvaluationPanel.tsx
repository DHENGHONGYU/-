/**
 * 双因子评估面板
 *
 * 基于"个股技术信号 × 行业景气度评分"双因子共振规则，
 * 辅助博收益部分的买卖决策。
 *
 * 共振规则：
 * - 买入信号 + 行业强(≥3.5) → 买入（高置信度）
 * - 买入信号 + 行业中(3.0-3.5) → 试探性买入（半仓）
 * - 买入信号 + 行业弱(<3.0) → 不操作
 * - 卖出信号 + 行业弱(<3.0) → 卖出（高置信度）
 * - 卖出信号 + 行业中(3.0-3.5) → 减仓（半仓）
 * - 卖出信号 + 行业强(≥3.5) → 不操作
 * - 观望信号 + 任意 → 不操作
 *
 * @doc 双因子评估体系（见 docs/specs/02-functional-specs.md §2.4.19）
 */

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { DEFAULT_CAPITAL_ALLOCATION_CONFIG } from '@/config/capitalAllocationConfig'

/** 技术信号类型 */
export type TechnicalSignal = 'buy' | 'sell' | 'hold'

/** 行业评级 */
export type IndustryRating = 'strong' | 'medium' | 'weak'

/** 双因子评估结果 */
export interface DualFactorResult {
  /** 技术信号 */
  technicalSignal: TechnicalSignal
  /** 行业评分（0-5） */
  industryScore: number
  /** 行业评级（由 industryScore 推导） */
  industryRating: IndustryRating
  /** 操作建议 */
  action: 'buy' | 'half_buy' | 'sell' | 'half_sell' | 'hold'
  /** 操作建议文案 */
  actionText: string
  /** 置信度 */
  confidence: 'high' | 'medium' | 'none'
}

export interface DualFactorEvaluationPanelProps {
  /** 双因子评估结果列表 */
  results: DualFactorResult[]
  /** 股票代码 → 评估结果的映射，可选 */
  className?: string
}

/** 行业评分 → 评级 */
// eslint-disable-next-line react-refresh/only-export-components
export function scoreToIndustryRating(
  score: number,
  strongThreshold = DEFAULT_CAPITAL_ALLOCATION_CONFIG.dualFactorWeights.industryStrongThreshold,
  weakThreshold = DEFAULT_CAPITAL_ALLOCATION_CONFIG.dualFactorWeights.industryWeakThreshold,
): IndustryRating {
  if (score >= strongThreshold) return 'strong'
  if (score < weakThreshold) return 'weak'
  return 'medium'
}

/** 双因子共振规则 → 操作建议 */
// eslint-disable-next-line react-refresh/only-export-components
export function evaluateDualFactor(
  technicalSignal: TechnicalSignal,
  industryScore: number,
): DualFactorResult {
  const industryRating = scoreToIndustryRating(industryScore)

  const actionMap: Record<TechnicalSignal, Record<IndustryRating, { action: DualFactorResult['action']; text: string; confidence: DualFactorResult['confidence'] }>> = {
    buy: {
      strong: { action: 'buy', text: '买入', confidence: 'high' },
      medium: { action: 'half_buy', text: '试探性买入（半仓）', confidence: 'medium' },
      weak: { action: 'hold', text: '不操作（行业不支撑）', confidence: 'none' },
    },
    sell: {
      strong: { action: 'hold', text: '不操作（行业仍景气）', confidence: 'none' },
      medium: { action: 'half_sell', text: '减仓（半仓）', confidence: 'medium' },
      weak: { action: 'sell', text: '卖出', confidence: 'high' },
    },
    hold: {
      strong: { action: 'hold', text: '不操作', confidence: 'none' },
      medium: { action: 'hold', text: '不操作', confidence: 'none' },
      weak: { action: 'hold', text: '不操作', confidence: 'none' },
    },
  }

  const result = actionMap[technicalSignal][industryRating]

  return {
    technicalSignal,
    industryScore,
    industryRating,
    action: result.action,
    actionText: result.text,
    confidence: result.confidence,
  }
}

/** 信号标签 */
const SIGNAL_LABEL: Record<TechnicalSignal, string> = {
  buy: '买入信号',
  sell: '卖出信号',
  hold: '观望信号',
}

/** 信号颜色 */
const SIGNAL_COLOR: Record<TechnicalSignal, string> = {
  buy: 'text-success',
  sell: 'text-danger',
  hold: 'text-muted-foreground',
}

/** 行业评级标签 */
const RATING_LABEL: Record<IndustryRating, string> = {
  strong: '强',
  medium: '中',
  weak: '弱',
}

/** 行业评级颜色 */
const RATING_COLOR: Record<IndustryRating, string> = {
  strong: 'text-success',
  medium: 'text-warning',
  weak: 'text-danger',
}

/** 操作颜色 */
const ACTION_COLOR: Record<string, string> = {
  buy: 'text-success font-medium',
  half_buy: 'text-warning',
  sell: 'text-danger font-medium',
  half_sell: 'text-warning',
  hold: 'text-muted-foreground',
}

/** 置信度标签 */
const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  none: '—',
}

/**
 * 双因子评估面板
 */
export const DualFactorEvaluationPanel = memo(function DualFactorEvaluationPanel({
  results,
  className,
}: DualFactorEvaluationPanelProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>双因子评估</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          个股技术信号 × 行业景气度评分 → 共振才操作（博收益依据）
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无评估数据
          </p>
        ) : (
          <>
            {/* 评估结果列表 */}
            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_1.5fr_auto] items-center gap-2 rounded-md border p-2 text-xs"
                >
                  <div>
                    <span className="text-muted-foreground">技术：</span>
                    <span className={SIGNAL_COLOR[result.technicalSignal]}>
                      {SIGNAL_LABEL[result.technicalSignal]}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">行业：</span>
                    <span className={RATING_COLOR[result.industryRating]}>
                      {RATING_LABEL[result.industryRating]}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      ({result.industryScore.toFixed(1)})
                    </span>
                  </div>
                  <div className={ACTION_COLOR[result.action] ?? ''}>
                    {result.actionText}
                  </div>
                  <div className="text-muted-foreground">
                    置信度：{CONFIDENCE_LABEL[result.confidence]}
                  </div>
                </div>
              ))}
            </div>

            {/* 共振规则速查 */}
            <div className="rounded-md border p-2 space-y-1">
              <div className="text-xs font-medium">共振规则速查</div>
              <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                <div></div>
                <div className="text-center font-medium text-success">行业强</div>
                <div className="text-center font-medium text-warning">行业中</div>
                <div className="text-center font-medium text-danger">行业弱</div>

                <div className="font-medium text-success">买入信号</div>
                <div className="text-center text-success">买入</div>
                <div className="text-center text-warning">半仓</div>
                <div className="text-center text-muted-foreground">不操作</div>

                <div className="font-medium text-danger">卖出信号</div>
                <div className="text-center text-muted-foreground">不操作</div>
                <div className="text-center text-warning">半仓</div>
                <div className="text-center text-danger">卖出</div>

                <div className="font-medium text-muted-foreground">观望信号</div>
                <div className="text-center text-muted-foreground col-span-3">不操作</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})
