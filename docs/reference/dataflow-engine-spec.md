---
title: DataFlow Engine 实现规格
type: reference
domain: backend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "Dataflow 引擎规范：统一管理实时/准实时数据通道的数据感知层核心组件�?
tags: [backend, dataflow, data, spec, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-002
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-DATA-007, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-DATA-019, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# DataFlow Engine 实现规格

## 1. 定位与职�?
`src/core/dataflow/dataflowEngine.ts` 是系统数据感知层的核心组件，负责统一管理系统内所有实�?准实时数据通道。它在底�?`eventBus` 之上封装了一层面�?通道"的高级语义，提供以下能力�?
- 数据通道订阅与取消订�?- 数据包缓存（带持久化标记�?- 定时刷新任务注册
- 通道优先级分�?- SSE 推送连接与轮询回退
- 慢订阅者检�?- 序列号追踪与统计

## 2. 目录结构

```text
src/core/dataflow/
├── dataflowEngine.ts      # 核心引擎实现（DataFlowEngine �?+ 单例 dataFlowEngine�?├── dataflowTypes.ts       # 通道、数据包、元数据、回调类型定�?└── defaultDataBuilder.ts  # 默认通道元数据与兜底数据构造器
```

## 3. 核心概念

### 3.1 DataChannel（数据通道�?
预定义通道枚举，标识一类数据主题：

| 通道 | 说明 | 默认刷新间隔 | 优先�?| 是否持久�?|
| --- | --- | --- | --- | --- |
| `market:index` | 大盘指数实时数据 | 5000ms | high | true |
| `market:sector` | 板块涨跌排行 | 10000ms | high | true |
| `market:fundflow` | 资金流向统计 | 15000ms | normal | true |
| `market:emotion` | 市场情绪指标 | 30000ms | low | false |
| `portfolio:summary` | 持仓总览 | 10000ms | high | true |
| `portfolio:holding` | 持仓明细 | 30000ms | normal | true |
| `strategy:signal` | 买卖信号 | 5000ms | high | false |
| `strategy:score` | 股票评分 | 60000ms | normal | true |
| `agent:status` | Agent 状�?| 10000ms | normal | false |
| `system:health` | 系统健康 | 30000ms | low | false |

> 实现类型：`DataChannel`（`src/core/dataflow/dataflowTypes.ts`�?
### 3.2 ChannelMeta / DataChannelConfig（通道元数据）

每个通道的配置信息，包含刷新间隔、持久化策略、优先级等：

```ts
export interface ChannelMeta {
  channel: DataChannel
  description: string
  refreshInterval: number
  persist: boolean
  priority: 'high' | 'normal' | 'low'
}
```

默认元数据由 `DefaultDataBuilder` 提供，并可在 `DataFlowEngine` 初始化时注入或覆盖�?
### 3.3 Subscriber（订阅者）

订阅者是一个回调函数，接收 `DataPacket<T>`�?
```ts
export interface DataPacket<T = unknown> {
  channel: DataChannel
  data: T
  timestamp: number
  seq: number
}
```

`subscribe(channel, callback)` 返回一个取消订阅函数�?
### 3.4 ChannelState（通道状态）

代码层面未定义独�?`ChannelState` 类型，但引擎内部维护以下状态：

- `subscribers`：每通道的回调集�?- `cache`：每通道的最新数据、时间戳、序列号
- `channelMeta`：每通道的元数据
- `refreshTimers`：每通道的刷新定时器
- `connected`：整体连接状态（SSE 或轮询模式）

### 3.5 DataFlowEvent（数据流事件�?
引擎通过 `eventBus` 发布以下事件，供其他模块监听�?
| 事件�?| 触发时机 | Payload |
| --- | --- | --- |
| `DATAFLOW_CONNECTED` | SSE 连接成功或进入轮询模�?| `{ connected: true }` |
| `DATAFLOW_DISCONNECTED` | SSE 连接断开�?`disconnect()` | `{ connected: false }` |
| `DATAFLOW_PACKET_PUBLISHED` | 有新数据包发�?| `{ channel, seq }` |

## 4. 能力说明

### 4.1 SSE 推�?+ 轮询回退

- `connect(url?)` 尝试�?`EventSource` 建立 SSE 连接�?- 若未提供 `url`、`EventSource` 不可用或连接失败，则自动降级为轮询模式�?- 错误时关�?SSE，切换到轮询，并触发 `DATAFLOW_DISCONNECTED`�?
### 4.2 内存缓存

- `publish(channel, data)` 时，若通道 `persist` �?`true`，会将数据写入内存缓存�?- 新订阅者会立即收到最近一次缓存数据（通过 `queueMicrotask` 异步派发）�?- 当前实现为纯内存缓存，未实现 TTL/maxSize 淘汰策略（预留扩展点）�?
### 4.3 refreshInterval / priority / persist 配置

- `refreshInterval`：由 `registerRefresh(channel, fetcher, intervalMs?)` 使用，未指定时取通道元数据默认值�?- `priority`：当前用于初始化日志与元数据标记，分发阶段尚未实现按优先级抢占（预留扩展点）�?- `persist`：控�?`publish` 是否写入缓存�?
### 4.4 慢订阅者检�?
`_distribute()` 使用 `queueMicrotask` 派发数据包，并测量每个回调执行耗时�?
- 超过 16ms：记�?`warn` 慢订阅者日�?- 5ms ~ 16ms：记�?`debug` 日志
- 抛错：记�?`error` 并继续派发其他订阅�?
### 4.5 序列号追�?
- 引擎维护全局 `seqCounter`，每�?`publish` 自增并写�?`DataPacket.seq`�?- 缓存数据同样记录 `seq`，便于订阅者判断数据新鲜度与丢失情况�?
## 5. 调用示例

### 5.1 订阅一个通道

```ts
import { dataFlowEngine } from '@/core/dataflow/dataflowEngine'

const unsubscribe = dataFlowEngine.subscribe('market:index', (packet) => {
  console.log(`[${packet.channel}] seq=${packet.seq}`, packet.data)
})

// 取消订阅
unsubscribe()
```

### 5.2 注册定时刷新

```ts
dataFlowEngine.registerRefresh('market:sector', async () => {
  const sectors = await fetchSectorRanking()
  return sectors
}, 10000)
```

### 5.3 手动发布数据

```ts
dataFlowEngine.publish('agent:status', { agents: [...], timestamp: Date.now() })
```

### 5.4 连接与断开

```ts
dataFlowEngine.connect('/api/dataflow/sse')
// ...
dataFlowEngine.disconnect()
```

### 5.5 获取统计

```ts
const stats = dataFlowEngine.getStats()
// { connected, channels, subscribers, cacheEntries, refreshTasks }
```

## 6. �?eventBus 的关�?
`eventBus`（`src/lib/eventBus.ts`）提供基础发布/订阅能力，仅按事件名广播载荷，不关心业务语义�?
`DataFlowEngine` �?`eventBus` 之上构建�?
- 使用 `eventBus.emit` 发送连接状态与发布事件�?- 内部维护通道维度订阅表、缓存、刷新任务、序列号�?- 提供面向数据通道的高�?API：`subscribe` / `publish` / `registerRefresh` / `getStats` 等�?
简言之：`eventBus` 是通用消息总线，`DataFlowEngine` 是基于该总线实现的数据通道管理器�?