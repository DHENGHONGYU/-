# 跨平台 SKILL 体系统一收尾报告（虚拟清零）

> 日期：2026-08-23 ｜ 契约版本：AGENTS.md v1.7.10 ｜ 状态：✅ 完成，门禁全绿

## 一、目标（用户原话提炼）

针对 `.workbuddy\skills` / `.trae\skills` / `wiki\skills` 及用户级目录中提炼的检查/分析/校对类 SKILL：制定标准、统一到本地文件层面、各开发平台（TRAE/Qoder/WorkBuddy/VSCode）统一到一个文件夹、相互调用、消除相同或类似 SKILL，提高体系统一性。

## 二、执行结果

### 1. 单一物理源统一（标准）

- 唯一物理真相源：`.agents/skills/`（38 个技能目录 + `_SKILL-TEMPLATE.md` 骨架模板）
- `.workbuddy/skills` = junction → `.agents/skills`（物理单份零漂移）
- `.trae/skills/` 仅存索引（INDEX.md 指针 + skill-registry.json 机器真相源 + usage.log）
- `wiki/skills/INDEX.md` 为唯一人类可读统一索引；`.agents/skills/README.md` 同源同频
- 格式标准：S 级 5 段式骨架（一/触发 二/前置 三/SOP 四/教训 五/交付物）+ frontmatter 六字段

### 2. 物理化迁入 16 项（自用户级 `~/.trae-cn/skills` 与 `~/.workbuddy/skills` 归位，去 `v9-` 前缀）

| 技能 | 分类 | 强制 |
|---|---|---|
| module-sync-checklist | code-quality | MAND |
| code-quality-audit | code-quality | MAND |
| dev-checklist | code-quality | adv |
| health-audit | code-quality | adv |
| tsc-gate-scope-audit | code-quality | adv |
| tsc-test-error-diagnosis | code-quality | adv |
| bash-conventions | code-quality | adv |
| doc-encoding-remediation | doc-governance | adv |
| stale-path-reference-audit | doc-governance | adv |
| cross-index-governance | doc-governance | MAND |
| doc-management-principles | doc-governance | adv |
| mock-data-diagnosis | data-flow | adv |
| color-token-remediation | ui-design | adv |
| windows-env-path-doctor | devops | adv |
| architecture-debt-remediation | architecture | MAND |
| component-health-check | architecture | adv |

迁移中内容修正（非原样照抄）：
- `bash-conventions`：Python 解释器过时用户路径 → 受管 `.venv\Scripts\python.exe`（package.json 真相源）
- `windows-env-path-doctor`：scan.cjs 路径更新为 `.agents/skills/windows-env-path-doctor/scripts/scan.cjs`
- `stale-path-reference-audit` / `color-token-remediation`：机器专属硬编码路径泛化
- `architecture-debt-remediation`：mandatory 裁决为 true（对齐 registry 与 AGENTS 路由表 MAND 契约）

### 3. 影子重复消除 3 组（删虚拟、留物理）

- `v9-data-flow-integrity-audit` ↔ `data-flow-integrity-audit`
- `v9-databridge-migration`（aliasOf）↔ `databridge-migration`
- `v9-constant-migration`（aliasOf）↔ `constant-migration`

### 4. registry 重构（`.trae/skills/skill-registry.json`）

- L1 物理：22 → **38**；L3 虚拟：19 → **0**；合计：50 → **47**；mandatory：9；categoriesStats 重算（16 类）
- 虚拟条目 `triggers`/`gates` 原样搬入物理条目；description 以 SKILL.md frontmatter 为真相源

### 5. 文档同频

| 文件 | 变更 |
|---|---|
| `AGENTS.md` | v1.7.10：索引段（38 项/16 类/虚拟清零/禁混加）、路由表 14 处 `v9-*` 改物理自然名、对齐记录补记、change_log |
| `wiki/skills/INDEX.md` | v1.1.0：L1 38 项全表、新增 code-quality/ui-design/devops 分类、L3 清零段 |
| `.trae/skills/INDEX.md` | v2.0.1：指针行计数 22→38 |
| `.agents/skills/README.md` | v2.2.0：L1 表补 16 行、§四 清零、§五 47 条 |

## 三、门禁回归（全绿）

| 门禁 | 结果 |
|---|---|
| `npm run audit:skill-coverage` | ✅ 38/38 三方一致（frontmatter ↔ registry ↔ AGENTS.md），RULE-TPL 通过 |
| `npm run audit:skill-runtime` | ✅ 38 个技能运行时可加载，junction 有效 |
| `npm run test:skill-router` | ✅ 9/9 路由回归用例通过 |
| `npm run audit:platform-docs` | ✅ 跨平台 WIKI 契约一致性全绿 |
| `npm run audit:agents-consistency` | ✅ A1–A7 全部断言通过（version=1.7.10） |

## 四、遗留与后续（Phase 2 候选，本轮不迁）

8 个用户级孤儿技能暂留用户目录（未登记、非检查/校对主线）：
`v9-performance-audit`、`v9-security-review`、`data-collection-audit`、`pre-release-inspection-gate`、`store-rendering-audit`、`doc-code-dual-proofreading`、`architecture-pollution-review`、`web-performance-audit`。

**用户级影子副本清理**（`~/.trae-cn/skills/v9-*` 与 `~/.workbuddy/skills/v9-*` 已迁出项）属删除动作，**待用户确认后执行**；不清理也不影响项目内统一（平台加载以项目目录为准，用户级仅旧会话残留）。
