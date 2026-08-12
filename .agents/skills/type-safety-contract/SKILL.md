---
name: "type-safety-contract"
description: "修改 TypeScript 类型前强制6步安全契约：不变式锚定→影响范围扫描→变更方案→边界守卫(any/never/null)→分层原子执行→tsc+类型级测试验证。Invoke when user asks to modify/refactor/rename a TypeScript interface, type, or generic, or before any type-definition edit, to prevent type-erosion and CI breakage."
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# TypeScript 类型安全修改硬契约 (Type-Safety Contract) — v1.0.0

> **定位**：软件开发时必须硬性遵守的契约原则。把"悬在空中的类型安全"变成可执行、可验证、AI 能主动规避的硬约束。
> **创建**：2026-07-02，基于"五维不可替代性"框架 + 项目类型级测试基线。

---

## 一、触发条件（Invoke When）

满足以下任一即应激活本契约：

- 用户要求 **修改 / 重构 / 重命名** 任何 TypeScript `interface`、`type`、泛型参数、函数签名。
- 用户要求"放宽类型""加个字段""改个可选""合并类型""提取公共类型"。
- 任何涉及 `src/types/**`、`src/**/types.ts`、`*.d.ts`、`__tests__/types/**` 的改动。
- AI 自主决定修改类型签名时（须先回到第 0 步）。

**不触发**：纯运行时逻辑改动、不触碰类型签名的实现修改。

---

## 二、核心契约：6 步强制流程（禁止跳步）

### 第 0 步 · 不变式锚定（Compile-time 契约基线）

- 识别本次涉及类型的当前**不变式**：
  - 可赋值关系（A extends B？双向？）
  - 可空性（是否含 `null | undefined` 字段）
  - 方差（协变 / 逆变 / 双变）
- 全局查找是否存在**类型级测试**（`__tests__/types/*.spec.ts`、`*.d.ts` 中的 `Expect<...>` / `Equals<...>` / `@ts-expect-error` 断言）。
- 若存在 → 列为【硬约束基线】，声明：修改后这些断言必须仍通过 `tsc --noEmit`。
- 输出"不变式清单"，待用户确认后进入第 1 步。

### 第 1 步 · 影响范围扫描（先扫后改）

- 全局搜索该类型的**所有引用点**：`import`、派生类型（`extends`/`implements`）、泛型实参、函数签名入参/返回值、类型守卫。
- 输出「影响范围清单」表格：

  | 文件路径:行号 | 引用方式 | 风险等级(🔴高/🟡中/🟢低) | 兼容性影响 |
  |---|---|---|---|

- **门禁**：用户确认清单前，禁止修改任何代码。

### 第 2 步 · 变更方案（三选一，优先级递减）

- **方案 A · 窄化扩展**（首选）：仅新增可选字段或更宽的联合，保持向后兼容，旧调用方零改动。
- **方案 B · 泛型参数化**：把变动抽象为泛型参数，由调用方决定具体形态。
- **方案 C · 破坏性重构**：仅当 A/B 均不可行，提供完整迁移路径 + codemod 思路 + 版本号策略。
- 必须说明所选方案对**方差**的影响，以及是否改变可赋值方向。

### 第 3 步 · 边界守卫（守住 TS 护城河）

- **any 红线**：禁止用 `any` 掩盖类型错误；确需放宽用 `unknown` + 类型守卫 narrowing。
- **never 边界**：条件类型 / `infer` 后的 `never` 分支须正确处理，避免吞掉合法分支。
- **可空性**：是否破坏"无 null 字段"等既定不变式；如必须引入可空，须同步更新对应类型级测试。
- **any 退化检查**：确认修改未导致下游推断大面积退化为 `any`（会产生假阳性）。

### 第 4 步 · 原子执行（分层顺序，每步可独立回滚）

按「**类型定义 → store/状态 → builder/适配层 → 核心集成**」分层顺序给出原子命令：

- 每条命令必须含**具体文件路径与行号**，禁止模糊表述。
- 每步标注预期 `tsc --noEmit` 输出（应为：无新增错误）。
- 遵循项目"四步集成编码契约"（type definition → store → builder → core integration）。

### 第 5 步 · 验证（双重门禁）

- **编译期门禁**：`npx tsc --noEmit`（退出码必须为 0）。
- **类型级测试门禁**：`npx vitest run __tests__/types/`（断言实际由 `tsc` 校验，vitest 仅确认 no-op 通过）。
- **运行期门禁**（如涉及）：`npx vitest run <相关路径>`。
- 任一步失败 → 回滚到上一步并报告失败原因，禁止带病继续。

### 第 6 步 · 契约稳定性声明

- 明确：本次修改是否为 **BREAKING** 变更？是否需 bump 版本？
- 列出其他同事拉取代码后是否需同步改动，避免 CI/CD 流水线全红阻塞发布。

---

## 三、五维度原理（为什么必须遵守）

| 契约步骤 | 对应维度 | 作用机理 |
|---|---|---|
| 第 0 步 不变式锚定 + 类型级测试 | ①扭转 AI 收益风险比 | 把类型安全变成可执行硬约束，AI 须主动规避 |
| 第 3 步 any/never/null 边界 | ②编译时 vs 运行时博弈 | 拒绝 any 退化，错误拦截在 IDE 红线与 tsc，而非运行时白屏 |
| 第 6 步 契约稳定性声明 | ③团队契约稳定性 | 标注 BREAKING，公共类型演进时同事拉代码不原地崩溃 |
| 第 1 步 影响范围清单 + 三色风险 | ④降低心智负担 | 把"几十文件跳转人工比对"丢给 AI，节省 ~70% 调错时间 |
| 第 2 步 泛型参数化 + 方差分析 | ⑤驾驭严苛项目 | 处理十几层泛型链路、never/unknown 边界，安全重构核心工具 |

---

## 四、类型级测试基线（项目既有资产）

本契约第 0/5 步引用的项目类型级测试资产：

- `tests/__tests__/types/user-type.spec.ts` — `UserType` 可赋值给 `BaseUser` + 无 null 字段
- `tests/__tests__/types/typeTestHelpers.ts` — 可复用 `Expect` / `Equals` / `NullKeys` / `assertNever` / `UndefinedKeys`

**为新类型补类型级测试的模板**：

```typescript
import { describe, it } from 'vitest'
import { expectType } from 'ts-expect'
import type { Expect, Equals, NullKeys } from '../typeTestHelpers'

// 纯类型级断言（由 tsc --noEmit 校验）
export const _assignable: Expect<SubType extends BaseType ? true : false> = true
export const _noNull: Expect<Equals<NullKeys<SubType>, never>> = true

describe('SubType 类型级单元测试', () => {
  it('SubType 必须可赋值给 BaseType', () => {
    expectType<BaseType>(sample as SubType)
  })
  it('SubType 不得包含 null 字段', () => {
    expectType<never>(null as unknown as NullKeys<SubType>)
  })
})
```

> 修改任何带类型级测试的类型时，追加约束："请确保修改不破坏 `<对应>.spec.ts` 中的类型测试（`tsc --noEmit` 必须通过）。"

---

## 五、万能 Prompt 模板（复制即用）

```
你是一位 TypeScript 类型系统专家。我将要求你修改一个类型定义。
在动手改任何代码前，严格按以下 6 步顺序执行，任一步不达标禁止进入下一步：
0. 不变式锚定：识别可赋值关系/可空性/方差，列出类型级测试为硬约束基线。
1. 影响范围扫描：全局搜索引用点，输出"文件:行号|引用方式|风险(🔴🟡🟢)|影响"表格，用户确认前禁改。
2. 变更方案：优先窄化扩展(A) > 泛型参数化(B) > 破坏性重构(C)，说明方差影响。
3. 边界守卫：禁 any(用 unknown+narrowing)，处理 never 分支，守住可空性不变式。
4. 原子执行：按 类型→store→builder→核心 分层，每条命令含路径+行号，可独立回滚。
5. 验证：tsc --noEmit 退出码 0 + 类型级测试 + 相关 vitest，失败即回滚。
6. 契约声明：是否 BREAKING？是否需 bump 版本？同事是否需同步改动？
输出：分步骤带标题，清单用表格，命令用代码块。禁止跳步。
```

---

## 六、验证命令速查

```powershell
# 编译期门禁（最关键，类型级断言在此校验）
npx tsc --noEmit

# 类型级测试
npx vitest run tests/__tests__/types/

# 相关单元测试
npx vitest run <相关路径>
```

> ⚠️ **关键机制**：类型级断言只由 `tsc --noEmit` 校验，vitest 运行期抓不到（esbuild 转译会剥离类型、不做类型检查）。本项目 `tsc` 校验链路 = `npm run tsc` 及 `predev`/`prebuild` 钩子。

---

## 七、红线清单（禁止事项）

- ❌ 用 `any` 掩盖类型错误（用 `unknown` + 守卫替代）。
- ❌ 跳过影响范围扫描直接改类型。
- ❌ 模糊的修改指令（如"在某个文件改一下"，必须含路径+行号）。
- ❌ 破坏既有类型级测试断言而不更新测试。
- ❌ 引入 `null` 字段而未声明可空性变更。
- ❌ 带病继续（验证失败须回滚，不得忽略）。

---

## 八、变更日志

### v1.0.0 (2026-07-02)
- 初始版本，基于"五维不可替代性"框架建立 6 步强制流程。
- 集成项目类型级测试基线（`__tests__/types/`）与万能 Prompt 模板。
- 定义 any/never/null 三类边界守卫与编译期双重验证门禁。
