---
title: V9 技术实施文档索�?
type: explanation
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "V9 技术实施文档索�?type: explanation"
tags: [project, plan, implementation, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "V9 技术实施文档索�?type: explanation"
tags: [project, plan, implementation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 技术实施文档索�?
> **目录**: `docs/implementation/`  
> **文件总数**: 44 �?.md 文档�?1 份业务文�?+ 9 �?ADR + 4 份治理文档）  
> **子目�?*: `adr/`�? 份架构决策记录）、`deprecated/`�? 份废弃文档）  
> **最后更�?*: 2026-06-27

---

## 一、文档分类索�?
### 1.1 架构设计（Architecture Design�?
| 文档 | 最后更�?| 行数 | 关联代码目录 | 说明 |
|:---|:---|:---|:---|:---|
| [v9-system-blueprint.md](../../reference/v9-system-blueprint.md) | 2026-06-25 | 311 | `src/` (全量) | V9 整体架构蓝图，含分层设计、模块依�?|
| [data-collection-architecture.md](data-collection-architecture.md) | 2026-06-24 | 218 | `src/services/data-collector/` | 数据采集模块三层架构设计 |
| [architecture-version-comparison.md](../architecture-version-comparison.md) | 2026-06-25 | 145 | `docs/` (跨版�? | 架构设计文档版本比对 |
| [data-interaction-protocols.md](../../reference/data-interaction-protocols.md) | 2026-06-25 | 89 | `src/core/databridge.ts` | 数据交互协议�?DataBridge 端点 |
| [fourth-industrial-revolution-core-resource-strategy.md](../../reference/fourth-industrial-revolution-core-resource-strategy.md) | 2026-06-24 | 219 | `src/services/trading/` | 第四次工业革命核心资源交易策�?|
| [investment-pipeline-stage-analysis.md](investment-pipeline-stage-analysis.md) | 2026-06-24 | 64 | �?| 投资流程阶段化分�?|
| [v10-architecture-alignment.md](../v10-architecture-alignment.md) | 2026-06-24 | 106 | `docs/` (跨版�? | V10 架构白皮书与 V9 对齐报告 |

### 1.2 接口/实现规格（Interface & Implementation Specs�?
| 文档 | 最后更�?| 行数 | 关联代码目录 | 说明 |
|:---|:---|:---|:---|:---|
| [agent-runtime-spec.md](../../reference/agent-runtime-spec.md) | 2026-06-25 | 107 | `src/types/modules/agent.types.ts` | Agent Runtime 实现规格 |
| [dataflow-engine-spec.md](../../reference/dataflow-engine-spec.md) | 2026-06-25 | 116 | `src/core/dataflow/` | DataFlow Engine 实现规格 |
| [rotation-score-spec.md](../../reference/rotation-score-spec.md) | 2026-06-25 | 146 | `src/services/rotation-score/` | Rotation Score Service 实现规格 |
| [input-cabin-spec.md](input-cabin-spec.md) | 2026-06-25 | 192 | `src/pages/input-cabin/` | 输入舱业务规格与实现映射 |
| [db-migration-v4-to-v6.md](../db-migration-v4-to-v6.md) | 2026-06-25 | 72 | `src/data/db.ts` | IndexedDB v4→v6 升级规范 |
| [trading-core-factors.md](trading-core-factors.md) | 2026-06-24 | 138 | `src/services/trading/` | 交易核心因子与复盘指�?|

### 1.3 迁移记录（Migration Records�?
| 文档 | 最后更�?| 行数 | 关联代码目录 | 说明 |
|:---|:---|:---|:---|:---|
| [v6-to-v9-migration-spec.md](../../reference/v6-to-v9-migration-spec.md) | 2026-06-25 | 514 | `src/services/v6-migration/` | V6→V9 JSON 数据迁移规范 |
| [v6pro-to-v9-migration-analysis.md](../v6pro-to-v9-migration-analysis.md) | 2026-06-25 | 265 | `src/` (全量) | V6 Pro→V9 源码比对与模块梳�?|
| [v6pro-ui-page-diff-report.md](v6pro-ui-page-diff-report.md) | 2026-06-24 | 256 | `src/pages/`, `src/components/` | V6 Pro �?V9 UI & Page 差异全量对比 |
| [v6-cockpit-ui-reference.md](../../reference/v6-cockpit-ui-reference.md) | 2026-06-24 | 111 | `src/cockpit/` | V6 Pro Cockpit UI 组件参�?|
| [ui-only-implementation-summary.md](ui-only-implementation-summary.md) | 2026-06-24 | 111 | `src/pages/` | V6 Pro UI/Page 吸收落地总结 |
| [input-cabin-ui-reshaping.md](../../reference/input-cabin-ui-reshaping.md) | 2026-06-25 | 64 | `src/pages/input-cabin/` | 输入�?UI 体系化重�?|

### 1.4 治理与审计报告（Governance & Audit�?
| 文档 | 最后更�?| 行数 | 关联代码目录 | 说明 |
|:---|:---|:---|:---|:---|
| [v9-architecture-data-diff-report.md](v9-architecture-data-diff-report.md) | 2026-06-27 | 207 | `docs/`, `src/` (全量) | 架构资产差异分析报告 |
| [v9-architecture-data-dictionary-validation-report.md](../../reference/v9-architecture-data-dictionary-validation-report.md) | 2026-06-27 | 186 | `docs/`, `src/types/` | Phase 4 一致性验证报�?|
| [v9-documentation-audit-report.md](v9-documentation-audit-report.md) | 2026-06-25 | 246 | `docs/` (全量) | 文档体系化审计与补全建议 |
| [v9-current-state-review.md](v9-current-state-review.md) | 2026-06-25 | 322 | `src/` (全量) | 当前状态全面梳理（按实施进度） |
| [implementation-governance.md](implementation-governance.md) | 2026-06-25 | 111 | `docs/`, `src/` | 实施治理与架构决策记�?|
| [quality-gates-baseline.md](../quality-gates-baseline.md) | 2026-06-25 | 75 | `scripts/` | 质量门禁实测基线 |

### 1.5 执行方案与跟踪（Execution Plans�?
| 文档 | 最后更�?| 行数 | 关联代码目录 | 说明 |
|:---|:---|:---|:---|:---|
| [cockpit-news-doc-fix-plan.md](../../reference/cockpit-news-doc-fix-plan.md) | 2026-06-26 | 749 | `docs/`, `src/cockpit/`, `src/services/news/` | Cockpit + News 模块文档修正方案 |
| [doc-sync-execution-plan.md](doc-sync-execution-plan.md) | 2026-06-26 | 152 | `docs/` | 代码-文档同步整体方案与执行计�?|
| [v9-issue-management.md](../v9-issue-management.md) | 2026-06-27 | �?| `src/` (全量) | 问题整改管理与调度记录（合并三份原文档） |

### 1.6 阶段性合并报告（Batch Merge Reports�?
| 文档 | 最后更�?| 行数 | 说明 |
|:---|:---|:---|:---|
| [batch-merge-reports.md](batch-merge-reports.md) | 2026-06-27 | 135 | Batch 1-3 阶段性合并报告汇�?|

### 1.7 策略与分析（Strategy & Analysis�?
| 文档 | 最后更�?| 行数 | 关联代码目录 | 说明 |
|:---|:---|:---|:---|:---|
| [factor-tracking-roadmap.md](../factor-tracking-roadmap.md) | 2026-06-24 | 52 | `src/services/trading/` | 因子提炼、扩容与追踪路径 |
| [v9-input-cabin-strategy-report.md](../../reference/v9-input-cabin-strategy-report.md) | 2026-06-24 | 133 | `src/pages/input-cabin/` | 输入舱升级策略报�?|

### 1.8 架构决策记录（ADR�?
| 文档 | 最后更�?| 行数 | 说明 |
|:---|:---|:---|:---|
| [adr/2026-06-20-pure-frontend-architecture.md](2026-06-20-pure-frontend-architecture.md) | 2026-06-24 | 20 | ADR-001: 纯前端无后端架构 |
| [adr/2026-06-20-indexeddb-over-localstorage.md](../../reference/2026-06-20-indexeddb-over-localstorage.md) | 2026-06-24 | 20 | ADR-002: IndexedDB 替代 localStorage |
| [adr/2026-06-21-databridge-over-direct-datalayer.md](../../reference/project/2026-06-21-databridge-over-direct-datalayer.md) | 2026-06-24 | 20 | ADR-003: DataBridge 替代直接 dataLayer |
| [adr/2026-06-21-hashrouter-for-static-hosting.md](../../reference/2026-06-21-hashrouter-for-static-hosting.md) | 2026-06-24 | 19 | ADR-004: HashRouter 静态托管方�?|
| [adr/2026-06-23-portalshell-dark-kimi-layout.md](../2026-06-23-portalshell-dark-kimi-layout.md) | 2026-06-24 | 19 | ADR-005: PortalShell 深色 Kimi 布局 |
| [adr/2026-06-24-input-cabin-subpages.md](../2026-06-24-input-cabin-subpages.md) | 2026-06-24 | 20 | ADR-006: 输入舱拆分为四子页面 |
| [adr/2026-06-24-pool-screening-signal-persistence-review-engine.md](../2026-06-24-pool-screening-signal-persistence-review-engine.md) | 2026-06-24 | 32 | ADR-007: 补齐筛�?信号/复盘引擎 |
| [adr/2026-06-24-adopt-v6-core-resource-trading-strategy.md](../../reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md) | 2026-06-24 | 89 | ADR-008: 采用 V6 核心资源交易策略 |
| [adr/2026-06-25-v6-migration.md](../2026-06-25-v6-migration.md) | 2026-06-25 | 80 | ADR-009: V6 Pro JSON 全量导出迁移 |

### 1.9 废弃文档（Deprecated�?
| 文档 | 废弃日期 | 废弃原因 |
|:---|:---|:---|
| [deprecated/deprecated-cockpit-news-doc-correction-plan.md](deprecated-cockpit-news-doc-correction-plan.md) | 2026-06-27 | 内容�?cockpit-news-doc-fix-plan.md 的子�?|
| [deprecated/deprecated-ui-module-alignment.md](../../reference/deprecated-ui-module-alignment.md) | 2026-06-27 | 内容已被 v6pro-ui-page-diff-report.md 覆盖 |
| [deprecated/deprecated-doc-sync-gap-list.md](deprecated-doc-sync-gap-list.md) | 2026-06-27 | 差异项已闭环，合并至 doc-sync-execution-plan.md |
| [deprecated/deprecated-batch1-merge-report.md](deprecated-batch1-merge-report.md) | 2026-06-27 | 合并�?batch-merge-reports.md |
| [deprecated/deprecated-batch2-merge-report.md](../deprecated-batch2-merge-report.md) | 2026-06-27 | 合并�?batch-merge-reports.md |
| [deprecated/deprecated-batch3-merge-report.md](deprecated-batch3-merge-report.md) | 2026-06-27 | 合并�?batch-merge-reports.md |
| [deprecated/deprecated-v9-issue-execution-board.md](../../archive/deprecated-v9-issue-execution-board.md) | 2026-06-27 | 合并�?v9-issue-management.md |
| [deprecated/deprecated-v9-issue-resolution-schedule.md](../deprecated-v9-issue-resolution-schedule.md) | 2026-06-27 | 合并�?v9-issue-management.md |
| [deprecated/deprecated-v9-parallel-task-schedule.md](deprecated-v9-parallel-task-schedule.md) | 2026-06-27 | 合并�?v9-issue-management.md |

---

## 二、关联代码目录映�?
| 代码目录 | 关联实施文档 |
|:---|:---|
| `src/cockpit/` | cockpit-news-doc-fix-plan.md, v6-cockpit-ui-reference.md |
| `src/core/databridge.ts` | data-interaction-protocols.md |
| `src/core/dataflow/` | dataflow-engine-spec.md |
| `src/data/db.ts` | db-migration-v4-to-v6.md |
| `src/pages/input-cabin/` | input-cabin-spec.md, input-cabin-ui-reshaping.md, v9-input-cabin-strategy-report.md |
| `src/pages/` | v6pro-ui-page-diff-report.md, ui-only-implementation-summary.md |
| `src/services/data-collector/` | data-collection-architecture.md |
| `src/services/news/` | cockpit-news-doc-fix-plan.md |
| `src/services/rotation-score/` | rotation-score-spec.md |
| `src/services/trading/` | trading-core-factors.md, fourth-industrial-revolution-core-resource-strategy.md, factor-tracking-roadmap.md |
| `src/services/v6-migration/` | v6-to-v9-migration-spec.md |
| `src/types/modules/agent.types.ts` | agent-runtime-spec.md |
| `docs/` (全量文档) | v9-architecture-data-diff-report.md, v9-documentation-audit-report.md, doc-sync-execution-plan.md |
| `scripts/` | quality-gates-baseline.md |

---

## 三、归并操作记�?
| 操作 | 源文�?| 目标文件 | 理由 |
|------|--------|----------|------|
| 废弃 | cockpit-news-doc-correction-plan.md | �?| 内容�?cockpit-news-doc-fix-plan.md 的子集（226 �?vs 749 行） |
| 废弃 | ui-module-alignment.md | �?| 内容已被 v6pro-ui-page-diff-report.md 覆盖 |
| 废弃 | doc-sync-gap-list.md | �?| 差异项已闭环，核心逻辑�?doc-sync-execution-plan.md �?|
| 合并 | batch1/2/3-merge-report.md | batch-merge-reports.md | 三份报告为同一轮迭代的连续执行记录 |
| 合并 | v9-issue-execution-board.md + v9-issue-resolution-schedule.md + v9-parallel-task-schedule.md | v9-issue-management.md | 覆盖同一问题整改流程的不同维度，合并后形成完整闭�?|

---

## 四、文档更新规�?
### 4.1 变更原则
- 每个开发任务完成后，必须检查是否涉及文档变�?- 若涉及，必须同步更新对应文档并追�?Change Log
- Code Review 时同时检查文档是否同步更�?
### 4.2 Frontmatter 规范
每份文档必须包含以下 YAML 元数据头�?```yaml
---
title: [文档标题]
version: [语义化版本号]
last_updated: [YYYY-MM-DD]
maintainer: [维护人]
status: [active | review | deprecated]
change_log:
  - date: [YYYY-MM-DD]
    author: [姓名]
    desc: [变更描述]
---
```

### 4.3 保鲜度告警规�?- 当一份文档对应的 `src/` 目录累计修改超过 5 次，但文档未同步更新时，自动标记�?🟡 需关注
- 每两周复查所�?🟡 �?🔴 文档的更新状�?
### 4.4 文档同步 DoD（Definition of Done�?每个开发任务完成后，必须满足以下条件方可标记为完成�?- [ ] 涉及的代码变更已提交
- [ ] 关联的架构文档已同步更新（如有架构变更）
- [ ] 关联的数据字典已同步更新（如有类�?接口变更�?- [ ] 变更日志已追加到对应文档�?`change_log`
- [ ] 文档 `last_updated` 已更新为当前日期
- [ ] 文档版本号已按语义化规则递增
- [ ] `npm run audit:docs` 通过

---

## 五、治理交付物清单

| 序号 | 交付�?| 路径 | 说明 |
|:---|:---|:---|:---|
| 1 | 目录索引 | [00-readme.md](00-readme.md) | 统一导航入口，含分类/状�?关联代码 |
| 2 | 合并后的文档 | `*.md`�?1 份活跃文档） | 已归并去重、注�?Frontmatter |
| 3 | 废弃文档 | [deprecated/](../../archive/deprecated-v9-issue-execution-board.md) | 存放 9 份已废弃的旧文档 |
| 4 | 健康度报�?| [health-report.md](../../reports/retrospectives/health-report.md) | 每份文档的保鲜度评分与标�?|
| 5 | 时间轴报�?| [timeline-report.md](../../reports/retrospectives/timeline-report.md) | 变更历史时间�?+ 沉默期分�?|
| 6 | 告警清单 | [freshness-alerts.md](freshness-alerts.md) | 当前需关注的文档列�?|

---

## 六、变更日�?
| 日期 | 版本 | 变更内容 | 变更�?|
|:---|:---|:---|:---|
| 2026-06-27 | v1.2.0 | Phase 5 完成：时间轴报告、告警清单、DoD 规范、交付物清单 | Documentation Governor |
| 2026-06-27 | v1.1.0 | Phase 3-4 完成：Frontmatter 注入�?8 份）、健康度评分�?1 份全�?🟢�?| Documentation Governor |
| 2026-06-27 | v1.0.0 | Phase 1-2：初始盘点（47 份）、归并去重（�?7 份、合 2 份） | Documentation Governor |