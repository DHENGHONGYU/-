/**
 * CandlestickChart 常量配置
 * 从 CandlestickChart.tsx 提取，包含周期选项、复权选项、均线配置、样式常量
 */
import type { CSSProperties } from 'react'
import { CHART_PALETTE_PRO } from '@/constants/theme.tokens'
import { EMA_COLORS, BOLL_COLORS, RSI_COLORS } from './indicators'

// 重新导出共享配置，保持向后兼容
export { PERIOD_OPTIONS, ADJUST_OPTIONS, MA_OPTIONS } from './shared.config'

/** EMA 叠加配置（EMA12/26/50） */
export const EMA_OVERLAY_OPTIONS: Array<{ period: number; color: string }> = [
  { period: 12, color: EMA_COLORS[12]! },
  { period: 26, color: EMA_COLORS[26]! },
  { period: 50, color: EMA_COLORS[50]! },
]

/** Bollinger 叠加配置 */
export const BOLL_OVERLAY_CONFIG = {
  upper: { color: BOLL_COLORS.upper, lineWidth: 1, lineStyle: 0 },
  middle: { color: BOLL_COLORS.middle, lineWidth: 1, lineStyle: 0 },
  lower: { color: BOLL_COLORS.lower, lineWidth: 1, lineStyle: 0 },
  fillColor: BOLL_COLORS.fill,
}

/** RSI 副图配置 */
export const RSI_PANE_CONFIG = {
  overboughtLevel: 70,
  oversoldLevel: 30,
  lineColor: RSI_COLORS.line,
  overboughtColor: RSI_COLORS.overbought,
  oversoldColor: RSI_COLORS.oversold,
  midlineColor: RSI_COLORS.midline,
}

/** 叠加指标选项 */
export const OVERLAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: '无叠加' },
  { value: 'ema', label: 'EMA' },
  { value: 'bollinger', label: 'BOLL' },
  { value: 'all', label: '全部' },
]

/** 工具栏容器样式 */
export const toolbarContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0',
  flexWrap: 'wrap',
}

/** 按钮组背景样式 */
export const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  gap: '2px',
  background: CHART_PALETTE_PRO.bgLight,
  borderRadius: '6px',
  padding: '2px',
}

/** 工具栏按钮样式工厂 */
export function getToolbarButtonStyle(isActive: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: '0.78rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    background: isActive
      ? 'rgba(255,255,255,0.1)'
      : 'transparent',
    color: isActive
      ? CHART_PALETTE_PRO.contrast
      : CHART_PALETTE_PRO.axis,
    transition: 'background-color 0.15s ease, color 0.15s ease',
  }
}

/** 均线图例容器样式 */
export const maLegendContainerStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 8,
  zIndex: 5,
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '2px 8px',
  borderRadius: '6px',
  background: 'rgba(19,23,34,0.8)',
  backdropFilter: 'blur(4px)',
  fontSize: '0.72rem',
  fontWeight: 500,
  color: CHART_PALETTE_PRO.axis,
  pointerEvents: 'none',
}

/** 均线图例条目样式 */
export const maLegendItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

/** 均线图例色条样式 */
export const maLegendColorBarStyle: CSSProperties = {
  width: 12,
  height: 2,
  borderRadius: 1,
  display: 'inline-block',
}

/** tooltip 容器样式 */
export const tooltipContainerStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 6,
  minWidth: 160,
  padding: '8px 10px',
  borderRadius: '8px',
  background: 'rgba(19,23,34,0.92)',
  backdropFilter: 'blur(8px)',
  border: `1px solid ${CHART_PALETTE_PRO.grid}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  fontSize: '0.74rem',
  fontFeatureSettings: 'tnum',
  color: CHART_PALETTE_PRO.axis,
  pointerEvents: 'none',
  display: 'none',
}

/** tooltip 时间样式 */
export const tooltipTimeStyle: CSSProperties = {
  fontWeight: 600,
  marginBottom: 4,
  color: CHART_PALETTE_PRO.contrast,
}

/** tooltip 数值网格样式 */
export const tooltipValuesStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '2px 10px',
}

/** 价格变动脉冲动画关键帧（注入到 document） */
export const PRICE_PULSE_KEYFRAMES = `
@keyframes v9-price-pulse-up {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
@keyframes v9-price-pulse-down {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
`
