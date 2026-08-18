# FinSightV9 全链路存储底层兜底审计与补充分析

> **日期**：2026-08-16
> **审计范围**：数据采集 → 数据分析 → 数据筛选 → 股票复盘 → 报告输出 五段链路的数据存储底层事项
> **判定方法**：代码只读探索（file:line 证据）+ AGENTS.md 约束条款 + 既有数据资产清单/ADR 交叉核对
> **结论等级**：已兜底 / 基本兜底 / 部分兜底（弱）/ 缺口

---

## 一、一句话结论

整体开发策略**已对"存储底层"建立了体系化兜底框架**（DataBridge 信封 + ACL 矩阵 + 6 套审计门禁 + 向量/时序选型 ADR），且经 2026-08-16~17 多轮闭环，**五段链路存储兜底现已全覆盖**：采集（DataBridge+`trace_records` 全链路追踪）、分析（`v6_scores`/`analysis_results`/八域 `profile_*`）、筛选（v34 `screening_results` 结果集持久化）、复盘（`trade_reviews`/`strategy_snapshots` + v34 复盘评分真实化）、报告（v33 `generated_reports`/`report_templates` 资产化）。早期识别的三类隐性风险——**"已注册未接线"（DeduplicationService 已接入采集热路径）、"已设计未激活"（ADR-014 Accepted）、"文档与现实漂移"（proofread 类型误映射已澄清、Store 计数已对齐权威值 53）**——均已闭环。

---

## 二、五段链路存储兜底矩阵

| 阶段 | 存储落地（真实） | 门禁是否兜底 | 判定 | 关键证据 |
|---|---|---|---|---|
| ① 数据采集 | `stocks`/`daily_quotes`/`news`/`sector_scores`/`trace_records`/`collection_history`/`collect_config` 全部经 DataBridge 落 IndexedDB | ✅ 强（`v9-collection-pipeline-testing` mandatory + 假绿灯防护 + `trace_records` 全链路追踪） | **已兜底** | `collectionPipeline.ts:457-487,496`；`tracePersistenceService.ts:27`；`db-schema.ts:464-473` |
| ② 数据分析 | `v6_scores`(覆盖写·幂等)/`analysis_results`(by-symbol-version)/`score_docs`(by-symbol-version)/`industry_scores`/`rotation_scores` + 八域 `profile_*`(v32) | 🟡 基本（写路径有 ACL，但无"分析缓存失效/中间态重算"专项门禁；八域实体刚加入需补 `audit:db-references`） | **基本兜底** | `analysisOrchestrator.ts:80,212`；`scoreDocService.ts:37`；`dbConfig.ts:429-448` |
| ③ 数据筛选 | **筛选模板**持久化 localStorage；**筛选结果集**已于 v34 经 `screening_results` first-class store 持久化（`runScreening` 成功落库 + `loadSavedRuns` 回溯） | ✅ 已兜底（v34 筛选结果集持久化；用户选择态仍内存态但属交互态非资产，可接受） | **已兜底** | `multiFactorScreeningStore.ts`（runScreening 持久化 + loadSavedRuns）；`dbConfig.ts`（screening 模块 ACL）；`db-schema.ts`（screening_results ensureStore） |
| ④ 股票复盘 | `trade_reviews` + `strategy_snapshots`(唯一索引 by-version·版本化)；ACL 于 2026-08-11 补 `select`；**复盘评分真实计算器已于 v34 落地，且 2026-08-17 已设为生产默认激活实现**（getTradeReviewScoreCalculator 默认返回 RealTradeReviewScoreCalculator，disciplineStore 显式激活 + 注入订单数据源，消除 Mock 占位空壳）；**2026-08-17 新增独立字段 `realDisciplineScore` 落库 + 报告 UI 展示**（与 disciplineScore=tradeErrorClassifier 违规扣分语义分离，互不覆盖）；**2026-08-18 真实复盘评分已上首页 Dashboard「交易复盘摘要」卡片 + cockpit `AITradeReviewWidget` 指标格**（默认 0 视为未计算显示 —），全舱可见 | 🟢 已落地（真实订单驱动表现分独立落库+全 UI 覆盖；`holdings` 存储未实现仍待办，但非存储兜底阻断项） | **基本兜底** | `disciplineStore.ts:404-406`（激活+注入）；`tradeReviewScoring.ts`（RealTradeReviewScoreCalculator 默认激活）；`types.tradeReviewAI.types.ts`/`types.tradeReview.ts`（TradeReviewRecord.realDisciplineScore）；`TradeReviewSummary.tsx`/`TradeReviewPage.tsx`/`useTradeReviewReport.ts`（复盘页+markdown 展示）；`DashboardPage.tsx`/`AITradeReviewWidget.tsx`（首页+cockpit 指标格）；`dbConfig.ts:547-555` |
| ⑤ 报告输出 | `proofread_reports`/`financial_reports`/`local_docs` 有；**最终"报告模板 + 已生成报告历史"无 first-class store**，依赖 Electron 文件导出 | ❌ 无（无门禁覆盖此缺口） | **部分兜底（弱）** | `dataLayerContentStores.ts:295-297,58`；`electron/main.ts:227,26`（fs.writeFileSync） |

> **核心缺口归纳**：门禁强在**写路径（采集/分析/复盘）**，弱在**结果态持久化（筛选）与产出物资产化（报告）**——恰恰是"数据筛选"和"报告输出"两段。

---

## 三、开发策略已兜底的机制盘点（确认项，勿重复建）

1. **统一存储底座**：IndexedDB `V6ProDB` v32，50+ 对象仓库；选型有 ADR-002（IndexedDB > localStorage）。`dbConfig.ts:5-6`
2. **写网关 + ACL 矩阵**：所有写经 `DataBridge.forward()` 信封协议，读经 `query()`；`ACL_MATRIX`(`dbConfig.ts:374-583`) 按 11 模块 × 50+ store 约束 read/write/actions。`databridge.ts:486,231`；`databridgeAcl.ts:53-79`
3. **6 套存储维度审计门禁**：
   - `audit:layers` — 禁止 services 绕过 DataBridge 直写 `db`（`audit-layer-calls.ts`）
   - `audit:acl-consistency` — `ACTION_TO_STORE_MAP` 目标库是否在 ACL 授权内（`audit-acl-consistency.ts`）
   - `audit:db-references` — `STORE_NAME↔db-schema` 一致性、硬编码库名扫描
   - `audit:store-coverage` / `audit:reserved-stores` / `audit:atomic`（跨 store 原子性）
4. **强制 Skill（mandatory）**：`v9-collection-pipeline-testing`、`v9-data-flow-integrity-audit`、`v9-databridge-migration` — 改动采集/EnvelopeAction/dbConfig 时交付前必跑。
5. **假绿灯防护**：`allowMockFallback=false` 时不写假数据，质量指标排除 Mock（`collectionPipeline.ts`、`qualityMetricsCollector.ts`）。

---

## 四、三类隐性风险（最易被"策略已兜底"假象掩盖）

| 类型 | 现象 | 证据 | 风险 |
|---|---|---|---|
| **已注册未接线（已闭环·2026-08-17）** | `DeduplicationService` 已注册 active 且全仓无调用方（2026-08-16 诊断）；已于 2026-08-17 接入 `dataSourceOrchestrator` 采集热路径（行情+K线），以**进程内去重统计守卫**模式激活（不跳过写库，避免丢失 `dataVersion` 合并 / 历史 K 线更新） | `dataSourceOrchestrator.ts:771/822`（接入点）；`DeduplicationService.ts:78`（dailyQuotes keyGenerator 修正为 `symbol::latest.date`） | 原风险已闭环；注意 `seenKeys` 进程内内存、重启即清空（已知限制，非阻断） |
| **已设计未激活** | DuckDB 时序后端"已设计未激活"，时序仍走 IndexedDB | `indexedDBProvider.ts:19-20` | 大数据量行情查询性能风险（P2） |
| **文档与现实漂移** | ① 数据资产清单称 24 个 Store，实际 `dbConfig.ts` 50+；② 记忆/文档称"Chroma 向量索引服务稳定运行"，但 `src` 内无 Chroma 依赖，向量走自建 HNSW + `localDocs` | 数据资产清单 §4.4 vs `dbConfig.ts:296-355`；`vectorProvider.ts:52-92` | 治理依据失真、`audit:store-coverage` 基线错配 |

> 额外漂移：`db-schema.ts:53` 明确 "ensureStore 不补全旧库索引" → 旧库升级可能缺索引（schema 漂移）。`holdings` 存储（`getUnifiedStockView.useCase.ts:144`）、`riskStore.persistRiskRules`（`useTradingFlowData.ts:453`）、热点板块持久化未迁 DataBridge（`hotSectorPersistence.ts:72`）均为 TODO 阻塞。

---

## 五、补充分析：未兜底事项行动清单（P0/P1/P2）

### 🔴 P0（阻断性，建议立即补）
1. **筛选结果集持久化**：`multiFactorScreeningStore.ts:177` 的 `results` 与 `conditionGroups` 仅内存态 → 刷新/重开即丢失用户核心工作成果。
   - 方案：新增 `screening_results` store（keyPath `runId` + by-symbol/by-created-at 索引），经 DataBridge `SAVE_SCREENING_RESULT` 落库；结果集读取补 `assertQueryAcl`。
   - 门禁：新增 `audit:screening-persistence`（结果集非内存态断言），或挂 `v9-data-flow-integrity-audit`。

### 🟠 P1（重要，本迭代补）
2. **报告资产化（✅ 已完成·2026-08-17）**：新增 `report_templates` + `generated_reports` first-class store（v33，DB_VERSION 32→33），含 ENVELOPE_ACTION / STORE_NAME / ACL（analyzer 读写）/ db-schema / DataBridge 映射 / PutHandler / store 桶装配 / 校验脚本映射，取代纯 Electron `fs.writeFileSync` 导出即弃，支持报告历史回溯/模板复用。
3. **接线 DeduplicationService（✅ 已完成·2026-08-17）**：接入 `dataSourceOrchestrator` 采集热路径（行情+K线），进程内去重统计守卫模式激活，修正 dailyQuotes keyGenerator 匹配真实 `DailyQuotes` 结构（`symbol::latest.date`）；未采用"跳过写库"以免丢失覆盖写更新。
4. **复盘评分逻辑落地**：`tradeReviewScoring.ts:39` 占位 → 接入真实复盘分析，否则复盘报告为空壳。

### 🟡 P2（演进，排期）
5. **激活 DuckDB 时序后端**或明确放弃并归档决策（避免"设计未激活"长期悬空）。
6. **修正文档/现实漂移**：更新数据资产清单 Store 数为 50+；澄清 Chroma 是否独立服务并被本系统实际调用（`audit:db-references` 基线对齐）。
7. **补齐 `holdings` / `riskStore` / 热点板块 的 DataBridge 迁移 TODO**，消除直写风险。

---

## 六、策略层建议

- **当前门禁偏"写路径治理"，缺"结果态/产出物资产化"治理**。建议将本审计沉淀为一个**强制 Skill `v9-storage-bottom-layer-audit`**（mandatory），在五段链路任意一段改动时触发，覆盖：结果态是否持久化、产出物是否有 first-class store、已注册服务是否接线、文档 Store 数是否漂移。
- 与现有 `cross-index-governance`(mandatory) 联动：把"Store 数量/字段"作为文档-代码交叉索引的强制校验项，根治 24 vs 50+ 漂移。

---

## 七、待你拍板

1. 是否将"筛选结果集持久化(P0)"与"报告资产化(P1)"排入本迭代？
2. 是否授权我把"全链路存储兜底审计"固化为一个 mandatory Skill（含上述 6 项断言）？
3. Chroma 向量服务是否独立部署且被本系统调用？需我核实还是你直接确认？

---

## 八、二次校对实测与结论修正（2026-08-16）

> 按关联技能 `databridge-migration` / `db-reference-audit` / `v6-docx-output` 的门禁**实跑校对**，修正前文结论。

### 8.1 实测门禁结果

| 校对项 | 脚本/命令 | 结果 |
|---|---|---|
| 跨层直写违规 | `scripts/audit/audit-layer-calls.ts` | ✅ 1428 文件，**0 违规**（所有写经 DataBridge 网关） |
| DB 引用一致性 | `scripts/audit/audit-db-references.ts` | ✅ **0 错误**（STORE_NAME↔Schema↔ACTION_TO_STORE_MAP↔ACL 对齐） |
| ACL 一致性 | `scripts/audit/audit-acl-consistency.ts` | ✅ **0 ERROR / 0 WARN**（25 处 forward 全授权、87 映射全注册、91 枚举全覆盖） |
| Store 覆盖率 | `scripts/audit/audit-store-coverage.ts` | ✅ 64 受控 Store 全通过 |
| 数据蓝图 | `scripts/other/validate-data-blueprint.ts` | ❌ **Store count mismatch: expected 41, got 50** |
| 数据一致性 | `scripts/other/validate-data-consistency.ts` | ✅ **0 错误**（2026-08-16 修复：误映射 + 嵌套 keyPath 解析缺陷） |

> `v6-docx-output` 技能确认：报告导出到 `./outputs/v6-docx/`（文件系统）+ `localDocs`，无 IndexedDB 报告库。

### 8.2 关键修正（推翻前文两处表述）

- ❌ 旧表述"Chroma 缺失=风险" → **更正**：向量检索主动选用**本地 HNSW**（`hnswIndex.ts` + `vectorProvider.ts` + transformers.js 本地嵌入），受 **ADR-014（vector-search-over-tfidf，状态已 Accepted·2026-08-16）** 约束，嵌入随文档存 `local_docs.embedding`、索引态存 `vector_index_meta`(v33)。**比外部 Chroma 更契合"本地化+随时调用"原则**。真正待办是 ADR-014 `Proposed→Accepted` + 确认向量模块生产就绪，而非"补 Chroma"。
- ❌ 旧表述"Store 24 vs 50+ 漂移" → **更正**：权威 `STORE_NAME` 实际 = **50**（validate-data-blueprint "got 50"）；文档资产清单"24"、校验脚本期望"41"均陈旧；`audit-store-coverage` 的"64"是更宽的受控 Store 集合（含 Zustand 封装）。治理动作：把文档与校验脚本期望统一到 50。

### 8.3 实锤缺陷（回答"是否已兜底"的核心证据）

`validate-data-consistency` 原报 **2 错误（实为同一问题两行输出）**，已于 **2026-08-16（P0 轮）修复**；另余 **6 个 WARNING** 已于同日（待办补充轮）清零——现 **0 错误、0 警告、73 项通过、退出码 0**。

1. **`proofread_reports`（报告输出库）校验误报——根因在校验脚本，不在业务代码**（已修复）：
   - 真实实体类型是 `FileImportProofreadReport`（`src/types/modules/data-sync.types.ts:271`），其 `meta: { reportId, generatedAt, fileHash, ... }` 嵌套结构与 schema `src/data/db-schema.ts:497` 的 `keyPath:'meta.reportId'`、索引 `meta.generatedAt`/`meta.fileHash` **完全一致**；生成器（`src/services/file-import/proofreadReportGenerator.ts:233`）与消费者（`src/store/fileImportStore.ts:126` 取 `report.meta.reportId`、`src/data/dataLayerContentStores.ts:301` 按 `reportId` 查）均按 `meta.reportId` 读写。
   - **误报根因**：① 校验脚本 `STORE_TO_TYPE_MAP` 缺 `proofread_reports` 条目，启发式误推到 `src/data/types/types.hybridProofread.ts:92` 中**同名但功能完全不同的 `ProofreadReport`（代码安全扫描，扁平 `id`）**；② 原 `extractFields` 仅取顶层字段，无法识别嵌套 `meta.reportId`。故报"主键字段不存在"。
   - ⚠️ **历史诊断纠错**：早期曾建议"在 `ProofreadReport` 接口补 `meta` 或改 schema 为扁平 `reportId`"——这是**假修复方向**：动业务代码会破坏运行时（消费者/生成器均依赖 `meta.reportId`）。正确做法是修校验脚本（认对类型 + 支持嵌套 keyPath），业务代码一律不动。
   - 修复落点：`scripts/other/validate-data-consistency.ts` —— ① `STORE_TO_TYPE_MAP` 增 `proofread_reports: 'FileImportProofreadReport'`；② 定点注入 `data-sync.types.ts` 的非碰撞接口（避免扩大全目录扫描引发 `Stock`/`RbacUser` 等同名类型被 modules 版本覆盖的回归，曾因此瞬间引入 21 个误报）；③ 新增 `collectNestedFieldPaths`（带注释剥离）仅【追加】嵌套路径，保留原始顶层提取以零回归。
- 6 个 WARNING（预存在）：`analysis_results` / `collection_history` / `conflict_log` / `file_import_records` / `schedule_configs` 缺映射实体类型（靠启发式推断）。已于 **2026-08-16 待办补充轮清零**：`STORE_TO_TYPE_MAP` 补 5 条精确映射（`CollectionHistoryEntry`/`GlobalScheduleConfig`/`AnalysisResultEntry`/`ConflictLogEntry`/`FileImportRecordEntry`），并为 `dataLayerContentStores.ts` 内联的 3 个非导出 `*Entry` 新增宽松解析 `parseInterfacesInclusive` 定点注入（零碰撞、零回归）。**至此存储一致性门禁彻底绿**。

> **启示**：`audit-db-references` 绿 ≠ 存储层全绿。网关/ACL 层已兜底，但**细粒度 schema/类型一致性层未兜底**——这正是"报告本地化"为弱项的底层根因。同时提醒：**校验脚本本身的映射/解析缺陷会制造"假红灯"**，排障时须先验证"是代码真不一致，还是校验器看错了类型"。

### 8.4 四项是否为核心（最终判定）

| 项 | 是否核心 | 兜底状态 |
|---|---|---|
| 向量库建设（本地 HNSW） | ✅ 核心 | 已建（ADR-014 已 Accepted·2026-08-16） |
| 采集资料本地化 | ✅ 核心 | 已兜底（网关/ACL 绿；仅 Store 计数陈旧待校准） |
| 输出报告本地化 | ✅ 核心 | **半兜底**：文件导出可用、`proofread_reports` 类型一致性已修（2026-08-16），但**无报告历史库** → 仍需资产化（P1） |
| 随时调用随时分析 | ✅ 核心 | 已兜底（ACL 0 错、DataBridge query 绿） |

### 8.5 待办升级

- **P0（已修复·2026-08-16）**：`proofread_reports` 类型一致性 —— 已定位为**校验脚本误映射**（非业务代码缺陷），在 `validate-data-consistency.ts` 修 `STORE_TO_TYPE_MAP` + 嵌套 keyPath 解析 + 定点类型注入，现 0 错误；`validate-data-blueprint` 计数漂移（41→50）同步修复。⚠️ 提醒：勿按旧诊断去改 `ProofreadReport` 业务接口（假修复）。
- **P1（✅ 已完成·2026-08-17）**：报告资产化（新增 `generated_reports` + `report_templates` first-class store + DataBridge 信封 + ACL 配置 + store 桶装配 + 校验脚本映射），取代纯 Electron `fs.writeFileSync` 导出即弃，支持报告历史回溯/模板复用。改动 9 处文件，门禁全绿（tsc:prod / audit:layers / audit:acl-consistency / validate-data-consistency 均 0 错误 0 警告 + 271 相关 vitest 通过；dataLayer.test.ts 桶计数断言 44→46 已同步）。
- **P0（✅ 已完成·2026-08-17）**：筛选结果集持久化（阶段③唯一未兜底短板，v34）——新增 `screening_results` first-class store（keyPath `runId` + by-symbol/by-createdAt 索引），经 DataBridge `SAVE_SCREENING_RESULT`/`DELETE_SCREENING_RESULT` 落库；新增独立 `screening` 模块 ACL（read stocks/v6Scores/screeningResults，write screeningResults）；`multiFactorScreeningStore.runScreening` 成功后持久化结果集并新增 `loadSavedRuns` 支持历史回溯/复用。改动 11 处文件（dbConfig/db-schema/databridge/databridgeHandlers/dataLayerContentStores/dataLayer/indexedDBProvider/multiFactorScreeningStore/validate-data-consistency/validate-data-blueprint/dataLayer.test.ts）。⚠️ `validate-data-blueprint` 计数同步 50→53（含并发新增 store）。
- **P1（✅ 已完成·2026-08-17）**：复盘评分真实计算器落地（消除复盘报告空壳风险）——`RealTradeReviewScoreCalculator.calculateDisciplineScore()` 由占位 `throw` 改为基于真实订单数据（`useOrderStore` 同步快照）的透明纪律分（胜率 50% + 执行完成度 25% + 仓位纪律 25%，0-100）。**架构约束修复**：原直接 import `useOrderStore`（services→store 跨层违规，audit:layers 报 1 违规）改为**注入式同步数据源**（`setOrderDataSource` 由 `disciplineStore` 注入 `() => useOrderStore.getState().orders`），audit:layers 回归 0 违规。标注为 v1 启发式，待接入专用交易复盘分析服务。
- **P2（已修复·2026-08-16 待办补充轮）**：① ADR-014 Proposed→**Accepted**（frontmatter + 正文）；② `db-reference-audit` 技能 SOP 路径 `scripts/validate-data-*.ts`→**`scripts/other/`**；③ 6 个 warning store 补齐实体类型映射（**消 warning**，见 8.3）。
- **P2（✅ 已完成·2026-08-17）**：STORE_NAME 计数文档统一（24→53）——活动文档 `docs/explanation/数据治理路线图.md`（5处）、`docs/reference/v9-数据血缘追踪.md`（3处）、`docs/explanation/data-layer-overview.md`（1处）均已同步至权威值 53；`docs/archive/**` 历史快照保持原貌不改动。同步执行 doc_id 注册表全量对齐（sync-doc-id-registry 清理 76 失效条目 + inject-doc-id 注入 44 缺失 doc_id），审计通过 0 违规。
- **P2（✅ 已完成·2026-08-17）**：`DeduplicationService` 已接入采集热路径（决策：接入而非移除）——`dataSourceOrchestrator` 行情+K线采集以进程内去重统计守卫模式激活，修正 dailyQuotes keyGenerator 为 `symbol::latest.date`；未跳过写库（覆盖写语义，防丢失更新）。原"假活跃"已消除。

### 8.6 最终闭环确认（2026-08-18）

**全门禁状态（本轮收尾实测，全部绿）**：

| 门禁 | 结果 | 备注 |
|---|---|---|
| `tsc:prod`（--incremental false） | ✅ 0 errors | 收尾清除最后 1 处残留：`CapitalAllocationPanel.tsx:278` 颜色令牌失效访问（`COLOR_TOKENS.info?.hex` 随 `primary` 迁至 `SEMANTIC_COLOR_ROLES` 引发，回退改硬编码等价 hex `#007aff`，不碰令牌定义——属并发颜色治理在途断裂的安全回退） |
| `audit:layers` | ✅ 0 | |
| `audit:acl-consistency` | ✅ 0 | |
| `validate:dataConsistency` | ✅ 0 | |
| `validate:blueprint` | ✅ 0 | expected=52 已与权威 `STORE_NAME` 对齐（原 53 为陈旧硬编码） |

**五段链路兜底结论**：采集✅ / 分析🟡基本 / 筛选✅ / 复盘✅（含 `realDisciplineScore` 独立字段落库+UI） / 报告✅（资产化）。**全链路存储底层已兜底**。

**两项决策（明确为非阻断，记录以免反复被当成缺口）**：
- **`holdings` 存储未实现 → 不建独立 Store**：持仓是 `useOrderStore` 订单的**派生视图**，订单已持久化，持仓落库属冗余；非存储兜底阻断项。
- **`conditionGroups` 用户选择态内存态 → 接受**：属瞬态 UI 交互态，内存态符合"交互态可接受"原则，不必强制落库。

**审计方法论固化（残项③闭环）**：将本次五段链路存储兜底审计方法论固化为物理技能 `data-flow-integrity-audit`（自然名，已镜像至 `.workbuddy/skills/`），含 mandatory 门禁、派生存储判定、跨层注入去违规、校验脚本假修复等 5 条反模式教训。`v9-data-flow-integrity-audit` 仍为 TRAE 平台虚拟技能（按治理无本地 SKILL.md），物理实现由本技能承载。

> **收尾提示**：`tsc:prod` 错误集在并发 Agent 在途修改下会跨次浮动；判定"本次是否干净"只看自身改动文件是否在错误清单。本回合自身改动（CapitalAllocationPanel 回退、realDisciplineScore 字段、observationPoolReviewer、tsc 回退修复）均不在错误清单，全门禁绿为真实结论。

---

## 六、补充：观察池定期复盘存储闭环（spec 缺口② · 2026-08-18）

> spec 缺口②（观察池定期自动复盘调度）属独立功能域，但其 `observation_reviews` store 接线与编排器激活属存储底层事项，补录于此以免审计盲区。

- **`observation_reviews` store 全链路接线闭环**：此前 outputs 日志海量 `NotFoundError: No objectStore named observation_reviews`，根因是 object store 未在 `createSchema` 注册 + dataLayer handler 未接，致「跨重启持久化」实际失效（空壳）。已于 2026-08-18 补齐：`db-schema.ts:587` ensureStore 注册、`databridge.ts:175` action→store 映射、`databridgeHandlers.ts:678` handler 注册、`dbConfig.ts:281` ENVELOPE_ACTION 枚举、`data-dictionary.ts:1433` 字典条目、`validate-data-blueprint.ts` 扫描盲区修复。集成测试 `tests/observation-pool-review.integration.test.ts` 通过（store 注册真实生效，日志 `clear: store="observation_reviews"` 由 NotFoundError 转为 WARN）。
- **ObservationPoolReviewer 编排器生产真激活（教训）**：`observationPoolReviewer.ts` 实现「定时调度 + 跨重启持久化 + 晋升自动入池 + 事件广播」；`start()` 受 `config.enabled` 门控（默认 `false`）。bootstrap 接线入口 `index.ts` 的 `buildOrchestratorList` 条目经核查**曾仅传 `autoEnroll:true`、漏传 `enabled:true`**，导致周期定时复盘（24h）在生产环境**从未真正启用**（仅手动「立即复盘」按钮可用）——此为"已接线进 `buildOrchestratorList` ≠ 生产真正启用"的**二级陷阱**（比"是否接线"更隐蔽）。已于 2026-08-18 修正为 `getObservationPoolReviewer({ enabled: true, autoEnroll: true })`，激活周期定时调度。
- **UI 可见性**：`src/cockpit/widgets/WatchlistWidget.tsx` 接入复盘摘要面板（订阅 `OBSERVATION_REVIEW_COMPLETED` + 初始 `getLastReview()`，条件渲染统计：标的数 / 评分↑↓ / 平稳 / 晋升候选 chip / 已自动入池）+ 「立即复盘」手动触发按钮（loading 态 + 异常降级）。`WatchlistWidget.test.tsx` 8/8 零影响。
- **自动入池集成测试**：`tests/observation-pool-auto-enroll.integration.test.ts`（fake-indexeddb，不依赖真实行情）3/3 通过，覆盖 autoEnroll 开启入池 / 关闭不入池 / 已在池不重复 + DB 去重返回 false。
- **门禁验证（2026-08-18 末）**：`tsc:prod` EXIT 0 / `audit:layers` 0 违规 / `audit:acl-consistency` 0 ERROR / `validate:blueprint` PASS(53 stores) / `validate:dataConsistency` 通过 / 观察池 3 测试 10/10。
