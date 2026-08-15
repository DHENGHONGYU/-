# AGENTS.md 技能治理对账报告（2026-08-16）

> 触发：本轮"腾讯自选股 MCP 整合"收尾时，`Skill(v9-collection-pipeline-testing)` 报 "Can not find skill"。
> 核查发现这并非单点缺失，而是 **AGENTS.md / registry 声明、`.agents/skills/` 物理落盘、WorkBuddy 加载器** 三层互不同步。

## 1. 三层真相源快照

| 层 | 位置 | 实际内容 |
|---|---|---|
| **A. 声明（索引/路由表）** | `AGENTS.md` §项目级 SKILL 索引 + 技能路由表；`.trae/skills/skill-registry.json` | 声明 **15 个** `v9-*` L1 物理技能（含 `v9-collection-pipeline-testing` MAND） |
| **B. 物理落盘** | `.agents/skills/*/SKILL.md` | 实际 **17 个** 技能，但 slug **无 `v9-` 前缀且部分完全不同名** |
| **C. WorkBuddy 可加载** | `~/.workbuddy/skills/`（用户级） | `v9-*` 中仅 **`v9-color-token-remediation`** 1 个实际可经 `Skill()` 加载；WorkBuddy 加载器**不扫描** `.agents/skills/` |

## 2. 声明 ↔ 物理 映射表

| AGENTS/registry 声明（A） | `.agents/skills/` 物理（B） | 状态 |
|---|---|---|
| `v9-constant-migration` | `constant-migration` | ⚠️ 仅前缀不一致 |
| `v9-databridge-migration` | `databridge-migration` | ⚠️ 仅前缀不一致 |
| `architecture-debt-remediation` | `architecture-cleanup`（或 `architecture-radar-scan`？歧义） | ❌ slug 完全不同 |
| `v9-bash-conventions` | — | ❌ 物理缺失 |
| `v9-code-quality-audit` | — | ❌ 物理缺失 |
| `v9-collection-pipeline-testing` | — | ❌ **物理缺失（本轮命中）** |
| `v9-dev-checklist` | — | ❌ 物理缺失 |
| `v9-doc-encoding-remediation` | — | ❌ 物理缺失 |
| `v9-health-audit` | — | ❌ 物理缺失 |
| `v9-mock-data-diagnosis` | — | ❌ 物理缺失 |
| `v9-module-sync-checklist` | — | ❌ 物理缺失 |
| `v9-tsc-gate-scope-audit` | — | ❌ 物理缺失 |
| `v9-tsc-test-error-diagnosis` | — | ❌ 物理缺失 |
| `v9-windows-env-path-doctor` | — | ❌ 物理缺失 |
| `v9-data-flow-integrity-audit` | — | ❌ 物理缺失 |
| `v9-color-token-remediation` | — | ⚠️ 仅用户级 `~/.workbuddy/skills/` 可加载，项目 `.agents/skills/` 无 |

**物理存在但索引未声明（B 中"孤儿"，14 个）**：`architecture-radar-scan`、`db-reference-audit`、`doc-freshness-governance`、`docs-as-mirror`、`feature-window-context-doc`、`industry-score`、`industry-score-mapping`、`intelligent-score`、`mcp-ui-acl-authorization`、`sector-analysis-framework`、`type-safety-contract`、`v6-docx-output`、`v6-stock-analysis-model`、`valuation-financial-analysis`。

## 3. 缺口分析

- **`v9-collection-pipeline-testing` 物理缺失**：`.agents/skills/` 无此目录、用户级 skills 也无 → `Skill()` 必报 "Can not find skill"。该技能被路由表标记为 mandatory（数据采集链路改动门禁）。
  - **本轮影响与处置**：实际改动已按该技能既定门禁 **手动等效执行** —— `tsc:prod` 0 错误、`audit:layers` 0 违规、`audit:acl-consistency` 0 ERROR/WARN、穿透全链 vitest `4 passed | 1 skipped`，交付不受阻。
- **命名前缀不一致**：声明用 `v9-*`，物理用无前缀 slug（`constant-migration` 等）。即便在 TRAE CN（读取 `.agents/skills/`），声明名也无法解析到物理目录 → 多数 `v9-*` 技能实际**不可用**。
- **加载器路径错位**：WorkBuddy 仅扫描 `~/.workbuddy/skills/` 与 `{workspace}/.workbuddy/skills/`，**不扫 `.agents/skills/`**，故即便物理存在的 L1 技能在本环境也不可经 `Skill()` 加载。

## 4. 推荐对齐方案（P0/P1/P2）

- **P0 — 补齐关键缺失技能**：至少落地 `v9-collection-pipeline-testing`（数据采集链路 mandatory 门禁），避免"声明强制但实际无法加载"的契约失信。
- **P1 — 统一命名**：二选一：
  - (a) **重命名物理目录** `.agents/skills/<slug>` → `.agents/skills/v9-<slug>` 以匹配索引/路由表（若 TRAE CN 为主力工具，推荐此向）；或
  - (b) **反向改写** AGENTS.md 索引 + `skill-registry.json` 为实际 slug（若保留无前缀命名体系）。
  - 同步将 14 个未声明物理技能补登索引，或清理无效声明。
- **P2 — 加载器对齐**：若需在 WorkBuddy 环境直接使用项目 L1 技能，将 `.agents/skills/*` 镜像/软链至 `.workbuddy/skills/`，或在环境配置中增加扫描路径（需评估与 TRAE CN 双写漂移风险）。

## 5. 本轮已采取动作（2026-08-16，依用户选定"补装+统一命名"执行）

- 产出本报告（事实对账）。
- **P0 补装**：新建 `.agents/skills/v9-collection-pipeline-testing/SKILL.md`（含 frontmatter + 门禁 `tsc:prod`/`audit:layers`/相关 vitest + 采集链路关键事实），消除路由表 mandatory 声明的物理缺失。
- **P1 精确重命名（2 个）**：`.agents/skills/constant-migration` → `v9-constant-migration`、`.agents/skills/databridge-migration` → `v9-databridge-migration`，并同步更新两文件内 `name:` 字段。
- 在 `AGENTS.md` 技能路由表前追加"⚠️ 技能安装态勘误"块：标注 `v9-collection-pipeline-testing` 已补装 + 本轮手动等效门禁已通过；记录命名前缀 + 加载器路径两层结构性问题。

## 6. 残留与待决策（重要）

经 P0 + 2 重命名后，声明↔物理对应关系仅对齐 **4 个**（`v9-collection-pipeline-testing` 新建、`v9-constant-migration`/`v9-databridge-migration` 重命名、`v9-color-token-remediation` 用户级可加载）。**仍存在大规模错位**：

- **声明但物理仍缺失（11+ 个）**：`v9-bash-conventions`、`v9-code-quality-audit`、`v9-data-flow-integrity-audit`、`v9-dev-checklist`、`v9-doc-encoding-remediation`、`v9-health-audit`、`v9-mock-data-diagnosis`、`v9-module-sync-checklist`、`v9-tsc-gate-scope-audit`、`v9-tsc-test-error-diagnosis`、`v9-windows-env-path-doctor`；以及 `cross-index-governance`、`architecture-debt-remediation`（MAND，物理为 `architecture-cleanup`，slug 完全不同）。
- **物理存在但索引未声明（14 个）**：`architecture-cleanup`、`architecture-radar-scan`、`db-reference-audit`、`doc-freshness-governance`、`docs-as-mirror`、`feature-window-context-doc`、`industry-score`、`industry-score-mapping`、`intelligent-score`、`mcp-ui-acl-authorization`、`sector-analysis-framework`、`type-safety-contract`、`v6-docx-output`、`v6-stock-analysis-model`、`valuation-financial-analysis`。

**根因判断**：声明集（V9 构建治理 `v9-*`）与物理集（V6/领域分析）**基本是两套不同分类法**，仅靠"加 v9- 前缀重命名"无法真正对账——物理集中大量技能在索引中根本无名，声明集中大量 `v9-*` 在物理集中无对应体。因此完整对账必须二选一：
- **方案 A（继续补装）**：为剩余 11+ 个声明 `v9-*` 逐一新建 SKILL.md（需谨慎，避免编造不准确门禁内容）。
- **方案 B（反向对齐）**：保留物理无前缀 slug，改写 AGENTS.md 索引 + `skill-registry.json` 为实际名称，并补登 14 个未声明物理技能。

**额外偏差（新发现）**：AGENTS.md 声称各技能 frontmatter 含 `triggers`/`gates`/`mandatory` 机器可读字段为"单一真相源"，但实测物理 SKILL.md（含新建的）均仅用 `name`/`description`/`version`/`last_updated`/`change_log`，**无** `triggers`/`gates`/`mandatory` 字段。该声明同样失真，需后续一并校正（或补字段、或改声明）。

**加载器 caveat（仍成立）**：即便完成上述对齐，WorkBuddy 加载器仍只扫 `~/.workbuddy/skills/`，不扫 `.agents/skills/`——本环境 `Skill(v9-*)` 仍可能报 "Can not find skill"。完整解决需 P2：将 `.agents/skills/*` 镜像/软链至 `.workbuddy/skills/`，或在环境加扫描路径（需评估与 TRAE CN 双写漂移）。本对齐主要使 **TRAE CN（读取 `.agents/skills/`）** 能正确解析。

→ 剩余全量对齐（方案 A/B 抉择 + P2 加载器 + frontmatter 声明校正）建议作为**独立专项**处理，不在本轮"补装+2 重命名"范围内。
