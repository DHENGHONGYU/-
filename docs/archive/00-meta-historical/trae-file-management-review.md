---
title: trae-file-management-review
code_version: 2.0.0
tier: core
status: archived
referenced_by: [V9-DOC-META-000, docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-RCA-report.md, docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-task-list.md, V9-DOC-PROJ-176]
---

# V9 文件管理体系 × TRAE 开发习惯 审查评价报告

> ⚠️ **本文档已过时（2026-07-12 标注，N5 治理）**：本报告描述的是「清理前」的快照状态。下列问题**均已处置**，本文件仅作历史审查记录保留，不作为当前文件管理依据——当前基准请查 `docs/README.md` + `docs/00-meta/doc-auto-update-kanban.md`：
> - `file-management-system/`（根）→ 已迁至 `tools/`
> - `articles/`（根）→ 已迁至 `docs/assets/articles/`
> - `docs/README.md` → 已建立
> - `DATA_DEFINITION*` 10 份 → 已归并为 `docs/02-design/` 下各域单一文件
>
> **当前残留（已处置，见 `doc-auto-update-kanban.md` N4 ✅）**：`docs/reports/` tracked 产物已 `git rm --cached`（gitignore L146 已配）；`docs/design/` 2 文件迁 `02-design/`；根散落 `cleanup-schedule.md`/`governance.md` 迁 `00-meta/`。

> **审查日期**：2026-07-12
> **审查视角**：TRAE 开发工具（AI 编码助手）的项目结构 / 文件管理习惯
> **方法**：全量本地文件检索（排除 `node_modules`/`dist*`/`coverage*`/`.git`）+ 与用户给定的「文档治理层 52 / 双向一致性 61」评分表逐项交叉校对 + TRAE 官方/社区发布规范的匹配度评价
> **TRAE 规范基准**（来源：TRAE 官方社区《全局开发规范调教实录 v2》、社区《AI-Native 开发工作流手册》、个人规则经验帖）：
> 1. **公共目录单点收敛（SSOT）**：已有 `utils/`/`lib/`/`components/`/`hooks/` 则禁止另起炉灶；业务源码严格归入 `src/`。
> 2. **归档标准 / 禁止散落根目录**：脚本→`scripts/` 或 `tools/`；媒体→`assets/` 或 `public/`；文档→`docs/`；源码→`src/`。
> 3. **命名规范**：文件/目录名全小写，推荐 kebab-case（连字符）。
> 4. **3 文件底线（AI-Native）**：只保留 `.trae/skills` 或 `rules`（技术宪法）+ `../archive/feature-xxx-template.md`（Living PRD 唯一真相源）+ `./GOVERNANCE.md`（记录"为什么选 A 不选 B"）；中间文档不堆项目内。
> 5. **模块化 + 文件元信息 + 规范注释**；先输出目录结构树再写码。

---

## 一、全量文件底数（本地实测，非估算）

| 指标 | 实测值 | 核验命令 |
|------|--------|---------|
| 项目 `.md` 总数（排除 node_modules/dist/coverage/.git） | **484** | `find -name "*.md"` |
| `docs/` 顶层子目录数 | **20** | `ls docs/` |
| `docs/` 各目录文件数 | 01-requirements 42 / 02-design 140 / 03-development 35 / 04-testing 12 / 05-deployment 1 / 06-project-management 2 / 07-archive 1 / architecture 1 / architecture-radar-v2 58 / audit 43 / blueprints 1 / changelogs 27 / design **0** / drafts 9 / guides 1 / implementation 14 / plans 4 / plugins 10 / project-management **0** / reports **1414** | `find` |
| `docs/reports/` 体积 | **90 MB / 1414 文件** | `du -sh` |
| `DATA_DEFINITION*` 文件 | **10**（根 1 + 01-requirements 1 + 02-design 8；其中 **3 个同名** `../reference/data-definition.md`，**7 个按域命名**：AI_CENTER / BACKTEST / DATAFLOW / MULTI_FACTOR_SCREENING / NEWS / RISK_DERIVED / SEVEN_DIM_CONFIG） | `find -iname` |
| `DEPRECATED*` 文件（docs 内） | **9**（8 散落活跃目录，仅 1 在 `07-archive/`） | `find -iname` |
| `.ai-index` / `.ai-cache` | **0**（不存在） | `find` |
| `docs/README.md` | **缺失** | `ls` |
| 根 `../../README.md` | **存在** | `ls *.md` |
| `../reference/README.md` | **存在**（子目录索引） | `find` |
| 空目录 | `docs/design/`、`docs/project-management/`（各 0 文件） | `find` |
| `file-management-system/` | **502 文件**，含**自有 `node_modules/`、`bin/`、`configs/`、`guides/`、`templates/`、`scripts/`**（实质是嵌在仓库根的自包含子包） | `find` |
| `articles/` | **29 文件**（png/svg/cjs/txt/md） | `find` |
| 根散落脚本 | `_cmp.cjs` `_cx_filter.cjs` `_dupq.cjs` `_extract_d4.cjs`（4 个） | `ls *.cjs` |
| 根散落 zip | `code-quality-compliance.zip`、`v9-roadmap-execution.zip`（2 个） | `ls *.zip` |
| `.trae/` | **存在**（rules/、`../../.agents/skills/feature-window-context-doc/SKILL.md`、mcp.json、logs/、documents/ 等 13 文件） | `find` |
| `scripts/` | **存在** | `ls -d` |
| `.gitignore` 覆盖缺口 | `docs/reports/`（仅忽略 `audit/*.json`）、`file-management-system/`、`articles/`、`_*.cjs`(4)、`v9-roadmap-execution.zip` **均未忽略** | `grep` |
| `docs/` 根散落 `.md` | **8 个**（含本类分析报表，违反"禁止散落"） | `ls docs/*.md` |

---

## 二、评分表交叉校对（遗漏 / 例外 / 偏差）

将用户给定的两张评分表逐项与本地实测比对，结论分三类：**确认**（与本地一致）/ **偏差**（局部成立但口径需修正）/ **例外**（表内完全未覆盖的重大项）。

### 2.1 文档治理层（原 52/100）

| 检查项 | 原得分 | 本地核验 | 结论 | 修正说明 |
|--------|:---:|------|:---:|------|
| 体系覆盖 | 80 | 八类体系已建（`文档归类体系结构.md`） | ✅ 确认 | — |
| 顶层入口 | 0 | `docs/../../README.md` 缺失，但根 `../../README.md` + `../reference/../../README.md` **存在** | 🟡 偏差 | 缺口是"**docs 主控索引**"，非"全项目无 README"；AI 另有 `public/ai-memory-index.json` 可部分补偿 |
| 应有文档 | 0 | 仅 `input` 有舱 spec；令牌 mapping **已存在**（缺 cookbook） | 🟡 偏差 | "5 个可能已存在"含令牌指南；非空洞 0 |
| 孤儿文档 | 40 | 孤儿问题真实；但 `docs/` 根 8 个散落 `.md` + 根级 `file-management-system/`(502) + `articles/`(29) **未被计入** | 🔴 例外（低估） | 孤儿口径过窄（仅 docs 内），漏算根级散落 |
| 目录健康 | 30 | 2 空目录（`design/`、`project-management/`）✅；3 错位含 `architecture/` vs `architecture-radar-v2/` 拆分、`file-management-system/` 根级 | ✅ 确认 | — |
| 自动产物 | 50 | `docs/reports/` = 1414 文件 / 90 MB，gitignore 仅覆盖 `audit/*.json` | 🔴 例外（低估） | 这是**头号膨胀源**，33.1% 表述偏轻 |
| 令牌指南 | 50 | `../reference/design-token-mapping.md` 存在（无场景 cookbook） | 🟡 偏差 | 非"全缺"，属"有映射无菜谱" |
| 过程产物 | 40 | `drafts/`(9)+`plans/`(4)+`blueprints/`(1)+`.trae/logs/`+`lint-*.txt` 均未忽略 | 🔴 例外（外溢） | 过程产物还外溢到 `.trae/` 日志/ lint 输出 |
| 数据一致 | 20 | 10 个 `DATA_DEFINITION*`，但**仅 3 个同名真重复**，7 个为独立域定义 | 🔴 例外（误报） | "10 份重复"应改为"3 真重复 + 7 按域拆分（命名不一致）" |
| 归档状态 | 40 | 9 份 DEPRECATED，8 散落活跃目录，1 在 `07-archive/` | ✅ 确认 | — |
| AI 缓存 | 0 | 无 `.ai-index`；但 `public/ai-memory-index.json`（AI 记忆索引）**已存在** | 🟡 偏差 | 缺"缓存机制"为真，但"AI 无法加载"被 `ai-memory-index.json` 部分缓解 |

### 2.2 双向一致性（原 61/100）

| 检查项 | 原得分 | 本地核验 | 结论 | 修正说明 |
|--------|:---:|------|:---:|------|
| 存在落差 | 40 | `src/services/` 实测 **24 个子域目录**，无总览文档 | ✅ 确认 | — |
| 规格落差 | 20 | 仅 `../reference/input-cabin-spec.md` 存在，4 舱缺 spec | ✅ 确认 | — |
| 指南落差 | 30 | 无 How-to 系列（Widget/Store/Service） | ✅ 确认 | — |
| 索引落差 | 0 | `docs/README.md` 缺失；但 `.trae/` + `ai-memory-index.json` 存在 | 🟡 偏差 | 非绝对 0，AI 检索有兜底 |
| 数据一致 | 20 | 同 2.1「数据一致」——3 真重复非 10 | 🔴 例外（误报） | 同上 |
| 归档状态 | 40 | 同 2.1「归档状态」——9 份仅 1 正确归档 | ✅ 确认 | — |

### 2.3 重大遗漏（两张表均未覆盖）

| # | 遗漏项 | 实测 | 严重度 | 说明 |
|---|--------|------|:---:|------|
| O1 | **根级自包含子包 `file-management-system/`** | 502 文件 / 含自有 `node_modules`+`bin/` | 🔴 高 | 直接违反 TRAE「业务源码→`src/`、禁止散落根目录」；评分表完全未触及根级文件管理 |
| O2 | **`docs/reports/` 90 MB / 1414 文件未隔离** | gitignore 仅忽略 `audit/*.json` | 🔴 高 | 头号膨胀源，会随提交污染仓库 |
| O3 | **根级散落**（`_*.cjs`×4、`.zip`×2、`articles/`×29） | 均未 gitignore | 🔴 高 | 脚本应入 `scripts/`、媒体应入 `assets/`、`public/`、压缩包应忽略 |
| O4 | **`.gitignore` 覆盖缺口** | 上述 O1/O2/O3 均未被忽略 | 🔴 高 | 已有门禁（Husky/audit）但**不捕获文件卫生** |
| O5 | **`docs/` 根 8 个散落 `.md`** | 含本类分析报表 | 🟡 中 | 违反"禁止散落"，应归入子目录 |
| O6 | **`architecture/`(1) 与 `architecture-radar-v2/`(58) 拆分** | 命名不一致、内容割裂 | 🟡 中 | 应合并为单一 `docs/architecture/` + 子目录 |
| O7 | **`.trae/` 过程产物未忽略** | `lint-*.txt`、`logs/*` | 🟡 中 | 过程产物外溢到 TRAE 自身目录 |

> **校对结论**：两张表对 `docs/` 内部治理刻画较准（顶层入口、归档、存在/规格落差均确认），但存在 **2 处误报**（DATA_DEFINITION 重复数、AI 缓存绝对 0）、**3 处偏差**（README/令牌/索引落差口径过严）、**7 处重大遗漏**（全部指向**根级文件卫生与 `.gitignore` 缺口**）——而这些恰恰是 TRAE 视角下最刺眼的问题。

---

## 三、TRAE 开发习惯匹配度评价（五维度）

> 每维度按「TRAE 规则 → V9 现状 → 匹配度 → 证据」评价；匹配度 0–100。

### A. 文件组织结构（SSOT / 归档标准）
- **TRAE 规则**：公共目录单点收敛；源码→`src/`、文档→`docs/`、脚本→`scripts/`、媒体→`assets/`/`public/`；禁止散落根目录。
- **V9 现状**：`src/` 作为源码 SSOT 纪律良好 ✅；`docs/`、`scripts/`、`.trae/` 均有规划意图 ✅。但 **根级出现 `file-management-system/`(502, 含自有 node_modules)、`articles/`(29)、`_*.cjs`(4)、`.zip`(2)** ❌，完全违背"禁止散落根目录 / 源码→src"。
- **匹配度：55** —— 源码层合格，仓库根级严重失序。

### B. 命名规范（全小写 / kebab-case）
- **TRAE 规则**：文件/目录名全小写，推荐连字符 kebab-case。
- **V9 现状**：`docs/` 用 `01-requirements/` 等有序编号前缀（利于索引，可接受）；但 `DATA_DEFINITION` 系列用 **UPPER_SNAKE**（`AI_CENTER_DATA_DEFINITION` 等）与 kebab 不一致 ❌；根级 `_cmp.cjs` 等下划线临时脚本 ❌；源码 PascalCase 组件（React 惯例，合理）。
- **匹配度：65** —— 主体可接受，但数据字典命名与临时脚本破坏一致性。

### C. 目录层级（极简 / 避免深宽失当 / 无死目录）
- **TRAE 规则**：极简（3 文件底线）、模块化、避免过度嵌套。
- **V9 现状**：`docs/` **20 个顶层子目录 + `reports/` 1414 文件**（与"极简"相反）；**2 个空目录**（`design/`、`project-management/`）❌；`architecture/` 与 `architecture-radar-v2/` 割裂 ❌；`file-management-system/` 自成深树 ❌。
- **匹配度：50** —— 文档侧过宽过深，且存在死目录与割裂。

### D. 文档分类（Living PRD / DECISIONS / 最小中间文档 / AI 规则）
- **TRAE 规则**：`../archive/feature-xxx-template.md` 作唯一需求源；`./GOVERNANCE.md` 记"为什么选 A 不选 B"；中间文档不堆项目内；AI 规则入 `.trae/skills` 或 `rules`。
- **V9 现状**：已有**八类文档归类体系**（超 TRAE 最小主义，适合规模）✅；`.trae/skills/v9-gatekeeper` + `rules` + MCP 已落地 ✅。但 **无单一 Living PRD / 无 `./GOVERNANCE.md`（9 份 ADR 式文档散落无主索引）** ❌；**`drafts/`(9)/`plans/`(4)/`blueprints/`(1) 囤积中间文档** ❌（违背 3 文件底线）；`docs/` 缺主控索引 ❌。
- **匹配度：60** —— 分类框架与 AI 规则好，但缺 PRD/DECISIONS 主轴、囤中间文档、无索引。

### E. 开发习惯一致性（已用 TRAE 但结构未遵从）
- **TRAE 规则**：采用 TRAE 即应按其规范治理项目；规则避免重复、覆盖全栈。
- **V9 现状**：**`.trae/` 已采用**（rules + skill + MCP），且代码门禁极严（Husky + `audit:*` + `v9-gatekeeper`）✅。但 **`.trae/rules` 未见"公共目录单点收敛 / 归档标准 / kebab-case"等文件管理条款** ❌——规则侧重**代码门禁**，对**文件/文档卫生无约束**；`.gitignore` 也不捕获根级散落。形成"**代码严、结构松**"的分裂人格。
- **匹配度：50** —— 工具已用，习惯未贯穿到文件结构。

### 三维度综合匹配度

| 维度 | 匹配度 | 权重 | 加权 |
|------|:---:|:---:|:---:|
| A 文件组织结构 | 55 | 20% | 11.0 |
| B 命名规范 | 65 | 20% | 13.0 |
| C 目录层级 | 50 | 20% | 10.0 |
| D 文档分类 | 60 | 20% | 12.0 |
| E 开发习惯一致性 | 50 | 20% | 10.0 |
| **综合** | — | 100% | **56.0** |

> **综合匹配度 ≈ 56/100（中等偏低）**：TRAE 工具链已就位且代码治理优秀，但**文件组织结构与文档卫生明显未遵从 TRAE 自身发布的规范**，根级散落与 `.gitignore` 缺口是最大扣分项。

---

## 四、综合评价与核心问题清单

**总体判断**：V9 是一个**代码架构健壮、文档治理滞后、文件结构失序**的项目。从 TRAE 视角看，它"用了 TRAE 做代码门禁，却没用 TRAE 做文件管理"——工具采纳与结构纪律脱节。

**TOP 问题（按 TRAE 严重度）**
1. 🔴 根级自包含子包 `file-management-system/`（502 文件 + 自有 node_modules）违反"源码→src / 禁止散落"。
2. 🔴 `docs/reports/` 90 MB / 1414 文件未隔离，将随提交污染仓库。
3. 🔴 根级散落（`_*.cjs`×4、`.zip`×2、`articles/`×29）且 `.gitignore` 未覆盖。
4. 🟡 `DATA_DEFINITION` 重复口径误报（3 真重复非 10）；令牌/索引/AI 缓存三项得分口径过严。
5. 🟡 缺 `docs/README.md` 主控索引、`./GOVERNANCE.md`、单一 Living PRD；`drafts/plans/blueprints` 囤积中间文档。
6. 🟡 `architecture/` 与 `architecture-radar-v2/` 割裂；2 个空目录；`docs/` 根 8 个散落 `.md`。

---

## 五、改进建议（TRAE 对齐，P0/P1/P2）

### P0（一致性阻断，建议本周）
| 动作 | 对应 TRAE 规则 | 文件/目录 | 验收 |
|------|----------------|-----------|------|
| 建 `docs/README.md` 主控索引（含 20 子目录导航 + 八类体系入口） | 索引落差 / AI 快速加载 | `docs/README.md` | AI 可 1 步定位任意文档 |
| 将 4 个 `_*.cjs` 移入 `scripts/`；2 个 `.zip` 移入 `releases/`（或删除）；`articles/` 并入 `docs/assets/` 或 `public/` | 归档标准 / 禁止散落 | 根级 | 根目录仅剩项目元文件 |
| 处置 `file-management-system/`：迁移至 `tools/file-management-system/` 并 gitignore 其 `node_modules`/`bin`，或抽为独立子仓 | 公共目录单点收敛 / 源码→src | 根级 | 根级无自包含子包 |
| 补齐 `.gitignore`：忽略 `docs/reports/`（保留一份生成索引）、`file-management-system/node_modules`、`articles/`、`_*.cjs`、`v9-roadmap-execution.zip`、`.trae/logs/`、`.trae/lint-*.txt` | 过程产物隔离 | `.gitignore` | 上述散落均不可提交 |

### P1（高优，建议两周内）
| 动作 | 对应 TRAE 规则 | 文件/目录 | 验收 |
|------|----------------|-----------|------|
| 合并 `DATA_DEFINITION`：3 个同名 → 单一 `../reference/data-definition.md`；7 个域定义重命名为 kebab（`../reference/ai-center-data-definition.md` 等） | kebab-case / SSOT | `docs/02-design/` | 同名 0、命名统一 |
| 将 8 份散落 DEPRECATED 移入 `07-archive/`；删除或填充 2 个空目录 | 归档状态 | `docs/` | 活跃目录无 DEPRECATED、无空目录 |
| 合并 `architecture/` ↔ `architecture-radar-v2/` 为单一 `docs/architecture/` + 子目录 | 目录层级 / 命名 | `docs/` | 无割裂 |
| 将 `docs/` 根 8 个散落 `.md`（含本报告）归入 `docs/00-meta/`（即本报告所在处，以身作则） | 禁止散落 | `docs/` | `docs/` 根仅留 `../../README.md` |
| 在 `.trae/rules` 中增补文件管理条款（公共目录单点收敛 / 归档标准 / kebab-case / 禁止散落） | 开发习惯一致性 | `.trae/rules` | 后续 AI 改动自动遵从 |

### P2（中优，持续）
| 动作 | 对应 TRAE 规则 | 文件/目录 | 验收 |
|------|----------------|-----------|------|
| 建 `./GOVERNANCE.md`（收口 9 份 ADR 式文档）+ 单一 Living PRD 索引（指向 `01-requirements/`） | 3 文件底线 | 根级 / `../reference/README.md` | 决策有主索引、需求有唯一源 |
| 设节奏将 `drafts/plans/blueprints` 归档进 `07-archive/` | 最小中间文档 | `docs/` | 中间文档不长期堆项目内 |
| 正式将 `public/ai-memory-index.json` 立为 AI 文档索引（命名可加 `.ai-index` 软链），关闭"AI 缓存 0%"缺口 | AI 索引 | `public/` | AI 检索有官方索引 |

---

## 六、修订后评分提示

若执行 P0，下列原评分项将显著变化：
- **顶层入口 0→约 75**（补 `docs/README.md`）、**索引落差 0→约 70**（AI 可快速加载）；
- **自动产物 50→约 80**（隔离 `docs/reports/`）、**孤儿/过程产物**随根级散落清理而下降；
- **文档治理层 52 → 约 70+**，**双向一致性 61 → 约 75+**；综合评级 **C → B**。
- 本项目匹配度 **56 → 约 72**（A 维度随根级清理大幅回升）。

> 注：本报告本身即落入 P1「`docs/` 根散落」问题——故刻意写入新建的 `docs/00-meta/`，以践行所提规范。
