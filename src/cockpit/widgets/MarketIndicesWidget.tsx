import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetStateShell } from './components/WidgetStateShell'
import { useWidgetErrorState } from '@/cockpit/hooks/useWidgetErrorState'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig, MarketIndexData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import {
  twText,
  twBg,
  getStockColorClass,
  getStockColorHex,
} from '@/constants/theme.tokens'
import { safeFormatNumber, safeFormatPercent, isValidNumber } from '@/lib/format'

interface MarketIndicesWidgetProps {
  config: WidgetConfig
}

/**
 * MarketIndicesWidget
 * @param props
 */
export default function MarketIndicesWidget(props: MarketIndicesWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  // P0-2 防御性 guard：防止 props 为 null 时解构崩溃（hooks 之后条件返回）
  if (!props?.config) return <div className={cn('p-4 text-sm', twText('gray', 400))}>配置未就绪</div>
  const { config } = props
  const indices = data.indices
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getChangeIcon = (change: number | undefined) => {
    if (!isValidNumber(change)) return <Minus className={cn('h-4 w-4', twText('gray', 400))} />
    const iconColorClass = getStockColorClass(change)
    if (change > 0) return <TrendingUp className={cn('h-4 w-4', iconColorClass)} />
    if (change < 0) return <TrendingDown className={cn('h-4 w-4', iconColorClass)} />
    return <Minus className={cn('h-4 w-4', iconColorClass)} />
  }

  const getChangeColor = (change: number | undefined) => {
    if (!isValidNumber(change)) return twText('gray', 400)
    return getStockColorHex(change)
  }

  const { visualState, displayError } = useWidgetErrorState({
    loading,
    error,
    hasData: indices.length > 0,
    fallbackErrorMessage: '大盘行情数据暂不可用，请检查后端服务或稍后重试',
  })

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={displayError}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载大盘行情中…"
      emptyTitle="暂无大盘行情"
      emptyDescription="当前未获取到指数数据，请检查数据源或稍后重试"
      skeleton={
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" className={twBg('gray', 200)} />
              <Skeleton variant="text" className={cn(twBg('gray', 200), 'h-6 w-20')} />
              <Skeleton variant="text" className={cn(twBg('gray', 200), 'h-4 w-16')} />
            </div>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {indices.map((index: MarketIndexData) => (
            <div key={index.code} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{index.name}</span>
                {getChangeIcon(index.change)}
              </div>
              <div className="text-lg font-bold">{safeFormatNumber(index.price, 2)}</div>
              <div className="text-sm" style={{ color: getChangeColor(index.changePercent) }}>
                {safeFormatPercent(index.changePercent, 2)}
              </div>
              <div className={cn('text-xs', twText('gray', 400))}>
                最高:{safeFormatNumber(index.high, 0)} 最低:{safeFormatNumber(index.low, 0)}
              </div>
              <div className={cn('text-xs', twText('gray', 400))}>成交:{index.volume ?? '--'}</div>
            </div>
        ))}
      </div>
    </WidgetStateShell>
  )
}
