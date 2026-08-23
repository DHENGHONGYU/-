---
skill_id: V9-SKILL-DOCS-AS-MIRROR
name: "docs-as-mirror"
description: "指导 AI 编写与仓库实际状态严格一致的文档。核心原则：Truth-First（先读取真相源再编写）、Scan-Before-Write（编写前扫描实际文件系统）、Exhaustiveness（穷尽性原则覆盖所有文件归属）、Bidirectional Linking（双向引用防止信息孤岛）、Version Pinning（版本锁定确保兼容性）。Invoke when user asks to write or update any technical documentation, directory mapping guide, .gitignore documentation, file management spec, architecture description, audit:docs 报告文档与实际不一致、audit:directory 报告目录映射遗漏、新增目录/文件后需要同步更新相关文档。"
version: v1.0.5
last_updated: 2026-08-23
change_log:
  - version: v1.0.5
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 5 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.4
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.3 / 正文 v1.0.2) → 取真值 max=1.0.3 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 3 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-11
mandatory: false
---

# 文档镜像技能（Docs-as-Mirror） — v1.0.5

> **版本**: v1.0.5 | **日期**: 2026-08-21 | **校验基准**: V9 AGENTS.md 当前版本 + 实际文件系统 + package.json + `docs/` 真实现状
> **适用性质**: 文档编写与维护的 AI 行为约束；禁止凭空捏造目录定义/规则/命令名
> **输出格式**: 编写前扫描证据 + 文档正文（穷尽覆盖 + 双向引用 + 版本锁定） + 编写后验证报告 + 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求编写或更新任何技术文档（文件管理规范、编码规范、API 规范、数据规范、目录映射指南、.gitignore 说明、架构描述、SOP 正文等）
- **显式触发 2**：怀疑文档凭记忆写（典型症状：`src/` 下按「core、data、services 等分层」这种模糊话术 + 未具体列出 10 子目录）、.gitignore 说明 vs 实际规则不符、文档引用旧版契约号
- **脚本/审计触发 3**：`npm run audit:docs` 报告文档与实际不一致（有未文档化 src 文件、文档引用路径不存在）；或 `npm run audit:directory` 报告目录映射遗漏（AGENTS.md 目录定义 vs 文档说明不一致）
- **脚本/审计触发 4**：`npm run stale-path-reference-audit` 或 Grep 全仓扫出僵尸路径/死链接；交叉索引治理扫描 covers_code/covers_docs 缺失
- **设计/协议触发 5**：AGENTS.md 大版本升级、package.json scripts 变更、门禁命令增删后重评文档准确性；新增目录/文件、模块归位、文件迁移/重命名/归档后同步所有引用文档；十目录架构/Frontmatter 标准/质量链三环契约更新

**不触发场景 · 减少误激活**：
- 纯代码功能开发（未涉及文档）；
- 文档中的错别字修复 / 文案润色（不涉及目录、命令、版本号变更的微小改动）。

**协作 Skill / 链式调用**：
- 扫描前置→`architecture-radar-scan`（确认目录/架构无漂移）+ `stale-path-reference-audit`（僵尸路径全仓扫）；
- 双版本校对→`doc-freshness-governance`（基准日校对、change_log 闭环）；
- 文档录入/管理→`doc-management-principles`（十目录架构 + Frontmatter 标准 + 质量链三环）；
- 交叉索引治理→`cross-index-governance`（doc_id / covers_code / covers_docs / related_docs 四向）。

---

## 二、前置检查

> **铁律（5 大原则 · 违反任一即 FAIL）**：① Truth-First（第一步永远读实际文件，禁止凭记忆或模板写目录/命令/.gitignore 说明）；② Scan-Before-Write（写任何文档前，先扫文件系统：路径真存在？Frontmatter 对？引用文档真在？doc_id 无冲突？）；③ Exhaustiveness（复杂文档必须穷尽覆盖：8 章节模板 100% 打勾，禁止「最小化原则」留灰地带）；④ Bidirectional Linking（任何文档必须同时建立注册+引用+反向 3 方向链接；禁止单向引用孤岛）；⑤ Version Pinning（文档头必须显式标注基于哪个契约版本；契约升级时必须重评 SOP 关键处）。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 读当前架构契约与项目体系版本 | 打开 `AGENTS.md`（记录其顶部声明/大版本号）+ 读 `package.json` version（项目级版本） | 两者版本号均记录（不是凭印象写 v1.x） |
| 2 | 提取 AGENTS.md 目录+验证命令+命名规则 | Grep `src/` / `.agents/` / `docs/` 目录定义行；Grep `npm run audit\|npx tsc\|npm test` 验证命令全集；Grep §四命名约定 | 提取结果后续逐行比对文档覆盖率，目标 100% |
| 3 | 扫实际文件系统（目录/.gitignore/流浪路径） | `find . -maxdepth 2 -type d \| sort`；`cat .gitignore \| grep -v '^#' \| grep -v '^$' \| sort`；`git status --short`（找未跟踪流浪文件） | 所有非标准目录 / .gitignore 每一条规则 都有对应说明（或废弃解释） |
| 4 | 真相源存在性 + doc_id 冲突扫 | Glob 目标文档路径（Test-Path）+ Grep 全仓目标 doc_id；Glob 文档要引用的 8+ 篇相关文档路径 | 路径存在 + doc_id 0 冲突 + 被引用文档 10/10 命中 |
| 5 | package.json 命令真相导出 | 读 scripts 对象并排序写临时 JSON（命令参考库） | 文档中使用的每个 `npm run <xxx>` 名都能在库中找到匹配（不存在的命令 = 虚构，FAIL） |
| 6 | 相似目录/冲突目录人工区分 | Grep `agents/` vs `.agents/skills/` 、`src/utils/` vs `src/lib/` 、`src/databridge/` vs `src/core/` | 相邻排列并附职责差异；废弃目录必须标注 |
| 7 | 编写前快照 | `git status --short > outputs/docs-as-mirror-before.txt` + 文档变更前 AGENTS.md 版本号记录 | 有前后对比基线 |

---

## 三、阶段化 SOP

按 5 个 Phase 顺序严格对应 5 大原则落地，禁止跳过任何 1 个 Phase。

### **目标**：文档=代码状态的精确镜像，无捏造目录、无虚构命令、无遗漏章节、无信息孤岛、无版本漂移。

### Phase 1 · Truth-First（真相优先，零凭记忆）

**交付物**: 真相源 → 文档映射表

1. **打开并阅读当前版本的契约**：AGENTS.md / ARCHITECTURE.md / 对应 README / 被引用的相关文档。不要凭记忆写「源代码放在 src/ 下按 core/data/services 等分层」——必须**逐条抄 AGENTS.md 实际列出的目录定义**。
2. **每一项定义都要与真相对比覆盖**：目录定义、命名规则、验证命令三条线，要把 Phase §二 2 提取的结果逐条覆盖到文档对应章节中，目标 100%。
3. **冲突以契约为准改文档**：如果文档旧内容与当前 AGENTS.md / package.json / 实际文件系统冲突，必须改文档（并在 change_log 中加一条记录说明「对齐 AGENTS.md vX.Y」）。**禁止改契约来迁就文档**。

### Phase 2 · Scan-Before-Write（编写前扫真相，零凭空假设）

**交付物**: 扫描结果 4 件套（R1 路径+R2 doc_id+R3 命令库+R4 引用存在性）

- R1 **路径检查**：写任何文件前先 Test-Path，不存在的目录/路径先建（如 docs/guides/sops 不存在则 mkdir），不得假设目录存在。
- R2 **doc_id 冲突**：如果文档需要 doc_id（如 V9-DOC-SOP-000），Grep 全仓确认 0 命中再占用。
- R3 **命令存在性**：文档中所有命令名必须在 package.json scripts 导出的命令参考库中命中（或脚本路径真实存在），不得虚构。
- R4 **被引用文档存在性**：文档计划引用的每一篇外部文档（8+2 篇目标）都用 Glob 确认路径存在，不存在=要先建/改目标引用名。

### Phase 3 · Exhaustiveness（穷尽性原则，零漏章节）

**交付物**: 8 章节勾表 + 8/8 通过

**文件管理类/目录映射类文档，必须包含的 8 章节**（对应原技能 §原则 3）：
1. **目录映射表** — 每个目录的职责、依赖方向、与相似目录的区别
2. **命名规范** — kebab-case / PascalCase / camelCase+Store / UPPER_SNAKE_CASE 四类分别说明适用位置
3. **`.gitignore` 规则说明** — **基于实际 `.gitignore` 文件逐行分类**（不是凭经验写常见 node_modules/.dist/.env）
4. **提交前检查清单** — 完整列出所有验证命令（tsc / lint / audit:* / npm test 等，必须与 package.json scripts 一致）
5. **定期审计策略** — 未跟踪文件审计、架构合规审计、doc_id 巡检
6. **生命周期管理** — 入（创建）- 移（迁移）- 出（清理/归档）全闭环
7. **交叉引用** — 引用 AGENTS.md；并被文档索引（REGISTRY_INDEX/README）收录
8. **变更日志** — 版本同步关系、修订记录（含本次对齐的契约版本号）

**禁止「最小化原则」**：不得留「其余按常识处理」「开发者自行判断」这种无操作定义的灰色坑。

### Phase 4 · Bidirectional Linking（双向引用，防信息孤岛）

**交付物**: 三步骤 DoD 勾表（3/3）+ 引用链路图

1. **注册**：新文档必须注册到文档索引（`docs/README.md` 或 `REGISTRY_INDEX.md`），条目包含「标题 / 路径 / 一句话描述 / 版本号 / doc_id / covers_code / covers_docs」。
2. **正向引用**：新文档必须引用所有相关真相源与关联文档（如文件管理规范必须引用 AGENTS.md + FILE-MANAGEMENT-GUIDE）。
3. **反向引用**：在至少 1~2 篇相关真相源文档（如 AGENTS.md 附录、该 Skill 对应章节、模块 README）中反向建立引用该文档的链接；Frontmatter `referenced_by` 字段填上游文档 id。

完成后检查：**不存在「写了一篇文档但新人在总览页里完全找不到入口」的情况**。

### Phase 5 · Version Pinning（版本锁定，防契约升级后文档失信）

**交付物**: 双版本号声明 + 升级重评范围

- **文档头强制声明**（至少以下之一 + Frontmatter last_updated / code_version / covers_code）：
  ```
  > 文档体系版本: <项目 package.json version> | 本文档修订: rev.N | 兼容 AGENTS.md v<AGENTS.md 顶部声明版本>+
  ```
- **Frontmatter 必须带**: `last_updated`（YYYY-MM-DD）+ `change_log`（本次变更的 version/changes/date）+ 若有明确的代码基线则加 `code_version`。
- **重评规则声明**：文末或兼容性段必须明确：契约（AGENTS.md / code_version）大版本升级时，本 SOP 哪 N 处必评（例：S05 §2 命令集 / §3.1 分级阈值 / §4.B 25 股票清单）。

---

## 四、陷阱与经验教训

| # | 教训 | 后果 | 规避方法 |
|---|------|------|---------|
| 1 | 凭记忆编写目录定义 | 遗漏 `src/portal/`、`src/constants/`、`.agents/skills/` 等非平凡目录，文档覆盖率 <80% | §二 2 用 Grep 从 AGENTS.md 提取完整目录清单，**逐条复制**到文档，严禁省略「等」字 |
| 2 | 最小化原则（只写最确定的几条） | 留下命名规范、Schema SOP、temp 清理、归档策略等大量灰区，新人 10 问 10 查不到答案 | §三 8 章节模板 100% 勾选通过；缺一章=FAIL，不得打折扣 |
| 3 | 单向引用（文档引用 AGENTS.md 但 AGENTS.md 不引用文档） | 新人从真相源出发找不到该 SOP，文档长期没人看 | §三 Phase 4 三步强制：注册+正向+反向；三步骤 DoD 3/3 才过 |
| 4 | 文档版本号 & 项目版本号 & AGENTS.md 版本号三不一致 | 文档 v1.0.0，README v2.5.0，AGENTS.md v1.6.0，读者不知道信谁 | §三 Phase 5 双版本号统一：项目体系版（package.json）+ 文档 rev + 契约兼容版 |
| 5 | .gitignore 文档与实际脱节 | 文档写 11 类忽略项，实际 .gitignore 有 167 行规则 → 90% 规则没覆盖 → 文档失信 | §二 3 先扫：`cat .gitignore | grep -v '^#' | grep -v '^$' | sort` → **基于实际清单分类写入文档** |
| 6 | 遗漏 toolit/、src/databridge/、src/utils/ 等「历史残留」目录 | 新人以为这两个目录有效 → 开发走错目录 → 后期目录迁移成本高 | §二 6 强制「相似/冲突目录人工区分表」；残留目录必须在文档中标「废弃」「兼容保留」「计划清理日期」 |
| 7 | 只定义「新文件放哪里」，不定义文件迁移/清理策略 | 老项目技术债务利滚利，死文件、残影目录、僵尸文档越积越多 | §三 8 章节模板第 6 章「生命周期管理」必须写：入（创建）-移（迁移路径+正则安全+import 同步）-出（归档规则、doc_id 处理、索引清理） |
| 8 | 文档中使用的命令名、审计脚本路径、版本号都是假的 | 新人照文档跑命令直接失败，对文档信任感直接崩塌 | §二 5 把 package.json scripts 全部导出 JSON 参考库；每个命令必须能在库中命中（或脚本路径真实存在） |

---

## 五、完成交付物清单

### 5.1 交付物清单（≥10 项 · 完成打勾）

- [x] **1. 当前契约版本记录**：AGENTS.md 版本号 + package.json 项目体系版本号
- [x] **2. AGENTS.md 提取三件套**：目录定义全量清单 + 验证命令全量 + 命名规则全量
- [ ] **3. 实际文件系统扫描结果**：目录结构 2 层列表 + .gitignore 规则全集（去注释去空行后排序） + 流浪文件状态
- [ ] **4. 编写前扫描 R1–R4 报告**：路径存在 / doc_id 0 冲突 / 命令库 ≥ 180 条命中 / 被引用文档 10/10 命中
- [ ] **5. 相似/冲突目录区分表**：相邻目录职责差异 + 废弃目录保留原因+清理计划
- [ ] **6. 8 章节穷尽勾表**：文档正文 1-8 章全过（对应 §三 Phase 3）
- [ ] **7. 三步骤双向引用证明**：注册（文档索引收录）+ 正向引用 + 反向引用（至少 1-2 篇真相源回链）
- [ ] **8. 版本号声明与重评范围**：文档头双版本号 + Frontmatter last_updated/change_log 齐全 + 契约升级必评范围 N 处
- [ ] **9. 目录覆盖度对比验证**：AGENTS.md 提取目录集合 与 文档目录集合 100% 一致（目标 0% 遗漏）
- [ ] **10. .gitignore 覆盖度验证**：文档说明 vs 实际规则 覆盖率 ≥ 95%（<5% 未覆盖且有合理解释）
- [ ] **11. 命令路径存在性验证**：文档每个 `npm run <xxx>` 或脚本路径都在命令库中命中
- [ ] **12. 文档-代码一致性复查**：`npm run audit:docs` + `npm run audit:directory`（若有）0 inconsistencies
- [ ] **13. 交叉索引治理输出**（如需）：Frontmatter doc_id / covers_code / covers_docs / related_docs / referenced_by 5 字段齐全
- [ ] **14. 四端一致性同步**（若变更技能文档索引/描述）：registry / README 导航表 / AGENTS.md 索引同步

### 5.2 必要且充分条件

> **当且仅当**以下 4 条**同时成立**，方可声称本次文档编写/更新完成：
> 1. **真相对齐**：文档中所有目录定义、命令名、脚本路径、.gitignore 分类、版本号都能在 AGENTS.md / package.json / 实际文件系统 / .gitignore 当前版本中独立命中；**无任何一处「凭经验大概」的模糊描述**（不得出现「…等」「大概 10 项」这种含混话术，除非附精确清单作为定义补全）。
> 2. **章节+链接齐备**：8 章节穷尽 8/8 全过 + 双向引用三步骤（注册+正向+反向）3/3 全过；不存在写完成后「文档总览找不到入口」的信息孤岛。
> 3. **版本锁定可追溯**：文档头双版本号声明齐全 + Frontmatter last_updated 与 change_log 同时更新 + 明确了契约大版本升级时的必评范围（至少 1 处）。
> 4. **门禁全绿**：`npm run audit:docs`（代码-文档同步）与 `npm run audit:directory`（目录映射对齐）报告 0 inconsistencies；且文档编写前后快照比对仅涉及本次目标文档 + 少量索引同步文件（通过 `git commit --only <paths>` 限定范围，不得混入代码改动）。

---

## 附录 A · 实战案例：SOP Suite v1.0.0 编写五大原则落地证据

> 本条作为本 SKILL 5 大原则**完整落地案例**参考。产物位置：`docs/guides/sops/`（1 总览 README + 7 正文 S01–S07）。

- **Truth-First 证据**：真相源 1 `AGENTS.md v1.6.0`（S05 §2 24 步门禁 → §七 22 步 + Step 23/24 延伸；22/6 命令严格一致；真数禁止、MCP=17、DB_VERSION=35 全在 SOP 中有体现）；真相源 2 `package.json scripts`（先导出 255 条命令 JSON 引用库，每条文档命令都可在此命中）；真相源 3「上线前全面校验报告 v2.0.0 §1.1」6 维评分权重与 S05 §3.4 100% 一致。冲突处理：所有 SOP 文末「文档兼容性声明」明确「冲突以 AGENTS.md 当前版本编号为准 + 同步修订 SOP（附 change_log）」。
- **Scan-Before-Write 证据**（Task 0 R1–R4）：R1 `Test-Path docs/guides/sops` 不存在→一次创建成功；R2 Grep 全仓 doc_id `V9-DOC-SOP-000~007` → 0 冲突→合法可用；R3 导出 scripts（255 条 ≥180 条）；R4 Glob 8+2 篇被引用文档目标 → 10/10 全部命中。
- **Exhaustiveness 证据**：阶段穷尽 S01→S07 覆盖新人 Clone→线上 P0 RCA 完整 SDLC 闭环时间线 100%；目录穷尽 8 doc_id（SOP-000~007）无 orphan（REGISTRY/README/脚本 0 僵尸）；章节穷尽 7 正文严格五段式+S05/S07 子章扩展。
- **Bidirectional-Linking 证据**：REGISTRY_INDEX.md（四向交叉索引表）+ AGENTS.md 双引用注入点（头部「📋 SOP 规范体系」声明 + §七 验证命令尾交叉链接）+ 8 篇被引用文档回链（how-to/模块标准/故障排查/git/09-gates/testing-strategy/DEPLOYMENT-CHECKLIST/校验v2.0.0）+ Frontmatter `referenced_by` 链式（S01→S02→S03→S04→S05→S06→S07）。
- **Version-Pinning 证据**：8 SOP Frontmatter 统一 code_version=`"2.0.0-rc.1"` + last_updated=`2026-08-19` + change_log v1.0.0；每篇 Frontmatter/兼容性声明明确「基于 AGENTS.md v1.6.0 编写；大版本升级/次版本 bump 重评关键内容」；S06 §2.A HOTFIX 豁免与 package.json version 严格绑定用 `npm version` 官方工具。

---

## 附录 B · 相关参考与协同

- AGENTS.md（契约真相源）· `docs/01-requirements/FILE-MANAGEMENT-GUIDE.md`（文件管理规范样本）
- 关联 Skill：`doc-management-principles`（文档十目录+Frontmatter标准+质量链）· `doc-freshness-governance`（双版本校对）· `cross-index-governance`（四向交叉索引）· `stale-path-reference-audit`（僵尸路径扫）· `architecture-radar-scan`（L6 文档同步扫描）
