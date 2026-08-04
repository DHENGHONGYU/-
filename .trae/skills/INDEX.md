---
title: V9 SKILL 索引
type: meta
domain: project
phase: development
tier: reference
status: active
maintainer: current developer
summary: "V9 项目所有 SKILL 的统一索引，基于 .trae/skills/ 目录下 20 个 SKILL.md 和 skill-registry.json 自动生成"
tags: [project, skill, meta, governance, index]
version: v2.0.0
last_updated: 2026-08-04
doc_id: V9-DOC-PROJ-SKILLINDEX-001
change_log:
  - version: v2.0.0
    changes: 基于 skill-registry.json 全量重写，删除 2 个不存在 SKILL，修正 4 个错误路径，补全 15 个缺失条目
    date: 2026-08-04
  - version: v1.5.0
    changes: Add dev-checklist SKILL (V9-SKILL-DEV-CHECKLIST), total 19 SKILLs
    date: 2026-07-25
  - version: v1.4.0
    changes: Add component-health-check SKILL (V9-SKILL-COMP-HEALTH), total 18 SKILLs
    date: 2026-07-25
  - version: v1.3.0
    changes: Add fix-verification-governance SKILL (V9-SKILL-VERIFY-GOVERNANCE), total 17 SKILLs
    date: 2026-07-25
  - version: v1.2.0
    changes: Add doc-management-principles SKILL (V9-SKILL-DOC-PRINCIPLES), total 16 SKILLs
    date: 2026-07-24
  - version: v1.1.0
    changes: Add skill_id and covers_docs to all SKILL frontmatter, update INDEX
    date: 2026-07-19
  - version: v1.0.0
    changes: Initial SKILL inventory with 15 entries
    date: 2026-07-19
---

# V9 SKILL 索引

> **状态**: active | **最后更新**: 2026-08-04 | **维护者**: current developer
> **统一登记**: .trae/skills/（项目级）| **单一真相源**: skill-registry.json

## 一、架构治理（architecture，4 个）

| skill_id | 名称 | covers_docs | 触发条件 | mandatory | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-ARCH-DEBT | architecture-debt-remediation | V9-DOC-ARCH-005, V9-DOC-ARCH-018, V9-DOC-ARCH-032 | 架构债务 / 分层违规 / 死代码 | ✅ | v1.0.0 |
| V9-SKILL-COMP-HEALTH | component-health-check | V9-DOC-ARCH-044, V9-DOC-QA-069 | 僵尸组件 / 命名冲突 / 注册一致性 | ❌ | v1.0.0 |
| V9-SKILL-DATABRIDGE-MIGRATION | v9-databridge-migration | V9-DOC-ARCH-001, V9-DOC-DATA-050, V9-DOC-LESSONS-001 | DataBridge 迁移 / 信封协议 / dataLayer 违规 | ✅ | v1.0.0 |
| V9-SKILL-CONSTANT-MIGRATION | v9-constant-migration | V9-DOC-ARCH-001, V9-DOC-LESSONS-001, V9-DOC-META-STRATEGY-001 | 业务常量 / 常量迁移 / config 重复 | ✅ | v1.0.0 |

## 二、代码质量与交付闸口（code-quality，7 个）

| skill_id | 名称 | covers_docs | 触发条件 | mandatory | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-BASH | v9-bash-conventions | AGENTS.md §十六 | 跑命令 / 执行脚本 / npm run / 门禁 | ❌ | v1.0.0 |
| V9-SKILL-COLLECTION | v9-collection-pipeline-testing | V9-DOC-DATA-036, V9-DOC-DATA-054, V9-DOC-QA-046 | 采集链路 / 七维 / collectionPipeline | ✅ | v1.0.0 |
| V9-SKILL-HEALTH-AUDIT | v9-health-audit | .trae/skills/v9-health-audit/SKILL.md, AGENTS.md | 健康度 / 进度检查 / 假绿灯 / 假红灯 | ❌ | v1.0.0 |
| V9-SKILL-MODULE-SYNC | v9-module-sync-checklist | AGENTS.md, V9-DOC-DATA-050, V9-DOC-QA-046 | 模块同步 / 代码校对 / 交付前检查 | ✅ | v1.2.0 |
| V9-SKILL-TSC-GATE-SCOPE | v9-tsc-gate-scope-audit | AGENTS.md, outputs/tsc-prod-attribution-report.md, outputs/tsc-prod-remediation-plan.md | tsc:prod 报错 / husky 阻塞 / 类型门禁误报 | ❌ | v1.0.0 |
| V9-SKILL-TSC-TEST-DIAG | v9-tsc-test-error-diagnosis | outputs/tsc-test-top5-repair-schedule.md | tsc:test 报错 / 契约漂移 / 测试类型错误 | ❌ | v1.0.0 |
| V9-SKILL-CODE-QUALITY | v9-code-quality-audit | AGENTS.md, V9-DOC-QA-046 | 代码质量 / 合规审查 / DataBridge | ✅ | v1.0.0 |

## 三、文档治理（doc-governance，4 个）

| skill_id | 名称 | covers_docs | 触发条件 | mandatory | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-CROSSINDEX | cross-index-governance | V9-DOC-ARCH-018, V9-DOC-ARCH-044, V9-DOC-DATA-038, V9-DOC-PROJ-288, V9-DOC-PROJ-CROSSINDEX-001, V9-DOC-QA-CROSSINDEX-001 | 交叉索引 / 双向引用 / frontmatter | ✅ | v1.0.0 |
| V9-SKILL-DOC-PRINCIPLES | doc-management-principles | V9-DOC-AUDIT-001, V9-DOC-LESSONS-001, V9-DOC-META-STRATEGY-001, V9-DOC-PROJ-016 | 文档管理 / 目录架构 / 命名规范 | ❌ | v1.0.0 |
| V9-SKILL-DOC-ENCODING | v9-doc-encoding-remediation | outputs/gbk-encoding-remediation-report.md, scripts/lib/encoding.ts | 文档乱码 / GBK / 编码修复 | ❌ | v1.0.0 |
| V9-SKILL-STALE-PATH-AUDIT | stale-path-reference-audit | docs/how-to/FILE-MANAGEMENT-GUIDE.md | 僵尸路径 / 失效链接 / 文档引用修复 | ❌ | v1.0.0 |

## 四、数据流与采集（data-flow，2 个）

| skill_id | 名称 | covers_docs | 触发条件 | mandatory | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-DATAFLOW | v9-data-flow-integrity-audit | V9-DOC-BACK-002, V9-DOC-DATA-002, V9-DOC-DATA-006, V9-DOC-DATA-008, V9-DOC-DATA-018 | 按钮无响应 / 数据流完整性 / ACL | ✅ | v1.0.0 |
| V9-SKILL-MOCK-DIAG | v9-mock-data-diagnosis | V9-DOC-DATA-038, V9-DOC-DATA-048, V9-DOC-QA-053, V9-DOC-QA-069 | Mock 数据残留 / 信息孤岛 / 假数据 | ❌ | v1.0.0 |

## 五、部署运维（devops，1 个）

| skill_id | 名称 | covers_docs | 触发条件 | mandatory | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-ENV-PATH | v9-windows-env-path-doctor | AGENTS.md | 环境迁移 / 路径硬编码 / DELL→Huawei | ❌ | v1.0.0 |

## 六、其他 SKILL

| skill_id | 名称 | covers_docs | 触发条件 | mandatory | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-DEV-CHECKLIST | v9-dev-checklist | V9-DOC-GUIDE-021, V9-DOC-QA-069 | 新组件 / 新模块 / PR Review | ❌ | v1.0.0 |
| V9-SKILL-COLOR-TOKEN-REMEDIATION | v9-color-token-remediation | docs/how-to/COLOR-TOKEN-GUIDE.md | 颜色令牌 / 色值硬编码 / 设计系统 | ❌ | v1.0.0 |

## 七、统计

| 分类 | 数量 |
|------|------|
| architecture | 4 |
| code-quality | 7 |
| doc-governance | 4 |
| data-flow | 2 |
| devops | 1 |
| 其他（dev-checklist + color-token） | 2 |
| **总计** | **20** |
| **mandatory SKILL** | **8** |

## 八、SKILL 体系架构

```
skill-registry.json (单一真相源)
  ├── .trae/skills/*/SKILL.md (frontmatter 镜像)
  │   ├── triggers: { keywords, files, events }
  │   ├── gates: [命令/检查项]
  │   ├── mandatory: boolean
  │   ├── related_skills: [关联 SKILL]
  │   └── search_priority: high | medium | low
  └── INDEX.md (本文档，由 registry 自动同步)
```

## 九、变更历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v2.0.0 | 2026-08-04 | 全量重写：删除 v9-gatekeeper/fix-verification-governance 不存在条目，修正 4 个 .workbuddy/skills/ 错误路径，补全 15 个缺失 SKILL，基于 skill-registry.json 生成 |
| v1.5.0 | 2026-07-25 | 新增 dev-checklist，共 19 SKILL |
| v1.4.0 | 2026-07-25 | 新增 component-health-check，共 18 SKILL |
| v1.3.0 | 2026-07-25 | 新增 fix-verification-governance，共 17 SKILL |
| v1.2.0 | 2026-07-24 | 新增 doc-management-principles，共 16 SKILL |
| v1.1.0 | 2026-07-19 | 全量补 skill_id/covers_docs |
| v1.0.0 | 2026-07-19 | 初始版本，15 SKILL |
