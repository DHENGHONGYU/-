---
doc_id: V9-DOC-REF-909
title: ai-center-data-definition
tier: important
code_version: "2.0.0-rc.1"
version: v1.2.1
last_updated: 2026-08-15
change_log:
  - version: v1.2.1
    changes: "2026-08-15 系统性核对：与 src/constants/ai-center.constants.ts、src/types/modules/ai-center.types.ts 对齐，字段无漂移；登记为 reference 视图，权威 SSOT 转向 docs/reference/data-dictionary-index.md v1.1.0。"
    date: 2026-08-15
  - version: v1.2.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-06
---


> **Version**: v1.2.1  
> **Last Updated**: 2026-08-15  
> **Maintainer**: 架构资产治理官

# AI 智能体调度中心 / 健康监控 / 诊断分析 — 数据字典

> 生成日期：2026-06-26
> 模块范围：`src/constants/ai-center.constants.ts` · `src/constants/health.constants.ts` · `src/types/modules/ai-center.types.ts` · `src/services/ai-center/`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码状态、颜色、标签，必须从此字典对应的 constants 文件引用。

---

## 一、TypeScript 接口定义

### 1.1 AgentItem — AI 智能体条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | - | 智能体唯一标识 |
| `type` | `string` | 是 | `agentAssistant` / `stockStrategy` / `llmIntegration` / `knowledgeRetrieval` | 智能体类型 key，对应 `AGENT_TYPE_MAP` |
| `name` | `string` | 是 | - | 显示名称 |
| `tags` | `AgentTag[]` | 是 | `LLM` / `KNOWLEDGE` / `TOOL` / `STRATEGY` | 标签列表，见 §2.2 |
| `description` | `string` | 是 | - | 智能体描述 |
| `callCount` | `number` | 是 | ≥ 0 | 运行/调用次数 |
| `status` | `AgentStatus` | 是 | `NORMAL` / `WARNING` / `ERROR` / `PAUSED` | 当前状态，见 §2.1 |
| `lastActiveAt` | `number` | 是 | 毫秒时间戳 | 最后活跃时间 |
| `knowledgeUsage` | `number` | 否 | ≥ 0 | 知识库使用次数（用于总览） |

### 1.2 AgentOverviewMetrics — 顶部总览指标

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `totalAgents` | `number` | 是 | ≥ 0 | 智能体总数 |
| `knowledgeUsage` | `number` | 是 | ≥ 0 | 知识库使用总次数 |
| `taskExecutions` | `number` | 是 | ≥ 0 | 任务执行总次数 |
| `monitorAlerts` | `number` | 是 | ≥ 0 | 监控告警数量 |

### 1.3 AgentListData — Agent 列表数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `agents` | `AgentItem[]` | 是 | - | 当前页 Agent 列表 |
| `overview` | `AgentOverviewMetrics` | 是 | - | 顶部总览指标 |
| `total` | `number` | 是 | ≥ 0 | 总条数 |
| `page` | `number` | 是 | ≥ 1 | 当前页码 |
| `pageSize` | `number` | 是 | ≥ 1 | 每页条数 |

### 1.4 HealthMetricItem — 健康指标条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | - | 模块唯一标识 |
| `name` | `string` | 是 | - | 模块名称 |
| `category` | `HealthModuleCategory` | 是 | `CORE` / `SYSTEM` / `AGENT` / `DATA` | 模块分类，见 §2.4 |
| `healthScore` | `number` | 是 | 0 ~ 100 | 健康度百分比 |
| `status` | `HealthStatus` | 是 | `HEALTHY` / `WARNING` / `CRITICAL` / `UNKNOWN` | 状态，见 §2.3 |
| `extra` | `Record<string, number \| string>` | 否 | - | 附加指标（成功率、响应时间等） |
| `checkedAt` | `number` | 是 | 毫秒时间戳 | 最后检测时间 |

### 1.5 HealthMetricsData — 健康监控数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `metrics` | `HealthMetricItem[]` | 是 | - | 各模块健康指标 |
| `overallScore` | `number` | 是 | 0 ~ 100 | 整体健康评分 |
| `overallStatus` | `HealthStatus` | 是 | 见 §2.3 | 整体状态 |
| `lastUpdatedAt` | `number` | 是 | 毫秒时间戳 | 最后更新时间 |

### 1.6 DiagnosticReportItem — 诊断报告条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | - | 诊断项 ID |
| `name` | `string` | 是 | - | 诊断项名称 |
| `module` | `string` | 是 | - | 所属模块 |
| `healthScore` | `number` | 是 | 0 ~ 100 | 健康评分 |
| `successRate` | `number` | 是 | 0 ~ 100 | 成功率 |
| `stabilityScore` | `number` | 是 | 0 ~ 100 | 稳定性评分 |
| `level` | `DiagnosticLevel` | 是 | `EXCELLENT` / `GOOD` / `AVERAGE` / `POOR` | 综合等级，见 §2.5 |
| `detail` | `string` | 否 | - | 诊断详情 |
| `reportedAt` | `number` | 是 | 毫秒时间戳 | 诊断时间 |

### 1.7 DiagnosticReportsData — 诊断分析数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `reports` | `DiagnosticReportItem[]` | 是 | - | 诊断报告列表 |
| `overallLevel` | `DiagnosticLevel` | 是 | 见 §2.5 | 整体等级 |
| `lastUpdatedAt` | `number` | 是 | 毫秒时间戳 | 最后更新时间 |

### 1.8 AICenterData — AI 中心统一数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `agents` | `AgentListData` | 是 | - | 智能体列表与总览 |
| `healthMetrics` | `HealthMetricsData` | 是 | - | 健康监控 |
| `diagnosticReports` | `DiagnosticReportsData` | 是 | - | 诊断分析 |

---

## 二、枚举常量定义

### 2.1 AgentStatus — Agent 运行状态

| 枚举值 | 中文标签 | 颜色 | Tailwind 背景类 | Tailwind 文字类 | 图标 |
|--------|----------|------|-----------------|-----------------|------|
| `NORMAL` | 正常 | `#22c55e` | `bg-green-500` | `text-green-500` | `check-circle` |
| `WARNING` | 预警 | `#f59e0b` | `bg-amber-500` | `text-amber-500` | `alert-triangle` |
| `ERROR` | 异常 | `#ef4444` | `bg-red-500` | `text-red-500` | `x-circle` |
| `PAUSED` | 已暂停 | `#9ca3af` | `bg-gray-400` | `text-gray-400` | `pause-circle` |

### 2.2 AgentTag — Agent 标签

| 枚举值 | 中文标签 | 颜色 | Tailwind 背景类 | 图标 |
|--------|----------|------|-----------------|------|
| `LLM` | LLM模型 | `#8b5cf6` | `bg-violet-500` | `brain` |
| `KNOWLEDGE` | 知识库 | `#3b82f6` | `bg-blue-500` | `book-open` |
| `TOOL` | 工具链 | `#10b981` | `bg-emerald-500` | `wrench` |
| `STRATEGY` | 策略 | `#f59e0b` | `bg-amber-500` | `trending-up` |

### 2.3 HealthStatus — 健康状态

| 枚举值 | 中文标签 | 颜色 | Tailwind 背景类 | Tailwind 文字类 | 图标 |
|--------|----------|------|-----------------|-----------------|------|
| `HEALTHY` | 正常 | `#22c55e` | `bg-green-500` | `text-green-500` | `check-circle` |
| `WARNING` | 预警 | `#f59e0b` | `bg-amber-500` | `text-amber-500` | `alert-triangle` |
| `CRITICAL` | 异常 | `#ef4444` | `bg-red-500` | `text-red-500` | `x-circle` |
| `UNKNOWN` | 未知 | `#9ca3af` | `bg-gray-400` | `text-gray-400` | `help-circle` |

### 2.4 HealthModuleCategory — 健康模块分类

| 枚举值 | 中文标签 |
|--------|----------|
| `CORE` | 核心模块 |
| `SYSTEM` | 系统组件 |
| `AGENT` | 智能体 |
| `DATA` | 数据服务 |

### 2.5 DiagnosticLevel — 诊断等级

| 枚举值 | 中文标签 | 颜色 | Tailwind 背景类 |
|--------|----------|------|-----------------|
| `EXCELLENT` | 优秀 | `#22c55e` | `bg-green-500` |
| `GOOD` | 良好 | `#3b82f6` | `bg-blue-500` |
| `AVERAGE` | 一般 | `#f59e0b` | `bg-amber-500` |
| `POOR` | 较差 | `#ef4444` | `bg-red-500` |

### 2.6 评分阈值

| 常量 | 值 | 说明 |
|------|-----|------|
| `HEALTH_SCORE_THRESHOLDS.EXCELLENT` | `90` | ≥ 90 为优秀/健康 |
| `HEALTH_SCORE_THRESHOLDS.GOOD` | `75` | ≥ 75 为良好 |
| `HEALTH_SCORE_THRESHOLDS.WARNING` | `60` | ≥ 60 为预警；< 60 为异常/较差 |

---

## 三、服务端 statusCode 映射关系

### 3.1 AgentStatus 映射

| 服务端 statusCode | 前端枚举 |
|-------------------|----------|
| `NORMAL` / `0` | `AGENT_STATUS.NORMAL` |
| `WARNING` / `1` | `AGENT_STATUS.WARNING` |
| `ERROR` / `2` | `AGENT_STATUS.ERROR` |
| `PAUSED` / `3` | `AGENT_STATUS.PAUSED` |

### 3.2 HealthStatus 映射

| 服务端 statusCode | 前端枚举 |
|-------------------|----------|
| `HEALTHY` / `0` | `HEALTH_STATUS.HEALTHY` |
| `WARNING` / `1` | `HEALTH_STATUS.WARNING` |
| `CRITICAL` / `2` | `HEALTH_STATUS.CRITICAL` |
| `UNKNOWN` / `3` | `HEALTH_STATUS.UNKNOWN` |

---

## 四、引用约束

1. 组件内禁止出现 `'正常'`、`'异常'`、`#22c55e`、`bg-green-500` 等硬编码值。
2. Agent 状态一律使用 `AI_AGENT_STATUS_MAP[agent.status]`。
3. 健康状态一律使用 `HEALTH_STATUS_MAP[metric.status]`。
4. Agent 标签一律使用 `AGENT_TAG_MAP[tag]`。
5. 图标类型由常量中的 `icon` 字段驱动，组件内仅负责根据 `icon` 名称渲染对应图标组件。

---

## 五、Agent 运行时类型（补充）

> 以下为 `src/types/modules/agent.types.ts` 中 Agent 运行时核心类型，与 AI Center 数据字典关联。

### 5.1 AgentModuleInput — Agent 模块输入

**来源**: `src/types/modules/agent.types.ts:7-15`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | 是 | 智能体唯一标识 |
| `type` | `string` | 是 | 智能体类型 |
| `payload` | `Record<string, unknown>` | 是 | 任务载荷 |
| `options.timeout` | `number` | 否 | 超时时间（毫秒） |
| `options.priority` | `number` | 否 | 优先级 |

### 5.2 AgentModuleOutput — Agent 模块输出

**来源**: `src/types/modules/agent.types.ts:17-23`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务唯一标识 |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'timeout'` | 是 | 任务状态 |
| `result` | `Record<string, unknown>` | 否 | 执行结果 |
| `error` | `string` | 否 | 错误信息 |
| `executionTimeMs` | `number` | 是 | 执行耗时（毫秒） |

### 5.3 AgentDefinition — Agent 定义

**来源**: `src/types/modules/agent.types.ts:25-33`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 智能体 ID |
| `name` | `string` | 是 | 名称 |
| `description` | `string` | 是 | 描述 |
| `type` | `string` | 是 | 类型 |
| `version` | `string` | 是 | 版本号 |
| `capabilities` | `Array<{ id, name, description }>` | 是 | 能力列表 |
| `metadata.tags` | `string[]` | 是 | 标签列表 |
| `metadata.config` | `Record<string, unknown>` | 是 | 配置项 |

### 5.4 AgentInstance — Agent 运行实例

**来源**: `src/types/modules/agent.types.ts:35-43`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | 是 | 实例唯一标识 |
| `agentId` | `string` | 是 | 关联 Agent 定义 ID |
| `name` | `string` | 是 | 实例名称 |
| `status` | `'idle' \| 'running' \| 'completed' \| 'failed' \| 'stopped'` | 是 | 运行状态 |
| `startTime` | `number` | 是 | 启动时间（毫秒时间戳） |
| `lastHeartbeat` | `number` | 是 | 最后心跳（毫秒时间戳） |
| `stats.totalTasks` | `number` | 是 | 总任务数 |
| `stats.successTasks` | `number` | 是 | 成功任务数 |
| `stats.failedTasks` | `number` | 是 | 失败任务数 |
| `stats.avgExecutionTime` | `number` | 是 | 平均执行时间 |

### 5.5 AgentHealthSnapshot — Agent 健康快照

**来源**: `src/types/modules/agent.types.ts:51-66`
**用途**: 单个 Agent 的健康状态快照，用于监控面板

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | 是 | 智能体唯一标识 |
| `agentName` | `string` | 是 | 智能体名称（冗余字段） |
| `name` | `string` | 是 | 显示名称 |
| `status` | `'healthy' \| 'warning' \| 'critical' \| 'unknown'` | 是 | 健康状态 |
| `lastHeartbeat` | `number` | 是 | 最后心跳（毫秒时间戳） |
| `taskCount` | `number` | 是 | 当前任务数 |
| `totalTasks` | `number` | 是 | 累计任务总数 |
| `errorCount` | `number` | 是 | 错误计数 |
| `failureRate` | `number` | 是 | 失败率 0-1 |
| `uptime` | `number` | 是 | 运行时间（毫秒） |
| `avgExecutionTime` | `number` | 是 | 平均执行时间（毫秒） |
| `consecutiveFailures` | `number` | 是 | 连续失败次数 |
| `maxConcurrent` | `number` | 是 | 最大并发数 |
| `defaultTimeout` | `number` | 是 | 默认超时（毫秒） |

### 5.6 AgentTaskHistoryEntry — Agent 任务历史条目

**来源**: `src/types/modules/agent.types.ts:69-79`
**用途**: 单个 Agent 任务的执行历史记录

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务唯一标识 |
| `agentId` | `string` | 是 | 关联 Agent ID |
| `type` | `string` | 是 | 任务类型 |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'timeout'` | 是 | 任务状态 |
| `createdAt` | `number` | 是 | 创建时间（毫秒时间戳） |
| `startedAt` | `number` | 否 | 开始执行时间 |
| `completedAt` | `number` | 否 | 完成时间 |
| `durationMs` | `number` | 否 | 执行耗时（毫秒） |
| `error` | `string` | 否 | 错误信息 |

### 5.7 AgentMetricsSummary — Agent 指标汇总

**来源**: `src/types/modules/agent.types.ts:82-94`
**用途**: 所有 Agent 的聚合指标汇总

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalAgents` | `number` | 是 | Agent 总数 |
| `healthyCount` | `number` | 是 | 健康数量 |
| `warningCount` | `number` | 是 | 预警数量 |
| `criticalCount` | `number` | 是 | 异常数量 |
| `totalTasks` | `number` | 是 | 任务总数 |
| `successTasks` | `number` | 是 | 成功任务数 |
| `failedTasks` | `number` | 是 | 失败任务数 |
| `runningTasks` | `number` | 是 | 运行中任务数 |
| `pendingTasks` | `number` | 是 | 等待中任务数 |
| `avgFailureRate` | `number` | 是 | 平均失败率 |
| `avgExecutionTime` | `number` | 是 | 平均执行时间（毫秒） |

### 5.8 SystemMonitorSnapshot — 系统监控快照

**来源**: `src/types/modules/agent.types.ts:97-107`
**用途**: 系统级监控快照，聚合 Agent 系统全部运行时状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | `number` | 是 | 快照时间（毫秒时间戳） |
| `agentSystemInitialized` | `boolean` | 是 | Agent 系统是否已初始化 |
| `agentMetrics` | `AgentMetricsSummary` | 是 | Agent 指标汇总 |
| `agentHealthSnapshots` | `AgentHealthSnapshot[]` | 是 | 各 Agent 健康快照列表 |
| `recentTasks` | `AgentTaskHistoryEntry[]` | 是 | 最近任务历史 |
| `eventBusStats.totalEvents` | `number` | 是 | EventBus 总事件数 |
| `eventBusStats.totalListeners` | `number` | 是 | EventBus 总监听器数 |

### 5.9 AgentTriggerPayload — Agent 任务触发参数

**来源**: `src/types/modules/agent.types.ts:114-120`
**用途**: 手动触发 Agent 执行时的输入参数

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | 是 | 目标 Agent ID |
| `toolName` | `string` | 是 | 工具名称 |
| `serverName` | `string` | 是 | MCP Server 名称 |
| `args` | `Record<string, unknown>` | 是 | 工具调用参数 |
| `timeout` | `number` | 否 | 超时时间（毫秒） |

### 5.10 AgentTaskFilter — Agent 任务筛选

**来源**: `src/types/modules/agent.types.ts:123-127`
**用途**: 查询 Agent 任务历史时的筛选条件

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | 否 | 按 Agent ID 筛选 |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'timeout'` | 否 | 按状态筛选 |
| `dateRange` | `{ start: number; end: number }` | 否 | 按时间范围筛选 |

### 5.11 MCPCallRecord — MCP 调用记录

**来源**: `src/types/modules/agent.types.ts:130-141`
**用途**: 单次 MCP 工具调用的完整记录

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 记录唯一标识 |
| `taskId` | `string` | 是 | 关联任务 ID |
| `serverName` | `string` | 是 | MCP Server 名称 |
| `toolName` | `string` | 是 | 工具名称 |
| `args` | `Record<string, unknown>` | 是 | 调用参数 |
| `result` | `unknown` | 否 | 调用结果 |
| `error` | `string` | 否 | 错误信息 |
| `startedAt` | `number` | 是 | 开始时间（毫秒时间戳） |
| `completedAt` | `number` | 否 | 完成时间 |
| `durationMs` | `number` | 否 | 调用耗时（毫秒） |

### 5.12 AgentFeedback — Agent 反馈

**来源**: `src/types/modules/agent.types.ts:148-157`
**用途**: 用户对 Agent 执行结果的反馈评价

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 反馈唯一标识 |
| `taskId` | `string` | 是 | 关联任务 ID |
| `agentId` | `string` | 是 | 关联 Agent ID |
| `rating` | `1 \| 2 \| 3 \| 4 \| 5` | 是 | 评分（1-5 星） |
| `comment` | `string` | 是 | 评论内容 |
| `category` | `'accuracy' \| 'speed' \| 'usability' \| 'feature'` | 是 | 反馈分类 |
| `createdAt` | `number` | 是 | 创建时间（毫秒时间戳） |
| `resolved` | `boolean` | 是 | 是否已处理 |

### 5.13 AgentFeedbackSummary — Agent 反馈汇总

**来源**: `src/types/modules/agent.types.ts:160-165`
**用途**: 单个 Agent 的反馈聚合统计

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | 是 | 关联 Agent ID |
| `averageRating` | `number` | 是 | 平均评分 |
| `totalFeedback` | `number` | 是 | 反馈总数 |
| `categoryBreakdown` | `Record<string, number>` | 是 | 各分类反馈数量 |

---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆盖 AI Center 全部类型定义（8 个接口）与枚举常量（6 组） | Architecture Asset Governor |
| 2026-06-26 | v1.1.0 | 补充 §5 Agent 运行时类型（4 个接口：AgentModuleInput/Output/Definition/Instance） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | 补充 §5.5-§5.13 共 9 个 Agent 运行时类型（HealthSnapshot/TaskHistoryEntry/MetricsSummary/SystemMonitorSnapshot/TriggerPayload/TaskFilter/MCPCallRecord/Feedback/FeedbackSummary） | Architecture Asset Governor |
