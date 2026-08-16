---
name: "collection-pipeline-testing"
description: "数据采集管线（data-collector）端到端测试与门禁。Invoke when 改动 src/services/data-collector/**、src/store/sevenDimConfigStore.ts、src/types/modules/collection.types.ts，或相关 vitest 失败；用于验证采集主链路（多源编排、MCP 源接入、CLI 桥接、降级与计分）在类型安全、层合规与真实取数层面的完整性。"
version: v1.0.0
last_updated: 2026-08-16
change_log:
  - version: v1.0.0
    changes: "初始版本：补齐 AGENTS.md 路由表声明但物理缺失的 mandatory 技能；门禁对齐路由表行（tsc:prod + audit:layers + 相关 vitest）"
    date: 2026-08-16
---

# 数据采集管线测试技能 (Collection Pipeline Testing) — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-08-16 | **校验基准**: V9 v2.0.0-rc.1
> **性质**: 质量门禁（mandatory），改动采集链路前/后必须跑通
> **输出格式**: 门禁退出码 + 采集质量报告

---

## 一、触发条件（Invoke When）

- 改动 `src/services/data-collector/**`（采集主链路、MCP 源适配层、E2E 测试）
- 改动 `src/store/sevenDimConfigStore.ts`（七维配置 store）
- 改动 `src/types/modules/collection.types.ts`（采集类型定义）
- 相关 vitest 失败（尤其 `e2eWestockQuality.test.ts` / `e2eWestockMcpChain.test.ts` / `westockMcpSource.test.ts`）
- 新增/调整任何实采数据源（含 MCP Server 接入，如 `marketdata:westock`）

---

## 二、交付前必跑门禁（mandatory）

下列命令**全部绿**方可声明完成（与 AGENTS.md 路由表行一致）：

```powershell
# 1. 类型检查（全量，必须 0 错误）
npx tsc --noEmit
npm run tsc:prod          # 生产文件子集类型门禁（注意：全量仍含 src/components/chart/** 既有未提交错误，与本链路无关）

# 2. 跨层调用审计（必须 0 违规）
npm run audit:layers

# 3. 相关采集链路单元测试 / 穿透全链 E2E
node node_modules/vitest/vitest.mjs run src/services/data-collector
```

> 关键约定：采集链路改动涉及 MCP 源（如 `marketdata:westock`）时，必须额外跑通
> `e2eWestockMcpChain.test.ts`（穿透 `mcpBridge.callTool → MCPClientImpl → MCPServerBase → handler → WestockCliBridge` 完整链路，
> 含 ACL 双层放行 + 字段透传 + CLI 失败降级 4 个确定性用例）。
> 真实 CLI 端到端由 `e2eWestockQuality.test.ts`（经可控桥接跑真实 CLI）覆盖，可用率须 ≥ 95%。

---

## 三、采集链路核心事实（避免重复踩坑）

- **`toToolResult(data)` 直接 `JSON.stringify(data)`** 进 `content[0].text`，**无 `{data}` 包装层**；
  解析 MCP 返回应直接 `JSON.parse(text)`，勿假设 `{data:...}`。
- **CLI 必须追加全局 `--raw`**：腾讯自选股 CLI 默认吐 markdown 表格，`parseJson` 必崩 → 源永远降级。
- **Windows `spawn('npx')` ENOENT**：必须用 `shell: true`（npx 仅提供 npx.cmd）。该跨平台缺陷仅 E2E 实测能暴露。
- **ACL**：`marketdata:westock` 默认角色 `system`（`caller:'system'` 整链放行）；UI 角色经 `mcpAclMatrix` 显式授予 `westock_*` 只读。

---

## 四、验证命令速查

```powershell
# 单跑穿透全链 E2E（默认 4 passed / 1 skipped）
node node_modules/vitest/vitest.mjs run src/services/data-collector/e2eWestockMcpChain.test.ts

# 真实 CLI 端到端（需网络 + CLI，默认 skip；手动开启）
$env:WESTOCK_LIVE_E2E="1"; node node_modules/vitest/vitest.mjs run src/services/data-collector/e2eWestockQuality.test.ts

# 类型 + 层审计
npx tsc --noEmit
npm run audit:layers
```

---

## 五、与已有 SKILL 的协同

| 已有 SKILL | 协同点 |
|-----------|--------|
| `v9-data-flow-integrity-audit` | 采集链路涉及 DataBridge 信封/ACL 时，先跑本技能门禁，再由其校验 `audit:acl-consistency` |
| `v9-module-sync-checklist` | 新增 MCP Server/注册表变更时，本技能门禁 + 其十域同步清单双跑 |
| `v9-mock-data-diagnosis` | 上线前 Mock 残留排查，与本技能质量门禁互补 |

---

## 六、版本记录

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-08-16 | 初始版本：补齐物理缺失的 mandatory 技能；门禁对齐路由表；固化采集链路关键事实（toToolResult 无包装 / --raw / shell:true / ACL） |
