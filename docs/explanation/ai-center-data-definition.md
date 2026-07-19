---
title: DEPRECATED - ai-center-data-definition.md
type: explanation
domain: data
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "⚠️ 此文件已废弃�?026-07-14�?> 数据定义已整合至..."
tags: [data, data-definition, definition]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-070
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# DEPRECATED - ai-center-data-definition.md

> ⚠️ **此文件已废弃**�?026-07-14�?> 
> 数据定义已整合至 `docs/reference/data-dictionary-index.md`，请通过主索引访问最新定义�?
---

> **Version**: v1.2.0  
> **Last Updated**: 2026-07-06  
> **Maintainer**: 架构资产治理�?
# AI 智能体调度中�?/ 健康监控 / 诊断分析 �?数据字典

> 生成日期�?026-06-26
> 模块范围：`src/constants/ai-center.constants.ts` · `src/constants/health.constants.ts` · `src/types/modules/ai-center.types.ts` · `src/services/ai-center/`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码状态、颜色、标签，必须从此字典对应�?constants 文件引用�?
---

## 一、TypeScript 接口定义

### 1.1 AgentItem �?AI 智能体条�?
| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | �?| - | 智能体唯一标识 |
| `type` | `string` | �?| `agentAssistant` / `stockStrategy` / `llmIntegration` / `knowledgeRetrieval` | 智能体类�?key，对�?`AGENT_TYPE_MAP` |
| `name` | `string` | �?| - | 显示名称 |
| `tags` | `AgentTag[]` | �?| `LLM` / `KNOWLEDGE` / `TOOL` / `STRATEGY` | 标签列表，见 §2.2 |
| `description` | `string` | �?| - | 智能体描�?|
| `callCount` | `number` | �?| �?0 | 运行/调用次数 |
| `status` | `AgentStatus` | �?| `NORMAL` / `WARNING` / `ERROR` / `PAUSED` | 当前状态，�?§2.1 |
| `lastActiveAt` | `number` | �?| 毫秒时间�?| 最后活跃时�?|
| `knowledgeUsage` | `number` | �?| �?0 | 知识库使用次数（用于总览�?|

### 1.2 AgentOverviewMetrics �?顶部总览指标

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `totalAgents` | `number` | �?| �?0 | 智能体总数 |
| `knowledgeUsage` | `number` | �?| �?0 | 知识库使用总次�?|
| `taskExecutions` | `number` | �?| �?0 | 任务执行总次�?|
| `monitorAlerts` | `number` | �?| �?0 | 监控告警数量 |

### 1.3 AgentListData �?Agent 列表数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `agents` | `AgentItem[]` | �?| - | 当前�?Agent 列表 |
| `overview` | `AgentOverviewMetrics` | �?| - | 顶部总览指标 |
| `total` | `number` | �?| �?0 | 总条�?|
| `page` | `number` | �?| �?1 | 当前页码 |
| `pageSize` | `number` | �?| �?1 | 每页条数 |

### 1.4 HealthMetricItem �?健康指标条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | �?| - | 模块唯一标识 |
| `name` | `string` | �?| - | 模块名称 |
| `category` | `HealthModuleCategory` | �?| `CORE` / `SYSTEM` / `AGENT` / `DATA` | 模块分类，见 §2.4 |
| `healthScore` | `number` | �?| 0 ~ 100 | 健康度百分比 |
| `status` | `HealthStatus` | �?| `HEALTHY` / `WARNING` / `CRITICAL` / `UNKNOWN` | 状态，�?§2.3 |
| `extra` | `Record<string, number \| string>` | �?| - | 附加指标（成功率、响应时间等�?|
| `checkedAt` | `number` | �?| 毫秒时间�?| 最后检测时�?|

### 1.5 HealthMetricsData �?健康监控数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `metrics` | `HealthMetricItem[]` | �?| - | 各模块健康指�?|
| `overallScore` | `number` | �?| 0 ~ 100 | 整体健康评分 |
| `overallStatus` | `HealthStatus` | �?| �?§2.3 | 整体状�?|
| `lastUpdatedAt` | `number` | �?| 毫秒时间�?| 最后更新时�?|

### 1.6 DiagnosticReportItem �?诊断报告条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | �?| - | 诊断�?ID |
| `name` | `string` | �?| - | 诊断项名�?|
| `module` | `string` | �?| - | 所属模�?|
| `healthScore` | `number` | �?| 0 ~ 100 | 健康评分 |
| `successRate` | `number` | �?| 0 ~ 100 | 成功�?|
| `stabilityScore` | `number` | �?| 0 ~ 100 | 稳定性评�?|
| `level` | `DiagnosticLevel` | �?| `EXCELLENT` / `GOOD` / `AVERAGE` / `POOR` | 综合等级，见 §2.5 |
| `detail` | `string` | �?| - | 诊断详情 |
| `reportedAt` | `number` | �?| 毫秒时间�?| 诊断时间 |

### 1.7 DiagnosticReportsData �?诊断分析数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `reports` | `DiagnosticReportItem[]` | �?| - | 诊断报告列表 |
| `overallLevel` | `DiagnosticLevel` | �?| �?§2.5 | 整体等级 |
| `lastUpdatedAt` | `number` | �?| 毫秒时间�?| 最后更新时�?|

### 1.8 AICenterData �?AI 中心统一数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `agents` | `AgentListData` | �?| - | 智能体列表与总览 |
| `healthMetrics` | `HealthMetricsData` | �?| - | 健康监控 |
| `diagnosticReports` | `DiagnosticReportsData` | �?| - | 诊断分析 |

---

## 二、枚举常量定�?
### 2.1 AgentStatus �?Agent 运行状�?
| 枚举�?| 中文标签 | 颜色 | Tailwind 背景�?| Tailwind 文字�?| 图标 |
|--------|----------|------|-----------------|-----------------|------|
| `NORMAL` | 正常 | `#22c55e` | `bg-green-500` | `text-green-500` | `check-circle` |
| `WARNING` | 预警 | `#f59e0b` | `bg-amber-500` | `text-amber-500` | `alert-triangle` |
| `ERROR` | 异常 | `#ef4444` | `bg-red-500` | `text-red-500` | `x-circle` |
| `PAUSED` | 已暂�?| `#9ca3af` | `bg-gray-400` | `text-gray-400` | `pause-circle` |

### 2.2 AgentTag �?Agent 标签

| 枚举�?| 中文标签 | 颜色 | Tailwind 背景�?| 图标 |
|--------|----------|------|-----------------|------|
| `LLM` | LLM模型 | `#8b5cf6` | `bg-violet-500` | `brain` |
| `KNOWLEDGE` | 知识�?| `#3b82f6` | `bg-blue-500` | `book-open` |
| `TOOL` | 工具�?| `#10b981` | `bg-emerald-500` | `wrench` |
| `STRATEGY` | 策略 | `#f59e0b` | `bg-amber-500` | `trending-up` |

### 2.3 HealthStatus �?健康状�?
| 枚举�?| 中文标签 | 颜色 | Tailwind 背景�?| Tailwind 文字�?| 图标 |
|--------|----------|------|-----------------|-----------------|------|
| `HEALTHY` | 正常 | `#22c55e` | `bg-green-500` | `text-green-500` | `check-circle` |
| `WARNING` | 预警 | `#f59e0b` | `bg-amber-500` | `text-amber-500` | `alert-triangle` |
| `CRITICAL` | 异常 | `#ef4444` | `bg-red-500` | `text-red-500` | `x-circle` |
| `UNKNOWN` | 未知 | `#9ca3af` | `bg-gray-400` | `text-gray-400` | `help-circle` |

### 2.4 HealthModuleCategory �?健康模块分类

| 枚举�?| 中文标签 |
|--------|----------|
| `CORE` | 核心模块 |
| `SYSTEM` | 系统组件 |
| `AGENT` | 智能�?|
| `DATA` | 数据服务 |

### 2.5 DiagnosticLevel �?诊断等级

| 枚举�?| 中文标签 | 颜色 | Tailwind 背景�?|
|--------|----------|------|-----------------|
| `EXCELLENT` | 优秀 | `#22c55e` | `bg-green-500` |
| `GOOD` | 良好 | `#3b82f6` | `bg-blue-500` |
| `AVERAGE` | 一�?| `#f59e0b` | `bg-amber-500` |
| `POOR` | 较差 | `#ef4444` | `bg-red-500` |

### 2.6 评分阈�?
| 常量 | �?| 说明 |
|------|-----|------|
| `HEALTH_SCORE_THRESHOLDS.EXCELLENT` | `90` | �?90 为优秀/健康 |
| `HEALTH_SCORE_THRESHOLDS.GOOD` | `75` | �?75 为良�?|
| `HEALTH_SCORE_THRESHOLDS.WARNING` | `60` | �?60 为预警；< 60 为异�?较差 |

---

## 三、服务端 statusCode 映射关系

### 3.1 AgentStatus 映射

| 服务�?statusCode | 前端枚举 |
|-------------------|----------|
| `NORMAL` / `0` | `AGENT_STATUS.NORMAL` |
| `WARNING` / `1` | `AGENT_STATUS.WARNING` |
| `ERROR` / `2` | `AGENT_STATUS.ERROR` |
| `PAUSED` / `3` | `AGENT_STATUS.PAUSED` |

### 3.2 HealthStatus 映射

| 服务�?statusCode | 前端枚举 |
|-------------------|----------|
| `HEALTHY` / `0` | `HEALTH_STATUS.HEALTHY` |
| `WARNING` / `1` | `HEALTH_STATUS.WARNING` |
| `CRITICAL` / `2` | `HEALTH_STATUS.CRITICAL` |
| `UNKNOWN` / `3` | `HEALTH_STATUS.UNKNOWN` |

---

## 四、引用约�?
1. 组件内禁止出�?`'正常'`、`'异常'`、`#22c55e`、`bg-green-500` 等硬编码值�?2. Agent 状态一律使�?`AI_AGENT_STATUS_MAP[agent.status]`�?3. 健康状态一律使�?`HEALTH_STATUS_MAP[metric.status]`�?4. Agent 标签一律使�?`AGENT_TAG_MAP[tag]`�?5. 图标类型由常量中�?`icon` 字段驱动，组件内仅负责根�?`icon` 名称渲染对应图标组件�?
---

## 五、Agent 运行时类型（补充�?
> 以下�?`src/types/modules/agent.types.ts` �?Agent 运行时核心类型，�?AI Center 数据字典关联�?
### 5.1 AgentModuleInput �?Agent 模块输入

**来源**: `src/types/modules/agent.types.ts:7-15`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | �?| 智能体唯一标识 |
| `type` | `string` | �?| 智能体类�?|
| `payload` | `Record<string, unknown>` | �?| 任务载荷 |
| `options.timeout` | `number` | �?| 超时时间（毫秒） |
| `options.priority` | `number` | �?| 优先�?|

### 5.2 AgentModuleOutput �?Agent 模块输出

**来源**: `src/types/modules/agent.types.ts:17-23`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | �?| 任务唯一标识 |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'timeout'` | �?| 任务状�?|
| `result` | `Record<string, unknown>` | �?| 执行结果 |
| `error` | `string` | �?| 错误信息 |
| `executionTimeMs` | `number` | �?| 执行耗时（毫秒） |

### 5.3 AgentDefinition �?Agent 定义

**来源**: `src/types/modules/agent.types.ts:25-33`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 智能�?ID |
| `name` | `string` | �?| 名称 |
| `description` | `string` | �?| 描述 |
| `type` | `string` | �?| 类型 |
| `version` | `string` | �?| 版本�?|
| `capabilities` | `Array<{ id, name, description }>` | �?| 能力列表 |
| `metadata.tags` | `string[]` | �?| 标签列表 |
| `metadata.config` | `Record<string, unknown>` | �?| 配置�?|

### 5.4 AgentInstance �?Agent 运行实例

**来源**: `src/types/modules/agent.types.ts:35-43`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | �?| 实例唯一标识 |
| `agentId` | `string` | �?| 关联 Agent 定义 ID |
| `name` | `string` | �?| 实例名称 |
| `status` | `'idle' \| 'running' \| 'completed' \| 'failed' \| 'stopped'` | �?| 运行状�?|
| `startTime` | `number` | �?| 启动时间（毫秒时间戳�?|
| `lastHeartbeat` | `number` | �?| 最后心跳（毫秒时间戳） |
| `stats.totalTasks` | `number` | �?| 总任务数 |
| `stats.successTasks` | `number` | �?| 成功任务�?|
| `stats.failedTasks` | `number` | �?| 失败任务�?|
| `stats.avgExecutionTime` | `number` | �?| 平均执行时间 |

### 5.5 AgentHealthSnapshot �?Agent 健康快照

**来源**: `src/types/modules/agent.types.ts:51-66`
**用�?*: 单个 Agent 的健康状态快照，用于监控面板

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | �?| 智能体唯一标识 |
| `agentName` | `string` | �?| 智能体名称（冗余字段�?|
| `name` | `string` | �?| 显示名称 |
| `status` | `'healthy' \| 'warning' \| 'critical' \| 'unknown'` | �?| 健康状�?|
| `lastHeartbeat` | `number` | �?| 最后心跳（毫秒时间戳） |
| `taskCount` | `number` | �?| 当前任务�?|
| `totalTasks` | `number` | �?| 累计任务总数 |
| `errorCount` | `number` | �?| 错误计数 |
| `failureRate` | `number` | �?| 失败�?0-1 |
| `uptime` | `number` | �?| 运行时间（毫秒） |
| `avgExecutionTime` | `number` | �?| 平均执行时间（毫秒） |
| `consecutiveFailures` | `number` | �?| 连续失败次数 |
| `maxConcurrent` | `number` | �?| 最大并发数 |
| `defaultTimeout` | `number` | �?| 默认超时（毫秒） |

### 5.6 AgentTaskHistoryEntry �?Agent 任务历史条目

**来源**: `src/types/modules/agent.types.ts:69-79`
**用�?*: 单个 Agent 任务的执行历史记�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | �?| 任务唯一标识 |
| `agentId` | `string` | �?| 关联 Agent ID |
| `type` | `string` | �?| 任务类型 |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'timeout'` | �?| 任务状�?|
| `createdAt` | `number` | �?| 创建时间（毫秒时间戳�?|
| `startedAt` | `number` | �?| 开始执行时�?|
| `completedAt` | `number` | �?| 完成时间 |
| `durationMs` | `number` | �?| 执行耗时（毫秒） |
| `error` | `string` | �?| 错误信息 |

### 5.7 AgentMetricsSummary �?Agent 指标汇�?
**来源**: `src/types/modules/agent.types.ts:82-94`
**用�?*: 所�?Agent 的聚合指标汇�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalAgents` | `number` | �?| Agent 总数 |
| `healthyCount` | `number` | �?| 健康数量 |
| `warningCount` | `number` | �?| 预警数量 |
| `criticalCount` | `number` | �?| 异常数量 |
| `totalTasks` | `number` | �?| 任务总数 |
| `successTasks` | `number` | �?| 成功任务�?|
| `failedTasks` | `number` | �?| 失败任务�?|
| `runningTasks` | `number` | �?| 运行中任务数 |
| `pendingTasks` | `number` | �?| 等待中任务数 |
| `avgFailureRate` | `number` | �?| 平均失败�?|
| `avgExecutionTime` | `number` | �?| 平均执行时间（毫秒） |

### 5.8 SystemMonitorSnapshot �?系统监控快照

**来源**: `src/types/modules/agent.types.ts:97-107`
**用�?*: 系统级监控快照，聚合 Agent 系统全部运行时状�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | `number` | �?| 快照时间（毫秒时间戳�?|
| `agentSystemInitialized` | `boolean` | �?| Agent 系统是否已初始化 |
| `agentMetrics` | `AgentMetricsSummary` | �?| Agent 指标汇�?|
| `agentHealthSnapshots` | `AgentHealthSnapshot[]` | �?| �?Agent 健康快照列表 |
| `recentTasks` | `AgentTaskHistoryEntry[]` | �?| 最近任务历�?|
| `eventBusStats.totalEvents` | `number` | �?| EventBus 总事件数 |
| `eventBusStats.totalListeners` | `number` | �?| EventBus 总监听器�?|

### 5.9 AgentTriggerPayload �?Agent 任务触发参数

**来源**: `src/types/modules/agent.types.ts:114-120`
**用�?*: 手动触发 Agent 执行时的输入参数

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | �?| 目标 Agent ID |
| `toolName` | `string` | �?| 工具名称 |
| `serverName` | `string` | �?| MCP Server 名称 |
| `args` | `Record<string, unknown>` | �?| 工具调用参数 |
| `timeout` | `number` | �?| 超时时间（毫秒） |

### 5.10 AgentTaskFilter �?Agent 任务筛�?
**来源**: `src/types/modules/agent.types.ts:123-127`
**用�?*: 查询 Agent 任务历史时的筛选条�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | �?| �?Agent ID 筛�?|
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'timeout'` | �?| 按状态筛�?|
| `dateRange` | `{ start: number; end: number }` | �?| 按时间范围筛�?|

### 5.11 MCPCallRecord �?MCP 调用记录

**来源**: `src/types/modules/agent.types.ts:130-141`
**用�?*: 单次 MCP 工具调用的完整记�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 记录唯一标识 |
| `taskId` | `string` | �?| 关联任务 ID |
| `serverName` | `string` | �?| MCP Server 名称 |
| `toolName` | `string` | �?| 工具名称 |
| `args` | `Record<string, unknown>` | �?| 调用参数 |
| `result` | `unknown` | �?| 调用结果 |
| `error` | `string` | �?| 错误信息 |
| `startedAt` | `number` | �?| 开始时间（毫秒时间戳） |
| `completedAt` | `number` | �?| 完成时间 |
| `durationMs` | `number` | �?| 调用耗时（毫秒） |

### 5.12 AgentFeedback �?Agent 反馈

**来源**: `src/types/modules/agent.types.ts:148-157`
**用�?*: 用户�?Agent 执行结果的反馈评�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 反馈唯一标识 |
| `taskId` | `string` | �?| 关联任务 ID |
| `agentId` | `string` | �?| 关联 Agent ID |
| `rating` | `1 \| 2 \| 3 \| 4 \| 5` | �?| 评分�?-5 星） |
| `comment` | `string` | �?| 评论内容 |
| `category` | `'accuracy' \| 'speed' \| 'usability' \| 'feature'` | �?| 反馈分类 |
| `createdAt` | `number` | �?| 创建时间（毫秒时间戳�?|
| `resolved` | `boolean` | �?| 是否已处�?|

### 5.13 AgentFeedbackSummary �?Agent 反馈汇�?
**来源**: `src/types/modules/agent.types.ts:160-165`
**用�?*: 单个 Agent 的反馈聚合统�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agentId` | `string` | �?| 关联 Agent ID |
| `averageRating` | `number` | �?| 平均评分 |
| `totalFeedback` | `number` | �?| 反馈总数 |
| `categoryBreakdown` | `Record<string, number>` | �?| 各分类反馈数�?|

---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更�?|
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆�?AI Center 全部类型定义�? 个接口）与枚举常量（6 组） | Architecture Asset Governor |
| 2026-06-26 | v1.1.0 | 补充 §5 Agent 运行时类型（4 个接口：AgentModuleInput/Output/Definition/Instance�?| Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | 补充 §5.5-§5.13 �?9 �?Agent 运行时类型（HealthSnapshot/TaskHistoryEntry/MetricsSummary/SystemMonitorSnapshot/TriggerPayload/TaskFilter/MCPCallRecord/Feedback/FeedbackSummary�?| Architecture Asset Governor |
