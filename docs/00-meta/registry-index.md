---
title: 文档注册索引
tier: core
code_version: 2.0.0
---

# 文档注册索引

> 本索引由 `doc-manifest.csv` 派生。编号仅用于查阅/审计，文档间引用请用 slug（文件名）。
> 改编号只改 CSV 1 份文件，零文档影响。`npm run doc:manifest` 可重建。

## 编号规则

| 层级 | 前缀 | 序号 | 示例 | 说明 |
|------|------|------|------|------|
| 核心 | C | 2位 | C-01 | 治理/契约/事实源，变更需评审 |
| 重要 | I | 2位 | I-01 | 开发规范/指南，变更需 review |
| 参考 | R | 3位 | R-001 | 历史报告/ADR，只读归档 |

## 类目

| 代码 | 含义 | 代码 | 含义 |
|------|------|------|------|
| GOV | 治理 | ARC | 架构 |
| DAT | 数据 | API | 契约 |
| GUIDE | 指南 | SPEC | 规格 |
| ADR | 决策 | RPT | 报告 |
| LOG | 日志 | SEC | 安全 |
| PERF | 性能 | DESIGN | 设计 |
| UI | 界面 | TEST | 测试 |
| AI | AI | MCP | MCP |
| MIGR | 迁移 | MISC | 其他 |

## 🔴 核心（必读，变更需评审）（71 份）

| 编号 | 类目 | 标题 | 关注点 | 引用→ | 被引用← | 文档链接 |
|------|------|------|--------|-------|---------|----------|
| C-01 | AI | V9 AI 索引缓存（.ai-index） | 定位**：存放供 AI Agent 快速加载的项目知识缓存，降低每次对话重复解析 | - | C-37 | [README.md](../00-meta/ai-index/.ai-index/README.md) |
| C-02 | AI | 增强提示词：多源信息合并去重（最新优先 / 冲突覆盖） | 用途**：将多个数据源（同名或同主题文件）的信息合并为一份去重且完整的产物。 | - | C-37,I-82 | [prompt-merge-dedup.md](../00-meta/prompt-merge-dedup.md) |
| C-03 | API | ADR-003: DataBridge 替代直接 dataLayer 写入 | 状态**: Accepted | - | C-37,I-82 | [adr-003-databridge-over-direct-datalayer.md](../reference/adr-003-databridge-over-direct-datalayer.md) |
| C-04 | API | ADR-003: DataBridge 替代直接 dataLayer 写入 | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-21-databridge-over-direct-datalayer.md](../reference/project/2026-06-21-databridge-over-direct-datalayer.md) |
| C-05 | API | DataBridge 改进建议整改实施计划 | 文档结束** | - | C-37,I-10,I-80,I-82,R-037 | [databridge改进建议整改实施计划.md](../reference/databridge改进建议整改实施计划.md) |
| C-06 | API | DataBridge 端点与数据映射清单 | 文档版本**：v1.2.0 | - | C-37,I-80,I-81,I-82,R-037 | [databridge端点与数据映射清单.md](../reference/databridge端点与数据映射清单.md) |
| C-07 | API | databridge.ts 详细分拆方案 | 版本**: v1.0 | **日期**: 2026-07-07 | - | C-37,I-80,I-82,R-037 | [databridge-split-plan.md](../reference/databridge-split-plan.md) |
| C-08 | API | 交易持仓管理模块 API 契约文档 | Version**: v1.2.0 | - | C-37,I-80,I-82,R-037 | [api-contract.md](../reference/api-contract.md) |
| C-09 | API | 交易持仓管理模块 API 契约文档 | Version**: v1.1.0 | - | C-37,I-81 | [api-contract.md](../reference/trade/api-contract.md) |
| C-10 | API | 功能模块分类图示与开发者必读清单 | 本文档按功能模块对 docs/ 下 596 份文档进行分类，每个模块配备颜色标注 | - | C-37 | [functional-module-guide.md](../00-meta/functional-module-guide.md) |
| C-11 | API | 技术日志：DataBridge.query() 实现与 dataLayer 读操 | 先帮我运行 tsc --noEmit 验证一下当前已修改的代码有没有类型错误；然 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-databridge-query-implementation.md](../reference/changelogs/2026-07/2026-07-05-databridge-query-implementation.md) |
| C-12 | ARC | 03. 架构标准 | Status**: Current | - | C-37,I-179,I-81,R-116 | [03-architecture-standards.md](../reference/03-architecture-standards.md) |
| C-13 | ARC | V9 架构 Phase 4 一致性验证报告 | - | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v9-architecture-data-dictionary-validation-report.md](../reference/v9-architecture-data-dictionary-validation-report.md) |
| C-14 | DAT | AI 智能体调度中心 / 健康监控 / 诊断分析 — 数据字典 | Version**: v1.2.0 | - | C-37,I-81 | [ai-center-data-definition.md](../reference/ai-center-data-definition.md) |
| C-15 | DAT | Cockpit Widget 框架数据字典 | Version**: v1.2.0 | - | C-37,I-81 | [data-definition.md](../reference/cockpit/data-definition.md) |
| C-16 | DAT | data-definition.md — V9 主数据字典（整合版） | Version**: v2.0.0（整合版） | - | C-37 | [data-definition.md](../reference/data-definition.md) |
| C-17 | DAT | DEPRECATED - backtest-data-definition.md | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-80,I-81,I-82,R-037 | [backtest-data-definition.md](../reference/backtest-data-definition.md) |
| C-18 | DAT | DEPRECATED - risk-derived-data-definitio | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-80,I-82,R-037 | [risk-derived-data-definition.md](../reference/risk-derived-data-definition.md) |
| C-19 | DAT | NewsPage（智能资讯中心）数据字典 | 版本**：v1.0.0 | - | C-37 | [news-data-definition.md](../reference/news-data-definition.md) |
| C-20 | DAT | V9 数据字典索引（DATA_DICTIONARY_INDEX） | 定位**：所有 `DATA_DEFINITION*` 文档的**唯一索引**（S | - | C-37,I-81 | [data-dictionary-index.md](../reference/data-dictionary-index.md) |
| C-21 | DAT | 七维采集配置模块 — 数据字典 | Version**: v1.0.0 | - | C-37 | [seven-dim-config-data-definition.md](../reference/seven-dim-config-data-definition.md) |
| C-22 | DAT | 多因子选股筛选器数据字典 | 版本**：v1.0.0 | - | C-37 | [multi-factor-screening-data-definition.md](../reference/multi-factor-screening-data-definition.md) |
| C-23 | DAT | 数据流引擎（DataFlow Engine）数据字典 | Status**: Current | - | C-37,I-81 | [dataflow-data-definition.md](../reference/dataflow-data-definition.md) |
| C-24 | DAT | 数据采集模块数据字典 | Version**: v1.2.0 | - | C-37,I-81 | [data-definition.md](../reference/data-collection/data-definition.md) |
| C-25 | DAT | 新闻资讯模块数据字典 | Version**: v1.2.0 | - | C-37,I-81 | [data-definition.md](../reference/news/data-definition.md) |
| C-26 | GOV | FILE-MANAGEMENT-GUIDE 代码清理决策报告 | 生成时间**: 2026-07-20 | - | C-37,I-82 | [file-management-guide-cleanup-decisions.md](../00-meta/file-management-guide-cleanup-decisions.md) |
| C-27 | GOV | file-management-guide.md 体系优化提示词 | 用途: 嵌入 AI 系统提示词，防止文件管理规范漂移 | - | C-37,I-82 | [file-management-guide-optimization-prompt.md](../00-meta/file-management-guide-optimization-prompt.md) |
| C-28 | GOV | file-management-guide.md 修订任务清单 | 生成时间**: 2026-07-20 | C-30 | C-37,I-82 | [file-management-guide-task-list.md](../00-meta/file-management-guide-task-list.md) |
| C-29 | GOV | file-management-guide.md 根因分析与二次开发教训报告 | 生成时间: 2026-07-12 | C-30 | C-37,I-82 | [file-management-guide-rca-report.md](../00-meta/file-management-guide-rca-report.md) |
| C-30 | GOV | V9 文件管理体系 × TRAE 开发习惯 审查评价报告 | ⚠️ **本文档已过时（2026-07-12 标注，N5 治理）**：本报告描述 | - | C-28,C-29,C-37,I-76,I-82 | [trae-file-management-review.md](../00-meta/trae-file-management-review.md) |
| C-31 | GOV | V9 文档治理宪法（GOVERNANCE） | 版本**: v1.0.0 | **日期**: 2026-07-12 | - | C-37,I-185,I-201,I-94 | [governance.md](../00-meta/governance.md) |
| C-32 | GOV | V9 文档迁移计划（A-H 分类体系） | 版本**: v1.0.0 | **日期**: 2026-07-13 | - | C-37,I-82 | [migration-plan.md](../00-meta/migration-plan.md) |
| C-33 | GOV | V9 智能投研复盘系统 — 文档与文件管理体系优化方案 | 版本**: v1.0.0 ｜ **日期**: 2026-07-13 ｜ **作者 | - | C-37,I-185 | [doc-file-management-optimization-plan.md](../00-meta/doc-file-management-optimization-plan.md) |
| C-34 | GOV | V9 目录结构文档审计报告 | Version**: v1.0.0 | C-35 | C-37,I-82 | [directory-structure-audit-report.md](../00-meta/directory-structure-audit-report.md) |
| C-35 | GOV | V9 项目目录结构规范与使用指南 | Version**: v3.1.1 | - | C-34,C-37,C-59,I-185 | [directory-structure-guide.md](../00-meta/directory-structure-guide.md) |
| C-36 | GOV | 文件流浪检查报告 | 生成时间: 2026-07-20 | - | C-37,I-82 | [file-management-guide-file-wandering-report.md](../00-meta/file-management-guide-file-wandering-report.md) |
| C-37 | GOV | 文档注册索引 | 本索引由 `doc-manifest.csv` 派生。编号仅用于查阅/审计，文档 | C-01,C-02,C-03,C-04,C-05,C-06, | C-37,I-185,R-037 | [registry-index.md](../00-meta/registry-index.md) |
| C-38 | GOV | 文档清理周期（CLEANUP_SCHEDULE） | 定位**：定义文档/产物的保留与清理规则，消除「过程产物过度膨胀、无清理规则」缺 | - | C-37,I-82 | [cleanup-schedule.md](../00-meta/cleanup-schedule.md) |
| C-39 | GOV | 触发事件 → 更新动作 一一映射权威表 | 文档日期：2026-07-14（pr-6 Diátaxis 重组后路径同步修订） | - | C-37,I-185 | [doc-trigger-action-map.md](../00-meta/doc-trigger-action-map.md) |
| C-40 | MISC | 23 个核心文档重新检索报告 | 检索方法**：全量文件遍历 + 关键词模糊匹配（排除 node_modules/ | - | C-37,I-82 | [23个核心文档重新检索报告.md](../00-meta/23个核心文档重新检索报告.md) |
| C-41 | MISC | V9 文件系统整改开发日志 | 说明：外部文档导入后，项目文档总数虽然从 ~563 增至 887，但不存在内容完 | R-035 | C-37 | [development-log.md](../00-meta/development-log.md) |
| C-42 | MISC | V9 文档体系修复执行计划 v1.0 | 制定日期**：2026-07-12 | - | C-37,I-82 | [文档体系修复执行计划-v1.md](../00-meta/文档体系修复执行计划-v1.md) |
| C-43 | MISC | V9 文档体系治理 — 下一阶段任务图（P4 执行计划） | 定位**：基于 `docs/00-meta/文档体系体检报告-v9.md`（第3 | - | C-37,I-82 | [v9-next-phase-todo.md](../00-meta/v9-next-phase-todo.md) |
| C-44 | MISC | V9 文档治理整改 — 执行校验报告（P0→P2） | 日期**：2026-07-12 ｜ **执行依据**：`v9-文档治理修复行动计 | - | C-37,I-82 | [执行校验报告.md](../00-meta/执行校验报告.md) |
| C-45 | MISC | V9 文档系统性分类与理解深度核查报告 | 生成日期**：2026-07-12 | - | C-37,I-82 | [文档理解核查报告.md](../00-meta/文档理解核查报告.md) |
| C-46 | MISC | V9 智能投研复盘系统 — 文档治理修复行动计划（Action Plan） | 版本**：v1.0.0 ｜ **日期**：2026-07-12 ｜ **作者** | - | C-37,I-82 | [v9-文档治理修复行动计划.md](../00-meta/v9-文档治理修复行动计划.md) |
| C-47 | MISC | V9 智能投研复盘系统 — 项目健康状态总览 | 版本**：v1.1.0（P0 整改后修订） | - | C-37,I-82 | [v9-项目健康状态总览.md](../00-meta/v9-项目健康状态总览.md) |
| C-48 | MISC | 文档自动更新体系 — 架构梳理、任务检索与完善优化计划 | 文档日期：2026-07-12 | - | C-37,I-82 | [文档自动更新体系-架构梳理与任务清单.md](../00-meta/文档自动更新体系-架构梳理与任务清单.md) |
| C-49 | MISC | 智能投研复盘系统 V9 — 文档归类体系体检报告 | 体检日期**：2026-07-12 | - | C-37,I-82 | [doc-system-check-v9.md](../00-meta/doc-system-check-v9.md) |
| C-50 | MISC | 智能投研复盘系统 V9 — 文档归类体系体检报告 | 体检日期**：2026-07-12 | - | C-37,I-82 | [文档体系体检报告-v9.md](../00-meta/文档体系体检报告-v9.md) |
| C-51 | MISC | 智能投研复盘系统 V9 — 文档归类体系结构（DocTaxonomy V9） | 版本**：v1.1.0（2026-07-12） | - | C-37,I-82 | [文档归类体系结构.md](../00-meta/文档归类体系结构.md) |
| C-52 | MISC | 智能投研复盘系统 V9 — 文档管理系统评分报告 | 版本**：v1.0.0 | - | C-37,I-82 | [文档管理系统评分报告.md](../00-meta/文档管理系统评分报告.md) |
| C-53 | MISC | 月度文档体系体检检查清单 | 定位**：每月运行一次的标准化检查流程，确保文档体系健康度持续达标。 | - | C-37,I-82 | [月度文档体检检查清单.md](../00-meta/月度文档体检检查清单.md) |
| C-54 | RPT | outputs/ 和未定义 src/ 目录评估报告 | 评估时间: 2026-07-12 | - | C-37,I-82 | [outputs-and-undefined-src-evaluation-report.md](../00-meta/outputs-and-undefined-src-evaluation-report.md) |
| C-55 | RPT | P1 二次校对报告 | 日期**：2026-07-14 | - | C-37 | [p1-secondary-verification-report.md](../00-meta/p1-secondary-verification-report.md) |
| C-56 | RPT | P4 系统性目录梳理报告 | 生成日期**: 2026-07-20 | - | C-37,I-82 | [directory-audit-report-v1.4.3.md](../00-meta/directory-audit-report-v1.4.3.md) |
| C-57 | RPT | P5 验证报告 — 系统性目录梳理收尾 | 验证日期**: 2026-07-20 | - | C-37,I-82 | [p5-verification-report.md](../00-meta/p5-verification-report.md) |
| C-58 | RPT | src/databridge/ 和 src/utils/ 评估报告 | 评估时间: 2026-07-12 | - | C-37,I-82 | [src-directories-evaluation-report.md](../00-meta/src-directories-evaluation-report.md) |
| C-59 | RPT | V9 上线前系统性梳理报告 | 日期**: 2026-07-13 | C-35,C-65,C-66,R-043,R-117 | C-37,I-82 | [v9-pre-launch-audit-report-20260713.md](../00-meta/v9-pre-launch-audit-report-20260713.md) |
| C-60 | RPT | V9 文件系统全面评估报告 | - | - | C-37 | [file-system-assessment-v2.md](../00-meta/file-system-assessment-v2.md) |
| C-61 | RPT | V9 智能投研复盘系统 — 23个核心文档 · 二次校对最终报告 | 报告生成时间**：2026-07-12 | - | C-37,I-82 | [23-core-docs-v2-final-report.md](../00-meta/23-core-docs-v2-final-report.md) |
| C-62 | RPT | V9 智能投研复盘系统 — 23个核心文档 · 最终检索核实报告 | 报告生成时间**：2026-07-12 | - | C-37,I-82 | [23-core-docs-final-verification-report.md](../00-meta/23-core-docs-final-verification-report.md) |
| C-63 | RPT | 提示词：V9 文档治理与文件结构整改执行（P0→P3，AI Agent 集群协同 | 用途：作为可复用的元提示词（meta-prompt），驱动 AI 在「V9 智能 | - | C-37,I-82 | [prompt-execute-remediation.md](../00-meta/prompt-execute-remediation.md) |
| C-64 | RPT | 文档自动更新体系 — 任务看板（单一事实源） | 文档日期：2026-07-12（M1 收尾 + 维度二审查后建立） | - | C-37,I-82 | [doc-auto-update-kanban.md](../00-meta/doc-auto-update-kanban.md) |
| C-65 | RPT | 目录结构文档 — TODO 清单（诊断阶段交付物 2/2） | 阶段**：第一阶段产出 → 第二阶段执行完成 | - | C-37,C-59,I-82 | [directory-audit-todo.md](../00-meta/directory-audit-todo.md) |
| C-66 | RPT | 目录结构文档 — 整体可行性方案（诊断阶段交付物 1/2） | 阶段**：第一阶段 · 现状摸底（诊断）→ 第二阶段 · 执行完成 | - | C-37,C-59,I-82 | [directory-audit-feasibility-plan.md](../00-meta/directory-audit-feasibility-plan.md) |
| C-67 | SPEC | 05. 引擎规格 | Status**: Current | - | C-37,I-199,I-200,I-201,I-215,I | [05-engine-specs.md](../reference/05-engine-specs.md) |
| C-68 | SPEC | 06. 路由规格 | Status**: Current | - | C-37,I-81,R-029 | [06-routing-specs.md](../reference/06-routing-specs.md) |
| C-69 | SPEC | 09. 质量门禁 | Status**: Current | I-236 | C-37,I-81 | [09-quality-gates.md](../reference/09-quality-gates.md) |
| C-70 | SPEC | V9 数据流规范 | 版本：v0.9.14 P6-DATA | I-179,I-296,I-44,I-52,I-59 | C-37 | [data-flow-spec.md](../reference/data-flow-spec.md) |
| C-71 | SPEC | V9 智能投研复盘系统 — 23个核心文档 · 功能匹配最终报告 | 报告生成时间**：2026-07-12 | - | C-37,I-82 | [23-core-docs-functional-match-report.md](../00-meta/23-core-docs-functional-match-report.md) |

## 🟡 重要（开发查阅）（302 份）

| 编号 | 类目 | 标题 | 关注点 | 引用→ | 被引用← | 文档链接 |
|------|------|------|--------|-------|---------|----------|
| I-01 | ADR | ADR-013: MCP Server 生命周期管理 SOP | - | - | C-37,I-82 | [adr-mcp-server-lifecycle.md](../reference/adr-mcp-server-lifecycle.md) |
| I-02 | AI | AI Engineering Governance — V9 智能投研复盘系统 | 版本**: v1.0.0 | **日期**: 2026-07-10 | - | C-37 | [README.md](../prompts/README.md) |
| I-03 | AI | 项目专属 AI 记忆层（RAG） | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37,I-80,I-82,R-037 | [ai-memory-layer.md](../explanation/ai-memory-layer.md) |
| I-04 | AI | 项目专属 AI 记忆层（RAG） | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37 | [ai-memory-layer.md](../reference/ai-memory-layer.md) |
| I-05 | API | ai-center-contract.md — AI 中心接口契约 | 定位**：定义 `ai-center` 子域的接口契约、职责边界、数据流与依赖关 | - | C-37,I-82 | [ai-center-contract.md](../reference/ai-center-contract.md) |
| I-06 | API | analysis-contract.md — 投研分析核心子域接口契约 | 定位**：定义 `analysis` 子域的接口契约、职责边界、数据流与依赖关系 | - | C-37,I-82 | [analysis-contract.md](../reference/analysis-contract.md) |
| I-07 | API | backtest-contract.md — 回测引擎接口契约 | 定位**：定义 `backtest` 子域的接口契约、职责边界、数据流与依赖关系 | - | C-37,I-82 | [backtest-contract.md](../reference/backtest-contract.md) |
| I-08 | API | collection-contract.md — 数据采集子域接口契约 | 定位**：定义 `collection` 子域的接口契约、职责边界、数据流与依赖 | - | C-37,I-82 | [collection-contract.md](../reference/collection-contract.md) |
| I-09 | API | data-collector-contract.md — 数据采集编排服务 | 定位**：协调 fetcher 服务执行数据采集任务，管理采集管道、质量检测、缺 | - | C-37,I-82 | [data-collector-contract.md](../reference/data-collector-contract.md) |
| I-10 | API | DataBridge 改进建议整改报告 | 文档结束** | C-05,I-10 | C-37,I-10,I-80,I-82,R-037 | [databridge改进建议整改报告.md](../explanation/design/databridge改进建议整改报告.md) |
| I-11 | API | DataBridge 数据链路全景分析报告 | 文档结束** | - | C-37,I-80,I-82,R-037 | [databridge数据链路全景分析报告.md](../explanation/design/databridge数据链路全景分析报告.md) |
| I-12 | API | execution-contract.md — 交易执行子域接口契约 | 定位**：定义 `execution` 子域的接口契约、职责边界、数据流与依赖关 | - | C-37,I-82 | [execution-contract.md](../reference/execution-contract.md) |
| I-13 | API | export-contract.md — 导出服务接口契约 | 定位**：定义 `export` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [export-contract.md](../reference/export-contract.md) |
| I-14 | API | fetcher-contract.md — 行情/资讯抓取服务 | 定位**：统一外部行情/资讯 API 适配层，负责采集、限流、缓存、错误恢复。 | - | C-37,I-82 | [fetcher-contract.md](../reference/fetcher-contract.md) |
| I-15 | API | hybrid-proofread-contract.md — 混合校对（人机协同 | 定位**：定义 `hybrid-proofread` 子域的接口契约、职责边界、 | - | C-37,I-82 | [hybrid-proofread-contract.md](../reference/hybrid-proofread-contract.md) |
| I-16 | API | input-contract.md — 输入处理子域接口契约 | 定位**：定义 `input` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [input-contract.md](../reference/input-contract.md) |
| I-17 | API | llm-contract.md — 大模型服务接口契约 | 定位**：定义 `llm` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [llm-contract.md](../reference/llm-contract.md) |
| I-18 | API | news-contract.md — 新闻资讯子域接口契约 | 定位**：定义 `news` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [news-contract.md](../reference/news-contract.md) |
| I-19 | API | portfolio-contract.md — 投资组合（Portfolio）接 | 定位**：定义 `portfolio` 子域的接口契约、职责边界、数据流与依赖关 | - | C-37,I-82 | [portfolio-contract.md](../reference/portfolio-contract.md) |
| I-20 | API | pwa-contract.md — PWA Service Worker 接口契 | 定位**：定义 `pwa` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [pwa-contract.md](../reference/pwa-contract.md) |
| I-21 | API | rbac-contract.md — RBAC 权限管理子域接口契约 | 定位**：定义 `rbac` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [rbac-contract.md](../reference/rbac-contract.md) |
| I-22 | API | scoring-contract.md — 评分引擎服务 | 定位**：V9 核心投研评分引擎，包含 v6 五因子评分、热门板块/价值洼地双策 | - | C-37,I-82 | [scoring-contract.md](../reference/scoring-contract.md) |
| I-23 | API | screening-contract.md — 选股/筛选子域接口契约 | 定位**：定义 `screening` 子域的接口契约、职责边界、数据流与依赖关 | - | C-37,I-82 | [screening-contract.md](../reference/screening-contract.md) |
| I-24 | API | stock-analysis-contract.md — 个股分析子域接口契约 | 定位**：定义 `stock-analysis` 子域的接口契约、职责边界、数据 | - | C-37,I-82 | [stock-analysis-contract.md](../reference/stock-analysis-contract.md) |
| I-25 | API | stockpool-contract.md — 股票池管理子域接口契约 | 定位**：定义 `stockpool` 子域的接口契约、职责边界、数据流与依赖关 | - | C-37,I-82 | [stockpool-contract.md](../reference/stockpool-contract.md) |
| I-26 | API | system-contract.md — 系统级服务接口契约 | 定位**：定义 `system` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [system-contract.md](../reference/system-contract.md) |
| I-27 | API | trade-contract.md — 交易域接口契约 | 定位**：定义 `trade` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [trade-contract.md](../reference/trade-contract.md) |
| I-28 | API | trading-contract.md — 交易业务子域接口契约 | 定位**：定义 `trading` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [trading-contract.md](../reference/trading-contract.md) |
| I-29 | API | usecase-contract.md — 业务用例编排接口契约 | 定位**：定义 `useCase` 子域的接口契约、职责边界、数据流与依赖关系。 | - | C-37,I-82 | [usecase-contract.md](../reference/usecase-contract.md) |
| I-30 | API | {subdomain}-contract.md — {子域中文名} 接口契约 | 定位**：定义 `{subdomain}` 子域的接口契约、职责边界、数据流与依 | - | C-37 | [_contract-template.md](../reference/_contract-template.md) |
| I-31 | ARC | 03. 架构标准 | Status**: Current | - | C-37,I-118,I-181,I-182,I-199,I | [03-architecture-standards.md](../explanation/03-architecture-standards.md) |
| I-32 | ARC | V10 架构白皮书与 V9 对齐报告 | Status: Future Reference / Deferred** | - | C-37,I-177,I-80,I-81,I-82 | [v10-architecture-alignment.md](../explanation/v10-architecture-alignment.md) |
| I-33 | ARC | V10 架构白皮书与 V9 对齐报告 | Status: Future Reference / Deferred** | - | C-37,I-242 | [v10-architecture-alignment.md](../reference/v10-architecture-alignment.md) |
| I-34 | ARC | V9 策略架构文档 | Status**: Active | C-67,I-199,I-215,I-226,I-228,I | C-37,I-199,I-63,I-81,I-82,R-03 | [v9-strategy-architecture.md](../explanation/v9-strategy-architecture.md) |
| I-35 | ARC | V9 策略架构文档 | Status**: Active | C-67,I-200,I-215,I-226,I-228,I | C-37,I-200,I-215,I-226,I-228,I | [v9-strategy-architecture.md](../explanation/design/v9-strategy-architecture.md) |
| I-36 | ARC | 数据采集模块架构设计 | Status**: Current | - | C-37,I-81,I-82,R-037 | [data-collection-architecture.md](../explanation/data-collection-architecture.md) |
| I-37 | ARC | 数据采集模块架构设计 | Status**: Current | - | C-37,I-177,I-80 | [data-collection-architecture.md](../explanation/design/data-collection-architecture.md) |
| I-38 | ARC | 智能投研复盘系统 V9 — 系统架构与设计文档 | 版本**：v1.0 · **日期**：2026-07-12 | - | C-37,I-93 | [system-architecture.md](../explanation/system-architecture.md) |
| I-39 | ARC | 智能投研复盘系统 V9 — 驾驶舱 Widget 架构说明 | 本文档面向后续接入的 AI 智能体与研发人员，说明驾驶舱（Cockpit）Wid | - | C-37,I-146,I-185,I-65,I-82,I-9 | [architecture.md](../explanation/architecture.md) |
| I-40 | ARC | 架构设计文档版本比对 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82 | [architecture-version-comparison.md](../explanation/architecture-version-comparison.md) |
| I-41 | ARC | 架构设计文档版本比对 | Status**: Current | - | C-37 | [architecture-version-comparison.md](../reference/architecture-version-comparison.md) |
| I-42 | DAT | AI 智能体调度中心 / 健康监控 / 诊断分析 — 数据字典 | Version**: v1.2.0 | - | C-37,I-80 | [ai-center-data-definition.md](../explanation/design/ai-center-data-definition.md) |
| I-43 | DAT | Cockpit Widget 框架数据字典 | Version**: v1.2.0 | - | C-37,I-185,I-80,I-82,R-037 | [data-definition.md](../explanation/design/data-definition.md) |
| I-44 | DAT | DataFlow Engine 实现规格 | Status**: Current | - | C-37,C-70,I-177,I-271,I-80,I-8 | [dataflow-engine-spec.md](../reference/dataflow-engine-spec.md) |
| I-45 | DAT | DEPRECATED - ai-center-data-definition.m | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-82,R-037 | [ai-center-data-definition.md](../explanation/ai-center-data-definition.md) |
| I-46 | DAT | DEPRECATED - dataflow-data-definition.md | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-82,R-037 | [dataflow-data-definition.md](../explanation/dataflow-data-definition.md) |
| I-47 | DAT | DEPRECATED - multi-factor-screening-data | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-80,I-81,I-82,R-037 | [multi-factor-screening-data-definition.md](../explanation/multi-factor-screening-data-definition.md) |
| I-48 | DAT | DEPRECATED - news-data-definition.md | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-80,I-81,I-82,R-037 | [news-data-definition.md](../explanation/news-data-definition.md) |
| I-49 | DAT | DEPRECATED - seven-dim-config-data-defin | ⚠️ **此文件已废弃**（2026-07-14） | - | C-37,I-80,I-81,I-82,R-037 | [seven-dim-config-data-definition.md](../explanation/seven-dim-config-data-definition.md) |
| I-50 | DAT | NewsPage（智能资讯中心）数据字典 | 版本**：v1.0.0 | - | C-37 | [news-data-definition.md](../explanation/design/news-data-definition.md) |
| I-51 | DAT | V9 双策略体系与数据流架构规格 | Status**: Proposal / 待校对 | - | C-37,I-271,I-34,I-35,I-80,I-81 | [dual-strategy-dataflow-spec.md](../explanation/design/dual-strategy-dataflow-spec.md) |
| I-52 | DAT | V9 双策略体系与数据流架构规格 | Status**: Proposal / 待校对 | - | C-37,C-70 | [dual-strategy-dataflow-spec.md](../reference/dual-strategy-dataflow-spec.md) |
| I-53 | DAT | V9 数据关系蓝图任务跟踪计划 | Goal:** 确保 `docs/blueprints/` 中的数据关系与时间关 | - | C-37,I-80,I-81,I-82,R-037 | [v9-data-blueprint-task-tracking.md](../explanation/design/v9-data-blueprint-task-tracking.md) |
| I-54 | DAT | V9 数据字典索引 | Status**: Current | - | C-37,I-179,I-181,I-182,I-185,I | [data-dictionary-index.md](../explanation/design/data-dictionary-index.md) |
| I-55 | DAT | V9 数据层总览 | 定位**：本文档是 `src/data/` 与 `src/core/databr | C-67,I-232,I-54 | C-37,I-82 | [data-layer-overview.md](../explanation/data-layer-overview.md) |
| I-56 | DAT | V9 数据库实体关系蓝图 (ER) | Status**: Current | - | C-37,I-80,I-81,I-82,R-037 | [v9-data-relationship-er.md](../explanation/v9-data-relationship-er.md) |
| I-57 | DAT | V9 数据时间关系与生命周期蓝图 | Status**: Current | - | C-37,I-80,I-81,I-82,R-037 | [v9-data-timeline.md](../reference/v9-data-timeline.md) |
| I-58 | DAT | 多因子选股筛选器数据字典 | 版本**：v1.0.0 | - | C-37 | [multi-factor-screening-data-definition.md](../explanation/design/multi-factor-screening-data-definition.md) |
| I-59 | DAT | 数据交互协议 | Status**: Current | - | C-37,C-70,I-177,I-179,I-271,I- | [data-interaction-protocols.md](../reference/data-interaction-protocols.md) |
| I-60 | DAT | 数据流引擎（DataFlow Engine）数据字典 | Status**: Current | - | C-37,I-80 | [dataflow-data-definition.md](../explanation/design/dataflow-data-definition.md) |
| I-61 | DAT | 数据采集功能差距分析报告 | 基于F盘投资赛道分析文档与V9项目实际代码实现的全面比对 | - | C-37,I-80,I-81,I-82,R-037 | [data-collection-gap-analysis.md](../explanation/design/data-collection-gap-analysis.md) |
| I-62 | DAT | 数据采集模块开发任务清单 | 基于差距分析报告 + 路由UI校对报告 + 用户需求 | - | C-37,I-80,I-81,I-82,R-037 | [data-collection-task-list.md](../reference/data-collection-task-list.md) |
| I-63 | DESIGN | Design Tokens 系统使用指南 | - | I-34 | C-37,I-82,R-037 | [design-tokens.md](../explanation/design-tokens.md) |
| I-64 | DESIGN | Design Tokens 系统使用指南 | - | I-35 | C-37,I-80 | [design-tokens.md](../explanation/design/design-tokens.md) |
| I-65 | DESIGN | Design Tokens 系统使用指南 | - | I-39 | C-37,I-81 | [design-tokens.md](../reference/design-tokens.md) |
| I-66 | DESIGN | V6 Pro UI / Page 吸收落地总结（仅 UI 展示层，不动数据架构） | Status**: Implemented | - | C-37,I-81,I-82,R-037 | [ui-only-implementation-summary.md](../explanation/ui-only-implementation-summary.md) |
| I-67 | DESIGN | V6 Pro UI / Page 吸收落地总结（仅 UI 展示层，不动数据架构） | Status**: Implemented | - | C-37,I-177,I-80 | [ui-only-implementation-summary.md](../explanation/design/ui-only-implementation-summary.md) |
| I-68 | DESIGN | V9 UI 设计优化分布式 AGENT 任务执行清单 | 聚合来源：`../reference/ui设计优化实施计划-详细版.md`（v3.0） | - | C-37,I-82,R-037 | [ui-design-agent-execution-plan.md](../explanation/ui-design-agent-execution-plan.md) |
| I-69 | DESIGN | V9 UI 设计优化分布式 AGENT 任务执行清单 | 聚合来源：`../reference/ui设计优化实施计划-详细版.md`（v3.0） | - | C-37,I-80 | [ui-design-agent-execution-plan.md](../explanation/design/ui-design-agent-execution-plan.md) |
| I-70 | DESIGN | V9 UI 设计系统 | Status**: Current | - | C-37,I-80,I-81,I-82,R-037,R-11 | [ui-design-system.md](../explanation/design/ui-design-system.md) |
| I-71 | DESIGN | V9 设计令牌映射表 | 文档编号**: DOC-TOKENS-002 | - | C-37,I-80,I-82,R-037 | [design-token-mapping.md](../reference/design-token-mapping.md) |
| I-72 | DESIGN | V9 间距令牌规范（Spacing Tokens） | 版本**: v0.9.14 P5-SPACE | - | C-37,I-80,I-81,I-82,R-037 | [spacing-tokens.md](../explanation/design/spacing-tokens.md) |
| I-73 | DESIGN | 令牌使用 Cookbook（token-usage-cookbook） | 定位**：`../reference/design-token-mapping. | - | C-37,I-82 | [token-usage-cookbook.md](../explanation/token-usage-cookbook.md) |
| I-74 | DESIGN | 宋韵美学设计指南（Song Aesthetics） | 定位**：定义 V9 的「宋韵美学」视觉语言，补 H 类设计指南缺口（P2-2） | - | C-37,I-82 | [song-aesthetics.md](../explanation/song-aesthetics.md) |
| I-75 | DESIGN | 无障碍与国际化指南（A11y & i18n） | 定位**：定义 V9 的无障碍（A11y）与国际化（i18n）基线，补 H 类指 | - | C-37,I-82 | [a11y-i18n.md](../explanation/a11y-i18n.md) |
| I-76 | GOV | V9 文件管理规范 | 版本**: v1.4.0 | **日期**: 2026-07-20 | C-30,I-137 | C-37,I-263,I-82 | [file-management-guide.md](../how-to/file-management-guide.md) |
| I-77 | GOV | 代码复杂度专项治理规范 | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37 | [complexity-governance.md](../reference/complexity-governance.md) |
| I-78 | GOV | 代码复杂度治理规范 | 版本**: v1.0.0 | **日期**: 2026-07-13 | - | C-37,I-185,I-80,I-82,R-037 | [complexity-governance.md](../explanation/complexity-governance.md) |
| I-79 | GOV | 实施治理与架构决策记录 | Status**: Current | - | C-37,I-100,I-177,I-80,I-81,I-8 | [implementation-governance.md](../explanation/design/implementation-governance.md) |
| I-80 | GOV | 文档索引 | 本文件由每日文档验证流程自动生成，请勿手动修改。 | C-04,C-05,C-06,C-07,C-08,C-11, | C-37,I-80 | [registry-index.md](../explanation/design/registry-index.md) |
| I-81 | GOV | 文档索引 | 本文件由每日文档验证流程自动生成，请勿手动修改。 | C-04,C-06,C-09,C-11,C-12,C-13, | C-37,I-81 | [registry-index.md](../reference/registry-index.md) |
| I-82 | GOV | 文档索引 | 本文件由每日文档验证流程自动生成，请勿手动修改。 | C-02,C-03,C-04,C-05,C-06,C-07, | C-37 | [registry-index.md](../reference/meta/registry-index.md) |
| I-83 | GOV | 触发事件 → 更新动作 一一映射权威表 | 文档日期：2026-07-12（N2/N3 修订） | - | C-37 | [doc-trigger-action-map.md](../reference/meta/doc-trigger-action-map.md) |
| I-84 | GUIDE | MCP 权限控制开发指南 | 版本**: v1.0.0 | **日期**: 2026-07-08 | - | C-37,I-80,I-82,R-037 | [mcp-acl-guide.md](../how-to/mcp-acl-guide.md) |
| I-85 | GUIDE | Service 集成开发指南 | 定位**：本文是 `src/services/` 层的新增/维护 Service | I-105,I-106,I-191,I-198,I-232 | C-37,I-82 | [service-integration-guide.md](../prompts/service-integration-guide.md) |
| I-86 | GUIDE | Store 集成开发指南 | 定位**：本文档是 `src/store/` 目录的**权威开发指南**，指导开 | - | C-37,I-82 | [store-integration-guide.md](../prompts/store-integration-guide.md) |
| I-87 | GUIDE | UI 组件迁移检查清单 | 适用于跨舱、跨目录、跨模块的 UI 组件迁移或重构，确保引用关系无遗漏、质量门禁 | - | C-37,I-80,I-82,R-037 | [ui-migration-checklist.md](../reference/ui-migration-checklist.md) |
| I-88 | GUIDE | V9 PWA 离线化实施指南 | 对应蓝图**：`../reference/v9-system-blueprint | - | C-37,I-80,I-81,I-82,R-037 | [pwa-offline-guide.md](../how-to/pwa-offline-guide.md) |
| I-89 | GUIDE | V9 PWA 离线化实施指南 | 对应蓝图**：`../reference/v9-system-blueprint.md` §1 系统定 | - | C-37 | [pwa-offline-guide.md](../reference/pwa-offline-guide.md) |
| I-90 | GUIDE | V9 UI 组件库使用指南 | 版本：v1.0.0（P6-UI 组件库完善 + 无障碍增强） | - | C-37,I-80,I-81,I-82,R-037 | [component-library-guide.md](../explanation/design/component-library-guide.md) |
| I-91 | GUIDE | V9 三层测试策略 | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37,I-185,I-80,I-82,R-037 | [testing-strategy.md](../how-to/testing/testing-strategy.md) |
| I-92 | GUIDE | V9 无障碍（Accessibility）检查清单 | - | - | C-37,I-80,I-81,I-82,R-037 | [a11y-checklist.md](../explanation/a11y-checklist.md) |
| I-93 | GUIDE | V9 智能投研复盘系统 · 测试前准备清单 | 版本**: v1.0.0 ｜ **更新日期**: 2026-07-15 ｜ ** | I-104,I-109,I-165,I-197,I-281, | C-37,I-242 | [pre-testing-checklist.md](../04-testing/pre-testing-checklist.md) |
| I-94 | GUIDE | V9 智能投研复盘系统 — 开发工作流 SOP | 文档体系版本**: v2.0.0 | **本文档修订**: rev.1 | ** | C-31,I-39 | C-37,I-185,I-82 | [development-workflow-sop.md](../reference/development-workflow-sop.md) |
| I-95 | GUIDE | V9 智能投研复盘系统 — 新成员 30 分钟上手指南 | 版本**：v1.0.0 | - | C-37,I-82 | [getting-started.md](../tutorials/getting-started.md) |
| I-96 | GUIDE | V9 模块完成度剖面图 — 批次 B（输入舱） | 审计范围**：输入舱 6 个子页面 | - | C-37 | [completeness-profile-batch2.md](../how-to/testing/completeness-profile-batch2.md) |
| I-97 | GUIDE | V9 自主工作流优化策略 | 版本**: v1.0.0 | **日期**: 2026-07-04 | I-119,I-254,I-79 | C-37,I-100,I-80,I-81,I-82,R-03 | [autonomous-workflow-optimization.md](../explanation/design/autonomous-workflow-optimization.md) |
| I-98 | GUIDE | V9 自主工作流优化策略 | 版本**: v1.0.0 | **日期**: 2026-07-04 | I-119,I-254,I-79 | C-37,I-99 | [autonomous-workflow-optimization.md](../prompts/autonomous-workflow-optimization.md) |
| I-99 | GUIDE | V9 自主工作流使用指南 | 版本**: v1.0.0 | **日期**: 2026-07-04 | I-254,I-79,I-98 | C-37,I-80,I-81,I-82,R-037 | [autonomous-workflow-user-guide.md](../prompts/autonomous-workflow-user-guide.md) |
| I-100 | GUIDE | V9 自主工作流使用指南 | 版本**: v1.0.0 | **日期**: 2026-07-04 | I-254,I-79,I-97 | C-37 | [autonomous-workflow-user-guide.md](../reference/autonomous-workflow-user-guide.md) |
| I-101 | GUIDE | V9 视觉回归基线管理规范 | 版本**: v1.0.0 | **日期**: 2026-07-12 | - | C-37,I-82 | [visual-regression-guide.md](../how-to/visual-regression-guide.md) |
| I-102 | GUIDE | Widget 开发指南 | 适用范围**：驾驶舱（Cockpit）所有 Widget 组件的开发、注册与集成 | - | C-37,I-298,I-299,I-80,I-82,R-0 | [widget-development-guide.md](../how-to/widget-development-guide.md) |
| I-103 | GUIDE | Widget 开发指南 | 适用范围**：驾驶舱（Cockpit）所有 Widget 组件的开发、注册与集成 | - | C-37,I-81 | [widget-development-guide.md](../reference/widget-development-guide.md) |
| I-104 | GUIDE | 体系化上线测试检查清单 Skill | 版本**: v1.0.1 | **更新日期**: 2026-07-13 | - | C-37,I-82,I-93 | [production-release-checklist-skill.md](../explanation/production-release-checklist-skill.md) |
| I-105 | GUIDE | 如何新增一个 Service（DataBridge + Envelope 路由） | 版本**：v1.0.0 | - | C-37,I-82,I-85 | [how-to-add-service.md](../how-to/how-to-add-service.md) |
| I-106 | GUIDE | 如何新增一个 Store（Zustand + withBroadcast） | 版本**：v1.0.0 | - | C-37,I-82,I-85 | [how-to-add-store.md](../how-to/how-to-add-store.md) |
| I-107 | GUIDE | 如何新增一个 Widget（WidgetShell + 事件总线） | 版本**：v1.0.0 | - | C-37,I-82 | [how-to-add-widget.md](../how-to/how-to-add-widget.md) |
| I-108 | GUIDE | 自定义 Hook 使用指南 | Status**: Current | - | C-37,I-82 | [hooks-guide.md](../how-to/hooks-guide.md) |
| I-109 | GUIDE | 运维与发布手册（Runbook） | 定位**：定义 V9 的本地构建、预览、健康监控与常见故障处置，补 H 类运维缺 | - | C-37,I-201,I-291,I-82,I-93 | [runbook.md](../explanation/runbook.md) |
| I-110 | GUIDE | 驾驶舱 Widget 集成检查清单 | 新增或修改驾驶舱 Widget 时，必须同步完成三处注册，并遵循设计令牌与数据消 | - | C-37,I-80,I-82,R-037 | [widget-integration-checklist.md](../explanation/design/widget-integration-checklist.md) |
| I-111 | GUIDE | 驾驶舱 Widget 集成检查清单 | 新增或修改驾驶舱 Widget 时，必须同步完成三处注册，并遵循设计令牌与数据消 | - | C-37 | [widget-integration-checklist.md](../reference/widget-integration-checklist.md) |
| I-112 | LOG | JSDoc 文档更新清单 - Data Collector 模块 | 日期**: 2026-07-12 | - | C-37 | [jsdoc-update-summary-data-collector-20260712.md](../reference/changelogs/2026-07/jsdoc-update-summary-data-collector-20260712.md) |
| I-113 | LOG | JSDoc 注释补充汇总报告 | 日期**: 2026-07-12 | - | C-37 | [jsdoc-update-summary-20260712.md](../reference/changelogs/2026-07/jsdoc-update-summary-20260712.md) |
| I-114 | LOG | P1 批次完整性画像 — 2026-07-05 | 生成依据：架构雷达扫描 v2.0.0、audit:layers、audit:ha | - | C-37,I-80,I-81,I-82,R-037,R-15 | [completeness-profile-p1.md](../reference/changelogs/2026-07/completeness-profile-p1.md) |
| I-115 | LOG | P1 批次行动清单 — 2026-07-05 | - | - | C-37,I-80,I-81,I-82,R-037,R-15 | [action-list-p1.md](../reference/changelogs/2026-07/action-list-p1.md) |
| I-116 | LOG | PR-5 构建性能优化总结 | 版本**: v1.0 | **日期**: 2026-07-07 | I-137 | C-37,I-80,I-81,I-82,R-037 | [pr-5-build-optimization-summary.md](../reference/changelogs/2026-07/pr-5-build-optimization-summary.md) |
| I-117 | LOG | PR-7 tradeErrorClassifier.ts 拆分方案文档 | 方案编号**: PR-7 | - | C-37,I-80,I-82,R-037 | [pr-7-trade-error-classifier-split-plan.md](../reference/changelogs/2026-07/pr-7-trade-error-classifier-split-plan.md) |
| I-118 | LOG | PR-8 重复函数去重重构方案 | 版本**: v1.0.0 | **日期**: 2026-07-08 | I-119,I-31,R-092 | C-37,I-80,I-82,R-037 | [pr-8-dedup-plan.md](../reference/changelogs/2026-07/pr-8-dedup-plan.md) |
| I-119 | LOG | V9 架构文档变更日志 | 遵循"变更即记录（Change as Record）"原则，每次架构/数据变更均 | - | C-37,I-118,I-240,I-80,I-81,I-8 | [CHANGELOG.md](../reference/CHANGELOG.md) |
| I-120 | LOG | 发布说明 | 本文件面向用户与开发者，汇总每个已发布版本的核心变更、质量指标与升级须知。 | - | C-37,I-185,I-80,I-81,I-82,R-03 | [release-notes.md](../reference/release-notes.md) |
| I-121 | LOG | 变更摘要-2026-06-28-phase0-数据层改造 | - | - | C-37,I-80,I-81,R-037 | [变更摘要-2026-06-28-phase0-数据层改造.md](../reference/changelogs/变更摘要-2026-06-28-phase0-数据层改造.md) |
| I-122 | LOG | 本周执行任务清单（2026-07-05 至 2026-07-12） | 目标**: 建立并验证代码审查系统工作流 | - | C-37,I-80,I-81,I-82,R-037 | [weekly-tasks-2026-07-05.md](../explanation/design/weekly-tasks-2026-07-05.md) |
| I-123 | LOG | 每日文档变更历史 — 2026-07-12 | 本文件由每日文档验证流程自动生成，记录当天所有材料的变更情况。 | - | C-37 | [daily-doc-validation-2026-07-12.md](../reference/changelogs/2026-07/daily-doc-validation-2026-07-12.md) |
| I-124 | LOG | 测试缓存清理修复总结 | - | - | C-37,I-80,I-81,I-82,R-037 | [test-cache-fix-summary.md](../reference/changelogs/2026-07/test-cache-fix-summary.md) |
| I-125 | MIGR | V6 Pro → V9 源码比对与二次开发重点模块梳理 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v6pro-to-v9-migration-analysis.md](../explanation/v6pro-to-v9-migration-analysis.md) |
| I-126 | MIGR | V6 Pro → V9 源码比对与二次开发重点模块梳理 | Status**: Current | - | C-37 | [v6pro-to-v9-migration-analysis.md](../reference/v6pro-to-v9-migration-analysis.md) |
| I-127 | MIGR | V6ProDB IndexedDB 升级规范（v4 → v6） | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [db-migration-v4-to-v6.md](../explanation/db-migration-v4-to-v6.md) |
| I-128 | MIGR | 变更影响分析报告 | - | - | C-37,I-81,I-82,R-037 | [refactor-impact-analysis-2026-06-27.md](../explanation/refactor-impact-analysis-2026-06-27.md) |
| I-129 | MIGR | 变更影响分析报告 | - | - | C-37,I-80 | [refactor-impact-analysis-2026-06-27.md](../explanation/design/refactor-impact-analysis-2026-06-27.md) |
| I-130 | MISC | 08. 实施计划 | Status**: Current | - | C-37,I-80,I-82,R-037 | [08-implementation-plan.md](../explanation/design/08-implementation-plan.md) |
| I-131 | MISC | 08. 实施计划 | Status**: Current | - | C-37,I-81 | [08-implementation-plan.md](../reference/08-implementation-plan.md) |
| I-132 | MISC | B 批次组件集成测试报告（B-6） | 日期：2026-07-08 | - | C-37,I-80,I-82,R-037 | [b批次组件集成测试报告-b6-2026-07-08.md](../explanation/b批次组件集成测试报告-b6-2026-07-08.md) |
| I-133 | MISC | B 批次高价值孤儿组件集成状态报告 | 日期：2026-07-08 | - | C-37,I-80,I-82,R-037 | [b批次高价值孤儿集成状态报告-2026-07-08.md](../explanation/b批次高价值孤儿集成状态报告-2026-07-08.md) |
| I-134 | MISC | Blueprints | 定位**：系统架构蓝图、流程设计图、技术方案可视化。 | - | C-37 | [README.md](../explanation/design/blueprints/README.md) |
| I-135 | MISC | buildScoreDocDiff 修复 — 生产部署回滚预案 | 版本**: v1.0 | **日期**: 2026-07-04 | - | C-37,I-80,I-81,I-82,R-037 | [buildscoredocdiff-rollback-plan.md](../explanation/design/buildscoredocdiff-rollback-plan.md) |
| I-136 | MISC | data_link_sequence_diagram | - | - | C-37,I-80,I-82,R-037 | [data_link_sequence_diagram.md](../reference/data_link_sequence_diagram.md) |
| I-137 | MISC | FinSightV9 文档中心 | - | - | C-37,I-116,I-76,I-80,I-82,R-03 | [README.md](../README.md) |
| I-138 | MISC | iFinD 插件 | 数据域**: 同花顺金融数据平台（中国 A 股、港股、美股及其他市场） | - | C-37,I-225,I-82 | [ifind.md](../reference/ifind.md) |
| I-139 | MISC | IMF 插件 | 数据域**: 国际货币基金组织（IMF）全球宏观经济数据 | - | C-37,I-225,I-82 | [imf.md](../reference/imf.md) |
| I-140 | MISC | JSDoc 与文档门禁规范 | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37 | [jsdoc-convention.md](../reference/jsdoc-convention.md) |
| I-141 | MISC | JSDoc 编写规范 | 版本**: v1.0.0 | **日期**: 2026-07-13 | - | C-37,I-185,I-80,I-82,R-037 | [jsdoc-convention.md](../explanation/jsdoc-convention.md) |
| I-142 | MISC | Kimi WebBridge 插件 | 功能域**: 浏览器自动化控制（导航、点击、输入、截图、PDF 保存） | - | C-37,I-225,I-82 | [kimi-webbridge.md](../explanation/kimi-webbridge.md) |
| I-143 | MISC | Kimi 加载提示：本项目为 V9 智能投研复盘系统，按 AGENTS.md v | 用途**：本文件是 `docs/` 的唯一顶层入口。任何新成员或 AI Agen | - | C-37,I-81 | [README.md](../reference/README.md) |
| I-144 | MISC | P4 文档去重清单与执行方案 | 版本**：v1.0 | **日期**：2026-07-08 | **归属**：质 | - | C-37,I-80,I-82,R-037 | [p4-文档去重清单与执行方案.md](../explanation/design/p4-文档去重清单与执行方案.md) |
| I-145 | MISC | Plans | 定位**：项目计划、实施方案、路线图。 | - | C-37 | [README.md](../reference/project/plans/README.md) |
| I-146 | MISC | Pull Request: P0 级资金安全修复 + P1 路由挂载 + 测试覆 | - | I-151,I-39 | C-37,I-185,I-82 | [pr-description.md](../reference/pr-description.md) |
| I-147 | MISC | R01 发布计划与评审文档 — V9 智能投研复盘系统 | 文档版本**：v1.0 ｜ **日期**：2026-07-08 ｜ **负责人* | - | C-37,I-80,I-82,R-037 | [发布计划与评审-r01.md](../explanation/design/发布计划与评审-r01.md) |
| I-148 | MISC | R03 回滚方案与演练文档 — V9 智能投研复盘系统 | 文档版本**：v1.0 ｜ **日期**：2026-07-08 ｜ **关联清单 | - | C-37,I-80,I-82,R-037 | [回滚方案与演练-r03.md](../explanation/design/回滚方案与演练-r03.md) |
| I-149 | MISC | Scholar 插件 | 数据域**: 学术文献检索（Google Scholar 风格） | - | C-37,I-225,I-82 | [scholar.md](../reference/scholar.md) |
| I-150 | MISC | SEC EDGAR 插件 | 数据域**: 美国 SEC 上市公司申报文件与财务数据 | - | C-37,I-225,I-82 | [sec_edgar.md](../reference/sec_edgar.md) |
| I-151 | MISC | tech-debt.md — 技术债管理文档 | 版本**: v1.0.0 | **日期**: 2026-07-05 | - | C-37,I-146,I-80,I-81,I-82,R-03 | [tech-debt.md](../explanation/design/tech-debt.md) |
| I-152 | MISC | Tianyancha 插件 | 数据域**: 天眼查企业数据库（中国大陆企业信息） | - | C-37,I-225,I-82 | [tianyancha.md](../reference/tianyancha.md) |
| I-153 | MISC | UI 设计优化实施计划（详细版） | 合并《UI设计优化实操方案 V6×V9×WorkBuddy》与《UI设计原则基线 | - | C-37,I-80,I-82,R-037 | [../reference/ui设计优化实施计划-详细版.md](../reference/../reference/ui设计优化实施计划-详细版.md) |
| I-154 | MISC | V6 Pro UI 模块新旧比对与 V9 吸收报告 | Status: Future Reference / Deferred** | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-ui-module-alignment.md](../reference/deprecated-ui-module-alignment.md) |
| I-155 | MISC | V6 Pro → V9 架构差异分析报告 | 审计基准：`V6Pro_整体架构梳理_v3.md`、`trade_review_ | - | C-37,I-80,I-81,I-82,R-037 | [v6pro-v9-gap-analysis-final.md](../explanation/design/v6pro-v9-gap-analysis-final.md) |
| I-156 | MISC | V6-V9 界面设计优化详细可行性计划 | 版本**: v1.0 | **日期**: 2026-07-08 | - | C-37,I-80,I-82,R-037 | [v6-v9界面设计优化可行性计划.md](../explanation/design/v6-v9界面设计优化可行性计划.md) |
| I-157 | MISC | V6-V9 界面设计最新 HTML 精读报告 | 检索日期**: 2026-07-08 | - | C-37,I-80,I-82,R-037 | [v6-v9界面设计html精读报告.md](../explanation/design/v6-v9界面设计html精读报告.md) |
| I-158 | MISC | V9 IndexedDB Store Schema 文档 | 版本**：v21 | - | C-37,I-80,I-82,R-037 | [v9-indexeddb-store-schema.md](../explanation/design/v9-indexeddb-store-schema.md) |
| I-159 | MISC | V9 IndexedDB Store Schema 文档 | 版本**：v21 | - | C-37,I-81 | [v9-indexeddb-store-schema.md](../reference/v9-indexeddb-store-schema.md) |
| I-160 | MISC | V9 L2 状态层补齐路线图 | 注：`HotSectorPage` 与 `ValuePitPage` 虽在历史清 | - | C-37,I-80,I-82,R-037 | [v9-l2状态层补齐路线图.md](../explanation/v9-l2状态层补齐路线图.md) |
| I-161 | MISC | V9 L2 状态层补齐路线图 | 注：`HotSectorPage` 与 `ValuePitPage` 虽在历史清 | - | C-37,I-81 | [v9-l2状态层补齐路线图.md](../reference/v9-l2状态层补齐路线图.md) |
| I-162 | MISC | V9 五层追溯审计 — 修复行动清单 | 审计范围**：批次 A-E（48 个功能入口 + 21 个 Widget） | - | C-37,I-80,I-81,I-82,R-037 | [action-list.md](../explanation/action-list.md) |
| I-163 | MISC | V9 五层追溯审计 — 修复行动清单 | 审计范围**：批次 A-E（48 个功能入口 + 21 个 Widget） | - | C-37 | [action-list.md](../reference/action-list.md) |
| I-164 | MISC | V9 代码实现分析报告 | 审计范围：批次 A-E（28 个模块） | - | C-37,I-80,I-81,I-82,R-037 | [v9-代码实现分析报告.md](../explanation/v9-代码实现分析报告.md) |
| I-165 | MISC | V9 体系化上线测试 TODO LIST | 生成时间**: 2026-07-13 11:09:49 ｜ **更新**: 20 | - | C-37,I-82,I-93 | [v9-体系化上线测试-todo-list.md](../explanation/v9-体系化上线测试-todo-list.md) |
| I-166 | MISC | V9 功能入口清单 | 扫描来源：`src/config/routes.ts`（路由唯一真相源）、`sr | - | C-37,I-80,I-81,I-82,R-037 | [feature-entry-list.md](../explanation/feature-entry-list.md) |
| I-167 | MISC | V9 双策略体系 — 更新日志与一致性检查 | 问题来源**：用户提出「整体交易策略进行结构性调整，将原先单行的股票选择和交易策 | - | C-37,I-80,I-81,I-82,R-037 | [dual-strategy-update-log-and-consistency-check.md](../reference/dual-strategy-update-log-and-consistency-check.md) |
| I-168 | MISC | V9 双策略规格与现有项目差异分析报告 | Status**: Proposal / 待评审 | - | C-37,I-81,I-82,R-037 | [dual-strategy-gap-analysis.md](../explanation/dual-strategy-gap-analysis.md) |
| I-169 | MISC | V9 双策略规格与现有项目差异分析报告 | Status**: Proposal / 待评审 | - | C-37,I-80 | [dual-strategy-gap-analysis.md](../explanation/design/dual-strategy-gap-analysis.md) |
| I-170 | MISC | V9 图表组件集成规格 | 对应蓝图**：`../reference/v9-system-blueprint.md` §2 技术栈 | - | C-37,I-80,I-81,I-82,R-037 | [chart-integration.md](../reference/chart-integration.md) |
| I-171 | MISC | V9 实施文档保鲜度告警清单 | 生成日期：2026-06-27 | - | C-37,I-177,I-80,I-81,I-82,R-03 | [freshness-alerts.md](../explanation/design/freshness-alerts.md) |
| I-172 | MISC | V9 并行任务调度表 | 生成时间：2026-06-25 | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-v9-parallel-task-schedule.md](../explanation/design/deprecated-v9-parallel-task-schedule.md) |
| I-173 | MISC | V9 待处理事项清单（Backlog） | 生成日期**: 2026-07-04 | - | C-37,I-81,I-82,R-037 | [pending-items-backlog-20260704.md](../explanation/pending-items-backlog-20260704.md) |
| I-174 | MISC | V9 待处理事项清单（Backlog） | 生成日期**: 2026-07-04 | - | C-37,I-80 | [pending-items-backlog-20260704.md](../explanation/design/pending-items-backlog-20260704.md) |
| I-175 | MISC | V9 批次 D（交易舱）P2 问题修复方案 | 审计范围**：交易舱 4 模块（D1-D4） | - | C-37,I-80,I-81,I-82,R-037 | [batchd-fix-plan.md](../reference/batchd-fix-plan.md) |
| I-176 | MISC | V9 批次 E（输出舱 + 总控舱）P2 问题修复方案 | 审计范围**：输出舱 + 总控舱（4 模块） | - | C-37,I-80,I-81,I-82,R-037 | [batche-fix-plan.md](../reference/batche-fix-plan.md) |
| I-177 | MISC | V9 技术实施文档索引 | 目录**: `docs/implementation/` | C-04,C-13,I-125,I-127,I-154,I- | C-37,I-177,I-80,I-81,I-82 | [00-readme.md](../explanation/design/00-readme.md) |
| I-178 | MISC | V9 数据分析与筛选模块开发任务规划与 Agent 分配 | 角色：V9 数据分析与筛选模块开发负责人 | - | C-37,I-80,I-82,R-037 | [analysis-screening-module-dev-plan.md](../explanation/design/analysis-screening-module-dev-plan.md) |
| I-179 | MISC | V9 数据宪法（Data Constitution） | 文档版本**：v1.0 | C-12,I-196,I-54,I-59 | C-37,C-70,I-181,I-182,I-271,I- | [v9数据宪法.md](../reference/v9数据宪法.md) |
| I-180 | MISC | V9 数据架构修订建议 | 基于文档**：`../reference/v9-system-blueprint.md` vs `V9核心 | - | C-37,I-80,I-81,I-82,R-037,R-16 | [v9数据架构修订建议.md](../reference/v9数据架构修订建议.md) |
| I-181 | MISC | V9 数据治理路线图与执行优先级 | 编制日期**：2026-07-02 | I-179,I-196,I-254,I-31,I-54 | C-37,I-80,I-82,R-037 | [数据治理路线图.md](../explanation/design/数据治理路线图.md) |
| I-182 | MISC | V9 数据治理路线图与执行优先级 | 编制日期**：2026-07-02 | I-179,I-196,I-254,I-31,I-54 | C-37,I-81 | [数据治理路线图.md](../reference/数据治理路线图.md) |
| I-183 | MISC | V9 数据血缘追踪与数据流全景图 | 文档版本**: v1.2 | - | C-37,I-80,I-81,I-82,R-037 | [v9-数据血缘追踪.md](../reference/v9-数据血缘追踪.md) |
| I-184 | MISC | V9 文件命名规范（File Naming Conventions） | 定位**：统一项目中所有文件和目录的命名规则，确保代码库的一致性和可维护性。 | - | C-37 | [file-naming-conventions.md](../reference/file-naming-conventions.md) |
| I-185 | MISC | V9 文档体系 — A-H 分类索引（真实映射） | 版本**: v2.0.0 | **日期**: 2026-07-13 | C-31,C-33,C-35,C-37,C-39,I-120 | C-37,I-82 | [a-h-index.md](../explanation/a-h-index.md) |
| I-186 | MISC | V9 智能投研复盘系统 · 用户画像与使用场景 | 版本**: v1.0.0 ｜ **更新日期**: 2026-07-15 ｜ ** | - | - | [user-personas-and-scenarios.md](../01-product/user-personas-and-scenarios.md) |
| I-187 | MISC | V9 智能投研复盘系统 — RM 剩余任务全量盘点与整改方案 | 生成时间：2026-07-08 19:30 | 最后更新：2026-07-09  | - | C-37,I-80,I-82,R-037 | [rm剩余任务全量盘点与整改方案-2026-07-08.md](../reference/rm剩余任务全量盘点与整改方案-2026-07-08.md) |
| I-188 | MISC | V9 智能投研复盘系统 — UI 改善部分检索报告 | 检索时间：2026-07-08 ｜ 范围：工作区根目录及 `docs/`、`sc | - | C-37,I-80,I-82,R-037 | [ui改善部分检索报告.md](../explanation/design/ui改善部分检索报告.md) |
| I-189 | MISC | V9 智能投研复盘系统 — 整体架构蓝图 | Status**: Current | - | C-37,I-177,I-242,I-80,I-81,I-8 | [v9-system-blueprint.md](../reference/v9-system-blueprint.md) |
| I-190 | MISC | V9 智能投研复盘系统 — 文档中心（docs/ 总入口） | 版本**: v1.0.0 | **日期**: 2026-07-13 | - | C-37,I-185 | [README.md](../explanation/README.md) |
| I-191 | MISC | V9 服务子域目录（Services Catalog） | 定位**：为 24 个服务子域提供统一文档锚点，消除「24 子域运行中但缺总览文 | - | C-37,I-185,I-82,I-85 | [services-catalog.md](../reference/services-catalog.md) |
| I-192 | MISC | V9 未完成任务清单（已验证版） | 生成时间：2026-07-01 | - | C-37,I-80,I-81,I-82,R-037 | [pending-tasks-inventory-20260701.md](../explanation/pending-tasks-inventory-20260701.md) |
| I-193 | MISC | V9 架构缺陷与整改行动清单 | 审计范围：批次 A-E（28 个模块） | - | C-37,I-80,I-81,I-82,R-037 | [v9-架构缺陷与整改行动清单.md](../explanation/v9-架构缺陷与整改行动清单.md) |
| I-194 | MISC | V9 架构覆盖分析报告 | 审计范围：批次 A-E（28 个模块） | - | C-37,I-80,I-81,I-82,R-037 | [v9-架构覆盖分析报告.md](../explanation/v9-架构覆盖分析报告.md) |
| I-195 | MISC | V9 核心数据字典与类型定义（整合版） | 文档版本**：v1.4 | - | - | [v9核心数据字典与类型定义(整合版).md](../reference/v9核心数据字典与类型定义(整合版).md).md) |
| I-196 | MISC | V9 现有数据资产清单 | 编制日期**：2026-06-29 | - | C-37,I-179,I-181,I-182,I-80,I- | [v9现有数据资产清单.md](../explanation/design/v9现有数据资产清单.md) |
| I-197 | MISC | V9 目标功能清单 | 扫描来源：`src/config/routes.ts`（路由唯一真相源）、`sr | - | C-37,I-242,I-80,I-81,I-82,I-93 | [v9-目标功能清单.md](../explanation/v9-目标功能清单.md) |
| I-198 | MISC | V9 编码规范（Coding Conventions） | 定位**：汇总 `../../AGENTS.md` 中的工程约束为一页可速查的编 | - | C-37,I-185,I-291,I-82,I-85 | [coding-conventions.md](../reference/coding-conventions.md) |
| I-199 | MISC | V9 选股策略总文档 | Status**: Active | C-67,I-215,I-226,I-228,I-233,I | C-37,I-34,I-81,I-82,R-037 | [stock-selection-strategy.md](../explanation/stock-selection-strategy.md) |
| I-200 | MISC | V9 选股策略总文档 | Status**: Active | C-67,I-215,I-226,I-228,I-233,I | C-37,I-215,I-226,I-228,I-233,I | [stock-selection-strategy.md](../explanation/design/stock-selection-strategy.md) |
| I-201 | MISC | V9 部署运维基线 | 文档体系版本**: v2.0.0 | **本文档修订**: rev.1 | ** | C-31,C-67,I-109,I-232,I-251 | C-37,I-82 | [deployment.md](../reference/deployment.md) |
| I-202 | MISC | V9 问题整改管理与调度记录 | 归并来源：`v9-issue-execution-board.md` + `v9 | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v9-issue-management.md](../explanation/v9-issue-management.md) |
| I-203 | MISC | V9 问题整改调度表 | 生成时间：2026-06-25 | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-v9-issue-resolution-schedule.md](../explanation/deprecated-v9-issue-resolution-schedule.md) |
| I-204 | MISC | V9 项目文件整理清单 | Version**: v1.3.0 | - | C-37,I-80,I-81,I-82,R-037 | [文件整理清单.md](../reference/文件整理清单.md) |
| I-205 | MISC | World Bank Open Data 插件 | 数据域**: 世界银行开放数据（全球发展指标） | - | C-37,I-225,I-82 | [world_bank_open_data.md](../reference/world_bank_open_data.md) |
| I-206 | MISC | Yahoo Finance 插件 | 数据域**: Yahoo Finance 全球股票数据 | - | C-37,I-225,I-82 | [yahoo_finance.md](../reference/yahoo_finance.md) |
| I-207 | MISC | Yuandian Law 插件 | 数据域**: 元典法律数据库（中国大陆法律法规与案例） | - | C-37,I-225,I-82 | [yuandian_law.md](../reference/yuandian_law.md) |
| I-208 | MISC | 「股票池」泛化旧名称 内部标识符重命名重构方案 | 版本**: v1.0 | **日期**: 2026-07-20 | - | C-37,I-82 | [refactor-research-pool-rename-plan.md](../reference/refactor-research-pool-rename-plan.md) |
| I-209 | MISC | 业务能力补充报告：自选股异动 Widget | - | - | C-37,I-80,I-82,R-037 | [业务能力补充报告_自选股异动_2026-07-09.md](../explanation/design/业务能力补充报告_自选股异动_2026-07-09.md) |
| I-210 | MISC | 交易核心因子与复盘指标导入 | Status: Future Reference / Deferred** | - | C-37,I-81,I-82,R-037 | [trading-core-factors.md](../explanation/trading-core-factors.md) |
| I-211 | MISC | 交易核心因子与复盘指标导入 | Status: Future Reference / Deferred** | - | C-37,I-177,I-80 | [trading-core-factors.md](../explanation/design/trading-core-factors.md) |
| I-212 | MISC | 代码-文档同步差异清单 | Status**: Current | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-doc-sync-gap-list.md](../explanation/design/deprecated-doc-sync-gap-list.md) |
| I-213 | MISC | 代码-文档同步整体方案与执行计划 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [doc-sync-execution-plan.md](../explanation/design/doc-sync-execution-plan.md) |
| I-214 | MISC | 代码质量优化处理计划 | 基于 `nested-code-review-report.json` 的静态评 | - | C-37,I-82 | [optimization-plan.md](../explanation/optimization-plan.md) |
| I-215 | MISC | 价值洼地策略（value-bargain） | Status**: Active | C-67,I-200,I-228,I-233,I-35,R- | C-37,I-199,I-200,I-228,I-233,I | [value-bargain-strategy.md](../explanation/design/value-bargain-strategy.md) |
| I-216 | MISC | 任务图模板 | 用途**: 复杂任务（涉及 3+ 文件或跨模块）的结构化拆解模板 | - | C-37,I-80,I-82,R-037 | [task-graph-template.md](../explanation/task-graph-template.md) |
| I-217 | MISC | 任务图模板 | 本模板参照 AGENTS.md §12.3 任务图核心结构。 | - | C-37 | [task-graph-template.md](../reference/templates/task-graph-template.md) |
| I-218 | MISC | 功能模块数据契约 | 文档版本**：v1.0 | - | C-37,I-80,I-81,I-82,R-037 | [功能模块数据契约.md](../reference/功能模块数据契约.md) |
| I-219 | MISC | 双通道投研评分系统技术方案（可行性论证报告） | 文档定位：系统性可行性论证 + 可执行技术方案 | - | C-37,I-82,R-037 | [双通道投研评分系统技术方案.md](../explanation/双通道投研评分系统技术方案.md) |
| I-220 | MISC | 双通道投研评分系统技术方案（可行性论证报告） | 文档定位：系统性可行性论证 + 可执行技术方案 | - | C-37,I-80 | [双通道投研评分系统技术方案.md](../explanation/design/双通道投研评分系统技术方案.md) |
| I-221 | MISC | 发文就绪卡 · 腾讯云开发者社区 | 两篇文章已通过质检，以下为发布前可直接套用的元数据与操作清单。 | - | C-37,I-82 | [publish-ready.md](../assets/articles/publish-ready.md) |
| I-222 | MISC | 因子提炼、扩容与追踪路径分析 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [factor-tracking-roadmap.md](../explanation/factor-tracking-roadmap.md) |
| I-223 | MISC | 批次 B P2 问题修复方案 | 问题来源**：批次 B（输入舱）审计发现的 7 个 P2 级问题 | - | C-37,I-80,I-81,I-82,R-037 | [batchb-fix-plan.md](../reference/batchb-fix-plan.md) |
| I-224 | MISC | 投资流程阶段化分析：仓位、引擎、数据架构与数据交互 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [investment-pipeline-stage-analysis.md](../explanation/design/investment-pipeline-stage-analysis.md) |
| I-225 | MISC | 插件技能文档索引 | 同步日期**: 2025-07-12 | I-138,I-139,I-142,I-149,I-150, | C-37,I-225,I-82 | [index.md](../reference/index.md) |
| I-226 | MISC | 核心稀缺资源策略（core-scarce） | Status**: Active | C-67,I-200,I-35,R-055 | C-37,I-199,I-200,I-233,I-34,I- | [core-scarce-strategy.md](../explanation/design/core-scarce-strategy.md) |
| I-227 | MISC | 每周数据蓝图一致性检查 — 2026-06-30 | 按 `../reports/retrospectives/v9-data-blu | - | C-37,I-80,I-81,I-82,R-037 | [weekly-check-2026-06-30.md](../explanation/weekly-check-2026-06-30.md) |
| I-228 | MISC | 热门赛道策略（hot-momentum） | Status**: Active | C-67,I-200,I-215,I-35,R-057 | C-37,I-199,I-200,I-215,I-233,I | [hot-momentum-strategy.md](../explanation/design/hot-momentum-strategy.md) |
| I-229 | MISC | 状态管理规范 | Status**: Current | - | C-37,I-82 | [state-management.md](../explanation/state-management.md) |
| I-230 | MISC | 第四次工业革命稀缺核心资源 — 交易策略解析与 V9 采用方案 | Status**: Accepted / Phase 1 Implemented | - | C-37,I-177,I-80,I-81,I-82,R-03 | [fourth-industrial-revolution-core-resource-strategy.md](../reference/fourth-industrial-revolution-core-resource-strategy.md) |
| I-231 | MISC | 网页测试检索校对是否纳入数据采集改进方案——比对分析与建议 | 结论先行**：不建议将“网页测试/检索/校对”能力（当前实现为 `hybrid- | - | C-37,I-80,I-82,R-037 | [网页测试检索校对纳入采集方案分析.md](../reference/网页测试检索校对纳入采集方案分析.md) |
| I-232 | MISC | 股票池看板迁移 + 采集进度汇报 + 既有债务治理完成 | - | - | C-37,I-185,I-201,I-55,I-82,I-8 | [overview.md](../explanation/overview.md) |
| I-233 | MISC | 观察仓策略（watchlist） | Status**: Active | I-200,I-215,I-226,I-228,I-35,R | C-37,I-199,I-200,I-215,I-34,I- | [watchlist-strategy.md](../explanation/design/watchlist-strategy.md) |
| I-234 | MISC | 质量保障策略：分阶段自适应检查机制 | 版本**: v1.0.0 | **日期**: 2026-07-12 | - | C-37,I-82 | [quality-assurance-strategy.md](../explanation/design/quality-assurance-strategy.md) |
| I-235 | MISC | 踩坑规则门禁指南 | Status**: Current | I-254 | C-37,I-254,I-80,I-82,R-037 | [踩坑规则门禁指南.md](../explanation/design/踩坑规则门禁指南.md) |
| I-236 | MISC | 踩坑规则门禁指南 | Status**: Current | I-254 | C-37,C-69,I-81 | [踩坑规则门禁指南.md](../reference/踩坑规则门禁指南.md) |
| I-237 | MISC | 迁移风险复盘与应对策略文档 | 文档编号**: V9-MIGRATION-RISK-001 | - | C-37,I-80,I-82,R-037 | [迁移风险复盘与应对策略文档.md](../explanation/design/迁移风险复盘与应对策略文档.md) |
| I-238 | MISC | 页面结构与五舱布局 | Status**: Current | - | C-37,I-82 | [page-structure.md](../explanation/page-structure.md) |
| I-239 | PERF | V9 性能基线 | 建立于 v0.9.11 | P2-PERF 性能整改 | - | C-37,I-80,I-81,I-82,R-037 | [performance-baseline.md](../explanation/performance-baseline.md) |
| I-240 | RPT | V9 代码质量校对分析 — 过程透明看板 | 版本**: v1.0.0 | I-119,I-284,I-31,R-115 | C-37,I-299,I-80,I-81,I-82,R-03 | [v9-code-quality-kanban-20260629.md](../explanation/design/v9-code-quality-kanban-20260629.md) |
| I-241 | RPT | V9 文件系统全面评估报告 | - | - | C-37 | [file-system-assessment-v2.md](../reference/meta/file-system-assessment-v2.md) |
| I-242 | RPT | V9 智能投研复盘系统 · 综合验证与定位分析报告 | 版本**: v2.0.0 ｜ **生成日期**: 2026-07-15 ｜ ** | I-189,I-197,I-247,I-278,I-281, | - | [综合验证与定位分析报告-v2.0.0.md](../reports/综合验证与定位分析报告-v2.0.0.md) |
| I-243 | RPT | 文档自动更新体系 — 任务看板（单一事实源） | 文档日期：2026-07-12（M1 收尾 + 维度二审查后建立） | - | C-37 | [doc-auto-update-kanban.md](../reference/meta/doc-auto-update-kanban.md) |
| I-244 | SEC | RBAC 整合：可行性分析 + 实施计划 + 整改方案 | 生成时间：2026-07-08 ｜ 依据：实地核查当前磁盘真实状态（V9 工作树 | - | C-37,I-80,I-82,R-037 | [rbac整合可行性分析与实施计划-2026-07-08.md](../explanation/rbac整合可行性分析与实施计划-2026-07-08.md) |
| I-245 | SEC | Security Model — V9 智能投研复盘系统安全架构 | 版本**: v1.0.0 | **日期**: 2026-07-10 | - | C-37,I-82 | [security-model.md](../reference/security-model.md) |
| I-246 | SPEC | 01. 愿景与目标 | Status**: Current | - | C-37,I-80,I-82,R-037 | [01-vision-and-goals.md](../explanation/01-vision-and-goals.md) |
| I-247 | SPEC | 01. 愿景与目标 | Status**: Current | - | C-37,I-242,I-81 | [01-vision-and-goals.md](../reference/01-vision-and-goals.md) |
| I-248 | SPEC | 02. 功能规格 | Status**: Current | - | C-37,I-80,I-81,I-82,R-037 | [02-functional-specs.md](../reference/02-functional-specs.md) |
| I-249 | SPEC | 04. UI/UX 规范 | Status**: Current | - | C-37,I-80,I-82,R-037 | [04-ui-ux-specs.md](../explanation/design/04-ui-ux-specs.md) |
| I-250 | SPEC | 04. UI/UX 规范 | Status**: Current | - | C-37,I-81 | [04-ui-ux-specs.md](../reference/04-ui-ux-specs.md) |
| I-251 | SPEC | 06. 路由规格 | Status**: Current | - | C-37,I-201,I-80,I-82,R-028,R-0 | [06-routing-specs.md](../explanation/design/06-routing-specs.md) |
| I-252 | SPEC | 07. 运营策略 | Status**: Current | - | C-37,I-80,I-82,R-037 | [07-operation-strategy.md](../explanation/design/07-operation-strategy.md) |
| I-253 | SPEC | 07. 运营策略 | Status**: Current | - | C-37,I-81 | [07-operation-strategy.md](../reference/07-operation-strategy.md) |
| I-254 | SPEC | 09. 质量门禁 | Status**: Current | I-235 | C-37,I-100,I-181,I-182,I-235,I | [09-quality-gates.md](../explanation/design/09-quality-gates.md) |
| I-255 | SPEC | 10. 领域词汇表 | Status**: Current | - | C-37,I-274,I-80,I-82,R-037 | [10-glossary.md](../explanation/10-glossary.md) |
| I-256 | SPEC | 10. 领域词汇表 | Status**: Current | - | C-37,I-81 | [10-glossary.md](../reference/10-glossary.md) |
| I-257 | SPEC | Agent Runtime 实现规格 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [agent-runtime-spec.md](../reference/agent-runtime-spec.md) |
| I-258 | SPEC | AI 中心 Vue3 组件示例 | 注意**：`src/services/ai-center/mockAICente | - | C-37,I-80,I-81,I-82,R-037 | [ai-center-vue3-examples.md](../explanation/ai-center-vue3-examples.md) |
| I-259 | SPEC | Analysis 舱规格（analysis-cabin-spec） | 定位**：analysis 舱（投研分析中枢）的职责边界、页面、路由、数据流定义 | - | C-37,I-82 | [analysis-cabin-spec.md](../reference/analysis-cabin-spec.md) |
| I-260 | SPEC | Cockpit & News 模块文档修正方案（Phase 2-3） | Status**: Draft | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-cockpit-news-doc-correction-plan.md](../explanation/design/deprecated-cockpit-news-doc-correction-plan.md) |
| I-261 | SPEC | Cockpit + News 模块文档修正方案 | 基于**: [v9-architecture-data-diff-report. | R-022 | C-37,I-177,I-80,I-81,I-82,R-03 | [cockpit-news-doc-fix-plan.md](../reference/cockpit-news-doc-fix-plan.md) |
| I-262 | SPEC | Command 舱规格（command-cabin-spec） | 定位**：command 舱（总控舱）的职责边界、子路由、数据流。补「4 舱缺  | - | C-37,I-82 | [command-cabin-spec.md](../reference/command-cabin-spec.md) |
| I-263 | SPEC | Gateway 层写入权限规范 | 版本**: v1.0.0 | **日期**: 2026-07-13 | I-76,R-134 | C-37,I-185,I-274,I-82 | [gateway-write-permission-spec.md](../reference/gateway-write-permission-spec.md) |
| I-264 | SPEC | Output 舱规格（output-cabin-spec） | 定位**：output 舱（产出与复盘）的职责边界、页面、路由、数据流。补「4  | - | C-37,I-82 | [output-cabin-spec.md](../reference/output-cabin-spec.md) |
| I-265 | SPEC | Rotation Score Service 实现规格 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [rotation-score-spec.md](../reference/rotation-score-spec.md) |
| I-266 | SPEC | SevenDimConfigPage 高级配置补全方案 | 接口测试 | - | C-37,I-80,I-82,R-037 | [seven-dim-advanced-config-implementation.md](../reference/seven-dim-advanced-config-implementation.md) |
| I-267 | SPEC | Trading 舱规格（trading-cabin-spec） | 定位**：trading 舱（交易与持仓）的职责边界、页面、路由、数据流。补「4 | - | C-37,I-82 | [trading-cabin-spec.md](../reference/trading-cabin-spec.md) |
| I-268 | SPEC | V6 Pro → V9 JSON 数据迁移规范（中间文档） | 文档版本：1.0 | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v6-to-v9-migration-spec.md](../reference/v6-to-v9-migration-spec.md) |
| I-269 | SPEC | V9 操作反馈闭环规格 | 对应蓝图**：`../reference/v9-system-blueprint | - | C-37,I-80,I-81,I-82,R-037 | [feedback-loop-spec.md](../explanation/feedback-loop-spec.md) |
| I-270 | SPEC | V9 操作反馈闭环规格 | 对应蓝图**：`../reference/v9-system-blueprint.md` §5.3 事 | - | C-37 | [feedback-loop-spec.md](../reference/feedback-loop-spec.md) |
| I-271 | SPEC | V9 数据流规范 | 版本：v0.9.14 P6-DATA | I-179,I-296,I-44,I-51,I-59 | C-37,I-298,I-299,I-80,I-81,I-8 | [data-flow-spec.md](../explanation/design/data-flow-spec.md) |
| I-272 | SPEC | 审计场景下 WorkBuddy 的 5 个真实踩坑与解法 #WorkBuddy | 用 WorkBuddy 改造审计工作流三个月，我踩过不少坑。这篇文章挑 5 个最 | - | C-37,I-82 | [02-experience-five-pitfalls.md](../assets/articles/02-experience-five-pitfalls.md) |
| I-273 | SPEC | 新闻模块 — useState → Zustand 迁移文档 | - | - | C-37,I-80,I-81,I-82,R-037 | [migration-news-usestate-to-zustand.md](../explanation/migration-news-usestate-to-zustand.md) |
| I-274 | SPEC | 股票池统一存储方案规范 | 版本**: v1.0.0 | **日期**: 2026-07-13 | I-255,I-263,R-134 | C-37,I-82 | [unified-pool-storage-spec.md](../reference/unified-pool-storage-spec.md) |
| I-275 | SPEC | 质量门禁实测基线（2026-06-25） | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [quality-gates-baseline.md](../explanation/quality-gates-baseline.md) |
| I-276 | SPEC | 输入舱业务规格与实现映射 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [input-cabin-spec.md](../explanation/design/input-cabin-spec.md) |
| I-277 | SPEC | 输入舱业务规格与实现映射 | Status**: Current | - | C-37 | [input-cabin-spec.md](../reference/input-cabin-spec.md) |
| I-278 | TEST | V9 三层测试策略 | 版本**: v2.0.0 | **日期**: 2026-07-12 | I-291 | C-37,I-242,I-291,I-81 | [testing-strategy.md](../reference/testing-strategy.md) |
| I-279 | TEST | V9 批次 E：输出舱 + 总控舱 + 其他 — 完成度剖面图 | 审计日期**：2026-06-27 | - | C-37,I-80,I-81,I-82,R-037 | [completeness-profile-batch5.md](../explanation/completeness-profile-batch5.md) |
| I-280 | TEST | V9 批次 E：输出舱 + 总控舱 + 其他 — 完成度剖面图 | 审计日期**：2026-06-27 | - | C-37 | [completeness-profile-batch5.md](../reference/completeness-profile-batch5.md) |
| I-281 | TEST | V9 智能投研复盘系统 - 测试用例清单 | - | - | C-37,I-242,I-80,I-81,I-82,I-93 | [v9-test-cases.md](../reference/v9-test-cases.md) |
| I-282 | TEST | V9 智能投研复盘系统 全面自动化测试实施计划 | 全部完成**。所有 24 个任务已执行完毕，综合评估报告已生成。 | - | C-37,I-80,I-82,R-037 | [automation-test-plan.md](../reference/automation-test-plan.md) |
| I-283 | TEST | V9 智能投研复盘系统 综合测试与可行性评估报告 | 版本**: v1.0.0 | **日期**: 2026-07-09 | - | C-37,I-80,I-82,R-037 | [automation-test-evaluation.md](../explanation/design/automation-test-evaluation.md) |
| I-284 | TEST | V9 模块完成度剖面图 — 全量汇总 | 审计范围**：批次 A（门户与驾驶舱）+ 批次 B（输入舱 9 入口）+ 批次  | - | C-37,I-240,I-80,I-81,I-82,R-03 | [completeness-profile.md](../explanation/completeness-profile.md) |
| I-285 | TEST | V9 模块完成度剖面图 — 全量汇总 | 审计范围**：批次 A（门户与驾驶舱）+ 批次 B（输入舱 9 入口）+ 批次  | - | C-37,R-116 | [completeness-profile.md](../reference/completeness-profile.md) |
| I-286 | TEST | V9 模块完成度剖面图 — 批次 1 | 审计范围：首页、驾驶舱、新闻资讯（V6）、交易持仓、录入看板 | - | C-37,I-80,I-81,I-82,R-037 | [completeness-profile-batch1.md](../reference/completeness-profile-batch1.md) |
| I-287 | TEST | V9 模块完成度剖面图 — 批次 B（输入舱） | 审计范围**：输入舱 6 个子页面 | - | C-37,I-80,I-81,I-82,R-037 | [completeness-profile-batch2.md](../explanation/completeness-profile-batch2.md) |
| I-288 | TEST | V9 模块完成度剖面图 — 批次 C（分析舱） | 审计范围**：分析舱 9 个子页面 | - | C-37,I-80,I-81,I-82,R-037 | [completeness-profile-batch3.md](../explanation/completeness-profile-batch3.md) |
| I-289 | TEST | V9 模块完成度剖面图 — 批次 D（交易舱） | 审计范围**：交易舱 4 个子页面 | - | C-37,I-81,I-82,R-037 | [completeness-profile-batch4.md](../explanation/completeness-profile-batch4.md) |
| I-290 | TEST | V9 模块完成度剖面图 — 批次 D（交易舱） | 审计范围**：交易舱 4 个子页面 | - | C-37,I-80 | [completeness-profile-batch4.md](../explanation/design/completeness-profile-batch4.md) |
| I-291 | TEST | V9 测试目录与策略 | 文档定位**：本文档是 V9 智能投研复盘系统全部测试资产的**单一真相源**（ | I-109,I-198,I-278 | C-37,I-278,I-82,I-93 | [test-catalog.md](../reference/test-catalog.md) |
| I-292 | TEST | 回归测试套件模板 | 用途**: 定义单次变更或一个 phase 完成后应运行的验证命令 | - | C-37,I-80,I-82,R-037 | [regression-suite.md](../explanation/regression-suite.md) |
| I-293 | TEST | 回归测试套件模板 | 本模板参照 AGENTS.md §12.4 三级回归测试套件。 | - | C-37 | [regression-suite.md](../reference/templates/regression-suite.md) |
| I-294 | TEST | 测试扩充设计方案 | 版本**: v1.0 | **日期**: 2026-07-12 | - | C-37,I-82 | [test-expansion-design.md](../explanation/design/test-expansion-design.md) |
| I-295 | UI | v6-pro-cockpit UI 组件参考（输入舱） | Status: Future Reference / Deferred** | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v6-cockpit-ui-reference.md](../reference/v6-cockpit-ui-reference.md) |
| I-296 | UI | V9 Widget 错误隔离与降级规格 | 对应蓝图**：`../reference/v9-system-blueprint.md` §7.1 P | - | C-37,C-70,I-271,I-80,I-81,I-82 | [widget-error-handling.md](../reference/widget-error-handling.md) |
| I-297 | UI | V9 原子组件构成体系（Atomic Design System） | 版本**：v1.0.0 | - | C-37,I-80,I-82,R-037 | [atomic-component-system.md](../reference/atomic-component-system.md) |
| I-298 | UI | V9 组件弃用政策 | 版本：v0.9.14 P6-DATA | I-102,I-271,R-115 | C-37,I-80,I-81,I-82 | [component-deprecation-policy.md](../explanation/component-deprecation-policy.md) |
| I-299 | UI | V9 组件弃用政策 | 版本：v0.9.14 P6-DATA | I-102,I-240,I-271,R-116 | C-37 | [component-deprecation-policy.md](../reference/component-deprecation-policy.md) |
| I-300 | UI | V9 舱室总览（Cabins Overview） | 定位**：统览 5 大舱（cabin）的职责、页面与关键路由，补《文档理解核查报 | - | C-37,I-185,I-82 | [cabins-overview.md](../explanation/cabins-overview.md) |
| I-301 | UI | 股票池看板迁移至分析舱 — 可行性方案论证 | 版本：v1.0 | 日期：2026-07-09 | 状态：待决策 | - | C-37,I-80,I-82,R-037 | [stock-pool-board-migration-proposal.md](../reference/stock-pool-board-migration-proposal.md) |
| I-302 | UI | 输入舱 UI 体系化重塑说明 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [input-cabin-ui-reshaping.md](../reference/input-cabin-ui-reshaping.md) |

## 🔵 参考（只读归档）（222 份）

| 编号 | 类目 | 标题 | 关注点 | 引用→ | 被引用← | 文档链接 |
|------|------|------|--------|-------|---------|----------|
| R-001 | ADR | ADR-002: IndexedDB 替代 localStorage | 状态**: Accepted | - | C-37,I-82 | [adr-002-indexeddb-over-localstorage.md](../reference/adr-002-indexeddb-over-localstorage.md) |
| R-002 | ADR | ADR-004: HashRouter 静态托管方案 | 状态**: Accepted | - | C-37,I-82 | [adr-004-hashrouter-static-hosting.md](../explanation/adr-004-hashrouter-static-hosting.md) |
| R-003 | ADR | ADR-005: PortalShell 深色 Kimi 经典布局 | 状态**: Accepted | - | C-37,I-82 | [adr-005-portalshell-dark-kimi-layout.md](../explanation/adr-005-portalshell-dark-kimi-layout.md) |
| R-004 | ADR | ADR-006: 输入舱拆分为四子页面 | 状态**: Accepted | - | C-37,I-82 | [adr-006-input-cabin-subpages.md](../reference/adr-006-input-cabin-subpages.md) |
| R-005 | ADR | ADR-007: 补齐筛选引擎、信号持久化与复盘引擎 | 状态**: Accepted（部分条款被 ADR-009 取代） | - | C-37,I-82 | [adr-007-screening-signal-persistence-review.md](../explanation/adr-007-screening-signal-persistence-review.md) |
| R-006 | ADR | ADR-008: 采用 V6 核心资源交易策略 | 状态**: Accepted | - | C-37,I-82 | [adr-008-v6-core-resource-trading-strategy.md](../explanation/adr-008-v6-core-resource-trading-strategy.md) |
| R-007 | ADR | ADR-009: 引入热门板块与价值洼地双策略体系 | 状态**: Accepted（supersedes ADR-007 部分条款） | - | C-37,I-82 | [adr-009-dual-strategy-system.md](../explanation/adr-009-dual-strategy-system.md) |
| R-008 | ARC | 2026-07-01-v6-architecture-dominance-bat | Status**: ✅ 已完成（2026-07-01） | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-01-v6-architecture-dominance-batch-a.md](../reference/2026-07-01-v6-architecture-dominance-batch-a.md) |
| R-009 | ARC | ADR-001: 纯前端无后端架构 | 状态**: Accepted | - | C-37,I-82 | [adr-001-pure-frontend-architecture.md](../explanation/adr-001-pure-frontend-architecture.md) |
| R-010 | ARC | ADR-001: 纯前端无后端架构 | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-20-pure-frontend-architecture.md](../explanation/design/2026-06-20-pure-frontend-architecture.md) |
| R-011 | ARC | FinSightV9 分析报告输出功能架构评估 | 报告版本**: v3.0.0 | - | C-37,I-82 | [report-generation-architecture-assessment.md](../explanation/report-generation-architecture-assessment.md) |
| R-012 | ARC | MCP 架构整改行动计划 | 基于文档**: mcp-architecture-audit-report-20 | - | C-37,I-80,R-037 | [mcp-architecture-remediation-plan-2026-07-08.md](../reports/mcp-architecture-remediation-plan-2026-07-08.md) |
| R-013 | ARC | MCP 架构规则与逻辑全面二次审查报告 | 审查日期**: 2026-07-08 | - | C-37,I-80,R-037 | [mcp-architecture-audit-report-2026-07-08.md](../reports/mcp-architecture-audit-report-2026-07-08.md) |
| R-014 | ARC | V6 → V9 架构一致性审计计划 | 状态：已归档（superseded）**。本文档记录的是 2026-06-30  | R-016 | C-37,I-80,I-81,I-82,R-037 | [v6-v9-architecture-audit-plan.md](../explanation/design/v6-v9-architecture-audit-plan.md) |
| R-015 | ARC | V6 → V9 架构一致性整改行动清单 | 审计结论**：V6 架构思想在 V9 中“有实现、未主导”。项目同时存在 V6  | - | C-37,I-81,I-82,R-037 | [v6-v9-architecture-audit-action-list.md](../explanation/v6-v9-architecture-audit-action-list.md) |
| R-016 | ARC | V6 → V9 架构一致性整改行动清单 | 审计结论**：V6 架构思想在 V9 中“有实现、未主导”。项目同时存在 V6  | - | C-37,I-80,R-014 | [v6-v9-architecture-audit-action-list.md](../explanation/design/v6-v9-architecture-audit-action-list.md) |
| R-017 | ARC | V6→V9 架构整改校正评估与可行性分析报告 | 决策1**: `V6Score` 类型是否需要扩展？ | - | C-37,I-80,I-81,I-82,R-037 | [v6-v9-rectification-feasibility-report.md](../explanation/design/v6-v9-rectification-feasibility-report.md) |
| R-018 | ARC | V9 智能投研复盘系统 — 当前状态全面梳理（按实施进度） | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v9-current-state-review.md](../explanation/design/v9-current-state-review.md) |
| R-019 | ARC | V9 智能投研复盘系统 — 当前状态全面梳理（按实施进度） | Status**: Current | - | C-37 | [v9-current-state-review.md](../reports/retrospectives/v9-current-state-review.md) |
| R-020 | ARC | V9 智能投研复盘系统 — 架构合规审计报告（T-11 第一轮） | 审计角色**: A8 · 架构合规 AGENT | - | C-37,I-80,I-82,R-037 | [architecture-compliance-report.md](../explanation/design/architecture-compliance-report.md) |
| R-021 | ARC | V9 架构整改总体策略与执行计划 | 关联文档**： | - | C-37,I-80,I-81,I-82,R-037 | [v9-architecture-rectification-strategy.md](../explanation/design/v9-architecture-rectification-strategy.md) |
| R-022 | ARC | V9 架构资产差异分析报告（Phase 5 深层审计） | Status**: Active | - | C-37,I-177,I-261,I-80,I-81,I-8 | [v9-architecture-data-diff-report.md](../explanation/design/v9-architecture-data-diff-report.md) |
| R-023 | ARC | V9 蓝图补全整改任务清单 — 批次 E（v15/v16 新增 Store） | 创建日期**: 2026-06-30 | - | C-37,I-80,I-81,I-82,R-037 | [v9-rectification-tasks-v15-v16.md](../explanation/v9-rectification-tasks-v15-v16.md) |
| R-024 | DAT | V9 数据关系蓝图任务跟踪计划 | Goal:** 确保 `docs/blueprints/` 中的数据关系与时间关 | - | C-37 | [v9-data-blueprint-task-tracking.md](../reports/retrospectives/v9-data-blueprint-task-tracking.md) |
| R-025 | DAT | V9 数据字典索引 | Status**: Current | - | C-37,I-82 | [data-dictionary-index-v1.6.0.md](../00-meta/deprecated-docs/old-versions/data-dictionary-index-v1.6.0.md) |
| R-026 | DAT | V9 数据库数据关系与时间关系蓝图计划 | For agentic workers:** REQUIRED SUB-SKIL | - | C-37,I-80,I-81,I-82,R-037 | [2026-06-29-data-relationship-blueprint.md](../reference/2026-06-29-data-relationship-blueprint.md) |
| R-027 | DAT | 数据采集模块开发任务清单 | 基于差距分析报告 + 路由UI校对报告 + 用户需求 | - | C-37 | [data-collection-task-list.md](../reports/retrospectives/data-collection-task-list.md) |
| R-028 | DAT | 数据采集模块路由与UI校对分析报告 | 基于V9路由注册表、UI组件清单、F盘V6设计文档的三维交叉校对 | I-251 | C-37,I-80,I-81,I-82,R-037 | [data-collection-route-ui-audit.md](../explanation/design/data-collection-route-ui-audit.md) |
| R-029 | DAT | 数据采集模块路由与UI校对分析报告 | 基于V9路由注册表、UI组件清单、F盘V6设计文档的三维交叉校对 | C-68 | C-37 | [data-collection-route-ui-audit.md](../reference/data-collection-route-ui-audit.md) |
| R-030 | DAT | 驾驶舱 Widget 数据定义 | Status**: Current | - | C-37,I-82 | [data-definition-v1.0.0-cockpit.md](../00-meta/deprecated-docs/old-versions/data-definition-v1.0.0-cockpit.md) |
| R-031 | GOV | 2026-07-14 架构治理与代码整理 | - | - | C-37 | [2026-07-14-architecture-governance.md](../reference/changelogs/2026-07/2026-07-14-architecture-governance.md) |
| R-032 | GOV | file-management-guide.md 综合测试评分报告 | 检查时间**: 2026-07-20 | - | C-37,I-82 | [file-management-guide-test-report.md](../reports/audit/file-management-guide-test-report.md) |
| R-033 | GOV | MCP Server 治理复盘深度报告 | 结论前置**：Registry 中注册的 18 个 Server，实际仅 12  | - | C-37,I-82 | [mcp-server-governance-retrospective.md](../reports/audit/mcp-server-governance-retrospective.md) |
| R-034 | GOV | V9 数据架构五大问题治理计划 | For agentic workers:** REQUIRED SUB-SKIL | - | C-37,I-80,I-81,I-82,R-037 | [2026-06-29-data-architecture-governance.md](../explanation/design/2026-06-29-data-architecture-governance.md) |
| R-035 | GOV | V9 文件管理体系包合规性审查报告 | 版本**: v1.0 | **日期**: 2026-07-12 | **审查范围 | - | C-37,C-41 | [file-management-compliance-report-2026-07-12.md](../reports/file-management-compliance-report-2026-07-12.md) |
| R-036 | GOV | V9 文档与文件管理体系 — 治理审计报告 | 版本**: v1.0.0 ｜ **日期**: 2026-07-13 ｜ **执行 | - | C-37,I-82 | [doc-governance-audit-report-2026-07-13.md](../reports/doc-governance-audit-report-2026-07-13.md) |
| R-037 | GOV | 文档索引 | 本文件由每日文档验证流程自动生成，请勿手动修改。 | C-04,C-05,C-06,C-07,C-08,C-11, | C-37,I-82 | [registry-index-v1.0.0-02-design.md](../00-meta/deprecated-docs/old-versions/registry-index-v1.0.0-02-design.md) |
| R-038 | GOV | 测试/构建产物清理记录（最终状态） | 生成时间：2026-07-12 | - | C-37,I-80,R-037 | [test-artifacts-cleanup-list.md](../reports/test-artifacts-cleanup-list.md) |
| R-039 | GUIDE | 代码评审指南与质量门禁 SOP | 版本**: v1.0.0 | **日期**: 2026-07-12 | - | C-37,I-185,I-82 | [code-review-guide.md](../how-to/code-review-guide.md) |
| R-040 | GUIDE | 剩余复杂度整改任务清单与计划（2026-07-12） | 基准：`complexity-baseline-current.json`（实测 | - | C-37 | [complexity-remediation-plan.md](../how-to/testing/complexity-remediation-plan.md) |
| R-041 | GUIDE | 我用 WorkBuddy 给审计团队搭了 20 个"分身"：一个审计合伙人的 A | 作者身份：资深审计合伙人，20 年审计从业经验。本文记录我用 WorkBuddy | - | C-37,I-82 | [01-tutorial-audit-workflow.md](../assets/articles/01-tutorial-audit-workflow.md) |
| R-042 | LOG | 2026-07-05 模块注册体系建立与未注册文件全量集成 | 任务状态**: ✅ 完成 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-module-registry-and-integration.md](../reference/changelogs/2026-07/2026-07-05-module-registry-and-integration.md) |
| R-043 | LOG | CHANGELOG 警告处理策略 | Created**: 2026-07-13 | - | C-37,C-59,I-82 | [changelog-warnings-handling-strategy.md](../00-meta/changelog-warnings-handling-strategy.md) |
| R-044 | LOG | Jira 任务单归档:P0-5 缺陷 + 6 个历史 Bug 修复 | 归档日期**: 2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-p0-5-and-legacy-bugs-jira-tickets.md](../reference/changelogs/2026-07/2026-07-05-p0-5-and-legacy-bugs-jira-tickets.md) |
| R-045 | LOG | P2 批次完成报告 & 后续迭代任务清单 — 2026-07-05 | - | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-p2-completion-and-backlog.md](../reference/changelogs/2026-07/2026-07-05-p2-completion-and-backlog.md) |
| R-046 | LOG | P4 阶段完成 — 文档体系治理 | - | - | C-37 | [2026-07-14-p4-completion.md](../reference/project/changelogs/2026-07/2026-07-14-p4-completion.md) |
| R-047 | LOG | UI 测试与优化更新日志 | - | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-ui-testing-optimization.md](../reference/changelogs/2026-07/2026-07-05-ui-testing-optimization.md) |
| R-048 | LOG | V9 系统性文档更新与交叉验证报告 | 报告日期：2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-systematic-doc-update.md](../reference/changelogs/2026-07/2026-07-05-systematic-doc-update.md) |
| R-049 | LOG | 颜色令牌重构清单 | - | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-color-token-refactor.md](../reference/changelogs/2026-07/2026-07-05-color-token-refactor.md) |
| R-050 | LOG | 颜色硬编码治理 - P1 批次技术日志 | - | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-color-refactor-p1.md](../reference/changelogs/2026-07/2026-07-05-color-refactor-p1.md) |
| R-051 | LOG | 颜色硬编码治理 - P2 批次技术日志 | - | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-color-refactor-p2.md](../reference/changelogs/2026-07/2026-07-05-color-refactor-p2.md) |
| R-052 | MIGR | ADR-009: V6 Pro JSON 全量导出迁移至 V9 IndexedD | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-25-v6-migration.md](../explanation/2026-06-25-v6-migration.md) |
| R-053 | MISC | ADR-002: IndexedDB 替代 localStorage | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-20-indexeddb-over-localstorage.md](../reference/2026-06-20-indexeddb-over-localstorage.md) |
| R-054 | MISC | ADR-004: React Router HashRouter | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-21-hashrouter-for-static-hosting.md](../reference/2026-06-21-hashrouter-for-static-hosting.md) |
| R-055 | MISC | ADR-008: 采用 v6-pro-cockpit "第四次工业革命稀缺核心资 | - | - | C-37,I-177,I-199,I-200,I-226,I | [2026-06-24-adopt-v6-core-resource-trading-strategy.md](../reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md) |
| R-056 | MISC | ADR-009: 引入热门板块与价值洼地双策略体系 | - | - | C-37,I-199,I-34,I-81,I-82,R-03 | [2026-06-27-dual-strategy-system.md](../explanation/2026-06-27-dual-strategy-system.md) |
| R-057 | MISC | ADR-009: 引入热门板块与价值洼地双策略体系 | - | - | C-37,I-200,I-215,I-228,I-233,I | [2026-06-27-dual-strategy-system.md](../explanation/design/2026-06-27-dual-strategy-system.md) |
| R-058 | MISC | Deployment Guide — V9 智能投研复盘系统部署基线 | 版本**: v1.0.0 | **日期**: 2026-07-10 | - | C-37,I-82 | [deployment-v1.0.0.md](../00-meta/deprecated-docs/old-versions/deployment-v1.0.0.md) |
| R-059 | MISC | docs/drafts/ — 临时草稿区 | 角色**: 根据 `docs/00-meta/governance.md` §2 | - | C-37 | [README.md](../drafts/README.md) |
| R-060 | MISC | V9 文档体系治理 — 下一阶段任务图（P4 执行计划） | 定位**：基于 `docs/00-meta/文档体系体检报告-v9.md`（第3 | - | C-37 | [v9-next-phase-todo.md](../archive/00-meta-archive-2026-07-13/v9-next-phase-todo.md) |
| R-061 | MISC | V9 智能投研复盘系统 - API 文档 | 生成时间: 2026-07-12T08:33:40Z | - | C-37 | [complete-api-doc.md](../drafts/complete-api-doc.md) |
| R-062 | MISC | V9 现有数据资产清单 | 编制日期**：2026-06-29 | - | C-37 | [V9现有数据资产清单.md](../reference/V9现有数据资产清单.md) |
| R-063 | MISC | V9 问题整改执行看板 | 调度官：Multi-Agent Orchestrator | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-v9-issue-execution-board.md](../archive/deprecated-v9-issue-execution-board.md) |
| R-064 | MISC | 删除日志 | 版本**: v1.0.0 | **日期**: 2026-07-13 | - | C-37,I-82 | [deletion-log.md](../archive/deletion-log.md) |
| R-065 | MISC | 归档目录（07-archive） | 定位**：存放已废弃、过时或不再维护的文档和资源。 | - | C-37 | [README.md](../archive/README.md) |
| R-066 | RPT | 25 只股票全流程端到端校对测试 — 按舱分析报告 | 版本**：v1.0 | **日期**：2026-07-14 | R-067 | C-37,I-82 | [e2e-verify-25stocks-report.md](../reports/e2e-verify-25stocks-report.md) |
| R-067 | RPT | 25 只股票全流程端到端校对测试 — 考核指标方案 | 版本**：v1.1 | **日期**：2026-07-14（新增「维度 F：冗余 | - | C-37,I-82,R-066 | [e2e-verify-25stocks-plan.md](../reports/e2e-verify-25stocks-plan.md) |
| R-068 | RPT | ADR-007: 补齐筛选引擎、信号持久化与复盘引擎 | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-24-pool-screening-signal-persistence-review-engine.md](../explanation/2026-06-24-pool-screening-signal-persistence-review-engine.md) |
| R-069 | RPT | AI 生成—审计—修正飞轮 | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37,I-80,I-82,R-037 | [ai-generate-audit-fix-loop.md](../explanation/ai-generate-audit-fix-loop.md) |
| R-070 | RPT | AI 生成—审计—修正飞轮 | 版本：v1.0.0 | 日期：2026-07-10 | - | C-37 | [ai-generate-audit-fix-loop.md](../reference/ai-generate-audit-fix-loop.md) |
| R-071 | RPT | audit:hardcode Warning 分布分析报告 | 生成时间: 2026-07-05 | 审计脚本版本: audit-hardcod | - | C-37,I-80,I-81,R-037 | [audit-hardcode-warning-distribution.md](../reports/audit-hardcode-warning-distribution.md) |
| R-072 | RPT | audit:hardcode 剩余 107 项 Warning 根因分类报告 | 生成日期: 2026-07-05 | - | C-37,I-80,I-81,R-037 | [hardcode-warning-root-cause-analysis.md](../reports/hardcode-warning-root-cause-analysis.md) |
| R-073 | RPT | Batch-1 阶段性合并报告 | 生成时间：2026-06-25 | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-batch1-merge-report.md](../explanation/design/deprecated-batch1-merge-report.md) |
| R-074 | RPT | Batch-2 阶段性合并报告 | 生成时间：2026-06-25 | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-batch2-merge-report.md](../explanation/deprecated-batch2-merge-report.md) |
| R-075 | RPT | Batch-3 全量回归测试报告 | 生成时间：2026-06-25 | - | C-37,I-177,I-80,I-81,R-037 | [deprecated-batch3-merge-report.md](../explanation/design/deprecated-batch3-merge-report.md) |
| R-076 | RPT | buildScoreDocDiff 修复 — 生产部署回滚预案 | 版本**: v1.0 | **日期**: 2026-07-04 | - | C-37 | [buildscoredocdiff-rollback-plan.md](../reports/release-management/buildscoredocdiff-rollback-plan.md) |
| R-077 | RPT | cockpit / 整体设计一致性审查 | 触发：用户要求"扩大检索本地所有文件的范围，做更广的 cockpit / 整体设 | - | C-37,I-80,I-82,R-037 | [cockpit_整体设计一致性审查.md](../reports/audit/cockpit_整体设计一致性审查.md) |
| R-078 | RPT | cockpit widget「40 个类型错误」核查 · 分析性判断 | 触发：用户要求「检索本地所有真实文件，核实相关设计的整体思路是否采用上述 40  | - | C-37,I-80,I-82,R-037 | [cockpit_widget_40错误核查-分析判断.md](../reports/audit/cockpit_widget_40错误核查-分析判断.md) |
| R-079 | RPT | code-review.md — V9 代码审查标准与流程 | 版本**: v1.0.0 | **日期**: 2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [code-review.md](../reference/code-review.md) |
| R-080 | RPT | CollectionPlanPanel V6 设计校对分析报告 | 校对日期**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-collection-plan-panel-v6-audit.md](../reports/2026-07-09-collection-plan-panel-v6-audit.md) |
| R-081 | RPT | Debug Session: output-cabin-not-renderin | Session ID**: `output-cabin-not-renderin | - | C-37,I-80,I-82,R-037 | [debug-output-cabin-not-rendering.md](../reports/audit/debug-output-cabin-not-rendering.md) |
| R-082 | RPT | Design Tokens 系统实施事后分析报告 | - | I-34 | C-37,I-80,I-81,R-037 | [design-tokens-implementation-report.md](../reports/design-tokens-implementation-report.md) |
| R-083 | RPT | Jira 任务卡片内容 | 生成时间**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-jira-tasks.md](../reports/2026-07-09-jira-tasks.md) |
| R-084 | RPT | JSDoc 注释完整汇总报告 | 日期**: 2026-07-12 | - | C-37 | [jsdoc-combined-report-20260712.md](../reference/changelogs/2026-07/jsdoc-combined-report-20260712.md) |
| R-085 | RPT | MCP Server 集成测试报告（修复后重跑） | 日期**: 2026-07-08 | - | C-37,I-80,R-037 | [mcp-integration-test-report-2026-07-08-v2.md](../reports/mcp-integration-test-report-2026-07-08-v2.md) |
| R-086 | RPT | MCP 层权限控制修复方案 | 问题级别**: P0 高风险 | - | C-37,I-80,R-037 | [mcp-acl-fix-plan-2026-07-08.md](../reports/mcp-acl-fix-plan-2026-07-08.md) |
| R-087 | RPT | P0 优先级待办任务清单 | 生成时间**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-p0-todo-list.md](../reports/2026-07-09-p0-todo-list.md) |
| R-088 | RPT | P0/P1 路由缺口修复代码方案 | 日期**: 2026-07-09 | **状态**: P0 已修复，P1 待执行 | - | C-37,I-80,R-037 | [2026-07-09-p0-p1-fix-code-plan.md](../reports/2026-07-09-p0-p1-fix-code-plan.md) |
| R-089 | RPT | P1 级测试修复与日志埋点技术总结 | 日期**: 2026-07-09 | **版本**: v1.0 | **作者** | - | C-37,I-80,R-037 | [2026-07-09-p1-fix-technical-summary.md](../reports/2026-07-09-p1-fix-technical-summary.md) |
| R-090 | RPT | P1 缺口修复技术复盘 | 日期**: 2026-07-09 | **状态**: 已完成 | **修复缺口数 | - | C-37,I-80,R-037 | [2026-07-09-p1-gaps-fix-technical-review.md](../reports/2026-07-09-p1-gaps-fix-technical-review.md) |
| R-091 | RPT | PR-5 构建性能优化总结 | 版本**: v1.0 | **日期**: 2026-07-07 | I-137 | C-37 | [pr-5-build-optimization-summary.md](../reports/changelogs/pr-5-build-optimization-summary.md) |
| R-092 | RPT | PR-8 重复函数去重审计报告 | 版本**: v1.0.0 | **日期**: 2026-07-08 | I-119,I-31 | C-37,I-118,I-80,I-82,R-037 | [pr-8-dedup-audit-report.md](../reference/changelogs/2026-07/pr-8-dedup-audit-report.md) |
| R-093 | RPT | PR-8 重复函数去重审计报告 | 版本**: v1.0.0 | **日期**: 2026-07-08 | I-31,R-139 | C-37,R-094 | [pr-8-dedup-audit-report.md](../reports/changelogs/pr-8-dedup-audit-report.md) |
| R-094 | RPT | PR-8 重复函数去重重构方案 | 版本**: v1.0.0 | **日期**: 2026-07-08 | I-31,R-093,R-139 | C-37 | [pr-8-dedup-plan.md](../reports/changelogs/pr-8-dedup-plan.md) |
| R-095 | RPT | Report-6 整改行动清单 | 审计来源**：`../../reference/v9-code-quality- | - | C-37,I-80,I-81,R-037 | [report-6-remediation-action-list.md](../reports/audit/report-6-remediation-action-list.md) |
| R-096 | RPT | RM整改方案 — 全量审计差异清单 | 生成时间：2026-07-09 10:03 | 审计基准：文档 v.s. 代码实 | - | C-37,I-80,R-037 | [2026-07-09-rm-audit-diff-report.md](../reports/2026-07-09-rm-audit-diff-report.md) |
| R-097 | RPT | solo-review.md — 单人开发代码审查指南 | 版本**: v1.0.0 | **日期**: 2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [solo-review.md](../explanation/design/solo-review.md) |
| R-098 | RPT | src/store 派生计算文件文档化必要性分析 | 分析对象**: src/store 下 5 个派生计算文件 | - | C-37,I-80,R-037 | [2026-07-08-store-derived-documentation-analysis.md](../reports/2026-07-08-store-derived-documentation-analysis.md) |
| R-099 | RPT | src/store 派生计算文件文档化必要性分析 | 生成时间**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-store-derived-documentation-analysis.md](../reports/2026-07-09-store-derived-documentation-analysis.md) |
| R-100 | RPT | T-09 WCAG 对比度复核报告 | - | - | C-37,I-80,I-82,R-037 | [a11y-contrast-report.md](../explanation/a11y-contrast-report.md) |
| R-101 | RPT | T-11 分层依赖与文档同步审计报告 | 任务**: T-11 · 分层依赖与文档同步审计 | - | C-37,I-80,R-037 | [t11-compliance-audit-report.md](../reports/t11-compliance-audit-report.md) |
| R-102 | RPT | TradeReviewAI SkillDevelopment 测试说明 | - | - | C-37,I-80,I-81,I-82,R-037 | [tradereviewai-skill-testing.md](../explanation/design/tradereviewai-skill-testing.md) |
| R-103 | RPT | TypeScript 错误处理和类型安全检测报告 | - | - | C-37,I-80,I-82,R-037 | [typescript错误处理和类型安全检测报告.md](../reports/audit/typescript错误处理和类型安全检测报告.md) |
| R-104 | RPT | v2.2.1 dataLayer.test.ts 测试覆盖率对比报告 | - | - | C-37,I-80,I-81,R-037 | [v2.2.1-test-coverage-comparison.md](../reports/v2.2.1-test-coverage-comparison.md) |
| R-105 | RPT | v2.2.1 测试覆盖率对比报告 | - | - | C-37,I-80,I-81,R-037 | [test-coverage-comparison-v2.2.1.md](../reports/test-coverage-comparison-v2.2.1.md) |
| R-106 | RPT | V6 Pro 备份源码/线上站点 与 V9 当前项目 UI & Page 差异全 | Status**: Current / Analysis | - | C-37,I-81,I-82,R-037 | [v6pro-ui-page-diff-report.md](../explanation/v6pro-ui-page-diff-report.md) |
| R-107 | RPT | V6 Pro 备份源码/线上站点 与 V9 当前项目 UI & Page 差异全 | Status**: Current / Analysis | - | C-37,I-177,I-80 | [v6pro-ui-page-diff-report.md](../explanation/design/v6pro-ui-page-diff-report.md) |
| R-108 | RPT | V6-V9 UI 组件库比对分析报告 | 生成时间: 2026-07-01 | - | C-37,I-80,I-81,I-82,R-037,R-11 | [v6-v9-ui-component-comparison-report.md](../reports/audit/v6-v9-ui-component-comparison-report.md) |
| R-109 | RPT | V6-V9 界面设计优化整改任务明细表 | 版本**: v1.0 | **建立**: 2026-07-08 | **基准** | - | C-37,I-80,I-82,R-037 | [ui-remediation-tracker.md](../reference/ui-remediation-tracker.md) |
| R-110 | RPT | V9 P0 严重问题修复方案 | 文档版本**：v1.0 | R-136 | C-37,I-80,I-81,I-82,R-037 | [v9-p0-remediation-plan.md](../explanation/design/v9-p0-remediation-plan.md) |
| R-111 | RPT | V9 UI 组件增加可行性评估报告 | 评估日期: 2026-07-01 | I-70,R-108 | C-37,I-80,I-81,I-82,R-037 | [v9-ui-component-feasibility-assessment.md](../reports/audit/v9-ui-component-feasibility-assessment.md) |
| R-112 | RPT | V9 上线前终审报告 | 注意**：首轮校对中 27 个测试文件 / 90 个用例失败，主要集中在 V6  | - | C-37,I-242 | [pre-launch-audit-report-2026-07-14.md](../reports/audit/pre-launch-audit-report-2026-07-14.md) |
| R-113 | RPT | V9 交互时序文档复核报告 | 复核对象：`docs/v9-interaction-flows.html` | - | C-37,I-80,I-82,R-037 | [v9-interaction-flows-review.md](../explanation/design/v9-interaction-flows-review.md) |
| R-114 | RPT | V9 代码质量校对分析 — 过程透明看板 | ⚠️ **本文档已过时（2026-07-12 标注，N5 模式）**：本看板为  | I-119,I-284,I-31,R-115 | C-37 | [v9-code-quality-kanban-20260629.md](../reports/audit/v9-code-quality-kanban-20260629.md) |
| R-115 | RPT | V9 代码质量校对分析报告 | 审计周期**: 2026-06-29 | I-284,I-31,I-34,R-119,R-120,R- | C-37,I-240,I-298,I-80,I-81,I-8 | [v9-code-quality-audit-report-20260629.md](../explanation/v9-code-quality-audit-report-20260629.md) |
| R-116 | RPT | V9 代码质量校对分析报告 | 审计周期**: 2026-06-29 | C-12,I-285,I-34,R-119,R-120,R- | C-37,I-299 | [v9-code-quality-audit-report-20260629.md](../reference/v9-code-quality-audit-report-20260629.md) |
| R-117 | RPT | V9 代码质量校对分析报告（2026-07-13 更新） | 审计周期**: 2026-07-13 | - | C-37,C-59,I-82 | [v9-code-quality-audit-report-20260713.md](../explanation/v9-code-quality-audit-report-20260713.md) |
| R-118 | RPT | V9 全量审计问题详细清单 | 生成时间**: 2026-07-05 | - | C-37,I-80,I-81,R-037 | [full-audit-inventory-2026-07-05.md](../reports/full-audit-inventory-2026-07-05.md) |
| R-119 | RPT | V9 前端应用代码编写质量审计报告 (B4-1) | 审计日期：2026-06-29 | - | C-37,I-80,I-81,I-82,R-037,R-11 | [audit-b4-1-code-quality.md](../reference/audit-b4-1-code-quality.md) |
| R-120 | RPT | V9 前端应用安全质量审计报告 | 说明**: 本审计仅覆盖前端代码层面的安全问题，不包含后端 API、服务器配置、 | - | C-37,I-80,I-81,I-82,R-037,R-11 | [audit-b4-4-security.md](../reference/audit-b4-4-security.md) |
| R-121 | RPT | V9 前端应用性能质量审计报告 | 审计日期：2026-06-29 | R-115 | C-37,I-80,I-81,I-82,R-037,R-11 | [audit-b4-3-performance.md](../explanation/design/audit-b4-3-performance.md) |
| R-122 | RPT | V9 前端应用测试质量审计报告 | 审计日期：2026-06-29 | - | C-37,I-80,I-81,I-82,R-037,R-11 | [audit-b4-2-test-quality.md](../explanation/audit-b4-2-test-quality.md) |
| R-123 | RPT | V9 双策略一致性收敛 — 验收报告 | - | - | C-37,I-80,I-81,I-82,R-037 | [v9-acceptance-report.md](../explanation/design/v9-acceptance-report.md) |
| R-124 | RPT | V9 回滚方案演练记录（P0-08） | 生成时间**: 2026-07-13 | - | C-37,I-82 | [rollback-drill-report.md](../explanation/rollback-drill-report.md) |
| R-125 | RPT | V9 开发后复盘报告 | Status**: Current | - | C-37,I-80,I-81,I-82,R-037 | [v9-post-dev-review.md](../explanation/design/v9-post-dev-review.md) |
| R-126 | RPT | V9 文档体系化审计与补全建议书 | 角色**：架构治理官 | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v9-documentation-audit-report.md](../explanation/design/v9-documentation-audit-report.md) |
| R-127 | RPT | V9 文档更新报告 — 2026-07-08 | 报告类型**: 文档同步与交叉检查报告 | - | C-37,I-80,R-037 | [2026-07-08-document-update-report.md](../reports/2026-07-08-document-update-report.md) |
| R-128 | RPT | V9 智能体检视报告 | 生成日期：2026-06-27 | - | C-37,I-80,I-81,I-82,R-037 | [agent-audit-report.md](../reference/agent-audit-report.md) |
| R-129 | RPT | V9 智能投研复盘系统 - MCP 最小耦合原则合规性分析报告 | - | - | C-37,I-80,I-81,I-82,R-037,R-15 | [mcp-coupling-analysis-report.md](../explanation/design/mcp-coupling-analysis-report.md) |
| R-130 | RPT | V9 智能投研复盘系统 - 审计警告报告 | 生成时间**: 2026-07-12 | - | C-37 | [audit-warning-report.md](../reports/audit/audit-warning-report.md) |
| R-131 | RPT | V9 智能投研复盘系统 — 全面整改报告 | 版本**: v1.0 | **日期**: 2026-07-12 | - | C-37 | [system-rectification-report-2026-07-12.md](../reports/system-rectification-report-2026-07-12.md) |
| R-132 | RPT | V9 智能投研复盘系统 — 整改完成报告 | 生成时间**：2026-07-12 | - | C-37,R-133 | [system-rectification-final-report.md](../reports/system-rectification-final-report.md) |
| R-133 | RPT | V9 智能投研复盘系统 — 整改遗留事项后续处理计划 | 版本**: v1.0 | **日期**: 2026-07-12 | R-132 | C-37 | [rectification-follow-up-plan.md](../reports/rectification-follow-up-plan.md) |
| R-134 | RPT | V9 智能投研复盘系统 — 核心数据策略报告 | 文档体系版本**: v2.0.0 | **本文档修订**: rev.1 | ** | - | C-37,I-263,I-274,I-82 | [core-data-strategy-report.md](../explanation/core-data-strategy-report.md) |
| R-135 | RPT | V9 智能投研复盘系统 — 测试报告 | 生成时间**: 2026-07-12 | - | C-37,I-242 | [test-report-2026-07-12.md](../reports/test-report-2026-07-12.md) |
| R-136 | RPT | V9 智能投研复盘系统 — 质量审计总结报告 | 审计周期**：2026-06-27 | - | C-37,I-80,I-81,I-82,R-037,R-11 | [audit-summary-report.md](../explanation/design/audit-summary-report.md) |
| R-137 | RPT | V9 更新日志报告 | 生成时间: 2026-07-04 06:45:59 | - | C-37,I-80,I-81,R-037 | [changelog-2026-07-04t06-45-59.md](../reports/changelog-2026-07-04t06-45-59.md) |
| R-138 | RPT | V9 更新日志报告 | 生成时间: 2026-07-04 06:46:30 | - | C-37,I-80,I-81,R-037 | [monthly-2026-07.md](../reports/monthly-2026-07.md) |
| R-139 | RPT | V9 架构文档变更日志 | 遵循"变更即记录（Change as Record）"原则，每次架构/数据变更均 | - | C-37,R-093,R-094 | [CHANGELOG.md](../reports/changelogs/CHANGELOG.md) |
| R-140 | RPT | V9 架构缺陷与整改行动清单 | 来源文档**： | - | C-37,I-242 | [v9-架构缺陷与整改行动清单.md](../reports/audit/v9-架构缺陷与整改行动清单.md) |
| R-141 | RPT | V9 模块完成度逆向校验 — 执行计划 | 批次 E 合计**：5（输出舱）+ 2（总控舱 Hub+根）+ 10（Agent | - | C-37,I-80,I-81,I-82,R-037 | [quality-audit-plan.md](../explanation/design/quality-audit-plan.md) |
| R-142 | RPT | V9 模块完成度逆向校验 — 执行计划 | 批次 E 合计**：5（输出舱）+ 2（总控舱 Hub+根）+ 10（Agent | - | C-37 | [quality-audit-plan.md](../reports/audit/quality-audit-plan.md) |
| R-143 | RPT | V9 模块补全验收报告 | - | - | C-37,I-80,I-82,R-037 | [模块补全验收报告.md](../reports/audit/模块补全验收报告.md) |
| R-144 | RPT | V9 模块集成水平测试比对报告 — Agent集群修复后 | 审计日期**：2026-06-29（Agent集群修复批次） | - | C-37,I-80,I-81,R-037 | [report-12-integration-baseline-comparison.md](../reports/audit/report-12-integration-baseline-comparison.md) |
| R-145 | RPT | V9 比对/分析报告 — 检索与横向比对报告 | 检索时间：2026-07-08 ｜ 范围：`docs/`、`根目录` 下所有 ` | - | C-37,I-80,I-82,R-037 | [比对分析报告检索与比对报告.md](../reports/audit/比对分析报告检索与比对报告.md) |
| R-146 | RPT | V9 渗透测试自查报告（P0-03） | 生成时间**: 2026-07-13 | - | C-37,I-82 | [penetration-test-report.md](../explanation/penetration-test-report.md) |
| R-147 | RPT | V9 漏洞扫描报告与处理建议 | 生成时间**: 2026-07-13 | - | C-37,I-82 | [vulnerability-scan-report.md](../explanation/vulnerability-scan-report.md) |
| R-148 | RPT | V9 系统代码质量综合报告 | - | - | C-37,I-80,I-81,R-037 | [code-quality-report-2026-07-06.md](../reports/code-quality-report-2026-07-06.md) |
| R-149 | RPT | V9 系统代码重构执行方案 | 生成时间**: 2026-07-04 | - | C-37,I-80,I-81,R-037 | [refactoring-plan-2026-07-04.md](../reports/refactoring-plan-2026-07-04.md) |
| R-150 | RPT | V9 计划与排期（Plans） | 定位**：存放设计阶段的过程产物（方案、基线、评估、排期表）。 | - | C-37 | [README.md](../reports/release-management/README.md) |
| R-151 | RPT | V9 输入舱升级策略报告 | Status**: Current | - | C-37,I-177,I-80,I-81,I-82,R-03 | [v9-input-cabin-strategy-report.md](../reference/v9-input-cabin-strategy-report.md) |
| R-152 | RPT | V9 问题修复排期报告 | 基准：`V6Pro_整体架构梳理_v3.md`、`v6pro_architect | - | C-37,I-80,I-81,I-82,R-037 | [v9-remediation-plan.md](../explanation/design/v9-remediation-plan.md) |
| R-153 | RPT | V9 阶段性合并报告（Batch 1-3 汇总） | 归并来源：`batch1-merge-report.md` + `batch2- | - | C-37,I-177,I-80,I-81,I-82,R-03 | [batch-merge-reports.md](../explanation/design/batch-merge-reports.md) |
| R-154 | RPT | V9 项目审计报告 — 2026-07-05 | 审计时间：2026-07-05 | I-114,I-115,R-129,R-162 | C-37,I-80,I-81,R-037 | [audit-findings-2026-07-05.md](../reports/audit-findings-2026-07-05.md) |
| R-155 | RPT | V9 项目文件系统全局诊断报告 | 扫描范围**：D:\FinSightV9（排除 node_modules/.gi | - | C-37,I-82 | [file-system-diagnosis-report-2026-07-20.md](../reports/audit/file-system-diagnosis-report-2026-07-20.md) |
| R-156 | RPT | V9 项目文档化工作技术分享 PPT 大纲 | 生成时间**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-technical-sharing-ppt-outline.md](../reports/2026-07-09-technical-sharing-ppt-outline.md) |
| R-157 | RPT | V9 项目文档化工作最终总结报告 | 生成时间**: 2026-07-08 | - | C-37,I-80,R-037 | [2026-07-08-documentation-summary-report.md](../reports/2026-07-08-documentation-summary-report.md) |
| R-158 | RPT | V9 项目更新日志 — 文档化工作完成 | 日期**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-update-log.md](../reports/2026-07-09-update-log.md) |
| R-159 | RPT | V9 项目未文档化文件报告 | 生成时间**: 2026-07-08 | - | C-37,I-80,R-037 | [2026-07-08-undocumented-files-report.md](../reports/2026-07-08-undocumented-files-report.md) |
| R-160 | RPT | V9 项目未文档化文件报告（更新版） | 生成时间**: 2026-07-09 | - | C-37,I-80,R-037 | [2026-07-09-undocumented-files-report.md](../reports/2026-07-09-undocumented-files-report.md) |
| R-161 | RPT | V9系统四类常态问题综合分析报告 | - | - | C-37,I-80,R-037 | [2026-07-09-four-category-problem-analysis.md](../reports/2026-07-09-four-category-problem-analysis.md) |
| R-162 | RPT | V9项目Token优化最佳实践指南 | - | I-180,I-31,R-163 | C-37,I-80,I-81,R-037,R-154 | [token-optimization-best-practices.md](../reports/token-optimization-best-practices.md) |
| R-163 | RPT | V9项目Token消耗深度分析报告 | - | - | C-37,I-80,I-81,R-037,R-162 | [token-consumption-analysis-2026-07-04.md](../reports/token-consumption-analysis-2026-07-04.md) |
| R-164 | RPT | 七维采集配置模块 — 文档交叉检查报告 | 检查日期**: 2026-07-01 | - | C-37,I-80,I-81,I-82,R-037 | [doc-cross-check-report.md](../explanation/design/doc-cross-check-report.md) |
| R-165 | RPT | 二次校验报告 — 2026-07-15 | 报告范围**: V9 v2.6.1 系统性评分的二次深度校验 | - | C-37 | [secondary-verification-report-2026-07-15.md](../00-meta/secondary-verification-report-2026-07-15.md) |
| R-166 | RPT | 代码多层嵌套评审报告 | 评审范围：`src/` 目录下全部非测试 TypeScript/TSX 文件 | - | C-37,I-82 | [nested-code-review-report.md](../explanation/nested-code-review-report.md) |
| R-167 | RPT | 代码审查快速参考卡片 | 打印建议**: 将本节打印并贴在显示器旁，或使用 asciiflow.com 转 | - | C-37,I-80,I-81,I-82,R-037 | [code-review-cheatsheet.md](../reference/code-review-cheatsheet.md) |
| R-168 | RPT | 代码审查者培训材料 | 版本**: v1.0.0 | **日期**: 2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [code-review-training.md](../explanation/design/code-review-training.md) |
| R-169 | RPT | 代码清理待确认清单与信息孤岛整合建议 | 版本**：v1.0（真实重建） | **日期**：2026-07-07 | - | C-37,I-80,I-82,R-037 | [代码清理待确认清单与信息孤岛整合建议.md](../reports/audit/代码清理待确认清单与信息孤岛整合建议.md) |
| R-170 | RPT | 代码评审报告 · WIP 聚焦评审（2026-07-11） | 评审范围**：工作树中 19 个未提交文件 + 未跟踪文件（i18n/UI_TE | - | C-37,I-80,R-037 | [code-review-wip-2026-07-11.md](../reports/code-review-wip-2026-07-11.md) |
| R-171 | RPT | 代码质量合规审查报告 | 审查对象**：智能投研复盘系统 V9（``） | - | C-37,I-80,I-82,R-037 | [代码质量合规审查报告_2026-07-08.md](../reports/audit/代码质量合规审查报告_2026-07-08.md) |
| R-172 | RPT | 代码质量审查报告 | 审查日期**: 2026-06-30 | R-174 | C-37,I-80,I-81,I-82,R-037 | [code-quality-audit-report.md](../reports/audit/code-quality-audit-report.md) |
| R-173 | RPT | 代码质量整改与回归测试报告 | 工程**：智能投研复盘系统 V9 | - | C-37,I-80,I-82,R-037 | [代码质量整改与回归测试报告_2026-07-08.md](../reports/audit/代码质量整改与回归测试报告_2026-07-08.md) |
| R-174 | RPT | 代码质量量化考核标准（v1.0） | 本标准基于项目 Hard Constraints 和 Engineering C | - | C-37,I-80,I-81,I-82,R-037,R-17 | [code-quality-rubric.md](../reports/audit/code-quality-rubric.md) |
| R-175 | RPT | 优化计划执行进度报告（P1 服务层中优项推进） | 生成时间：2026-07-11 00:25 | - | C-37,I-82 | [optimization-progress-report.md](../explanation/optimization-progress-report.md) |
| R-176 | RPT | 依赖分析报告 | - | - | C-37 | [dependency-analysis.md](../reports/dependency-analysis.md) |
| R-177 | RPT | 全面检测、总结与整改报告 — 2026-07-05 | 检测范围**：全量审计（tsc / audit:layers / audit:h | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-comprehensive-audit-and-remediation.md](../reference/changelogs/2026-07/2026-07-05-comprehensive-audit-and-remediation.md) |
| R-178 | RPT | 冗余设计专项端到端验证报告（R1–R5） | 版本**：v1.0 | **日期**：2026-07-14 | - | C-37,I-82 | [e2e-verify-redundancy-report.md](../reports/e2e-verify-redundancy-report.md) |
| R-179 | RPT | 剩余 3 个 P1 缺口修复代码方案 | 日期**: 2026-07-09 | **状态**: 待执行 | **缺口数** | - | C-37,I-80,R-037 | [2026-07-09-remaining-p1-gaps-fix-plan.md](../reports/2026-07-09-remaining-p1-gaps-fix-plan.md) |
| R-180 | RPT | 剩余复杂度整改任务清单与计划（2026-07-12） | 基准：`complexity-baseline-current.json`（实测 | - | C-37,I-82 | [complexity-remediation-plan.md](../explanation/complexity-remediation-plan.md) |
| R-181 | RPT | 变更日志 — 2026-07-05 开发后复盘修复 | 日期**: 2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-post-dev-review.md](../reference/changelogs/2026-07/2026-07-05-post-dev-review.md) |
| R-182 | RPT | 圈复杂度优化方案 | 生成日期**: 2026-07-12 | - | C-37 | [complexity-optimization-plan.md](../reports/complexity-optimization-plan.md) |
| R-183 | RPT | 审计脚本误报分析报告 | 报告编号**: FP-2026-07-05-001 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-audit-false-positive-analysis.md](../reference/changelogs/2026-07/2026-07-05-audit-false-positive-analysis.md) |
| R-184 | RPT | 工作区未跟踪文件整改报告 | 工作区**：`c:\Users\huawei\Documents\kimi\Wo | - | C-37,I-80,I-82,R-037 | [untracked-files-remediation-report.md](../reports/audit/untracked-files-remediation-report.md) |
| R-185 | RPT | 开发复盘行动项执行日志 | 日期**：2026-07-05 | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-post-dev-review-actions.md](../reference/changelogs/2026-07/2026-07-05-post-dev-review-actions.md) |
| R-186 | RPT | 开发教训总结与知识沉淀报告 | 生成时间: 2026-07-12T00:39:37.015Z | - | C-37,I-80,R-037 | [latest.md](../reports/lessons-learned/latest.md) |
| R-187 | RPT | 开发教训总结与知识沉淀报告 | 生成时间: 2026-07-12T00:39:37.015Z | - | C-37,I-80,R-037 | [lessons-learned-2026-07-12.md](../reports/lessons-learned/lessons-learned-2026-07-12.md) |
| R-188 | RPT | 批次 B（输入舱）L1-L5 五层追溯审计报告 | 审计日期**: 2026-07-05 | - | C-37,I-80,I-81,R-037 | [batch-b-input-audit.md](../reports/batch-b-input-audit.md) |
| R-189 | RPT | 批次 C（分析舱）L1-L5 五层追溯审计报告 | 审计日期**: 2026-07-05 | - | C-37,I-80,I-81,R-037 | [audit-batch-c-analysis.md](../reports/audit-batch-c-analysis.md) |
| R-190 | RPT | 文档↔代码双向一致性检测报告 | 说明：AGENTS.md 服务层清单用省略号（`analysis/scoring | - | C-37,I-80,I-82,R-037 | [文档-代码双向一致性检测报告_2026-07-08.md](../reports/audit/文档-代码双向一致性检测报告_2026-07-08.md) |
| R-191 | RPT | 文档更新结果报告 | 报告日期**: 2026-07-05 | - | C-37,I-80,I-81,R-037 | [2026-07-05-document-update-report.md](../reports/2026-07-05-document-update-report.md) |
| R-192 | RPT | 文档自动化更新与交叉检查结果报告 | 执行时间：2026-07-01 晚间批次 | - | C-37,I-80,I-81,I-82,R-037 | [doc-update-report-20260701.md](../explanation/design/doc-update-report-20260701.md) |
| R-193 | RPT | 未文档化文件 JSDoc/TSDoc 文档注释模板 | 生成时间**: 2026-07-08 | - | C-37,I-80,R-037 | [2026-07-08-undocumented-files-jsdoc-templates.md](../reports/2026-07-08-undocumented-files-jsdoc-templates.md) |
| R-194 | RPT | 测试失败分析报告 | - | I-119 | C-37,I-80,I-81,R-037 | [test-failure-analysis-report.md](../reports/test-failure-analysis-report.md) |
| R-195 | RPT | 知识图谱构建Token消耗复盘与优化报告 | - | - | C-37,I-80,I-81,R-037 | [knowledge-graph-token-optimization-report.md](../reports/knowledge-graph-token-optimization-report.md) |
| R-196 | RPT | 类型错误诊断报告 | 生成日期**: 2026-07-05 | - | C-37,I-80,I-81,R-037 | [type-error-diagnosis-report.md](../reports/type-error-diagnosis-report.md) |
| R-197 | RPT | 统一错误处理补丁报告 | 生成时间：2026-07-12T06:41:54.485Z | - | C-37 | [error-handling-patch-report-2026-07-12.md](../reports/error-handling-patch-report-2026-07-12.md) |
| R-198 | RPT | 股票池看板迁移回归测试报告 | - | - | C-37,I-82 | [regression-test-report.md](../explanation/regression-test-report.md) |
| R-199 | RPT | 脚本与测试质量检查报告 | 检查日期：2026-07-05 | - | C-37,I-80,I-81,R-037 | [脚本与测试质量检查报告.md](../reports/脚本与测试质量检查报告.md) |
| R-200 | RPT | 评分引擎异常处理优化测试报告 | - | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-05-exception-handling-test-report.md](../explanation/2026-07-05-exception-handling-test-report.md) |
| R-201 | RPT | 评分拍照比对功能模块 — 补充穿行测试报告 | 版本**: v1.1 | **日期**: 2026-07-04 | - | C-37,I-80,I-81,I-82,R-037 | [walkthrough-scoredoc-report.md](../reference/walkthrough-scoredoc-report.md) |
| R-202 | RPT | 路由注册缺失报告 | 日期**: 2026-07-09 | **严重级别**: P1 | **影响范围 | - | C-37,I-80,R-037 | [2026-07-09-route-registration-gap-report.md](../reports/2026-07-09-route-registration-gap-report.md) |
| R-203 | RPT | 输出舱模块未显示问题 — 整改报告 | 报告编号**: V9-OUTPUT-CABIN-REMEDIATION-2026 | - | C-37,I-80,I-82,R-037 | [output-cabin-remediation-report.md](../reports/audit/output-cabin-remediation-report.md) |
| R-204 | RPT | 邮件正文：V9 项目文档化工作完成通知 | - | - | C-37,I-80,R-037 | [2026-07-09-email-body.md](../reports/2026-07-09-email-body.md) |
| R-205 | RPT | 项目优化处理总结报告 | 汇总范围：V9 智能投研复盘系统 `src/`、`docs/`、`scripts | - | C-37,I-82 | [optimization-summary-report.md](../explanation/design/optimization-summary-report.md) |
| R-206 | RPT | 颜色整改总结报告 | 报告日期**: 2026-07-03 | - | C-37,I-81,I-82,R-037 | [color-remediation-summary-report-20260703.md](../reports/audit/color-remediation-summary-report-20260703.md) |
| R-207 | SPEC | 6 个 Disabled MCP Server 深度复盘报告 | 审计日期**: 2026-07-20 | - | C-37,I-82 | [mcp-disabled-server-deep-dive.md](../reports/retrospectives/mcp-disabled-server-deep-dive.md) |
| R-208 | SPEC | data_link_sequence_diagram | - | - | C-37 | [data_link_sequence_diagram.md](../reports/retrospectives/data_link_sequence_diagram.md) |
| R-209 | SPEC | MCP Server 僵尸模块审计报告 | 审计日期**: 2026-07-20 | - | C-37,I-82 | [mcp-zombie-server-audit-report.md](../reports/retrospectives/mcp-zombie-server-audit-report.md) |
| R-210 | SPEC | MCP 模块状态与历史变更记录 | 文档用途**：记录 MCP Server 生命周期中的所有状态变更，作为决策追溯 | - | C-37,I-82 | [mcp-module-status.md](../reports/retrospectives/mcp-module-status.md) |
| R-211 | SPEC | V9 实施文档保鲜度告警清单 | 生成日期：2026-06-27 | - | C-37 | [freshness-alerts.md](../reports/retrospectives/freshness-alerts.md) |
| R-212 | SPEC | V9 实施文档健康度报告 | 生成日期：2026-06-27 | - | C-37,I-81,I-82,R-037 | [health-report.md](../reports/retrospectives/health-report.md) |
| R-213 | SPEC | V9 实施文档时间轴报告 | 生成日期：2026-06-27 | - | C-37,I-81,I-82,R-037 | [timeline-report.md](../reports/retrospectives/timeline-report.md) |
| R-214 | SPEC | V9 阶段性合并报告（Batch 1-3 汇总） | 归并来源：`batch1-merge-report.md` + `batch2- | - | C-37 | [batch-merge-reports.md](../reports/retrospectives/batch-merge-reports.md) |
| R-215 | SPEC | V9 项目经验教训 — 团队分享摘要版 | 版本**: v1.0.0 | **日期**: 2026-07-13 | **阅读 | R-216 | C-37,I-82 | [lessons-learned-summary.md](../reports/retrospectives/lessons-learned-summary.md) |
| R-216 | SPEC | V9 项目经验教训知识库 | 版本**: v1.0.0 | **生成日期**: 2026-07-13 | ** | - | C-37,I-82,R-215 | [lessons-learned.md](../reports/retrospectives/lessons-learned.md) |
| R-217 | SPEC | 代码-文档同步整体方案与执行计划 | Status**: Current | - | C-37 | [doc-sync-execution-plan.md](../reports/retrospectives/doc-sync-execution-plan.md) |
| R-218 | SPEC | 评分拍照比对功能模块 — 补充穿行测试报告 | 版本**: v1.1 | **日期**: 2026-07-04 | - | C-37 | [walkthrough-scoredoc-report.md](../reports/retrospectives/walkthrough-scoredoc-report.md) |
| R-219 | TEST | V9 系统界面功能测试与优化执行方案 | For agentic workers:** REQUIRED SUB-SKIL | - | C-37,I-80,I-81,I-82,R-037 | [2026-07-04-ui-testing-optimization.md](../reference/2026-07-04-ui-testing-optimization.md) |
| R-220 | TEST | 回归测试套件模板 | 本模板参照 AGENTS.md §12.4 三级回归测试套件。 | - | C-37,I-82 | [regression-suite-v1.0.0.md](../00-meta/deprecated-docs/old-versions/regression-suite-v1.0.0.md) |
| R-221 | UI | ADR-005: PortalShell 深色 Kimi 经典布局 | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-23-portalshell-dark-kimi-layout.md](../explanation/2026-06-23-portalshell-dark-kimi-layout.md) |
| R-222 | UI | ADR-006: 输入舱拆分为四子页面 | Status**: Accepted | - | C-37,I-177,I-80,I-81,I-82,R-03 | [2026-06-24-input-cabin-subpages.md](../explanation/2026-06-24-input-cabin-subpages.md) |

