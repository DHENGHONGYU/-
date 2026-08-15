/**
 * SignalQualityDashboardWidget - 信号质量复盘仪表盘 Widget
 *
 * @module cockpit/widgets/SignalQualityDashboardWidget
 * @description 信号质量复盘仪表盘，展示准确率/胜率/Sharpe 等绩效指标、
 * 方向/类型分布、盈亏分析与趋势图。作为 signalQualityStore 的首个 UI 消费方。
 *
 * @architecture 四步集成契约
 * 1. 类型定义：src/store/signalQualityStore.ts（SignalQualityMetrics、SignalReviewRecord）
 * 2. Store：useSignalQualityStore（已存在）
 * 3. 派生查询：src/store/signalQualityStore.derived.ts（accuracyTrend、winRateTrend 等）
 * 4. UI 集成：本组件
 *
 * @compliance
 * - 颜色规范：使用 COLOR_TOKENS / STOCK_COLOR_TOKENS，盈亏场景走 A 股红涨绿跌例外规则
 * - 事件清理：useEffect cleanup 调用 initSignalQualityStoreSubscriptions 返回的 cleanup
 * - 日志埋点：核心分支（初始化、加载、操作按钮）有 logger.info
 * - 零硬编码：所有阈值提取为常量
 */

import React, { memo, useEffect, useMemo } from 'react'
import {
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Award,
} from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Skeleton } from '@/components/molecules/states'
import { WidgetStateShell } from './components/WidgetStateShell'
import {
  useSignalQualityStore,
  initSignalQualityStoreSubscriptions,
} from '@/store/signalQualityStore'
import {
  accuracyTrend,
  winRateTrend,
  getDirectionStats,
  topSignalTypes,
  bestReview,
  worstReview,
  recentReviews,
  averageReturn,
  averageWin,
  averageLoss,
} from '@/store/signalQualityStore'
import { SignalQualityTrendChart } from '@/components/organisms/analysis/signal/SignalQualityTrendChart'
import {
  COLOR_TOKENS,
  STOCK_COLOR_TOKENS,
  getStockColorClass,
} from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

// Import from extracted sub-files
import {
  TREND_WINDOW_SIZE,
  TOP_SIGNAL_TYPES_LIMIT,
  RECENT_REVIEWS_LIMIT,
  DIRECTION_COLOR,
  DIRECTION_LABEL,
} from './SignalQualityDashboardWidget.constants'
import type {
  SignalQualityDashboardWidgetProps,
  DirectionStatRow,
  SignalTypeStatRow,
} from './SignalQualityDashboardWidget.types'
import {
  formatPercent,
  formatPercentFrom100,
  formatDecimal,
  formatTime,
  getAccuracyBadgeClass,
  getSharpeBadgeClass,
} from './SignalQualityDashboardWidget.utils'
import { MetricCard, PnLCard } from './SignalQualityDashboardWidget.components'

const logger = getLogger()

// ============================================================
// 主组件
// ============================================================

const SignalQualityDashboardWidget = memo(
  function SignalQualityDashboardWidget({ config }: SignalQualityDashboardWidgetProps): React.JSX.Element {
    // ── 订阅 Store 状态 ─────────────────────────────────────────────────────
    const reviews = useSignalQualityStore((s) => s.reviews)
    const metrics = useSignalQualityStore((s) => s.metrics)
    const loading = useSignalQualityStore((s) => s.loading)
    const error = useSignalQualityStore((s) => s.error)
    const loadReviews = useSignalQualityStore((s) => s.loadReviews)
    const recalculateMetrics = useSignalQualityStore((s) => s.recalculateMetrics)

    // ── 初始化 DataBridge 订阅 ───────────────────────────────────────────────
    useEffect(() => {
      logger.info('[SignalQualityDashboardWidget] 初始化', { title: config.title })
      const cleanup = initSignalQualityStoreSubscriptions()
      void loadReviews()
      return () => {
        cleanup()
        logger.info('[SignalQualityDashboardWidget] 卸载')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── 调用派生查询（依赖 reviews 引用变化触发重算）─────────────────────────
    // 注意：派生查询内部调用 getState()，ESLint 静态分析无法识别 reviews 的影响，
    // 但实际上 reviews 引用变化会改变派生查询结果，因此显式声明 reviews 为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const accuracyTrendData = useMemo(() => accuracyTrend(TREND_WINDOW_SIZE), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const winRateTrendData = useMemo(() => winRateTrend(TREND_WINDOW_SIZE), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const directionStats = useMemo(() => getDirectionStats() as DirectionStatRow[], [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const topTypes = useMemo(() => topSignalTypes(TOP_SIGNAL_TYPES_LIMIT) as SignalTypeStatRow[], [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const best = useMemo(() => bestReview(), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const worst = useMemo(() => worstReview(), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const recentList = useMemo(() => recentReviews(RECENT_REVIEWS_LIMIT), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const avgReturn = useMemo(() => averageReturn(), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const avgWin = useMemo(() => averageWin(), [reviews])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const avgLoss = useMemo(() => averageLoss(), [reviews])

    const hasError = error !== null && error.length > 0
    const isEmpty = !loading && !hasError && reviews.length === 0
    const visualState = hasError
      ? 'error'
      : loading && reviews.length === 0
        ? 'loading'
        : isEmpty
          ? 'empty'
          : 'ready'

    // ── 渲染：正常状态 ──────────────────────────────────────────────────────
    logger.info('[SignalQualityDashboardWidget] 渲染', {
      reviewsCount: reviews.length,
      hasMetrics: metrics !== null,
    })

    return (
      <WidgetStateShell
        title={config.title}
        titleIcon={<Activity className="h-4 w-4" />}
        titleAction={
          visualState === 'ready' ? (
            <Badge variant="outline" className="text-xs">
              {reviews.length} 条复盘
            </Badge>
          ) : null
        }
        visualState={visualState}
        error={error ?? undefined}
        onRetry={() => void loadReviews()}
        loadingLabel="加载复盘数据中…"
        emptyTitle="暂无复盘数据"
        emptyDescription="点击下方按钮加载历史信号复盘记录"
        emptyAction={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadReviews()}
          >
            加载复盘数据
          </Button>
        }
        skeleton={
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rect" className="h-20" />
              ))}
            </div>
            <Skeleton variant="rect" className="h-32" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="text" />
              ))}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 1. 核心指标卡（accuracy/winRate/sharpe/maxDrawdown） */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="准确率"
              value={formatPercent(metrics?.accuracy)}
              colorClass={getAccuracyBadgeClass(metrics?.accuracy)}
            />
            <MetricCard
              label="胜率"
              value={formatPercent(metrics?.winRate)}
              colorClass={getAccuracyBadgeClass(metrics?.winRate)}
            />
            <MetricCard
              label="夏普比率"
              value={formatDecimal(metrics?.sharpeRatio)}
              colorClass={getSharpeBadgeClass(metrics?.sharpeRatio)}
            />
            <MetricCard
              label="最大回撤"
              value={formatPercentFrom100(metrics?.maxDrawdown)}
              colorClass={COLOR_TOKENS.danger.tailwind}
            />
          </div>

          {/* 2. 盈亏分析（A 股红涨绿跌例外规则） */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PnLCard label="平均收益" value={avgReturn} />
            <PnLCard label="平均盈利" value={avgWin} />
            <PnLCard label="平均亏损" value={avgLoss} />
          </div>

          {/* 3. 趋势图（接入 SignalQualityTrendChart 组件） */}
          <SignalQualityTrendChart
            accuracyTrendData={accuracyTrendData}
            winRateTrendData={winRateTrendData}
            windowSize={TREND_WINDOW_SIZE}
            loading={loading}
            error={error}
            onRetry={() => void loadReviews()}
          />

          {/* 4. 方向统计表 */}
          <div className="rounded-md border">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="p-2 text-left font-medium">方向</th>
                  <th className="p-2 text-right font-medium">数量</th>
                  <th className="p-2 text-right font-medium">准确率</th>
                  <th className="p-2 text-right font-medium">平均收益</th>
                  <th className="p-2 text-right font-medium">胜率</th>
                </tr>
              </thead>
              <tbody>
                {directionStats.map((stat) => (
                  <tr key={stat.direction} className="border-b last:border-0">
                    <td className={`p-2 font-medium ${DIRECTION_COLOR[stat.direction]}`}>
                      {DIRECTION_LABEL[stat.direction]}
                    </td>
                    <td className="p-2 text-right">{stat.count}</td>
                    <td className="p-2 text-right">{formatPercent(stat.accuracy)}</td>
                    <td className={`p-2 text-right ${getStockColorClass(stat.avgReturn)}`}>
                      {stat.avgReturn >= 0 ? '+' : ''}{stat.avgReturn.toFixed(2)}%
                    </td>
                    <td className="p-2 text-right">{formatPercent(stat.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5. Top 5 信号类型 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Top {TOP_SIGNAL_TYPES_LIMIT} 信号类型</p>
            {topTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无类型统计数据</p>
            ) : (
              topTypes.map((stat) => (
                <div key={stat.type} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="min-w-20 justify-center">
                    {stat.type}
                  </Badge>
                  <span className="text-muted-foreground">{stat.count} 次</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="absolute left-0 top-0 h-full"
                      style={{
                        width: `${Math.min(stat.accuracy * 100, 100)}%`,
                        backgroundColor: 'currentColor',
                      }}
                    />
                  </div>
                  <span className={`w-16 text-right ${getStockColorClass(stat.avgReturn)}`}>
                    {stat.avgReturn >= 0 ? '+' : ''}{stat.avgReturn.toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </div>

          {/* 6. 最佳/最差复盘 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {best !== null ? (
              <div className="rounded-md border p-3">
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Award className="h-3 w-3" />
                  最佳复盘
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{best.symbol}</Badge>
                    <span className="text-xs">{best.type}</span>
                  </div>
                  <span className={`text-sm font-semibold ${STOCK_COLOR_TOKENS.up.tailwind}`}>
                    +{best.pnlPercent?.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatTime(best.issuedAt)}</p>
              </div>
            ) : (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                暂无最佳复盘数据
              </div>
            )}

            {worst !== null ? (
              <div className="rounded-md border p-3">
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingDown className="h-3 w-3" />
                  最差复盘
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{worst.symbol}</Badge>
                    <span className="text-xs">{worst.type}</span>
                  </div>
                  <span className={`text-sm font-semibold ${STOCK_COLOR_TOKENS.down.tailwind}`}>
                    {worst.pnlPercent?.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatTime(worst.issuedAt)}</p>
              </div>
            ) : (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                暂无最差复盘数据
              </div>
            )}
          </div>

          {/* 7. 最近复盘列表 */}
          <div className="space-y-1">
            <p className="text-sm font-medium">最近 {RECENT_REVIEWS_LIMIT} 条复盘</p>
            {recentList.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无复盘记录</p>
            ) : (
              recentList.map((review) => (
                <div
                  key={review.signalId}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{review.symbol}</Badge>
                    <Badge variant="outline" className={DIRECTION_COLOR[review.direction]}>
                      {DIRECTION_LABEL[review.direction]}
                    </Badge>
                    <span className="text-muted-foreground">{review.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {review.pnlPercent !== undefined && (
                      <span className={getStockColorClass(review.pnlPercent)}>
                        {review.pnlPercent >= 0 ? '+' : ''}{review.pnlPercent.toFixed(2)}%
                      </span>
                    )}
                    {review.correct !== undefined && (
                      review.correct
                        ? <TrendingUp className={`h-3 w-3 ${COLOR_TOKENS.success.tailwind}`} />
                        : <TrendingDown className={`h-3 w-3 ${COLOR_TOKENS.danger.tailwind}`} />
                    )}
                    <span className="text-muted-foreground">{formatTime(review.issuedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 8. 操作按钮 */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                logger.info('[SignalQualityDashboardWidget] 用户点击：加载复盘数据')
                void loadReviews()
              }}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              加载复盘数据
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                logger.info('[SignalQualityDashboardWidget] 用户点击：重新计算指标')
                recalculateMetrics()
              }}
            >
              重新计算指标
            </Button>
          </div>
        </div>
      </WidgetStateShell>
    )
  },
)

SignalQualityDashboardWidget.displayName = 'SignalQualityDashboardWidget'

export default SignalQualityDashboardWidget