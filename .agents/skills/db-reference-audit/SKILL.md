---
name: "db-reference-audit"
description: "对 V9 IndexedDB 数据库定义做一次全面的引用一致性审计：核对 STORE_NAME ↔ Schema/Migration、ENVELOPE_ACTION ↔ ACTION_TO_STORE_MAP、ACL_MATRIX 合法性、dataLayer 暴露对齐，并扫描 dataLayer/db 直接访问与硬编码数据库名。Invoke when user asks to cross-check database references, verify DB schema consistency, audit store name usage, or validate DataBridge envelope mappings."
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: false
triggers:
  keywords: []
  files: []
  events: []
gates: []
covers_docs: []
related_skills: []
gates: []
---# 数据库定义交叉引用审计 — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-07-13 | **校验基准**: V9 v2.0.0 / DB_VERSION 28
> **任务性质**: 审计与验证，允许补充/修正校验脚本，禁止直接修改 DB_VERSION 或 Store Schema（属 Schema 变更，需人工决策）
> **输出格式**: 审计报告 + 不一致项清单 + 重构优先级 + 反模式教训

gates: []
gates: []
---## 一、触发条件（Invoke When）

- 用户要求“交叉检查数据库相互引用”或“检查数据库名称是否更新完整”
- 新增/删除/重命名 `STORE_NAME`、`ENVELOPE_ACTION`、`MODULE_ID` 后需要验证一致性
- `DB_VERSION` 升级后需要确认 Schema/Migration/ACL/ActionMap 同步
- 发现 `DataBridge.forward()` 报 `Unknown action` 或 `ACL_PERMISSION_DENIED`
- 怀疑存在 `dataLayer.stocks` / `dataLayer.v6Scores` 等直接访问遗留代码

gates: []
---
## 二、执行前检查清单

1. **确认当前 DB_VERSION 与 Store 总数**：读取 `src/config/dbConfig.ts` 中 `DB_VERSION`、`STORE_NAME`。
2. **确认 Schema 创建点**：区分基线 Store（`src/data/db-schema.ts` 的 `createSchema`）与增量 Store（`src/data/migrations/*.ts`）。
3. **确认类型定义位置**：业务实体类型通常在 `src/data/types/*.ts`，部分遗留类型可能仍在 `src/services/**/*.types.ts` 或 `src/types/modules/*.ts`。
4. **确认 Gateway 规范状态**：检查 `docs/03-development/gateway-write-permission-spec.md` 是否已落地，DataBridge 是否仍直接 `import { db }`。

---

## 三、审计 SOP

### 步骤 1：运行已有校验脚本

```powershell
# 蓝图一致性：Store 数量 + 核心实体 Interface 存在性
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-blueprint.ts

# 类型-Schema 一致性：Store 主键/索引字段是否存在于 Interface
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-consistency.ts

# 交叉引用一致性（本 SKILL 新增）
node node_modules/tsx/dist/cli.mjs scripts/audit-db-references.ts
```

### 步骤 2：逐项核对清单

| 检查项 | 通过标准 | 常见失败模式 |
|--------|---------|-------------|
| STORE_NAME ↔ Schema | 每个 `STORE_NAME` key 在 `db-schema.ts` 或 `migrations/*.ts` 中有 `ensureStore`/`createObjectStore` | 新增 Store 只写 `STORE_NAME`，漏写 `createSchema` 或 Migration |
| ENVELOPE_ACTION 唯一性 | 同一字符串值不能被两个 key 复用 | 复制粘贴后忘记改值 |
| ACTION_TO_STORE_MAP | 所有写操作（非 query/event/strategy/manager）必须映射到合法 `STORE_NAME` | 新增 action 后未补映射 |
| ACL_MATRIX | key 必须是 `MODULE_ID`；read/write 数组元素必须是 `STORE_NAME` key | 拼写错误、使用 store value 而非 key |
| dataLayer 暴露 | 业务 Store 应在 `dataLayer.ts` barrel 中暴露；框架内部表可声明为例外 | 新增 Store 未加入 barrel |
| 直接访问扫描 | `services/`、`pages/`、`components/` 不应直接调用 `dataLayer.xxx.save()`/`db.put()` | 迁移遗留、绕过 DataBridge/ACL |
| DB_NAME 硬编码 | 全仓库除 `src/config/dbConfig.ts` 外不应出现 `"V6ProDB"` | 测试或工具硬编码数据库名 |

### 步骤 3：分类处理不一致项

- **error 级**：必须修复，否则运行时报错或 ACL 拒绝。
  - STORE_NAME 与 Schema 不匹配
  - ACTION_TO_STORE_MAP 引用非法 action/store
  - ACL_MATRIX 引用非法 module/store
- **warning 级**：按优先级分阶段清理。
  - 未映射的 ENVELOPE_ACTION
  - 未暴露的 dataLayer Store
  - services 层直接访问 dataLayer

### 步骤 4：运行回归套件

| 级别 | 命令 | 通过标准 |
|------|------|---------|
| L1 类型 | `node node_modules/typescript/bin/tsc --noEmit` | 0 errors（项目既有错误需单独记录） |
| L2 架构 | `node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts` | 0 violations |
| L3 单元 | `node node_modules/vitest/vitest.mjs run <相关测试>` | 全部通过 |
| L4 构建 | `node node_modules/vite/bin/vite.js build` | 成功 |

---

## 四、常见反模式与教训

### 教训 1：新增 Store 必须同时更新 4 个位置

**现象**: 只改了 `STORE_NAME`，忘记同步 `createSchema` / `Migration`、`ACTION_TO_STORE_MAP`、`ACL_MATRIX`、`dataLayer.ts`。

**后果**: 浏览器打开时 `onupgradeneeded` 未创建 store，导致 `DataBridge.forward()` 在 `routeToDB` 时操作不存在的 store；或 ACL 直接拒绝写入。

**对策**: 建立“新增 Store 四同步”检查清单：
1. `src/config/dbConfig.ts` → `STORE_NAME` + `DB_VERSION`
2. `src/data/db-schema.ts` 或 `src/data/migrations/*.ts` → 创建逻辑
3. `src/core/databridge.ts` → `ACTION_TO_STORE_MAP`（写操作）
4. `src/config/dbConfig.ts` → `ACL_MATRIX` 权限
5. `src/data/dataLayer.ts` → barrel 暴露（业务 store）

### 教训 2：业务实体类型必须归位到数据层

**现象**: `TradeReviewRecord` 等 Store 实体类型定义在 `src/services/trading/tradeReviewAI.types.ts`，`data/types/` 中无定义。

**后果**: 数据一致性校验脚本无法从 `src/data/types/` 找到对应 Interface；跨层依赖风险（services 类型被 data 层引用）。

**对策**: Store 对应的 Interface 应优先放在 `src/data/types/*.ts` 或 `src/types/modules/*.ts`（零依赖），services 层从数据层/类型层导入，反向依赖需重构。

### 教训 3：dataLayer 直接访问是架构债

**现象**: `services/news/newsService.ts`、`services/analysis/scoreDocService.ts` 等仍直接调用 `dataLayer.news.save()`。

**后果**: 绕过 DataBridge ACL、缓存失效、审计日志和 fallbackQueue，未来 Gateway 层规范落地时需二次迁移。

**对策**: 读操作可逐步迁移到 `dataBridge.query()`；写操作必须改为 `dataBridge.forward()` + 对应 `ENVELOPE_ACTION`，并注册 handler。

### 教训 4：迁移文件中的 Store 容易被 Schema 校验遗漏

**现象**: `rbacMigrationV24.ts` 创建 6 个 RBAC store，早期 `validate-data-consistency.ts` 只解析 `db-schema.ts`，导致 34 vs 40 不匹配。

**后果**: 校验脚本给出错误结论，掩盖真实一致性状态。

**对策**: Schema 校验脚本必须同时扫描 `src/data/db-schema.ts` 与 `src/data/migrations/*.ts`，并区分基线/增量 store。

### 教训 5：硬编码扫描必须限定上下文

**现象**: store 名如 `stocks`、`news`、`orders`、`signals` 是常见英文单词，全仓库字符串匹配会产生上千条误报。

**后果**: 审计报告噪音过大，真实问题被淹没。

**对策**: 仅扫描 `dataLayer.<store>` 属性访问、`db.<method>(<store>)` 调用、`createObjectStore`/`ensureStore` 在非法位置的出现，以及精确字符串 `V6ProDB`。

### 教训 6：services 层迁移应复用 dataLayerHelpers，而非手写 Envelope

**现象**: 清除 `services/**` 中 60+ 处 `dataLayer.xxx` 直接访问时，若每个调用点都手写 `EnvelopeFactory.create` + `dataBridge.forward`，会产生大量重复代码，且容易写错 `source`/`target`/`traceId`。

**后果**: 代码冗余、ACL 源配置不一致、审计日志格式碎片化、新开发者学习成本高。

**对策**: 统一使用 `src/data/dataLayerHelpers.ts` 提供的四个无状态函数：

```typescript
import { STORE_NAME } from '@/config/dbConfig'
import { queryGet, queryList, queryByIndex, sendWriteEnvelope } from '@/data/dataLayerHelpers'

// 读
const stock = await queryGet<Stock>(STORE_NAME.stocks, symbol)
const all = await queryList<Stock>(STORE_NAME.stocks)
const bySymbol = await queryByIndex<LocalDoc>(STORE_NAME.localDocs, 'by-symbol', symbol)

// 写
await sendWriteEnvelope('saveLocalDocs', doc, 'system')
```

这些 helper 已在 data 层内部调用 `dataBridge.query/forward`，满足 ACL、审计日志、缓存失效和 fallbackQueue 要求；services 层引入它们不违反分层规则（services 可依赖 data/ 基础设施）。迁移完成后必须运行 `audit:db-references` 验证 0 warning。

---

## 五、变更后审查清单

- [ ] `validate-data-blueprint.ts` 通过：Store 数量 = `STORE_NAME` 数量，核心 Interface 存在
- [ ] `validate-data-consistency.ts` 通过（警告已审阅）：Store 主键/索引字段存在于 Interface
- [ ] `audit-db-references.ts` 通过（error = 0）：引用关系无错误
- [ ] 所有 warning 已分类并建立修复工单/优先级
- [ ] `audit:layers` 0 violations
- [ ] 相关单元测试通过
- [ ] 审计报告已保存到 `outputs/` 或 `docs/reports/audit/`

---

## 六、相关参考

- `AGENTS.md` §一（项目分层规则）、§八（数据库版本管理）、§十四（MCP 权限）
- `docs/03-development/gateway-write-permission-spec.md`
- `docs/03-development/unified-pool-storage-spec.md`
- `src/config/dbConfig.ts`
- `src/data/db-schema.ts`、`src/data/migrations/rbacMigrationV24.ts`
- `src/core/databridge.ts`、`src/data/dataLayer.ts`
