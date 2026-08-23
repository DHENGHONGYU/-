---
title: SKILL 体系四维评分卡
date: 2026-08-23
total_skills: 22
average_score: 88
junction: valid
generator: scripts/audit/skill-scorecard.cjs v1.0
---

# SKILL 体系四维评分卡（2026-08-23）

> 评分维度：结构分（40，五段式 + frontmatter 六字段，与 RULE-TPL 同源）/ 可发现分（30，触发词/文件/事件信号宽度）/ 运行分（20，junction 可加载 + skill_id 对齐 + usage.log 真实命中）/ 质量分（10，SOP 阶段数/教训内容量/交付物勾选项静态代理）。等级：A≥90 / B≥75 / C≥60 / D<60。
> 评分是度量不是门禁；阻断职责由 `npm run audit:skill-coverage` / `audit:skill-runtime` / `test:skill-router` 承担。

| 技能 | 强制级 | 结构/40 | 发现/30 | 运行/20 | 质量/10 | 总分 | 等级 |
|---|---|---|---|---|---|---|---|
| doc-freshness-governance | MAND | 40 | 30 | 20 | 10 | **100** | A |
| collection-pipeline-governance | adv | 40 | 30 | 20 | 7 | **97** | A |
| docs-as-mirror | adv | 40 | 25 | 20 | 10 | **95** | A |
| data-flow-integrity-audit | MAND | 40 | 25 | 20 | 10 | **95** | A |
| constant-migration | MAND | 40 | 22 | 20 | 10 | **92** | A |
| databridge-migration | MAND | 40 | 22 | 20 | 10 | **92** | A |
| db-reference-audit | adv | 40 | 22 | 20 | 10 | **92** | A |
| gateway-facade-refactor | adv | 40 | 25 | 20 | 7 | **92** | A |
| type-safety-contract | adv | 40 | 25 | 20 | 7 | **92** | A |
| v6-stock-analysis-model | adv | 40 | 25 | 20 | 7 | **92** | A |
| collection-pipeline-testing | MAND | 40 | 25 | 20 | 7 | **92** | A |
| skill-5seg-migration | adv | 40 | 25 | 20 | 7 | **92** | A |
| industry-score | adv | 40 | 22 | 20 | 7 | **89** | B |
| intelligent-score | adv | 40 | 22 | 20 | 7 | **89** | B |
| mcp-ui-acl-authorization | adv | 40 | 19 | 20 | 10 | **89** | B |
| architecture-cleanup | adv | 40 | 15 | 20 | 10 | **85** | B |
| industry-score-mapping | adv | 40 | 17 | 20 | 7 | **84** | B |
| architecture-radar-scan | adv | 40 | 15 | 15 | 10 | **80** | B |
| sector-analysis-framework | adv | 40 | 17 | 15 | 7 | **79** | B |
| feature-window-context-doc | adv | 40 | 15 | 15 | 7 | **77** | B |
| valuation-financial-analysis | adv | 40 | 15 | 15 | 7 | **77** | B |
| v6-docx-output | adv | 40 | 12 | 15 | 7 | **74** | C |

**平均得分：88 / 100**（junction 有效）

## 复评约定

- 新增/迁移技能后跑 `npm run skill:scorecard` 刷新；
- 运行分中「真实命中」随 `.trae/skills/usage.log` 积累自然提升，鼓励经 `npm run skill:route` 走路由；
- 质量分仅为静态代理，深度语义评审（可执行性/证据/阈值正确性）走离线 LLM/人工 rubric，结论并入本报告续表。
