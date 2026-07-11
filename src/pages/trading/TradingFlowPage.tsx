/**
 * 交易流程页面
 * 整合信号、订单、持仓、风控四个区域
 */
import React, { useState, useEffect } from 'react'
import { TradingSignalPanel } from '@/components/organisms/trading/TradingSignalPanel'
import { OrderExecutionPanel } from '@/components/organisms/trading/OrderExecutionPanel'
import { RiskControlPanel } from '@/components/organisms/trading/RiskControlPanel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { useTradingStore, initTradingStoreFacadeSync } from '@/store/tradingStore'
import { useOrderStore } from '@/store/orderStore'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { DataCollectionWizard } from '@/components/organisms/input/DataCollectionWizard'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import type { MockTradingData } from '@/services/trading/mockDataGenerator'
import { Database } from 'lucide-react'

const logger = getLogger()

/** 是否使用模拟数据（开发环境） */
const USE_MOCK_DATA = import.meta.env.DEV

/**
 * TradingFlowPage
 */
export default function TradingFlowPage(): React.JSX.Element {
  // 从 tradingStore 获取状态
  const stocks = useTradingStore((s) => s.stocks)
  const orders = useTradingStore((s) => s.orders)
  const signals = useTradingStore((s) => s.signals)
  const message = useTradingStore((s) => s.message)
  
  const loadStocks = useTradingStore((s) => s.loadStocks)
  const loadOrders = useTradingStore((s) => s.loadOrders)
  const scanSignals = useTradingStore((s) => s.scanSignals)

  // 数据采集向导
  const openWizard = useCollectionWizardStore((s) => s.openWizard)

  // 风控规则状态
  const [, setRiskRules] = useState({
    stopLossPercent: 10,
    takeProfitPercent: 20,
  })

  // 风险预警
  const [riskAlerts, setRiskAlerts] = useState<string[]>([])

  // 模拟数据状态
  const [mockData, setMockData] = useState<MockTradingData | null>(null)

  // 通过 MCP 生成模拟交易数据（页面层不直接调用 service）
  useEffect(() => {
    if (!USE_MOCK_DATA) return
    let cancelled = false
    mcpBridge
      .callTool('trading', 'generate_mock_trading_data', {})
      .then((result) => {
        if (cancelled || result.isError) return
        const text = result.content[0]?.text
        if (!text) return
        try {
          const data = JSON.parse(text) as MockTradingData
          setMockData(data)
          setRiskAlerts(data.riskMetrics.alerts.map((a) => a.message))
          logger.info('[TradingFlowPage] 使用模拟数据', {
            timestamp: new Date().toISOString(),
            mockDataSummary: {
              signalsCount: data.signals.length,
              ordersCount: data.orders.length,
              positionsCount: data.positions.length,
              riskAlertsCount: data.riskMetrics.alerts.length,
            },
          })
        } catch {
          logger.warn('[TradingFlowPage] 模拟交易数据 JSON 解析失败', { text })
        }
      })
      .catch((err) => {
        logger.warn('[TradingFlowPage] 调用 generate_mock_trading_data 失败', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 初始化 Facade 同步（确保子 Store 数据能同步到 Facade）
  useEffect(() => {
    const timestamp = new Date().toISOString()
    logger.info('[TradingFlowPage] 初始化 Facade 同步', {
      timestamp,
      useMockData: USE_MOCK_DATA,
      environment: import.meta.env.MODE,
    })
    const cleanup = initTradingStoreFacadeSync()
    return () => {
      logger.info('[TradingFlowPage] 清理 Facade 同步', { timestamp: new Date().toISOString() })
      cleanup()
    }
  }, [])

  // 初始化加载数据
  useEffect(() => {
    const timestamp = new Date().toISOString()
    logger.info('[TradingFlowPage] 开始加载数据', {
      timestamp,
      initialState: {
        stocksCount: stocks.length,
        ordersCount: orders.length,
        signalsCount: signals.length,
      },
      useMockData: USE_MOCK_DATA,
    })

    void loadStocks().then(() => {
      logger.info('[TradingFlowPage] loadStocks 完成', {
        timestamp: new Date().toISOString(),
        stocksCount: stocks.length,
      })
    }).catch((err) => {
      logger.error('[TradingFlowPage] loadStocks 失败', {
        timestamp: new Date().toISOString(),
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    })
    
    void loadOrders().then(() => {
      logger.info('[TradingFlowPage] loadOrders 完成', {
        timestamp: new Date().toISOString(),
        ordersCount: orders.length,
      })
    }).catch((err) => {
      logger.error('[TradingFlowPage] loadOrders 失败', {
        timestamp: new Date().toISOString(),
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    })
    
    void scanSignals().then(() => {
      logger.info('[TradingFlowPage] scanSignals 完成', {
        timestamp: new Date().toISOString(),
        signalsCount: signals?.length ?? 0,
      })
    }).catch((err) => {
      logger.error('[TradingFlowPage] scanSignals 失败', {
        timestamp: new Date().toISOString(),
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    })
  }, [loadStocks, loadOrders, scanSignals]) // eslint-disable-line react-hooks/exhaustive-deps

  // 监听数据变化
  useEffect(() => {
    logger.info('[TradingFlowPage] 数据状态更新', {
      timestamp: new Date().toISOString(),
      stocksCount: stocks.length,
      ordersCount: orders.length,
      signalsCount: signals.length,
      message,
      riskAlertsCount: riskAlerts.length,
    })
  }, [stocks.length, orders.length, signals.length, message, riskAlerts.length])

  // 从信号创建订单
  const handleCreateOrderFromSignal = async (signal: { symbol: string; action: string }): Promise<void> => {
    const timestamp = new Date().toISOString()
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    logger.info('[TradingFlowPage] 从信号创建订单 - 开始', {
      timestamp,
      traceId,
      operation: 'CREATE_ORDER_FROM_SIGNAL',
      signalData: {
        symbol: signal.symbol,
        action: signal.action,
      },
    })
    
    const direction: 'buy' | 'sell' = signal.action === 'buy' ? 'buy' : 'sell'
    const orderData = {
      symbol: signal.symbol,
      direction: direction,
      quantity: 100, // 默认数量，实际应从信号中获取
      price: 0, // 市价单，实际价格由市场决定
      amount: 0,
      status: 'pending' as const,
      accountType: 'paper' as const,
    }
    
    logger.info('[TradingFlowPage] 从信号创建订单 - 准备提交', {
      timestamp: new Date().toISOString(),
      traceId,
      operation: 'CREATE_ORDER_FROM_SIGNAL',
      beforeState: null,
      afterState: orderData,
      parameters: {
        signalSymbol: signal.symbol,
        signalAction: signal.action,
        calculatedDirection: direction,
      },
    })
    
    const result = await useOrderStore.getState().addOrder(orderData)
    
    if (result.success) {
      logger.info('[TradingFlowPage] 从信号创建订单 - 成功', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER_FROM_SIGNAL',
        statusCode: 200,
        orderId: result.data?.id,
        orderData: result.data,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
      await loadOrders()
    } else {
      logger.error('[TradingFlowPage] 从信号创建订单 - 失败', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER_FROM_SIGNAL',
        statusCode: 500,
        errorCode: result.error,
        errorMessage: result.error,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
    }
  }

  // 创建订单
  const handleCreateOrder = async (orderForm: {
    symbol: string
    side: string
    quantity: number
    price: number
    type: string
  }): Promise<void> => {
    const timestamp = new Date().toISOString()
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    logger.info('[TradingFlowPage] 创建订单 - 开始', {
      timestamp,
      traceId,
      operation: 'CREATE_ORDER',
      formData: orderForm,
    })
    
    const orderData = {
      symbol: orderForm.symbol,
      direction: orderForm.side as 'buy' | 'sell',
      quantity: orderForm.quantity,
      price: orderForm.price,
      amount: orderForm.quantity * orderForm.price,
      status: 'pending' as const,
      accountType: 'paper' as const,
    }
    
    logger.info('[TradingFlowPage] 创建订单 - 准备提交', {
      timestamp: new Date().toISOString(),
      traceId,
      operation: 'CREATE_ORDER',
      beforeState: null,
      afterState: orderData,
      parameters: {
        symbol: orderForm.symbol,
        direction: orderForm.side,
        quantity: orderForm.quantity,
        price: orderForm.price,
        calculatedAmount: orderData.amount,
        orderType: orderForm.type,
      },
    })
    
    const result = await useOrderStore.getState().addOrder(orderData)
    
    if (result.success) {
      logger.info('[TradingFlowPage] 创建订单 - 成功', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER',
        statusCode: 200,
        orderId: result.data?.id,
        orderData: result.data,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
      await loadOrders()
    } else {
      logger.error('[TradingFlowPage] 创建订单 - 失败', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER',
        statusCode: 500,
        errorCode: result.error,
        errorMessage: result.error,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
    }
  }

  // 取消订单
  const handleCancelOrder = async (orderId: string): Promise<void> => {
    const timestamp = new Date().toISOString()
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // 查找原始订单数据
    const originalOrder = orders.find(o => o.id === orderId)
    
    logger.info('[TradingFlowPage] 取消订单 - 开始', {
      timestamp,
      traceId,
      operation: 'CANCEL_ORDER',
      orderId,
      originalOrder: originalOrder ? {
        id: originalOrder.id,
        symbol: originalOrder.symbol,
        direction: originalOrder.direction,
        quantity: originalOrder.quantity,
        price: originalOrder.price,
        status: originalOrder.status,
      } : null,
    })
    
    const beforeState = originalOrder ? { status: originalOrder.status } : null
    const afterState = { status: 'cancelled' as const }
    
    logger.info('[TradingFlowPage] 取消订单 - 准备提交', {
      timestamp: new Date().toISOString(),
      traceId,
      operation: 'CANCEL_ORDER',
      beforeState,
      afterState,
      parameters: {
        orderId,
        statusChange: 'pending -> cancelled',
      },
    })
    
    const result = await useOrderStore.getState().updateOrder(orderId, {
      status: 'cancelled',
    })
    
    if (result.success) {
      logger.info('[TradingFlowPage] 取消订单 - 成功', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CANCEL_ORDER',
        statusCode: 200,
        orderId,
        dataChange: {
          before: beforeState,
          after: afterState,
        },
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
      await loadOrders()
    } else {
      logger.error('[TradingFlowPage] 取消订单 - 失败', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CANCEL_ORDER',
        statusCode: 500,
        errorCode: result.error,
        errorMessage: result.error,
        orderId,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
    }
  }

  // 更新风控规则
  const handleUpdateRiskRules = (rules: { stopLossPercent: number; takeProfitPercent: number }): void => {
    const timestamp = new Date().toISOString()
    logger.info('[TradingFlowPage] 更新风控规则 - 开始', {
      timestamp,
      operation: 'UPDATE_RISK_RULES',
      afterState: rules,
    })
    setRiskRules(rules)
    logger.info('[TradingFlowPage] 更新风控规则 - 成功', {
      timestamp: new Date().toISOString(),
      operation: 'UPDATE_RISK_RULES',
      statusCode: 200,
    })
    // TODO: 实现风控规则持久化逻辑
  }

  // 数据源选择：开发环境使用模拟数据，生产环境使用真实数据
  const displaySignals = USE_MOCK_DATA && mockData
    ? mockData.signals.map(s => {
        const stock = stocks.find(st => st.symbol === s.symbol)
        return {
          id: s.id,
          symbol: s.symbol,
          name: stock?.name ?? s.symbol,
          direction: s.direction,
          confidence: s.confidence,
          rationale: s.rationale,
        }
      })
    : signals

  const displayOrders = USE_MOCK_DATA && mockData
    ? mockData.orders
    : orders

  // 持仓数据计算
  const positions = USE_MOCK_DATA && mockData
    ? mockData.positions.map(p => ({
        symbol: p.symbol,
        name: p.name,
        quantity: p.quantity,
        costPrice: p.avgCost,
        currentPrice: p.currentPrice,
        pnl: p.unrealizedPnl,
        pnlPercent: p.unrealizedPnlPercent,
      }))
    : displayOrders
        .filter((o) => o.status === 'filled')
        .reduce((acc, order) => {
          const existing = acc.find((p) => p.symbol === order.symbol)
          if (existing) {
            existing.quantity += order.direction === 'buy' ? order.quantity : -order.quantity
          } else {
            acc.push({
              symbol: order.symbol,
              name: stocks.find((st) => st.symbol === order.symbol)?.name ?? order.symbol,
              quantity: order.direction === 'buy' ? order.quantity : -order.quantity,
              costPrice: order.price,
              currentPrice: order.price,
              pnl: 0,
              pnlPercent: 0,
            })
          }
          return acc
        }, [] as Array<{
          symbol: string
          name: string
          quantity: number
          costPrice: number
          currentPrice: number
          pnl: number
          pnlPercent: number
        }>)
        .filter((p) => p.quantity > 0)

  // 风控指标
  const riskMetrics = USE_MOCK_DATA && mockData
    ? {
        var: mockData.riskMetrics.var95,
        maxDrawdown: mockData.riskMetrics.maxDrawdown,
        sharpeRatio: mockData.riskMetrics.sharpeRatio,
      }
    : {
        var: 2.5,
        maxDrawdown: 15.3,
        sharpeRatio: 1.2,
      }

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">交易流程</h1>
          <p className="text-muted-foreground mt-2">
            完整的交易流程管理：信号生成 → 订单执行 → 持仓管理 → 风险控制
          </p>
        </div>
        <Button onClick={openWizard} variant="outline">
          <Database className="mr-2 h-4 w-4" />
          数据采集
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">交易信号</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displaySignals.length}</div>
            <p className="text-xs text-muted-foreground">
              {displaySignals.filter((s) => s.direction === 'buy').length} 买入 / {displaySignals.filter((s) => s.direction === 'sell').length} 卖出
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">待执行订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {displayOrders.filter((o) => o.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {displayOrders.length} 个订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">持仓数量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positions.length}</div>
            <p className="text-xs text-muted-foreground">
              观察池 {stocks.length} 只
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">风险预警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {riskAlerts.length === 0 ? '无预警' : '需要关注'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 四区域布局 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：交易信号 */}
        <TradingSignalPanel
          signals={displaySignals.map((s) => ({
            id: s.id,
            symbol: s.symbol,
            name: stocks.find((st) => st.symbol === s.symbol)?.name ?? s.symbol,
            action: s.direction as 'buy' | 'sell' | 'hold',
            strength: Math.round(s.confidence * 100),
            targetPrice: 0, // TODO: 从信号获取目标价
            generatedAt: Date.now(),
            reason: s.rationale,
          }))}
          onCreateOrder={handleCreateOrderFromSignal}
        />

        {/* 左侧：订单执行 */}
        <OrderExecutionPanel
          orders={displayOrders.map((o) => ({
            id: o.id.toString(),
            symbol: o.symbol,
            side: o.direction,
            quantity: o.quantity,
            price: o.price,
            type: 'limit', // TODO: 从订单获取类型
            status: o.status,
            createdAt: o.createdAt,
          }))}
          onCreateOrder={handleCreateOrder}
          onCancelOrder={handleCancelOrder}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 右侧：持仓管理 */}
        <Card>
          <CardHeader>
            <CardTitle>持仓管理</CardTitle>
            <CardDescription>当前持仓与盈亏分析</CardDescription>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无持仓</p>
                <p className="text-sm mt-2">请先执行交易订单</p>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((position) => (
                  <div
                    key={position.symbol}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{position.symbol}</span>
                        <span className="text-sm text-muted-foreground">{position.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {position.quantity}股 @ {position.costPrice}元
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={position.pnl >= 0 ? COLOR_TOKENS.up.tailwind : COLOR_TOKENS.down.tailwind}>
                        {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右侧：风险控制 */}
        <RiskControlPanel
          riskMetrics={riskMetrics}
          riskAlerts={riskAlerts}
          onUpdateRules={handleUpdateRiskRules}
        />
      </div>

      {message && (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      {/* 数据采集向导 */}
      <DataCollectionWizard />
    </div>
  )
}
