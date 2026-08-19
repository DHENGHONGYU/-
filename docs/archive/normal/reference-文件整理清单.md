---
title: 文件整理清单
type: reference
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "文件整理清单 - reference documentation (project)"
tags: [project, checklist, reference, governance, documentation]
version: v1.3.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-120
change_log:
  - version: v1.3.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# V9 项目文件整理清单

> **Version**: v1.3.0  
> **Date**：2026-06-29  
> **更新人**：Documentation Governor  
> **目的**：按内容分类、标记重复文件、建议清理项  
> **状态**：已执行（~212 文件/目录已删除，44 处断裂链接已修复）

---

## 一、项目总览

| 区域 | 文件数（约） | 说明 |
|------|-------------|------|
| 根目录 (.md) | 10 | 项目入口文档 + 迁移过程文档 |
| docs/ 根目录 | 39 | 架构规范、数据字典、审计报告 |
| docs/audit/ | 15+14 | 审计报告 + 图表资产 |
| docs/explanation/implementation/ | 66+10+9 | 实施文档 + ADR + deprecated |
| docs/ 其余子目录 | 8 | cockpit/data-collection/news/strategy/trade 数据字典 |
| scripts/ | 14 | 审计/测试/迁移工具 |
| src/ | 150+ | 源代码（不纳入本次整理范围） |
| .playwright-mcp/ | 49 | **临时调试产物** |
| .venv/ | - | **可重建的 Python 虚拟环境** |
| screenshots/ | 16 | **迁移验证截图** |
| python/ | 2 | 后端数据服务定义 |

---

## 二、重复文件对（共 6 对）

| # | 保留（较新/权威） | 删除（旧版/副本） | 关系 |
|---|------------------|-------------------|------|
| 1 | `../explanation/design/v6pro-v9-gap-analysis-final.md` | `../explanation/design/v6pro-v9-gap-analysis-final.md` | 内容完全相同 |
| 2 | `../explanation/design/v9现有数据资产清单.md` (v2.2) | `../explanation/design/v9现有数据资产清单.md` (v1.0.1) | 新版 vs 旧版 |
| 3 | `./v9核心数据字典与类型定义(整合版).md` (v1.2) | `./v9核心数据字典与类型定义(整合版).md` (v1.0) | 新版 vs 旧版 |
| 4 | `./action-list.md` (已修复20/30) | `../reports/audit/v9-架构缺陷与整改行动清单.md` (已修复11/30) | 同源审计，后者数据滞后 |
| 5 | `release-notes.md` (根目录, v0.9.5) | `./release-notes.md` (v1.2.0) | 根目录版更新 |
| 6 | 两者保留 | `../reports/changelogs/CHANGELOG.md` ? `CHANGELOG.md` (根目录) | 定位不同，不重复 |

---

## 三、建议删除文件清单

### 3.1 高优先级 — 临时/可重建产物

| # | 文件/目录 | 理由 |
|---|----------|------|
| 1 | `.playwright-mcp/` (整个目录, 49 文件) | Playwright MCP 自动生成的调试快照，可随时重新生成 |
| 2 | `screenshots/` (整个目录, 16 文件) | 迁移验证截图，已完成 |
| 3 | `scripts/component-audit-data.json` | 审计产物，可重新生成 |
| 4 | `scripts/component-audit-report.txt` | 审计产物，可重新生成 |
| 5 | `docs/audit/assets/__pycache__/` | Python 缓存，无用 |

### 3.2 中优先级 — 已完成的迁移过程文档

| # | 文件 | 理由 |
|---|------|------|
| 6 | `../explanation/v6pro-to-v9-migration-analysis.md` | 一次性 PoC 验证 |
| 7 | `../explanation/v6pro-to-v9-migration-analysis.md` | 一次性验收确认 |
| 8 | `./v6-to-v9-migration-spec.md` | 迁移已完成，参考价值低 |
| 9 | `../00-meta/development-log.md` | 一次性修复报告 |
| 10 | `scripts/fix/apply-multi-match-fixes.ts` | 一次性迁移脚本 |

### 3.3 中优先级 — 已废弃的文档 (deprecated/)

| # | 文件 | 理由 |
|---|------|------|
| 11 | `docs/explanation/implementation/deprecated/` (整个目录, 9 文件) | 全部已被替代文档覆盖 |

### 3.4 低优先级 — 过程性审计报告（已执行完毕）

| # | 文件 | 理由 |
|---|------|------|
| 12 | `../archive/report-1-architecture-health.md` | 快照报告 |
| 13 | `../archive/report-2-function-completeness.md` | 快照报告 |
| 14 | `../archive/report-3-data-type-consistency.md` | 快照报告 |
| 15 | `../archive/report-4-test-quality-gates.md` | 快照报告 |
| 16 | `../archive/report-5-documentation-completeness.md` | 快照报告 |
| 17 | `../explanation/design/completeness-profile-batch4.md` (5 文件) | 已汇总到 completeness-profile.md |
| 18 | `../reports/retrospectives/batch-merge-reports.md` | Batch 1-3 汇总，任务全部完成 |
| 19 | `./batchb-fix-plan.md` | P2 fix plan (draft)，已进入 action-list |
| 20 | `./batchd-fix-plan.md` | 同上 |
| 21 | `./batche-fix-plan.md` | 同上 |
| 22 | `../archive/dual-strategy-divergence-list.md` | 已标记 completed |
| 23 | `../explanation/dual-strategy-gap-analysis.md` | proposal 阶段差异分析 |
| 24 | `../explanation/migration-news-usestate-to-zustand.md` | 已完成的迁移记录 |
| 25 | `../explanation/ui-only-implementation-summary.md` | UI 吸收落地总结，实施完毕 |
| 26 | `./cockpit-news-doc-fix-plan.md` | 文档修正方案，应已执行完毕 |
| 27 | `../reports/retrospectives/v9-current-state-review.md` | 某时间点快照，已被后续文档超越 |
| 28 | `../reports/retrospectives/freshness-alerts.md` | 一次性生成 |
| 29 | `../reports/retrospectives/health-report.md` | 一次性生成 |
| 30 | `../reports/retrospectives/timeline-report.md` | 一次性生成 |
| 31 | `./architecture-version-comparison.md` | 一次性分析 |
| 32 | `../explanation/refactor-impact-analysis-2026-06-27.md` | 特定日期变更分析 |
| 33 | `../reports/audit/quality-audit-plan.md` | 审计执行计划，审计已完成 |

### 3.5 低优先级 — 旧版重复文档

| # | 文件 | 理由 |
|---|------|------|
| 34 | `../explanation/design/v9现有数据资产清单.md` (v1.0.1) | 被 v2.2 取代 |
| 35 | `./v9核心数据字典与类型定义(整合版).md` (v1.0) | 被 v1.2 取代 |
| 36 | `../reports/audit/v9-架构缺陷与整改行动清单.md` | 数据滞后于 action-list |
| 37 | `../explanation/design/v6pro-v9-gap-analysis-final.md` | 与 docs/ 根目录完全重复 |
| 38 | `./release-notes.md` (v1.2.0) | 被根目录新版取代 |

### 3.6 可选 — 虚拟环境

| # | 目录 | 理由 |
|---|------|------|
| 39 | `.venv/` | 可重建（`python -m venv .venv && pip install -r python/data_service/requirements.txt`） |

---

## 四、保留文件分类清单

### 4.1 项目入口文档

| 文件 | 说明 |
|------|------|
| `README.md` | 项目简介与技术栈概览 |
| `../explanation/03-architecture-standards.md` | 驾驶舱 Widget 架构说明 |
| `CHANGELOG.md` | SemVer 更新日志 |
| `release-notes.md` | 发布说明 |
| `data-definition.md` | 交易持仓模块数据字典 |
| `.env.example` / `.env.local.example` | 环境变量模板 |

### 4.2 docs/ 规范体系（编号 01-10）

| 文件 | 说明 |
|------|------|
| `./01-vision-and-goals.md` | 愿景与目标 |
| `./02-functional-specs.md` | 功能规格 |
| `./03-architecture-standards.md` | 架构标准 |
| `./04-ui-ux-specs.md` | UI/UX 规格 |
| `./05-engine-specs.md` | 引擎规格 |
| `./06-routing-specs.md` | 路由规格 |
| `./07-operation-strategy.md` | 运营策略 |
| `./08-implementation-plan.md` | 实施计划 |
| `./09-quality-gates.md` | 质量门禁 |
| `./10-glossary.md` | 术语表 |
| `docs/README.md` | 文档体系导航索引 |

### 4.3 数据治理文档

| 文件 | 说明 |
|------|------|
| `./v9数据宪法.md` | 数据层最高权威 |
| `./v9核心数据字典与类型定义(整合版).md` | 核心数据字典 SST (v1.2) |
| `../explanation/design/v9现有数据资产清单.md` | 数据资产全景 (v2.2) |
| `./功能模块数据契约.md` | 模块级数据契约 |
| `./data-dictionary-index.md` | 数据字典索引 |
| `./数据治理路线图.md` | 治理演进路线 |
| `./v9-数据血缘追踪.md` | 数据血缘追踪 |
| `./v9-indexeddb-store-schema.md` | IndexedDB 存储Schema |
| `./dataflow-data-definition.md` | 数据流数据字典 |
| `./ai-center-data-definition.md` | AI 中心数据字典 |
| `./news-contract.md` | 新闻数据字典 |
| `./v9-l2状态层补齐路线图.md` | L2 Store 补齐路线图 |
| `./changelogs/变更摘要-2026-06-28-phase0-数据层改造.md` | Phase 0 变更摘要 |

### 4.4 核心审计报告（保留）

| 文件 | 说明 |
|------|------|
| `./agent-audit-report.md` | Agent 审计报告 |
| `../explanation/design/v6pro-v9-gap-analysis-final.md` | V6Pro→V9 最终差异分析 |
| `../explanation/v9-架构覆盖分析报告.md` | 架构覆盖分析 |
| `../explanation/v9-代码实现分析报告.md` | 代码实现分析 |
| `../explanation/v9-目标功能清单.md` | 目标功能清单 |
| `./v9数据架构修订建议.md` | 数据架构修订建议 |
| `./databridge端点与数据映射清单.md` | DataBridge 端点映射 |
| `../reports/audit/report-6-remediation-action-list.md` | 整改行动清单（跟踪中） |
| `../archive/report-9-data-layer-compliance.md` | 数据层合规报告（整改依据） |
| `../archive/report-10-mature-app-benchmark-comparison.md` | 成熟APP对标（最新基线） |
| `../archive/report-11-integration-maturity-test.md` | 模块集成测试（最新） |
| `../reports/audit/report-12-integration-baseline-comparison.md` | 集成基线对比（最新） |
| `../archive/code-completeness-test-report.md` | 代码完整度测试报告（1635 用例） |

### 4.5 docs/explanation/implementation/ 核心文档（保留）

| 文件 | 说明 |
|------|------|
| `../README.md` | 目录索引 |
| **ADR 架构决策记录 (10 份)** | `adr/` 子目录全部保留 |
| `v9-system-blueprint.md` | **系统总蓝图** |
| `../explanation/design/2026-06-29-data-architecture-governance.md` | 数据架构治理计划（最新） |
| `../explanation/design/v9-architecture-rectification-strategy.md` | 架构整改总体策略 |
| `dataflow-engine-spec.md` | 数据流引擎规格 |
| `data-interaction-protocols.md` | 数据交互协议 |
| `agent-runtime-spec.md` | Agent 运行时规格 |
| `input-cabin-spec.md` | 输入舱业务规格 |
| `rotation-score-spec.md` | 轮动评分服务规格 |
| `chart-integration.md` | 图表集成规格 (draft) |
| `feedback-loop-spec.md` | 反馈闭环规格 (draft) |
| `widget-error-handling.md` | Widget 错误隔离规格 (draft) |
| `pwa-offline-guide.md` | PWA 离线化指南 (draft) |
| `../explanation/design/implementation-governance.md` | 实施治理流程 |
| `../explanation/performance-baseline.md` | 性能基线 |
| `../explanation/quality-gates-baseline.md` | 质量门禁基线 |
| `../explanation/a11y-checklist.md` | 无障碍检查清单 |
| `../explanation/design/tradereviewai-skill-testing.md` | 测试规范 |
| `../explanation/data-collection-architecture.md` | 数据采集架构 |
| `../explanation/factor-tracking-roadmap.md` | 因子追踪路径 |
| `../explanation/design/investment-pipeline-stage-analysis.md` | 投资流程阶段分析 |
| `input-cabin-ui-reshaping.md` | 输入舱 UI 重塑 |
| `v9-input-cabin-strategy-report.md` | 输入舱升级策略 |
| `fourth-industrial-revolution-core-resource-strategy.md` | 核心资源交易策略 |
| `../explanation/feature-entry-list.md` | 功能入口清单 |
| `completeness-profile.md` | 完成度汇总（替代 batch1-5） |
| `../explanation/design/audit-summary-report.md` | 质量审计总结 |
| `../explanation/design/v9-acceptance-report.md` | 双策略验收报告 |
| `../explanation/design/v9-documentation-audit-report.md` | 文档体系审计 |
| `../explanation/design/v9-architecture-data-diff-report.md` | 架构深层差异 |
| `v9-architecture-data-dictionary-validation-report.md` | 一致性验证 |
| `../explanation/design/v9-remediation-plan.md` | 修复排期（跟踪中） |
| `../explanation/v9-issue-management.md` | 统一调度记录 |
| `action-list.md` | 修复行动清单（数据最新） |
| `dual-strategy-update-log-and-consistency-check.md` | 双策略一致性检查 |
| `dual-strategy-dataflow-spec.md` | 双策略数据流规格 |
| `../explanation/db-migration-v4-to-v6.md` | DB 升级规范 |
| `v6-to-v9-migration-spec.md` | JSON 数据迁移规范 |
| `../explanation/design/doc-sync-execution-plan.md` | 代码-文档同步方案 |
| `../explanation/trading-core-factors.md` | 外部参考 (Deferred) |
| `v10-architecture-alignment.md` | V10 对齐参考 (Deferred) |
| `v6-cockpit-ui-reference.md` | V6 UI 参考 (Deferred) |
| `v6pro-to-v9-migration-analysis.md` | 源码比对分析 |
| `../explanation/v6pro-ui-page-diff-report.md` | UI 差异全量对比 |

### 4.6 docs/ 子目录数据字典

| 文件 | 说明 |
|------|------|
| `./data-definition.md` | 驾驶舱数据字典 |
| `./data-definition.md` | 数据采集定义 |
| `./data-definition.md` | 新闻数据字典 |
| `./api-contract.md` | 交易 API 契约 |
| `docs/explanation/strategy/*.md` (5 份) | 策略文档 |
| `../explanation/v9-strategy-architecture.md` | 策略架构 |

### 4.7 审计脚本 (scripts/)

| 文件 | 说明 |
|------|------|
| `scripts/audit/audit-component-usage.ts` | 组件复用审计 |
| `scripts/audit/audit-dead-code.ts` | 死代码扫描 |
| `scripts/audit/audit-doc-sync.ts` | 代码-文档同步审计 |
| `scripts/audit/audit-hardcode.ts` | 硬编码扫描 |
| `scripts/audit/audit-layer-calls.ts` | 跨层调用扫描 |
| `scripts/other/inject-frontmatter.ts` | Frontmatter 批量注入 |
| `scripts/other/validate-data-consistency.ts` | 数据一致性校验 |
| `scripts/other/regression_news_v6.py` | 回归测试 (Python) |
| `scripts/other/regression_news_v6_test.cjs` | 回归测试 (Node) |
| `scripts/other/run_browser_test.ps1` | 浏览器测试脚本 |
| `scripts/test-tool/test-news-v6.cjs` | E2E 测试 |

### 4.8 后端服务

| 文件 | 说明 |
|------|------|
| `python/data_service/collect_endpoints.py` | FastAPI 数据采集服务 |
| `python/data_service/requirements.txt` | Python 依赖 |

---

## 五、清理统计汇总

| 优先级 | 数量 | 节省文件数 |
|--------|------|-----------|
| 高优先级（临时产物） | 5 项 | ~70 文件 |
| 中优先级（迁移/废弃） | 21 项 | ~21 文件 |
| 低优先级（过程性/旧版） | 27 项 | ~31 文件 |
| 可选（虚拟环境） | 1 项 | ~数百文件 |
| **合计** | **54 项** | **~120+ 文件** |

> 注：高优先级中 `.playwright-mcp/` 含 49 个文件，`.venv/` 为整个虚拟环境目录。

---

## 六、执行记录

> 执行时间：2026-06-29
> 操作方式：仅删除文件/目录，未调整目录结构，未新建文件夹

### 已完成

| 步骤 | 操作 | 删除数 | 状态 |
|------|------|--------|------|
| 1 | 删除 `.playwright-mcp/` 目录（49 个调试快照） | 49 | ? |
| 2 | 删除 `screenshots/` 目录（16 个迁移截图） | 16 | ? |
| 3 | 删除 `scripts/component-audit-data.json` + `component-audit-report.txt` | 2 | ? |
| 4 | 删除 `docs/audit/assets/__pycache__/` | 1 | ? |
| 5 | 删除根目录迁移文档（NewsPage-PoC、迁移验收、最佳实践、fix-report） | 4 | ? |
| 6 | 删除 `scripts/fix/apply-multi-match-fixes.ts` | 1 | ? |
| 7 | 删除 `docs/explanation/implementation/deprecated/` 全部 9 个废弃文档 | 9 | ? |
| 8 | 删除 5 个旧版重复文档（audit/V9资产清单、V9数据字典v1.0、架构缺陷清单、implementation/副本gap-analysis、docs/RELEASE_NOTES） | 5 | ? |
| 9 | 删除 `docs/audit/report-1~5` 快照报告 | 5 | ? |
| 10 | 删除 `docs/explanation/implementation/completeness-profile-batch1~5` | 5 | ? |
| 11 | 删除 batch-merge-reports + batchB/D/E-fix-plan | 4 | ? |
| 12 | 删除 dual-strategy-divergence-list、gap-analysis、migration-news-useState、ui-only-summary、cockpit-news-doc-fix-plan | 5 | ? |
| 13 | 删除 v9-current-state-review、freshness-alerts、health-report、timeline-report、architecture-version-comparison | 5 | ? |
| 14 | 删除 refactor-impact-analysis-2026-06-27、quality-audit-plan | 2 | ? |
| **合计（第一批）** | | **113** | ? |

### 补充执行（第二批）

| 步骤 | 操作 | 删除数 | 状态 |
|------|------|--------|------|
| 15 | 删除 `.venv/` Python 虚拟环境（可重建） | ~90 | ? |
| 16 | 删除 `docs/audit/report-6~12`（7 份审计快照报告） | 7 | ? |
| 17 | 删除 `../archive/code-completeness-test-report.md` | 1 | ? |
| 18 | 删除 `../explanation/ai-center-vue3-examples.md`（项目已用 React/TS，Vue3 示例无效） | 1 | ? |
| **合计（第二批）** | | **~99** | ? |

### 保留未删

| 项目 | 理由 |
|------|------|
| `../reports/changelogs/CHANGELOG.md` ? `CHANGELOG.md`（根目录） | 两者定位不同（架构变更日志 vs SemVer 更新日志），均保留 |

### 最终验证结果

- `.playwright-mcp/` 目录已不存在 ?
- `screenshots/` 目录已不存在 ?
- `.venv/` 目录已不存在 ?
- `docs/explanation/implementation/deprecated/` 目录已清空 ?
- `docs/audit/` 仅剩图表资产（chart_*.png、dynamic_analysis_report.json）和 assets/ 子目录 ?
- `../explanation/ai-center-vue3-examples.md` 已不存在 ?
- 核心保留文件完好：`release-notes.md`(根)、`../explanation/design/v6pro-v9-gap-analysis-final.md`、`./v9核心数据字典与类型定义(整合版).md`、`./v9-system-blueprint.md` ?

### 第三批：文档断裂链接修复（2026-06-29）

> 因删除文件导致其他文档中的 Markdown 链接失效，已全部修复

| # | 文档 | 修复数 | 状态 |
|---|------|--------|------|
| 1 | `../explanation/design/00-readme.md` | 18 处 | ? |
| 2 | `../explanation/design/v9现有数据资产清单.md` | 9 处 | ? |
| 3 | `../reports/retrospectives/doc-sync-execution-plan.md` | 4 处 | ? |
| 4 | `./changelogs/变更摘要-2026-06-28-phase0-数据层改造.md` | 2 处 | ? |
| 5 | `./数据治理路线图.md` | 3 处 | ? |
| 6 | `./v9数据宪法.md` | 1 处 | ? |
| 7 | `./news-contract.md` | 1 处 | ? |
| 8 | `./databridge端点与数据映射清单.md` | 1 处 | ? |
| 9 | `../reports/changelogs/CHANGELOG.md` | 2 处 | ? |
| 10 | `docs/README.md` | 2 处 | ? |
| 11 | `./action-list.md` | 1 处 | ? |
| **合计** | | **~44 处** | ? |

### .gitignore 修复

| 修复项 | 状态 |
|--------|------|
| 添加 `.venv/`、`venv/`、`__pycache__/`、`*.pyc` 忽略规则 | ? |
| 移除 `/*.md`（过于宽泛，会忽略 README 等重要文件） | ? |
| 添加精确的临时报告文件名模式（`*.report.md`、`*.audit.md`、`report-*.md`） | ? |
| 删除冗余 `temp/backup/`（已被 `temp/` 覆盖） | ? |

### 总计

| 批次 | 删除文件/目录数 |
|------|---------------|
| 第一批（高+中+低优先级） | 113 |
| 第二批（补充执行） | ~99 |
| **总计** | **~212** |
