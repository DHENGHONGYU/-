---
title: ai-center-contract
type: reference
domain: ai
phase: design
tier: important
status: draft
maintainer: 架构组
summary: "定义 ai-center 子域的接口契约、职责边界、数据流与依赖关系。"
tags: [ai, contract, reference, mcp, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-AI-010
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ai-center-contract.md — AI 中心接口契约

> **定位**：定义 `ai-center` 子域的接口契约、职责边界、数据流与依赖关系。  
> **Source**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **AI 中心数据提供**：提供 `AICenterProvider` 接口与 `MockAICenterProvider` 实现，统一输出智能体列表、系统健康监控、诊断分析三类数据。
- **智能体调度模拟**：基于 `AGENT_TYPE_MAP` 与 `AGENT_STATUS` 常量，生成本地模拟智能体数据（含运行状态、调用次数、标签、知识库使用次数）。
- **系统健康监控**：按 `HEALTH_MODULE_CATEGORY` 分类生成各模块健康评分、状态、附加指标（成功率、响应时间）及综合评分。
- **诊断分析报告**：按业务模块（量化选股、板块轮动、风险预警、知识检索、复盘生成）生成健康评分、成功率、稳定性评分及综合等级报告。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `types/modules/ai-center.types` | 类型依赖：消费 TypeScript 接口 | 类型定义 → `ai-center` |
| `constants/ai-center.constants` | 常量依赖：消费状态、标签、类型映射 | 常量 → `ai-center` |
| `constants/health.constants` | 常量依赖：消费健康状态、模块分类、诊断等级 | 常量 → `ai-center` |
| `store/ai-center` | 下游：待接入（目前无 Store 消费） | `ai-center` → `store/`（待实现） |

> **说明**：当前 `ai-center` 子域仅包含 `aiCenterProvider.ts`，尚无外部消费方。未来接入后端时，新增 REST/WebSocket 实现替换 `MockAICenterProvider` 即可，UI 与 Store 层无需改动。

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/types/modules/ai-center.types.ts

/** AI 智能体条目 */
export interface AgentItem {
  id: string
  type: string
  name: string
  tags: AgentTag[]
  description: string
  callCount: number
  status: AgentStatus
  lastActiveAt: number
  knowledgeUsage?: number
}

/** 顶部总览指标 */
export interface AgentOverviewMetrics {
  totalAgents: number
  knowledgeUsage: number
  taskExecutions: number
  monitorAlerts: number
}

/** Agent 列表数据 */
export interface AgentListData {
  agents: AgentItem[]
  overview: AgentOverviewMetrics
  total: number
  page: number
  pageSize: number
}

/** 健康指标条目 */
export interface HealthMetricItem {
  id: string
  name: string
  category: HealthModuleCategory
  healthScore: number
  status: HealthStatus
  extra?: Record<string, number | string>
  checkedAt: number
}

/** 健康监控数据 */
export interface HealthMetricsData {
  metrics: HealthMetricItem[]
  overallScore: number
  overallStatus: HealthStatus
  lastUpdatedAt: number
}

/** 诊断报告条目 */
export interface DiagnosticReportItem {
  id: string
  name: string
  module: string
  healthScore: number
  successRate: number
  stabilityScore: number
  level: DiagnosticLevel
  detail?: string
  reportedAt: number
}

/** 诊断分析数据 */
export interface DiagnosticReportsData {
  reports: DiagnosticReportItem[]
  overallLevel: DiagnosticLevel
  lastUpdatedAt: number
}

/** AI 中心统一数据 */
export interface AICenterData {
  agents: AgentListData
  healthMetrics: HealthMetricsData
  diagnosticReports: DiagnosticReportsData
}
```

### 2.2 主入口函数

| 函数/类 | 签名 | 职责 | 错误处理 |
|---------|------|------|----------|
| `AICenterProvider`（接口） | `{ getAICenterData: () => Promise<AICenterData> }` | 定义 AI 中心数据提供器契约 | — |
| `MockAICenterProvider` | `implements AICenterProvider` | Mock 实现：生成本地模拟数据 | 内部生成，无外部错误源 |
| `getAICenterData()` | `() => Promise<AICenterData>` | 返回智能体列表 + 健康监控 + 诊断分析 | 无（Mock 500ms 延迟后 resolve） |

> **工厂函数**：`getAICenterProvider()` 待实现（当前无工厂函数，直接实例化 `MockAICenterProvider`）。

### 2.3 事件接口

> **待实现**：当前 `ai-center` 子域未使用 `EventBus`。未来接入真实数据源时，建议补充以下事件：

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `ai-center:loaded` | `ai-center` | `store/aiCenterStore` | 数据加载完成 |
| `ai-center:error` | `ai-center` | `errorBus` | 数据加载失败 |

---

## 3. 数据流

```
[Mock 数据生成器]
    ↓
aiCenterProvider.ts (MockAICenterProvider.getAICenterData)
    ↓
Promise<AICenterData> 返回
    ↓ (待接入：DataBridge.forward() 路由)
DataBridge → routeToDB() → dataLayer → IndexedDB
    ↓ (待接入：EventBus)
aiCenterStore (Zustand + withBroadcast)
    ↓ (待接入：组件消费)
components/pages (仅经 Store 取数)
```

> **当前状态**：`ai-center` 子域目前为纯 Mock 数据层，尚未接入 `DataBridge` 与 `Store`。数据直接在 `MockAICenterProvider.getAICenterData()` 中生成并返回，无持久化与事件流转。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

> **当前状态**：`ai-center` 子域未使用 `lib/` 基础设施模块（`logger`、`eventBus`、`format`、`errors` 等）。未来接入真实后端时，建议补充 `logger` 与 `eventBus`。

| 依赖 | 路径 | 用途 |
|------|------|------|
| `nanoid` | `nanoid` (npm) | 生成智能体/诊断项唯一 ID |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `MOCK_AGENT_CALL_COUNT_RANGE` | `900` | Mock 智能体调用次数随机上限 | 模块内常量 |
| `MOCK_AGENT_CALL_COUNT_MIN` | `50` | Mock 智能体调用次数随机下限 | 模块内常量 |
| `AI_CENTER_DATA_SOURCE` | `{ agents: { endpoint: '/ai-center/agents', mode: 'polling', interval: 5000 }, ... }` | 默认数据源端点与轮询配置 | `src/constants/ai-center.constants.ts` |
| `AGENT_STATUS` | `{ NORMAL, WARNING, ERROR, PAUSED }` | 智能体状态枚举 | `src/constants/ai-center.constants.ts` |
| `AGENT_TAG` | `{ LLM, KNOWLEDGE, TOOL, STRATEGY }` | 智能体标签枚举 | `src/constants/ai-center.constants.ts` |
| `AGENT_TYPE_MAP` | 4 类智能体映射 | 类型/角色名称、图标、描述 | `src/constants/ai-center.constants.ts` |
| `HEALTH_STATUS` | `{ HEALTHY, WARNING, CRITICAL }` | 健康状态枚举 | `src/constants/health.constants.ts` |
| `HEALTH_MODULE_CATEGORY` | `{ CORE, SYSTEM, AGENT, DATA }` | 健康模块分类 | `src/constants/health.constants.ts` |
| `DIAGNOSTIC_LEVEL` | `{ EXCELLENT, GOOD, AVERAGE, POOR }` | 诊断等级枚举 | `src/constants/health.constants.ts` |

---

## 5. 测试策略

> **待实现**：当前 `ai-center` 子域无测试文件与 `__tests__` 目录。

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/ai-center/aiCenterProvider.ts` | 纯函数、数据生成逻辑（`generateAgentList`、`generateHealthMetrics`、`generateDiagnosticReports`） |
| 集成测试 | `tests/services/ai-center.integration.test.ts` | 待接入：DataBridge 交互、Store 联动 |
| Mock 策略 | `__mocks__/aiCenterProvider.ts` | 待接入：隔离外部依赖（未来 REST/WebSocket 实现） |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 按本契约接入 `DataBridge` 与 `Store`，完成数据持久化与事件流转。
> 2. 补充 `__tests__` 单元测试，覆盖 `MockAICenterProvider` 数据生成逻辑。
> 3. 接入真实后端时，实现 `getAICenterProvider()` 工厂函数与 REST/WebSocket 提供器。
> 4. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
