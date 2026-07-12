# V9 智能投研复盘系统 — 架构合规审计报告（T-11 第一轮）

> **审计角色**: A8 · 架构合规 AGENT  
> **任务编号**: T-11 分层依赖与文档同步审计  
> **审计日期**: 2026-07-10  
> **AGENTS.md 版本**: v1.4.0  
> **当前 Commit**: `c483894`（`feat: 令牌债清零 + DIVIDE辅助对象 + ThemeProvider修复 + 基线刷新`）  
> **审计轮次**: 第一轮；其他 AGENT 任务完成后需进行第二轮。

---

## 一、分层规则与四步集成契约摘要

### 1.1 分层依赖规则（AGENTS.md §一）

```
pages/、components/  → store/、services/
store/               → services/、core/
services/            → core/、data/、lib/（仅基础设施白名单）
lib/                 → core/、config/
core/                → 禁止依赖 pages/、components/、apps/、lib/
config/              → 禁止依赖 services/、pages/、components/、lib/
constants/           → 零运行时依赖，可被所有层引用
types/               → 零依赖，可被所有层引用
```

### 1.2 四步集成编码契约（AGENTS.md §二）

新增模块必须按以下顺序集成，严禁在 `/pages` 或 `/components` 下孤立新建 UI 文件：

1. **类型定义** → `src/types/modules/*.types.ts` 或 `src/data/types.ts`
2. **Store/状态** → `src/store/*Store.ts`（Zustand + `withBroadcast`）
3. **Builder/适配层** → `src/services/*`（通过 `DataBridge` 写入数据）
4. **核心集成** → `src/pages/` 或 `src/components/`（仅通过 Store 获取数据）

---

## 二、审计命令执行结果

| 命令 | 状态 | 关键结果 |
|------|------|----------|
| `npm run audit:layers` | ✅ 通过 | 扫描 825 文件，**0 违规、0 警告** |
| `npm run audit:docs` | ✅ 通过 | 扫描 4 个变更文件，**0 处文档不同步** |
| `npx tsc --noEmit` | ❌ 失败 | **7 处类型错误** |
| `npm run audit:tokens` | ❌ 失败 | **新增 16 处 HEX 字面量 + 2 处裸 Tailwind 色类**，超过基线 |
| `npm run test -- --run` | ❌ 失败 | `dataLayer.test.ts` 期望 26 个属性、实际 27 个；测试 worker 异常退出 |

> 说明：工作区存在大量未提交修改（`git status` 显示 100+ 已修改文件和 50+ 未跟踪文件），但审计命令直接作用于当前工作区，结果已如实记录。

---

## 三、四步集成契约专项检查

### 3.1 新增文件清单（`git status` 中 `??` 状态）

本次工作区新增主要文件：

- **类型层**：`src/types/modules/collection.types.ts`、`src/data/types/types.customAgent.ts`、`src/data/types/types.hybridProofread.ts`
- **状态层**：`src/store/collectionRuntimeStore.ts`、`src/store/customAgentStore.ts`、`src/store/hybridProofreadStore.ts`、`src/store/runtimeTradingConfigStore.ts`
- **服务层**：`src/services/data-collector/collectionPipeline.ts`、`src/services/data-collector/collectionReportService.ts`、`src/services/data-collector/tracePersistenceService.ts`、`src/services/hybrid-proofread/*`、`src/services/trading/watchlistMoversService.ts`、`src/services/trading/mockDataGenerator.ts`
- **UI 层**：`src/pages/trading/*Page.tsx`、`src/pages/analysis/ScoreComparisonPage.tsx`、`src/pages/analysis/StockPoolBoardPage.tsx`、`src/pages/output/*Page.tsx`、`src/components/input/*`、`src/components/trading/*`、`src/components/collection/*`、`src/components/cockpit/*`、`src/components/output/*`

### 3.2 发现的四步集成违规

#### 违规 A：模拟交易数据生成器将类型定义内联，未下沉到 `src/types/modules/`

- **文件**：`src/services/trading/mockDataGenerator.ts`
- **问题**：
  - 第 209-220 行内联定义 `MockPosition`
  - 第 268-290 行内联定义 `MockRiskMetrics`、`MockRiskAlert`
  - 第 354-365 行内联定义 `MockTradingData`
  - 这些类型均未按契约要求放置于 `src/types/modules/` 或 `src/data/types.ts`，导致 `TradingFlowPage` 无法直接复用类型，并间接引发类型不一致。
- **违反步骤**：第 1 步（类型定义层）
- **修复建议**：将 `MockPosition`、`MockRiskMetrics`、`MockRiskAlert`、`MockTradingData` 迁移到 `src/types/modules/trading.types.ts` 或 `src/data/types.ts`，并在 `mockDataGenerator.ts` 中仅做类型导入。

#### 违规 B：交易信号类型与 UI 消费不一致，导致 TypeScript 报错

- **文件**：`src/services/trading/signalGenerator.ts`（类型源头）  
  `src/services/trading/mockDataGenerator.ts`（扩展使用）  
  `src/pages/trading/TradingFlowPage.tsx`（UI 消费）
- **问题**：
  - `mockDataGenerator.ts:85` 向 `TradingSignal` 对象写入 `name` 字段；`mockDataGenerator.ts:99` 写入 `timestamp` 字段。
  - 但 `signalGenerator.ts` 导出的 `TradingSignal` 接口不包含 `name` 和 `timestamp`。
  - `TradingFlowPage.tsx:368` 在映射 `displaySignals` 时读取 `s.name`，触发 `TS2339: Property 'name' does not exist on type 'Signal'`。
- **违反步骤**：第 1 步（类型定义未同步）
- **修复建议**：
  1. 在 `src/types/modules/trading.types.ts` 中统一定义 `TradingSignal` 接口，包含 `id`、`symbol`、`name`、`direction`、`confidence`、`rationale`、`createdAt`、`timestamp` 等字段。
  2. 同步修正 `signalGenerator.ts`、`mockDataGenerator.ts`、`TradingFlowPage.tsx` 的类型引用。

#### 违规 C：交易流程页面直接引用 `src/services/trading/mockDataGenerator.ts`

- **文件**：`src/pages/trading/TradingFlowPage.tsx:14`
- **问题**：页面层直接导入 `generateMockTradingData` 服务，用于生成开发环境模拟数据。虽然 mock 数据生成属于服务层，但页面通过 `USE_MOCK_DATA` 分支直接消费该服务，未经过 Store 层。根据四步契约，UI 应仅通过 Store 获取数据，模拟数据注入也应由 Store 或 Service 门面统一提供。
- **违反步骤**：第 4 步（UI 应仅通过 Store 获取数据）
- **修复建议**：在 `tradingStore`（或新建 `tradingRuntimeStore`）中提供 `useMockData` 开关和模拟数据加载 action，页面仅订阅 Store 状态。

#### 违规 D：UI 组件使用硬编码涨跌色，未使用 `STOCK_COLOR_TOKENS`

- **文件**：`src/components/trading/OrderExecutionPanel.tsx:180`
- **代码**：`className={order.side === 'buy' ? 'text-red-500' : 'text-green-500'}`
- **问题**：虽然买入/卖出在股票语义中对应红买绿卖，但此处是**订单方向**（buy/sell），并非 `changePercent`/`priceChange`/`涨跌幅` 场景。AGENTS.md §3.5.6 的豁免明确针对“股票涨跌”相关字段，订单方向不在豁免范围内，应使用 `STOCK_COLOR_TOKENS` 或语义令牌。
- **违反规范**：颜色令牌规范（AGENTS.md §3.5）
- **修复建议**：改为 `order.side === 'buy' ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind`。

#### 违规 E：服务层生成 HTML 报告时硬编码 HEX 色值

- **文件**：`src/services/hybrid-proofread/reportGenerator.ts:286-291`
- **代码**：
  ```ts
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#65a30d',
    warning: '#ca8a04',
    info: '#64748b',
  }
  ```
- **问题**：服务层虽非 UI 层，但生成的是最终面向用户的 HTML 报告内容。AGENTS.md §3.5.8 的豁免清单未包含 `services/` 目录，且 §3.5.2 要求报告文本中的颜色通过令牌系统引用。服务层输出硬编码 HEX 会导致令牌管线断裂、暗色模式/品牌色切换失效。
- **修复建议**：将 `severityColors` 映射迁移到 `src/config/chartColors.ts` 或 `src/constants/theme.tokens.ts` 的语义令牌，服务层仅引用令牌。

---

## 四、其他命令结果详细记录

### 4.1 `npx tsc --noEmit` 类型错误（7 项）

| # | 文件 | 行/列 | 错误码 | 描述 |
|---|------|-------|--------|------|
| 1 | `src/pages/trading/TradingFlowPage.tsx` | 352:20 | TS2552 | 使用了未定义的 `riskRules`（仅声明 `setRiskRules`） |
| 2 | `src/pages/trading/TradingFlowPage.tsx` | 369:17 | TS2339 | `Signal` 类型无 `name` 属性 |
| 3 | `src/services/trading/mockDataGenerator.ts` | 46:3 | TS2322 | `randomChoice<T>` 返回 `T \| undefined` 赋值给 `T` |
| 4 | `src/services/trading/mockDataGenerator.ts` | 85:7 | TS2353 | 对象字面量包含 `name`，但 `Signal` 类型无此属性 |
| 5 | `src/services/trading/mockDataGenerator.ts` | 99:35 | TS2339 | `Signal` 类型无 `timestamp` 属性 |
| 6 | `src/services/trading/mockDataGenerator.ts` | 99:49 | TS2339 | `Signal` 类型无 `timestamp` 属性 |
| 7 | `src/services/trading/mockDataGenerator.ts` | 174:3 | TS2322 | `string` 不可赋值给 `OrderStatus` |

### 4.2 `npm run audit:tokens` 令牌违规

- **HEX 字面量**：当前 40 处，基线 24 处，新增 **16 处**；主要集中在 `src/services/hybrid-proofread/reportGenerator.ts`（severity 颜色映射）。
- **裸 Tailwind 色类**：当前 2 处，基线 0 处，新增 **2 处**；位于 `src/components/trading/OrderExecutionPanel.tsx:180`（`text-red-500`、`text-green-500`）。
- **结论**：令牌回归闸触发，CI 应拦截。

### 4.3 `npm run test -- --run` 单元测试结果

- **失败套件**：`src/data/dataLayer.test.ts`（135 用例 | 1 失败）
- **失败用例**：`dataLayer > dataLayer aggregator > 共计 25 个属性`
- **错误信息**：`expected ['stocks', 'v6Scores', …(25) ] to have a length of 26 but got 27`
- **根因**：`dataLayer` 聚合器导出的属性数量从 26 增加到 27，但测试断言仍为 26；同时测试注释写“共计 25 个属性”，本身存在文档/断言不一致。
- **附加问题**：测试 worker 异常退出（`Worker exited unexpectedly`），需进一步排查是否由未 caught 的 Promise 拒绝或全局事件监听导致。

---

## 五、修复建议汇总（按优先级）

| 优先级 | 问题 | 建议修复人 | 估计影响范围 |
|--------|------|------------|--------------|
| P0 | TypeScript 7 处错误阻塞编译 | Trading 模块作者 | `TradingFlowPage.tsx`、`mockDataGenerator.ts`、相关 Signal 类型 |
| P0 | 令牌违规导致 CI 拦截 | UI/Token 模块作者 | `OrderExecutionPanel.tsx`、`reportGenerator.ts` |
| P1 | `dataLayer.test.ts` 属性计数断言过期 | Data 层作者 | 测试文件 `src/data/dataLayer.test.ts:1530` |
| P1 | 模拟数据类型未下沉到 `types/` | Trading 模块作者 | 新建/迁移 `trading.types.ts` |
| P1 | 页面直接消费 `mockDataGenerator` | Trading 模块作者 | 将 mock 数据入口迁移到 `tradingStore` |
| P2 | 测试 worker 异常退出 | 测试基础设施作者 | 排查 `dataLayer.test.ts` 的全局副作用 / 未捕获异常 |

---

## 六、合规判定

- **分层依赖**：✅ 通过（`audit:layers` 0 违规）
- **文档同步**：✅ 通过（`audit:docs` 0 违规）
- **四步集成契约**：⚠️ 部分违规（类型未下沉、UI 直接引用服务、类型与消费不一致）
- **类型安全**：❌ 未通过（`npx tsc --noEmit` 7 错误）
- **令牌合规**：❌ 未通过（新增 18 处违规）
- **单元测试**：❌ 未通过（1 处断言失败 + worker 异常）

---

## 七、后续行动

1. 由相关模块作者优先修复 P0 类型错误和令牌违规。
2. 修复后重新执行 T-11 全部命令，确认以下目标：
   - `npx tsc --noEmit` 退出码 0
   - `npm run audit:tokens` 退出码 0（或仅保留已豁免项）
   - `npm run test -- --run` 全部通过
3. 第二轮审计在其它 AGENT 任务完成后进行，重点复查本次报告中的 P1/P2 项是否已闭环。

---

*报告由 A8 · 架构合规 AGENT 自动生成，保存于 `docs/architecture-compliance-report.md`。*
