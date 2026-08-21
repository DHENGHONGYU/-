---
title: TODO-ADD-TITLE
type: meta
domain: project
phase: planning
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "00-meta directory document index and navigation entry"
tags: [meta, documentation, index, project, governance, checklist]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-175
related_docs: [V9-DOC-PROJ-016, V9-DOC-META-000, V9-DOC-PROJ-026, V9-DOC-PROJ-316, V9-DOC-PROJ-315, V9-DOC-PROJ-317, V9-DOC-PROJ-321, V9-DOC-QA-111, V9-DOC-PROJ-320, V9-DOC-ARCH-047, V9-DOC-PROJ-007, V9-DOC-PROJ-010, V9-DOC-PROJ-325, V9-DOC-AI-031, V9-DOC-PROJ-338, V9-DOC-PROJ-184]
referenced_by: [V9-DOC-META-000]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 00-meta — 文档治理与元数据

> **定位**：文档系统的治理层与元数据层
> **治理宪法**：[GOVERNANCE.md](GOVERNANCE.md)
> **全量索引**：[registry-index.md（已废弃）](registry-index.md（已废弃）)（自动生成）

---

## ?? 文档治理体系（系统化整理成果）

| 文件 | 类型 | 说明 |
|------|------|------|
| [document-metadata-standard.md](document-metadata-standard.md) | 元数据标准 | Frontmatter 字段规范 + 枚举字典 + 验证规则 + 迁移方案 |
| [document-classification-system.md](document-classification-system.md) | 分类体系 | 三维分类体系（类型/领域/阶段）+ 分类树 + 编号系统 |
| [document-style-guide.md](document-style-guide.md) | 风格指南 | 命名规范 + 格式标准 + 结构模板 + 写作风格 |
| [document-organization-workflow.md](document-organization-workflow.md) | 工作流程 | 五阶段整理流程 + 质量控制点 + 工具模板 |
| [document-archive-management.md](document-archive-management.md) | 归档管理 | 死文档判定 + 三级归档 + 生命周期管理 |
| [document-quality-control-report.md（已废弃）](document-quality-control-report.md（已废弃）) | 质量报告 | 整理质量评估 + 问题清单 + 改进计划 |
| [documentation-team-training.md](documentation-team-training.md) | 培训材料 | 团队培训 + 快速参考 + FAQ |
| `document-inventory.csv` | 清单数据 | 全量文档清单 CSV（586 份活跃文档） |

---

## 标准操作流程体系（SOP Suite · 1 总览 + 7 正文）

> **性质**：Meta 索引登记（本体文档存放在 `docs/guides/sops/` 目录，此处为治理侧登记 + doc_id 速查）
> **注册契约**：8 篇 doc_id 均已在 [REGISTRY_INDEX.md §六（Doc ID 注册表）](REGISTRY_INDEX.md#六文档-doc-id-注册表规范v120) 全量登记（V9-DOC-SOP-000 ~ 007）
> **架构契约引用**：[AGENTS.md §十七](../../../AGENTS.md#十七sop-体系索引v160-新增--sdlc-全流程标准操作-procedure-suite)

| doc_id | SOP 标题 | 路径 | 规范等级 | 一句话用途 |
|:------|---------|:-----|:--------:|-----------|
| V9-DOC-SOP-000 | SDLC 七阶段 SOP 总览 | `docs/guides/sops/README.md` | T0 入口 | 7 阶段流转图 + 快速选择决策树（新员工/开发/上线/故障 4 场景跳转） |
| V9-DOC-SOP-001 | 开发环境搭建 SOP | `docs/guides/sops/S01-dev-env-setup.md` | T2 · P1 | 9 步从零到可启动；跨平台双命令（Win + macOS/Linux）；Node/venv/AkShare 就位 |
| V9-DOC-SOP-002 | 日常开发与提交 SOP | `docs/guides/sops/S02-dev-workflow.md` | T2 · P1 | 分支策略/模块 DoD/十域同步/pre-commit 速查/`git commit --only` 防夹带实操 |
| V9-DOC-SOP-003 | 代码审查 SOP | `docs/guides/sops/S03-code-review.md` | T2 · P1 | 三轮 55+ 项检查矩阵（架构/安全/质量三维）+ Blocker→Nitpick 5 级严重度 + SLA |
| V9-DOC-SOP-004 | 合并前集成测试 SOP | `docs/guides/sops/S04-pre-merge-integration.md` | **T1 · P0🔥** | 14 步集成：Gate:quick 7 子门禁 + 可信单元测试(≥99.2%) + CI vs 本地双检 |
| V9-DOC-SOP-005 | 上线前全面体检 SOP | `docs/guides/sops/S05-pre-launch-checklist.md` | **T1 · P0🔥** | **最核心**：24 步门禁 17 BLOCK + 真数测试（禁MOCK/25股票）+ 6 维评分模板 |
| V9-DOC-SOP-006 | 版本发布与部署 SOP | `docs/guides/sops/S06-release-deployment.md` | **T1 · P0🔥** | SemVer 2.0/三文件单向同步防错/Web+Electron双端构建/灰度 10%/回滚 A+B |
| V9-DOC-SOP-007 | 上线后运维与应急 SOP | `docs/guides/sops/S07-ops-incident-response.md` | T2 · P1 | 48h 值守 3 岗 6 人/P0 告警 SLA(5min)/4 源日志定位法/RCA 标准模板 |

---

## ?? 其他元文档

| 文件 | 类型 | 说明 |
|------|------|------|
| [GOVERNANCE.md](GOVERNANCE.md) | 治理宪法 | 文档治理最高规则 |
| [registry-index.md（已废弃）](registry-index.md（已废弃）) | 索引 | 全量文档注册表（自动生成） |
| `doc-manifest.csv` | 元数据 | 文档清单 CSV（自动生成） |
| `_migration-inventory.csv` | 元数据 | 迁移清单（自动生成） |
| [markdown-reorg-framework.md](markdown-reorg-framework.md) | 框架 | 文档重组框架 |
| [directory-structure-guide.md](directory-structure-guide.md) | 指南 | 目录结构指南 |
| [doc-style-standard.md](doc-style-standard.md) | 规范 | 文档样式标准 |
| [doc-trigger-action-map.md](doc-trigger-action-map.md) | 映射 | 触发器-动作映射 |
| [agent-app-docs-classification.md](agent-app-docs-classification.md) | 分类 | Agent 应用文档分类体系 |
| [文档整理待办清单.md（已废弃）](文档整理待办清单.md（已废弃）) | 待办 | 文档整理进度跟踪 |
| [p1-debt-cleanup-todo.md](../archive/historical-2026-08-16/batch6/docs/reports/project-management/01-p1-debt-cleanup-todo.md（已归档）) | 待办 | P1 架构债务清理待办 |

---

**历史归档** → [../archive/](../archive/)（历史治理文档已于 2026-08-03 清理，见 archive/README.md）
**返回根目录** → [../../README.md](../../README.md)
