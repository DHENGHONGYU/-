import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig, SectorHeatmapData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLORS } from '@/constants/cockpit.constants'

interface SectorHeatmapWidgetProps {
  config: WidgetConfig
}

export default function SectorHeatmapWidget({ config }: SectorHeatmapWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  const sectors = data.sectors
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getTextColorClass = (change: number) => {
    return change >= 0 ? COLORS.UP : COLORS.DOWN
  }

  const getHeatmapColor = (change: number) => {
    const intensity = Math.min(Math.abs(change) / 5, 0.8)
    if (change >= 0) {
      const r = Math.round(255 - (255 - 34) * intensity)
      const g = Math.round(255 - (255 - 197) * intensity)
      const b = Math.round(255 - (255 - 94) * intensity)
      return `rgb(${r}, ${g}, ${b})`
    }
    const r = Math.round(255 - (255 - 239) * intensity)
    const g = Math.round(255 - (255 - 68) * intensity)
    const b = Math.round(255 - (255 - 68) * intensity)
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
        <CardContent className="text-center text-red-500">
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
          <div className="h-32 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded" />
              ))}
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded" />
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
              <span style={{ color: getTextColorClass(sector.changePercent) }}>
                {sector.changePercent > 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold" style={{ color: COLORS.UP }}>领涨 Top5</h4>
            <div className="space-y-1">
              {topGainers.map((sector: SectorHeatmapData, idx: number) => (
                <div key={sector.code} className="flex justify-between text-xs">
                  <span>{idx + 1}. {sector.name}</span>
                  <span style={{ color: COLORS.UP }}>+{sector.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold" style={{ color: COLORS.DOWN }}>领跌 Top5</h4>
            <div className="space-y-1">
              {topLosers.map((sector: SectorHeatmapData, idx: number) => (
                <div key={sector.code} className="flex justify-between text-xs">
                  <span>{idx + 1}. {sector.name}</span>
                  <span style={{ color: COLORS.DOWN }}>{sector.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
