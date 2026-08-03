---
title: mcp-module-status
tier: T2
status: active
type: reports
domain: project
doc_id: V9-DOC-AUTO-544060
code_version: 2.0.0
summary: title: mcp-module-status
maintainer: V9 Architecture Team
phase: retrospective
---


## 当前 Registry 状态（2026-07-13）

### Enabled（12）

| Server | 优先级 | 说明 |
|--------|--------|------|
| `fetcher:data` | high | 数据采集核心 |
| `scoring:v6` | high | V6 评分引擎 |
| `trading:main` | high | 交易主服务 |
| `analysis:main` | medium | ⚠️ 已禁用（零调用） |
| `news:main` | medium | 新闻分析 |
| `llm:main` | medium | LLM 服务 |
| `portfolio:main` | medium | ⚠️ 已禁用（零调用） |
| `screening:main` | medium | 保留，Agent 编排驱动 |
| `knowledge:local` | medium | ⚠️ 已禁用（零调用） |
| `backtest:main` | medium | 保留，参数复杂但引擎核心 |
| `stockpool:main` | medium | 保留，Agent 内省驱动 |
| `system:main` | medium | 系统管理 |
| `data-collector:main` | medium | 数据采集器 |
| `execution:main` | medium | ⚠️ 已禁用（零调用） |
| `workflow:main` | medium | ⚠️ 已禁用（零调用） |

> **实际 Enabled 数**：12（registry 中 15 个条目，3 个 enabled: false）

### Disabled（3）

| Server | 禁用日期 | 原因 | 恢复条件 |
|--------|---------|------|---------|
| `analysis:main` | 2026-07-13 | 零业务调用，无 Agent 配置 | Agent 分析编排需求明确时 |
| `portfolio:main` | 2026-07-13 | 零业务调用，无 Agent 配置 | 组合管理 Agent 上线时 |
| `knowledge:local` | 2026-07-13 | 零业务调用，无 Agent 配置 | 知识库问答 Agent 上线时 |
| `execution:main` | 2026-07-13 | 零业务调用，无 Agent 配置 | 自动执行 Agent 上线时 |
| `workflow:main` | 2026-07-13 | 零业务调用，无 Agent 配置 | 工作流编排 Agent 上线时 |

### 已移除（MCP 层）

| Server | 操作 | 日期 | 去向 | 说明 |
|--------|------|------|------|------|
| `trade:main` | 合并 | 2026-07-13 | `trading:main` | 功能重叠，d4200a7 合并正确 |
| `input:main` | 合并 | 2026-07-13 | `fetcher:data` | 6 工具与 fetcher 天然配合 |
| `export:main` | 降级 | 2026-07-13 | `src/services/export/backtestExportService.ts` | Store API 缺失，降级为 Service 函数 |
title: mcp-module-status
tier: T2
status: active
type: reports
doc_id: V9-DOC-AI-027
domain: ai
code_version: 2.0.0

---

## 变更历史（时间倒序）

### 2026-07-13 — P0+P1+P2 综合治理

**触发原因**：MCP 模块从 18 个膨胀到无法维护，需治理至 13 个。

**决策依据**：
- `screening` / `stockpool`：UI 直接调用，MCP 层无人使用，但保留 Agent 编排可能
- `trade` / `input`：与其他 Server 功能重叠
- `export`：`backtestStore.getBacktestById()` 缺失，从未可用
- `analysis` / `portfolio` / `knowledge` / `execution` / `workflow`：零调用

**执行操作**：
1. ✅ Registry 标记 5 个 Server `enabled: false`（analysis/portfolio/knowledge/execution/workflow）
2. ✅ 清理 ACL 中 trade/input/export 残留引用
3. ✅ 移除零引用类型 `TradeActionRequest` / `TradeActionResponse`
4. ✅ 注册 screening-agent + stockpool-inspector 到 Agent Registry
5. ✅ 补齐 `backtestStore` API：`getBacktestById`、`listBacktestHistory`、`exportReportById`
6. ✅ 新增 `history` 状态，回测完成后自动归档（上限 50 条）
7. ✅ BacktestPage 新增历史记录表格 UI
8. ✅ 编写 ADR-013 MCP Server 生命周期 SOP
9. ✅ mcpBridge 添加 Tool 调用计数器
10. ✅ 编写 `audit-mcp-tool-usage.ts` 月度审计脚本
11. ✅ 补充 10 个 backtestStore 测试用例（24/24 通过）

**验证结果**：
- `tsc --noEmit`：✅ 通过
- `audit:layers`：✅ 0 违规，880 文件
- `backtestStore.test.ts`：✅ 24/24 通过
- `backtestExportService.test.ts`：✅ 6/6 通过

### 2026-07-08 — P0 MCP 权限控制修复

**触发原因**：MCP 层缺乏权限控制，任何调用方都可调用任意 Tool。

**执行操作**：
- 新增 `mcpAclMatrix.ts` 定义 `agent`/`ui`/`ci`/`system` 四角色权限矩阵
- `callTool()` 透传 `callerContext` 至 `MCPClient` 进行权限校验

### 2026-07-05 — 批次 F MCP-DataBridge 集成

**触发原因**：MCP Tool 调用缺乏审计追踪。

**执行操作**：
- 新增 `MCPAuditLogger`，通过 `DataBridge.forward()` 写入 `executionLogs`
- 记录所有 Tool 调用的参数、结果、耗时、traceId

### 2026-07-04 — Phase 1 MCP 适配层建设

**触发原因**：引入 MCP 架构，需与现有 DataBridge/Store 层适配。

**执行操作**：
- 新增 `MCPBridge` 作为 MCP ↔ 现有架构适配层
- 实现 `callTool()`、`readResource()`、`getPrompt()` 便捷方法
- 引入 `nanoid` 生成 traceId

### 2026-07-04 — Phase 0 MCP 基础设施层建设

**触发原因**：建立 MCP 核心基础设施。

**执行操作**：
- 新增 `MCPRegistry` 全局注册中心
- 新增 `MCPServerBase` 基类
- 新增 `MCPClientImpl` 客户端实现
- 新增 `InProcessTransport` 进程内传输层

---

## 恢复流程

当 Disabled Server 需要恢复时，按以下流程执行：

1. 确认恢复条件已达成（见上表）
2. 在 Registry 中将 `enabled` 设为 `true`
3. 如需新增 Tool，更新 `mcpAclMatrix.ts` 的 `allowedTools`
4. 如需 Agent 调用，注册到 `agentComponentRegistry.ts`
5. 运行 `tsc --noEmit` 和 `audit:layers`
6. 补充/更新测试用例
7. 在本文件追加变更记录
8. 更新 `../../../CHANGELOG.md`

---

## 关联文件

| 文件 | 用途 |
|------|------|
| `src/config/mcpServerRegistry.ts` | Registry 配置（enabled/优先级） |
| `src/config/mcpAclMatrix.ts` | ACL 权限矩阵 |
| `src/components/organisms/agent/agentComponentRegistry.ts` | Agent 组件注册 |
| `src/mcp/bridge/mcpBridge.ts` | Tool 调用计数器 |
| `scripts/audit/audit-mcp-tool-usage.ts` | 月度审计脚本 |
| `../../reference/adr-mcp-server-lifecycle.md` | 生命周期 SOP |

---

*最后更新：2026-07-13*
