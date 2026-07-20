---
title: MCP 模块状态与历史变更记录
type: reports
domain: ai
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档用�?*：记�?MCP Server 生命周期中的所有状态变更，作为决策追溯依据�?>..."
tags: [ai, mcp, report, spec, log]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# MCP 模块状态与历史变更记录

> **文档用�?*：记�?MCP Server 生命周期中的所有状态变更，作为决策追溯依据�?> **维护规则**：每次变更后必须追加记录，禁止修改历史条目（仅可补充恢复条件）�?> **关联文档**：`../../reference/adr-mcp-server-lifecycle.md`

---

## 当前 Registry 状态（2026-07-13�?
### Enabled�?2�?
| Server | 优先�?| 说明 |
|--------|--------|------|
| `fetcher:data` | high | 数据采集核心 |
| `scoring:v6` | high | V6 评分引擎 |
| `trading:main` | high | 交易主服�?|
| `analysis:main` | medium | ⚠️ 已禁用（零调用） |
| `news:main` | medium | 新闻分析 |
| `llm:main` | medium | LLM 服务 |
| `portfolio:main` | medium | ⚠️ 已禁用（零调用） |
| `screening:main` | medium | 保留，Agent 编排驱动 |
| `knowledge:local` | medium | ⚠️ 已禁用（零调用） |
| `backtest:main` | medium | 保留，参数复杂但引擎核心 |
| `stockpool:main` | medium | 保留，Agent 内省驱动 |
| `system:main` | medium | 系统管理 |
| `data-collector:main` | medium | 数据采集�?|
| `execution:main` | medium | ⚠️ 已禁用（零调用） |
| `workflow:main` | medium | ⚠️ 已禁用（零调用） |

> **实际 Enabled �?*�?2（registry �?15 个条目，3 �?enabled: false�?
### Disabled�?�?
| Server | 禁用日期 | 原因 | 恢复条件 |
|--------|---------|------|---------|
| `analysis:main` | 2026-07-13 | 零业务调用，�?Agent 配置 | Agent 分析编排需求明确时 |
| `portfolio:main` | 2026-07-13 | 零业务调用，�?Agent 配置 | 组合管理 Agent 上线�?|
| `knowledge:local` | 2026-07-13 | 零业务调用，�?Agent 配置 | 知识库问�?Agent 上线�?|
| `execution:main` | 2026-07-13 | 零业务调用，�?Agent 配置 | 自动执行 Agent 上线�?|
| `workflow:main` | 2026-07-13 | 零业务调用，�?Agent 配置 | 工作流编�?Agent 上线�?|

### 已移除（MCP 层）

| Server | 操作 | 日期 | 去向 | 说明 |
|--------|------|------|------|------|
| `trade:main` | 合并 | 2026-07-13 | `trading:main` | 功能重叠，d4200a7 合并正确 |
| `input:main` | 合并 | 2026-07-13 | `fetcher:data` | 6 工具�?fetcher 天然配合 |
| `export:main` | 降级 | 2026-07-13 | `src/services/export/backtestExportService.ts` | Store API 缺失，降级为 Service 函数 |

---

## 变更历史（时间倒序�?
### 2026-07-13 �?P0+P1+P2 综合治理

**触发原因**：MCP 模块�?18 个膨胀到无法维护，需治理�?13 个�?
**决策依据**�?- `screening` / `stockpool`：UI 直接调用，MCP 层无人使用，但保�?Agent 编排可能
- `trade` / `input`：与其他 Server 功能重叠
- `export`：`backtestStore.getBacktestById()` 缺失，从未可�?- `analysis` / `portfolio` / `knowledge` / `execution` / `workflow`：零调用

**执行操作**�?1. �?Registry 标记 5 �?Server `enabled: false`（analysis/portfolio/knowledge/execution/workflow�?2. �?清理 ACL �?trade/input/export 残留引用
3. �?移除零引用类�?`TradeActionRequest` / `TradeActionResponse`
4. �?注册 screening-agent + stockpool-inspector �?Agent Registry
5. �?补齐 `backtestStore` API：`getBacktestById`、`listBacktestHistory`、`exportReportById`
6. �?新增 `history` 状态，回测完成后自动归档（上限 50 条）
7. �?BacktestPage 新增历史记录表格 UI
8. �?编写 ADR-013 MCP Server 生命周期 SOP
9. �?mcpBridge 添加 Tool 调用计数�?10. �?编写 `audit-mcp-tool-usage.ts` 月度审计脚本
11. �?补充 10 �?backtestStore 测试用例�?4/24 通过�?
**验证结果**�?- `tsc --noEmit`：✅ 通过
- `audit:layers`：✅ 0 违规�?80 文件
- `backtestStore.test.ts`：✅ 24/24 通过
- `backtestExportService.test.ts`：✅ 6/6 通过

### 2026-07-08 �?P0 MCP 权限控制修复

**触发原因**：MCP 层缺乏权限控制，任何调用方都可调用任�?Tool�?
**执行操作**�?- 新增 `mcpAclMatrix.ts` 定义 `agent`/`ui`/`ci`/`system` 四角色权限矩�?- `callTool()` 透传 `callerContext` �?`MCPClient` 进行权限校验

### 2026-07-05 �?批次 F MCP-DataBridge 集成

**触发原因**：MCP Tool 调用缺乏审计追踪�?
**执行操作**�?- 新增 `MCPAuditLogger`，通过 `DataBridge.forward()` 写入 `executionLogs`
- 记录所�?Tool 调用的参数、结果、耗时、traceId

### 2026-07-04 �?Phase 1 MCP 适配层建�?
**触发原因**：引�?MCP 架构，需与现�?DataBridge/Store 层适配�?
**执行操作**�?- 新增 `MCPBridge` 作为 MCP �?现有架构适配�?- 实现 `callTool()`、`readResource()`、`getPrompt()` 便捷方法
- 引入 `nanoid` 生成 traceId

### 2026-07-04 �?Phase 0 MCP 基础设施层建�?
**触发原因**：建�?MCP 核心基础设施�?
**执行操作**�?- 新增 `MCPRegistry` 全局注册中心
- 新增 `MCPServerBase` 基类
- 新增 `MCPClientImpl` 客户端实�?- 新增 `InProcessTransport` 进程内传输层

---

## 恢复流程

�?Disabled Server 需要恢复时，按以下流程执行�?
1. 确认恢复条件已达成（见上表）
2. �?Registry 中将 `enabled` 设为 `true`
3. 如需新增 Tool，更�?`mcpAclMatrix.ts` �?`allowedTools`
4. 如需 Agent 调用，注册到 `agentComponentRegistry.ts`
5. 运行 `tsc --noEmit` �?`audit:layers`
6. 补充/更新测试用例
7. 在本文件追加变更记录
8. 更新 `../../../CHANGELOG.md`

---

## 关联文件

| 文件 | 用�?|
|------|------|
| `src/config/mcpServerRegistry.ts` | Registry 配置（enabled/优先级） |
| `src/config/mcpAclMatrix.ts` | ACL 权限矩阵 |
| `src/components/organisms/agent/agentComponentRegistry.ts` | Agent 组件注册 |
| `src/mcp/bridge/mcpBridge.ts` | Tool 调用计数�?|
| `scripts/audit-mcp-tool-usage.ts` | 月度审计脚本 |
| `../../reference/adr-mcp-server-lifecycle.md` | 生命周期 SOP |

---

*最后更新：2026-07-13*
