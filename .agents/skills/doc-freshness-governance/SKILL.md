---
name: "doc-freshness-governance"
description: "以基准日为锚点，统一校对文档双轨版本、last_updated 与 change_log 闭环；并在后续增量变更中保持同频更新。Invoke when user asks to calibrate document versions, fix version drift, refresh last_updated fields, or align frontmatter change_log with actual changes, audit:docs / audit-doc-freshness FAIL 或 detect-doc-version-drift 生成漂移报告或任何代码/文档变更后需要按决策树同频更新 frontmatter 版本时。"
title: 文档新鲜度治理（Doc Freshness Governance）
skill_id: V9-SKILL-DOC-FRESHNESS
type: governance
domain: project
phase: maintenance
status: active
maintainer: current developer
summary: "以基准日为锚点，统一校对文档双轨版本、last_updated 与 change_log 闭环；并在后续增量变更中保持同频更新。"
tags: [governance, documentation, versioning, freshness, audit]
version: "v1.0.2"
last_updated: "2026-08-21"
doc_id: V9-SKILL-DOC-FRESH-001
mandatory: true
triggers:
  keywords:
    - 校对文档
    - 版本对齐
    - 版本漂移
    - 文档新鲜度
    - last_updated
    - change_log
    - frontmatter 版本
    - 双轨版本
    - 基准日校对
    - doc freshness
  files:
    - "docs/**/*.md"
    - "AGENTS.md"
    - ".trae/skills/*.md"
    - ".agents/skills/**/*.md"
    - "prompts/**/*.md"
  events:
    - pre-push
gates:
  - npm run audit:docs
  - npx tsx scripts/audit/audit-doc-freshness.ts
  - npm run audit:skill-coverage
related_docs:
  - "V9-DOC-ROOT-902"   # AGENTS.md
  - "V9-DOC-PROJ-SKILLINDEX-001"  # .trae/skills/INDEX.md
  - "V9-DOC-PROJ-007"   # directory-structure-guide.md
tier: T0
change_log:
  - version: v1.0.3
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×2），词命中 ≥6，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.2
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构；§一从『为什么需要』重写为标准触发条件（A1-A5 子项完整）；§二核心概念合并为表格化前置检查 7 项；§三基准校对 6 步法拆为 6 个 Phase；§四决策树与§五触发矩阵提炼为 8 条教训（后果+规避双字段）；§六交付物清单扩展为 14 项+必要充分条件声明；保留 mandatory=true（T0 治理 Skill）。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "frontmatter 标准化：补齐 name/description 字段（对齐 skill-registry.json 元数据）；description 同步覆盖 registry 占位值；version PATCH++"
    date: 2026-08-11
  - version: v1.0.0
    changes: "定稿版：R1-R6全部确认（用户2026-08-11确认）；R2改为基准校对触发PATCH++；批次重新切分（Batch1=全A类+P0B/C，Batch2=仅非P0B类，Batch3=仅非P0C类）"
    date: 2026-08-11
  - version: v0.9.0-draft
    changes: "草稿版：基准校对 6 步法 + 增量决策树 + 双版本职责分离 + 三门禁验证 + 代码变更-文档触发矩阵"
    date: 2026-08-11
---

# 文档新鲜度治理（Doc Freshness Governance）— v1.0.2

> **版本**: v1.0.2 | **日期**: 2026-08-21 | **校验基准**: V9 AGENTS.md v1.5.5+ + doc-management-principles SKILL v1.0.0+
> **适用性质**: **mandatory（命中触发条件时，交付前必跑 gates 未全绿不得声明完成）**
> **输出格式**: 版本漂移检测报告 → 人工确认的分批清单 → 校对后审计报告 + 变更日志条目
> **基准日（Baseline Day）**: 2026-08-11 — 此后所有版本字段、日期、change_log 均以该次全仓校对为起点

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「校对文档双轨版本」「对齐 last_updated / change_log 闭环」「诊断文档版本漂移」「刷新 frontmatter 版本与正文标题 `— vX.Y.Z` 一致性」「增量变更后文档与代码同频更新」
- **显式触发 2**：AI 读取 frontmatter version 与正文标题版本号不一致、或 AI 新鲜度仪表盘显示长期未维护文档时，主动启动统一校对
- **脚本/审计触发 3**：`npm run audit:docs` / `npm run audit:doc-integrity` / `npm run audit:skill-coverage` 任一 FAIL；或 `npx tsx scripts/audit/audit-doc-freshness.ts` 报告 A/B/C 类违规；或 `node scripts/temp/detect-doc-version-drift.cjs` 输出非空漂移表
- **脚本/审计触发 4**：Git 提交前 husky 的文档门禁钩子（doc-freshness pre-push / pre-commit）校验 FAIL；或 `cross-index-governance` 交叉索引 batch 发现 doc_id / last_updated 未同频
- **设计/协议触发 5**：Frontmatter 标准字段 schema 调整（新增/删除/重命名 doc_id / related_docs / covers_code / covers_docs 等字段）；或 version / code_version / last_updated / change_log 四字段职责定义变更；或十目录架构（docs/ 十目录）新增/下线文档目录
- **设计/协议触发 6**：任何代码变更命中 `§五 代码变更→文档触发矩阵`（§六附录 2）中的路径模式 → 对应文档必须同步刷新 version / last_updated / change_log

**不触发场景 · 减少误激活**：
- 仅代码变更且未命中 §六附录 2 触发矩阵；
- 纯格式排版优化（空白行、缩进、换行符 CR/LF、纯链接锚点调整）不涉及内容与元数据版本的改动。

**协作 Skill / 链式调用**：
- 文档镜像与真相先写 → `docs-as-mirror`
- 交叉索引同步 → `cross-index-governance`
- 文档录入十目录架构 → `doc-management-principles`
- 十域同步检查清单 → `v9-module-sync-checklist`

---

## 二、前置检查

> **铁律: 禁止跳步 DryRun（§三 Step 1 扫描必须先生成报告再批量写）**。单批文件 ≤ 250，超量不得合并批次。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 漂移检测器存在性确认 | `ls scripts/temp/detect-doc-version-drift.cjs`（若缺失则先参考 AGENTS.md §六 1 号脚本重写） | 路径存在 |
| 2 | 新鲜度审计脚本存在性确认 | `ls scripts/audit/audit-doc-freshness.ts` + `scripts/audit/audit-doc-integrity.cjs` | 新鲜度+断链完整性两脚本存在 |
| 3 | 三字段真值优先级知识（A 类漂移解决锚） | 确认 P1 change_log 最新 → P2 正文声明版本 → P3 标题 `— vX.Y.Z` 后缀 → P4 frontmatter.version 裸值 | 所有执行者知道该优先级，不得把低优先级值覆盖高优先级 |
| 4 | SemVer 三位版本号补齐规则 | 检查 `v1.2` / `v4.8` 这种双位版本号 → 需先补零为 `v1.2.0` / `v4.8.0` 再 PATCH++ | 不得出现 MAJOR.MINOR 两位，任何基准校对必须先补齐三位 |
| 5 | R2 铁律确认 | **基准校对必须触发 PATCH++**（即使只对齐三个字段未改内容） | 执行者不得以「内容没变」为由跳过 PATCH |
| 6 | 批次文件数上限 250 确认 | 从 Step 1 扫描报告中检查单批文件数 ≤ 250（参考 doc-management-principles §八安全过程） | 超过则拆子批次 |
| 7 | 审计前快照 | `git status --short > outputs/doc-freshness-batch-N-before.txt` | 有校对前磁盘状态快照 |

---

## 三、阶段化 SOP

### **目标**：A 类双轨不一致 / B 类 last_updated 缺失 / C 类 change_log 闭环缺失 三类漂移一次性清零 + 增量变更永久同频更新。

### Phase 1 · 扫描（必须先做）

**交付物**: P0/P1/P2 分档的漂移报告 + 3 批文件集合

```powershell
node scripts/temp/detect-doc-version-drift.cjs
# 产物：outputs/doc-version-drift-report-YYYY-MM-DD.md
```

- 报告按 A/B/C 三类 × P0/P1/P2 分档；
- **禁止**：未读报告并确认清单前批量写任何文件。

### Phase 2 · 取真值（A 类冲突解决）

**交付物**: 每份文档的「目标 version / 目标 last_updated / change_log 首条」真值表

对每份文档按 §二 #3 优先级取目标版本：

| 场景 | 目标 version | 目标 last_updated |
|------|-------------|------------------|
| change_log 最新 + 正文声明版 | change_log 最新条目的 version | change_log 最新日期合法则用它；否则基准日 2026-08-11 |
| 仅正文声明版 | 正文版本 | 基准日 2026-08-11 |
| 仅 frontmatter.version 裸值 | frontmatter | 基准日 2026-08-11 |
| 完全没有版本 | 新建 `v1.0.0` | 基准日 2026-08-11 |

铁律：正文声明版本 < frontmatter.version → **以高版本为目标**并 change_log 追加合并记录；**绝不允许回退版本号**。

### Phase 3 · 改元数据（写 frontmatter 核心字段）

**交付物**: 本批所有文档的 version / last_updated / code_version 三字段写入 diff

```yaml
version: <Phase2确定的目标版本>
last_updated: 2026-08-11    # 基准校对阶段；增量阶段改为当天日期
code_version: "2.0.0-rc.1" # 若缺失则补；已有则由 audit-version-drift 对齐 package.json
```

+ 补齐三位 SemVer（v1.2 → v1.2.0 先）+ PATCH++（R2 铁律）。

### Phase 4 · 补 change_log 闭环

**交付物**: change_log 数组首尾完整，首条（若无 change_log 则次条）为基准校对条目。

固定条目模板（基准校对专用）：

```yaml
change_log:
  # ... 原有条目 ...
  - version: <Phase2目标版本PATCH++后>
    changes: "基准日校对(2026-08-11)：对齐 frontmatter.version 与正文声明 / 补全 last_updated / 新增 change_log 闭环"
    date: 2026-08-11
```

- **已有 change_log** → 最前面追加基准条目（保证最新一条与 Phase3.version/last_updated 一致）
- **无 change_log** → 首条为"初始化版本"条目（version = 当前目标 version，date = 能找到的最早修改日期），次条为基准校对条目

### Phase 5 · 备份 + 批次报告生成

**交付物**: Git 前快照 + 批次变更报告 `outputs/doc-freshness-batch-N-2026-08-11.md`

- 报告内容：本批文件列表 / 每份的漂移类型 A/B/C / A 类冲突真值判定依据 / 下一待办批次
- 任何本批失败不得进入下一批（三门禁 F ail 修复前不得开启下一批）

### Phase 6 · 三门禁验证（100% 全绿交付）

**交付物**: G1/G2/G3 全绿报告

| 门禁 | 命令 | 失败时处理 |
|------|------|-----------|
| G1 audit:docs | `npm run audit:docs` | code_version 漂移先对齐 package.json |
| G2 audit-doc-freshness | `npx tsx scripts/audit/audit-doc-freshness.ts` | P0/P1 必须修复；P2 可审阅后 waive |
| G3 audit:doc-integrity | `npm run audit:doc-integrity` | frontmatter 格式调整引入断链 → 立即修复路径 |

---

## 四、陷阱与经验教训

| # | 教训条目 | 后果 | 规避 / 对策 |
|---|---------|------|------------|
| 1 | 基准校对必须触发 PATCH++（R2），哪怕「内容没改只是对齐字段」 | 跳过 PATCH → change_log 最新条目的 version 与 frontmatter.version 不一致 → 下次 A 类漂移优先顺序算法取到错误真值，形成恶性循环 | Phase 3 末尾强校验：写入后 frontmatter.version 必须 = 原真值 PATCH+1，不一致则回滚 |
| 2 | A 类冲突的真值优先级顺序错误（把 frontmatter.version 当最高优先级） | 会把人工正文维护的「显式声明版本」覆盖为 frontmatter 的裸值 → AI 读到假旧版 → 兼容逻辑错误 | Phase 2 前必须通读 §二 #3 P1→P4 表格，执行者不得自行调换顺序 |
| 3 | 禁止跳过 Phase 1 DryRun / 报告生成，直接批量写文件 | 不知道 P0/P1/P2 分布，一次写数百文件 → 三门禁失败时 diff 定位极其困难 | 铁律：Step 1 报告未生成，任何批量写禁止；单批文件数>250 必须拆子批 |
| 4 | 双位 SemVer 未补齐三位就 PATCH++（v1.2 PATCH++ → v1.3 而非 v1.2.1） | 与 package.json / code_version 三位对比恒不匹配 → audit-version-drift 恒 FAIL | Phase 3 首步：正则把 `^v(\d+)\.(\d+)$` 匹配为 `v$1.$2.0`，补齐三位再 PATCH |
| 5 | 「仅代码变更文档未改」判断错误，导致 `§六附录2 触发矩阵` 命中路径漏检 | 代码改了 databridge.ts，但文档 data-interaction-protocols.md 未追加 change_log → 下次读文档会误以旧版兼容新协议 | 每次 git diff 先运行矩阵路径 grep；命中则打开文档追加「代码侧变更确认兼容」change_log 并 PATCH++ |
| 6 | 双轨版本被强制回退（正文声明 v2.5.0 被 frontmatter v1.0.0 拉低为 v1.0.1） | 等于抹掉人工在正文维护的真实变更历史 → 读者 & AI 都被误导为「文档长期未更新」 | Phase 2 铁律：高版本永远是目标；若发现低版本→高版本，一律 PATCH 合并而非回退 |
| 7 | change_log 首条/最新条目的 version/date 与 frontmatter.version/last_updated 不一致 | 下次 P1 优先级取 change_log 最新条目为真值 → 与 frontmatter 三字段再次发生 A 类漂移 → 反复触发校对 | Phase 4 末尾强校验：`change_log[0].version === frontmatter.version && change_log[0].date === frontmatter.last_updated` 必须为 true |
| 8 | 三门禁未全绿即宣称完成（G1/G2/G3 任一 FAIL 继续下一批） | 把 frontmatter 格式错误、断链、过期版本带入后续批次 → 错误累积翻倍，且很难定位是哪一批引入 | Phase 6 末尾：三门禁 exit code = 0 才能提交；如果 FAIL 则在修复前不得拆子批或开启下一批 |

---

## 五、完成交付物清单

**必要且充分条件**：Phase 1-6 完整执行（含 6 步法顺序）、单批≤250 文件、G1/G2/G3 三门禁全绿（0 exit）、每份文档三字段与 change_log 最新条目一致、版本号永无回退、A/B/C 三类漂移清单全部清零（或 P2 waive 有记录）。

- [x] 1. `outputs/doc-version-drift-report-YYYY-MM-DD.md` — Phase 1 漂移检测分档报告
- [x] 2. 本批文件「目标版本 / last_updated / change_log」真值判定表 — Phase 2 产物
- [x] 3. frontmatter 三字段写入 diff（version / last_updated / code_version）— Phase 3
- [x] 4. change_log 闭环写入 diff（基准校对+初始化条目）— Phase 4
- [x] 5. `outputs/doc-freshness-batch-N-before.txt` — Phase 5 前 Git 状态快照
- [x] 6. `outputs/doc-freshness-batch-N-YYYY-MM-DD.md` — Phase 5 批次变更报告
- [x] 7. G1 `audit:docs` 全绿报告 — Phase 6 G1
- [x] 8. G2 `audit-doc-freshness.ts` 分级报告（P0/P1 0 FAIL，P2 waive 有签字）— Phase 6 G2
- [x] 9. G3 `audit:doc-integrity` 断链完整性 0 FAIL 报告 — Phase 6 G3
- [x] 10. 三位 SemVer 补齐清单（v1.2 → v1.2.0 的所有文件列表）
- [x] 11. 版本号无回退证明（change_log 版本单调上升检查表）
- [x] 12. P2 waive 清单（若有）：签字 + 理由 + 修复计划日期
- [x] 13. Git 提交 — 信息含 `doc-freshness-gov batch-N PASS`
- [x] 14. 下一批待办清单（如 Batch 1→2→3 拆分尚未完成）

---

## 六、附录

### 附录 1 · 增量更新决策树（基准日后永久生效，保留原资产）

基准校对完成后，任何后续代码/文档变更，按以下决策树决定 version：
- 颠覆性重写 → MAJOR++
- 新增章节 / 重写 ≥20% → MINOR++
- 错别字 / 格式 / 校对 / 兼容性说明 → PATCH++
- 每次变更同步：last_updated=当天日期 + change_log 追加一条（version+changes+date 三字段闭环）

### 附录 2 · 代码变更 → 文档触发矩阵（同频更新铁律，保留原资产）

以下代码路径一旦命中 git diff，必须检查对应文档并追加 change_log（哪怕内容无需修改，也追加"代码侧变更确认兼容"条目并 PATCH++）：

- `src/core/databridge*.ts` + `dbConfig.ts` → data-interaction-protocols.md / dual-strategy-dataflow-spec.md
- `src/services/data-collector/**` + `sevenDimConfigStore.ts` → collection-contract.md / data-collector-contract.md
- `src/store/*` schema 变更 + `ENVELOPE_ACTION` 新增 → backtest-contract.md / export-contract.md / 对应 ADR
- `src/components/widgets/**` 新增 Widget → widget-development-guide.md + widget-registry.json
- `scripts/audit/*.ts` 新增门禁 → quality-gates.md + 本 Skill gates 表
- `.agents/skills/*/SKILL.md` 新增/修改 + `skill-registry.json` → AGENTS.md 技能索引 + `.trae/skills/INDEX.md`
- AGENTS.md 本体修改 → 本 Skill triggers/gates 表 + 引用 AGENTS 版本的所有 SKILL
