/**
 * 订单执行面板
 * 创建和管理交易订单
 */
import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Label } from '@/components/atoms/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/Select'
import { RadioGroup, Radio } from '@/components/atoms/Radio'
import { getLogger } from '@/lib/logger'
import { COLOR_SHADES } from '@/constants/theme.tokens'

const logger = getLogger()

interface Order {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  type: 'limit' | 'market'
  status: 'pending' | 'filled' | 'cancelled'
  createdAt: number
}

interface OrderForm {
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  type: 'limit' | 'market'
}

interface OrderExecutionPanelProps {
  orders?: Order[]
  onCreateOrder?: (order: OrderForm) => Promise<void>
  onCancelOrder?: (orderId: string) => Promise<void>
}

/**
 * OrderExecutionPanel
 */
export function OrderExecutionPanel({
  orders = [],
  onCreateOrder,
  onCancelOrder
}: OrderExecutionPanelProps): React.JSX.Element {
  const [orderForm, setOrderForm] = useState<OrderForm>({
    symbol: '',
    side: 'buy',
    quantity: 0,
    price: 0,
    type: 'limit',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const timestamp = new Date().toISOString()
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    if (!orderForm.symbol || orderForm.quantity <= 0) {
      logger.warn('[OrderExecutionPanel] 订单表单验证失败', {
        timestamp,
        traceId,
        operation: 'CREATE_ORDER',
        statusCode: 400,
        validationError: {
          symbolEmpty: !orderForm.symbol,
          quantityInvalid: orderForm.quantity <= 0,
        },
        formData: orderForm,
      })
      return
    }

    setIsSubmitting(true)
    try {
      logger.info('[OrderExecutionPanel] 创建订单 - 开始', {
        timestamp,
        traceId,
        operation: 'CREATE_ORDER',
        formData: orderForm,
      })

      logger.info('[OrderExecutionPanel] 创建订单 - 准备提交', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER',
        beforeState: null,
        afterState: orderForm,
        parameters: {
          symbol: orderForm.symbol,
          side: orderForm.side,
          quantity: orderForm.quantity,
          price: orderForm.price,
          orderType: orderForm.type,
          calculatedAmount: orderForm.quantity * orderForm.price,
        },
      })

      await onCreateOrder?.(orderForm)

      logger.info('[OrderExecutionPanel] 创建订单 - 成功', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER',
        statusCode: 200,
        orderData: orderForm,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })

      // 重置表单
      setOrderForm({
        symbol: '',
        side: 'buy',
        quantity: 0,
        price: 0,
        type: 'limit',
      })
    } catch (error) {
      logger.error('[OrderExecutionPanel] 创建订单 - 失败', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CREATE_ORDER',
        statusCode: 500,
        errorCode: 'ORDER_CREATE_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async (orderId: string): Promise<void> => {
    const timestamp = new Date().toISOString()
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 查找原始订单数据
    const originalOrder = orders.find(o => o.id === orderId)

    logger.info('[OrderExecutionPanel] 取消订单 - 开始', {
      timestamp,
      traceId,
      operation: 'CANCEL_ORDER',
      orderId,
      originalOrder: originalOrder ? {
        id: originalOrder.id,
        symbol: originalOrder.symbol,
        side: originalOrder.side,
        quantity: originalOrder.quantity,
        price: originalOrder.price,
        status: originalOrder.status,
      } : null,
    })

    const beforeState = originalOrder ? { status: originalOrder.status } : null
    const afterState = { status: 'cancelled' as const }

    logger.info('[OrderExecutionPanel] 取消订单 - 准备提交', {
      timestamp: new Date().toISOString(),
      traceId,
      operation: 'CANCEL_ORDER',
      beforeState,
      afterState,
      parameters: {
        orderId,
        statusChange: `${originalOrder?.status ?? 'unknown'} -> cancelled`,
      },
    })

    try {
      await onCancelOrder?.(orderId)

      logger.info('[OrderExecutionPanel] 取消订单 - 成功', {
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
    } catch (error) {
      logger.error('[OrderExecutionPanel] 取消订单 - 失败', {
        timestamp: new Date().toISOString(),
        traceId,
        operation: 'CANCEL_ORDER',
        statusCode: 500,
        errorCode: 'ORDER_CANCEL_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        orderId,
        executionTime: Date.now() - new Date(timestamp).getTime(),
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>订单执行</CardTitle>
        <CardDescription>创建和管理交易订单</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>股票代码</Label>
              <Input
                value={orderForm.symbol}
                onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value })}
                placeholder="600519.SH"
              />
            </div>
            <div className="space-y-2">
              <Label>交易方向</Label>
              <Select
                value={orderForm.side}
                onValueChange={(value) => setOrderForm({ ...orderForm, side: value as 'buy' | 'sell' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">买入</SelectItem>
                  <SelectItem value="sell">卖出</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>数量（股）</Label>
              <Input
                type="number"
                value={orderForm.quantity}
                onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 0 })}
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label>价格（元）</Label>
              <Input
                type="number"
                step="0.01"
                value={orderForm.price}
                onChange={(e) => setOrderForm({ ...orderForm, price: parseFloat(e.target.value) || 0 })}
                placeholder="1800.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>订单类型</Label>
            <RadioGroup
              value={orderForm.type}
              onChange={(value) => setOrderForm({ ...orderForm, type: value as 'limit' | 'market' })}
            >
              <Radio value="limit" label="限价单" />
              <Radio value="market" label="市价单" />
            </RadioGroup>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : '创建订单'}
          </Button>
        </form>

        <div className="space-y-3">
          <h3 className="font-semibold">订单列表</h3>
          {orders.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              暂无订单记录
            </div>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          order.status === 'filled' ? 'success' :
                          order.status === 'pending' ? 'default' : 'outline'
                        }>
                          {order.status === 'filled' ? '已执行' :
                           order.status === 'pending' ? '待执行' : '已取消'}
                        </Badge>
                        <span className="font-medium">{order.symbol}</span>
                        <span className={order.side === 'buy' ? COLOR_SHADES.red[500] : COLOR_SHADES.green[500]}>
                          {order.side === 'buy' ? '买入' : '卖出'}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {order.quantity}股 @ {order.price}元 · {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    {order.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCancel(order.id)}
                      >
                        取消
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
