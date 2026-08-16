---
name: "databridge-migration"
description: "将直接操作 dataLayer 的代码迁移到 DataBridge 信封协议。涵盖 core/层违规修复、services/读取改为 dataBridge.query、写操作改为 dataBridge.forward + 新增 ENVELOPE_ACTION/Handler、迁移时保留业务逻辑、持久化实体类型归位。Invoke when user finds direct dataLayer.stocks/v6Scores/dailyQuotes/orders access in core/ or services/ layers, or when audit:layers reports violations."
version: v1.2.0
last_updated: 2026-08-11
change_log:
  - version: v1.2.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# DataBridge 迁移技能 (DataBridge Migration Skill) — v1.2.0

> **版本**: v1.2.0 | **日期**: 2026-07-13 | **校验基准**: V9 v1.4.6
> **迁移性质**: 代码重构，修改 import 与调用方式
> **输出格式**: 变更文件清单 + 类型检查结果 + 架构审计结果

---

## 一、触发条件（Invoke When）

- `audit:layers` 报告跨层调用违规（core/ 层直接依赖 data/ 层）
- `audit:layers` 报告 services/ 层直接调用 `dataLayer.xxx.get/list/put/save`
- 用户明确要求"将 dataLayer 调用改为 DataBridge"
- 新增业务需要写入 stocks/v6Scores/dailyQuotes/orders 等 store，需新增 ENVELOPE_ACTION

---

## 二、迁移前必读：DataBridge API 速查

### 2.1 读取操作：dataBridge.query()

```typescript
// 单条查询
const result = await dataBridge.query<Stock>({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.stocks,
  key: symbol,
  source: MODULE_ID.xxx,  // 调用模块标识，用于 ACL 校验
})
if (result.success && result.data) {
  const stock = result.data
}

// 列表查询
const result = await dataBridge.query<Stock[]>({
  action: ENVELOPE_ACTION.queryList,
  store: STORE_NAME.stocks,
  source: MODULE_ID.xxx,
})
if (result.success && result.data) {
  const stocks = result.data
}

// 按索引查询
const result = await dataBridge.query<Stock[]>({
  action: ENVELOPE_ACTION.queryByIndex,
  store: STORE_NAME.stocks,
  indexName: 'by-status',
  indexValue: RESEARCH_STATUS.watching,
  source: MODULE_ID.xxx,
})
```

**QueryResult 结构**：
```typescript
interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

### 2.2 写入操作：dataBridge.forward()

```typescript
// 构造信封
const envelope = EnvelopeFactory.create(
  {
    source: MODULE_ID.xxx,
    target: ENVELOPE_TARGET.db,
    action: ENVELOPE_ACTION.updateStock,  // 或自定义 action
    traceId: `xxx-${nanoid(8)}-${symbol}`,
  },
  payload,  // 具体数据
)

// 发送（forward 返回 Promise<void>，失败时抛异常）
try {
  await dataBridge.forward(envelope)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  // 处理错误
}
```

### 2.3 必需导入

```typescript
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { nanoid } from 'nanoid'
```

---

## 三、迁移模式：按违规类型分类

### 模式 A：core/ 层直接读取 dataLayer（最严重）

**违规示例**：
```typescript
// ❌ 违规：core/feedbackOrchestrator.ts 直接调用 dataLayer
import { dataLayer } from '@/data/dataLayer'
const score = await dataLayer.v6Scores.get(symbol)
```

**迁移后**：
```typescript
// ✅ 合规：通过 dataBridge.query 读取
import { dataBridge } from './databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'

const result = await dataBridge.query<V6Score>({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.v6Scores,
  key: symbol,
  source: MODULE_ID.system,
})
if (!result.success || !result.data) {
  // 处理缺失
}
const score = result.data
```

**关键注意**：
- core/ 层**禁止** `import { dataLayer } from '@/data/dataLayer'`
- 删除 dataLayer 导入后，检查是否还有 `ENVELOPE_TARGET` 等未使用导入
- `dataBridge.query()` 返回 `QueryResult<T>`，需检查 `success` 和 `data`

### 模式 B：services/ 读取验证（fetcherService 等）

**违规示例**：
```typescript
// ❌ 违规：写入后通过 dataLayer 验证结果
await dataBridge.forward(envelope)  // 写入
const updated = await dataLayer.stocks.get(symbol)  // 验证
```

**迁移后**：
```typescript
// ✅ 合规：写入后通过 dataBridge.query 验证
try {
  await dataBridge.forward(envelope)
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : String(err) }
}

const updatedResult = await dataBridge.query<Stock>({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.stocks,
  key: symbol,
  source: MODULE_ID.fetcher,
})
if (!updatedResult.success || !updatedResult.data) {
  return { success: false, error: '更新后未找到记录' }
}
return { success: true, data: updatedResult.data }
```

### 模式 C：services/ 写操作绕过 DataBridge（最严重）

**违规示例**：
```typescript
// ❌ 违规：stockpoolService 直接调用 dataLayer.stocks.updateStatus
const result = await dataLayer.stocks.updateStatus(symbol, status)
```

**迁移步骤**：

**Step 1**：在 `src/config/dbConfig.ts` 的 `ENVELOPE_ACTION` 中新增 action
```typescript
export const ENVELOPE_ACTION = {
  // ... 现有 actions
  /** 更新股票研究状态 */
  updateStockStatus: 'UPDATE_STOCK_STATUS',
  /** 更新股票分组 */
  updateStockGroup: 'UPDATE_STOCK_GROUP',
} as const
```

**Step 2**：在 `src/core/databridgeHandlers.ts` 中新增 Handler
```typescript
/**
 * 股票研究状态更新处理器
 */
class UpdateStockStatusHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.updateStockStatus
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { symbol, status } = envelope.payload as { symbol: string; status: string }
    const existing = await db.get<Stock>(store, symbol)
    if (!existing) {
      throw new EnvelopeError(`Stock not found: ${symbol}`)
    }
    await db.put(store, {
      ...existing,
      researchStatus: status,
      updatedAt: Date.now(),
      dataVersion: (existing.dataVersion ?? 0) + 1,
    })
  }
}
```

**Step 3**：在 `createHandlerRegistry()` 中注册 Handler
```typescript
registry.register(new UpdateStockStatusHandler())
```

**Step 4**：在 `src/core/databridge.ts` 的 `ACTION_TO_STORE_MAP` 中新增映射
```typescript
const ACTION_TO_STORE_MAP: Record<string, StoreName> = {
  // ... 现有映射
  [ENVELOPE_ACTION.updateStockStatus]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.updateStockGroup]: STORE_NAME.stocks,
}
```

**Step 5**：在 Service 中改为 forward 调用
```typescript
const envelope = EnvelopeFactory.create(
  {
    source: MODULE_ID.stockpool,
    target: ENVELOPE_TARGET.db,
    action: ENVELOPE_ACTION.updateStockStatus,
    traceId: `pool-transition-${nanoid(8)}-${symbol}`,
  },
  { symbol, status: toStatus },
)
try {
  await dataBridge.forward(envelope)
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : String(err) }
}
```

### 模式 D：services/ 批量列表查询

**违规示例**：
```typescript
// ❌ 违规：直接调用 dataLayer.stocks.list()
const list = await dataLayer.stocks.list()
const list = await dataLayer.stocks.listByStatus(status)
const list = await dataLayer.orders.list()
```

**迁移后**：
```typescript
// ✅ 列表查询
const result = await dataBridge.query<Stock[]>({
  action: ENVELOPE_ACTION.queryList,
  store: STORE_NAME.stocks,
  source: MODULE_ID.xxx,
})
if (!result.success) {
  return { success: false, error: result.error }
}
return { success: true, data: result.data ?? [] }

// ✅ 按索引查询（替代 listByStatus）
const result = await dataBridge.query<Stock[]>({
  action: ENVELOPE_ACTION.queryByIndex,
  store: STORE_NAME.stocks,
  indexName: 'by-status',
  indexValue: status,
  source: MODULE_ID.xxx,
})
```

### 模式 E：services/ 复杂类型查询（含自定义 dataLayer 方法）

**违规示例**：
```typescript
// ❌ 违规：dataLayer 自定义方法无直接 DataBridge 等价物
const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
const latest = await dataLayer.strategySnapshots.getLatest()
const scores = await dataLayer.intelligentScores.getLatestBySymbol(symbol)
```

**处理策略**：

| 策略 | 适用场景 | 示例 |
|------|----------|------|
| **泛型 query + 客户端过滤** | 简单过滤条件 | `listBySymbol` → `queryList` + `filter(r => r.symbol === symbol)` |
| **新增 queryByIndex** | 有对应索引 | `listByStatus` → `queryByIndex` + `indexName: 'by-status'` |
| **保留 dataLayer + TODO** | 复杂聚合/自定义逻辑 | `getLatest()` → 保留 dataLayer 调用，添加 `// TODO: 迁移至 DataBridge` |
| **新增 ENVELOPE_ACTION + Handler** | 高频写入操作 | 按模式 C 处理 |

**示例**：scoreDocs.listBySymbol 迁移
```typescript
// 原代码
const versions = await dataLayer.scoreDocs.listBySymbol(symbol)

// 迁移后（客户端过滤）
const result = await dataBridge.query<Array<{ symbol: string }>>({
  action: ENVELOPE_ACTION.queryList,
  store: STORE_NAME.scoreDocs,
  source: MODULE_ID.analyzer,
})
const versions = result.success && result.data
  ? result.data.filter((r) => r.symbol === symbol)
  : []
```

### 模式 F：迁移写入时保留 dataLayer 业务逻辑

**违规示例**：
```typescript
// ❌ 违规：直接 forward 后丢失时间戳填充
await dataBridge.forward(envelope) // payload 中无 createdAt/updatedAt
```

**迁移后**：新增 Handler 复刻原 dataLayer 逻辑
```typescript
// src/core/databridgeHandlers.ts
class CustomAgentSaveHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.saveCustomAgent
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const agent = envelope.payload as Omit<CustomAgent, 'createdAt' | 'updatedAt'> & { createdAt?: number }
    const existing = await db.get<CustomAgent>(store, agent.id)
    const full: CustomAgent = {
      ...agent,
      createdAt: existing?.createdAt ?? agent.createdAt ?? now(),
      updatedAt: now(),
    }
    await db.put(store, full)
  }
}
```

**判定标准**：
- 若原 `dataLayer.xxx.save()` 只是简单 `sendWriteEnvelope`，直接 `forward` 即可
- 若原方法含时间戳、合并、默认值、级联，必须在 Handler 或调用方保留等价逻辑

---

## 四、迁移检查清单

### 4.1 修改前检查

- [ ] 确认违规类型（A/B/C/D/E）
- [ ] 读取 `src/core/databridge.ts` 确认 `query()` 签名和 `QueryResult` 结构
- [ ] 读取 `src/core/databridgeHandlers.ts` 确认现有 Handler 模式
- [ ] 检查是否需要新增 ENVELOPE_ACTION（模式 C/E）
- [ ] 检查 `ACTION_TO_STORE_MAP` 是否已有对应映射
- [ ] 评估复杂查询是否适合客户端过滤（模式 E）

### 4.2 修改中检查

- [ ] 删除 `import { dataLayer } from '@/data/dataLayer'`
- [ ] 添加 `import { dataBridge } from '@/core/databridge'`（如需要）
- [ ] 添加 `import { EnvelopeFactory } from '@/core/envelope'`（如需要 forward）
- [ ] 添加 `import { nanoid } from 'nanoid'`（如需要构造 traceId）
- [ ] 检查 `ENVELOPE_TARGET` 是否仍在使用（可能已移除）
- [ ] 所有 `dataLayer.xxx.get()` 改为 `dataBridge.query()` + 检查 `success/data`
- [ ] 所有 `dataLayer.xxx.list()` 改为 `dataBridge.query()` + `action: queryList`
- [ ] 所有 `dataLayer.xxx.listByStatus()` 改为 `dataBridge.query()` + `action: queryByIndex`
- [ ] 所有 `dataLayer.xxx.save/put/update` 改为 `dataBridge.forward()` + try/catch
- [ ] 对模式 E 复杂查询，添加 `// TODO: 迁移至 DataBridge` 标记
- [ ] 对模式 F，检查原 dataLayer 方法是否含时间戳/合并逻辑，并在 Handler 中复刻
- [ ] 若迁移持久化实体类型，同步更新 `src/data/types/` 与 `validate-data-consistency.ts` 映射

### 4.3 修改后验证

- [ ] `node node_modules/typescript/bin/tsc --noEmit` 通过
- [ ] `node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts` 0 违规
- [ ] 相关单元测试通过（如有）
- [ ] 检查是否引入未使用的导入（TS6133 错误）
- [ ] 检查是否遗漏 TODO 标记（模式 E）

---

## 五、常见陷阱与解决方案

| 陷阱 | 现象 | 解决方案 |
|------|------|----------|
| `forward()` 返回 `void` | 尝试检查 `result.success` 报错 | `forward()` 成功无返回，失败抛异常。用 `try/catch` 处理错误 |
| `query()` 返回 `QueryResult` | 直接赋值 `const data = await dataBridge.query()` 类型错误 | 检查 `result.success && result.data` 后再使用 `result.data` |
| 忘记在 `ACTION_TO_STORE_MAP` 注册 | `forward()` 报 `Unknown action` | 新增 action 后必须同时在 dbConfig.ts、Handler、Registry、ACTION_TO_STORE_MAP 四处注册 |
| `ENVELOPE_TARGET` 未使用 | 编译错误 `Cannot find name 'ENVELOPE_TARGET'` | 如果代码中不再使用 `ENVELOPE_TARGET`（如构造 envelope 时硬编码 `target: 'event'`），删除该导入 |
| 类型参数不匹配 | `query()` 返回 `unknown` 需手动断言 | 使用 `dataBridge.query<Stock>({...})` 泛型参数指定类型 |
| 索引查询缺参数 | `queryByIndex` 缺少 `indexName`/`indexValue` | 必须同时提供 `indexName` 和 `indexValue`，否则运行时断言失败 |
| 复杂查询无直接等价物 | `listBySymbol` / `getLatest` 等自定义方法 | 评估客户端过滤或保留 TODO 标记，后续统一新增 action |
| 测试 mock 未同步 | 测试失败，mock 的 dataLayer 方法未被调用 | 将 `vi.mocked(dataLayer.xxx.get)` 改为 `vi.mocked(dataBridge.query)` |
| Handler 丢失原 dataLayer 业务逻辑 | `customAgent.save` 迁移后 `createdAt/updatedAt` 不再写入 | 若 `dataLayer.xxx.save()` 含时间戳/合并逻辑，必须在 Handler 中复刻或保留 dataLayer 调用 |
| 类型层迁移后 validator 扫描不到字段 | `validate-data-consistency.ts` 报字段缺失 | validator 不识别 `interface A extends B {}`，需在 `src/data/types/` 中给出完整字段定义 |
| 读操作全部改为 `dataBridge.query` 成本过高 | 简单查询可改，复杂聚合改不动 | data/ 层内部工具（如 queryBuilder）可保留 dataLayer 读；跨层 services 优先改为 DataBridge |

---

## 六、验证命令速查

```powershell
# 类型检查（必须首先通过）
node node_modules/typescript/bin/tsc --noEmit

# 架构审计（必须 0 违规）
node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts

# 单元测试（如涉及测试文件修改）
node node_modules/vitest/vitest.mjs run <相关路径>

# 全量审计（阶段完成后）
node node_modules/typescript/bin/tsc --noEmit
node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts
node node_modules/tsx/dist/cli.mjs scripts/audit-hardcode.ts
node node_modules/tsx/dist/cli.mjs scripts/audit-deadcode.ts
```

---

## 七、与已有 SKILL 的协同关系

| 已有 SKILL | 协同点 |
|-----------|--------|
| `architecture-radar-scan` | 迁移前调用，扫描 dataLayer 违规点；迁移后调用，验证 0 违规 |
| `type-safety-contract` | 新增 ENVELOPE_ACTION 类型时，确保不破坏现有类型约束 |

---

## 八、版本记录

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-12 | 初始版本：基于 P0/P1 修复实践总结，覆盖 4 种迁移模式（core读取/service读取验证/service写入/service列表查询）、新增 Handler SOP、常见陷阱清单 |
| v1.1.0 | 2026-07-12 | 新增模式 E（复杂查询/自定义方法处理策略）、客户端过滤示例、TODO 标记规范、测试 mock 同步陷阱 |
| v1.2.0 | 2026-07-13 | 新增 Handler 业务逻辑保留、持久化实体类型归位、validator interface extends 限制、读操作分层策略 |
