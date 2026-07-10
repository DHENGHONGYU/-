/**
 * @module SectorRotationHeatmap
 * @description 板块轮动热力图：支持日线/周线/月线切换，按涨跌幅、换手率、资金流向着色。
 * 参考 SectorHeatmapWidget 风格，使用 DataState 处理 loading/empty/error 三态。
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDataSource, useMarketDataStore } from '@/store/marketDataStore'
import { DataState } from '@/components/ui/DataState'
import { Select, SelectItem } from '@/components/ui/Select'
import type { SectorHeatmapData } from '@/types/modules/widget.types'
import type { DataSourceConfig } from '@/types/modules/widget.types'
import {
  SECTOR_HEATMAP_COLUMNS,
  SECTOR_HEATMAP_INTENSITY_REFERENCE,
  SECTOR_HEATMAP_METRICS,
  SECTOR_HEATMAP_OPACITY,
  SECTOR_HEATMAP_RANK_LIMIT,
  SECTOR_HEATMAP_TEXT_COLORS,
  SECTOR_HEATMAP_TIME_WINDOWS,
  SECTOR_HEATMAP_COLORS,
  type SectorHeatmapMetric,
  type SectorHeatmapTimeWindow,
} from '@/config/sectorHeatmapConfig'
import { WIDGET_DEFAULT_DATA_SOURCE } from '@/constants/cockpit.constants'
import { hexToRgba, cn } from '@/lib/utils'
import { twText, twBg, twBorder, DARK, HOVER } from '@/constants/theme.tokens'

export interface SectorRotationHeatmapProps {
  title?: string
}

export interface HeatmapCell {
  code: string
  name: string
  changePercent: number
  turnover: number | null
  fundFlow: number | null
}

function parsePercentString(value: string | number | undefined): number | null {
  if (value === undefined) return null
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value.replace('%', ''))
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * adaptHeatmapData
 * @param sectors
 * @returns HeatmapCell[]
 */
export function adaptHeatmapData(sectors: SectorHeatmapData[]): HeatmapCell[] {
  return sectors.map((sector) => ({
    code: sector.code,
    name: sector.name,
    changePercent: sector.changePercent,
    turnover: parsePercentString(sector.turnover),
    fundFlow: sector.fundFlow ?? null,
  }))
}

/**
 * getMetricValue
 * @param cell
 * @param metric
 * @returns number | null
 */
export function getMetricValue(cell: HeatmapCell, metric: SectorHeatmapMetric): number | null {
  if (metric === 'changePercent') return cell.changePercent
  if (metric === 'turnover') return cell.turnover
  return cell.fundFlow
}

function computeCellStyle(metric: SectorHeatmapMetric, value: number | null) {
  if (value === null) {
    return {
      backgroundColor: hexToRgba(SECTOR_HEATMAP_COLORS[metric].neutral, SECTOR_HEATMAP_OPACITY.min),
      color: SECTOR_HEATMAP_TEXT_COLORS.onLight,
    }
  }

  const reference = SECTOR_HEATMAP_INTENSITY_REFERENCE[metric]
  const ratio = Math.abs(value) / reference
  const opacity = Math.min(SECTOR_HEATMAP_OPACITY.max, SECTOR_HEATMAP_OPACITY.min + ratio * (SECTOR_HEATMAP_OPACITY.max - SECTOR_HEATMAP_OPACITY.min))

  const colorSet = SECTOR_HEATMAP_COLORS[metric]
  const baseColor = value > 0 ? colorSet.positive : value < 0 ? colorSet.negative : colorSet.neutral
  const textColor = opacity > SECTOR_HEATMAP_OPACITY.textThreshold ? SECTOR_HEATMAP_TEXT_COLORS.onDark : SECTOR_HEATMAP_TEXT_COLORS.onLight

  return {
    backgroundColor: hexToRgba(baseColor, opacity),
    color: textColor,
  }
}

function formatMetricValue(value: number | null, metric: SectorHeatmapMetric): string {
  if (value === null) return 'N/A'
  const unit = SECTOR_HEATMAP_METRICS.find((m) => m.value === metric)?.unit ?? ''
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}${unit}`
}

function sortCellsByMetric(cells: HeatmapCell[], metric: SectorHeatmapMetric): HeatmapCell[] {
  return [...cells].filter((cell) => getMetricValue(cell, metric) !== null).sort((a, b) => {
    const va = getMetricValue(a, metric) ?? 0
    const vb = getMetricValue(b, metric) ?? 0
    return vb - va
  })
}

/**
 * SectorRotationHeatmap
 */
export function SectorRotationHeatmap({ title = '板块轮动热力图' }: SectorRotationHeatmapProps) {
  const navigate = useNavigate()
  const { data, loading, error } = useDataSource('sectorHeatmap')
  const fetchDataSource = useMarketDataStore((state) => state.fetchDataSource)

  const [timeWindow, setTimeWindow] = useState<SectorHeatmapTimeWindow>('day')
  const [metric, setMetric] = useState<SectorHeatmapMetric>('changePercent')

  useEffect(() => {
    const baseConfig = WIDGET_DEFAULT_DATA_SOURCE.sectorHeatmap as DataSourceConfig
    void fetchDataSource('sectorHeatmap', {
      ...baseConfig,
      mode: 'once',
      params: { timeWindow },
    })
  }, [fetchDataSource, timeWindow])

  const cells = useMemo(() => adaptHeatmapData(data?.sectors ?? []), [data?.sectors])

  const rankedCells = useMemo(() => sortCellsByMetric(cells, metric), [cells, metric])
  const topGainers = useMemo(() => rankedCells.slice(0, SECTOR_HEATMAP_RANK_LIMIT), [rankedCells])
  const topLosers = useMemo(
    () =>
      metric === 'changePercent' || metric === 'fundFlow'
        ? [...rankedCells].reverse().slice(0, SECTOR_HEATMAP_RANK_LIMIT)
        : [],
    [metric, rankedCells],
  )

  const handleCellClick = (code: string) => {
    void navigate(`/analysis/industry-score?sector=${encodeURIComponent(code)}`)
  }

  const errorMessage = error ?? '操作失败'

  return (
    <section className={`rounded-xl border ${twBorder('neutral', 200)} bg-card p-4 shadow-sm ${DARK.borderSlate700} ${DARK.bgSlate900}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={`text-lg font-semibold ${twText('slate', 900)} ${DARK.textSlate100}`}>{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as SectorHeatmapTimeWindow)}
            className="w-28"
          >
            {SECTOR_HEATMAP_TIME_WINDOWS.map((window) => (
              <SelectItem key={window.value} value={window.value}>
                {window.label}
              </SelectItem>
            ))}
          </Select>

          <Select
            value={metric}
            onChange={(e) => setMetric(e.target.value as SectorHeatmapMetric)}
            className="w-36"
          >
            {SECTOR_HEATMAP_METRICS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <DataState
        isLoading={loading}
        isError={error !== null}
        isEmpty={cells.length === 0}
        data={cells}
        errorProps={{ error: errorMessage }}
      >
        <div className="space-y-4">
          <div
            className={cn('grid gap-2')}
            style={{ gridTemplateColumns: `repeat(${SECTOR_HEATMAP_COLUMNS}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => {
              const value = getMetricValue(cell, metric)
              const style = computeCellStyle(metric, value)
              return (
                <button
                  key={cell.code}
                  type="button"
                  onClick={() => handleCellClick(cell.code)}
                  className={`flex flex-col items-center justify-center rounded-lg border border-transparent p-3 text-center transition ${HOVER.ringSlate300} focus:outline-none focus:ring-2 ${twBorder('slate', 400)}`}
                  style={style}
                  aria-label={`${cell.name} ${formatMetricValue(value, metric)}`}
                >
                  <span className="text-sm font-medium">{cell.name}</span>
                  <span className="text-xs opacity-90">{formatMetricValue(value, metric)}</span>
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className={`mb-2 text-sm font-semibold ${twText('slate', 700)} ${DARK.textSlate300}`}>
                {metric === 'changePercent' ? '领涨板块' : metric === 'fundFlow' ? '资金流入' : '高换手板块'}
              </h3>
              <ul className="space-y-1">
                {topGainers.map((cell) => (
                  <li
                    key={`top-${cell.code}`}
                    className={`flex justify-between rounded ${twBg('slate', 50)} px-3 py-2 text-sm ${DARK.bgSlate800}`}
                  >
                    <span>{cell.name}</span>
                    <span className="font-medium">
                      {formatMetricValue(getMetricValue(cell, metric), metric)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {topLosers.length > 0 && (
              <div>
                <h3 className={`mb-2 text-sm font-semibold ${twText('slate', 700)} ${DARK.textSlate300}`}>
                  {metric === 'changePercent' ? '领跌板块' : '资金流出'}
                </h3>
                <ul className="space-y-1">
                  {topLosers.map((cell) => (
                    <li
                      key={`bottom-${cell.code}`}
                      className={`flex justify-between rounded ${twBg('slate', 50)} px-3 py-2 text-sm ${DARK.bgSlate800}`}
                    >
                      <span>{cell.name}</span>
                      <span className="font-medium">
                        {formatMetricValue(getMetricValue(cell, metric), metric)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </DataState>
    </section>
  )
}
