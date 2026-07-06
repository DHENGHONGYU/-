import React, { useEffect, useState } from 'react'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { MockMarketDataProvider, type FundFlow } from '@/cockpit/data/mockDataProvider'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { COLOR_TOKENS, twText } from '@/constants/theme.tokens'

interface FundFlowWidgetProps {
  config: WidgetConfig
}

export default function FundFlowWidget({ config }: FundFlowWidgetProps): React.JSX.Element {
  const [data, setData] = useState<FundFlow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const flows = await MockMarketDataProvider.getFundFlows()
        setData(flows)
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [])

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-6 bg-gray-200 rounded w-16 mt-1" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  )
}
