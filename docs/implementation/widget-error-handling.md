---
title: V9 Widget 错误隔离与降级规格
version: v0.9.0-doc-sync-batch2
last_review: 2026-06-27
status: draft
change_log:
  - date: 2026-06-27
    author: Documentation Governor
    desc: 首次定义 Widget ErrorBoundary、隔离策略、降级 UI 与错误上报机制
---

# V9 Widget 错误隔离与降级规格

> **对应蓝图**：`docs/implementation/v9-system-blueprint.md` §7.1 PortalShell/Widget 布局、§9 质量门禁（E2E / PWA / 死代码）、§10 偏差项 D19「Widget 级 ErrorBoundary 待专项接入」。
> **依赖文档**：`docs/implementation/feedback-loop-spec.md`（错误状态的用户反馈）、`docs/implementation/chart-integration.md`（图表 Widget 的渲染错误处理）。

---

## 1. 目标与范围

本文档规定 V9 驾驶舱 Widget 的错误隔离机制：每个 Widget 必须被独立的 `ErrorBoundary` 包裹，避免单个 Widget 崩溃导致整个驾驶舱或页面不可用。同时定义降级 UI 规范、错误上报与日志记录策略。

---

## 2. Widget ErrorBoundary 设计

### 2.1 复用全局 ErrorBoundary

当前全局错误边界已实现于 `src/components/organisms/shared/ErrorBoundary.tsx`，Widget 级复用该组件并传入自定义 `fallback`。

```tsx
// src/cockpit/components/WidgetErrorBoundary.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { WidgetErrorFallback } from './WidgetErrorFallback'

interface WidgetErrorBoundaryProps {
  widgetId: string
  children: React.ReactNode
}

export function WidgetErrorBoundary({ widgetId, children }: WidgetErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={<WidgetErrorFallback widgetId={widgetId} />}>
      {children}
    </ErrorBoundary>
  )
}
```

### 2.2 WidgetErrorFallback 降级 UI

```tsx
// src/cockpit/components/WidgetErrorFallback.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  widgetId: string
}

export function WidgetErrorFallback({ widgetId }: Props) {
  return (
    <Card className="flex h-full flex-col border-dashed border-red-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          Widget 加载失败
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-xs text-muted-foreground">
          组件 <code>{widgetId}</code> 渲染时发生错误，已自动隔离。
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          刷新该 Widget
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## 3. Widget 级错误隔离策略

### 3.1 包裹位置

```tsx
// src/cockpit/CockpitShell.tsx（示意）
<GridLayout>
  {instances.map((instance) => (
    <div key={instance.id}>
      <WidgetErrorBoundary widgetId={instance.widgetId}>
        <WidgetRenderer instance={instance} />
      </WidgetErrorBoundary>
    </div>
  ))}
</GridLayout>
```

### 3.2 隔离原则

| 层级 | 边界范围 | 影响范围 | 是否允许降级 |
|---|---|---|---|
| 全局 `ErrorBoundary` | `App.tsx` 根路由 | 整个应用 | 是，整页降级 |
| 页面 `ErrorBoundary` | 每个 lazy 路由页面 | 单个页面 | 是，页面级降级 |
| Widget `ErrorBoundary` | 每个 Widget 实例 | 单个 Widget | 是，占位卡片 |
| 子组件 try/catch | 数据转换、事件回调 | 仅当前调用 | 否，记录日志 |

### 3.3 错误分类处理

```ts
// src/constants/widget-error.constants.ts
export enum WidgetErrorType {
  RENDER = 'render',           // React 渲染异常
  DATA_FETCH = 'data_fetch',   // 采集/网络失败
  DATA_ADAPTER = 'data_adapter', // 数据适配异常
  CONFIG = 'config',           // Widget 配置缺失/非法
  UNKNOWN = 'unknown',
}

export interface WidgetErrorReport {
  widgetId: string
  instanceId: string
  type: WidgetErrorType
  message: string
  stack?: string
  timestamp: number
}
```

---

## 4. 降级 UI 展示规范

### 4.1 降级内容

1. **图标**：`AlertTriangle`（Lucide）。
2. **标题**：`Widget 加载失败`。
3. **说明**：显示 `widgetId` 或 `instanceId`，帮助定位。
4. **操作**：提供「刷新该 Widget」按钮；若支持重试则显示「重试」。
5. **样式**：红色虚线边框，背景使用 `bg-background`，保持与网格一致。

### 4.2 数据获取失败的额外处理

对于非渲染类错误（如数据获取失败），Widget 内部应先进入 `error` 状态并展示轻量提示，不触发 ErrorBoundary。仅当渲染阶段抛错时才进入 ErrorBoundary 降级。

---

## 5. 错误上报与日志记录

### 5.1 上报路径

```ts
// src/services/widget/widgetErrorReporter.ts
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import type { WidgetErrorReport } from '@/constants/widget-error.constants'

const logger = getLogger()

export function reportWidgetError(report: WidgetErrorReport): void {
  logger.error('[WidgetError] captured', report)
  eventBus.emit('widget:error', report)
  // Phase 3 可扩展：写入 IndexedDB 审计日志表 research_logs
}
```

### 5.2 与反馈服务的协作

ErrorBoundary 捕获后，除渲染降级 UI 外，应通过 `feedbackService.notify()` 向用户提示严重错误。详见 `docs/implementation/feedback-loop-spec.md` §6。

```ts
// 在 ErrorBoundary componentDidCatch 中扩展
import { feedbackService } from '@/services/feedback/feedbackService'

componentDidCatch(error: Error, info: ErrorInfo) {
  const report: WidgetErrorReport = {
    widgetId: this.props.widgetId,
    instanceId: this.props.instanceId,
    type: WidgetErrorType.RENDER,
    message: error.message,
    stack: error.stack,
    timestamp: Date.now(),
  }
  reportWidgetError(report)
  feedbackService.notify({
    scope: 'widget',
    variant: 'error',
    title: '驾驶舱组件异常',
    description: `${this.props.widgetId} 已隔离，请尝试刷新。`,
    duration: 8000,
  })
}
```

---

## 6. 验收标准

- [ ] 每个 Widget 实例都被 `WidgetErrorBoundary` 包裹。
- [ ] 单个 Widget 抛出错误不影响其他 Widget 渲染。
- [ ] 降级 UI 符合 §4.1 规范。
- [ ] `widget:error` 事件被 `eventBus` 正确发射。
- [ ] 新增单元测试：模拟 Widget 抛错，验证降级 UI 与事件上报。

---

## 7. 相关链接

- `docs/implementation/v9-system-blueprint.md` §7.1、§9、D19
- `docs/04-ui-ux-specs.md` §4.5（ErrorBoundary 组件清单）
- `docs/implementation/feedback-loop-spec.md` §6
- `docs/implementation/chart-integration.md` §5.3（图表渲染错误处理）
