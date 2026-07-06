import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig, SectorHeatmapData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

interface SectorHeatmapWidgetProps {
  config: WidgetConfig
}

export default function SectorHeatmapWidget({ config }: SectorHeatmapWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  const sectors = data.sectors
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getTextColor = (change: number) => {
    return change >= 0 ? COLOR_TOKENS.up.hex : COLOR_TOKENS.down.hex
  }

  // 热力图颜色：基于 COLOR_TOKENS 涨跌色进行强度插值，禁止硬编码
  const getHeatmapColor = (change: number) => {
    const intensity = Math.min(Math.abs(change) / 5, 0.8)
    const baseRgb = change >= 0 ? COLOR_TOKENS.up.rgb : COLOR_TOKENS.down.rgb
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-destructive">
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-32 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-muted rounded" />
              ))}
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold" style={{ color: COLOR_TOKENS.up.hex }}>领涨 Top5</h4>
            <div className="space-y-1">
              {topGainers.map((sector: SectorHeatmapData, idx: number) => (
                <div key={sector.code} className="flex justify-between text-xs">
                  <span>{idx + 1}. {sector.name}</span>
                  <span style={{ color: COLOR_TOKENS.up.hex }}>+{sector.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold" style={{ color: COLOR_TOKENS.down.hex }}>领跌 Top5</h4>
            <div className="space-y-1">
              {topLosers.map((sector: SectorHeatmapData, idx: number) => (
                <div key={sector.code} className="flex justify-between text-xs">
                  <span>{idx + 1}. {sector.name}</span>
                  <span style={{ color: COLOR_TOKENS.down.hex }}>{sector.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
