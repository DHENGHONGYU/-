---
title: 文档生命周期与四大交叉索引综合解决方案
type: meta
domain: project
phase: planning
tier: important
status: draft
maintainer: current developer
summary: "基于 799 份文档全量统计，设计文档间/测试/代码/SKILL 四大交叉索引子系统，含实施步骤、资源、时间、风险"
tags: [project, documentation, meta, governance, cross-index, lifecycle]
version: v1.0.0
last_updated: 2026-07-19
code_version: 2.0.0
doc_id: V9-DOC-PROJ-CROSSINDEX-001
change_log:
  - version: v1.0.0
changes: Initial draft based on full inventory (674 active + 125 archived = 799 docs)
date: 2026-07-19
---

# 文档生命周期与四大交叉索引综合解决方案

> **状态**：待审批 | **日期**：2026-07-19 | **作者**：current developer
> **审批条件**：用户书面确认后，按阶段 1-6 顺序组织实施

---

## 一、现状盘点（基于 2026-07-19 实测数据）

### 1.1 全量文档统计

| 维度 | 数量 | 备注 |
|---|---|---|
| 活跃文档 | 674 | 排除 archive/ 和 deprecated-docs/ |
| 归档文档 | 125 | docs/archive/ 下 |
| **总计** | **799** | 接近用户所述"约 700" |
| 含 frontmatter | 670 / 674 | 覆盖率 99.4% |

### 1.2 status 字段分布（关键发现）

| status | 数量 | 占比 |
|---|---|---|
| active | 633 | 94.0% |
| draft | 25 | 3.7% |
| deprecated | 9 | 1.3% |
| archived | 1 | 0.1% |

**🔴 重大异常**：archive/ 目录下有 125 个文档，但全库只有 1 个文档标记为 `status: archived`。这意味着 124 个归档文档的 status 字段未更新——**状态机与目录位置完全脱钩**。

### 1.3 type 字段分布（Diátaxis 分类已落地）

| type | 数量 | 占比 |
|---|---|---|
| reference | 244 | 36% |
| explanation | 214 | 32% |
| reports | 119 | 18% |
| meta | 75 | 11% |
| how-to | 14 | 2% |
| tutorials | 2 | 0.3% |

**🟡 冲突点**：实际使用 **Diátaxis 分类体系**（tutorial/how-to/reference/explanation + reports + meta），但 [GOVERNANCE.md](../00-meta/GOVERNANCE.md) 宣称 A-H 八类——宪法与现实脱节。

### 1.4 tier 字段分布

| tier | 数量 | 占比 |
|---|---|---|
| standard | 395 | 59% |
| important | 173 | 26% |
| reference | 82 | 12% |
| quick-note | 10 | 1.5% |
| core | 1 | 0.1% |

### 1.5 domain 字段分布

| domain | 数量 | 占比 |
|---|---|---|
| project | 290 | 43% |
| qa | 114 | 17% |
| data | 72 | 11% |
| frontend | 55 | 8% |
| architecture | 47 | 7% |
| backend | 45 | 7% |
| ai | 33 | 5% |
| product | 11 | 1.6% |
| development | 1 | 0.1% |

### 1.6 现有索引机制清单（6 套并存）

| 索引 | 位置 | 字段 | 覆盖 | 问题 |
|---|---|---|---|---|
| _redirect-map.json | docs/ | old_path, new_path, diataxi_category, status | 部分 | 字段 status 与 frontmatter status 语义不同 |
| doc-id-registry.md | 00-meta/ | doc_id, domain, title, path | 部分 | 大量文档无 doc_id |
| registry-index.md | 4 处副本 | doc_id, title | 部分 | 4 副本不同步 |
| doc-manifest.csv | 00-meta/ | doc_id, title, path, status | 部分 | 与 doc-id-registry 重复 |
| document-inventory.csv | 00-meta/ | 编号,功能,位置,分类,归档日期 | 部分 | 与 doc-manifest 重复 |
| ai-index/*.json | 00-meta/ai-index/ | ai-memory, category, code-graph | 部分 | 三份独立 JSON |

### 1.7 SKILL 体系现状（三套并存）

| 位置 | 数量 | 示例 |
|---|---|---|
| .trae/skills/ | 2 | v9-gatekeeper, architecture-debt-remediation |
| .workbuddy/skills/ | 4 | collection-pipeline-testing, mock-data-diagnosis, data-flow-integrity-audit, devops-automation |
| plugins/*/SKILL.md | 8 | ifind, imf, kimi-webbridge, scholar, sec_edgar, tianyancha, yahoo_finance, yuandian_law |
| **总计** | **14** | 三套体系无统一索引 |

---

## 二、当前架构 vs 拟实施架构 — 逐项匹配与归因分析

### 2.1 架构差异点矩阵

| 维度 | 当前架构（GOVERNANCE 宣称） | 磁盘现实 | 拟实施架构（v2.0） | 差异/冲突 |
|---|---|---|---|---|
| 目录分类 | A-H 八类 | 数字+字母混合 23 个一级目录 | Diátaxis + 数字前缀 | 🔴 三套并存 |
| 文档状态机 | 四阶段（draft/active/deprecated/archived） | 仅 4 个状态值在用 | 五阶段（+ purged） | 🟡 缺终态 |
| 索引体系 | 单一 registry-index.md | 6 套并存 | 统一 master-index.json | 🔴 真相源破裂 |
| SKILL 体系 | .trae/skills/ 单一 | 三套并存 | 统一到 .trae/skills/ | 🟡 体系分裂 |
| 归档机制 | archive/ 目录 + status 字段 | 125 文档在 archive/，仅 1 个 status: archived | 状态机驱动 + 目录强对应 | 🔴 完全失效 |
| 文档-代码关联 | 契约文档手动维护 | 100+ 文档引用 src/，无反向 | 双向 @doc + covers_code | 🟡 单向 |
| 文档-测试关联 | 测试目录文档存在 | 无 frontmatter 关联 | covers_docs + covered_by_tests | 🔴 完全缺失 |
| 文档-SKILL 关联 | 无 | 无 | covers_docs + covered_by_skills | 🔴 完全缺失 |

### 2.2 深度归因分析

**根因 1：宪法（GOVERNANCE.md）从未与磁盘真相对齐**
- 表现：A-H 八类是设计意图，从未落地；Diátaxis 是实际使用，但未被宪法承认
- 影响：所有依赖 GOVERNANCE 的脚本/Agent 行为偏差
- 根因：缺乏"宪法-现实一致性"校验机制

**根因 2：状态机字段不驱动行为**
- 表现：status 字段存在但不强制目录位置
- 影响：archive/ 下 124 文档状态未更新
- 根因：缺少 status↔目录位置的强校验脚本

**根因 3：索引体系演进而非替换**
- 表现：6 套索引先后建立，旧的不删
- 影响：真相源破裂，维护成本指数增长
- 根因：缺乏"索引生命周期管理"

**根因 4：交叉索引从未设计**
- 表现：文档↔代码、文档↔测试、文档↔SKILL 均无双向关联
- 影响：变更影响无法追踪，孤儿文档滋生
- 根因：把索引视为"目录"而非"关系图"

**根因 5：SKILL 体系多源化**
- 表现：.trae/skills/、.workbuddy/skills/、plugins/ 三套并存
- 影响：AI 调用 SKILL 时不知道用哪套
- 根因：SKILL 提炼机制未统一

---

## 三、四大交叉索引子系统设计

### 子系统 1：文档间标准化索引关系体系

#### 1.1 主键设计

沿用 `doc_id: V9-DOC-{DOMAIN}-{NNN}` 编号规则（已存在于 [doc-id-registry.md](doc-id-registry.md)），补全至全量 670 个活跃文档。

#### 1.2 五层索引结构

```
L0 主键索引（单一真相源）
  └─ doc_id ↔ path ↔ title ↔ status
     位置: docs/00-meta/ai-index/master-index.json

L1 目录索引（路径反查）
  └─ path → [doc_id]
     位置: docs/00-meta/ai-index/directory-index.json

L2 类型索引（Diátaxis 分类）
  └─ type → [doc_id]
     位置: docs/00-meta/ai-index/type-index.json

L3 标签索引（基于 tag-taxonomy.md）
  └─ tag → [doc_id]
     位置: docs/00-meta/ai-index/tag-index.json

L4 关系索引（双向链接）
  └─ doc_id → {related_docs: [...], referenced_by: [...]}
     位置: docs/00-meta/ai-index/relation-index.json
```

#### 1.3 双向链接机制

每个文档 frontmatter 新增字段：
```yaml
related_docs:
  - V9-DOC-DATA-016
  - V9-DOC-ARCH-002
referenced_by: []  # 自动生成，禁止手动编辑
```

#### 1.4 孤儿文档检测

- 无 `referenced_by` + 30 天未修改 → 自动转 `status: deprecated`
- 90 天后仍无引用 → 自动转 `status: archived` 并移入 archive/

#### 1.5 索引规则

| 规则 | 描述 |
|---|---|
| 单一真相源 | master-index.json 是唯一权威索引 |
| 派生索引只读 | L1-L4 由 master-index 派生，禁止手动编辑 |
| 版本号 | master-index.json 含 `version: v1.0`，schema 变更时升级 |
| CI 校验 | 每次 PR 必须运行 `npm run sync:doc-index` |

---

### 子系统 2：文档-脚本测试双向交叉索引

#### 2.1 测试用例 frontmatter（新增）

在 `e2e/*.spec.ts`、`tests/**/*.test.ts` 文件头部新增 JSDoc：
```ts
/**
 * @test_id V9-TEST-E2E-001
 * @covers_docs V9-DOC-QA-001, V9-DOC-QA-002
 * @module analysis
 */
```

#### 2.2 文档 frontmatter（新增）

```yaml
covered_by_tests:
  - e2e/analysis-scoring.spec.ts
  - tests/unit/scoring.test.ts
test_coverage: partial  # full / partial / none
```

#### 2.3 双向校验脚本

新增 `scripts/sync/sync-doc-test.ts`：
- **正向扫描**：解析所有测试文件的 `@covers_docs` 标签
- **反向扫描**：解析所有文档的 `covered_by_tests` 字段
- **一致性校验**：A.covers_docs 包含 B ⇔ B.covered_by_tests 包含 A
- **覆盖率报告**：生成 `docs/reports/audit/doc-test-coverage-{date}.md`

#### 2.4 覆盖率仪表盘

```markdown
## 文档测试覆盖率报告（2026-07-19）

| 维度 | 总数 | 有测试覆盖 | 覆盖率 |
|---|---|---|---|
| 全库 | 670 | 0 | 0.0% |
| important tier | 173 | 0 | 0.0% |
| qa domain | 114 | 0 | 0.0% |
```

#### 2.5 优先级策略

按 tier 优先级补全测试覆盖：
1. important tier（173 个）→ 必须 100% 覆盖
2. reference tier（82 个）→ 必须 50% 覆盖
3. standard tier（395 个）→ 推荐 30% 覆盖
4. quick-note tier（10 个）→ 不强制

---

### 子系统 3：文档-代码动态交叉索引

#### 3.1 代码 JSDoc 标签（新增）

在 `src/**/*.ts`、`src/**/*.tsx` 文件的 JSDoc 中新增：
```ts
/**
 * @doc V9-DOC-DATA-016 数据定义文档
 * @module data-layer
 * @since 2.0.0
 */
```

#### 3.2 文档 frontmatter（新增）

```yaml
covers_code:
  - path: src/data/db-schema.ts
    lines: [10-50]
    symbol: IndexedDBSchema
    relation: implements
  - path: src/data/dataLayer.ts
    symbol: dataLayer
    relation: references
```

#### 3.3 自动扫描脚本

新增 `scripts/sync/sync-doc-code.ts`：
- 扫描 src/ 下所有 `@doc` 标签 → 构建代码→文档映射
- 扫描 docs/ 下所有 `covers_code` 字段 → 构建文档→代码映射
- 双向一致性校验
- 输出 `docs/reports/audit/doc-code-sync-{date}.md`

#### 3.4 PR 影响检测（扩展 doc-auto-updater）

```
PR 合并
  ↓
1. git diff 提取变更文件（src/**/*.ts）
  ↓
2. 查 covers_code 索引 → 找出受影响文档
  ↓
3. 生成 Companion PR / Slack 通知文档 owner
  ↓
4. owner 在 7 天内更新文档或标记 stale
```

#### 3.5 CI 强制规则

- 新增/修改 src/ 文件必须含 `@doc` 标签（eslint 规则）
- 新增文档必须含 `covers_code` 字段（frontmatter 校验）

---

### 子系统 4：文档-SKILL 关联索引

#### 4.1 SKILL frontmatter（新增）

在所有 SKILL.md 文件 frontmatter 新增：
```yaml
skill_id: V9-SKILL-GATEKEEPER
covers_docs:
  - V9-DOC-ARCH-001
  - V9-DOC-QA-001
triggers:
  - "code change"
  - "new feature"
version: v1.0.0
last_updated: 2026-07-19
```

#### 4.2 文档 frontmatter（新增）

```yaml
covered_by_skills:
  - v9-gatekeeper
  - architecture-debt-remediation
```

#### 4.3 SKILL 索引文件

新建 `.trae/skills/INDEX.md`：
```markdown
# V9 SKILL 索引

| skill_id | 名称 | 位置 | covers_docs | 触发条件 | 版本 |
|---|---|---|---|---|---|
| V9-SKILL-GATEKEEPER | v9-gatekeeper | .trae/skills/v9-gatekeeper/ | 5 | code change | v1.0.0 |
| V9-SKILL-ARCH-DEBT | architecture-debt-remediation | .trae/skills/architecture-debt-remediation/ | 8 | audit warning | v1.1.0 |
| V9-SKILL-COLLECTION | collection-pipeline-testing | .workbuddy/skills/ | 3 | collection test | v0.1.0 |
| ... | ... | ... | ... | ... | ... |
```

#### 4.4 SKILL 体系合并

将三套 SKILL 体系统一到 `.trae/skills/`：
- `.workbuddy/skills/*` → 迁移到 `.trae/skills/`（保留软链接兼容）
- `plugins/*/SKILL.md` → 保留原位置，但在 `.trae/skills/INDEX.md` 中登记

#### 4.5 SKILL 提炼机制

- 当某个工作流被重复执行 3+ 次时，TRAE Agent 自动提示提炼为 SKILL
- SKILL 必须引用至少 1 个文档（`covers_docs` 非空）
- 季度审视：SKILL 与文档的双向覆盖度

---

## 四、master-index.json 统一索引文件设计

### 4.1 文件位置

`docs/00-meta/ai-index/master-index.json`

### 4.2 Schema

```json
{
  "version": "v1.0",
  "generated_at": "2026-07-19T00:00:00Z",
  "schema_version": "v1",
  "stats": {
    "total_documents": 670,
    "total_archived": 125,
    "frontmatter_coverage": 0.994,
    "doc_id_coverage": 0.0
  },
  "documents": {
    "V9-DOC-AI-001": {
      "path": "00-meta/prompt-execute-remediation.md",
      "title": "Prompt Execute Remediation",
      "type": "meta",
      "domain": "ai",
      "tier": "reference",
      "status": "active",
      "tags": ["ai", "prompt", "remediation"],
      "maintainer": "current developer",
      "last_updated": "2026-07-17",
      "related_docs": ["V9-DOC-AI-002"],
      "referenced_by": [],
      "covered_by_tests": [],
      "covers_code": [],
      "covered_by_skills": [],
      "next_review_date": "2026-10-17"
    }
  },
  "orphans": [],
  "stale_docs": []
}
```

### 4.3 派生索引

由 master-index.json 自动派生：
- `directory-index.json`：path → [doc_id]
- `type-index.json`：type → [doc_id]
- `tag-index.json`：tag → [doc_id]
- `relation-index.json`：doc_id → {related_docs, referenced_by}
- `test-coverage-index.json`：doc_id → [test_paths]
- `code-coverage-index.json`：doc_id → [code_paths]
- `skill-coverage-index.json`：doc_id → [skill_names]

---

## 五、实施步骤

### 阶段 1：基线建设（P0，2 周）

| 步骤 | 任务 | 产出 | 验收 |
|---|---|---|---|
| 1.1 | 修复 GOVERNANCE.md 与现实对齐 | 重写后的 GOVERNANCE.md | doc:gate 通过 |
| 1.2 | 补全 doc_id 至全量 670 个 | 更新的 doc-id-registry.md | doc_id 覆盖率 100% |
| 1.3 | 修复 archive/ 下 125 文档的 status 字段 | 批量更新脚本 | archived 文档数 = 125 |
| 1.4 | 创建 master-index.json 主索引 | master-index.json v1.0 | JSON schema 校验通过 |
| 1.5 | 合并 6 套旧索引为 master-index 派生 | 旧索引标记 deprecated | 旧索引不再使用 |

### 阶段 2：文档间索引（P0，2 周）

| 步骤 | 任务 | 产出 | 验收 |
|---|---|---|---|
| 2.1 | 在 frontmatter 新增 related_docs 字段 | 批量更新脚本 | related_docs 字段覆盖率 ≥ 30% |
| 2.2 | 开发 sync-doc-relations.ts 脚本 | 脚本 + npm 命令 | npm run sync:doc-relations 可运行 |
| 2.3 | 运行反向链接扫描 | relation-index.json | referenced_by 自动填充 |
| 2.4 | 识别并处理孤儿文档 | 孤儿清单 + 处理决策 | 孤儿数 < 50 |

### 阶段 3：测试-文档交叉索引（P1，2 周）

| 步骤 | 任务 | 产出 | 验收 |
|---|---|---|---|
| 3.1 | 在测试文件新增 @covers_docs JSDoc | 测试文件批量更新 | 80% 测试含 @covers_docs |
| 3.2 | 在文档新增 covered_by_tests 字段 | 文档批量更新 | important tier 100% 覆盖 |
| 3.3 | 开发 sync-doc-test.ts | 脚本 + npm 命令 | 双向校验通过 |
| 3.4 | 生成首份覆盖率报告 | doc-test-coverage-{date}.md | 覆盖率仪表盘可见 |

### 阶段 4：代码-文档动态索引（P1，3 周）

| 步骤 | 任务 | 产出 | 验收 |
|---|---|---|---|
| 4.1 | 在代码新增 @doc JSDoc 标签 | src/ 批量更新 | 80% src 文件含 @doc |
| 4.2 | 在文档新增 covers_code 字段 | 文档批量更新 | reference tier 100% 覆盖 |
| 4.3 | 开发 sync-doc-code.ts | 脚本 + npm 命令 | 双向校验通过 |
| 4.4 | 扩展 doc-auto-updater 的 PR 影响检测 | 升级后的 doc-auto-updater | PR 合并触发文档通知 |

### 阶段 5：SKILL-文档关联索引（P2，1 周）

| 步骤 | 任务 | 产出 | 验收 |
|---|---|---|---|
| 5.1 | 在 SKILL 文件新增 covers_docs frontmatter | 14 个 SKILL 更新 | 100% SKILL 含 covers_docs |
| 5.2 | 在文档新增 covered_by_skills 字段 | 文档批量更新 | important tier 100% 覆盖 |
| 5.3 | 创建 .trae/skills/INDEX.md | SKILL 索引文件 | 14 个 SKILL 全部登记 |
| 5.4 | 合并 .workbuddy/skills/ 到 .trae/skills/ | 迁移完成 | 三套体系统一 |

### 阶段 6：审计与运维（P3，持续）

| 步骤 | 任务 | 频率 | 产出 |
|---|---|---|---|
| 6.1 | 月度文档健康度仪表盘 | 每月 | docs/reports/audit/doc-health-{month}.md |
| 6.2 | 季度架构雷达扫描 | 每季 | architecture-radar-scan 报告 |
| 6.3 | 年度架构债务清查 | 每年 | 架构债务登记册更新 |
| 6.4 | SKILL 季度审视 | 每季 | SKILL 覆盖度报告 |

---

## 六、资源需求

| 资源 | 数量 | 用途 |
|---|---|---|
| 主导开发 | 1 人（@self） | 全程主导 |
| TRAE AI 辅助 | 全程 | 批量 frontmatter 补全、索引生成、脚本开发 |
| 现有 audit/sync 基础设施 | 复用 | 30+ audit:* 命令、husky、CI |
| TRAE Work worktree | 用于阶段 1-2 隔离实验 | 防止破坏主分支 |
| TRAE Hooks | 用于文件保存时校验 | 替代部分 husky 职责 |

**无需新增人力**，无需新增外部工具依赖。

---

## 七、时间节点

| 阶段 | 起止 | 周数 | 累计 |
|---|---|---|---|
| 阶段 1 基线建设 | 第 1-2 周 | 2 | 2 |
| 阶段 2 文档间索引 | 第 3-4 周 | 2 | 4 |
| 阶段 3 测试-文档索引 | 第 5-6 周 | 2 | 6 |
| 阶段 4 代码-文档索引 | 第 7-9 周 | 3 | 9 |
| 阶段 5 SKILL-文档索引 | 第 10 周 | 1 | 10 |
| 阶段 6 审计运维 | 第 11 周起 | 持续 | - |

**总工期**：10 周完成核心建设，第 11 周起进入持续运维。

---

## 八、风险评估与应对措施

| 风险 | 概率 | 影响 | 应对措施 |
|---|---|---|---|
| frontmatter 批量修改破坏现有文档 | 中 | 高 | 用 TRAE Work worktree 隔离实验；每批 ≤ 50 文档；先备份 |
| master-index.json 版本冲突 | 中 | 中 | 加 version 字段；CI 强制校验；禁止手动编辑派生索引 |
| SKILL 体系合并冲突 | 低 | 中 | 保留 .workbuddy/skills/ 软链接；分批迁移 |
| 测试 covers_docs 字段维护成本高 | 高 | 中 | 优先覆盖 important tier；CI 强制新增测试必填 |
| 代码 @doc 标签遗漏 | 高 | 低 | ESLint 规则强制；新增 src/ 文件必填 |
| doc_id 补全工作量过大 | 高 | 中 | TRAE AI 批量生成 + 人工抽样校验 |
| 孤儿文档处理决策困难 | 中 | 中 | 30 天宽限期；owner 确认后归档 |
| 索引脚本性能瓶颈 | 低 | 低 | 增量更新；缓存机制；夜间全量重建 |

---

## 九、可调用 TRAE 技能整合

| 阶段 | 主调用技能 | 辅助技能 |
|---|---|---|
| 1 基线建设 | docs-as-mirror | v9-gatekeeper |
| 2 文档间索引 | — | consulting-analysis |
| 3 测试-文档索引 | test-driven-development | — |
| 4 代码-文档索引 | type-safety-contract | — |
| 5 SKILL-文档索引 | skill-creator | — |
| 6 审计运维 | architecture-debt-remediation | architecture-radar-scan |

---

## 十、验收标准

| 维度 | 验收指标 |
|---|---|
| doc_id 覆盖率 | 670/670 = 100% |
| status↔目录一致性 | archive/ 下文档 100% status: archived |
| master-index.json | 单一真相源，旧索引全部 deprecated |
| related_docs 覆盖率 | ≥ 30% |
| 孤儿文档数 | < 50 |
| 测试覆盖文档率 | important tier 100% |
| 代码 @doc 覆盖率 | src/ 文件 80% |
| SKILL covers_docs 覆盖率 | 14/14 = 100% |
| 月度仪表盘 | 自动生成 |
| CI 强制校验 | sync:doc-* 全部通过 |

---

## 十一、审批

| 项目 | 状态 |
|---|---|
| 方案作者 | current developer |
| 创建日期 | 2026-07-19 |
| 审批人 | ____________（待签） |
| 审批日期 | ____________ |
| 审批意见 | ____________ |

> **审批通过后**，按阶段 1 → 6 顺序组织实施。每阶段完成后向审批人汇报，获确认后进入下一阶段。

---

## 附录 A：相关文档

- [GOVERNANCE.md](GOVERNANCE.md) — 项目治理宪法（待修复）
- [document-archive-management.md](document-archive-management.md) — 文档归档管理（待修复）
- [doc-id-registry.md](doc-id-registry.md) — doc_id 编号注册表
- [tag-taxonomy.md](tag-taxonomy.md) — 标签分类体系
- [metadata-governance-phased-plan.md](metadata-governance-phased-plan.md) — 元数据治理阶段计划
- [_redirect-map.json](../_redirect-map.json) — 重定向映射表
- [AGENTS.md](../../AGENTS.md) — 项目级 AI 行为约束契约

## 附录 B：现有索引文件清单

| 文件 | 状态 | 处置 |
|---|---|---|
| docs/_redirect-map.json | 保留 | 字段语义对齐 |
| docs/00-meta/doc-id-registry.md | 保留 | 补全至 670 个 |
| docs/00-meta/registry-index.md | deprecated | 由 master-index 替代 |
| docs/registry-index.md | deprecated | 删除（重定向 stub） |
| docs/reference/registry-index.md | deprecated | 删除（重定向 stub） |
| docs/00-meta/doc-manifest.csv | deprecated | 由 master-index 替代 |
| docs/00-meta/document-inventory.csv | deprecated | 由 master-index 替代 |
| docs/00-meta/ai-index/*.json | 保留 | 由 master-index 派生 |
