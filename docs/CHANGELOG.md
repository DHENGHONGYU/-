# V9 架构文档变更日志

> 遵循"变更即记录（Change as Record）"原则，每次架构/数据变更均在此留下审计痕迹。

---

## v1.2.0 (2026-06-27) — 架构审计修复与能力升级

**审计范围**：V9 架构审计四项核心扫描（注册完整性/数据流一致性/错误处理/偏差清单）  
**修复结果**：10 项待办任务（P1:3, P2:7）全部完成，4 项代码修复

### 新增文件

| 文件 | 模块 | 说明 |
|------|------|------|
| `src/agents/index.ts` | Agent | 统一入口，注册 5 个默认 Agent，健康监控初始化 |
| `src/config/thresholds.ts` | Config | 统一阈值配置中心，整合 8 类阈值 |
| `src/services/unifiedStockService.ts` | Service | 数据融合层，UnifiedStockView 统一视图 |
| `src/services/feedbackService.ts` | Service | 操作反馈闭环，自动反馈包装器 |
| `src/components/WidgetErrorBoundary.tsx` | Component | Widget 专用错误边界，重试机制 |
| `src/constants/newsColorTokens.ts` | News | 新闻组件颜色令牌（从 pages/news-v6/styles 迁移） |
| `docs/RELEASE_NOTES.md` | Docs | 版本发布说明文档 |

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/cockpit/CockpitShell.tsx` | Widget 引擎完整生命周期管理（mount/refresh/unmount） |
| `src/services/scoring/v6ScoreService.ts` | 关闭 mock 降级，添加质量指标，扩展字段 |
| `src/data/types.ts` | V6Score 添加 qualityWarning 字段 |
| `src/pages/analysis/SectorAnalysisPage.tsx` | 接入轮动评分和行业评分数据展示 |
| `src/pages/news-v6/components/NewsCard.tsx` | 修复 JSX 标签闭合错误 |
| `src/pages/news-v6/components/newsCardUtils.tsx` | 修复类型索引错误 |
| `tests/news-v6/NewsFeed.test.tsx` | 修复空值检查 |
| `tests/news-v6/NewsPage.test.tsx` | 修复空值检查 |
| `docs/implementation/feedback-loop-spec.md` | 反馈闭环规格文档更新 |
| `scripts/audit-doc-sync.ts` | 审计脚本更新 |

### 验证结果

| 验证项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 0 错误 |
| `git diff --stat` | 18 files, +1558/-75 |

---

> **变更人**：V9 质量审计官  
> **关联任务**：V9 架构审计全量扫描修复

---

## v1.1.0 (2026-06-26) — 架构资产治理：文档与代码同步修正

**治理范围**：全量差异扫描 + 架构文档修正 + 数据字典补全 + 一致性验证  
**治理工具**：`audit-doc-sync.ts` (v1.0)  
**治理结果**：61 项差异（P1:55, P2:6）全部清零，回归 🟢 零债务状态

### 架构文档变更

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `docs/03-architecture-standards.md` | 修正 | §3.1.2 DataFlow 补充 4 接口（DataFlowModuleInput/Output, DataPacket, ChannelMeta） |
| `docs/03-architecture-standards.md` | 新增 | §3.1.7 Page 生命周期（PageModuleInput/Output, PageGuard） |
| `docs/03-architecture-standards.md` | 修正 | §3.8 DataBridge 适配层补充 5 接口（DataBridgeAdapterConfig, DataAction, BridgeQueryOptions, BridgeQueryResult, DataBridgeAdapterStats） |
| `docs/03-architecture-standards.md` | 修正 | §3.7 数据层补充 34 个数据模型引用（DimensionScore, PortfolioHolding, StrategyClassification 等） |
| `docs/02-functional-specs.md` | 版本升级 | v0.9.1 → v1.1.0 |
| `docs/05-engine-specs.md` | 版本升级 | v0.9.0 → v1.1.0 |
| `docs/06-routing-specs.md` | 版本升级 | v0.9.0 → v1.1.0 |
| `docs/08-implementation-plan.md` | 版本升级 | v0.9.0 → v1.1.0 |
| `docs/09-quality-gates.md` | 版本升级 | v0.9.0 → v1.1.0 |

### 数据字典变更

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `docs/trade/API_CONTRACT.md` | 修正 | §9.2b 新增 TradeSignal/TradingSignal 接口定义（8 字段 + SignalSnapshot 子类型） |
| `docs/cockpit/DATA_DEFINITION.md` | 元数据 | 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26） |
| `docs/AI_CENTER_DATA_DEFINITION.md` | 元数据 | 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26） |
| `docs/trade/API_CONTRACT.md` | 元数据 | 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26） |
| `docs/data-collection/DATA_DEFINITION.md` | 元数据 | 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26） |
| `docs/news/DATA_DEFINITION.md` | 元数据 | 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26） |
| `docs/DATA_DICTIONARY_INDEX.md` | 版本升级 | v0.9.0 → v1.1.0 |
| `docs/DATAFLOW_DATA_DEFINITION.md` | 版本升级 | v0.9.0 → v1.1.0 |

### 工具链变更

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `scripts/audit-doc-sync.ts` | 新增 | 文档与代码同步审计脚本，支持 5 条规则 |
| `scripts/audit-doc-sync.ts` | 修正 | 修复 `docContainsType` 复合词匹配（HealthMetric → HealthMetricItem） |
| `scripts/audit-doc-sync.ts` | 修正 | 修复 `docHasVersionHeader` 正则兼容 Markdown 加粗格式 |
| `scripts/audit-doc-sync.ts` | 修正 | 新增 MODULE_MAP 映射（AI Center Services, Trading Services） |
| `scripts/audit-doc-sync.ts` | 修正 | P2 文档元数据去重逻辑 |
| `package.json` | 修正 | 新增 `audit:docs` 脚本，纳入 `audit` 全量审计 |

### 新增交付物

| 文件 | 说明 |
|------|------|
| `docs/implementation/v9-architecture-data-diff-report.md` | 差异分析报告 v1.1.0 |
| `docs/implementation/v9-architecture-data-dictionary-validation-report.md` | 一致性验证报告 |
| `docs/CHANGELOG.md` | 本文档 |

### 验证结果

| 验证项 | 结果 |
|--------|------|
| `audit:docs` | ✅ 0 差异 |
| `tsc --noEmit` | ✅ 0 错误 |
| `audit:layers` | ✅ 226 文件，0 违规 |
| `vitest run` | ✅ 58/58 文件，447/447 用例 |

---

## v1.0.0-governance-complete (2026-06-26) — 首次架构资产治理完成

**治理范围**：Cockpit + News + Trading + AI Center + Data Collection 五大模块文档同步  
**治理结果**：28 项差异（P0:16, P1:7, P2:5）全部清零

### 变更摘要

| 模块 | 文档 | 变更内容 |
|------|------|---------|
| Cockpit | `docs/cockpit/DATA_DEFINITION.md` | 新建，Widget 框架 40+ 接口 + 枚举常量 |
| Cockpit | `docs/03-architecture-standards.md` §3.1.4 | 目录结构替换为 12 个实际 Widget，新增 §3.1.4.1 采集流 |
| News | `docs/news/DATA_DEFINITION.md` | 新建，newsService/sentimentAnalyzer/stockLinker 5 接口 |
| News | `docs/02-functional-specs.md` §2.1 | 新增新闻资讯模块 |
| Trading | `docs/trade/API_CONTRACT.md` §9 | 新增交易服务层 9 接口 + 7 模块函数清单 |
| Trading | `docs/02-functional-specs.md` §2.1 | 新增交易持仓管理模块 |
| AI Center | `docs/AI_CENTER_DATA_DEFINITION.md` §5 | 补充 Agent 运行时类型（AgentModuleInput/Output, AgentDefinition, AgentInstance） |
| AI Center | `docs/02-functional-specs.md` §2.1 | 新增 AI 智能体中心模块 |
| Data Collection | `docs/data-collection/DATA_DEFINITION.md` | 新建，三层架构 8 接口 + 5 组枚举 |
| Data Collection | `src/services/data-collector/mockDataCollection.ts` | 新建，8 接口 Mock 数据生成器 |
| Architecture | `docs/03-architecture-standards.md` | L5/L4 映射表补充 Widget 数量，L3 行补充 news 服务路径 |
| User Stories | `docs/02-functional-specs.md` §2.4 | 新增 3 个用户故事（2.4.12~2.4.14） |

---

## v0.9.0 (2026-06-24) — 架构基线

初始版本，包含 01~10 全套架构文档、7 个 ADR 决策记录、DeepAnalysis 工业 4.0 战略分析。

### 文档清单

| 编号 | 文档 | 说明 |
|------|------|------|
| 01 | `01-vision-and-goals.md` | 愿景与目标 |
| 02 | `02-functional-specs.md` | 功能规格 |
| 03 | `03-architecture-standards.md` | 架构标准 |
| 04 | `04-ui-ux-specs.md` | UI/UX 规格 |
| 05 | `05-engine-specs.md` | 引擎规格 |
| 06 | `06-routing-specs.md` | 路由规格 |
| 07 | `07-operation-strategy.md` | 运营策略 |
| 08 | `08-implementation-plan.md` | 实施计划 |
| 09 | `09-quality-gates.md` | 质量门禁 |
| 10 | `10-glossary.md` | 术语表 |
| — | `implementation/adr/` | 7 个 ADR |
| — | `implementation/deep-analysis/` | 工业 4.0 战略分析 |

---

> **变更人**：架构资产治理官  
> **关联任务**：V9 架构升级项目 — 文档与代码同步治理