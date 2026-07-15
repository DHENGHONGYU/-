---
title: README
code_version: 2.0.0

tier: important
---

---
title: docs/explanation/README.md
code_version: 2.0.0
tier: important
---

# V9 智能投研复盘系统 — 文档中心（docs/ 总入口）

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **定位**: `docs/` 是项目全部文档的单一入口。本文档提供目录地图、权威文档索引与导航约定，是"找文档"的第一站。

## 一、目录地图（物理层 00–07 + 顶层）

| 目录 | 职责 | 主要受众 |
|------|------|----------|
| `00-meta/` | **治理核心**——5 份权威文档（目录指南 / 治理宪法 / 注册索引 / 触发映射 / 优化方案） | 架构守护、AI 辅助 |
| `explanation/` | **解释型文档**——愿景、架构标准、设计决策、概念说明 | 产品 / 架构 |
| `reference/` | **参考型文档**——功能规格、舱室规格、API 契约、数据字典、配置清单 | 开发 / 架构 |
| `how-to/` | **实操型文档**——开发指南、组件库使用、代码审查、Hook 规范 | 开发 / AI |
| `tutorials/` | **教程型文档**——入门指南、学习路径 | 新人 / 培训 |
| `04-testing/` | 测试策略、用例、门禁、报告 | QA |
| `06-project-management/` | 变更日志、项目计划 | 管理 |
| `07-archive/` | **归档层**——过期 / 废弃 / 临时文档（只读，不再维护） | 审计追溯 |
| `reports/` | 自动 / 过程产物（审计、复盘、草稿、发布） | 质量追踪 |
| `prompts/` | AI 提示词模板 | AI 工程 |
| `assets/` | 文档图片等静态资源 | — |
| `a-h-index.md` | **逻辑分类索引**——A–H 八类 ↔ 物理目录的真实映射 | 全局导航 |

## 二、权威文档（治理核心，必读且必须随代码同步）

| 角色 | 文件 | 说明 |
|------|------|------|
| 目录结构事实源 | `../00-meta/directory-structure-guide.md` | 目录结构与归位规则的唯一真相源 |
| 文档治理宪法 | `../00-meta/governance.md` | 文档分类、命名、版本、权限的总约束 |
| 文档注册索引 | `../reference/registry-index.md` | 全量文档注册与检索索引 |
| 自动更新触发映射 | `../reference/meta/doc-trigger-action-map.md` | "触发事件 → 更新动作"单一事实源 |
| 文档与文件管理优化方案 | `../00-meta/doc-file-management-optimization-plan.md` | 本轮梳理整合产出（supersede 三份旧核心文档） |

> 代码 / 架构变更后，上述权威文档必须同步更新，并经 `audit:docs` / `audit:doc-integrity` / `file:check` 校验。

## 三、全局导航约定

- **找文档分类** → 先读 `a-h-index.md`（逻辑 A–H ↔ 物理目录的真实映射，无幽灵链接）。
- **找某类规范** → 按上表目录地图定位物理目录。
- **新增文档** → 先查 `../reference/registry-index.md` 是否已有同类；旧版归档到 `07-archive/`。
- **文档断链 / 过期** → 运行 `npm run audit:doc-integrity` 全量扫描。

## 四、与相关根文档的关系

- `../../AGENTS.md`（根）：代码分层契约，文档体系的上位约束。
- `architecture.md`（`explanation/`）：架构决策记录。
- `../../CHANGELOG.md`（根）：项目级变更日志。
- `../reference/development-workflow-sop.md`（`reference/`）：开发工作流 SOP，所有文件整理规则依赖此。
