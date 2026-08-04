/**
 * WidgetPriceGuardVerifyPage —— 验证 Widget 在 price=undefined 时的渲染
 *
 * @module pages/WidgetPriceGuardVerifyPage
 */

import React, { useEffect, useState } from 'react'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { Button } from '@/components/atoms/Button'
import WatchlistWidget from '@/cockpit/widgets/WatchlistWidget'
import MarketIndicesWidget from '@/cockpit/widgets/MarketIndicesWidget'
import { CoreResourcePanel } from '@/apps/trading/panels/CoreResourcePanel'
import { useMarketDataStore } from '@/store/marketDataStore'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import type { Portfolio, StrategyResult } from '@/data/types'

const mockMarketData: MarketData = {
  watchlist: [
    { name: '贵州茅台', code: '600519', price: 1688.88, changePercent: 2.35 },
    { name: '平安银行', code: '000001', price: 0, changePercent: 0 },
    { name: '宁德时代', code: '300750', price: undefined, changePercent: undefined },
    { name: '中芯国际', code: '688981', price: undefined, changePercent: -2.1 },
    { name: '中国平安', code: '601318', price: 48.5, changePercent: undefined },
  ],
  indices: [
    { code: 'SH', name: '上证指数', price: 3245.67, change: 12.34, changePercent: 0.38, high: 3260, low: 3230, volume: '3.2亿' },
    { code: 'SZ', name: '深证成指', price: undefined, change: undefined, changePercent: undefined, volume: undefined },
    { code: 'CYB', name: '创业板指', price: 2156.78, change: -5.67, changePercent: -0.26, high: undefined, low: undefined, volume: '1.1亿' },
  ],
} as unknown as MarketData

const mockPortfolio: Portfolio = {
  id: 'demo-portfolio',
  name: '核心稀缺主题组合',
  theme: 'core-scarce',
  totalValue: 1000000,
  cashReserve: 400000,
  holdings: [
    { symbol: '600519.SH', name: '贵州茅台', currentShares: 100, currentWeight: 0.1689, targetWeight: 0.2, targetShares: 120, price: 1688.88, marketValue: 168888, score: 4.5, rationale: '核心稀缺' },
    { symbol: '300750.SZ', name: '宁德时代', currentShares: 200, currentWeight: 0, targetWeight: 0.15, targetShares: 300, price: undefined, marketValue: undefined, score: undefined, rationale: '行情未采集' },
    { symbol: '000001.SZ', name: '平安银行', currentShares: 500, currentWeight: 0, targetWeight: 0.1, targetShares: 800, price: 0, marketValue: 0, score: 0, rationale: '停牌价格 0' },
    { symbol: '688981.SH', name: '中芯国际', currentShares: 300, currentWeight: 0, targetWeight: 0.05, targetShares: 400, price: undefined, marketValue: undefined, score: 3.8, rationale: '评分有但行情缺' },
  ],
  rebalancePlan: [
    { symbol: '600519.SH', action: 'buy' as const, shares: 20, reason: '权重偏低' },
    { symbol: '300750.SZ', action: 'sell' as const, shares: 50, reason: '行情缺失，降仓防御' },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockStrategyResult: StrategyResult = {
  selected: [
    { symbol: '600519.SH', name: '贵州茅台', composite: 4.5, valuationScore: null, industryScore: null, momentum: null, sector: null, classification: 'core-scarce', reasons: ['核心稀缺'] },
  ],
  coreScarce: [
    { symbol: '600519.SH', name: '贵州茅台', composite: 4.5, valuationScore: null, industryScore: null, momentum: null, sector: null, classification: 'core-scarce', reasons: ['核心稀缺'] },
  ],
  valueBargain: [],
  hotMomentum: [],
  rejected: [],
  summary: {
    total: 20,
    selectedCount: 13,
    coreScarceCount: 6,
    valueBargainCount: 4,
    hotMomentumCount: 3,
  },
}

const watchlistConfig: WidgetConfig = {
  instanceId: 'demo-watchlist',
  type: 'watchlist',
  title: '自选股行情（含 price=undefined 边界）',
  layout: { w: 6, h: 4, x: 0, y: 0 },
} as unknown as WidgetConfig

const indicesConfig: WidgetConfig = {
  instanceId: 'demo-indices',
  type: 'market-indices',
  title: '大盘指数（含 price=undefined 边界）',
  layout: { w: 6, h: 4, x: 6, y: 0 },
} as unknown as WidgetConfig

export default function WidgetPriceGuardVerifyPage(): React.JSX.Element {
  const mergeAdaptedData = useMarketDataStore((s) => s.mergeAdaptedData)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    mergeAdaptedData(mockMarketData)
  }, [mergeAdaptedData])

  return (
    <PageContainer>
      <PageHeader
        title="safeFormatNumber 迁移验证页"
        description="验证 WatchlistWidget / MarketIndicesWidget / CoreResourcePanel 在 price/changePercent 为 undefined 时的渲染表现（应显示 -- 占位符）"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            重新渲染
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <WatchlistWidget key={`wl-${refreshKey}`} config={watchlistConfig} />
        <MarketIndicesWidget key={`idx-${refreshKey}`} config={indicesConfig} />
      </div>

      <div className="mt-4">
        <CoreResourcePanel
          portfolio={mockPortfolio}
          strategyResult={mockStrategyResult}
          loading={false}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <div className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium">预期渲染表现：</p>
        <ul className="ml-4 mt-2 list-disc space-y-1">
          <li>WatchlistWidget：宁德时代 / 中芯国际 / 中国平安 显示 --，无白屏</li>
          <li>MarketIndicesWidget：深证成指 price/change/high/low 均显示 --</li>
          <li>CoreResourcePanel：宁德时代 / 中芯国际 评分/价格/市值列显示 --</li>
          <li>控制台应无 TypeError: Cannot read properties of undefined (reading 'toFixed')</li>
        </ul>
      </div>
    </PageContainer>
  )
}