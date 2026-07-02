import React, { memo, useEffect } from 'react'
import { AlertTriangle, TrendingDown, Activity, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { getLogger } from '@/lib/logger'
import { useOrderStore, initOrderStoreSubscriptions } from '@/store/orderStore'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

interface RiskMonitorWidgetProps {
  config: WidgetConfig
}

const RiskMonitorWidget = memo(function RiskMonitorWidget({ config }: RiskMonitorWidgetProps): React.JSX.Element {
  const { orders, riskMetrics, loading, error } = useOrderStore()

  useEffect(() => {
    logger.info('[RiskMonitorWidget] 加载风险指标')
    const cleanup = initOrderStoreSubscriptions()
    useOrderStore.getState().refresh()
    return cleanup
  }, [])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center" style={{ color: COLOR_TOKENS.danger.hex }}>
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-16 ${THEME_TOKENS.color.mutedBackground} rounded animate-pulse`} />
            ))}
          </div>
          <div className={`h-16 ${THEME_TOKENS.color.mutedBackground} rounded animate-pulse`} />
        </CardContent>
      </Card>
    )
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">暂无风险数据</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">
            完成交易后将自动计算VaR、回撤、波动率等风险指标
          </p>
        </CardContent>
      </Card>
    )
  }

  const data = riskMetrics

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 核心风险指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex justify-center mb-1">
              <AlertTriangle className="h-5 w-5" style={{ color: data.varLevel === 'high' ? COLOR_TOKENS.danger.hex : THEME_TOKENS.color.warningRaw }} />
            </div>
            <div className="text-xl font-bold" style={{ color: data.varLevel === 'high' ? COLOR_TOKENS.danger.hex : THEME_TOKENS.color.warningRaw }}>
              {data.var95}%
            </div>
            <div className="text-xs text-gray-400">VaR(95%)</div>
            {/* 风险等级 Badge 使用动态颜色类：高风险红/中风险黄/低风险绿，因三目条件链中混用多个语义色，暂不替换为单一 token */}
            <Badge
              variant="outline"
              className={`text-xs mt-1 ${data.varLevel === 'high' ? 'text-red-500 border-red-300' : data.varLevel === 'medium' ? 'text-yellow-500 border-yellow-300' : 'text-green-500 border-green-300'}`}
            >
              {data.varLevel === 'high' ? '高风险' : data.varLevel === 'medium' ? '中风险' : '低风险'}
            </Badge>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex justify-center mb-1">
              <TrendingDown className="h-5 w-5" style={{ color: COLOR_TOKENS.danger.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: COLOR_TOKENS.danger.hex }}>{data.maxDrawdown}%</div>
            <div className="text-xs text-gray-400">最大回撤</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex justify-center mb-1">
              <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: COLOR_TOKENS.info.hex }}>{data.volatility}%</div>
            <div className="text-xs text-gray-400">波动率</div>
          </div>
        </div>

        {/* 次要指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: data.sharpeRatio >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }}>
              {data.sharpeRatio}
            </div>
            <div className="text-xs text-gray-400">夏普比率</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-700">{data.betaEstimate}</div>
            <div className="text-xs text-gray-400">Beta</div>
          </div>
          <div className="text-center">
            <div
              className="text-lg font-bold"
              style={{ color: data.concentration > 50 ? COLOR_TOKENS.danger.hex : COLOR_TOKENS.success.hex }}
            >
              {data.concentration}%
            </div>
            <div className="text-xs text-gray-400">集中度</div>
          </div>
        </div>

        {/* 风险告警 */}
        {data.alerts.length > 0 && (
          <div className="bg-red-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> 风险告警
            </h4>
            <ul className="space-y-1">
              {data.alerts.map((alert, i) => (
                <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                  <span>-</span>
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.alerts.length === 0 && (
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 text-center">当前无风险告警，组合风险可控</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export default RiskMonitorWidget
