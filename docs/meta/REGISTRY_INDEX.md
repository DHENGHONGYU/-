---
title: "V9 模块注册体系索引"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.1.2
change_log:
  - version: v1.1.2
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v1.1.1) → R2 PATCH++(v1.1.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
- version: v1.1.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.1.0) → R2 PATCH++(v1.1.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---
covers_code:
  - src/store/storeRegistry.ts
  - src/services/serviceRegistry.ts
  - src/cockpit/core/widgetRegistry.ts
  - src/constants/cockpit.constants.ts
  - src/store/helpers/withBroadcast.ts
  - src/components/componentRegistry.ts


# V9 模块注册体系索引

> **版本**: v1.1.0 | **日期**: 2026-07-05 | **对应代码版本**: v2.5.0
> **适用范围**: Store / Component / Widget 三层注册体系

---

## 一、注册体系全景

V9 项目采用**集中注册表 + 分散实现**的模块管理模式。每层通过独立的 Registry 文件提供模块发现、状态追踪和元数据查询能力。

```
┌─────────────────────────────────────────────────────────┐
│                    注册体系全景                           │
├──────────────┬──────────────────┬──────────┬─────────────┤
│ Widget 注册   │ Store 注册        │ Service 注册│ Component 注册│
│ widgetRegistry│ ~~storeRegistry~~ │ ~~serviceRegistry~~│ componentRegistry│
│ 21 个 Widget  │ 47 个 Store      │ 52 个 Service│ 10 个组件     │
│ 运行时注册     │ 已删除，待重建     │ 已删除       │ 静态清单      │
└──────────────┴──────────────────┴──────────┴─────────────┘
```

---

## 二、各注册表详情

### 2.1 Widget 注册表

| 属性 | 值 |
|------|-----|
| **文件** | `src/cockpit/core/widgetRegistry.ts` |
| **模式** | Class 单例，运行时注册 |
| **配置** | `src/constants/cockpit.constants.ts`（DEFAULT_WIDGET_CONFIG + WIDGET_DEFAULT_DATA_SOURCE） |
| **条目数** | 21 个 Widget（14 个核心 + 7 个系统监控/高级分析） |
| **状态** | 全部 active |

**注册格式**：
```typescript
interface WidgetTemplate {
  meta: WidgetMeta          // { id, name, category, description, defaultSize, defaultDataSource }
  component: () => Promise<{ default: React.ComponentType }>  // 懒加载
  configPanel?: () => Promise<{ default: React.ComponentType }>
}
```

**v2.3.0 新增 Widget（8 个）**：

| ID | 名称 | 分类 | 默认尺寸 |
|----|------|------|---------|
| `agentPerformance` | 智能体性能追踪 | 系统监控 | 2×2 |
| `engineStatus` | 引擎状态监控 | 系统监控 | 1×1 |
| `systemArchitecture` | 系统架构视图 | 系统监控 | 2×2 |
| `pnlAnalysis` | 盈亏分析 | 交易分析 | 2×2 |
| `positionControl` | 仓位控制 | 投资组合 | 2×2 |
| `riskMonitor` | 风险监控 | 系统监控 | 2×2 |
| `signalMonitor` | 信号监控 | 交易分析 | 1×2 |

### 2.2 Store 注册表（已删除，待重建）

> **注意**：`src/store/storeRegistry.ts` 已删除（因数据损坏移除），当前 47 个 Store 以独立文件形式存在于 `src/store/` 目录，各自独立导出。

| 属性 | 值 |
|------|-----|
| **文件** | ~~`src/store/storeRegistry.ts`~~（已删除，待重建）；当前 `src/store/*.ts`（47 个独立 Zustand Store 文件） |
| **辅助** | `src/store/helpers/withBroadcast.ts`（跨 Tab 广播 HOC）、`withOptimisticUpdate.ts` |
| **条目数** | 47 个 Store |
| **查询函数** | 各 Store 独立导出，通过 `helpers/withBroadcast` 统一广播 |

**原注册格式**（已删除，仅供参考）：
```typescript
interface StoreRegistryEntry {
  id: string              // Store 唯一标识
  name: string            // 显示名称
  domain: StoreDomain     // 域分类：market/analysis/trading/portfolio/system/cockpit/input/signal/widget
  description: string     // 功能描述
  status: StoreStatus     // active | available | deprecated
  broadcastChannel?: string  // EventBus 广播通道
  importPath: string      // 懒加载导入路径
}
```

**Store 完整清单（47 个）**：

| 序号 | Store 文件 | 域 | 说明 |
|:---:|-----------|-----|------|
| 1 | `analysisStore` | analysis | 分析主状态 |
| 2 | `analysisHubStore` | analysis | 分析中心聚合状态 |
| 3 | `analysisNewsStore` | analysis | 分析资讯状态 |
| 4 | `hotSectorStore` | analysis | 热门板块评分 |
| 5 | `industryScoreStore` | analysis | 行业评分 |
| 6 | `intelligentScoreStore` | analysis | 智能评分 |
| 7 | `localKnowledgeStore` | analysis | 本地知识库 |
| 8 | `multiFactorScreeningStore` | analysis | 多因子筛选 |
| 9 | `rotationSignalStore` | signal | 板块轮动信号 |
| 10 | `riskStore` | signal | 风险指标计算 |
| 11 | `scoreDocStore` | analysis | 评分文档版本 |
| 12 | `sectorAnalysisStore` | analysis | 板块分析 |
| 13 | `signalAdviceStore` | signal | 信号建议 |
| 14 | `signalQualityStore` | signal | 信号质量评分 |
| 15 | `signalStore` | signal | 交易信号 |
| 16 | `stockAnalysisStore` | analysis | 股票分析 |
| 17 | `valuePitStore` | analysis | 价值洼地评分 |
| 18 | `backtestStore` | trading | 回测引擎 |
| 19 | `disciplineStore` | trading | 交易纪律 |
| 20 | `dualStrategyStore` | trading | 双策略引擎 |
| 21 | `executionStore` | trading | 执行管理 |
| 22 | `holdingsStore` | trading | 持仓查询 |
| 23 | `orderStore` | trading | 订单管理 |
| 24 | `portfolioStore` | trading | 投资组合 |
| 25 | `positionStore` | trading | 仓位管理 |
| 26 | `strategySnapshotStore` | trading | 策略快照 |
| 27 | `tradingHubStore` | trading | 交易中心 |
| 28 | `tradingStore` | trading | 交易基础状态 |
| 29 | `inputHubStore` | input | 输入中心 |
| 30 | `poolStore` | input | 股票池 |
| 31 | `watchlistStore` | input | 自选股 |
| 32 | `outputStore` | output | 输出舱 |
| 33 | `workflowStore` | output | 工作流 |
| 34 | `agentFeedbackStore` | system | 智能体反馈 |
| 35 | `agentStore` | system | 智能体管理 |
| 36 | `chatStore` | cockpit | LLM 聊天状态 |
| 37 | `commandStore` | system | 命令管理 |
| 38 | `databridgeStore` | system | DataBridge 网关状态 |
| 39 | `dataflowStore` | system | 数据流引擎状态 |
| 40 | `dataTestStore` | system | 数据测试 |
| 41 | `engineStore` | system | 引擎状态 |
| 42 | `marketDataStore` | market | 行情数据 |
| 43 | `mcpServerStore` | system | MCP 服务器 |
| 44 | `pageStore` | system | 页面状态 |
| 45 | `sevenDimConfigStore` | system | 采集维度配置（历史沿用“七维”命名，实际十六维） |
| 46 | `systemMonitorStore` | system | 系统监控 |
| 47 | `widgetStore` | widget | Widget 实例状态 |

### 2.3 Service 注册表（已废弃）

> **注意**：`src/services/serviceRegistry.ts` 已删除（agent 残留孤立文件），原四层注册体系调整为三层。Service 层模块通过 `docs/REGISTRY_INDEX.md` 和代码目录结构管理。

| 属性 | 值 |
|------|-----|
| **文件** | ~~`src/services/serviceRegistry.ts`~~（已删除） |
| **模式** | ~~静态清单 `SERVICE_REGISTRY`~~ |
| **条目数** | ~~52 个 Service（47 active + 2 available + 3 mock）~~ |
| **查询函数** | ~~`getServicesByDomain()` / `getServicesByStatus()` / `getServiceById()` / `getServiceStats()`~~ |

**注册格式**：
```typescript
interface ServiceRegistryEntry {
  id: string              // Service 唯一标识
  name: string            // 显示名称
  domain: ServiceDomain   // 21 个域分类
  description: string     // 功能描述
  status: ServiceStatus   // active | available | mock | deprecated
  importPath: string      // 导入路径
  exports?: string[]      // 主要导出函数
  dependsOn?: string[]    // 依赖的其他 Service
}
```

### 2.4 Component 注册表

| 属性 | 值 |
|------|-----|
| **文件** | `src/components/componentRegistry.ts` |
| **模式** | 静态清单 `COMPONENT_REGISTRY` |
| **条目数** | 10 个业务组件（全部 available） |
| **查询函数** | `getComponentsByDomain()` / `getComponentsByStatus()` / `getComponentById()` / `getComponentsByType()` |

**注册格式**：
```typescript
interface ComponentRegistryEntry {
  id: string              // 组件名（PascalCase）
  name: string            // 显示名称
  domain: ComponentDomain // system / analysis / shared / ui
  description: string     // 功能描述
  status: ComponentStatus // active | available | deprecated
  importPath: string      // 导入路径
  componentType: 'page-section' | 'panel' | 'chart' | 'form' | 'layout' | 'utility'
  suggestedTarget?: string  // 建议集成目标页面
}
```

**v2.3.0 已集成组件（10 个 → 全部接入目标页面）**：

| 组件 | 集成目标 | 集成方式 |
|------|---------|---------|
| `LogStreamPanel` | CommandApp 系统监控区 | 直接渲染 |
| `AgentTaskList` | CommandApp 系统监控区 | 直接渲染 |
| `LLMConfigWidget` | ConfigApp 配置管理 | 受控模式 + localStorage |
| `WidgetErrorBoundary` | CockpitShell WidgetWrapper | 异常降级包裹 |
| `AnalysisTemplateCards` | AnalysisApp 默认视图 | V6ScoreCard 之前 |
| `NewsSentimentTrend` | NewsPage | 资讯列表之后 |
| `ScoreHistoryPanel` | StockAnalysisPage | Card 之后 |
| `MultiPeriodTrendChart` | IntelligentScorePage | 趋势数据加载 |
| `IntelligentScoreExplanation` | IntelligentScorePage | 评分结果解释 |
| `initPWA()` | bootstrapService | 启动链路 |

### 2.5 UseCase 模块

| 属性 | 值 |
|------|-----|
| **目录** | `src/services/useCase/` |
| **模式** | 跨域业务用例，编排多个 Service 完成复杂业务流程 |
| **条目数** | 11 个 UseCase |

| 序号 | 文件名 | 说明 |
|:---:|--------|------|
| 1 | `getUnifiedStockView.useCase.ts` | 统一股票视图聚合 |
| 2 | `fetchSectorAnalysis.useCase.ts` | 板块分析数据获取 |
| 3 | `createExecutionPlan.useCase.ts` | 创建执行计划 |
| 4 | `fetcherOrchestrator.useCase.ts` | 数据获取编排器 |
| 5 | `rebalancePortfolio.useCase.ts` | 投资组合再平衡 |
| 6 | `hotSectorQuery.useCase.ts` | 热门板块查询 |
| 7 | `executePlan.useCase.ts` | 执行计划执行 |
| 8 | `submitOrder.useCase.ts` | 提交订单 |
| 9 | `generateTradeReview.useCase.ts` | 交易复盘生成 |
| 10 | `runDualStrategy.useCase.ts` | 双策略运行 |
| 11 | `strategySnapshotSave.useCase.ts` | 策略快照保存 |

### 2.6 交易计算纯函数模块

| 属性 | 值 |
|------|-----|
| **目录** | `src/services/trading/` |
| **模式** | 无副作用纯函数，可独立测试，不依赖 Store 或 DataBridge |
| **条目数** | 6 个计算模块 |

| 序号 | 文件名 | 说明 |
|:---:|--------|------|
| 1 | `positionComputer.ts` | 仓位计算（持仓成本、盈亏、仓位比例） |
| 2 | `riskComputer.ts` | 风险指标计算（波动率、最大回撤、VaR） |
| 3 | `pnlComputer.ts` | 盈亏计算（已实现/未实现盈亏） |
| 4 | `positionSizer.ts` | 仓位尺寸管理（Kelly/固定比例/风险预算） |
| 5 | `portfolioBuilder.ts` | 投资组合构建器 |
| 6 | `tradeErrorClassifier.ts` | 交易错误分类器 |

---

## 三、注册状态流转

```
新模块创建
    │
    ▼
[available] ──→ 注册到对应 Registry ──→ 文档记录
    │
    ▼
集成到页面/组件
    │
    ▼
[active] ──→ 被生产代码引用
    │
    ▼
功能废弃
    │
    ▼
[deprecated] ──→ 标记待清理
```

---

## 四、维护规范

### 4.1 新增模块注册 SOP

1. 在对应层创建模块文件（遵循四步集成编码契约）
2. 在对应 Registry 中添加注册条目
3. 设置 `status: 'available'`
4. 集成到页面后更新为 `status: 'active'`
5. 运行 `npx tsc --noEmit` 验证

### 4.2 注册表查询（DevTools 集成）

```typescript
// import { getStoreStats } from '@/store/storeRegistry'         // ❌ 已删除，待重建
// import { getServiceStats } from '@/services/serviceRegistry'   // ❌ 已删除
import { getComponentStats } from '@/components/componentRegistry'

// 获取全局模块统计
// console.log(getStoreStats())     // ❌ storeRegistry 已删除，待重建
// console.log(getServiceStats())   // ❌ serviceRegistry 已删除
console.log(getComponentStats()) // { total: 10, active: 0, available: 10, ... }
```

### 4.3 与审计脚本的关系

- `audit:deadcode` 检查页面注册（routes.ts + apps/ + portal/）
- `audit:layers` 检查跨层调用合规性
- Registry 提供模块元数据，未来可扩展 `audit:registry` 检查注册完整性

---

## 六、文档 Frontmatter 注册表（Doc ID Registry · SOP Suite）

> **本节目的**：为整套 SOP Suite（docs/guides/sops/ 8 篇文档）建立 doc_id → 路径 → 关联代码/文档 的双向索引，供 `audit:doc-id` / `audit:doc-id-reverse` 脚本查询，避免文档孤岛。  
> **格式**：每行 = 1 个 `V9-DOC-SOP-*` 文档。

| doc_id | 标题（中文） | 路径（相对仓库根） | covers_docs（引用的文档路径） | covers_code（引用的真相源代码/脚本） |
|--------|------------|------------------|--------------------------|-----------------------------------|
| **V9-DOC-SOP-000** | SDLC 七阶段 SOP 总览 | `docs/guides/sops/README.md` | S01~S07 全部正文 | AGENTS.md、package.json、.husky/pre-commit、.husky/pre-push、scripts/env-path-guard.cjs、scripts/ensure-venv.cjs、scripts/run-venv-python.cjs |
| **V9-DOC-SOP-001** | 开发环境搭建 SOP | `docs/guides/sops/S01-dev-env-setup.md` | docs/guides/how-to/how-to-troubleshooting.md、docs/guides/how-to/git-commit-governance.md | .nvmrc、AGENTS.md §十六、scripts/ensure-venv.cjs、scripts/run-venv-python.cjs、.vscode/extensions.json、.vscode/settings.json |
| **V9-DOC-SOP-002** | 日常开发与提交 SOP | `docs/guides/sops/S02-dev-workflow.md` | docs/guides/how-to/git-commit-governance.md、docs/guides/09-quality-gates.md | AGENTS.md §七（22 步门禁）、package.json scripts、.husky/pre-commit、.husky/pre-push、.husky/commit-msg、PULL_REQUEST_TEMPLATE.md |
| **V9-DOC-SOP-003** | 代码审查 SOP | `docs/guides/sops/S03-code-review.md` | docs/guides/module-completion-standard.md、docs/guides/how-to/git-commit-governance.md、docs/guides/09-quality-gates.md | .github/CODEOWNERS、src/**/*.ts(x) type exports、tests/**、docs/reports/code-review/ 归档 |
| **V9-DOC-SOP-004** | 合并前集成测试 SOP | `docs/guides/sops/S04-pre-merge-integration.md` | docs/guides/how-to/how-to-use-audit-scripts.md、docs/guides/module-completion-standard.md、docs/guides/testing-strategy.md、docs/guides/09-quality-gates.md | package.json gate:quick/test:stable/test:e2e-verify/test:ci/audit:layers/audit:acl-consistency、tsconfig.prod.json、tests/quarantine.list |
| **V9-DOC-SOP-005** | 上线前全面体检 SOP | `docs/guides/sops/S05-pre-launch-checklist.md` | docs/guides/09-quality-gates.md、docs/guides/how-to/how-to-use-audit-scripts.md、docs/guides/testing-strategy.md、docs/reports/上线前全面校验报告-v2.0.0.md、AGENTS.md v1.6.0 | AGENTS.md §七 全量、package.json 全部 audit:* / tsc:* / test:* / validate:* / complexity-scan、.env.example、tests/e2e-verify-25stocks.integration.test.ts、scripts/build-health-report.ts |
| **V9-DOC-SOP-006** | 版本发布与部署 SOP | `docs/guides/sops/S06-release-deployment.md` | docs/reports/testing/DEPLOYMENT-CHECKLIST-2026-08-14.md、docs/guides/sops/S05-pre-launch-checklist.md、docs/guides/how-to/git-commit-governance.md | package.json build / verify:* / scripts/build-manifest.cjs、scripts/verify-build-sri.cjs、CHANGELOG.md、dist/（构建产物）、Edge Pages CLI 配置 |
| **V9-DOC-SOP-007** | 上线后运维与应急 SOP | `docs/guides/sops/S07-ops-incident-response.md` | docs/guides/how-to/how-to-troubleshooting.md、docs/guides/sops/S06-release-deployment.md | Sentry SDK 接入代码、scripts/ops/logs-locate-fast.cjs、docs/reports/rca/ 归档目录、飞书 Bot Webhook 配置 |

**合计注册条目**：`8 条`（1 条总览 + 7 条正文 SOP）。与 docs/guides/sops/README.md §六「双向引用说明」对齐。

---

## 五、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|---------|
| v1.2.0 | 2026-08-19 | 新增 §六 文档 Doc ID 注册表（SOP Suite）：注册 V9-DOC-SOP-000 ~ 007 共 8 条 SOP，建立 doc_id ↔ 路径 ↔ covers_code/docs 四向交叉索引。 |
| v1.1.0 | 2026-07-05 | Store 注册表更新为实际 47 个 Zustand Store 完整清单；新增 §2.5 UseCase 模块（11 个）；新增 §2.6 交易计算纯函数模块（6 个）；修正 Store 注册表文件路径与查询方式 |
| v1.0.0 | 2026-07-05 | 初始版本：三层注册体系文档化（Widget/Store/Component） |
