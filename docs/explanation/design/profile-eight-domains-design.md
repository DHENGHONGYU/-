---
title: 八域资料体系设计（D1-D8）
type: explanation
domain: data
phase: design
tier: secondary
status: stable
maintainer: V9 Architecture Team
summary: "八域资料体系设计：D1-D8 八个研究域对应 V6 评分模型 11 层，4 个核心数据 Store（profile_items/score_evidence/stock_profiles/profile_tags），5 个同步适配器，形成完整的资料归集与证据链体系。"
tags: [data, profile, design, explanation, evidence-chain]
version: v1.1.0
last_updated: 2026-07-21
code_version: 2.0.0
doc_id: V9-DOC-DATA-029
related_docs: [V9-DOC-DATA-028]
change_log:
  - version: v1.1.0
    changes: 设计正式发布，完成全部基础设施与同步适配器实现
  - version: v1.0.0
    changes: Initial draft version
date: 2026-07-19
---

# 八域资料体系设计（D1-D8）

> **文档版本**: v1.1.0  
> **状态**: Stable（全部基础设施已落地）  
> **创建日期**: 2026-07-19  
> **架构决策**: [ADR-010: 八域资料体系与评分证据链架构](../../reference/adr-010-profile-evidence-chain.md)

---

## 1. 设计目标

### 1.1 核心目标

1. **资料统一归集**：将分散在 `news`、`local_docs`、采集链路各处的资讯/研报/公告/社区帖/评分报告，统一归集到 D1-D8 八个研究域，形成"这只股票的全部研究资料"单一视图
2. **评分证据链**：将 V6 评分从"黑箱输出"变为"证据链白盒"——每个层级得分可下钻到具体的资料条目、衍生指标与专家判断
3. **不重复存储**：原始数据仍归原 Store 所有，资料体系只保存元数据与引用（`originalStore`/`originalKey`），避免 50+ Store 的数据二次拷贝
4. **研究闭环**：评分报告与分析结论自动归档回资料体系，形成"资料 → 证据 → 评分 → 再研究"的迭代闭环
5. **LLM 上下文供给**：分析编排器在分析前自动收集高质量资料摘要注入 LLM 上下文，分析质量随资料积累递增

### 1.2 设计原则

- **旁路构建，零侵入**：采集链路（`01_basic` ~ `07_index` 七维）与 V6 评分算法均不改动，资料层以同步适配器方式增量构建
- **去重内建**：所有批量写入基于 `dataHash`（FNV-1a 32 位，由 `title + summary` 计算）自动去重，多源收录同一资料不产生重复条目
- **质量门槛**：每个适配器有独立的质量分门槛（如研报 ≥50、社区帖 ≥40），低质量资料不进入资料库
- **降级友好**：资料数据缺失时分析主流程不阻塞（`gatherProfileSummary` 返回空摘要），归档操作异步非阻塞
- **类型先行**：全部数据结构在 `src/data/types/types.profile.ts` 中定义 Interface（15+ 类型），本文档类型表与该文件逐字段一致

---

## 2. 八域定义与 V6 映射

### 2.1 八域 ↔ V6 评分层映射

V6 评分模型共 11 层（`ScoreLayerId`：`lMinus1` / `l0` / `l1` / `l2` / `l3f` / `l3v` / `l4` / `l5` / `l6` / `l7` / `l8`）。八域与层的映射关系固化为 `DOMAIN_META` 常量（`src/data/types/types.profile.ts`）：

| 域 | 名称 | 覆盖内容 | 对应 V6 评分层 | 颜色 / 图标 |
|----|------|----------|---------------|-------------|
| D1 | 行业产业 | 行业景气度、产业链、竞争格局、市场规模 | L-1 行业评分（`lMinus1`）/ L0 宏观环境（`l0`） | `#3b82f6` 🏭 |
| D2 | 政策监管 | 政策法规、监管动态、行业标准 | L0 宏观环境（`l0`） | `#8b5cf6` 📋 |
| D3 | 公司基本面 | 商业模式、护城河、主营业务、产能扩张 | L1 护城河（`l1`） | `#10b981` 🏢 |
| D4 | 竞争对比 | 竞品分析、市场份额、行业排名、龙头优势 | L2 竞品格局（`l2`） | `#f59e0b` ⚔️ |
| D5 | 财务分析 | 财务报表、ROE、现金流、杜邦分析、分红 | L3f 财务健康（`l3f`，层标签中亦称 L3a） | `#06b6d4` 📊 |
| D6 | 估值定价 | PE/PB、目标价、评级、估值分位、一致预期 | L3v 估值水平（`l3v`） | `#ef4444` 💰 |
| D7 | 成长前沿 | 第二曲线、新业务、情景推演、业绩兑现、Hype 周期 | L4 第二曲线（`l4`）/ L5 情景推演（`l5`）/ L6 业绩兑现（`l6`） | `#ec4899` 🚀 |
| D8 | 市场信号 | 筹码博弈、技术面、资金流向、龙虎榜、量价 | L7 筹码博弈（`l7`）/ L8 技术面（`l8`） | `#6366f1` 📈 |

换算函数（`profileService.ts`）：
- `domainToLayers(domain)`：域 → 评分层数组（依据 `DOMAIN_META`）
- `layerToDomain(layer)`：评分层 → 归属域

> 一条资料只归属一个域（`domain` 字段），但可通过 `relatedLayers` 关联多个评分层；保存资料时若 `relatedLayers` 缺失，由 `saveProfileItem` 依据 `domain` 自动推导补齐。

### 2.2 原始 Store → profile_items 映射

| 原始数据来源 | 同步适配器 | 目标域 | itemType | 说明 |
|-------------|-----------|--------|----------|------|
| `news` Store | `newsSyncService` | 关键词投票分域，默认 D7 | `news` | 标题命中关键词权重加倍 |
| 券商研报（东财 API / LLM 搜索 / Tushare） | `researchReportSyncService` | 默认 D3（公司基本面） | `research_report` | 评级映射情绪与证据权重；头部券商权重加成 |
| 公司公告 | `noticeSyncService` | D3 / D5 / D7 / D8（按标题关键词） | `notice` | 一手权威信息，质量分基数 80-90 |
| 社区帖（雪球/股吧/知乎等） | `communitySyncService` | 默认 D8（关联 `l7`/`l8`） | `community_post` | 严格质量门槛（≥40），来源权重校准 |
| `local_docs` Store | `localDocSyncService` | 研报→D7 / 财报→D5 / 行业分析→D1 / 其他→D8 | `research_report` / `financial_report` / `industry_report` / `news` / `note` / `other` | 策略笔记按内容关键词动态分域 |
| `score_docs`（V6 评分报告） | `scoreDocArchiveService` | 综合报告→D5；分层详情按层映射 | `score_report` / `score_layer` / `score_diff` | 生成后自动归档（见 §4.4） |
| 分析编排器结论 | `profileIntegrationService` | D7（成长前沿） | `analysis_note` | 分析后异步归档（见 §8） |

### 2.3 采集维度 → 域映射（资料来源视角）

采集维度（`src/config/dataDimensions.ts`，七维）为资料体系提供原始素材：

| 采集维度 | 名称 | 主要供给域 | 说明 |
|---------|------|-----------|------|
| 01_basic | 基本信息 | D3 公司基本面 | 公司资料/行业/股本/股东户数/千股千评 |
| 02_kline | K线数据 | D6 估值定价 / D8 市场信号 | 日/周/月线 OHLCV + 均线 + 技术指标 |
| 03_chip | 筹码分布 | D8 市场信号 | 股东户数趋势/主力成本/机构参与度 |
| 04_events | 重大事项 | D3 / D5 / D7 | 公告/财报/业绩快报/分红送转/限售解禁 |
| 05_news | 热点新闻 | D1 / D2 / D7 / D8 | 个股新闻标题+摘要+链接/热搜/龙虎榜 |
| 06_industry | 行业竞品 | D1 行业产业 / D4 竞争对比 | 行业成分股/估值排名/资金流向/ETF 规模 |
| 07_index | 关联指数 | D8 市场信号 | Pearson/Beta/Alpha/R²/ETF 规模 |
| 09_community* | 社区精选 | D1 / D7 / D8 | LLM 联网搜索（雪球深度长文/大V观点）+ 股吧爬虫 |

> *09_community 为扩展维度，不在 `dataDimensions.ts` 七维注册表内，由 `communitySyncService` 直接对接 LLM 搜索与股吧爬虫数据源。

---

## 3. 数据模型详解

DB 版本 v32 新增 4 个 Store，schema 定义见 `src/data/db-schema.ts`，类型定义见 `src/data/types/types.profile.ts`。以下类型表与代码逐字段一致。

### 3.1 ProfileItem（资料条目，核心表）

> **Store**: `profile_items`（`STORE_NAME.profileItems`）  
> **KeyPath**: `id`  
> **索引**: `by-symbol`（symbol）、`by-symbol-domain-quality`（[symbol, domain, qualityScore]）、`by-symbol-type`（[symbol, itemType]）、`by-hash`（dataHash，去重查询）、`by-published-at`（publishedAt）、`by-source`（source）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 主键，格式：`{symbol}_{domain}_{itemType}_{dataHash}`（`makeProfileItemId` 生成） |
| `symbol` | `string` | ✅ | 股票代码 |
| `domain` | `ProfileDomain` | ✅ | 所属域：`'D1'` ~ `'D8'` |
| `itemType` | `ProfileItemType` | ✅ | 资料类型（16 种枚举，见下） |
| `subType` | `string?` | | 子类型（如研报子类型、公告子类型） |
| `title` | `string` | ✅ | 标题 |
| `summary` | `string` | ✅ | 摘要/内容预览 |
| `content` | `string?` | | 完整内容（Markdown 或纯文本；原始正文一般仍归原 Store） |
| `author` | `string?` | | 作者/分析师 |
| `source` | `string` | ✅ | 来源（如"东方财富"、"中信证券"、"雪球"） |
| `sourceUrl` | `string?` | | 原始 URL |
| `publishedAt` | `number` | ✅ | 发布时间戳（ms） |
| `collectedAt` | `number` | ✅ | 收录时间戳（ms），保存时自动补齐 |
| `sentiment` | `SentimentLabel` | ✅ | 情绪标签：`'positive'` / `'neutral'` / `'negative'`（默认 neutral） |
| `sentimentConfidence` | `number?` | | 情绪置信度（0-1） |
| `qualityScore` | `number?` | | 质量评分（0-100） |
| `dataQuality` | `DataQuality?` | | 数据质量等级：`'low'` / `'medium'` / `'high'` |
| `evidenceWeight` | `number?` | | 证据权重（0-1），在对应层中的证据贡献度 |
| `relatedLayers` | `ScoreLayerId[]` | ✅ | 关联的评分层（可多层），缺失时按 domain 推导 |
| `topicTags` | `string[]?` | | 主题标签（自动+手动） |
| `riskTags` | `string[]?` | | 风险标签 |
| `catalystTags` | `string[]?` | | 催化标签 |
| `customTags` | `string[]?` | | 自定义标签 |
| `dataHash` | `number` | ✅ | 去重哈希：FNV-1a 32 位，由 `title + summary`（trim + 小写）计算（`computeDataHash`） |
| `sourceId` | `string?` | | 原始数据 ID（如 newsId、postId、docId） |
| `originalStore` | `string?` | | 原始数据所在 Store（如 `news` / `local_docs`） |
| `originalKey` | `string?` | | 原始数据 key |
| `isUserGenerated` | `boolean?` | | 是否用户生成内容 |
| `crossReferences` | `ProfileCrossReference[]?` | | 交叉引用（见下） |
| `viewCount` | `number?` | | 阅读/浏览次数 |
| `isBookmarked` | `boolean?` | | 是否收藏 |
| `evidenceIds` | `string[]?` | | 关联的证据 ID（反向引用） |
| `keyPoints` | `string[]?` | | 关键点/要点列表 |
| `schemaVersion` | `number?` | | Schema 版本 |
| `version` | `number?` | | 资料版本号（内容更新时递增） |

**ProfileItemType（16 种）**：

| 值 | 含义 | | 值 | 含义 |
|----|------|---|----|------|
| `news` | 新闻资讯 | | `score_doc` | 评分文档 |
| `research_report` | 券商研报 | | `score_report` | 评分综合报告 |
| `notice` | 公司公告 | | `score_layer` | 评分分层报告 |
| `community_post` | 社区帖子 | | `score_diff` | 评分版本差异 |
| `community` | 社区帖子（兼容旧命名） | | `derived_metric` | 衍生指标 |
| `local_doc` | 本地文档 | | `analysis_note` | 研究笔记 |
| `financial_report` | 财务报告 | | `note` | 笔记（兼容旧命名） |
| `industry_report` | 行业报告 | | `other` | 其他 |

**ProfileCrossReference（交叉引用）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `targetId` | `string` | 目标资料 ID |
| `targetType` | `ProfileItemType` | 目标资料类型 |
| `relation` | `'part_of' \| 'references' \| 'compares' \| 'supports' \| 'contradicts'` | 关系类型 |
| `description` | `string?` | 关系描述 |

### 3.2 ScoreEvidence（评分证据）

> **Store**: `score_evidence`（`STORE_NAME.scoreEvidence`）  
> **KeyPath**: `id`  
> **索引**: `by-symbol`（symbol）、`by-symbol-layer`（[symbol, layer]）、`by-profile-item`（profileItemId）、`by-weight`（weight）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 主键，格式：`{symbol}_{layer}_{type}_{hash}` |
| `symbol` | `string` | ✅ | 股票代码 |
| `layer` | `ScoreLayerId` | ✅ | 评分层（11 层之一） |
| `evidenceType` | `EvidenceType` | ✅ | 证据类型（见下） |
| `title` | `string` | ✅ | 证据标题 |
| `description` | `string` | ✅ | 证据描述/推理过程 |
| `weight` | `number` | ✅ | 证据权重（0-1），在该层中的贡献占比 |
| `confidence` | `number` | ✅ | 置信度（0-1） |
| `sentiment` | `SentimentLabel` | ✅ | 对评分的影响方向 |
| `profileItemId` | `string?` | | 关联的资料条目 ID（`profile_item` 型证据） |
| `metricKey` | `string?` | | 关联的衍生指标 key（`derived_metric` 型证据） |
| `metricValue` | `number?` | | 关联的衍生指标值 |
| `source` | `string` | ✅ | 来源描述 |
| `createdAt` | `number` | ✅ | 创建时间戳（ms） |
| `scoreVersion` | `number?` | | 评分版本号（对应 `score_docs` 的 version） |

**EvidenceType（3 种）**：
- `profile_item`：资料条目型证据（关联 `profile_items` 中的研报/公告/帖子）
- `derived_metric`：衍生指标型证据（关联衍生指标，预留 `metricKey`/`metricValue` 扩展点）
- `expert_judgment`：专家判断型证据（人工/LLM 判断记录）

**ScoreLayerId（11 层）**：`lMinus1`（L-1 行业评分）、`l0`（L0 宏观环境）、`l1`（L1 护城河）、`l2`（L2 竞品格局）、`l3f`（L3f 财务健康）、`l3v`（L3v 估值水平）、`l4`（L4 第二曲线）、`l5`（L5 情景推演）、`l6`（L6 业绩兑现）、`l7`（L7 筹码博弈）、`l8`（L8 技术面）。

### 3.3 StockProfile（股票资料包元数据）

> **Store**: `stock_profiles`（`STORE_NAME.stockProfiles`）  
> **KeyPath**: `symbol`  
> **索引**: `by-updated-at`（lastUpdatedAt）、`by-coverage`（evidenceCoverage）

每只股票一个资料包，记录资料的整体统计信息与状态（`updateProfileStats` 自动重算）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | `string` | 股票代码（主键） |
| `stockName` | `string` | 股票名称 |
| `totalItems` | `number` | 资料总数 |
| `domainCounts` | `Record<ProfileDomain, number>` | 各域资料数量 |
| `typeCounts` | `Record<string, number>` | 各类型资料数量 |
| `totalEvidence` | `number` | 证据总数 |
| `layerEvidenceCounts` | `Record<ScoreLayerId, number>` | 各层证据数量 |
| `evidenceCoverage` | `number` | 证据覆盖率（0-1）= 有证据的层数 / 总层数 |
| `lastUpdatedAt` | `number` | 最后更新时间戳（ms） |
| `lastSyncSources` | `string[]` | 最后同步的资料来源 |
| `avgQualityScore` | `number?` | 质量平均分（0-100） |
| `notes` | `string?` | 自定义备注 |

### 3.4 ProfileTag（资料标签）

> **Store**: `profile_tags`（`STORE_NAME.profileTags`）  
> **KeyPath**: `id`  
> **索引**: `by-category`（category）、`by-name`（name，**unique**）、`by-usage`（usageCount）、`by-parent`（parentId）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 标签 ID（主键） |
| `name` | `string` | 标签名称（全局唯一） |
| `category` | `TagCategory` | 标签类别（见下） |
| `parentId` | `string?` | 父标签 ID（支持层级） |
| `childrenIds` | `string[]?` | 子标签 ID 列表 |
| `description` | `string?` | 标签描述 |
| `color` | `string?` | 标签颜色 |
| `usageCount` | `number` | 使用次数 |
| `isSystem` | `boolean` | 是否系统内置标签 |
| `createdAt` | `number` | 创建时间戳（ms） |
| `lastUsedAt` | `number?` | 最后使用时间戳（ms） |

**TagCategory（5 种）**：`topic`（主题标签）、`risk`（风险标签）、`catalyst`（催化标签）、`quality`（质量标签）、`custom`（自定义标签）。

### 3.5 辅助类型

**ProfileQueryFilter（资料查询筛选条件）**：`symbol`（必填）、`domain?`、`itemType?`、`sentiment?`、`minQuality?`、`source?`、`keyword?`、`limit?`、`offset?`、`sortBy?`（`'publishedAt' | 'qualityScore' | 'collectedAt'`）、`sortOrder?`（`'asc' | 'desc'`）。

**SyncOptions（同步选项）**：`skipDuplicates?`（基于 dataHash 跳过重复，默认 true）、`minQuality?`（最低质量分阈值，默认 0）、`autoTag?`（是否自动打标，默认 true）、`triggerEvidenceBuild?`（是否触发证据链构建）。

**SyncResult（同步结果）**：`saved`（成功保存数）、`skippedDuplicates`（去重跳过数）、`skippedLowQuality`（质量过滤跳过数）、`failed`（失败数）、`failures?`（失败详情：`Array<{ title, error }>`）。

---

## 4. 同步适配器机制

### 4.1 统一写入管道

```
原始数据源（news Store / 研报 API / 公告 / 社区 / local_docs / score_docs）
    ↓
各同步适配器（转换为 ProfileItem 草稿：分域 + 定类型 + 情绪 + 质量分 + 权重）
    ↓
tagService.autoTagItem()（自动打标：主题/风险标签）
    ↓
profileService.bulkSaveProfileItems()
    ├─ 质量过滤（minQuality 门槛）→ skippedLowQuality
    ├─ dataHash 去重（by-hash 索引查重）→ skippedDuplicates
    ├─ 自动补齐：collectedAt / dataHash / id / relatedLayers / sentiment
    ↓
DataBridge（sendWriteEnvelope → BULK_SAVE_PROFILE_ITEMS → ACL 校验 → DB 写入）
    ↓
返回 SyncResult（saved / skippedDuplicates / skippedLowQuality / failed）
```

### 4.2 五个同步适配器

| 适配器 | 数据源 | 分域机制 | 质量管控 | 特色 |
|--------|--------|----------|----------|------|
| `newsSyncService` | `news` Store | `DOMAIN_KEYWORDS` 关键词投票（8 域关键词表），标题命中权重加倍，全低分默认 D7 | 继承新闻质量分 | 不侵入新闻采集流程，增量同步 |
| `researchReportSyncService` | 东财研报 API（L1）/ DeepSeek LLM 搜索（L2）/ Tushare（L3） | 默认 D3 | 门槛 ≥50 | `RATING_TO_SENTIMENT` 评级→情绪映射；`RATING_WEIGHT_FACTOR` 评级→权重系数；头部券商（`TOP_INSTITUTIONS`）权重加成 |
| `noticeSyncService` | 公司公告（NewsItem） | 标题关键词分类：财报类→D5、经营类→D3、并购/新项目→D7、停复牌/增减持/回购→D8 | 质量分基数 80-90（一手权威信息） | 分类结果直接携带关联层与默认情绪 |
| `communitySyncService` | LLM 联网搜索（雪球深度长文）/ 东财股吧爬虫 | 默认 D8，关联 `l7`/`l8` | 门槛 ≥40 | `SOURCE_QUALITY_WEIGHT` 来源权重校准（雪球 1.2 / 股吧 0.8）；`ENGAGEMENT_WEIGHT` 互动热度（阅读/评论/点赞）加权证据权重 |
| `localDocSyncService` | `local_docs` Store | `CATEGORY_TO_DOMAIN`：研报→D7 / 财报→D5 / 行业分析→D1 / 新闻→D8；策略笔记按 `STRATEGY_NOTE_KEYWORDS` 动态分域 | 复用文档元数据 | 不重复存储正文，仅建索引与元数据 |

### 4.3 dataHash 去重机制

- **算法**：FNV-1a 32 位哈希（`fnv1a32`），输入为 `${title.trim().toLowerCase()}|${summary.trim().toLowerCase()}`
- **ID 派生**：条目 ID = `{symbol}_{domain}_{itemType}_{dataHash}`，同内容条目天然幂等
- **查重**：批量保存前通过 `by-hash` 索引检查已存在条目，`skipDuplicates`（默认 true）时跳过并计入 `SyncResult.skippedDuplicates`
- **跨源去重**：同一篇资料从不同入口（如 news Store 与 LLM 搜索）进入时，标题+摘要一致即被判重

### 4.4 评分报告自动归档（scoreDocArchiveService）

每次生成新的 `ScoreDocVersion` 后（`onScoreDocGenerated` 钩子），自动归档为：

1. **1 条综合评分报告** → D5 财务分析域，`itemType='score_report'`
2. **N 条分层评分详情** → 按 `LAYER_TO_DOMAIN` 映射分布到各域，`itemType='score_layer'`：
   `l1→D3`、`l2→D4`、`l3f→D5`、`l3v→D6`、`l4/l5/l6→D7`、`l7/l8→D8`
3. **1 条版本差异**（如有上一版本）→ `itemType='score_diff'`，便于追踪评分变化

导出函数：`scoreDocToProfileItems`（转换）、`archiveScoreDocsToProfile`（批量归档）、`archiveSingleScoreDoc`（单文档归档）、`onScoreDocGenerated`（生成钩子）。

---

## 5. 标签体系与自动打标（tagService）

### 5.1 打标机制

`autoTagItem(item)` 在资料入库前执行，基于内置关键词词典：

- **主题标签**（`TOPIC_TAG_RULES`）：行业主题（新能源/人工智能/消费/医药/金融/房地产/汽车/军工）+ 投资主题（护城河/成长性/估值/业绩/政策）
- **风险标签**（`RISK_TAG_RULES`）：业绩风险/政策风险/财务风险/行业风险/技术风险
- 命中关键词 → 写入 `topicTags` / `riskTags`，同时 `incrementTagUsage` 更新标签库使用统计

### 5.2 标签库管理

- `seedSystemTags()`：初始化系统内置标签（`isSystem=true`）
- `createTag` / `deleteTag` / `findTagByName` / `listAllTags`：标签 CRUD，`by-name` 唯一索引保证不重名
- 层级结构：`parentId` / `childrenIds` 支持标签树

---

## 6. 评分证据链（scoreEvidenceService）

### 6.1 证据构建方式

| 构建方式 | 入口 | 说明 |
|---------|------|------|
| 手工/服务写入 | `saveScoreEvidence` / `bulkSaveScoreEvidence` | 单条/批量写入，自动补 ID 与 createdAt |
| 自动构建 | `autoBuildLayerEvidence(symbol, layer)` / `autoBuildAllEvidence(symbol)` | 从该层关联的高质量 profile_items 自动派生 `profile_item` 型证据 |
| 衍生指标接入 | `metricKey` / `metricValue` 字段 | `derived_metric` 型证据的扩展点（见 §7） |

### 6.2 证据链示例（L1 护城河层）

```
L1 护城河（l1）层得分
  ├─ [profile_item] 「XX 证券深度研报：护城河分析」 weight: 0.35, confidence: 0.9, sentiment: positive
  ├─ [derived_metric] 「毛利率连续 5 年 > 40%」 metricKey: 'grossMarginStability', weight: 0.25, sentiment: positive
  ├─ [profile_item] 「公司公告：核心专利授权」 weight: 0.20, confidence: 0.95, sentiment: positive
  └─ [expert_judgment] 「LLM 综合判断：品牌壁垒中等」 weight: 0.20, confidence: 0.7, sentiment: neutral
```

### 6.3 证据维护

- **查询**：`listEvidenceBySymbol` / `listEvidenceByLayer` / `listEvidenceByProfileItem` / `getEvidenceOverview`（覆盖率总览）
- **清理**：`clearEvidenceByLayer`（按层清除）、`clearAllEvidence`（按股票全清）、`clearOldVersionEvidence`（只保留最近 3 个 `scoreVersion`，默认）
- **权重校准**：`recalculateLayerWeights(symbol, layer)` 按各证据质量重新归一化层内权重

### 6.4 证据链构建原则

1. **资料优先**：`profile_item` 型证据优先于纯判断，可追溯来源的证据权重更高
2. **正负对冲**：每层同时保留 positive 与 negative 证据，分析摘要按方向分组呈现
3. **版本演进**：每次评分产生新版本证据，旧版本按保留策略清理，支持"分数为什么变了"的回溯
4. **置信度诚实**：LLM 派生证据的 `confidence` 低于一手公告/财报证据

---

## 7. 衍生指标引擎

`derived_metric` 型证据的结构化数据支撑，详细设计见 [衍生指标计算引擎设计规范（V9-DOC-DATA-030）](./derived-metrics-engine-design.md)。

### 7.1 指标体系（4 大类 20+ 指标）

| 类别 | 代表指标 | 主要供给层 |
|------|---------|-----------|
| 杜邦分析体系 | ROE 三因素分解（净利率 × 资产周转率 × 权益乘数）、ROA | D5 → `l3f` |
| 估值体系 | PE/PB/PEG、PE/PB 历史分位、行业分位、股息率、市值估值区间 | D6 → `l3v` |
| 成长质量体系 | 营收/净利增速、增收增利一致性、毛利变化、利润含金量、研发强度 | D5/D7 → `l3f`/`l4` |
| 风险预警体系 | 资产负债率、流动/速动比率、有息负债率、商誉占比、质押比例、应收-营收增速差 | D5 → `l3f`（负向证据） |

### 7.2 落地状态

- 计算结果通过 `ScoreEvidence.evidenceType='derived_metric'` + `metricKey`/`metricValue` 接入证据链，**不新增独立存储**（纯函数设计：输入 `FinancialReport` 与行情数据 → 输出指标）
- **当前状态**：设计已完成（V9-DOC-DATA-030），e2e 测试脚本（`scripts/test/profile-e2e-test.ts` 等）按 `src/services/derived-metrics/derivedMetricsEngine` 路径引用，但该模块尚未随主干代码落地，列入 P2 待办；落地前 `derived_metric` 型证据可由 `scoreEvidenceService` 手工/脚本写入

---

## 8. 分析编排集成（profileIntegrationService）

位于 `src/services/analysis/profileIntegrationService.ts`，为 `analysisOrchestrator` 提供资料体系接入，不侵入分析主管线。

### 8.1 分析前：资料摘要注入（gatherProfileSummary）

```
gatherProfileSummary(symbol)
  ├─ 查询 profile_items（by-symbol-domain-quality 索引，前缀 [symbol]）
  ├─ 按 qualityScore × evidenceWeight 降序，取 Top 10 条高质量资料（TOP_ITEMS_LIMIT=10）
  ├─ 按域统计 domainCounts
  └─ 查询 score_evidence（by-symbol-layer 索引），按层分组：
       每层取 weight 最高的 Top 3 正面证据 + Top 3 负面证据（TOP_EVIDENCE_PER_LAYER=3）
  ↓
产出 ProfileDataSummary { totalItems, domainCounts, topItems, evidenceSummary }
  ↓ 注入 LLM 分析上下文
```

降级策略：任一查询失败返回空摘要并记 `logger.info`，不抛异常、不阻塞分析。

### 8.2 分析后：结论自动归档（archiveAnalysisToProfile）

- 分析结论异步归档为 D7 成长前沿域的 `analysis_note` 型资料条目（后台执行，不等待结果）
- 质量分 = 合理性校验基数（通过 80 / 未通过 60）+ 置信度加成（≤20）；情绪由评级映射（buy/strong_buy→positive 等）
- `relatedLayers` 取因子执行记录中全部 `l*` 层 ID（分析结论是综合性的）
- `originalStore` 指向 `analysisResults`，`originalKey` 为分析文档 ID，保持可回源

---

## 9. 页面与路由

### 9.1 ProfileBrowsePage（路由 `/output/profile`）

`src/pages/output/ProfileBrowsePage.tsx`——八域资料浏览与证据链可视化页面：

- **八域导航**：基于 `DOMAIN_META` 渲染 8 个域入口（图标/颜色/资料计数），支持全域/单域切换
- **多维筛选**：资料类型、情绪、最低质量分、关键词搜索（`ProfileFilter`）
- **资料详情抽屉**：Sheet 侧滑展示完整资料（标题/摘要/来源/标签/关键要点/原始链接）
- **证据链可视化**：`groupEvidenceByLayer` 将证据按层分组，逐层展示证据条目、权重与方向，配合 `StockProfile.evidenceCoverage` 展示证据覆盖率

### 9.2 profileStore（Zustand）

`src/store/profileStore.ts` 管理页面状态：股票选择（`stocks`/`symbol`，源自研究池 `listPoolItems`）、域导航（`activeDomain`）、资料列表（`items`/`itemsLoading`）、详情（`selectedItemId`）、证据（`evidence`）、资料包统计（`profile`）、筛选（`filter`）。

选择器（组件经 selector 订阅，遵循 AGENTS.md §二响应式铁律）：`selectStocks` / `selectSymbol` / `selectActiveDomain` / `selectItems` / `selectItemsLoading` / `selectFilter` / `selectSelectedItemId` / `selectEvidence` / `selectProfile` / `selectSelectedItem` / `selectDomainCounts` / `selectAvailableSources` / `groupEvidenceByLayer`。

---

## 10. 容量与性能

### 10.1 容量估算

| Store | 单股票规模 | 单条大小 | 单股票占用 |
|-------|-----------|---------|-----------|
| profile_items | 200-500 条 | ~500B（元数据+摘要，不含正文） | 100-250KB |
| score_evidence | ~55 条（11 层 × ~5 条） | ~200B | ~10KB |
| stock_profiles | 1 条 | ~1KB | ~1KB |
| profile_tags | 全局共享 | ~200B/条 | 全局 ~1MB |
| **合计/股票** | | | **~250KB** |

100 只跟踪股票约 **~25MB**，远低于 IndexedDB 可用容量（>500MB）。

### 10.2 查询性能

- **按域浏览**：`by-symbol-domain-quality` 复合索引直接命中 `[symbol, domain]` 前缀，按质量分有序
- **按类型筛选**：`by-symbol-type` 复合索引
- **去重查询**：`by-hash` 索引 O(1) 判重
- **证据链查询**：`by-symbol-layer` 复合索引支撑层级下钻；`by-profile-item` 支撑资料→证据反查
- **覆盖率排序**：`stock_profiles.by-coverage` 索引支撑"证据最薄弱股票"运营视图

### 10.3 去重与一致性

- **dataHash 幂等**：条目 ID 由内容哈希派生，重复同步同一资料天然幂等
- **回源读取**：详情正文通过 `originalStore`/`originalKey` 回源，资料层不持有正文的权威副本
- **版本清理**：`clearOldVersionEvidence` 默认只保留最近 3 个评分版本的证据，防止证据无限膨胀

---

## 11. 数据迁移与版本

### 11.1 v31 → v32 迁移

- 新增 4 个 Store：`stock_profiles` / `profile_items` / `score_evidence` / `profile_tags`（纯新增，无存量数据迁移）
- `src/config/dbConfig.ts`：`DB_VERSION = 32`，新增 9 个 `ENVELOPE_ACTION`（`SAVE_PROFILE_ITEM` / `BULK_SAVE_PROFILE_ITEMS` / `DELETE_PROFILE_ITEM` / `SAVE_SCORE_EVIDENCE` / `BULK_SAVE_SCORE_EVIDENCE` / `DELETE_SCORE_EVIDENCE` / `SAVE_STOCK_PROFILE` / `SAVE_PROFILE_TAG` / `DELETE_PROFILE_TAG`）与对应 ACL_MATRIX 条目
- 打开旧库时 IndexedDB `upgradeneeded` 自动建表（`ensureStore` 幂等）

### 11.2 回滚

v32 的 4 个 Store 为纯新增：版本回退至 v31 后旧代码不感知新 Store，多余 Store 残留无影响；同步适配器均为旁路调用，停用即完成业务回滚。

---

## 12. 扩展规划与集成点

### 12.1 远期扩展

| 扩展方向 | 内容 | 阶段 |
|---------|------|------|
| 衍生指标引擎落地 | `src/services/derived-metrics/` 随主干落地，4 大类 20+ 指标自动接入证据链 | P2 |
| V6 引擎消费证据 | calculator 将 score_evidence 作为层分输入（当前为旁路构建） | P2 |
| 文件系统映射 | DB → 本地 Markdown 目录树镜像（见 V9-DOC-DATA-031） | P3 |
| 语义检索（RAG） | 资料摘要向量化，支撑"问资料"式自然语言研究 | P3+ |
| 协作标注 | 多人共享资料批注与证据评审 | P3+ |

### 12.2 既有模块集成点

- **v6ScoreService / scoreDocService**：评分报告生成触发 `onScoreDocGenerated` 自动归档
- **newsService**：新闻入库后触发 `newsSyncService` 增量同步
- **localDocService**：本地文档入库后触发 `localDocSyncService` 同步
- **analysisOrchestrator**：经 `profileIntegrationService` 双向集成（上下文注入 + 结论归档）
- **exportService**：资料/证据可随研究档案导出

---

## 13. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 自动分域误判（关键词投票） | 中 | 中 | 专用分类器（研报/公告/社区）+ 质量门槛；支持人工改域；默认域集中便于抽检 |
| 元数据与原 Store 不一致 | 中 | 低 | 资料层只存元数据与引用；详情回源读取；对账任务列入技术债 |
| 社区帖噪声污染证据链 | 中 | 中 | 来源权重校准 + 质量门槛 ≥40 + 互动热度加权；负面证据同样呈现保持平衡 |
| 资料库膨胀 | 低 | 低 | dataHash 去重 + 证据版本保留策略 + 容量估算 25MB/100 股 |
| 衍生指标引擎长期未落地 | 中 | 低 | `metricKey`/`metricValue` 扩展点已预留，证据服务可手工写入兜底 |

---
