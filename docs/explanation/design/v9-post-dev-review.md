---
title: V9 开发后复盘报告
type: explanation
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档汇�?V9 智能投研复盘系统�?2026-07-05 开发会话中发现的问题、修复方案、经验教训与架构改进建议�?> 目标读者：所有参�?V9..."
tags: [project, plan, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-248
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 开发后复盘报告

> **Status**: Current
> **Version**: v1.0.0
> **Created**: 2026-07-05
> **Author**: AI 辅助开发复�?>
> 本文档汇�?V9 智能投研复盘系统�?2026-07-05 开发会话中发现的问题、修复方案、经验教训与架构改进建议�?> 目标读者：所有参�?V9 开发的工程师、架构师、QA 工程师�?
---

## 1. 概述

本次复盘覆盖 2026-07-05 全天开发会话，共发现并修复 **17 项问�?*，涵�?EventBus 事件系统、PWA/Service Worker、资源引用、死代码、日志规范、测试一致性等多个维度。所有修复均通过 `tsc --noEmit`�? 错误）、`audit:layers`�? 违规）、单元测试（30+ 通过）验证�?
---

## 2. 问题分类与修复汇�?
### 2.1 EventBus 事件系统�? 项）

| # | 问题 | 严重�?| 根因 | 修复方案 | 涉及文件 |
|---|------|--------|------|----------|----------|
| 1 | `SYSTEM_MONITOR_SNAPSHOT` 递归 emit 540ms | **P0** | listener 调用 `refreshSnapshot()` �?`getSystemSnapshot()` �?再次 emit 同一事件，形成无限递归 | listener 改为直接使用 payload `setState()`，不再调�?`refreshSnapshot()` | `src/store/systemMonitorStore.ts` |
| 2 | `SIGNALS_CHANGED` 双重 emit | **P1** | `eventBus.emit()` + `withBroadcast()` 对同一事件连续调用，`withBroadcast` 内部已含 `eventBus.emit()` | 删除多余�?`eventBus.emit()` 调用 | `src/store/signalAdviceStore.ts` |
| 3 | ArchitectureService 构造函数订阅无清理 | **P1** | `eventBus.on()` 返回值未保存，类�?`destroy()` 方法 | 保存 unsubscribe 引用，新�?`destroy()` + `destroyArchitectureService()` | `src/services/system/architectureService.ts` |
| 4 | DataBridgeAdapter.destroy() 不清理活跃订�?| **P1** | `destroyDataBridgeAdapter()` 仅置空实例，不追�?清理通过 `subscribe()` 创建的订�?| 新增 `activeSubscriptions` 追踪数组 + `destroySubscriptions()` | `../../../src/showcase/index.ts` |
| 5 | `AGENT_HEALTH_CRITICAL/WARNING` 注释不准�?| **P2** | 注释暗示存在递归风险，但 P0 修复后链路已终止 | 更新注释说明链路终止�?| `src/store/systemMonitorStore.ts` |

### 2.2 PWA / Service Worker�? 项）

| # | 问题 | 严重�?| 根因 | 修复方案 | 涉及文件 |
|---|------|--------|------|----------|----------|
| 6 | �?SW 残留拦截 `/health` 请求报错 | **P1** | 浏览器残留旧版生产构建的 SW，但项目已无 `sw.js` 文件 | 新增 `cleanupStaleServiceWorker()` 开发环境自动清�?| `src/services/pwa/registerServiceWorker.ts` |
| 7 | `vite.svg` favicon 404 | **P2** | `index.html` 引用 `/vite.svg`，但 `public/` 目录不存在此文件 | 生成 V9 品牌 SVG 图标 | `public/vite.svg` |
| 8 | `manifest.json` 未在 HTML 中链�?| **P2** | PWA manifest 存在�?`index.html` 缺少 `<link rel="manifest">` | 添加 manifest 链接�?theme-color meta | `index.html` |

### 2.3 资源与引用（3 项）

| # | 问题 | 严重�?| 根因 | 修复方案 | 涉及文件 |
|---|------|--------|------|----------|----------|
| 9 | PWA 图标文件缺失 | **P2** | `manifest.json` 引用 `/icons/icon-192.png` �?`icon-512.png`，但目录不存�?| 生成 V9 品牌图标（JPG 格式）并更新 manifest 引用 | `public/icons/` + `public/manifest.json` |
| 10 | `pwa.test.ts` 断言目标文件错误 | **P3** | 测试断言 `App.tsx` 导入 `initPWA`，实际在 `bootstrapService.ts` | 修正断言目标�?`bootstrapService.ts` | `tests/pwa.test.ts` |
| 11 | `stockAnalysisStore` 订阅从未初始�?| **P0** | `initStockAnalysisStoreSubscriptions()` 已定义但从未调用，V6 评分自动刷新不生�?| 末尾添加自动初始化调�?| `src/store/stockAnalysisStore.ts` |

### 2.4 死代码清理（2 项）

| # | 问题 | 严重�?| 根因 | 修复方案 | 涉及文件 |
|---|------|--------|------|----------|----------|
| 12 | 2 个完全无引用的源文件 | **P2** | `stockAnalysisEngine.ts`�?100+ 行）�?`mockAICenterProvider.ts` 从未被任何文件导�?| 删除文件 | 已删�?|
| 13 | 7 个未使用的常量定�?| **P2** | `DATA_CHANNELS` 整组 + 6 �?`EVENT_NAMES` �?`src/` 中零引用 | 删除未使用常�?| `src/constants/store-channels.constants.ts` |

### 2.5 日志规范�? 项）

| # | 问题 | 严重�?| 根因 | 修复方案 | 涉及文件 |
|---|------|--------|------|----------|----------|
| 14 | commandStore 使用自定�?`console.log` 包装 | **P2** | 违反项目日志规范（应使用 `getLogger()`�?| 替换为标�?`getLogger()`，添�?`[commandStore]` 前缀 | `src/store/commandStore.ts` |

---

## 3. 核心经验教训

### 教训 1：EventBus 监听器禁止调用会再次 emit 同一事件的方�?
**场景**：`SYSTEM_MONITOR_SNAPSHOT` 事件 �?listener 调用 `refreshSnapshot()` �?`getSystemSnapshot()` �?再次 emit `SYSTEM_MONITOR_SNAPSHOT` �?再次触发 listener �?无限递归�?
**规则**�?- EventBus 监听器的回调中，**禁止**调用会再�?emit 同一事件（或触发 emit 链）的方�?- 如果 service 方法内部�?emit 事件，listener 应直接使用事�?payload 更新状�?- 跨事件链（A �?B）可以接受，但必须确保链路在有限步内终止

**检查方�?*�?```
emit('EVENT_X') �?listener �?method() �?emit('EVENT_X')? �?递归�?emit('EVENT_X') �?listener �?method() �?emit('EVENT_Y') �?listener �?setState() �?终止 �?```

### 教训 2：withBroadcast 内部已含 eventBus.emit，禁止双重调�?
**场景**：`eventBus.emit(EVENT_NAMES.X, data)` 后紧�?`withBroadcast(EVENT_NAMES.X, data)`，导致所有监听器被触发两次�?
**规则**�?- `withBroadcast()` = `eventBus.emit()` + �?Tab 广播，已包含 emit
- 需要跨 Tab 广播时，**只调�?* `withBroadcast()`
- 仅本地通知时，**只调�?* `eventBus.emit()`
- 两�?*不可同时调用**同一事件

### 教训 3：EventBus 订阅必须�?destroy 时清�?
**场景**：`ArchitectureService` 构造函数中 `eventBus.on()` 的返回值未保存，类�?`destroy()` 方法，订阅永远无法被清理�?
**规则**�?- 所�?`eventBus.on()` / `eventBus.subscribe()` 的返回值（unsubscribe 函数）必须保�?- 提供对应�?`destroy()` / `cleanup()` 方法
- 单例模式需提供 `destroyXxx()` 全局函数
- 参考标准模板：`initXxxSubscriptions()` + `destroyXxxSubscriptions()` 配对模式

### 教训 4：Store 订阅必须自动初始�?
**场景**：`initStockAnalysisStoreSubscriptions()` 已完整定义（�?`destroyStockAnalysisStoreSubscriptions()`），但从未被调用，导�?V6 评分自动刷新功能完全失效�?
**规则**�?- Store 模块末尾必须调用 `initXxxSubscriptions()` 自动初始化（�?`systemMonitorStore`、`agentStore`、`widgetStore` 保持一致）
- 新增 Store 时，参照已有 Store 的初始化模式
- 代码审查时检�?`init*Subscriptions` 是否有对应的调用�?
### 教训 5：PWA/SW 开发环境需清理残留

**场景**：旧版生产构建注册的 Service Worker 在开发环境中仍拦截请求，导致 `localhost:8000/health` 等请求被 SW 捕获并放大为网络错误�?
**规则**�?- 开发环境初始化时检�?SW 脚本是否存在，不存在则自动注销
- 生产环境移除 SW 功能时，必须提供迁移/清理机制
- 开发者遇�?SW 相关错误时，首先检�?DevTools �?Application �?Service Workers

### 教训 6：测试断言必须与实际代码结构保持一�?
**场景**：`pwa.test.ts` 断言 `App.tsx` 导入 `initPWA`，但实际 `initPWA` �?`bootstrapService.ts` 中导入（`App.tsx` 通过 `initializeApp()` 间接调用）�?
**规则**�?- 测试中的文件内容断言（`readFileSync` + `toContain`）必须验证实际的文件路径
- 重构代码结构后，必须同步更新相关测试断言
- 优先测试行为（函数是否被调用），而非实现细节（哪个文件导入）

### 教训 7：死代码必须定期清理

**场景**：`stockAnalysisEngine.ts`�?100+ 行，12 个导出函数）�?`mockAICenterProvider.ts` 完全无引用，但仍存在于代码库中�?
**规则**�?- 定期运行死代码检测（`audit:deadcode`�?- 整个文件无引用时，果断删除（保留 git 历史�?- 部分函数无引用时，评估是否为预留 API，非预留则删�?- 删除前确认无测试文件引用

---

## 4. 架构改进建议

### 4.1 EventBus 类型安全增强

当前 `eventBus.emit()` �?payload 类型�?`unknown`，listener 需要手�?cast。建议：

```typescript
// 建议：为每个事件定义 payload 类型
interface EventBusEvents {
  'SYSTEM_MONITOR_SNAPSHOT': SystemMonitorSnapshot
  'AGENT_HEALTH_CRITICAL': { agentId: string }
  'SIGNALS_CHANGED': { action: string; count: number }
  // ...
}

eventBus.emit<'SYSTEM_MONITOR_SNAPSHOT'>('SYSTEM_MONITOR_SNAPSHOT', snapshot)
eventBus.on<'SYSTEM_MONITOR_SNAPSHOT'>('SYSTEM_MONITOR_SNAPSHOT', (payload) => {
  // payload 自动推断�?SystemMonitorSnapshot，无需 cast
})
```

### 4.2 Store 初始化模式标准化

当前部分 Store 自动初始化订阅，部分需要手动调用。建议统一为自动初始化模式，并�?AGENTS.md 中明确规定：

> **Store 订阅初始化规�?*：所�?Store 模块必须在文件末尾调�?`initXxxSubscriptions()`，确保订阅在模块加载时自动生效。禁止依赖外部调用方手动初始化�?
### 4.3 PWA 功能决策

当前项目存在完整�?PWA "骨架"代码（注册模�?+ manifest + 图标 + 测试 + 文档），但核心组件缺失（无实�?SW 文件、无 `vite-plugin-pwa`）。建议做出明确决策：

- **方案 A**：完整实�?PWA（安�?`vite-plugin-pwa`，生�?SW，完善离线缓存）
- **方案 B**：移�?PWA 相关代码（删�?`registerServiceWorker.ts`、`manifest.json`、图标、测试、文档）
- **方案 C**：保持现状（�?manifest + 图标，无 SW，作为渐进增强）

---

## 5. 质量指标快照

| 指标 | 修复�?| 修复�?| 变化 |
|------|--------|--------|------|
| EventBus 递归 emit 风险 | 1 处（540ms�?| 0 �?| -100% |
| EventBus 双重 emit bug | 1 �?| 0 �?| -100% |
| EventBus 内存泄漏风险 | 2 �?| 0 �?| -100% |
| 功能缺失（订阅未初始化） | 1 �?| 0 �?| -100% |
| 死代码文�?| 2 个（1200+ 行） | 0 �?| -100% |
| 未使用常�?| 7 �?| 0 �?| -100% |
| 日志规范违规 | 1 处（15 个调用点�?| 0 �?| -100% |
| 测试断言不一�?| 1 �?| 0 �?| -100% |
| 资源引用缺失 | 3 �?| 0 �?| -100% |
| `tsc --noEmit` 错误 | 0 | 0 | 保持 |
| `audit:layers` 违规 | 0 | 0 | 保持 |

---

## 6. 相关文件索引

| 文件 | 说明 |
|------|------|
| `../../reference/踩坑规则门禁指南.md` | 踩坑规则 #11-#14（正�?超时/缓存/降级�?|
| `./v9-post-dev-review.md` | 本文档（开发后复盘�?|
| `../../reference/changelogs/2026-07/2026-07-05-post-dev-review.md` | 本次修复的变更日�?|
| `../../../AGENTS.md` | AI 行为约束契约（含事件监听清理规范�?|

---

## 7. 变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-05 | 初始版本�?7 项问题修复汇总�? 条核心经验教训�? 项架构改进建议、质量指标快�?|
