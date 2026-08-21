---
title: V9 编码规范（Coding Conventions）
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：汇总 `../../AGENTS.md` 中的工程约束为一页可速查的编码规范，补「应有文档：coding-conventions」缺口。..."
tags: [project, spec, reference]
version: v1.1.0
last_updated: 2026-08-09
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-225
referenced_by: [V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-BACK-026, V9-DOC-QA-009, V9-DOC-PROJ-176, V9-DOC-PROJ-294, V9-DOC-PROJ-149]
change_log:
  - version: v1.1.0
    changes: 新增 §7 文件系统操作规范（safeWriteFileSync 强制使用）
    date: 2026-08-09
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---
covers_code:
  - src/services/scoring/v6-engine/config.ts
  - src/data/types.ts
  - src/lib/safeFs.ts


# V9 编码规范（Coding Conventions）

> **定位**：汇总 `../../AGENTS.md` 中的工程约束为一页可速查的编码规范，补「应有文档：coding-conventions」缺口。
> **权威契约**：`../../AGENTS.md`（不可替代）。本文是其摘要版。
> **状态**：? P0 新增（摘要版，冲突以 AGENTS.md 为准）

---

## 1. 类型安全

- ? 禁止 `any`（`@typescript-eslint/no-explicit-any: error`）。
- ? 禁止 `@ts-ignore`；用 `@ts-expect-error` 并附注释说明原因。
- ? 所有数据结构先定义 Interface；复杂泛型须有 `Expect<Equals>` 类型测试（`tests/__tests__/types/`）。
- ? 修改 `UserType` 不得破坏 `user-type.spec.ts`。

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
// ? 禁止 cleanup 中用 EventBus.clear()
```

`EventBus.subscribe()` 配对 `unsubscribe()`；`vi.useFakeTimers()` 须在 `afterEach` 中 `useRealTimers()`。

---

## 6. 文档与 JSDoc

- 新增公共函数/组件/Hook/Store 必须补 JSDoc（见 `./jsdoc-convention.md`）。
- 避免深层嵌套、长链式条件、过长函数（见 `./complexity-governance.md`）。

---

## 7. 文件系统操作

### 7.1 强制使用 safeWriteFileSync

- **禁止**在脚本和业务代码中直接调用 `writeFileSync` 写入动态路径（路径含变量拼接、时间戳、用户输入等）。
- **必须**使用 `src/lib/safeFs.ts` 中的 `safeWriteFileSync`，该函数在写入前自动调用 `mkdirSync(dirname(filePath), { recursive: true })` 创建父目录，避免 ENOENT 异常。

```typescript
// ❌ 禁止：动态路径 + 无目录创建 → ENOENT 风险
import { writeFileSync } from 'fs'
writeFileSync(join(dir, `report-${Date.now()}.json`), data, 'utf-8')

// ✅ 正确：自动创建父目录
import { safeWriteFileSync } from '@/lib/safeFs'
safeWriteFileSync(join(dir, `report-${Date.now()}.json`), data)
```

### 7.2 适用范围

| 场景 | 要求 |
|------|------|
| 脚本写入报告/输出文件（`scripts/`） | 必须使用 `safeWriteFileSync` |
| 业务代码写入缓存/日志（`src/`） | 必须使用 `safeWriteFileSync` |
| 写入静态路径（目录确定存在） | 可直接 `writeFileSync`，但建议统一 |
| `.cjs`/`.mjs` 脚本 | 无法导入 TS 模块时，须在 `writeFileSync` 前显式 `mkdirSync` |

### 7.3 迁移要点

- 替换 `writeFileSync` → `safeWriteFileSync` 时，移除冗余的 `mkdirSync` 前置调用和 `existsSync` 目录检查。
- `safeWriteFileSync` 签名与 `writeFileSync` 兼容：`(filePath, data, options?)`，默认编码 `'utf-8'`。
- 导入路径：`scripts/` 下用相对路径 `'../src/lib/safeFs'`，`src/` 下用 `'@/lib/safeFs'`。

---

## 8. 门禁速查

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

_规范冲突时以 `../../AGENTS.md` 为准；本文随规范演进持续更新。_
