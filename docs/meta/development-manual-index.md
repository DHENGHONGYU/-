---
title: V9 开发手册索引（Development Manual Index）
type: meta
domain: project
phase: deployment
tier: important
status: active
maintainer: V9 Architecture Team
summary: "FinSightV9 全栈开发规则、编码规范、测试策略、接口约定的一站式索引，覆盖 SDLC 七阶段 90+ 篇核心文档"
tags: [index, development-manual, coding-conventions, testing, quality-gates, sdlc, reference]
version: v1.1.0
last_updated: 2026-08-20
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-META-013
related_docs:
  - V9-DOC-SOP-000
  - V9-DOC-QA-065
  - V9-DOC-GUIDE-046
  - V9-DOC-GUIDE-029
  - V9-DOC-QA-116
  - V9-DOC-PROJ-181
covers_docs:
  - docs/guides/standards/coding-conventions.md
  - docs/guides/standards/component-naming-conventions.md
  - docs/guides/standards/quality-gates.md
  - docs/guides/testing-strategy.md
  - docs/guides/09-quality-gates.md
  - docs/guides/CODE-REVIEW.md
  - docs/guides/sops/README.md
  - docs/guides/sops/S01-dev-env-setup.md
  - docs/guides/sops/S02-dev-workflow.md
  - docs/guides/sops/S03-code-review.md
  - docs/guides/sops/S04-pre-merge-integration.md
  - docs/guides/sops/S05-pre-launch-checklist.md
  - docs/guides/sops/S06-release-deployment.md
  - docs/guides/sops/S07-ops-incident-response.md
  - docs/guides/how-to/git-commit-governance.md
  - docs/guides/how-to/how-to-use-audit-scripts.md
  - docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md
  - docs/guides/how-to/no-unsafe-fix-patterns.md
  - docs/guides/how-to/hooks-guide.md
  - docs/guides/how-to/code-review-guide.md
  - docs/guides/how-to/mcp-acl-guide.md
  - docs/audit/code-quality-rubric.md
  - docs/guides/how-to/MCP-LIFECYCLE-GUIDE.md
  - docs/guides/how-to/ui-performance-best-practices.md
  - docs/guides/how-to/how-to-troubleshooting.md
  - docs/guides/how-to/COLOR-TOKEN-GUIDE.md
  - docs/guides/how-to/how-to-add-service.md
  - docs/guides/how-to/how-to-add-store.md
  - docs/guides/how-to/how-to-add-widget.md
  - docs/guides/how-to/how-to-configure-v6-scoring.md
  - docs/guides/how-to/how-to-run-scoring-pipeline.md
  - docs/guides/how-to/how-to-data-import-export.md
  - docs/guides/how-to/README.md
  - docs/guides/module-completion-standard.md
  - docs/guides/design-to-code-workflow.md
  - docs/guides/widget-development-guide.md
  - docs/reference/screening-contract.md
  - docs/reference/useCase-contract.md
  - docs/reference/fetcher-contract.md
  - docs/reference/pwa-offline-guide.md
  - docs/reference/coding-conventions.md
  - docs/reference/rotation-score-spec.md
  - docs/reference/agent-runtime-spec.md
  - docs/reference/dataflow-engine-spec.md
  - docs/reference/dual-strategy-dataflow-spec.md
  - docs/reference/trading-cabin-spec.md
  - docs/reference/analysis-cabin-spec.md
  - docs/reference/command-cabin-spec.md
  - docs/reference/output-cabin-spec.md
change_log:
  - version: v1.1.0
    changes: "交叉检查与补充：修复 covers_docs 拼写错误、踩坑规则路径；新增 How-To 13 篇、组件治理 3 篇、设计流程 2 篇、接口契约 7 篇、参考规格 8 篇、团队手册 7 篇、教程 2 篇；快速导航扩充 7 条；文档总数 60+ → 90+"
    date: 2026-08-20
  - version: v1.0.0
    changes: Initial version：9 大分类 60+ 篇文档索引，覆盖 SDLC 全生命周期
    date: 2026-08-20
---
covers_code:
  - src/data/types.ts


# V9 开发手册索引

> **文档体系版本**: v2.0.0-rc.2 | **本文档版本**: v1.1.0 | **兼容 AGENTS.md v1.6.0+
> **定位**: 一站式索引，汇聚 FinSightV9 项目所有开发规则、编码规范、测试策略、接口约定文档（90+ 篇）
> **使用方式**: 开发前查表、遇到问题时快速定位对应规范文档

---

## 一、快速导航（按场景）

| 我想... | 打开这份文档 |
|--------|-------------|
| 从零搭建开发环境 | [S01 环境搭建](#二-sdlc-七阶段-sop) |
| 了解代码编码规范 | [coding-conventions](#三代码风格与编码规范) |
| 知道文件放哪里 | [FILE-MANAGEMENT-GUIDE](#三代码风格与编码规范) |
| 写代码时避免踩坑 | [踩坑规则门禁指南](#七安全与踩坑规则) |
| 提交代码前检查 | [S02 日常开发](#二-sdlc-七阶段-sop) |
| 审查他人 PR | [S03 代码审查](#二-sdlc-七阶段-sop) |
| 测试我的代码 | [testing-strategy](#四测试规范) |
| 确保质量门禁通过 | [09-quality-gates](#五质量门禁与审查体系) |
| 上线前做全面体检 | [S05 上线前体检](#二-sdlc-七阶段-sop) |
| 发布和部署版本 | [S06 发布部署](#二-sdlc-七阶段-sop) |
| 线上出了故障 | [S07 运维应急](#二-sdlc-七阶段-sop) |
| 了解 API 和数据契约 | [接口与数据约定](#六接口与数据约定) |
| 查询审计脚本用法 | [how-to-use-audit-scripts](#五质量门禁与审查体系) |
| 新增 Service/Store/Widget | [开发实操指南](#三代码风格与编码规范) |
| 配置评分引擎 | [how-to-configure-v6-scoring](#三代码风格与编码规范) |
| UI 性能优化 | [ui-performance-best-practices](#三代码风格与编码规范) |
| MCP 生命周期管理 | [MCP-LIFECYCLE-GUIDE](#三代码风格与编码规范) |
| 组件准入审查 | [component-admission-policy](#七安全与踩坑规则) |
| 设计稿转代码 | [design-to-code-workflow](#七安全与踩坑规则) |
| 新成员快速上手 | [getting-started](#八文档治理元规范) |

---

## 二、SDLC 七阶段 SOP

> 完整覆盖开发全生命周期，按阶段执行，S04/S05/S06 为 **T1 P0 强制级**

```
S01 环境搭建 → S02 日常开发 → S03 代码审查 → S04 集成测试 → S05 上线体检 → S06 发布部署 → S07 运维应急
```

| # | 文档 | doc_id | 等级 | 核心内容 | 典型耗时 |
|:-:|------|:------:|:----:|----------|:--------:|
| SOP-000 | [SOP 总览](../guides/sops/README.md) | V9-DOC-SOP-000 | T0 | 7 阶段流转图、快速选择指南、版本兼容矩阵 | — |
| SOP-001 | [S01 环境搭建](../guides/sops/S01-dev-env-setup.md) | V9-DOC-SOP-001 | T2 P1 | 9 步搭建 + 跨平台双命令 + Mentor 5/5 通过 | ≤ 60 min |
| SOP-002 | [S02 日常开发与提交](../guides/sops/S02-dev-workflow.md) | V9-DOC-SOP-002 | T2 P1 | 7 型分支 + Worktree + 22 步门禁速查 + 6 步 pre-push | 按需 |
| SOP-003 | [S03 代码审查](../guides/sops/S03-code-review.md) | V9-DOC-SOP-003 | T2 P1 | PR 8 字段模板 + 三轮 55+ 项检查矩阵 | ≤ 30 min |
| SOP-004 | [S04 合并前集成测试](../guides/sops/S04-pre-merge-integration.md) | V9-DOC-SOP-004 | T1 P0🔥 | gate:quick 7 子门禁 + 可信测试 ≥ 99.2% + CI 双检 | 15–25 min |
| SOP-005 | [S05 上线前全面体检](../guides/sops/S05-pre-launch-checklist.md) | V9-DOC-SOP-005 | T1 P0🔥 | 24 步门禁 + 真数测试（禁 MOCK）+ 6 维加权评分 | 30–60 min |
| SOP-006 | [S06 版本发布与部署](../guides/sops/S06-release-deployment.md) | V9-DOC-SOP-006 | T1 P0🔥 | SemVer 规则 + 三文件同步 + 灰度/正式/回滚方案 | 20–40 min |
| SOP-007 | [S07 上线后运维与应急](../guides/sops/S07-ops-incident-response.md) | V9-DOC-SOP-007 | T2 P1 | 48h 值守表 + P0 故障 5 层上报 + RCA 模板 | 值守 48h |

---

## 三、代码风格与编码规范

### 3.1 核心编码规范

| 文档 | doc_id | 核心规则 |
|------|:------:|----------|
| [coding-conventions.md](../guides/standards/coding-conventions.md) | V9-DOC-GUIDE-046 | 禁 `any`、禁 `@ts-ignore`；零硬编码；四步集成契约；日志规范；事件监听清理模板 |
| [component-naming-conventions.md](../guides/standards/component-naming-conventions.md) | V9-DOC-GUIDE-047 | PascalCase 命名；@fileoverview 模板；Props 接口文档；导出模式规范；`audit:naming` 自动检查 |
| [code-quality-rubric.md](../audit/code-quality-rubric.md) | — | 6 维度量化考核：硬编码、嵌套深度、圈复杂度、错误处理、类型安全、代码重复 |

### 3.2 TypeScript 类型安全

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [no-unsafe-fix-patterns.md](../guides/how-to/no-unsafe-fix-patterns.md) | V9-DOC-GUIDE-012 | 14 种 `@typescript-eslint/no-unsafe-*` 修复模式，含 Before/After 代码对比与自动化脚本输入 |

### 3.3 文件与目录规范

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [FILE-MANAGEMENT-GUIDE.md](../guides/how-to/FILE-MANAGEMENT-GUIDE.md) | V9-DOC-DEV-010 | 文件归位规则（30+ 目录）、`.gitignore` 说明、生命周期管理 |
| [hooks-guide.md](../guides/how-to/hooks-guide.md) | V9-DOC-DEV-011 | 自定义 Hook 清单、Provider 约束、事件清理规范、性能 Hook 使用 |

### 3.4 开发实操指南（How-To）

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [how-to-add-service.md](../guides/how-to/how-to-add-service.md) | — | 如何新增 Service（DataBridge + Envelope 路由） |
| [how-to-add-store.md](../guides/how-to/how-to-add-store.md) | — | 如何新增 Store（Zustand + withBroadcast） |
| [how-to-add-widget.md](../guides/how-to/how-to-add-widget.md) | — | 如何新增 Widget（WidgetShell + 事件总线） |
| [how-to-configure-v6-scoring.md](../guides/how-to/how-to-configure-v6-scoring.md) | — | 如何配置 V6 评分引擎权重与阈值 |
| [how-to-run-scoring-pipeline.md](../guides/how-to/how-to-run-scoring-pipeline.md) | — | 如何运行采集与评分流水线 |
| [how-to-data-import-export.md](../guides/how-to/how-to-data-import-export.md) | — | 如何导入导出与备份 V9 数据 |
| [how-to-troubleshooting.md](../guides/how-to/how-to-troubleshooting.md) | — | V9 常见问题排查指南 |
| [ui-performance-best-practices.md](../guides/how-to/ui-performance-best-practices.md) | — | UI 性能最佳实践：渲染优化、内存泄漏检测 |
| [COLOR-TOKEN-GUIDE.md](../guides/how-to/COLOR-TOKEN-GUIDE.md) | — | 颜色令牌生命周期管理（入-移-出） |
| [MCP-LIFECYCLE-GUIDE.md](../guides/how-to/MCP-LIFECYCLE-GUIDE.md) | — | MCP 生命周期管理指南（入-移-出） |
| [pathtrace-deployment-guide.md](../guides/how-to/pathtrace-deployment-guide.md) | — | PathTrace 模块部署与配置指南 |
| [pathtrace-github-actions-deploy-guide.md](../guides/how-to/pathtrace-github-actions-deploy-guide.md) | — | PathTrace GitHub Actions 部署与版本门控指南 |
| [README.md](../guides/how-to/README.md) | — | how-to 操作指南目录索引 |

---

## 四、测试规范

### 4.1 测试策略

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [testing-strategy.md](../guides/testing-strategy.md) | V9-DOC-GUIDE-XXX | 三层测试金字塔（Unit/Integration/E2E）；vitest + Playwright 工具链；Store Mock 模式；覆盖率目标表；Playwright 回归策略 |
| [V9-TEST-CASES.md](../reference/V9-TEST-CASES.md) | — | 系统测试用例大全 |

### 4.2 测试分层与覆盖率

| 层级 | 工具 | 最低覆盖率 | 典型示例 |
|------|------|:----------:|----------|
| 单元测试 | vitest + jsdom | core/data/lib ≥ 85% | `databridge.test.ts`, `intelligentScore.test.ts` |
| 集成测试 | vitest + @testing-library/react | services ≥ 70% | `StockAnalysisPage.test.tsx` |
| E2E 测试 | Playwright | 关键路径 100% | `e2e/pool-group.spec.ts` |

### 4.3 测试模式速查

| 场景 | 参考模板 |
|------|----------|
| 页面组件测试 | testing-strategy §七.1 页面组件测试模板 |
| 服务层测试 | testing-strategy §七.2 服务层测试模板 |
| Widget 测试 | testing-strategy §七.3 Widget 测试模板 |
| Store Mock | testing-strategy §四 Store Mock 模式 |
| useEffect cleanup | testing-strategy §五 useEffect cleanup 测试 |

### 4.4 视觉回归

| 文档 | 说明 |
|------|------|
| [visual-regression-guide.md](../guides/how-to/visual-regression-guide.md) | UI 视觉回归测试方法与流程 |

---

## 五、质量门禁与审查体系

### 5.1 质量门禁

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [09-quality-gates.md](../guides/09-quality-gates.md) | V9-DOC-QA-065 | **权威门禁定义**：13 项门禁总览、类型/规范/测试/构建/审计门禁、CI 流水线规划、偏差收敛计划 |
| [quality-gates.md](../guides/standards/quality-gates.md) | V9-DOC-QA-108 | 旧文档入口，指向 09-quality-gates.md |

**13 项门禁速查**：

| # | 门禁项 | 目标 | 命令 |
|:-:|--------|------|------|
| 1 | TypeScript 类型检查 | 0 errors | `tsc --noEmit` |
| 2 | ESLint 代码规范 | 0 warnings/errors | `npm run lint` |
| 3 | 单元测试 | 全通过 | `npm run test` |
| 4 | 生产构建 | 产物生成成功 | `npm run build` |
| 5 | 跨层调用审计 | 0 违规 | `npm run audit:layers` |
| 6 | 硬编码审计 | 0 阈值/颜色 | `npm run audit:hardcode` |
| 7 | 死代码审计 | 0 空壳/漂移 | `npm run audit:deadcode` |
| 8 | 测试覆盖率 | core ≥ 85% | `npm run coverage` |
| 9 | E2E 冒烟 | 0 失败 | `npm run test:e2e` |
| 10 | 路由一致性 | 0 漂移 | `npm run audit:deadcode` |
| 11 | PWA 离线验证 | Service Worker 正常 | 手动/Playwright |
| 12 | 数据蓝图一致性 | Store/类型/文档一致 | `validate:blueprint` |
| 13 | 踩坑规则门禁 | 0 ERROR | `python pitfall_check.py` |

### 5.2 代码审查

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [CODE-REVIEW.md](../guides/CODE-REVIEW.md) | V9-DOC-PROJ-181 | **三级审查体系**（自动化/同级/架构）；P0/P1/P2 检查清单；PR 模板；审查流程 |
| [code-review-guide.md](../guides/how-to/code-review-guide.md) | — | 审查实操指南 |
| [code-review-cheatsheet.md](../guides/development/code-review/code-review-cheatsheet.md) | — | 审查要点速查表 |

**P0 强制检查项**：架构合规性、类型安全、零硬编码、功能正确性

### 5.3 Git 提交规范

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [git-commit-governance.md](../guides/how-to/git-commit-governance.md) | V9-DOC-QA-121 | Conventional Commits 格式；Scope 守卫 4 规则（文件数≤30、禁跨层、禁临时产物）；Windows 兼容性约束 |

**提交规范速查**：
- 格式：`type(scope): description`
- 合法 type：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- 禁止：中文冒号、`git add -A`、GUI/IDE 插件提交

### 5.4 审计脚本

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [how-to-use-audit-scripts.md](../guides/how-to/how-to-use-audit-scripts.md) | V9-DOC-QA-116 | 40+ 审计脚本分类；3 级质量门禁（gate:dev/gate:quick/regression） |

**3 级门禁命令**：

| 级别 | 命令 | 覆盖内容 | 耗时 |
|------|------|----------|:----:|
| P0 开发门禁 | `npm run gate:dev` | lint + tsc + 分层 + 原子性 + DB + ACL | < 30s |
| P1 快速门禁 | `npm run gate:quick` | P0 + Mock + ACL + 文档 + 硬编码 + DB | < 2 min |
| P2 回归门禁 | `npm run regression` | lint + test + 全量审计 + build + e2e | 5–10 min |

---

## 六、接口与数据约定

### 6.1 API 与系统架构

| 文档 | 路径 | 说明 |
|------|------|------|
| [api-contract.md](../reference/api-contract.md) | `docs/reference/` | 系统 API 接口定义 |
| [v9-system-blueprint.md](../reference/v9-system-blueprint.md) | `docs/reference/` | 系统架构蓝图 |
| [system-contract.md](../reference/system-contract.md) | `docs/reference/` | 系统级数据契约 |
| [data-layer-overview.md](../explanation/data-layer-overview.md) | `docs/explanation/` | 数据层架构说明 |
| [rotation-score-spec.md](../reference/rotation-score-spec.md) | `docs/reference/` | 轮动评分服务实现规格 |
| [agent-runtime-spec.md](../reference/agent-runtime-spec.md) | `docs/reference/` | Agent Runtime 实现规格 |
| [dataflow-engine-spec.md](../reference/dataflow-engine-spec.md) | `docs/reference/` | 数据流引擎规格 |
| [dual-strategy-dataflow-spec.md](../reference/dual-strategy-dataflow-spec.md) | `docs/reference/` | 双策略体系与数据流架构 |
| [trading-cabin-spec.md](../reference/trading-cabin-spec.md) | `docs/reference/` | Trading 舱规格 |
| [analysis-cabin-spec.md](../reference/analysis-cabin-spec.md) | `docs/reference/` | 分析舱规格 |
| [command-cabin-spec.md](../reference/command-cabin-spec.md) | `docs/reference/` | 指挥舱规格 |
| [output-cabin-spec.md](../reference/output-cabin-spec.md) | `docs/reference/` | 输出舱规格 |

### 6.2 数据流与 DataBridge

| 文档 | 路径 | 说明 |
|------|------|------|
| [data-flow-spec.md](../reference/data-flow-spec.md) | `docs/reference/` | 数据流设计规范 |
| [data_link_sequence_diagram.md](../reference/data_link_sequence_diagram.md) | `docs/reference/` | 数据链路时序图 |
| [databridge端点与数据映射清单.md](../reference/databridge端点与数据映射清单.md) | `docs/reference/` | DataBridge 端点与数据映射 |
| [V9_IndexedDB_Store_Schema.md](../reference/V9_IndexedDB_Store_Schema.md) | `docs/reference/` | IndexedDB 存储 Schema |

### 6.3 模块数据契约

| 文档 | 说明 |
|------|------|
| [analysis-contract.md](../reference/analysis-contract.md) | 分析模块契约 |
| [scoring-contract.md](../reference/scoring-contract.md) | 评分模块契约 |
| [trading-contract.md](../reference/trading-contract.md) | 交易模块契约 |
| [news-contract.md](../reference/news-contract.md) | 资讯模块契约 |
| [collection-contract.md](../reference/collection-contract.md) | 采集模块契约 |
| [data-collector-contract.md](../reference/data-collector-contract.md) | 数据采集器契约 |
| [input-contract.md](../reference/input-contract.md) | 输入模块契约 |
| [export-contract.md](../reference/export-contract.md) | 导出模块契约 |
| [execution-contract.md](../reference/execution-contract.md) | 执行模块契约 |
| [portfolio-contract.md](../reference/portfolio-contract.md) | 组合模块契约 |
| [backtest-contract.md](../reference/backtest-contract.md) | 回测模块契约 |
| [llm-contract.md](../reference/llm-contract.md) | LLM 模块契约 |
| [screening-contract.md](../reference/screening-contract.md) | 筛选模块契约 |
| [useCase-contract.md](../reference/useCase-contract.md) | 用例编排契约 |
| [fetcher-contract.md](../reference/fetcher-contract.md) | 数据获取契约 |
| [rbac-contract.md](../reference/rbac-contract.md) | 权限控制契约 |
| [pwa-contract.md](../reference/pwa-contract.md) | PWA 离线契约 |
| [pwa-offline-guide.md](../reference/pwa-offline-guide.md) | PWA 离线功能指南 |

### 6.4 数据定义

| 文档 | 说明 |
|------|------|
| [BACKTEST_DATA_DEFINITION.md](../reference/BACKTEST_DATA_DEFINITION.md) | 回测数据定义 |
| [AI_CENTER_DATA_DEFINITION.md](../reference/AI_CENTER_DATA_DEFINITION.md) | AI 中心数据定义 |
| [SEVEN_DIM_CONFIG_DATA_DEFINITION.md](../reference/SEVEN_DIM_CONFIG_DATA_DEFINITION.md) | 七维配置数据定义 |
| [MULTI_FACTOR_SCREENING_DATA_DEFINITION.md](../reference/multi-factor-screening-data-definition.md) | 多因子选股数据定义 |
| [NEWS_DATA_DEFINITION.md](../archive/normal/reference/NEWS_DATA_DEFINITION.md) | 资讯数据定义 |
| [COCKPIT_DATA_DEFINITION.md](../reference/cockpit/DATA_DEFINITION.md) | 驾驶舱数据定义 |
| [DATA_COLLECTION_DATA_DEFINITION.md](../reference/data-collection/DATA_DEFINITION.md) | 数据采集定义 |
| [V9_INDEXEDDB_STORE_SCHEMA.md](../reference/V9_IndexedDB_Store_Schema.md) | IndexedDB Schema |

---

## 七、安全与踩坑规则

| 文档 | 路径 | 核心内容 |
|------|------|----------|
| [踩坑规则门禁指南.md](../guides/踩坑规则门禁指南.md) | `docs/guides/` | 14 条踩坑规则、Python 检测脚本 `pitfall_check.py` |
| [security-model.md](../archive/normal/reference/security-model.md) | `docs/archive/` | 系统安全模型设计 |
| [mcp-acl-guide.md](../guides/how-to/mcp-acl-guide.md) | `docs/guides/how-to/` | MCP 访问控制列表配置 |
| [component-admission-policy.md](../guides/component-admission-policy.md) | `docs/guides/` | 组件准入标准与流程 |
| [component-lifecycle-sop.md](../guides/component-lifecycle-sop.md) | `docs/guides/` | 组件生命周期管理 |
| [no-unsafe-fix-patterns.md](../guides/how-to/no-unsafe-fix-patterns.md) | `docs/guides/how-to/` | TypeScript 类型安全修复模式 |

---

### 7.3 组件治理与准入

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [component-admission-policy.md](../guides/component-admission-policy.md) | V9-DOC-GUIDE-033 | 组件新增准入 6 步流程、4 项测试要求、3 项文档要求 |
| [component-lifecycle-sop.md](../guides/component-lifecycle-sop.md) | V9-DOC-GUIDE-034 | 组件全生命周期：创建→注册→使用→审查→归档/删除；季度僵尸组件清理 |
| [module-completion-standard.md](../guides/module-completion-standard.md) | — | 模块完成标准（Definition of Done）：8 项验收条件 |

### 7.4 设计与开发流程

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [design-to-code-workflow.md](../guides/design-to-code-workflow.md) | — | Design→Code 工作流规范：Figma → 组件实现 → 审查 |
| [widget-development-guide.md](../guides/widget-development-guide.md) | — | Widget 开发指南：WidgetShell + 事件总线 + 数据桥接 |

---

## 八、文档治理元规范

| 文档 | doc_id | 核心内容 |
|------|:------:|----------|
| [GOVERNANCE.md](GOVERNANCE.md) | — | **文档治理宪法**：十目录架构、Frontmatter 标准、三环闭环 |
| [doc-id-registry.md](doc-id-registry.md) | — | 全局 doc_id 注册表 |
| [document-classification-system.md](document-classification-system.md) | V9-DOC-META-004 | 文档分类体系 |
| [document-metadata-standard.md](document-metadata-standard.md) | V9-DOC-META-008 | Frontmatter 元数据规范 |
| [document-style-guide.md](document-style-guide.md) | V9-DOC-META-010 | 文档风格指南与命名规范 |
| [directory-structure-guide.md](directory-structure-guide.md) | V9-DOC-META-005 | 项目目录结构规范 |

---

## 九、快速命令速查

### 9.1 开发前必跑

```bash
# 代码质量全套检查
npm run gate:dev

# 快速验证
npm run lint && npx tsc --noEmit && npm test -- --run
```

### 9.2 质量审计

```bash
# 跨层调用检查
npm run audit:layers

# 硬编码检查
npm run audit:hardcode

# 死代码检查
npm run audit:deadcode

# 文档同步检查
npm run audit:docs

# 组件命名合规
npm run audit:naming

# 颜色零硬编码
npm run lint:colors
```

### 9.3 测试

```bash
# 运行全部单元测试
npm run test

# 生成覆盖率报告
npx vitest run --coverage

# 运行 E2E 测试
npm run test:e2e

# 可信测试（排除 quarantine）
npm run test:stable
```

### 9.4 构建与发布

```bash
# 生产构建
npm run build

# 完整回归门禁
npm run regression

# 快速门禁（PR 合并前）
npm run gate:quick
```

### 9.5 文档治理

```bash
# 文档健康度检查
npm run audit:docs

# JSDoc 覆盖率
npm run audit:jsdoc

# 文档完整性
npm run audit:doc-integrity
```

---

## 十、完整文档清单（按类别）

### 10.1 代码风格与编码规范（8 篇）

| # | 文档 | 路径 | 核心领域 |
|:-:|------|------|----------|
| 1 | coding-conventions | [standards/coding-conventions.md](../guides/standards/coding-conventions.md) | 编码规范、类型安全、零硬编码 |
| 2 | component-naming-conventions | [standards/component-naming-conventions.md](../guides/standards/component-naming-conventions.md) | 组件命名、文档模板 |
| 3 | no-unsafe-fix-patterns | [how-to/no-unsafe-fix-patterns.md](../guides/how-to/no-unsafe-fix-patterns.md) | TypeScript 类型安全修复 |
| 4 | code-quality-rubric | [audit/code-quality-rubric.md](../audit/code-quality-rubric.md) | 6 维度量化评分 |
| 5 | FILE-MANAGEMENT-GUIDE | [how-to/FILE-MANAGEMENT-GUIDE.md](../guides/how-to/FILE-MANAGEMENT-GUIDE.md) | 文件归位、目录结构 |
| 6 | hooks-guide | [how-to/hooks-guide.md](../guides/how-to/hooks-guide.md) | 自定义 Hook 规范 |
| 7 | jsdoc-convention | [jsdoc-convention.md](../reference/jsdoc-convention.md) | JSDoc 注释规范 |
| 8 | design-tokens | [design-tokens.md](../reference/design-tokens.md) | 设计令牌标准 |

### 10.2 测试规范（5 篇）

| # | 文档 | 路径 | 核心领域 |
|:-:|------|------|----------|
| 1 | testing-strategy | [testing-strategy.md](../guides/testing-strategy.md) | 三层测试金字塔、覆盖率 |
| 2 | V9-TEST-CASES | [V9-TEST-CASES.md](../reference/V9-TEST-CASES.md) | 测试用例清单 |
| 3 | visual-regression-guide | [how-to/visual-regression-guide.md](../guides/how-to/visual-regression-guide.md) | 视觉回归测试 |
| 4 | regression-suite | [regression-suite.md](../reference/templates/regression-suite.md) | 回归测试模板 |
| 5 | completeness-profile | [completeness-profile.md](../reference/completeness-profile.md) | 完整性评估 |

### 10.3 质量门禁与审查（7 篇）

| # | 文档 | 路径 | 核心领域 |
|:-:|------|------|----------|
| 1 | 09-quality-gates | [09-quality-gates.md](../guides/09-quality-gates.md) | 13 项门禁权威定义 |
| 2 | quality-gates | [standards/quality-gates.md](../guides/standards/quality-gates.md) | 门禁入口（指向 09） |
| 3 | CODE-REVIEW | [CODE-REVIEW.md](../guides/CODE-REVIEW.md) | 三级审查体系 |
| 4 | code-review-guide | [how-to/code-review-guide.md](../guides/how-to/code-review-guide.md) | 审查实操指南 |
| 5 | code-review-cheatsheet | [development/code-review/code-review-cheatsheet.md](../guides/development/code-review/code-review-cheatsheet.md) | 审查速查表 |
| 6 | git-commit-governance | [how-to/git-commit-governance.md](../guides/how-to/git-commit-governance.md) | Git 提交守卫 |
| 7 | how-to-use-audit-scripts | [how-to/how-to-use-audit-scripts.md](../guides/how-to/how-to-use-audit-scripts.md) | 40+ 审计脚本用法 |
| 8 | 踩坑规则门禁指南 | [踩坑规则门禁指南.md](../guides/踩坑规则门禁指南.md) | 14 条踩坑规则 + Python 检测 |

### 10.4 SDLC SOP（8 篇）

| # | 文档 | 路径 | 核心领域 |
|:-:|------|------|----------|
| 1 | SOP 总览 | [sops/README.md](../guides/sops/README.md) | 7 阶段流转图 |
| 2 | S01 环境搭建 | [sops/S01-dev-env-setup.md](../guides/sops/S01-dev-env-setup.md) | 9 步搭建 |
| 3 | S02 日常开发 | [sops/S02-dev-workflow.md](../guides/sops/S02-dev-workflow.md) | 分支/提交/门禁 |
| 4 | S03 代码审查 | [sops/S03-code-review.md](../guides/sops/S03-code-review.md) | 55+ 项检查矩阵 |
| 5 | S04 集成测试 | [sops/S04-pre-merge-integration.md](../guides/sops/S04-pre-merge-integration.md) | gate:quick + 可信测试 |
| 6 | S05 上线体检 | [sops/S05-pre-launch-checklist.md](../guides/sops/S05-pre-launch-checklist.md) | 24 步 + 真数测试 |
| 7 | S06 发布部署 | [sops/S06-release-deployment.md](../guides/sops/S06-release-deployment.md) | SemVer + 灰度/回滚 |
| 8 | S07 运维应急 | [sops/S07-ops-incident-response.md](../guides/sops/S07-ops-incident-response.md) | 值守 + P0 响应 |

### 10.5 接口与数据约定（25+ 篇）

| # | 文档类别 | 路径模式 | 数量 |
|:-:|----------|----------|:----:|
| 1 | 系统/架构契约 | `docs/reference/*-contract.md` | 5 |
| 2 | 模块数据契约 | `docs/reference/{module}-contract.md` | 14 |
| 3 | 数据定义 | `docs/reference/*-data-definition.md` | 8 |
| 4 | 数据流规范 | `docs/reference/data-flow*.md` | 3 |
| 5 | Schema/蓝图 | `docs/reference/*schema*.md` / `*blueprint*.md` | 4 |
| 6 | 模块实现规格 | `docs/reference/*spec*.md` | 8 |

### 10.6 安全与踩坑（5 篇）

| # | 文档 | 路径 |
|:-:|------|------|
| 1 | 踩坑规则门禁指南 | `docs/guides/踩坑规则门禁指南.md` |
| 2 | security-model | `docs/archive/normal/reference/security-model.md` |
| 3 | mcp-acl-guide | `docs/guides/how-to/mcp-acl-guide.md` |
| 4 | component-admission-policy | `docs/guides/component-admission-policy.md` |
| 5 | no-unsafe-fix-patterns | `docs/guides/how-to/no-unsafe-fix-patterns.md` |
| 6 | MCP-LIFECYCLE-GUIDE | `docs/guides/how-to/MCP-LIFECYCLE-GUIDE.md` |
| 7 | UI-performance-best-practices | `docs/guides/how-to/ui-performance-best-practices.md` |
| 8 | module-completion-standard | `docs/guides/module-completion-standard.md` |
| 9 | design-to-code-workflow | `docs/guides/design-to-code-workflow.md` |
| 10 | widget-development-guide | `docs/guides/widget-development-guide.md` |

### 10.7 文档治理（6 篇）

| # | 文档 | 路径 |
|:-:|------|------|
| 1 | GOVERNANCE.md | `docs/meta/GOVERNANCE.md` |
| 2 | doc-id-registry.md | `docs/meta/doc-id-registry.md` |
| 3 | document-classification-system.md | `docs/meta/document-classification-system.md` |
| 4 | document-metadata-standard.md | `docs/meta/document-metadata-standard.md` |
| 5 | document-style-guide.md | `docs/meta/document-style-guide.md` |
| 6 | directory-structure-guide.md | `docs/meta/directory-structure-guide.md` |

---

### 8.1 团队手册与教程

| 文档 | 路径 | 说明 |
|------|------|------|
| [团队手册 README](../guides/team-handbook/README.md) | `docs/guides/team-handbook/` | 团队手册入口 |
| [01 设计与原创思路](../guides/team-handbook/01-design-philosophy.md) | `docs/guides/team-handbook/` | 设计哲学 |
| [02 整体架构设计](../guides/team-handbook/02-architecture.md) | `docs/guides/team-handbook/` | 架构设计思路 |
| [03 UI 组件设计](../guides/team-handbook/03-ui-components.md) | `docs/guides/team-handbook/` | UI 组件设计思路 |
| [04 模型运行思路](../guides/team-handbook/04-model-runtime.md) | `docs/guides/team-handbook/` | Model Runtime 数据流 |
| [05 竞品分析](../guides/team-handbook/05-competitive-analysis.md) | `docs/guides/team-handbook/` | 竞品分析（TODO） |
| [06 团队开发操作指南](../guides/team-handbook/06-team-operation-guide.md) | `docs/guides/team-handbook/` | 团队操作指南 |

### 8.2 新成员上手

| 文档 | 路径 | 说明 |
|------|------|------|
| [新成员 30 分钟上手指南](../guides/tutorials/getting-started.md) | `docs/guides/tutorials/` | 30 分钟快速上手 |
| [Tutorials README](../guides/tutorials/README.md) | `docs/guides/tutorials/` | 教程目录 |

---

## 附录 A：文档分类与等级

### T0 核心文档（每季度审查）

| 文档 | 说明 |
|------|------|
| [AGENTS.md](AGENTS.md) | AI Agents 索引 |
| [GOVERNANCE.md](GOVERNANCE.md) | 文档治理宪法 |
| [09-quality-gates.md](../guides/09-quality-gates.md) | 质量门禁真相源 |
| [sops/README.md](../guides/sops/README.md) | SDLC SOP 总览 |
| [REGISTRY_INDEX.md](REGISTRY_INDEX.md) | 注册表索引 |

### T1 重要文档（每半年审查）

| 文档 | 说明 |
|------|------|
| [coding-conventions.md](../guides/standards/coding-conventions.md) | 编码规范 |
| [testing-strategy.md](../guides/testing-strategy.md) | 测试策略 |
| [CODE-REVIEW.md](../guides/CODE-REVIEW.md) | 代码审查标准 |
| [S05-pre-launch-checklist.md](../guides/sops/S05-pre-launch-checklist.md) | 上线体检 |
| [S06-release-deployment.md](../guides/sops/S06-release-deployment.md) | 发布部署 |

### T2 一般文档（每年审查）

其余所有文档

---

## 附录 B：架构分层与依赖方向

```
┌─────────────────────────────────────────────┐
│  L5  UI 层（pages / components / portal）    │
│  ↓ 仅通过 Store 取数                         │
│  L4  Store 层（Zustand + withBroadcast）     │
│  ↓ 仅通过 Service 调用                       │
│  L3  Service 层（经 DataBridge 读写）        │
│  ↓ 经 DataBridge.forward()                  │
│  L2  Core 层（DataBridge / Envelope / ACL）  │
│  ↓ 直接操作 dataLayer                        │
│  L1  Data 层（IndexedDB 封装）               │
│  ↓                                           │
│  L0  Config / Constants / Types             │
└─────────────────────────────────────────────┘
```

**四步集成契约**（新增模块必须遵循）：
1. 类型定义 → `src/types/` 或 `src/data/types.ts`
2. Store 实现 → `src/store/`（Zustand + withBroadcast）
3. Service 适配 → `src/services/`（经 `DataBridge.forward()` 写数据）
4. UI 消费 → `src/pages/` 或 `src/components/`（仅经 Store 取数）

---

## 附录 C：版本兼容矩阵

| 本文档版本 | 兼容 code_version | 兼容 AGENTS.md | 关键依赖 |
|:----------:|:-----------------:|:-------------:|----------|
| v1.0.0 | 2.0.0-rc.2 | v1.6.0+ | SOP Suite v1.0.0, quality-gates v2.5.0 |

**更新触发条件**：AGENTS.md 大版本升级、门禁编号/阈值变化、SOP 体系改版

---

## 附录 D：文档贡献指南

### 新增规则文档

1. 确认文档所属分类（§一 快速导航定位）
2. 在对应目录创建文档，使用 **Frontmatter 标准**（见 GOVERNANCE.md §二）
3. 分配唯一 doc_id（查 doc-id-registry.md）
4. 在本索引文档对应章节补充条目
5. 更新 doc-id-registry.md 注册表
6. 运行 `npm run audit:docs` 验证一致性

### 更新现有文档

1. 修改 frontmatter `last_updated` 与 `version`
2. 补充 `change_log` 条目
3. 若涉及门禁阈值变更，同步更新 09-quality-gates.md 与相关 SOP
4. 运行 `npm run audit:agents-consistency:strict` 验证

---

## 🔗 相关文档

| 文档 | 关系 |
|------|------|
| [GOVERNANCE.md](GOVERNANCE.md) | 文档治理宪法（上游） |
| [REGISTRY_INDEX.md](REGISTRY_INDEX.md) | 注册表索引（平行） |
| [sops/README.md](../guides/sops/README.md) | SDLC SOP 总览（下游引用） |
| [09-quality-gates.md](../guides/09-quality-gates.md) | 质量门禁定义（下游引用） |
| [doc-id-registry.md](doc-id-registry.md) | doc_id 分配表（平行） |

---

**维护者**: V9 Architecture Team  
**最后更新**: 2026-08-20  
**下次审查**: 2026-11-20（T0 文档季度审查）