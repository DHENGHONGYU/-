# V9 智能投研复盘系统 — 23个核心文档 · 二次校对最终报告

> **报告生成时间**：2026-07-12
> **校对轮次**：第2轮（人工复核所有判定）
> **校对依据**：重新读取 `implementation-governance.md`、`00-README.md`、`V9-TEST-CASES.md`、`audit-b4-4-security.md` 等关键文档全文

---

## 📊 统计汇总（二次校对后）

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 已存在 | 4 | 功能等价，仅目录/文件名不同 |
| 🔶 部分满足 | 7 | 相关文档存在但功能未完全覆盖 |
| 🔴 缺失 | 12 | 完全不存在（独立文档） |
| **合计** | **23** | — |

> **关键修正**：与第1轮相比，将 `GOVERNANCE.md` 和 `test-catalog.md` 从『缺失』调整为『部分满足』。最终缺失数从 **14** 降至 **12**（减少2个）。

---

## 📋 详细判定清单（校对后）

### `docs/README.md` 🔴

- **判定理由**：无 `docs/README.md`；`01-requirements/README.md` 是子目录导航，非顶层总入口

### `docs/GOVERNANCE.md` 🔶

- **实际文档**：`docs/02-design/implementation-governance.md + 00-README.md`
- **判定理由**：`implementation-governance.md` 含ADR模板/版本比对/审计基线/代码-文档同步；`00-README.md` 含Frontmatter规范/保鲜度告警/DoD；但两者是独立文档，无统一『文档治理公约』总述

### `docs/architecture/overview.md` ✅

- **实际文档**：`docs/01-requirements/v9-system-blueprint.md`
- **判定理由**：444行，标题『整体架构蓝图』，含五层架构、数据架构、路由映射、ADR索引、实施路线

### `docs/architecture/cabins-overview.md` 🔴

- **判定理由**：无独立5舱体系总览；`v9-current-state-review.md` 按实施进度描述五舱，非架构视角；`06-routing-specs` 仅路由；`input-cabin-spec` 仅input舱

### `docs/architecture/adr/README.md` 🔴

- **判定理由**：无ADR集中索引；`implementation-governance.md` 含ADR模板和已归档列表（9个），但无独立索引README；9份ADR散落各子目录

### `docs/01-requirements/adr/README.md` 🔴

- **判定理由**：`01-requirements/adr/` 下无README.md；与 `architecture/adr/README.md` 是同一功能的不同路径建议

### `docs/architecture/api-contracts.md` 🔶

- **实际文档**：`docs/02-design/API_CONTRACT.md`
- **判定理由**：仅交易持仓API契约，非全局DataBridge/行情端点/事件名契约

### `docs/modules/data-layer-overview.md` 🔶

- **实际文档**：`docs/02-design/V9_IndexedDB_Store_Schema.md`
- **判定理由**：1009行，含25个Store完整Schema/索引/版本历史，但缺DataBridge/collection端到端数据地图

### `docs/ai/store-integration-guide.md` 🔴

- **判定理由**：无独立Store集成规范；`prompts/store-prompt-template.md` 是AI生成提示词，非集成指南

### `docs/ai/service-integration-guide.md` 🔴

- **判定理由**：无独立Service集成规范；`prompts/service-prompt-template.md` 是AI生成提示词，非集成指南

### `docs/standards/coding-conventions.md` ✅

- **实际文档**：`docs/01-requirements/03-architecture-standards.md`
- **判定理由**：1199行，标题『架构标准』，含五层架构、调用铁律、数据访问规范、引擎层规范、映射层规范

### `docs/design/song-aesthetics.md` 🔶

- **实际文档**：`docs/02-design/design-tokens.md + ui-design-system.md`
- **判定理由**：design-tokens 495行（令牌使用指南），ui-design-system 279行（含『宋瓷绿』『古铜金』提及），但无独立『宋韵美学』总述文档

### `docs/standards/quality-gates.md` ✅

- **实际文档**：`docs/02-design/09-quality-gates.md + quality-gates-baseline.md`
- **判定理由**：两份文档合起来覆盖质量门禁数值基线和策略

### `docs/testing/test-catalog.md` 🔶

- **实际文档**：`docs/03-development/V9-TEST-CASES.md`
- **判定理由**：1178行完整测试用例清单，含10个分类、60+测试用例，但体系结构文档认为『偏一次性清单』，非集中维护目录

### `docs/ai/README.md` 🔶

- **实际文档**：`docs/02-design/ai-memory-layer.md`
- **判定理由**：70行，含AI记忆层设计、索引、检索、与提示词结合，但缺prompts/检查表/飞轮的总览串联

### `docs/architecture/security-model.md` 🔴

- **判定理由**：仅`guides/mcp-acl-guide.md`（MCP ACL）和`audit-b4-4-security.md`（前端安全审计），无整体安全/权限模型

### `docs/ops/deployment.md` 🔴

- **判定理由**：仅`05-deployment/ADR-004`（HashRouter静态托管），无部署架构文档

### `docs/ops/runbook.md` 🔴

- **判定理由**：无运行/故障手册；`07-operation-strategy.md` 含风险控制/回滚原则，但非运维手册

### `docs/guides/getting-started.md` 🔴

- **判定理由**：`autonomous-workflow-user-guide.md` 是自主工作流工具指南，非新手入门教程；`01-requirements/README.md` 是文档导航，非入门指南

### `docs/guides/how-to-add-widget.md` ✅

- **实际文档**：`docs/02-design/widget-development-guide.md`
- **判定理由**：481行，Widget开发全流程指南（注册/目录/开发/测试/发布）

### `docs/guides/how-to-add-store.md` 🔴

- **判定理由**：无『如何新增Store』操作指南；`V9_L2状态层补齐路线图.md` 是补齐计划，非新增指南；`migration-news-useState-to-zustand.md` 是迁移指南

### `docs/guides/how-to-add-service.md` 🔴

- **判定理由**：无『如何新增Service』操作指南；AGENTS.md四步集成有描述但非指南格式；`data-collection-architecture.md` 是采集架构，非Service指南

### `docs/design/a11y-i18n.md` 🔶

- **实际文档**：`docs/03-development/a11y-checklist.md`
- **判定理由**：239行，含无障碍检查清单，但无i18n策略

---

## 🔄 两次校对对比

| 文档 | 第1轮判定 | 第2轮判定 | 修正说明 |
|------|----------|----------|----------|
| `docs/GOVERNANCE.md` | 🔴 缺失 | 🔶 部分满足 | `implementation-governance.md`（ADR/版本比对/审计基线）+ `00-README.md`（Frontmatter/DoD/保鲜度）合起来覆盖大部分治理内容，但分散在两个独立文档中，无统一治理总述 |
| `docs/testing/test-catalog.md` | 🔴 缺失 | 🔶 部分满足 | `V9-TEST-CASES.md` 是1178行完整测试用例清单（10分类/60+用例），但体系结构认为『偏一次性清单』，非集中维护目录 |
| 其余21个 | 不变 | 不变 | 复核确认无误 |

---

## 🔴 真正缺失文档清单（12个）

- `docs/README.md` — `01-requirements/README.md` 是子目录导航，非顶层总入口
- `docs/architecture/cabins-overview.md` — `input-cabin-spec` 仅input舱
- `docs/architecture/adr/README.md` — 9份ADR散落各子目录
- `docs/01-requirements/adr/README.md` — 与 `architecture/adr/README.md` 是同一功能的不同路径建议
- `docs/ai/store-integration-guide.md` — `prompts/store-prompt-template.md` 是AI生成提示词，非集成指南
- `docs/ai/service-integration-guide.md` — `prompts/service-prompt-template.md` 是AI生成提示词，非集成指南
- `docs/architecture/security-model.md` — 仅`guides/mcp-acl-guide.md`（MCP ACL）和`audit-b4-4-security.md`（前端安全审计），无整体安全/权限模型
- `docs/ops/deployment.md` — 仅`05-deployment/ADR-004`（HashRouter静态托管），无部署架构文档
- `docs/ops/runbook.md` — `07-operation-strategy.md` 含风险控制/回滚原则，但非运维手册
- `docs/guides/getting-started.md` — `01-requirements/README.md` 是文档导航，非入门指南
- `docs/guides/how-to-add-store.md` — `migration-news-useState-to-zustand.md` 是迁移指南
- `docs/guides/how-to-add-service.md` — `data-collection-architecture.md` 是采集架构，非Service指南

---

## 🔶 部分满足文档清单（7个）

- `docs/GOVERNANCE.md` → `docs/02-design/implementation-governance.md + 00-README.md` — 但两者是独立文档，无统一『文档治理公约』总述
- `docs/architecture/api-contracts.md` → `docs/02-design/API_CONTRACT.md` — 仅交易持仓API契约，非全局DataBridge/行情端点/事件名契约
- `docs/modules/data-layer-overview.md` → `docs/02-design/V9_IndexedDB_Store_Schema.md` — 1009行，含25个Store完整Schema/索引/版本历史，但缺DataBridge/collection端到端数据地图
- `docs/design/song-aesthetics.md` → `docs/02-design/design-tokens.md + ui-design-system.md` — design-tokens 495行（令牌使用指南），ui-design-system 279行（含『宋瓷绿』『古铜金』提及），但无独立『宋韵美学』总述文档
- `docs/testing/test-catalog.md` → `docs/03-development/V9-TEST-CASES.md` — 1178行完整测试用例清单，含10个分类、60+测试用例，但体系结构文档认为『偏一次性清单』，非集中维护目录
- `docs/ai/README.md` → `docs/02-design/ai-memory-layer.md` — 70行，含AI记忆层设计、索引、检索、与提示词结合，但缺prompts/检查表/飞轮的总览串联
- `docs/design/a11y-i18n.md` → `docs/03-development/a11y-checklist.md` — 239行，含无障碍检查清单，但无i18n策略

---

## ✅ 已存在文档清单（4个）

- `docs/architecture/overview.md` → `docs/01-requirements/v9-system-blueprint.md` — 444行，标题『整体架构蓝图』，含五层架构、数据架构、路由映射、ADR索引、实施路线
- `docs/standards/coding-conventions.md` → `docs/01-requirements/03-architecture-standards.md` — 1199行，标题『架构标准』，含五层架构、调用铁律、数据访问规范、引擎层规范、映射层规范
- `docs/standards/quality-gates.md` → `docs/02-design/09-quality-gates.md + quality-gates-baseline.md` — 两份文档合起来覆盖质量门禁数值基线和策略
- `docs/guides/how-to-add-widget.md` → `docs/02-design/widget-development-guide.md` — 481行，Widget开发全流程指南（注册/目录/开发/测试/发布）
