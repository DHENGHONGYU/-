---
title: V9 交互时序文档复核报告
type: explanation
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "复核对象：`docs/v9-interaction-flows.html` 复核时间�?026-07-10 复核方式：检索源�?+ 结合 AGENTS.md 设计思路"
tags: [frontend, plan, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-033
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 交互时序文档复核报告

> 复核对象：`docs/v9-interaction-flows.html`  
> 复核时间�?026-07-10  
> 复核方式：检索源�?+ 结合 AGENTS.md 设计思路

---

## 一、复核结�?
总体准确，主要交互链路、页面入口、状态管理描述与代码基本一致。但存在 5 处需要修正或补充的细节，已同步更新到 `docs/v9-interaction-flows.html`�?
---

## 二、确认准确的描述

| 板块 | 准确�?|
|------|--------|
| 数据采集 | SevenDimConfigPage「开始采集」确实调�?`store.runCollection()`，页面有进度条与禁用状�?|
| 采集任务监控 | CollectTaskPage 确实挂载�?Timeline / Swimlane / Replay 三个 Tab |
| 个股分析 | `loadStockAnalysis` 并行调用 loadStock / loadDailyQuotes / loadV6Score；`refreshScore` 调用 scoring service |
| 策略回测 | `runBacktest` 调用 BacktestEngine，结果类型包含可�?positions |
| 交易流程 | 订单创建/取消/从信号创建订单当前均为空实现（TODO�?|
| 智能�?| AgentTriggerPage 通过 `agentRuntime.execute` 触发；AgentTasksPage 通过 eventBus 订阅同步状�?|

---

## 三、已修正/补充的问�?
### 1. 数据采集的「开始采集」当前为 MVP 模拟
**原问�?*：文档描述为「按数据源优先级链拉取行�?K线，写入 IndexedDB」�?**实际情况**：`sevenDimConfigStore.runCollection()` 只是 `setTimeout` 循环模拟进度�?%�?00%），未调用真实采集服务，也无降级逻辑�?**修正**：明确标注为「MVP 模拟进度」，并说明真实批量采集、优先级链、降级逻辑待接�?`collectionPipeline` / `orchestrator`�?
### 2. 多因子筛选缺少结果列表组�?**原问�?*：文档提到结果可在股票池看板查看�?**实际情况**：`MultiFactorFilterPanel` �?`MultiFactorFilterPage` 仅支持条件编辑与「导�?CSV」，页面内没有结果表�?列表展示组件�?**修正**：说明当前仅支持导出 CSV，结果列表组件（ScreeningResultList）待补充�?
### 3. 研究报告�?usePageGuard 是全局状�?**原问�?*：文档描述为「未满足条件时生成按钮禁用」�?**实际情况**：`usePageGuard('research-report')` 读取全局 `pageStore.isClickable`，初始为 `true`，默认不禁用�?**修正**：说�?usePageGuard 依赖全局 pageStore 加载状态，不是页面级权限控制�?
### 4. 驾驶舱「添�?Widget」按钮未实现
**原问�?*：文档描述为「从注册表选择 Widget 类型并实例化」�?**实际情况**：CockpitShell 中「添�?Widget」按钮只�?UI �?Plus 图标，没�?`onClick`；Widget 实例�?`WidgetRegistry` 构造函数默认注册�?**修正**：标注为「UI 占位，交互逻辑待实现」�?
### 5. 智能体任务状态同步机�?**原问�?*：未明确说明 AgentTriggerPage �?AgentTasksPage 的状态同步方式�?**实际情况**：通过 `agentRuntime.execute` + `eventBus` 广播 `AGENT_TASK_*` 事件，AgentTasksPage 订阅后更�?`useAgentStore.tasks`，两页共享同一任务池�?**修正**：补�?eventBus + AgentRuntime 的同步机制说明�?
---

## 四、设计思路一致性检�?
对照 AGENTS.md�?
- �?分层依赖：文档描述的 UI �?Store �?Service �?DataBridge 链路符合四步集成契约�?- �?状态管理：所有板块均通过 Zustand Store 获取状态，未出�?UI 直连 dataLayer�?- �?颜色令牌：梳理的是交互流程，未涉及颜色硬编码问题�?- ⚠️ 事件清理：驾驶舱 `widgetRegistry.subscribe` 返回�?unsubscribe 已正确使用；智能�?eventBus 订阅需确保配对 unsubscribe（代码层面已按模板实现）�?
---

## 五、建议后续动�?
1. **低优先级**：补�?`MultiFactorFilterPage` 的结果列表组件，完善筛选后展示闭环�?2. **中优先级**：实�?CockpitShell「添�?Widget」交互，支持动态实例化�?3. **中优先级**：将 `SevenDimConfigPage.runCollection()` 从模拟进度接入真�?`collectionPipeline`�?4. **低优先级**：如需要页面级权限控制，将 `usePageGuard` 从全局状态改为按页面维度控制�?
---

*复核完成，原文档已更新�?
