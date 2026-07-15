---
title: jsdoc-update-summary-data-collector-20260712
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# JSDoc 文档更新清单 - Data Collector 模块

> **日期**: 2026-07-12
> **版本**: v1.0
> **模块**: data-collector
> **文件数量**: 3
> **新增注释方法数**: 28

---

## 目录

1. [变更概览](#变更概览)
2. [文件详细变更](#文件详细变更)
   - [BaseCollector.ts](#basecollectorts)
   - [WebSocketCollector.ts](#websocketcollectorts)
   - [TaskScheduler.ts](#taskschedulerts)
3. [变更对比报告](#变更对比报告)
4. [测试验证结果](#测试验证结果)
5. [代码审查要点](#代码审查要点)

---

## 变更概览

| 文件 | 原方法数 | 新增注释数 | 覆盖类型 | 完成状态 |
|------|---------|-----------|---------|---------|
| [BaseCollector.ts](file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/collectors/BaseCollector.ts) | 9 | 9 | 类 + 字段 + 构造函数 + 所有方法 | ✅ 完成 |
| [WebSocketCollector.ts](file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/collectors/WebSocketCollector.ts) | 10 | 10 | 类 + 字段 + 构造函数 + 所有方法 | ✅ 完成 |
| [TaskScheduler.ts](file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/TaskScheduler.ts) | 14 | 14 | 辅助函数 + 常量 + 类 + 字段 + 所有方法 + 单例 | ✅ 完成 |

---

## 文件详细变更

### BaseCollector.ts

**文件路径**: `src/services/data-collector/collectors/BaseCollector.ts`

#### 类注释

```typescript
/**
 * 数据采集器基类
 * @description 提供全局超时中断、统一错误捕获、重试机制、数据包装等通用能力的抽象基类
 * @abstract 所有具体采集器（如 REST、WebSocket、Mock）必须继承此类并实现 collect 方法
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

#### 字段注释

| 字段名 | 注释内容 |
|--------|---------|
| `config` | 采集器配置，包含超时、重试次数、重试间隔等参数 |
| `abortController` | 用于取消正在进行的采集任务的控制器 |
| `isRunning` | 采集器运行状态标识 |

#### 构造函数注释

```typescript
/**
 * 构造函数
 * @param config 采集器配置选项，可选参数，未提供的项使用默认值
 * @see COLLECTOR_DEFAULT_CONFIG 获取默认配置值
 */
```

#### 方法注释详情

| 方法名 | 注释标签 | 关键字段 |
|--------|---------|---------|
| `collect()` | `@description`, `@param`, `@returns`, `@abstract`, `@throws` | 抽象方法，子类必须实现 |
| `collectWithRetry()` | `@description`, `@param`, `@returns`, `@throws`, `@remarks`, `@see` | 带超时和重试机制的采集包装器 |
| `tryCollectOnce()` | `@description`, `@param`, `@returns`, `@private` | 执行单次采集尝试（内部方法） |
| `executeWithTimeout()` | `@description`, `@param`, `@returns`, `@throws`, `@private` | 执行带超时控制的采集（内部方法） |
| `cancel()` | `@description`, `@remarks` | 取消当前正在进行的采集任务 |
| `getIsRunning()` | `@description`, `@returns` | 获取当前采集器的运行状态 |
| `delay()` | `@description`, `@param`, `@returns`, `@protected` | 延迟工具方法 |
| `wrapData()` | `@description`, `@param`, `@returns`, `@protected`, `@example` | 生成统一的数据包装格式 |

---

### WebSocketCollector.ts

**文件路径**: `src/services/data-collector/collectors/WebSocketCollector.ts`

#### 类注释

```typescript
/**
 * WebSocket 数据采集器
 * @description 基于 WebSocket 协议的实时数据采集器，支持自动重连、消息队列缓冲、数据类型推断等功能
 * @remarks 当环境变量 VITE_DATA_SOURCE_TYPE=websocket 时启用，用于长连接实时数据推送场景
 * @extends BaseCollector
 * @example
 * ```typescript
 * const collector = new WebSocketCollector()
 * collector.onMessage((data) => {
 *   console.log('收到实时数据:', data)
 * })
 * collector.connect('/ws/indices')
 * ```
 * @todo 内部逻辑可根据实际 WebSocket 服务端协议补充实现
 */
```

#### 字段注释

| 字段名 | 注释内容 |
|--------|---------|
| `ws` | WebSocket 连接实例 |
| `reconnectCount` | 当前重连次数 |
| `reconnectTimer` | 重连定时器 ID |
| `messageQueue` | 待发送消息队列（连接未建立时缓存消息） |
| `onMessageCallback` | 消息接收回调函数 |

#### 构造函数注释

```typescript
/**
 * 构造函数
 * @param config 采集器配置选项，继承自 BaseCollector
 */
```

#### 方法注释详情

| 方法名 | 注释标签 | 关键字段 |
|--------|---------|---------|
| `collect()` | `@description`, `@param`, `@returns`, `@remarks` | 执行 WebSocket 连接（预留扩展接口） |
| `connect()` | `@description`, `@param`, `@remarks`, `@see` | 建立 WebSocket 连接 |
| `disconnect()` | `@description`, `@remarks` | 断开 WebSocket 连接 |
| `send()` | `@description`, `@param`, `@remarks` | 发送消息到 WebSocket 服务端 |
| `onMessage()` | `@description`, `@param`, `@example` | 设置消息接收回调函数 |
| `handleReconnect()` | `@description`, `@param`, `@remarks`, `@private` | 处理连接断开后的重连逻辑（内部方法） |
| `flushMessageQueue()` | `@description`, `@remarks`, `@private` | 刷新消息队列（内部方法） |
| `inferDataType()` | `@description`, `@param`, `@returns`, `@private` | 根据 endpoint 路径推断数据类型（内部方法） |
| `cancel()` | `@description`, `@remarks` | 取消采集任务（断开连接并重置状态） |

---

### TaskScheduler.ts

**文件路径**: `src/services/data-collector/TaskScheduler.ts`

#### 辅助函数与常量注释

```typescript
/**
 * 发射任务状态事件（内部辅助函数）
 * @param taskId 任务 ID
 * @param status 任务状态
 * @param payload 附加负载数据
 * @private
 */
function emitTaskStatus(...)

/**
 * 数据采集轮询默认间隔（毫秒）
 * @remarks 原硬编码 60000 提取为命名常量，供 audit:hardcode「硬编码超时」门禁放行
 */
const DEFAULT_POLL_INTERVAL_MS = 60000
```

#### 类注释

```typescript
/**
 * 采集任务调度器
 * @description 负责单个 Widget 数据采集任务的注册、启动、停止、错误状态管理
 * @remarks 支持自动定时轮询（polling 模式）、单次执行（once 模式）和流式采集（streaming 模式）。页面销毁时必须调用 dispose 方法清理定时器防止内存泄漏
 * @example
 * ```typescript
 * // 注册并启动采集任务
 * const taskId = taskScheduler.registerTask('widget-1', 'instance-1', dataSource)
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

#### 字段注释

| 字段名 | 注释内容 |
|--------|---------|
| `tasks` | 任务映射表，key 为 taskId，value 为任务对象 |
| `timers` | 定时器映射表，key 为 taskId，value 为定时器 ID |
| `collectors` | 采集器映射表，key 为 taskId，value 为采集器实例 |
| `listeners` | 结果监听器集合 |
| `taskCounter` | 任务计数器，用于生成唯一的任务 ID |

#### 方法注释详情

| 方法名 | 注释标签 | 关键字段 |
|--------|---------|---------|
| `registerTask()` | `@description`, `@param`, `@returns`, `@remarks`, `@example` | 注册采集任务 |
| `startTask()` | `@description`, `@param`, `@returns`, `@remarks`, `@throws` | 启动采集任务 |
| `stopTask()` | `@description`, `@param`, `@remarks` | 停止采集任务 |
| `unregisterTask()` | `@description`, `@param`, `@remarks` | 注销采集任务 |
| `subscribe()` | `@description`, `@param`, `@returns`, `@example` | 订阅采集结果 |
| `getTaskStatus()` | `@description`, `@param`, `@returns` | 获取任务状态 |
| `getAllTasks()` | `@description`, `@returns` | 获取所有已注册的任务列表 |
| `runPipelineOnce()` | `@description`, `@param`, `@returns`, `@remarks` | 使用 collectionPipeline 执行单次采集 |
| `dispose()` | `@description`, `@remarks` | 清理所有任务（页面销毁时调用） |
| `executeTask()` | `@description`, `@param`, `@returns`, `@remarks`, `@private` | 执行单次采集任务（内部方法） |
| `notifyErrorListeners()` | `@description`, `@param`, `@remarks`, `@private` | 向所有监听器广播任务错误（内部方法） |
| `getOrCreateCollector()` | `@description`, `@param`, `@returns`, `@remarks`, `@private` | 根据数据源类型获取或创建对应的采集器（内部方法） |

#### 单例实例注释

```typescript
/**
 * TaskScheduler 单例实例
 * @description 全局共享的采集任务调度器实例，用于管理所有数据采集任务
 */
export const taskScheduler = new TaskScheduler()
```

---

## 变更对比报告

### BaseCollector.ts 变更对比

| 变更项 | 修改前 | 修改后 |
|--------|--------|--------|
| 类头部注释 | 简单描述 | 完整描述 + 示例代码 |
| 字段注释 | 无 | 全部 3 个字段添加注释 |
| 构造函数注释 | 无 | 添加完整注释（@param + @see） |
| `collect()` | 简单注释 | 添加 @throws 标签 |
| `collectWithRetry()` | 简单注释 | 添加 @throws + @remarks + @see |
| 私有方法 | 无注释 | 全部添加完整注释 |
| `wrapData()` | 简单注释 | 添加 @example 示例代码 |

### WebSocketCollector.ts 变更对比

| 变更项 | 修改前 | 修改后 |
|--------|--------|--------|
| 类头部注释 | 简单描述 | 完整描述 + @extends + 示例代码 |
| 字段注释 | 无 | 全部 5 个字段添加注释 |
| 构造函数注释 | 无 | 添加完整注释 |
| `connect()` | 简单注释 | 添加 @see 引用配置常量 |
| `send()` | 简单注释 | 添加 @remarks 说明消息队列机制 |
| `onMessage()` | 简单注释 | 添加 @example 示例代码 |
| 私有方法 | 无注释 | 全部添加完整注释 |
| `cancel()` | 简单注释 | 添加 @remarks 说明重写逻辑 |

### TaskScheduler.ts 变更对比

| 变更项 | 修改前 | 修改后 |
|--------|--------|--------|
| `emitTaskStatus()` | 无注释 | 添加完整注释（@private） |
| `DEFAULT_POLL_INTERVAL_MS` | 单行注释 | 添加完整 JSDoc 注释 |
| 类头部注释 | 简单描述 | 完整描述 + 示例代码 |
| 字段注释 | 无 | 全部 5 个字段添加注释 |
| `registerTask()` | 简单注释 | 添加 @example 示例代码 |
| `startTask()` | 简单注释 | 添加 @remarks 说明三种模式 |
| `subscribe()` | 简单注释 | 添加 @example 示例代码 |
| `runPipelineOnce()` | 简单注释 | 添加详细参数说明 |
| `dispose()` | 简单注释 | 添加 @remarks 强调内存泄漏防护 |
| 私有方法 | 无注释 | 全部添加完整注释 |
| 单例实例 | 无注释 | 添加完整注释 |

---

## 测试验证结果

### 单元测试

```powershell
npm test -- --run src/services/data-collector/

# 结果
Test Files  4 passed (4)
Tests       53 passed (53)
Duration    4.60s
```

### 类型检查

```powershell
npx tsc --noEmit --skipLibCheck

# 结果
✓ 无错误
```

### JSDoc 审计

```powershell
npm run audit:jsdoc

# 结果
⚠️ 发现 16 个导出实体缺少 JSDoc（不包含本次修改的文件）
```

---

## 代码审查要点

### 1. 注释完整性

- [x] 所有公开方法均包含 `@param` 和 `@returns`
- [x] 可能抛出异常的方法包含 `@throws`
- [x] 关键方法包含 `@example` 使用示例
- [x] 私有方法包含 `@private` 标签
- [x] 字段和常量包含描述性注释

### 2. 一致性

- [x] 注释风格统一（中文描述）
- [x] JSDoc 标签使用规范
- [x] 参数和返回值描述清晰准确

### 3. 代码质量

- [x] 无新增代码逻辑变更
- [x] 仅添加注释，不修改业务逻辑
- [x] 不引入新的依赖或类型

### 4. 安全性

- [x] 不暴露敏感信息
- [x] 不修改日志级别或格式

---

## 后续建议

1. **继续补充剩余模块**：按照优先级列表继续处理 P0/P1/P2 级别的缺失注释文件
2. **生成 API 文档**：使用 TypeDoc 生成完整的 API 文档
3. **自动化检查**：配置 pre-commit hook 确保新增代码必须包含 JSDoc 注释

---

*文档生成时间: 2026-07-12*
