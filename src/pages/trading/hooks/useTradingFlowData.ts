/**
 * TradingFlowPage 数据获取与处理逻辑
 * 从 TradingFlowPage.tsx 提取
 * 封装：store 选取、mock 数据生成、Facade 同步、初始加载、数据监听、
 * 订单/风控操作处理、派生数据计算
 */
import { useState, useEffect } from 'react'
import { useTradingStore, initTradingStoreFacadeSync } from '@/store/tradingStore'
import { useOrderStore } from '@/store/orderStore'
import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import type { MockTradingData } from '@/types/modules/pool.types'
import type { TradingPosition, RiskRules, CreateOrderForm, SignalOrderInput } from '../tradingFlow.types'

const logger = getLogger()

/** localStorage 存储键名：风控规则持久化 */
const RISK_RULES_STORAGE_KEY = 'finsight_risk_rules'

/** 默认风控规则 */
const DEFAULT_RISK_RULES: RiskRules = {
  stopLossPercent: 10,
  takeProfitPercent: 20,
}

/** Seeded random constants (LCG-based pseudo-random for deterministic mock data) */
const HASH_MULTIPLIER = 31
const LCG_MULTIPLIER = 1103515245
const LCG_INCREMENT = 12345
const LCG_MODULUS = 0xffffffff
const MOCK_VOLUME_RATIO_RANGE = 3.2
const MOCK_PRICE_TO_MA20_RANGE = 18
const MACD_RED_THRESHOLD = 0.42
const MACD_GREEN_THRESHOLD = 0.84
const FALLBACK_VOLUME_RATIO = 1.23
const FALLBACK_PRICE_TO_MA20 = 2.4
const FALLBACK_TURN_RATE = 1.85

/** DEV 环境使用 Mock 交易数据（生产构建时 tree-shaken 移除）。真实数据通过 MCP trading tools 接入。 */
export const USE_MOCK_DATA = import.meta.env.DEV

/**
 * 交易流程数据 Hook
 */
export function useTradingFlowData() {
  // 从 tradingStore 获取状态
  const stocks = useTradingStore((s) => s.stocks)
  const orders = useTradingStore((s) => s.orders)
  const signals = useTradingStore((s) => s.signals)
  const message = useTradingStore((s) => s.message)

  const loadStocks = useTradingStore((s) => s.loadStocks)
  const loadOrders = useTradingStore((s) => s.loadOrders)
  const scanSignals = useTradingStore((s) => s.scanSignals)

  // 风控规则状态（初始化时从 localStorage 恢复）
  const [riskRules, setRiskRules] = useState<RiskRules>(() => {
    try {
      const saved = localStorage.getItem(RISK_RULES_STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_RISK_RULES
    } catch {
      return DEFAULT_RISK_RULES
    }
  })

  // 风险预警
  const [riskAlerts, setRiskAlerts] = useState<string[]>([])

  // 模拟数据状态
  const [mockData, setMockData] = useState<MockTradingData | null>(null)

  // 通过 MCP 生成模拟交易数据（页面层不直接调用 service）
  // 为 Mock 数据补齐 SignalSnapshot 核心指标（量比/RSI/MA20/MACD/K线模式/换手率），
  // 保证开发模式下量价指标表格不空。真实生产数据由 MCP trading tools 采集后通过
  // initTradingStoreFacadeSync() 推到 tradingStore，此处不参与。
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
          // ——— snapshot 指标派生（基于 symbol 确定性种子，避免每次刷新跳动）———
          const enrichedSignals = data.signals.map((s) => {
            let seed = 0
            for (let i = 0; i < s.symbol.length; i++) seed = (seed * HASH_MULTIPLIER + s.symbol.charCodeAt(i)) >>> 0
            const rand = (): number => {
              seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) >>> 0
              return seed / LCG_MODULUS
            }
            const volumeRatio = +(0.4 + rand() * MOCK_VOLUME_RATIO_RANGE).toFixed(2)
            const rsi14 = Math.round(15 + rand() * 75)
            const priceToMA20 = +((rand() - 0.4) * MOCK_PRICE_TO_MA20_RANGE).toFixed(2)
            const macdDirRand = rand()
            const macdDirection =
              macdDirRand < MACD_RED_THRESHOLD ? 'red' : macdDirRand < MACD_GREEN_THRESHOLD ? 'green' : 'neutral'
            const turnRate = +(0.3 + rand() * 12).toFixed(2)
            const patterns = [
              '双底反弹', '放量突破', '均线金叉', '顶部背离',
              '缩量回调', '箱体震荡', '死叉确认', '上升三角形',
            ]
            const klinePattern = patterns[Math.floor(rand() * patterns.length)]
            return {
              ...s,
              snapshot: {
                ...s.snapshot,
                volumeRatio,
                rsi14,
                priceToMA20,
                macdDirection,
                turnRate,
                klinePattern,
              } as const,
            }
          })
          const enriched: MockTradingData = { ...data, signals: enrichedSignals }
          setMockData(enriched)
          setRiskAlerts(data.riskMetrics.alerts.map((a) => a.message))
          // DEV 下将 mock 订单同步到 orderStore，使复盘页（读真实 orders）与交易舱共用同一数据源
          // 注意：OrderState 没有 seedOrders 方法，此处仅为注释说明，实际不执行
          // if (data.orders && data.orders.length > 0) {
          //   void useOrderStore.getState().seedOrders(data.orders)
          // }
          logger.info('[TradingFlowPage] 使用模拟数据（已补齐量价指标）', {
            timestamp: new Date().toISOString(),
            mockDataSummary: {
              signalsCount: enriched.signals.length,
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
        signalsCount: signals.length,
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

  // 统一处理下单/撤单结果：单一 success 分支判断，避免重复条件
  const reportOrderOutcome = async (
    result: { success: boolean },
    onSuccess: () => Promise<void> | void,
    successLog: () => void,
    failureLog: () => void,
  ): Promise<void> => {
    if (result.success) {
      successLog()
      await onSuccess()
    } else {
      failureLog()
    }
  }

  // 从信号创建订单
  const handleCreateOrderFromSignal = async (signal: SignalOrderInput): Promise<void> => {
    const timestamp = new Date().toISOString()
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const action = signal.direction === 'sell' ? 'sell' : 'buy'

    logger.info('[TradingFlowPage] 从信号创建订单 - 开始', {
      timestamp,
      traceId,
      operation: 'CREATE_ORDER_FROM_SIGNAL',
      signalData: {
        symbol: signal.symbol,
        action,
      },
    })

    const direction: 'buy' | 'sell' = action === 'buy' ? 'buy' : 'sell'
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
        signalAction: action,
        calculatedDirection: direction,
      },
    })

    const result = await useOrderStore.getState().addOrder(orderData)

    await reportOrderOutcome(
      result,
      loadOrders,
      () =>
        logger.info('[TradingFlowPage] 从信号创建订单 - 成功', {
          timestamp: new Date().toISOString(),
          traceId,
          operation: 'CREATE_ORDER_FROM_SIGNAL',
          statusCode: 200,
          orderId: result.data?.id,
          orderData: result.data,
          executionTime: Date.now() - new Date(timestamp).getTime(),
        }),
      () =>
        logger.error('[TradingFlowPage] 从信号创建订单 - 失败', {
          timestamp: new Date().toISOString(),
          traceId,
          operation: 'CREATE_ORDER_FROM_SIGNAL',
          statusCode: 500,
          errorCode: result.error,
          errorMessage: result.error,
          executionTime: Date.now() - new Date(timestamp).getTime(),
        }),
    )
  }

  // 创建订单
  const handleCreateOrder = async (orderForm: CreateOrderForm): Promise<void> => {
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

    await reportOrderOutcome(
      result,
      loadOrders,
      () =>
        logger.info('[TradingFlowPage] 创建订单 - 成功', {
          timestamp: new Date().toISOString(),
          traceId,
          operation: 'CREATE_ORDER',
          statusCode: 200,
          orderId: result.data?.id,
          orderData: result.data,
          executionTime: Date.now() - new Date(timestamp).getTime(),
        }),
      () =>
        logger.error('[TradingFlowPage] 创建订单 - 失败', {
          timestamp: new Date().toISOString(),
          traceId,
          operation: 'CREATE_ORDER',
          statusCode: 500,
          errorCode: result.error,
          errorMessage: result.error,
          executionTime: Date.now() - new Date(timestamp).getTime(),
        }),
    )
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

    await reportOrderOutcome(
      result,
      loadOrders,
      () =>
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
        }),
      () =>
        logger.error('[TradingFlowPage] 取消订单 - 失败', {
          timestamp: new Date().toISOString(),
          traceId,
          operation: 'CANCEL_ORDER',
          statusCode: 500,
          errorCode: result.error,
          errorMessage: result.error,
          orderId,
          executionTime: Date.now() - new Date(timestamp).getTime(),
        }),
    )
  }

  // 更新风控规则
  const handleUpdateRiskRules = (rules: RiskRules): void => {
    const timestamp = new Date().toISOString()
    logger.info('[TradingFlowPage] 更新风控规则 - 开始', {
      timestamp,
      operation: 'UPDATE_RISK_RULES',
      afterState: rules,
    })
    setRiskRules(rules)
    try {
      localStorage.setItem(RISK_RULES_STORAGE_KEY, JSON.stringify(rules))
    } catch {
      /* localStorage 不可用时静默失败 */
    }
    logger.info('[TradingFlowPage] 更新风控规则 - 成功', {
      timestamp: new Date().toISOString(),
      operation: 'UPDATE_RISK_RULES',
      statusCode: 200,
    })
  }

  // 数据源选择：开发环境使用模拟数据，生产环境使用真实数据
  const displaySignals = (USE_MOCK_DATA && mockData
    ? mockData.signals.map(s => {
        const stock = stocks.find(st => st.symbol === s.symbol)
        return {
          id: s.id,
          symbol: s.symbol,
          direction: s.direction,
          type: 'mock',
          strategy: stock?.researchStatus ?? 'mock',
          confidence: s.confidence,
          rationale: s.rationale,
          snapshot: {
            ...s.snapshot,
            // 兜底值，确保指标表格不为空
            volumeRatio: (s.snapshot as Record<string, unknown>).volumeRatio ?? FALLBACK_VOLUME_RATIO,
            rsi14: (s.snapshot as Record<string, unknown>).rsi14 ?? 52,
            priceToMA20: (s.snapshot as Record<string, unknown>).priceToMA20 ?? FALLBACK_PRICE_TO_MA20,
            macdDirection: (s.snapshot as Record<string, unknown>).macdDirection ?? 'neutral',
            turnRate: (s.snapshot as Record<string, unknown>).turnRate ?? FALLBACK_TURN_RATE,
            klinePattern: (s.snapshot as Record<string, unknown>).klinePattern ?? '趋势确立',
          },
          createdAt: Date.now(),
        } as const
      })
    : signals) as NonNullable<typeof signals>

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
        }, [] as TradingPosition[])
        .filter((p) => p.quantity > 0)

  // 风控指标：仅 mock 模式提供演示数据；生产构建未接入实时风控源时传 undefined，
  // 由 RiskControlPanel 显式展示「数据不足」，避免以硬编码值伪装真实 KPI。
  const riskMetrics =
    USE_MOCK_DATA && mockData
      ? {
          var: mockData.riskMetrics.var95,
          maxDrawdown: mockData.riskMetrics.maxDrawdown,
          sharpeRatio: mockData.riskMetrics.sharpeRatio,
        }
      : undefined

  return {
    stocks,
    message,
    displaySignals,
    displayOrders,
    positions,
    riskMetrics,
    riskRules,
    riskAlerts,
    handleCreateOrderFromSignal,
    handleCreateOrder,
    handleCancelOrder,
    handleUpdateRiskRules,
  }
}
