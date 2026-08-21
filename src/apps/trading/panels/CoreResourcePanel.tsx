import React from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { EmptyState } from '@/components/molecules/EmptyState'
import { cn } from '@/lib/utils'
import type { Portfolio, StrategyClassification, StrategyResult } from '@/types'

export interface CoreResourcePanelProps {
  portfolio?: Portfolio
  strategyResult?: StrategyResult
  loading?: boolean
  onRefresh: () => void
}

export function CoreResourcePanel({
  portfolio,
  strategyResult,
  loading,
  onRefresh,
}: CoreResourcePanelProps): React.JSX.Element {
  const classificationMap = React.useMemo(() => {
    if (!strategyResult) return new Map<string, StrategyClassification>()
    return new Map<string, StrategyClassification>(
      [
        ...strategyResult.coreScarce,
        ...strategyResult.valueBargain,
        ...strategyResult.hotMomentum,
      ].map((c) => [c.symbol, c.classification]),
    )
  }, [strategyResult])

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">核心稀缺主题组合</CardTitle>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading} className="shadow-sm">
            {loading ? '构建中...' : '刷新组合'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          第四次工业革命稀缺核心资源 · 目标仓位 40% · 评分驱动
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-3">
        {!portfolio || portfolio.holdings.length === 0 ? (
          <EmptyState
            title={loading ? '正在构建组合...' : '暂无核心稀缺组合'}
            description={loading
              ? '正在根据观察池与评分构建组合...'
              : '请确保观察池中有匹配标的且评分 ≥ 4.0，然后点击刷新。'}
            className="py-6"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricItem label="总资产" value={`¥${formatNumber(portfolio.totalValue)}`} />
              <MetricItem
                label="主题仓位"
                value={`${(((portfolio.totalValue - portfolio.cashReserve) / portfolio.totalValue) * 100).toFixed(1)}%`}
              />
              <MetricItem label="现金储备" value={`¥${formatNumber(portfolio.cashReserve)}`} />
              <MetricItem label="持仓数" value={`${portfolio.holdings.length}`} />
            </div>

            {strategyResult && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricItem
                  label="20进13入选"
                  value={`${strategyResult.summary.selectedCount}/${strategyResult.summary.total}`}
                />
                <MetricItem
                  label="核心稀缺"
                  value={`${strategyResult.summary.coreScarceCount}`}
                />
                <MetricItem
                  label="价值洼地"
                  value={`${strategyResult.summary.valueBargainCount}`}
                />
                <MetricItem
                  label="热门追涨"
                  value={`${strategyResult.summary.hotMomentumCount}`}
                />
              </div>
            )}

            <div className="overflow-x-auto rounded-md border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 pr-2">代码</th>
                    <th className="px-3 py-2.5 pr-2">名称</th>
                    {strategyResult && <th className="px-3 py-2.5 pr-2">分类</th>}
                    <th className="px-3 py-2.5 pr-2 text-right">评分</th>
                    <th className="px-3 py-2.5 pr-2 text-right">价格</th>
                    <th className="px-3 py-2.5 pr-2 text-right">当前/目标股数</th>
                    <th className="px-3 py-2.5 pr-2 text-right">当前/目标权重</th>
                    <th className="px-3 py-2.5 pr-2 text-right">市值</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {portfolio.holdings.map((holding) => (
                    <tr key={holding.symbol} className="last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 pr-2 font-mono text-xs tabular-nums">{holding.symbol}</td>
                      <td className="px-3 py-2 pr-2 text-xs">{holding.name}</td>
                      {strategyResult && (
                        <td className="px-3 py-2 pr-2">
                          <ClassificationBadge
                            classification={classificationMap.get(holding.symbol)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 pr-2 text-right">
                        <Badge variant="outline" className="border-border/50 text-[10px] font-medium">{holding.score.toFixed(2)}</Badge>
                      </td>
                      <td className="px-3 py-2 pr-2 text-right tabular-nums text-xs">{holding.price.toFixed(2)}</td>
                      <td className="px-3 py-2 pr-2 text-right tabular-nums text-xs">
                        {holding.currentShares} / {holding.targetShares}
                      </td>
                      <td className="px-3 py-2 pr-2 text-right tabular-nums text-xs">
                        {(holding.currentWeight * 100).toFixed(1)}% /{' '}
                        {(holding.targetWeight * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 pr-2 text-right tabular-nums text-xs">
                        ¥{formatNumber(holding.marketValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {portfolio.rebalancePlan.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold tracking-tight">再平衡计划</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {portfolio.rebalancePlan.map((action) => (
                    <div
                      key={action.symbol}
                      className="flex items-center justify-between rounded-lg border border-border/40 p-3 text-xs transition-colors hover:bg-muted/20"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold">{action.symbol}</span>
                        <span className="ml-2 text-muted-foreground">{action.reason}</span>
                      </div>
                      <Badge
                        className={cn(
                          'shrink-0',
                          action.action === 'buy'
                            ? 'bg-success/10 text-success border-success/20'
                            : action.action === 'sell'
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : 'bg-muted text-muted-foreground border-border/40',
                        )}
                      >
                        {action.action === 'buy'
                          ? `买入 ${action.shares}`
                          : action.action === 'sell'
                            ? `卖出 ${action.shares}`
                            : '持有'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ClassificationBadge({
  classification,
}: {
  classification: StrategyClassification | undefined
}): React.JSX.Element {
  const label =
    classification === 'core-scarce'
      ? '核心稀缺'
      : classification === 'value-bargain'
        ? '价值洼地'
        : classification === 'hot-momentum'
          ? '热门追涨'
          : '其他'

  const badgeClass =
    classification === 'core-scarce'
      ? 'bg-info/10 text-info'
      : classification === 'value-bargain'
        ? 'bg-info/10 text-info'
        : classification === 'hot-momentum'
          ? 'bg-warning/10 text-warning'
          : 'bg-muted text-muted-foreground'

  return <Badge className={badgeClass}>{label}</Badge>
}

function MetricItem({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.round(value))
}
