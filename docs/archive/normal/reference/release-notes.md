---
title: release-notes
type: reference
domain: project
phase: deployment
tier: important
status: active
maintainer: V9 Architecture Team
summary: "release-notes - reference documentation (project)"
tags: [project, release, reference, changelog, deployment]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-104
referenced_by: [V9-DOC-PROJ-174, V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 发布说明

> 本文件面向用户与开发者，汇总每个已发布版本的核心变更、质量指标与升级须知。

---

## v0.9.5 — P0 质量改进：L2 状态层补齐 + 动态质量分析引擎

**发布日期**：2026-06-29

### 概要

本次版本聚焦 **P0 质量改进**，核心目标是将 L2 状态层（Store）覆盖率从 52.6% 提升至 90.0%，并通过自研动态质量分析引擎实现代码库质量的量化追踪。同步补齐 4 个分析舱页面的 Store 迁移，新增 66 个单元测试，综合评分从 D 级提升至 B 级。

### 核心变更

#### 1. P0-1 Store 补齐（4 个 Store 迁移）

| 页面 | Store | 测试用例 | 说明 |
|------|-------|----------|------|
| `analysis/NewsPage.tsx` | `newsStore.ts`（扩展） | — | 新增 V9 track + `loadWithFilter` action |
| `ScoreDocPage.tsx` | `scoreDocStore.ts`（新建） | 9 个 | 完整状态管理 + 测试 |
| `IntelligentScorePage.tsx` | `intelligentScoreStore.ts`（新建） | 28 个 | Hook 重构为纯常量导出 |
| `IndustryScorePage.tsx` | `industryScoreStore.ts`（新建） | 29 个 | Hook 重构，状态下沉 |

- 新增测试总计 **66 个**，项目累计 **345 个**
- 所有 Store 遵循统一模式：类型定义 → Store 创建 → Action 实现 → 单元测试覆盖

#### 2. 动态质量分析引擎

- 新建 `scripts/quality/quality-config.ts`，从代码库实时扫描采集质量指标
- 生成 7 张动态分析图表（覆盖率趋势、模块热力图、测试分布、硬编码扫描、死代码分布、Store 迁移进度、综合评分雷达）
- 导出结构化 JSON 报告，支持 CI 集成与历史趋势对比

### 质量指标

| 指标 | 改进前 | 改进后 | 变化 |
|------|--------|--------|------|
| Store 覆盖率 | 52.6% | 90.0% | +37.4pp |
| 综合评分 | 55.1 (D) | 81.4 (B) | +26.3 |
| 测试用例总数 | 279 | 345 | +66 |
| TypeScript 编译 | 0 errors | 0 errors | — |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/store/scoreDocStore.ts` | ScoreDocPage 专用 Store |
| `src/store/intelligentScoreStore.ts` | IntelligentScorePage 专用 Store |
| `src/store/industryScoreStore.ts` | IndustryScorePage 专用 Store |
| `tests/stores/scoreDocStore.test.ts` | scoreDocStore 单元测试（9 用例） |
| `tests/stores/intelligentScoreStore.test.ts` | intelligentScoreStore 单元测试（28 用例） |
| `tests/stores/industryScoreStore.test.ts` | industryScoreStore 单元测试（29 用例） |
| `scripts/quality/quality-config.ts` | 动态质量分析引擎 |
| `scripts/reports/chart_dynamic_01.png` ~ `chart_dynamic_07.png` | 7 张动态分析图表 |
| `scripts/reports/dynamic_analysis_report.json` | 结构化质量快照 |

### 修改文件

| 文件 | 变更说明 |
|------|----------|
| `src/store/analysisNewsStore.ts` | 新增 V9 track 与 `loadWithFilter` action |
| `src/pages/analysis/NewsPage.tsx` | 迁移至扩展 newsStore |
| `src/pages/analysis/ScoreDocPage.tsx` | 迁移至 scoreDocStore |
| `src/pages/analysis/IntelligentScorePage.tsx` | 迁移至 intelligentScoreStore |
| `src/pages/analysis/IndustryScorePage.tsx` | 迁移至 industryScoreStore |
| `src/hooks/cabin/useIntelligentScorePage.ts` | 重构为纯常量导出 |
| `src/hooks/cabin/useIndustryScorePage.ts` | 重构为纯常量导出 |

### 升级须知

- 无破坏性变更。所有页面行为保持不变，仅状态管理层从页面内局部状态下沉至全局 Store。
- `useIntelligentScorePage` 与 `useIndustryScorePage` 两个 Hook 的公共 API 不变，内部实现改为从 Store 读取。

---

## v0.9.6 — 文档体系清理

**发布日期**：2026-06-29

### 概要

本次版本聚焦**文档体系整理与健康度维护**，删除约 212 个文件/目录，修复 44 处文档断裂链接，更新 .gitignore 规则。清理范围涵盖临时调试产物、已完成的迁移文档、已废弃的旧文档、过程性审计报告，保留核心架构规范与实施文档。

### 清理内容

#### 1. 临时产物清理

| 类型 | 删除内容 | 文件数 |
|------|---------|--------|
| Playwright MCP 调试快照 | `.playwright-mcp/` | 49 |
| 迁移验证截图 | `screenshots/` | 16 |
| 审计产物 | `component-audit-data.json`、`component-audit-report.txt` | 2 |
| Python 缓存 | `docs/audit/assets/__pycache__/` | — |
| Python 虚拟环境 | `.venv/` | ~90 |

#### 2. 迁移过程文档清理

| 文件 | 理由 |
|------|------|
| `../explanation/v6pro-to-v9-migration-analysis.md` | 一次性 PoC 验证，已完成 |
| `../explanation/v6pro-to-v9-migration-analysis.md` | 一次性验收确认，已完成 |
| `./v6-to-v9-migration-spec.md` | 迁移已完成，参考价值低 |
| `../00-meta/development-log.md` | 一次性修复报告 |
| `scripts/fix/apply-multi-match-fixes.ts` | 一次性迁移脚本 |

#### 3. 已废弃文档清理

- `docs/explanation/implementation/deprecated/` 目录 9 个文件全部删除（已被替代文档覆盖）
- 13 份旧版/重复文档（数据字典 v1.0、数据资产清单 v1.0.1、架构缺陷清单、docs/release-notes.md 等）

#### 4. 过程性审计报告清理

- 27 份过程性文档（report-1~12 快照、completeness-profile-batch1~5、fix plan 等）

### 文档链接修复

修复 11 个文档中的 44 处断裂 Markdown 链接，确保文档交叉引用完整性。

### .gitignore 更新

| 变更 | 说明 |
|------|------|
| 新增 `.venv/`、`venv/`、`__pycache__/`、`*.pyc` | 防止 Python 虚拟环境被提交 |
| `/*.md` → `*.report.md` 等精确模式 | 避免误忽略 README 等重要文件 |
| 删除 `temp/backup/` | 已被 `temp/` 覆盖 |

### 升级须知

- 无代码变更，不影响编译和运行
- `.venv/` 如需重建：`python -m venv .venv && pip install -r python/data_service/requirements.txt`

- 动态质量分析引擎为独立 Python 脚本，不影响前端构建流程。

---
