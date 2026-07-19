---
title: ui改善部分检索报�?
type: explanation
domain: project
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "UI 改善专项检索报告：定位 V9 界面改善相关的文档与代码锚点�?
tags: [project, plan, report, design, governance, documentation, strategy, architecture, component, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-052
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: project
phase: design
tier: important
doc_id: V9-DOC-PROJ-052
status: active
maintainer: V9 Architecture Team
summary: "UI 改善专项检索报告：定位 V9 界面改善相关的文档与代码锚点�?
tags: [project, plan, report, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 智能投研复盘系统 �?UI 改善部分检索报�?
> 检索时间：2026-07-08 �?范围：工作区根目录及 `docs/`、`scripts/`、`src/` �?UI 相关文件
> 方法：Glob + Grep 全仓扫描 �?精读核心文档 �?磁盘实查核验「已落地」产物真�?
---

## 一、UI 改善相关文档总览（按主题分组�?
### A. 顶层总体规划�? 份，最核心�?| 文件 | 价�?|
|---|---|
| `../../reference/ui设计优化实施计划-详细�?md` | **主计�?*。合并两份分析为 P0–P6 可验收路线图，含设计水准基线评分、令牌管线断裂发现、本回合落地产物清单 |

### B. 设计基线 / 原则 / 令牌
| 文件 | 内容 |
|---|---|
| `../../../AGENTS.md` §�?| 颜色令牌规范 + 单一克制强调色公�?+ 令牌管线一致性规则（P0 已增补） |
| `../../reference/design-tokens.md` | 设计令牌说明 |
| `./spacing-tokens.md` | 间距令牌 |
| `docs/reports/design-tokens-implementation-report.md` | 令牌实施报告 |
| `design-tokens/tokens.json` �?src/generated/tokens.css �?tokens.ts | 规范源（primary 已改�?emerald�?|

### C. UI 组件库（V6→V9 迁移与补缺）
| 文件 | 内容 |
|---|---|
| `../../reports/audit/v6-v9-ui-component-comparison-report.md` | **47 vs 38 组件比对**�?5+ 缺失组件清单 + 迁移优先级（高：navigation-menu/chart/calendar�?|
| `../../reports/audit/v9-ui-component-feasibility-assessment.md` | 25 个缺失组件逐项可行性评估（业务必要�?成本/UX 价�?综合优先级） |
| `./ui-design-system.md` | UI 设计系统 |
| `./component-library-guide.md` | 组件库指�?|
| `../../reference/component-deprecation-policy.md` | 组件弃用策略 |

### D. 舱室�?UI 重塑
| 文件 | 内容 |
|---|---|
| `../../reference/input-cabin-ui-reshaping.md` | **输入舱体系化重塑**：PortalShell 深色布局、子页面拆分、路由映射（验收全绿�?|
| `../../reports/audit/cockpit_整体设计一致性审�?md` | **驾驶�?6 维一致性审�?*�?026-07-08）：发现 1 孤立 widget�? 处数据来源偏�?|
| `../../reports/audit/v6-v9-ui-component-comparison-report.md` �?`../../reference/v6-cockpit-ui-reference.md` | 驾驶�?UI 参照 |
| `../../reports/audit/output-cabin-remediation-report.md` | 输出舱整�?|
| `../v6pro-ui-page-diff-report.md` | V6 Pro 页面差异 |

### E. 测试 / 质检 / 无障�?| 文件 | 内容 |
|---|---|
| `../../reference/2026-07-04-ui-testing-optimization.md` | **UI 测试与优化方�?*�? Phase，Button/Input/Dialog/Card + 5 �?Hub + 颜色/间距审计 + 四�?+ 响应�?+ A11y�?|
| `../../reference/changelogs/2026-07/2026-07-05-ui-testing-optimization.md` | 上计划执行变更日�?|
| `../a11y-checklist.md` | WCAG 2.1 AA 无障碍清单（�?待更新组件表�?|
| `APP上线前体检清单_v9.html` | 上线体检含「用户体验」模块（U01–U08�?|
| `scripts/other/a11y-contrast.cjs` | WCAG 对比度校验脚本（P0 已创建，可运行） |

### F. 实施记录 / 验收
| 文件 | 内容 |
|---|---|
| `../../reference/changelogs/2026-07/2026-07-05-color-refactor-p1.md` �?`../../archive/-p2.md` | 颜色重构记录 |
| `../ui-only-implementation-summary.md` | UI-only 实施小结 |

---

## 二、已落地 �?vs 待办 ⏳（P0–P6 状态）

| 阶段 | 目标 | 状�?| 磁盘实查 |
|---|---|---|---|
| **P0** 设计基线固化 | 令牌单一真相�?+ 主色 AA 校验 + 单强调色 | �?已落�?| `tokens.json`/`tokens.css`/`theme.tokens.design.ts`/`a11y-contrast.cjs` 均存�?|
| **P1** 暗色优先 & 主题体验 | 驾驶舱默认暗�?+ 持久�?+ �?FOUC | �?计划�?| `src/core/ThemeProvider.tsx` **不存�?* |
| **P2** 统一视觉锚点（签名母题） | SignalSpectrum 母题 + WidgetShell 收口 | 🟡 组件已建，收口未�?| `SignalSpectrum.tsx` **存在**；核�?widget 接入 �?|
| **P3** 交互与状态标准（四态） | Loading/Empty/Error/Skeleton + 动效令牌 | 🟡 组件已建，推广未�?| `states/{Loading,Empty,Error,Skeleton}.tsx` + `THEME_TOKENS.motion` **均存�?* |
| **P4** 令牌迁移债清�?& 视觉 QA 闸门 | lint 禁裸色类 + token-scan CI 卡点 | �?未启�?| `scripts/other/token-scan.cjs` **不存�?* |
| **P5** 结果优先呈现 & 渐进披露 | 成品�?+ 向导式复�?| �?未启�?| `ResultCard.tsx` **不存�?* |
| **P6** 移动适配 & 巡检 skill | 响应�?+ ui-design-audit skill | �?未启�?| �?|

> 实测对照：P0/P2/P3 计划标注 �?的产�?**10/10 全部真实落地**；P1/P4/P5/P6 标注 �?的产�?**均未落地**，与计划一�?�?文档与代码相符，无虚报�?
---

## 三、关键发�?/ 风险（值得关注�?
1. **令牌管线断裂（真实证据）**：`tailwind.config.js` �?`primary` 消费 `index.css` 手写�?`--primary`（绿）；`generate-tokens.ts` 生成�?`--color-primary` �?*未被消费的死变量**（已 grep 确认无引用）。规范源 `tokens.json` 与运行时实际生效色并不真正连通。P0 已将 `tokens.json` 蓝→emerald 对齐，但**真·单一真相�?*仍需 P4 修正生成器输�?`--primary` 才能闭合�?2. **对比度未达正�?AA**：绿/emerald 主色配白字约 3.4�?.8（满足大字号 AA 3:1，未达正�?AA 4.5:1）；`emerald.700(#15803d)` 白字�?5.02。`index.css` 注释「≥4.5:1」对正文不严谨�?3. **驾驶舱孤�?widget（F1�?*：`SignalQualityDashboardWidget.tsx` 已实现但**未注册进 widgetRegistry**，全仓零引用、无测试 �?用户不可达（类先�?I3）。建议注册或标注为分析专用，**删除须你批准**�?4. **驾驶舱数据来源偏离（F2/F3�?*：`FundFlowWidget` �?`MockMarketDataProvider` 绕过统一 `MarketDataProvider`（疑 demo 占位）；`SignalQualityDashboardWidget` 走独立合�?store，差异可接受但需文档注明�?5. **组件补缺缺口（高优先�?*：V9 组件库比 V6 �?9 个，**navigation-menu / chart / calendar** �?P0 业务必需（PortalShell 导航、可视化、日期选择），可行性评估已强烈建议增加�?6. **UI 测试计划第一批（9 项）标注 �?* 但属计划文档的勾选预期，是否真实跑通需�?`npm run test` 实测为准（计划本身注明「等待用户确认后继续下一批」）�?
---

## 四、建议下一步（供你决策�?
- **闭合令牌管线**：执�?P4，修�?`generate-tokens.ts` 输出 `--primary` 而非 `--color-primary`，使 `tokens.json` 真正驱动 UI（消除死变量）�?- **F1 处置**：确�?`SignalQualityDashboardWidget` 注册�?cockpit 还是标注分析专用（我可先列影响面，删�?改动的动作会先征得你同意）�?- **F2 核实**：确�?`FundFlowWidget` 是否应接入真实数据流�?- **高优组件补缺**：启�?navigation-menu / chart / calendar 的迁移或新实现（已有可行性评估支撑）�?- **暗色体验（P1�?*：补 `themeStore.ts` �?Tab 同步 + `index.html` 内联�?FOUC�?
> 本轮�?*纯检�?+ 核验**，未做任何修改、删除。如需上述任一项落地，告诉我即可，我会先给影响面评估再执行�?