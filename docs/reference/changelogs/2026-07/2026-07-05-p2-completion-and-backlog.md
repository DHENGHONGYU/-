---
title: P2 批次完成报告 & 后续迭代任务清单 �?2026-07-05
type: reference
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "P2 批次完成报告 & 后续迭代任务清单 �?2026-07-05 reference document"
tags: [project, changelog, checklist]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-205
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P2 批次完成报告 & 后续迭代任务清单 �?2026-07-05

## 一、P2 批次完成摘要

### P2-A：类型测试扩�?�?- 新建 `tests/__tests__/types/data-types.spec.ts`
- 覆盖 Stock / Order / V6Score / Signal 四个核心类型的编译期断言
- 使用 `Expect<Equals<...>>` 模式确保关键字段�?null/undefined/any

### P2-B：EventBus 清理 �?- 修复 `src/devtools/testDataFlow.ts`�?  - `eventBus.off('USER_LOGIN', unsub)` �?`unsub()`（正确调用返回的 unsubscribe 函数�?  - 新增 `STOCK_UPDATE` 订阅的清理（`unsubStockUpdate()`�?
### P2-C：硬编码颜色消除 �?- **新增令牌**：`src/constants/theme.tokens.ts`
  - `COLOR_SHADES`�?2 色系 × 多色阶（50-900），�?HEX 值和暗色模式变体
  - `twText(color, shade)` / `twBg(color, shade)` / `twBorder(color, shade)` 辅助函数
- **修改 29 个文�?*，消�?104 处硬编码 Tailwind 颜色类：
  - `components/ui/`：Toast / ErrorState / Badge / Button�? 文件�?  - `components/system/`：LogStreamPanel�? 文件�?  - `components/cabin/`：ScoreItem�? 文件�?  - `components/analysis/`：ScoreHistoryPanel / ScoreFactorWaterfall�? 文件�?  - `components/strategy/`：ChangeLogPanel�? 文件�?  - `components/input/`：QualityIndicator�? 文件�?  - `components/agent/`：GenericAgentDetail / V6ScoringAgentDetail�? 文件�?  - `components/`：WidgetErrorBoundary / ScoreUpdateAlert / ScoreDocVersionTable�? 文件�?  - `cockpit/CockpitShell.tsx`�? 文件�?  - `cockpit/widgets/`�?4 �?Widget 文件
- **策略**�?  - 500 级语义色 �?`COLOR_TOKENS.danger/success/info/warning.tailwind`
  - �?500 级文字色 �?`twText('color', shade)`
  - 背景�?�?`twBg('color', shade)`
  - 边框�?�?`twBorder('color', shade)`
  - 透明度修饰符 �?inline style + `COLOR_SHADES.*.hex[]`
  - 暗色模式�?�?保留硬编码（后续建设暗色模式令牌体系�?
### P2-D：MCP 热更�?�?- **新建** `src/config/mcpServerRegistry.ts`�?  - `MCPServerConfigEntry` 接口：name / modulePath / exportName / priority / enabled
  - `MCP_SERVER_REGISTRY` 常量数组�?1 �?Server 的配置清�?- **改�?* `src/mcp/register.ts`�?  - 移除 11 个静�?`import` + 硬编�?`register()` 调用
  - 使用 `import.meta.glob('./servers/**/*.ts', { eager: true })` 同步加载模块
  - `registerAllServers()` 从配置清单读取并实例化注�?  - 新增 `syncWithConfig()` 增量同步函数（添加新 Server / 注销已删 Server / 禁用处理�?  - 保持 `import '@/mcp/register'` 副作用导入的向后兼容

### P2 验证
- `tsc --noEmit`�? 新增错误�?5 个预存错误均在未修改文件中）
- `npm run build`：成功（53.13s�?
---

## 二、后续迭代任务清单（P1 尾巴 + P2 遗留�?
### 优先级说�?- **P1-剩余**：原 P1 批次中尚未完成的项目，影响架构完整�?- **P2-遗留**：P2 批次中标记为"后续建设"的项�?- **P3-新增**：架构雷达扫描中发现的优化项

---

### P1-剩余-1：上�?Store 完全拆分

**现状**：已完成 positionStore 解耦（去除 orderStore 依赖）和 chatStore 拆分（从 marketDataStore 分离）�?
**待完�?*�?
| 子任�?| 源文�?| 目标 | 影响范围 |
|--------|--------|------|----------|
| tradingStore 拆分 | `store/tradingStore.ts` | `watchlistStore.ts` + `signalAdviceStore.ts` + `portfolioHoldingStore.ts` | Trading 舱所有页�?|
| marketDataStore 瘦身 | `store/marketDataStore.ts` | �?widget 拆分�?`DataSourceStore` 系列 | Cockpit 舱所�?Widget |
| dualStrategyStore 重构 | `store/dualStrategyStore.ts` | 改为只读 facade 或独立策�?Store | Trading 舱策略页�?|
| orderStore 派生计算拆分 | `store/orderStore.ts` | 拆分�?`positionComputer` / `pnlComputer` / `riskComputer` | Trading �?+ Analysis �?|

**预估工作�?*：每个子任务 2-4 小时，总计 8-16 小时
**风险等级**：中（跨模块重构，需逐个子系统验证）

---

### P1-剩余-2：Service 层直调修正（尾巴�?
**现状**：已完成 freshnessGuard �?core、llmGateway 封装、UseCase 路由�?
**待完�?*�?
| 子任�?| 描述 | 文件 |
|--------|------|------|
| inputService 跨域调用 | 封装�?`FetcherOrchestratorUseCase` | `services/input/inputService.ts` |
| strategyEngine 跨域调用 | 封装�?`HotSectorQueryUseCase` | `services/strategy/strategyEngine.ts` |
| 同子�?Service 互调审计 | 运行 `audit:layers` 检�?services 内部跨子域直接依�?| �?services/ 目录 |

**预估工作�?*�?-6 小时
**风险等级**：低（UseCase 模式已验证，照搬即可�?
---

### P1-剩余-3：UseCase 补充

**待创�?*�?
| UseCase | �?Service | 描述 |
|---------|-----------|------|
| `rebalancePortfolio.useCase.ts` | `portfolioService.rebalance()` | 组合再平衡（已部分完�?transaction 集成�?|
| `fetcherOrchestrator.useCase.ts` | `inputService` | 数据获取编排（多源聚�?+ 重试�?|
| `hotSectorQuery.useCase.ts` | `strategyEngine` | 热门板块查询（跨域数据融合） |

**预估工作�?*：每�?1-2 小时，总计 3-6 小时

---

### P2-遗留-1：暗色模式令牌体�?
**现状**：P2-C 中暗色模式类（`dark:text-*` / `dark:bg-*`）保留硬编码�?
**待完�?*�?- �?`COLOR_SHADES` 中为每个色系添加完整的暗色模式变体令�?- 或引�?CSS Custom Properties 方案（`--color-danger-50` 等），通过 Tailwind `theme.extend` 映射
- 迁移所有组件中�?`dark:*` 硬编码类

**预估工作�?*�?-6 小时
**风险等级**：低（纯 UI 替换，零业务影响�?
---

### P2-遗留-2：魔法数字消�?
**现状**：`audit:hardcode` 报告 151 个魔法数�?+ 705 个静默回退（`?? ""`）�?
**待完�?*�?
| 类别 | 数量 | 策略 |
|------|------|------|
| 魔法数字�?位以上） | 151 | 提取�?`const` �?config |
| 静默回退 `?? ""` | 705 | 审计每个回退点，添加 logger.warn 或提取默认值常�?|
| 硬编�?URL | 14 | 迁移�?`src/config/apiPaths.ts` |
| 硬编�?API 路径 | 6 | 迁移�?`src/config/apiPaths.ts` |
| 硬编码超时�?| 5 | 迁移�?`src/config/timeouts.ts` |

**预估工作�?*�?-12 小时（需逐个审计，不可批量盲替）
**风险等级**：中（静默回退可能掩盖数据问题�?
---

### P3-新增-1：类型测试补�?
**现状**：仅 `data-types.spec.ts` 覆盖 Stock/Order/V6Score/Signal�?
**待补�?*�?- `ScoreDocVersion` / `ScoreDocDiff` 类型测试
- `WidgetConfig` / `WidgetRuntimeState` 类型测试
- `MonitorLogEntry` / `SystemMonitorSnapshot` 类型测试
- `MCPServer` / `ToolDescriptor` 类型测试

**预估工作�?*�?-3 小时

---

### P3-新增-2：EventBus 类型安全

**现状**：EventBus 事件名和 payload 类型通过字符串联�?+ `as` 断言�?
**待改�?*�?- 建立事件�?�?payload 类型的映射接�?`EventMap`
- `eventBus.emit<K extends keyof EventMap>(event: K, payload: EventMap[K])` 泛型约束
- 消除组件中所�?`as { ... }` payload 断言

**预估工作�?*�?-6 小时
**风险等级**：中（需全局搜索所�?emit/on 调用点）

---

### P3-新增-3：MCP 注册入口接入

**现状**：`register.ts` 的副作用导入尚未�?`main.tsx` / `App.tsx` 中触发�?
**待完�?*�?- �?`src/App.tsx` �?`src/main.tsx` 中添�?`import '@/mcp/register'`
- 或在 `AgentRuntime` 初始化时调用 `registerAllServers()`
- 验证 MCP Dashboard 页面能正确展示所有已注册 Server

**预估工作�?*�?.5 小时
**风险等级**：低

---

## 三、执行建�?
### 下一轮迭代推荐顺�?
1. **P1-剩余-3**（UseCase 补充）�?低风险，模式已验�?2. **P1-剩余-2**（Service 直调尾巴）�?低风险，依赖 UseCase
3. **P3-新增-3**（MCP 注册入口接入）�?极低风险，一行导�?4. **P1-剩余-1**（上�?Store 拆分）�?中风险，需逐个子系统验�?5. **P2-遗留-1**（暗色模式令牌）�?低风险，�?UI
6. **P2-遗留-2**（魔法数字消除）�?中风险，需逐个审计
7. **P3-新增-1**（类型测试补全）�?低风�?8. **P3-新增-2**（EventBus 类型安全）�?中风险，全局影响

### 验证命令

每轮迭代完成后执行：
```powershell
npx tsc --noEmit
npm run build
npm run audit:layers
npm run audit:hardcode
```
