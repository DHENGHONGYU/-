---
title: how-to-add-widget
code_version: 2.0.0

tier: important
status: active
version: v1.0.0
last_updated: 2026-07-21
doc_id: V9-DOC-HOW-901
---


# 如何新增一个 Widget（WidgetShell + 事件总线）

> **版本**：v1.0.0  
> **日期**：2026-07-12  
> **目标**：在 20 分钟内完成新增 Widget 的全流程，不踩 ErrorBoundary 遗漏、事件命名冲突、状态提升等常见坑

---

## 前置检查

- [ ] 已阅读 `../tutorials/getting-started.md`（了解四步集成契约）
- [ ] 已阅读 `../reference/widget-integration-checklist.md`（Widget 集成检查清单）
- [ ] 已阅读 `../reference/atomic-component-system.md`（原子组件系统）
- [ ] 已确定 Widget 的数据来源（Store 或 Service）
- [ ] 已确认 Widget 的宿主位置（驾驶舱 `/cockpit` 或页面内嵌）

---

## 步骤 1：定义 Widget 类型与配置（3 分钟）

在 `src/types/widget.ts`（或新建 `src/types/widget.ts`）中定义 Widget 类型：

```typescript
// 示例：新增 SectorHeatmapWidget 的类型
export interface SectorHeatmapWidgetConfig extends WidgetConfig {
  settings?: {
    title?: string
    showTrend?: boolean
    colorScheme?: 'red-green' | 'blue-purple'
  }
}
```

> **基类**：所有 Widget 必须继承 `WidgetConfig`（位于 `src/types/widget.ts`）：
> ```typescript
> export interface WidgetConfig {
>   id: string
>   widgetId: string
>   position: { x: number; y: number }
>   size: { cols: number; rows: number }
>   settings?: Record<string, unknown>
> }
> ```

---

## 步骤 2：创建 Widget 组件（8 分钟）

### 2.1 目录结构

```
src/components/widgets/
├── WidgetShell.tsx          # 通用外壳（已存在）
├── SectorHeatmapWidget/
│   ├── index.tsx            # 主入口（导出 Widget 组件）
│   ├── SectorHeatmapView.tsx # 纯视图组件（无状态）
│   ├── useSectorHeatmap.ts   # 自定义 Hook（数据逻辑）
│   └── types.ts             # 局部类型（可选）
```

### 2.2 标准模板

```tsx
/**
 * @module SectorHeatmapWidget
 * @description 板块热力图 Widget。展示板块评分热力分布，支持趋势切换。
 *
 * @see @/components/widgets/WidgetShell.tsx - 外壳包装器
 * @see @/store/sectorAnalysisStore.ts - 数据来源
 */

import React, { useEffect, useMemo } from 'react'
import { WidgetShell } from '../WidgetShell'
import { useSectorAnalysisStore } from '@/store/sectorAnalysisStore'
import { THEME_TOKENS } from '@/constants/theme.tokens'
import { getStockColorClass } from '@/constants/theme.tokens'
import type { SectorHeatmapWidgetConfig } from '@/types/widget'

// ============================================================
// 纯视图组件（无状态，方便测试）
// ============================================================

interface SectorHeatmapViewProps {
  sectors: Array<{
    sectorId: string
    sectorName: string
    score: number
    trend: 'up' | 'down' | 'flat'
  }>
  loading: boolean
  error: string | null
  onRetry: () => void
}

function SectorHeatmapView({ sectors, loading, error, onRetry }: SectorHeatmapViewProps) {
  if (loading) {
    return <div className={THEME_TOKENS.color.muted}>加载中...</div>
  }
  if (error) {
    return (
      <div className={THEME_TOKENS.color.destructive}>
        <p>加载失败: {error}</p>
        <button onClick={onRetry} className={THEME_TOKENS.controlSizes.md}>重试</button>
      </div>
    )
  }
  if (sectors.length === 0) {
    return <div className={THEME_TOKENS.color.muted}>暂无板块数据</div>
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {sectors.map((sector) => (
        <div
          key={sector.sectorId}
          className={`p-3 rounded-lg ${getStockColorClass(sector.score > 3 ? 1 : -1)}`}
          title={`${sector.sectorName}: ${sector.score.toFixed(1)}`}
        >
          <div className="text-sm font-medium">{sector.sectorName}</div>
          <div className="text-xs opacity-75">{sector.score.toFixed(1)}</div>
          {sector.trend === 'up' && <span>↑</span>}
          {sector.trend === 'down' && <span>↓</span>}
          {sector.trend === 'flat' && <span>→</span>}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 自定义 Hook（数据逻辑分离）
// ============================================================

function useSectorHeatmapData() {
  const { sectors, loading, error, loadSectors, clearError } = useSectorAnalysisStore()

  useEffect(() => {
    loadSectors()
  }, [loadSectors])

  return {
    sectors,
    loading,
    error,
    onRetry: () => {
      clearError()
      loadSectors()
    },
  }
}

// ============================================================
// Widget 主入口（WidgetShell 包装）
// ============================================================

export interface SectorHeatmapWidgetProps {
  widgetId: string
  config: SectorHeatmapWidgetConfig
}

export function SectorHeatmapWidget({ widgetId, config }: SectorHeatmapWidgetProps) {
  const { sectors, loading, error, onRetry } = useSectorHeatmapData()

  // 视觉状态映射
  const visualState = useMemo(() => {
    if (loading) return 'loading' as const
    if (error) return 'error' as const
    if (sectors.length === 0) return 'empty' as const
    return 'ready' as const
  }, [loading, error, sectors.length])

  return (
    <WidgetShell
      widgetId={widgetId}
      config={config}
      state={visualState}
      stateConfig={{
        loadingLabel: '加载板块数据...',
        emptyTitle: '暂无板块数据',
        emptyDescription: '请检查数据源或稍后再试',
        errorTitle: '加载失败',
        errorDescription: error ?? '未知错误',
        onRetry,
      }}
    >
      <SectorHeatmapView
        sectors={sectors}
        loading={loading}
        error={error}
        onRetry={onRetry}
      />
    </WidgetShell>
  )
}

export default SectorHeatmapWidget
```

### 2.3 关键要素检查清单

| 要素 | 是否必须 | 说明 | 常见错误 |
|------|----------|------|----------|
| `WidgetShell` 包装 | ✅ 必须 | 提供 ErrorBoundary、事件总线、标题栏 | 遗漏 WidgetShell，导致无统一错误处理 |
| 纯视图组件 | ✅ 必须 | 数据与视图分离，方便测试 | 逻辑与视图混合，难以测试 |
| 自定义 Hook | 🟡 建议 | 数据逻辑抽离为 `useXxxData` | 在视图组件中直接调用 Store |
| `visualState` | ✅ 必须 | `ready`/`loading`/`empty`/`error` | 未映射到 WidgetShell 的 state 属性 |
| `useEffect` 清理 | ✅ 必须 | 订阅/定时器在 cleanup 中移除 | 内存泄漏 |
| 颜色令牌 | ✅ 必须 | 使用 `THEME_TOKENS` / `COLOR_TOKENS` | 硬编码 HEX 或 Tailwind 类 |

---

## 步骤 3：注册 Widget（2 分钟）

### 3.1 在 Widget 注册表中添加

在驾驶舱或页面的 Widget 注册文件中添加（如 `src/cockpit/core/widgetRegistry.ts`）：

```typescript
import { SectorHeatmapWidget } from '@/components/widgets/SectorHeatmapWidget'

export const WIDGET_REGISTRY = {
  // ... 现有 Widget ...
  sectorHeatmap: {
    component: SectorHeatmapWidget,
    title: '板块热力图',
    defaultSize: { cols: 4, rows: 3 },
    category: 'analysis',
  },
} as const
```

### 3.2 在驾驶舱布局中配置（如需默认显示）

```typescript
// src/cockpit/defaultLayout.ts
export const DEFAULT_COCKPIT_LAYOUT = [
  // ... 现有 Widget ...
  {
    widgetId: 'sectorHeatmap-1',
    type: 'sectorHeatmap',
    position: { x: 0, y: 6 },
    size: { cols: 4, rows: 3 },
    settings: { title: '板块热力图', showTrend: true },
  },
]
```

---

## 步骤 4：验证（5 分钟）

### 4.1 类型检查

```bash
npx tsc --noEmit
```

### 4.2 单元测试

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectorHeatmapView } from './SectorHeatmapView'

describe('SectorHeatmapView', () => {
  it('renders sectors', () => {
    const sectors = [
      { sectorId: '1', sectorName: '半导体', score: 4.5, trend: 'up' as const },
      { sectorId: '2', sectorName: '新能源', score: 3.2, trend: 'flat' as const },
    ]
    render(<SectorHeatmapView sectors={sectors} loading={false} error={null} onRetry={() => {}} />)
    expect(screen.getByText('半导体')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<SectorHeatmapView sectors={[]} loading={true} error={null} onRetry={() => {}} />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(<SectorHeatmapView sectors={[]} loading={false} error="Failed" onRetry={() => {}} />)
    expect(screen.getByText('加载失败: Failed')).toBeInTheDocument()
  })
})
```

### 4.3 架构审计

```bash
npm run audit:layers
npm run audit:hardcode
```

### 4.4 手动验证

1. 启动开发服务器：`npm run dev`
2. 导航到驾驶舱 `/cockpit`
3. 添加 Widget：搜索「板块热力图」
4. 确认：数据加载、视觉状态切换、错误重试、设置按钮点击

---

## 常见踩坑与规避

### 坑 1：Widget 直接调用 dataLayer（跨层违规）

```tsx
// ❌ 错误：Widget 直接访问 dataLayer（Widget 只能依赖 Store 和 Service）
import { dataLayer } from '@/data/dataLayer'
const data = await dataLayer.sectors.list()

// ✅ 正确：通过 Store 间接获取
const { sectors } = useSectorAnalysisStore()
```

### 坑 2：遗漏 WidgetShell 的 ErrorBoundary

```tsx
// ❌ 错误：无 WidgetShell 包装，渲染错误导致整个页面崩溃
export function MyWidget() {
  return <div>{data.map(...)}</div> // 如果 data 未定义，整个页面白屏
}

// ✅ 正确：WidgetShell 提供 ErrorBoundary，局部错误隔离
<WidgetShell widgetId={id} config={config}>
  <MyWidgetContent />
</WidgetShell>
```

### 坑 3：事件名冲突

```tsx
// ❌ 错误：使用硬编码事件名，与其他 Widget 冲突
widgetEventBus.publish('update', data)

// ✅ 正确：使用 widget:{widgetId}:{event} 命名空间
widgetEventBus.publish(`widget:${widgetId}:update`, data)
// 或依赖 WidgetShell 自动添加前缀
```

### 坑 4：useEffect 未清理 Store 订阅

```tsx
// ❌ 错误：Store 订阅未清理，导致内存泄漏和重复回调
useEffect(() => {
  useSectorAnalysisStore.subscribe((state) => {
    setLocalData(state.sectors)
  })
}, [])

// ✅ 正确：subscribe 返回 unsubscribe，在 cleanup 中调用
useEffect(() => {
  const unsubscribe = useSectorAnalysisStore.subscribe((state) => {
    setLocalData(state.sectors)
  })
  return unsubscribe
}, [])

// 更好的做法：直接使用 useSectorAnalysisStore()，Zustand 自动处理订阅
const { sectors } = useSectorAnalysisStore()
```

### 坑 5：Widget 状态未提升到 Store

```tsx
// ❌ 错误：Widget 内部使用 useState 管理数据，导致多个 Widget 实例数据不一致
const [data, setData] = useState([])

// ✅ 正确：数据统一在 Store 中管理，Widget 只负责展示
const { data } = useMyStore()
```

> **原则**：Widget 是「展示层」，状态应提升到 Store。只有 UI 局部状态（如折叠/展开）可保留在 Widget 内部。

---

## 步骤 5：性能优化（可选）

### 大数据量场景

```tsx
import { useMemo, useCallback } from 'react'

function useOptimizedData() {
  const { sectors } = useSectorAnalysisStore()

  // 使用 useMemo 缓存计算结果
  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => b.score - a.score)
  }, [sectors])

  // 使用 useCallback 缓存事件处理
  const handleSelect = useCallback((id: string) => {
    // ...
  }, [])

  return { sortedSectors, handleSelect }
}
```

### 虚拟滚动（列表过长）

```tsx
import { FixedSizeGrid } from 'react-window'

// 使用 react-window 或 @tanstack/react-virtual 实现虚拟滚动
```

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 新增 Store | `./how-to-add-store.md` | Widget 的数据来源 |
| 新增 Service | `./how-to-add-service.md` | Store 的下游依赖 |
| Widget 集成检查清单 | `../reference/widget-integration-checklist.md` | 逐项核对 |
| Widget 错误处理 | `../reference/widget-error-handling.md` | 错误边界与降级 |
| 原子组件系统 | `../reference/atomic-component-system.md` | 组件分层 |
| WidgetShell 源码 | `src/components/widgets/WidgetShell.tsx` | 外壳实现 |

---

> **验证完成后**：更新 `docs/README.md` 的 C 类索引，将新增 Widget 链接回主索引。