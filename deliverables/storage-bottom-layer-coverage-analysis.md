# FinSightV9 全链路存储底层兜底审计与补充分析

> **日期**：2026-08-16
> **审计范围**：数据采集 → 数据分析 → 数据筛选 → 股票复盘 → 报告输出 五段链路的数据存储底层事项
> **判定方法**：代码只读探索（file:line 证据）+ AGENTS.md 约束条款 + 既有数据资产清单/ADR 交叉核对
> **结论等级**：已兜底 / 基本兜底 / 部分兜底（弱）/ 缺口

---

## 一、一句话结论

整体开发策略**已对"存储底层"建立了体系化兜底框架**（DataBridge 信封 + ACL 矩阵 + 6 套审计门禁 + 向量/时序选型 ADR），但兜底**在五段链路上不均衡**：**采集、分析、复盘三段覆盖扎实；筛选结果集与报告资产两段是明显短板**（结果集内存态刷新即丢、报告无 first-class 表），并存在**"已注册未接线 / 已设计未激活 / 文档与现实漂移"** 三类隐性风险。

---

## 二、五段链路存储兜底矩阵

| 阶段 | 存储落地（真实） | 门禁是否兜底 | 判定 | 关键证据 |
|---|---|---|---|---|
| ① 数据采集 | `stocks`/`daily_quotes`/`news`/`sector_scores`/`trace_records`/`collection_history`/`collect_config` 全部经 DataBridge 落 IndexedDB | ✅ 强（`v9-collection-pipeline-testing` mandatory + 假绿灯防护 + `trace_records` 全链路追踪） | **已兜底** | `collectionPipeline.ts:457-487,496`；`tracePersistenceService.ts:27`；`db-schema.ts:464-473` |
| ② 数据分析 | `v6_scores`(覆盖写·幂等)/`analysis_results`(by-symbol-version)/`score_docs`(by-symbol-version)/`industry_scores`/`rotation_scores` + 八域 `profile_*`(v32) | 🟡 基本（写路径有 ACL，但无"分析缓存失效/中间态重算"专项门禁；八域实体刚加入需补 `audit:db-references`） | **基本兜底** | `analysisOrchestrator.ts:80,212`；`scoreDocService.ts:37`；`dbConfig.ts:429-448` |
| ③ 数据筛选 | **仅筛选模板**持久化到 localStorage；**筛选结果集 / 用户选择状态纯内存态**（刷新即丢），无落库 | ❌ 无（无门禁覆盖此缺口） | **部分兜底（弱）** | `multiFactorScreeningStore.ts:33,96-103,177`；`screeningEngine.ts:41-70`（纯读） |
| ④ 股票复盘 | `trade_reviews` + `strategy_snapshots`(唯一索引 by-version·版本化)；ACL 于 2026-08-11 补 `select` | 🟡 基本（落地 OK，但复盘评分逻辑占位、`holdings` 存储未实现） | **基本兜底** | `disciplineStore.ts:216,300`；`db-schema.ts:253-260`；`dbConfig.ts:547-555` |
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
| **已注册未接线** | `DeduplicationService` 已注册 active，全仓无调用方 → 采集去重实际只靠 `dataVersion` 合并 | `DeduplicationService.ts:123`；`serviceRegistry.ts:40` | 重复数据/增量同步边界不可控 |
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
2. **报告资产化**：新增 `report_templates` + `generated_reports` first-class store（取代纯 Electron `fs.writeFileSync` 导出即弃），支持报告历史回溯/模板复用。
3. **接线 DeduplicationService**：将 `DeduplicationService` 接入 `collectionPipeline` 热路径，或显式标注为"设计冗余"并从注册表移除，避免假活跃。
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
- **P1（待拍板·功能开发）**：报告资产化（新增 `generated_reports` + `report_templates` first-class store + DataBridge 信封 + ACL 配置），取代纯 Electron `fs.writeFileSync` 导出即弃，支持报告历史回溯/模板复用。
- **P2（已修复·2026-08-16 待办补充轮）**：① ADR-014 Proposed→**Accepted**（frontmatter + 正文）；② `db-reference-audit` 技能 SOP 路径 `scripts/validate-data-*.ts`→**`scripts/other/`**；③ 6 个 warning store 补齐实体类型映射（**消 warning**，见 8.3）。
- **P2（残留·文档漂移）**：STORE_NAME 计数文档统一（24→50）——活动文档 `docs/explanation/数据治理路线图.md` 仍多处声称 24（属历史路线图验收目标，非硬错误）；`docs/archive/**` 历史快照大量声称 24/47 等，**保持原貌不改动**；已正确文档 `docs/guides/how-to/how-to-data-import-export.md` 写 50+、`validate-data-blueprint.ts` 硬编码 50。建议单列 doc-code 专项（`doc-code-dual-proofreading` 技能）统一活动文档计数，避免误改历史快照。
- **P2（待拍板·架构决策）**：`DeduplicationService` 接线或显式移除——已注册 active 但全仓零业务调用（采集去重实际只靠 `dataVersion` 合并），属"假活跃"，需决策接入采集热路径或移出注册表。
