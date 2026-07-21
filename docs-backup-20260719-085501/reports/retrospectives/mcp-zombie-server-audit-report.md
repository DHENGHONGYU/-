---
title: MCP Server 僵尸模块审计报告
type: reports
domain: ai
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计日期: 2026-07-20 审计范围: `src/mcp/servers/` 下全部 18 个 Server（12 enabled + 6 disabled） 审计方法:..."
tags: [ai, mcp, audit]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# MCP Server 僵尸模块审计报告

> **审计日期**: 2026-07-20  
> **审计范围**: `src/mcp/servers/` 下全部 18 个 Server（12 enabled + 6 disabled）  
> **审计方法**: 静态代码分析（排除测试文件），追踪 `mcpBridge.callTool()` 直接调用 + `AgentComponentRegistry` 间接注册  
> **审计脚本**: `scripts/audit/mcp-tool-usage-audit.py`

---

## 一、审计方法

1. **Tool 名称提取**: 精确解析每个 Server 的 `getTools()` 方法体，提取 `name: 'xxx'` 定义。
2. **直接调用追踪**: 全项目搜索 `mcpBridge.callTool('server', 'toolName', ...)` 模式，定位实际业务调用点。
3. **间接调用追踪**: 检查 `src/components/organisms/agent/agentComponentRegistry.ts` 中注册的 Agent，这些 Agent 通过 `agentRuntime.ts` 动态调用 MCP Tool。
4. **严格过滤**: 排除 `__tests__/`、`.test.*` 文件和 Server 自身定义文件，仅统计业务代码引用。

---

## 二、12 个 Enabled Server 审计结果

### ?? 完全僵尸 Server（0 业务调用）

| Server | Tool 数量 | 根因分析 | 建议 |
|--------|----------|---------|------|
| **execution** | 5 | 无任何 `callTool` 调用，Agent Registry 未注册，仅有单元测试覆盖 | ?? 评估降级或移除 |
| **knowledge** | 1 | `query_knowledge` 无任何业务引用，Agent Registry 未注册 | ?? 评估降级或移除 |
| **portfolio** | 3 | 无任何 `callTool` 调用，Agent Registry 未注册，仅有单元测试覆盖 | ?? 评估降级或移除 |
| **workflow** | 17 | 无任何业务代码调用自身的 CRUD Tool；`workflowServer.ts:1175` 的 `callTool` 是**调用其他 Server** 而非自身被调用；Agent Registry 未注册 | ?? 评估降级或保留为基础设施 |
| **analysis** | 3 | `screen_stocks` 仅在 ACL 矩阵中字符串引用，无实际调用；`analyze_stock`/`analyze_sector` 零业务引用；Agent Registry 未注册 | ?? 评估降级或移除 |

> **注**: workflow Server 情况特殊——它是一个编排引擎，理论上应由外部系统触发（如定时调度、UI 操作），但当前没有任何业务代码调用其 `create_workflow`/`run_workflow` 等入口。

### ?? 部分僵尸 Server（有活跃 Tool，但也有僵尸 Tool）

| Server | 活跃/总数 | 僵尸 Tool | 活跃 Tool 及调用点 |
|--------|----------|----------|-------------------|
| fetcher | 2/5 | `fetch_stocks_basic`, `fetch_kline`, `refresh_symbol` | `fetch_stock_basic` → Agent Registry (`fetcher-agent`); `test_source_connectivity` → `FetcherConfigPage.tsx` |
| llm | 1/4 | `analyze_with_context`, `list_models`, `get_model_config` | `chat_completion` → Agent Registry (`llm-intelligent-agent`) |
| news | 1/3 | `analyze_sentiment`, `get_sentiment_trend` | `fetch_news` → Agent Registry (`news-analyzer-agent`) |
| scoring | 2/6 | `get_all_scores`, `get_engine_config`, `detect_rotation`, `analyze_value_pit` | `score_stock` → Agent Registry (`v6-scoring-agent`); `analyze_hot_sector` → Agent Registry (`v4-industrial-agent`) |
| system | 7/9 | `get_stats`, `reset_system` | `parse_v6_export`/`transform_v6_to_v9`/`import_to_v9`/`run_v6_migration`/`generate_migration_report` → `useMcpMigration.ts`; `fetch_health_report` → `HealthDashboardPage.tsx`; `export_data` → `useMcpMigration.ts` |
| trading | 1/10 | `scan_signals`, `advise_stock`, `get_orders`, `create_buy_order`, `create_sell_order`, `check_order_risk`, `calculate_position`, `get_strategy_snapshot`, `generate_trade_review` | `generate_mock_trading_data` → `TradingFlowPage.tsx`（仅 DEV 环境） |
| data-collector | 1/3 | `fetch_market_data`, `detect_missing_reports` | `build_collection_report` → `CollectTaskPage.tsx` |

### ? 全部活跃 Server

无。所有 12 个 Enabled Server 均存在不同程度的僵尸 Tool。

---

## 三、6 个 Disabled Server 审计结果（参考）

| Server | 状态 | 说明 |
|--------|------|------|
| backtest | ? 全部活跃 | `run_backtest` 有业务引用，但因参数复杂不适合 MCP 表达，已 disabled |
| export | ? 完全僵尸 | `export_backtest_report` 零业务引用，已 disabled |
| input | ? 完全僵尸 | 6 个 tool 全部零业务引用，已 disabled |
| screening | ? 完全僵尸 | 2 个 tool 全部零业务引用，已 disabled |
| stockpool | ?? 部分僵尸 | `list_pool_stocks`/`list_groups` 有 ACL 矩阵引用；`transition_stock` 零引用；已 disabled |
| trade | ? 完全僵尸 | 3 个 tool 全部零业务引用，已 disabled（与 trading 重叠） |

---

## 四、实际业务调用点汇总

### 直接 `mcpBridge.callTool()` 调用（按文件）

| 文件 | 调用 Server | 调用 Tool | 说明 |
|------|------------|----------|------|
| `useMcpMigration.ts:29` | system | `parse_v6_export`, `transform_v6_to_v9`, `import_to_v9`, `run_v6_migration` | V6→V9 数据迁移 |
| `useMcpMigration.ts:75` | system | `generate_migration_report` | 生成迁移报告 |
| `HealthDashboardPage.tsx:75` | system | `fetch_health_report` | 健康 dashboard |
| `CollectTaskPage.tsx:225` | data-collector | `build_collection_report` | 采集任务监控 |
| `TradingFlowPage.tsx:61` | trading | `generate_mock_trading_data` | 开发环境模拟数据 |
| `MCPServerDashboardPage.tsx:58` | *(通用)* | *(通用)* | MCP Server 管理后台（用户手动调用） |
| `agentRuntime.ts:132` | *(动态)* | *(动态)* | Agent 运行时根据 Registry 配置动态调用 |

### Agent Registry 间接调用（`src/components/organisms/agent/agentComponentRegistry.ts`）

| Agent ID | MCP Server | Default Tool | 说明 |
|----------|-----------|--------------|------|
| v6-scoring-agent | scoring:v6 | `score_stock` | V6 九维评分 |
| v4-industrial-agent | scoring:v6 | `analyze_hot_sector` | V4 行业评分 |
| llm-intelligent-agent | llm | `chat_completion` | LLM 智能分析 |
| fetcher-agent | fetcher | `fetch_stock_basic` | 数据采集 |
| news-analyzer-agent | news | `fetch_news` | 新闻分析 |

---

## 五、核心发现

### 5.1 Enabled Server 真实使用率

在 12 个 Enabled Server 中，**真正被业务代码或 Agent 系统调用的只有 7 个**：

- **system** — 被数据迁移和健康 dashboard 直接调用（7 个 tool 活跃）
- **data-collector** — 被采集任务监控页直接调用（1 个 tool 活跃）
- **trading** — 被交易流程页在 DEV 环境下直接调用（1 个 tool 活跃）
- **scoring** — 被 2 个 Agent 间接调用（2 个 tool 活跃）
- **fetcher** — 被 1 个 Agent + 配置页调用（2 个 tool 活跃）
- **llm** — 被 1 个 Agent 间接调用（1 个 tool 活跃）
- **news** — 被 1 个 Agent 间接调用（1 个 tool 活跃）

**完全无调用的 Enabled Server 有 5 个**：
`execution`, `knowledge`, `portfolio`, `workflow`, `analysis`

### 5.2 僵尸 Tool 统计

| 类别 | 数量 |
|------|------|
| 18 个 Server 总 Tool 数 | 89 |
| 业务活跃的 Tool 数 | 24 |
| 僵尸 Tool 数（仅测试/ACL矩阵引用） | 65 |
| 僵尸率 | **73%** |

---

## 六、建议行动

### 立即执行（P0）

1. **将 5 个完全僵尸的 Enabled Server 标记为 Disabled**：
   - `execution`, `knowledge`, `portfolio`, `workflow`, `analysis`
   - 理由：源码存在但业务零调用，继续启用会占用启动资源并增加维护负担
   - 在 `mcpServerRegistry.ts` 中将其 `enabled: false`，注释说明"零业务调用，待需求确认后恢复"

2. **清理完全僵尸的 Tool**：
   - 对于已确认永不会被调用的 Tool，从 Server 的 `getTools()` 中移除，减少 API 表面积
   - 优先清理：`analysis.analyze_stock`, `analysis.analyze_sector`, `knowledge.query_knowledge`

### 短期优化（P1）

3. **Agent Registry 补全**：
   - 若 `execution`, `portfolio`, `workflow` 有明确的 Agent 使用场景，应在 `agentComponentRegistry.ts` 中注册对应 Agent
   - 否则应保持 disabled 状态

4. **workflow Server 决策**：
   - 如果workflow是核心基础设施（供定时调度使用），需要补充调度器代码调用其 Tool
   - 如果暂时无调度需求，建议 disabled 并在恢复时补全调用链

### 中期治理（P2）

5. **建立 Tool 调用监控**：
   - 在 `mcpBridge.callTool()` 或 `agentRuntime.ts` 中添加调用计数器
   - 每月输出 "MCP Tool 调用热力图"，持续发现新的僵尸 Tool

6. **MCP Server 生命周期管理 SOP**：
   - 新增 Server 必须附带至少一个业务调用点（页面、Agent、或定时任务）
   - 新增 Tool 必须在 `agentComponentRegistry.ts` 或页面代码中注册引用
   - 合并入 `./mcp-module-status.md`

---

## 七、附录：审计脚本使用说明

```bash
# 运行审计脚本（需要 Python 3）
python scripts/mcp-tool-usage-audit.py

# 输出文件
# mcp_zombie_strict_report.json — 每个 Server 的 Tool 级引用详情
```

---

*本报告基于 `src/` 目录下截至 2026-07-20 的代码静态分析生成。如后续有动态调用（如字符串拼接的 Server/Tool 名）可能未被捕获。*
