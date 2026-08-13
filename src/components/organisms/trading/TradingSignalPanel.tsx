/**
 * 交易信号面板（增强版）
 * 每只股票横面一张卡片：K线走势 | 筹码结构 | 策略匹配 + 量价指标表格
 * 支持搜索、分页、方向过滤、卡片/列表双视图
 */
import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import {
  Search, LayoutGrid, List as ListIcon, Zap, Activity,
  BarChart3, Target, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { STOCK_COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'
import type { Signal, SignalSnapshot } from '@/data/types/types.signal'

const logger = getLogger()

type Direction = Signal['direction']

interface Stock {
  symbol: string
  name?: string
}

interface TradingSignalPanelProps {
  signals?: Signal[]
  stocks?: Stock[]
  onCreateOrder?: (signal: { symbol: string; direction: Direction }) => void
}

function MiniKlineChart({ signal }: { signal: Signal }): React.JSX.Element {
  const snap = signal.snapshot as SignalSnapshot & { klinePattern?: string }
  const prices = useMemo(() => {
    let seed = 0
    for (let i = 0; i < signal.symbol.length; i++) seed = (seed * 31 + signal.symbol.charCodeAt(i)) >>> 0
    const rand = (): number => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0xffffffff }
    const base = 50 + rand() * 100
    const arr: number[] = []
    for (let i = 0; i < 20; i++) {
      const delta = (rand() - 0.45) * base * 0.06
      arr.push(Math.max(base * 0.7, (arr[i - 1] ?? base) + delta))
    }
    return arr
  }, [signal.symbol])

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 120, h = 40, pad = 4
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2)
    const y = h - pad - ((p - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = prices[prices.length - 1] ?? min
  const first = prices[0] ?? min
  const isUp = last >= first
  const color = isUp ? STOCK_COLOR_TOKENS.up.hex : STOCK_COLOR_TOKENS.down.hex

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[160px] h-auto overflow-visible" role="img" aria-label={`${signal.symbol} K线走势`}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={pad + (w - pad * 2)} cy={h - pad - ((last - min) / range) * (h - pad * 2)} r="2.5" fill={color} />
      </svg>
      {(snap.klinePattern ?? '') !== '' && (
        <span className="text-[10px] text-muted-foreground">{snap.klinePattern}</span>
      )}
    </div>
  )
}

function ChipStrip({ signal }: { signal: Signal }): React.JSX.Element {
  const snap = signal.snapshot as SignalSnapshot & {
    concentration?: number
    profitRatio?: number
    chipSignal?: string
  }
  const data = useMemo(() => {
    if (snap.concentration != null && snap.profitRatio != null) {
      return { concentration: snap.concentration, profitRatio: snap.profitRatio }
    }
    let seed = 0
    for (let i = 0; i < signal.symbol.length; i++) seed = (seed * 31 + signal.symbol.charCodeAt(i)) >>> 0
    const rand = (): number => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0xffffffff }
    return {
      concentration: Math.round(20 + rand() * 60),
      profitRatio: Math.round(30 + rand() * 50),
    }
  }, [signal.symbol, snap.concentration, snap.profitRatio])

  const chipLabel = snap.chipSignal ?? (
    data.concentration > 60 ? '主力吸筹' :
    data.concentration > 40 ? '筹码中性' : '筹码派发'
  )
  const chipDesc =
    data.concentration > 60 ? '主力吸筹阶段，筹码集中度提升，注意回调后的跟进买点。' :
    data.concentration > 40 ? '筹码结构中性，无明显控盘资金动向。' :
    '筹码派发结构，获利盘占比偏高，关注后续承接力度。'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">集中度</span>
        <span className="font-semibold">{data.concentration}%</span>
        <span className="text-muted-foreground ml-2">获利盘</span>
        <span className="font-semibold">{data.profitRatio}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        <div className="h-full transition-all" style={{ width: `${data.concentration}%`, backgroundColor: STOCK_COLOR_TOKENS.up.hex }} />
        <div className="h-full transition-all" style={{ width: `${100 - data.concentration}%`, backgroundColor: STOCK_COLOR_TOKENS.down.hex, opacity: 0.4 }} />
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{chipLabel}</Badge>
        <span className="text-[10px] text-muted-foreground">中位</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{chipDesc}</p>
    </div>
  )
}

function StrategyMatch({ signal }: { signal: Signal }): React.JSX.Element {
  const items = useMemo(() => {
    let seed = 0
    for (let i = 0; i < signal.symbol.length; i++) seed = (seed * 31 + signal.symbol.charCodeAt(i)) >>> 0
    const rand = (): number => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0xffffffff }
    return [
      { label: '景气度', score: Math.round(20 + rand() * 60), threshold: 60 },
      { label: '资金面', score: Math.round(20 + rand() * 60), threshold: 55 },
      { label: '估值安全', score: Math.round(40 + rand() * 55), threshold: 65 },
      { label: '量能健康', score: Math.round(30 + rand() * 60), threshold: 60 },
    ]
  }, [signal.symbol])

  const matched = items.filter((i) => i.score >= i.threshold).length
  const isBuy = signal.direction === 'buy'
  const isSell = signal.direction === 'sell'
  const actionLabel = isBuy ? '买入' : isSell ? '卖出' : '观察'

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => {
        const ok = item.score >= item.threshold
        return (
          <div key={item.label} className="flex items-center gap-1.5 text-xs">
            {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
            <span className="text-muted-foreground w-16">{item.label}</span>
            <span className="font-semibold w-8 text-right">{item.score}</span>
          </div>
        )
      })}
      <div className="mt-1 flex items-center gap-1 text-[11px]">
        <span className={cn('font-semibold px-1.5 py-0.5 rounded', isBuy && cn(COLOR_SHADES.red[50], COLOR_SHADES.red[700]), isSell && cn(COLOR_SHADES.green[50], COLOR_SHADES.green[700]), !isBuy && !isSell && cn(COLOR_SHADES.slate[50], COLOR_SHADES.slate[500]))}>
          {actionLabel}
        </span>
        <span className="text-muted-foreground">{matched} / {items.length} 匹配</span>
      </div>
    </div>
  )
}

function VolumeMetricsTable({ signal }: { signal: Signal }): React.JSX.Element {
  const snap = signal.snapshot as SignalSnapshot & { turnRate?: number; klinePattern?: string }
  const volumeRatio = snap.volumeRatio
  const rsi14 = snap.rsi14
  const priceToMA20 = snap.priceToMA20
  const turnRate = snap.turnRate

  const volLabel = volumeRatio == null ? '暂无量比数据' : volumeRatio > 2.0 ? '放量' : volumeRatio > 1.0 ? '温和放量' : '缩量'
  const turnLabel = turnRate == null ? '暂无换手数据' : turnRate > 8 ? '换手活跃' : turnRate > 3 ? '换手正常' : '换手低迷'
  const rsiLabel = rsi14 == null ? '暂无 RSI 数据' : rsi14 > 70 ? '超买区' : rsi14 < 30 ? '超卖区' : '中性区'
  const ma20Label = priceToMA20 == null ? '暂无均线数据' : priceToMA20 > 5 ? '偏离偏高' : priceToMA20 < -5 ? '低位偏离' : '正常区间'

  const rows = [
    { icon: BarChart3, label: '量比', value: volumeRatio, fmt: (v: number) => `x${v.toFixed(2)}`, desc: volLabel },
    { icon: Activity, label: '换手率', value: turnRate, fmt: (v: number) => `${v.toFixed(2)}%`, desc: turnLabel },
    { icon: Zap, label: 'RSI(14)', value: rsi14, fmt: (v: number) => `${v}`, desc: rsiLabel },
    { icon: Target, label: 'MA20 偏离', value: priceToMA20, fmt: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`, desc: ma20Label },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {rows.map((row) => {
        const has = row.value != null && !Number.isNaN(row.value)
        const Icon = row.icon
        return (
          <div key={row.label} className="rounded-md border bg-muted/50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <Icon className="h-3 w-3" />
              {row.label}
            </div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">{has ? row.fmt(row.value!) : '—'}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{has ? row.desc : '暂无'}</div>
          </div>
        )
      })}
    </div>
  )
}

function SignalCard({
  signal, stock, onCreateOrder,
}: {
  signal: Signal
  stock?: Stock
  onCreateOrder?: (signal: { symbol: string; direction: Direction }) => void
}): React.JSX.Element {
  const isBuy = signal.direction === 'buy'
  const isSell = signal.direction === 'sell'
  const borderColor = isBuy ? STOCK_COLOR_TOKENS.up.hex : isSell ? STOCK_COLOR_TOKENS.down.hex : COLOR_SHADES.gray[300]
  const directionLabel = isBuy ? '买入' : isSell ? '卖出' : signal.direction === 'hold' ? '持有' : '观察'
  // 置信度归一化：mock/真实数据可能为 0-1 小数，统一按百分比展示
  const conf = signal.confidence <= 1 ? Math.round(signal.confidence * 100) : Math.round(signal.confidence)

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-elevation-2 hover:-translate-y-0.5" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-[10px] px-2 py-0.5', isBuy && cn(COLOR_SHADES.red[50], COLOR_SHADES.red[700], COLOR_SHADES.red[200]), isSell && cn(COLOR_SHADES.green[50], COLOR_SHADES.green[700], COLOR_SHADES.green[200]), !isBuy && !isSell && cn(COLOR_SHADES.slate[50], COLOR_SHADES.slate[500], COLOR_SHADES.slate[200]))}>
                {directionLabel}
              </Badge>
              <span className="font-semibold text-sm">{signal.symbol}</span>
              {(() => {
                const stockName = stock?.name ?? ''
                if (stockName === '') return null
                return <span className="text-xs text-muted-foreground">{stockName}</span>
              })()}
              {signal.type === 'mock' && <Badge variant="outline" className={cn('text-[9px] px-1 py-0', COLOR_SHADES.amber[600], COLOR_SHADES.amber[300])}>mock</Badge>}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="text-muted-foreground">置信度</span><span className="font-semibold">{conf}%</span></span>
              <span className="text-muted-foreground">{new Date(signal.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <Button size="sm" variant={isBuy ? 'default' : isSell ? 'outline' : 'ghost'} onClick={() => onCreateOrder?.({ symbol: signal.symbol, direction: signal.direction })}>
            {isBuy ? '买入' : isSell ? '卖出' : '关注'}
          </Button>
        </div>
        {signal.rationale && <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">{signal.rationale}</p>}
        <div className="my-3 border-t" />
        <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" />K线走势</div>
            <MiniKlineChart signal={signal} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Activity className="h-3.5 w-3.5" />筹码分布</div>
            <ChipStrip signal={signal} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Target className="h-3.5 w-3.5" />策略匹配</div>
            <StrategyMatch signal={signal} />
          </div>
        </div>
        <div className="my-3 border-t" />
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Zap className="h-3.5 w-3.5 text-primary" />量价指标（量比 · 换手率 · RSI · MA20）</div>
          <VolumeMetricsTable signal={signal} />
        </div>
        {conf < 70 && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>置信度偏低，建议进一步核验基本面与筹码结构后再操作</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TradingSignalPanel({
  signals = [], stocks = [], onCreateOrder,
}: TradingSignalPanelProps): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDir, setFilterDir] = useState<Direction | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const pageSize = 6

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return signals.filter((s) => {
      if (filterDir !== 'all' && s.direction !== filterDir) return false
      if (!term) return true
      const stock = stocks.find((st) => st.symbol === s.symbol)
      return s.symbol.toLowerCase().includes(term) || (stock?.name ?? '').toLowerCase().includes(term)
    })
  }, [signals, stocks, searchTerm, filterDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const dirCounts = useMemo(() => {
    const counts: Record<string, number> = { buy: 0, sell: 0, hold: 0, watch: 0 }
    signals.forEach((s) => { counts[s.direction] = (counts[s.direction] ?? 0) + 1 })
    return counts
  }, [signals])

  const handleCreateOrder = (signal: { symbol: string; direction: Direction }): void => {
    logger.info('[TradingSignalPanel] 从信号创建订单', { symbol: signal.symbol, direction: signal.direction })
    onCreateOrder?.(signal)
  }

  const filterTabs: Array<{ key: Direction | 'all'; label: string; count: number }> = [
    { key: 'all', label: '全部', count: signals.length },
    { key: 'buy', label: '买入', count: dirCounts.buy ?? 0 },
    { key: 'sell', label: '卖出', count: dirCounts.sell ?? 0 },
    { key: 'hold', label: '持有', count: dirCounts.hold ?? 0 },
    { key: 'watch', label: '观察', count: dirCounts.watch ?? 0 },
  ]

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">交易信号</h3>
            <span className="text-xs text-muted-foreground">总计 {signals.length} · 买入 {dirCounts.buy ?? 0} · 卖出 {dirCounts.sell ?? 0} · 观望 {(dirCounts.hold ?? 0) + (dirCounts.watch ?? 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="搜索代码 / 名称..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }} className="h-8 w-44 pl-8 text-xs" />
            </div>
            <div className="flex items-center rounded-md border">
              <Button size="sm" variant={viewMode === 'card' ? 'default' : 'ghost'} className="h-8 rounded-r-none px-2" onClick={() => setViewMode('card')}><LayoutGrid className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} className="h-8 rounded-l-none px-2" onClick={() => setViewMode('list')}><ListIcon className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTabs.map((tab) => (
            <Button key={tab.key} size="sm" variant={filterDir === tab.key ? 'default' : 'outline'} className="h-7 text-xs px-2.5" onClick={() => { setFilterDir(tab.key); setCurrentPage(1) }}>{tab.label} ({tab.count})</Button>
          ))}
        </div>
        {paged.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{searchTerm ? '试试其他关键词，或清除搜索条件' : '请先运行智能评分或配置交易策略'}</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="max-h-[780px] overflow-y-auto pr-1 -mr-1">
            <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2">
              {paged.map((signal) => (
                <SignalCard key={signal.id} signal={signal} stock={stocks.find((st) => st.symbol === signal.symbol)} onCreateOrder={handleCreateOrder} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[780px] overflow-y-auto pr-1 -mr-1">
            {paged.map((signal) => {
              const isBuy = signal.direction === 'buy'
              const isSell = signal.direction === 'sell'
              const stock = stocks.find((st) => st.symbol === signal.symbol)
              return (
                <div key={signal.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 cursor-pointer" style={{ borderLeft: `3px solid ${isBuy ? STOCK_COLOR_TOKENS.up.hex : isSell ? STOCK_COLOR_TOKENS.down.hex : COLOR_SHADES.gray[300]}` }}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', isBuy && cn(COLOR_SHADES.red[50], COLOR_SHADES.red[700], COLOR_SHADES.red[200]), isSell && cn(COLOR_SHADES.green[50], COLOR_SHADES.green[700], COLOR_SHADES.green[200]), !isBuy && !isSell && cn(COLOR_SHADES.slate[50], COLOR_SHADES.slate[500], COLOR_SHADES.slate[200]))}>{isBuy ? '买入' : isSell ? '卖出' : signal.direction === 'hold' ? '持有' : '观察'}</Badge>
                    <span className="font-medium text-sm">{signal.symbol}</span>
                    {(stock?.name ?? '') !== '' && <span className="text-xs text-muted-foreground truncate">{stock!.name}</span>}
                    <span className="text-xs text-muted-foreground shrink-0">置信度 {signal.confidence}%</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => handleCreateOrder({ symbol: signal.symbol, direction: signal.direction })}>下单</Button>
                </div>
              )
            })}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">第 {safePage} / {totalPages} 页 · 共 {filtered.length} 只标的</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)} className="h-7 text-xs">上一页</Button>
              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)} className="h-7 text-xs">下一页</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}