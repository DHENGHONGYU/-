/**
 * @fileoverview K线图表组件（带买卖点标注）
 */

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { CandlestickChart } from '@/components/chart'
import type { CandlestickChartData } from '@/components/chart'
import { useTradeReviewKline } from '@/pages/output/hooks/useTradeReviewKline'
import type { Order } from '@/data/types'
import { cn } from '@/lib/utils'
import { twBg, twText } from '@/constants/theme.tokens'

const KLINE_DEMO_DAYS = 30

/** 演示数据价格漂移系数 */
const DRIFT_COEFFICIENT = 0.003
/** 演示数据基础成交量 */
const DEMO_BASE_VOLUME = 1000000
/** 演示数据随机成交量范围 */
const DEMO_VOLUME_RANGE = 500000

function generateDemoKlineData(orders: Order[]): CandlestickChartData[] {
  if (orders.length === 0) return []

  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const firstDate = new Date(sorted[0]!.createdAt)
  const startDate = new Date(firstDate)
  startDate.setDate(startDate.getDate() - KLINE_DEMO_DAYS)

  const basePrice = sorted[0]!.price
  const data: CandlestickChartData[] = []
  let prevClose = basePrice

  for (let i = 0; i < KLINE_DEMO_DAYS * 2; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().slice(0, 10)

    const drift = (Math.sin(i * 0.3) + Math.cos(i * 0.15)) * basePrice * 0.02
    const open = prevClose
    const close = basePrice + drift + (i - KLINE_DEMO_DAYS) * basePrice * DRIFT_COEFFICIENT
    const high = Math.max(open, close) + Math.abs(drift) * 0.5
    const low = Math.min(open, close) - Math.abs(drift) * 0.5
    const volume = Math.round(DEMO_BASE_VOLUME + Math.random() * DEMO_VOLUME_RANGE)

    data.push({
      time: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })
    prevClose = close
  }

  return data
}

function getPrimarySymbol(orders: Order[]): string | null {
  if (orders.length === 0) return null
  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  return sorted[0]!.symbol
}

function adaptKlineResponseToChartData(
  history: unknown[],
): CandlestickChartData[] {
  return history.map((bar) => {
    const b = bar as { date: string; open: number; high: number; low: number; close: number; volume: number; amount: number }
    return {
      time: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }
  })
}

interface TradeReviewKlineChartProps {
  orders: Order[]
}

export function TradeReviewKlineChart({ orders }: TradeReviewKlineChartProps): React.JSX.Element {
  const primarySymbol = useMemo(() => getPrimarySymbol(orders), [orders])

  const {
    period,
    setPeriod,
    adjust,
    setAdjust,
    klineData,
    loading,
    dataSource,
    markers,
  } = useTradeReviewKline(primarySymbol, orders, adaptKlineResponseToChartData, generateDemoKlineData)

  if (klineData.length === 0 && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            多周期K线买卖点标注
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">暂无交易数据</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          多周期K线买卖点标注
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载 {period} K线数据...
            </div>
          )}
          <CandlestickChart
            data={klineData}
            markers={markers}
            height={400}
            showToolbar
            showVolume
            period={period}
            adjust={adjust}
            onPeriodChange={setPeriod}
            onAdjustChange={setAdjust}
          />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className={cn('inline-block w-3 h-3 rounded-full', twBg('red', 600))} />
              买入点
            </span>
            <span className="flex items-center gap-1">
              <span className={cn('inline-block w-3 h-3 rounded-full', twBg('green', 600))} />
              卖出点
            </span>
            <span>
              数据来源：
              {dataSource === 'real' && <span className={cn('font-medium', twText('green', 500))}>真实行情</span>}
              {dataSource === 'demo' && <span className={cn('font-medium', twText('amber', 500))}>模拟数据（采集失败降级）</span>}
              {dataSource === 'loading' && <span>加载中...</span>}
            </span>
            {primarySymbol !== null && <span>标的：{primarySymbol}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
