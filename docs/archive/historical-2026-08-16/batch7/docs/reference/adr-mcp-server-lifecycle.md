---
title: adr-mcp-server-lifecycle
type: reference
domain: ai
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 项目 MCP 层经历了从 18 个 Server 到 13 个 Server 的治理过程。在此过程中暴露以下问题："
tags: [ai, adr, mcp, reference, documentation]
version: v1.1.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-AI-005
referenced_by: [V9-DOC-META-000, V9-DOC-PROD-005, V9-DOC-PROJ-176, V9-DOC-PROJ-149, V9-DOC-ARCH-013]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
  - version: v1.1.0
    changes: "P0-3 僵尸 Server 清理：补全 §2.3 ACL 清理 Checklist 执行记录，修正 §3.2 最终 Registry 配置描述（10 enabled + 5 disabled），新增 §3.3 本次清理记录"
    date: 2026-08-15
---

# ADR-013: MCP Server 生命周期管理 SOP

| 项目 | 内容 |
|------|------|
| **状态** | ? 已采纳 (Adopted) |
| **决策日期** | 2026-07-13 |
| **作者** | V9 架构治理小组 |
| **相关模块** | `src/config/mcpServerRegistry.ts`, `src/config/mcpAclMatrix.ts`, `src/agents/`, `src/mcp/bridge/mcpBridge.ts` |
| **影响范围** | MCP 模块注册表、Agent 编排层、ACL 权限矩阵、Tool 调用监控 |

---

## 1. 背景与问题

V9 项目 MCP 层经历了从 18 个 Server 到 13 个 Server 的治理过程。在此过程中暴露以下问题：

1. **功能重叠**：`trade` 与 `trading:main`、`input` 与 `fetcher:data` 存在功能边界不清，导致双轨并行。
2. **路径绕过**：`screening` / `stockpool` 被 UI 直接调用，MCP 层成为无人使用的"薄包装"。
3. **阻塞性依赖**：`export` 因 `backtestStore.getBacktestById()` 未实现，从未真正可用。
4. **决策缺乏记录**：合并/降级/保留的决策散落在聊天记录中，无文档化 SOP，导致 d4200a7 合并后又被 revert。

因此需要一套**可复用的 MCP Server 生命周期管理 SOP**，覆盖从评估、决策、执行到验证的完整流程。

---

## 2. 决策

### 2.1 生命周期状态机

```
[Active] ──(评估)──> [Under Review] ──(决策)──> [Merged] / [Downgraded] / [Disabled] / [Archived]
                                                            │
                                                            └────(恢复条件达成)──> [Active]
```

| 状态 | 含义 | 代码表现 |
|------|------|---------|
| **Active** | 正常运行，可被注册和调用 | `enabled: true`，在 Registry 中注册 |
| **Under Review** | 进入评估期，标记为待观察 | `enabled: true`，但添加 `@deprecated` 注释 |
| **Merged** | 功能合并至其他 Server，自身废弃 | `enabled: false`，代码保留至下一主版本 |
| **Downgraded** | 从 Server 降级为 Service 函数 | `enabled: false`，代码迁移至 `src/services/` |
| **Disabled** | 暂时禁用（保留恢复可能） | `enabled: false`，注释注明恢复条件 |
| **Archived** | 彻底移除（代码删除） | 代码从 `src/mcp/` 删除，仅历史文档保留 |

### 2.2 状态转换触发条件

| 转换 | 触发条件 | 审批要求 |
|------|---------|---------|
| Active → Under Review | 连续 30 天零调用（由 `audit-mcp-tool-usage.ts` 识别） | 技术负责人确认 |
| Under Review → Merged | 与其他 Server 功能重叠 ≥ 80%，且目标 Server 已覆盖 | 架构评审会议（≥2 人） |
| Under Review → Downgraded | 参数不适合 MCP Schema 表达，但引擎逻辑是核心资产 | 架构评审会议 + 产品确认 |
| Under Review → Disabled | 有 UI 路径绕过，MCP 层无人使用，但保留 Agent 编排可能 | 技术负责人 + 产品经理确认 |
| Disabled → Active | 恢复条件达成（如 Agent 编排上线、Store API 补齐） | 重新走 RFC 流程 |
| Merged/Downgraded → Archived | 代码保留满一个主版本周期（如 v2.0 → v3.0） | 架构评审会议 |

### 2.3 执行清单（Checklist）

任何状态变更必须完成以下检查项：

- [ ] **Registry 更新**：在 `src/config/mcpServerRegistry.ts` 中更新 `enabled` 字段和注释
- [ ] **ACL 清理**：在 `src/config/mcpAclMatrix.ts` 中清理对应 `allowedServers` 和 `allowedTools`
- [ ] **Agent 注册**：在 `src/agents/` 中新增/移除对应 Agent 配置（保留的 Server 必须注册 Agent）
- [ ] **类型清理**：移除 `src/types/modules/` 中零引用的类型定义
- [ ] **tsc 验证**：运行 `npx tsc --noEmit` 确认无类型错误
- [ ] **audit:layers 验证**：运行 `npm run audit:layers` 确认无跨层违规
- [ ] **文档更新**：在 `docs/specs/design/ADR/` 中新增或更新 ADR，记录决策原因和恢复条件
- [ ] **CHANGELOG 记录**：在 `CHANGELOG.md` 中记录变更

---

## 3. 已执行决策记录

### 3.1 本次治理（2026-07-13）

| Server | 原状态 | 新状态 | 原因 | 恢复条件 | 恢复审批 | 恢复检查项 |
|--------|--------|--------|------|---------|---------|----------|
| `analysis` | Active | **Disabled** | 零调用，无 Agent 配置 | Agent 分析编排需求明确时（如多维度交叉分析 Agent） | 架构评审会议 | tsc, audit:layers, Agent 注册, ACL 更新, ADR 更新 |
| `portfolio` | Active | **Disabled** | 零调用，无 Agent 配置 | 组合管理 Agent 上线时（如投资组合再平衡 Agent） | 架构评审会议 | tsc, audit:layers, Agent 注册, ACL 更新, ADR 更新 |
| `knowledge` | Active | **Disabled** | 零调用，无 Agent 配置 | 知识库问答 Agent 上线时（如本地研报检索 Agent） | 架构评审会议 | tsc, audit:layers, Agent 注册, ACL 更新, ADR 更新 |
| `execution` | Active | **Disabled** | 零调用，无 Agent 配置 | 自动执行 Agent 上线时（如执行计划自动调度 Agent） | 架构评审会议 | tsc, audit:layers, Agent 注册, ACL 更新, ADR 更新 |
| `workflow` | Active | **Disabled** | 零调用，无 Agent 配置 | 工作流编排 Agent 上线时（如多步骤工作流调度 Agent） | 架构评审会议 | tsc, audit:layers, Agent 注册, ACL 更新, ADR 更新 |
| `screening` | Active | **Active** | 保留，但需 Agent 编排驱动 | 已注册 `screening-agent` |
| `stockpool` | Active | **Active** | 保留，但需 Agent 内省驱动 | 已注册 `stockpool-agent` |
| `backtest` | Active | **Active** | 参数复杂不适合 MCP，但引擎是核心资产 | 参数简化或流水线 Agent 上线时 |
| `trade` | Active | **Merged** → Disabled | 与 `trading:main` 功能重叠，d4200a7 合并正确 | 不恢复，功能由 `trading:main` 覆盖 |
| `input` | Active | **Merged** → Disabled | 与 `fetcher:data` 天然配合，应合并 | 不恢复，功能由 `fetcher:data` 覆盖 |
| `export` | Active | **Downgraded** → Disabled | `backtestStore` API 缺失，从未可用 | `backtestStore.getBacktestById()` 实现后恢复 |

### 3.2 最终 Registry 配置（2026-08-15 更新）

```typescript
// Enabled（10）
fetcher:data, scoring:v6, trading:main, news:main, llm:main,
screening:main, backtest:main, pool:main, system:main, data-collector:main

// Disabled（5）- 详见 3.1 恢复条件
analysis:main, portfolio:main, knowledge:local, execution:main, workflow:main
```

**当前状态：15 个 Registry 条目（10 enabled / 5 disabled）**

**已移除（3）**：export（降级纯 Service）、trade（合并入 trading:main）、input（MCP 层移除）

### 3.3 P0-3 僵尸 Server ACL 残留清理（2026-08-15）

**问题**：§3.1 中 5 个 Disabled Server 在 `src/config/mcpAclMatrix.ts` 的 `ui` 角色 `allowedServers` 中仍残留 `analysis`、`portfolio` 两个入口，违反 §2.3 Checklist 中的 "ACL 清理" 项。

**清理范围**：
- 从 `MCP_ACL_MATRIX.ui.allowedServers` 移除 `analysis`、`portfolio`
- 同步修正 `src/config/mcpServerRegistry.ts` 头注释（原错误描述"15 个 enabled" → "10 enabled + 5 disabled"）
- 注：`knowledge:local`、`execution:main`、`workflow:main` 原本就不在 `ui` 角色白名单中，无需清理

**未清理项（保留代码以备恢复）**：
- 5 个 Disabled Server 的源码文件（`src/mcp/servers/{analysis,portfolio,knowledge,execution,workflow}/`）
- 5 个 Disabled Server 的单元测试（`src/mcp/__tests__/{analysisServer,portfolioServer,knowledgeServer,executionServer,workflowServer}.test.ts`）
- 原因：按 §2.1 状态机，"Disabled" 状态代码保留至下一主版本；若直接归档（删除代码），需走 §2.2 "Merged/Downgraded → Archived" 流程

**恢复路径**：
- 任意 Disabled Server 重新 `enabled: true` 时，须同步在 `MCP_ACL_MATRIX.ui.allowedServers` 中恢复对应入口
- 恢复时按 §4 模板在 `mcpServerRegistry.ts` 注释中记录恢复条件

---

## 4. 恢复条件模板

对于 Disabled 状态的 Server，必须在 Registry 注释中按以下模板记录恢复条件：

```typescript
{
  name: 'export:main',
  enabled: false,
  // 恢复条件：backtestStore.getBacktestById() 实现
  // 恢复审批：架构评审会议
  // 恢复检查项：tsc, audit:layers, Agent 注册, ACL 更新, ADR 更新
}
```

---

## 5. 监控机制

1. **月度审计**：`scripts/audit/audit-mcp-tool-usage.ts` 每月运行一次，输出：
   - 每个 Server 的 Tool 调用次数
   - 零调用 Server 列表（连续 30 天）
   - 建议变更状态（Under Review 推荐）

2. **实时计数**：`mcpBridge.callTool()` 中内置 `toolCallStats` 计数器，运行时可通过 `mcpBridge.getToolUsageStats()` 获取。

3. **CI 门禁**：`audit:layers` 和 `tsc` 作为每次提交的强制检查。

---

## 6. 教训与沉淀

| 教训 | 来源 | 预防措施 |
|------|------|---------|
| 合并后无文档记录，导致 revert | d4200a7 合并 trade 后无 ADR | 合并必须配套 ADR |
| 禁用 Server 后 ACL 未清理 | input/trade/export 残留在 ACL | 禁用必须执行 Checklist |
| 零引用类型未清理 | TradeActionRequest / TradeActionResponse | 类型清理纳入 Checklist |
| UI 绕过 MCP 导致 Server 闲置 | screening / stockpool | 新增 UI 时必须评估 MCP 路径 |

---

## 7. 参考

- `../reports/retrospectives/mcp-module-status.md` — 模块历史变更记录
- `src/config/mcpServerRegistry.ts` — Registry 配置
- `src/config/mcpAclMatrix.ts` — ACL 权限矩阵
- `src/mcp/bridge/mcpBridge.ts` — Tool 调用计数器
- `scripts/audit/audit-mcp-tool-usage.ts` — 月度审计脚本
