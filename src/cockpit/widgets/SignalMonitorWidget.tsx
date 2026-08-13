import React, { memo, useEffect } from 'react'
import { Zap, ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useSignalStore, initSignalStoreSubscriptions } from '@/store/signalStore'
import { THEME_TOKENS, COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'
import { WidgetStateShell } from './components/WidgetStateShell'

const logger = getLogger()

interface SignalMonitorWidgetProps {
  config: WidgetConfig
}

const SignalMonitorWidget = memo(function SignalMonitorWidget({ config }: SignalMonitorWidgetProps): React.JSX.Element {
  const { loading, error, refresh, signals: allSignals } = useSignalStore()
  const signals = allSignals.slice(0, 10)

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

  const visualState = error ? 'error' : loading ? 'loading' : signals.length === 0 ? 'empty' : 'ready'

  const getSignalIcon = (direction: string) => {
    if (direction === 'buy') return <ArrowUpCircle className={`h-5 w-5 ${COLOR_TOKENS.success.tailwind}`} />
    if (direction === 'sell') return <ArrowDownCircle className={`h-5 w-5 ${COLOR_TOKENS.danger.tailwind}`} />
    return <MinusCircle className="h-5 w-5 text-muted-foreground/70" />
  }

  const getSignalBadge = (direction: string) => {
    if (direction === 'buy') return <Badge className="text-xs" style={{ backgroundColor: THEME_TOKENS.color.successRaw, color: 'white' }}>买入</Badge>
    if (direction === 'sell') return <Badge className="text-xs" style={{ backgroundColor: THEME_TOKENS.color.destructiveRaw, color: 'white' }}>卖出</Badge>
    if (direction === 'hold') return <Badge variant="outline" className={`text-xs ${COLOR_TOKENS.info.tailwind} border-info/30`}>持有</Badge>
    return <Badge variant="outline" className="text-xs text-muted-foreground/70">观望</Badge>
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return COLOR_TOKENS.success.tailwind
    if (confidence >= 60) return COLOR_TOKENS.info.tailwind
    if (confidence >= 40) return COLOR_TOKENS.warning.tailwind
    return 'text-muted-foreground/70'
  }

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Zap className={`h-5 w-5 ${COLOR_TOKENS.warning.tailwind}`} />}
      visualState={visualState}
      error={error}
      onRetry={refresh}
      emptyTitle="暂无交易信号"
      emptyDescription="添加股票到观察池后将自动生成信号"
      skeleton={(
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
    >
      <div className="space-y-2">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {signals.map((signal) => (
            <div
              key={signal.symbol}
              className="flex items-center gap-3 bg-muted rounded-lg p-3 hover:bg-muted transition-colors"
            >
              <div className="shrink-0">
                {getSignalIcon(signal.direction)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{signal.symbol}</span>
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
                <div className="w-full bg-muted rounded-full h-1 mt-1.5">
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

        {/* 信号统计 */}
        {signals.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>
              买入: <span className={`font-medium ${STOCK_COLOR_TOKENS.up.tailwind}`}>{signals.filter((s) => s.direction === 'buy').length}</span>
            </span>
            <span>
              卖出: <span className={`font-medium ${STOCK_COLOR_TOKENS.down.tailwind}`}>{signals.filter((s) => s.direction === 'sell').length}</span>
            </span>
            <span>
              持有/观望: <span className="font-medium text-muted-foreground">{signals.filter((s) => s.direction === 'hold' || s.direction === 'watch').length}</span>
            </span>
          </div>
        )}
      </div>
    </WidgetStateShell>
  )
})

export default SignalMonitorWidget
