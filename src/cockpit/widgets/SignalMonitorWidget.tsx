import React, { memo, useEffect } from 'react'
import { Zap, ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useSignalStore, topSignals, initSignalStoreSubscriptions } from '@/store/signalStore'
import { THEME_TOKENS, COLOR_TOKENS, twText, twBg, twBorder } from '@/constants/theme.tokens'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface SignalMonitorWidgetProps {
  config: WidgetConfig
}

const SignalMonitorWidget = memo(function SignalMonitorWidget({ config }: SignalMonitorWidgetProps): React.JSX.Element {
  const { loading: isLoading, error } = useSignalStore()
  const signals = topSignals(10)

  useEffect(() => {
    let cancelled = false
    const cleanup = initSignalStoreSubscriptions()
    const doRefresh = async () => {
      try {
        await useSignalStore.getState().refresh()
      } catch (err) {
        if (!cancelled) {
          logger.error('[SignalMonitorWidget] 刷新信号数据失败', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
    void doRefresh()
    return () => { cancelled = true; cleanup() }
  }, [])

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`h-12 ${twBg('gray', 200)} rounded animate-pulse`} />
          ))}
        </CardContent>
      </Card>
    )
  }

  const getSignalIcon = (direction: string) => {
    if (direction === 'buy') return <ArrowUpCircle className={`h-5 w-5 ${COLOR_TOKENS.success.tailwind}`} />
    if (direction === 'sell') return <ArrowDownCircle className={`h-5 w-5 ${COLOR_TOKENS.danger.tailwind}`} />
    return <MinusCircle className={`h-5 w-5 ${twText('gray', 400)}`} />
  }

  const getSignalBadge = (direction: string) => {
    if (direction === 'buy') return <Badge className="text-xs" style={{ backgroundColor: THEME_TOKENS.color.successRaw, color: 'white' }}>买入</Badge>
    if (direction === 'sell') return <Badge className="text-xs" style={{ backgroundColor: THEME_TOKENS.color.destructiveRaw, color: 'white' }}>卖出</Badge>
    if (direction === 'hold') return <Badge variant="outline" className={`text-xs ${COLOR_TOKENS.info.tailwind} ${twBorder('blue', 300)}`}>持有</Badge>
    return <Badge variant="outline" className={`text-xs ${twText('gray', 400)}`}>观望</Badge>
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return COLOR_TOKENS.success.tailwind
    if (confidence >= 60) return COLOR_TOKENS.info.tailwind
    if (confidence >= 40) return COLOR_TOKENS.warning.tailwind
    return twText('gray', 400)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className={`h-5 w-5 ${COLOR_TOKENS.warning.tailwind}`} />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {signals.length === 0 ? (
          <div className="text-center py-6">
            <Zap className={`h-8 w-8 ${twText('gray', 300)} mx-auto mb-2`} />
            <p className={`text-sm ${COLOR_TOKENS.textMuted.tailwind}`}>暂无交易信号</p>
            <p className={`text-xs ${twText('gray', 300)} mt-1`}>添加股票到观察池后将自动生成信号</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {signals.map((signal) => (
              <div
                key={signal.symbol}
                className={`flex items-center gap-3 ${twBg('gray', 50)} rounded-lg p-3 hover:${twBg('gray', 100)} transition-colors`}
              >
                <div className="shrink-0">
                  {getSignalIcon(signal.direction)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${twText('gray', 700)}`}>{signal.symbol}</span>
                      {getSignalBadge(signal.direction)}
                    </div>
                    <span className={`text-xs font-bold ${getConfidenceColor(signal.confidence)}`}>
                      {signal.confidence}
                    </span>
                  </div>
                  <p className={`text-xs ${COLOR_TOKENS.textMuted.tailwind} mt-0.5 truncate`}>
                    {signal.rationale}
                  </p>
                  {/* 置信度条 */}
                  <div className={`w-full ${twBg('gray', 200)} rounded-full h-1 mt-1.5`}>
                    <div
                      className="h-1 rounded-full"
                      style={{
                        width: `${signal.confidence}%`,
                        backgroundColor: signal.confidence >= 80
                          ? THEME_TOKENS.color.successRaw
                          : signal.confidence >= 60
                            ? THEME_TOKENS.color.infoRaw
                            : signal.confidence >= 40
                              ? THEME_TOKENS.color.warningRaw
                              : THEME_TOKENS.color.mutedRaw,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 信号统计 */}
        {signals.length > 0 && (
          <div className={`flex items-center justify-between text-xs ${twText('gray', 500)} pt-2 border-t`}>
            <span>
              买入: <span className={`font-medium ${STOCK_COLOR_MAPPING.UP_CLASS}`}>{signals.filter((s) => s.direction === 'buy').length}</span>
            </span>
            <span>
              卖出: <span className={`font-medium ${STOCK_COLOR_MAPPING.DOWN_CLASS}`}>{signals.filter((s) => s.direction === 'sell').length}</span>
            </span>
            <span>
              持有/观望: <span className={`font-medium ${twText('gray', 500)}`}>{signals.filter((s) => s.direction === 'hold' || s.direction === 'watch').length}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export default SignalMonitorWidget
