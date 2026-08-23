---
title: 文档治理二次校准总结报告
type: meta
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 文档治理二次校准总结报告

> 生成时间: 2026-08-15
> 性质: 临时治理材料，定期归档/移出，不纳入 doc_id 注册表
> 校准范围: 全仓库文档（docs/ 656 篇）+ 文档↔代码关系

## 一、校准目标

结合已有文档治理体系，对全仓库文档进行二次校准，识别治理覆盖度、缺口与下一步动作，保障文档治理相对彻底。

## 二、文档治理体系现状盘点

### 2.1 治理工具链（已建立）

| 类别 | 工具 | 命令 | 用途 |
|------|------|------|------|
| doc_id 注册 | audit-doc-id-reverse.ts | `npm run audit:doc-id` | 磁盘↔注册表反向校验，归档候选豁免 |
| doc_id 注入 | inject-doc-id.ts | — | 为正式文档自动注入 doc_id，跳过归档候选 |
| doc_id 同步 | sync-doc-id-registry.ts | — | 同步磁盘与注册表条目 |
| 归档候选分类 | classify-orphan-docs.ts | `npm run classify:orphan-docs` | 识别审计/测试/总结类，不注入 doc_id |
| 文档↔代码索引 | gen-doc-code-xref-index.ts | `npm run gen:doc-code-xref` | 双向映射，二次校对快速入口 |
| 代码-文档同步 | audit-doc-sync.ts | `npm run audit:docs` | git diff 模式，扫描未文档化代码 |
| 版本漂移 | audit-version-drift.ts | — | 校对 frontmatter code_version 与 package.json |
| 交叉引用断链 | audit-doc-code-references.ts | — | doc→code / code→doc / doc→doc 三类断链 |
| 文档完整性 | audit-doc-integrity.ts | `npm run audit:doc-integrity` | frontmatter 字段完整性 |
| 重复文档 | audit-doc-duplicates.ts | — | 识别重复/相似文档 |
| JSDoc | audit-jsdoc.ts | `npm run audit:jsdoc` | 代码 JSDoc 一致性 |

### 2.2 治理产物（meta/ 目录）

| 产物 | 性质 | 用途 |
|------|------|------|
| doc-id-registry.md | 正式 | doc_id 注册表（509 条） |
| REGISTRY_INDEX.md | 正式 | 模块注册体系索引（V9-DOC-META-003） |
| doc-code-direct-xref.md | 临时 | 文档↔代码直接关系快速索引 |
| orphan-archive-candidates.md | 临时 | 无 doc_id 归档候选清单（149 篇） |
| 文件整理清单.md | 临时 | 文件整理清单 |
| GOVERNANCE.md | 正式 | 文档治理宪法 v2.0.0 |

### 2.3 CI 门禁集成

`gate:quick` 已包含 `audit:doc-id`，doc_id 反向校验作为持续约束机制生效。

## 三、二次校准体检结果（2026-08-15）

### 3.1 通过项 ✅

| 维度 | 结果 | 说明 |
|------|------|------|
| doc_id 反向校验 | ✅ 0 违规 | 656 文档，506 有 doc_id，150 归档候选豁免，覆盖率 77.1% |
| 代码-文档同步 | ✅ 0 违规 | git diff 模式，685 文档，0 疑似未文档化 |
| 版本漂移 | ✅ 一致 | 683 文档 code_version 与 package.json 一致 |
| 归档候选豁免 | ✅ 生效 | 临时治理产物（doc-code-direct-xref 等）正确豁免 |

### 3.2 失败项 ❌

| 维度 | 结果 | 缺口 |
|------|------|------|
| 交叉引用断链 | ❌ 22.06% | 2760/12511 断裂，超门禁阈值 0% |
| ├ 文档→代码 | 613 断裂 | 文档引用了已删除/改名的代码文件 |
| ├ 代码→文档 | 34 断裂 | 代码引用了已归档/删除的文档 |
| └ 文档→文档 | 2113 断裂 | 历史索引文档引用大量已归档文档 |

## 四、Top 断链源（二次校对重点入口）

### 4.1 文档→文档 断链 Top 12

| # | 源文档 | 断裂数 | 性质判断 |
|---|--------|--------|---------|
| 1 | docs/meta/registry-index.md | 263 | 历史损坏产物，frontmatter 全空，应归档 |
| 2 | docs/meta/文件整理清单.md | 122 | 临时整理清单，引用已归档文档 |
| 3 | docs/reports/CHANGELOG.md | 88 | 历史变更日志，引用已删除文档 |
| 4 | docs/reports/changelogs/CHANGELOG_changelogs.md | 76 | 同上 |
| 5 | docs/explanation/architecture/adr/README.md | 58 | ADR 索引，引用已迁移的 ADR |
| 6 | docs/meta/doc-system-check-v9.md | 52 | 历史文档系统检查清单 |
| 7 | docs/reference/文件整理清单.md | 50 | 同 #2，重复副本 |
| 8 | docs/reference/《V9现有数据资产清单》.md | 44 | 数据资产清单，引用已重构的 Store |
| 9 | docs/reports/project-management/docs-governance-file-structure-report-2026-08-03.md | 43 | 治理报告 |
| 10 | docs/meta/type-domain-audit-worksheet.md | 36 | 类型审计工作表 |
| 11 | docs/meta/document-style-guide.md | 35 | 文档风格指南 |
| 12 | docs/reference/README.md | 35 | reference 目录 README |

### 4.2 代码→文档 断链 Top（共 34 条）

| 代码文件 | 断链目标 | 性质 |
|---------|---------|------|
| scripts/build-ai-memory-index.ts | docs/reference/testing-strategy.md | 文档已迁移 |
| scripts/cleanup-temp.ts | docs/how-to/FILE-MANAGEMENT-GUIDE.md | 路径错误 |
| scripts/doc-gatekeeper.ts | docs/meta/doc-auto-update-kanban.md | 文档已删除 |
| scripts/docs-tool/doc-freshness-alert.ts | docs/reports/retrospectives/freshness-alerts.md | 路径错误 |
| scripts/fix/fix-silent-fallback.ts | docs/archive/silent-fallback-fix-report.md | 引用 archive 目录 |
| scripts/generate/generate-pdf-report.ts | docs/reports/audit/2026-07-09-undocumented-files-report.md | 文档已删除 |
| scripts/other/changelog-query.ts | docs/reports/changelogs/2026-07-09-update-log.md | 文档已删除 |
| scripts/other/cleanup-reports.ts | docs/meta/cleanup-schedule.md | 文档已删除 |
| scripts/sync/doc-sync.ts | docs/reports/doc-sync/latest-summary.md | 路径不存在 |
| scripts/sync/test-sync.ts | docs/reports/doc-sync/latest-summary.md | 同上 |

## 五、治理覆盖度评估

| 维度 | 覆盖度 | 说明 |
|------|--------|------|
| doc_id 注册 | 77.1% | 506/656 已注册，剩余 150 为归档候选 |
| 文档↔代码双向索引 | 100% | 已建立 doc-code-direct-xref.md |
| 代码-文档同步 | 100% | git diff 模式全覆盖 |
| 版本漂移 | 100% | 全文档 code_version 校验 |
| 交叉引用断链 | 78% | 22% 断链率，主要为历史索引文档 |
| 归档候选识别 | 100% | 149 篇归档候选已识别 |
| frontmatter 完整性 | 待复查 | audit:doc-integrity 未在本轮重跑 |

## 六、治理动作执行记录（2026-08-15 已完成 P0-P4）

### P0：归档历史损坏产物 ✅ 已完成

已归档 7 个文件至 docs/archive/historical-2026-08-15/：
- meta/registry-index.md（V9-DOC-META-000，263 断链）→ 已从注册表移除
- meta/文件整理清单.md（V9-DOC-META-004，122 断链）→ 已从注册表移除
- reference/文件整理清单.md（V9-DOC-PROJ-120，50 断链）→ 已从注册表移除
- reports/CHANGELOG.md（88 断链）→ 已标记 status: archived
- reports/changelogs/CHANGELOG_changelogs.md（V9-DOC-AUTO-386190，76 断链）→ 已从注册表移除
- reference/V9现有数据资产清单.md（V9-DOC-REF-977，重复副本）→ 已从注册表移除
- explanation/design/v9现有数据资产清单.md（V9-DOC-PROJ-366，重复副本）→ 已从注册表移除

同步修复：
- `cross-ref-engine.ts` 的 `scanDirectory` 新增排除 `archive/` 目录
- `registry-index-root.md` 重定向至 `REGISTRY_INDEX.md`
- `doc-id-registry.md` 移除 7 个归档条目

### P1：修复代码→文档断链 ✅ 已完成

修复 39 条代码→文档断链（34 条原始 + 5 条根级副本）：
- 引用 registry-index.md → 改为 doc-id-registry.md（4 条）
- 引用 CHANGELOG.md → 改为 release-notes.md（1 条）
- 路径迁移类：reference/03-architecture-standards.md → explanation/（8 条）
- 路径迁移类：reference/05-engine-specs.md → explanation/（2 条）
- 其它路径修正（24 条）
- 代码→文档断裂归零 ✅

### P2：重建 ADR 索引 ✅ 已完成

修复 `../../README.md` 的 58 条断链：
- 重建 §4.1 索引表，移除 9 条断链，新增 6 条实际存在的 ADR
- 修复 §4.2 摘要引用路径（8 条）
- 修复 §5/§6/§9 关联路径（6 条）
- 发现 ADR-010 编号冲突（cockpit vs profile），已标注待架构组重排

### P3：评估数据资产清单文档 ✅ 已完成

- 归档 2 个重复副本（V9-DOC-REF-977、V9-DOC-PROJ-366）
- 保留 `../archive/historical-2026-08-16/batch7/docs/reference/%E3%80%8AV9%E7%8E%B0%E6%9C%89%E6%95%B0%E6%8D%AE%E8%B5%84%E4%BA%A7%E6%B8%85%E5%8D%95%E3%80%8B.md（已归档）`（V9-DOC-REF-981）作为权威版本
- 保留版本仍有 ~44 条断链（引用已重构 Store），建议后续基于 storeRegistry 重新生成

### P4：断链率递减基线 ✅ 已建立

### P5-P7：Top 断链源批量治理 ✅ 已完成（2026-08-15 第二轮）

**归档 8 个审计/日志/废弃类文档**（~108 条断链源头）：
- reports/test-catalog-gap-analysis-2026-08-09.md（14 条）
- explanation/implementation/deprecated/DEPRECATED_batch1-merge-report.md（14 条）
- reports/governance/governance-summary-2026-08-03.md（14 条）
- reference/superpowers/plans/2026-06-29-data-relationship-blueprint.md（15 条）
- explanation/implementation/deprecated/DEPRECATED_v9-issue-resolution-schedule.md（13 条）
- reference/v9-architecture-data-dictionary-validation-report.md（13 条）
- reference/dual-strategy-update-log-and-consistency-check.md（13 条）
- explanation/design/color-token-consolidation-feasibility.md（13 条）

**修复 7 个活跃文档**（~190 条断链）：
- docs/explanation/architecture/adr/README.md（51 条）：修复裸文件名相对路径（05-engine-specs/06-routing-specs/overview/mcp-coupling 等 13 类映射）+ 清除 §4.1 旧路径残留
- docs/reference/《V9现有数据资产清单》.md（35 条）：迁移路径更新 + 废弃 Store 标注
- docs/meta/document-style-guide.md（32 条）：示例文件名去反引号 + 乱码链接修复
- docs/reference/fourth-industrial-revolution-core-resource-strategy.md（20 条）：外部参考文件加完整前缀
- docs/meta/markdown-reorg-framework.md（17+6 条）：归档文件标注 + 裸名引用补全
- docs/reference/v6pro-to-v9-migration-analysis.md（30 处）：V6 Pro 外部路径转纯文字 + 目录修正（该文档现位于 `docs/archive/normal/explanation-v6pro-to-v9-migration-analysis.md`）
- docs/guides/how-to/git-commit-governance.md（19 处）：模式说明去反引号

**注册表同步**：
- 移除 11 条失效条目（含本轮归档的 5 条）
- 新增 13 条（9 个活跃文档注入 doc_id + 其它）
- doc_id 审计 0 违规，覆盖率 76.8%

## 七、断链率递减基线

### 治理效果

| 阶段 | 断链率 | 变化 | 说明 |
|------|--------|------|------|
| **当前（第五轮后）** | **9.22%** | **-12.84%** | 突破10%关口，逼近 3 月目标（≤5%） |
| 治理前 | 22.06% | — | 2760/12511 断裂 |
| P0 后 | 19.69% | -2.37% | 归档 7 个历史产物 |
| P1 后 | 19.39% | -0.30% | 代码→文档断裂归零 |
| P2+P3 后 | 19.62% | +0.23% | ADR 重建引入新引用 + 归档产生少量反向断链 |
| 第二轮后 | 14.72% | -4.90% | 归档 8 + 修复 7 个 Top 断链文档（1月目标 ≤15% 达成） |
| 第三轮后 | 13.12% | -1.60% | 修复《功能模块数据契约》《V9现有数据资产清单》《adr/README》，校准校准报告自身 |
| 第四轮后 | 13.00% | -0.12% | 归档 6 个高断链废弃文档（changelogs索引、重复test-catalog、3个过期报告+tracker） |
| 第五轮后 | 9.22% | -3.78% | Token脚本路径纯文本化（72条）+ 规范路径集群修正（201条）+ AGENTS.md路径（12条）+ 归档第二梯队4个 + 额外修复46条，共331处 |

### 门禁阈值

- **当前门禁阈值**：0%（audit-doc-code-references.ts 默认，未纳入 gate:quick）
- **建议阈值**：20%（当前基线 + 7% 缓冲），纳入 gate:quick 防止恶化
- **递减目标**：
  - 1 个月内：≤15% ✅（第二轮已达成，目前 9.22%）
  - 3 个月内：≤5%（第五轮已突破10%关口，距5%目标剩 4.22%；按当前节奏第六/七轮可达成）
  - 6 个月内：≤1%（接近门禁阈值 0%）

### 剩余断链分布（第五轮后）

- **类型**：全部为文档→文档 + 文档→代码（代码→文档已归零 ✅）
- **分散度**：约 240 个文档，单文档 1-2 条断链占 85%（高度分散，单点修复性价比下降）
- **Top 断链源（第六轮候选）**：
  - 历史changelogs（reference/changelogs/2026-07/ 下多个，每个 1-2 条）
  - reports/ 下过期报告（type-debt-cleanup、next-phase-architecture-optimization-plan 等）
  - 残留 file:// 绝对路径（mock-isolation-fix-report、phase1-execution-checklist 等）
- **Top 断链目标（第六轮候选）**：
  - 已重构的 Store/Service（stockAnalysisStore.ts、profileStore.ts、holdingsService.ts 等）
  - 已迁移的 Page（StockAnalysisPage.tsx、HotSectorPanel.tsx 等，路径变化）
  - 裸文件名引用（code-review.md、governance.md、V9.md 等）
- **修复策略**：
  1. 批量归档 changelogs/2026-07/ 下历史变更日志（每个 1-2 条断链，归档性价比高）
  2. 批量替换 file:// 绝对路径为相对路径
  3. 对已重构的 Store/Service 引用，标注"已迁移至XXX"或更新路径

## 八、二次校对快速入口

以下入口已建立，供后续校对直接使用：

1. **文档↔代码直接关系**：`docs/meta/doc-code-direct-xref.md`
   - 447 文档引用 1079 代码，428 个高频被引代码（≥3 篇）
   - 代码改动后必查高频被引代码

2. **归档候选清单**：`docs/meta/orphan-archive-candidates.md`
   - 149 篇归档候选，按原因分类

3. **本报告**：`docs/meta/doc-governance-calibration-2026-08-15.md`
   - Top 断链源与下一步动作

## 九、结论

文档治理已完成五轮校准（P0-P18）：
- **第一轮（P0-P4）**：归档 7 个历史损坏产物 + 修复 39 条代码→文档断链 + 重建 ADR 索引 + 建立递减基线（22.06% → 19.62%）
- **第二轮（P5-P7）**：归档 8 个审计/日志/废弃类文档 + 修复 7 个活跃文档 ~190 条断链 + 注册表同步（19.62% → 14.72%）✅ 达成1月目标（≤15%）
- **第三轮（P8-P10）**：修复《功能模块数据契约》《V9现有数据资产清单》《adr/README》活跃文档，处理校准报告自引用断链（14.72% → 13.12%），doc_id覆盖率提升至 77.1%
- **第四轮（P11-P14）**：归档 6 个高断链废弃文档（reports/changelogs/README、重复test-catalog草稿、ui-remediation-tracker、pending-backlog、optimization-progress、implementation/quality-audit-plan），注册表同步新增4条漏登记（13.12% → 13.00%）
- **第五轮（P15-P18）**：Token脚本路径纯文本化（72条）+ 规范路径集群修正（06/03/05/02/04-specs相对路径201条）+ AGENTS.md路径修正（12条）+ 归档第二梯队4个（deprecated batch2-merge、deprecated ui-module-alignment、pwa-offline-guide、prompts/README）+ 额外修复46条，共331处批量修复（13.00% → 9.22%）✅ 突破10%关口，达成第五轮 ≤11.9% 目标

**第五轮后最终状态**：
- 断链率：**9.22%**，✅ 突破10%关口，距 3 月目标（≤5%）剩 4.22%
- doc_id 审计：0 违规 ✅，覆盖率 77.4%（485/627，488注册表条目 + 142归档候选豁免）
- 代码→文档断裂：0 ✅
- 代码-文档同步：通过 ✅
- 版本漂移：通过 ✅

**第六轮治理方向（待启动）**：
1. **剩余分散断链收尾**：约 240 个文档，单文档 1-5 条断链占 85%，需批量处理裸文件名引用 + 历史迁移残留
2. **重复/历史文档归档**：reference/changelogs/2026-07/ 下多个历史变更日志、reports/ 下过期报告继续归档
3. **file:// 绝对路径统一**：少量文档残留 `file:///D:/FinSightV9/...` 绝对路径，需改为相对路径
4. **目标**：断链率降至 ≤7%，为 3 月目标（≤5%）做最后冲刺
