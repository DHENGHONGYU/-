import React from 'react'
import { TrendingUp, Target, Award, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/states'
import { WidgetStateShell } from './components/WidgetStateShell'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { STOCK_COLOR_TOKENS, COLOR_TOKENS, COLOR_SHADES, twText } from '@/constants/theme.tokens'

interface AITradeReviewWidgetProps {
  config: WidgetConfig
}

/**
 * AITradeReviewWidget
 */
export default function AITradeReviewWidget({ config }: AITradeReviewWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const tradeReview = data.tradeReview
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : !tradeReview
        ? 'empty'
        : 'ready'

  const content = (() => {
    if (!tradeReview) return null

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Target className={`h-6 w-6 ${COLOR_TOKENS.info.tailwind}`} />
            </div>
            <div className="text-2xl font-bold">{tradeReview.totalTrades}</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>总交易数</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <TrendingUp className="h-6 w-6" style={{ color: STOCK_COLOR_TOKENS.up.hex }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: STOCK_COLOR_TOKENS.up.hex }}>{tradeReview.winRate}%</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>胜率</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>目标: 55%+</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Award className={`h-6 w-6 ${twText('yellow', 500)}`} />
            </div>
            <div className={`text-2xl font-bold ${twText('yellow', 500)}`}>{tradeReview.profitLossRatio}</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>盈亏比</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>目标: 1.5+</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <AlertCircle className={`h-6 w-6 ${tradeReview.disciplineScore >= 80 ? COLOR_TOKENS.success.tailwind : COLOR_TOKENS.orange.tailwind}`} />
            </div>
            <div className={`text-2xl font-bold ${tradeReview.disciplineScore >= 80 ? COLOR_TOKENS.success.tailwind : COLOR_TOKENS.orange.tailwind}`}>
              {tradeReview.disciplineScore}
            </div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>纪律评分</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>目标: 80+</div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h4 className={`text-sm font-semibold ${COLOR_TOKENS.purple.tailwind} mb-3`}>AI 深度洞察</h4>
          <ul className={`space-y-2 text-sm ${COLOR_SHADES.gray[600]}`}>
            <li className="flex items-start gap-2">
              <span className={COLOR_TOKENS.purple.tailwind}>•</span>
              <span>盈亏比失衡: 平均盈利3.3% vs 平均亏损13.3%，盈亏比仅0.25:1。建议优化止盈策略。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={COLOR_TOKENS.purple.tailwind}>•</span>
              <span>数据揭示关键规律: 无错误交易的胜率(100%)显著高于有错误交易的胜率(0%)。交易纪律是核心竞争力。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={COLOR_TOKENS.purple.tailwind}>•</span>
              <span>情绪控制是核心瓶颈。记录显示负面情绪的交易日盈亏表现明显差于平静状态。</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">行动建议</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-card border rounded-lg p-3">
              <span className={`text-xs font-semibold ${COLOR_TOKENS.success.tailwind} w-16`}>立即执行</span>
              <span className={`text-sm ${COLOR_SHADES.gray[600]}`}>采用移动止损策略，每笔交易强制填写计划</span>
            </div>
            <div className="flex items-center gap-3 bg-card border rounded-lg p-3">
              <span className={`text-xs font-semibold ${COLOR_TOKENS.info.tailwind} w-16`}>短期(1月)</span>
              <span className={`text-sm ${COLOR_SHADES.gray[600]}`}>每日收盘后使用 V6 Pro 复盘工具分析当日交易</span>
            </div>
            <div className="flex items-center gap-3 bg-card border rounded-lg p-3">
              <span className={`text-xs font-semibold ${COLOR_TOKENS.warning.tailwind} w-16`}>长期(3月)</span>
              <span className={`text-sm ${COLOR_SHADES.gray[600]}`}>建立完整的交易 SOP，每季度进行深度 AI 复盘</span>
            </div>
          </div>
        </div>
      </div>
    )
  })()

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      titleAction={
        <Badge variant="outline" className="mt-1">
          基于 AI 双引擎分析
        </Badge>
      }
      skeleton={
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton variant="text" className="h-8 w-16 mx-auto" />
                <Skeleton variant="text" className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
        </div>
      }
    >
      {content}
    </WidgetStateShell>
  )
}
