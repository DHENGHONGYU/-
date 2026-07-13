# Command 舱规格（command-cabin-spec）

> **定位**：command 舱（总控舱）的职责边界、子路由、数据流。补「4 舱缺 spec」缺口。
> **权威契约**：`AGENTS.md`；路由见 `02-design/06-routing-specs.md`；总览见 `architecture/cabins-overview.md`。
> **状态**：✅ P0 新增（骨架版）

---

## 1. 职责边界

总控舱：横向监控全系统健康度、管理 Agent/MCP 服务、编排任务、展示能力图谱与 Showcase。是系统的「控制塔」，不直接承载业务分析。

## 2. 页面与子路由

以单一分发器 + 多子路由实现（页面文件仅 `MCPServerDashboardPage.tsx` 壳，功能面最广）：

| 子路由 | 职责 |
|--------|------|
| `/command`（默认 / hub） | 总控中枢 |
| `/command/health` | **架构健康仪表盘**（综合评分 + 7 项指标） |
| `/command/agents/*` | Agent 编排：registry / tasks / dag-scheduler / feedback / llm / model-upgrade / optimization / skill-audit / capability-graph / api-config / custom / changelog / trigger |
| `/command/mcp-servers` | MCP 服务管理 |
| `/command/monitor` | 监控 |
| `/command/config` | 配置 |
| `/command/showcase` | 能力展示 |

## 3. 路由与分发

入口 `/command` → `src/apps/command/CommandApp.tsx` 分发 → 子路由组件。

## 4. 数据流

读全系统 `store` + `system` 服务健康指标 → `/command/health` 仪表盘；Agent/MCP 经 `ai-center` / `llm` 服务编排。

## 5. 跨舱依赖

- 横向监控：`input / analysis / trading / output` 全部
- 协作：`ai-center`、`llm`、`system`、`services/useCase`
- 文档：`docs/command/health` 报告生成（`npm run build:health` → `public/health-report.json`）

## 6. 文档锚点

- 总览：`architecture/cabins-overview.md`
- 路由：`02-design/06-routing-specs.md`
- 健康仪表盘：见 `/command/health` 与 `public/health-report.json`
- 服务：`architecture/services-catalog.md`（system / ai-center / useCase）
