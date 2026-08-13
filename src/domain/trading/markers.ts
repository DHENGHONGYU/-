/**
 * @fileoverview 买卖点标注构建 — 纯函数实现
 *
 * 将交易信号/订单转换为 K 线图 markers 或 AnnotatedTradePoint。
 * 原实现位于 src/services/trading/buySellPointMarkerBuilder.ts。
 * P1-12 分层合规：纯函数落地 domain 层（从 lib/trading 迁移），services 侧 re-export 保持 API 兼容。
 *
 * @see src/services/trading/buySellPointMarkerBuilder.ts (re-export caller)
 * @doc [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-FRONT-020]
 */

import type { Order, Signal } from '@/data/types'
import type {
  AnnotatedTradePoint,
  BuyPointType,
  ChartMarker,
  SellPointType,
} from '@/types/modules/buySellPoint.types'
import {
  BUY_POINT_COLORS,
  BUY_POINT_NAMES,
  SELL_POINT_COLORS,
  SELL_POINT_NAMES,
} from '@/config/buySellPointConfig'

const BUY_TYPES = new Set<string>([
  'buy_dip',
  'buy_pivot',
  'buy_safety_margin',
  'buy_breakout',
  'composite_buy',
])

const SELL_TYPES = new Set<string>([
  'sell_profit_taking',
  'sell_trailing_stop',
  'sell_stop_loss',
  'composite_sell',
])

function isBuyType(type: string): type is BuyPointType {
  return BUY_TYPES.has(type)
}

function isSellType(type: string): type is SellPointType {
  return SELL_TYPES.has(type)
}

/** 将信号列表转换为 K 线图 markers */
export function signalsToMarkers(signals: Signal[]): ChartMarker[] {
  return signals
    .filter((s) => s.direction === 'buy' || s.direction === 'sell')
    .map((s) => {
      const isBuy = s.direction === 'buy'
      const pointType = s.type
      let color: string
      let name: string
      if (isBuy && isBuyType(pointType)) {
        color = BUY_POINT_COLORS[pointType]
        name = BUY_POINT_NAMES[pointType]
      } else if (!isBuy && isSellType(pointType)) {
        color = SELL_POINT_COLORS[pointType]
        name = SELL_POINT_NAMES[pointType]
      } else {
        color = isBuy ? '#ef4444' : '#22c55e'
        name = isBuy ? '买入' : '卖出'
      }
      return {
        time: new Date(s.createdAt).toISOString().slice(0, 10),
        position: isBuy ? 'belowBar' : 'aboveBar',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        color,
        text: `${name} ${(s.confidence * 100).toFixed(0)}%`,
        size: 1.5,
      }
    })
}

/** 将订单列表转换为 K 线图 markers（实际交易点） */
export function ordersToMarkers(orders: Order[]): ChartMarker[] {
  return orders.map((o) => {
    const isBuy = o.direction === 'buy'
    return {
      time: new Date(o.createdAt).toISOString().slice(0, 10),
      position: isBuy ? 'belowBar' : 'aboveBar',
      shape: isBuy ? 'circle' : 'square',
      color: isBuy ? '#dc2626' : '#16a34a',
      text: `${isBuy ? '买' : '卖'} ${o.price.toFixed(2)}`,
      size: 2,
    }
  })
}

/** 将订单转换为带元数据的买卖点标注（用于分析） */
export function ordersToAnnotatedPoints(orders: Order[]): AnnotatedTradePoint[] {
  return orders.map((o) => {
    const isBuy = o.direction === 'buy'
    const inferredType = isBuy ? 'buy_pivot' : 'sell_profit_taking'
    return {
      signalId: o.id,
      symbol: o.symbol,
      type: inferredType,
      direction: isBuy ? 'buy' : 'sell',
      time: new Date(o.createdAt).toISOString().slice(0, 10),
      price: o.price,
      confidence: 0.5,
      rationale: `实际${isBuy ? '买入' : '卖出'}订单 @ ${o.price.toFixed(2)}`,
    }
  })
}

/** 将信号转换为带元数据的买卖点标注（用于分析） */
export function signalsToAnnotatedPoints(signals: Signal[]): AnnotatedTradePoint[] {
  return signals
    .filter((s) => s.direction === 'buy' || s.direction === 'sell')
    .map((s) => {
      const isBuy = s.direction === 'buy'
      const pointType = s.type
      const typedType: BuyPointType | SellPointType = isBuy
        ? (isBuyType(pointType) ? pointType : 'buy_pivot')
        : (isSellType(pointType) ? pointType : 'sell_profit_taking')
      return {
        signalId: s.id,
        symbol: s.symbol,
        type: typedType,
        direction: isBuy ? 'buy' : 'sell',
        time: new Date(s.createdAt).toISOString().slice(0, 10),
        price: 0,
        confidence: s.confidence,
        rationale: s.rationale,
        snapshot: {
          priceToMA20: s.snapshot.priceToMA20,
          rsi14: s.snapshot.rsi14,
          volumeRatio: s.snapshot.volumeRatio,
          macdDirection: s.snapshot.macdDirection,
        },
      }
    })
}
