/**
 * 交易信号面板
 * 展示基于评分和策略生成的交易信号
 */
import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Target, TrendingUp, Clock } from 'lucide-react'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { STOCK_COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'

const logger = getLogger()

interface TradingSignal {
  id: string
  symbol: string
  name: string
  action: 'buy' | 'sell' | 'hold'
  strength: number
  targetPrice: number
  generatedAt: number
  reason: string
}

interface TradingSignalPanelProps {
  signals?: TradingSignal[]
  onCreateOrder?: (signal: TradingSignal) => void
}

export function TradingSignalPanel({ signals = [], onCreateOrder }: TradingSignalPanelProps): React.JSX.Element {
  const handleCreateOrder = (signal: TradingSignal): void => {
    logger.info('[TradingSignalPanel] 从信号创建订单', { signalId: signal.id })
    onCreateOrder?.(signal)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易信号</CardTitle>
        <CardDescription>基于评分和策略生成的交易信号</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无交易信号</p>
            <p className="text-sm mt-2">请先进行智能评分或配置交易策略</p>
          </div>
        ) : (
          signals.map((signal) => (
            <Card key={signal.id} className={cn(
              'border-l-4',
              signal.action === 'buy' && STOCK_COLOR_TOKENS.up.tailwind.replace('text-', 'border-l-'),
              signal.action === 'sell' && STOCK_COLOR_TOKENS.down.tailwind.replace('text-', 'border-l-'),
              signal.action === 'hold' && COLOR_SHADES.gray[500]
            )}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        signal.action === 'buy' ? 'destructive' :
                        signal.action === 'sell' ? 'success' : 'outline'
                      }>
                        {signal.action === 'buy' ? '买入' :
                         signal.action === 'sell' ? '卖出' : '持有'}
                      </Badge>
                      <span className="font-semibold">{signal.symbol}</span>
                      <span className="text-sm text-muted-foreground">{signal.name}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        信号强度: {signal.strength}%
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        目标价: {signal.targetPrice}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(signal.generatedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {signal.reason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCreateOrder(signal)}
                  >
                    下单
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  )
}
