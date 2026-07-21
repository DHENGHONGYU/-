---
title: V9 架构资产差异分析报告（Phase 5 深层审计）
type: explanation
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 一、扫描统计总览 ## 二、文档覆盖矩阵"
tags: [architecture, report, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-028
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-FRONT-010, V9-DOC-PROJ-176, V9-DOC-PROJ-182, docs/archive/reference-historical/cockpit-news-doc-fix-plan.md, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 架构资产差异分析报告（Phase 5 深层审计）

> **Status**: Active  
> **Version**: v1.1.0  
> **Last Updated**: 2026-06-26  
> **审计工具**: `audit-doc-sync.ts`  
> **扫描范围**: 全量 `src/types/modules/` (8文件)、`src/constants/` (4文件)、`src/services/` (54文件)、`src/pages/` (25文件)、`src/data/types.ts`、`docs/` (55文件)  
> **核心原则**: 文档即代码 | 变更即记录 | 差异即债务  
> **治理结论**: Phase 1-4 治理已消除 28/28 项差异（P0 16 + P1 7 + P2 5 → 全部清零）；Phase 5 深层审计发现新的 P1 55 项 + P2 6 项，合计 61 项待修复

---

## 一、扫描统计总览

| 维度 | 数量 |
|------|------|
| 类型定义文件 (`src/types/modules/`) | 8 |
| 常量定义文件 (`src/constants/`) | 4 |
| TypeScript 接口/类型声明 (含 `src/data/types.ts`) | 150+ |
| 枚举常量组 | 23+ |
| 服务层模块目录 | 14 |
| 页面组件 | 25 |
| 现有文档文件 (`docs/`) | 55 |
| 已有数据字典文档 | 5 (`ai-center-data-definition.md`, `../../reference/data-definition.md`, `../../reference/data-definition.md`, `../../reference/data-definition.md`, `../../reference/api-contract.md`) |
| 架构标准文档 | 1 (`../../reference/03-architecture-standards.md`) |

---

## 二、文档覆盖矩阵

### 2.1 类型模块 → 文档映射

| 代码模块 | 类型文件 | 对应文档 | 覆盖状态 |
|---------|---------|---------|---------|
| **AI Center** | `ai-center.types.ts` | `../../reference/ai-center-data-definition.md` | ? 已覆盖 |
| **Trade / Holdings** | `trade.types.ts` | `../../reference/api-contract.md` | ?? 部分（`TradeSignal` 未记录） |
| **Cockpit / Widget** | `widget.types.ts` | `../../reference/data-definition.md` | ? 已覆盖 |
| **Engine** | `engine.types.ts` | `../../reference/03-architecture-standards.md` §3.1.6 | ? 已覆盖 |
| **DataBridge** | `databridge.types.ts` | `../../reference/03-architecture-standards.md` §3.8 | ?? 部分（5 个类型未记录） |
| **Agent Runtime** | `agent.types.ts` | `../../reference/03-architecture-standards.md` §3.1.5.1 | ? 已覆盖 |
| **Page Lifecycle** | `page.types.ts` | 无 | ?? 缺失（3 个类型未记录） |
| **DataFlow** | `dataflow.types.ts` | `../../reference/03-architecture-standards.md` §3.1.2 | ?? 部分（4 个类型未记录） |

### 2.2 服务模块 → 文档映射

| 服务目录 | 对应文档 | 覆盖状态 |
|---------|---------|---------|
| `src/services/ai-center/` | `../../reference/ai-center-data-definition.md` | ? 已覆盖 |
| `src/services/data-collector/` | `../../reference/data-definition.md` | ? 已覆盖 |
| `src/services/news/` | `../../reference/data-definition.md` | ? 已覆盖 |
| `src/services/trading/` | `../../reference/api-contract.md` | ? 已覆盖 |
| `src/services/trading/` | `../../reference/api-contract.md` | ? 已覆盖 |
| `src/services/analysis/` | 无 | ?? 缺失 |
| `src/services/fetcher/` | 无 | ?? 缺失 |
| `src/services/input/` | 无 | ?? 缺失 |
| `src/services/llm/` | 无 | ?? 缺失 |
| `src/services/scoring/` | 无 | ?? 缺失 |
| `src/services/stock-analysis/` | 无 | ?? 缺失 |
| `src/services/stockpool/` | 无 | ?? 缺失 |
| `src/services/system/` | 无 | ?? 缺失 |

### 2.3 数据模型 → 文档映射

| 数据源 | 对应文档位置 | 覆盖状态 |
|--------|------------|---------|
| `src/data/types.ts` (全部导出类型) | `../../reference/03-architecture-standards.md` §3.7 | ?? 部分（34 个类型未引用） |

---

## 三、差异明细清单

### 3.1 ?? P0 级差异 — 0 项

> Phase 1-4 治理已全部消除。本次深层审计未发现新的 P0 级差异。

---

### 3.2 ?? P1 级差异 — 55 项

#### 3.2.1 A 类：类型定义缺失（13 项）

代码中的类型已在 TypeScript 中定义，但未在对应文档中记录。

| 差异ID | 差异类型 | 描述 | 来源文件 | 期望文档位置 | 等级 |
|--------|---------|------|---------|-------------|------|
| **DIFF-101** | 类型定义缺失 | `TradeSignal` 接口未在 API 契约中记录 | `src/types/modules/trade.types.ts` | `../../reference/api-contract.md` | ?? P1 |
| **DIFF-102** | 类型定义缺失 | `DataBridgeAdapterConfig` 接口未在架构文档中记录 | `src/types/modules/databridge.types.ts` | `../../reference/03-architecture-standards.md` §3.8 | ?? P1 |
| **DIFF-103** | 类型定义缺失 | `DataAction` 枚举（14 个枚举值）未在架构文档中记录 | `src/types/modules/databridge.types.ts` | `../../reference/03-architecture-standards.md` §3.8 | ?? P1 |
| **DIFF-104** | 类型定义缺失 | `BridgeQueryOptions` 接口未在架构文档中记录 | `src/types/modules/databridge.types.ts` | `../../reference/03-architecture-standards.md` §3.8 | ?? P1 |
| **DIFF-105** | 类型定义缺失 | `BridgeQueryResult` 接口未在架构文档中记录 | `src/types/modules/databridge.types.ts` | `../../reference/03-architecture-standards.md` §3.8 | ?? P1 |
| **DIFF-106** | 类型定义缺失 | `DataBridgeAdapterStats` 接口未在架构文档中记录 | `src/types/modules/databridge.types.ts` | `../../reference/03-architecture-standards.md` §3.8 | ?? P1 |
| **DIFF-107** | 类型定义缺失 | `DataFlowModuleInput` 接口未在架构文档中记录 | `src/types/modules/dataflow.types.ts` | `../../reference/03-architecture-standards.md` §3.1.2 | ?? P1 |
| **DIFF-108** | 类型定义缺失 | `DataFlowModuleOutput` 接口未在架构文档中记录 | `src/types/modules/dataflow.types.ts` | `../../reference/03-architecture-standards.md` §3.1.2 | ?? P1 |
| **DIFF-109** | 类型定义缺失 | `DataPacket` 接口未在架构文档中记录 | `src/types/modules/dataflow.types.ts` | `../../reference/03-architecture-standards.md` §3.1.2 | ?? P1 |
| **DIFF-110** | 类型定义缺失 | `ChannelMeta` 接口未在架构文档中记录 | `src/types/modules/dataflow.types.ts` | `../../reference/03-architecture-standards.md` §3.1.2 | ?? P1 |
| **DIFF-111** | 类型定义缺失 | `PageModuleInput` 接口未在架构文档中记录 | `src/types/modules/page.types.ts` | `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-112** | 类型定义缺失 | `PageModuleOutput` 接口未在架构文档中记录 | `src/types/modules/page.types.ts` | `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-113** | 类型定义缺失 | `PageGuard` 接口未在架构文档中记录 | `src/types/modules/page.types.ts` | `../../reference/03-architecture-standards.md` | ?? P1 |

#### 3.2.2 B 类：服务模块未映射（8 项）

以下服务目录存在代码实现，但无对应的文档（数据字典或架构文档）映射。

| 差异ID | 差异类型 | 描述 | 来源目录 | 建议文档位置 | 等级 |
|--------|---------|------|---------|-------------|------|
| **DIFF-114** | 服务模块未映射 | `src/services/analysis/` 目录（6 个服务文件：analysisService、rotationCalculator、rotationSignalGrader、rotationScoreService、scoreDocService、scorePageService、screeningEngine、sectorScoreService）无文档映射 | `src/services/analysis/` | `../../reference/data-definition.md`（待建） | ?? P1 |
| **DIFF-115** | 服务模块未映射 | `src/services/fetcher/` 目录（5 个文件：fetcherAdapter、fetcherClient、fetcherScheduler、fetcherService、fetcherTypes）无文档映射 | `src/services/fetcher/` | `../../reference/data-definition.md`（待建）或 `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-116** | 服务模块未映射 | `src/services/input/` 目录（4 个文件：batchImportService、hotSectorService、inputService、mockStockLibrary）无文档映射 | `src/services/input/` | `../../reference/data-definition.md`（待建）或 `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-117** | 服务模块未映射 | `src/services/llm/` 目录（2 个文件：llmClient、llmTypes）无文档映射 | `src/services/llm/` | `../../reference/data-definition.md`（待建）或 `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-118** | 服务模块未映射 | `src/services/scoring/` 目录（7 个文件：industryScorePrompt、industryScoreService、industryScoreSkill、intelligentScorePrompt、intelligentScoreService、intelligentScoreSkill、v6ScoreService）无文档映射 | `src/services/scoring/` | `../../reference/data-definition.md`（待建） | ?? P1 |
| **DIFF-119** | 服务模块未映射 | `src/services/stock-analysis/` 目录（1 个文件：mockStockAnalysisProvider）无文档映射 | `src/services/stock-analysis/` | `../../reference/data-definition.md`（待建）或 `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-120** | 服务模块未映射 | `src/services/stockpool/` 目录（1 个文件：stockpoolService）无文档映射 | `src/services/stockpool/` | `../../reference/data-definition.md`（待建）或 `../../reference/03-architecture-standards.md` | ?? P1 |
| **DIFF-121** | 服务模块未映射 | `src/services/system/` 目录（9 个文件：bootstrapService、localDocService、systemService、v6MigrationService + migration/ 子目录 4 个文件）无文档映射 | `src/services/system/` | `../../reference/data-definition.md`（待建） | ?? P1 |

#### 3.2.3 C 类：数据模型未在架构文档中引用（34 项）

`src/data/types.ts` 中导出的类型未在 `../../reference/03-architecture-standards.md` §3.7 Schema 表格中引用。

| 差异ID | 差异类型 | 描述 | 来源文件 | 期望文档位置 | 等级 |
|--------|---------|------|---------|-------------|------|
| **DIFF-122** | 数据模型未引用 | `DimensionScore` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-123** | 数据模型未引用 | `IndustryDimensionScore` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-124** | 数据模型未引用 | `IndustryScore` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-125** | 数据模型未引用 | `PortfolioHolding` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-126** | 数据模型未引用 | `RebalanceAction` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-127** | 数据模型未引用 | `StrategyClassification` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-128** | 数据模型未引用 | `StrategyCandidate` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-129** | 数据模型未引用 | `StrategyResult` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-130** | 数据模型未引用 | `SignalSnapshot` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-131** | 数据模型未引用 | `ResearchLog` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-132** | 数据模型未引用 | `KlineBar` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-133** | 数据模型未引用 | `SectorScoreDimensions` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-134** | 数据模型未引用 | `SectorUsChinaData` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-135** | 数据模型未引用 | `SectorDefinition` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-136** | 数据模型未引用 | `SectorStockMapping` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-137** | 数据模型未引用 | `SectorScoreRecord` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-138** | 数据模型未引用 | `MarketStyle` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-139** | 数据模型未引用 | `RotationSubFactor` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-140** | 数据模型未引用 | `RotationFactor` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-141** | 数据模型未引用 | `RotationSignalGrade` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-142** | 数据模型未引用 | `RotationScoreBucket` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-143** | 数据模型未引用 | `RotationAlertLevel` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-144** | 数据模型未引用 | `DeclineNature` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-145** | 数据模型未引用 | `RotationSectorScore` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-146** | 数据模型未引用 | `V6LayerScore` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-147** | 数据模型未引用 | `ScoreDocVersion` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-148** | 数据模型未引用 | `StrategyGroupSnapshot` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-149** | 数据模型未引用 | `StrategySnapshot` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-150** | 数据模型未引用 | `LocalDoc` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-151** | 数据模型未引用 | `NewsArticle` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-152** | 数据模型未引用 | `NewsStockMap` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-153** | 数据模型未引用 | `SentimentCache` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-154** | 数据模型未引用 | `DataDimensionType` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |
| **DIFF-155** | 数据模型未引用 | `DimensionStatus` 类型未在架构文档 §3.7 中引用 | `src/data/types.ts` | `../../reference/03-architecture-standards.md` §3.7 | ?? P1 |

---

### 3.3 ?? P2 级差异 — 6 项

文档元数据格式不一致或缺失。

| 差异ID | 差异类型 | 描述 | 涉及文件 | 建议修复方案 | 等级 |
|--------|---------|------|---------|-------------|------|
| **DIFF-201** | 文档元数据缺失 | `../../reference/data-definition.md` 缺少标准化的 `Version: x.y.z` 和 `Last Updated: yyyy-mm-dd` 字段（仅有"生成日期"） | `../../reference/data-definition.md` | 在文件头部添加 `> **Version**` 和 `> **Last Updated**` 元数据块 | ?? P2 |
| **DIFF-202** | 文档元数据缺失 | `../../reference/ai-center-data-definition.md` 缺少标准化的版本号和更新日期字段（仅有"生成日期"） | `../../reference/ai-center-data-definition.md` | 在文件头部添加 `> **Version**` 和 `> **Last Updated**` 元数据块 | ?? P2 |
| **DIFF-203** | 文档元数据缺失 | `../../reference/api-contract.md` 缺少标准化的版本号和更新日期字段 | `../../reference/api-contract.md` | 在文件头部添加 `> **Version**` 和 `> **Last Updated**` 元数据块 | ?? P2 |
| **DIFF-204** | 文档元数据缺失 | `../../reference/data-definition.md` 缺少标准化的版本号和更新日期字段（仅有"生成日期"） | `../../reference/data-definition.md` | 在文件头部添加 `> **Version**` 和 `> **Last Updated**` 元数据块 | ?? P2 |
| **DIFF-205** | 文档元数据缺失 | `../../reference/data-definition.md` 缺少标准化的版本号和更新日期字段（仅有"生成日期"） | `../../reference/data-definition.md` | 在文件头部添加 `> **Version**` 和 `> **Last Updated**` 元数据块 | ?? P2 |
| **DIFF-206** | 审计工具误报 | `../../reference/03-architecture-standards.md` 实际已包含 `Version: v1.0.0-governance-complete` 和 `Last Updated: 2026-06-26`，审计工具正则未能匹配非标准格式。需修复审计工具的正则表达式以兼容 `> **Version**: ...` 格式 | `../../reference/03-architecture-standards.md` | 修复 `audit-doc-sync.ts` 中的版本号正则，支持 `> **Key**: value` 的 YAML frontmatter 风格元数据 | ?? P2 |

---

## 四、差异统计汇总

### 4.1 按等级统计

| 等级 | 数量 | 涉及模块/文件 |
|------|------|-------------|
| ?? P0 | 0 | — |
| ?? P1 | 55 | DataBridge (5), DataFlow (4), Page (3), Trade (1), Analysis (1), Fetcher (1), Input (1), LLM (1), Scoring (1), StockAnalysis (1), StockPool (1), System (1), `src/data/types.ts` → §3.7 (34) |
| ?? P2 | 6 | 5 个数据字典文档 + 1 个审计工具 |
| **合计** | **61** | 12 个模块 + 1 个审计工具 |

### 4.2 按类别统计

| 类别 | 数量 | 子类别说明 |
|------|------|-----------|
| A. 类型定义缺失 | 13 | Trade (1), DataBridge (5), DataFlow (4), Page (3) |
| B. 服务模块未映射 | 8 | analysis, fetcher, input, llm, scoring, stock-analysis, stockpool, system |
| C. 数据模型未引用 | 34 | `src/data/types.ts` 类型未在架构文档 §3.7 中引用 |
| D. 文档元数据缺失 | 5 | 5 个数据字典文档缺少标准化版本号 |
| E. 审计工具误报 | 1 | 正则兼容性问题 |
| **合计** | **61** | |

---

## 五、模块现状矩阵

| 领域 | 类型定义 | 服务层 | 数据字典 | 架构文档 | 综合评级 |
|------|---------|--------|---------|---------|---------|
| **Cockpit / Widget** | ? 完善 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **AI Center** | ? 完善 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **Trade / Holdings** | ?? 缺 TradeSignal | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 1 项 P1 |
| **DataBridge** | ?? 缺 5 类型 | ? 已实现 | — | ?? 部分 (§3.8) | ?? 5 项 P1 |
| **DataFlow** | ?? 缺 4 类型 | ? 已实现 | — | ?? 部分 (§3.1.2) | ?? 4 项 P1 |
| **Page Lifecycle** | ?? 缺 3 类型 | — | — | ?? 缺失 | ?? 3 项 P1 |
| **Engine** | ? 完善 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **Agent Runtime** | ? 完善 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **Data Collection** | ? 内联 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **News** | ? 内联 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **Analysis** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **Fetcher** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **Input** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **LLM** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **Scoring** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **Stock Analysis** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **StockPool** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **System** | ?? 无类型文件 | ? 已实现 | ?? 缺失 | ?? 缺失 | ?? 1 项 P1 |
| **Trading Services** | ? 内联 | ? 已实现 | ? 已覆盖 | ? 已覆盖 | ?? 无债务 |
| **数据模型层** | ? 完善 | — | — | ?? 缺失 34 类型 | ?? 34 项 P1 |
| **文档元数据** | — | — | ?? 5 文档缺版本号 | — | ?? 5 项 P2 |

---

## 六、Phase 5 修复优先级建议

### 6.1 修复分级策略

| 优先级 | 范围 | 差异数 | 建议时间 | 策略 |
|--------|------|--------|---------|------|
| **P1-High** | C 类：数据模型未引用 (§3.7) | 34 | 1 个工作日 | 在 `../../reference/03-architecture-standards.md` §3.7 中补全 34 个类型的 Schema 引用表 |
| **P1-Medium** | A 类：类型定义缺失 | 13 | 1 个工作日 | 在相应文档中补充 13 个类型的定义（DataBridge §3.8 补充 5 个、DataFlow §3.1.2 补充 4 个、Page 补充 3 个、Trade API 契约补充 1 个） |
| **P1-Medium** | B 类：服务模块未映射 | 8 | 2 个工作日 | 为 8 个服务模块创建数据字典或架构文档映射（analysis、fetcher、input、llm、scoring、stock-analysis、stockpool、system） |
| **P2-Low** | D 类：文档元数据缺失 | 5 | 0.5 小时 | 为 5 个数据字典文档添加标准化元数据块 |
| **P2-Low** | E 类：审计工具误报 | 1 | 0.5 小时 | 修复 `audit-doc-sync.ts` 正则表达式 |

### 6.2 建议执行顺序

```
Phase 5.1 (P1-High): 架构文档 §3.7 补全 → 34 项
Phase 5.2 (P1-Medium): 类型定义文档补全 → 13 项
Phase 5.3 (P1-Medium): 服务模块文档创建 → 8 项
Phase 5.4 (P2-Low): 文档元数据标准化 → 5 项
Phase 5.5 (P2-Low): 审计工具正则修复 → 1 项
Phase 5.6 (验证): tsc + vitest + audit:layers 全量验证
```

### 6.3 预期治理后状态

治理完成后，预期差异清零：
- P0: 0 → 0
- P1: 55 → 0
- P2: 6 → 0
- **合计: 61 → 0**

---

## 七、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v0.9.0-diff-scan-1 | Phase 1 全量扫描完成，生成初始差异报告，识别 28 个差异项 | Architecture Asset Governor |
| 2026-06-26 | v1.0.0-governance-complete | Phase 2-4 治理完成，28/28 差异全部消除；tsc + vitest 全量通过 | Architecture Asset Governor |
| 2026-06-26 | v1.1.0 | Phase 5 深层审计完成，发现 61 项新差异（P1 55 + P2 6）；全部为文档同步/元数据类差异，无架构级风险 | Architecture Asset Governor |