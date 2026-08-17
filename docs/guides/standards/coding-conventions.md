---
doc_id: V9-DOC-GUIDE-046
title: "V9 编码规范（Coding Conventions）"
domain: guide
status: active
last_updated: 2026-08-17
---

---
doc_id: V9-DOC-GUIDE-029
title: "V9 编码规范（Coding Conventions）"
domain: guide
status: active
last_updated: 2026-08-15
---

# V9 编码规范（Coding Conventions）

> **定位**：汇总 `AGENTS.md` 中的工程约束为一页可速查的编码规范，补「应有文档：coding-conventions」缺口。
> **权威契约**：`AGENTS.md`（不可替代）。本文是其摘要版。
> **状态**：✅ P0 新增（摘要版，冲突以 AGENTS.md 为准）

---

## 1. 类型安全

- ❌ 禁止 `any`（`@typescript-eslint/no-explicit-any: error`）。
- ❌ 禁止 `@ts-ignore`；用 `@ts-expect-error` 并附注释说明原因。
- ✅ 所有数据结构先定义 Interface；复杂泛型须有 `Expect<Equals>` 类型测试（`tests/__tests__/types/`）。
- ✅ 修改 `UserType` 不得破坏 `user-type.spec.ts`。

---

## 2. 零硬编码

- **引擎层**：阈值/权重/公式参数从 `src/services/scoring/v6-engine/config.ts` 注入。
- **UI 层**：颜色必须引用 `src/constants/` 令牌，禁直接 HEX 或 Tailwind 数字颜色类（`lint:colors` 拦截）。
- **组件层**：≥3 位数字魔法数须提取为 `const` 或 config。

---

## 3. 四步集成契约（新增模块）

1. **类型** → `src/types/modules/` 或 `src/data/types.ts`
2. **Store** → `src/store/`（Zustand + `withBroadcast` 跨 Tab 广播）
3. **Service/适配** → `src/services/`（经 `DataBridge.forward()` 写数据）
4. **UI** → `src/pages/` 或 `src/components/`（仅经 Store 取数）

每步可独立回滚，完成后 `npx tsc --noEmit` 验证。

---

## 4. 日志规范

- 核心分支（filter reset、modal 提交、data fusion）须 `logger.info`。
- 前缀格式：`[模块名] 操作名`，如 `[DataBridge] routeToDB() completed`。
- 错误日志含 context：`logger.error('操作失败', { error: message })`。

---

## 5. 事件监听清理（标准化模板）

```typescript
// EventBus
useEffect(() => {
  const handler = (d: unknown) => { /* ... */ }
  EventBus.subscribe('ev', handler)
  return () => EventBus.unsubscribe('ev', handler)
}, [])
// DOM 事件 / 定时器同理，cleanup 中配对移除
// ❌ 禁止 cleanup 中用 EventBus.clear()
```

`EventBus.subscribe()` 配对 `unsubscribe()`；`vi.useFakeTimers()` 须在 `afterEach` 中 `useRealTimers()`。

---

## 6. 文档与 JSDoc

- 新增公共函数/组件/Hook/Store 必须补 JSDoc（见 `../../archive/historical-2026-08-16/batch8/jsdoc-convention.md（已归档）`）。
- 避免深层嵌套、长链式条件、过长函数（见 `../../archive/historical-2026-08-16/batch8/complexity-governance.md（已归档）`）。

---

## 7. 门禁速查

| 命令 | 作用 |
|------|------|
| `npm run audit:layers` | 跨层调用 0 违规 |
| `npm run audit:atomic` | 原子组件边界 0 违规 |
| `npm run lint:colors` | 颜色零硬编码 |
| `npm run audit:tokens` | 设计令牌同步 |
| `npm run audit:docs` | 文档-代码同步 |
| `npm run tsc:prod` | 生产类型检查 |
| `npm run test:clean` | 单元测试（须绿） |

---

_规范冲突时以 `AGENTS.md` 为准；本文随规范演进持续更新。_
