---
title: 路由规范（Routing Specs）
doc_id: V9-DOC-REF-906
tier: important
status: active
version: v1.0.0
last_updated: 2026-07-21
code_version: 2.0.0
---
# 路由规格文档 (Routing Specs)

> 自动提取自 `src/config/routes.ts`，最后同步: 2026-07-18
> 补充报告 P1-14: docs/routing-specs.md 缺失 → 已创建

---

## 路由架构

FinsightV9 采用扁平路由表 + React.lazy 懒加载架构。每个路由对应一个页面组件和可选子路由。

---

## 路由清单

### 根路由
| 路径 | 页面 | 备注 |
|------|------|------|
| `/` | HomePage | 首页 |

### 驾驶舱
| 路径 | 页面 | 备注 |
|------|------|------|
| `/cockpit` | CockpitPage | 驾驶舱主入口（26 Widget） |

### 输入舱 (Input)
| 路径 | 页面 | 备注 |
|------|------|------|
| `/input` | InputHubPage | 输入舱首页（重定向） |
| `/input/hub` | InputHubPage | 输入舱 Hub |
| `/input/hot-sectors` | HotSectorsPage | 热门板块 |
| `/input/intention-pool` | IntentionPoolBoardPage | 意向候选池（自选股导入+热门板块推荐+三列看板） |
| `/input/data-test` | DataTestPage | 数据测试 |

### 分析舱 (Analysis)
| 路径 | 页面 | 备注 |
|------|------|------|
| `/analysis` | AnalysisHubPage | 分析舱首页（重定向） |
| `/analysis/hub` | AnalysisHubPage | 分析舱 Hub |

### 交易舱 (Trading)
| 路径 | 页面 | 备注 |
|------|------|------|
| `/trading` | TradingHubPage | 交易舱首页（重定向） |
| `/trading/flow` | TradingFlowPage | 交易流程 |

### 输出舱 (Output)
| 路径 | 页面 | 备注 |
|------|------|------|
| `/output` | OutputHubPage | 输出舱首页 |
| `/output/hub` | OutputHubPage | 输出 Hub |
| `/output/research` | ResearchReportPage | 研报输出 |
| `/output/review` | ReviewWizardPage | 复盘向导 |
| `/output/export` | ExportPage | 数据导出 |
| `/output/dashboard` | OutputDashboardPage | 输出仪表盘 |
| `/output/wizard` | OutputWizardPage | 输出向导 |
| `/output/prediction` | PredictionPage | 预测校验 |
| `/output/retrospective` | RetrospectivePage | 回测分析 |
| `/output/factor-dashboard` | FactorDashboardPage | 因子看板 |
| `/output/profile` | ProfileBrowsePage | 八域资料浏览 |

### 指令舱 (Command)
| 路径 | 页面 | 备注 |
|------|------|------|
| `/command` | CommandHubPage | 指令舱首页 |
| `/command/hub` | CommandHubPage | 指令舱 Hub |
| `/command/agents` | AgentsPage | 智能体列表 |
| `/command/agents/registry` | AgentRegistryPage | Agent 注册表 |
| `/command/agents/registry/:agentId` | AgentDetailPage | Agent 详情 |
| `/command/agents/trigger` | AgentTriggerPage | Agent 触发 |
| `/command/agents/tasks` | AgentTasksPage | Agent 任务 |

### 通用
| 路径 | 页面 | 备注 |
|------|------|------|
| `/showcase` | ShowcasePage | 组件展示（仅 dev） |
| `*` | NotFoundPage | 404 页面 |

---

## 路由统计

| 舱位 | 路由数 |
|------|--------|
| 根 | 2 |
| 驾驶舱 | 1 |
| 输入舱 | 5 |
| 分析舱 | 2 |
| 交易舱 | 2 |
| 输出舱 | 10 |
| 指令舱 | 7 |
| 通用 | 2 |
| **总计** | **31** |

---

## 导航结构

```
/ (首页)
├── /cockpit (驾驶舱)
├── /input (输入舱)
│   ├── /hub
│   ├── /hot-sectors
│   ├── /intention-pool
│   └── /data-test
│   └── （批量导入已整合到 InputDashboard Tabs 中，不再有独立路由）
├── /analysis (分析舱)
│   └── /hub
├── /trading (交易舱)
│   └── /flow
├── /output (输出舱)
│   ├── /hub
│   ├── /research (研报)
│   ├── /review (复盘)
│   ├── /export
│   ├── /dashboard
│   ├── /wizard
│   ├── /prediction
│   ├── /retrospective
│   ├── /factor-dashboard
│   └── /profile
└── /command (指令舱)
    ├── /hub
    ├── /agents
    │   ├── /registry
    │   │   └── /:agentId
    │   ├── /trigger
    │   └── /tasks
```

---

## 维护规则

1. 新增页面必须在此文档登记路径和页面组件
2. 变更路由后运行 `npm run audit:deadcode` 确认无孤儿页面
3. 此文档与 `src/config/routes.ts` 保持同步（T8 触发）
