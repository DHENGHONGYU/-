import React, { memo, useEffect } from 'react'
import { AlertTriangle, TrendingDown, Activity, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/states'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { getLogger } from '@/lib/logger'
import { useOrderStore, initOrderStoreSubscriptions } from '@/store/orderStore'
import { THEME_TOKENS, COLOR_TOKENS, COLOR_SHADES, twText, twBg, twBorder } from '@/constants/theme.tokens'
import { WidgetStateShell } from './components/WidgetStateShell'

const logger = getLogger()

interface RiskMonitorWidgetProps {
  config: WidgetConfig
}

const RiskMonitorWidget = memo(function RiskMonitorWidget({ config }: RiskMonitorWidgetProps): React.JSX.Element {
  const { orders, riskMetrics, loading, error, refresh } = useOrderStore()

  useEffect(() => {
    logger.info('[RiskMonitorWidget] 加载风险指标')
    const cleanup = initOrderStoreSubscriptions()
    void useOrderStore.getState().refresh()
    return cleanup
  }, [])

  const visualState = error ? 'error' : loading ? 'loading' : orders.length === 0 ? 'empty' : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Shield className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />}
      visualState={visualState}
      error={error}
      onRetry={refresh}
      emptyTitle="暂无风险数据"
      emptyDescription="完成交易后将自动计算VaR、回撤、波动率等风险指标"
      skeleton={(
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-16" />
        </div>
      )}
    >
      <div className="space-y-4">
        {/* 核心风险指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3 text-center`}>
            <div className="flex justify-center mb-1">
              <AlertTriangle className="h-5 w-5" style={{ color: riskMetrics.varLevel === 'high' ? COLOR_TOKENS.danger.hex : THEME_TOKENS.color.warningRaw }} />
            </div>
            <div className="text-xl font-bold" style={{ color: riskMetrics.varLevel === 'high' ? COLOR_TOKENS.danger.hex : THEME_TOKENS.color.warningRaw }}>
              {riskMetrics.var95}%
            </div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>VaR(95%)</div>
            {/* 风险等级 Badge 使用动态颜色类：高风险红/中风险黄/低风险绿，因三目条件链中混用多个语义色，暂不替换为单一 token */}
            <Badge
              variant="outline"
              className={`text-xs mt-1 ${riskMetrics.varLevel === 'high' ? `${COLOR_TOKENS.danger.tailwind} ${twBorder('red', 300)}` : riskMetrics.varLevel === 'medium' ? `${twText('yellow', 500)} ${twBorder('yellow', 300)}` : `${COLOR_TOKENS.success.tailwind} ${twBorder('green', 300)}`}`}
            >
              {riskMetrics.varLevel === 'high' ? '高风险' : riskMetrics.varLevel === 'medium' ? '中风险' : '低风险'}
            </Badge>
          </div>
          <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3 text-center`}>
            <div className="flex justify-center mb-1">
              <TrendingDown className="h-5 w-5" style={{ color: COLOR_TOKENS.danger.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: COLOR_TOKENS.danger.hex }}>{riskMetrics.maxDrawdown}%</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>最大回撤</div>
          </div>
          <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3 text-center`}>
            <div className="flex justify-center mb-1">
              <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: COLOR_TOKENS.info.hex }}>{riskMetrics.volatility}%</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>波动率</div>
          </div>
        </div>

        {/* 次要指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: riskMetrics.sharpeRatio >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }}>
              {riskMetrics.sharpeRatio}
            </div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>夏普比率</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${COLOR_SHADES.gray[700]}`}>{riskMetrics.betaEstimate}</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>Beta</div>
          </div>
          <div className="text-center">
            <div
              className="text-lg font-bold"
              style={{ color: riskMetrics.concentration > 50 ? COLOR_TOKENS.danger.hex : COLOR_TOKENS.success.hex }}
            >
              {riskMetrics.concentration}%
            </div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>集中度</div>
          </div>
        </div>

        {/* 风险告警 */}
        {riskMetrics.alerts.length > 0 && (
          <div className={`${twBg('red', 50)} rounded-lg p-3`}>
            <h4 className={`text-sm font-semibold ${twText('red', 700)} mb-2 flex items-center gap-1`}>
              <AlertTriangle className="h-4 w-4" /> 风险告警
            </h4>
            <ul className="space-y-1">
              {riskMetrics.alerts.map((alert, i) => (
                <li key={i} className={`text-xs ${twText('red', 600)} flex items-start gap-1`}>
                  <span>-</span>
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {riskMetrics.alerts.length === 0 && (
          <div className={`${twBg('green', 50)} rounded-lg p-3`}>
            <p className={`text-xs ${twText('green', 600)} text-center`}>当前无风险告警，组合风险可控</p>
          </div>
        )}
      </div>
    </WidgetStateShell>
  )
})

export default RiskMonitorWidget
