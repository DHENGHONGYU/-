/**
 * @module TradeModal
 * @description 交易操作确认弹窗。支持补仓/平仓二次确认，确认后调用后端接口并刷新列表。
 * 所有标题、描述文本从 @/constants/trade.constants 引用，禁止硬编码。
 */

import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/Dialog'
import {
  HOLDING_ACTION,
  HOLDING_ACTION_LABELS,
  TRADE_MODAL_TITLES,
  TRADE_MODAL_DESCRIPTIONS,
  getPnlColorClass,
} from '@/constants/trade.constants'
import type { HoldingItem, TradeModalState } from '@/types/modules/trade.types'
import type { HoldingAction } from '@/constants/trade.constants'
import { getLogger } from '@/lib/logger'


const logger = getLogger()

interface TradeModalProps {
  /** 弹窗状态 */
  modal: TradeModalState
  /** 是否操作执行中 */
  isActionLoading: boolean
  /** 关闭弹窗 */
  onClose: () => void
  /** 确认操作 */
  onConfirm: (item: HoldingItem, action: HoldingAction, quantity: number) => void
}

/**
 * TradeModal
 */
export default function TradeModal({
  modal,
  isActionLoading,
  onClose,
  onConfirm,
}: TradeModalProps): React.JSX.Element {
  const [quantity, setQuantity] = useState(0)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        logger.info('[TradeModal] 弹窗打开', {
          code: modal.holding?.code,
          action: modal.action,
        })
      } else {
        logger.info('[TradeModal] 弹窗关闭', {
          code: modal.holding?.code,
          action: modal.action,
        })
        onClose()
      }
    },
    [onClose, modal.holding?.code, modal.action],
  )

  const handleConfirm = useCallback(() => {
    if (!modal.holding || !modal.action) return
    logger.info('[TradeModal] 用户确认交易', {
      code: modal.holding.code,
      action: modal.action,
      quantity,
      holdingQuantity: modal.holding.quantity,
    })
    onConfirm(modal.holding, modal.action, quantity)
  }, [modal.holding, modal.action, quantity, onConfirm])

  if (!modal.holding || !modal.action) return <></>

  const { holding, action } = modal
  const title = TRADE_MODAL_TITLES[action]
  const description = TRADE_MODAL_DESCRIPTIONS[action](holding.name, holding.code)
  const pnlColor = getPnlColorClass(holding.floatingPnl)

  return (
    <Dialog open={modal.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 持仓信息 */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">证券名称</span>
              <span className="font-medium">{holding.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">证券代码</span>
              <span className="font-mono">{holding.code}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">当前持仓</span>
              <span>{holding.quantity.toLocaleString()} 股</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">当前价格</span>
              <span>{holding.currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">成本价</span>
              <span>{holding.avgCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">浮动盈亏</span>
              <span className={pnlColor}>
                {holding.floatingPnlPercent >= 0 ? '+' : ''}
                {holding.floatingPnlPercent.toFixed(2)}%
                {' '}
                ({holding.floatingPnl.toFixed(2)})
              </span>
            </div>
          </div>

          {/* 操作数量 */}
          {action === HOLDING_ACTION.ADD_POSITION && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {HOLDING_ACTION_LABELS[HOLDING_ACTION.ADD_POSITION]}数量（股）
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={quantity || ''}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="请输入补仓数量"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <p className="text-xs text-muted-foreground">最小交易单位 100 股</p>
            </div>
          )}

          {action === HOLDING_ACTION.CLOSE_POSITION && (
            <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
              确认后将全部平仓 {holding.quantity.toLocaleString()} 股，该操作不可撤销。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isActionLoading}>
            取消
          </Button>
          <Button
            variant={action === HOLDING_ACTION.CLOSE_POSITION ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={isActionLoading || (action === HOLDING_ACTION.ADD_POSITION && quantity < 100)}
          >
            {isActionLoading ? '处理中...' : `确认${HOLDING_ACTION_LABELS[action]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}