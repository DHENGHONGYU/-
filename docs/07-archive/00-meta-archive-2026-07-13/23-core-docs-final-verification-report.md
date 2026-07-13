# V9 智能投研复盘系统 — 23个核心文档 · 最终检索核实报告

> **报告生成时间**：2026-07-12
> **检索范围**：421个Markdown文档（全项目扫描）
> **匹配方法**：系统标题提取 + 关键词匹配 + 人工复核

---

## 📊 统计汇总

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 已存在 | 4 | 功能等价，仅目录/文件名不同 |
| 🔶 部分满足 | 5 | 相关文档存在但功能未完全覆盖 |
| 🔴 缺失 | 14 | 完全不存在（独立文档） |
| **合计** | **23** | — |

> **最终结论**：经过421个文档的全量扫描和逐一复核，23个核心文档中 **14个缺失**、**5个部分满足**、**4个已存在**。与前期判定（14个缺失/5个部分满足/4个已存在）**完全一致**。

---

## 📋 详细判定清单

### `docs/README.md` 🔴

- **判定理由**：无 `docs/README.md`；`docs/01-requirements/README.md` 是子目录导航，非顶层总入口

### `docs/GOVERNANCE.md` 🔴

- **判定理由**：无 `docs/GOVERNANCE.md`；`implementation-governance.md` 是实施治理，非文档治理公约

### `docs/architecture/overview.md` ✅

- **实际文档**：`docs/01-requirements/v9-system-blueprint.md`
- **判定理由**：444行，标题『整体架构蓝图』，含五层架构、数据架构、路由映射、ADR索引、实施路线

### `docs/architecture/cabins-overview.md` 🔴

- **判定理由**：无独立5舱体系总览；`v9-current-state-review.md` 按实施进度描述五舱，非架构视角

### `docs/architecture/adr/README.md` 🔴

- **判定理由**：无ADR集中索引；9份ADR散落各子目录

### `docs/01-requirements/adr/README.md` 🔴

- **判定理由**：`01-requirements/adr/` 下无README.md

### `docs/architecture/api-contracts.md` 🔶

- **实际文档**：`docs/02-design/API_CONTRACT.md`
- **判定理由**：仅交易模块API契约，非全局DataBridge/行情端点/事件名契约

### `docs/modules/data-layer-overview.md` 🔶

- **实际文档**：`docs/02-design/V9_IndexedDB_Store_Schema.md`
- **判定理由**：1009行，含25个Store完整Schema/索引/版本历史，但缺DataBridge/collection端到端数据地图

### `docs/ai/store-integration-guide.md` 🔴

- **判定理由**：无独立Store集成规范；仅`prompts/store-prompt-template.md`有片段

### `docs/ai/service-integration-guide.md` 🔴

- **判定理由**：无独立Service集成规范；仅`prompts/service-prompt-template.md`有片段

### `docs/standards/coding-conventions.md` ✅

- **实际文档**：`docs/01-requirements/03-architecture-standards.md`
- **判定理由**：1199行，标题『架构标准』，含五层架构、调用铁律、数据访问规范、引擎层规范、映射层规范

### `docs/design/song-aesthetics.md` 🔶

- **实际文档**：`docs/02-design/design-tokens.md + ui-design-system.md`
- **判定理由**：design-tokens 495行（令牌使用指南），ui-design-system 279行（含『宋瓷绿』『古铜金』提及），但无独立『宋韵美学』总述文档

### `docs/standards/quality-gates.md` ✅

- **实际文档**：`docs/02-design/09-quality-gates.md + quality-gates-baseline.md`
- **判定理由**：两份文档合起来覆盖质量门禁数值基线和策略

### `docs/testing/test-catalog.md` 🔴

- **判定理由**：无集中测试用例目录；V9-TEST-CASES.md偏一次性清单

### `docs/ai/README.md` 🔶

- **实际文档**：`docs/02-design/ai-memory-layer.md`
- **判定理由**：70行，含AI记忆层设计、索引、检索、与提示词结合，但缺prompts/检查表/飞轮的总览串联

### `docs/architecture/security-model.md` 🔴

- **判定理由**：仅`guides/mcp-acl-guide.md`（MCP ACL），无整体安全/权限模型

### `docs/ops/deployment.md` 🔴

- **判定理由**：仅`05-deployment/ADR-004`（HashRouter），无部署架构文档

### `docs/ops/runbook.md` 🔴

- **判定理由**：无运行/故障手册

### `docs/guides/getting-started.md` 🔴

- **判定理由**：`autonomous-workflow-user-guide.md`是自主工作流工具指南，非新手入门教程

### `docs/guides/how-to-add-widget.md` ✅

- **实际文档**：`docs/02-design/widget-development-guide.md`
- **判定理由**：481行，Widget开发全流程指南（注册/目录/开发/测试/发布）

### `docs/guides/how-to-add-store.md` 🔴

- **判定理由**：无『如何新增Store』操作指南；`V9_L2状态层补齐路线图.md`是补齐计划，非新增指南

### `docs/guides/how-to-add-service.md` 🔴

- **判定理由**：无『如何新增Service』操作指南；AGENTS.md四步集成有描述但非指南格式

### `docs/design/a11y-i18n.md` 🔶

- **实际文档**：`docs/03-development/a11y-checklist.md`
- **判定理由**：239行，含无障碍检查清单，但无i18n策略

---

## 🔴 真正缺失文档清单（14个）

- `docs/README.md` — `docs/01-requirements/README.md` 是子目录导航，非顶层总入口
- `docs/GOVERNANCE.md` — `implementation-governance.md` 是实施治理，非文档治理公约
- `docs/architecture/cabins-overview.md` — `v9-current-state-review.md` 按实施进度描述五舱，非架构视角
- `docs/architecture/adr/README.md` — 9份ADR散落各子目录
- `docs/01-requirements/adr/README.md` — `01-requirements/adr/` 下无README.md
- `docs/ai/store-integration-guide.md` — 仅`prompts/store-prompt-template.md`有片段
- `docs/ai/service-integration-guide.md` — 仅`prompts/service-prompt-template.md`有片段
- `docs/testing/test-catalog.md` — V9-TEST-CASES.md偏一次性清单
- `docs/architecture/security-model.md` — 仅`guides/mcp-acl-guide.md`（MCP ACL），无整体安全/权限模型
- `docs/ops/deployment.md` — 仅`05-deployment/ADR-004`（HashRouter），无部署架构文档
- `docs/ops/runbook.md` — 无运行/故障手册
- `docs/guides/getting-started.md` — `autonomous-workflow-user-guide.md`是自主工作流工具指南，非新手入门教程
- `docs/guides/how-to-add-store.md` — `V9_L2状态层补齐路线图.md`是补齐计划，非新增指南
- `docs/guides/how-to-add-service.md` — AGENTS.md四步集成有描述但非指南格式

---

## 🔄 目录错位修正建议

以下4个文档功能已确认等价，但存放目录与体系结构预期不符：

| 体系结构预期路径 | 实际路径 | 建议操作 |
|------------------|----------|----------|
| `docs/architecture/overview.md` | `docs/01-requirements/v9-system-blueprint.md` | 建立软链接或迁移 |
| `docs/standards/coding-conventions.md` | `docs/01-requirements/03-architecture-standards.md` | 建立软链接或迁移 |
| `docs/standards/quality-gates.md` | `docs/02-design/09-quality-gates.md` + `quality-gates-baseline.md` | 建立软链接或整合 |
| `docs/guides/how-to-add-widget.md` | `docs/02-design/widget-development-guide.md` | 建立软链接或迁移 |

---

## 📝 附录：检索过程说明

1. **第一轮检索**：文件名匹配（Grep/Glob），初步判定18个缺失、5个可能已存在
2. **第二轮检索**：人工读取10个关键文档内容，确认 `v9-system-blueprint` = `overview`、`03-architecture-standards` = `coding-conventions` 等功能等价关系
3. **第三轮检索**：扩展关键词（中英文变体），对8个高/中优先级文档进行深度搜索
4. **第四轮检索**：Python脚本系统化扫描421个文档，提取标题并做关键词匹配
5. **最终复核**：逐份读取候选文档（`v9-current-state-review.md`、`01-requirements/README.md`、`autonomous-workflow-user-guide.md` 等），确认其与目标文档的功能差异

> **关键区分原则**：
> - **已存在**：有独立文档，标题和内容明确对应目标功能（即使目录不同）
> - **部分满足**：有独立文档覆盖目标功能的部分内容，但未完全覆盖
> - **缺失**：无独立文档承担该功能（即使功能被分散在多个不相关文档中）
