---
doc_id: V9-DOC-DEV-019
title: "MCP 生命周期管理指南（入-移-出）"
domain: project
status: active
last_updated: 2026-08-17
code_version: 2.0.0-rc.2
---
covers_code:
  - src/mcp/core/server.ts
  - src/config/mcpAclMatrix.ts
  - src/mcp/__tests__/mcpAclInterceptor.test.ts


---
doc_id: V9-DOC-DEV-006
title: MCP 生命周期管理指南（入-移-出）
code_version: "2.0.0-rc.2"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# MCP 生命周期管理指南（入-移-出）

> **版本**: v1.0.0 | **日期**: 2026-07-22
> **适用范围**: `src/mcp/**` 下所有 MCP Server / Tool 的创建、迁移、废弃全生命周期
> **关联规范**:
> - [AGENTS.md §十四 MCP 权限控制规范](../../meta/AGENTS.md)（契约真相源）
> - [MCP 权限控制开发指南 mcp-acl-guide.md](./mcp-acl-guide.md)（ACL 配置权威）
> - [v9-code-quality-audit 技能](../../../.agents/skills/architecture-cleanup/SKILL.md)（交付前必跑；mcp-server-design-review 已并入此技能）
> **事实基线**: `src/mcp/servers/` 实测 **15** 个子服务器（analysis/backtest/data-collector/execution/fetcher/knowledge/llm/news/pool/portfolio/scoring/screening/system/trading/workflow）；其中 `audit:mcp-usage` 识别 **6 个零调用 server**，属"出"阶段清理对象。

---

## 一、入（创建）

新增 MCP Server 或 Tool 的标准作业流程（与 AGENTS.md 分层规则 + mcp-acl-guide §5 对齐）：

1. **目录命中**：新 Server 必须落在 `src/mcp/servers/<name>/`，基类继承 `MCPServerBase`（`src/mcp/core/server.ts`）；禁止在 `src/mcp/` 根或其他层新建散落 server 文件。
2. **命名命中**：
   - Server 名 = 目录名的小写短横（kebab），与 `src/config/mcpAclMatrix.ts` 的 `MCP_ACL_MATRIX` 键一致；
   - Tool 名遵循下划线通配符约定（`list_*`/`get_*`/`fetch_*`/`create_*`），见 mcp-acl-guide §3.3。
3. **ACL 配置（强制）**：按 mcp-acl-guide §5.1 在 `MCP_ACL_MATRIX` 配置角色权限，并在 `src/mcp/__tests__/mcpAclInterceptor.test.ts` 补充四角色对比用例。
4. **桥接注册**：通过 `mcpBridge.callTool` 暴露，禁止 `mcpRegistry.getServer().server.callTool()` 绕过 Client（mcp-acl-guide §4.3 禁止清单）。
5. **验证命令（必跑）**：
   ```bash
   npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts
   npm run audit:mcp
   npm run tsc:prod
   ```

> ⚠️ 触发 `v9-code-quality-audit` 技能（AGENTS.md 路由表 mandatory）：其「交付前必跑」未全绿不得声明完成。

---

## 二、移（迁移 / 重命名）

Server 或 Tool 重命名、目录迁移的标准作业流程（对标 [FILE-MANAGEMENT-GUIDE.md §6.3 文件迁移 SOP](./FILE-MANAGEMENT-GUIDE.md)）：

1. **影响评估**：列出所有 `mcpBridge.callTool('<oldName>', ...)` 调用点（含 `src/`、`tests/`、Agent prompt 模板）。
2. **原子重命名**：同步修改 ① 目录名 ② `MCP_ACL_MATRIX` 键 ③ 所有调用点 ④ 单元测试用例名。
3. **跨层检查（强制）**：迁移后必须 `npm run audit:layers` 确认无跨层违规；MCP 属 `src/mcp/`，禁止误迁入 `core`/`lib`/`config`。
4. **残留扫描（强制）**：用 `stale-path-reference-audit` 技能对旧 Server/Tool 名做九类文件（`.ts/.tsx/.md/.json/.mjs/.cjs/.yaml/.yml/.sh`）全仓 Grep 残留 + 交叉验证目标存在性，排除 `.encoding-scan.json`/备份噪声。
5. **文档同步**：更新 mcp-acl-guide 权限矩阵、AGENTS.md §一 目录描述、本指南事实基线计数。
6. **验证命令（必跑）**：
   ```bash
   npm run audit:mcp && npm run audit:mcp-usage
   npm run audit:layers
   npm run audit:docs
   ```

---

## 三、出（废弃 / 清理）

### 3.1 零调用 Server 清理

`audit:mcp-usage` 定期扫描全部注册 Server 的工具被调用情况，识别**零调用 server**（当前 6 个）。清理流程：

1. **标注废弃**：在 Server 入口加 `// @deprecated vX.Y.Z — 零调用，待清理` 注释，并在本指南事实基线登记。
2. **前置确认（三条件）**：
   - 达目标版本 / 或被新 Server 取代；
   - Grep 旧 Server 名全仓 **0 命中**调用点；
   - `audit:mcp` 0 违规、相关测试已迁移或删除。
3. **安全删除**：删除 `src/mcp/servers/<name>/` 目录 + `MCP_ACL_MATRIX` 对应键 + 残留测试；禁止删除仍被引用的 Server。
4. **更新计数**：同步 AGENTS.md §一 与本文「事实基线」的 server 总数。

### 3.2 Tool 废弃

- 旧 Tool 保留一个 release 周期（标注 `@deprecated`），新调用点改用新 Tool；
- 过期后从 Server handler 与 `MCP_ACL_MATRIX` 移除，并补「迁移说明」注释。

---

## 四、审计门禁清单

| 阶段 | 必跑命令 | 门禁意图 |
|------|----------|----------|
| 入 | `vitest mcpAclInterceptor` + `audit:mcp` + `tsc:prod` | ACL 配置 + 目录合规 + 类型 |
| 移 | `audit:mcp-usage` + `audit:layers` + `audit:docs` + 残留扫描 | 无跨层 + 无残留 + 文档同步 |
| 出 | `audit:mcp-usage` + `audit:mcp` | 零调用识别 + 删除安全 |

---

## 五、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-22 | 新建 MCP 入-移-出全生命周期指南；对齐 FILE-MANAGEMENT-GUIDE §6.3 迁移 SOP；事实基线计数修正为 15 server；绑定 `v9-code-quality-audit`(mandatory) 与 `audit:mcp-usage` 零调用清理（mcp-server-design-review 已并入） |
