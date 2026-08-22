---
title: V9 统一技能索引
type: registry
domain: ai
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "跨平台统一技能索引（L1 物理 22 + L2 插件 9 + L3 虚拟 19 = 50），机器真相源为 skill-registry.json"
tags: [wiki, skill, registry, index, governance]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-011
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-004, V9-DOC-WIKI-007]
change_log:
  - version: v1.0.0
    changes: "初版：取代 .trae/skills/INDEX.md 过时内容（19 项旧口径），按 registry 真值 50 项重写"
    date: 2026-08-23
---

# V9 统一技能索引

> **机器真相源**：[.trae/skills/skill-registry.json](../../.trae/skills/skill-registry.json)（`triggers` / `gates` / `mandatory` 字段以此为准；`audit:skill-coverage` 强校验三方一致性）。
> **分层口径**：L1 项目物理技能（22）+ L2 外部插件技能（9）+ L3 平台内置虚拟技能（19）= **50 项登记**；禁止混加计数。
> **口径漂移说明**：AGENTS.md v1.7.6 索引段写 49 项（L1=21），registry 真值为 50 项（L1=22，新增 `skill-5seg-migration`）；以本索引与 registry 为准，AGENTS.md 待下次契约升级对齐。
> **强制标记**：`*` = mandatory（命中未全绿不得声明完成）。新增技能必须从 `.agents/skills/_SKILL-TEMPLATE.md` 复制起步。

## 一、L1 项目物理技能（22 项，`.agents/skills/*/SKILL.md`）

### 架构治理 architecture（5）

| 技能 | 强制 | 用途 |
|---|---|---|
| `architecture-cleanup` | adv | 跨层违规修复、重复服务合并、领域命名统一 |
| `architecture-radar-scan` | adv | 六层架构无损探测与热力风险图 |
| `constant-migration` | MAND | 跨层重复常量迁移归位 `src/constants/` |
| `databridge-migration` | MAND | dataLayer 直接访问迁移到 DataBridge 信封协议 |
| `gateway-facade-refactor` | adv | Gateway 门面化重构 6 阶段 SOP |

### 数据库治理 db-governance（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `db-reference-audit` | adv | STORE_NAME/ENVELOPE_ACTION/ACL 一致性审计 |

### 文档治理 doc-governance（2）

| 技能 | 强制 | 用途 |
|---|---|---|
| `doc-freshness-governance` | MAND | 文档双轨版本与 last_updated/change_log 闭环 |
| `docs-as-mirror` | adv | 文档与仓库实际状态严格一致 |

### 特性运行时 feature-runtime（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `feature-window-context-doc` | adv | 功能窗口上下文文档加载诊断 |

### 行业评分 industry-score（2）

| 技能 | 强制 | 用途 |
|---|---|---|
| `industry-score` | adv | 行业综合评分（供个股模型 L-1 层） |
| `industry-score-mapping` | adv | 报告 SKILL-C/SKILL-N 提取与个股映射 |

### V6 分析 v6-analysis（3）

| 技能 | 强制 | 用途 |
|---|---|---|
| `intelligent-score` | adv | 个股综合智能评分 |
| `v6-docx-output` | adv | V6 报告专业 Word 输出 |
| `v6-stock-analysis-model` | adv | V6 分层递进式个股分析（L-1 ~ L8） |

### MCP 安全 mcp-security（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `mcp-ui-acl-authorization` | adv | ui 角色只读 Tool 授权与 ACL 对齐 |

### 板块分析 sector-analysis（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `sector-analysis-framework` | adv | 六维度板块分析框架 |

### 类型安全 type-safety（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `type-safety-contract` | adv | TypeScript 类型修改 6 步安全契约 |

### 估值 valuation（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `valuation-financial-analysis` | adv | 财务分析与估值模型 |

### 数据流 data-flow（3）

| 技能 | 强制 | 用途 |
|---|---|---|
| `collection-pipeline-testing` | MAND | 采集管线端到端测试与门禁（上线前禁 MOCK） |
| `data-flow-integrity-audit` | MAND | 五段数据流存储兜底审计 |
| `skill-5seg-migration` | adv | Skill 5 段式骨架迁移 7 步 SOP |

### 质量门禁治理 quality-gate-governance（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `collection-pipeline-governance` | adv | 采集管线配置/降级/字典/CI 全链路治理 |

## 二、L2 外部插件技能（9 项，`plugins/*/skills/*/SKILL.md`）

`ifind`（同花顺）、`imf`（IMF 数据）、`kimi-webbridge`（Kimi 网页桥接）、`scholar`（学术文献）、`sec_edgar`（SEC EDGAR）、`tianyancha`（天眼查）、`world_bank_open_data`（世界银行）、`yahoo_finance`（雅虎财经）、`yuandian_law`（圆点法律）。

详见 [wiki/platforms/kimi-plugins.md](../platforms/kimi-plugins.md)。

## 三、L3 平台内置虚拟技能（19 项，无本地物理目录）

定义见 registry `virtualPlatformSkills`，由 TRAE CN 平台内置：

`v9-doc-encoding-remediation`、`stale-path-reference-audit`、`cross-index-governance`、`doc-management-principles`、`v9-module-sync-checklist`、`v9-bash-conventions`、`v9-tsc-gate-scope-audit`、`v9-tsc-test-error-diagnosis`、`v9-health-audit`、`v9-code-quality-audit`、`v9-dev-checklist`、`v9-color-token-remediation`、`v9-data-flow-integrity-audit`、`v9-mock-data-diagnosis`、`v9-windows-env-path-doctor`、`v9-databridge-migration`、`architecture-debt-remediation`、`component-health-check`、`v9-constant-migration`。

## 四、变更纪律

1. 新增/变更技能三方同步：SKILL.md frontmatter ↔ `skill-registry.json` ↔ 本索引（AGENTS.md 索引段下次升级对齐）。
2. 交付前必跑：`npm run audit:skill-coverage`；L1 变更后另跑 `npm run skill:mirror`。
3. 会话级路由摘要见 AGENTS.md「技能路由表」。
