---
name: "data-flow-integrity-audit"
description: "对 V9 数据流的『存储底层兜底』做全链路审计：按 采集→分析→筛选→复盘→报告 五段，逐一核对过程产物是否已被持久化（IndexedDB Store / 派生视图 / 资产化），识别『已注册未接线 / 已设计未激活 / 文档漂移』三类隐性风险，并运行 mandatory 门禁（tsc:prod / audit:layers / audit:acl-consistency / validate-data-consistency / validate:blueprint）确认兜底闭环。Invoke when user asks to audit storage coverage, verify data-flow persistence, check whether a pipeline stage is backed by storage, or review the five-stage storage bottom-layer, validate-blueprint 报 5 段链路缺失或重构新增数据链路/新增 Store 后需要回归 mandatory 门禁时。"
version: "v1.0.2"
last_updated: "2026-08-21"
change_log:
  - version: v1.0.2
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥4，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 5 段自定义标题重映射为标准一~五段；§二前置事实合并为表格化检查清单；§三五段兜底+风险扫描+门禁拆为 5 Phase；§六反模式 5 条与 §五决策陷阱合并扩充为 8 条（后果+规避双字段）；§七审查清单转为 S5 14 项交付物+必要充分条件声明；保留 mandatory=true（项目级治理门禁）。"
    date: 2026-08-21
  - version: v1.0.0
    changes: "初始版本：固化五段链路存储兜底审计方法论（含 mandatory 门禁、派生存储判定、跨层注入去违规等踩坑）"
    date: 2026-08-18
mandatory: true
---

# 全链路存储兜底审计 — v1.0.1

> **版本**: v1.0.1 | **日期**: 2026-08-21 | **校验基准**: V9 v2.1.0 / DB_VERSION 34+
> **任务性质**: 审计与验证（**mandatory：命中触发时，交付前 5 门禁未全绿不得声明完成**），允许补充/修正校验脚本与持久化接线，禁止无评审直接改 `DB_VERSION` 或删 Store
> **输出格式**: 五段链路兜底矩阵 + 三类隐性风险清单 + 门禁结论 + 决策记录

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「审计五段存储兜底」「核对过程产物是否真的落库」「检查某数据链路段持久化闭环状态」「复盘 采集→分析→筛选→复盘→报告 五段存储完整性」
- **显式触发 2**：怀疑存在三类隐性反模式任一种——「已注册未接线（Store 已注册但无 ENVELOPE_ACTION/Handler/ACL）」「已设计未激活（默认 Mock 兜底真实实现为可选）」「文档漂移（文档声明 Store 数/路径 vs 磁盘不一致）」
- **脚本/审计触发 3**：`npm run validate:blueprint` 或 `npm run validate:dataConsistency` FAIL；或 `npm run audit:layers` / `npm run audit:acl-consistency` 任一 FAIL；或 `tsc:prod` 报数据层 Interface 字段缺失
- **脚本/审计触发 4**：Gateway 门面化 / DataBridge 信封协议 / Schema+Migration+ACL 批次大改后，回归 5 个 mandatory 门禁（M1 tsc:prod / M2 audit:layers+audit:acl / M3 data-consistency+blueprint）必跑本 Skill
- **设计/协议触发 5**：新增一条数据链路（采集/分析/筛选/复盘/报告任一阶段）或新增 IndexedDB Store；或 AGENTS.md 五段链路权威目录变更（新增 data-collector/analysis/screening/tradeReview/report-generator 子目录）后，需要同步审计五段兜底矩阵

**不触发场景 · 减少误激活**：
- 纯 UI 组件样式变更、文档错别字修复、非数据层配置调整；
- 业务 CRUD 单元测试通过但与新链路 / 新 Store 无关的常规开发。

**协作 Skill / 链式调用**：
- DB 引用交叉核对 → `db-reference-audit`
- 采集链路门禁 → `v9-collection-pipeline-testing` / `collection-pipeline-governance`
- 跨层注入违规 → `databridge-migration` / `gateway-facade-refactor`
- 类型变更契约 → `type-safety-contract`

---

## 二、前置检查

> **铁律: 勿被过时报告误导**。每次审计前必须重跑 3 个基线脚本，不得直接采信数月前的审计报告。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 存储基座权威源确认 | 读 `src/config/dbConfig.ts` → `STORE_NAME` key 总数（权威清单） + `DB_VERSION` | 数量与 `db-schema.ts` + `migrations/*.ts` 两端合并的创建点数量一致 |
| 2 | 写入协议基座确认 | 检查 `src/core/databridge.ts` → `ACTION_TO_STORE_MAP` 表覆盖所有写操作；`src/data/dataLayerHelpers.ts` 有 queryGet/queryList/queryByIndex/sendWriteEnvelope 4 Helper | 写操作必须路由到 DataBridge；services 层改走 helper（禁止裸 dataLayer 写） |
| 3 | 5 段链路权威清单确认 | 核对 `src/services/data-collector/**`（采集）/ `analysis/**`（分析）/ `screening/**`（筛选）/ `tradeReview/**`（复盘）/ `report-generator/**`（报告）5 段目录 | 每段都有源码入口或明确声明为「派生视图 / 交互态」 |
| 4 | mandatory 门禁脚本存在性 | 确认 `tsconfig.prod.json` + `scripts/other/validate-data-consistency.ts` + `validate-data-blueprint.ts` + `scripts/audit/audit-layer-calls.ts` + `audit/audit-acl-consistency.cjs` 5 文件存在 | 5 门禁路径存在、tsx/tsc 可执行 |
| 5 | 并发在途残差确认 | `git stash list` + 打开 `tsc -p tsconfig.prod.json --noEmit --incremental false` 初跑，标记与本次改动无关的既有错误 | 本次审计 FAIL 判定只计本审计改动的文件引入的错误 |
| 6 | 审计前快照 | `git status --short > outputs/data-flow-integrity-audit-before.txt` | 有审计前磁盘状态快照 + commit hash 记录 |
| 7 | 派生视图白名单核对 | 确认 `holdings` / `筛选条件 conditionGroups` 等项目级已知「不必单独建 Store」的白名单列表存在 | 白名单中的不建 Store 项不得误判为兜底缺口 |

---

## 三、阶段化 SOP

按 5 个 Phase 顺序执行，对应五段链路 + 三类风险扫描 + Mandatory 门禁验证：

### **目标**：确认 采集→分析→筛选→复盘→报告 五段过程产物 100% 有持久化落点（或明确声明为派生视图/交互态并在白名单），三类隐性风险归零。

### Phase 1 · 五段链路 × 存储落点矩阵审核

**交付物**: 五段×产物×持久化落点×兜底判定矩阵（每段回答 3 个问题：产物是什么？已持久化？若无可接受态？）

| 阶段 | 核心产物 | 持久化落点（已验证） | 兜底判定 |
|------|---------|---------------------|---------|
| ① 数据采集 | 行情 / K 线 / 研报 / 新闻 / 因子 | `DeduplicationService` 统计守卫激活（覆盖写语义不跳写）+ 各业务 Store（stocks / dailyQuotes / researchDocs / news / factorSignals 等） | ✅ 已兜底（白名单：瞬时交互态可除外） |
| ② 数据分析 | V6 评分 / 因子 / 行业分 | 基本落库（`v6Scores`、`industrySectorData`、`sectorSkillData`、`intelligentScores` 等）；分析中间态多为派生视图 | ✅ 基本（派生视图不须单独 Store） |
| ③ 数据筛选 | 筛选结果集 | `screening_results`（v34 新增，keyPath runId，by-symbol / by-createdAt 双索引） | ✅ 已兜底（run 结果资产化） |
| ④ 股票复盘 | 复盘记录 / 评分 / 版本化快照 | `trade_reviews` + `strategy_snapshots`（by-version 版本化）；真实评分：`RealTradeReviewScoreCalculator` 默认激活 + 独立字段 `realDisciplineScore` | ✅ 已落地（真实实现默认激活，无 Mock 占位） |
| ⑤ 报告输出 | 生成报告 / 模板资产化 | `generated_reports` + `report_templates`（v33 资产化，keyPath reportId / templateId） | ✅ 已兜底（报告/模板可复用，资产化入库） |

**模板**：矩阵中任何一行判定≠✅，立即写入「三类风险清单」进入 Phase 2。

### Phase 2 · 三类隐性风险扫描

**交付物**: 三类隐性风险 × 实例清单 × 严重级别

1. **已注册未接线（高风险）**：Store 在 `STORE_NAME` 但无 `ACTION_TO_STORE_MAP` / handler / ACL 入口 → 写入会被拒或落空。
   - 扫描方法：`db-reference-audit` 的 Phase 2 × ACTION_MAP 核对维度
2. **已设计未激活（高风险）**：能力已写但默认走 Mock 或未接线（曾：`getTradeReviewScoreCalculator()` 默认返回 Mock，`RealTradeReviewScoreCalculator` 沦为死代码）。
   - 扫描方法：Grep `class Real*` → 追 `export default` / `factory()` / `setDefault`，确认真实实现是默认激活路径
3. **文档漂移（中风险）**：文档声称的 Store 数/路径与磁盘不一致（曾：`validate-data-blueprint` 硬编码 expected=53 而权威 STORE_NAME=52）。
   - 扫描方法：文档中的 `expected=` / `DB_VERSION=` / `Store 数` 字面量 Grep，与磁盘 `STORE_NAME` + `DB_VERSION` 权威源对齐

### Phase 3 · 缺口修复 / 风险闭环

**交付物**: 每类风险的修复 diff + 复跑脚本 0 error 报告

- 已注册未接线 → 写 ACTION_TO_STORE_MAP + handler + ACL（参考 `databridge-migration`）
- 已设计未激活 → 把真实实现设为默认；保留 Mock 只在测试/开发环境显式切换
- 文档漂移 → 以 `STORE_NAME` / `DB_VERSION` 为准：若文档写 53 而 Store=52，则修文档→52，不得修 Store 为 53（属于假修复）

### Phase 4 · 决策规则应用（避免假修复）

**交付物**: 决策判断记录表

以下四条作为修复前的 gate，任何一条不满足则不得写代码修复：
1. **派生视图不必单独建 Store**：持仓（holdings）由 `useOrderStore` 订单聚合派生 → 订单已持久化 = 持仓属派生视图，无需独立 Store
2. **交互态内存可接受**：用户筛选条件选择（conditionGroups）属瞬态 UI → 内存态可接受，不强制落库
3. **Mock 占位 ≠ 落地**：真实逻辑写好但默认返回 Mock ≠ 未落地；落地 = 真实实现默认激活 + 生产接线 + 注入数据源
4. **语义不同字段禁止盲替**：`disciplineScore`（违规扣分=纪律度）与 `RealTradeReviewScoreCalculator` 输出（胜率+执行+仓位=交易分）语义不同 → 落地用**新增独立字段**而非覆盖

### Phase 5 · Mandatory 5 门禁全绿验证

**交付物**: 5 门禁全绿（0 error）报告 + 审计最终归档

```powershell
# M1 类型（排除增量缓存伪影，用 --incremental false）
node node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit --incremental false 2>&1 | Tee-Object outputs/m1-tsc-prod.txt

# M2 架构跨层违规
npm run audit:layers 2>&1 | Tee-Object outputs/m2-audit-layers.txt
npm run audit:acl-consistency 2>&1 | Tee-Object outputs/m2-audit-acl.txt

# M3 数据一致性 + 蓝图
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-consistency.ts 2>&1 | Tee-Object outputs/m3-data-consistency.txt
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-blueprint.ts 2>&1 | Tee-Object outputs/m3-blueprint.txt
```

> **tsc 伪影铁律**: 并发在途 Agent 修改未提交时，`tsc --noEmit` 错误集会浮动（15→10→1）。判定本次 FAIL 只看**本审计改动文件**是否出现在错误清单；他人未提交代码仅记录残差，不得擅自修复。

---

## 四、陷阱与经验教训

| # | 教训条目 | 后果 | 规避 / 对策 |
|---|---------|------|------------|
| 1 | 校验脚本映射错误会导致业务代码假修复（`STORE_TO_TYPE_MAP` 把 proofread_reports 映射到错误类型） | 报告「缺字段」→ 开发者去改业务 Interface → 真修脚本误报 → 反而引入真正类型断裂 | 先定点看业务数据写入路径是否正常；业务代码正确则只修校验脚本，扩大扫描前先注入单条样本，不扫 modules/ 引发同名类型碰撞 |
| 2 | DeduplicationService「命中即跳过写库」会丢失兜底 | 本系统是覆盖写语义，跳过会丢失最新数据（如 factor 值变动）→ 五段审计报「已兜底」但实际丢数 | 改用「统计守卫」——仍调用写库，仅统计命中/跳过计数，不阻断写入；白名单注释写明「覆盖写 > 纯去重」 |
| 3 | 引擎层直连 store 层触发 audit:layers 违规（tradeReviewScoring 直接 import useOrderStore） | audit:layers 跨层违规；且引擎逻辑被 store 状态耦合，无法在 Node 测试 | 引擎层禁止依赖 store 层；由 store 层反向注入数据源函数：`setOrderDataSource(() => useOrderStore.getState().orders)` |
| 4 | 同名 Interface 跨目录定义（TradeReviewRecord 在 types/modules 和 data/types 两处） | 只改一处 → tsc 报「缺字段」；审计报告误判为 Store→Interface 未对齐 | grep 全量定位所有同名定义，保持同步；以 disciplineStore 实际 import 的来源文件为锚 |
| 5 | 并发治理令牌重构断裂（COLOR_TOKENS primary→SEMANTIC_COLOR_ROLES 迁移中） | 组件仍 `COLOR_TOKENS.info?.hex` 访问，TS 误报 → 审计误判为数据层类型问题 | 组件内安全回退为硬编码等价 hex（`#007aff`），解耦对在途令牌定义的硬依赖；仅做回退，不碰令牌定义本体 |
| 6 | 「派生视图」被误判为兜底缺口（持仓由订单聚合 → 想单独加 holdings Store） | 引入冗余 Store；跨层同步增加失败点；五段矩阵膨胀 | 严格走 Phase 4 四条决策规则 gate；下单前在「派生视图白名单」（§二 #7）登记 |
| 7 | 为让 validate-blueprint PASS 而改 expected 常量（52→53 或反向） | 掩盖真实 STORE 数量错配；下次 DB_VERSION 升级会再次浮现且难定位 | 以 `STORE_NAME` 为唯一锚点；expected 若错只修脚本常量，且必须同时跑 audit-db-references 做交叉复核 |
| 8 | 「真实实现默认激活」未确认（RealTradeReviewScoreCalculator 返回 Mock 为默认） | 生产评分全为 Mock 0 → 用户信任崩塌；审计「已兜底」是假绿 | 扫 `factory()` / `getXXXCalculator()` 默认 return 路径；真实实现必须为默认，Mock 需通过 `NODE_ENV===test` 或 feature flag 显式开启 |

---

## 五、完成交付物清单

**必要且充分条件**：Phase 1 矩阵 5/5 ✅；Phase 2 三类风险=0 或全部在修复工单登记且 P0 关闭；Phase 4 决策规则无违规；M1-M5 5 个 mandatory 门禁全绿（0 error，他人残差须标注）；最终审计报告含 Git commit hash。

- [x] 1. `outputs/data-flow-integrity-audit-before.txt` — 审计前 Git 状态快照 + commit hash
- [x] 2. Phase 1 五段×产物×落点×判定矩阵 —（§三 Phase 1 表格）
- [x] 3. Phase 2 三类隐性风险清单 — 实例清单 × 严重级别 × 修复方案
- [x] 4. Phase 3 缺口修复 diff / PR — 每类风险的修复 Git 变更集
- [x] 5. Phase 4 决策判断记录 — 四条 gate 的 pass/fail 判定表
- [x] 6. `outputs/m1-tsc-prod.txt` — M1 tsc:prod 门禁报告
- [x] 7. `outputs/m2-audit-layers.txt` — M2 audit:layers 门禁报告
- [x] 8. `outputs/m2-audit-acl.txt` — M2 audit:acl-consistency 门禁报告
- [x] 9. `outputs/m3-data-consistency.txt` — M3 data-consistency 门禁报告
- [x] 10. `outputs/m3-blueprint.txt` — M3 blueprint 门禁报告
- [x] 11. 派生视图白名单（§二 #7 + §三 Phase 4 决策规则）— 不建 Store 的例外清单
- [x] 12. 残差表（并发在途他人改动导致的非本次 tsc 错误）— 区分「本次失败」vs「历史残差」
- [x] 13. 最终审计报告 `outputs/data-flow-integrity-audit-YYYY-MM-DD.md` — 含五段矩阵+风险表+门禁全绿截图
- [x] 14. Git 提交 — 信息含 `mandatory:data-flow-integrity-audit PASS` + 审计后 commit hash

---

## 六、附录 · 参考路径索引

- `src/config/dbConfig.ts` — STORAGE_NAME / ACL_MATRIX / MODULE_ID / DB_VERSION 权威源
- `src/core/databridge.ts` + `src/data/dataLayerHelpers.ts` — DataBridge 写入协议 + 4 Helper
- `src/data/db-schema.ts` + `src/data/migrations/*.ts` — Schema 创建点（基线+增量）
- `src/services/data-collector/**` → `services/analysis/**` → `services/screening/**` → `services/trading/tradeReviewScoring/**` → `services/report/**` — 五段链路目录入口
- `scripts/other/validate-data-blueprint.ts` + `validate-data-consistency.ts` + `scripts/audit/audit-layer-calls.ts` + `audit/audit-acl-consistency.cjs` — 5 门禁脚本
- 关联 Skill：`db-reference-audit` / `collection-pipeline-governance` / `databridge-migration` / `gateway-facade-refactor`
