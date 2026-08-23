---
skill_id: V9-SKILL-MCP-UI-ACL-AUTHORIZATION
name: "mcp-ui-acl-authorization"
description: "为 V9 MCP 体系的 ui 角色显式配置查询/导出类 Tool 授权，同时保持写操作被拒绝。处理 MCP Server 清理、合并或下线后，ACL 矩阵与测试契约、历史 Agent 配置、UI 调用点的同步。Invoke when user needs to authorize UI-layer MCP tools, reconcile ACL matrix after server removal/merge, fix mcpAclInterceptor test failures related to ui role permissions, audit:mcp 报告权限契约断裂，或 UI 组件收到 allowed=false 却需要只读类工具放行。"
version: "v1.0.3"
last_updated: "2026-08-23"
change_log:
  - version: v1.0.3
    changes: "跨平台 SKILL 体系统一(2026-08-23)：补全 skill_id 对齐 registry，junction 单一物理源加载，统一索引与跨平台加载契约登记"
    date: 2026-08-23
  - version: v1.0.2
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥5，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 5+段自定义标题（核心原则+检查清单+授权SOP+陷阱+验证清单）合并重映射为标准一~五段；§二前置检查合并原则+清单并表格化（7 项）；§三授权 SOP 拆 4 个 Phase；§四扩展至 8 条教训（后果+规避双字段）；§五交付物≥10 项+必要且充分条件声明；补 mandatory 字段对齐 registry。"
    date: 2026-08-21
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: false
---

# MCP UI 层 ACL 显式授权技能 — v1.0.2

> **版本**: v1.0.2 | **日期**: 2026-08-21 | **校验基准**: V9 v2.0.0 / AGENTS.md v1.4.6 §十四 MCP 权限控制规范
> **任务性质**: 权限配置与测试契约同步，禁止扩大 system/agent 角色权限；ui 角色只允许查询/导出类工具放行
> **输出格式**: 变更矩阵 + 测试翻转/新增清单 + 四级回归结果 + 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求为 UI 层 MCP 工具配置 ACL 授权、放行查询类工具同时拒绝写工具；或在 Server 移除/合并/下线后同步 ACL 矩阵、测试契约、历史 Agent 配置、UI 调用点四端
- **显式触发 2**：怀疑某写工具（execute_trade_action / create_buy_order / reset_database）因疏忽被加入 `ui.allowedTools`；或 UI 调用 `run_mcp` 时 `caller` 缺省为 `agent` 导致权限归属错位
- **脚本/审计触发 3**：`src/mcp/__tests__/mcpAclInterceptor.test.ts` 中 `ui` 角色相关用例 FAIL；或 `tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts` 套件 9（ui 角色场景）断言不成立；或 `npm run audit:mcp` 报告权限契约断裂
- **脚本/审计触发 4**：UI 组件/页面合法调用只读 MCP Tool，但 `mcpAclInterceptor.check()` 返回 `{ allowed: false, reason: ... }` 业务被误阻断；或 Grep 全仓 UI 调用点缺 `{ caller: 'ui' }` 参数
- **设计/协议触发 5**：MCP Server 新增/移除/合并/重命名（serverName 变更）或下线后，历史测试或 Agent 配置仍引用旧 serverName 需保留兼容授权或同步清理；AGENTS.md §十四 MCP 权限控制规范版本更新后存量 ACL 矩阵重评

**不触发场景 · 减少误激活**：
- system / agent / admin 角色的授权变更（本 Skill 专管 ui 角色）；
- 新增 server 但默认不让 UI 访问、且测试未受影响；
- 纯 MCP Tool 业务 bug（非 ACL 拒绝）。

**协作 Skill / 链式调用**：
- 审计前置→`db-reference-audit`（若变更涉及 ACL_MATRIX 与 registry 引用一致性）
- Server 清理→`v9-module-sync-checklist`（十域同步校对：registry/ACL/测试/文档/Agent 配置）
- 测试失败定位→`v9-tsc-test-error-diagnosis`（若契约漂移连带测试 TS 报错）

---

## 二、前置检查

> **铁律: 先扫后改，禁止跳过 Server 注册状态确认与测试基线保存**。未完成下表 1-7 项前，不得编辑 `mcpAclMatrix.ts` 或测试断言；禁止用 server 级拒绝偷懒替代工具级拒绝。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 读取当前 ui 角色矩阵 | 读取 `src/config/mcpAclMatrix.ts` 的 `ui.allowedServers`、`ui.allowedTools`，列出其当前长度 | 有变更前快照（复制保存为临时对比用） |
| 2 | 确认目标 Server 注册状态 | 读 `src/config/mcpServerRegistry.ts`：目标 serverName 是否仍注册、是否 `enabled: true` | Server 存在 / 已移除 两种状态任一明确；若已移除标记为「兼容授权」 |
| 3 | 保存测试基线 | 先跑一次 `mcpAclInterceptor.test.ts`，记录 FAIL/PASS 数量与失败用例名；同理跑 `mcp-acl-scenarios.integration.test.ts` | 有「变更前」测试输出快照，避免把历史 FAIL 归因到本次 |
| 4 | 工具读写属性确认 | 逐个核对待授权工具名：`list_*` / `get_*` / `fetch_*` / `health_check` / `export_*` 属只读；`create_*` / `update_*` / `delete_*` / `execute_*` / `reset_*` 属写 | 待授权清单 100% 为只读/导出类；写工具列入显式排除清单 |
| 5 | UI 调用点 caller 检查 | Grep `run_mcp\(` / `mcpBridge\.(query\|forward)` 于 `src/pages/**`、`src/components/**`，检查是否传 `{ caller: 'ui', callerId: '...' }` | 列表列出所有缺 caller 或 caller='agent' 的 UI 调用点，本次或跟随 issue 同步修复 |
| 6 | 历史 Agent 配置扫描 | Grep 配置文件（`.agents/**`、`src/config/mcpAgentPresets.*` 等）中是否引用目标 serverName/Tool | 存在则标记：若 Server 下线，决定 ACL 矩阵保留兼容条目还是同批次清理 |
| 7 | 快照备份 | `git status --short > outputs/mcp-ui-acl-before.txt`；备份当前矩阵原始行号区间 | 有变更前磁盘状态快照 |

---

## 三、阶段化 SOP

按 4 个 Phase 顺序执行，禁止跳过 Phase 3 四级回归：

### **目标**：ui 角色查询/导出工具放行率精确达标，写工具拒绝率 100%；矩阵↔测试↔集成↔审计四契约零漂移。

### Phase 1 · 更新 MCP_ACL_MATRIX

**交付物**: 变更后矩阵 diff + 注释清单

编辑 `src/config/mcpAclMatrix.ts`：

```typescript
ui: {
  allowedServers: [
    // 已存在的查询类 Server
    'fetcher', 'pool', 'scoring:v6', 'analysis', 'news', 'llm',
    'portfolio', 'screening', 'backtest', 'system', 'trading',
  ],
  allowedTools: [
    'health_check',
    'list_*',
    'get_*',
    'fetch_*',
    // ... 其他已授权工具
    // 兼容授权的非写工具（Server 已从 registry 移除但历史配置仍引用）
    'get_trades',
    'get_inputs',
    'export_backtest_report',
  ],
}
```

**注释硬性要求**：在 `ui` 角色上方，添加 JSDoc 块注释说明：
- 变更日期、变更人、变更原因；
- 兼容授权保留的 Server 清单（为何保留、计划何时清理）；
- **显式排除的写工具清单**（例如：`execute_trade_action / create_buy_order / reset_database / delete_pool_group 不得加入 allowedTools`）。

### Phase 2 · 同步测试断言（双套件翻转）

**交付物**: mcpAclInterceptor 单测翻转清单 + mcp-acl-scenarios 集成翻转清单

#### 2.1 `mcpAclInterceptor.test.ts`（单元层）
- 把"ui 禁止访问 trade/input/export Server"的 server 级拒绝断言，改为"ui 允许访问其查询/导出 Tool"；
- **新增/保留** ui 拒绝调用写工具断言，且 `reason` 必须包含 `"not allowed to call tool"`（工具级拒绝，非 `"not allowed to access server"` server 级拒绝，两者语义不可混淆）；
- Server 已不在 registry 的条目：测试只验证 ACL 拦截器矩阵逻辑，不额外校验 Server 是否存在于 registry（避免立即契约断裂）。

#### 2.2 `mcp-acl-scenarios.integration.test.ts`（集成层）
- 套件 9（ui 角色场景）同意图翻转：允许查询、拒绝写；
- 对仍被 server 级禁止的 Server（如 `execution`）保留 server 级拒绝场景，确保反向覆盖不丢失；
- 若新增工具名，对应加 1 条 allow + 1 条 write-tool-deny 场景（成对新增）。

### Phase 3 · 四级回归测试

**交付物**: 4 份测试/审计报告（必须附于 PR）

```powershell
# 1) ACL 拦截器单测（核心契约）
node node_modules/vitest/vitest.mjs run src/mcp/__tests__/mcpAclInterceptor.test.ts `
  2>&1 | Tee-Object outputs/mcp-ui-acl-step3-interceptor.txt

# 2) MCP 全量单测（防副效用）
node node_modules/vitest/vitest.mjs run src/mcp `
  2>&1 | Tee-Object outputs/mcp-ui-acl-step3-mcp-all.txt

# 3) ACL 场景集成测试（端到端契约）
node node_modules/vitest/vitest.mjs run tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts `
  2>&1 | Tee-Object outputs/mcp-ui-acl-step3-scenarios.txt

# 4) MCP 架构一致性审计（ACL ↔ Registry ↔ Server 三角对齐）
node node_modules/tsx/dist/cli.mjs scripts/audit-mcp.ts `
  2>&1 | Tee-Object outputs/mcp-ui-acl-step3-auditmcp.txt
```

通过标准：
- `mcpAclInterceptor.test.ts` 全部通过（≥ 基准 75/75）；
- `src/mcp` 全量通过（≥ 基准 242/242）；
- `mcp-acl-scenarios.integration.test.ts` 套件 9 全通过；
- `audit:mcp` 0 违规 / 0 警告。

### Phase 4 · 可选：UI caller 修正 + Agent 配置同步

**交付物**: UI 调用点 caller 补全清单（若存在）+ Agent 配置清理清单（若执行）

- 对 §二-5 列出的缺 caller 的 UI 调用点，统一补 `{ caller: 'ui', callerId: '<ComponentName>' }`；
- 若 §二-6 标记了 Server 下线后同步清理 Agent 配置，则同步修改并跑对应场景；
- 重新跑一次 Phase 3 确认副效用 0。

---

## 四、陷阱与经验教训

| # | 教训 | 后果 | 规避方法 |
|---|------|------|---------|
| 1 | 用 server 级拒绝替代工具级拒绝 | 写工具测试收到 `"not allowed to access server"`，实际期望 `"not allowed to call tool"`；拦截器语义错位，后续 server 加入 allowedServers 时写工具会被意外放行 | 把混合读写的 Server 加入 `allowedServers`，写工具不加入 `allowedTools`，依靠工具级拒绝提供更细粒度 |
| 2 | Server 已移除就立即删除 ACL 条目 | 历史测试、Agent 配置、UI 调用点立即全红，引发"变更雪崩" | 保留兼容授权条目，并加注释标记「兼容保留 · SERVER=<下线日期> · 预计 <清理日期> 移除」；给迁移留缓冲窗口 |
| 3 | 疏忽把写工具授权到 ui 角色 | `execute_trade_action` / `create_buy_order` / `reset_database` 被 UI 层任意调用，存在证券交易执行、数据污染、资金风险 | 在矩阵注释中显式列出写工具排除清单；并在单测中为每个排除项单独加 1 条拒绝断言 |
| 4 | 只改矩阵不改测试契约 | Husky 预提交钩子中 `mcpAclInterceptor.test.ts` 直接 FAIL，阻塞全团队提交 | 矩阵变更与双套件（单元+集成）翻转必须在同一次 commit，通过 `git commit --only` 把变更严格绑定 |
| 5 | UI 调用传 `caller='agent'` 或缺省 | 实际业务从 UI 发起但 ACL 按 agent 角色判定，放行/拒绝的结果与 ui 角色规范不一致，审计会报权限归属错位 | Grep UI 代码中所有 `run_mcp` 调用，强制 `{ caller: 'ui', callerId: '<ComponentName>' }`；review checklist 必核 |
| 6 | 新增工具但未同步 ACL 矩阵 | 上线后 UI 调用新工具直接被拒，业务故障回滚 | 新增 MCP Tool 时在 PR 模板内加入「三问」：①谁调用（ui/agent/system）？②读还是写？③对应 allowedServers/allowedTools 是否对齐 |
| 7 | 只跑单测不跑集成 audit:mcp | 单元通过但矩阵-注册-测试三角漂移，Husky / CI 的 audit:mcp 在后续提交才 FAIL，根因难以回溯 | Phase 3 四级（单测/MCP全量/集成/审计）必须全跑并附 PR，缺一不可 |
| 8 | 兼容授权条目长期未清理 | 1 个月后变成僵尸条目，新成员不清楚"为什么允许 UI 访问一个不存在的 Server"，越积越多导致矩阵臃肿难审 | 注释内写清理日期；每月架构巡检按过期日期批量清理，并跑一次完整 Phase 3 回归验证 |

---

## 五、完成交付物清单

### 5.1 交付物清单（≥10 项 · 完成打勾）

- [x] **1. 变更前矩阵快照**：`mcpAclMatrix.ts` 的 ui 角色 allowedServers/allowedTools 变更前清单
- [x] **2. Server 注册状态确认表**：目标 serverName 在 registry 中 enabled / disabled / 已移除 三态标记
- [ ] **3. 变更前测试基线**：`mcpAclInterceptor.test.ts` + `mcp-acl-scenarios.integration.test.ts` 变更前 PASS/FAIL 数与失败用例名
- [ ] **4. 工具读写属性判定清单**：每个待授权工具判定为只读 / 写（写工具列入显式排除清单）
- [ ] **5. 变更后矩阵 diff**：`git diff -- src/config/mcpAclMatrix.ts`，含注释块（变更日期/兼容 Server/排除写工具）
- [ ] **6. mcpAclInterceptor 单测翻转清单**：allow 翻转数 + write-deny 新增数 / 保留数
- [ ] **7. mcp-acl-scenarios 集成翻转清单**：套件 9 allow/deny 场景变更对照表
- [ ] **8. Phase 3-1 拦截器单测报告**：`outputs/mcp-ui-acl-step3-interceptor.txt`（≥ 基准 PASS 数）
- [ ] **9. Phase 3-2 MCP 全量单测报告**：`outputs/mcp-ui-acl-step3-mcp-all.txt`（≥ 基准 PASS 数）
- [ ] **10. Phase 3-3 集成场景报告**：`outputs/mcp-ui-acl-step3-scenarios.txt`（套件 9 全绿）
- [ ] **11. Phase 3-4 audit:mcp 报告**：`outputs/mcp-ui-acl-step3-auditmcp.txt`（0 违规 / 0 警告）
- [ ] **12. UI caller 补全清单**（若存在）：修正的组件名 + 文件路径 + callerId 规范
- [ ] **13. Agent 配置清理清单**（若执行）：清理的 serverName/Tool 条目 + 影响面说明
- [ ] **14. 迁移后快照**：`git status --short > outputs/mcp-ui-acl-after.txt`，确认未越权修改无关文件

### 5.2 必要且充分条件

> **当且仅当**以下 4 条**同时成立**，方可声称本次 UI 层 ACL 授权完成并允许关闭对应 Issue / PR：
> 1. `ui.allowedTools` **只包含**查询/分析/导出类工具（读 + 导出），所有写工具 0 命中；并在注释中给出了**显式排除的写工具清单**（非空，至少列出该 Server 已知写工具名）；
> 2. 矩阵↔单测↔集成测试↔审计 四契约零漂移：`mcpAclInterceptor.test.ts` + `mcp-acl-scenarios.integration.test.ts` 全通过 + `audit:mcp` 0 违规；
> 3. 混合读写 Server 采用工具级拒绝（`reason="not allowed to call tool"`），而非偷懒用 server 级拒绝；Server 级拒绝仅用于「完全不应被 UI 访问的纯净写 Server」；
> 4. 本次提交范围严格限定在矩阵 + 双测试套件 + 注释 + 同步修正的 UI caller/Agent 配置（通过 `git commit --only <paths>` 强制隔离，不得与其它功能代码混合提交）。

---

## 六、相关参考

- AGENTS.md §十四 MCP 权限控制规范
- `src/config/mcpAclMatrix.ts`（权限矩阵真相源）
- `src/config/mcpServerRegistry.ts`（Server 注册状态真相源）
- `src/mcp/__tests__/mcpAclInterceptor.test.ts`（拦截器单元契约）
- `tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts`（集成场景契约）
- `scripts/audit-mcp.ts`（矩阵↔注册↔测试三角一致性审计）
