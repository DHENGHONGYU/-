# AGENTS.md — V9 智能投研复盘系统 AI 行为约束契约

> **版本**: v1.0.0 | **日期**: 2026-07-02
> **适用范围**: 所有 AI 辅助开发工具（Claude Code、Cursor、Trae 等）
> **强制等级**: 所有 AI 生成的代码必须遵守以下约束

---

## 一、项目分层规则（禁止跨层调用）

```
src/config/       ← 配置层（零硬编码锚点）
src/core/         ← 核心工具与类型守卫（DataBridge/ACL/Envelope/MemoryCache/EventBus）
src/data/         ← 数据层（IndexedDB/dataLayer/queryBuilder/types）
src/lib/          ← 库函数（logger/format/errors/utils/localStorageManager）
src/services/      ← 服务层（18个子域：analysis/scoring/fetcher/news/llm/...）
src/store/        ← 状态层（39个Zustand Store + helpers/withBroadcast）
src/pages/        ← 页面层（5舱：input/analysis/trading/output/command）
src/components/   ← 组件层（ui/cabin/chart/pool/news/strategy/...）
src/portal/       ← PortalShell 舱室入口层
src/constants/    ← 常量层（零硬编码锚点）
```

### 依赖方向规则

- `pages/` 和 `components/` → 只能依赖 `store/` 和 `services/`，禁止直接调用 `dataLayer` 或 `db`
- `store/` → 只能依赖 `services/` 和 `core/`
- `services/` → 只能依赖 `core/` 和 `data/`，禁止直接写 `db`（通过 `DataBridge.forward()`）
- `core/` → 禁止依赖 `pages/`、`components/`、`apps/`
- `config/` → 禁止依赖 `services/`、`pages/`、`components/`

### 验证命令

```powershell
npm run audit:layers
# 期望：0 violations, 0 warnings
```

---

## 二、四步集成编码契约

新模块严禁直接在 `/views` 或 `/pages` 目录下新建 `.vue` 或 `.tsx` 文件并孤立运行，必须按以下四步顺序集成：

1. **类型定义** → 在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface
2. **Store/状态** → 在 `src/store/` 中创建 Zustand Store，通过 `withBroadcast` 实现跨 Tab 广播
3. **Builder/适配层** → 在 `src/services/` 中创建 Service，通过 DataBridge 写入数据
4. **核心集成** → 在 `src/pages/` 或 `src/components/` 中创建 UI，仅通过 Store 获取数据

每步可独立回滚，完成后运行 `npx tsc --noEmit` 验证类型安全。

---

## 三、代码风格约束

### 类型安全

- 禁止使用 `any`（ESLint `@typescript-eslint/no-explicit-any: error`）
- 禁止使用 `@ts-ignore`（使用 `@ts-expect-error` 并附带注释说明原因）
- 所有数据结构必须先定义 TypeScript Interface
- 复杂泛型必须有 `Expect<Equals>` 类型测试（位于 `tests/__tests__/types/`）
- 修改 `UserType` 不得破坏 `user-type.spec.ts`

### 零硬编码

- 引擎层：所有阈值、权重、公式参数必须从 `src/services/scoring/v6-engine/config.ts` 注入
- UI 层：所有颜色值必须引用 `src/constants/` 中的常量，禁止直接使用 HEX 或 Tailwind 数字颜色类
- 组件层：禁止魔法数字（3位以上数字需提取为 const 或 config）

### 日志规范

- 核心分支（filter reset、modal submission、data fusion）必须有 `logger.info` 打印
- 日志前缀格式：`[模块名] 操作名`，如 `[DataBridge] routeToDB() completed`
- 错误日志必须包含 context 对象：`logger.error('操作失败', { error: message })`

### 事件监听清理

- 所有 `useEffect` 中的事件监听必须在 cleanup 中显式移除
- `EventBus.subscribe()` 必须配对 `EventBus.unsubscribe()`
- 测试中使用 `vi.useFakeTimers()` 必须在 `afterEach` 中 `vi.useRealTimers()`

---

## 四、命名约定

- **文件名**: kebab-case（如 `data-bridge.ts`）或 PascalCase（如 `DataBridge.ts`）
- **组件**: PascalCase（如 `CockpitShell.tsx`）
- **Store**: camelCase + `Store` 后缀（如 `analysisStore.ts`）
- **常量**: UPPER_SNAKE_CASE（如 `ROUTE_REGISTRY`）
- **类型**: PascalCase + Interface 前缀（如 `interface StockData`）
- **UI 组件 import 路径**: 大小写必须一致（如 `Card` 而非 `card`）

---

## 五、路由注册规则

- 所有业务路由必须在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 中注册
- 禁止组件内硬编码路由路径
- 新增页面必须同步更新 `ROUTE_REGISTRY` 和 `docs/06-routing-specs.md`
- 路由白名单通过 `ROUTE_WHITELIST` 和 `ROUTE_PREFIX_WHITELIST` 控制

---

## 六、引擎架构约束

- L3/L4/L7/L8 是确定性层（程序计算），L0/L1/L2/L5/L6 是 LLM 可增强层
- L4 应用层不得直接调用 L6 外部依赖（含 LLM 客户端），必须通过 L3 services 路由
- LLM 模型选择和评分因子使用必须通过接口暴露给用户，含显式选择选项
- LLM 调用必须含用户可配置的开关，可禁用/启用特定 LLM 可增强层
- LLM API Key 必须使用 `localStorageManager.setEncrypted/getEncrypted` 加密存储
- LLM 输出必须经 `sanitizeLlmOutput` 消毒后渲染，防止 XSS

---

## 七、验证命令速查

```powershell
# 类型检查
npx tsc --noEmit

# ESLint
npm run lint

# 单元测试
npm test -- --run

# 生产构建
npm run build

# 架构审计
npm run audit          # 全部审计
npm run audit:layers   # 分层调用
npm run audit:hardcode # 硬编码
npm run audit:deadcode # 死代码
npm run audit:docs     # 文档同步
```

---

## 八、数据库版本管理

- 修改 IndexedDB schema 必须递增 `DB_VERSION`（`src/config/dbConfig.ts`）
- 新增 store 必须在 `STORE_NAME` 中注册
- 新增 store 必须在 `ACL_MATRIX` 中添加对应的 read/write 白名单
- 新增 store 必须在 `db.ts` 的 `onupgradeneeded` 中添加创建逻辑
- 新增 ENVELOPE_ACTION 必须在 `DataBridge.routeToDB()` 中添加对应 case

---

## 九、LLM 调用透明度

- LLM 调用前必须向用户展示模型选择和评分因子使用情况
- 评分结果必须清晰标注哪些因子使用 LLM 增强 vs 自动计算
- LLM 调用必须包含用户可配置的开关

---

## 十、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-02 | 初始版本：分层规则、四步契约、类型安全、零硬编码、路由注册、引擎架构、验证命令、数据库版本管理、LLM透明度 |
