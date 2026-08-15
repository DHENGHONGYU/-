---
title: code-review-guide
code_version: "2.0.0-rc.1"
tier: reference
status: active
version: v1.0.0
last_updated: 2026-08-13
doc_id: V9-DOC-HOW-904
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-21
  - version: v1.0.1
    changes: "文档新鲜度刷新：twBg/twText/twBorder 已废弃，确认令牌引用一致性"
    date: 2026-08-13
---


# 代码评审指南与质量门禁 SOP

> **版本**: v1.0.0 | **日期**: 2026-07-12
> **基于**: `AGENTS.md v1.4.5` 架构契约
> **适用范围**: 所有 PR / MR 代码评审,以及分支合并前的质量把控
> **维护者**: 资深开发工程师

---

## 一、评审流程 SOP

### 评审前(提交者自查)

提交者在发起 PR 前,**必须**完成以下自查,否则评审者有权直接 Request Changes:

```bash
# 1. 类型安全验证
npm run tsc:prod                          # 期望: 0 errors

# 2. 颜色令牌验证
npm run lint:colors                       # 期望: 0 violations

# 3. 架构分层验证
npm run audit:layers                      # 期望: 0 violations, 0 warnings

# 4. 原子组件边界验证
npm run audit:atomic                      # 期望: 0 violations, 0 warnings

# 5. 复杂度验证
npm run audit:complexity                  # 期望: 0 深层嵌套, 0 长链, 0 重复条件

# 6. JSDoc 验证(当前短板,重点关注)
npm run audit:jsdoc                       # 期望: 不新增缺失

# 7. 文档同步验证
npm run audit:docs                        # 期望: 0 violations

# 8. 单元测试
npm run test:clean                        # 期望: 全部通过
```

**PR 标题格式**: `[模块名] 简要描述 (#Issue编号)`
**PR 描述必须包含**: 变更摘要、影响范围、测试方式、是否涉及架构变更

### 评审中(评审者执行)

评审按 **L1 → L2 → L3** 顺序执行,前一层不通过则直接打回,不进入下一层:

```
L1 编码规范(5分钟)  →  不通过则 Request Changes
    ↓ 通过
L2 架构审查(10分钟)  →  不通过则 Request Changes
    ↓ 通过
L3 治理验证(3分钟)  →  不通过则 Request Changes
    ↓ 通过
Approve
```

### 评审后(合并前)

- 评审者确认所有 P0/P1 问题已修复
- 提交者确认 CI 全绿(12 道门禁 + 测试 + 构建)
- 涉及架构变更的 PR 需额外获得技术负责人 Approval

---

## 二、L1 编码规范 Checklist

> **目标**: 确保每一行代码类型安全、无硬编码、日志规范、资源清理
> **评审者**: 全体开发者(每人都能审)
> **预计耗时**: 5 分钟

### 2.1 类型安全 [P0 阻塞]

- [ ] **无 `any` 类型** — 搜索 `: any`、`as any`、`<any>`
  - 验证: `grep -rn ": any\|as any\|<any>" src/ --include="*.ts" --include="*.tsx"`
  - 例外: 无(ESLint 已设为 error)
- [ ] **无 `@ts-ignore`** — 使用 `@ts-expect-error` 并附注释说明原因
  - 验证: `grep -rn "@ts-ignore" src/ --include="*.ts" --include="*.tsx"`
- [ ] **所有数据结构先定义 Interface** — 不允许内联匿名类型作为函数参数
- [ ] **复杂泛型有类型测试** — 位于 `tests/__tests__/types/`,使用 `Expect<Equals>`
- [ ] **修改 `UserType` 不破坏 `user-type.spec.ts`**

### 2.2 零硬编码 [P0 阻塞]

- [ ] **引擎层阈值/权重/公式参数** — 从 `src/services/scoring/v6-engine/config.ts` 注入
- [ ] **UI 层颜色值** — 引用 `src/constants/theme.tokens.ts` 中的令牌
  - 禁止: `className="text-red-500"`、`style={{ color: '#22c55e' }}`
  - 正确: `className={THEME_TOKENS.color.info}`、`style={{ color: THEME_TOKENS.color.successRaw }}`
  - 验证: `npm run lint:colors` + `npm run audit:tokens`
- [ ] **组件层魔法数字** — 3 位以上数字提取为 const 或 config
  - 例外: `1000`(毫秒)、`100`(百分比)等约定俗成的可接受
- [ ] **路由路径/事件名/API 路径** — 集中至 `src/config/` 对应文件
  - 行情 URL: `src/config/marketDataEndpoints.ts`
  - API 路径/接口映射: `src/config/collectConfig.ts`

### 2.3 日志规范 [P1 需改]

- [ ] **核心分支有 `logger.info`** — filter reset、modal submission、data fusion 等关键操作
- [ ] **日志前缀格式** — `[模块名] 操作名`,如 `[DataBridge] routeToDB() completed`
- [ ] **错误日志包含 context** — `logger.error('操作失败', { error: message, ...context })`
  - 禁止: `console.log(error)`、`logger.error(error.message)`
- [ ] **无遗留 `console.log`** — 生产代码中不允许 console.log
  - 验证: `grep -rn "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`

### 2.4 事件监听清理 [P0 阻塞]

- [ ] **`useEffect` 中事件监听有 cleanup** — 显式移除
- [ ] **`EventBus.subscribe()` 配对 `unsubscribe()`** — 不允许遗漏
- [ ] **`vi.useFakeTimers()` 在 `afterEach` 中 `useRealTimers()`** — 测试隔离
- [ ] **禁止在 cleanup 中使用 `EventBus.clear()`** — 会影响其他订阅者

**标准清理模板**(评审时对照检查):

```typescript
// EventBus 订阅清理
useEffect(() => {
  const handler = (data: unknown) => { /* 处理逻辑 */ }
  EventBus.subscribe('eventName', handler)
  return () => EventBus.unsubscribe('eventName', handler)
}, [])

// 多个监听器批量清理
useEffect(() => {
  const cleanupFns: Array<() => void> = []
  cleanupFns.push(EventBus.subscribe('event1', handler1))
  cleanupFns.push(EventBus.subscribe('event2', handler2))
  return () => cleanupFns.forEach(fn => fn())
}, [])
```

### 2.5 JSDoc 完整性 [P1 需改]

> 当前项目 JSDoc 缺失 9 处,是唯一短板,评审时重点把关新增代码

- [ ] **新增公共函数有 JSDoc** — 参数、返回值、用途说明
- [ ] **新增组件有 JSDoc** — Props 说明、使用示例
- [ ] **新增 Hook 有 JSDoc** — 返回值结构、副作用说明
- [ ] **新增 Store 有 JSDoc** — 状态结构、action 用途
- [ ] **JSDoc 不含字面 `*/`** — 会提前闭合块注释致 tsc 级联报错
  - 验证: `npm run audit:jsdoc`

---

## 三、L2 架构审查 Checklist

> **目标**: 确保分层依赖正确、四步集成顺序、原子组件边界、依赖方向合规
> **评审者**: 模块负责人及以上
> **预计耗时**: 10 分钟

### 3.1 分层依赖 [P0 阻塞]

> 完整规则见 `../../../AGENTS.md` §一依赖方向规则

- [ ] **`pages/` 和 `components/` 只依赖 `store/` 和 `services/`**
  - 禁止: 直接调用 `dataLayer`、`db`、IndexedDB API
- [ ] **`store/` 只依赖 `services/` 和 `core/`**
  - 禁止: store 直接依赖 `data/`、`lib/`(除 withBroadcast)
- [ ] **`services/` 只依赖 `core/`、`data/` 和 `lib/`(白名单)**
  - lib 白名单: `logger`、`withBroadcast`、`eventBus`、`format`、`errors`、`utils`、`localStorageManager`、`safeCoerce`、`perf`、`precision`、`validation`
  - 禁止: service 直接写 `db`(必须通过 `DataBridge.forward()`)
  - 禁止: service 依赖 `lib/` 中的业务模块
- [ ] **`lib/` 只依赖 `core/` 和 `config/`**
  - 禁止: lib 依赖 `services/`、`store/`、`pages/`、`components/`
- [ ] **`core/` 不依赖任何上层**
  - 禁止: core 依赖 `pages/`、`components/`、`apps/`、`lib/`
- [ ] **`config/` 不依赖运行时模块**
  - 禁止: config 依赖 `services/`、`pages/`、`components/`、`lib/`
- [ ] **`constants/` 零运行时依赖** — 仅导出常量
- [ ] **`types/` 零依赖** — 纯类型定义

**验证命令**: `npm run audit:layers` — 期望 `0 violations, 0 warnings`

### 3.2 四步集成顺序 [P1 需改]

> 新模块严禁直接在 `pages/` 或 `components/` 下新建文件孤立运行

- [ ] **第 1 步:类型定义** — 在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface
- [ ] **第 2 步:Store/状态** — 在 `src/store/` 中创建 Zustand Store,通过 `withBroadcast` 实现跨 Tab 广播
- [ ] **第 3 步:Service 适配层** — 在 `src/services/` 中创建 Service,通过 DataBridge 写入数据
- [ ] **第 4 步:UI 集成** — 在 `src/pages/` 或 `src/components/` 中创建 UI,仅通过 Store 获取数据
- [ ] **每步可独立回滚** — 确认四步之间无循环依赖
- [ ] **完成后运行 `npx tsc --noEmit`** — 验证类型安全

### 3.3 原子组件边界 [P0 阻塞]

> 完整规则见 `audit:atomic` 脚本

- [ ] **atom 不引 store/service/molecule/organism/template**
  - atom 是最基础组件,零业务依赖
- [ ] **molecule 不引 organism/template/store/service**
  - molecule 可组合 atom,但不触碰业务状态
- [ ] **organism 不引 template/store/service**
  - organism 可组合 atom + molecule,通过 props 接收数据
- [ ] **template 不引 organism/store/service**
  - template 只负责布局组合
- [ ] **导入路径规范** — 走 `@/components/{atoms,molecules,organisms,templates}/...`
  - 禁止: 引用已删除的旧目录(toolkit/、src/utils/ 等)

**验证命令**: `npm run audit:atomic` — 期望 `0 violations, 0 warnings`

### 3.4 驾驶舱 Widget 三处注册 [P0 阻塞]

> 新增 Widget 必改三处,详见 `../reference/widget-integration-checklist.md`

- [ ] **自动化校验通过** — `npm run audit:widget-registry` 期望 P0=0, P1=0
  - 脚本自动校验：registry ↔ DEFAULT_WIDGET_CONFIG ↔ WIDGET_DEFAULT_DATA_SOURCE 三处 key 一致性
  - 脚本自动校验：组件文件存在性（`src/cockpit/widgets/XxxWidget.tsx`（占位示例，非实际文件））
  - 脚本自动校验：defaultLayout 默认布局覆盖性
- [ ] **第 1 处**: `src/cockpit/core/widgetRegistry.ts` — 注册 WidgetTemplate
- [ ] **第 2 处**: `src/constants/cockpit.constants.ts` — `DEFAULT_WIDGET_CONFIG` 添加配置
- [ ] **第 3 处**: `src/constants/cockpit.constants.ts` — `WIDGET_DEFAULT_DATA_SOURCE` 添加数据源
- [ ] **组件消费 `useMarketData()`** — 不直接调用 service(脚本不覆盖,人工检查)
- [ ] **颜色走令牌** — 不硬编码(脚本不覆盖,人工检查)

### 3.5 文件归位 [P1 需改]

- [ ] **新文件放在正确目录** — 参见 `../../../AGENTS.md` §一目录定义
- [ ] **相似目录不混淆** — `src/agents/`(运行时) vs `.agents/skills/`(AI技能);`src/lib/`(库函数) vs `src/lib/`(已废弃)
- [ ] **导入路径使用 `@/` 别名** — 不使用相对路径 `../../`
- [ ] **无旧路径残留** — 全文件类型扫描(详见 `../reference/ui-migration-checklist.md`)

---

## 四、L3 治理验证 Checklist

> **目标**: 确保门禁通过、复杂度达标、文档同步、AI 协同规范
> **评审者**: 技术负责人
> **预计耗时**: 3 分钟

### 4.1 门禁全绿 [P0 阻塞]

> Husky 预提交门禁共 10 项,详见 `.husky/pre-commit`

- [ ] `lint-staged` 通过 — ESLint 无 error
- [ ] `lint:colors` 通过 — 颜色令牌零违规
- [ ] `tsc:prod` 通过 — 类型安全零 error
- [ ] `audit:layers` 通过 — 跨层调用 0 违规
- [ ] `audit:atomic` 通过 — 原子边界 0 违规
- [ ] `audit:docs` 通过 — 文档同步 0 违规
- [ ] `verify:tokens` 通过 — 设计令牌验证通过
- [ ] `audit:tokens` 通过 — 令牌扫描通过
- [ ] `audit:jsdoc` 通过 — JSDoc 不新增缺失
- [ ] `audit:complexity` 通过 — 复杂度三维度归零
- [ ] `audit:widget-registry` 通过 — Widget 三处注册一致性(已接入 Husky pre-commit 第 12 道门禁，提交即拦截)

**pre-push 额外验证**:
- [ ] `test:clean` 通过 — 单元测试全绿
- [ ] `build` 通过 — 生产构建成功

### 4.2 复杂度治理 [P1 需改]

> 三类债务必须归零,清除手法见项目记忆

- [ ] **深层嵌套(≥4 层)** — 0 处
  - 手法: 卫语句提前返回、抽函数、三元表达式扁平化
- [ ] **长链式条件(≥6 分支)** — 0 处
  - 手法: 查表法(map/object 替代 switch)、策略模式
- [ ] **重复 if 条件** — 0 处
  - 四种清除手法:
    1. 抽具名 helper,把 `if` 收进唯一一处
    2. 卫语句一正一反使文本不同
    3. De Morgan 反转同义过滤
    4. 多处分支合并为回调 helper
  - 注意: 单纯抽共享变量 `if (cond)` 两处仍判重,必须把 `if` 收进唯一一处

**验证命令**: `npm run audit:complexity` — 期望 `0 深层嵌套 / 0 长链 / 0 重复条件`

### 4.3 文档同步 [P1 需改]

- [ ] **架构变更同步** — 修改 `../../../AGENTS.md` 后同步相关文档
- [ ] **触发→动作映射** — 新增模块时检查 `docs/meta/doc-trigger-action-map.md`
- [ ] **API 路径变更** — 更新 `../../explanation/06-routing-specs.md` 或相关数据字典
- [ ] **目录结构变更** — 更新 `../../../AGENTS.md` §一目录定义

**验证命令**: `npm run audit:docs` — 期望 `0 violations`

### 4.4 AI 协同规范 [P2 建议]

- [ ] **AI 生成代码加载提示词模板** — `prompts/` 目录下对应模板
- [ ] **迁移/Widget/记忆检索按 checklist 执行** — 逐项核对
- [ ] **AI 生成代码走审计飞轮** — 生成 → 审计 → 修正 → 再审计
- [ ] **门禁复测用系统 Node24 直驱 tsx** — `node ./node_modules/tsx/dist/cli.mjs scripts/xxx.ts`

---

## 五、实战案例:常见反例与正例

### 案例 1: `any` 类型滥用 [P0]

```typescript
// 反例: 用 any 绕过类型检查
function processData(data: any) {
  return data.map((item: any) => item.value)
}

// 正例: 定义 Interface
interface DataItem {
  value: number
  [key: string]: unknown
}
function processData(data: DataItem[]): number[] {
  return data.map(item => item.value)
}
```

### 案例 2: 颜色硬编码 [P0]

```tsx
// 反例: 直接写 Tailwind 颜色类
<span className="text-red-500 font-bold">+3.2%</span>
<div className="bg-amber-100 p-2">警告</div>

// 正例: 走令牌系统
import { COLOR_TOKENS, THEME_TOKENS } from '@/constants/theme.tokens'
<span className={`${COLOR_TOKENS.up.tailwind} font-bold`}>+3.2%</span>
<div className={`${THEME_TOKENS.color.warningBg} p-2`}>警告</div>
```

### 案例 3: EventBus 未清理 [P0]

```tsx
// 反例: 订阅后不清理,导致内存泄漏
useEffect(() => {
  EventBus.subscribe('market:update', handleUpdate)
  // 缺少 cleanup!
}, [])

// 正例: 配对 unsubscribe
useEffect(() => {
  const handler = (data: unknown) => { /* 处理逻辑 */ }
  EventBus.subscribe('market:update', handler)
  return () => EventBus.unsubscribe('market:update', handler)
}, [])
```

### 案例 4: 跨层调用 [P0]

```typescript
// 反例: service 直接写 db
// src/services/analysis/scoreService.ts
import { db } from '@/data/db'
export async function saveScore(score: Score) {
  await db.scores.put(score) // 禁止!service 不能直接写 db
}

// 正例: 通过 DataBridge 转发
import { DataBridge } from '@/core/DataBridge'
export async function saveScore(score: Score) {
  await DataBridge.forward('scores', 'put', score) // 通过 DataBridge 路由
}
```

### 案例 5: 重复 if 条件 [P1]

```typescript
// 反例: 两处相同的 if 条件被判重
function processA(data: Data) {
  if (data.type === 'stock') { /* 逻辑A */ }
}
function processB(data: Data) {
  if (data.type === 'stock') { /* 逻辑B */ } // 重复!
}

// 正例: 抽具名 helper,把 if 收进唯一一处
function isStockType(data: Data): boolean {
  return data.type === 'stock' // if 只在这一处
}
function processA(data: Data) {
  if (isStockType(data)) { /* 逻辑A */ }
}
function processB(data: Data) {
  if (isStockType(data)) { /* 逻辑B */ } // 文本不同,不判重
}
```

---

## 六、PR 评审模板

> 评审者可直接复制以下模板填写,保持评审反馈的结构化与一致性

```markdown
## 代码评审报告

**评审人**: @xxx
**评审时间**: YYYY-MM-DD
**PR**: #xxx

### 评审结论

- [ ] **通过** — 可合并
- [ ] **需修改** — 修复以下问题后重新提交
- [ ] **拒绝** — 存在严重架构问题,需重新设计

### L1 编码规范

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 类型安全(无 any) | ✅/❌ | |
| 零硬编码 | ✅/❌ | |
| 日志规范 | ✅/❌ | |
| 事件清理 | ✅/❌ | |
| JSDoc 完整 | ✅/❌ | |

### L2 架构审查

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 分层依赖正确 | ✅/❌ | |
| 四步集成顺序 | ✅/❌ | |
| 原子组件边界 | ✅/❌ | |
| Widget 三处注册 | ✅/❌/N/A | |
| 文件归位 | ✅/❌ | |

### L3 治理验证

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 门禁全绿 | ✅/❌ | |
| 复杂度达标 | ✅/❌ | |
| 文档同步 | ✅/❌ | |

### 问题清单

**P0(阻塞,必须修复)**:
1. `src/services/xxx.ts:42` — 使用了 `any` 类型,需定义 Interface
2. `src/components/xxx.tsx:18` — EventBus.subscribe 缺少 cleanup

**P1(需改,本次修复)**:
1. `src/services/xxx.ts:88` — 错误日志缺少 context 对象

**P2(建议,可后续迭代)**:
1. 建议将魔法数字 `86400` 提取为 `SECONDS_PER_DAY` 常量

### 亮点

- 类型定义清晰,Interface 命名规范
- EventBus 清理模板使用标准模式
- JSDoc 完整,包含使用示例
```

---

## 七、评审者能力矩阵

| 层级 | 角色 | 可评审范围 | 能力要求 |
|------|------|-----------|---------|
| L1 | 全体开发者 | L1 编码规范 | 熟悉 TypeScript、ESLint 规则、清理模板 |
| L2 | 模块负责人 | L1 + L2 架构审查 | 理解分层依赖设计意图、四步集成、原子设计 |
| L3 | 技术负责人 | L1 + L2 + L3 治理验证 | 掌握 12 道门禁、复杂度治理、文档自动化体系 |

### 评审配对规则

- **常规 PR**: 1 名 L1 评审者即可
- **涉及新模块**: 至少 1 名 L2 评审者
- **涉及架构变更**: 至少 1 名 L3 评审者 + 技术负责人 Approval
- **涉及 `../../../AGENTS.md` 修改**: 必须技术负责人 Approval

---

## 八、常见问题 FAQ

### Q1: 评审发现门禁已通过的代码仍有问题怎么办?

门禁是**底线**,不是**上限**。门禁通过只能保证不违反自动化规则,人工评审仍需把关:
- 命名是否清晰
- 逻辑是否正确
- 是否有更好的实现方式
- 是否符合业务意图

### Q2: 紧急修复(Hotfix)能否跳过评审?

**不能跳过评审,但可以简化流程**:
- L1 编码规范必须检查(5分钟)
- L2/L3 可在 Hotfix 合并后 24 小时内补审
- Hotfix PR 标题标注 `[HOTFIX]`,描述中说明紧急原因

### Q3: AI 生成的代码评审标准是否不同?

**标准完全相同**。AI 生成代码的额外要求:
- 必须加载对应提示词模板(`prompts/`)
- 走审计飞轮(生成 → 审计 → 修正 → 再审计)
- 架构治理型改动(迁移、重组、引用同步)需人工逐行确认
- 门禁复测用系统 Node24 直驱 tsx,不用 `npm run`(git-bash 下偶报错)

### Q4: 评审意见产生分歧怎么办?

1. 先以 `../../../AGENTS.md` 契约为准 — 它是唯一真相源
2. 契约未覆盖的,以技术负责人裁决为准
3. 重大分歧可发起架构评审会议(需 2 名以上 L3 评审者参与)

---

## 附录:验证命令速查

```bash
# L1 验证
npm run tsc:prod              # 类型安全
npm run lint:colors           # 颜色令牌
npm run lint                  # ESLint
npm run audit:jsdoc           # JSDoc 完整性

# L2 验证
npm run audit:layers          # 分层依赖
npm run audit:atomic          # 原子组件边界
npm run audit:widget-registry # Widget 三处注册一致性

# L3 验证
npm run audit:complexity      # 复杂度三维度
npm run audit:docs            # 文档同步
npm run verify:tokens         # 设计令牌
npm run audit:tokens          # 令牌扫描

# 全量验证
npm run audit                 # 所有 audit 脚本
npm run test:clean            # 单元测试
npm run build                 # 生产构建
```

---

> **维护说明**: 本文档基于 `../../AGENTS.md v1.4.5` 编写。当 `../../../AGENTS.md` 版本升级时,需同步修订本文档。任何评审规则的调整,需经技术负责人评审后更新。
