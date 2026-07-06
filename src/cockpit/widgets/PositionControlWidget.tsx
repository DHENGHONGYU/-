import React, { memo, useEffect } from 'react'
import { PieChart, Wallet, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { usePositionStore, initPositionStoreSubscriptions } from '@/store/positionStore'
import { THEME_TOKENS, COLOR_TOKENS, COLOR_SHADES, twText, twBg, twBorder } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface PositionControlWidgetProps {
  config: WidgetConfig
}

const PositionControlWidget = memo(function PositionControlWidget({ config }: PositionControlWidgetProps): React.JSX.Element {
  const {
    totalValue,
    availableFunds,
    positionRatio,
    holdings,
    loading,
    error,
    refresh,
  } = usePositionStore()

  useEffect(() => {
    let cancelled = false
    const cleanup = initPositionStoreSubscriptions()
    const doRefresh = async () => {
      try {
        await refresh()
      } catch (err) {
        if (!cancelled) {
          logger.error('[PositionControlWidget] 刷新仓位数据失败', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
    void doRefresh()
    return () => { cancelled = true; cleanup() }
  }, [refresh])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className={`text-center ${COLOR_TOKENS.danger.tailwind}`}>
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
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className={`h-20 ${COLOR_SHADES.gray[200]} rounded animate-pulse`} />
            ))}
          </div>
          <div className={`h-32 ${COLOR_SHADES.gray[200]} rounded animate-pulse`} />
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (val: number): string => {
    if (val >= 1e8) return `${(val / 1e8).toFixed(1)}亿`
    if (val >= 1e4) return `${(val / 1e4).toFixed(1)}万`
    return val.toFixed(0)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 资金概览 */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`${twBg('blue', 50)} rounded-lg p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className={`h-4 w-4 ${COLOR_TOKENS.info.tailwind}`} />
              <span className={`text-xs ${COLOR_SHADES.gray[500]}`}>持仓市值</span>
            </div>
            <div className={`text-lg font-bold ${twText('blue', 600)}`}>{formatCurrency(totalValue)}</div>
          </div>
          <div className={`${twBg('green', 50)} rounded-lg p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className={`h-4 w-4 ${COLOR_TOKENS.success.tailwind}`} />
              <span className={`text-xs ${COLOR_SHADES.gray[500]}`}>可用资金</span>
            </div>
            <div className={`text-lg font-bold ${twText('green', 600)}`}>{formatCurrency(availableFunds)}</div>
          </div>
        </div>

        {/* 仓位比例 */}
        <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${COLOR_SHADES.gray[700]}`}>仓位比例</span>
            <Badge
              variant="outline"
              className={
                positionRatio > 80 ? `${COLOR_TOKENS.danger.tailwind} ${twBorder('red', 300)}` :
                positionRatio > 50 ? `${twText('yellow', 500)} ${twBorder('yellow', 300)}` :
                `${COLOR_TOKENS.success.tailwind} ${twBorder('green', 300)}`
              }
            >
              {positionRatio}%
            </Badge>
          </div>
          <div className={`w-full ${COLOR_SHADES.gray[200]} rounded-full h-3`}>
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${Math.min(positionRatio, 100)}%`,
                backgroundColor: positionRatio > 80 ? COLOR_TOKENS.danger.hex : positionRatio > 50 ? THEME_TOKENS.color.warningRaw : COLOR_TOKENS.success.hex,
              }}
            />
          </div>
        </div>

        {/* 持仓分布 */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <PieChart className="h-4 w-4" /> 持仓分布
          </h4>
          {holdings.length === 0 ? (
            <p className={`text-xs ${COLOR_SHADES.gray[400]} text-center py-4`}>暂无持仓</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {holdings.map((holding) => (
                <div key={holding.symbol} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: holding.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${COLOR_SHADES.gray[700]} truncate`}>
                        {holding.name}
                      </span>
                      <span className={`text-xs ${COLOR_SHADES.gray[500]}`}>{holding.ratio}%</span>
                    </div>
                    <div className={`w-full ${COLOR_SHADES.gray[200]} rounded-full h-1.5 mt-1`}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${holding.ratio}%`,
                          backgroundColor: holding.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

export default PositionControlWidget
