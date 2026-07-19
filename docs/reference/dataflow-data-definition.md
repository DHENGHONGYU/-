---
title: dataflow-data-definition
type: reference
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "v1.2.0 新增。getStats() 返回的缓存统计对象。"
tags: [data, data-definition, dataflow, reference, store]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-018
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 数据流引擎（DataFlow Engine）数据字典

> **Status**: Current  
> **Version**: v1.2.0  
> **Last Updated**: 2026-07-05  
> 模块范围：`src/core/dataflow/`  
> 关联任务：`./08-implementation-plan.md` 2.1.8

---

## 一、类型定义

### 1.1 DataChannel — 数据通道

| 通道标识 | 说明 | 默认刷新间隔 | 持久化 | 优先级 |
|----------|------|--------------|--------|--------|
| `market:index` | 大盘指数实时数据 | 5000ms | true | high |
| `market:sector` | 板块涨跌排行 | 10000ms | true | high |
| `market:fundflow` | 资金流向统计 | 15000ms | true | normal |
| `market:emotion` | 市场情绪指标 | 30000ms | false | low |
| `portfolio:summary` | 持仓总览 | 10000ms | true | high |
| `portfolio:holding` | 持仓明细 | 30000ms | true | normal |
| `strategy:signal` | 买卖信号 | 5000ms | false | high |
| `strategy:score` | 股票评分 | 60000ms | true | normal |
| `agent:status` | Agent 状态 | 10000ms | false | normal |
| `system:health` | 系统健康 | 30000ms | false | low |

### 1.2 DataPacket — 数据包

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `channel` | `DataChannel` | 是 | 所属通道 |
| `data` | `T` | 是 | 载荷数据 |
| `timestamp` | `number` | 是 | 发布时间戳（毫秒） |
| `seq` | `number` | 是 | 单调递增序列号 |

### 1.3 ChannelMeta — 通道元数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `channel` | `DataChannel` | 是 | 见 §1.1 | 通道标识 |
| `description` | `string` | 是 | - | 通道描述 |
| `refreshInterval` | `number` | 是 | > 0 | 轮询刷新间隔（毫秒） |
| `persist` | `boolean` | 是 | - | 是否持久化到缓存 |
| `priority` | `string` | 是 | `high` / `normal` / `low` | 分发优先级 |
| `ttl` | `number` | 否 | >= 0 | 缓存过期时间（毫秒），0 表示不缓存。v1.2.0 新增 |

### 1.4 DataCallback — 订阅回调

```ts
type DataCallback<T = unknown> = (packet: DataPacket<T>) => void
```

### 1.5 CacheStats — 数据流缓存统计

v1.2.0 新增。`getStats()` 返回的缓存统计对象。

| 字段 | 类型 | 描述 |
|------|------|------|
| `hits` | `number` | 缓存命中次数 |
| `hitCount` | `number` | 缓存命中条目数 |
| `misses` | `number` | 缓存未命中次数 |
| `missCount` | `number` | 缓存未命中条目数 |
| `size` | `number` | 当前缓存大小 |
| `totalRequests` | `number` | 总请求数 |
| `totalEntries` | `number` | 总条目数 |
| `maxEntries` | `number` | 最大缓存条目数 |
| `hitRate` | `number` | 命中率（0-1） |
| `expiredCount` | `number` | 过期条目数 |
| `evictedCount` | `number` | 驱逐条目数 |

---

## 二、核心 API

### 2.1 DataFlowEngine

| 方法 | 入参 | 出参 | 说明 |
|------|------|------|------|
| `connect(url?)` | `url?: string` | `void` | 建立 SSE 连接；无 URL 或 EventSource 不可用时切换为轮询模式 |
| `disconnect()` | - | `void` | 断开连接，清理所有刷新定时器 |
| `subscribe(channel, callback)` | `channel: string`, `callback: DataCallback<T>` | `() => void` | 订阅通道；返回取消订阅函数 |
| `publish(channel, data)` | `channel: string`, `data: T` | `void` | 发布数据包，自动递增 seq，按 persist 决定是否缓存 |
| `registerRefresh(channel, fetcher, intervalMs?)` | `channel: string`, `fetcher: () => Promise<T>`, `intervalMs?: number` | `void` | 注册轮询刷新任务 |
| `stopRefresh(channel)` | `channel: string` | `void` | 停止指定通道的轮询 |
| `onConnectionChange(listener)` | `listener: (connected: boolean) => void` | `() => void` | 监听连接状态变化 |
| `getStats()` | - | 统计对象 | 返回连接状态、通道数、订阅数、缓存数、刷新任务数 |
| `destroy()` | - | `void` | 销毁引擎，释放所有资源 |

---

## 三、事件总线信号

| 事件名 | 触发时机 | 载荷 |
|--------|----------|------|
| `DATAFLOW_CONNECTED` | SSE 连接建立或进入轮询模式 | `{ connected: true }` |
| `DATAFLOW_DISCONNECTED` | SSE 连接断开 | `{ connected: false }` |
| `DATAFLOW_PACKET_PUBLISHED` | 数据包发布成功 | `{ channel, seq }` |

---

## 四、默认回退数据

当通道刷新失败且需要兜底时，`DefaultDataBuilder.buildFallbackData()` 返回：

| 通道 | 回退数据结构 |
|------|--------------|
| `market:index` | `{ index: 0, change: 0, changePercent: 0, volume: 0 }` |
| `market:sector` | `[]` |
| `portfolio:summary` | `{ totalAssets: 0, available: 0, dailyPnL: 0, totalPnL: 0 }` |
| `portfolio:holding` | `[]` |
| `strategy:signal` | `[]` |
| `strategy:score` | `{ score: 0, factors: {} }` |
| `agent:status` | `[]` |
| `system:health` | `{ cpu: 0, memory: 0, network: 'normal' }` |

---

## 五、重连策略

| 参数 | 值 | 说明 |
|------|-----|------|
| `maxReconnectAttempts` | 5 | 最大重连次数 |
| `maxReconnectDelay` | 30000ms | 最大重连退避间隔 |
| 退避公式 | `min(1000 * 2^attempts, 30000)` | 指数退避，上限 30 秒 |
| 超限时行为 | 切回轮询模式 | `_fallbackToPolling()` |

---

## 六、性能阈值

| 操作 | 告警阈值 | 说明 |
|------|----------|------|
| 发布耗时 | > 10ms | `publish()` 超过 10ms 记录 warn |
| 单订阅者回调耗时 | > 16ms | 慢订阅者 warn；> 5ms debug |
| 分发总耗时 | > 5ms | `_distribute()` 超过 5ms 记录 info |

---

## 七、已知问题与整改方向

1. **魔法数字未常量化**：`refreshInterval`、`maxReconnectAttempts`、`maxReconnectDelay`、性能阈值等仍为硬编码，后续应迁移到 `src/core/dataflow/dataflowTypes.ts`。
2. **部分通道未接入真实数据源**：当前 `market:*`、`portfolio:*` 等通道依赖 Mock 或轮询，待 Data Fetcher 成熟后替换。
3. **SSE 断线重连**：已具备指数退避与轮询回退，但生产环境需补充心跳检测。

---

## 八、开发调试工具

| 文件 | 说明 |
|------|------|
| `src/devtools/testDataFlow.ts` | 浏览器控制台调试脚本，暴露 `__DEV__.testDataFlow()` 用于手动验证数据流引擎订阅/发布/刷新链路 |

## 九、关联文档

- `./03-architecture-standards.md` 3.1.2：数据流引擎设计
- `./08-implementation-plan.md` 2.1.8：数据流引擎任务
- `./data-dictionary-index.md`：数据字典总索引
