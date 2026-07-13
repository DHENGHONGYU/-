---
name: "mcp-ui-acl-authorization"
description: "为 V9 MCP 体系的 ui 角色显式配置查询/导出类 Tool 授权，同时保持写操作被拒绝。处理 MCP Server 清理、合并或下线后，ACL 矩阵与测试契约、历史 Agent 配置、UI 调用点的同步。Invoke when user needs to authorize UI-layer MCP tools, reconcile ACL matrix after server removal/merge, or fix mcpAclInterceptor test failures related to ui role permissions."
---

# MCP UI 层 ACL 显式授权技能 — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-07-13 | **校验基准**: V9 v2.0.0 / AGENTS.md v1.4.6
> **任务性质**: 权限配置与测试契约同步，禁止扩大 system/agent 角色权限
> **输出格式**: 变更矩阵 + 测试翻转/新增清单 + 回归验证结果

---

## 一、触发条件（Invoke When）

- `src/mcp/__tests__/mcpAclInterceptor.test.ts` 中 `ui` 角色相关用例失败
- MCP Server 被移除/合并/下线后，历史测试或 Agent 配置仍引用旧 `serverName`
- UI 组件/页面需要调用 MCP Tool，但 `mcpAclInterceptor.check()` 返回 `allowed=false`
- 用户要求"UI 层 ACL 显式授权"或"放行查询类工具、拒绝写工具"
- `audit:mcp` 或 `mcp-acl-scenarios.integration.test.ts` 报告权限契约断裂

---

## 二、核心原则

| 原则 | 说明 |
|------|------|
| **查询/导出可放行** | UI 角色只允许 `list_*` / `get_*` / `fetch_*` / `health_check` 及显式列出的只读/导出工具 |
| **写操作必须显式排除** | 交易执行、股票池写入、数据库重置等写工具**不得**出现在 `ui.allowedTools` |
| **Server 级授权优先** | 若某 Server 完全不应被 UI 访问，不要加入 `ui.allowedServers`；工具级拒绝仅用于同 Server 内读写混合场景 |
| **兼容授权保留** | Server 已从 registry 移除（P0 清理）但测试/历史配置仍引用时，ACL 矩阵可保留其条目，避免契约立即断裂 |
| **测试契约同步** | 矩阵变更必须同步翻转/新增 `mcpAclInterceptor.test.ts` 与 `mcp-acl-scenarios.integration.test.ts` 断言 |

---

## 三、执行前检查清单

1. 读取 `src/config/mcpAclMatrix.ts` 的当前 `ui` 角色。
2. 读取 `src/config/mcpServerRegistry.ts`，确认目标 Server 是否仍注册/启用。
3. 读取 `src/mcp/__tests__/mcpAclInterceptor.test.ts` 中 `ui` 角色相关套件，记录当前期望。
4. 读取 `tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts` 套件 9（ui 角色场景）。
5. 确认待授权工具是**查询/分析/导出类**（非写操作）。

---

## 四、授权 SOP

### 步骤 1：更新 MCP_ACL_MATRIX

编辑 `src/config/mcpAclMatrix.ts`：

```typescript
ui: {
  allowedServers: [
    // 已存在的查询类 Server
    'fetcher', 'stockpool', 'scoring:v6', 'analysis', 'news', 'llm',
    'portfolio', 'screening', 'backtest', 'system', 'trading',
    // 兼容授权：Server 已不在 registry，但测试/历史配置仍引用
    'trade',
    'input',
    'export',
  ],
  allowedTools: [
    'health_check',
    'list_*',
    'get_*',
    'fetch_*',
    // ... 其他已授权工具
    // 兼容授权的非写工具
    'get_trades',
    'get_inputs',
    'export_backtest_report',
  ],
}
```

**注释要求**：在 `ui` 角色上方说明变更日期、原因、保留的兼容 Server 及显式排除的写工具清单。

### 步骤 2：同步测试断言

#### 2.1 `mcpAclInterceptor.test.ts`

- 将"ui 禁止访问 trade/input/export Server"改为"ui 允许访问其查询/导出 Tool"。
- 新增/保留"ui 拒绝调用 trade/input/trading 写工具"断言，且 `reason` 应包含 `not allowed to call tool`（工具级拒绝，非 server 级拒绝）。
- 若 Server 已不在 registry，测试仍只验证 ACL 拦截器逻辑，不验证 Server 存在性。

#### 2.2 `mcp-acl-scenarios.integration.test.ts`

- 套件 9 同意图翻转：允许查询、拒绝写。
- 确保用仍为禁止的 Server（如 `execution`）保留 server 级拒绝场景。

### 步骤 3：运行回归测试

```powershell
# ACL 拦截器单测
node node_modules/vitest/vitest.mjs run src/mcp/__tests__/mcpAclInterceptor.test.ts

# MCP 全量单测
node node_modules/vitest/vitest.mjs run src/mcp

# ACL 场景集成测试
node node_modules/vitest/vitest.mjs run tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts

# MCP 架构一致性
node node_modules/tsx/dist/cli.mjs scripts/audit-mcp.ts
```

通过标准：
- `mcpAclInterceptor.test.ts` 全部通过（75/75 基准）
- `src/mcp` 全量通过（242/242 基准）
- `audit:mcp` 0 违规/0 警告

---

## 五、常见陷阱与反模式

| 陷阱 | 表现 | 正确做法 |
|------|------|---------|
| 用 server 级拒绝替代工具级拒绝 | 写工具测试收到 `"not allowed to access server"`，期望是 `"not allowed to call tool"` | 把 Server 加入 `allowedServers`，写工具不加入 `allowedTools` |
| Server 已移除就同步删除 ACL 条目 | 历史测试/Agent 配置立即变红 | 保留兼容授权条目，并加注释说明 |
| 授权写工具到 ui 角色 | `execute_trade_action` / `create_buy_order` 被放行 | 在注释中显式列出排除清单，并在测试中新增拒绝断言 |
| 只改矩阵不改测试 | Husky 预提交中 `mcpAclInterceptor.test.ts` 失败 | 矩阵与测试必须同一次 commit |
| 新增工具后未判断角色 | UI 组件调用时 `caller` 缺省为 `agent` | UI 调用必须传 `{ caller: 'ui', callerId: 'ComponentName' }` |

---

## 六、验证清单

- [ ] `ui.allowedServers` 包含所有需要查询/导出的 Server（含兼容 Server）
- [ ] `ui.allowedTools` 仅含查询/分析/导出类工具，不含写工具
- [ ] 注释中列出显式排除的写工具清单
- [ ] `mcpAclInterceptor.test.ts` 允许查询、拒绝写工具断言通过
- [ ] `mcp-acl-scenarios.integration.test.ts` 同步翻转
- [ ] `audit:mcp` 0 违规
- [ ] `tsc:prod` 0 errors

---

## 七、相关文档

- [V9 AGENTS.md](../../AGENTS.md) §十四 MCP 权限控制规范
- [mcpAclMatrix.ts](../../../src/config/mcpAclMatrix.ts) 权限矩阵真相源
- [mcpAclInterceptor.test.ts](../../../src/mcp/__tests__/mcpAclInterceptor.test.ts) 测试契约
- [mcp-acl-scenarios.integration.test.ts](../../../tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts) 集成场景

---

## 八、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-13 | 初始版本：基于 P5 UI 层 ACL 显式授权实践总结，覆盖 trade/input/export 兼容授权、测试契约翻转、常见陷阱 |
