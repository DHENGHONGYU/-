---
title: V9 统一技能索引
type: registry
domain: ai
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "跨平台统一技能索引（L1 物理 38 + L2 插件 9 + L3 虚拟 0 = 47），机器真相源为 skill-registry.json"
tags: [wiki, skill, registry, index, governance]
version: v1.1.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-011
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-004, V9-DOC-WIKI-007]
change_log:
  - version: v1.1.0
    changes: "虚拟清零：16 个检查/分析/校对类虚拟技能物理化迁入 .agents/skills/，3 组影子重复删除，L1 22→38、L3 19→0、合计 50→47；新增 code-quality（7）/ui-design（1）/devops（1）分类；skill-5seg-migration 归位 doc-governance"
    date: 2026-08-23
  - version: v1.0.0
    changes: "初版：取代 .trae/skills/INDEX.md 过时内容（19 项旧口径），按 registry 真值 50 项重写"
    date: 2026-08-23
---

# V9 统一技能索引

> **机器真相源**：[.trae/skills/skill-registry.json](../../.trae/skills/skill-registry.json)（`triggers` / `gates` / `mandatory` 字段以此为准；`audit:skill-coverage` 强校验三方一致性）。
> **分层口径**：L1 项目物理技能（38）+ L2 外部插件技能（9）+ L3 平台内置虚拟技能（0，已清零）= **47 项登记**；禁止混加计数。
> **虚拟清零（v1.1.0，2026-08-23）**：原 19 项虚拟技能全量物理化归位（16 项转物理 + 3 项影子重复删除），TRAE/Qoder/WorkBuddy/VSCode 全平台经 `.agents/skills/` 单一物理源（`.workbuddy/skills` junction）统一加载。
> **强制标记**：`*` = mandatory（命中未全绿不得声明完成）。新增技能必须从 `.agents/skills/_SKILL-TEMPLATE.md` 复制起步。

## 一、L1 项目物理技能（38 项，`.agents/skills/*/SKILL.md`）

### 架构治理 architecture（7）

| 技能 | 强制 | 用途 |
|---|---|---|
| `architecture-cleanup` | adv | 跨层违规修复、重复服务合并、领域命名统一 |
| `architecture-radar-scan` | adv | 六层架构无损探测与热力风险图 |
| `constant-migration` | MAND | 跨层重复常量迁移归位 `src/constants/` |
| `databridge-migration` | MAND | dataLayer 直接访问迁移到 DataBridge 信封协议 |
| `gateway-facade-refactor` | adv | Gateway 门面化重构 6 阶段 SOP |
| `architecture-debt-remediation` | MAND | 架构债务治理：层违规/死组件/大组件拆分/巡检机制 |
| `component-health-check` | adv | 组件健康度六步审计（只诊断不删除） |

### 数据库治理 db-governance（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `db-reference-audit` | adv | STORE_NAME/ENVELOPE_ACTION/ACL 一致性审计 |

### 文档治理 doc-governance（7）

| 技能 | 强制 | 用途 |
|---|---|---|
| `doc-freshness-governance` | MAND | 文档双轨版本与 last_updated/change_log 闭环 |
| `docs-as-mirror` | adv | 文档与仓库实际状态严格一致 |
| `skill-5seg-migration` | adv | Skill 5 段式骨架迁移 7 步 SOP |
| `doc-encoding-remediation` | adv | 文档编码乱码诊断与安全转码（GBK 二次损坏前置修复） |
| `stale-path-reference-audit` | adv | 僵尸路径/失效链接扫描，迁移后残留检测 |
| `cross-index-governance` | MAND | 文档↔代码↔测试↔SKILL 四向交叉索引治理 |
| `doc-management-principles` | adv | 文档录入与管理整体原则（十目录/三环闭环） |

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
| `mock-data-diagnosis` | adv | Mock 残留诊断、信息孤岛识别、Mock→真实切换就绪度 |

### 质量门禁治理 quality-gate-governance（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `collection-pipeline-governance` | adv | 采集管线配置/降级/字典/CI 全链路治理 |

### 代码质量 code-quality（7）

| 技能 | 强制 | 用途 |
|---|---|---|
| `module-sync-checklist` | MAND | 模块改动十域同步校对（交付闸口） |
| `code-quality-audit` | MAND | 代码质量合规审查（分层/ACL/类型安全/零硬编码） |
| `dev-checklist` | adv | 新组件/新模块/PR Review 三场景快速检查清单 |
| `health-audit` | adv | 开发进度/健康度复检、行业对标、假绿灯排查 |
| `tsc-gate-scope-audit` | adv | tsc 门禁误锁诊断与作用域对齐 |
| `tsc-test-error-diagnosis` | adv | tsc:test 测试类型错误系统性诊断 |
| `bash-conventions` | adv | Bash 执行规范与命令速查（全局生效） |

### UI 设计 ui-design（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `color-token-remediation` | adv | 颜色令牌新增/重命名/废弃管理与硬编码排查 |

### 开发运维 devops（1）

| 技能 | 强制 | 用途 |
|---|---|---|
| `windows-env-path-doctor` | adv | Windows 用户目录绝对路径硬编码可移植诊断 |

## 二、L2 外部插件技能（9 项，`plugins/*/skills/*/SKILL.md`）

`ifind`（同花顺）、`imf`（IMF 数据）、`kimi-webbridge`（Kimi 网页桥接）、`scholar`（学术文献）、`sec_edgar`（SEC EDGAR）、`tianyancha`（天眼查）、`world_bank_open_data`（世界银行）、`yahoo_finance`（雅虎财经）、`yuandian_law`（圆点法律）。

详见 [wiki/platforms/kimi-plugins.md](../platforms/kimi-plugins.md)。

## 三、L3 平台内置虚拟技能（0 项，v1.1.0 已清零）

原 19 项虚拟技能已全量物理化归位：16 项转物理（见 §一新增行）+ 3 项影子重复删除（`v9-data-flow-integrity-audit`/`v9-databridge-migration`/`v9-constant-migration` 虚拟别名 ↔ 同名物理技能）。`skill-registry.json` 的 `virtualPlatformSkills` 现为空数组；全平台统一从 `.agents/skills/` 加载，相互调用零分叉。

## 四、变更纪律

1. 新增/变更技能三方同步：SKILL.md frontmatter ↔ `skill-registry.json` ↔ 本索引（AGENTS.md 索引段 v1.7.10 已对齐）。
2. 交付前必跑：`npm run audit:skill-coverage`；`skill:mirror` 仅新克隆/联接失效时重建（junction 对内容变更透明）。
3. registry 触发词变更后跑 `npm run test:skill-router` 路由回归；评分度量见 `npm run skill:scorecard`（详见 [.agents/skills/README.md](../../.agents/skills/README.md) §六）。
4. 会话级路由摘要见 AGENTS.md「技能路由表」。
