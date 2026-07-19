---
title: 任务图模板
type: explanation
domain: project
phase: planning
tier: quick-note
status: draft
maintainer: V9 Architecture Team
tags: [project, template, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 任务图模板

> **用途**: 复杂任务（涉及 3+ 文件或跨模块）的结构化拆解模板
> **来源**: [AGENTS.md](../../AGENTS.md) §十二
> **使用方式**: 复制本文件，按实际任务填写后置于任务相关 PR / 变更日志中

---

## rootTask

| 字段 | 内容 |
|------|------|
| **intent** | 一句话说明本次任务要解决的问题或达成的目标 |
| **successCriteria** | 任务完成的可验证标准（如：某脚本通过、某测试覆盖率达到 X%、某漂移数为 0） |
| **constraints** | 约束条件（如不修改 package.json 某脚本、不引入新依赖、必须兼容旧数据等） |
| **priority** | P0 / P1 / P2 |

---

## phases

| 阶段 | 任务 | 依赖 | verificationLevel | 状态 |
|------|------|------|-------------------|------|
| 1 | 诊断 / 调研 | — | L1 轻量 | ? |
| 2 | 设计 / 方案 | 1 | L1 轻量 | ? |
| 3 | 核心实现 | 2 | L2 标准 | ? |
| 4 | 验证 / 测试 | 3 | L3 完整 | ? |
| 5 | 文档 / 索引同步 | 4 | L2 标准 | ? |

---

## contextAnchor

| 锚点 | 内容 |
|------|------|
| **意图锚点** | 本次任务最终要解决什么问题？ |
| **范围锚点** | 明确不在本次范围内的变更 |
| **状态锚点** | 任务开始时的基线状态（如 commit hash、关键文件版本） |

---

## tokenBudget

| 项目 | 数值 |
|------|------|
| **预算** | 50,000 tokens |
| **已消耗** | 0 |
| **超预算策略** | 优先查询知识图谱，减少重复搜索 |

---

## exitCriteria

- [ ] 所有 phase 完成并运行对应 regression 套件
- [ ] 关键指标达到 successCriteria
- [ ] 变更文档已同步并更新索引
- [ ] 无新增跨层调用违规


<!-- merge-source: docs/how-to/testing/task-graph-template.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `../reference/templates/task-graph-template.md`）

> 本模板参照 AGENTS.md §12.3 任务图核心结构。
> 每个复杂任务必须建立任务图，包含以下组成部分。
## rootTask（根任务）
| **intent** | 用户原始意图描述 |
| **successCriteria** | 成功标准（可验证的退出条件） |
| **constraints** | 约束条件（范围边界、不可触碰文件等） |
## contextAnchor（上下文锚点）
| **意图锚点** | 当前操作是否服务于 rootTask.intent？ |
| **范围锚点** | 当前操作是否超出 phase 边界？ |
| **状态锚点** | 工作区状态（git status / git log --oneline -5）是否与预期一致？ |
## phases（阶段分解）
### Phase 1: [阶段名称]
| **tasks** | 本阶段任务清单 |
| **dependsOn** | 依赖的前置阶段（无则填"无"） |
| **verificationLevel** | L1 轻量 / L2 标准 / L3 完整 |
| **exitCriteria** | 退出条件（含回归测试结果） |
  ├─ 1.1 [任务描述] → 预期产出
  ├─ 1.2 [任务描述] → 预期产出
  └─ 1.3 [任务描述] → 预期产出
### Phase 2: [阶段名称]
| **dependsOn** | Phase 1 |
| **verificationLevel** | L2 标准 |
## tokenBudget（Token 预算）
| **budget** | 预估 token 上限 |
| **consumed** | 已消耗 token（动态更新） |
| **overrunStrategy** | 超预算策略（如：暂停并汇报用户、收缩范围、跳过非关键验证） |
1. **任务开始前**：填写 rootTask + contextAnchor，运行状态前置检查门禁（§12.2）
2. **每个 phase 开始前**：对照 contextAnchor 三个锚点，确认无漂移
3. **每个 phase 完成后**：运行对应 verificationLevel 的回归套件，结果记入 exitCriteria
4. **触发暂停的条件**（硬性规则）：
   - staged 文件数与 phase 预期不符
   - 发现非本 phase 引入的文件变更
   - pre-commit hook 修改了非 staged 文件
   - token 消耗超过预算 80%
