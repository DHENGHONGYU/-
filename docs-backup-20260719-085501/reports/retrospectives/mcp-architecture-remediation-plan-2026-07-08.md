---
title: MCP 架构整改行动计划
type: reports
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "**基于文档**: mcp-architecture-audit-report-2026-07-08.md **制定日期**: 2026-07-08 **目标**: 针对 5 条核心教训，按优先..."
tags: [architecture, mcp, remediation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# MCP 架构整改行动计划

> **基于文档**: mcp-architecture-audit-report-2026-07-08.md
> **制定日期**: 2026-07-08
> **目标**: 针对 5 条核心教训，按优先级制定可执行的架构整改计划

---

## 整改总览

| 批次 | 对应教训 | 整改项数 | 优先级 | 核心目标 |
|------|---------|---------|--------|---------|
| 第一批 | 教训 5 + 教训 4 | 2 项 | P0 | 补齐安全缺口和生命周期管理 |
| 第二批 | 教训 3 | 2 项 | P0 | 落实 LLM 透明度强制要求 |
| 第三批 | 教训 2 | 3 项 | P1 | 补全 MCP 业务能力覆盖 |
| 第四批 | 教训 1 | 2 项 | P1 | 解决架构规则冲突 |
| 第五批 | 遗留项 | 3 项 | P2 | 清理低风险技术债 |

---

## 第一批：安全与生命周期（P0 — 教训 5 + 教训 4）

### 整改项 1.1：MCP 层权限控制集成

**对应教训**: 教训 5 — 权限控制应在架构入口层前置

**问题**: MCP Tool/Resource 调用无任何权限校验，与 DataBridge 的 ACL_MATRIX 形成安全缺口

**重构模块**:

| 模块 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| MCP 权限定义 | `src/config/mcpAclMatrix.ts`（新建） | 新增 | 定义 `MCP_ACL_MATRIX`，按调用方角色（agent/ui/ci）限制可访问的 Server 和 Tool |
| MCP Client | `src/mcp/core/client.ts` | 修改 | `callTool()`/`readResource()` 入口增加 `aclEngine.assert()` 调用 |
| MCP Bridge | `src/mcp/bridge/mcpBridge.ts` | 修改 | `callTool()` 传入 caller 身份标识，透传至 ACL 校验 |
| ACL Engine | `src/core/acl.ts` | 修改 | 新增 `assertMcpTool(caller, serverName, toolName)` 方法 |

**MCP ACL 矩阵设计**:

```typescript
// src/config/mcpAclMatrix.ts
export const MCP_ACL_MATRIX: Record<string, McpPermission> = {
  // AI Agent：可调用所有 Server 的所有 Tool
  agent: { allowedServers: ['*'], allowedTools: ['*'] },
  // UI 层：仅可调用查询类 Tool，禁止交易类写操作
  ui: {
    allowedServers: ['fetcher', 'stockpool', 'scoring:v6', 'analysis', 'news', 'llm', 'portfolio'],
    allowedTools: ['health_check', 'list_*', 'get_*', 'score_stock', 'fetch_*'],
  },
  // CI 流水线：仅可调用系统管理类 Tool
  ci: {
    allowedServers: ['system'],
    allowedTools: ['get_*', 'generate_migration_report'],
  },
}
```

**验证标准**:
- [ ] `MCPClientImpl.callTool()` 在调用前执行 ACL 校验
- [ ] ACL 拒绝时返回 `isError: true` 且包含 `ACL_PERMISSION_DENIED` 信息
- [ ] 审计日志记录 `aclResult` 字段
- [ ] 新增单元测试覆盖 3 种角色（agent/ui/ci）的权限边界

**预计影响范围**: 4 个文件修改，1 个文件新建

---

### 整改项 1.2：MCPServerBase 生命周期管理

**对应教训**: 教训 4 — 生命周期管理是 Server 抽象的必备能力

**问题**: MCPServerBase 无 `start()`/`stop()`/`healthCheck()` 方法

**重构模块**:

| 模块 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| MCPServer 接口 | `src/types/modules/mcp.types.ts` | 修改 | 接口新增 `start()`/`stop()`/`healthCheck()` 方法定义 |
| Server 基类 | `src/mcp/core/server.ts` | 修改 | MCPServerBase 新增生命周期方法默认实现 |
| Registry | `src/mcp/core/registry.ts` | 修改 | 新增 `startAll()`/`stopAll()`/`healthCheckAll()` |
| 16 个 Server | `src/mcp/servers/**/*.ts` | 修改 | 各 Server 按需 override `start()`/`stop()` |
| MCP Bridge | `src/mcp/bridge/mcpBridge.ts` | 修改 | 新增 `healthCheckAll()` 便捷方法 |

**接口设计**:

```typescript
// src/types/modules/mcp.types.ts 新增
export interface MCPServer {
  // ... 现有方法 ...

  /** 启动 Server（初始化资源、启动后台任务） */
  start(): Promise<void>
  /** 优雅关闭（等待进行中 Tool 调用完成、释放资源） */
  stop(): Promise<void>
  /** 健康检查 */
  healthCheck(): Promise<HealthStatus>
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  details?: Record<string, unknown>
  lastCheckedAt: number
}
```

**验证标准**:
- [ ] `MCPServerBase` 提供 `start()`/`stop()`/`healthCheck()` 默认实现（空方法 + 返回 healthy）
- [ ] `fetcher` Server override `start()` 初始化数据源连接
- [ ] `registry.startAll()` 按优先级依次启动所有 Server
- [ ] `registry.healthCheckAll()` 返回所有 Server 健康状态
- [ ] 应用退出时调用 `registry.stopAll()` 优雅关闭

**预计影响范围**: 3 个核心文件 + 16 个 Server 文件

---

## 第二批：LLM 透明度（P0 — 教训 3）

### 整改项 2.1：V6 评分工具 LLM 增强层暴露

**对应教训**: 教训 3 — LLM 透明度要求需在接口设计阶段落实

**问题**: `score_stock` 工具无 LLM 增强层开关、无模型选择、结果无 LLM 标注

**重构模块**:

| 模块 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| V6 Scoring Server | `src/mcp/servers/scoring/v6ScoringServer.ts` | 修改 | `score_stock` inputSchema 新增 LLM 控制参数 |
| V6 Score Service | `src/services/scoring/v6ScoreService.ts` | 修改 | `runV6Score()` 接受 LLM 增强配置 |
| V6 Engine Config | `src/services/scoring/v6-engine/config.ts` | 修改 | 新增 `llmEnhanceLayers` 默认配置 |
| 评分结果类型 | `src/types/modules/score.types.ts` | 修改 | ScoreLayer 新增 `llmEnhanced: boolean` 字段 |

**工具参数设计**:

```typescript
// score_stock 的新 inputSchema
{
  symbol: { type: 'string', description: '股票代码' },
  llmEnhanceLayers: {
    type: 'array',
    items: { type: 'string', enum: ['L0', 'L1', 'L2', 'L5', 'L6'] },
    description: '启用的 LLM 增强层（默认全部启用，传空数组禁用所有 LLM）',
  },
  llmModel: {
    type: 'string',
    description: 'LLM 模型 ID（留空使用默认模型）',
  },
  disableLlm: {
    type: 'boolean',
    description: '完全禁用所有 LLM 增强层（快捷开关）',
  },
}
```

**验证标准**:
- [ ] `score_stock` 工具支持 `llmEnhanceLayers`/`llmModel`/`disableLlm` 参数
- [ ] 返回结果中每个 layer 标注 `llmEnhanced: boolean`
- [ ] 新增 `get_llm_enhance_config` 工具，返回各层 LLM 增强支持情况
- [ ] 单元测试覆盖 LLM 全启用/部分启用/全禁用三种场景

---

### 整改项 2.2：LLM Server 评分因子展示工具

**对应教训**: 教训 3 — LLM 调用前向用户展示评分因子使用情况

**问题**: LLMServer 无"评分因子使用情况"展示工具

**重构模块**:

| 模块 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| LLM Server | `src/mcp/servers/llm/llmServer.ts` | 修改 | 新增 `get_scoring_factors` 工具 |
| LLM Gateway | `src/services/llm/llmGateway.ts` | 修改 | 新增 `getScoringFactors()` 方法 |

**验证标准**:
- [ ] 新增 `get_scoring_factors` 工具返回各评分因子的 LLM 使用情况
- [ ] 返回结构包含：因子名称、是否使用 LLM、默认模型、可配置开关

**预计影响范围**: 2 个文件

---

## 第三批：MCP 能力覆盖补全（P1 — 教训 2）

### 整改项 3.1：优先补充 3 个高价值 MCP Server

**对应教训**: 教训 2 — MCP 能力覆盖应先于深度优化（21 个 service 仅 8 个有 MCP Server）

**新增 Server 清单（按业务价值排序）**:

| 优先级 | 新建 Server | 封装的 service | 价值说明 |
|--------|------------|---------------|---------|
| 高 | `src/mcp/servers/system/systemServer.ts` | `services/rbac/*` | RBAC 用户/角色/权限管理，AI Agent 安全管理基础 |
| 高 | `src/mcp/servers/workflow/workflowServer.ts` | `services/useCase/*` | 跨服务编排（统一股票视图、双策略运行），8 个 useCase 中 7 个未暴露 |
| 中 | `src/mcp/servers/analysis/analysisServer.ts` | `services/ai-center/*` | 智能体调度中心（当前为孤立僵尸模块） |

**RBAC Server 工具设计**:

| 工具名 | 功能 | 对应 service 方法 |
|--------|------|------------------|
| `list_users` | 列出所有用户 | `rbacManagementService.listUsers()` |
| `create_user` | 创建用户 | `rbacManagementService.createUser()` |
| `assign_role` | 给用户分配角色 | `rbacManagementService.assignRole()` |
| `revoke_role` | 撤销用户角色 | `rbacManagementService.revokeRole()` |
| `list_roles` | 列出所有角色 | `rbacManagementService.listRoles()` |
| `list_permissions` | 列出所有权限 | `rbacManagementService.listPermissions()` |
| `get_audit_logs` | 查询权限审计日志 | `rbacManagementService.getAuditLogs()` |

**UseCase Server 工具设计**:

| 工具名 | 功能 | 对应 useCase |
|--------|------|-------------|
| `get_unified_stock_view` | 统一股票视图（8 源数据融合） | `getUnifiedStockView.useCase` |
| `run_dual_strategy` | 双策略运行（热门+价值+轮动） | `runDualStrategy.useCase` |
| `rebalance_portfolio` | 组合再平衡 | `rebalancePortfolio.useCase` |
| `query_hot_sector` | 热门板块查询 | `hotSectorQuery.useCase` |
| `fetch_sector_analysis` | 板块分析 | `fetchSectorAnalysis.useCase` |
| `orchestrate_fetcher` | 数据采集编排 | `fetcherOrchestrator.useCase` |

**验证标准**:
- [ ] 3 个新 Server 注册到 `mcpServerRegistry.ts`
- [ ] `audit:deadcode` 不报"未注册 Server"
- [ ] 集成测试覆盖每个新 Server 的核心工具冒烟测试

---

### 整改项 3.2：补充现有 Server 缺失的工具

**问题**: 部分 service 方法未被对应 MCP Server 封装

| Server | 缺失工具 | 对应 service 方法 | 修复文件 |
|--------|---------|------------------|---------|
| fetcher | `refresh_symbol_kline` | `fetcherService.refreshSymbolKline` | `dataFetcherServer.ts` |
| stockpool | `update_stock_group` | `stockpoolService.updateStockGroup` | `stockPoolServer.ts` |
| llm | `streaming_chat` | `llmGateway.streamingChat` | `llmServer.ts` |
| trading | `get_watchlist_stocks` | `tradingService.getWatchlistStocks` | `tradingServer.ts` |
| system | `get_architecture_health` | `architectureService.checkHealth` | `systemServer.ts` |

**验证标准**:
- [ ] 每个缺失工具补充到对应 Server 的 `getTools()` 返回列表
- [ ] 工具 inputSchema 定义完整
- [ ] 集成测试冒烟覆盖

---

### 整改项 3.3：处理 ai-center 孤立模块

**问题**: `src/services/ai-center/` 全项目无引用，为僵尸模块

**决策点**:

| 方案 | 说明 | 建议 |
|------|------|------|
| A. 废弃删除 | 确认为遗留废弃代码，直接删除 | 如果 AI 中心功能不再需要 |
| B. 接入 MCP | 新建 aiCenterServer 并接入 agentRuntime | 如果 AI 中心功能需要保留 |

**验证标准**:
- [ ] 与架构负责人确认方案 A 或 B
- [ ] 方案 A：删除文件 + 更新 audit 排除清单
- [ ] 方案 B：新建 Server + 注册 + 集成测试

---

## 第四批：架构规则冲突解决（P1 — 教训 1）

### 整改项 4.1：修订 AGENTS.md 分层规则

**对应教训**: 教训 1 — 架构规则与实现规则存在冲突

**问题**: AGENTS.md §1 允许 `store/ → services/`，但 MCP 理念要求解耦

**修订方案**:

在 AGENTS.md §1 的依赖方向规则中新增"MCP 编排层"定义：

```markdown
### MCP 编排层规则（新增）

- `store/` → 可直接依赖 `services/`（过渡期保留），但新增 store 应优先通过 `mcpBridge.callTool()` 调用
- `apps/` → 必须通过 `mcpBridge.callTool()` 调用 service，禁止直接 import service
- `pages/` 和 `components/` → 必须通过 `store/` 间接调用 MCP，禁止直接 import service（类型导入除外）
- `agents/` → 必须通过 `mcpBridge.callTool()` 调用 service

### 迁移计划

- 阶段 1（当前）：apps 层强制执行 MCP 调用（2 项违规优先修复）
- 阶段 2：store 层逐步迁移（42 项违规分批重构）
- 阶段 3：全面禁止 store → service 直接依赖
```

**验证标准**:
- [ ] AGENTS.md 新增 MCP 编排层规则
- [ ] `audit:layers` 脚本新增 MCP 违规检测
- [ ] `audit:contract` 脚本覆盖 MCP 编排规则

---

### 整改项 4.2：修复 apps 层违规（立即执行）

**问题**: `src/apps/input/InputDashboard.tsx` 直接 import service

**重构模块**:

| 文件 | 当前 import | 改为 MCP 调用 | 依赖 |
|------|------------|-------------|------|
| `InputDashboard.tsx` L17 | `checkFetcherHealth` from fetcherService | `mcpBridge.callTool('fetcher', 'health_check')` | 整改项 3.2 |
| `InputDashboard.tsx` L18 | `refreshSymbolKline` from fetcherService | `mcpBridge.callTool('fetcher', 'refresh_symbol_kline')` | 整改项 3.2 |
| `InputDashboard.tsx` L21 | `transitionStock` from stockpoolService | `mcpBridge.callTool('stockpool', 'transition_stock')` | 无 |
| `InputDashboard.tsx` L21 | `updateStockGroup` from stockpoolService | `mcpBridge.callTool('stockpool', 'update_stock_group')` | 整改项 3.2 |

**验证标准**:
- [ ] `InputDashboard.tsx` 无 `from '@/services/'` 的值导入
- [ ] 功能测试通过（健康检查、K 线刷新、状态变更、分组更新）

---

## 第五批：低风险技术债清理（P2）

### 整改项 5.1：修复 useMcpMigration.ts BUG

**问题**: `useMcpMigration.ts:64` 的 `callTool` 参数缺失，调用必然失败

**修复**:

```typescript
// 修复前（错误）
const result = await mcpBridge.callTool('generate_migration_report', { migrationReport: report })

// 修复后（正确）
const result = await mcpBridge.callTool('system', 'generate_migration_report', { migrationReport: report })
```

---

### 整改项 5.2：类型迁移至 types/modules/

**问题**: pages/components 层 7 项类型导入违规

| 类型 | 当前位置 | 迁移目标 |
|------|---------|---------|
| `RotationSignal` | `services/scoring/rotationSignalDetector` | `types/modules/scoring.types.ts` |
| `HotSectorScore` | `services/scoring/hotSectorAnalyzer` | `types/modules/scoring.types.ts` |
| `TradeReviewReport` | `services/trading/tradeReviewAI` | `types/modules/trading.types.ts` |
| `PoolGroup` | `services/stockpool/stockpoolService` | `types/modules/stockpool.types.ts` |
| `FactorContribution`/`ScoreAuditTrail` | `services/scoring/v6-engine` | `types/modules/scoring.types.ts` |
| `ScoreTrendData`/`ScoreTrendPeriod` | `services/analysis/scoreTrendService` | `types/modules/analysis.types.ts` |
| `StrategyGroupItem` | `services/trading/strategySnapshotService` | `types/modules/trading.types.ts` |

---

### 整改项 5.3：清理死类型 + 补全接口

| 项目 | 文件 | 改动 |
|------|------|------|
| JSONRPCRequest/Response 死类型 | `mcp.types.ts` L231-248 | 标记 `@deprecated` 或在 StdioTransport 实现时启用 |
| MCPServer 接口补全 health_check | `mcp.types.ts` L158-180 | 在整改项 1.2 中一并完成 |
| RootsManager.isAllowed 启用 | `client.ts` readResource | 在 `readResource` 入口调用 `rootsManager.isAllowed()` |

---

## 执行顺序与依赖关系

```
第一批（P0 安全+生命周期）
├── 整改项 1.1：MCP 权限控制 ──────────────┐
└── 整改项 1.2：Server 生命周期管理 ───────┤
                                          │
第二批（P0 LLM 透明度）                     │
├── 整改项 2.1：V6 评分 LLM 增强层暴露 ────┤
└── 整改项 2.2：LLM 评分因子展示工具 ─────┤
                                          │
第三批（P1 能力覆盖）                       │
├── 整改项 3.1：新建 3 个 MCP Server ─────┤
├── 整改项 3.2：补充现有 Server 缺失工具 ──┼──→ 第四批依赖（apps 层修复需要工具就绪）
└── 整改项 3.3：ai-center 孤立模块处理 ───┤
                                          │
第四批（P1 规则冲突）                       │
├── 整改项 4.1：修订 AGENTS.md ───────────┤
└── 整改项 4.2：修复 apps 层违规 ←─────────┘
                                          │
第五批（P2 技术债）                         │
├── 整改项 5.1：useMcpMigration BUG 修复 ─┤
├── 整改项 5.2：类型迁移 ─────────────────┤
└── 整改项 5.3：死类型清理 ────────────────┘
```

**关键依赖**:
- 整改项 4.2（apps 层修复）依赖整改项 3.2（补充缺失工具）完成
- 整改项 1.1（权限控制）和 1.2（生命周期）可并行
- 整改项 2.1 和 2.2 可并行
- 第五批可随时穿插执行

---

## 每批次验证清单

每批次完成后必须通过以下验证：

```powershell
# 类型检查
npx tsc --noEmit

# 架构审计
npm run audit:layers
npm run audit:deadcode
npm run audit:hardcode

# 集成测试
npx vitest run tests/__tests__/integration/ --reporter=verbose

# 单元测试
npm test -- --run
```

**批次完成标准**:
- [ ] 所有验证命令通过
- [ ] 新增/修改文件均有对应测试覆盖
- [ ] 变更日志记录到 `docs/changelogs/2026-07/`
- [ ] AGENTS.md 如有修订则同步更新

---

*行动计划制定时间: 2026-07-08 (Asia/Shanghai)*
