# cockpit / 整体设计一致性审查

> 触发：用户要求"扩大检索本地所有文件的范围，做更广的 cockpit / 整体设计一致性审查"。
> 方法：基于**真实本地文件**（Grep/Glob 直读真实 FS，tsc 以 dangerouslyDisableSandbox 验证），6 维度交叉核验；**先分析后排查，删除须用户同意，本轮零删除、零修改**。
> 时间：2026-07-08

## 审查框架（6 维度）

| 维度 | 检查点 |
|---|---|
| ① 注册一致性 | widgetRegistry 注册项 ↔ 实际 widget 文件是否 1:1 |
| ② 契约一致性 | 组件是否统一遵循 `WidgetTemplate` 的 `({config, data?})` 契约 |
| ③ 数据来源一致性 | widget 是否统一经 `MarketDataProvider`/`useMarketData` |
| ④ 主题一致性 | 源码是否走颜色令牌（L5 股票红涨绿跌例外除外） |
| ⑤ 路由可达性 | `/cockpit` → CockpitShell → registry 驱动渲染，有无孤立 |
| ⑥ 整体架构一致性 | route↔page↔component 1:1（引用既有核查结论） |

---

## ① 注册一致性 —— 发现 1 个孤立 widget

- **widgetRegistry 注册 21 个 widget**，逐一核对均有对应 `.tsx` 文件（1:1 对齐 ✓）。
- **目录多 1 个文件：`SignalQualityDashboardWidget.tsx`，未注册、全仓零外部引用、无测试**（见 ③/⑤）。
- 该组件自述"作为 signalQualityStore 的首个 UI 消费方"，但 `src/components/analysis/signal/SignalQualityTrendChart.tsx` 也是该 store 的消费方 → 注释失真。

> 形态与先前已处理的 **I3（MultiFactorFilterPanel 未挂舱）** 完全一致：组件已完整实现，仅缺"注册进 registry"这一环，致 cockpit 用户不可达。

## ② 组件契约一致性 —— 一致 ✓

全部 21+1 个 widget 均 `export default function XxxWidget({ config, data? }: …)`，与 `WidgetTemplate.component` 声明的 `React.ComponentType<{ config: WidgetConfig; data?: MarketData }>` 一致。部分仅用 `config`、部分用 `config+data`（因 `data` 可选），属正常变体，非违规。

## ③ 数据来源一致性 —— 2 处轻微偏离

- **FundFlowWidget**：直接 `MockMarketDataProvider.getFundFlows()`（mock 数据源），绕过 cockpit 统一的 `MarketDataProvider`。疑似 demo/占位，需确认是否应接入真实数据流。
- **SignalQualityDashboardWidget**：走 `useSignalQualityStore`（自身 store）而非 `useMarketData`。其 store 本身合规（有 `signalQualityStore.test.ts`、`initSignalQualityStoreSubscriptions` 经 DataBridge 订阅），属"独立 store 模式"，与主链路非孤立，差异可接受，但建议在 widget 层文档注明该模式。

其余 19 个 widget 均经 `useMarketData()` / `useOptionalMarketData()`，统一从 `MarketDataProvider` 取数 ✓。

## ④ 主题令牌一致性 —— 合规 ✓

- 源码 widget 统一使用令牌：`COLOR_TOKENS` / `COLOR_SHADES` / `STOCK_COLOR_TOKENS` / `twText` / `twBg`（如 `AITradeReviewWidget.tsx`、`HotSectorWidget.tsx`）。
- Grep 命中的 `text-red-500`/`bg-green-500` 等**全部位于 `.test.tsx` 断言**（验证令牌输出值，如 `COLOR_TOKENS.danger.tailwind === 'text-red-500'`），**源码无硬编码绕过**。股票涨跌色正确走 L5 固定例外（STOCK_COLOR_TOKENS.up.hex）。

## ⑤ 路由可达性 —— cockpit 可达，孤立 widget 不可达

- `src/config/routes.ts:41` 存在 `/cockpit` 路由 → `React.lazy(() => import('@/cockpit/CockpitShell'))`。
- `CockpitShell.tsx` 消费 `widgetRegistry` + `widgetEngine`，经 `widgetEngine.loadComponent(config.widgetId)` 渲染 registry 驱动布局 ✓。
- **`SignalQualityDashboardWidget` 未注册 → cockpit 用户不可达**（信息孤岛）。

## ⑥ 整体架构一致性（引用既有核查结论）

- 原 5 层映射审计（Engine→Module→Route→Mapping→UI）及 I/C/R 全结案已证明 route↔page↔component 1:1 整体成立；DataBridge 全仓单例（I1 误报核消）；dataLayer 桶重导出已裁定为项目约定（R6/I5 核消）。
- 本次 cockpit 专项系对子系统更深一层的交叉核验，未发现新的系统性断裂。

---

## 分析性判断总结

| 编号 | 维度 | 现象 | 判定 | 处置建议（均非删除） |
|---|---|---|---|---|
| F1 | ①⑤ | `SignalQualityDashboardWidget.tsx` 孤立：未注册、零引用、无测试 | 信息孤岛（类 I3） | 二选一：① 注册进 widgetRegistry（接 cockpit，与 I3 同法）；② 确认其为分析模块专用，保留但标注。删除须批准 |
| F2 | ③ | `FundFlowWidget` 走 `MockMarketDataProvider` 绕过真实 Provider | 数据来源不一致 | 确认 demo 占位还是应接入真实数据流；非删除 |
| F3 | ③ | `SignalQualityDashboardWidget` 走独立 store 而非 MarketDataProvider | 模式差异（store 合规） | 文档注明即可，可接受 |
| F4 | ① | SQ widget 注释称"signalQualityStore 首个 UI 消费方"，实际另有 `SignalQualityTrendChart` | 文档失真 | 轻微，修订注释 |

**确认健康（无动作）**：注册 21/21 对齐、契约一致、主题合规、/cockpit 可达、signalQualityStore 主链路非孤立。

## 后续"排查"建议（待用户确认后执行，均非删除类）

1. **运行 vitest 实测 cockpit**（只读、零风险）：确认运行时通过，呼应上轮"40 错误"辟谣后的收尾。
2. **F1 处置**：若选①，新增 widgetRegistry 注册项（低风险增量，类 I3）；若选②，标注为分析专用。
3. **F2 核实**：确认 FundFlowWidget 数据流意图。

> 本轮任何涉及注册/修改/删除的动作均须先经用户同意（CORE PRINCIPLE）。

## 固化教训

- cockpit 子系统用"registry 注册项 ↔ 文件 ↔ 路由消费"三线交叉，可快速定位孤立组件（本次 F1、前期 I3 同法）。
- 颜色类一致性审查：命中多在 `.test.tsx` 断言，须区分"源码硬编码"与"测试验证令牌输出"，后者是合规证据而非违规。
- 凡沙箱 Bash 的 `tsc` 报错须以真实 FS 三连核验（dangerouslyDisableSandbox tsc + 读代表文件 + 查 tsconfig include）再下结论。
