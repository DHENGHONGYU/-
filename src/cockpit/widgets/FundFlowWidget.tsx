import React, { useEffect, useState, useCallback } from 'react'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { MockMarketDataProvider, type FundFlow } from '@/cockpit/data/mockDataProvider'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { COLOR_TOKENS, twText, twBg } from '@/constants/theme.tokens'

interface FundFlowWidgetProps {
  config: WidgetConfig
}

/**
 * FundFlowWidget
 */
export default function FundFlowWidget({ config }: FundFlowWidgetProps): React.JSX.Element {
  const [data, setData] = useState<FundFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const flows = await MockMarketDataProvider.getFundFlows()
      setData(flows)
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取资金流向数据失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // 资金流向图标色（A股惯例：北向资金流入=红涨，流出=绿跌；主力资金=info 蓝）
  const getIcon = (type: FundFlow['type'], value: number) => {
    if (value > 0) {
      switch (type) {
        case 'main':
          return <ArrowUpCircle className={`h-6 w-6 ${COLOR_TOKENS.info.tailwind}`} />
        case 'north':
          return <ArrowUpCircle className={`h-6 w-6 ${STOCK_COLOR_MAPPING.UP_CLASS}`} />
        default:
          return <ArrowDownCircle className={`h-6 w-6 ${twText('gray', 500)}`} />
      }
    }
    switch (type) {
      case 'main':
        return <ArrowDownCircle className={`h-6 w-6 ${COLOR_TOKENS.info.tailwind}`} />
      case 'north':
        return <ArrowDownCircle className={`h-6 w-6 ${STOCK_COLOR_MAPPING.DOWN_CLASS}`} />
      default:
        return <ArrowUpCircle className={`h-6 w-6 ${twText('gray', 500)}`} />
    }
  }

  // 资金流向数值色（A股惯例：净流入=红，净流出=绿）
  const getValueColor = (value: number) => {
    return value >= 0 ? STOCK_COLOR_MAPPING.UP_CLASS : STOCK_COLOR_MAPPING.DOWN_CLASS
  }

  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : data.length === 0
        ? 'empty'
        : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={fetchData}
      loadingLabel="加载资金流向…"
      emptyTitle="暂无资金流向数据"
      emptyDescription="当前未获取到主力资金、北向资金等流向数据"
      skeleton={
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton variant="circle" className={`h-8 w-8 ${twBg('gray', 200)}`} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className={`${twBg('gray', 200)} w-24`} />
                <Skeleton variant="text" className={`${twBg('gray', 200)} h-6 w-16`} />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        {data.map((flow) => (
          <div key={flow.type} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon(flow.type, flow.value)}
              <span className="text-sm font-medium">{flow.name}</span>
            </div>
            <span className={`text-lg font-bold ${getValueColor(flow.value)}`}>
              {flow.value >= 0 ? '+' : ''}{flow.value}{flow.unit}
            </span>
          </div>
        ))}
      </div>
    </WidgetStateShell>
  )
}
