import React from 'react'
import { Skeleton } from '@/components/molecules/states'
import { WidgetStateShell } from './components/WidgetStateShell'
import type { WidgetConfig, SectorHeatmapData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

interface SectorHeatmapWidgetProps {
  config: WidgetConfig
}

/**
 * SectorHeatmapWidget
 */
export default function SectorHeatmapWidget({ config }: SectorHeatmapWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const sectors = data.sectors
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getTextColor = (change: number) => {
    return change >= 0 ? STOCK_COLOR_TOKENS.up.hex : STOCK_COLOR_TOKENS.down.hex
  }

  // 热力图颜色：基于 STOCK_COLOR_TOKENS 涨跌色进行强度插值，禁止硬编码
  const getHeatmapColor = (change: number) => {
    const intensity = Math.min(Math.abs(change) / 5, 0.8)
    const baseRgb = change >= 0 ? STOCK_COLOR_TOKENS.up.rgb : STOCK_COLOR_TOKENS.down.rgb
    const parts = baseRgb.split(',').map((s) => Number.parseInt(s.trim(), 10))
    const baseR = parts[0] ?? 0
    const baseG = parts[1] ?? 0
    const baseB = parts[2] ?? 0
    const r = Math.round(255 - (255 - baseR) * intensity)
    const g = Math.round(255 - (255 - baseG) * intensity)
    const b = Math.round(255 - (255 - baseB) * intensity)
    return `rgb(${r}, ${g}, ${b})`
  }

  const topGainers = [...sectors].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5)
  const topLosers = [...sectors].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5)

  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : sectors.length === 0
        ? 'empty'
        : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      className="widget-card-elevated"
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="text" />
              ))}
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="text" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {sectors.map((sector: SectorHeatmapData) => (
            <div
              key={sector.code}
              className="aspect-square flex flex-col items-center justify-center rounded-lg text-xs p-1"
              style={{ backgroundColor: getHeatmapColor(sector.changePercent) }}
            >
              <span className="font-medium truncate w-full text-center">{sector.name}</span>
              <span style={{ color: getTextColor(sector.changePercent) }}>
                {sector.changePercent > 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold" style={{ color: STOCK_COLOR_TOKENS.up.hex }}>领涨 Top5</h4>
            <div className="space-y-1">
              {topGainers.map((sector: SectorHeatmapData, idx: number) => (
                <div key={sector.code} className="flex justify-between text-xs">
                  <span>{idx + 1}. {sector.name}</span>
                  <span style={{ color: STOCK_COLOR_TOKENS.up.hex }}>+{sector.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold" style={{ color: STOCK_COLOR_TOKENS.down.hex }}>领跌 Top5</h4>
            <div className="space-y-1">
              {topLosers.map((sector: SectorHeatmapData, idx: number) => (
                <div key={sector.code} className="flex justify-between text-xs">
                  <span>{idx + 1}. {sector.name}</span>
                  <span style={{ color: STOCK_COLOR_TOKENS.down.hex }}>{sector.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WidgetStateShell>
  )
}
