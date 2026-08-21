---
doc_id: V9-DOC-REF-907
title: Agent Runtime 实现规格
version: v0.9.0-migration-implemented
last_updated: 2026-06-25
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v0.9.0-migration-implemented
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-06-25
  - date: 2026-06-25
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）

covers_code:
  - src/agents/agentRuntime.ts


code_version: 2.0.0-rc.2
---
> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25

# Agent Runtime 实现规格

## 1. 定位与职责

`src/agents/agentRuntime.ts` 提供多 Agent 注册、任务调度、任务队列与超时机制的基础运行时。它是 Agent 层的执行引擎，负责：

- 维护已注册 Agent 的配置表
- 接收任务请求并生成任务记录
- 调度任务执行并监控超时
- 支持任务取消与状态查询
- 通过 `eventBus` 发布任务生命周期事件

## 2. 目录结构

```text
src/agents/
└── agentRuntime.ts      # 当前唯一文件：AgentRuntime 类 + 单例 agentRuntime
```

> 未来可能拆分出 `agentRegistry.ts`、`agentHealth.ts`、`agentHandlers.ts` 等模块。

## 3. 核心 API

当前实现提供的 API 与需求命名存在差异，对照如下：

| 需求 API | 实际实现 | 说明 |
| --- | --- | --- |
| `registerAgent` | `register(config: AgentConfig)` | 注册/覆盖 Agent |
| `unregisterAgent` | 暂未实现 | 预留扩展 |
| `submitTask` | `execute(agentId, type, payload, timeout?)` | 提交单个任务 |
| `cancelTask` | `cancelTask(id: string): boolean` | 取消运行中/待执行任务 |
| `getAgentStatus` | `getTask(id)` / `listTasks(status?)` | 查询任务状态 |
| `getQueueStatus` | `getStats()` | 获取整体统计 |

### 3.1 主要方法签名

```ts
class AgentRuntime {
  register(config: AgentConfig): void
  execute(agentId: string, type: string, payload: unknown, timeout?: number): Promise<AgentTask>
  executeParallel(tasks: Array<{ agentId; type; payload; timeout? }>): Promise<AgentTask[]>
  getTask(id: string): AgentTask | undefined
  listTasks(status?: AgentTask['status']): AgentTask[]
  cancelTask(id: string): boolean
  getStats(): { totalAgents; pendingTasks; runningTasks; completedTasks; failedTasks }
}
```

## 4. Agent 定义

当前 `AgentConfig` 结构：

```ts
export interface AgentConfig {
  id: string                // Agent 唯一标识
  name: string              // 显示名称
  description: string       // 描述
  defaultTimeout: number    // 默认任务超时（ms）
  maxConcurrent: number     // 最大并发数（当前尚未 enforced）
}
```

> 注：需求中提到的 `capabilities`、`handler`、`priority` 字段当前版本未实现，Agent 实际执行逻辑暂时硬编码在 `runAgent()` 中（模拟 1s 延迟后返回占位结果）。

## 5. 任务生命周期

```text
pending → running → completed
              ↘ failed
              ↘ cancelled
              ↘ timeout
```

### 5.1 状态定义

```ts
export interface AgentTask {
  id: string
  agentId: string
  type: string
  payload: unknown
  timeout: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
  result?: unknown
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}
```

### 5.2 状态转换说明

| 阶段 | 行为 | 触发事件 |
| --- | --- | --- |
| `pending` | 任务创建，加入任务表 | `AGENT_TASK_STARTED` |
| `running` | 启动 `AbortController` 与超时定时器，调用 `runAgent` | - |
| `completed` | 异步执行成功，`result` 写入任务 | `AGENT_TASK_COMPLETED` |
| `failed` | 执行抛错或被取消 | `AGENT_TASK_FAILED` / `AGENT_TASK_CANCELLED` |
| `timeout` | 超过 `timeout` 仍未完成，`controller.abort()` | `AGENT_TASK_TIMEOUT` |

## 6. 调用示例

### 6.1 注册 Agent

```ts
import { agentRuntime } from '@/agents/agentRuntime'

agentRuntime.register({
  id: 'analyst',
  name: '投研分析师 Agent',
  description: '负责基本面与舆情分析',
  defaultTimeout: 30000,
  maxConcurrent: 2,
})
```

### 6.2 提交任务

```ts
const task = await agentRuntime.execute('analyst', 'fundamental-review', {
  symbol: '000001.SZ',
})
console.log(task.status, task.result)
```

### 6.3 取消任务

```ts
const cancelled = agentRuntime.cancelTask(task.id)
```

### 6.4 查询任务与统计

```ts
const running = agentRuntime.listTasks('running')
const stats = agentRuntime.getStats()
```

## 7. 当前限制

- **Agent 注册表**：仅支持 `register`，不支持 `unregister`、版本管理、依赖注入。
- **健康监控**：未实现 Agent 心跳、失败率统计、自动降级。
- **AI 助手能力**：`runAgent()` 当前为占位实现，未接入真实 LLM 或业务 handler；需求中的 `capabilities`、`handler`、`priority` 字段待补充。
- **并发控制**：`maxConcurrent` 已定义但未生效。
- **任务队列**：当前采用立即执行 + 超时模式，未实现带优先级/背压的正式任务队列。
