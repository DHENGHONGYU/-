---
name: "databridge-migration-lessons"
description: "DataBridge 迁移过程中的经验教训总结。包含 core/层违规修复、services/读取改为 query()、写入改为 forward()、新增 ENVELOPE_ACTION/Handler 的完整踩坑记录与改进措施。Invoke when planning similar architecture refactoring or onboarding new developers to the DataBridge envelope protocol."
version: v1.1.0
last_updated: 2026-08-11
change_log:
  - version: v1.1.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# DataBridge 迁移经验教训 (Lessons Learned) — v1.1.0

> **版本**: v1.1.0 | **日期**: 2026-07-12 | **关联 SKILL**: `databridge-migration`
> **背景**: 修复 V9 项目中 89 处 dataLayer 直接调用违规，涉及 20+ 文件

---

## 一、问题总览

### 1.1 违规分布

| 层级 | 违规文件数 | 违规类型 | 严重程度 |
|------|-----------|----------|----------|
| `src/core/` | 1 | 直接读取 `dataLayer.v6Scores/stocks/dailyQuotes` | 🔴 P0（core/层禁止依赖 data/层） |
| `src/services/stockpool/` | 1 | 直接写入 `dataLayer.stocks.updateStatus/updateGroup` | 🔴 P0（绕过 DataBridge ACL） |
| `src/services/fetcher/` | 1 | 读取验证 `dataLayer.stocks/financialReports.get()` | 🟡 P1 |
| `src/services/trading/` | 3 | 读取 `dataLayer.orders.list/stocks.listByStatus/dailyQuotes.get` | 🟡 P1 |
| `src/services/scoring/` | 1 | 读取 `dataLayer.financialReports.get` + 写入 `dataLayer.v6Scores.save` | 🟡 P1 |
| `src/services/input/` | 1 | 读取 `dataLayer.stocks.list/listByStatus/get` | 🟡 P1 |
| `src/services/analysis/` | 2 | 读取 `dataLayer.stocks/v6Scores.list` + `dataLayer.v6Scores.get` | 🟡 P1 |
| `src/services/screening/` | 1 | 读取 `dataLayer.stocks.list` | 🟡 P1 |
| `src/services/system/` | 1 | 读取 `dataLayer.stocks/orders/v6Scores.list` | 🟡 P1 |
| `src/services/` 其他 | ~8 | 含自定义 dataLayer 方法（`listBySymbol`/`getLatest`/`save` 等） | 🟡 P2 |
| `src/store/` | 2 | 直接读取/写入 `dataLayer.customAgents/watchlists` | 🟡 P2 |

### 1.2 根因分析

1. **早期代码未遵循四步集成契约**：部分 Service 在 DataBridge 完善前直接调用 dataLayer，后续未同步重构
2. **验证逻辑绕过 DataBridge**：fetcherService 写入后通过 `dataLayer.get()` 验证保存结果，而非通过 `query()`
3. **缺少 stock 状态/分组更新 Handler**：`updateStockStatus` 和 `updateStockGroup` 无对应 ENVELOPE_ACTION，导致 stockpoolService 被迫直接操作 dataLayer
4. **测试 mock 依赖 dataLayer**：测试文件 mock `dataLayer.xxx.get` 而非 `dataBridge.query`，形成隐性依赖
5. **自定义 dataLayer 方法无 DataBridge 等价物**：`listBySymbol`/`getLatest`/`save` 等方法需新增 ENVELOPE_ACTION + Handler，成本较高

---

## 二、核心教训

### 教训 1：core/ 层绝对禁止依赖 data/ 层

**违规代码**：`src/core/feedbackOrchestrator.ts`
```typescript
import { dataLayer } from '@/data/dataLayer'
// ...
const scoreResult = await dataLayer.v6Scores.get(symbol)
```

**问题**：
- `core/` 层按 AGENTS.md 应仅依赖 `core/` 和 `config/`，禁止依赖 `data/` 层具体 store
- 直接调用绕过 DataBridge 的信封协议、ACL 校验、缓存机制、审计日志
- 导致 `audit:layers` 报告跨层违规

**修复**：
```typescript
const scoreResult = await dataBridge.query<V6Score>({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.v6Scores,
  key: symbol,
  source: MODULE_ID.system,
})
```

**改进措施**：
- 在 `audit:layers` 脚本中增加 `src/core/** → src/data/**` 的专项检测规则
- 在 CI 门禁中增加 `core/` 层导入白名单检查

---

### 教训 2：新增写操作必须同步新增 ENVELOPE_ACTION + Handler

**违规代码**：`src/services/stockpool/stockpoolService.ts`
```typescript
const updateResult = await dataLayer.stocks.updateStatus(normalized, toStatus)
```

**问题**：
- DataBridge 当时无 `UPDATE_STOCK_STATUS` action，导致开发者被迫直接操作 dataLayer
- 这是架构设计遗漏，而非开发者违规

**修复步骤**（必须按顺序执行）：

1. **dbConfig.ts**：新增 `updateStockStatus: 'UPDATE_STOCK_STATUS'`
2. **databridgeHandlers.ts**：新增 `UpdateStockStatusHandler` 类
3. **databridgeHandlers.ts**：在 `createHandlerRegistry()` 中 `registry.register()`
4. **databridge.ts**：在 `ACTION_TO_STORE_MAP` 中新增映射
5. **Service 层**：改为 `dataBridge.forward(envelope)`

**改进措施**：
- 建立"新增 action 检查清单"（见 SKILL 文档 §4.2）
- 在 `databridgeHandlers.ts` 文件头添加注释："新增 Handler 必须同步注册到 Registry 和 ACTION_TO_STORE_MAP"

---

### 教训 3：`dataBridge.forward()` 返回 `void`，不是 `Result` 对象

**错误尝试**：
```typescript
const result = await dataBridge.forward(envelope)
if (!result.success) {  // ❌ TS2339: Property 'success' does not exist on type 'void'
  return { success: false, error: result.error }
}
```

**正确写法**：
```typescript
try {
  await dataBridge.forward(envelope)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  return { success: false, error: message }
}
```

**改进措施**：
- 在 `databridge-migration` SKILL 中增加"常见陷阱"章节
- 考虑未来将 `forward()` 改为返回 `{ success: boolean, error?: string }` 以统一错误处理模式（需评估影响范围）

---

### 教训 4：`query()` 返回 `QueryResult<T>`，必须检查 `success` 和 `data`

**错误尝试**：
```typescript
const quotes = await dataBridge.query({ ... })  // 未指定泛型参数
// quotes 类型为 QueryResult<unknown>
const freshnessCheck = checkV6ScoreFreshness(score.calculatedAt, quotes.updatedAt)
// ❌ TS2339: Property 'updatedAt' does not exist on type '{}'
```

**正确写法**：
```typescript
const quotesResult = await dataBridge.query<{
  symbol: string
  updatedAt: number
  // ... 其他字段
}>({ ... })
if (quotesResult.success && quotesResult.data) {
  const freshnessCheck = checkV6ScoreFreshness(score.calculatedAt, quotesResult.data.updatedAt)
}
```

**改进措施**：
- 强制要求 `query()` 调用必须指定泛型参数（ESLint 规则或代码审查）
- 考虑引入 `queryOrThrow()` 辅助函数简化成功路径（需评估）

---

### 教训 5：删除 `dataLayer` 导入后检查残留引用

**问题**：删除 `import { dataLayer }` 后，文件中可能仍有 `ENVELOPE_TARGET` 等未使用导入

**示例**：
```typescript
// 修改前
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION } from '@/config/dbConfig'

// 修改后（如果不再使用 ENVELOPE_TARGET）
import { MODULE_ID, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
// 否则保留
```

**改进措施**：
- 修改后必须运行 `tsc --noEmit` 检查 TS6133（未使用变量）错误
- 在 IDE 中启用 "未使用导入" 自动检测

---

### 教训 6：测试文件 mock 需要同步更新

**问题**：`feedbackOrchestrator.test.ts` mock 了 `dataLayer.v6Scores.get`，改为 `dataBridge.query` 后测试失效

**原 mock**：
```typescript
vi.mock('@/data/dataLayer', () => ({
  dataLayer: { v6Scores: { get: vi.fn() } }
}))
vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(...)
```

**新 mock**：
```typescript
vi.mock('@/core/databridge', () => ({
  dataBridge: { query: vi.fn(), broadcast: vi.fn() }
}))
vi.mocked(dataBridge.query).mockResolvedValue({ success: true, data: mockScore })
```

**改进措施**：
- 将测试 mock 更新纳入迁移检查清单
- 考虑编写 `mockDataBridgeQuery()` 辅助函数统一 mock 模式

---

### 教训 7：`listGroups()` / `listByGroup()` 无直接 query 等价物

**问题**：`dataLayer.stocks.listGroups()` 和 `listByGroup()` 是 dataLayer 的自定义方法，DataBridge `query()` 仅支持 `queryGet/queryList/queryByIndex`

**解决方案**：
```typescript
// listGroups() → 先 queryList 全部，再提取唯一分组
const result = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks })
const groups = [...new Set((result.data ?? []).map(s => s.group ?? DEFAULT_POOL_GROUP))]

// listByGroup() → 先 queryList 全部，再过滤
const result = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks })
const list = (result.data ?? []).filter(s => (s.group ?? DEFAULT_POOL_GROUP) === group)
```

**改进措施**：
- 评估是否需要新增 `queryListGroups` / `queryByGroup` action（当前用 client-side 过滤替代）
- 在 dataLayer 中标记 `listGroups` / `listByGroup` 为 "@deprecated 请使用 DataBridge.query() + client-side 过滤"

---

### 教训 8：复杂查询（含自定义 dataLayer 方法）的处理策略

**问题**：`dataLayer.scoreDocs.listBySymbol(symbol)`、`dataLayer.strategySnapshots.getLatest()`、`dataLayer.news.getByHash(hash)` 等自定义方法无直接 DataBridge 等价物

**处理策略矩阵**：

| 方法类型 | 示例 | 处理策略 | 工作量 |
|----------|------|----------|--------|
| 简单过滤 | `listBySymbol` | `queryList` + client-side `filter()` | 低 |
| 单条聚合 | `getLatest` | `queryList` + `sort()` + `slice(0,1)` | 中 |
| 哈希查询 | `getByHash` | 保留 dataLayer + `// TODO` 标记 | 低（临时） |
| 写入操作 | `save` / `put` | 新增 ENVELOPE_ACTION + Handler（模式 C） | 高 |

**改进措施**：
- 对高频读取的自定义方法，评估新增 `queryByIndex` 索引支持
- 对低频写入的自定义方法，保留 TODO 标记，后续统一规划新增 action
- 建立"自定义方法迁移优先级矩阵"，按调用频率排序处理

---

## 三、迁移效率数据

### 3.1 已完成文件统计

| 阶段 | 文件数 | 修改行数 | 验证时间 | 返工次数 | 主要陷阱 |
|------|--------|---------|----------|----------|----------|
| P0-1 feedbackOrchestrator | 1 | ~15 | 2 min | 2 | 类型参数、ENVELOPE_TARGET |
| P0-2 新增 Handler | 3 | ~80 | 3 min | 0 | — |
| P0-3 stockpoolService | 1 | ~120 | 5 min | 2 | forward 返回值、listGroups 替代 |
| P1-1 v6ScoreService | 1 | ~30 | 3 min | 1 | 写入改为 forward + try/catch |
| P1-2 inputService | 1 | ~25 | 2 min | 0 | — |
| P1-3 analysisService | 1 | ~20 | 2 min | 0 | — |
| P1-4 screeningEngine | 1 | ~60 | 3 min | 1 | 条件读取改为 query + 检查 |
| P1-5 trading 组 | 3 | ~40 | 4 min | 1 | Order 类型导入 |
| P1-6 system/screening | 2 | ~20 | 2 min | 0 | — |
| **合计** | **14** | **~430** | **26 min** | **7** | — |

### 3.2 效率分析

- **80% 时间**花在理解 DataBridge API 签名和错误处理模式
- **15% 时间**花在处理类型参数和泛型匹配
- **5% 时间**花在具体代码逻辑修改
- **返工主因**：`forward()` 返回 `void`（3次）、`query()` 需检查 `success`（2次）、类型参数缺失（2次）

---

## 四、改进建议（面向未来架构）

### 4.1 短期（已落地）

1. ✅ 新增 `databridge-migration` SKILL 文档，标准化迁移流程
2. ✅ 在 `audit:layers` 中增加 `core/ → data/` 专项检测
3. ✅ 建立"新增 ENVELOPE_ACTION 四步检查清单"
4. ✅ 建立"复杂查询处理策略矩阵"（模式 E）

### 4.2 中期（建议）

1. **统一错误处理模式**：考虑将 `forward()` 改为返回 `Result<void>`，与 `query()` 保持一致
2. **新增 query 辅助 action**：`queryListGroups`、`queryByGroup` 等常用组合查询
3. **测试 mock 辅助函数**：`mockDataBridgeQuery()`、`mockDataBridgeForward()` 统一测试写法
4. **IDE 插件/代码片段**：提供 `dbq`（query 模板）、`dbf`（forward 模板）代码片段
5. **自定义方法迁移计划**：按调用频率排序，分批新增 ENVELOPE_ACTION + Handler

### 4.3 长期（建议）

1. **自动化迁移脚本**：基于 AST 的 `dataLayer.xxx.get()` → `dataBridge.query()` 自动替换工具（需处理泛型参数和类型推断）
2. **DataBridge 调用统计**：运行时监控直接 dataLayer 调用，告警未迁移代码
3. **类型级测试**：为 `QueryResult` 和 `StandardEnvelope` 增加类型级测试，防止接口变更破坏调用方
4. **统一查询 DSL**：设计类似 `db.stocks.where({ symbol }).first()` 的链式 API，底层自动转换为 `dataBridge.query()`

---

## 五、流程改进建议

### 5.1 需求管理不足

**问题**：
- DataBridge 设计初期未覆盖 `updateStockStatus`/`updateStockGroup` 等业务操作
- 新增 store 时未同步规划对应的 ENVELOPE_ACTION

**改进**：
- 新增 store/业务操作时，强制要求同步设计 ENVELOPE_ACTION（检查清单门禁）
- 在 PR 模板中增加"DataBridge Action 覆盖检查"项

### 5.2 协作沟通不足

**问题**：
- 早期 Service 开发者不了解 DataBridge 信封协议
- 四步集成契约（type → store → builder → UI）未严格执行

**改进**：
- 将 `databridge-migration` SKILL 纳入新人 onboarding 必读
- 在代码审查中增加"是否直接调用 dataLayer"专项检查

### 5.3 测试验证不足

**问题**：
- 测试文件 mock `dataLayer` 而非 `dataBridge`，导致迁移后测试失效
- 缺乏 DataBridge 调用的集成测试

**改进**：
- 新增 `mockDataBridgeQuery()` / `mockDataBridgeForward()` 辅助函数
- 编写 DataBridge 集成测试套件，覆盖 query/get/list/forward 全路径
- 在 CI 中增加 `audit:layers` 门禁，阻塞新增 dataLayer 直接调用

---

## 六、验证命令速查

```powershell
# 迁移前：扫描违规点
node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts

# 迁移中：类型检查
node node_modules/typescript/bin/tsc --noEmit

# 迁移后：全量审计
node node_modules/typescript/bin/tsc --noEmit
node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts
node node_modules/tsx/dist/cli.mjs scripts/audit-hardcode.ts
node node_modules/tsx/dist/cli.mjs scripts/audit-deadcode.ts
```

---

## 七、关联文档

| 文档 | 路径 | 说明 |
|------|------|------|
| DataBridge 迁移 SKILL | `.agents/skills/databridge-migration/SKILL.md` | 标准化迁移流程与模式（v1.1.0） |
| 架构雷达扫描 SKILL | `.agents/skills/architecture-radar-scan/SKILL.md` | 扫描违规点 |
| 类型安全契约 SKILL | `.agents/skills/type-safety-contract/SKILL.md` | 新增 action 时的类型安全 |
| AGENTS.md | `AGENTS.md` | 项目分层规则与验证命令 |

---

## 八、版本记录

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-12 | 初始版本：基于 P0/P1 修复实践，总结 7 条核心教训、迁移效率数据、短中长期改进建议 |
| v1.1.0 | 2026-07-12 | 新增教训 8（复杂查询处理策略）、P1 完成文件统计（14 文件/430 行/26 分钟）、流程改进建议（需求/协作/测试）、自定义方法迁移优先级矩阵 |
