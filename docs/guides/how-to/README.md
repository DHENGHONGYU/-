---
title: how-to 操作指南目录索引
type: how-to
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "how-to directory document index and navigation entry"
tags: [project, guide, list, checklist, how-to]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-157
related_docs: [V9-DOC-DATA-055, V9-DOC-BACK-027, V9-DOC-FRONT-026, V9-DOC-AI-018, V9-DOC-PROJ-161, V9-DOC-PROJ-239, V9-DOC-PROJ-071, V9-DOC-PROJ-072, V9-DOC-PROJ-070, V9-DOC-FRONT-025, V9-DOC-QA-008, V9-DOC-QA-064, V9-DOC-QA-063]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# how-to 操作指南目录

> **Diataxis 分类**：How-to（操作指南）
> **定位**：面向具体任务的步骤化操作手册，每篇解决一个明确问题
> **读者**：V9 开发者与运维使用者
---

## 📘 核心操作指南

| 指南 | 入口 |
|------|------|
| **新增 Store** | [how-to-add-store.md](how-to-add-store.md) |
| **新增 Service** | [how-to-add-service.md](how-to-add-service.md) |
| **新增 Widget** | [how-to-add-widget.md](how-to-add-widget.md) |
| **MCP ACL 配置** | [mcp-acl-guide.md](mcp-acl-guide.md) |
| **代码评审** | [code-review-guide.md](code-review-guide.md) |
| **Hooks 规范** | [hooks-guide.md](hooks-guide.md) |
| **PWA 离线** | [../../archive/historical-2026-08-16/batch7/docs/explanation/implementation/pwa-offline-guide.md（已归档）](../../archive/historical-2026-08-16/batch7/docs/explanation/implementation/pwa-offline-guide.md（已归档）) |
| **视觉回归** | [visual-regression-guide.md](visual-regression-guide.md) |
| **文件管理规范** | [FILE-MANAGEMENT-GUIDE.md](FILE-MANAGEMENT-GUIDE.md) |
| **Widget 开发** | [widget-development-guide.md](../widget-development-guide.md) |

### 测试相关指南

[testing/](testing/) 目录收录测试策略与质量治理文档：

| 文档 | 说明 |
|------|------|
| [testing/testing-strategy.md](../testing-strategy.md) | 测试分层策略 |
| [testing/complexity-remediation-plan.md](testing/complexity-remediation-plan.md) | 复杂度治理整改计划 |
| [testing/completeness-profile-batch2.md](testing/completeness-profile-batch2.md) | 完整性画像批次报告 |

---

## 🔖 SOP 体系 · 按开发阶段索引

> **Diataxis 分类**：Tutorial + How-to 融合的阶段化时间线
> **定位**：覆盖 SDLC 完整 7 阶段（Onboarding → 开发 → CR → 集成 → 上线体检 → 发布 → 运维应急），**新人/资深/QA/DevOps 通用第一入口**
> **总览**：[**SOP 体系总览 README**](../sops/README.md)（含 7 阶段流转图 + 4 场景决策树）
> **真相源契约**：[AGENTS.md §十七](../../../AGENTS.md#十七sop-体系索引v160-新增--sdlc-全流程标准操作-procedure-suite)（所有命令与阈值冲突以契约为准）

| 阶段 | SOP 文档 | 一句话用途 | 规范等级 |
|-----|---------|-----------|:--------:|
| 🆕 新人入职 | [S01 · 开发环境搭建](../sops/S01-dev-env-setup.md) | 9 步从零到可启动（Node/npm/venv/AkShare/Vite/Husky/首次验证），跨平台双命令 | 🟧 T2 · P1 |
| 💻 日常编码 | [S02 · 开发与提交](../sops/S02-dev-workflow.md) | 分支策略/模块 DoD/十域同步/Gate:dev 预检/pre-commit 22/6 速查 + `git commit --only` | 🟧 T2 · P1 |
| 🔍 代码审查 | [S03 · Code Review](../sops/S03-code-review.md) | 三轮 55+ 项检查矩阵（架构/安全/质量）+ 5 级严重度 + 不合格 PR 模板 | 🟧 T2 · P1 |
| 🧪 Merge 前 | [**S04 · 合并前集成测试**](../sops/S04-pre-merge-integration.md) | 14 步集成：Gate:quick/可信测试(≥99.2%)/类型双检/复杂度不增/构建烟雾/CI双检 | 🟥 **T1 · P0🔥** |
| ✅ Release 前 | [**S05 · 上线前全面体检**](../sops/S05-pre-launch-checklist.md) | **最核心**：24 步门禁 17 BLOCK + 真数测试（禁MOCK/25股票）+ 6 维评分 ≥90 GO | 🟥 **T1 · P0🔥** |
| 🚀 发布部署 | [**S06 · 版本发布与部署**](../sops/S06-release-deployment.md) | SemVer 规则/三文件单向同步防错/Web+Electron 双端构建/灰度&回滚 A+B双方案 | 🟥 **T1 · P0🔥** |
| 🚨 上线后 | [S07 · 运维与应急响应](../sops/S07-ops-incident-response.md) | 48h 值守排班/告警 SLA（5/15/60min）/4 源日志定位/热修复/RCA 模板 | 🟧 T2 · P1 |

---

## 📂 其他文档分类

- 入门教学类文档见 [../tutorials/](../tutorials/)
- 契约与参考文档见 [../reference/](../reference/)
- 背景与原理说明见 [../explanation/](../explanation/)
