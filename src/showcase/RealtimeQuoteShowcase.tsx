/**
 * @fileoverview 通用实时行情展示组件
 * 支持股票选择器，展示实时行情与K线数据
 *
 * @module showcase/RealtimeQuoteShowcase
 */

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Clock,
  LineChart,
} from 'lucide-react'
import { useRealtimeQuote } from '@/hooks/useRealtimeQuote'
import { useKline, type KlinePeriod } from '@/hooks/useKline'
import { cn } from '@/lib/utils'
import { getStockColorHex } from '@/constants/theme.tokens'
import { getStockBySymbol, type StockOption } from '@/constants/stockList'
import { StockSelector } from '@/components/organisms/input/StockSelector'
import { getLogger } from '@/lib/logger'

const logger = getLogger()
const LOG_PREFIX = '[RealtimeQuoteShowcase]'

// ============================================================
// 常量
// ============================================================

const DEFAULT_SYMBOL = '600519'
const REFRESH_INTERVAL = 30_000 // 30秒
const RECENT_KLINE_COUNT = 10
const KLINE_PERIODS: { value: KlinePeriod; label: string }[] = [
  { value: 'daily', label: '日K' },
  { value: 'weekly', label: '周K' },
  { value: 'monthly', label: '月K' },
  { value: '5min', label: '5分' },
  { value: '15min', label: '15分' },
  { value: '60min', label: '60分' },
]

// ============================================================
// 组件
// ============================================================

/**
 * 通用实时行情展示组件
 *
 * 支持股票选择器，展示实时行情与K线数据。
 */
export function RealtimeQuoteShowcase(): React.JSX.Element {
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL)

  // 日志：组件初始化
  useEffect(() => {
    logger.info(`${LOG_PREFIX} 组件初始化`, { defaultSymbol: DEFAULT_SYMBOL })
  }, [])

  // 日志：股票切换
  useEffect(() => {
    const stock = getStockBySymbol(selectedSymbol)
    logger.info(`${LOG_PREFIX} 股票已切换`, {
      symbol: selectedSymbol,
      name: stock?.name ?? '未知',
      market: stock?.market,
    })
  }, [selectedSymbol])

  const {
    data: quoteData,
    loading: quoteLoading,
    error: quoteError,
    secondsSinceUpdate,
    isStale,
    refresh: refreshQuote,
  } = useRealtimeQuote({
    symbol: selectedSymbol,
    refreshIntervalMs: REFRESH_INTERVAL,
  })

  const {
    data: klineData,
    loading: klineLoading,
    error: klineError,
    period,
    setPeriod,
    refresh: refreshKline,
  } = useKline({
    symbol: selectedSymbol,
    period: 'daily',
    count: 30,
    refreshIntervalMs: 60_000,
  })

  // 日志：行情数据加载状态
  useEffect(() => {
    if (quoteError) {
      logger.error(`${LOG_PREFIX} 行情数据加载失败`, {
        symbol: selectedSymbol,
        error: quoteError,
      })
    } else if (quoteData) {
      logger.debug(`${LOG_PREFIX} 行情数据加载成功`, {
        symbol: selectedSymbol,
        price: quoteData.price,
        pe: quoteData.pe,
        pb: quoteData.pb,
      })
    }
  }, [quoteData, quoteError, selectedSymbol])

  // 日志：K线数据加载状态
  useEffect(() => {
    if (klineError) {
      logger.error(`${LOG_PREFIX} K线数据加载失败`, {
        symbol: selectedSymbol,
        error: klineError,
      })
    } else if (klineData) {
      logger.debug(`${LOG_PREFIX} K线数据加载成功`, {
        symbol: selectedSymbol,
        barCount: klineData.history.length,
      })
    }
  }, [klineData, klineError, selectedSymbol])

  // 日志：数据新鲜度
  useEffect(() => {
    if (isStale) {
      logger.warn(`${LOG_PREFIX} 数据已过期`, {
        symbol: selectedSymbol,
        secondsSinceUpdate,
      })
    }
  }, [isStale, secondsSinceUpdate, selectedSymbol])

  // 计算涨跌
  const price = quoteData?.price ?? null
  const klineBars = klineData?.history ?? []
  const prevClose = klineBars.length > 1 ? klineBars[klineBars.length - 2]?.close ?? null : null

  let changePercent = 0
  let currentColor = getStockColorHex(0)

  if (price && prevClose) {
    changePercent = ((price - prevClose) / prevClose) * 100
    currentColor = getStockColorHex(changePercent)
  }

  const TrendIcon = changePercent > 0 ? TrendingUp : changePercent < 0 ? TrendingDown : Minus

  const formatUpdateTime = (seconds: number): string => {
    if (seconds === 0) return '刚更新'
    if (seconds < 60) return `${seconds}秒前`
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins}分钟前`
    return `${Math.floor(mins / 60)}小时前`
  }

  const klineStats = (() => {
    if (klineBars.length === 0) return null
    const highs = klineBars.map(b => b.high)
    const lows = klineBars.map(b => b.low)
    const firstBar = klineBars[0]!
    const lastBar = klineBars[klineBars.length - 1]!
    return {
      open: firstBar.open,
      close: lastBar.close,
      high: Math.max(...highs),
      low: Math.min(...lows),
    }
  })()

  const handleSelectStock = (stock: StockOption) => {
    logger.info(`${LOG_PREFIX} 用户选择股票`, {
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
    })
    setSelectedSymbol(stock.symbol)
  }

  const handleManualRefresh = () => {
    logger.info(`${LOG_PREFIX} 用户手动刷新`, { symbol: selectedSymbol })
    void refreshQuote()
    void refreshKline()
  }

  return (
    <div className="space-y-4">
      {/* 股票选择器 */}
      <StockSelector
        value={selectedSymbol}
        onChange={handleSelectStock}
        maxDisplayCount={20}
      />

      {/* 状态栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatUpdateTime(secondsSinceUpdate)}</span>
          </div>
          {isStale && (
            <span className={cn('rounded px-1.5 py-0.5 text-xs', 'bg-yellow-500/20 text-yellow-500')}>
              数据延迟
            </span>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={quoteLoading || klineLoading}
          className={cn(
            'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
            'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
            'disabled:opacity-50',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', quoteLoading && 'animate-spin')} />
          <span>刷新</span>
        </button>
      </div>

      {/* 错误提示 */}
      {(quoteError ?? klineError) && (
        <div
          className={cn(
            'rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive',
          )}
        >
          {quoteError ?? klineError}
        </div>
      )}

      {/* 行情卡片 */}
      <div className={cn('rounded-xl border p-4', 'border-border bg-background')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 当前价格 */}
          <div>
            <div className={cn('text-xs', 'text-muted-foreground')}>当前价</div>
            {quoteLoading && !price ? (
              <div className={cn('mt-1 h-8 w-24 animate-pulse rounded', 'bg-muted')} />
            ) : price ? (
              <div className="flex items-center gap-2">
                <span className={cn('text-h1 font-bold tabular-nums')} style={{ color: currentColor }}>
                  ¥{price.toFixed(2)}
                </span>
                <TrendIcon className="h-4 w-4" style={{ color: currentColor }} />
              </div>
            ) : (
              <div className={cn('mt-1 text-h2 font-bold', 'text-muted-foreground')}>--</div>
            )}
          </div>

          {/* 涨跌幅 */}
          <div>
            <div className={cn('text-xs', 'text-muted-foreground')}>涨跌幅</div>
            {quoteLoading && !price ? (
              <div className={cn('mt-1 h-8 w-20 animate-pulse rounded', 'bg-muted')} />
            ) : price ? (
              <div className={cn('text-h2 font-semibold tabular-nums')} style={{ color: currentColor }}>
                {changePercent > 0 ? '+' : ''}
                {changePercent.toFixed(2)}%
              </div>
            ) : (
              <div className={cn('mt-1 text-h2 font-semibold', 'text-muted-foreground')}>--</div>
            )}
          </div>

          {/* PE */}
          <div>
            <div className={cn('text-xs', 'text-muted-foreground')}>市盈率(PE)</div>
            {quoteLoading ? (
              <div className={cn('mt-1 h-8 w-20 animate-pulse rounded', 'bg-muted')} />
            ) : quoteData?.pe != null ? (
              <div className={cn('mt-1 text-lg font-semibold tabular-nums', 'text-foreground')}>
                {quoteData.pe.toFixed(2)}
              </div>
            ) : (
              <div className={cn('mt-1 text-lg', 'text-muted-foreground')}>--</div>
            )}
          </div>

          {/* PB */}
          <div>
            <div className={cn('text-xs', 'text-muted-foreground')}>市净率(PB)</div>
            {quoteLoading ? (
              <div className={cn('mt-1 h-8 w-20 animate-pulse rounded', 'bg-muted')} />
            ) : quoteData?.pb != null ? (
              <div className={cn('mt-1 text-lg font-semibold tabular-nums', 'text-foreground')}>
                {quoteData.pb.toFixed(2)}
              </div>
            ) : (
              <div className={cn('mt-1 text-lg', 'text-muted-foreground')}>--</div>
            )}
          </div>
        </div>

        {/* K线统计 */}
        {klineStats && (
          <div className={cn('mt-4 grid grid-cols-2 md:grid-cols-4 gap-2', 'border-t pt-3', 'border-border')}>
            <KStatItem label="开盘" value={klineStats.open.toFixed(2)} />
            <KStatItem label="收盘" value={klineStats.close.toFixed(2)} color={currentColor} />
            <KStatItem label="最高" value={klineStats.high.toFixed(2)} color={getStockColorHex(1)} />
            <KStatItem label="最低" value={klineStats.low.toFixed(2)} color={getStockColorHex(-1)} />
          </div>
        )}
      </div>

      {/* K线周期切换 */}
      <div className="flex items-center gap-2">
        <LineChart className={cn('h-4 w-4', 'text-muted-foreground')} />
        <span className={cn('text-sm', 'text-muted-foreground')}>周期</span>
        <div className="flex gap-1">
          {KLINE_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* K线列表 */}
      <div className={cn('rounded-xl border', 'border-border')}>
        <div className={cn('flex items-center justify-between px-4 py-2', 'border-b border-border')}>
          <span className={cn('text-sm font-medium', 'text-foreground')}>
            {KLINE_PERIODS.find((p) => p.value === period)?.label}K线
          </span>
          <span className={cn('text-xs', 'text-muted-foreground')}>共 {klineBars.length} 根</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn('text-xs', 'text-muted-foreground')}>
                <th className="px-4 py-2 text-left font-medium">日期</th>
                <th className="px-4 py-2 text-right font-medium">开盘</th>
                <th className="px-4 py-2 text-right font-medium">最高</th>
                <th className="px-4 py-2 text-right font-medium">最低</th>
                <th className="px-4 py-2 text-right font-medium">收盘</th>
                <th className="px-4 py-2 text-right font-medium">成交量</th>
              </tr>
            </thead>
            <tbody>
              {klineLoading && klineBars.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : klineBars.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                klineBars
                  .slice(-RECENT_KLINE_COUNT)
                  .reverse()
                  .map((bar, idx) => {
                    const prevBar = klineBars[klineBars.length - (RECENT_KLINE_COUNT + 1) - idx]
                    const barChange = prevBar ? ((bar.close - prevBar.close) / prevBar.close) * 100 : 0
                    const barColor = getStockColorHex(barChange)
                    return (
                      <tr key={bar.date} className={cn('border-t', 'border-border')}>
                        <td className="px-4 py-2 tabular-nums text-foreground">{bar.date}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-foreground">
                          {bar.open.toFixed(2)}
                        </td>
                        <td
                          className="px-4 py-2 text-right tabular-nums"
                          style={{ color: getStockColorHex(1) }}
                        >
                          {bar.high.toFixed(2)}
                        </td>
                        <td
                          className="px-4 py-2 text-right tabular-nums"
                          style={{ color: getStockColorHex(-1) }}
                        >
                          {bar.low.toFixed(2)}
                        </td>
                        <td
                          className="px-4 py-2 text-right tabular-nums font-medium"
                          style={{ color: barColor }}
                        >
                          {bar.close.toFixed(2)}
                        </td>
                        <td className={cn('px-4 py-2 text-right tabular-nums', 'text-muted-foreground')}>
                          {(bar.volume / 10000).toFixed(1)}万
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 辅助组件
// ============================================================

function KStatItem(props: { label: string; value: string; color?: string }): React.JSX.Element {
  const { label, value, color } = props
  return (
    <div>
      <div className={cn('text-xs', 'text-muted-foreground')}>{label}</div>
      <div
        className={cn('mt-0.5 text-sm font-semibold tabular-nums')}
        style={{ color: color ?? 'inherit' }}
      >
        {value}
      </div>
    </div>
  )
}
