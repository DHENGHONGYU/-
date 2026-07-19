---
title: Command 舱规格（command-cabin-spec�?
type: reference
domain: project
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "command 舱（总控舱）的职责边界、子路由、数据流。补�? 舱缺 spec」缺口�?
tags: [project, input-cabin, spec, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-088
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: project
tier: important
doc_id: V9-DOC-PROJ-088
status: active
maintainer: V9 Architecture Team
summary: "command 舱（总控舱）的职责边界、子路由、数据流。补�? 舱缺 spec」缺口�?
tags: [project, input-cabin, spec]
phase: design
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# Command 舱规格（command-cabin-spec�?
> **定位**：command 舱（总控舱）的职责边界、子路由、数据流。补�? 舱缺 spec」缺口�?> **权威契约**：`../../AGENTS.md`；路由见 `./06-routing-specs.md`；总览�?`../explanation/cabins-overview.md`�?> **状�?*：✅ P0 新增（骨架版�?
---

## 1. 职责边界

总控舱：横向监控全系统健康度、管�?Agent/MCP 服务、编排任务、展示能力图谱与 Showcase。是系统的「控制塔」，不直接承载业务分析�?
## 2. 页面与子路由

以单一分发�?+ 多子路由实现（页面文件仅 `MCPServerDashboardPage.tsx` 壳，功能面最广）�?
| 子路�?| 职责 |
|--------|------|
| `/command`（默�?/ hub�?| 总控中枢 |
| `/command/health` | **架构健康仪表�?*（综合评�?+ 7 项指标） |
| `/command/agents/*` | Agent 编排：registry / tasks / dag-scheduler / feedback / llm / model-upgrade / optimization / skill-audit / capability-graph / api-config / custom / changelog / trigger |
| `/command/mcp-servers` | MCP 服务管理 |
| `/command/monitor` | 监控 |
| `/command/config` | 配置 |
| `/command/showcase` | 能力展示 |

## 3. 路由与分�?
入口 `/command` �?`src/apps/command/CommandApp.tsx` 分发 �?子路由组件�?
## 4. 数据�?
读全系统 `store` + `system` 服务健康指标 �?`/command/health` 仪表盘；Agent/MCP �?`ai-center` / `llm` 服务编排�?
## 5. 跨舱依赖

- 横向监控：`input / analysis / trading / output` 全部
- 协作：`ai-center`、`llm`、`system`、`services/useCase`
- 文档：`docs/command/health` 报告生成（`npm run build:health` �?`public/health-report.json`�?
## 6. 文档锚点

- 总览：`../explanation/cabins-overview.md`
- 路由：`./06-routing-specs.md`
- 健康仪表盘：�?`/command/health` �?`public/health-report.json`
- 服务：`./services-catalog.md`（system / ai-center / useCase�?