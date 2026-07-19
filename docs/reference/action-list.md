---
title: V9 五层追溯审计 �?修复行动清单
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计范围：批�?A-E�?8 个功能入�?+ 21 �?Widget�?> 问题总数�?5 项（P0=7 / P1=13 / P2=15�?> 预计总工�?*：约 79..."
tags: [project, plan, checklist, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-235
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 五层追溯审计 �?修复行动清单

> **审计范围**：批�?A-E�?8 个功能入�?+ 21 �?Widget�?> **问题总数**�?5 项（P0=7 / P1=13 / P2=15�?> **预计总工�?*：约 79 人时（P0: 28h / P1: 31h / P2: 20h�?> **建议修复周期**�? 个迭代（2 �?/ 迭代�?
---

## 一、P0 阻塞级（功能不可用，立即修复�?
> **定义**：核心功能完全不可用，用户无法完成基本操作；或页面文件缺失、仅 Mock/桩代码�?> **修复时限**：下一迭代必须完成�?
| 编号 | 问题摘要 | 位置 | 影响范围 | 修复建议 | 预计工时 |
|:---|:---|:---|:---|:---|:---|
| **P0-01** | 七维分析页面全为 TODO �?| `src/pages/input/` 七维分析�?| 输入�?B7 | 按四步契约实现：�?类型定义 �?�?Store �?�?DataBridge �?�?UI。saveConfig �?runCollection 需接入真实采集逻辑 | 8h |
| **P0-02** | 采集器配置页全页 Mock | `src/pages/input/` 采集器配置页 | 输入�?B8 | 实现采集器配�?CRUD：配置表单、校验逻辑、持久化�?IndexedDB、对�?DataBridge | 6h |
| **P0-03** | 采集任务页全�?Mock | `src/pages/input/` 采集任务�?| 输入�?B9 | 实现任务列表、任务创�?编辑/删除、任务状态追踪、执行日志展�?| 6h |
| **P0-04** | TradingHubPage.tsx 文件不存�?| `src/apps/trading/TradingApp.tsx` | 交易�?D1 | 创建交易�?Hub 页面，包含快捷入口卡片、统计概览、导航到各子页面 | 2h |
| **P0-05** | 持仓交易操作为桩实现 | `src/pages/trading/HoldingsPage.tsx` | 交易�?D4 | 实现真实买入/卖出/调仓逻辑，通过 DataBridge 写入交易记录，更新持仓数�?| 4h |
| **P0-06** | 持仓导出为桩实现 | `src/pages/trading/HoldingsPage.tsx` | 交易�?D4 | 实现 CSV/Excel 导出功能，支持当前持仓和历史交易两种导出模式 | 2h |
| **P0-07** | 持仓数据未实际加�?| `src/pages/trading/HoldingsPage.tsx` + `holdingsStore` | 交易�?D4 | 打�?DataBridge �?holdingsStore �?UI 的数据链路；fetchData 需真实查询 IndexedDB 并更�?Store | 4h |

**P0 小计�? �?/ 32 人时**

---

## 二、P1 严重级（功能降级，高优修复）

> **定义**：功能可用但存在明显缺陷（状态断裂、数据不持久、无三态），影响用户体验或数据完整性�?> **修复时限**：两个迭代内完成�?
| 编号 | 问题摘要 | 位置 | 影响范围 | 修复建议 | 预计工时 |
|:---|:---|:---|:---|:---|:---|
| **P1-01** | 批量导入无专�?Store | `src/apps/input/BulkImportPanel.tsx` | 输入�?B3 | 新建 `bulkImportStore.ts`，迁�?useState �?Zustand actions，接�?withBroadcast | 2h |
| **P1-02** | 输入�?Hub 状态层断裂 | `src/apps/input/InputApp.tsx` | 输入�?B1 | 新建 `inputHubStore.ts`，统计数据从 Store 获取而非硬编�?| 1.5h |
| **P1-03** | 录入看板状态层断裂 | `src/apps/input/InputDashboard.tsx` | 输入�?B2 | 统一接入 `poolStore` 或独�?Store，替�?usePoolData hook 的直接调�?| 2h |
| **P1-04** | 热门板块绕过 Store 直用静态数�?| `src/apps/input/HotSectorPanel.tsx` | 输入�?B4 | 接入 `hotSectorStore`，数据通过 DataBridge 流入而非静态常�?| 2h |
| **P1-05** | 采集测试数据不持久化 | `src/apps/input/DataTestPanel.tsx` | 输入�?B6 | 新建 `dataTestStore.ts`，测试结果通过 DataBridge 写入 IndexedDB | 2h |
| **P1-06** | V6ScoreCard �?useState 绕过 Store | `src/components/.../V6ScoreCard.tsx` | 分析�?C4 | 迁移�?`intelligentScoreStore`，状态统一管理，遵守四步契�?| 2h |
| **P1-07** | NewsPage 未消�?store �?loading/error 状�?| `src/pages/analysis/NewsPage.tsx` | 分析�?C8 | 接入 `analysisNewsStore` �?loading/error 状态，展示骨架屏和错误重试 | 1.5h |
| **P1-08** | intelligentScoreStore 未订�?DataBridge | `src/store/intelligentScoreStore.ts` | 分析�?C4 | �?Store 中添�?DataBridge.subscribe，数据变更自动同步到 Store | 1.5h |
| **P1-09** | 交易信号 Facade 同步未激�?| `src/apps/trading/TradingApp.tsx` | 交易�?D2 | 调用 `initTradingStoreFacadeSync()`，打通多 Store 间的 Facade 同步 | 2h |
| **P1-10** | 策略快照 DataBridge 订阅未激�?| `src/pages/trading/StrategySnapshotPage.tsx` | 交易�?D3 | 添加 `useEffect` 订阅 DataBridge，策略快照数据变更实时更�?UI | 1.5h |
| **P1-11** | 交易信号看板缺少 loading/error 状�?| `src/apps/trading/TradingApp.tsx` | 交易�?D2 | 添加骨架�?loading 状�?+ 错误重试组件 + empty 空状态引�?| 2h |
| **P1-12** | Agent 反馈数据无持久化 | `src/store/agentStore.ts` + Agent 反馈�?| 总控�?Agent 子系�?| AgentFeedback 数据通过 DataBridge 写入 IndexedDB，新�?`agent_feedback` store | 4h |
| **P1-13** | Agent 任务历史无持久化 | `src/store/agentStore.ts` + Agent 任务�?| 总控�?Agent 子系�?| AgentTaskHistoryEntry 数据持久化到 IndexedDB，新�?`agent_task_history` store | 4h |

**P1 小计�?3 �?/ 31 人时**

---

## 三、P2 优化级（代码规范与体验优化）

> **定义**：功能正常但存在代码规范问题（硬编码、命名不一致）或体验瑕疵（缺引导、缺动画）�?> **修复时限**：三个迭代内完成，或随业务迭代一并修复�?
| 编号 | 问题摘要 | 位置 | 影响范围 | 修复建议 | 预计工时 |
|:---|:---|:---|:---|:---|:---|
| **P2-01** | `/input/hub` �?`/input` 功能重复 | 输入�?B1 + B2 | 输入舱导�?| 合并或明确分工：Hub 做导航聚合，`/input` 做录入看板主入口 | 1h |
| **P2-02** | 多处�?empty 引导�?| 输入�?B1/B2/B4 �?| 输入�?| 为无数据场景添加空状态插�?+ 操作引导按钮 | 2h |
| **P2-03** | 分析舱多处缺 loading spinner | 分析�?C2/C3/C3b/C7 | 分析�?| 统一添加骨架屏或 Spinner 组件，与 Store loading 状态绑�?| 2h |
| **P2-04** | valuePitStore 使用硬编码样本数�?| `src/store/valuePitStore.ts` | 分析�?C10 | 接入真实数据源，初始状态改为空数组 + loading | 1.5h |
| **P2-05** | analysisNewsStore 未集�?DataBridge | `src/store/analysisNewsStore.ts` | 分析�?C8 | 完成 DataBridge 双向集成：forward 写入 + subscribe 读取 | 1.5h |
| **P2-06** | 分析舱根路由�?loading/empty 引导 | `src/pages/analysis/` 根路�?| 分析�?C11 | 添加路由�?loading �?empty �?| 1h |
| **P2-07** | Widget 颜色硬编�?| `src/cockpit/widgets/MarketIndicesWidget.tsx` �?| 驾驶�?A2 | 迁移�?`COLOR_TOKENS` �?`COLOR_SHADES` 令牌系统 | 1.5h |
| **P2-08** | HotSectorWidget �?loading/error �?| `src/cockpit/widgets/HotSectorWidget.tsx` | 驾驶�?A2 | 添加 WidgetSkeleton �?WidgetErrorBoundary 集成 | 1h |
| **P2-09** | 交易舱颜色硬编码 | `src/pages/trading/` 多个文件 | 交易�?D2/D3/D4 | 迁移到颜色令牌系�?| 1.5h |
| **P2-10** | 交易舱分类阈值硬编码 | `src/store/tradingStore.ts` | 交易�?D2 | 提取�?`src/config/thresholds.ts` 配置文件 | 1h |
| **P2-11** | tradingHubStore 空壳 | `src/store/tradingHubStore.ts` | 交易�?D1 | 完善 Store �?state/actions，或�?D1 实现后同步充�?| 1h（与 P0-04 联动�?|
| **P2-12** | 总控舱多处颜色硬编码 | `src/pages/command/` 多个文件 | 总控�?E2/E3 | 迁移到颜色令牌系�?| 1.5h |
| **P2-13** | 术语不一致（信号/策略/因子混用�?| 全项�?UI 文案 | 所有舱 | 统一术语表，review 所有可见文�?| 2h |
| **P2-14** | 配置面板缺失（部分模块） | 总控舱配置管�?| 总控�?| 完善配置面板 UI，对�?localStorageManager 加密存储 | 1.5h |
| **P2-15** | 首页�?loading/error（设计选择，但建议补空态） | `src/pages/HomePage.tsx` | 批次 A1 | 添加首次访问引导和功能提示卡�?| 0.5h |

**P2 小计�?5 �?/ 21 人时**（P2-11 �?P0-04 联动，实际工时约 20h�?
---

## 四、按模块分组的修复路线图

### 迭代 1：P0 清零 + 关键 P1（约 2 周）

**目标**：所有入口功能可用，消除 Mock/桩代码�?
| 模块 | 任务编号 | 内容 | 工时 | 依赖 |
|:---|:---|:---|:---|:---|
| **输入�?B7** | P0-01 | 七维分析页面完整实现 | 8h | �?|
| **输入�?B8** | P0-02 | 采集器配�?CRUD 实现 | 6h | �?|
| **输入�?B9** | P0-03 | 采集任务列表实现 | 6h | P0-02（复用配置类型） |
| **交易�?D1** | P0-04 + P2-11 | 创建 TradingHubPage + 完善 Store | 3h | �?|
| **交易�?D4** | P0-05 + P0-06 + P0-07 | 持仓功能全链路打�?| 10h | �?|
| **输入�?B3** | P1-01 | 批量导入 Store 建设 | 2h | �?|
| **合计** | | | **35h** | |

### 迭代 2：P1 清零 + 数据层贯通（�?2 周）

**目标**：状态层完整，数据持久化到位，消除状态断裂�?
| 模块 | 任务编号 | 内容 | 工时 | 依赖 |
|:---|:---|:---|:---|:---|
| **输入�?B1/B2/B4/B6** | P1-02 ~ P1-05 | 状态层断裂修复�? 项） | 7.5h | P1-01 |
| **分析�?C4/C8** | P1-06 ~ P1-08 | Store 合规 + DataBridge 订阅 | 5h | �?|
| **交易�?D2/D3** | P1-09 ~ P1-11 | Facade 同步 + 三态补�?| 5.5h | P0-04 |
| **总控�?Agent** | P1-12 ~ P1-13 | 反馈与任务持久化 | 8h | �?|
| **合计** | | | **26h** | |

### 迭代 3：P2 优化 + 质量收口（约 1-2 周）

**目标**：代码规范达标，用户体验完善�?
| 模块 | 任务编号 | 内容 | 工时 | 依赖 |
|:---|:---|:---|:---|:---|
| **输入�?* | P2-01 ~ P2-02 | 导航合并 + empty 引导 | 3h | 迭代 1 |
| **分析�?* | P2-03 ~ P2-06 | loading + 数据接入 + 引导 | 6h | 迭代 2 |
| **驾驶�?* | P2-07 ~ P2-08 | 颜色令牌 + 三态补�?| 2.5h | �?|
| **交易�?* | P2-09 ~ P2-10 | 颜色 + 阈值硬编码修复 | 2.5h | 迭代 1 |
| **总控�?* | P2-12 ~ P2-14 | 颜色 + 术语 + 配置面板 | 5h | 迭代 2 |
| **全局** | P2-13 + P2-15 | 术语统一 + 首页引导 | 2.5h | �?|
| **合计** | | | **21.5h** | |

---

## 五、验收标�?
### 5.1 通用验收标准

所有修复项必须满足以下条件方可关闭�?
1. **类型安全**：`npx tsc --noEmit` 零错�?2. **架构合规**：`npm run audit:layers` 零违�?3. **代码规范**：`npm run lint --max-warnings 0`
4. **单元测试**：新增代码有对应测试用例，覆盖率不下�?5. **四步契约**：涉及新�?修改 Store 的，必须遵循「类�?�?Store �?Service/DataBridge �?UI」顺�?6. **事件清理**：useEffect 中所�?EventBus/DOM 监听有对�?cleanup

### 5.2 P0 专项验收

- **P0-01 ~ P0-03（输入舱三页�?*�?  - 页面可正常打开，无白屏
  - 数据可持久化（刷新后不丢失）
  - �?loading/error/empty 三�?  - 对应 Store 有完�?state + actions

- **P0-04（TradingHubPage�?*�?  - 路由 `/trading/hub` 可正常访�?  - 包含至少 4 个功能入口卡�?  - 有统计数据展示（�?Store 获取�?
- **P0-05 ~ P0-07（持仓功能）**�?  - 买入/卖出操作后持仓数据实时更�?  - 导出 CSV 文件内容与页面数据一�?  - 刷新页面后持仓数据仍在（持久化验证）
  - DataBridge 信封中有对应 action 记录

### 5.3 P1 专项验收

- **状态层断裂修复**：useState 迁移�?Zustand Store 后功能完全等�?- **DataBridge 订阅**：修改底层数据后，Store �?UI 自动更新
- **持久化验�?*：刷新页�?+ 重启浏览器后数据不丢�?- **Facade 同步**：多 Store 间数据一致性验证（修改 A Store �?B Store 同步更新�?
### 5.4 P2 专项验收

- **颜色令牌**：`npm run audit:hardcode` 对应模块零违�?- **三态覆�?*：手动触�?loading / error / empty 三种场景，均有正确展�?- **术语统一**：全�?UI 文案 review 通过
- **配置面板**：设置项修改后持久化生效，刷新后保持

---

## 六、风险与依赖

| 风险�?| 影响 | 缓解措施 |
|:---|:---|:---|
| 输入舱三页（B7/B8/B9）需求不明确 | P0 修复延期 | 先明确产品需求文档，再开工；可先做骨架和类型定义 |
| 持仓功能（D4）依赖交易执行引�?| P0-05 无法独立完成 | 先实现模拟交易模式（内存撮合），后续接入真实引擎 |
| Agent 持久化需修改 IndexedDB schema | 数据库版本升级风�?| 严格遵循 DB 版本管理规范，递增 DB_VERSION，编写迁移脚�?|
| 术语统一涉及面广 | P2-13 工时膨胀 | 分模块逐步替换，先统一核心模块（交�?分析�?|

---

## 七、变更日�?
| 日期 | 版本 | 变更内容 | 变更�?|
|:---|:---|:---|:---|
| 2026-07-05 | v2.0.0 | 基于五批次全量审计重写：P0=7 / P1=13 / P2=15，新增三迭代修复路线图和验收标准 | Quality Auditor |
| 2026-06-27 | v1.0.0 | 初始版本：基�?28 模块审计结果 | Quality Auditor |
