/**
 * @fileoverview K线图表组件（带买卖点标注）
 */

import { useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { CandlestickChart } from '@/components/chart'
import type { CandlestickChartData } from '@/components/chart'
import { useTradeReviewKline } from '@/hooks/trading/useTradeReviewKline'
import type { Order } from '@/data/types'
import { cn } from '@/lib/utils'
import {
  BUY_POINT_COLORS,
  BUY_POINT_NAMES,
  SELL_POINT_COLORS,
  SELL_POINT_NAMES,
} from '@/config/buySellPointConfig'
import type { BuyPointType, SellPointType } from '@/types/modules/buySellPoint.types'

/** 买点图例展示顺序（按交易逻辑：先趋势类，再特殊类，最后共振） */
const BUY_TYPES_ORDER: BuyPointType[] = [
  'buy_pivot',
  'buy_breakout',
  'buy_turning',
  'buy_dip',
  'buy_divergence',
  'buy_safety_margin',
  'composite_buy',
]

/** 卖点图例展示顺序（按止盈→止损→共振） */
const SELL_TYPES_ORDER: SellPointType[] = [
  'sell_profit_taking',
  'sell_trailing_stop',
  'sell_stop_loss',
  'composite_sell',
]

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

/**
 * 买卖点颜色对照图例（与 K线 marker 颜色严格对齐）
 *
 * 设计要点：
 * - 颜色直接取自 BUY_POINT_COLORS / SELL_POINT_COLORS，与 domain/trading/markers.ts 生成的 marker 颜色一致
 * - 默认折叠（图例共 11 项，展开会占用过多垂直空间），点击标题切换
 * - 紧凑两列布局：左列买点（红色系），右列卖点（绿色系）
 */
function BuySellPointLegend(): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
        aria-expanded={expanded}
      >
        <span>买卖点颜色对照（买 {BUY_TYPES_ORDER.length} / 卖 {SELL_TYPES_ORDER.length}）</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-3 pb-3 pt-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">买点（红色系）</div>
            {BUY_TYPES_ORDER.map((type) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: BUY_POINT_COLORS[type] }}
                />
                <span className="text-foreground">{BUY_POINT_NAMES[type]}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">卖点（绿色系）</div>
            {SELL_TYPES_ORDER.map((type) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: SELL_POINT_COLORS[type] }}
                />
                <span className="text-foreground">{SELL_POINT_NAMES[type]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              数据来源：
              {dataSource === 'real' && <span className={cn('font-medium', 'text-success')}>真实行情</span>}
              {dataSource === 'demo' && <span className={cn('font-medium', 'text-warning')}>模拟数据（采集失败降级）</span>}
              {dataSource === 'loading' && <span>加载中...</span>}
            </span>
            {primarySymbol !== null && <span>标的：{primarySymbol}</span>}
          </div>
          <BuySellPointLegend />
        </div>
      </CardContent>
    </Card>
  )
}
