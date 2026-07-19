---
title: 自定�?Hook 使用指南
type: how-to
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 定位 `src/hooks/` 存放项目自定�?React Hook，按职责平铺，舱室专�?Hook 放入 `src/hooks/cabin/`。所�?Hook..."
tags: [project, guide, definition]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-239
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 自定�?Hook 使用指南

> **Status**: Current  
> **Version**: v1.0.0  
> **Last Updated**: 2026-07-12  
> **Related**: `src/hooks/`、`../reference/data-flow-spec.md`、`../../AGENTS.md` §�?事件监听清理

---

## 1. 定位

`src/hooks/` 存放项目自定�?React Hook，按职责平铺，舱室专�?Hook 放入 `src/hooks/cabin/`。所�?Hook 必须遵循 `../../AGENTS.md` §�?的事件监听清理模板（`useEffect` cleanup 显式取消订阅 / 移除监听 / 清除定时器）�?
---

## 2. Hook 清单

### 2.1 通用 Hook

| Hook | 签名 | 说明 |
|------|------|------|
| `useDebounce` | `useDebounce<T>(value: T, delayMs = 300): T` | 值防抖，返回防抖后的�?|
| `useToast` | `useToast()` | 全局 Toast 调用；须�?`<ToastProvider>` 内使用，否则抛错 |
| `ToastProvider` | `<ToastProvider>{children}</ToastProvider>` | Toast 上下�?Provider（同文件导出�?|
| `useConfirmDialog` | `useConfirmDialog()` | 命令式确认对话框，替代原�?`window.confirm()`，基�?`<Dialog>` 实现 |
| `useFreshData` | `useFreshData(options): UseFreshDataResult` | 数据新鲜度自动刷新；监听 Store 数据 `lastUpdated` 时间戳，过期自动触发刷新 |
| `usePageGuard` | `usePageGuard(pageKey): PageGuardState` | 页面守卫；返回页面可见�?/ 可交互状态及 Button props（如 `'stock-analysis'`�?|
| `usePerfTrace` | `usePerfTrace(name, meta?): void` | 组件渲染 + commit 耗时追踪，写�?`[PERF]` 日志与内存采样聚合，为关键路径建立真实性能数据 |
| `useStockPoolBoard` | `useStockPoolBoard()` | 股票池看板页面逻辑；从�?`InputDashboard` 抽离的看板状态与操作 |
| `useDataCollection` | `useDataCollection()` | Widget 数据采集便捷方法；采集任务由 `MarketDataProvider` 在顶层自动注册管理，�?Hook 仅提供访问接�?|

### 2.2 舱室专用 Hook（`src/hooks/cabin/`�?
| Hook | 说明 |
|------|------|
| `cabin/useIndustryScorePage` | 行业评分页面逻辑；导�?`STEP_LABELS`、`STEP_ORDER`、`DIMENSION_ORDER`、`formatIndustryDelta(current, previous)` |
| `cabin/useIntelligentScorePage` | 智能选股评分页面逻辑；导�?`STEP_LABELS`、`STEP_ORDER`、`DIMENSION_ORDER`、`formatIntelligentDelta(current, previous)` |

> 测试文件 `useToast.test.tsx` �?Hook 同目录�?
---

## 3. 使用规范

1. **Provider 约束**：`useToast` 必须�?`ToastProvider` 内调用，否则�?`useToast must be used within <ToastProvider>`�?2. **事件清理**：Hook 内部若注�?`EventBus.subscribe` / `addEventListener` / `setInterval`，必须在返回�?cleanup 中成对取消（�?`../../AGENTS.md` 模板 1�?），禁止 `EventBus.clear()`�?3. **假定时器**：测试中使用 `vi.useFakeTimers()` 须在 `afterEach` 还原 `vi.useRealTimers()`�?4. **性能 Hook**：`usePerfTrace` 仅用于关键路径（如图表渲染），勿在叶子节点滥用�?
---

## 4. 变更触发

> 触发事件 **T7（Hook 自定义变更）** �?匹配 `src/hooks/**/*.ts`、`src/hooks/**/*.tsx`

| 动作 | 文档 |
|------|------|
| 主更新动�?| 本文档（`./hooks-guide.md`�?|
| 补充文档 | `../reference/data-flow-spec.md` |
| 写后校验 | `npm run audit:docs`（是�?|

详见 `docs/00-meta/doc-trigger-action-map.md` §�?T7 行�?