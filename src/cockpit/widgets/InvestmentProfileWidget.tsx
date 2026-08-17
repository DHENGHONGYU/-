import React from 'react'
import { User, TrendingUp, Shield, PieChart, Clock } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import { Badge } from '@/components/atoms/Badge'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, MarketData, ProfileMetric } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'

interface InvestmentProfileWidgetProps {
  config: WidgetConfig
  /** 外部注入的 MarketData；未注入时自动从 MarketDataProvider 获取 */
  data?: MarketData
}

const ICON_MAP: Record<string, React.ReactNode> = {
  '投资能力': <TrendingUp className="h-4 w-4" />,
  '投资风格': <User className="h-4 w-4" />,
  '风控能力': <Shield className="h-4 w-4" />,
  '持仓透视': <PieChart className="h-4 w-4" />,
  '择时风格': <Clock className="h-4 w-4" />,
}

/**
 * 根据评分从 SCORE_LEVELS 常量获取等级
 * @remarks 禁止硬编码等级阈值，所有判断必须来自常量
 */
function getScoreLevel(score: number) {
  if (score >= SCORE_LEVELS.EXCELLENT.min) return SCORE_LEVELS.EXCELLENT
  if (score >= SCORE_LEVELS.GOOD.min) return SCORE_LEVELS.GOOD
  if (score >= SCORE_LEVELS.AVERAGE.min) return SCORE_LEVELS.AVERAGE
  if (score >= SCORE_LEVELS.POOR.min) return SCORE_LEVELS.POOR
  return SCORE_LEVELS.BAD
}

/**
 * 投资画像 / 分析中心 Widget
 * @description 展示用户投资画像核心指标与标签，数据来自 MarketData.analysisScores.profile
 * @remarks 真实数据替换：将 MarketDataCollector 指向用户画像量化模型 API（如 /quant/profile）
 */
export default function InvestmentProfileWidget({ config, data }: InvestmentProfileWidgetProps): React.JSX.Element {
  const { data: marketData, loadingMap, errorMap, refreshWidget } = useMarketData()
  const sourceData = data ?? marketData
  const { profile } = sourceData.analysisScores

  const loading = (loadingMap[config.instanceId] ?? false) === true
  const error = errorMap[config.instanceId] ?? null
  const visualState = (error ?? '') !== ''
    ? 'error'
    : loading
      ? 'loading'
      : profile.metrics.length === 0
        ? 'empty'
        : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载投资画像…"
      emptyTitle="暂无投资画像数据"
      emptyDescription="当前未获取到投资能力、风格、风控等画像指标"
      skeleton={
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rect" className="h-24" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="text" className="h-6 w-16" />
            ))}
          </div>
        </div>
      }
      className="h-full flex flex-col widget-card-elevated"
    >
      <div className="flex-1 overflow-auto space-y-4">
        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {profile.metrics.map((metric: ProfileMetric) => {
            const level = getScoreLevel(metric.score)
            return (
              <div
                key={metric.name}
                className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-elevation-1"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {ICON_MAP[metric.name] ?? <User className="h-4 w-4" />}
                  <span className="text-xs">{metric.name}</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-h1 font-bold" style={{ color: level.color }}>
                    {metric.score}
                  </span>
                  <Badge variant="outline" className="text-xs" style={{ borderColor: level.color, color: level.color }}>
                    {level.label}
                  </Badge>
                </div>
                {(metric.description ?? '') !== '' && (
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                    {metric.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* 标签列表 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">画像标签</h4>
          <div className="flex flex-wrap gap-2">
            {profile.tags.length > 0 ? (
              profile.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">暂无标签</span>
            )}
          </div>
        </div>
      </div>
    </WidgetStateShell>
  )
}
