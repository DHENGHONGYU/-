---
title: 23-core-docs-functional-match-report
code_version: 2.0.0

tier: reference
---


# V9 智能投研复盘系统 — 23个核心文档 · 功能匹配最终报告

> **报告生成时间**：2026-07-12
> **匹配方法**：按功能/内容匹配（非文件名匹配）
> **匹配原则**：英文大小写视同相似；关键词一致即视为功能等价

---

## 📊 统计汇总

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 已存在 | 4 | 功能等价，仅目录/文件名不同 |
| 🔶 部分满足 | 5 | 相关文档存在但功能未完全覆盖 |
| 🔴 缺失 | 14 | 完全不存在 |
| **合计** | **23** | — |

> **关键结论**：基于功能匹配的重新判定，23个核心文档中真正『缺失』的是 **14个**（非此前按文件名匹配的18个），另有 **5个** 可视为『部分满足』（已有相关文档但功能未完全覆盖），**4个** 已确认功能等价存在。

---

## 📋 详细判定清单

### A. 导航与治理

**1. `docs/README.md`** 🔴

- **预期功能**：顶层总入口（人工维护）
- **判定理由**：无人工维护的顶层总入口；00-readme.md偏实施且已漂移

**2. `./governance.md`** 🔴

- **预期功能**：文档治理公约（Frontmatter/DoD）
- **判定理由**：无文档治理公约；implementation-governance.md偏实施非全文档

### B. 架构设计

**3. `../explanation/overview.md`** ✅

- **预期功能**：V9全局架构说明（白盒+依赖图+5舱关系）
- **实际文档**：`../reference/v9-system-blueprint.md`
- **判定理由**：444行，标题『整体架构蓝图』，含五层架构、数据架构、路由映射、ADR索引、实施路线
- **备注**：目录错位：在01-requirements/而非architecture/

**4. `../explanation/cabins-overview.md`** 🔴

- **预期功能**：5舱体系总览（职责边界+协作关系+PortalShell）
- **判定理由**：无独立5舱体系总览；06-routing-specs仅含路由，input-cabin-spec仅input舱

**5. `../reports/release-management/README.md`** 🔴

- **预期功能**：ADR主索引（汇集9份ADR+新增流程）
- **判定理由**：9份ADR散落各子目录，无集中索引

**6. `../reports/release-management/README.md`** 🔴

- **预期功能**：ADR主索引（01-requirements路径）
- **判定理由**：01-requirements/adr/下无README.md

**7. `../reference/api-contract.md`** 🔶

- **预期功能**：统一接口契约（DataBridge/行情端点/事件名）
- **实际文档**：`../reference/api-contract.md`
- **判定理由**：仅交易模块API契约，非全局DataBridge/行情端点/事件名契约

### C. 功能模块

**8. `../explanation/data-layer-overview.md`** 🔶

- **预期功能**：端到端数据地图（dataLayer/IndexedDB/DataBridge/collection）
- **实际文档**：`../reference/v9-indexeddb-store-schema.md`
- **判定理由**：1009行，含25个Store完整Schema/索引/版本历史，但缺DataBridge/collection端到端数据地图

### C/F. 功能模块/AI工程

**9. `../prompts/store-integration-guide.md`** 🔴

- **预期功能**：Store集成规范（从prompts抽离）
- **判定理由**：无独立Store集成规范；仅prompts/store-prompt-template.md有片段

**10. `../prompts/service-integration-guide.md`** 🔴

- **预期功能**：Service集成规范（从prompts抽离）
- **判定理由**：无独立Service集成规范；仅prompts/service-prompt-template.md有片段

### D. 技术规范

**11. `../reference/coding-conventions.md`** ✅

- **预期功能**：整合编码条款+JSDoc+复杂度的单一标准页
- **实际文档**：`../reference/03-architecture-standards.md`
- **判定理由**：1199行，标题『架构标准』，含五层架构、调用铁律、数据访问规范、引擎层规范、映射层规范
- **备注**：目录错位：在01-requirements/而非standards/

**12. `../explanation/song-aesthetics.md`** 🔶

- **预期功能**：宋韵美学设计哲学（亮色stone/暗色neutral来由）
- **实际文档**：`../reference/design-tokens.md + ../reference/04-ui-ux-specs.md`
- **判定理由**：design-tokens 495行（令牌使用指南），ui-design-system 279行（含『宋瓷绿』『古铜金』提及），但无独立『宋韵美学』总述文档

**13. `../explanation/quality-gates-baseline.md`** ✅

- **预期功能**：audit:*脚本与门禁清单的说明文档
- **实际文档**：`../reference/09-quality-gates.md + ../explanation/quality-gates-baseline.md`
- **判定理由**：两份文档合起来覆盖质量门禁数值基线和策略；体系结构文档认为『偏数值缺说明』，但功能已覆盖

### E. 测试策略

**14. `../reference/test-catalog.md`** 🔴

- **预期功能**：集中测试用例目录（与feature-entry-list合并）
- **判定理由**：无集中测试用例目录；v9-test-cases.md偏一次性清单

### F. AI工程

**15. `../reference/README.md`** 🔶

- **预期功能**：AI工程入口（串联prompts/检查表/飞轮/记忆层）
- **实际文档**：`../reference/ai-memory-layer.md`
- **判定理由**：70行，含AI记忆层设计、索引、检索、与提示词结合，但缺prompts/检查表/飞轮的总览串联

### H. 跨域补充

**16. `../reference/security-model.md`** 🔴

- **预期功能**：整体安全/权限模型（超出MCP）
- **判定理由**：仅guides/mcp-acl-guide.md（MCP ACL），无整体安全/权限模型

**17. `../reference/deployment.md`** 🔴

- **预期功能**：部署架构（静态托管/GitHub Pages）
- **判定理由**：仅05-deployment/ADR-004 HashRouter，无部署架构文档

**18. `../explanation/runbook.md`** 🔴

- **预期功能**：运行/故障手册
- **判定理由**：无运行/故障手册

**19. `../tutorials/getting-started.md`** 🔴

- **预期功能**：新手教程（Diátaxis Tutorials）
- **判定理由**：根README.md为基础启动说明，非Diátaxis Tutorials风格的新手教程

**20. `../how-to/how-to-add-widget.md`** ✅

- **预期功能**：如何新增Widget（操作指南）
- **实际文档**：`../reference/widget-development-guide.md`
- **判定理由**：481行，Widget开发全流程指南（注册/目录/开发/测试/发布）
- **备注**：目录错位：在02-design/而非guides/

**21. `../how-to/how-to-add-store.md`** 🔴

- **预期功能**：如何新增Store（操作指南）
- **判定理由**：无『如何新增Store』操作指南；AGENTS.md四步集成有描述但非指南格式

**22. `../how-to/../how-to/how-to-add-service.md`** 🔴

- **预期功能**：如何新增Service（操作指南）
- **判定理由**：无『如何新增Service』操作指南；AGENTS.md四步集成有描述但非指南格式

**23. `../explanation/a11y-i18n.md`** 🔶

- **预期功能**：无障碍+国际化策略
- **实际文档**：`../explanation/a11y-checklist.md`
- **判定理由**：239行，含无障碍检查清单，但无i18n策略

---

## 🔴 真正缺失文档清单（按优先级排序）

### 🔴 高优先级

- **`docs/README.md`** — 所有角色的文档入口；修正00-readme.md漂移
- **`../explanation/cabins-overview.md`** — 5舱体系是V9核心卖点，当前仅input舱有spec
- **`../reports/release-management/README.md`** — 9份ADR散落，无集中索引影响检索效率
- **`../tutorials/getting-started.md`** — 新人onboarding必备，降低上手门槛

### 🟡 中优先级

- **`../explanation/data-layer-overview.md`** — 补齐DataBridge/collection端到端地图（V9_IndexedDB_Store_Schema已覆盖IndexedDB部分）
- **`../reference/README.md`** — AI工程入口，串联四件套（可从ai-memory-layer扩展）
- **`../explanation/song-aesthetics.md`** — 品牌设计哲学，可从design-tokens/ui-design-system提炼
- **`../reference/api-contract.md`** — 全局接口契约，可从DataBridge系列4份文档+API_CONTRACT整合

### 🟢 低优先级

- **`./governance.md`** — 文档保鲜度与DoD规则，可从00-readme.md提升
- **`../reference/test-catalog.md`** — 测试用例集中维护
- **`../prompts/store-integration-guide.md + ../prompts/service-integration-guide.md`** — 从prompts模板抽离为独立文档
- **`../reference/security-model.md`** — 安全合规
- **`../reference/deployment.md + ../explanation/runbook.md`** — 运维SRE
- **`../how-to/how-to-add-store.md + ../how-to/how-to-add-service.md`** — 操作指南（AGENTS.md已有四步集成描述）

---

## 🔄 目录错位修正建议

以下文档功能已确认等价，但存放目录与体系结构预期不符，建议后续做目录整理（非紧急）：

| 体系结构预期路径 | 实际路径 | 建议操作 |
|------------------|----------|----------|
| `../explanation/overview.md` | `../reference/v9-system-blueprint.md` | 建立软链接或迁移 |
| `../reference/coding-conventions.md` | `../reference/03-architecture-standards.md` | 建立软链接或迁移 |
| `../how-to/how-to-add-widget.md` | `../reference/widget-development-guide.md` | 建立软链接或迁移 |

---

## 📝 附录：与前期报告的修正对照

| 前期判定（文件名匹配） | 本次判定（功能匹配） | 修正说明 |
|------------------------|----------------------|----------|
| 18个缺失 | 14个缺失 | `v9-system-blueprint`、`03-architecture-standards` 功能等价确认 |
| 5个可能已存在 | 4个已存在 + 5个部分满足 | `V9_IndexedDB_Store_Schema`、`ai-memory-layer`、`API_CONTRACT`、`design-tokens`、`a11y-checklist` 功能部分覆盖 |

> **建议**：对『部分满足』的5个文档，无需从零新建，可在现有文档基础上补充扩展（如 `ai-memory-layer.md` 扩展为 `../README.md`，`../explanation/a11y-checklist.md` 补充i18n章节等）。
