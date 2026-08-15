# SignalQualityDashboardWidget React-Refresh 拆分方案

## 概述

本方案旨在解决 `react-refresh/only-export-components` 规则警告，将 `SignalQualityDashboardWidget.tsx` 中的非组件内容拆分为独立文件。

## 当前结构分析

### 文件内容分布

| 类别 | 内容 | 行号范围 | 拆分目标 |
|------|------|----------|----------|
| 常量定义 | `TREND_WINDOW_SIZE`, `TOP_SIGNAL_TYPES_LIMIT`, `RECENT_REVIEWS_LIMIT`, `DIRECTION_COLOR`, `DIRECTION_LABEL`, `METRIC_GOOD_THRESHOLD`, `METRIC_WARN_THRESHOLD`, `SHARPE_GOOD_THRESHOLD`, `SHARPE_WARN_THRESHOLD` | L65-L100 | `.constants.ts` |
| 类型定义 | `SignalDirection`, `SignalQualityDashboardWidgetProps`, `DirectionStatRow`, `SignalTypeStatRow` | L74-L125 | `.types.ts` |
| 辅助函数 | `formatPercent`, `formatPercentFrom100`, `formatDecimal`, `formatTime`, `getAccuracyBadgeClass`, `getSharpeBadgeClass` | L131-L173 | `.utils.ts` |
| 子组件 | `MetricCard`, `PnLCard` | L179-L210 | `.components.tsx` |
| 主组件 | `SignalQualityDashboardWidget` | L216-L526 | 保留在主文件 |

## 拆分方案

### 1. 创建 `.constants.ts` — 常量文件

**路径**: `src/cockpit/widgets/SignalQualityDashboardWidget.constants.ts`

**内容**:
```typescript
import { COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

export const TREND_WINDOW_SIZE = 20
export const TOP_SIGNAL_TYPES_LIMIT = 5
export const RECENT_REVIEWS_LIMIT = 5

export type SignalDirection = 'buy' | 'sell' | 'hold' | 'watch'

export const DIRECTION_COLOR: Record<SignalDirection, string> = {
  buy: COLOR_TOKENS.success.tailwind,
  sell: COLOR_TOKENS.danger.tailwind,
  hold: COLOR_TOKENS.info.tailwind,
  watch: STOCK_COLOR_TOKENS.neutral.tailwind,
}

export const DIRECTION_LABEL: Record<SignalDirection, string> = {
  buy: '买入',
  sell: '卖出',
  hold: '持有',
  watch: '观察',
}

export const METRIC_GOOD_THRESHOLD = 0.7
export const METRIC_WARN_THRESHOLD = 0.5
export const SHARPE_GOOD_THRESHOLD = 1
export const SHARPE_WARN_THRESHOLD = 0
```

### 2. 创建 `.types.ts` — 类型文件

**路径**: `src/cockpit/widgets/SignalQualityDashboardWidget.types.ts`

**内容**:
```typescript
import type { WidgetConfig } from '@/types/modules/widget.types'
import type { SignalDirection } from './SignalQualityDashboardWidget.constants'

export interface SignalQualityDashboardWidgetProps {
  config: WidgetConfig
}

export interface DirectionStatRow {
  direction: SignalDirection
  count: number
  accuracy: number
  avgReturn: number
  winRate: number
}

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
```

### 3. 创建 `.utils.ts` — 工具函数文件

**路径**: `src/cockpit/widgets/SignalQualityDashboardWidget.utils.ts`

**内容**:
```typescript
import { COLOR_TOKENS, STOCK_COLOR_TOKENS, getStockColorClass } from '@/constants/theme.tokens'
import {
  METRIC_GOOD_THRESHOLD,
  METRIC_WARN_THRESHOLD,
  SHARPE_GOOD_THRESHOLD,
  SHARPE_WARN_THRESHOLD,
} from './SignalQualityDashboardWidget.constants'

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export function formatPercentFrom100(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${value.toFixed(1)}%`
}

export function formatDecimal(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(2)
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getAccuracyBadgeClass(accuracy: number | undefined | null): string {
  if (accuracy === undefined || accuracy === null) return STOCK_COLOR_TOKENS.neutral.tailwind
  if (accuracy >= METRIC_GOOD_THRESHOLD) return COLOR_TOKENS.success.tailwind
  if (accuracy >= METRIC_WARN_THRESHOLD) return COLOR_TOKENS.warning.tailwind
  return COLOR_TOKENS.danger.tailwind
}

export function getSharpeBadgeClass(sharpe: number | undefined | null): string {
  if (sharpe === undefined || sharpe === null) return STOCK_COLOR_TOKENS.neutral.tailwind
  if (sharpe >= SHARPE_GOOD_THRESHOLD) return COLOR_TOKENS.success.tailwind
  if (sharpe >= SHARPE_WARN_THRESHOLD) return COLOR_TOKENS.warning.tailwind
  return COLOR_TOKENS.danger.tailwind
}
```

### 4. 创建 `.components.tsx` — 子组件文件

**路径**: `src/cockpit/widgets/SignalQualityDashboardWidget.components.tsx`

**内容**:
```typescript
import React, { memo } from 'react'
import { getStockColorClass } from '@/constants/theme.tokens'
import type { MetricCardProps, PnLCardProps } from './SignalQualityDashboardWidget.types'

export const MetricCard = memo(function MetricCard({ label, value, colorClass }: MetricCardProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  )
})

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
```

### 5. 重构主文件

**修改后的 `SignalQualityDashboardWidget.tsx`** 只保留：
- 主组件定义和导出
- 从子文件导入依赖
- 去除常量、类型、辅助函数、子组件的内联定义

## 实施步骤

1. **Phase 1**: 创建 `.constants.ts` 文件
   - 提取所有常量定义
   - 验证导入导出正确

2. **Phase 2**: 创建 `.types.ts` 文件
   - 提取所有接口和类型
   - 验证类型依赖关系

3. **Phase 3**: 创建 `.utils.ts` 文件
   - 提取所有辅助函数
   - 验证函数依赖

4. **Phase 4**: 创建 `.components.tsx` 文件
   - 提取 `MetricCard` 和 `PnLCard`
   - 验证组件 props 类型正确

5. **Phase 5**: 重构主文件
   - 删除内联定义
   - 添加导入语句
   - 验证功能完整性

6. **Phase 6**: 验证
   - 运行 `npm run lint` 确认无 react-refresh 警告
   - 运行 `npm run tsc` 确认类型正确
   - 运行 `npm run test` 确认功能正常

## 注意事项

1. **保持向后兼容**: 所有导出的类型和常量名称保持不变
2. **循环依赖**: 注意 `.types.ts` 可能需要引用 `.constants.ts` 中的类型，确保依赖方向正确
3. **barrel export**: 可选创建 `index.ts` 统一导出，简化导入路径
4. **渐进式重构**: 可分阶段实施，每阶段完成后验证

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 循环依赖 | 中 | 仔细规划文件间依赖方向 |
| 导入路径错误 | 低 | 使用 IDE 自动导入 |
| 类型丢失 | 中 | 完整迁移所有类型定义 |
| 组件行为变化 | 低 | 保持 props 和渲染逻辑不变 |

## 验证命令

```bash
# 验证无 lint 警告
npm run lint

# 验证类型正确
npm run tsc

# 运行测试
npm run test

# 构建验证
npm run build
```