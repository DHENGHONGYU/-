---
title: V9 计划与排期（Plans）
type: reports
domain: project
phase: deployment
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "release-management directory document index and navigation entry"
tags: [project, report, plan, changelog, deployment]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 计划与排期（Plans）

> **定位**：存放设计阶段的过程产物（方案、基线、评估、排期表）。  
> **注意**：本目录当前以 **HTML/XLSX 非 Markdown 格式**为主，后续建议迁移为 Markdown 以纳入 Docs-as-Code 体系。  
> **状态**：?? 过渡中（过程产物，非长期维护文档）。

---

## 当前文件

| 文件 | 类型 | 主题 | 来源 | 建议 |
|------|------|------|------|------|
| `UI设计优化实操方案_V6×V9×WorkBuddy.html` | HTML | UI 设计优化方案 | 2026-07-08 设计阶段 | 建议提取核心内容转为 `../../archive/ui-optimization-plan.md` |
| `UI设计原则基线与创新水准_V9.html` | HTML | 设计原则基线 | 2026-07-08 设计阶段 | 建议提取核心内容转为 `../../archive/design-principles.md` |
| `UI设计对照与成熟度评估_V6vsV9.html` | HTML | V6 vs V9 设计对照 | 2026-07-08 设计阶段 | 建议提取核心结论并入 `../../explanation/design/v6pro-v9-gap-analysis-final.md` |
| `智能投研复盘系统V9-整改计划表.xlsx` | XLSX | 整改任务排期表 | 2026-07-08 项目管理 | 建议核心任务转为 `docs/00-meta/` 下的 Markdown 执行计划 |

---

## 治理规则

- 本目录**不纳入 `docs/README.md` A–H 索引**（过程产物，非体系文档）。
- 新增计划文档优先使用 `.md` 格式；`.html`/`.xlsx` 保留期限：**6 个月**或任务完成后归档。
- 参照 `../../00-meta/governance.md` §4「保鲜优于堆积」：任务完成后，相关计划应提取结论并入体系文档，原始产物归档或删除。
