# MCP 架构规则与逻辑全面二次审查报告

> **审查日期**: 2026-07-08
> **审查范围**: MCP 核心层合规性 + 绕过 MCP 违规调用 + MCP 能力覆盖缺失
> **审查依据**: MCP 标准协议规范 + AGENTS.md v1.3.5 分层契约
> **审查方式**: 静态代码审查（未修改任何代码）

---

## 一、审查总览

| 维度 | 审查项数 | 符合 | 部分符合 | 不符合 | 违规/缺失 |
|------|---------|------|---------|--------|----------|
| 核心层合规性 | 8 | 4 | 3 | 1 | — |
| 绕过 MCP 违规 | 4 层级 | — | — | — | 73 项 |
| MCP 能力缺失 | 6 项 | — | — | — | 6 项 |
| **合计** | **18** | **4** | **3** | **1** | **79 项** |

---

## 二、不符合项汇总（按严重程度排序）

### 🔴 P0 — 高风险（4 项）

#### 不符合项 1：MCP Tool/Resource 调用无权限控制

- **位置**: [src/mcp/core/client.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/mcp/core/client.ts)、[src/mcp/bridge/mcpBridge.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/mcp/bridge/mcpBridge.ts) 全文
- **问题**: MCP 层无任何 ACL/权限校验，未与 `src/core/acl.ts` 的 ACL_MATRIX 集成。任何调用方可执行任何 Server 的任何 Tool，包括 `trading:main` 的下单工具
- **潜在影响**: 违反 AGENTS.md §1 最小权限原则和 §6 引擎架构约束；误调用或恶意调用可执行敏感操作
- **修复建议**: 在 `MCPClientImpl.callTool`/`readResource` 入口集成 `aclEngine.assert()`

#### 不符合项 2：MCPServerBase 缺少生命周期管理

- **位置**: [src/mcp/core/server.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/mcp/core/server.ts) L27-233
- **问题**: 无 `start()`/`stop()`/`health_check()`/`initialize()` 方法
- **潜在影响**: Server 无法优雅关闭，资源泄漏风险；无法统一健康检查
- **修复建议**: 在 MCPServerBase 新增 `abstract start()`、`abstract stop()`、`healthCheck()` 方法

#### 不符合项 3：V6 评分 LLM 增强层控制未通过 MCP 暴露

- **位置**: [src/mcp/servers/scoring/v6ScoringServer.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/mcp/servers/scoring/v6ScoringServer.ts)
- **问题**: `score_stock` 工具仅接受 `symbol` 参数，无 LLM 增强层开关、无模型选择、评分结果无 LLM 标注
- **潜在影响**: 违反 AGENTS.md §六"LLM 模型选择和评分因子使用必须通过接口暴露给用户"和 §九"评分结果必须清晰标注哪些因子使用 LLM 增强 vs 自动计算"
- **修复建议**: 新增 `llmEnhanceLayers`/`llmModel` 参数，结果增加 `llmEnhanced` 标注

#### 不符合项 4：RBAC 权限管理服务无 MCP Server

- **位置**: `src/services/rbac/` 完整 RBAC 管理能力（5 表 CRUD + 授权/撤销）
- **问题**: RBAC 写入通道（6 个 ENVELOPE_ACTION）已通过 DataBridge 暴露，但缺少 MCP 工具入口
- **潜在影响**: AI Agent 无法通过 MCP 进行用户/角色/权限管理
- **修复建议**: 新建 `src/mcp/servers/rbac/rbacServer.ts`

### 🟡 P1 — 中风险（7 项）

| # | 不符合项 | 位置 | 影响 |
|---|---------|------|------|
| 5 | apps 层直接 import service 运行时调用 | [InputDashboard.tsx](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/apps/input/InputDashboard.tsx) L17-21 | apps 分发器完全绕过 MCP |
| 6 | store 层 42 项值导入绕过 MCP | `src/store/` 21 个文件 | 架构规则冲突（AGENTS.md §1 允许 store→service，但违背 MCP 解耦理念） |
| 7 | 缺少标准 stdio/SSE 传输 | [transport.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/mcp/core/transport.ts) | 无法作为独立 MCP Server 暴露给外部 AI 客户端 |
| 8 | MCPBridge 未实现 Store→Resource 同步 | [mcpBridge.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/mcp/bridge/mcpBridge.ts) L1-13 | Resource 数据可能与 Store 状态不一致 |
| 9 | ai-center 孤立模块无 MCP Server | `src/services/ai-center/` | 僵尸模块，全项目无引用 |
| 10 | useCase 协调层 7/8 未暴露 | `src/services/useCase/` | 核心编排（统一股票视图、双策略运行）无法通过 MCP 调用 |
| 11 | useMcpMigration.ts:64 callTool 参数缺失 BUG | [useMcpMigration.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/components/system/migration/useMcpMigration.ts) L64 | 调用 `generateMigrationReport()` 必然失败 |

### 🟢 P2 — 低风险（4 项）

| # | 不符合项 | 位置 | 影响 |
|---|---------|------|------|
| 12 | pages/components 层 7 项类型导入 | 3 个 pages + 4 个 components | 类型应迁移至 `src/types/modules/` |
| 13 | MCPServer 接口缺少 health_check 方法定义 | [mcp.types.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/types/modules/mcp.types.ts) L158-180 | 无法通过统一接口轮询健康状态 |
| 14 | JSONRPCRequest/Response 类型定义但未使用 | [mcp.types.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/types/modules/mcp.types.ts) L231-248 | 死类型 |
| 15 | SystemServer 未暴露诊断能力 | `src/services/system/` | 架构自诊断、监控日志未通过 MCP 暴露 |

---

## 三、MCP 架构合规项（设计亮点）

| 合规项 | 说明 |
|--------|------|
| ✅ 核心能力完整 | elicitation/cancellation/progress/roots/sampling/notification 6 大能力全部实现 |
| ✅ 配置驱动注册 | mcpServerRegistry.ts + syncWithConfig() 声明式注册与热更新 |
| ✅ Registry 完整 | register/unregister/getServer/listServers/setEnabled/getStats 全覆盖 |
| ✅ 审计日志集成 | mcpAuditLogger 通过 DataBridge 信封协议写入 executionLogs |
| ✅ Server 间无耦合 | 16 个 Server 仅 import 各自 service 域，通过 dependencies 声明依赖 |
| ✅ Registry 一致性 | 16 个 Server 文件全部在 Registry 注册，无遗漏无多余 |
| ✅ 无影子 MCP | 未发现绕过 MCPServerBase 自行实现类 MCP 接口的模块 |
| ✅ DataBridge 边界清晰 | 数据层通道与 MCP 工具调用入口职责分离合理 |
| ✅ 入口层不直用 MCP | portal/apps 层通过 store/bridge 间接调用，分层正确 |

---

## 四、MCP 架构设计的教训和经验

### 教训 1：架构规则与实现规则存在冲突

**现象**: AGENTS.md §1 明确允许 `store/ → services/` 依赖，但 MCP 架构理念要求编排层通过 MCP 调用。store 层 42 项值导入违规全部符合 AGENTS.md 分层规则，但违背 MCP 解耦理念。

**教训**: 引入 MCP 架构时，必须同步修订 AGENTS.md 的分层规则，明确 store 层是否纳入 MCP 强制范围。否则规则冲突会导致开发者无所适从。

### 教训 2：MCP 能力覆盖应先于深度优化

**现象**: 核心层建设完整（6 大能力 + 审计日志 + 配置驱动），但业务层覆盖不全：21 个 service 子目录中仅 8 个有 MCP Server 封装，13 个 service 的能力无法通过 MCP 调用。

**教训**: MCP 架构推广应先确保 service 层 100% 覆盖（"宽度优先"），再深入优化核心层协议合规性（"深度其次"）。当前"核心层深但业务层窄"的状态导致 MCP 架构形同虚设——store 层不得不绕过 MCP 直接调用 service。

### 教训 3：LLM 透明度要求需在接口设计阶段落实

**现象**: AGENTS.md §六和§九明确要求 LLM 调用透明度（模型选择暴露、增强层开关、因子标注），但 V6ScoringServer 在设计时未将这些要求纳入工具参数和返回结构。

**教训**: 架构约束文档中的强制要求（如 LLM 透明度）应在 MCP 工具接口设计阶段就纳入参数 schema，而非事后补丁。建议在 ToolDescriptor 的 inputSchema 中增加合规性校验。

### 教训 4：生命周期管理是 Server 抽象的必备能力

**现象**: MCPServerBase 只关注能力查询（listTools/callTool），完全缺失生命周期管理（start/stop/health_check），导致资源无法统一释放、健康状态无法统一轮询。

**教训**: Server 抽象基类必须包含完整生命周期契约（initialize → start → healthCheck → stop → shutdown），否则生产环境下资源泄漏和状态不一致问题不可避免。

### 教训 5：权限控制应在架构入口层前置

**现象**: DataBridge 层有完整的 ACL_MATRIX 权限控制，但 MCP 层（更靠前的入口）完全没有权限校验。调用方可以通过 MCP Tool 绕过 DataBridge 的 ACL（如果 Tool 内部不走 DataBridge）。

**教训**: 权限控制应在架构的最外层入口（MCP Tool 调用）和最内层入口（DataBridge 数据操作）双重设置，形成纵深防御。

---

## 五、二次开发时提炼关注点

### 关注点 1：MCP 工具覆盖完整性检查

**关注问题**: 新增 service 时，是否同步创建了对应的 MCP Server？

**检查方法**:
```powershell
# 对比 service 子目录数与 MCP Server 数
ls src/services/ | Measure-Object  # 21 个
ls src/mcp/servers/ | Measure-Object  # 16 个
# 差值即为未覆盖的 service 子域
```

**建议**: 在 `audit:deadcode` 脚本中新增"MCP 覆盖率"检查，CI 中强制要求新增 service 必须同步注册 MCP Server。

### 关注点 2：MCP 工具参数合规性校验

**关注问题**: 新增 MCP 工具时，是否满足 AGENTS.md §六的 LLM 透明度要求？

**检查清单**:
- [ ] 工具是否涉及 LLM 调用？如是，是否暴露了模型选择参数？
- [ ] 工具是否涉及评分？如是，是否暴露了 LLM 增强层开关？
- [ ] 返回结果是否标注了 LLM 增强 vs 自动计算？
- [ ] 工具是否有用户可配置的 LLM 开关？

### 关注点 3：分层规则与 MCP 理念的一致性

**关注问题**: 修改 AGENTS.md §1 分层规则时，是否同步考虑了 MCP 解耦要求？

**建议**: AGENTS.md §1 应增加"MCP 编排层"定义，明确 store 层是否属于 MCP 强制范围。若纳入，需提供完整的迁移计划。

### 关注点 4：MCP 调用链路的权限审计

**关注问题**: MCP Tool 调用是否经过了权限校验？

**检查方法**: 在 `mcpAuditLogger` 的审计记录中增加 `aclResult` 字段，记录权限校验结果。CI 中检查审计日志是否包含 ACL 拒绝记录。

### 关注点 5：传输层协议合规性

**关注问题**: 是否需要与外部 AI 客户端（Claude Desktop、Cursor）互操作？

**决策点**: 如果需要，必须实现 stdio/SSE 传输层；如果仅进程内自用，当前 InProcessTransport 足够，但应在文档中明确标注。

---

## 六、设计时关注点

### 设计关注点 1：Server 抽象的生命周期契约

**设计原则**: MCPServerBase 必须定义完整的生命周期：
```
initialize() → start() → [running] → healthCheck() → stop() → [stopped]
```

**设计要点**:
- `initialize()`: 初始化资源（数据源连接、配置加载）
- `start()`: 启动后台任务（定时刷新、事件订阅）
- `healthCheck()`: 返回 `{ status: 'healthy'|'degraded'|'unhealthy', details: {...} }`
- `stop()`: 优雅关闭（等待进行中的 Tool 调用完成、释放资源）

### 设计关注点 2：MCP 权限矩阵设计

**设计原则**: MCP 层应有独立权限矩阵，与 DataBridge 的 ACL_MATRIX 形成纵深防御。

**设计要点**:
```typescript
// 建议：新增 MCP_ACL_MATRIX
const MCP_ACL_MATRIX: Record<string, McpPermission> = {
  'agent': { allowedServers: ['*'], allowedTools: ['*'] },
  'ui': { allowedServers: ['fetcher', 'stockpool', 'scoring:v6'], allowedTools: ['health_check', 'list_*'] },
  'ci': { allowedServers: ['system'], allowedTools: ['get_*', 'generate_migration_report'] },
}
```

### 设计关注点 3：MCP 工具粒度设计

**设计原则**: 工具粒度应平衡"原子性"和"编排性"。

**设计要点**:
- 原子工具（如 `list_pool_stocks`）：单个 service 方法封装
- 编排工具（如 `getUnifiedStockView`）：跨 service 聚合，应通过 useCase 层封装
- 当前项目 8 个 useCase 中 7 个未通过 MCP 暴露，建议优先补充编排工具

### 设计关注点 4：MCP 与 DataBridge 的边界

**设计原则**: MCP 是工具调用入口，DataBridge 是数据层通道，两者不混淆。

**设计要点**:
- MCP Tool → Service → DataBridge.forward() → DB（写入链路）
- MCP Tool → Service → DataBridge.query() → DB（读取链路）
- DataBridge 不应通过 MCP 暴露（它是基础设施，不是业务工具）
- MCP Resource 可以读取 DataBridge 缓存的数据（通过 MCPBridge 同步）

### 设计关注点 5：LLM 透明度的接口设计

**设计原则**: LLM 相关工具的 inputSchema 必须包含透明度参数。

**设计要点**:
```typescript
// V6ScoringServer.score_stock 的 inputSchema 应设计为：
{
  symbol: { type: 'string' },
  llmEnhanceLayers: { 
    type: 'array', 
    items: { type: 'string', enum: ['L0', 'L1', 'L2', 'L5', 'L6'] },
    description: '启用的 LLM 增强层（默认全部启用）'
  },
  llmModel: { type: 'string', description: 'LLM 模型 ID' },
  disableLlm: { type: 'boolean', description: '完全禁用 LLM 增强' }
}
// 返回结果应包含：
{
  layers: Array<{ name, score, llmEnhanced: boolean, model?: string }>
}
```

---

## 七、修复优先级建议

| 优先级 | 修复项 | 预计工作量 | 依赖关系 |
|--------|--------|-----------|---------|
| P0-1 | MCP 权限控制（ACL 集成） | 中 | 无 |
| P0-2 | Server 生命周期管理 | 中 | 无 |
| P0-3 | V6 评分 LLM 增强层暴露 | 中 | 需协同 LLMServer |
| P0-4 | RBAC MCP Server | 中 | 依赖 RBAC service 完成 |
| P1-1 | apps 层违规修复 | 低 | 需补充 fetcher/stockpool 缺失工具 |
| P1-2 | store 层迁移策略决策 | 高 | 需架构负责人确认 |
| P1-3 | stdio/SSE 传输实现 | 高 | 视互操作需求决定 |
| P1-4 | MCPBridge Store→Resource 同步 | 中 | 依赖 EventBus |
| P1-5 | ai-center 孤立模块处理 | 低 | 需确认是否废弃 |
| P1-6 | useCase 编排工具补充 | 中 | 依赖 useCase 层稳定 |
| P1-7 | useMcpMigration.ts BUG 修复 | 低 | 无 |
| P2 | 类型迁移 + 接口补全 + 死类型清理 | 低 | 无 |

---

## 八、审查结论

V9 项目的 MCP 架构在**基础设施层**（Registry、Bridge、核心能力、审计日志、配置驱动）建设完整且设计良好，16 个 Server 全部正确注册，Server 间无耦合。

主要问题集中在三个维度：
1. **安全维度**: MCP 层无权限控制（P0），与 DataBridge 的 ACL 形成安全缺口
2. **覆盖维度**: 21 个 service 子域仅 8 个有 MCP Server，13 个能力无法通过 MCP 调用（P1）
3. **合规维度**: LLM 透明度要求仅满足 1/3（P0），Server 生命周期管理缺失（P0）

建议按 P0 → P1 → P2 顺序修复，优先处理安全维度和合规维度的 4 项 P0 问题。

---

*审查报告生成时间: 2026-07-08 (Asia/Shanghai)*
*审查文件数: 49 个 MCP 实现文件 + 5 份架构文档*
