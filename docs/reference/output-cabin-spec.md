---
title: Output 舱规格（output-cabin-spec�?
type: reference
domain: project
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "output 舱（产出与复盘）的职责边界、页面、路由、数据流。补�? 舱缺 spec」缺口�?
tags: [project, input-cabin, spec, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-100
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: project
tier: important
doc_id: V9-DOC-PROJ-100
status: active
maintainer: V9 Architecture Team
summary: "output 舱（产出与复盘）的职责边界、页面、路由、数据流。补�? 舱缺 spec」缺口�?
tags: [project, input-cabin, spec]
phase: design
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# Output 舱规格（output-cabin-spec�?
> **定位**：output 舱（产出与复盘）的职责边界、页面、路由、数据流。补�? 舱缺 spec」缺口�?> **权威契约**：`../../AGENTS.md`；路由见 `./06-routing-specs.md`；总览�?`../explanation/cabins-overview.md`�?> **状�?*：✅ P0 新增（骨架版�?
---

## 1. 职责边界

产出与复盘中枢：�?analysis 的分析结论与 trading 的交易记录，组织为仪表盘、研究报、复盘向导与交易复盘，是用户最终消费价值的出口�?
## 2. 页面清单�? 个，文件位于 `src/pages/output/`�?
| 页面文件 | 路由 | 职责 |
|----------|------|------|
| DashboardPage | `/output`(默认) | 产出仪表�?|
| OutputHubPage | `/output/hub` | 输出中枢 |
| ResearchReportPage | `/output/report` | 研究报生�?|
| ReviewWizardPage | `/output/review` | 复盘向导 |
| TradeReviewPage | `/output/trade-review` | 交易复盘 |

## 3. 路由与分�?
入口 `/output` �?`src/apps/output/OutputApp.tsx` 分发 �?上述 `*Page`�?
## 4. 数据�?
`store/*`（analysis/trading 结果�?�?`services/export` + 报告生成 �?`pages/output/*Page` 渲染；复盘经 `ReviewWizard` 回写 IndexedDB�?
## 5. 跨舱依赖

- 上游：`analysis`、`trading`
- 下游：`command`（健康监控）
- 共享：`cockpit` Widget（Dashboard 相关�?
## 6. 文档锚点

- 总览：`../explanation/cabins-overview.md`
- 路由：`./06-routing-specs.md`
- 服务：`./services-catalog.md`（export�?