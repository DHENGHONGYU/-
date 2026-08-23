---
skill_id: V9-SKILL-DATABRIDGE-MIGRATION
name: "databridge-migration"
description: "将直接操作 dataLayer 的代码迁移到 DataBridge 信封协议。涵盖 core/层违规修复、services/读取改为 dataBridge.query、写操作改为 dataBridge.forward + 新增 ENVELOPE_ACTION/Handler、迁移时保留业务逻辑、持久化实体类型归位。Invoke when user finds direct dataLayer.stocks/v6Scores/dailyQuotes/orders access in core/ or services/ layers, audit:layers reports violations, 或需要新增写入 stocks/v6Scores/dailyQuotes/orders 等 store 必须新增 ENVELOPE_ACTION 的场景。"
version: "v1.2.3"
last_updated: "2026-08-23"
change_log:
  - version: v1.2.3
    changes: "跨平台 SKILL 体系统一(2026-08-23)：补全 skill_id 对齐 registry，junction 单一物理源加载，统一索引与跨平台加载契约登记"
    date: 2026-08-23
  - version: v1.2.2
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥5，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.2.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 8 段自定义标题（触发条件+API速查+迁移模式A-F+检查清单+陷阱清单+验证速查+协同+版本记录）合并重映射为标准一~五段；§二前置检查合并 API 真相源 + 违规类型判定表格化（7 项）；§三迁移 SOP 拆 7 个 Phase（API 速查→A core读→B service读→C 写Handler→D 批量查询→E 复杂查询→F 业务逻辑+验证）；§四扩展至 8 条教训（后果+规避双字段）；§五交付物≥10 项+必要且充分条件声明；补 mandatory=true 对齐 registry。"
    date: 2026-08-21
  - version: v1.2.0
    changes: "v1.2.0(2026-07-13)：新增 Handler 业务逻辑保留、持久化实体类型归位、validator interface extends 限制、读操作分层策略"
    date: 2026-07-13
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: true
---

# DataBridge 信封协议迁移 — v1.2.2

> **版本**: v1.2.2 | **日期**: 2026-08-21 | **校验基准**: V9 AGENTS.md §一 分层规则 + DataBridge/Envelope 源码（src/core/databridge.ts + envelope.ts）
> **迁移性质**: 代码重构，修改 import 与调用方式；禁止修改业务语义（值、顺序、错误处理、时间戳填充必须与原 dataLayer 等价）
> **输出格式**: 变更文件清单 + 类型检查结果 + 架构审计结果 + 常见陷阱 + 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求将 dataLayer 调用改为 DataBridge；或对某次模块重构强制要求全链路过 DataBridge（core/services/components → dataLayer/db 裸访问清零）
- **显式触发 2**：怀疑某 Service 写操作仍然直用 dataLayer 但 audit:layers 漏检；或 Handler 中丢失原 dataLayer 的 createdAt/updatedAt 填充逻辑；写路径绕过 ACL 权限
- **脚本/审计触发 3**：`npm run audit:layers` 报 core/ 层直接依赖 data/ 层（core → dataLayer/db 违规）；或 services/ 层直接调用 `dataLayer.xxx.get/list/put/save`（绕过 DataBridge）；或 `npm run audit:db-references` FAIL
- **脚本/审计触发 4**：Handler 注册缺失报 `Unknown action`、ACL 拒写报 `ACL_PERMISSION_DENIED`、Store 名未登记报 `store not found onupgradeneeded`、或 `npm run tsc:prod` 报 ENVELOPE_ACTION/STORE_NAME 类型不一致
- **设计/协议触发 5**：新增业务需要写入 `stocks / v6Scores / dailyQuotes / orders` 等 store，必须新增 `ENVELOPE_ACTION` + Handler + ACTION_TO_STORE_MAP 四位置同步；DataBridge/Envelope 协议升级后存量调用点迁移

**不触发场景 · 减少误激活**：
- data/ 层内部工具（如 queryBuilder、validator）直读 dataLayer（允许；跨层违规指 core/services/store/components → data）；
- 简单查询不涉及 dataLayer 的纯内存路径。

**协作 Skill / 链式调用**：
- 审计前置→`architecture-radar-scan`（L3 数据桥防腐层）· `architecture-cleanup`（跨层通用清理）；
- 类型修改→`type-safety-contract`（新增 ENVELOPE_ACTION/STORE_NAME 类型前 6 步契约）；
- DB 引用一致性→`db-reference-audit`（迁移后核对 ACTION_TO_STORE_MAP、STORE_NAME/Schema 对齐）。

---

## 二、前置检查

> **铁律: 新增写 ENVELOPE_ACTION 必须 4 位置 100% 同步（dbConfig.ts 定义 + databridgeHandlers.ts Handler 实现 + createHandlerRegistry() 注册 + databridge.ts ACTION_TO_STORE_MAP 映射），缺一即运行时报 `Unknown action` / 写入黑洞。**

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 读取 DataBridge API 真相源 | 打开 `src/core/databridge.ts`：`query()` 签名、`QueryResult<T>` 结构、`forward()` 返回值（void，失败抛异常）、`ACTION_TO_STORE_MAP` 当前条目数 | 3 个 API + Map 结构已读入并记录 |
| 2 | 读取 Envelope 真相源 | 打开 `src/core/envelope.ts`：`EnvelopeFactory.create()` 参数顺序、`source/target/action/traceId` 字段意义、payload 类型约束 | Envelope 构造字段已核对 |
| 3 | 读取配置真相源 | 打开 `src/config/dbConfig.ts`：`ENVELOPE_ACTION` / `ENVELOPE_TARGET` / `MODULE_ID` / `STORE_NAME` 四个常量对象当前条目 | 有清单；写操作时比对需新增的 action |
| 4 | 读取 Handler 真相源 | 打开 `src/core/databridgeHandlers.ts` 与 `createHandlerRegistry()`：现有 Handler 的 canHandle/handle 模式、注册方式 | 有参考实现，模式 C/F 可直接套用 |
| 5 | 判定违规类型（A/B/C/D/E/F） | Grep 目标文件中 dataLayer 调用形式：`core` 位置读 / service 读验证 / service 写绕过 / 批量 list() / 自定义方法(listBySymbol) / save()含时间戳 | 每个违规点按原文 §三 6 模式分类，记录 A~F 类型 |
| 6 | 保存 tsc/audit 基线 | `tsc --noEmit`、`npm run audit:layers` 先跑一次；`git status --short > outputs/databridge-mig-before.txt` | 有变更前快照 + 历史残差清单 |
| 7 | 持久化实体类型归位检查 | 若迁移涉及实体，打开 `src/data/types/` + `scripts/other/validate-data-consistency.ts`，确认 Interface 字段完整（validator 不识别 `extends`） | 目标实体 Interface 字段全展开；没有遗留的 `extends` 导致 validator 扫描不到字段的情况 |

---

## 三、阶段化 SOP

按 7 个 Phase 顺序执行：Phase 0 API 速查（所有迁移必须先过）→ Phase 1-6 对应模式 A-F → Phase 7 统一四级验证。禁止逆序或跨模式直接改代码。

### **目标**：`audit:layers` 报 dataLayer 跨层违规归零；所有写操作过 DataBridge + Handler（4 位置同步）；结果与原逻辑等价（值、时间戳、错误路径一致）。

### Phase 0 · 迁移前 API 速查（所有模式共用）

**交付物**: 导入 4 件套清单

```typescript
// 必需导入
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { nanoid } from 'nanoid'
```

- `dataBridge.query<T>({ action, store, key, indexName, indexValue, source })` → 返回 `Promise<QueryResult<T>>`（需检查 `success && data`）。
- `dataBridge.forward(envelope)` → 返回 `Promise<void>`（成功无返回；失败抛异常，必须 try/catch）。

### Phase 1 · 模式 A：core/ 层直接读取 dataLayer（最严重）

**交付物**: core 违规点 → dataBridge.query 转换清单

```typescript
// ❌ 违规：core/feedbackOrchestrator.ts 直接调用 dataLayer
import { dataLayer } from '@/data/dataLayer'
const score = await dataLayer.v6Scores.get(symbol)

// ✅ 合规：通过 dataBridge.query 读取
import { dataBridge } from './databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'
const result = await dataBridge.query<V6Score>({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.v6Scores,
  key: symbol,
  source: MODULE_ID.system,
})
if (!result.success || !result.data) { /* 缺失处理 */ }
const score = result.data
```

### Phase 2 · 模式 B：services/ 读取验证（写入后查旧 dataLayer）

**交付物**: 验证路径从 dataLayer → dataBridge.query 的 diff

```typescript
// ❌：写入后通过 dataLayer 验证
await dataBridge.forward(envelope); const updated = await dataLayer.stocks.get(symbol)
// ✅：写入后通过 dataBridge.query 验证
try { await dataBridge.forward(envelope) } catch (err) { return { success:false, error: message(err) } }
const updatedResult = await dataBridge.query<Stock>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.stocks, key: symbol, source: MODULE_ID.fetcher })
if (!updatedResult.success || !updatedResult.data) return { success:false, error: '更新后未找到记录' }
return { success: true, data: updatedResult.data }
```

### Phase 3 · 模式 C：services/ 写操作绕过 DataBridge（最严重 · 需 4 位置同步）

**交付物**: 4 位置同步变更清单 + Handler 代码 + Service 调用 diff

Step 1/4 · `src/config/dbConfig.ts` 新增 `ENVELOPE_ACTION` 字面量。
Step 2/4 · `src/core/databridgeHandlers.ts` 新增 Handler（implements EnvelopeHandler；canHandle + handle）。
Step 3/4 · `createHandlerRegistry()` 注册：`registry.register(new UpdateStockStatusHandler())`。
Step 4/4 · `src/core/databridge.ts` `ACTION_TO_STORE_MAP` 加映射：`[ENVELOPE_ACTION.updateStockStatus]: STORE_NAME.stocks`。

最后 Service 中改为 `EnvelopeFactory.create({source, target: ENVELOPE_TARGET.db, action, traceId: \`<domain>-${nanoid(8)}-${key}\`}, payload)` → `try { await dataBridge.forward(envelope) } catch (err) { 错误处理 }`。

### Phase 4 · 模式 D：services/ 批量列表查询（list / listByStatus / listByIndex）

**交付物**: list → queryList / queryByIndex 转换 diff

```typescript
// ❌：const list = await dataLayer.stocks.list() / listByStatus(status)
// ✅ 列表：
const r = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks, source: MODULE_ID.xxx })
return r.success ? { success:true, data: r.data ?? [] } : { success:false, error: r.error }
// ✅ 按索引（替代 listByStatus）：
const r = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryByIndex, store: STORE_NAME.stocks, indexName:'by-status', indexValue: status, source: MODULE_ID.xxx })
```

### Phase 5 · 模式 E：services/ 复杂类型查询（含自定义 dataLayer 方法）

**交付物**: 策略对比表 + 客户端过滤代码 diff

| 策略 | 场景 | 示例 |
|------|------|------|
| 泛型 queryList + 客户端过滤 | 简单过滤 | `listBySymbol` → `queryList` + `filter(r => r.symbol === symbol)` |
| 新增 queryByIndex | 有对应索引 | `listByStatus` → `queryByIndex` + `indexName: 'by-status'` |
| 保留 dataLayer + TODO | 复杂聚合/暂不对齐 | `getLatest()` → 保留调用，加 `// TODO: 迁移至 DataBridge` |
| 新增 ACTION + Handler（模式 C） | 高频写 | 按 Phase 3 四位置同步处理 |

### Phase 6 · 模式 F：迁移写入时保留 dataLayer 业务逻辑（时间戳、合并、默认值、级联）

**交付物**: Handler 业务逻辑复刻代码 diff（原 dataLayer.save 逻辑 → Handler 逻辑对照表）

示例：`CustomAgentSaveHandler` 在 `handle()` 中复刻原 `dataLayer.customAgent.save()` 的 createdAt/updatedAt 填充：

```typescript
class CustomAgentSaveHandler implements EnvelopeHandler {
  canHandle(a:string){ return a===ENVELOPE_ACTION.saveCustomAgent }
  async handle(env: StandardEnvelope, store: StoreName){
    const agent = env.payload as Omit<CustomAgent,'createdAt'|'updatedAt'> & { createdAt?:number }
    const existing = await db.get<CustomAgent>(store, agent.id)
    const full: CustomAgent = { ...agent, createdAt: existing?.createdAt ?? agent.createdAt ?? now(), updatedAt: now() }
    await db.put(store, full)
  }
}
```

判定规则：
- 原 `dataLayer.xxx.save()` 只是简单 `sendWriteEnvelope` → 直接 `forward` 即可；
- 原方法含时间戳/合并/默认值/级联 → **必须在 Handler 内复刻等价逻辑**（或在调用方 payload 中提前填充并加注释证明对齐）。

### Phase 7 · 四级验证 + 快照

**交付物**: 四项验证全绿报告 + 迁移后快照

| 级别 | 命令 | 通过标准 |
|------|------|---------|
| L1 类型 | `node node_modules/typescript/bin/tsc --noEmit` | 0 errors（无 TS6133 未使用导入） |
| L2 架构 | `node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts`（或 `npm run audit:layers`） | 0 violations（目标违规点归零） |
| L3 单元 | `node node_modules/vitest/vitest.mjs run <涉及测试路径>`（含 mock 从 dataLayer→dataBridge 的同步） | 全通过 |
| L4 全量审计（阶段完成后） | `tsc --noEmit` + `audit:layers` + `tsx scripts/audit-hardcode.ts` + `tsx scripts/audit-deadcode.ts` | 全绿；无新引入 hardcode/deadcode |

最后 `git status --short > outputs/databridge-mig-after.txt`，确认未越权修改无关文件。

---

## 四、陷阱与经验教训

| # | 教训 | 后果 | 规避方法 |
|---|------|------|---------|
| 1 | `forward()` 返回 void，误对其 result.success 判空 | 编译报错 / 运行时 undefined 访问 | 牢记：`forward()` 成功无返回；失败抛异常。必须 try/catch。Phase 0 速查表首条。 |
| 2 | `query()` 返回 `QueryResult<T>`，直接赋值 `const x = await query(...)` 当数据用 | TS 类型错误或运行时 NPE | 必须 `if (result.success && result.data) { x = result.data }`。 |
| 3 | 新增写 ACTION 时遗漏 4 位置中任意 1 个 | `Unknown action` / 写入黑洞（Handler 不执行）/ ACL 不过 | §二铁律 + Phase 3 清单：定义/Handler/注册/MAP 全勾选提交。 |
| 4 | `ENVELOPE_TARGET` 导入后未使用 | TS6133 编译错误 `Cannot find name 'ENVELOPE_TARGET'`（或未用） | 如果构造 envelope 时硬编码 target/不再使用该导入，删除该 import。 |
| 5 | `query()` 未给泛型参数导致 T=unknown | 后续所有字段访问要手动 `as X`，等于类型系统凿穿 | 必须写 `dataBridge.query<Stock>({...})` 并与目标实体类型一致。 |
| 6 | `queryByIndex` 缺 `indexName` 或 `indexValue` 参数 | 运行时断言失败，查询空或全表扫 | 两参数必须同时提供；Phase 4 清单勾选项。 |
| 7 | 复杂查询用模式 E 保留 TODO 但后续长期不清理 | TODO 堆积，audit:layers 永久黄灯，团队失去过 DataBridge 的一致信念 | TODO 写清理日期；每月架构巡检（`architecture-radar-scan`）按过期日期批量迁移。 |
| 8 | 测试 mock 未同步（vi.mocked(dataLayer) → dataBridge） | 测试大面积 FAIL：mock 的 dataLayer 不被调用，真实 dataBridge 无 mock | 同步改 `vi.mocked(dataBridge.query)` / `vi.mocked(dataBridge.forward)`，失败路径用 mockRejectedValue 触发 catch 分支。 |
| 9 | Handler 丢失原 dataLayer 的时间戳/合并/默认值/级联业务逻辑 | 写入后 createdAt=undefined、dataVersion 不自增，后续排序/乐观锁/审计全错 | Phase 6 对照表：原 `dataLayer.xxx.save()` 每一行逻辑都能在 Handler 或调用方 payload 中找到对应复刻。 |
| 10 | 类型层 `interface A extends B {}`，validator 扫描不到 B 的字段 | `validate-data-consistency` 报字段缺失 → 审计误报 → 团队失去对迁移质量信心 | §二 7：目标实体 Interface 在 `src/data/types/` 中必须完整展开字段；不得用继承偷懒（或 validator 同步补映射）。 |

---

## 五、完成交付物清单

### 5.1 交付物清单（≥10 项 · 完成打勾）

- [x] **1. 违规类型分类清单**：每个 dataLayer 点按 A/B/C/D/E/F 类型+路径+行号
- [x] **2. API 真相源记录**：query/forward 签名 + QueryResult 结构 + ACTION_TO_STORE_MAP 当前条目
- [ ] **3. 迁移前快照与基线**：`outputs/databridge-mig-before.txt` + tsc/audit:layers 历史残差清单
- [ ] **4. 模式 A（core 读）转换 diff**：`import { dataLayer }` 清除 + dataBridge.query 替换清单
- [ ] **5. 模式 B（service 读验证）转换 diff**：写后验证路径从 dataLayer → dataBridge.query
- [ ] **6. 模式 C（写操作）4 位置同步证明**：定义/Handler/注册/MAP 四处文件位置与代码片段
- [ ] **7. 模式 D/E（批量 & 复杂查询）策略表**：每个自定义方法的处理策略与代码
- [ ] **8. 模式 F（Handler 业务逻辑复刻）对照表**：原 dataLayer.save 逻辑 vs Handler 逻辑
- [ ] **9. Phase 7-1 tsc 报告**：0 errors + 0 TS6133 未使用导入
- [ ] **10. Phase 7-2 架构审计报告**：`audit:layers` 目标违规点 0 violations
- [ ] **11. Phase 7-3 单元测试报告**：相关测试全绿（含 mock 同步证明）
- [ ] **12. Phase 7-4 全量审计报告**：hardcode/deadcode 无新引入
- [ ] **13. 迁移后快照**：`outputs/databridge-mig-after.txt`，与 before 对比无越权
- [ ] **14. 四端一致性同步**（若新增 ACTION/MODULE_ID）：db-reference-audit 复核 ACTION_TO_STORE_MAP 一致性

### 5.2 必要且充分条件

> **当且仅当**以下 4 条**同时成立**，方可声称本次 DataBridge 迁移完成：
> 1. 读操作：core/ 与 services/ 中所有 `dataLayer.xxx.get/list/listBy*` 已转换为 `dataBridge.query`（或模式 E 留 TODO 并标清理日期）；`audit:layers` 中「core/services → dataLayer 读」违规点 **0**。
> 2. 写操作：所有原 `dataLayer.xxx.put/save/update/delete` 直写已改为 `dataBridge.forward`；且每个新增 ACTION 4 位置（定义/Handler/注册/ACTION_TO_STORE_MAP）100% 同步；Handler 与原 dataLayer 逻辑**等价**（时间戳、dataVersion、默认值、级联复刻到位）。
> 3. 结果等价可验证：Phase 7 四级验证（L1 tsc / L2 架构 / L3 单元 / L4 全量审计）全绿无 FAIL；模式 F 至少对 3 条样例数据比对写入前后字段一致（时间戳取相对差验证而非绝对值）。
> 4. 提交范围严格限定在迁移相关文件（通过 `git commit --only <paths>` 强制隔离）；涉及 4 位置同步的 ACTION 变更必须在同一 commit 提交（禁止拆分 commit 留下 ACTION 已定义但 Handler 未注册的中间态）。

---

## 六、相关参考与协同

- `src/core/databridge.ts` · `src/core/envelope.ts` · `src/core/databridgeHandlers.ts`（DataBridge 真相源）
- `src/config/dbConfig.ts`（ENVELOPE_ACTION / ENVELOPE_TARGET / MODULE_ID / STORE_NAME）
- 关联 Skill：`db-reference-audit`（DB 引用一致性四位置核对）· `type-safety-contract`（新增字面量类型安全）· `architecture-cleanup`（跨层通用清理）· `architecture-radar-scan`（L3 防腐层扫描）
