import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  getWatchlistStocks,
  getOrders,
  createBuyOrder,
  createSellOrder,
  scanWatchingSignals,
  adviseForStock,
  type TradeAdvice,
} from '@/services/trading/tradingService'
import {
  buildStrategyFilteredPortfolio,
  computeHoldingsFromOrders,
} from '@/services/trading/portfolioBuilder'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { Order, Portfolio, Stock, StrategyResult } from '@/data/types'
import { useToast } from '@/hooks/useToast'
import { CoreResourcePanel } from './panels/CoreResourcePanel'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'

export default function TradingApp(): React.JSX.Element {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [signals, setSignals] = useState<TradingSignal[]>([])
  const [adviceMap, setAdviceMap] = useState<Record<string, TradeAdvice>>({})
  const [portfolio, setPortfolio] = useState<Portfolio | undefined>(undefined)
  const [strategyResult, setStrategyResult] = useState<StrategyResult | undefined>(undefined)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [processingSymbols, setProcessingSymbols] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const { toast } = useToast()

  const loadStocks = async (): Promise<void> => {
    const result = await getWatchlistStocks()
    if (result.success && result.data) {
      setStocks(result.data)
      const map: Record<string, TradeAdvice> = {}
      for (const stock of result.data) {
        const advice = await adviseForStock(stock)
        if (advice.success && advice.data) {
          map[stock.symbol] = advice.data
        }
      }
      setAdviceMap(map)
      setMessage('观察池与交易建议已更新')
    } else {
      setMessage(result.error ?? '加载观察池失败')
    }
  }

  const loadOrders = async (): Promise<void> => {
    const result = await getOrders()
    if (result.success && result.data) {
      setOrders(result.data)
    } else {
      setMessage(result.error ?? '加载订单失败')
    }
  }

  const scanSignals = async (): Promise<void> => {
    const result = await scanWatchingSignals()
    setSignals(result)
    setMessage(`扫描完成，共 ${result.length} 条信号`)
  }

  const loadPortfolio = async (): Promise<void> => {
    if (stocks.length === 0) {
      await loadStocks()
    }
    if (orders.length === 0) {
      await loadOrders()
    }

    setPortfolioLoading(true)
    try {
      const result = await buildStrategyFilteredPortfolio({
        theme: CORE_RESOURCE_THEME,
        stocks,
        currentHoldings: computeHoldingsFromOrders(orders),
      })
      setPortfolio(result.portfolio)
      setStrategyResult(result.strategyResult)
      setMessage(
        result.portfolio.holdings.length > 0
          ? `核心稀缺组合已构建，共 ${result.portfolio.holdings.length} 只标的`
          : '核心稀缺组合为空，无匹配标的或评分不足',
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '构建组合失败')
    } finally {
      setPortfolioLoading(false)
    }
  }

  const handleBuy = async (stock: Stock): Promise<void> => {
    if (processingSymbols.has(stock.symbol)) return
    setProcessingSymbols((prev) => new Set(prev).add(stock.symbol))
    try {
      const advice = adviceMap[stock.symbol]
      // 仅当建议为买入时使用建议仓位，否则使用默认 100 股（模拟盘兜底）
      const quantity = advice?.sizing?.action === 'buy' ? advice.sizing.targetShares : 100
      const result = await createBuyOrder(stock, quantity)

      if (result.success) {
        toast({ title: '买入成功', description: `已买入 ${stock.symbol} ${quantity} 股`, variant: 'success' })
        setMessage(`已买入 ${stock.symbol} ${quantity} 股`)
        await loadOrders()
      } else {
        toast({ title: '买入失败', description: result.error ?? '未知错误', variant: 'error' })
        setMessage(result.error ?? '买入失败')
      }
    } finally {
      setProcessingSymbols((prev) => {
        const next = new Set(prev)
        next.delete(stock.symbol)
        return next
      })
    }
  }

  const handleSell = async (stock: Stock): Promise<void> => {
    if (processingSymbols.has(stock.symbol)) return
    setProcessingSymbols((prev) => new Set(prev).add(stock.symbol))
    try {
      const advice = adviceMap[stock.symbol]
      // 卖出数量优先级：卖出建议的 targetShares > 当前持仓 > 默认 100 股
      // 避免在买入建议下误用买入目标仓位卖出
      const quantity =
        advice?.sizing?.action === 'sell'
          ? advice.sizing.targetShares
          : getHoldingShares(stock.symbol) || 100
      const result = await createSellOrder(stock, quantity)

      if (result.success) {
        toast({ title: '卖出成功', description: `已卖出 ${stock.symbol} ${quantity} 股`, variant: 'success' })
        setMessage(`已卖出 ${stock.symbol} ${quantity} 股`)
        await loadOrders()
      } else {
        toast({ title: '卖出失败', description: result.error ?? '未知错误', variant: 'error' })
        setMessage(result.error ?? '卖出失败')
      }
    } finally {
      setProcessingSymbols((prev) => {
        const next = new Set(prev)
        next.delete(stock.symbol)
        return next
      })
    }
  }

  const signalColor = (direction: string): string => {
    switch (direction) {
      case 'buy':
        return 'bg-green-100 text-green-800'
      case 'sell':
        return 'bg-red-100 text-red-800'
      case 'watch':
        return 'bg-yellow-100 text-yellow-800'
      case 'hold':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getHoldingShares = (symbol: string): number => {
    return orders
      .filter((o) => o.symbol === symbol)
      .reduce((sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity), 0)
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>交易舱 · 模拟盘</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={loadStocks}>
              加载观察池
            </Button>
            <Button variant="secondary" size="sm" onClick={loadOrders}>
              加载持仓
            </Button>
            <Button variant="secondary" size="sm" onClick={scanSignals}>
              扫描信号
            </Button>
            <Button variant="secondary" size="sm" onClick={loadPortfolio}>
              构建核心组合
            </Button>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <h3 className="text-sm font-semibold">观察池交易建议</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stocks.map((stock) => {
              const advice = adviceMap[stock.symbol]
              const signal = advice?.signal
              return (
                <div
                  key={stock.symbol}
                  className="rounded-md border p-3 hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{stock.symbol}</span>
                    <Badge>{stock.researchStatus}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{stock.name}</p>
                  {signal && (
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${signalColor(signal.direction)}`}>
                          {signal.direction.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground">{signal.type}</span>
                        <span>置信 {(signal.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-muted-foreground">{signal.rationale}</p>
                      {advice.sizing && advice.sizing.action !== 'hold' && (
                        <p>
                          建议：{advice.sizing.action} {advice.sizing.targetShares} 股
                          （仓位 {(advice.sizing.positionPct * 100).toFixed(1)}%）
                        </p>
                      )}
                      {advice.risk && !advice.risk.ok && (
                        <p className="text-red-600">
                          风控阻塞：{advice.risk.blocks.join('；')}
                        </p>
                      )}
                      {advice.risk && advice.risk.ok && advice.risk.warnings.length > 0 && (
                        <p className="text-yellow-600">
                          风控提示：{advice.risk.warnings.join('；')}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => handleBuy(stock)} disabled={processingSymbols.has(stock.symbol)}>
                      {processingSymbols.has(stock.symbol) ? '执行中...' : '买入'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleSell(stock)} disabled={processingSymbols.has(stock.symbol)}>
                      {processingSymbols.has(stock.symbol) ? '执行中...' : '卖出'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <CoreResourcePanel
            portfolio={portfolio}
            strategyResult={strategyResult}
            loading={portfolioLoading}
            onRefresh={loadPortfolio}
          />

          {signals.length > 0 && (
            <>
              <h3 className="text-sm font-semibold">全部信号 ({signals.length})</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {signals.map((signal) => (
                  <div key={signal.id} className="rounded-md border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{signal.symbol}</span>
                      <span className={`rounded px-1.5 py-0.5 font-medium ${signalColor(signal.direction)}`}>
                        {signal.direction.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{signal.rationale}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="text-sm font-semibold">持仓订单</h3>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span>
                  {order.symbol} · {order.direction} · {order.quantity}股
                </span>
                <Badge variant="outline">{order.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
