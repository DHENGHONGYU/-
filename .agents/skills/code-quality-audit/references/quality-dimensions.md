# 代码质量维度与可检查规则（参考）

> 本文件作为 `v9-code-quality-audit` Skill 的详细参考。每条维度都给出**通用原则**、**可检查规则（证据）**与**严重级**，供 AI 审查与 `quality-gate-check.cjs` 落地。
> 本项目（V9 智能投研复盘系统）以 `AGENTS.md` 为权威蓝图；通用原则适用于任意前端/TS 工程。

---

## D1 分层架构与依赖方向（Layering / Dependency Direction）

**通用原则**：代码须按职责分层（配置 / 核心 / 数据 / 库 / 服务 / 状态 / 页面 / 组件 / 常量 / 类型），依赖只能单向向下，禁止反向或跨层直连底层存储。

**可检查规则**：
- `pages/`、`components/`、`cockpit/`、`apps/` 不得 import `@/data/db`、`@/data/dataLayer`、`@/data/queryBuilder`。
- `services/`、`store/` 不得 import `@/data/db`（写库须经 `DataBridge.forward()`，读经 `DataBridge.query()`）。
- `lib/` 仅依赖 `core/`、`config/`；`core/` 不得依赖 `pages/components/apps/lib`；`constants/`、`types/` 零运行时依赖。
- 脚本检测：正则扫描 import 语句，命中即记录 `file → import spec`。

**严重级**：Blocking。
**V9 权威门禁**：`npm run audit:layers`（期望 0 violations）。

---

## D2 四步集成契约（Four-Step Integration）

**通用原则**：新功能须按「类型定义 → 状态 → 服务适配 → UI 集成」顺序落地，每步可独立回滚，禁止在 `pages/` 直接建孤立页面并直连数据层。

**可检查规则**：
- 类型：业务数据结构定义在 `src/types/modules/` 或 `src/data/types.ts`，禁止在组件内联 `interface`。
- 状态：`src/store/` 中使用 `withBroadcast` 实现跨 Tab 广播。
- 适配：`src/services/` 通过 `DataBridge.forward()` 写、`DataBridge.query()` 读。
- UI：页面/组件仅经 Store 取数，不得直连 db。

**严重级**：Blocking（违反分层即 D1/D2 双重命中）。
**V9 权威门禁**：`npm run audit:contract`（覆盖 §二四步契约、§三日志/清理、§八DB、§九LLM）。

---

## D3 类型安全（Type Safety）

**通用原则**：显式类型优先；禁止 `any` 退化类型系统；禁止用 `@ts-ignore` 掩盖错误。

**可检查规则**：
- 搜索 `\bany\b` 类型位（`: any`、`<any>`、`any[]`、`as any`、泛型参数）→ 违规。
- 搜索 `@ts-ignore` → 违规（应改 `@ts-expect-error` 并附原因注释）。
- 所有对外数据结构须先定义 `interface`/`type`。
- 复杂泛型应有 `Expect<Equals>` 类型测试（位于 `tests/__tests__/types/`）。

**严重级**：Blocking。
**脚本检测**：`quality-gate-check.cjs` 的 `no-explicit-any`、`no-ts-ignore` 门禁。

---

## D4 零硬编码（No Hardcoding）

**通用原则**：阈值、权重、公式参数、颜色、维度名、端点路径、魔法数字须抽到常量/配置文件。

**可检查规则**：
- 引擎层：阈值/权重/参数从 `src/services/scoring/v6-engine/config.ts` 注入。
- 颜色：UI 层禁止 HEX / Tailwind 颜色类，须用 `THEME_TOKENS` / `COLOR_TOKENS` / `COLOR_SHADES` / `chartColors.ts`；股票涨跌用 `STOCK_COLOR_TOKENS`（红涨绿跌，豁免主题切换）。
- 魔法数字：≥3 位字面量提取为 `const` 或 `src/config/thresholds.ts`。

**严重级**：Major（颜色）/ Blocking（引擎参数）。
**V9 权威门禁**：`npm run audit:hardcode`、`npm run lint:colors`。
**脚本检测**：`ui-hardcoded-colors` 启发式门禁（含误报，需人工确认）。

---

## D5 日志规范（Observability）

**通用原则**：核心分支可观测；错误日志带上下文；日志前缀统一。

**可检查规则**：
- 核心分支（filter reset / modal submission / data fusion / route switching / enqueue / dequeue）须有 `logger.info`。
- 日志前缀格式：`[模块名] 操作名`，如 `[DataBridge] routeToDB() completed`。
- 错误日志必须含 context：`logger.error('操作失败', { error: message })`。

**严重级**：Major。
**V9 权威门禁**：`npm run audit:contract`（logging-spec 类别）。

---

## D6 资源与事件清理（Resource Cleanup）

**通用原则**：订阅、监听、定时器须在组件卸载/测试结束后释放，防止内存泄漏与测试串扰。

**可检查规则**：
- `useEffect` 内 `addEventListener` / `EventBus.subscribe` / `window.addEventListener` 须配对 `removeEventListener` / `unsubscribe` / `clearInterval` / `clearTimeout`，在 cleanup 中返回清理函数。
- `EventBus.subscribe` 必须配对 `EventBus.unsubscribe`（禁止 cleanup 中用 `EventBus.clear()` 误伤其他订阅）。
- 测试 `vi.useFakeTimers()` 须在 `afterEach` 中 `vi.useRealTimers()`。

**严重级**：Major。
**脚本检测**：`event-listener-cleanup` 启发式门禁（文件含订阅但无 cleanup 关键字即告警）。

---

## D7 命名与路由注册（Naming & Routing）

**通用原则**：命名一致、可预测；路由集中注册，禁止在组件内硬编码路径。

**可检查规则**：
- 文件名 kebab-case 或 PascalCase；组件 PascalCase；Store `camelCase+Store`；常量 UPPER_SNAKE_CASE；类型 PascalCase。
- 业务路由在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 注册；新增页面同步更新 `docs/06-routing-specs.md`。

**严重级**：Minor。
**V9 权威门禁**：`npm run audit:routes`、`npm run audit:deadcode`。

---

## D8 数据接口协议（Data Interface Protocol）

**通用原则**：跨模块/跨层数据交换须契约化——统一信封（Envelope）、访问控制（ACL）、路由总线（Bridge）、广播机制（Broadcast）、标准响应包装。

**可检查规则**：见 `data-interface-protocol.md`（D8 专属参考）。

**严重级**：Blocking。

---

## D9 可测试性（Testability）

**通用原则**：每个模块须有对应测试；分层测试（单元/集成/E2E）；数据层与协议层必须有契约测试。

**可检查规则**：
- 服务/Store/核心协议（DataBridge/Envelope/ACL）须有 `.test.ts` 覆盖正常/异常路径。
- 新增对外接口须补 `Expect<Equals>` 类型测试。
- 提交前门禁：`npx tsc --noEmit` + `npm test -- --run` + `npm run audit`。

**严重级**：Major（缺契约测试）/ Blocking（tsc 不过）。
**V9 验证命令**：`npm run audit:tests`、`npm test -- --run`。

---

## 严重级约定

| 级别 | 含义 | 是否阻断合并 |
|------|------|--------------|
| Blocking | 破坏架构/类型契约，必须在合并前修复 | 是 |
| Major | 质量显著下降（硬编码/清理缺失） | 建议修复，可协商 |
| Minor | 风格/可维护性 | 否 |

> 机器门禁（`quality-gate-check.cjs`）将 Blocking + Major 失败判为 `FAIL`（退出码 1）；仅 Minor/启发式警告判为 `PASS_WITH_WARNINGS`。
