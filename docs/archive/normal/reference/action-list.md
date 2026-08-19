---
doc_id: V9-DOC-REF-906
title: action-list
tier: important
code_version: "2.0.0-rc.2"
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# V9 五层追溯审计 — 修复行动清单

> **审计范围**：批次 A-E（48 个功能入口 + 21 个 Widget）
> **问题总数**：35 项（P0=7 / P1=13 / P2=15）
> **预计总工时**：约 79 人时（P0: 28h / P1: 31h / P2: 20h）
> **建议修复周期**：3 个迭代（2 周 / 迭代）

---

## 一、P0 阻塞级（功能不可用，立即修复）

> **定义**：核心功能完全不可用，用户无法完成基本操作；或页面文件缺失、仅 Mock/桩代码。
> **修复时限**：下一迭代必须完成。

| 编号 | 问题摘要 | 位置 | 影响范围 | 修复建议 | 预计工时 |
|:---|:---|:---|:---|:---|:---|
| **P0-01** | 七维分析页面全为 TODO 桩 | `src/pages/input/` 七维分析页 | 输入舱 B7 | 按四步契约实现：① 类型定义 → ② Store → ③ DataBridge → ④ UI。saveConfig 和 runCollection 需接入真实采集逻辑 | 8h |
| **P0-02** | 采集器配置页全页 Mock | `src/pages/input/` 采集器配置页 | 输入舱 B8 | 实现采集器配置 CRUD：配置表单、校验逻辑、持久化到 IndexedDB、对接 DataBridge | 6h |
| **P0-03** | 采集任务页全页 Mock | `src/pages/input/` 采集任务页 | 输入舱 B9 | 实现任务列表、任务创建/编辑/删除、任务状态追踪、执行日志展示 | 6h |
| **P0-04** | TradingHubPage.tsx 文件不存在 | `src/apps/trading/TradingApp.tsx` | 交易舱 D1 | 创建交易舱 Hub 页面，包含快捷入口卡片、统计概览、导航到各子页面 | 2h |
| **P0-05** | 持仓交易操作为桩实现 | `src/pages/trading/HoldingsPage.tsx` | 交易舱 D4 | 实现真实买入/卖出/调仓逻辑，通过 DataBridge 写入交易记录，更新持仓数据 | 4h |
| **P0-06** | 持仓导出为桩实现 | `src/pages/trading/HoldingsPage.tsx` | 交易舱 D4 | 实现 CSV/Excel 导出功能，支持当前持仓和历史交易两种导出模式 | 2h |
| **P0-07** | 持仓数据未实际加载 | `src/pages/trading/HoldingsPage.tsx` + `holdingsStore` | 交易舱 D4 | 打通 DataBridge → holdingsStore → UI 的数据链路；fetchData 需真实查询 IndexedDB 并更新 Store | 4h |

**P0 小计：7 项 / 32 人时**

---

## 二、P1 严重级（功能降级，高优修复）

> **定义**：功能可用但存在明显缺陷（状态断裂、数据不持久、无三态），影响用户体验或数据完整性。
> **修复时限**：两个迭代内完成。

| 编号 | 问题摘要 | 位置 | 影响范围 | 修复建议 | 预计工时 |
|:---|:---|:---|:---|:---|:---|
| **P1-01** | 批量导入无专属 Store | `src/apps/input/BulkImportPanel.tsx` | 输入舱 B3 | 新建 `bulkImportStore.ts`，迁移 useState → Zustand actions，接入 withBroadcast | 2h |
| **P1-02** | 输入舱 Hub 状态层断裂 | `src/apps/input/InputApp.tsx` | 输入舱 B1 | 新建 `inputHubStore.ts`，统计数据从 Store 获取而非硬编码 | 1.5h |
| **P1-03** | 录入看板状态层断裂 | `src/apps/input/InputDashboard.tsx` | 输入舱 B2 | 统一接入 `poolStore` 或独立 Store，替换 usePoolData hook 的直接调用 | 2h |
| **P1-04** | 热门板块绕过 Store 直用静态数据 | `src/apps/input/HotSectorPanel.tsx` | 输入舱 B4 | 接入 `hotSectorStore`，数据通过 DataBridge 流入而非静态常量 | 2h |
| **P1-05** | 采集测试数据不持久化 | `src/apps/input/DataTestPanel.tsx` | 输入舱 B6 | 新建 `dataTestStore.ts`，测试结果通过 DataBridge 写入 IndexedDB | 2h |
| **P1-06** | V6ScoreCard 用 useState 绕过 Store | `src/components/.../V6ScoreCard.tsx` | 分析舱 C4 | 迁移到 `intelligentScoreStore`，状态统一管理，遵守四步契约 | 2h |
| **P1-07** | NewsPage 未消费 store 的 loading/error 状态 | `src/pages/analysis/NewsPage.tsx` | 分析舱 C8 | 接入 `analysisNewsStore` 的 loading/error 状态，展示骨架屏和错误重试 | 1.5h |
| **P1-08** | intelligentScoreStore 未订阅 DataBridge | `src/store/intelligentScoreStore.ts` | 分析舱 C4 | 在 Store 中添加 DataBridge.subscribe，数据变更自动同步到 Store | 1.5h |
| **P1-09** | 交易信号 Facade 同步未激活 | `src/apps/trading/TradingApp.tsx` | 交易舱 D2 | 调用 `initTradingStoreFacadeSync()`，打通多 Store 间的 Facade 同步 | 2h |
| **P1-10** | 策略快照 DataBridge 订阅未激活 | `src/pages/trading/StrategySnapshotPage.tsx` | 交易舱 D3 | 添加 `useEffect` 订阅 DataBridge，策略快照数据变更实时更新 UI | 1.5h |
| **P1-11** | 交易信号看板缺少 loading/error 状态 | `src/apps/trading/TradingApp.tsx` | 交易舱 D2 | 添加骨架屏 loading 状态 + 错误重试组件 + empty 空状态引导 | 2h |
| **P1-12** | Agent 反馈数据无持久化 | `src/store/agentStore.ts` + Agent 反馈页 | 总控舱 Agent 子系统 | AgentFeedback 数据通过 DataBridge 写入 IndexedDB，新增 `agent_feedback` store | 4h |
| **P1-13** | Agent 任务历史无持久化 | `src/store/agentStore.ts` + Agent 任务页 | 总控舱 Agent 子系统 | AgentTaskHistoryEntry 数据持久化到 IndexedDB，新增 `agent_task_history` store | 4h |

**P1 小计：13 项 / 31 人时**

---

## 三、P2 优化级（代码规范与体验优化）

> **定义**：功能正常但存在代码规范问题（硬编码、命名不一致）或体验瑕疵（缺引导、缺动画）。
> **修复时限**：三个迭代内完成，或随业务迭代一并修复。

| 编号 | 问题摘要 | 位置 | 影响范围 | 修复建议 | 预计工时 |
|:---|:---|:---|:---|:---|:---|
| **P2-01** | `/input/hub` 与 `/input` 功能重复 | 输入舱 B1 + B2 | 输入舱导航 | 合并或明确分工：Hub 做导航聚合，`/input` 做录入看板主入口 | 1h |
| **P2-02** | 多处缺 empty 引导态 | 输入舱 B1/B2/B4 等 | 输入舱 | 为无数据场景添加空状态插图 + 操作引导按钮 | 2h |
| **P2-03** | 分析舱多处缺 loading spinner | 分析舱 C2/C3/C3b/C7 | 分析舱 | 统一添加骨架屏或 Spinner 组件，与 Store loading 状态绑定 | 2h |
| **P2-04** | valuePitStore 使用硬编码样本数据 | `src/store/valuePitStore.ts` | 分析舱 C10 | 接入真实数据源，初始状态改为空数组 + loading | 1.5h |
| **P2-05** | analysisNewsStore 未集成 DataBridge | `src/store/analysisNewsStore.ts` | 分析舱 C8 | 完成 DataBridge 双向集成：forward 写入 + subscribe 读取 | 1.5h |
| **P2-06** | 分析舱根路由缺 loading/empty 引导 | `src/pages/analysis/` 根路由 | 分析舱 C11 | 添加路由级 loading 和 empty 态 | 1h |
| **P2-07** | Widget 颜色硬编码 | `src/cockpit/widgets/MarketIndicesWidget.tsx` 等 | 驾驶舱 A2 | 迁移到 `COLOR_TOKENS` 和 `COLOR_SHADES` 令牌系统 | 1.5h |
| **P2-08** | HotSectorWidget 缺 loading/error 态 | `src/cockpit/widgets/HotSectorWidget.tsx` | 驾驶舱 A2 | 添加 WidgetSkeleton 和 WidgetErrorBoundary 集成 | 1h |
| **P2-09** | 交易舱颜色硬编码 | `src/pages/trading/` 多个文件 | 交易舱 D2/D3/D4 | 迁移到颜色令牌系统 | 1.5h |
| **P2-10** | 交易舱分类阈值硬编码 | `src/store/tradingStore.ts` | 交易舱 D2 | 提取到 `src/config/thresholds.ts` 配置文件 | 1h |
| **P2-11** | tradingHubStore 空壳 | `src/store/tradingHubStore.ts` | 交易舱 D1 | 完善 Store 的 state/actions，或在 D1 实现后同步充实 | 1h（与 P0-04 联动） |
| **P2-12** | 总控舱多处颜色硬编码 | `src/pages/command/` 多个文件 | 总控舱 E2/E3 | 迁移到颜色令牌系统 | 1.5h |
| **P2-13** | 术语不一致（信号/策略/因子混用） | 全项目 UI 文案 | 所有舱 | 统一术语表，review 所有可见文案 | 2h |
| **P2-14** | 配置面板缺失（部分模块） | 总控舱配置管理 | 总控舱 | 完善配置面板 UI，对接 localStorageManager 加密存储 | 1.5h |
| **P2-15** | 首页无 loading/error（设计选择，但建议补空态） | `src/pages/HomePage.tsx` | 批次 A1 | 添加首次访问引导和功能提示卡片 | 0.5h |

**P2 小计：15 项 / 21 人时**（P2-11 与 P0-04 联动，实际工时约 20h）

---

## 四、按模块分组的修复路线图

### 迭代 1：P0 清零 + 关键 P1（约 2 周）

**目标**：所有入口功能可用，消除 Mock/桩代码。

| 模块 | 任务编号 | 内容 | 工时 | 依赖 |
|:---|:---|:---|:---|:---|
| **输入舱 B7** | P0-01 | 七维分析页面完整实现 | 8h | 无 |
| **输入舱 B8** | P0-02 | 采集器配置 CRUD 实现 | 6h | 无 |
| **输入舱 B9** | P0-03 | 采集任务列表实现 | 6h | P0-02（复用配置类型） |
| **交易舱 D1** | P0-04 + P2-11 | 创建 TradingHubPage + 完善 Store | 3h | 无 |
| **交易舱 D4** | P0-05 + P0-06 + P0-07 | 持仓功能全链路打通 | 10h | 无 |
| **输入舱 B3** | P1-01 | 批量导入 Store 建设 | 2h | 无 |
| **合计** | | | **35h** | |

### 迭代 2：P1 清零 + 数据层贯通（约 2 周）

**目标**：状态层完整，数据持久化到位，消除状态断裂。

| 模块 | 任务编号 | 内容 | 工时 | 依赖 |
|:---|:---|:---|:---|:---|
| **输入舱 B1/B2/B4/B6** | P1-02 ~ P1-05 | 状态层断裂修复（4 项） | 7.5h | P1-01 |
| **分析舱 C4/C8** | P1-06 ~ P1-08 | Store 合规 + DataBridge 订阅 | 5h | 无 |
| **交易舱 D2/D3** | P1-09 ~ P1-11 | Facade 同步 + 三态补齐 | 5.5h | P0-04 |
| **总控舱 Agent** | P1-12 ~ P1-13 | 反馈与任务持久化 | 8h | 无 |
| **合计** | | | **26h** | |

### 迭代 3：P2 优化 + 质量收口（约 1-2 周）

**目标**：代码规范达标，用户体验完善。

| 模块 | 任务编号 | 内容 | 工时 | 依赖 |
|:---|:---|:---|:---|:---|
| **输入舱** | P2-01 ~ P2-02 | 导航合并 + empty 引导 | 3h | 迭代 1 |
| **分析舱** | P2-03 ~ P2-06 | loading + 数据接入 + 引导 | 6h | 迭代 2 |
| **驾驶舱** | P2-07 ~ P2-08 | 颜色令牌 + 三态补齐 | 2.5h | 无 |
| **交易舱** | P2-09 ~ P2-10 | 颜色 + 阈值硬编码修复 | 2.5h | 迭代 1 |
| **总控舱** | P2-12 ~ P2-14 | 颜色 + 术语 + 配置面板 | 5h | 迭代 2 |
| **全局** | P2-13 + P2-15 | 术语统一 + 首页引导 | 2.5h | 无 |
| **合计** | | | **21.5h** | |

---

## 五、验收标准

### 5.1 通用验收标准

所有修复项必须满足以下条件方可关闭：

1. **类型安全**：`npx tsc --noEmit` 零错误
2. **架构合规**：`npm run audit:layers` 零违规
3. **代码规范**：`npm run lint --max-warnings 0`
4. **单元测试**：新增代码有对应测试用例，覆盖率不下降
5. **四步契约**：涉及新增/修改 Store 的，必须遵循「类型 → Store → Service/DataBridge → UI」顺序
6. **事件清理**：useEffect 中所有 EventBus/DOM 监听有对应 cleanup

### 5.2 P0 专项验收

- **P0-01 ~ P0-03（输入舱三页）**：
  - 页面可正常打开，无白屏
  - 数据可持久化（刷新后不丢失）
  - 有 loading/error/empty 三态
  - 对应 Store 有完整 state + actions

- **P0-04（TradingHubPage）**：
  - 路由 `/trading/hub` 可正常访问
  - 包含至少 4 个功能入口卡片
  - 有统计数据展示（从 Store 获取）

- **P0-05 ~ P0-07（持仓功能）**：
  - 买入/卖出操作后持仓数据实时更新
  - 导出 CSV 文件内容与页面数据一致
  - 刷新页面后持仓数据仍在（持久化验证）
  - DataBridge 信封中有对应 action 记录

### 5.3 P1 专项验收

- **状态层断裂修复**：useState 迁移到 Zustand Store 后功能完全等价
- **DataBridge 订阅**：修改底层数据后，Store 和 UI 自动更新
- **持久化验证**：刷新页面 + 重启浏览器后数据不丢失
- **Facade 同步**：多 Store 间数据一致性验证（修改 A Store 后 B Store 同步更新）

### 5.4 P2 专项验收

- **颜色令牌**：`npm run audit:hardcode` 对应模块零违规
- **三态覆盖**：手动触发 loading / error / empty 三种场景，均有正确展示
- **术语统一**：全量 UI 文案 review 通过
- **配置面板**：设置项修改后持久化生效，刷新后保持

---

## 六、风险与依赖

| 风险项 | 影响 | 缓解措施 |
|:---|:---|:---|
| 输入舱三页（B7/B8/B9）需求不明确 | P0 修复延期 | 先明确产品需求文档，再开工；可先做骨架和类型定义 |
| 持仓功能（D4）依赖交易执行引擎 | P0-05 无法独立完成 | 先实现模拟交易模式（内存撮合），后续接入真实引擎 |
| Agent 持久化需修改 IndexedDB schema | 数据库版本升级风险 | 严格遵循 DB 版本管理规范，递增 DB_VERSION，编写迁移脚本 |
| 术语统一涉及面广 | P2-13 工时膨胀 | 分模块逐步替换，先统一核心模块（交易/分析） |

---

## 七、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-07-05 | v2.0.0 | 基于五批次全量审计重写：P0=7 / P1=13 / P2=15，新增三迭代修复路线图和验收标准 | Quality Auditor |
| 2026-06-27 | v1.0.0 | 初始版本：基于 28 模块审计结果 | Quality Auditor |
