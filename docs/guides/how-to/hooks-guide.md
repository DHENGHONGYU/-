---
title: "自定义 Hook 使用指南"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

---
doc_id: V9-DOC-DEV-004
title: "自定义 Hook 使用指南"
domain: dev
status: active
last_updated: 2026-08-15
---

# 自定义 Hook 使用指南

> **Status**: Current  
> **Version**: v1.0.0  
> **Last Updated**: 2026-07-12  
> **Related**: `src/hooks/`、`../../archive/historical-2026-08-16/batch7/docs/explanation/implementation/data-flow-spec.md（已归档）`、`AGENTS.md` §三 事件监听清理

---

## 1. 定位

`src/hooks/` 存放项目自定义 React Hook，按职责平铺，舱室专用 Hook 放入 `src/hooks/cabin/`。所有 Hook 必须遵循 `AGENTS.md` §三 的事件监听清理模板（`useEffect` cleanup 显式取消订阅 / 移除监听 / 清除定时器）。

---

## 2. Hook 清单

### 2.1 通用 Hook

| Hook | 签名 | 说明 |
|------|------|------|
| `useDebounce` | `useDebounce<T>(value: T, delayMs = 300): T` | 值防抖，返回防抖后的值 |
| `useToast` | `useToast()` | 全局 Toast 调用；须在 `<ToastProvider>` 内使用，否则抛错 |
| `ToastProvider` | `<ToastProvider>{children}</ToastProvider>` | Toast 上下文 Provider（同文件导出） |
| `useConfirmDialog` | `useConfirmDialog()` | 命令式确认对话框，替代原生 `window.confirm()`，基于 `<Dialog>` 实现 |
| `useFreshData` | `useFreshData(options): UseFreshDataResult` | 数据新鲜度自动刷新；监听 Store 数据 `lastUpdated` 时间戳，过期自动触发刷新 |
| `usePageGuard` | `usePageGuard(pageKey): PageGuardState` | 页面守卫；返回页面可见性 / 可交互状态及 Button props（如 `'stock-analysis'`） |
| `usePerfTrace` | `usePerfTrace(name, meta?): void` | 组件渲染 + commit 耗时追踪，写入 `[PERF]` 日志与内存采样聚合，为关键路径建立真实性能数据 |
| `useStockPoolBoard` | `useStockPoolBoard()` | 股票池看板页面逻辑；从原 `InputDashboard` 抽离的看板状态与操作 |
| `useDataCollection` | `useDataCollection()` | Widget 数据采集便捷方法；采集任务由 `MarketDataProvider` 在顶层自动注册管理，此 Hook 仅提供访问接口 |

### 2.2 舱室专用 Hook（`src/hooks/cabin/`）

| Hook | 说明 |
|------|------|
| `cabin/useIndustryScorePage` | 行业评分页面逻辑；导出 `STEP_LABELS`、`STEP_ORDER`、`DIMENSION_ORDER`、`formatIndustryDelta(current, previous)` |
| `cabin/useIntelligentScorePage` | 智能选股评分页面逻辑；导出 `STEP_LABELS`、`STEP_ORDER`、`DIMENSION_ORDER`、`formatIntelligentDelta(current, previous)` |

> 测试文件 `useToast.test.tsx` 与 Hook 同目录。

---

## 3. 使用规范

1. **Provider 约束**：`useToast` 必须在 `ToastProvider` 内调用，否则抛 `useToast must be used within <ToastProvider>`。
2. **事件清理**：Hook 内部若注册 `EventBus.subscribe` / `addEventListener` / `setInterval`，必须在返回的 cleanup 中成对取消（见 `AGENTS.md` 模板 1–4），禁止 `EventBus.clear()`。
3. **假定时器**：测试中使用 `vi.useFakeTimers()` 须在 `afterEach` 还原 `vi.useRealTimers()`。
4. **性能 Hook**：`usePerfTrace` 仅用于关键路径（如图表渲染），勿在叶子节点滥用。

---

## 4. 变更触发

> 触发事件 **T7（Hook 自定义变更）** — 匹配 `src/hooks/**/*.ts`、`src/hooks/**/*.tsx`

| 动作 | 文档 |
|------|------|
| 主更新动作 | 本文档（`docs/specs/design/HOOKS_GUIDE.md`） |
| 补充文档 | `../../archive/historical-2026-08-16/batch7/docs/explanation/implementation/data-flow-spec.md（已归档）` |
| 写后校验 | `npm run audit:docs`（是） |

详见 `docs/meta/doc-trigger-action-map.md` §二 T7 行。
