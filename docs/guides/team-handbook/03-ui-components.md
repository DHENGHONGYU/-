# 03 · UI 组件设计思路（UI Component Design）

> 本文回答"**UI 怎么写、怎么复用**"。权威基线：`docs/reference/atomic-component-system.md`、`docs/reference/../reference/ui-migration-checklist.md`、`docs/reference/widget-integration-checklist.md`、`docs/reference/design-token-mapping.md`、`eslint.colors.config.js`、`docs/reference/jsdoc-convention.md`、`docs/reference/complexity-governance.md`。

---

## 1. 原子设计体系（Atomic Design）

目录：`src/components/{atoms, molecules, organisms, templates, chart, cabin, cockpit, widgets}`，各层有 `index.ts` 桶导出。

### 1.1 层级边界（由 `audit:atomic` 强制）
| 层级 | 可由谁组成 | 禁止 import |
|------|------------|-------------|
| **Atom** | Tailwind / Tokens | Store/Service/Molecule/Organism/Template/Page/App/业务 |
| **Molecule** | Atom | Organism/Template/Store/Service/Page/App/业务 |
| **Template** | Molecule + Atom | 业务数据 / Store / Service |
| **Organism** | 任意层级（含 Store/Service/Hook） | — |

组合方向强制：`Page → Template → Organism → Molecule → Atom`（不可跨层跳跃）。

### 1.2 Barrel 导出
- `atoms/index.ts`：导出 24 原子（Button/Input/Card…），头注释"原子不可再分，禁止依赖 Store/Service"。
- `molecules/index.ts`：导出 22 分子（Alert/Dialog/Tabs/FormField/MetricCard…）；`states/` 子目录的 `Loading/Empty/ErrorState` 因重名需直引 `@/components/molecules/states/Error`。
- `organisms/index.ts`：业务有机体（pool/collection/analysis…）。
- `templates/index.ts`：页面级布局骨架（`CockpitLayout`/`PageContainer`/`PageHeader`/`SidebarLayout`，共 4 个，无业务逻辑）。注意：`PageHeader` 在 `moleculeRegistry` 中注册但 `level` 标记为 `'template'`。

### 1.3 迁移现状
阶段 1–5 全部完成：**0 shim 残留、0 违规 0 警告**，`audit:atomic` 133 文件通过。最终保留原位目录 `chart/cabin/cockpit/widgets`（因与 Widget 注册表耦合，仅 registry 标注，不物理搬）。

---

## 2. 组件注册表与门禁

- `src/components/componentRegistry.ts`：`COMPONENT_REGISTRY` 每项含 `name/level/sourcePath/targetPath/status/description`，`status: active|migrating|deprecated`（当前全量 active，`SkeletonLegacy` 已标记 `deprecated`）。
- `audit:atomic`（`scripts/audit/audit-atomic.ts`）：依据 registry 推断层级，扫描 `src/components/**/*.ts(x)`，按 `FORBIDDEN` 跨层表判定阻断性违规；含 `stale-ui-import`（探测已删的 `@/components/ui/`）、`unregistered` 警告。

---

## 3. Widget 系统（驾驶舱组件）

所有 Widget 位于 `src/cockpit/widgets/`（注意：部分旧文档误写为 `src/components/widgets/`，以代码为准）。

### 3.1 三处注册（必须同步）
1. `src/cockpit/core/widgetRegistry.ts` → `registerDefaultWidgets()` 的 `widgets[]`（含默认布局 `defaultLayout`）。
2. `src/constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG`（key 含 `title/category/size`）。
3. `src/constants/cockpit.constants.ts` 的 `WIDGET_DEFAULT_DATA_SOURCE`（key 含 `type/mode/interval/endpoint/enabled`）。

一致性由 `npm run audit:widget-registry` 校验（P0 违规 exit 1）。

> ⚠️ 文档漂移：旧 `widget-integration-checklist.md` 示例用 `WIDGET_CATEGORY.MARKET` 枚举，但代码实际用**字符串字面量** category（如 `'market'`/`'analysis'`/`'系统监控'`）。新增时以代码为准。

### 3.2 数据消费（useMarketData）
`MarketDataProvider`（Context）注入统一 `MarketData`；Widget 通过 `useMarketData()` 强校验消费（必须在 Provider 内），或 `useOptionalMarketData()`。Provider 在 `useEffect` 中按 `dataSource` 注册采集任务到 `taskScheduler`，结果经 `marketDataAdapter.adapt/merge` 注入，卸载时完整 cleanup。

### 3.3 四态外壳（复用）
`src/cockpit/widgets/components/WidgetStateShell.tsx` 统一封装 `ready/loading/empty/error` 四态，颜色走 `COLOR_TOKENS.danger`。Widget 推荐复用此外壳，避免重复样板。

---

## 4. 设计令牌与颜色门禁

### 4.1 lint:colors（强制令牌）
- 配置：`eslint.colors.config.js` + `eslint-rules/no-hardcoded-colors.js`（level: error）。
- 检测：HEX / RGB / HSL 字符串与模板字面量；Tailwind 数字色类 `text|bg|border|ring|from|to|via-{red|blue|…}-\d{2,3}`。
- 豁免：`src/constants/theme.tokens.ts`、`src/config/chartColors.ts`、`src/config/themeRegistry.ts`、`src/theme.config.ts`、`src/generated/*`、`tests/`。

### 4.2 红涨绿跌固定色（最重要例外）
所有个股/指数/ETF 涨跌幅必须用 `STOCK_COLOR_TOKENS`；**暗色模式不变**；禁止用 `COLOR_TOKENS.up/down` 替代。`cockpit.constants.ts` 的 `STOCK_COLOR_MAPPING` 已 `@deprecated`，改用 `STOCK_COLOR_TOKENS`。

### 4.3 开发提效
- `.vscode/token-snippets.code-snippets`：令牌导入/用法片段（如 `itt` 导入 theme tokens、`isc` 导入 stock colors、`icc` 导入 chart colors）。
- `design-tokens/figma-to-project.json`：Figma/MasterGo 变量 ↔ V9 令牌双向映射；`npm run audit:tokens` 校验。

---

## 5. 复用机制与交互逻辑

### 5.1 逻辑下沉到 Hook
- 数据/业务逻辑下沉到 `useXxxData` Hook，纯视图组件只收 props（见 `../how-to/how-to-add-widget.md`）。
- 代表：`src/hooks/usePoolBoard.ts` 操作研究池，用 `useState` 管纯 UI 局部态，`useMemo` 派生、`useCallback` 封装 handlers，业务动作委托 `poolService` 并回调 `refresh()` 同步 Store。
- Store 用 Zustand（`useXxxStore((s)=>s.xxx)` 自动订阅，返回 unsubscribe 供 cleanup）。

### 5.2 模板与状态外壳
- Templates：页面级布局骨架，无业务逻辑。
- 四态组件：`src/components/molecules/states/`（Loading/Empty/Error/Skeleton）+ `WidgetStateShell`。
- 全局视觉锚点：`SignalSpectrum`（信号频谱母题）、`DensityContext/DensityToggle`（信息密度）。

### 5.3 状态提升原则
业务数据进 Store，UI 局部态留组件内（Widget 是展示层，状态提升到 Store）。

---

## 6. UI 相关质量门禁

| 门禁 | 命令 | 作用 |
|------|------|------|
| 颜色硬编码 | `lint:colors` | 禁止 HEX/RGB/HSL 与 Tailwind 数字色类 |
| 原子层级 | `audit:atomic` | 校验跨层 import 禁令（阻断） |
| 令牌扫描 | `audit:tokens` | 无令牌硬编码违规 |
| JSDoc | `audit:jsdoc` | 导出函数/组件/Hook/Store action 必须有 JSDoc |
| 复杂度 | `audit:complexity` | 嵌套≥4、链式 if≥6、重复 if 债务只减不增 |
| Widget 注册 | `audit:widget-registry` | 三处注册一致性 |

**JSDoc 要点**（`jsdoc-convention.md`）：导出函数需 `@param/@returns`；组件需 `@description`+props；复杂 Hook 需说明输入输出/副作用/清理；禁止空 JSDoc、`@ts-ignore`（用 `@ts-expect-error`+原因）。
**复杂度要点**（`../explanation`）：卫语句+提前返回降嵌套；查找表替代长 if-else；提取常量/函数消除重复判断；基线对比 `.complexity-baseline.json`，债务只减不增。

---

## 7. UI 迁移与协作约定

迁移清单核心（`../reference/ui-migration-checklist.md`）：
1. 备份基线 → 移动文件 + 样式/类型/测试。
2. 更新所有 import + barrel `index.ts` 导出。
3. 更新路由/导航。
4. Store/Service 归属校验（禁止 `dataLayer`/`db` 直引、EventBus 订阅配对）。
5. 颜色令牌替换（`THEME_TOKENS`/`COLOR_TOKENS`/`STOCK_COLOR_TOKENS`）。
6. 跑 `tsc` / `audit:layers` / `lint:colors` / 测试 / E2E。
7. 文档同步（含 CHANGELOG）。

> ⚠️ 关键陷阱：**非源码旧路径残留**会导致 AI 生成错误代码。迁移后必须对 `*.tsx/.ts/.md/.json/.mjs/.cjs/.yaml/.yml/.sh` 全文件类型 grep 旧路径（排除 coverage/dist/docs/reports）。
