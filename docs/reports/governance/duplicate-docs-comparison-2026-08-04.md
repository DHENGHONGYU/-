---
title: 重复文档逐对对比报告
tier: important
doc_id: V9-DOC-GOV-2026-08-04-DUP
status: active
version: v1.0.0
last_updated: 2026-08-04
code_version: 2.0.0
---

# 重复文档逐对对比报告

> **生成时间**: 2026-08-04
> **扫描范围**: `docs/` 目录（排除 `archive/`、`backup/`、`_backup_*`、`tmp/`）
> **目的**: 为去重决策提供逐对证据，确认每对重复文档的保留方与删除方
> **配套文件**: `file-cleanup-report-20260804.md`（清理总报告）

## 摘要

本次扫描在 `docs/` 下共识别出 **11 对高度重复文档**，分为两类：

| 类别 | 对数 | 特征 | 去重风险 |
|:---|:---:|:---|:---|
| A. 完全相同（哈希一致） | 5 | 内容字节级一致，仅路径不同 | 🟢 零风险，可直接删除任意一份 |
| B. 近乎相同（仅 frontmatter/少量行差异） | 6 | 行数一致，差异集中在 `type`/`tags`/`doc_id`/核实批注 | 🟡 低风险，需人工确认保留方 |

**判定标准**：
- 完全相同：SHA256 一致
- 近乎相同：行数一致，`git diff --numstat` 显示 ±5 行以内差异，且差异仅涉及 frontmatter 元数据或少量核实批注

---

## A. 完全相同对（5 对，可直接去重）

### 对 1：ai-center-data-definition.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/design/ai-center-data-definition.md` | `docs/reference/ai/ai-center-data-definition.md` |
| SHA256 | `893A35EEA057...` | `893A35EEA057...`（相同） |
| 差异行数 | +0 / -0 | |

**差异说明**: 字节级完全一致。
**去重建议**: ✅ 保留 `docs/reference/ai/` 版（reference 是数据字典的归属目录），删除 `docs/explanation/design/` 版。

---

### 对 2：news-data-definition.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/design/news-data-definition.md` | `docs/reference/news/news-data-definition.md` |
| SHA256 | `B7C64B0B0BD4...` | `B7C64B0B0BD4...`（相同） |
| 差异行数 | +0 / -0 | |

**差异说明**: 字节级完全一致。
**去重建议**: ✅ 保留 `docs/reference/news/` 版，删除 `docs/explanation/design/` 版。

---

### 对 3：implementation-governance.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/design/implementation-governance.md` | `docs/explanation/implementation/implementation-governance.md` |
| SHA256 | `5175005548CC...` | `5175005548CC...`（相同） |
| 差异行数 | +0 / -0 | |

**差异说明**: 字节级完全一致。两个子目录（design/ 与 implementation/）均存放同一文件。
**去重建议**: ✅ 保留 `docs/explanation/implementation/` 版（实现治理文档归属 implementation 子目录更合理），删除 `docs/explanation/design/` 版。

---

### 对 4：data-definition.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/design/data-definition.md` | `docs/reference/cockpit/data-definition.md` |
| SHA256 | `9D23C4970603...` | `9D23C4970603...`（相同） |
| 差异行数 | +0 / -0 | |
| 行数 / 大小 | 474 行 / 26730 字节 | 474 行 / 26730 字节 |

**差异说明**: 字节级完全一致。主题为「Cockpit Widget 框架数据字典」。
**去重建议**: ✅ 保留 `docs/reference/cockpit/` 版（数据字典归属 reference/cockpit），删除 `docs/explanation/design/` 版。

---

### 对 5：component-library-guide.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/design/component-library-guide.md` | `docs/explanation/implementation/component-library-guide.md` |
| SHA256 | `E4742486AAEC...` | `E4742486AAEC...`（相同） |
| 差异行数 | +0 / -0 | |
| 行数 / 大小 | 309 行 / 13518 字节 | 309 行 / 13518 字节 |

**差异说明**: 字节级完全一致。
**去重建议**: ✅ 保留 `docs/explanation/implementation/` 版（组件库实现指南归属 implementation），删除 `docs/explanation/design/` 版。

---

## B. 近乎相同对（6 对，需人工确认保留方）

### 对 6：completeness-profile-batch2.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/completeness-profile-batch2.md` | `docs/guides/how-to/testing/completeness-profile-batch2.md` |
| 行数 / 大小 | 91 行 / 7418 字节 | 91 行 / 7416 字节 |
| 差异行数 | +1 / -2 | |

**差异说明**: frontmatter 中 `code_version: 2.0.0` 行的空行排布不同，正文完全一致。
**去重建议**: 🟡 保留 `docs/guides/how-to/testing/` 版（完整性配置文档属于 how-to 测试指南），删除 `docs/explanation/` 版。

---

### 对 7：completeness-profile-batch5.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/completeness-profile-batch5.md` | `docs/reference/completeness-profile-batch5.md` |
| 行数 / 大小 | 91 行 / 6487 字节 | 91 行 / 6485 字节 |
| 差异行数 | +1 / -2 | |

**差异说明**: 同对 6，frontmatter 空行排布差异，正文完全一致。
**去重建议**: 🟡 保留 `docs/reference/` 版（参考性配置归 reference），删除 `docs/explanation/` 版。

---

### 对 8：complexity-remediation-plan.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/complexity-remediation-plan.md` | `docs/guides/how-to/testing/complexity-remediation-plan.md` |
| 行数 / 大小 | 141 行 / 17342 字节 | 141 行 / 17315 字节 |
| 差异行数 | +5 / -5 | |

**差异说明**: frontmatter 字段不同：
- A: `type: explanation`, `domain: architecture`, `tags: [architecture, complexity, remediation]`
- B: `type: how-to`, `domain: qa`

正文一致。
**去重建议**: 🟡 保留 `docs/guides/how-to/testing/` 版（修复计划属于 how-to 操作指南），删除 `docs/explanation/` 版。

---

### 对 9：v6pro-to-v9-migration-analysis.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/v6pro-to-v9-migration-analysis.md` | `docs/reference/v6pro-to-v9-migration-analysis.md` |
| 行数 / 大小 | 359 行 / 29134 字节 | 359 行 / 29134 字节 |
| 差异行数 | +5 / -6 | |

**差异说明**:
- frontmatter 空行排布差异
- B 版本含一行硬编码绝对路径：`> **Target**: `C:/Users/<用户名>/Documents/kimi/Workspaces/智能投研复盘系统V9``（违反项目可移植性约束，原文件中为具体用户名）

**去重建议**: 🟡 保留 `docs/explanation/` 版（迁移分析文档偏向架构解释，且不含硬编码路径），删除 `docs/reference/` 版。⚠️ 删除前确认无其他文档引用 `docs/reference/v6pro-to-v9-migration-analysis.md` 路径。

---

### 对 10：v9-l2状态层补齐路线图.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/v9-l2状态层补齐路线图.md` | `docs/reference/v9-l2状态层补齐路线图.md` |
| 行数 / 大小 | 232 行 / 19974 字节 | 232 行 / 19961 字节 |
| 差异行数 | +5 / -5 | |

**差异说明**: frontmatter 字段不同：
- A: `type: explanation`, `tags: [project, plan, explanation]`, `doc_id: V9-DOC-PROJ-260`
- B: `type: reference`, `tags: [project, plan, reference]`

正文一致。
**去重建议**: 🟡 保留 `docs/explanation/` 版（路线图属于 explanation 范畴，且含完整 doc_id），删除 `docs/reference/` 版。⚠️ 删除前确认 `doc_id: V9-DOC-PROJ-260` 未被交叉索引引用。

---

### 对 11：tech-debt.md / TECH-DEBT.md

| 属性 | 文件 A | 文件 B |
|:---|:---|:---|
| 路径 | `docs/explanation/design/tech-debt.md` | `docs/reports/TECH-DEBT.md` |
| 行数 / 大小 | 607 行 / 22826 字节 | 601 行 / 22592 字节 |
| 差异行数 | +1 / -9 | |

**差异说明**: A 版本多出 9 行 2026-07-12 的核实批注，标注以下债务项已无效：
- TD-004（api.ts 缺 JSDoc）：`src/services/api.ts` 已不存在
- TD-005（calculateScore 120 行）：函数已删/改名
- TD-006（硬编码 API 端点）：已集中至 `src/config/marketDataEndpoints.ts`
- TD-007：tsc 误报，非真实债务

B 版本（reports/TECH-DEBT.md）少这 9 行批注，更"干净"，但缺少核实信息。
**去重建议**: 🟡 保留 `docs/explanation/design/tech-debt.md` 版（含核实批注，状态更完整），删除 `docs/reports/TECH-DEBT.md` 版。⚠️ 删除前确认 reports 目录索引无引用。

---

## 去重执行清单

| 对 | 删除文件 | 保留文件 | 类别 | 风险 |
|:---:|:---|:---|:---:|:---:|
| 1 | `docs/explanation/design/ai-center-data-definition.md` | `docs/reference/ai/ai-center-data-definition.md` | A | 🟢 |
| 2 | `docs/explanation/design/news-data-definition.md` | `docs/reference/news/news-data-definition.md` | A | 🟢 |
| 3 | `docs/explanation/design/implementation-governance.md` | `docs/explanation/implementation/implementation-governance.md` | A | 🟢 |
| 4 | `docs/explanation/design/data-definition.md` | `docs/reference/cockpit/data-definition.md` | A | 🟢 |
| 5 | `docs/explanation/design/component-library-guide.md` | `docs/explanation/implementation/component-library-guide.md` | A | 🟢 |
| 6 | `docs/explanation/completeness-profile-batch2.md` | `docs/guides/how-to/testing/completeness-profile-batch2.md` | B | 🟡 |
| 7 | `docs/explanation/completeness-profile-batch5.md` | `docs/reference/completeness-profile-batch5.md` | B | 🟡 |
| 8 | `docs/explanation/complexity-remediation-plan.md` | `docs/guides/how-to/testing/complexity-remediation-plan.md` | B | 🟡 |
| 9 | `docs/reference/v6pro-to-v9-migration-analysis.md` | `docs/explanation/v6pro-to-v9-migration-analysis.md` | B | 🟡 |
| 10 | `docs/reference/v9-l2状态层补齐路线图.md` | `docs/explanation/v9-l2状态层补齐路线图.md` | B | 🟡 |
| 11 | `docs/reports/TECH-DEBT.md` | `docs/explanation/design/tech-debt.md` | B | 🟡 |

## 去重前确认事项

执行物理删除前，必须完成以下检查：

1. **交叉引用扫描**: 对每个删除文件，运行 `grep -r "<filename>" docs/` 确认无其他文档引用其路径
2. **frontmatter doc_id 迁移**: 检查删除文件的 `doc_id` 是否已被交叉索引引用，若是则需将 doc_id 迁移到保留文件
3. **REGENERATE_INDEX**: 删除完成后运行文档索引生成脚本，更新 `REGISTRY_INDEX.md`
4. **CI 验证**: 提交后运行 `npm run audit:docs` 确认无断链

## 其他观察

本次扫描还发现 50+ 对同名文档对，但内容差异较大（如 `README.md` 在 21 个子目录各有一份，属正常索引文档），未纳入本报告。如需扩大去重范围，可基于本报告的扫描脚本扩展相似度阈值。

完整重复清单（含所有同名对）见扫描脚本输出，存储于临时会话日志中。
