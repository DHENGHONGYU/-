---
skill_id: V9-SKILL-DB-REFERENCE-AUDIT
name: "db-reference-audit"
description: "对 V9 IndexedDB 数据库定义做一次全面的引用一致性审计：核对 STORE_NAME ↔ Schema/Migration、ENVELOPE_ACTION ↔ ACTION_TO_STORE_MAP、ACL_MATRIX 合法性、dataLayer 暴露对齐，并扫描 dataLayer/db 直接访问与硬编码数据库名。Invoke when user asks to cross-check database references, verify DB schema consistency, audit store name usage, or validate DataBridge envelope mappings, audit:db-references 门禁 FAIL 或新增/删除/重命名 STORE_NAME/ENVELOPE_ACTION/DB_VERSION 升级后需要验证一致性时。"
version: v1.0.6
last_updated: 2026-08-23
code_version: "2.0.0-rc.1"
change_log:
  - version: v1.0.6
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 6 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.5
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.4 / 正文 v1.0.1) → 取真值 max=1.0.4 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 4 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-11
mandatory: false
---

# 数据库定义交叉引用审计 — v1.0.6

> **版本**: v1.0.6 | **日期**: 2026-08-21 | **校验基准**: V9 v2.0.0 / DB_VERSION 28+
> **任务性质**: 审计与验证，允许补充/修正校验脚本，禁止直接修改 DB_VERSION 或 Store Schema（属 Schema 变更，需人工决策）
> **输出格式**: 审计报告 + 不一致项清单 + 重构优先级 + 反模式教训

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「交叉核对 DB 引用」「验证 Store 名称完整性」「核对 Schema 一致性」「验证 DataBridge envelope 映射」「核查 ACL 权限矩阵对齐」
- **显式触发 2**：出现运行时错误 `DataBridge.forward() Unknown action` / `ACL_PERMISSION_DENIED` / `store not found onupgradeneeded` / IndexedDB upgrade 迁移失败 → 启动 DB 交叉引用审计
- **脚本/审计触发 3**：`npm run audit:db-references` 门禁 FAIL；或 `npm run audit:acl-consistency` 报 DB ACL 矩阵角色权限不合法；或 `npm run validate-data-blueprint` 报 Store 数 vs 蓝图期望不一致；或 `tsc:prod` 报 `dataLayer.xxx` 属性缺失
- **脚本/审计触发 4**：Grep 全仓发现疑似裸 dataLayer 访问（`dataLayer.stocks` / `dataLayer.v6Scores`）或全仓硬编码 `"V6ProDB"` 数据库名、或 `services/**` 绕过 DataBridge 直写
- **设计/协议触发 5**：新增 / 删除 / 重命名 `STORE_NAME` / `ENVELOPE_ACTION` / `MODULE_ID`；或 `DB_VERSION` 升级 + `migrations/*.ts` 增量新增；或 AGENTS.md 数据层契约 / ACL_MATRIX 定义调整后需要 STORE_NAME↔Schema、ACTION→STORE_MAP、ACL_MATRIX 三方引用同步回归

**不触发场景 · 减少误激活**：
- 日常业务 CRUD 开发、组件 UI 调整、非数据层配置变更；
- 已知与数据库定义无关的 tsc / eslint / vitest 报错。

**协作 Skill / 链式调用**：
- 迁移违规→`databridge-migration`（DataBridge 信封协议迁移）
- Gateway 层门面收敛→`gateway-facade-refactor`
- 全链路存储兜底复查→`data-flow-integrity-audit`

---

## 二、前置检查

> **铁律: 先扫后改，禁止跳过 DryRun 与 Step-1 快照**。未完成下表 1-5 项前，不得对 `dbConfig.ts` / `db-schema.ts` / `migrations/*.ts` / `databridge.ts` 做任何写入性编辑。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 确认当前 DB_VERSION 与 Store 总数 | 读取 `src/config/dbConfig.ts` 的 `DB_VERSION`、`STORE_NAME` 对象 key 数并与报告比对 | 数量与蓝图一致 |
| 2 | 区分基线 Store 与增量 Store | 浏览 `src/data/db-schema.ts`（`createSchema`）+ `src/data/migrations/*.ts` | 所有 STORE_NAME 能在 createSchema / ensureStore / createObjectStore 任一处找到 |
| 3 | 类型定义位置确认 | Grep `src/data/types/*.ts`、`src/types/modules/*.ts`、`src/services/**/*.types.ts` | Store 实体 Interface 已归位到 data/ 或 types/ 层 |
| 4 | Gateway 规范落地检查 | 检查 `docs/03-development/gateway-write-permission-spec.md` + `src/core/databridge.ts` 是否仍暴露裸 `db` import | DataBridge 内部仍用 db 可接受；services/ 层不得直接 import db |
| 5 | 审计脚本存在性确认 | 确认 `scripts/other/validate-data-blueprint.ts`、`validate-data-consistency.ts`、`scripts/audit-db-references.ts` 三文件存在 + 可执行 | 三脚本路径存在、tsx 执行无 file not found |
| 6 | 快照备份 | `git status --short > outputs/db-ref-audit-before.txt` | 有审计前磁盘状态快照 |
| 7 | 并发在途残差确认 | 检查 `tsc --noEmit` 既有历史错误清单，标记本次改动无关的错误 | 仅本次改动文件引入的错误计入 FAIL 判定 |

---

## 三、阶段化 SOP

按 4 个 Phase 顺序执行，禁止跳过 Phase 1 DryRun：

### **目标**：把「4 位置四同步」失败率降到 0，把 ACL 直接拒写 / Store 落空等运行时阻断问题在上线前暴露。

### Phase 1 · DryRun + 基础脚本跑通

**交付物**: 3 份脚本初跑报告快照

```powershell
# 蓝图一致性：Store 数量 + 核心实体 Interface 存在性
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-blueprint.ts 2>&1 | Tee-Object outputs/audit-dbref-step1-blueprint.txt

# 类型-Schema 一致性：Store 主键/索引字段是否存在于 Interface
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-consistency.ts 2>&1 | Tee-Object outputs/audit-dbref-step1-consistency.txt

# 交叉引用一致性（本 SKILL 核心脚本）
node node_modules/tsx/dist/cli.mjs scripts/audit-db-references.ts 2>&1 | Tee-Object outputs/audit-dbref-step1-xref.txt
```

**模板**：若 3 脚本任一非 0 exit，先把失败项写入 P0-P2 分级清单再进入 Phase 2。

### Phase 2 · 七维度逐项核对清单

**交付物**: 不一致项×失败模式 + 严重级别（error/warning）分类表

| 检查维度 | 正确锚点 | FAIL 常见模式 |
|---------|---------|--------------|
| STORE_NAME ↔ Schema 对查 | `STORE_NAME` key 必须在 `db-schema.ts` 或 `migrations/*.ts` 中有 `ensureStore`/`createObjectStore` | 新增 Store 只写 `STORE_NAME`，漏写 createSchema 或 Migration |
| ENVELOPE_ACTION 唯一性 | 同一字符串值不能被两个 key 复用 | 复制粘贴后忘记改值 |
| ACTION_TO_STORE_MAP 合法性 | 所有写操作（非 query/event/strategy/manager）必须映射到合法 `STORE_NAME` | 新增 action 后未补映射 |
| ACL_MATRIX 一致性 | key 必须是 `MODULE_ID`；read/write 数组元素必须是 `STORE_NAME` **key**（不能用 store value）| 拼写错误、使用 store value 而非 key |
| dataLayer barrel 暴露 | 业务 Store 应在 `dataLayer.ts` barrel 暴露；框架内部表可声明为例外 | 新增 Store 未加入 barrel |
| services 层直访扫描 | `services/`、`pages/`、`components/` 不应直接 `dataLayer.xxx.save()`/`db.put()` | 迁移遗留、绕过 DataBridge/ACL |
| DB_NAME 硬编码扫描 | 全仓除 `src/config/dbConfig.ts` 外不应出现精确 `"V6ProDB"` | 测试或工具硬编码数据库名 |

严重级别分类：
- **error 级（必须修复，否则运行时阻断）**：STORE_NAME↔Schema 不匹配 / ACTION_MAP / ACL 引用非法
- **warning 级（按优先级分阶段清理）**：未映射 ENVELOPE_ACTION / 未暴露 dataLayer Store / services 层直访

### Phase 3 · 针对性修复 + 脚本复跑

**交付物**: 修复后的脚本 0 error 报告（warning 允许保留但须分级列工单）

- error 级→直接定位 4 位置四同步缺口并修复（参考 §四 教训 1「四同步」清单）
- warning 级→建立优先级工单，不得用假修复（如把校验脚本 expected 改为匹配现状）
- 每次修复后复跑 Phase 1 三脚本，直到 error=0

### Phase 4 · Mandatory 门禁 + 审计报告归档

**交付物**: 4 个门禁全绿报告 + 最终审计报告 + Git 提交

| 门禁级别 | 命令 | 通过标准 |
|---------|------|---------|
| L1 类型 | `node node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit --incremental false` | 0 errors（他人未提交残差不计入 FAIL） |
| L2 架构分层 | `node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts` | 0 violations（与 databridge-migration 联合核对） |
| L3 数据一致性 | `node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-consistency.ts` | 0 error（warning 已审阅不阻断） |
| L4 DB 交叉引用 | `node node_modules/tsx/dist/cli.mjs scripts/audit-db-references.ts` | 0 error |

**模板**：最终审计报告写入 `outputs/dev-health-review-YYYY-MM-DD.md` 或 `docs/reports/audit/db-reference-audit-YYYY-MM-DD.md`，包含七维度的 pass/fail/warn 统计、P0-P2 修复工单清单、回滚点（Git commit hash）。

---

## 四、陷阱与经验教训

> 每条教训含「现象 / 后果 / 规避」三字段，禁止跳读。

| # | 教训条目 | 后果 | 规避 / 对策 |
|---|---------|------|------------|
| 1 | 新增 Store 必须同时更新 4 个位置（STORE_NAME + Schema/Migration + ACTION_TO_STORE_MAP + ACL_MATRIX + dataLayer barrel） | 浏览器 `onupgradeneeded` 未创建 store → DataBridge.forward 操作不存在的 store；或 ACL 直接拒绝写入 | 建立「新增 Store 五同步」检查清单：①dbConfig.ts → STORE_NAME + DB_VERSION ②db-schema.ts 或 migrations → 创建逻辑 ③databridge.ts → ACTION_TO_STORE_MAP（写操作）④dbConfig.ts → ACL_MATRIX 权限 ⑤dataLayer.ts → barrel 暴露（业务 store） |
| 2 | 业务实体 Interface 必须归位到数据层（不能散落在 services/**.types.ts） | 数据一致性校验脚本无法从 `src/data/types/` 找到对应 Interface；跨层反向依赖风险 | Store 对应的 Interface 优先放在 `src/data/types/*.ts` 或 `src/types/modules/*.ts`（零依赖）；services 层从数据层/类型层导入，反向依赖必须重构 |
| 3 | `services/**` 层 `dataLayer.xxx.save()` 直访 = 架构债 | 绕过 DataBridge ACL、缓存失效、审计日志和 fallbackQueue；Gateway 落地时须二次迁移 | 读操作→`dataBridge.query()` 或复用 `dataLayerHelpers.queryGet/queryList/queryByIndex`；写操作→必须 `sendWriteEnvelope('actionName', payload, source)` |
| 4 | migrations/*.ts 创建的增量 Store 易被 Schema 校验脚本遗漏（如 rbacMigrationV24 的 6 个 RBAC store） | 校验脚本给出 34 vs 40 假不一致结论，掩盖真实状态 | 校验脚本必须同时扫描 `db-schema.ts` + `src/data/migrations/*.ts`，区分基线/增量 store 并在报告标注 |
| 5 | 硬编码扫描必须限定上下文（stocks/news/orders/signals 是常见英文单词） | 全仓库字符串匹配产生上千条误报，真实问题被淹没 | 仅扫描 `dataLayer.<store>` 属性访问、`db.<method>(<store>)` 调用、`createObjectStore`/`ensureStore` 在非法位置的出现，以及精确 `V6ProDB` |
| 6 | services 层迁移必须统一用 `dataLayerHelpers`，不能每个调用点手写 `EnvelopeFactory.create` + `dataBridge.forward` | 60+ 处手写带来 source/target/traceId 格式不一致、ACL 源配置分散、审计日志碎片化 | 统一 4 helper：queryGet / queryList / queryByIndex / sendWriteEnvelope；helper 内部处理 ACL/审计日志/缓存失效/fallbackQueue；迁移后重跑 audit:db-references 验证 warning=0 |
| 7 | ACL_MATRIX 必须用 `STORE_NAME` 的 **key**（如 `STORE_NAME.stocks` 指向的键名 `"stocks"`），不能用 value 字符串 | ACL 校验时 key 不存在直接被拒写，报 ACL_PERMISSION_DENIED 且难以定位 | 在 ACL 写操作侧先通过 `keyof typeof STORE_NAME` 类型检查；改 ACL_MATRIX 时跑 `audit:acl-consistency` 强制 PASS |
| 8 | 不得为了让校验脚本 PASS 而修改脚本 expected 值（把 expected=53 改为 52 等） | 等于掩盖真实不一致，真问题未修 → 下次升级会再次浮现且更难定位 | 脚本 expected 若与 `STORE_NAME` 权威数冲突，**以 STORE_NAME 为准**→修脚本 expected 前必须先确认 STORE_NAME 的每个 key 都在 Schema 存在 |

---

## 五、完成交付物清单

**必要且充分条件**：Phase 1~4 全跑过且 L1-L4 门禁 error=0（warning 可带工单保留），审计报告含七维度统计与 P0-P2 工单，并在 Git 提交信息中含 `audit:db-references PASS`。

- [x] 1. `outputs/audit-dbref-step1-blueprint.txt` — validate-data-blueprint 初跑报告
- [x] 2. `outputs/audit-dbref-step1-consistency.txt` — validate-data-consistency 初跑报告
- [x] 3. `outputs/audit-dbref-step1-xref.txt` — audit-db-references 初跑报告（DryRun 基线）
- [x] 4. `outputs/db-ref-audit-before.txt` — 审计前 Git 状态快照
- [x] 5. 七维度核对清单（§三 Phase 2 表格）— P0-P2 分类的不一致项报告
- [x] 6. error 级修复 PR / 变更集 — 四同步缺口修复后对应的 Git diff
- [x] 7. L1 tsc:prod 全绿报告 — 本次改动文件不在错误清单中
- [x] 8. L2 audit:layers 0 violations 报告 — 跨层违规 0
- [x] 9. L3 validate-data-consistency 0 error 报告 — 类型一致性
- [x] 10. L4 audit-db-references 最终 0 error 报告 — 引用一致性最终确认
- [x] 11. P0-P2 修复工单清单 — warning 级项目的优先级与负责人
- [x] 12. 最终审计报告（`outputs/dev-health-review-YYYY-MM-DD.md` 或 `docs/reports/audit/` 下）
- [x] 13. Git 提交 — 信息含 `audit:db-references PASS`，可追溯修复版本
- [x] 14. 回滚点记录 — 审计后 commit hash，作为下次 DB_VERSION 升级的对比锚点

---

## 六、附录 · 参考路径索引

- `AGENTS.md` §一（项目分层规则）、§八（数据库版本管理）、§十四（MCP 权限）
- `docs/03-development/gateway-write-permission-spec.md`
- `docs/03-development/unified-pool-storage-spec.md`
- `src/config/dbConfig.ts` — STORE_NAME / ACL_MATRIX / MODULE_ID / DB_VERSION 权威源
- `src/data/db-schema.ts` + `src/data/migrations/*.ts` — 基线 + 增量 Schema 创建点
- `src/core/databridge.ts` — ACTION_TO_STORE_MAP + ACL 校验入口
- `src/data/dataLayer.ts` + `src/data/dataLayerHelpers.ts` — barrel 暴露 + 统一读写 helper
