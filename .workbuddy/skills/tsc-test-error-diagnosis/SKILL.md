---
skill_id: V9-SKILL-TSC-TEST-DIAG
name: tsc-test-error-diagnosis
title: "tsc:test 测试文件类型错误系统性诊断与修复"
description: "当 npm run tsc:test（tsc -p tsconfig.test.json --noEmit）报出大量测试文件类型错误时，系统性定位、根因归类并合规修复。基于 2026-07-22 V9 实战：211→0 错误清零，覆盖契约漂移(Contract Drift)、严格空检暴露(strictNullChecks/noUncheckedIndexedAccess)、vi.mock 提升陷阱、未使用声明、以及脚本替换缺陷导致的 TS1011 语法错误。适用于 vitest 测试、*.spec.ts、*.test.ts(x) 的类型体检与历史债务清理。"
agent_created: true
category: code-quality
triggers:
  keywords: [tsc:test 报错, 测试类型错误, 契约漂移, Contract Drift, 测试与源码类型不一致, vi.mock 提升陷阱, noUncheckedIndexedAccess, strictNullChecks, TS2305 找不到导出, TS2322 不可赋值, TS2339 属性不存在, TS2532 可能为 undefined, TS1011 空数组下标, 测试类型债务, 历史测试债, 测试类型体检, 测试文件类型清零, 类型断言漂移]
  files:
    - "tsconfig.test.json"
    - "tests/**/*.test.ts"
    - "tests/**/*.spec.ts"
    - "src/**/*.test.ts"
    - "src/**/*.test.tsx"
  events: [tsc-test-red, test-type-error, contract-drift-detected]
gates:
  - "错误按 file:line 归类到四大根因（契约漂移 / 严格空检 / vi.mock提升 / 未使用声明），每类产出证据"
  - "契约漂移类修复必须「先读真实源码类型再改测试」，禁止凭想象补全字段（防二次漂移）"
  - "空检暴露用 `!` / 可选链 / 默认值收敛，禁止用 `any` / `@ts-ignore` 掩盖"
  - "修复后 npm run tsc:test 实测 0 错误，且 tsc:prod 保持 0（生产门禁不被破坏）"
mandatory: false
covers_docs: [outputs/tsc-test-top5-repair-schedule.md, scripts/tsc-test-inventory.ts]
---

# tsc:test 测试文件类型错误系统性诊断与修复

> **核心铁律：测试类型错误 ≠ 业务代码坏了。绝大多数测试类型错误是「测试契约」与「源码真实类型」失配（契约漂移），修复点在测试侧，不是源码侧。**
> **绝不因测试类型债而放宽源码约束（如关 strictNullChecks）或用 `any` 掩盖——那是把债务转嫁给生产。**

---

## 〇、触发判定（何时加载本 skill）

满足任一即触发：
1. `npm run tsc:test` 退出码非 0，输出集中在 `tests/**` 或 `src/**/*.test.*`。
2. 错误数 30+ 且分散在多个测试文件（历史测试债）。
3. 出现 `TS2305`（找不到导出成员）、`TS2339`（属性不存在）、`TS2322`（不可赋值）等"测试引用了源码没有的东西"的特征码。
4. 重构/接口变更后测试文件批量飘红（契约漂移爆发）。

**不触发**：错误全在 `src/**` 非测试源码 → 那是真 prod 缺陷，配合 `module-sync-checklist` + `tsc-gate-scope-audit` 修代码。

---

## 一、根因分类模型（四大类 + 子模式）

本项目 `tsconfig.test.json` 继承 strict 全家桶：`strict` / `strictNullChecks` / `noUncheckedIndexedAccess` / `noImplicitAny`。测试文件因此暴露四类问题：

### A 类 · 契约漂移（Contract Drift）—— 占比最高（≈60%）

**定义**：测试按"想象中/旧版/文档承诺"的 API 写断言，但源码真实类型已变（字段改名、方法重命名、返回结构变、枚举值删减）。测试是"旧契约"的化石。

**子模式**：
| 子模式 | 典型表现 | 真实根因 |
|---|---|---|
| A1 字段改名 | `profileItem.layerId` 报错 | 源码已改为 `layer` |
| A2 字段删除 | `stockProfile.name` / `completenessScore` 报错 | 源码拆为 `stockName` / 已删除 |
| A3 类型改名 | `ProfileItemType='report'` 报错 | 源码枚举为 `'research_report'` |
| A4 方法重命名 | `recalculateProfileStats()` 报错 | 源码为 `updateProfileStats()` |
| A5 返回结构变 | `getProfileItem()` 期望 `null` 报错 | 源码返回 `undefined` |
| A6 返回包装变 | `bulkSaveProfileItems()` 期望数组报错 | 源码返回 `SyncResult` 对象 |
| A7 枚举值删减 | `SentimentLabel='mixed'` 报错 | 源码只有 positive/negative/neutral |
| A8 占位断言非法 | `assertNever<Equals<A,A>>()` 报错 | `Equals<A,A>` 非 `never`，该占位写法无效 |

**高危信号**：同一文件多个 TS2339/TS2305 指向"源码里听起来该有、实际没有"的符号 → 99% 是漂移，不是源码缺实现。

### B 类 · 严格空检暴露（Strict Null Exposure）—— 占比 ≈25%

**定义**：strict 模式下 `T | undefined` 不能当 `T` 用，`noUncheckedIndexedAccess` 下数组下标返回 `T | undefined`。测试里裸用 `.data.x` / `arr[i].y` 就飘红。

**子模式**：
| 子模式 | 错误码 | 修复手法 |
|---|---|---|
| B1 可选属性链断 | TS2532 / TS18048 | `result.data.x` → `result.data!.x` 或 `result.data?.x` |
| B2 数组下标 | TS2532 | `arr[i].prop` → `arr[i]!.prop`（确认非空时）或 `arr[i]?.prop` |
| B3 函数返回 undefined | TS2322 | 目标类型若要求非 null，用 `!` 收敛或调整断言 |

**注意 B2**：`noUncheckedIndexedAccess` 是本项目**特意开启**的（防越界）。修复时保留该约束，用 `!`（已知非空）而非关掉规则。

### C 类 · vi.mock 提升陷阱（Hoisting Trap）—— 占比 ≈10%

**定义**：`vi.mock('x', () => ({ db: dbModule.db }))` 的工厂函数在文件顶部"提升"执行，此时顶部的 `import { dbModule } from '...'` 在 TS 视角下**可能尚未初始化**（运行时一定已初始化）。TS 推断 `dbModule` 为 `typeof import | undefined` → 访问 `.db` 报 TS2532。

**修复**：工厂内对导入绑定加 `!`：`dbModule!.db`、`mockLogger!`。这是 vi.mock 的固有语义，**不是测试写错**。

### D 类 · 未使用声明（Unused）—— 占比 ≈5%

| 子模式 | 错误码 | 修复 |
|---|---|---|
| D1 未用导入 | TS6133 / TS6196 | 从 import 中删除 |
| D2 重复属性 | TS2783 | 移除被 spread 覆盖的冗余键（如 `...overrides` 已含 `symbol`，再写 `symbol: overrides.symbol` 即重复） |
| D3 未用参数 | TS6133 | 删除回调无用形参 `(s, i) =>` → `(s) =>` |

### E 类 · 脚本替换缺陷（Self-Inflicted Syntax）—— 偶发但致命

**定义**：用正则脚本批量修测试时，正则缺陷**吞掉数组下标数字**，产出 `result.targets![]!`（空下标）→ 15× `TS1011: An element access expression should take an argument`（空数组字面量语法错误）。

**根因**：`String.replace` 的 replacement 用了 `$1` 但正则分组没捕获数字，或替换串把 `[\d+]` 整体删掉。
**修复**：先 `replace_all` 把 `![]!` → `![0]!`，再按"测试语义"把多 target 块的第 2+ 个还原为 `[1]/[2]`（见 §五案例）。
**预防**：批量改测试前**先人工抽样 3 行**确认正则输出，再全量跑；跑完立刻 `tsc:test` 验证，不要等。

---

## 二、错误码速查表（tsc:test 高频码）

| 错误码 | 含义 | 首选归因 | 首选修复 |
|---|---|---|---|
| TS2305 | 模块无此导出成员 | A 类漂移 | 读源码确认真实导出名，改测试引用 |
| TS2307 | 找不到模块 | 路径漂移/大小写 | 修正 import 路径（含测试别名） |
| TS2322 | 类型不可赋值 | A5/A6 结构变 或 B 类 | 对齐真实返回类型 |
| TS2339 | 类型上不存在属性 | A1/A2 字段改名删 | 读源码真实字段名 |
| TS2344 | 类型参数不满足约束 | A8 占位非法 | 删无效占位断言 |
| TS2345 | 实参类型不可赋值 | A 类方法签名变 | 对齐真实签名 |
| TS2532 | 对象可能为 undefined | B1 | `!` 或可选链 |
| TS18048 | 可能为 null/undefined | B1 | `!` 或可选链 |
| TS6113/TS6133/TS6196 | 未使用 | D 类 | 删除 |
| TS2783 | 属性指定多次 | D2 重复键 | 删冗余键 |
| TS1011 | 元素访问缺少参数 | E 类脚本缺陷 | 补回下标数字 |
| TS7053 | 索引签名缺失 | A 类 | 用真实已知键 |

---

## 三、逐文件排查五步法（用户要求的 SOP）

> 从错误率最高的文件开始，逐文件推进。每文件必须走完五步，**禁止跳到"直接改"**。

**步骤 1 · 定位（Locate）**
- 跑 inventory 脚本聚合：`node ./node_modules/tsx/dist/cli.mjs scripts/tsc-test-inventory.ts`（读 `tsc_test.log`，按文件/错误码分组）。
- 输出 Top-N 文件清单（错误数降序），作为排查顺序。

**步骤 2 · 根因（Root Cause）**
- 对每个错误用 §一 / §二 归类（A/B/C/D/E）。
- **关键验证动作**：漂移类（A）**必须先读真实源码**（如 `src/services/profile/profileService.ts`、`src/data/types/types.profile.ts`），把"测试引用的符号"与"源码真实导出"逐项比对，列出差异表。

**步骤 3 · 验证（Verify）**
- 漂移结论必须可证伪：若改完仍飘红，立即回头重读源码——多半是"想象字段"又错一处。
- 用 `grep`/Grep 工具在源码中搜真实符号名，确认拼写与类型（防凭记忆补全）。

**步骤 4 · 修复（Fix）**
- A 类：改写测试断言对齐真实类型（**改测试，不动源码**）。
- B 类：`!` / `?.` 收敛，保留严格约束。
- C 类：vi.mock 工厂内导入绑定加 `!`。
- D 类：删未用声明 / 冗余键。
- E 类：补回下标数字（先 `[0]` 全量，再按语义还原 `[1]`）。

**步骤 5 · 提炼（Lesson）**
- 每文件修复后，用一句话记"这类漂移的根因 + 防复发动作"，沉淀进本 SKILL 的 §四模式库或项目记忆。

---

## 四、高频错误模式库（Before → After 实战样本）

> 以下均来自 V9 实战，可直接套用。

### 模式 1 · 字段改名（A1/A2）
```ts
// ❌ 漂移：测试引用源码已删除/改名的字段
expect(item.layerId).toBe('L1')              // TS2339
expect(stock.name).toBe('贵州茅台')           // TS2339
expect(profile.domainStats).toBeDefined()     // TS2339
// ✅ 对齐真实类型
expect(item.layer).toBe('L1')
expect(stock.stockName).toBe('贵州茅台')
expect(profile.domainCounts).toBeDefined()
```

### 模式 2 · 返回结构/包装变（A5/A6）
```ts
// ❌ 期望 null / 数组，但源码返回 undefined / SyncResult
const item = await getProfileItem('id')       // 期望 T | null → 实际 T | undefined
expect(item).toBeNull()                        // TS2322
const res = await bulkSaveProfileItems(items)  // 期望数组 → 实际 SyncResult
expect(res.length).toBe(3)                     // TS2339
// ✅
expect(item).toBeUndefined()
expect(res.successCount).toBe(3)
```

### 模式 3 · 枚举值改名/删减（A3/A7）
```ts
// ❌
type ProfileItemType = 'report'               // 源码是 'research_report'
const label: SentimentLabel = 'mixed'          // 源码无 mixed
// ✅
type ProfileItemType = 'research_report'
const label: SentimentLabel = 'neutral'
```

### 模式 4 · 方法重命名（A4）
```ts
// ❌
await recalculateProfileStats(symbol)          // TS2305 无此导出
// ✅
await updateProfileStats(symbol)
```

### 模式 5 · 严格空检暴露（B1/B2）
```ts
// ❌
expect(result.data.x).toBe(1)                  // TS18048 data 可能 undefined
expect(arr[i].prop).toBe(2)                    // TS2532 下标可能 undefined
// ✅（已知非空时）
expect(result.data!.x).toBe(1)
expect(arr[i]!.prop).toBe(2)
// 或（防御性）
expect(result.data?.x).toBe(1)
```

### 模式 6 · vi.mock 提升陷阱（C）
```ts
// ❌ dbModule 在工厂提升期 TS 视为可能 undefined
vi.mock('../db', () => ({ db: dbModule.db, logger: mockLogger }))
// ✅ 工厂内加 !
vi.mock('../db', () => ({ db: dbModule!.db, logger: mockLogger! }))
```

### 模式 7 · 重复属性（D2）
```ts
// ❌ ...overrides 已含 symbol，又显式写一次 → TS2783
const make = (overrides) => ({ ...overrides, symbol: overrides.symbol })
// ✅ 删冗余键
const make = (overrides) => ({ ...overrides })
```

### 模式 8 · 脚本缺陷空下标（E）
```ts
// ❌ 正则缺陷吞掉数字
expect(result.targets![]!.store).toBe('x')    // TS1011
// ✅ 先全量补 [0]
expect(result.targets![0]!.store).toBe('x')
// 多 target 块再还原
expect(result.targets![1]!.store).toBe('y')
```

---

## 五、实战案例：cascadeExecutor 空下标（E 类还原）

背景：`result.targets` 类型为 `CascadeTarget[] | undefined`。测试断言级联删除命中了哪些 store。
缺陷：批量加 `!` 脚本的正则把 `[0]` 的数字吞掉，变成 `result.targets![]!`，触发 15× TS1011。

修复 SOP：
1. `replace_all`：`result.targets![]!` → `result.targets![0]!`（13 处单 target 块全部正确）。
2. 多 target 块（如删除角色级联清理 user_roles + role_permissions）按**语义**还原：第 1 个 target → `[0]`，第 2 个 → `[1]`：
```ts
expect(result.targets![0]!.store).toBe('rbac_user_roles')
expect(result.targets![0]!.affectedCount).toBe(1)
expect(result.targets![1]!.store).toBe('rbac_role_permissions')
expect(result.targets![1]!.affectedCount).toBe(2)
```
3. **教训**：批量改下标类语法，**先抽样再全量**，跑完立即 `tsc:test`，不要攒一批。

---

## 六、预防措施（防复发）

1. **测试即契约快照**：源码接口/类型变更时，**同回合**改对应测试（不要等红灯爆发）。配合 `module-sync-checklist` 的"十域同步"把测试纳入变更清单。
2. **漂移用 grep 证伪**：补字段前先 `grep` 源码确认真实名，绝不凭"听起来该有"补全。
3. **空检收敛而非关闭**：保留 `noUncheckedIndexedAccess` / `strictNullChecks`，用 `!`/`?.` 收敛已知非空场景。
4. **vi.mock 工厂一律加 `!`**：把 C 类当成书写规范，新测试直接写 `dbModule!.db`。
5. **批量脚本三铁律**：① 先人工抽样 3 行验证正则输出；② 全量跑完立即 `tsc:test`；③ 用 `replace_all` 而非手写循环，减少吞字符风险。
6. **门禁分流**：`tsc:prod`（源码）与 `tsc:test`（测试）分开跑。测试债爆发时**只修测试**，不动 `tsconfig` 严格度，避免债务转嫁生产。
7. **趋势追踪**：用 `scripts/tsc-test-inventory.ts` 每周生成错误分布快照，错误数回升即预警（可挂周度自动化）。

---

## 七、配套脚本

- `scripts/tsc-test-inventory.ts`：读 `tsc_test.log`，按文件/错误码聚合并输出 Top-N 排查顺序。
- 运行门禁：
  - 测试类型检查：`node ./node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit`
  - 生产类型检查：`npm run tsc:prod`（必须保持 0）
- 注意：本机受管 Node 22 跑 tsx 偶发段错误，批量/inventory 类用系统 Node 24 驱动：`"C:/Program Files/nodejs/node.exe" ./node_modules/tsx/dist/cli.mjs scripts/tsc-test-inventory.ts`

---

## 八、交付判定（何时可声明"完成"）

- ✅ `npm run tsc:test` 退出码 0（错误数 = 0）。
- ✅ `npm run tsc:prod` 仍为 0（生产门禁未被破坏）。
- ✅ 每个修复文件都能在 §一归因表中找到根因类别，无 `any` / `@ts-ignore` 掩盖。
- ✅ 漂移类修复均有"已读真实源码类型"的动作证据（非凭记忆补全）。
