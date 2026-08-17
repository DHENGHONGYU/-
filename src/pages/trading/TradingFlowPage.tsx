/**
 * 交易流程页面
 * 整合信号、订单、持仓、风控四个区域
 */
import React from 'react'
import { TradingSignalPanel } from '@/components/organisms/trading/TradingSignalPanel'
import { OrderExecutionPanel } from '@/components/organisms/trading/OrderExecutionPanel'
import { RiskControlPanel } from '@/components/organisms/trading/RiskControlPanel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { DataCollectionWizard } from '@/components/organisms/input/DataCollectionWizard'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { PageContainer } from '@/components/templates'
import { TradingFlowHeader } from './components/TradingFlowHeader'
import { TradingFlowSummary } from './components/TradingFlowSummary'
import { useTradingFlowData, USE_MOCK_DATA } from './hooks/useTradingFlowData'

/**
 * TradingFlowPage
 */
export default function TradingFlowPage(): React.JSX.Element {
  const {
    stocks,
    message,
    displaySignals,
    displayOrders,
    positions,
    riskMetrics,
    riskAlerts,
    handleCreateOrderFromSignal,
    handleCreateOrder,
    handleCancelOrder,
    handleUpdateRiskRules,
  } = useTradingFlowData()

  return (
    <PageContainer className="space-y-6">
      {/* 页面标题 */}
      <TradingFlowHeader useMockData={USE_MOCK_DATA} />

      {/* 统计卡片 */}
      <TradingFlowSummary
        signals={displaySignals}
        orders={displayOrders}
        positions={positions}
        stocksCount={stocks.length}
        riskAlertsCount={riskAlerts.length}
      />

      {/* 四区域布局 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左侧：交易信号 */}
        <div className="lg:col-span-2">
          <TradingSignalPanel
            signals={displaySignals}
            stocks={stocks.map((st) => ({ symbol: st.symbol, name: st.name }))}
            onCreateOrder={(signal) => void handleCreateOrderFromSignal(signal)}
          />
        </div>

        {/* 左侧：订单执行 */}
        <OrderExecutionPanel
          orders={displayOrders.map((o) => ({
            id: o.id.toString(),
            symbol: o.symbol,
            side: o.direction,
            quantity: o.quantity,
            price: o.price,
            type: o.type ?? 'limit',
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
                      <div className={position.pnl >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
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
    </PageContainer>
  )
}