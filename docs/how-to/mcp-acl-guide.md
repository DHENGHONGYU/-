---
title: MCP 权限控制开发指�?
type: how-to
domain: ai
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本: v1.0.0 | 日期: 2026-07-08 适用范围: 所有通过 MCP 协议调用工具的开发场�?> 相关规范: [AGENTS.md §十四 MCP..."
tags: [ai, mcp, guide]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# MCP 权限控制开发指�?
> **版本**: v1.0.0 | **日期**: 2026-07-08
> **适用范围**: 所有通过 MCP 协议调用工具的开发场�?> **相关规范**: [AGENTS.md §十四 MCP 权限控制规范](../../AGENTS.md#十四mcp-权限控制规范v140-新增)

---

## 一、概�?
### 1.1 为什么需要权限控制？

V9 系统通过 MCP（Model Context Protocol）统一管理 16 �?Server 的工具调用。在权限控制上线前，任何调用方都可以通过 `mcpBridge.callTool` 调用所有工具，包括�?
- UI 组件可以调用交易类写操作（`create_buy_order`�?- CI 流水线可以访问业务数据（`stockpool.list_pool_stocks`�?- 未知调用方可以执行系统级危险操作（`system.reset_database`�?
这在金融级系统中是不可接受的安全风险�?
### 1.2 设计目标

- **纵深防御**：双端校验（Client 防君�?+ Server 防小人）
- **最小权�?*：每个角色只能访问其职责所需的工�?- **向后兼容**：现有代码无需修改即可工作（默�?`agent` 角色�?- **审计追踪**：所有调用都带有 `caller` �?`callerId` 标识

---

## 二、架构设�?
### 2.1 双端校验流程

```
调用方传�?context: { caller: 'ui', callerId: 'StockPoolPanel' }
        �?        �?┌──────────────────────────────────────────────────────────────�?�? MCPBridge.callTool(server, tool, args, context)              �?�?   透传 context �?client                                      �?└──────────────────────────────────────────────────────────────�?        �?        �?┌──────────────────────────────────────────────────────────────�?�? MCPClientImpl.callTool(server, tool, args, context)          �?�?                                                               �?�? �?检查点 1：Client 主拦截（防君子）                           �?�? ├─ resolveCaller(context?.caller) �?默认 'agent'              �?�? ├─ mcpAclInterceptor.check({caller, server, tool})            �?�? └─ 拒绝 �?返回 { isError: true, text: "ACL_PERMISSION_DENIED" }�?└──────────────────────────────────────────────────────────────�?        �?透传 context �?server.callTool(tool, args, context)
        �?┌──────────────────────────────────────────────────────────────�?�? MCPServerBase.callTool(name, args, context)                   �?�?                                                               �?�? �?检查点 2：Server 深度防御（防小人�?                        �?�? ├─ resolveCallerFromContext(context) �?优先 context.caller    �?�? �?                                       回退 defaultCallerRole�?�? ├─ this.assertServerPermission(caller, name)                  �?�? �?  └─ mcpAclInterceptor.assert() �?�?McpAclError            �?�? └─ catch McpAclError �?返回 { isError: true, text: "ACL_..." }�?└──────────────────────────────────────────────────────────────�?        �?        �?   tool.handler(args) 实际执行
```

### 2.2 为什么需要双端校验？

| 场景 | �?Client 校验 | �?Server 校验 | 双端校验 |
|------|----------------|----------------|---------|
| 正规调用（走 mcpBridge�?| �?拦截 | �?拦截 | �?拦截 |
| 绕过 Client 直接调用 Server | �?绕过 | �?拦截 | �?拦截 |
| Client 实现�?bug | �?失效 | �?兜底 | �?兜底 |
| Server 子类忘记调用 super | �?拦截 | �?绕过 | �?拦截 |

**结论**：金融级系统必须双端校验，任何单端校验都存在绕过风险�?
---

## 三、角色权限矩�?
### 3.1 四种调用方角�?
| 角色 | 用�?| 权限范围 | 典型场景 |
|------|------|---------|---------|
| `agent` | AI Agent 自主调用 | 全权�?| AgentRuntime 执行任务 |
| `ui` | UI 层调�?| 仅查询类 | 组件按钮、表单提�?|
| `ci` | CI 流水线调�?| �?system Server 查询/迁移 | GitHub Actions |
| `system` | 系统内部调用 | 全权�?| Bootstrap、迁移、Dashboard |

### 3.2 权限矩阵速查�?
| Server\角色 | agent | ui | ci | system |
|-------------|-------|-----|-----|--------|
| fetcher | �?| �?| �?| �?|
| stockpool | �?| �?| �?| �?|
| scoring:v6 | �?| �?| �?| �?|
| analysis | �?| �?| �?| �?|
| news | �?| �?| �?| �?|
| llm | �?| �?| �?| �?|
| portfolio | �?| �?| �?| �?|
| screening | �?| �?| �?| �?|
| backtest | �?| �?| �?| �?|
| trading | �?| �?| �?| �?|
| execution | �?| �?| �?| �?|
| trade | �?| �?| �?| �?|
| input | �?| �?| �?| �?|
| export | �?| �?| �?| �?|
| data-collector | �?| �?| �?| �?|
| system | �?| �?| ✅（仅查询） | �?|

### 3.3 Tool 通配符规�?
| 通配符模�?| 匹配示例 | 不匹配示�?|
|-----------|---------|-----------|
| `'*'` | 任意字符�?| �?|
| `'list_*'` | `list_pool_stocks`, `list_groups` | `listpoolstocks`（缺下划线） |
| `'get_*'` | `get_engine_config`, `get_stats` | `getstats`（缺下划线） |
| `'fetch_*'` | `fetch_news`, `fetch_kline` | `fetchnews`（缺下划线） |
| `'health_check'` | `health_check` | `healthcheck` |

---

## 四、调用方适配指南

### 4.1 角色选择决策�?
```
新增 mcpBridge.callTool 调用�?├── 调用方是 AI Agent（AgentRuntime）？
�?  └── �?{ caller: 'agent', callerId: agentId }
├── 调用方是 UI 组件（按�?表单）？
�?  ├── 仅查询类操作 �?{ caller: 'ui', callerId: 'ComponentName' }
�?  └── 系统管理工具（Dashboard 等） �?{ caller: 'system', callerId: 'ComponentName' }
├── 调用方是 CI 流水线？
�?  └── �?{ caller: 'ci', callerId: 'github-actions' }
├── 调用方是系统内部（Bootstrap/迁移/Transport）？
�?  └── �?{ caller: 'system', callerId: 'ModuleName' }
└── 不确定？
    └── �?默认 { caller: 'agent' }（全权限，但需在代码审查时确认�?```

### 4.2 场景示例

#### 场景 1: UI 组件调用查询工具

```typescript
// StockPoolPanel.tsx �?股票池面板组�?import { mcpBridge } from '@/mcp/bridge/mcpBridge'

const result = await mcpBridge.callTool(
  'stockpool',
  'list_pool_stocks',
  { group: '默认分组' },
  { caller: 'ui', callerId: 'StockPoolPanel' },
)
```

#### 场景 2: AI Agent 自主调用

```typescript
// agentRuntime.ts �?Agent 执行任务
const result = await mcpBridge.callTool(
  serverName,
  toolName,
  task.payload as Record<string, unknown>,
  { caller: 'agent', callerId: agentId },
)
```

#### 场景 3: CI 流水线调用迁移工�?
```typescript
// migration-script.ts �?CI 迁移脚本
const result = await mcpBridge.callTool(
  'system',
  'generate_migration_report',
  { migrationReport: report },
  { caller: 'ci', callerId: 'github-actions' },
)
```

#### 场景 4: 系统内部调用（迁移组件）

```typescript
// useMcpMigration.ts �?系统迁移 Hook
const MIGRATION_CALLER_CONTEXT: McpCallerContext = {
  caller: 'system',
  callerId: 'useMcpMigration',
}

const result = await mcpBridge.callTool(
  'system',
  'run_v6_migration',
  args,
  MIGRATION_CALLER_CONTEXT,
)
```

### 4.3 禁止清单

- �?禁止 `mcpRegistry.getServer().server.callTool()` 直接调用（绕�?Client�?- �?禁止省略 `context` 参数（除非是向后兼容的旧代码�?- �?禁止�?UI 组件中用 `caller: 'agent'` 规避权限限制
- �?禁止�?`caller: 'system'` 掩盖本应限制权限�?UI 调用

---

## 五、新�?Server/Tool SOP

### 5.1 新增 MCP Server 权限配置

**步骤 1**: �?`src/config/mcpAclMatrix.ts` �?`MCP_ACL_MATRIX` 中配置权限：

```typescript
// 如果�?Server 是查询类（UI 可访问）
ui: {
  allowedServers: [..., 'newServer'],
  allowedTools: [..., 'new_query_tool'],
}

// 如果�?Server 是写操作类（�?agent/system 可访问）
// 不需要修�?ui 角色配置，默认就被拒�?```

**步骤 2**: 更新单元测试 `src/mcp/__tests__/mcpAclInterceptor.test.ts`�?
```typescript
// �?四角色权限对比矩�?套件中新�?{
  desc: 'newServer.new_tool（查询类�?,
  server: 'newServer', tool: 'new_tool',
  expected: { agent: true, ui: true, ci: false, system: true },
}
```

**步骤 3**: 运行验证�?
```powershell
npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts
```

### 5.2 新增 Tool 权限配置

根据 Tool 性质选择配置方式�?
| Tool 类型 | 配置方式 | 示例 |
|-----------|---------|------|
| 查询�?| 添加通配符（自动覆盖�?| `'get_*'`、`'list_*'` |
| 写操�?| 显式列出 Tool �?| `'create_order'` |
| 危险操作 | 仅允�?agent/system | 不添加到 ui/ci |

---

## 六、故障排�?
### 6.1 ACL_PERMISSION_DENIED 错误

**错误现象**�?
```json
{
  "content": [{ "type": "text", "text": "ACL_PERMISSION_DENIED: Caller \"ui\" is not allowed to access server \"trading\"" }],
  "isError": true
}
```

**排查步骤**�?
1. **检�?caller 角色**：确�?`context.caller` 是否传入正确的角�?2. **检�?Server 权限**：查�?`MCP_ACL_MATRIX[caller].allowedServers` 是否包含目标 Server
3. **检�?Tool 权限**：查�?`MCP_ACL_MATRIX[caller].allowedTools` 是否匹配目标 Tool
4. **检查通配�?*：确认通配符模式正确（注意 `list_*` 需�?`list_` 前缀�?
### 6.2 常见错误原因

| 错误原因 | 解决方案 |
|---------|---------|
| 未传�?context 参数 | 添加 `{ caller: 'ui', callerId: 'ComponentName' }` |
| caller 角色错误 | 根据决策树选择正确角色 |
| Server 不在允许列表 | �?`MCP_ACL_MATRIX` 中添�?Server |
| Tool 不匹配通配�?| 检�?Tool 名是否包含下划线（`list_pool_stocks` ✅，`listpoolstocks` ❌） |
| 绕过 Client 直接调用 Server | 改用 `mcpBridge.callTool` �?Client 拦截 |

### 6.3 日志关键�?
```bash
# 权限拒绝日志
[MCP:ACL] server denied: caller="ui", server="trading"
[MCP:ACL] tool denied: caller="ui", server="stockpool", tool="delete_stock"
[MCP:ACL] caller role not found: guest

# 权限通过日志
[MCP:ACL] granted: caller="agent", server="fetcher", tool="health_check"
```

---

## 七、测试验�?
### 7.1 单元测试

```powershell
# MCP ACL 拦截器单元测试（72 用例�?npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts
```

**测试覆盖**�?- 权限矩阵配置完整性（4 用例�?- 4 种角色权限验证（14 用例�?- 权限拒绝场景全覆盖（30 用例�?- 四角色权限对比矩阵（8 用例�?- assert() 拒绝场景�? 用例�?- 通配符边界场景（3 用例�?- resolveCaller() 默认值（2 用例�?- 其他边界场景�? 用例�?
### 7.2 集成测试

```powershell
# MCP Server 全链路集成测�?npx vitest run tests/__tests__/integration/mcp-servers.integration.test.ts
```

---

## 八、相关文件索�?
| 文件 | 用�?|
|------|------|
| [src/types/modules/mcp.types.ts](../../src/types/modules/mcp.types.ts) | `McpCallerRole` / `McpCallerContext` 类型定义 |
| [src/config/mcpAclMatrix.ts](../../src/config/mcpAclMatrix.ts) | `MCP_ACL_MATRIX` 权限矩阵常量 |
| [src/mcp/core/mcpAclInterceptor.ts](../../src/mcp/core/mcpAclInterceptor.ts) | `mcpAclInterceptor` 拦截器实�?|
| [src/mcp/core/server.ts](../../src/mcp/core/server.ts) | `MCPServerBase` 基类（含 `assertServerPermission`�?|
| [src/mcp/core/client.ts](../../src/mcp/core/client.ts) | `MCPClientImpl` Client 实现（主拦截点） |
| [src/mcp/bridge/mcpBridge.ts](../../src/mcp/bridge/mcpBridge.ts) | `MCPBridge` 桥接层（透传 context�?|
| [src/mcp/__tests__/mcpAclInterceptor.test.ts](../../src/mcp/__tests__/mcpAclInterceptor.test.ts) | 72 个单元测试用�?|
| [AGENTS.md §十四](../../AGENTS.md#十四mcp-权限控制规范v140-新增) | AI 行为约束契约 |
