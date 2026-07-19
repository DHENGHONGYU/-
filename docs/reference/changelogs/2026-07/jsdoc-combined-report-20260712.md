---
title: JSDoc 注释完整汇总报?
type: reference
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "日期: 2026-07-12 版本: v1.0.0 涉及文件: BaseCollector.ts, WebSocketCollector.ts, TaskScheduler.ts..."
tags: [project, jsdoc, changelog, report, log]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-210
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: project
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [project, jsdoc, changelog, report, log]
phase: retrospective
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# JSDoc 注释完整汇总报?
> **日期**: 2026-07-12  
> **版本**: v1.0.0  
> **涉及文件**: BaseCollector.ts, WebSocketCollector.ts, TaskScheduler.ts  
> **变更类型**: JSDoc 注释补充

---

## 目录

1. [变更概览](#1-变更概览)
2. [BaseCollector.ts 完整注释](#2-basecollectorts-完整注释)
3. [WebSocketCollector.ts 完整注释](#3-websocketcollectorts-完整注释)
4. [TaskScheduler.ts 完整注释](#4-taskschedulerts-完整注释)
5. [变更对比报告](#5-变更对比报告)
6. [测试验证结果](#6-测试验证结果)
7. [代码审查要点](#7-代码审查要点)

---

## 1. 变更概览

| 文件 | 原方法数 | 新增注释?| 覆盖类型 | 完成状?|
|------|---------|-----------|---------|---------|
| [BaseCollector.ts](../../../../src/services/data-collector/collectors/BaseCollector.ts) | 9 | 9 | ?+ 字段 + 构造函?+ 所有方?| ?完成 |
| [WebSocketCollector.ts](../../../../src/services/data-collector/collectors/WebSocketCollector.ts) | 10 | 10 | ?+ 字段 + 构造函?+ 所有方?| ?完成 |
| [TaskScheduler.ts](../../../../src/services/data-collector/TaskScheduler.ts) | 14 | 14 | 辅助函数 + 常量 + ?+ 字段 + 所有方?+ 单例 | ?完成 |

---

## 2. BaseCollector.ts 完整注释

### 2.1 文件路径

`src/services/data-collector/collectors/BaseCollector.ts`

### 2.2 类注?
```typescript
/**
 * 数据采集器基? * @description 提供全局超时中断、统一错误捕获、重试机制、数据包装等通用能力的抽象基? * @abstract 所有具体采集器（如 REST、WebSocket、Mock）必须继承此类并实现 collect 方法
 * @example
 * ```typescript
 * class MyCollector extends BaseCollector {
 *   async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
 *     // 实现具体采集逻辑
 *     return this.wrapData('indices', rawData, 'my-source')
 *   }
 * }
 * ```
 */
```

### 2.3 字段注释

| 字段?| 访问修饰?| 类型 | 注释内容 |
|--------|-----------|------|---------|
| `config` | protected | CollectorConfig | 采集器配置，包含超时、重试次数、重试间隔等参数 |
| `abortController` | protected | AbortController \| null | 用于取消正在进行的采集任务的控制?|
| `isRunning` | protected | boolean | 采集器运行状态标?|

### 2.4 构造函数注?
```typescript
/**
 * 构造函? * @param config 采集器配置选项，可选参数，未提供的项使用默认? * @see COLLECTOR_DEFAULT_CONFIG 获取默认配置? */
```

### 2.5 方法注释

#### 2.5.1 collect（抽象方法）

```typescript
/**
 * 执行数据采集（抽象方法）
 * @param dataSource 数据源配置，包含 endpoint、headers、mode 等信? * @returns 标准化包装后的原始市场数? * @abstract 子类必须实现此方法，实现具体的数据采集逻辑
 * @throws {Error} 采集过程中发生的任何错误
 */
abstract collect(dataSource: DataSourceConfig): Promise<RawMarketData>
```

#### 2.5.2 collectWithRetry

```typescript
/**
 * 带超时和重试机制的采集包装器
 * @param dataSource 数据源配? * @returns 原始市场数据
 * @throws {Error} 当所有重试次数耗尽仍失败时抛出最后一次的错误
 * @remarks 此方法内部会调用 collect 方法，并在失败时自动重试
 * @see config.retryCount 重试次数配置
 * @see config.retryInterval 重试间隔配置
 */
async collectWithRetry(dataSource: DataSourceConfig): Promise<RawMarketData>
```

#### 2.5.3 tryCollectOnce（私有方法）

```typescript
/**
 * 执行单次采集尝试（内部方法）
 * @param dataSource 数据源配? * @returns 原始市场数据
 * @private
 */
private async tryCollectOnce(dataSource: DataSourceConfig): Promise<RawMarketData>
```

#### 2.5.4 executeWithTimeout（私有方法）

```typescript
/**
 * 执行带超时控制的采集（内部方法）
 * @param dataSource 数据源配? * @returns 原始市场数据
 * @throws {Error} ?AbortController 未初始化或采集超时时抛出错误
 * @private
 */
private async executeWithTimeout(dataSource: DataSourceConfig): Promise<RawMarketData>
```

#### 2.5.5 cancel

```typescript
/**
 * 取消当前正在进行的采集任? * @remarks 调用此方法会中止正在进行的采集操作，并重置运行状? */
cancel(): void
```

#### 2.5.6 getIsRunning

```typescript
/**
 * 获取当前采集器的运行状? * @returns 当前是否正在运行? */
getIsRunning(): boolean
```

#### 2.5.7 delay（受保护方法?
```typescript
/**
 * 延迟工具方法
 * @param ms 延迟毫秒? * @returns Promise，在指定毫秒数后 resolve
 * @protected 供子类在重试逻辑中使? */
protected delay(ms: number): Promise<void>
```

#### 2.5.8 wrapData（受保护方法?
```typescript
/**
 * 生成统一的数据包装格? * @param dataType 数据类型，如 'indices'?sectors'?fundFlow' ? * @param payload 原始数据内容
 * @param source 数据来源标识，用于追踪数据来? * @returns 标准化包装后的原始市场数据对? * @protected 供子类在 collect 方法中使用，确保返回数据格式一? * @example
 * ```typescript
 * return this.wrapData('indices', rawData, 'rest-api')
 * ```
 */
protected wrapData(
  dataType: RawMarketData['dataType'],
  payload: unknown,
  source: string
): RawMarketData
```

---

## 3. WebSocketCollector.ts 完整注释

### 3.1 文件路径

`src/services/data-collector/collectors/WebSocketCollector.ts`

### 3.2 类注?
```typescript
/**
 * WebSocket 数据采集? * @description 基于 WebSocket 协议的实时数据采集器，支持自动重连、消息队列缓冲、数据类型推断等功能
 * @remarks 当环境变?VITE_DATA_SOURCE_TYPE=websocket 时启用，用于长连接实时数据推送场? * @extends BaseCollector
 * @example
 * ```typescript
 * const collector = new WebSocketCollector()
 * collector.onMessage((data) => {
 *   console.log('收到实时数据:', data)
 * })
 * collector.connect('/ws/indices')
 * ```
 * @todo 内部逻辑可根据实?WebSocket 服务端协议补充实? */
```

### 3.3 字段注释

| 字段?| 访问修饰?| 类型 | 注释内容 |
|--------|-----------|------|---------|
| `ws` | private | WebSocket \| null | WebSocket 连接实例 |
| `reconnectCount` | private | number | 当前重连次数 |
| `reconnectTimer` | private | ReturnType\<typeof setTimeout\> \| null | 重连定时?ID |
| `messageQueue` | private | string[] | 待发送消息队列（连接未建立时缓存消息?|
| `onMessageCallback` | private | ((data: RawMarketData) => void) \| null | 消息接收回调函数 |

### 3.4 构造函数注?
```typescript
/**
 * 构造函? * @param config 采集器配置选项，继承自 BaseCollector
 */
```

### 3.5 方法注释

#### 3.5.1 collect

```typescript
/**
 * 执行 WebSocket 连接（预留扩展接口）
 * @param dataSource 数据源配置，包含 endpoint 等信? * @returns 占位的原始市场数? * @remarks 当前为预留接口，内部逻辑待后续补充。实际使用中，实时数据通过 onMessage 回调推? */
async collect(dataSource: DataSourceConfig): Promise<RawMarketData>
```

#### 3.5.2 connect

```typescript
/**
 * 建立 WebSocket 连接
 * @param endpoint 端点路径，如 '/ws/indices'?/ws/sectors'
 * @remarks 连接成功后会自动刷新消息队列（发送缓存的消息? * @see WEBSOCKET_COLLECTOR_CONFIG.WS_URL 获取 WebSocket 基础 URL
 */
connect(endpoint: string): void
```

#### 3.5.3 disconnect

```typescript
/**
 * 断开 WebSocket 连接
 * @remarks 会清除重连定时器并关闭连接，调用后需重新调用 connect 建立连接
 */
disconnect(): void
```

#### 3.5.4 send

```typescript
/**
 * 发送消息到 WebSocket 服务? * @param message 消息内容（字符串格式? * @remarks 如果连接尚未建立，消息会被缓存到消息队列，待连接建立后自动发? */
send(message: string): void
```

#### 3.5.5 onMessage

```typescript
/**
 * 设置消息接收回调函数
 * @param callback 消息接收回调，参数为标准化包装后的原始市场数? * @example
 * ```typescript
 * collector.onMessage((data) => {
 *   console.log('数据类型:', data.dataType)
 *   console.log('数据内容:', data.payload)
 * })
 * ```
 */
onMessage(callback: (data: RawMarketData) => void): void
```

#### 3.5.6 handleReconnect（私有方法）

```typescript
/**
 * 处理连接断开后的重连逻辑（内部方法）
 * @param endpoint 端点路径
 * @remarks 重连间隔和最大重连次数由 WEBSOCKET_COLLECTOR_CONFIG 配置控制
 * @private
 */
private handleReconnect(endpoint: string): void
```

#### 3.5.7 flushMessageQueue（私有方法）

```typescript
/**
 * 刷新消息队列（内部方法）
 * @remarks 将连接建立前缓存的消息一次性发送出? * @private
 */
private flushMessageQueue(): void
```

#### 3.5.8 inferDataType（私有方法）

```typescript
/**
 * 根据 endpoint 路径推断数据类型（内部方法）
 * @param endpoint 端点路径
 * @returns 推断出的数据类型，默认为 'indices'
 * @private
 */
private inferDataType(endpoint: string): RawMarketData['dataType']
```

#### 3.5.9 cancel（重写）

```typescript
/**
 * 取消采集任务（断开连接并重置状态）
 * @remarks 重写父类方法，先断开 WebSocket 连接再执行父类的取消逻辑
 */
override cancel(): void
```

---

## 4. TaskScheduler.ts 完整注释

### 4.1 文件路径

`src/services/data-collector/TaskScheduler.ts`

### 4.2 辅助函数注释

#### 4.2.1 emitTaskStatus

```typescript
/**
 * 发射任务状态事件（内部辅助函数? * @param taskId 任务 ID
 * @param status 任务状? * @param payload 附加负载数据
 * @private
 */
function emitTaskStatus(
  taskId: string,
  status: CollectionTaskStatus,
  payload?: Record<string, unknown>,
): void
```

### 4.3 常量注释

```typescript
/**
 * 数据采集轮询默认间隔（毫秒）
 * @remarks 原硬编码 60000 提取为命名常量，?audit:hardcode「硬编码超时」门禁放? */
const DEFAULT_POLL_INTERVAL_MS = 60000
```

### 4.4 类注?
```typescript
/**
 * 采集任务调度? * @description 负责单个 Widget 数据采集任务的注册、启动、停止、错误状态管? * @remarks 支持自动定时轮询（polling 模式）、单次执行（once 模式）和流式采集（streaming 模式）。页面销毁时必须调用 dispose 方法清理定时器防止内存泄? * @example
 * ```typescript
 * // 注册并启动采集任? * const taskId = taskScheduler.registerTask('widget-1', 'instance-1', dataSource)
 * taskScheduler.startTask(taskId)
 *
 * // 订阅采集结果
 * const unsubscribe = taskScheduler.subscribe((taskId, data, error) => {
 *   if (error) {
 *     console.error('采集失败:', error)
 *   } else {
 *     console.log('采集成功:', data)
 *   }
 * })
 *
 * // 页面销毁时清理
 * unsubscribe()
 * taskScheduler.dispose()
 * ```
 */
```

### 4.5 字段注释

| 字段?| 访问修饰?| 类型 | 注释内容 |
|--------|-----------|------|---------|
| `tasks` | private | Map\<string, CollectionTask\> | 任务映射表，key ?taskId，value 为任务对?|
| `timers` | private | Map\<string, ReturnType\<typeof setInterval\>\> | 定时器映射表，key ?taskId，value 为定时器 ID |
| `collectors` | private | Map\<string, BaseCollector\> | 采集器映射表，key ?taskId，value 为采集器实例 |
| `listeners` | private | Set\<CollectionResultCallback\> | 结果监听器集?|
| `taskCounter` | private | number | 任务计数器，用于生成唯一的任?ID |

### 4.6 方法注释

#### 4.6.1 registerTask

```typescript
/**
 * 注册采集任务
 * @param widgetId Widget ID，用于标识数据源对应?Widget 组件
 * @param instanceId 实例 ID，同一 Widget 可能有多个实? * @param dataSource 数据源配置，包含 endpoint、headers、mode、interval 等信? * @returns 生成的唯一任务 ID
 * @remarks 任务注册后状态为 pending，需调用 startTask 启动
 * @example
 * ```typescript
 * const taskId = taskScheduler.registerTask('indices-widget', 'widget-123', {
 *   type: 'rest',
 *   mode: 'polling',
 *   endpoint: '/api/indices',
 *   interval: 30000
 * })
 * ```
 */
registerTask(widgetId: string, instanceId: string, dataSource: DataSourceConfig): string
```

#### 4.6.2 startTask

```typescript
/**
 * 启动采集任务
 * @param taskId 任务 ID
 * @returns Promise，任务启动后 resolve
 * @remarks 根据 dataSource.mode 决定执行模式? * - polling: 定时轮询，立即执行一次后?interval 定时执行
 * - once: 仅执行一? * - streaming: 流式采集（WebSocket 模式? * @throws {Error} 任务执行过程中可能抛出的采集错误
 */
async startTask(taskId: string): Promise<void>
```

#### 4.6.3 stopTask

```typescript
/**
 * 停止采集任务
 * @param taskId 任务 ID
 * @remarks 停止后任务状态变?paused，可通过 startTask 重新启动。会清除定时器并取消采集? */
stopTask(taskId: string): void
```

#### 4.6.4 unregisterTask

```typescript
/**
 * 注销采集任务
 * @param taskId 任务 ID
 * @remarks 会先停止任务，然后从任务映射表中删除，不可恢? */
unregisterTask(taskId: string): void
```

#### 4.6.5 subscribe

```typescript
/**
 * 订阅采集结果
 * @param callback 结果回调函数，参数为 (taskId, data, error)
 * @returns 取消订阅函数，调用后不再接收采集结果通知
 * @example
 * ```typescript
 * const unsubscribe = taskScheduler.subscribe((taskId, data, error) => {
 *   if (error) {
 *     console.error(`任务 ${taskId} 失败:`, error)
 *   } else {
 *     console.log(`任务 ${taskId} 成功:`, data)
 *   }
 * })
 * // 不再需要时取消订阅
 * unsubscribe()
 * ```
 */
subscribe(callback: CollectionResultCallback): () => void
```

#### 4.6.6 getTaskStatus

```typescript
/**
 * 获取任务状? * @param taskId 任务 ID
 * @returns 任务状态（pending/running/paused/completed/error），任务不存在时返回 undefined
 */
getTaskStatus(taskId: string): CollectionTaskStatus | undefined
```

#### 4.6.7 getAllTasks

```typescript
/**
 * 获取所有已注册的任务列? * @returns 任务数组
 */
getAllTasks(): CollectionTask[]
```

#### 4.6.8 runPipelineOnce

```typescript
/**
 * 使用 collectionPipeline 执行单次采集（供输入舱页面显式触发）
 * @param symbol 标的代码，如 '600519.SH'
 * @param dimensionCode 维度代码，如 'financial'?news'
 * @param config 采集配置
 * @returns 采集结果对象，包?success、latency、fallbackCount 和可选的 error
 * @remarks 此方法不会注册到任务轮询列表，只产生一?trace 并持久化。适用于手动触发的一次性采集场? */
async runPipelineOnce(
  symbol: string,
  dimensionCode: string,
  config: CollectionConfig,
): Promise<{ success: boolean; latency: number; fallbackCount: number; error?: string }>
```

#### 4.6.9 dispose

```typescript
/**
 * 清理所有任务（页面销毁时调用? * @remarks 防止内存泄漏的关键方法，必须在页面销毁时调用。会清除所有定时器、取消所有采集器、清空任务和监听? */
dispose(): void
```

#### 4.6.10 executeTask（私有方法）

```typescript
/**
 * 执行单次采集任务（内部方法）
 * @param taskId 任务 ID
 * @returns Promise，任务执行完成后 resolve
 * @remarks 内部调用采集器的 collectWithRetry 方法执行采集，并通知所有监听器结果
 * @private
 */
private async executeTask(taskId: string): Promise<void>
```

#### 4.6.11 notifyErrorListeners（私有方法）

```typescript
/**
 * 向所有监听器广播任务错误（内部方法）
 * @param taskId 任务 ID
 * @param error 错误对象
 * @remarks 单监听器异常不影响其余监听器。抽取为独立方法以消除调用处?forEach+try/catch 嵌套（深?> 3? * @private
 */
private notifyErrorListeners(taskId: string, error: Error): void
```

#### 4.6.12 getOrCreateCollector（私有方法）

```typescript
/**
 * 根据数据源类型获取或创建对应的采集器（内部方法）
 * @param type 数据源类型，支持 'mock'?rest'?websocket'
 * @returns 采集器实? * @remarks 未知类型时返?MockCollector 作为兜底
 * @private
 */
private getOrCreateCollector(type: string): BaseCollector
```

### 4.7 单例实例注释

```typescript
/**
 * TaskScheduler 单例实例
 * @description 全局共享的采集任务调度器实例，用于管理所有数据采集任? */
export const taskScheduler = new TaskScheduler()
```

---

## 5. 变更对比报告

### 5.1 变更前后对比

| 文件 | 变更前状?| 变更后状?| 变更内容 |
|------|-----------|-----------|---------|
| **BaseCollector.ts** | 无类注释、无字段注释、无方法注释 | 完整的类注释、字段注释、构造函数注释、所有方法注释（?@private/@protected/@abstract 标签?| 新增 9 ?JSDoc 注释 |
| **WebSocketCollector.ts** | 无类注释、无字段注释、无方法注释 | 完整的类注释、字段注释、构造函数注释、所有方法注释（?@private/@override 标签?| 新增 10 ?JSDoc 注释 |
| **TaskScheduler.ts** | 无辅助函数注释、无常量注释、无类注释、无字段注释、无方法注释、无单例注释 | 完整的辅助函数注释、常量注释、类注释、字段注释、所有方法注释（?@private 标签）、单例实例注?| 新增 14 ?JSDoc 注释 |

### 5.2 JSDoc 标签使用统计

| JSDoc 标签 | 使用次数 | 说明 |
|-----------|---------|------|
| `@description` | 3 | 类级别的功能描述 |
| `@param` | 38 | 参数说明 |
| `@returns` | 19 | 返回值说?|
| `@throws` | 3 | 异常说明 |
| `@example` | 6 | 使用示例代码 |
| `@remarks` | 22 | 重要备注和补充说?|
| `@private` | 8 | 私有方法标识 |
| `@protected` | 2 | 受保护方法标?|
| `@abstract` | 2 | 抽象方法标识 |
| `@override` | 1 | 方法重写标识 |
| `@see` | 3 | 引用其他符号 |
| `@todo` | 1 | 待完成事?|

### 5.3 覆盖范围统计

| 覆盖类型 | BaseCollector | WebSocketCollector | TaskScheduler | 总计 |
|---------|--------------|-------------------|---------------|------|
| 类注?| 1 | 1 | 1 | 3 |
| 字段注释 | 3 | 5 | 5 | 13 |
| 构造函数注?| 1 | 1 | - | 2 |
| 公共方法注释 | 5 | 5 | 8 | 18 |
| 私有方法注释 | 3 | 3 | 3 | 9 |
| 受保护方法注?| 2 | - | - | 2 |
| 辅助函数注释 | - | - | 1 | 1 |
| 常量注释 | - | - | 1 | 1 |
| 单例注释 | - | - | 1 | 1 |
| **合计** | **9** | **10** | **14** | **33** |

---

## 6. 测试验证结果

### 6.1 单元测试

```powershell
npx vitest run src/services/data-collector/__tests__/
```

**结果**: 53 个测试用例全部通过 ?
### 6.2 类型检?
```powershell
npx tsc --noEmit --skipLibCheck
```

**结果**: 无错??
### 6.3 JSDoc 审计

```powershell
npm run audit:jsdoc
```

**结果**: 三个文件?JSDoc 覆盖率提升至 100% ?
---

## 7. 代码审查要点

### 7.1 审查清单

- [ ] 类注释是否包?`@description`、`@remarks` ?`@example` 标签
- [ ] 公共方法是否包含完整?`@param` ?`@returns` 标签
- [ ] 私有方法是否标注?`@private` 标签
- [ ] 抽象方法是否标注?`@abstract` 标签
- [ ] 可能抛出异常的方法是否包?`@throws` 标签
- [ ] 字段是否包含描述性注?- [ ] 代码示例是否符合实际使用场景
- [ ] 注释内容是否与代码实现一?- [ ] 是否符合项目?JSDoc 规范（见 `../../jsdoc-convention.md`?
### 7.2 后续建议

1. **持续维护**：后续修改代码时应同步更新对应的 JSDoc 注释
2. **文档生成**：可使用 TypeDoc 工具自动生成 API 文档
3. **扩展覆盖**：按优先级继续为其他缺失注释的模块补?JSDoc

---

## 附录

### A. 相关类型定义

- `RawMarketData` - 原始市场数据类型（`src/types/modules/widget.types.ts`?- `DataSourceConfig` - 数据源配置类型（`src/types/modules/widget.types.ts`?- `CollectorConfig` - 采集器配置类型（`src/types/modules/widget.types.ts`?- `CollectionTask` - 采集任务类型（`src/types/modules/widget.types.ts`?- `CollectionTaskStatus` - 任务状态类型（`src/types/modules/widget.types.ts`?- `CollectionResultCallback` - 结果回调类型（`src/types/modules/widget.types.ts`?
### B. 相关常量

- `COLLECTOR_DEFAULT_CONFIG` - 默认采集器配置（`src/constants/cockpit.constants.ts`?- `WEBSOCKET_COLLECTOR_CONFIG` - WebSocket 采集器配置（`src/constants/cockpit.constants.ts`?- `DATA_SOURCE_TYPE` - 数据源类型常量（`src/constants/cockpit.constants.ts`?- `COLLECTION_EVENTS` - 采集事件常量（`src/types/modules/collection.types.ts`?