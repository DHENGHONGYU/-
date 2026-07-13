# V9 智能投研复盘系统 — UI 改善部分检索报告

> 检索时间：2026-07-08 ｜ 范围：工作区根目录及 `docs/`、`scripts/`、`src/` 下 UI 相关文件
> 方法：Glob + Grep 全仓扫描 → 精读核心文档 → 磁盘实查核验「已落地」产物真伪

---

## 一、UI 改善相关文档总览（按主题分组）

### A. 顶层总体规划（1 份，最核心）
| 文件 | 价值 |
|---|---|
| `UI设计优化实施计划_详细版.md` | **主计划**。合并两份分析为 P0–P6 可验收路线图，含设计水准基线评分、令牌管线断裂发现、本回合落地产物清单 |

### B. 设计基线 / 原则 / 令牌
| 文件 | 内容 |
|---|---|
| `AGENTS.md` §三 | 颜色令牌规范 + 单一克制强调色公约 + 令牌管线一致性规则（P0 已增补） |
| `docs/design-tokens.md` | 设计令牌说明 |
| `docs/implementation/spacing-tokens.md` | 间距令牌 |
| `docs/reports/design-tokens-implementation-report.md` | 令牌实施报告 |
| `design-tokens/tokens.json` ＋ `src/generated/tokens.css\|tokens.ts` | 规范源（primary 已改为 emerald） |

### C. UI 组件库（V6→V9 迁移与补缺）
| 文件 | 内容 |
|---|---|
| `docs/audit/v6-v9-ui-component-comparison-report.md` | **47 vs 38 组件比对**；25+ 缺失组件清单 + 迁移优先级（高：navigation-menu/chart/calendar） |
| `docs/audit/v9-ui-component-feasibility-assessment.md` | 25 个缺失组件逐项可行性评估（业务必要性/成本/UX 价值/综合优先级） |
| `docs/implementation/ui-design-system.md` | UI 设计系统 |
| `docs/implementation/component-library-guide.md` | 组件库指南 |
| `docs/implementation/component-deprecation-policy.md` | 组件弃用策略 |

### D. 舱室级 UI 重塑
| 文件 | 内容 |
|---|---|
| `docs/implementation/input-cabin-ui-reshaping.md` | **输入舱体系化重塑**：PortalShell 深色布局、子页面拆分、路由映射（验收全绿） |
| `cockpit_整体设计一致性审查.md` | **驾驶舱 6 维一致性审查**（2026-07-08）：发现 1 孤立 widget、2 处数据来源偏离 |
| `docs/audit/v6-v9-ui-component-comparison-report.md` ＋ `docs/implementation/v6-cockpit-ui-reference.md` | 驾驶舱 UI 参照 |
| `output-cabin-remediation-report.md` | 输出舱整改 |
| `docs/implementation/v6pro-ui-page-diff-report.md` | V6 Pro 页面差异 |

### E. 测试 / 质检 / 无障碍
| 文件 | 内容 |
|---|---|
| `docs/superpowers/plans/2026-07-04-ui-testing-optimization.md` | **UI 测试与优化方案**（6 Phase，Button/Input/Dialog/Card + 5 舱 Hub + 颜色/间距审计 + 四态 + 响应式 + A11y） |
| `docs/changelogs/2026-07/2026-07-05-ui-testing-optimization.md` | 上计划执行变更日志 |
| `docs/implementation/a11y-checklist.md` | WCAG 2.1 AA 无障碍清单（已/待更新组件表） |
| `APP上线前体检清单_v9.html` | 上线体检含「用户体验」模块（U01–U08） |
| `scripts/a11y-contrast.cjs` | WCAG 对比度校验脚本（P0 已创建，可运行） |

### F. 实施记录 / 验收
| 文件 | 内容 |
|---|---|
| `docs/changelogs/2026-07/2026-07-05-color-refactor-p1.md` ＋ `-p2.md` | 颜色重构记录 |
| `docs/implementation/ui-only-implementation-summary.md` | UI-only 实施小结 |

---

## 二、已落地 ✅ vs 待办 ⏳（P0–P6 状态）

| 阶段 | 目标 | 状态 | 磁盘实查 |
|---|---|---|---|
| **P0** 设计基线固化 | 令牌单一真相源 + 主色 AA 校验 + 单强调色 | ✅ 已落地 | `tokens.json`/`tokens.css`/`theme.tokens.design.ts`/`a11y-contrast.cjs` 均存在 |
| **P1** 暗色优先 & 主题体验 | 驾驶舱默认暗色 + 持久化 + 无 FOUC | ⏳ 计划中 | `src/store/themeStore.ts` **不存在** |
| **P2** 统一视觉锚点（签名母题） | SignalSpectrum 母题 + WidgetShell 收口 | 🟡 组件已建，收口未完 | `SignalSpectrum.tsx` **存在**；核心 widget 接入 ⏳ |
| **P3** 交互与状态标准（四态） | Loading/Empty/Error/Skeleton + 动效令牌 | 🟡 组件已建，推广未完 | `states/{Loading,Empty,Error,Skeleton}.tsx` + `THEME_TOKENS.motion` **均存在** |
| **P4** 令牌迁移债清零 & 视觉 QA 闸门 | lint 禁裸色类 + token-scan CI 卡点 | ⏳ 未启动 | `scripts/token-scan.cjs` **不存在** |
| **P5** 结果优先呈现 & 渐进披露 | 成品卡 + 向导式复盘 | ⏳ 未启动 | `ResultCard.tsx` **不存在** |
| **P6** 移动适配 & 巡检 skill | 响应式 + ui-design-audit skill | ⏳ 未启动 | — |

> 实测对照：P0/P2/P3 计划标注 ✅ 的产物 **10/10 全部真实落地**；P1/P4/P5/P6 标注 ⏳ 的产物 **均未落地**，与计划一致 → 文档与代码相符，无虚报。

---

## 三、关键发现 / 风险（值得关注）

1. **令牌管线断裂（真实证据）**：`tailwind.config.js` 的 `primary` 消费 `index.css` 手写的 `--primary`（绿）；`generate-tokens.ts` 生成的 `--color-primary` 是**未被消费的死变量**（已 grep 确认无引用）。规范源 `tokens.json` 与运行时实际生效色并不真正连通。P0 已将 `tokens.json` 蓝→emerald 对齐，但**真·单一真相源**仍需 P4 修正生成器输出 `--primary` 才能闭合。
2. **对比度未达正文 AA**：绿/emerald 主色配白字约 3.4–3.8（满足大字号 AA 3:1，未达正文 AA 4.5:1）；`emerald.700(#15803d)` 白字达 5.02。`index.css` 注释「≥4.5:1」对正文不严谨。
3. **驾驶舱孤立 widget（F1）**：`SignalQualityDashboardWidget.tsx` 已实现但**未注册进 widgetRegistry**，全仓零引用、无测试 → 用户不可达（类先前 I3）。建议注册或标注为分析专用，**删除须你批准**。
4. **驾驶舱数据来源偏离（F2/F3）**：`FundFlowWidget` 走 `MockMarketDataProvider` 绕过统一 `MarketDataProvider`（疑 demo 占位）；`SignalQualityDashboardWidget` 走独立合规 store，差异可接受但需文档注明。
5. **组件补缺缺口（高优先）**：V9 组件库比 V6 少 9 个，**navigation-menu / chart / calendar** 为 P0 业务必需（PortalShell 导航、可视化、日期选择），可行性评估已强烈建议增加。
6. **UI 测试计划第一批（9 项）标注 ✅** 但属计划文档的勾选预期，是否真实跑通需以 `npm run test` 实测为准（计划本身注明「等待用户确认后继续下一批」）。

---

## 四、建议下一步（供你决策）

- **闭合令牌管线**：执行 P4，修正 `generate-tokens.ts` 输出 `--primary` 而非 `--color-primary`，使 `tokens.json` 真正驱动 UI（消除死变量）。
- **F1 处置**：确认 `SignalQualityDashboardWidget` 注册进 cockpit 还是标注分析专用（我可先列影响面，删除/改动的动作会先征得你同意）。
- **F2 核实**：确认 `FundFlowWidget` 是否应接入真实数据流。
- **高优组件补缺**：启动 navigation-menu / chart / calendar 的迁移或新实现（已有可行性评估支撑）。
- **暗色体验（P1）**：补 `themeStore.ts` 跨 Tab 同步 + `index.html` 内联防 FOUC。

> 本轮为**纯检索 + 核验**，未做任何修改、删除。如需上述任一项落地，告诉我即可，我会先给影响面评估再执行。
