import React from 'react'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetStateShell } from './components/WidgetStateShell'
import { useWidgetErrorState } from '@/cockpit/hooks/useWidgetErrorState'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig, FundFlowData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLOR_TOKENS, STOCK_COLOR_TOKENS, twText, twBg } from '@/constants/theme.tokens'

interface FundFlowWidgetProps {
  config: WidgetConfig
}

/**
 * FundFlowWidget
 * @description 资金流向 Widget。数据经 MarketDataProvider 统一采集（fundFlow dataSource），
 * 不再直读 MockMarketDataProvider，保持 cockpit 数据通道单一（与其他 widget 一致）。
 */
export default function FundFlowWidget(props: FundFlowWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  // 防御性 guard：防止 props 为 null 时解构崩溃（hooks 之后条件返回）
  if (!props?.config) return <div className={cn('p-4 text-sm', twText('gray', 400))}>配置未就绪</div>
  const { config } = props
  const flows = data.fundFlows
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  // 资金流向图标色（A股惯例：北向资金流入=红涨，流出=绿跌；主力资金=info 蓝）
  const getIcon = (type: FundFlowData['type'], value: number) => {
    if (value > 0) {
      switch (type) {
        case 'main':
          return <ArrowUpCircle className={cn('h-6 w-6', COLOR_TOKENS.info.tailwind)} />
        case 'north':
          return <ArrowUpCircle className={cn('h-6 w-6', STOCK_COLOR_TOKENS.up.tailwind)} />
        default:
          return <ArrowDownCircle className={cn('h-6 w-6', twText('gray', 500))} />
      }
    }
    switch (type) {
      case 'main':
        return <ArrowDownCircle className={cn('h-6 w-6', COLOR_TOKENS.info.tailwind)} />
      case 'north':
        return <ArrowDownCircle className={cn('h-6 w-6', STOCK_COLOR_TOKENS.down.tailwind)} />
      default:
        return <ArrowUpCircle className={cn('h-6 w-6', twText('gray', 500))} />
    }
  }

  // 资金流向数值色（A股惯例：净流入=红，净流出=绿）
  const getValueColor = (value: number) => {
    return value >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind
  }

  const { visualState, displayError } = useWidgetErrorState({
    loading,
    error,
    hasData: flows.length > 0,
    fallbackErrorMessage: '资金流向数据暂不可用，请检查后端服务或稍后重试',
  })

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={displayError}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载资金流向…"
      emptyTitle="暂无资金流向数据"
      emptyDescription="当前未获取到主力资金、北向资金等流向数据"
      skeleton={
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton variant="circle" className={cn('h-8 w-8', twBg('gray', 200))} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className={cn(twBg('gray', 200), 'w-24')} />
                <Skeleton variant="text" className={cn(twBg('gray', 200), 'h-6 w-16')} />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        {flows.map((flow) => (
          <div key={flow.type} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon(flow.type, flow.value)}
              <span className="text-sm font-medium">{flow.name}</span>
            </div>
            <span className={cn('text-lg font-bold', getValueColor(flow.value))}>
              {flow.value >= 0 ? '+' : ''}{flow.value}{flow.unit}
            </span>
          </div>
        ))}
      </div>
    </WidgetStateShell>
  )
}
