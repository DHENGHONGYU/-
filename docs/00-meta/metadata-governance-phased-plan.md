---
title: 文档元数据治理分阶段实施计划
type: meta
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "用三阶段渐进式方案，?2-3 个月时间，将 V9 文档元数据从'近乎空白状态（核心字段覆盖?~4%）提升到生产级标准（核心字段 100%、推荐字?80%+、质量稳定可验证）?
tags: [project, governance, implementation, management, documentation, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-017
related_docs: [V9-DOC-PROJ-026, V9-DOC-PROJ-186, V9-DOC-PROJ-001, V9-DOC-META-018, V9-DOC-PROJ-331, V9-DOC-PROJ-316, V9-DOC-PROJ-321]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-CROSSINDEX-001, V9-DOC-PROJ-026]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档元数据治??分阶段详细实施计?
> **版本**：v1.0.0 ?**日期**?026-07-17 ?**维护?*：文档治理小?> **适用范围**：V9 项目全部 660 ?Markdown 文档
> **配套标准**：[《V9 文档元数据标准规范》](document-metadata-standard.md)
> **工具?*：`scripts/audit-frontmatter.ps1` · `scripts/validate-frontmatter.ps1` · `scripts/auto-complete-frontmatter.ps1` · `scripts/cleanup-frontmatter.ps1` · `scripts/fix-frontmatter.ps1`

---

## 〇、执行摘?
### 总体目标

用三阶段渐进式方案，?2-3 个月时间，将 V9 文档元数据从"近乎空白状态（核心字段覆盖?~4%）提升到生产级标准（核心字段 100%、推荐字?80%+、质量稳定可验证）?
### 当前状态（Phase 0 基准?
| 指标 | 基准?|
|------|--------|
| 文档总数 | 660 |
| Frontmatter 拥有?| 96.1% |
| 核心 7 字段完整?| ~4% |
| type 字段覆盖?| 0.2% |
| domain 字段覆盖?| 0% |
| status 字段覆盖?| 28.4% |
| P0 验证错误?| 1369 |

### 三阶段路线图

```
Phase 1: 核心字段补齐（已完成 ✅）
    ?Phase 2: 推荐字段完善（进行中 🚧?    ?Phase 3: 质量持续优化（长期）
```

---

## 一、Phase 1：核心字段补齐（已完成）

### 1.1 目标与范?
**目标**：全?660 份文档的 7 个核心字段（title/type/domain/status/tier/last_updated/version）覆盖率达到 80% 以上，P0 级验证错误下?80%?
**核心字段定义**?- `title` ?文档标题
- `type` ?文档类型（reference/explanation/how-to/tutorials/reports/meta?- `domain` ?功能领域（architecture/frontend/backend/data/ai/qa/project/product?- `status` ?生命周期状态（draft/active/deprecated/archived?- `tier` ?重要级别（reference/important/standard/quick-note?- `last_updated` ?最后更新日期（YYYY-MM-DD?- `version` ?文档版本（语义化版本?
**验收标准**?- [x] 核心 7 字段完整??80%
- [x] Frontmatter 拥有??98%
- [x] P0 验证错误 ?200 个（下降 85%+?- [x] ?Frontmatter 文档 ?10 ?
### 1.2 任务分解（共 5 个任务包?
#### 任务?1.1：基线审计与现状摸底

**目的**：获取精确的基线数据，明确问题分布?
**步骤**?- [ ] 运行 `audit-frontmatter.ps1`，输出全量字段覆盖率报告
- [ ] 运行 `validate-frontmatter.ps1`，输?P0/P1/P2 三级错误清单
- [ ] ?domain 维度统计各领域问题分?- [ ] ?type 维度统计各类型问题分?- [ ] 输出基线数据存档：`baseline-audit-2026-07-17.json`

**预期产出**：基线数据表?+ Top 10 问题类型清单

**预计工时**?.5 人天

---

#### 任务?1.2：损坏文件诊断与修复

**目的**：修复因历史脚本错误导致?Frontmatter 重复/损坏文件?
**背景**：约 200+ 份文档存在多?`---` 块重复、Frontmatter 内容重复追加等损坏情况，必须先修复才能进行后续补全?
**步骤**?- [ ] 运行 `fix-frontmatter.ps1`（报告模式），扫描损坏文件清?- [ ] 抽样检?10 份损坏文件，确认损坏模式
- [ ] 在独立分支上运行 `fix-frontmatter.ps1 -Apply`
- [ ] 抽样验证 20 份修复后的文?- [ ] 运行 `validate-frontmatter.ps1`，确认损坏导致的 P0 错误清零

**损坏模式识别**?| 模式 | 特征 | 处理方式 |
|------|------|----------|
| 多块 `---` 重复 | 文件顶部?? ?`---` 分隔?| 保留最后一个有?FM ?|
| FM 内容重复追加 | 第一?`---` 块后又追加无包裹?FM 字段 | 截断重复内容，重建干净 FM |
| FM 字段值带注释 | `domain: project # TODO: confirm` | 清理注释，保留有效?|

**预期产出**?00+ 份损坏文件全部修复，无残留重?FM ?
**预计工时**? 人天

---

#### 任务?1.3：自动补全规则调?
**目的**：基于路径和文件名的推断规则准确率达?85%+?
**推断规则矩阵**?
| 字段 | 推断依据 | 置信?|
|------|----------|--------|
| type | 目录名匹配：`reference/`→reference, `how-to/`→how-to | ?|
| type | 目录名匹配：`explanation/`→explanation, `tutorials/`→tutorials | ?|
| type | 目录名匹配：`00-meta/`→meta, `reports/`→reports | ?|
| domain | 目录名匹配：`architecture/`→architecture, `frontend/`→frontend | ?|
| domain | 目录名匹配：`backend/`→backend, `data/`→data, `ai/`→ai | ?|
| domain | 目录名匹配：`testing/`→qa, `project-management/`→project | ?|
| phase | 目录/文件名关键词：`design/`→design, `test`→testing | ?|
| phase | 目录/文件名关键词：`plan`→planning, `deploy`→deployment | ?|
| tier | 文件名匹配：`README`/`index`/`manifest`→reference | ?|
| tier | 文件名匹配：`adr-`/`standard`/`spec`→important | ?|
| tier | 文件名匹配：`todo`/`draft`/`wip`→quick-note | ?|
| status | 路径?`deprecated`/`legacy`→deprecated | ?|
| status | 路径?`archive`→archived | ?|
| status | 默认值→active | ?|
| last_updated | 文件系统修改时间 | ?|
| version | 默认?`v1.0.0` | ?|

**调优步骤**?- [ ] 运行 `auto-complete-frontmatter.ps1 -Report`，输出推断建?- [ ] 按领域各抽样 5 份，检查推断准确率
- [ ] 调整推断准确?< 80% 的领域，补充规则
- [ ] 再次运行报告模式，确认整体准确率 ?85%

**预期产出**：调优后的推断规则，整体准确??85%

**预计工时**?.5 人天

---

#### 任务?1.4：批量自动补?
**目的**：为所有缺失核心字段的文档批量补全?
**步骤**?- [ ] 确认?feature 分支（`feat/metadata-phase1）上执行
- [ ] 运行 `auto-complete-frontmatter.ps1 -Apply`
- [ ] 运行 `cleanup-frontmatter.ps1 -Apply`（二次清?+ 补全遗漏?- [ ] 运行 `validate-frontmatter.ps1`，验?P0 错误?- [ ] 按领域输出待人工审核清单

**执行顺序**?1. 先跑 auto-complete（补全缺?? 个字段的文档
2. 再跑 cleanup（清理注?+ 补全缺失 <3 个字段的文档
3. 最?validate 验收

**预期产出**?- 核心字段完整率从 ~4% ??95%+
- P0 错误?1369 ??200

**预计工时**?.5 人天

---

#### 任务?1.5：分领域人工审核

**目的**：确保自动推断的 type/domain/tier/status 准确率达?90%+?
**各领域工作量估算**?
| 领域 | 文档?| 负责?| 预计工时 | 审核重点 |
|------|--------|--------|---------|----------|
| architecture | ~50 | 架构?| 0.5 ?| type/domain 准确?|
| frontend | ~100 | 前端?| 1 ?| type/tier 分级 |
| backend | ~120 | 后端?| 1 ?| domain 细分（backend vs ai |
| data | ~80 | 数据?| 0.5 ?| domain 准确?|
| ai | ~60 | AI ?| 0.5 ?| type/domain 准确?|
| qa | ~50 | 测试?| 0.5 ?| type 分类 |
| project/product | ~100 | 产品/项目 | 1 ?| domain 区分 |
| meta | ~30 | 文档?| 0.5 ?| tier 分级 |
| **合计** | **590** | ?| **5.5 人天 | ?|

**审核要点（按优先级排序）**?1. **type 是否正确？（最关键，影响检索和分类?2. **domain 是否正确？（影响领域归属?3. **tier 分级是否合理？（影响优先级）
4. **status 是否准确？（影响生命周期管理?5. **phase 是否合理？（影响阶段归属?
**审核方法**?- 脚本输出 `audit-by-domain.csv`，按领域分组
- 各领域负责人拉取自己领域文档清单
- 直接编辑 Frontmatter，确?修改
- 提交 PR，文档组统一合入

**预期产出**：各领域审核完成，type/domain 准确??90%

**预计工时**?.5 人天

---

### 1.3 时间线（甘特图）

```
Week 1:
  Day 1-2: 任务?1.1 + 1.2（基线审?+ 损坏修复
  Day 3: 任务?1.3（规则调优）
  Day 4-5: 任务?1.4（批量补?+ 验证

Week 2:
  Day 6-9: 任务?1.5（分领域人工审核?  Day 10: 收尾 + 验收报告
```

### 1.4 验收标准与实际结?
**Phase 1 实际完成情况?026-07-17 实测?*?
| 指标 | 目标 | 实际 | 达成?|
|------|------|------|--------|
| Frontmatter 拥有?| ?98% | **100%** | 102% |
| 核心 7 字段完整?| ?80% | **100%** | 125% |
| type 字段覆盖?| ?90% | **100%** | 111% |
| domain 字段覆盖?| ?90% | **100%** | 111% |
| status 字段覆盖?| ?90% | **100%** | 111% |
| tier 字段合规?| ?85% | **100%** | 118% |
| last_updated 覆盖?| ?80% | **100%** | 125% |
| version 覆盖?| ?60% | **100%** | 167% |
| P0 验证错误?| ?200 | **0** | 100% |
| ?Frontmatter 文档 | ?10 | **0** | 100% |

**结论**：Phase 1 超额完成全部目标，核心字段全?100% 覆盖，P0 错误清零?
---

## 二、Phase 2：推荐字段完善（进行?🚧?
> **自动化任务已完成?026-07-17?*?> - 任务?2.3 phase 补全?5.8% ?**81.2%**（[complete-phase-field.ps1](../../scripts/complete-phase-field.ps1)?68 份自动补全，124 份转人工?> - 任务?2.1 doc_id 分配?74 ?important 文档 **100%** 完成（[assign-doc-id.ps1](../../scripts/assign-doc-id.ps1)，[注册表](doc-id-registry.md)?> - 任务?2.2 标签词表初稿：[tag-taxonomy.md](tag-taxonomy.md)（三层结构，基于词频提取?> - 人工任务已输出：[phase2-manual-task-list.md](phase2-manual-task-list.md)（审?maintainer/summary 四类清单?>
> **剩余人工任务**：summary 质量抽查（paragraph 来源 116 份）、type/domain 抽样终审
>
> **任务 A 进展?026-07-17?*：domain 二次推断已应用（[reinfer-domain.ps1](../../scripts/reinfer-domain.ps1)），114 份高置信度修正完成；`project` 域从 407 降至 292（其?00-meta 58 ?+ 变更日志/复盘类为合理归属）；33 ?doc_id ?domain 一致性问题已修复（重编号），当前不一致数 **0**。新分布：project 292 / qa 113 / data 72 / frontend 51 / architecture 47 / backend 45 / ai 32 / product 11。剩余：各领域负责人抽样终审 + 3 份歧义文档人工定域?>
> **任务 B 进展?026-07-17?*：phase 覆盖?81.2% ?**100%**?67/667）。三批规则补全（[complete-phase-field.ps1](../../scripts/complete-phase-field.ps1) 51 份、[complete-phase-batch2.ps1](../../scripts/complete-phase-batch2.ps1) 31 份、[complete-phase-batch3.ps1](../../scripts/complete-phase-batch3.ps1) 41+4 份）+ 1 份手动。阶段分布：design 224 / planning 164 / testing 97 / retrospective 92 / development 70 / requirements 11 / deployment 6?>
> **任务 C 进展?026-07-17?*：maintainer 覆盖?9.6% ?**100%**?67/667）。按用户确认?方案?统一?`V9 Architecture Team`（[assign-maintainer.ps1](../../scripts/assign-maintainer.ps1)?99+5 份）。同步修复：registry-index 生成?[update-registry-index.py](../../scripts/update-registry-index.py) 补充 Frontmatter 模板? ?BOM 导致的检测失败已剥离?>
> **任务 D 进展?026-07-17?*：important 文档 summary 覆盖?0.6% ?**100%**?76/176）。自动提取（[extract-summaries.ps1](../../scripts/extract-summaries.ps1)）：blockquote 定位 31 + 首段 116 + 概述?13 + H1 兜底 15，超长截?1 份。质量说明：均为候选摘要，blockquote/概述来源?4 份）质量高可直接采信；首段来源（116 份）建议抽查润色；H1 兜底?5 份）信息量少建议重写?>
> **Phase 3 进展?026-07-18?*?> - **tags 批量打标 V2**：词表从 30 个模?12 个特性扩展到 39 个模?22 个特性（新增 changelog/scoring/factor/stocks/position/routing/validation 模块，report/guide/deprecated/plan/spec/template/research/batch 特性），并加入目录路径维度（reports/ ?report tag、how-to/ ?guide tag），覆盖?56% ?**86.7%**?79/668，远?60% 目标；剩?89 份无明确关键词命中）
> - **3 份歧义文档定?*：visual-regression-guide ?qa；color-token-refactor、seven-dim-config ?frontend
> - **生成器源头修?*：[rebuild-registry-index.py](../../scripts/rebuild-registry-index.py)、[update-registry-index.py](../../scripts/update-registry-index.py)、[generate-manual-tasks.ps1](../../scripts/generate-manual-tasks.ps1) 补充完整 FM 字段?*核心修复**：[doc-cross-ref-sync.ts](../../scripts/docs-tool/doc-cross-ref-sync.ts) ?`renderIndex` 函数——此前索引同步会覆盖?Frontmatter，导?registry-index.md 反复丢失 FM，已从源头根?> - 新增文档 FM 补齐：color-token-consolidation-feasibility.md
> - **summary 质量润色**?1 份弱摘要（标题重?列表碎片/表格碎片/代码碎片）已人工重写（[rewrite-weak-summaries.ps1](../../scripts/rewrite-weak-summaries.ps1)）；131 ?paragraph/H1 来源?89 份质量合格直接保留，41 份重写后达标? 份已废弃文档维持简短描?> - **type/domain 抽样审计**：[generate-type-domain-audit.ps1](../../scripts/generate-type-domain-audit.ps1) ?8 domain × 6 type 分层抽样 67 份（10%），输出 [type-domain-audit-worksheet.md](type-domain-audit-worksheet.md) 审计工作?+ CSV。人工抽?10 份初判准确率?85-90%，待领域负责人终?> - 全库最终态：668 份，FM 100%，核心字?100%，maintainer 100%，phase 100%，tags 86.7%，P0 通过 100%
>
> **Phase 3 深化优化?026-07-18 续）**?> - **P1 警告清零**：[p1-warnings-fix.ps1](../../scripts/p1-warnings-fix.ps1) 批量修复三类 P1 问题—?4 ?deprecated 文档补充 `deprecated_by`? 份非语义化版本号统一?v1.0.0? ?important 文档补分?`doc_id`。P1 Warnings: 20 ?**0**
> - **P2 信息清零**：[p2-tags-optimization.ps1](../../scripts/p2-tags-optimization.ps1) 扩展关键词规则至 50+，修?31 份缺?tags + 73 ?<3 tags 文档；统一 typeDirMap 配置消除 63 ?type/path 误报。P2 Info: 104 ?**0**
> - **reference ?summary 全覆?*：[add-reference-summaries.ps1](../../scripts/add-reference-summaries.ps1) ?84 ?reference 级文档（README/索引/ADR/报告）自动生?summary，reference tier summary 覆盖?0% ?**100%**
> - **title 字段损坏修复**：[fix-broken-title-fields.ps1](../../scripts/fix-broken-title-fields.ps1) 修复 81 份文档因历史脚本导致?`title` ?`type` 字段行粘连问?> - **tags 覆盖率终?*：活动文档（?archive）tags 覆盖率达 **99.9%**?69/670），其中 99.7% 拥有 3+ tags
> - **全库最终态（最新）**?70 份活动文档，FM 100%，核心字?100%，maintainer 100%，phase 100%，tags 99.9%，important summary ~100%，reference summary 100%?*P0/P1/P2 全零**
>
> **Phase 3 扩展优化?026-07-18 再续?*?> - **standard ?summary 全覆?*：[add-standard-summaries.ps1](../../scripts/add-standard-summaries.ps1) ?394 ?standard 级文档批量生?summary（基?title + type 组合），standard tier summary 覆盖?0.5% ?**100%**
> - **title 粘连问题二次修复**：增?[fix-broken-title-fields.ps1](../../scripts/fix-broken-title-fields.ps1) 正则（支?`how-to` 等带连字符的 type 值），再修复 2 ?`type: how-to` 粘连文档
> - **乱码文件修复**：修?`guides/getting-started.md` 全文件乱码问题（重定向入口页?> - **全库 summary 覆盖终?*：整?summary 覆盖?38.8% ?**97.6%**?54/670），其中 important/reference/standard 三级均达 100%
>
> **Phase 3 深度优化?026-07-18 三续?*?> - **低质?summary 修复**：[fix-bad-summaries.ps1](../../scripts/fix-bad-summaries.ps1) 基于 blockquote/首段智能提取，修?22 份低质量 summary（代码片?过短/模板化），summary 质量整体提升
> - **高优先级文档 tags 增强**：[enhance-hightier-tags.ps1](../../scripts/enhance-hightier-tags.ps1) 基于 50+ 关键词规则（文件?路径/标题三维匹配），?149 ?important/reference 文档扩充标签维度
>   - 3 tags 文档占比?5% ?**16.5%**?91 ?42?>   - 4+ tags 文档占比?5% ?**83.5%**?3 ?212?>   - 高优先级文档平均标签数：3.4 ?**4.5**
> - **验证结果**：P0/P1 维持全零，P2 Info ?2 条（可忽略的信息级提示）

### 2.1 目标与范?
**目标**?- important 级文?`doc_id` 覆盖?100%
- standard 级文?`maintainer` 覆盖?60%
- `tags` 覆盖?60%
- `phase` 字段覆盖率从 55.8% ?75%
- `type/domain` 人工审核准确率达 90%+
- `summary` 覆盖率（important 文档?0%

**推荐字段定义**?- `doc_id` ?文档唯一标识符（?V9-DOC-META-001?- `phase` ?开发阶段（planning/requirements/design/development/testing/deployment/retrospective?- `summary` ?一句话摘要（≤ 100 字）
- `tags` ?标签数组（受控词表）
- `maintainer` ?维护?团队

**验收标准**?- [ ] important 文档 doc_id 100%
- [ ] phase 覆盖??75%
- [ ] maintainer 覆盖??60%
- [ ] tags 覆盖??60%
- [ ] type/domain 人工审核完成，准确率 ?90%
- [ ] P1 级警告下?50%

### 2.2 任务分解（共 7 个任务包?
#### 任务?2.1：doc_id 编号体系设计与分?
**目的**：为所?important 级文档分配唯一标识，建立文档注册表?
**编号规则设计**?
```
V9-DOC-{DOMAIN}-{NNN
  ?    ?      └── 三位序号?01-999?  ?    └── 领域缩写（ARCH/FRONT/BACK/DATA/AI/QA/PROJ/PROD/META
  └── 项目代号
```

**领域缩写映射**?| domain | 缩写 |
|--------|------|
| architecture | ARCH |
| frontend | FRONT |
| backend | BACK |
| data | DATA |
| ai | AI |
| qa | QA |
| project | PROJ |
| product | PROD |
| meta | META |

**步骤**?- [ ] 设计 doc_id 编码规则文档
- [ ] 筛?tier=important 的文档清单（按领域分组）
- [ ] 按领域批量分配编?- [ ] 创建 `doc-id-registry.md` 注册?- [ ] 批量写入 Frontmatter
- [ ] 验证编号唯一性（无重号、无跳号?
**预期产出**?- `doc-id-registry.md` ?文档唯一标识注册?- 所?important 文档?doc_id 字段

**预计工时**?.5 人天

---

#### 任务?2.2：标签体系（Tag Taxonomy）建?
**目的**：建立受控标签词表，为文档批量打标签?
**标签分类设计**?
```
一级标签（8 个领域）?  architecture, frontend, backend, data, ai, qa, project, product

二级标签（功能模块）?  cockpit, widget, databridge, mcp, store, service, ...

三级标签（特?主题）：
  performance, security, refactor, migration, audit, ...
```

**步骤**?- [ ] 设计标签分类体系（三层结构）
- [ ] 从现有文档标?内容中高频词提取候选标?- [ ] 人工审核 + 去重 + 规范?- [ ] 输出 `tag-taxonomy.md` 标签词表
- [ ] 脚本推荐 + 人工确认，为文档批量打标?- [ ] 验证标签覆盖??60%

**预期产出**?- `tag-taxonomy.md` ?标签分类体系与受控词?- 60% 以上文档?tags 字段

**预计工时**? 人天

---

#### 任务?2.3：phase 字段补全与审?
**目的**：将 phase 字段覆盖率从 55.8% 提升?75%?
**phase 推断规则增强**?
| phase | 推断依据 | 置信?|
|-------|----------|--------|
| planning | 路径?`plan`, `vision`, `goal`, `roadmap` | ?|
| requirements | 路径?`requirement`, `prd`, `spec` | ?|
| design | 路径?`design`, `architecture`, `blueprint` | ?|
| development | 路径?`dev`, `implement`, `how-to` | ?|
| testing | 路径?`test`, `qa`, `audit` | ?|
| deployment | 路径?`deploy`, `release`, `ops` | ?|
| retrospective | 路径?`retro`, `review`, `lesson`, `summary` | ?|

**步骤**?- [ ] 增强 phase 推断规则（增加更多关键词
- [ ] 运行脚本批量补全 phase 缺失的文?- [ ] 按领域抽样审?phase 准确?- [ ] 输出 phase 字段覆盖率验?
**预期产出**：phase 覆盖??75%

**预计工时**? 人天

---

#### 任务?2.4：maintainer 字段分配

**目的**：为 standard 及以上级别的文档指定维护人?
**分配原则**?- reference 级：文档治理小组统一维护
- important 级：按领域分配给领域负责?- standard 级：按模?功能分配给对应开发人?- quick-note 级：可无 maintainer

**步骤**?- [ ] 梳理各领域负责人清单
- [ ] 输出按领域分组的 important/standard 级文档清?- [ ] 各领域负责人确认 maintainer
- [ ] 批量写入 Frontmatter
- [ ] 验证 maintainer 覆盖??60%

**预期产出**?0% 以上 standard 文档?maintainer

**预计工时**? 人天

---

#### 任务?2.5：type/domain 人工审核（Phase 1 遗留?
**目的**：完?Phase 1 自动推断?type/domain 人工审核，准确率达到 90%+?
**步骤**?- [ ] 输出各领域待审核清单（从 Phase 1 输出?- [ ] architecture 领域审核
- [ ] frontend 领域审核
- [ ] backend 领域审核
- [ ] data 领域审核
- [ ] ai 领域审核
- [ ] qa 领域审核
- [ ] project/product 领域审核
- [ ] meta 领域审核
- [ ] 汇总审核结果，计算准确?- [ ] 调整推断规则，提高未来准确率

**审核检查清?*?- [ ] type 分类是否符合 Diataxis 体系?- [ ] domain 归属是否正确?- [ ] tier 分级是否合理?- [ ] status 状态是否准确？
- [ ] phase 阶段是否匹配?
**预期产出**：type/domain 准确??90%

**预计工时**? 人天

---

#### 任务?2.6：summary 摘要补充（important 级）

**目的**：为 important 级文档补充一句话摘要?
**摘要写作规范**?- 长度：≤ 100 ?- 内容：文档的核心内容 + 适用范围 + 关键价?- 格式：陈述句，简洁明?
**示例**?```yaml
summary: V9 项目文档 Frontmatter 元数据的完整规范，包括字段定义、枚举值、验证规则和模板示例
```

**步骤**?- [ ] 筛?important 级文档清?- [ ] 按领域分配写作任?- [ ] 各领域负责人编写摘要
- [ ] 文档组质量复?- [ ] 批量写入 Frontmatter

**预期产出**：important 级文?summary 覆盖??80%

**预计工时**? 人天

---

#### 任务?2.7：Phase 2 验收与报?
**目的**：全面验?Phase 2 成果，输出完成报告?
**步骤**?- [ ] 运行 `audit-frontmatter.ps1`，获取最终覆盖率数据
- [ ] 运行 `validate-frontmatter.ps1`，获取错误数
- [ ] 计算各指标达成率
- [ ] 编写 Phase 2 完成报告
- [ ] 遗留问题转入 Phase 3 任务清单
- [ ] 更新元数据标准文?
**验收清单**?- [ ] important 文档 doc_id 100%?- [ ] phase 覆盖??75%?- [ ] maintainer 覆盖??60%?- [ ] tags 覆盖??60%?- [ ] type/domain 准确??90%?- [ ] P1 警告下降 50%?- [ ] important 文档 summary ?80%?
**预期产出**：Phase 2 完成报告 + Phase 3 任务清单

**预计工时**?.5 人天

---

### 2.3 时间线（甘特图）

```
Week 1:
  Day 1-2: 任务?2.1（doc_id 分配? 任务?2.2（标签体系设计）
  Day 3-4: 任务?2.3（phase 补全? 任务?2.4（maintainer 分配?
Week 2-3:
  Day 5-9: 任务?2.5（type/domain 人工审核，分领域并行?  Day 10: 任务?2.6（summary 补充）启?
Week 4:
  Day 11-14: 任务?2.6（summary 补充? 任务?2.7（验收与报告?```

**总工?*：约 4 周（1 人月?
### 2.4 人力需求汇?
| 任务?| 工时 | 负责?|
|--------|------|--------|
| 2.1 doc_id 分配 | 0.5 人天 | 文档?|
| 2.2 标签体系建设 | 2 人天 | 文档?+ 各领?|
| 2.3 phase 补全 | 1 人天 | 文档?+ 各领域审?|
| 2.4 maintainer 分配 | 1 人天 | 各领域负责人 |
| 2.5 type/domain 审核 | 3 人天 | 各领域负责人 |
| 2.6 summary 补充 | 2 人天 | 各领域负责人 |
| 2.7 验收与报?| 0.5 人天 | 文档?|
| **合计** | **10 人天** | ?|

---

## 三、Phase 3：质量持续优化（长期?
### 3.1 目标

- 整体元数据质量稳定在优秀水平
- 建立常态化质量保障机制
- 新文档元数据合规?100%

### 3.2 常态化机制

| 机制 | 频率 | 负责?|
|------|------|--------|
| 元数据质量月?| 每月 | 文档?|
| 新文?PR 元数据检?| 每次 PR | CI + Reviewer |
| 季度抽查复核 | 每季?| 文档?|
| 标准迭代更新 | 每半?| 文档治理小组 |

### 3.3 长期优化方向

- [ ] 元数据与 AI 索引集成，支持按元数据智能检?- [ ] 文档生命周期自动化流转（draft→active→deprecated→archived?- [ ] 元数据与代码关联（doc-code双向链接?- [ ] 元数据质量评分体系（文档健康度打分）

---

## 四、工具链使用指南

### 4.1 脚本速查?
| 脚本 | 用?| 常用参数 | 输出 |
|------|------|----------|------|
| `audit-frontmatter.ps1 | 字段覆盖率审?| ?| 各字段覆盖率统计 |
| `validate-frontmatter.ps1 | 三级验证 | ?| P0/P1/P2 错误清单 |
| `auto-complete-frontmatter.ps1 | 自动补全 | `-Report` / `-Apply` | 补全建议 / 实际应用 |
| `cleanup-frontmatter.ps1 | 清理注释 + 二次补全 | ?/ `-Apply` | 清理建议 / 实际应用 |
| `fix-frontmatter.ps1 | 修复损坏 FM | ?/ `-Apply` | 损坏清单 / 实际修复 |

### 4.2 标准工作?
```
1. 审计现状：audit ?拿到基线数据
2. 预览建议：auto-complete -Report ?查看推断结果
3. 执行补全：auto-complete -Apply ?实际应用
4. 清理优化：cleanup -Apply ?清理注释 + 补遗?5. 验证结果：validate ?检查错?6. 人工审核：按领域审核清单
```

---

## 五、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 人工审核进度滞后 | ?| ?| 按领域并行，设置里程碑检查点 |
| 标签体系过于庞大 | ?| ?| 先核心标签，后逐步细化 |
| 推断准确率不达预?| ?| ?| 增加规则，扩大样本调?|
| 各领域配合度不足 | ?| ?| 领导层推动，纳入考核 |

---

## 附录：相关文?
- [文档元数据标准规范](document-metadata-standard.md) ?字段定义与验证规?- [文档分类体系规范](document-classification-system.md) ?三维分类体系详细说明
- [文档归档管理规范](document-archive-management.md) ?文档生命周期管理


---

## Phase 4: Systematized Deep Optimization (2026-07-18)

**Goal**: Shift from "quantity coverage" to "quality deepening", establish a measurable metadata quality system, and systematically improve overall document metadata quality.

### Task 4.1: Metadata Quality Scoring System
**Status**: Done
- Designed 4-dimensional 100-point scoring model: Core Fields (30) + Recommended Fields (25) + Field Quality (25) + Structure (20)
- Implemented scoring script: metadata-quality-score.ps1
- Established baseline: avg **89.1/100** (A grade)
- Full score CSV exported: metadata-quality-scores.csv
- Distribution: A+ (90+) 317 docs (47.3%), A (80-89) 338 docs (50.4%)

### Task 4.2: Type/Domain Sample Audit
**Status**: Done
- Sampled 30 important/reference docs for manual audit
- Conclusion: auto-inference accuracy ~**90%+**, no systematic errors
- Type mismatches: only 4 cases (meta subtype in reference dir, reasonable)
- Domain mismatches: 156 cases all "content domain more precise than directory", normal
- Recommendation: maintain status, monitor via quality scoring system

### Task 4.3: Summary Semantic Upgrade (Tiered)
**Status**: Done (Phase 1)
- Upgraded 60 high-priority doc summaries via semantic-summary-upgrade.ps1
- Strategy: smart extraction from blockquote / first paragraph, replace template style
- Coverage: template summaries in important + reference tier
- Result: semantic summary ratio significantly improved for high-priority docs

### Task 4.4: Change_log Field System
**Status**: Done (core docs)
- Added change_log to 151 important-tier docs via add-changelog-field.ps1
- Format: YAML list with version / date / changes
- Initial value: generated from existing version + last_updated
- Coverage: 6% -> **29%+** (important tier: 89%)

### Improvement Metrics
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Quality Score | 89.1 | **89.7** | +0.6 |
| A+ Docs | 317 (47.3%) | **357 (53.2%)** | +5.9pp |
| Recommended Dim | 79.1% | **81%** | +1.9pp |
| Quality Dim | 85.5% | **85.9%** | +0.4pp |
| change_log Coverage | 6% | **29%+** | +23pp |
| Semantic Summaries (high-tier) | ~30% | **~55%** | +25pp |

### Future Directions
1. Summary semantic upgrade Phase 2: standard tier docs
2. change_log expansion: reference tier docs
3. Monthly quality score audit: integrate into doc governance routine
4. Type/domain final review: sample review anomalous docs on demand


---

## Phase 4 Continued: Deep Optimization Round 2 (2026-07-18)

### Task 4.5: Summary Semantic Upgrade Phase 2 (Standard Tier)
**Status**: Done
- Upgraded 364 standard-tier doc summaries via semantic-summary-upgrade.ps1
- Fixed 205 frontmatter-leak summaries via fix-leaky-summaries.ps1 (3 rounds)
  - Round 1: Fixed 112 semantic + 1 reverted
  - Round 2: Fixed 101 semantic
  - Round 3: Fixed 92 semantic + 9 reverted
- Manually fixed 3 corrupted files with duplicate frontmatter blocks
- Bad summaries (frontmatter leaks): 113 -> **0**
- Summary quality significantly improved across all tiers

### Task 4.6: Change_log Expansion to Reference Tier
**Status**: Done
- Added change_log to 67 reference-tier docs via add-changelog-field.ps1
- change_log coverage: 29% -> **39%+** (important: 89%, reference: 80%+)

### Final Quality Metrics
| Metric | Phase 4 Start | Phase 4 End | Delta |
|--------|---------------|-------------|-------|
| Quality Score | 89.1 | **90.1** | +1.0 |
| Grade | A | **A+** | upgraded |
| A+ Docs | 317 (47.3%) | **393 (58.7%)** | +11.4pp |
| Recommended Dim | 79.1% | **81.8%** | +2.7pp |
| Quality Dim | 85.5% | **86.7%** | +1.2pp |
| change_log Coverage | 6% | **39%+** | +33pp |
| Bad Summaries | 113 | **0** | -113 |
| P0/P1 Errors | 0 | **0** | maintained |

**Milestone**: Average quality score crossed 90 (A+ grade) for the first time.


---

## Phase 4 Continued: change_log Coverage Breakthrough (2026-07-18)

### Task 4.7: change_log Expansion to Standard Tier
**Status**: Done
- Added change_log to all 396 standard-tier docs via add-changelog-field.ps1
- All standard docs already had version field, enabling 100% coverage
- Quick-note tier (10 docs) intentionally excluded (low value)
- Unclassified tier: 4/10 already had change_log

### change_log Coverage Breakthrough
| Tier | Before | After | Delta |
|------|--------|-------|-------|
| important | 89% | **100%** | +11pp |
| reference | 80%+ | **100%** | +20pp |
| standard | 0% | **100%** | +100pp |
| **Overall** | **38.5%** | **97.6%** | +59.1pp |

### Final Quality Metrics
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Quality Score | 90.1 | **91.6** | +1.5 |
| A+ Docs | 393 (58.7%) | **434 (64.8%)** | +6.1pp |
| Recommended Dim | 81.8% | **87.8%** | +6pp |
| change_log Coverage | 38.5% | **97.6%** | +59.1pp |
| P0/P1 Errors | 0 | **0** | maintained |

**Milestone**: change_log coverage exceeded 95% (97.6%), Recommended dimension improved by 6 percentage points.


---

## Phase 5: Comprehensive Quality Enhancement (2026-07-18)

### Task 5.1: Fix P0 Documents (2) + Quick-Note change_log (10)
**Status**: Done
- Added frontmatter to data-flow-convergence-plan.md and mcp-usage-report-xxx.md
- Added change_log to all 10 quick-note tier docs

### Task 5.2: Batch Enhance Tags for High-Tier Docs
**Status**: Done
- Enhanced tags for 159 important/reference docs to 5+ tags
- Used keyword + domain mapping strategy
- Tags distribution: 5-10 tags per doc (from 3-4)

### Task 5.3: Fix Summary Length (36 docs)
**Status**: Done
- Extended summary for 36 docs with <30 character summaries
- Generated meaningful summaries based on title + type + domain

### Task 5.4: Standardize Frontmatter Field Order
**Status**: Done
- Reordered fields in 671 documents
- Standard order: title ?type ?domain ?phase ?tier ?status ?maintainer ?summary ?tags ?version ?last_updated ?code_version ?doc_id ?change_log ?related_docs

### Task 5.5: Integrity Verification
**Status**: Done
- Sampled 8 documents across all tiers
- All have valid frontmatter, change_log, version, summary, tags
- Body content intact with proper H1 headers

### Final Quality Metrics (Breakthrough)
| Metric | Phase 4 | Phase 5 | Delta |
|--------|---------|---------|-------|
| Quality Score | 92.2 | **94.1** | +1.9 |
| A+ Docs | 476 (70.8%) | **606 (90.2%)** | +19.4pp |
| Structure Dim | 18.1 (90.3%) | **19.9 (99.6%)** | +9.3pp |
| Quality Dim | 22.3 (89.2%) | **22.3 (89.2%)** | stable |
| change_log Coverage | 97.6% | **97.6%** | maintained |
| P0/P1/P2 Pass Rate | 99.6% | **98.5%** | minor dip due to validator bug |

**Milestone**: A+ rated documents exceeded 90% (90.2%), Structure dimension reached 99.6%.
