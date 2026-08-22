---
title: V9 跨平台 SKILL 统一索引
type: registry
domain: ai
status: active
version: v2.1.0
last_updated: 2026-08-23
related_strategy: docs/03-development/mcp-cli-skill-strategy.md
change_log:
  - version: v2.1.0
    changes: "新增技能评估体系段（三层校对 + 四维评分）：audit:skill-runtime（L1 运行时加载冒烟，E2E 调用测试的确定性替代）、test:skill-router（L2 路由匹配回归，9 条信号→命中语料）、skill:scorecard（四维评分卡：结构 40/可发现 30/运行 20/质量 10，报告归档 deliverables/）"
    date: 2026-08-23
  - version: v2.0.0
    changes: "跨平台 SKILL 体系统一：重写为五平台（TRAE/WorkBuddy/Qoder/VSCode/Kimi）唯一人类可读统一索引；删除与 skill-registry.json 重复的 YAML 注册表段（机器真相源唯一化）；新增跨平台加载契约表与环境配置通用原则（junction 单一物理源防多备份）；L1 物理 22 项（含孤儿归位的 skill-5seg-migration）+ L2 插件 9 项 + L3 虚拟 19 项 = 50 项登记"
    date: 2026-08-23
  - version: v1.2.0
    changes: "P0 修复一致性：补 3 项孤儿/缺失技能；新增 collection-pipeline-governance（GAP-01 采集管线治理）；新增官方 S 级 Skill 骨架模板 _SKILL-TEMPLATE.md（5 段式）"
    date: 2026-08-20
  - version: v1.1.0
    changes: "新增 gateway-facade-refactor 项目专属 Skill（端到端 6 阶段门面化重构 SOP）"
    date: 2026-08-20
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-19
---

# V9 跨平台 SKILL 统一索引 — v2.1.0

> **版本**: v2.1.0 | **日期**: 2026-08-23 | **关联策略**: [MCP Server · CLI · Skill 三层协同开发策略](../../docs/03-development/mcp-cli-skill-strategy.md)
> **定位**: 本文件是**唯一人类可读统一索引**，覆盖 TRAE / WorkBuddy / Qoder / VSCode / Kimi 五平台。
> **机器真相源唯一**: [`.trae/skills/skill-registry.json`](../../.trae/skills/skill-registry.json)（triggers/gates/mandatory 机器可读字段只在此处维护；本索引不重复维护机器字段，防止双份漂移）。
> **跨平台契约入口**（<!-- WIKI-ADAPTER: source=wiki/ -->）：平台目录布局、同步规则与禁止事项的统一契约见 [wiki/CONTRACT.md](../../wiki/CONTRACT.md)，总入口 [wiki/README.md](../../wiki/README.md)；本文件为技能域的人类可读索引，与 [wiki/skills/INDEX.md](../../wiki/skills/INDEX.md) 同源同频（变更任一方须同步另一方）。

---

## 一、跨平台加载契约（环境配置通用原则）

**单一物理真相源**：`.agents/skills/`（git 追踪，22 个技能目录 + `_SKILL-TEMPLATE.md` 骨架模板 + 本索引）。
**防多备份铁律**：任何平台不得持有技能本体的第二份拷贝；加载目录差异一律用联接（junction）或指针解决。

| 平台 | 加载路径 | 机制 | 说明 |
|---|---|---|---|
| **TRAE CN** | `.trae/skills/skill-registry.json` + AGENTS.md 技能路由表 | 平台读注册表与会话级路由 | `.trae/skills/` 仅存索引文件（INDEX.md / skill-registry.json / usage.log），**无技能本体** |
| **WorkBuddy** | `.workbuddy/skills/` → junction → `.agents/skills/` | 加载器仅扫 `.workbuddy/skills/` | 目录联接，物理单份零漂移（v2.0 起，原 cp 镜像已废除） |
| **Qoder** | 同 WorkBuddy（经 `.workbuddy/skills/` junction） | IDE 技能加载 | `.qoder/` 仅存 repowiki 等平台产物，不复制技能 |
| **VSCode** | AGENTS.md + `.agents/skills/` | Copilot 读 AGENTS.md 契约 | AGENTS.md 即跨平台通用行为契约，无需独立技能副本 |
| **Kimi** | `plugins/*/`（kimi.plugin.json + SKILL.md + scripts） | Kimi 平台专属插件 schema | 平台专属格式**不强行统一**，仅在本索引与 registry 登记；**禁止镜像复制到其他目录** |

**环境搭建契约（新机器 / 新克隆）**：跑一次 `npm run skill:mirror` 即自动重建 `.workbuddy/skills` 联接（幂等：联接已存在则复用；非 Windows 或权限受限自动降级 cp 镜像并告警）。

---

## 二、L1 项目物理技能（22 项 · `.agents/skills/*/SKILL.md`）

> 全部为 S 级 5 段式骨架（一/触发条件 二/前置检查 三/阶段化 SOP 四/陷阱教训 五/交付物清单）；`_SKILL-TEMPLATE.md` 为官方骨架模板不计入计数。

| Skill | 分类 | 强制级 |
|---|---|---|
| [architecture-cleanup](./architecture-cleanup/SKILL.md) | architecture | adv |
| [architecture-radar-scan](./architecture-radar-scan/SKILL.md) | architecture | adv |
| [constant-migration](./constant-migration/SKILL.md) | architecture | **MAND** |
| [databridge-migration](./databridge-migration/SKILL.md) | architecture | **MAND** |
| [gateway-facade-refactor](./gateway-facade-refactor/SKILL.md) | architecture | adv |
| [db-reference-audit](./db-reference-audit/SKILL.md) | db-governance | adv |
| [doc-freshness-governance](./doc-freshness-governance/SKILL.md) | doc-governance | **MAND** |
| [docs-as-mirror](./docs-as-mirror/SKILL.md) | doc-governance | adv |
| [skill-5seg-migration](./skill-5seg-migration/SKILL.md) | doc-governance | adv |
| [feature-window-context-doc](./feature-window-context-doc/SKILL.md) | feature-runtime | adv |
| [industry-score](./industry-score/SKILL.md) | industry-score | adv |
| [industry-score-mapping](./industry-score-mapping/SKILL.md) | industry-score | adv |
| [intelligent-score](./intelligent-score/SKILL.md) | v6-analysis | adv |
| [v6-docx-output](./v6-docx-output/SKILL.md) | v6-analysis | adv |
| [v6-stock-analysis-model](./v6-stock-analysis-model/SKILL.md) | v6-analysis | adv |
| [mcp-ui-acl-authorization](./mcp-ui-acl-authorization/SKILL.md) | mcp-security | adv |
| [sector-analysis-framework](./sector-analysis-framework/SKILL.md) | sector-analysis | adv |
| [type-safety-contract](./type-safety-contract/SKILL.md) | type-safety | adv |
| [valuation-financial-analysis](./valuation-financial-analysis/SKILL.md) | valuation | adv |
| [collection-pipeline-testing](./collection-pipeline-testing/SKILL.md) | data-flow | **MAND** |
| [data-flow-integrity-audit](./data-flow-integrity-audit/SKILL.md) | data-flow | **MAND** |
| [collection-pipeline-governance](./collection-pipeline-governance/SKILL.md) | quality-gate-governance | adv |

## 三、L2 外部插件技能（9 项 · Kimi 插件生态 · `plugins/`）

> Kimi 平台专属三件套（`kimi.plugin.json` + `SKILL.md` + `scripts/<name>_tool.py`），由 [plugins/README.md](../../plugins/README.md) 导航；仅在统一索引登记，禁止复制到其他技能目录。

| 插件 | 用途 |
|---|---|
| ifind | 同花顺金融终端数据采集 |
| imf | IMF 宏观经济数据 |
| kimi-webbridge | Kimi 网页桥接交互 |
| scholar | 学术文献跨库检索 |
| sec_edgar | 美股 SEC 10K/10Q/8K 填报 |
| tianyancha | 工商/司法/经营风险信息 |
| world_bank_open_data | 世界银行开放数据 |
| yahoo_finance | 全球行情/财报替代源 |
| yuandian_law | 中国法律法规判例检索 |

## 四、L3 平台内置虚拟技能（19 项）

> 定义见 `skill-registry.json` 的 `virtualPlatformSkills`（TRAE CN 平台内置，无本地物理目录；本索引仅计项数不重复枚举）。

## 五、计数与防混加

- L1（22）+ L2（9）+ L3（19）= **50 条登记**，三层分离，任何声明不得混加计数。
- 一致性由 `npm run audit:skill-coverage` 三方校验（frontmatter ↔ registry ↔ AGENTS.md），RULE-TPL 对 5 段式结构强审。

## 六、技能评估体系（三层校对 + 四维评分，v2.1.0 新增）

> 设计原则：真实逐个调用 `Skill()` 代价高、不可断言、跨平台不可复现；故以确定性脚本覆盖 E2E 调用测试的可验证子集，评分与门禁分离（评分是度量，门禁才阻断）。

| 命令 | 层级 | 职责 | 阻断 |
|---|---|---|---|
| `npm run audit:skill-coverage` | L0 静态 | frontmatter↔registry↔AGENTS.md 三方一致 + RULE-TPL 五段结构 | ✅ exit 1 |
| `npm run audit:skill-runtime` | L1 运行时 | junction 有效 + 目录枚举 + frontmatter 六字段 + 清单比对 + 五段可加载（E2E 加载冒烟） | ✅ exit 1 |
| `npm run test:skill-router` | L2 路由 | 信号→命中回归（[fixtures](../../scripts/test/skill-router-fixtures.json) 9 条：文件/关键词/负例） | ✅ exit 1 |
| `npm run skill:scorecard` | 评分 | 四维加权（结构 40/可发现 30/运行 20/质量 10），报告归档 `deliverables/YYYY-MM-DD-skill-scorecard.md` | ❌ 仅度量 |

## 七、维护规范

1. **新增 Skill**：必须 `cp .agents/skills/_SKILL-TEMPLATE.md .agents/skills/<slug>/SKILL.md` 起步（禁止空白手写），随后登记 `skill-registry.json` + 本索引 L1 表 + AGENTS.md 索引段，跑 `npm run audit:skill-coverage`。
2. **机器字段只改 registry**：triggers/gates/mandatory 变更一律改 `skill-registry.json`，本索引与 SKILL.md frontmatter 不重复维护机器字段。
3. **平台适配不复制**：新平台的加载目录差异用联接/指针解决（参照 §一），禁止 `cp -r` 技能本体制造第二份备份。
4. **版本同步**：Skill 版本变更时同步 frontmatter `version`/`last_updated`/`change_log`（doc-freshness-governance 强制）。

## 八、相关文档

- [MCP Server · CLI · Skill 三层协同开发策略](../../docs/03-development/mcp-cli-skill-strategy.md)
- [V9 AGENTS.md（跨平台通用行为契约）](../../AGENTS.md)
- [skill-registry.json（机器可读单一真相源）](../../.trae/skills/skill-registry.json)
- [skill-mirror.cjs（联接初始化契约）](../../scripts/skill-mirror.cjs)
- [audit-skill-runtime.cjs（L1 运行时加载冒烟）](../../scripts/audit/audit-skill-runtime.cjs)
- [skill-router.test.cjs（L2 路由回归）](../../scripts/test/skill-router.test.cjs)
- [skill-scorecard.cjs（四维评分卡）](../../scripts/audit/skill-scorecard.cjs)
- [plugins/README.md（Kimi 插件导航）](../../plugins/README.md)
