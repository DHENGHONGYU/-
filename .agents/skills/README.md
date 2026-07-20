---
title: V9 Skill Registry
type: registry
domain: ai
status: active
version: v1.0.0
last_updated: 2026-07-19
related_strategy: docs/03-development/mcp-cli-skill-strategy.md
---

# V9 Skill Registry

> **版本**: v1.0.0 | **日期**: 2026-07-19 | **关联策略**: [MCP Server · CLI · Skill 三层协同开发策略](../docs/03-development/mcp-cli-skill-strategy.md)
> **用途**: 统一索引 `.agents/skills/` 下所有 AI 操作手册，建立 Skill 与 MCP Tool 之间的显式映射，供 AI Agent、CLI 与 Workflow Server 消费。

---

## 快速导航

| Skill | 领域 | 触发关键词 | 映射 MCP Tool |
|-------|------|-----------|--------------|
| [architecture-cleanup](./architecture-cleanup/SKILL.md) | architecture | 架构清理、跨层调用、目录迁移 | `system:health_check`, `audit:layers` |
| [architecture-radar-scan](./architecture-radar-scan/SKILL.md) | architecture | 架构扫描、技术债务、腐化点 | `system:health_check`, `audit:*` |
| [constant-migration](./constant-migration/SKILL.md) | refactor | 常量迁移、重复常量 | 待映射 |
| [databridge-migration](./databridge-migration/SKILL.md) | refactor | DataBridge 迁移、dataLayer 违规 | 待映射 |
| [db-reference-audit](./db-reference-audit/SKILL.md) | audit | DB 引用一致性、Schema 校验 | `system:health_check`, `audit:db-references` |
| [docs-as-mirror](./docs-as-mirror/SKILL.md) | docs | 文档编写、镜像原则 | `audit:docs` |
| [feature-window-context-doc](./feature-window-context-doc/SKILL.md) | support | 功能窗口文档、帮助面板 | 待映射 |
| [industry-score](./industry-score/SKILL.md) | analysis | 行业评分 | `analysis:analyze_sector` |
| [industry-score-mapping](./industry-score-mapping/SKILL.md) | analysis | 个股行业评分映射 | `analysis:analyze_industry_v4` |
| [intelligent-score](./intelligent-score/SKILL.md) | scoring | 智能评分 | `scoring:v6.calculate_*` |
| [mcp-ui-acl-authorization](./mcp-ui-acl-authorization/SKILL.md) | security | MCP UI ACL 授权 | `system:health_check`, `audit:mcp` |
| [sector-analysis-framework](./sector-analysis-framework/SKILL.md) | analysis | 板块分析、六维度框架 | `analysis:analyze_sector` |
| [type-safety-contract](./type-safety-contract/SKILL.md) | type | 类型安全、类型修改 | `audit:layers`, `tsc --noEmit` |
| [v6-docx-output](./v6-docx-output/SKILL.md) | output | Word 报告输出 | 待映射 |
| [v6-stock-analysis-model](./v6-stock-analysis-model/SKILL.md) | analysis | V6 个股分析 | `analysis:analyze_stock`, `scoring:v6.calculate_*` |
| [valuation-financial-analysis](./valuation-financial-analysis/SKILL.md) | analysis | 财务分析与估值 | `analysis:analyze_stock`, `scoring:v6.calculate_*` |

---

## 机器可读注册表

```yaml
registry:
  - name: architecture-cleanup
    path: ./architecture-cleanup/SKILL.md
    version: "1.0.0"
    domain: architecture
    triggers: [architecture cleanup, layer violation, directory migration]
    mcp_tools:
      - server: system
        tool: health_check
      - server: system
        tool: run_audit
        args: { audit: layers }
    related_skills: [architecture-radar-scan, type-safety-contract]

  - name: architecture-radar-scan
    path: ./architecture-radar-scan/SKILL.md
    version: "1.0.0"
    domain: architecture
    triggers: [architecture scan, tech debt, code rot]
    mcp_tools:
      - server: system
        tool: health_check
      - server: system
        tool: run_audit
        args: { audit: all }
    related_skills: [architecture-cleanup, type-safety-contract]

  - name: constant-migration
    path: ./constant-migration/SKILL.md
    version: "1.0.0"
    domain: refactor
    triggers: [constant migration, duplicate constant]
    mcp_tools: []
    related_skills: []

  - name: databridge-migration
    path: ./databridge-migration/SKILL.md
    version: "1.0.0"
    domain: refactor
    triggers: [databridge migration, dataLayer violation]
    mcp_tools: []
    related_skills: [db-reference-audit]

  - name: db-reference-audit
    path: ./db-reference-audit/SKILL.md
    version: "1.0.0"
    domain: audit
    triggers: [db reference audit, schema consistency]
    mcp_tools:
      - server: system
        tool: health_check
      - server: system
        tool: run_audit
        args: { audit: db-references }
    related_skills: [databridge-migration]

  - name: docs-as-mirror
    path: ./docs-as-mirror/SKILL.md
    version: "1.0.0"
    domain: docs
    triggers: [write docs, documentation, mirror principle]
    mcp_tools:
      - server: system
        tool: run_audit
        args: { audit: docs }
    related_skills: []

  - name: feature-window-context-doc
    path: ./feature-window-context-doc/SKILL.md
    version: "1.0.0"
    domain: support
    triggers: [help window, context doc, feature window]
    mcp_tools: []
    related_skills: []

  - name: industry-score
    path: ./industry-score/SKILL.md
    version: "1.0.0"
    domain: analysis
    triggers: [industry score, sector score]
    mcp_tools:
      - server: analysis
        tool: analyze_sector
    related_skills: [industry-score-mapping, sector-analysis-framework]

  - name: industry-score-mapping
    path: ./industry-score-mapping/SKILL.md
    version: "1.0.0"
    domain: analysis
    triggers: [industry score mapping, stock industry match]
    mcp_tools:
      - server: analysis
        tool: analyze_industry_v4
    related_skills: [industry-score, v6-stock-analysis-model]

  - name: intelligent-score
    path: ./intelligent-score/SKILL.md
    version: "1.0.0"
    domain: scoring
    triggers: [intelligent score, smart score]
    mcp_tools:
      - server: scoring:v6
        tool: calculate_intelligent_score
    related_skills: [v6-stock-analysis-model]

  - name: mcp-ui-acl-authorization
    path: ./mcp-ui-acl-authorization/SKILL.md
    version: "1.0.0"
    domain: security
    triggers: [mcp acl, ui authorization, tool permission]
    mcp_tools:
      - server: system
        tool: health_check
      - server: system
        tool: run_audit
        args: { audit: mcp }
    related_skills: []

  - name: sector-analysis-framework
    path: ./sector-analysis-framework/SKILL.md
    version: "1.0.0"
    domain: analysis
    triggers: [sector analysis, rotation analysis, industry framework]
    mcp_tools:
      - server: analysis
        tool: analyze_sector
      - server: analysis
        tool: analyze_industry_v4
    related_skills: [industry-score, v6-stock-analysis-model]

  - name: type-safety-contract
    path: ./type-safety-contract/SKILL.md
    version: "1.0.0"
    domain: type
    triggers: [type safety, type refactor, type change]
    mcp_tools:
      - server: system
        tool: run_audit
        args: { audit: layers }
    related_skills: [architecture-radar-scan]

  - name: v6-docx-output
    path: ./v6-docx-output/SKILL.md
    version: "1.0.0"
    domain: output
    triggers: [docx output, word report, analysis report]
    mcp_tools: []
    related_skills: [v6-stock-analysis-model]

  - name: v6-stock-analysis-model
    path: ./v6-stock-analysis-model/SKILL.md
    version: "4.3"
    domain: analysis
    triggers: [stock analysis, v6 model, equity research]
    mcp_tools:
      - server: analysis
        tool: analyze_stock
      - server: scoring:v6
        tool: calculate_v6_score
      - server: llm
        tool: generate_report
    related_skills: [industry-score-mapping, sector-analysis-framework, valuation-financial-analysis]

  - name: valuation-financial-analysis
    path: ./valuation-financial-analysis/SKILL.md
    version: "1.0.0"
    domain: analysis
    triggers: [financial analysis, valuation, target price]
    mcp_tools:
      - server: analysis
        tool: analyze_stock
      - server: scoring:v6
        tool: calculate_v6_score
    related_skills: [v6-stock-analysis-model]
```

---

## 使用方式

### 方式一：人工查阅

直接点击上表中的 Skill 链接阅读操作手册。

### 方式二：CLI 查询（待实现）

```powershell
npm run skill:list
npm run skill:invoke <name> -- --input ...
```

### 方式三：Workflow Server 编排（待实现）

Skill 注册表中的 `mcp_tools` 将被 `workflow:main` 读取，用于自动生成工作流步骤。

---

## 维护规范

1. **新增 Skill 必须更新本 Registry**：在 `registry` 数组中追加条目，并在上表「快速导航」中补充一行。
2. **Skill 头部必须包含 `mcp_tools`**：若暂时无映射，写 `mcp_tools: []` 并标注 `待映射`。
3. **版本号同步**：Skill 版本号变更时，同步修改本 Registry 中的 `version` 字段。
4. **关联策略**：重大变更需同步更新 [MCP Server · CLI · Skill 三层协同开发策略](../docs/03-development/mcp-cli-skill-strategy.md)。

---

## 相关文档

- [MCP Server · CLI · Skill 三层协同开发策略](../docs/03-development/mcp-cli-skill-strategy.md)
- [V9 AGENTS.md](../AGENTS.md)
- [MCP Server 注册配置](../src/config/mcpServerRegistry.ts)
- [prompts 目录](../prompts/README.md)
