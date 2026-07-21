---
title: ADR-010: 八域资料体系与评分证据链架构
type: reference
domain: data
phase: design
tier: important
status: accepted
maintainer: V9 Architecture Team
summary: "八域资料体系与证据链架构：将分散的资讯/研报/公告/社区帖等统一归集到 D1-D8 八个研究域，每域对应 V6 评分模型的一个或多个层级，形成「资料条目 → 评分证据 → 分层得分」的完整证据链，解决评分黑箱问题。"
tags: [data, profile, evidence-chain, scoring, adr, reference, data-definition]
version: v1.1.0
last_updated: 2026-07-21
code_version: 2.0.0
doc_id: V9-DOC-DATA-028
referenced_by: [docs/explanation/design/profile-eight-domains-design.md]
change_log:
  - version: v1.1.0
    changes: 架构正式通过，完成 4 个数据库 store、类型系统、profileService/tagService、5 个同步适配器（新闻/研报/公告/社区/本地文档）、评分报告自动归档等全部基础设施
  - version: v1.0.0
    changes: Initial version proposed
date: 2026-07-19
---

# ADR-010: 八域资料体系与评分证据链架构

> **决策状态**: Accepted  
> **决策日期**: 2026-07-19  
> **Version**: v1.1.0（2026-07-21 架构正式通过，全部基础设施落地）

---

## 1. 背景与问题（Context）

### 1.1 问题陈述

V9 系统的原始数据按**采集维度**（`01_basic` ~ `07_index`，见 `src/config/dataDimensions.ts`）组织进 50+ 个 IndexedDB Store，而 V6 评分模型按**11 个评分层级**（`lMinus1` ~ `l8`，见 `src/services/scoring/v6-engine/`）消费数据。两套组织方式之间存在结构性断层：

```
采集维度（面向"数据怎么来"）── 50+ Store ── ✗ 断层 ✗ ── V6 评分层（面向"评分怎么用"）
```

断层带来三个彼此强关联的具体问题：

**问题一：评分黑箱，结论不可解释**
- V6 引擎输出一个综合分和 11 个层级分，但每一层"为什么这么打分"没有持久化记录——证据散落在各业务 Store 中，评分完成后即丢失上下文
- 用户看到"L1 护城河 7.5 分"时，无法回答"是哪些资料、哪些数据支撑了这个分数"
- 两次评分之间分数变化时，无法回溯"是什么新证据导致了变化"

**问题二：研究资料分散，无法形成个股全景**
- 新闻在 `news` Store、本地研报在 `local_docs` Store、公告/社区帖散落在采集链路各处，没有"这只股票的所有研究资料"的统一视图
- 同一篇资料可能被多个采集入口重复收录，缺乏去重机制
- 研究员无法按研究主题（行业/基本面/财务/估值……）浏览资料，研究过程与系统数据脱节

**问题三：分析结论无法沉淀复用**
- LLM 分析编排器（`analysisOrchestrator`）每次分析都从原始数据重新出发，不利用历史研究积累
- 评分报告（`score_docs`）生成后即静态归档，其中的分层推理没有反哺为可检索的证据
- 研究迭代缺乏"资料 → 证据 → 评分 → 再研究"的闭环

### 1.2 决策驱动因素

- **可解释性优先**：评分系统的可信度取决于"每个分数都能给出证据"，证据必须是一等公民、可持久化、可查询
- **不重复存储**：原始数据仍归原 Store 所有，资料体系只建立索引与元数据，避免 50+ Store 的数据被二次拷贝
- **渐进式落地**：不改动 V6 引擎的评分算法本身，证据链以"旁路构建"方式接入，引擎可选择性消费
- **与研究习惯对齐**：域的划分必须对应投研人员的实际工作分类（行业/政策/基本面/竞品/财务/估值/成长/市场），而不是技术分类

### 1.3 前置决策与约束

- ADR-003（DataBridge 统一写入入口）：所有新 Store 的读写必须经 `DataBridge.forward()` + `StandardEnvelope`，禁止直接操作 `dataLayer` / `db`
- ADR-002（IndexedDB over localStorage）：新增 4 个 Store 落 IndexedDB，DB 版本 v31 → v32
- V9 分层规则（AGENTS.md §一）：服务层（`services/profile/`）封装全部写入逻辑，页面/Store 层不直接触碰数据层

---

## 2. 决策（Decision）

**采纳方案 A：新增独立的"八域资料体系"（Profile Layer）+ 评分证据链（Evidence Chain）**

在既有 50+ 业务 Store 之上新增一个**资料层**：4 个新 Store + 一套类型系统 + 一组同步适配器 + 证据链服务。原始数据 Store 保持不动，资料层通过适配器以"元数据 + 引用"方式增量构建。

### 2.1 核心设计

#### 2.1.1 八域定义（D1-D8）

将全部研究资料划分为八个研究域，每域对应 V6 评分模型的一个或多个层级。域元数据在代码中以 `DOMAIN_META` 常量（`src/data/types/types.profile.ts`）固化：

| 域 | 名称 | 对应 V6 评分层 | 覆盖内容 | 颜色/图标 |
|----|------|---------------|----------|-----------|
| D1 | 行业产业 | L-1 行业评分 / L0 宏观环境 | 行业景气度、产业链、竞争格局、市场规模 | `#3b82f6` 🏭 |
| D2 | 政策监管 | L0 宏观环境 | 政策法规、监管动态、行业标准 | `#8b5cf6` 📋 |
| D3 | 公司基本面 | L1 护城河 | 商业模式、护城河、主营业务、产能扩张 | `#10b981` 🏢 |
| D4 | 竞争对比 | L2 竞品格局 | 竞品分析、市场份额、行业排名、龙头优势 | `#f59e0b` ⚔️ |
| D5 | 财务分析 | L3f 财务健康 | 财务报表、ROE、现金流、杜邦分析、分红 | `#06b6d4` 📊 |
| D6 | 估值定价 | L3v 估值水平 | PE/PB、目标价、评级、估值分位、一致预期 | `#ef4444` 💰 |
| D7 | 成长前沿 | L4 第二曲线 / L5 情景推演 / L6 业绩兑现 | 第二曲线、新业务、情景推演、业绩兑现、Hype 周期 | `#ec4899` 🚀 |
| D8 | 市场信号 | L7 筹码博弈 / L8 技术面 | 筹码博弈、技术面、资金流向、龙虎榜、量价 | `#6366f1` 📈 |

> **域即索引**：域不是物理分区，而是 `profile_items` 上 `domain` 字段的枚举值（`'D1' | 'D2' | ... | 'D8'`）。一条资料只属于一个域，但可通过 `relatedLayers` 关联多个评分层；`domainToLayers()` / `layerToDomain()`（`profileService.ts`）提供域与层的双向换算。

#### 2.1.2 统一资料条目（ProfileItem）

所有类型的资料（新闻/研报/公告/社区帖/本地文档/评分报告/研究笔记）统一抽象为 `ProfileItem`，关键设计点：

```typescript
interface ProfileItem {
  id: string                    // 主键，格式：{symbol}_{domain}_{itemType}_{dataHash}
  symbol: string                // 股票代码
  domain: ProfileDomain         // 所属域（D1-D8）
  itemType: ProfileItemType     // 资料类型（16 种枚举，见设计文档）
  title: string                 // 标题
  summary: string               // 摘要/内容预览
  content?: string              // 完整内容（可选；原始内容仍归原 Store）
  source: string                // 来源（如"东方财富"、"中信证券"、"雪球"）
  sourceUrl?: string            // 原始 URL
  publishedAt: number           // 发布时间戳（ms）
  collectedAt: number           // 收录时间戳（ms）
  sentiment: SentimentLabel     // 情绪标签（positive/neutral/negative）
  qualityScore?: number         // 质量评分（0-100）
  evidenceWeight?: number       // 证据权重（0-1），在对应层中的贡献度
  relatedLayers: ScoreLayerId[] // 关联的评分层（可多层）
  topicTags?: string[]          // 主题标签（自动+手动）
  dataHash: number              // 去重哈希（FNV-1a 32 位，基于 title+summary）
  originalStore?: string        // 原始数据所在 Store（如 news / local_docs）
  originalKey?: string          // 原始数据 key
  isUserGenerated?: boolean     // 是否用户生成内容
  // ……完整字段见 types.profile.ts 与设计文档 §2.2
}
```

#### 2.1.3 评分证据链

V6 每一层的得分由一组 `ScoreEvidence` 支撑，证据持久化到 `score_evidence` Store，形成可回溯的证据链：

```
V6 层级得分（如 L1 护城河 7.5 分）
  └─ evidence[]（score_evidence）
     ├─ 资料条目型证据（evidenceType: 'profile_item'）→ 关联 profile_items 中的研报/公告/帖子，weight: 0.4
     ├─ 衍生指标型证据（evidenceType: 'derived_metric'）→ 关联衍生指标（metricKey/metricValue），weight: 0.3
     └─ 专家判断型证据（evidenceType: 'expert_judgment'）→ 人工/LLM 判断记录，weight: 0.3
```

每条证据携带 `weight`（层内贡献占比）、`confidence`（置信度）、`sentiment`（对评分的方向影响）与 `scoreVersion`（对应评分版本号），配合 `clearOldVersionEvidence()`（默认保留最近 3 个版本）实现证据的版本化演进。

### 2.2 数据模型（4 个 Store）

DB 版本 v31 → v32 新增 4 个 Store（schema 定义见 `src/data/db-schema.ts`，命名常量见 `src/config/dbConfig.ts` 的 `STORE_NAME`）：

| Store（snake_case） | STORE_NAME 常量 | keyPath | 承载类型 | 职责 |
|---------------------|----------------|---------|---------|------|
| `profile_items` | `profileItems` | `id` | ProfileItem | 全部资料条目的统一归集 |
| `score_evidence` | `scoreEvidence` | `id` | ScoreEvidence | 评分证据链（按层/按资料/按股票可查） |
| `stock_profiles` | `stockProfiles` | `symbol` | StockProfile | 每股票一个资料包元数据（域统计/证据覆盖率） |
| `profile_tags` | `profileTags` | `id` | ProfileTag | 全局标签库（层级结构 + 使用统计） |

> **不重复存储**：4 个新 Store 保存的是**元数据与引用**（`originalStore`/`originalKey`/`sourceUrl`），原始正文仍在原业务 Store（`news`、`local_docs`、`financial_reports` 等）。资料体系是"索引层"而非"拷贝层"。

### 2.3 数据流与同步策略

#### 写入路径（采集 → 资料层）
- 采集维度（`01_basic` ~ `07_index`）的原始数据照常写入原 Store，**采集链路零改动**
- 5 个同步适配器（新闻/研报/公告/社区/本地文档）将原始数据转换为 ProfileItem 后，经 `bulkSaveProfileItems()` 统一写入：
  - `newsSyncService`：`news` → profile_items（`itemType='news'`），关键词投票分域，默认 D7
  - `researchReportSyncService`：券商研报 → profile_items（`itemType='research_report'`），默认 D3，评级映射情绪与证据权重
  - `noticeSyncService`：公告 → profile_items（`itemType='notice'`），按标题关键词分到 D3/D5/D7/D8
  - `communitySyncService`：社区帖 → profile_items（`itemType='community_post'`），默认 D8，严格质量门槛（≥40）
  - `localDocSyncService`：`local_docs` → profile_items，按文档类别映射域与类型（研报→D7、财报→D5、行业分析→D1 等）
- 所有写入经 `DataBridge.forward()` + `ENVELOPE_ACTION`（v32 新增 `SAVE_PROFILE_ITEM` / `BULK_SAVE_PROFILE_ITEMS` / `DELETE_PROFILE_ITEM` / `SAVE_SCORE_EVIDENCE` / `BULK_SAVE_SCORE_EVIDENCE` / `DELETE_SCORE_EVIDENCE` / `SAVE_STOCK_PROFILE` / `SAVE_PROFILE_TAG` / `DELETE_PROFILE_TAG`），受 ACL_MATRIX 管控

#### 评分报告反哺路径
- `scoreDocArchiveService` 监听评分报告生成（`onScoreDocGenerated`），将每个 ScoreDocVersion 自动归档为：1 条综合评分报告（D5）+ N 条分层评分详情（按层映射到对应域）+ 1 条版本差异（与上一版本对比）
- `scoreEvidenceService` 提供证据 CRUD、按层/按资料/按股票查询、证据覆盖率计算与 `autoBuildAllEvidence()` 自动证据链构建

#### 分析编排集成路径
- `profileIntegrationService.gatherProfileSummary(symbol)`：分析前从 profile_items 按质量分 × 证据权重取 Top 10 资料 + 每层 Top 3 证据，注入 LLM 上下文；资料缺失时降级返回空摘要，不阻塞主流程
- `profileIntegrationService.archiveAnalysisToProfile(result)`：分析后将结论异步归档为 D7 域 `analysis_note` 型资料，非阻塞

### 2.4 决策理由

**Why not B（直接在 V6 引擎内部硬编码证据逻辑）**
- 引擎与资料的耦合会让证据格式随算法演进反复变更，且无法承载"评分之外"的研究资料（笔记、社区帖）
- 证据只能在评分瞬间存在，无法支持"先积累资料、后触发评分"的研究工作流

**Why not C（改造既有 Store，在其上直接加 domain/evidence 字段）**
- 50+ Store 的 schema 各自为政，逐一改造迁移成本高、风险大
- 同一资料多源收录（同一篇新闻可能同时进 `news` 和 `local_docs`）时无法统一去重

**Why A（独立资料层 + 同步适配器）**
- ✅ 原始 Store 零改动，采集链路零侵入，每步可独立回滚
- ✅ 统一去重（`dataHash` FNV-1a 基于 title+summary，批量保存时自动跳过重复）
- ✅ 证据链与 V6 引擎解耦：引擎可读证据，证据也可由适配器/人工独立构建
- ✅ 八域划分对齐研究员工作分类，支撑资料浏览页（`/output/profile`）的直接落地
- ✅ 评分报告、分析结论自动归档，形成"资料 → 证据 → 评分 → 再研究"闭环

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| **A. 独立资料层（八域 + 证据链）** | 新增 4 个 Store + 同步适配器，原始 Store 不动 | 零侵入、可回滚、统一去重、证据可独立演进 | 元数据与原数据双写，需适配器维护一致性 | ✅ 采纳 |
| **B. 引擎内嵌证据** | V6 calculator 内部直接记录证据 | 实现最快、无新 Store | 引擎与资料强耦合；评分之外的研究资料无处安放 | ❌ 否决 |
| **C. 改造既有 Store** | 给 `news`/`local_docs` 等 Store 加 `domain`/`evidence` 字段 | 无新 Store | 50+ Store schema 迁移高风险；多源重复无法统一去重 | ❌ 否决 |
| **D. 纯文件系统资料库** | 研究资料全部落本地文件（Markdown 目录树） | 人类可读、可 Git 管理 | 无索引、查询能力弱；与 IndexedDB 真相源产生双向同步难题 | ❌ 否决（文件映射降为 P3 远期规划，见 V9-DOC-DATA-031 文件系统映射规范） |

---

## 4. 影响与后果（Consequences）

### 4.1 正面影响

- **评分可解释**：每个层级得分可下钻到具体证据条目（资料/指标/判断），评分黑箱变为"证据链白盒"
- **研究全景视图**：八域导航 + 多维筛选 + 详情抽屉 + 证据可视化（`ProfileBrowsePage`，路由 `/output/profile`）
- **数据资产复用**：LLM 分析自动携带历史研究上下文（`gatherProfileSummary`），分析质量随资料积累递增
- **闭环沉淀**：评分报告与分析结论自动归档回资料体系，研究迭代产生复利
- **去重与质量管控**：`dataHash` 去重 + `minQuality` 门槛 + 自动打标（`tagService`），资料库保持高信噪比

### 4.2 负面影响 / 技术债

- **元数据双写一致性**：原始 Store 更新/删除后，profile_items 中的引用可能滞后
  - **缓解**：资料条目只存元数据与引用，内容读取走 `originalStore` 回源；展示层容忍引用失效
  - **跟踪**：tech-debt.md 记录"profile_items 与原 Store 的一致性对账"待办
- **DB 容量增长**：每股票约 200-500 条资料条目（约 100-250KB），100 只股票约 25MB
  - **缓解**：IndexedDB 容量充裕（>500MB）；`clearOldVersionEvidence()` 限制证据版本数
- **自动分域准确率**：关键词投票分域存在误判（新闻默认落 D7）
  - **缓解**：研报/公告/社区使用专用分类器 + 质量门槛；误判条目可由用户改域，不改原始数据
- **衍生指标引擎未随主干落地**：`ScoreEvidence` 已预留 `metricKey`/`metricValue` 扩展点，设计见 V9-DOC-DATA-030，但 `src/services/derived-metrics/derivedMetricsEngine` 当前未在主干代码库落地（e2e 脚本仍引用该路径）
  - **跟踪**：列入 P2 待办，落地前 `derived_metric` 型证据可由 `scoreEvidenceService` 手工/脚本写入

### 4.3 影响的模块

| 模块 | 变更类型 | 说明 |
|------|---------|------|
| `src/config/dbConfig.ts` | 修改 | 新增 STORE_NAME / ENVELOPE_ACTION（9 个 action）/ ACL_MATRIX |
| `src/data/db-schema.ts` | 修改 | 新增 4 个 Store 的 schema 与索引 |
| `src/data/db-connection.ts` / 迁移 | 修改 | DB 版本 v31 → v32 |
| `src/data/types/types.profile.ts` | 新增 | ProfileItem / ScoreEvidence / StockProfile / ProfileTag 等 15+ 类型 |
| `src/services/profile/` | 新增 | profileService / tagService / scoreEvidenceService + 5 同步适配器 + scoreDocArchiveService |
| `src/services/analysis/profileIntegrationService.ts` | 新增 | 分析前上下文注入 + 分析后结论归档 |
| `src/store/profileStore.ts` | 新增 | 资料浏览页状态管理（Zustand） |
| `src/pages/output/ProfileBrowsePage.tsx` | 新增 | 八域资料浏览页（路由 `/output/profile`） |
| `scripts/test/` | 新增 | profile-e2e / profile-full-e2e / profile-4source-e2e / profile-orchestrator-e2e |

---

## 5. 实施与验证（Implementation & Validation）

### 5.1 实施步骤 checklist

**Phase 1：数据基础设施（P0，已完成）**
- [x] Step 1.1：`dbConfig.ts` 新增 STORE_NAME / ENVELOPE_ACTION / ACL_MATRIX
- [x] Step 1.2：`db-schema.ts` 新增 4 个 Store 的 schema 与索引
- [x] Step 1.3：DB 版本 v31 → v32
- [x] Step 1.4：DataBridge 写路径接通（`sendWriteEnvelope` 封装于 `dataLayerHelpers`）
- [x] Step 1.5：TypeScript 类型系统（`src/data/types/types.profile.ts`）

**Phase 2：服务层与同步适配器（P1，已完成）**
- [x] Step 2.1：`profileService`（CRUD + 查询 + 去重 + 统计 + 域层换算）
- [x] Step 2.2：`scoreEvidenceService`（证据 CRUD + 覆盖率 + 自动证据链构建）
- [x] Step 2.3：`tagService`（自动打标 + 全局标签库）
- [x] Step 2.4：5 个同步适配器（news / researchReport / notice / community / localDoc）
- [x] Step 2.5：`scoreDocArchiveService`（评分报告自动归档：综合 + 分层 + 版本差异）

**Phase 3：证据链可视化与集成（P1，已完成 MVP）**
- [x] Step 3.1：`profileStore` + `ProfileBrowsePage`（八域导航 / 筛选 / 详情抽屉 / 证据链视图）
- [x] Step 3.2：`profileIntegrationService`（分析前注入上下文、分析后归档）
- [x] Step 3.3：4 个端到端测试脚本（profile-e2e / full-e2e / 4source-e2e / orchestrator-e2e）

**Phase 4：增强（P2，进行中/待办）**
- [ ] Step 4.1：衍生指标引擎落地（设计完成，见 V9-DOC-DATA-030；`src/services/derived-metrics/` 待随主干落地）
- [ ] Step 4.2：V6 calculator 消费 score_evidence 作为层分输入（当前为旁路构建）
- [ ] Step 4.3：文件系统映射（DB → 本地 Markdown 目录树，见 V9-DOC-DATA-031）

### 5.2 验证命令

```bash
# 类型安全
npx tsc --noEmit

# 分层架构审计
npm run audit:layers

# DB 引用一致性
npm run audit:db-references

# ACL 一致性
npm run audit:acl-consistency

# 文档-代码版本漂移
npm exec -- tsx scripts/audit/audit-version-drift.ts
```

### 5.3 回滚策略

**触发条件（任一）**：
- 新 Store 写入失败率 > 5% 或导致 DataBridge 主链路异常
- 同步适配器误判率过高（人工抽检准确率 < 70%）
- v32 迁移在真实数据上失败

**回滚步骤**：
1. 停用 5 个同步适配器与 scoreDocArchiveService 的调用入口（适配器均为旁路调用，停用不影响采集主链路）
2. 移除 `dbConfig.ts` 中新增的 STORE_NAME / ENVELOPE_ACTION / ACL_MATRIX 条目
3. DB 版本回退 v32 → v31（4 个新 Store 为新增，旧版本打开时自动忽略多余 Store）
4. 执行 `tsc` + `audit:layers` 验证

---

## 6. 相关文档（Related Documents）

| 文档 | doc_id | 路径 | 关系 |
|------|--------|------|------|
| 八域资料体系设计 | V9-DOC-DATA-029 | `../explanation/design/profile-eight-domains-design.md` | 本 ADR 的详细设计展开 |
| 衍生指标引擎设计 | V9-DOC-DATA-030 | `../explanation/design/derived-metrics-engine-design.md` | `derived_metric` 型证据的计算来源 |
| 文件系统映射规范 | V9-DOC-DATA-031 | `../explanation/design/filesystem-mapping-spec.md` | 资料体系的本地文件镜像（P3 规划） |
| ADR-003: DataBridge | V9-DOC-DATA-013 | `./adr-003-databridge-over-direct-datalayer.md` | 写入路径的前置约束 |
| V9 IndexedDB Store Schema | V9-DOC-DATA-031 | `explanation/design/v9-indexeddb-store-schema.md` | Store 注册规范 |
| V6 评分引擎规格 | V9-DOC-BACK-001 | `reference/05-engine-specs.md` | 11 层评分模型定义 |

---

## 7. 状态日志（Status Log）

| 日期 | 状态 | 决策人 | 备注 |
|------|------|--------|------|
| 2026-07-19 | proposed | @architect | 初版提案，解决"评分黑箱 + 资料分散 + 结论不沉淀"三大问题 |
| 2026-07-21 | accepted | @architect | 架构正式通过；4 Store / 类型系统 / profileService / tagService / 5 适配器 / 评分报告归档全部落地（v1.1.0） |

---
