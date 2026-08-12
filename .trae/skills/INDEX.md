---
title: V9 SKILL 索引
type: meta
domain: project
phase: development
tier: reference
status: active
maintainer: current developer
summary: "V9 项目所有 SKILL 的统一索引，含 .trae/skills/、.workbuddy/skills/、plugins/*/SKILL.md"
tags: [project, skill, meta, governance, index]
version: v1.5.0
last_updated: 2026-08-11
doc_id: V9-DOC-PROJ-SKILLINDEX-001
change_log:
  - version: v1.0.0
    changes: Initial SKILL inventory with 15 entries
    date: 2026-07-19
  - version: v1.1.0
    changes: Add skill_id and covers_docs to all SKILL frontmatter, update INDEX
    date: 2026-07-19
  - version: v1.2.0
    changes: Add doc-management-principles SKILL (V9-SKILL-DOC-PRINCIPLES), total 16 SKILLs
    date: 2026-07-24
  - version: v1.3.0
    changes: Add fix-verification-governance SKILL (V9-SKILL-VERIFY-GOVERNANCE), total 17 SKILLs
    date: 2026-07-25
  - version: v1.4.0
    changes: Add component-health-check SKILL (V9-SKILL-COMP-HEALTH), total 18 SKILLs
    date: 2026-07-25
  - version: v1.5.0
    changes: Add dev-checklist SKILL (V9-SKILL-DEV-CHECKLIST), total 19 SKILLs
    date: 2026-07-25
  - version: v1.5.1
    changes: '文档新鲜度刷新：同步 frontmatter 与变更日志至 2026-08-11'
    date: 2026-08-11
---

# V9 SKILL 索引

> **状态**：active | **最后更新**：2026-08-11 | **维护者**：current developer
> **统一登记**：.trae/skills/（项目级）+ .workbuddy/skills/（兼容）+ plugins/（外部插件）

## 一、项目级 SKILL（.trae/skills/）

| skill_id | 名称 | 位置 | covers_docs | 触发条件 | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-GATEKEEPER | v9-gatekeeper | .trae/skills/v9-gatekeeper/ | V9-DOC-FRONT-004, V9-DOC-PROJ-331, V9-DOC-QA-069, V9-DOC-QA-066 | code change / new feature | v1.0.0 |
| V9-SKILL-ARCH-DEBT | architecture-debt-remediation | .trae/skills/architecture-debt-remediation/ | V9-DOC-PROJ-036, V9-DOC-PROJ-276, V9-DOC-QA-066, V9-DOC-QA-069 | audit warning | v1.1.0 |
| V9-SKILL-CROSSINDEX | cross-index-governance | .trae/skills/cross-index-governance/ | V9-DOC-PROJ-CROSSINDEX-001, V9-DOC-ARCH-018, V9-DOC-ARCH-044, V9-DOC-PROJ-288 | doc governance / cross-index | v1.2.0 |
| V9-SKILL-DOC-PRINCIPLES | doc-management-principles | .trae/skills/doc-management-principles/ | V9-DOC-META-STRATEGY-001, V9-DOC-PROJ-016, V9-DOC-AUDIT-001, V9-DOC-LESSONS-001 | doc creation / editing / moving / organizing | v1.0.0 |
| V9-SKILL-VERIFY-GOVERNANCE | fix-verification-governance | .trae/skills/fix-verification-governance/ | V9-DOC-AUDIT-001, V9-DOC-LESSONS-001, V9-DOC-META-STRATEGY-001 | batch fix verification / cross-validation / fix audit | v1.0.0 |
| V9-SKILL-COMP-HEALTH | component-health-check | .trae/skills/component-health-check/ | 待补全 | component health audit / dead component / zombie component / naming collision / registry consistency | v1.0.0 |
| V9-SKILL-DEV-CHECKLIST | dev-checklist | .trae/skills/dev-checklist/ | 待补全 | dev checklist / new component / new module / PR review / bidirectional verification | v1.0.0 |

## 二、兼容 SKILL（.workbuddy/skills/，待迁移）

| skill_id | 名称 | 位置 | covers_docs | 触发条件 | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-COLLECTION | collection-pipeline-testing | .workbuddy/skills/collection-pipeline-testing/ | V9-DOC-DATA-017, V9-DOC-DATA-020, V9-DOC-DATA-032, V9-DOC-DATA-033, V9-DOC-DATA-041 | collection test | v0.1.0 |
| V9-SKILL-MOCK-DIAG | mock-data-diagnosis | .workbuddy/skills/mock-data-diagnosis/ | V9-DOC-DATA-023, V9-DOC-QA-069, V9-DOC-QA-070 | mock data issue | v0.1.0 |
| V9-SKILL-DATAFLOW | data-flow-integrity-audit | .workbuddy/skills/data-flow-integrity-audit/ | V9-DOC-DATA-017, V9-DOC-DATA-020, V9-DOC-DATA-021, V9-DOC-DATA-030, V9-DOC-DATA-031 | data flow audit | v0.1.0 |
| V9-SKILL-DEVOPS | devops-automation | .workbuddy/skills/devops-automation/ | V9-DOC-PROJ-178, V9-DOC-PROJ-274, V9-DOC-PROJ-276 | backup / deploy | v0.1.0 |

## 三、外部插件 SKILL（plugins/*/SKILL.md）

| skill_id | 名称 | 位置 | covers_docs | 用途 | 版本 |
|---|---|---|---|---|---|
| V9-PLUGIN-IFIND | ifind | plugins/ifind/ | 待补全 | 同花顺数据采集 | v1.0.0 |
| V9-PLUGIN-IMF | imf | plugins/imf/ | 待补全 | IMF 数据 | v1.0.0 |
| V9-PLUGIN-KIMI | kimi-webbridge | plugins/kimi-webbridge/ | 待补全 | Kimi 网页桥接 | v1.0.0 |
| V9-PLUGIN-SCHOLAR | scholar | plugins/scholar/ | 待补全 | 学术文献 | v1.0.0 |
| V9-PLUGIN-SEC | sec_edgar | plugins/sec_edgar/ | 待补全 | SEC EDGAR | v1.0.0 |
| V9-PLUGIN-TYC | tianyancha | plugins/tianyancha/ | 待补全 | 天眼查 | v1.0.0 |
| V9-PLUGIN-YAHOO | yahoo_finance | plugins/yahoo_finance/ | 待补全 | 雅虎财经 | v1.0.0 |
| V9-PLUGIN-YUANDIAN | yuandian_law | plugins/yuandian_law/ | 待补全 | 圆点法律 | v1.0.0 |

## 四、统计

- 项目级 SKILL：7 个
- 兼容 SKILL：4 个（待迁移到 .trae/skills/）
- 外部插件 SKILL：8 个
- **总计**：19 个
- **已补全 covers_docs**：11 个（项目级 + 兼容）

## 五、迁移计划

按 cross-index-comprehensive-solution.md 阶段 5 执行：
1. .workbuddy/skills/* → .trae/skills/（保留软链接兼容）
2. plugins/*/SKILL.md → 保留原位置，本索引登记
3. 所有 SKILL 补全 covers_docs frontmatter（已完成 7/15）

## 六、SKILL 索引文件

| 索引文件 | 位置 | 说明 |
|---|---|---|
| skill-doc-index.json | docs/00-meta/ai-index/ | SKILL ↔ 文档双向索引 |
