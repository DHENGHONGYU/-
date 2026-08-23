---
skill_id: V9-SKILL-TYPE-SAFETY-CONTRACT
name: "type-safety-contract"
description: "修改 TypeScript 类型前强制6步安全契约：不变式锚定→影响范围扫描→变更方案→边界守卫(any/never/null)→分层原子执行→tsc+类型级测试验证。Invoke when user asks to modify/refactor/rename a TypeScript interface, type, or generic, or before any type-definition edit, to prevent type-erosion and CI breakage；v9-tsc-test-error-diagnosis 报出测试文件类型错误批处理后需要回归验证、新增导出类型前、公共类型 BREAKING 变更前。"
version: v1.0.5
last_updated: 2026-08-23
change_log:
  - version: v1.0.5
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 5 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.4
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.3 / 正文 v1.0.2) → 取真值 max=1.0.3 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 3 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-11
mandatory: false
---

# TypeScript 类型安全修改硬契约 (Type-Safety Contract) — v1.0.5

> **版本**: v1.0.5 | **日期**: 2026-08-21 | **校验基准**: 项目 tsconfig.json strict 模式 + `__tests__/types/` 类型级测试基线 + v9-tsc-gate-scope-audit / v9-tsc-test-error-diagnosis 配套
> **性质**: 类型定义修改前/后的硬性约束；"悬在空中的类型安全"→可执行、可验证、AI 能主动规避的硬约束
> **输出格式**: 不变式清单 → 影响范围表格（三色风险）→ 变更方案 A/B/C 选型 → 边界守卫评估 → 分层原子命令 → 双重门禁报告 → 稳定性声明

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求修改 / 重构 / 重命名任何 TypeScript `interface`、`type`、泛型参数、函数签名；"放宽类型""加个字段""改个可选""合并类型""提取公共类型"等指令
- **显式触发 2**：怀疑存在 `any` 掩盖、`never` 分支被吞、条件类型推断错误导致大面积 `any` 退化、泛型十几层链路牵一发动全身、公共类型变更后同事拉代码原地崩溃
- **脚本/审计触发 3**：`npm run tsc:prod` / `v9-tsc-test-error-diagnosis` 报出契约漂移（Contract Drift）、严格空检暴露 strictNullChecks/noUncheckedIndexedAccess 违规、`vi.mock` 提升陷阱导致的 TS 报错批处理后需要回归验证；或 `npm run audit:skill-coverage` 报类型注册表漂移
- **脚本/审计触发 4**：任何涉及 `src/types/**`、`src/**/types.ts`、`*.d.ts`、`__tests__/types/**` 的改动触发；或 `npm run tsc:test` 报大面积类型错误
- **设计/协议触发 5**：AI 在代码修改过程中自主决定修改类型签名时（须先回到本契约第 0 步，禁止直接动手改）；新增导出类型前、公共类型 BREAKING 变更前；STORE_NAME/ENVELOPE_ACTION/ACL_MATRIX 等基础类型定义变更前（须联动 db-reference-audit + databridge-migration）

**不触发场景 · 减少误激活**：
- 纯运行时逻辑改动、不触碰类型签名的实现修改（单纯 refactor 算法/加字段赋值不改 interface）；
- `.md` / `.json` / `.yaml` 等非 TS 文件的类型无关修改。

**协作 Skill / 链式调用**：
- 生产类型门禁范围确认→`v9-tsc-gate-scope-audit`（确认本次修改是否被 tsconfig.prod.json 纳入，避免越权扫到测试）；
- 测试文件类型错误批处理→`v9-tsc-test-error-diagnosis`（覆盖契约漂移/严格空检/vi.mock 提升陷阱/未使用声明/脚本替换缺陷 5 类根因）；
- DB/Envelope 类型同步→`db-reference-audit`（若改 STORE_NAME/ENVELOPE_ACTION 相关类型，必须核对 Schema/Migration + ACL_MATRIX）；
- 数据桥写操作→`databridge-migration`（若改 payload 类型，必须四位置同步：定义 + Handler + Registry + ACTION_TO_STORE_MAP）；
- 模块变更十域同步→`v9-module-sync-checklist`（公共类型 BREAKING 变更时，类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆十域与代码同批落地）。

---

## 二、前置检查

> **铁律（类型安全红线 · 违反任一 = 破坏项目类型护城河）**：① **先扫后改，禁止跳步**：第 1 步影响范围扫描未完成且未经用户确认前，禁止修改任何一行类型代码；② **禁止用 `any` 掩盖错误**：确需放宽时用 `unknown` + narrowing，哪怕多写 10 行类型守卫；③ **每步可独立回滚**：分层原子执行（类型→store→builder→核心集成），每步单独验证 tsc，禁止一次性 20 文件连改失败后只能 `git checkout .`；④ **破坏类型级测试必须同步更新测试**：`__tests__/types/*.spec.ts` 的 `Expect/Equals/NullKeys/assertNever` 断言是硬约束基线，改了就必须同步保绿；⑤ **验证失败必须回滚，不得带病继续**：`tsc --noEmit` 非 0 = FAIL，不要"先提 PR，后面修"；⑥ **破坏性变更必须标注 BREAKING + bump 版本**：同事拉代码后原地崩溃 = 严重工程事故；⑦ **修改前必须保存不变式基线**：本次改动前类型级测试是否通过？赋值关系/可空性/方差是什么？不清零禁止动手。

| # | 检查项 | 命令 / 方法 | 通过标准 / 目的 |
|---|--------|-----------|----------------|
| 1 | 不变式基线保存（第 0 步前置） | 先跑：`npx tsc --noEmit`；`npx vitest run tests/__tests__/types/`；记录结果 | tsc 0 错误、类型级测试 PASS = 绿基线；若基线本身红，先修复基线再变更 |
| 2 | tsconfig 门禁范围确认 | 读 `tsconfig.json` + `tsconfig.prod.json`（如有）`include/exclude`；`npm run tsc:prod -- --listFiles \| Select-String '<目标类型文件>'` 或 读 scope 脚本逻辑 | 确认本次修改被生产门禁覆盖；未覆盖的话新增类型也要补齐覆盖 |
| 3 | 相关类型级测试资产扫描 | `ls tests/__tests__/types/`；Grep `Expect\|Equals\|NullKeys\|assertNever\|@ts-expect-error` 于 `tests/__tests__/types/` + 目标类型文件同目录 | 列出所有被本次类型影响的类型级断言；后续作为第 0 步"硬约束清单" |
| 4 | 引用范围预扫（快速版） | Grep 目标类型名（`interface X / type X / export type X`）于 `src/**/*.ts*`，输出大致引用文件数 | 心理预期：影响 < 10 文件 = 低风险；> 30 文件 = 高危，必须先向用户报告风险 |
| 5 | 项目 helper 类型库确认 | 读 `tests/__tests__/types/typeTestHelpers.ts`（如存在）：导出 Expect/Equals/NullKeys/UndefinedKeys/assertNever | 新写类型级测试时直接复用 helper，避免重复造轮子 |
| 6 | 变更前快照与残差记录 | `git status --short > outputs/type-contract-before.txt`；记录既有 tsc 错误列表（文件路径+错误码）；若有残差需列出 | 后续 FAIL 时可区分"本次新增"还是历史残差 |
| 7 | 工具链环境确认 | `node -v` 与 `.nvmrc` 一致；`npx tsc -v`（与 package.json devDependencies typescript 版本一致） | 避免"我的 tsc 过的，你的 tsc 挂了"的版本漂移问题 |

---

## 三、阶段化 SOP

严格按 7 个 Phase 顺序对应原契约的第 0-6 步执行，禁止跳 Phase。任何非末尾 Phase FAIL → 回滚到上一个 Phase 末尾状态重来，不得带病推进。

### **目标**：变更前后 `tsc --noEmit` + 类型级测试 + 相关 vitest 全绿；方差/可赋值方向/可空性不变式严格保持（或显式声明 BREAKING）。

### Phase 0 · 不变式锚定（Compile-time 契约基线，对应原第 0 步）

**交付物**: 不变式清单 + 硬约束基线声明

必须识别并列出本次涉及类型的三大不变式（缺一不可）：
1. **可赋值关系**：A extends B？还是双向？哪一方是协变，哪一方是逆变？
2. **可空性**：哪些字段目前"保证不含 `null | undefined`"？哪些是允许空的？
3. **方差**：协变（covariant）/ 逆变（contravariant）/ 双变（bivariant），特别注意函数参数/返回值的位置。

识别项目现有的**类型级测试**（`__tests__/types/*.spec.ts`、`*.d.ts` 中的 `Expect<...>` / `Equals<...>` / `@ts-expect-error` 断言），列为【硬约束基线】，声明：

> 修改后这些断言必须仍通过 `tsc --noEmit`。否则视为 BREAKING 或本次修改失败。

不变式清单必须经用户确认后才能进入 Phase 1。

### Phase 1 · 影响范围扫描（先扫后改，对应原第 1 步）

**交付物**: 「影响范围清单」表格（模板如下）

```
| 文件路径:行号 | 引用方式 | 风险等级(🔴高/🟡中/🟢低) | 兼容性影响 |
|---|---|---|---|
| src/types/user.ts:12 | 定义（修改点） | 🔴 | 所有派生类型起点 |
| src/store/userStore.ts:45 | extends 派生 | 🔴 | 赋值关系可能变化 |
| src/pages/profile.tsx:89 | 使用字段 user.name | 🟢 | 字段不变即零影响 |
```

全局搜索维度：`import`、派生类型（`extends`/`implements`）、泛型实参、函数签名入参/返回值、类型守卫、条件类型、mapped types。

**门禁**：用户确认清单前，禁止修改任何代码。

### Phase 2 · 变更方案（三选一，优先级递减，对应原第 2 步）

**交付物**: 方案选型说明 + 方差影响分析

必须从三方案中明确选一个，并给出选择理由：
- **方案 A · 窄化扩展（首选 · 向后兼容）**：仅新增可选字段或更宽的联合类型，旧调用方零改动；类型级测试基线 100% 通过。
- **方案 B · 泛型参数化**：把变动抽象为泛型参数，由调用方决定具体形态；保持默认实例向后兼容（`type Foo<T = Default>`）。
- **方案 C · 破坏性重构（仅当 A/B 均不可行）**：提供完整迁移路径 + codemod 思路 + 版本号策略（patch/minor/major）+ 同事通知计划。

**强制说明**：所选方案对**方差**的影响，以及是否改变可赋值方向（改变 = BREAKING）。

### Phase 3 · 边界守卫（守住 TS 护城河，对应原第 3 步）

**交付物**: 边界守卫评估表（4 红线全绿 = 通过）

| 边界红线 | 评估内容 | 通过标准 |
|---------|---------|---------|
| any 退化检查 | 全仓 Grep `: any`（生产代码，排除测试白名单） | 0 条新增 any；确需放宽用 `unknown` + narrowing |
| never 边界处理 | 条件类型 / `infer` 后的 `never` 分支 | 正确处理（不吞合法分支，不漏 exhaustive check） |
| 可空性不变式 | 修改是否破坏"无 null 字段"既定不变式 | 如未破坏 = 过；如破坏 → 必须同步更新类型级测试可空断言 + 声明 BREAKING |
| any 退化扩散 | 修改后是否导致下游推断大面积退化为 any | Grep 关键调用点检查推断类型；不得出现"原本是具体类型现在是 any" |

### Phase 4 · 原子执行（分层顺序，对应原第 4 步）

**交付物**: 分层原子命令清单（每步含 path:line + 预期 tsc 输出）

按「**类型定义 → store/状态 → builder/适配层 → 核心集成**」分层顺序（与项目"四步集成编码契约"对齐），每步一条可执行命令/修改说明，必须：
1. 每条含**具体文件路径与行号**，禁止模糊表述（如"改一下某个类型文件"）；
2. 每步标注预期 `npx tsc --noEmit` 输出（应为：无新增错误 / 仅有某已知残差）；
3. 每步可独立回滚（失败时只需撤销该步，不影响前面步骤）。

**每步执行后立即跑 tsc**，失败 → 回滚该步 + 报告失败原因，禁止继续。

### Phase 5 · 验证（双重门禁 + 可选运行期，对应原第 5 步）

**交付物**: 三重验证报告（全部 PASS 才通过）

```powershell
# ① 编译期门禁（最关键 · 类型级断言在此校验）
npx tsc --noEmit

# ② 类型级测试门禁（vitest 仅确认 no-op 通过，实际断言由 ① 校验）
npx vitest run tests/__tests__/types/

# ③ 运行期门禁（如本次修改涉及实现层）
npx vitest run <相关路径>
```

> ⚠️ **关键机制**：类型级断言（Expect/Equals/@ts-expect-error）只由 `tsc --noEmit` 校验，vitest 运行期抓不到（esbuild 转译会剥离类型、不做类型检查）。因此①永远是最高权重，哪怕 vitest 全绿。

判定规则：任一步 FAIL → 回滚到 Phase 4 上一步，并报告失败原因。禁止"类型测试红着先提 PR，后面修"。

### Phase 6 · 契约稳定性声明（对应原第 6 步）

**交付物**: 稳定性声明（模板如下）

```
## 契约稳定性声明
本次修改：
- 是否为 BREAKING 变更？ □ 否（A 方案）  □ 否（B 方案）  □ 是（C 方案 · 见 §三 Phase 2 变更路径）
- 是否需 bump 版本号？ □ 不需要（向后兼容）  □ patch  □ minor  □ major
- 其他同事是否需同步改动？ □ 否（调用方零改动）  □ 是（清单：[路径:行号, ...]）
- CI 拉代码后是否会阻塞发布？ □ 否（tsc:prod 全绿）  □ 是（需同事配合 A/B 两端同步提交）
```

---

## 四、陷阱与经验教训

| # | 陷阱 / 反模式 | 后果 | 规避方法 |
|---|-------------|------|---------|
| 1 | 跳过影响范围扫描直接改类型 | 20+ 下游文件连锁报错，定位源头耗时数小时；回滚困难 | Phase 1 强制 Grep 全引用；清单未经用户确认禁改代码 |
| 2 | 用 `any` 掩盖类型错误（最常见） | 编译期报错消失但运行时白屏；类型安全名存实亡 | Phase 3 边界守卫 any 红线；强制 `unknown` + narrowing 替代；Grep 新增 `: any` 数必须 = 0 |
| 3 | 一次性 20+ 文件连改，失败全回退 | 定位失败源头几乎不可能；`git checkout .` 浪费前序几小时工作 | Phase 4 分层原子执行，每步单独 tsc；确保每步可独立回滚 |
| 4 | 破坏类型级测试而不更新测试 | 不变式被静默破坏，后续改动再踩时才发现，追根溯源困难 | Phase 0 必须列出所有类型级断言为硬约束；Phase 5 ① tsc 是终极门禁 |
| 5 | 条件类型 `infer` 后 `never` 分支被吞 | 合法路径被 exhaustive check 漏掉，出现运行时未定义 | Phase 3 never 边界检查；测试中覆盖 `assertNever` 场景 |
| 6 | 未声明 BREAKING + 不 bump 版本 | 同事拉代码后 CI/CD 流水线全红，阻塞发布半天以上；工程事故级 | Phase 6 强制三问：是否 BREAKING？bump？同步改动？公共类型必须严格执行 |
| 7 | 公共类型 `null` 字段悄悄放宽，不变式被破坏 | 下游假设"该字段永不为 null"，运行时 null 引用崩溃 | Phase 3 可空性不变式；若放宽必须同步更新 NullKeys 等类型级测试 + 声明 BREAKING |
| 8 | 改完只跑 vitest，不跑 `tsc --noEmit` | 类型级断言全由 tsc 校验，vitest 转译时剥离类型完全看不到；"绿测试红类型"骗过自己 | Phase 5 顺序 = ① tsc → ② 类型测试 → ③ 运行测试；① 是不可替代的第一门禁 |

---

## 五、完成交付物清单

| # | 交付物 | 对应 Phase / 来源 | 验证方法 |
|---|--------|------------------|---------|
| 1 | 不变式清单（可赋值/可空性/方差）+ 硬约束基线声明 | Phase 0 | 三大不变式 3/3 明确列出；所有类型级测试文件已登记为硬约束 |
| 2 | 影响范围扫描清单（文件:行号 | 引用 | 三色风险 | 兼容性） | Phase 1 | 所有引用点全覆盖；清单已由用户确认（对话记录可回溯） |
| 3 | 变更方案选型说明（A/B/C 三选一）+ 方差影响分析 | Phase 2 | 方案选择理由充分；方差影响与赋值方向变化已声明 |
| 4 | 边界守卫评估表（any/never/可空/退化扩散 4 红线） | Phase 3 | 4/4 红线全绿；0 新增生产代码 any；never 分支全覆盖；可空性不变式保持或显式声明 BREAKING |
| 5 | 分层原子命令清单（类型→store→builder→核心）+ 每步 tsc 预期 | Phase 4 | 每条命令含 path:line；每步单独 tsc 无新增错误；每步可独立回滚 |
| 6 | `npx tsc --noEmit` 编译期报告（最核心） | Phase 5-① | exit 0；0 新增错误（仅允许既有历史残差，且与基线对比一致） |
| 7 | 类型级测试 PASS 报告 | Phase 5-② | `vitest run tests/__tests__/types/` 全绿；测试覆盖率≥修改前 |
| 8 | 相关运行期 vitest PASS 报告（若涉及） | Phase 5-③ | 相关单元测试全绿；功能无回归 |
| 9 | 契约稳定性声明（BREAKING/版本 bump/同事同步/CI 阻塞四问） | Phase 6 | 四项结论全部填写；公共类型 BREAKING 必须附带通知计划 + codemod |
| 10 | 修改前 → 修改后 git diff + 类型级测试 diff | 前置检查 6 + 所有 Phase | `git diff --stat` 变更范围符合预期；类型测试未出现"删除断言保绿"作弊 |
| 11 | tsconfig 生产门禁覆盖确认 + scope 审计报告 | 前置检查 2 + v9-tsc-gate-scope-audit 协同 | 本次修改文件全在 tsconfig.prod.json include 内，未被意外漏掉 |
| 12 | DB/Envelope 引用一致性报告（若涉及 STORE_NAME/ENVELOPE_ACTION 类型） | db-reference-audit 协同 | 定义 + Schema + Migration + ACL_MATRIX 四端无漂移 |
| 13 | DataBridge 四位置同步报告（若改 payload 类型） | databridge-migration 协同 | 定义 + Handler + Registry + ACTION_TO_STORE_MAP 4/4 对齐 |
| 14 | 十域同步校对结论（公共类型 BREAKING 时必跑） | v9-module-sync-checklist 协同 | 类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆十域与代码同批落地 |

**必要且充分条件**：
- 必要条件：① 1-3（契约基础件齐全）+ ② 4-5（边界+执行合规）+ ③ 6-7（tsc + 类型级测试双门禁 PASS，**此二条为硬必要，缺任何一条 = FAIL**）+ ④ 9（稳定性声明四问已答）；
- 充分条件：1-14 项全交付 + 与变更前基线对比"无新增 any/无新增类型级测试删除/无下游 any 退化扩散/无 BREAKING 未声明"。

> 若交付物 6（tsc --noEmit）非 0 或交付物 7（类型级测试）FAIL → 禁止声称"类型修改完成"，无论其他交付物是否齐全。

### 附录：为新类型追加类型级测试的模板（复用项目 helper）

```typescript
import { describe, it } from 'vitest'
import { expectType } from 'ts-expect'
import type { Expect, Equals, NullKeys } from '../typeTestHelpers'

// 纯类型级断言（由 tsc --noEmit 校验，vitest 不做实际检查）
export const _assignable: Expect<SubType extends BaseType ? true : false> = true
export const _noNull: Expect<Equals<NullKeys<SubType>, never>> = true

describe('SubType 类型级单元测试', () => {
  it('SubType 必须可赋值给 BaseType（协变方向）', () => {
    expectType<BaseType>(sample as SubType)
  })
  it('SubType 不得包含 null 字段（可空性不变式）', () => {
    expectType<never>(null as unknown as NullKeys<SubType>)
  })
})
```

> 修改任何带类型级测试的类型时，追加约束提示："请确保修改不破坏 `<对应>.spec.ts` 中的类型测试（`tsc --noEmit` 必须通过）。"
