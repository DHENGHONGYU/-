/**
 * TradingFlowPage 统计卡片区域
 * 从 TradingFlowPage.tsx 提取
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { Order } from '@/types'
import type { TradingPosition } from '../tradingFlow.types'

interface TradingFlowSummaryProps {
  signals: TradingSignal[]
  orders: Order[]
  positions: TradingPosition[]
  stocksCount: number
  riskAlertsCount: number
}

export function TradingFlowSummary({
  signals,
  orders,
  positions,
  stocksCount,
  riskAlertsCount,
}: TradingFlowSummaryProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">交易信号</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-h1 font-bold">{signals.length}</div>
          <p className="text-xs text-muted-foreground">
            {signals.filter((s) => s.direction === 'buy').length} 买入 / {signals.filter((s) => s.direction === 'sell').length} 卖出
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">待执行订单</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-h1 font-bold">
            {orders.filter((o) => o.status === 'pending').length}
          </div>
          <p className="text-xs text-muted-foreground">
            待执行 / 总订单 {orders.length} 个
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">持仓数量</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-h1 font-bold">{positions.length}</div>
          <p className="text-xs text-muted-foreground">
            已建仓 · 观察池 {stocksCount} 只标的
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">风险预警</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-h1 font-bold">{riskAlertsCount}</div>
          <p className="text-xs text-muted-foreground">
            {riskAlertsCount === 0 ? '无预警' : '需要关注'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
