---
name: "doc-freshness-governance"
description: "以基准日为锚点，统一校对文档双轨版本、last_updated 与 change_log 闭环；并在后续增量变更中保持同频更新。Invoke when user asks to calibrate document versions, fix version drift, refresh last_updated fields, or align frontmatter change_log with actual changes."
title: 文档新鲜度治理（Doc Freshness Governance）
skill_id: V9-SKILL-DOC-FRESHNESS
type: governance
domain: project
phase: maintenance
status: active
maintainer: current developer
summary: "以基准日为锚点，统一校对文档双轨版本、last_updated 与 change_log 闭环；并在后续增量变更中保持同频更新。"
tags: [governance, documentation, versioning, freshness, audit]
version: v1.0.1
last_updated: 2026-08-11
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
  - version: v1.0.1
    changes: "frontmatter 标准化：补齐 name/description 字段（对齐 skill-registry.json 元数据）；description 同步覆盖 registry 占位值；version PATCH++"
    date: 2026-08-11
  - version: v0.9.0-draft
    changes: "草稿版：基准校对 6 步法 + 增量决策树 + 双版本职责分离 + 三门禁验证 + 代码变更-文档触发矩阵"
    date: 2026-08-11
  - version: v1.0.0
    changes: "定稿版：R1-R6全部确认（用户2026-08-11确认）；R2改为基准校对触发PATCH++；批次重新切分（Batch1=全A类+P0B/C，Batch2=仅非P0B类，Batch3=仅非P0C类）"
    date: 2026-08-11
---

# 文档新鲜度治理（Doc Freshness Governance）— v1.0.1

> **版本**: v1.0.1 | **日期**: 2026-08-11 | **校验基准**: V9 AGENTS.md v1.5.5 + doc-management-principles SKILL v1.0.0
> **适用性质**: mandatory（命中触发条件时，交付前必跑 gates 未全绿不得声明完成）
> **输出格式**: 版本漂移检测报告 → 人工确认的分批清单 → 校对后审计报告 + 变更日志条目
> **基准日（Baseline Day）**: 2026-08-11 — 此后所有版本字段、日期、change_log 均以该次全仓校对为起点

---

## 一、为什么需要本 SKILL

V9 项目存在三类版本漂移反复出现，直接影响文档可信度与 AI 门禁判断：

| 漂移类型 | 真实案例（基准日前 P0 扫描） | 后果 |
|---------|--------------------------|------|
| **A 类：双轨不一致** | `docs/README.md` frontmatter `v1.0.0` vs 正文 `**Version** v2.5.0` | AI 读取 frontmatter 取到"假旧版"，触发错误的兼容逻辑 |
| **B 类：last_updated 缺失/失真** | 80 份 T0/important 文档中 19 份缺失 last_updated | 审查者误判文档"长期未维护"，或新鲜度仪表盘持续假红灯 |
| **C 类：change_log 无闭环** | `AGENTS.md` 正文变更日志已到 v1.5.5，但 frontmatter 无 change_log 字段 | 变更可追溯性为零；未来审计无法回答"哪个版本改了什么" |

本 SKILL 解决问题分为两阶段：
1. **基准校对阶段（一次性）**：以 2026-08-11 为基准日，全仓消除 A/B/C 三类历史债务
2. **增量维护阶段（永久性）**：任何代码/文档变更后，按增量决策树保持文档同频更新

---

## 二、核心概念与双版本职责分离

### 2.1 Frontmatter 标准的三个版本字段

所有 `.md` 文档的 frontmatter 必须同时具备以下三个字段（与 `doc-management-principles` 保持一致），**各自职责不得混用**：

```yaml
---
version: v1.5.5                  # 文档自身的语义版本（MAJOR.MINOR.PATCH，见 §四决策树）
code_version: "2.0.0-rc.1"       # 绑定的代码版本（由 audit-version-drift.ts 统一校验与 package.json 一致）
last_updated: 2026-08-11         # 本次校对/变更的实际日期（ISO 8601，YYYY-MM-DD）
change_log:                      # 变更条目闭环（最新一条必须与 version + last_updated 完全一致）
  - version: v1.5.5
    changes: "基准日校对(2026-08-11)：对齐双轨版本 / 补全 change_log / 新鲜度刷新"
    date: 2026-08-11
---
```

### 2.2 版本字段优先级（A 类冲突时取真值顺序）

当 A 类双轨不一致出现时，**真值来源按以下优先级**（高→低），校对脚本会把低优先级的一方改为高优先级的值：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| P1（最高） | frontmatter.change_log 最新条目 | 有明确 change_log 时，它是最权威的变更历史 |
| P2 | 正文 `**版本**:` / `**Version**:` 行 | 人工在正文维护的变更声明（读者直接可见） |
| P3 | 正文标题行的 `— vX.Y.Z` 后缀 | 标题版本（读者可见，次于正文显式声明） |
| P4（最低） | frontmatter.version 裸值 | 当以上三处都不存在时才以此为准 |

> 注意：若正文声明版本低于 frontmatter.version，一律以**高版本**为目标值，并在 change_log 补一条 "基准日校对合并版本" 条目。绝不允许出现"回退版本号"。

### 2.3 SemVer 语义版本规则（适用于 `version` 字段）

| 版本位 | 触发条件 | 示例 |
|--------|---------|------|
| **MAJOR（第一位）** | 颠覆性重写、结构/字段迁移、旧读者完全看不懂 | `v1.5.5 → v2.0.0` |
| **MINOR（第二位）** | 新增章节、重写 ≥20% 内容、字段 schema 扩展 | `v1.5.5 → v1.6.0` |
| **PATCH（第三位）** | 错别字、格式、补充一句说明、change_log 追加、校对类改动 | `v1.5.5 → v1.5.6` |

**铁律（R2 用户确认：基准校对必须触发 PATCH++）**：基准日校对属于 PATCH 级，所有受影响文档的 version 处理方式为：
- 若已有 P1-P4 的真值版本 → 先对齐 frontmatter.version = 真值版本，**然后 PATCH 位 +1**（例如真值 `v2.5.0` → 对齐后再 `v2.5.1`）
- 若真值版本与 frontmatter 不一致 → frontmatter 改为真值后，**PATCH 位仍 +1**
- 若原版本号不符合 MAJOR.MINOR.PATCH 三位（如 `v1.2`、`v4.8`） → 先补零为三位（`v1.2.0`、`v4.8.0`）再 PATCH++

---

## 三、基准校对 6 步法（P0/P1/P2 全阶段统一流程）

本阶段目标：**以 2026-08-11 为锚点，一次性清零 A/B/C 三类历史债务**。
任何批次必须严格按以下 6 步顺序执行，禁止跳步、禁止跳过 DryRun。

```
Step 1 扫描       Step 2 取真值      Step 3 改元数据    Step 4 补 change_log
   │                 │                  │                  │
   ▼                 ▼                  ▼                  ▼
 detect-doc-       按 §2.2 优先级      写 version +       追加基准校对
 version-drift.cjs 选择目标值          last_updated       条目（固定格式）
                                                    │
                      Step 6 验证 ◄────────────────┘
                          │
                          ▼
                    audit:docs +
                    audit-doc-freshness
                    audit:doc-integrity
                          │
                          ▼
                    Step 5 备份
                    （快照 + 报告）
```

### Step 1：扫描（必须先做）

执行检测器生成问题报告，作为本批次输入清单：

```powershell
node scripts/temp/detect-doc-version-drift.cjs
# 输出：outputs/doc-version-drift-report-YYYY-MM-DD.md
```

- **产物**：按 P0/P1/P2 分档的问题清单 + 去重后的 3 批文件集合
- **禁止**：在未阅读报告并确认清单前，批量写入任何文件

### Step 2：取真值（A 类冲突解决）

对清单中每份文档，读取 frontmatter + 正文，按 §2.2 优先级确定 `目标版本号`：

| 场景 | 目标 version | 目标 last_updated |
|------|-------------|------------------|
| 同时有 change_log + 正文声明 | change_log 最新条目的 version | 若 change_log 最新日期合法则取它；否则基准日 |
| 仅正文声明 | 正文版本 | 基准日 2026-08-11 |
| 仅 frontmatter.version | frontmatter（因为无更高优先级） | 基准日 2026-08-11 |
| 完全没有版本信息 | 新建 `v1.0.0` | 基准日 2026-08-11 |

### Step 3：改元数据（写 frontmatter 三个核心字段）

对每份文档写入：

```yaml
version: <Step2确定的目标版本>
last_updated: 2026-08-11
code_version: "2.0.0-rc.1"  # 若缺失则补，若已有则由 audit-version-drift 校验
```

### Step 4：补 change_log 闭环

- **已有 change_log 字段**：在最前面追加一条基准条目（保证最新一条与 Step3.version/Step3.last_updated 一致）
- **无 change_log 字段**：新建 change_log 数组，**首条**为"初始化版本"（version 取当前目标 version，date 取该文档历史上能找到的最早修改日期或 last_updated），**次条**为基准校对条目

固定条目格式（本次基准校对专用，复制粘贴即可）：

```yaml
change_log:
  # ... 原有条目（如有）...
  - version: <Step2目标版本>
    changes: "基准日校对(2026-08-11)：对齐 frontmatter.version 与正文声明 / 补全 last_updated / 新增 change_log 闭环"
    date: 2026-08-11
```

### Step 5：备份 + 批次报告

在写入任何文件前先做快照：
```powershell
# 备份清单（非内容，Windows 环境下禁止 cp -r 全仓）
git status --short > outputs/batch-N-before-snapshot.txt
```

完成写入后生成批次变更报告 `outputs/doc-freshness-batch-N-2026-08-11.md`，包含：
- 本批次文件列表
- 每份文件的变更类型（A/B/C 组合）
- A 类冲突的真值判定依据
- 下一待办批次

### Step 6：三门禁验证（交付前必须 100% 全绿）

| 门禁 | 命令 | 失败时处理 |
|------|------|-----------|
| G1: audit:docs | `npm run audit:docs` | 修复所有失败项；若 code_version 漂移先对齐 package.json |
| G2: audit-doc-freshness | `npx tsx scripts/audit/audit-doc-freshness.ts`（本 SKILL §六交付脚本） | P0/P1 必须修复；P2 可在报告中说明并 waive |
| G3: audit:doc-integrity | `npm run audit:doc-integrity` | 若因 frontmatter 格式调整引入断链，立即修复路径 |

> **批次安全规则**：
> - 单批文件 ≤ 250（参考 doc-management-principles §八安全过程）
> - 每批独立执行 Step 1-6，不得与下一批混合
> - 若本批出现任一 G1/G2/G3 失败，在修复前不得开启下一批

---

## 四、增量更新决策树（基准日后永久生效）

基准校对完成后，**任何后续代码/文档变更**必须按本决策树决定文档版本号。

```
开始 ── 文档内容是否实际变更？
           │
           ├─ 否（仅代码改，文档未改）
           │    └─ 文档 version 不变；若代码改的是文档关联模块（见 §五矩阵），
           │       仍需打开文档追加"兼容性说明" change_log 条目 PATCH++
           │
           └─ 是（文档内容已改）
                ├─ 颠覆性重写？ ──────► MAJOR++（v1.5.5 → v2.0.0）
                │
                ├─ 新增章节 / 重写≥20%？ ──► MINOR++（v1.5.5 → v1.6.0）
                │
                └─ 错别字 / 格式 / 补充一句 / 校对类 ──► PATCH++（v1.5.5 → v1.5.6）

每次变更同步写入：
  last_updated = 当天日期（YYYY-MM-DD）
  change_log 追加：
    - version: <新版本号>
      changes: <一句话说明变更>
      date: <当天日期>
```

### 4.1 内容变更 vs 元数据变更的 PATCH 规则

| 场景 | 是否 PATCH++ |
|------|-------------|
| 修改正文段落、表格、代码块、标题结构 | **是** |
| 修改 frontmatter 中的 title/summary/tags/related_docs | **是**（元数据也是文档的一部分） |
| 仅因本 SKILL 的基准校对对齐三个字段（未改内容） | **是（R2 强制）**：基准校对作为一次有记录的变更，必须 PATCH++ |
| 修复正文错别字 1-2 处 | **是**（最小 PATCH） |
| 修复 A 类双轨不一致（改 version 值本身） | **是**：双轨对齐是明确的元数据修复，需 PATCH++（与 R2 保持一致） |

---

## 五、代码变更 → 文档触发矩阵（同频更新铁律）

为解决"代码先行文档滞后"的老问题，以下代码路径一旦命中 git diff，**必须**检查对应文档并按 §四决策树追加 change_log（若文档内容无需修改，则 change_log 写 "代码侧变更确认兼容" 即可）：

| 代码变更类型 | 必须同步检查的文档 | SKILL 交叉验证 |
|------------|-------------------|---------------|
| `src/core/databridge*.ts`、`src/config/dbConfig.ts` | `docs/reference/data-interaction-protocols.md`、`docs/reference/dual-strategy-dataflow-spec.md` | `v9-data-flow-integrity-audit` |
| `src/services/data-collector/**`、`src/store/sevenDimConfigStore.ts` | `docs/reference/collection-contract.md`、`docs/reference/data-collector-contract.md` | `v9-collection-pipeline-testing` |
| `src/store/*` 新增/修改 schema、`ENVELOPE_ACTION` 新增 | `docs/reference/backtest-contract.md`、`docs/reference/export-contract.md`、对应 ADR | `v9-module-sync-checklist` §三 |
| `src/components/widgets/**` 新增 Widget | `docs/guides/widget-development-guide.md` + `widget-registry.json` | `component-health-check` |
| `src/services/chipStrategy/**`、`breakout-trading-strategy*.ts` 阈值变更 | `docs/explanation/strategy/breakout-trading-strategy.md`、`docs/reports/testing/*strategy*` | `v9-mock-data-diagnosis` §二 |
| `scripts/audit/*.ts` 新增门禁脚本 | `docs/guides/standards/quality-gates.md` + 本 SKILL 的 gates 表 | `v9-code-quality-audit` §四 |
| `.agents/skills/*/SKILL.md` 新增/修改、`skill-registry.json` | `AGENTS.md` §项目级 SKILL 索引、`.trae/skills/INDEX.md` | `audit:skill-coverage`（必须全绿） |
| `AGENTS.md` 本体修改（版本变更、规则新增） | 本 SKILL 的 gates/triggers 表、所有引用 AGENTS 版本的 SKILL.md | `doc-management-principles` §三环闭环 |

---

## 六、交付物清单（本 SKILL 落地时必须具备）

### 6.1 脚本

| 脚本 | 路径 | 用途 | 状态 |
|------|------|------|------|
| 版本漂移检测器 | `scripts/temp/detect-doc-version-drift.cjs` | P0 全仓扫描，生成分批报告 | ✅ 已交付 |
| 新鲜度审计器（新） | `scripts/audit/audit-doc-freshness.ts` | 增量门禁：检查 A/B/C 三类违规并分级；挂入 `audit:docs` | ⚠️ 待写 |
| 批量校对执行器（新） | `scripts/fix/apply-doc-freshness-batch.ts` | 接受 DryRun 文件清单 + 批次号，执行 §三 Step2-4 写入（支持 `--dry-run` 只打印不写） | ⚠️ 待写 |

### 6.2 周期任务（L5 调度层）

在 `.github/workflows/` 追加：

```yaml
name: doc-freshness-monthly
on:
  schedule:
    - cron: '30 7 1 * *'   # 每月 1 号 07:30 UTC = 15:30 Asia/Shanghai
  workflow_dispatch:
jobs:
  check:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx tsx scripts/audit/audit-doc-freshness.ts
      - run: npm run audit:doc-integrity
      - uses: actions/upload-artifact@v4
        with:
          name: doc-freshness-report
          path: outputs/doc-freshness-monthly-*.md
```

并与现有周检/月检并列记入 AGENTS.md §L5 调度层。

---

## 七、异常情况处理

| 情况 | 处理方式 |
|------|---------|
| change_log 中存在"历史版本跳跃"（v1.0.0 → v1.2.0，缺 v1.1.0） | 基准校对不回溯修复历史；只追加基准条目，在 changes 字段备注"历史跳跃保留" |
| 正文声明版本格式不规范（如 `v1.2`、`v2.1.0-prerelease`、`v4.8`） | 按原样保留；不强制补零或剥离预发布后缀 |
| 文档同时有中文 `**版本**` 和英文 `**Version**` 两行且不一致 | 以中文行为准（项目主语言为中文）；并在 change_log 条目备注"已对齐中英声明" |
| 文档在 `deliverables/` / `outputs/` 但有 frontmatter | 同样纳入校对；报告文档的 `code_version` 可跳过（以代码 package 为准） |
| 文档完全无 frontmatter 且在 `docs/` 体系内 | 先补齐 frontmatter 模板（参考 doc-management-principles §二），再做 Step2-4 |
| 一份文档同时命中 A+B+C 三类 | 一次性处理：先 A（取真值改 version）→ 再 B（last_updated=基准日）→ 最后 C（追加 change_log） |

---

## 八、gates 执行指南（交付前必跑）

命中触发条件后，**三个 gates 按顺序执行，全部 EXIT 0 方可声明"完成"**：

```powershell
# G1：项目级文档-代码同步 + code_version 漂移
npm run audit:docs

# G2：本 SKILL 专用 A/B/C 三类新鲜度检查（若有 P0/P1 则 FAIL）
npx tsx scripts/audit/audit-doc-freshness.ts

# G3：断链/交叉引用（若本批改动了文档标题/路径则必须跑）
npm run audit:doc-integrity

# (可选) 若改动涉及 AGENTS / SKILL 索引，追加：
npm run audit:skill-coverage
```

**豁免（Waive）规则**：
- P2 级 C 类问题可人工标注 Waive，但必须在批次报告中列出理由（例如"归档文档不再维护 change_log"）
- P0/P1 **无豁免**；必须修复到 G2 通过

---

## 九、快速命令参考

```powershell
# [基准校对 P0] 全仓扫描生成分批报告
node scripts/temp/detect-doc-version-drift.cjs

# [基准校对 P1 批次 N] DryRun 预览变更（不写盘）
npx tsx scripts/fix/apply-doc-freshness-batch.ts --batch 1 --dry-run

# [基准校对 P1 批次 N] 实际写入
npx tsx scripts/fix/apply-doc-freshness-batch.ts --batch 1

# [增量维护] 任何文档变更后快速自检
npx tsx scripts/audit/audit-doc-freshness.ts --staged

# [全量验证] 交付前三门禁
npm run audit:docs
npx tsx scripts/audit/audit-doc-freshness.ts
npm run audit:doc-integrity
```

---

## 十、确认事项定稿记录（2026-08-11 用户 6 项全部确认）

- [x] **R1 真值优先级**：P1(change_log 最新条目) → P2(正文 `**版本**:` 行) → P3(标题 `— vX.Y.Z` 后缀) → P4(frontmatter.version 裸值)。✅ 按此执行
- [x] **R2 基准日 PATCH 规则**：**（用户调整）必须触发 PATCH++**；即便仅对齐元数据，也视为一次有记录的变更；三位不足时先补零再 PATCH++。✅ 按此执行
- [x] **R3 批次切分（用户调整）**：Batch1 = **全部 A 类 + P0 级 B/C**（预计 ≤ 120 文件）；Batch2 = **仅非 P0 的 B 类**（last_updated 问题，非 T0/important 文档）；Batch3 = **仅非 P0 的 C 类**（change_log 闭环）。✅ 按新三档执行，每批 ≤ 250
- [x] **R4 无 frontmatter 文档**：仅 `docs/` 体系内缺失的需补齐；`deliverables/`、`outputs/`、`backend/deploy/releases/` 下的临时/交付报告可忽略。✅ 不在基准校对强制范围内
- [x] **R5 mandatory 范围**：关键词命中 + `docs/**`/`AGENTS.md`/`.trae/skills/*`/`.agents/skills/**/*.md` 文件命中即 **mandatory**。✅ 保持严格
- [x] **R6 月度周期任务**：cron `30 7 1 * *` = 每月 1 号 15:30 北京时间。✅ 频率合适

---

## 变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v0.9.0-draft | 2026-08-11 | 草稿：基准校对 6 步法 + 增量决策树 + 双版本职责分离 + 三门禁验证 + 代码-文档触发矩阵 + 异常处理 + 6 条待确认事项 |
| v1.0.0 | 2026-08-11 | 定稿：R1/R4/R5/R6按草稿；R2改为基准校对强制PATCH++（含非三位版本先补零）；R3批次重切为Batch1全A+P0BC / Batch2仅非P0B / Batch3仅非P0C；6项用户确认闭环 |
