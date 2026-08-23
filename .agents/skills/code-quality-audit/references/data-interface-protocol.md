# 数据接口协议参考（D8 — Data Interface Protocol）

> 本文件细化「数据传递 / 数据接口协议」维度的**可检查规则**与**规范示例**。
> 以 V9 项目（`src/core/databridge.ts`、`src/core/envelope.ts`、`src/core/acl.ts`、`src/store/helpers/withBroadcast`、`DATA_DEFINITION.md`）为权威实现；通用工程可类比替换为自己的「总线 + 信封 + 鉴权 + 广播」机制。

---

## P1 统一数据总线 DataBridge（写/读入口）

**原则**：服务层（services）与状态层（store）一律经 `DataBridge` 与底层存储交互，禁止直连 `db`/`dataLayer`。

**规范写法**：
```typescript
// services/trade/holdingsService.ts
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'

const envelope = EnvelopeFactory.create(
  { action: 'SAVE_HOLDINGS', source: 'trade', target: 'db', traceId: nanoid(8) },
  payload,
)
await dataBridge.forward(envelope)            // 写：ACL 校验 + 路由 + 审计日志
// 或
const res = await dataBridge.query<HoldingItem[]>({ action: 'GET_HOLDINGS', /* ... */ })  // 读
```

**反模式（违规）**：
```typescript
import { db } from '@/data/db'                // ❌ services 直连 db
await db.put('holdings', item)
```

**可检查规则**：
- `services/**`、`store/**` 不得出现 `import ... from '@/data/db'`。
- 出现 `dataBridge.forward(` / `dataBridge.query(` 视为协议合规正例。

---

## P2 信封 Envelope（标准数据载体）

**原则**：跨层传递的数据必须包裹为标准信封 `{ meta, payload }`，`meta` 含 `source / target / action / traceId / timestamp`，经 `EnvelopeFactory.validate` 校验。

**结构**：
```typescript
interface StandardEnvelope {
  meta: { source: string; target: EnvelopeTarget; action: EnvelopeAction; traceId: string; timestamp: number }
  payload: unknown
}
```

**可检查规则**：
- 写库前必须经 `EnvelopeFactory.create(...)` 构造（或 `DataBridgeAdapter.query(action, payload)` 内部已构造）。
- `meta.action` 须是 `ENVELOPE_ACTION` 中已注册的值；新增 action 须在 `routeToDB()` / `databridgeRouteMap.ts` 的 `ACTION_TO_STORE_MAP` 增加对应 case（否则路由失败）。
- `meta.traceId` 必须存在（用于全链路追踪），`timestamp` 为正毫秒数。

**反模式**：裸对象直接 `forward({ type: 'save', data })` 且无 traceId → 违规。

---

## P3 访问控制 ACL（最小权限）

**原则**：每个模块的读写权限在 `ACL_MATRIX` 白名单中声明，运行时由 `aclEngine.assert({ module, store, operation })` 校验。

**可检查规则**：
- 新增 store 须在 `STORE_NAME` 注册，并在 `ACL_MATRIX` 对应模块增加 `read`/`write` 白名单。
- 新增模块（ModuleId）必须在 `ACL_MATRIX` 注册，否则 `aclEngine.assert` 抛 `AclError`。
- operation 由 action 名推断：`INSERT/SAVE/INGEST → insert`，`UPDATE → update`，`DELETE/CLEAR → delete`，其余 `select`。

**反模式**：模块未在 `ACL_MATRIX` 注册即调用 `forward` → 运行时权限拒绝。

---

## P4 跨 Tab 广播 withBroadcast（状态变更通知）

**原则**：Store 状态变更后，须通过 `withBroadcast(EVENT_NAME, payload)` 广播，保证多 Tab 一致。

**规范写法**：
```typescript
// store/watchlistStore.ts
import { withBroadcast } from '@/store/helpers/withBroadcast'
withBroadcast(EVENT_NAMES.STOCKS_CHANGED, { action: 'loadWatchlist', count: result.data.length })
```

**可检查规则**：
- `store/**` 中状态写操作（set/更新数组）后应有 `withBroadcast` 调用。
- 事件名使用 `EVENT_NAMES` 常量，禁止字符串字面量。

---

## P5 标准 API 响应信封（前后端契约）

**原则**：HTTP 响应统一包装为 `{ code, data, message }`，`code=200` 表示成功。

**结构**（来自 `DATA_DEFINITION.md §1.4`）：
```typescript
interface HoldingsApiResponse<T> {
  code: number      // 200 = 成功
  data: T
  message?: string
}
```
**可检查规则**：
- 服务层对后端响应须做 `code` 判断与类型收窄，不得直接信任 `res.data`。
- 错误响应须带 `message` 并进入统一错误处理（logger.error 带 context）。

---

## P6 数据库版本与 Schema 管理（IndexedDB）

**原则**：Schema 演进须递增 `DB_VERSION`、注册 `STORE_NAME`、登记 `ACL_MATRIX`；基线 store 在 `createSchema`、增量 store 在对应 `Migration.up()`，禁止两处重复创建。

**可检查规则**：
- 修改 schema → `DB_VERSION` 自增（位于 `src/config/dbConfig.ts`）。
- 新增 store → `STORE_NAME` 注册 + `ACL_MATRIX` 白名单。
- 增量 store → 写在对应版本 `Migration.up()`，不写进 `createSchema`。

**V9 权威门禁**：`npm run audit:reserved-stores`、`npm run audit:contract`（db-version-management 类别）。

---

## P7 协议层必须有契约测试

**原则**：DataBridge / Envelope / ACL 是系统信任边界，须经测试覆盖正常与异常（ACL 拒绝、Envelope 校验失败、超时）。

**可检查规则**：
- `src/core/envelope.test.ts`、`src/core/acl.test.ts`、`src/core/memoryCache.test.ts` 等存在且覆盖 validate / assert 异常分支。
- 新增 ENVELOPE_ACTION 或 ACL 模块须补对应用例。

---

## 协议合规快速核对表

| 项 | 合规信号 | 违规信号 |
|----|----------|----------|
| 写库 | `dataBridge.forward(envelope)` | `db.put` / `db.add` 直连 |
| 信封 | `EnvelopeFactory.create` 含 traceId | 裸对象、缺 traceId |
| 路由 | action 在 `ACTION_TO_STORE_MAP` | 未知 action 未注册 |
| ACL | 模块在 `ACL_MATRIX` | 未注册模块调用 forward |
| 广播 | `withBroadcast(EVENT_NAMES.X, …)` | 字符串字面量事件 |
| 响应 | `{ code, data, message }` + code 判断 | 直接 `res.data` |
| 测试 | `*.test.ts` 覆盖协议异常 | 协议层零测试 |
