---
phase: maintenance
maintainer: V9 Architecture Team
summary: Data Collector 模块 JSDoc 更新摘要
tags: [changelog, jsdoc]
version: v1.0.0
last_updated: 2026-07-12
doc_id: reports\changelogs\2026-07\jsdoc-update-summary-data-collector-20260712
tier: T2
---﻿---
title: jsdoc-update-summary-data-collector-20260712
tier: T1
status: active
type: reference
domain: data
doc_id: V9-DOC-AUTO-119F5A
code_version: 2.0.0
---

# JSDoc ĵ嵥 - Data Collector ģ

> ****: 2026-07-12
> **汾**: v1.0
> **ģ**: data-collector
> **ļ**: 3
> **עͷ**: 28

---

## Ŀ¼

1. [](#)
2. [ļϸ](#ļϸ)
   - [BaseCollector.ts](#basecollectorts)
   - [WebSocketCollector.ts](#websocketcollectorts)
   - [TaskScheduler.ts](#taskschedulerts)
3. [Աȱ](#Աȱ)
4. [֤](#֤)
5. [Ҫ](#Ҫ)

---

## 

| ļ | ԭ | ע |  | ״̬ |
|------|---------|-----------|---------|---------|
| [BaseCollector.ts](../../../../src/services/data-collector/collectors/BaseCollector.ts) | 9 | 9 |  + ֶ + 캯 + з | ?  |
| [WebSocketCollector.ts](../../../../src/services/data-collector/collectors/WebSocketCollector.ts) | 10 | 10 |  + ֶ + 캯 + з | ?  |
| [TaskScheduler.ts](../../../../src/services/data-collector/TaskScheduler.ts) | 14 | 14 |  +  +  + ֶ + з +  | ?  |

---

## ļϸ

### BaseCollector.ts

**ļ·**: `src/services/data-collector/collectors/BaseCollector.ts`

#### ע

```typescript
/**
 * ݲɼ
 * @description ṩȫֳʱжϡͳһ󲶻Իơݰװͨĳ
 * @abstract оɼ RESTWebSocketMock̳дಢʵ collect 
 * @example
 * ```typescript
 * class MyCollector extends BaseCollector {
 *   async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
 *     // ʵ־ɼ߼
 *     return this.wrapData('indices', rawData, 'my-source')
 *   }
 * }
 * ```
 */
```

#### ֶע

| ֶ | ע |
|--------|---------|
| `config` | ɼãʱԴԼȲ |
| `abortController` | ȡڽеĲɼĿ |
| `isRunning` | ɼ״̬ʶ |

#### 캯ע

```typescript
/**
 * 캯
 * @param config ɼѡѡδṩʹĬֵ
 * @see COLLECTOR_DEFAULT_CONFIG ȡĬֵ
 */
```

#### ע

|  | עͱǩ | ؼֶ |
|--------|---------|---------|
| `collect()` | `@description`, `@param`, `@returns`, `@abstract`, `@throws` | 󷽷ʵ |
| `collectWithRetry()` | `@description`, `@param`, `@returns`, `@throws`, `@remarks`, `@see` | ʱԻƵĲɼװ |
| `tryCollectOnce()` | `@description`, `@param`, `@returns`, `@private` | ִеβɼԣڲ |
| `executeWithTimeout()` | `@description`, `@param`, `@returns`, `@throws`, `@private` | ִдʱƵĲɼڲ |
| `cancel()` | `@description`, `@remarks` | ȡǰڽеĲɼ |
| `getIsRunning()` | `@description`, `@returns` | ȡǰɼ״̬ |
| `delay()` | `@description`, `@param`, `@returns`, `@protected` | ӳٹ߷ |
| `wrapData()` | `@description`, `@param`, `@returns`, `@protected`, `@example` | ͳһݰװʽ |

---

### WebSocketCollector.ts

**ļ·**: `src/services/data-collector/collectors/WebSocketCollector.ts`

#### ע

```typescript
/**
 * WebSocket ݲɼ
 * @description  WebSocket Эʵʱݲɼ֧ԶϢл塢ƶϵȹ
 * @remarks  VITE_DATA_SOURCE_TYPE=websocket ʱãڳʵʱͳ
 * @extends BaseCollector
 * @example
 * ```typescript
 * const collector = new WebSocketCollector()
 * collector.onMessage((data) => {
 *   console.log('յʵʱ:', data)
 * })
 * collector.connect('/ws/indices')
 * ```
 * @todo ڲ߼ɸʵ WebSocket Э鲹ʵ
 */
```

#### ֶע

| ֶ | ע |
|--------|---------|
| `ws` | WebSocket ʵ |
| `reconnectCount` | ǰ |
| `reconnectTimer` | ʱ ID |
| `messageQueue` | ϢУδʱϢ |
| `onMessageCallback` | Ϣջص |

#### 캯ע

```typescript
/**
 * 캯
 * @param config ɼѡ̳ BaseCollector
 */
```

#### ע

|  | עͱǩ | ؼֶ |
|--------|---------|---------|
| `collect()` | `@description`, `@param`, `@returns`, `@remarks` | ִ WebSocket ӣԤչӿڣ |
| `connect()` | `@description`, `@param`, `@remarks`, `@see` |  WebSocket  |
| `disconnect()` | `@description`, `@remarks` | Ͽ WebSocket  |
| `send()` | `@description`, `@param`, `@remarks` | Ϣ WebSocket  |
| `onMessage()` | `@description`, `@param`, `@example` | Ϣջص |
| `handleReconnect()` | `@description`, `@param`, `@remarks`, `@private` | ӶϿ߼ڲ |
| `flushMessageQueue()` | `@description`, `@remarks`, `@private` | ˢϢУڲ |
| `inferDataType()` | `@description`, `@param`, `@returns`, `@private` |  endpoint ·ƶͣڲ |
| `cancel()` | `@description`, `@remarks` | ȡɼ񣨶ϿӲ״̬ |

---

### TaskScheduler.ts

**ļ·**: `src/services/data-collector/TaskScheduler.ts`

#### 볣ע

```typescript
/**
 * ״̬¼ڲ
 * @param taskId  ID
 * @param status ״̬
 * @param payload Ӹ
 * @private
 */
function emitTaskStatus(...)

/**
 * ݲɼѯĬϼ룩
 * @remarks ԭӲ 60000 ȡΪ audit:hardcodeӲ볬ʱŽ
 */
const DEFAULT_POLL_INTERVAL_MS = 60000
```

#### ע

```typescript
/**
 * ɼ
 * @description 𵥸 Widget ݲɼעᡢֹͣ״̬
 * @remarks ֧Զʱѯpolling ģʽִУonce ģʽʽɼstreaming ģʽҳʱ dispose ʱֹڴй©
 * @example
 * ```typescript
 * // עᲢɼ
 * const taskId = taskScheduler.registerTask('widget-1', 'instance-1', dataSource)
 * taskScheduler.startTask(taskId)
 *
 * // Ĳɼ
 * const unsubscribe = taskScheduler.subscribe((taskId, data, error) => {
 *   if (error) {
 *     console.error('ɼʧ:', error)
 *   } else {
 *     console.log('ɼɹ:', data)
 *   }
 * })
 *
 * // ҳʱ
 * unsubscribe()
 * taskScheduler.dispose()
 * ```
 */
```

#### ֶע

| ֶ | ע |
|--------|---------|
| `tasks` | ӳkey Ϊ taskIdvalue Ϊ |
| `timers` | ʱӳkey Ϊ taskIdvalue Ϊʱ ID |
| `collectors` | ɼӳkey Ϊ taskIdvalue Ϊɼʵ |
| `listeners` |  |
| `taskCounter` | Ψһ ID |

#### ע

|  | עͱǩ | ؼֶ |
|--------|---------|---------|
| `registerTask()` | `@description`, `@param`, `@returns`, `@remarks`, `@example` | עɼ |
| `startTask()` | `@description`, `@param`, `@returns`, `@remarks`, `@throws` | ɼ |
| `stopTask()` | `@description`, `@param`, `@remarks` | ֹͣɼ |
| `unregisterTask()` | `@description`, `@param`, `@remarks` | עɼ |
| `subscribe()` | `@description`, `@param`, `@returns`, `@example` | Ĳɼ |
| `getTaskStatus()` | `@description`, `@param`, `@returns` | ȡ״̬ |
| `getAllTasks()` | `@description`, `@returns` | ȡעб |
| `runPipelineOnce()` | `@description`, `@param`, `@returns`, `@remarks` | ʹ collectionPipeline ִеβɼ |
| `dispose()` | `@description`, `@remarks` | ҳʱã |
| `executeTask()` | `@description`, `@param`, `@returns`, `@remarks`, `@private` | ִеβɼڲ |
| `notifyErrorListeners()` | `@description`, `@param`, `@remarks`, `@private` | м㲥ڲ |
| `getOrCreateCollector()` | `@description`, `@param`, `@returns`, `@remarks`, `@private` | Դͻȡ򴴽ӦĲɼڲ |

#### ʵע

```typescript
/**
 * TaskScheduler ʵ
 * @description ȫֹĲɼʵڹݲɼ
 */
export const taskScheduler = new TaskScheduler()
```

---

## Աȱ

### BaseCollector.ts Ա

|  | ޸ǰ | ޸ĺ |
|--------|--------|--------|
| ͷע |  |  + ʾ |
| ֶע |  | ȫ 3 ֶע |
| 캯ע |  | עͣ@param + @see |
| `collect()` | ע |  @throws ǩ |
| `collectWithRetry()` | ע |  @throws + @remarks + @see |
| ˽з | ע | ȫע |
| `wrapData()` | ע |  @example ʾ |

### WebSocketCollector.ts Ա

|  | ޸ǰ | ޸ĺ |
|--------|--------|--------|
| ͷע |  |  + @extends + ʾ |
| ֶע |  | ȫ 5 ֶע |
| 캯ע |  | ע |
| `connect()` | ע |  @see ó |
| `send()` | ע |  @remarks ˵Ϣл |
| `onMessage()` | ע |  @example ʾ |
| ˽з | ע | ȫע |
| `cancel()` | ע |  @remarks ˵д߼ |

### TaskScheduler.ts Ա

|  | ޸ǰ | ޸ĺ |
|--------|--------|--------|
| `emitTaskStatus()` | ע | עͣ@private |
| `DEFAULT_POLL_INTERVAL_MS` | ע |  JSDoc ע |
| ͷע |  |  + ʾ |
| ֶע |  | ȫ 5 ֶע |
| `registerTask()` | ע |  @example ʾ |
| `startTask()` | ע |  @remarks ˵ģʽ |
| `subscribe()` | ע |  @example ʾ |
| `runPipelineOnce()` | ע | ϸ˵ |
| `dispose()` | ע |  @remarks ǿڴй© |
| ˽з | ע | ȫע |
| ʵ | ע | ע |

---

## ֤

### Ԫ

```powershell
npm test -- --run src/services/data-collector/

# 
Test Files  4 passed (4)
Tests       53 passed (53)
Duration    4.60s
```

## ͼ

```powershell
npx tsc --noEmit --skipLibCheck

# 
? ޴
```

## JSDoc 

```powershell
npm run audit:jsdoc

# 
??  16 ʵȱ JSDoc޸ĵļ
```

---

## Ҫ

### 1. ע

- [x] й `@param`  `@returns`
- [x] ׳쳣ķ `@throws`
- [x] ؼ `@example` ʹʾ
- [x] ˽з `@private` ǩ
- [x] ֶκͳע

### 2. һ

- [x] עͷͳһ
- [x] JSDoc ǩʹù淶
- [x] ͷֵ׼ȷ

### 3. 

- [x] ߼
- [x] עͣ޸ҵ߼
- [x] µ

### 4. ȫ

- [x] ¶Ϣ
- [x] ޸־ʽ

---

## 

1. **ʣģ**ȼб P0/P1/P2 ȱʧעļ
2. ** API ĵ**ʹ TypeDoc  API ĵ
3. **Զ** pre-commit hook ȷ JSDoc ע

---

*ĵʱ: 2026-07-12*
