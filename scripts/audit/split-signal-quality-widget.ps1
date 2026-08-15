# SignalQualityDashboardWidget Component Split Script
# This script extracts constants, types, utils, and sub-components to separate files

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$widgetDir = Join-Path $projectRoot "src\cockpit\widgets"
$sourceFile = Join-Path $widgetDir "SignalQualityDashboardWidget.tsx"

Write-Host "=== SignalQualityDashboardWidget 拆分脚本 ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sourceFile)) {
    Write-Host "ERROR: Source file not found: $sourceFile" -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText($sourceFile, [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"

# ============================================================
# Step 1: Create .constants.ts
# ============================================================
Write-Host "Step 1: Creating .constants.ts..." -ForegroundColor Yellow

$constantsContent = @"
/**
 * SignalQualityDashboardWidget Constants
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import { COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

/** 趋势图滚动窗口大小（每 20 条信号为一个统计周期） */
export const TREND_WINDOW_SIZE = 20

/** Top 信号类型显示数量 */
export const TOP_SIGNAL_TYPES_LIMIT = 5

/** 最近复盘列表显示数量 */
export const RECENT_REVIEWS_LIMIT = 5

/** 信号方向枚举（与 SignalReviewRecord.direction 对应） */
export type SignalDirection = 'buy' | 'sell' | 'hold' | 'watch'

/** 信号方向图标颜色映射（业务语义色，非涨跌色） */
export const DIRECTION_COLOR: Record<SignalDirection, string> = {
  buy: COLOR_TOKENS.success.tailwind,
  sell: COLOR_TOKENS.danger.tailwind,
  hold: COLOR_TOKENS.info.tailwind,
  watch: STOCK_COLOR_TOKENS.neutral.tailwind,
}

/** 信号方向中文标签 */
export const DIRECTION_LABEL: Record<SignalDirection, string> = {
  buy: '买入',
  sell: '卖出',
  hold: '持有',
  watch: '观察',
}

/** 指标良好阈值（≥ 显示绿色） */
export const METRIC_GOOD_THRESHOLD = 0.7
/** 指标警告阈值（≥ 显示黄色） */
export const METRIC_WARN_THRESHOLD = 0.5
/** Sharpe 比率良好阈值 */
export const SHARPE_GOOD_THRESHOLD = 1
/** Sharpe 比率警告阈值 */
export const SHARPE_WARN_THRESHOLD = 0
"@

$constantsPath = Join-Path $widgetDir "SignalQualityDashboardWidget.constants.ts"
[System.IO.File]::WriteAllText($constantsPath, $constantsContent, [System.Text.Encoding]::UTF8)
Write-Host "    Created: SignalQualityDashboardWidget.constants.ts" -ForegroundColor Green

# ============================================================
# Step 2: Create .types.ts
# ============================================================
Write-Host "Step 2: Creating .types.ts..." -ForegroundColor Yellow

$typesContent = @"
/**
 * SignalQualityDashboardWidget Types
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import type { WidgetConfig } from '@/types/modules/widget.types'
import type { SignalDirection } from './SignalQualityDashboardWidget.constants'

export interface SignalQualityDashboardWidgetProps {
  config: WidgetConfig
}

/** 方向统计行数据（来自 getDirectionStats 派生查询） */
export interface DirectionStatRow {
  direction: SignalDirection
  count: number
  accuracy: number
  avgReturn: number
  winRate: number
}

/** 信号类型统计行数据（来自 topSignalTypes 派生查询） */
export interface SignalTypeStatRow {
  type: string
  count: number
  accuracy: number
  avgReturn: number
}

export interface MetricCardProps {
  readonly label: string
  readonly value: string
  readonly colorClass: string
}

export interface PnLCardProps {
  readonly label: string
  readonly value: number
}
"@

$typesPath = Join-Path $widgetDir "SignalQualityDashboardWidget.types.ts"
[System.IO.File]::WriteAllText($typesPath, $typesContent, [System.Text.Encoding]::UTF8)
Write-Host "    Created: SignalQualityDashboardWidget.types.ts" -ForegroundColor Green

# ============================================================
# Step 3: Create .utils.ts
# ============================================================
Write-Host "Step 3: Creating .utils.ts..." -ForegroundColor Yellow

$utilsContent = @"
/**
 * SignalQualityDashboardWidget Utilities
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import { COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import {
  METRIC_GOOD_THRESHOLD,
  METRIC_WARN_THRESHOLD,
  SHARPE_GOOD_THRESHOLD,
  SHARPE_WARN_THRESHOLD,
} from './SignalQualityDashboardWidget.constants'

/** 格式化百分比（0-1 → "65.0%"） */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

/** 格式化百分比（0-100 → "65.0%"），用于已为百分比的值 */
export function formatPercentFrom100(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${value.toFixed(1)}%`
}

/** 格式化数字（保留 2 位小数） */
export function formatDecimal(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(2)
}

/** 格式化时间戳为本地时间 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 根据准确率返回徽章颜色 */
export function getAccuracyBadgeClass(accuracy: number | undefined | null): string {
  if (accuracy === undefined || accuracy === null) return STOCK_COLOR_TOKENS.neutral.tailwind
  if (accuracy >= METRIC_GOOD_THRESHOLD) return COLOR_TOKENS.success.tailwind
  if (accuracy >= METRIC_WARN_THRESHOLD) return COLOR_TOKENS.warning.tailwind
  return COLOR_TOKENS.danger.tailwind
}

/** 根据 Sharpe 比率返回徽章颜色 */
export function getSharpeBadgeClass(sharpe: number | undefined | null): string {
  if (sharpe === undefined || sharpe === null) return STOCK_COLOR_TOKENS.neutral.tailwind
  if (sharpe >= SHARPE_GOOD_THRESHOLD) return COLOR_TOKENS.success.tailwind
  if (sharpe >= SHARPE_WARN_THRESHOLD) return COLOR_TOKENS.warning.tailwind
  return COLOR_TOKENS.danger.tailwind
}
"@

$utilsPath = Join-Path $widgetDir "SignalQualityDashboardWidget.utils.ts"
[System.IO.File]::WriteAllText($utilsPath, $utilsContent, [System.Text.Encoding]::UTF8)
Write-Host "    Created: SignalQualityDashboardWidget.utils.ts" -ForegroundColor Green

# ============================================================
# Step 4: Create .components.tsx
# ============================================================
Write-Host "Step 4: Creating .components.tsx..." -ForegroundColor Yellow

$componentsContent = @"
/**
 * SignalQualityDashboardWidget Sub-components
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import React, { memo } from 'react'
import { getStockColorClass } from '@/constants/theme.tokens'
import type { MetricCardProps, PnLCardProps } from './SignalQualityDashboardWidget.types'

/** 核心指标卡（accuracy/winRate/sharpe/maxDrawdown） */
export const MetricCard = memo(function MetricCard({ label, value, colorClass }: MetricCardProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  )
})

/** 盈亏卡片（使用 STOCK_COLOR_TOKENS，A 股红涨绿跌例外规则） */
export const PnLCard = memo(function PnLCard({ label, value }: PnLCardProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${getStockColorClass(value)}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </p>
    </div>
  )
})
"@

$componentsPath = Join-Path $widgetDir "SignalQualityDashboardWidget.components.tsx"
[System.IO.File]::WriteAllText($componentsPath, $componentsContent, [System.Text.Encoding]::UTF8)
Write-Host "    Created: SignalQualityDashboardWidget.components.tsx" -ForegroundColor Green

# ============================================================
# Step 5: Generate updated main file (just the diff/patch)
# ============================================================
Write-Host "Step 5: Generating main file update instructions..." -ForegroundColor Yellow

$updateInstructions = @"
接下来需要手动更新 SignalQualityDashboardWidget.tsx：

1. 删除以下内容（约 180 行）：
   - L61-L100: 常量定义区块
   - L102-L125: 类型定义区块  
   - L127-L173: 辅助函数区块
   - L175-L210: 子组件区块

2. 在导入区块添加：
   import { TREND_WINDOW_SIZE, TOP_SIGNAL_TYPES_LIMIT, RECENT_REVIEWS_LIMIT,
            DIRECTION_COLOR, DIRECTION_LABEL } from './SignalQualityDashboardWidget.constants'
   import type { SignalDirection, SignalQualityDashboardWidgetProps, DirectionStatRow, SignalTypeStatRow } from './SignalQualityDashboardWidget.types'
   import { formatPercent, formatPercentFrom100, formatDecimal, formatTime,
            getAccuracyBadgeClass, getSharpeBadgeClass } from './SignalQualityDashboardWidget.utils'
   import { MetricCard, PnLCard } from './SignalQualityDashboardWidget.components'

3. 删除以下旧导入（已迁移）：
   - COLOR_TOKENS, STOCK_COLOR_TOKENS（保留，主组件仍在使用）
   - getStockColorClass（保留，主组件仍在使用）

4. 注意：
   - SignalDirection 类型需要从 constants 导入
   - MetricCardProps, PnLCardProps 接口已迁移到 types 文件
   - MetricCard, PnLCard 已迁移到 components 文件
"@

Write-Host $updateInstructions -ForegroundColor White

# ============================================================
# Summary
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  拆分完成" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  已创建文件：" -ForegroundColor White
Write-Host "    1. SignalQualityDashboardWidget.constants.ts" -ForegroundColor Green
Write-Host "    2. SignalQualityDashboardWidget.types.ts" -ForegroundColor Green
Write-Host "    3. SignalQualityDashboardWidget.utils.ts" -ForegroundColor Green
Write-Host "    4. SignalQualityDashboardWidget.components.tsx" -ForegroundColor Green
Write-Host ""
Write-Host "  下一步：手动更新 SignalQualityDashboardWidget.tsx 主文件" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan