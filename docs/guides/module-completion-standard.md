---
title: 模块完成标准（DoD）
type: guide
domain: project
phase: development
status: active
maintainer: Architecture Team
summary: "本文档定义 V9 项目中功能模块的完成标准（Definition of Done），包括模块完成六要素、孤岛模块检测方法和模块验收流程，解决模块孤岛化开发问题，确保每个模块都能被用户发现和使用。"
tags: [module, dod, completion-standard, governance, quality-gate]
version: v1.0.0
last_updated: 2026-07-25
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-GUIDE-022
tier: T1
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-25
---

# 模块完成标准（Definition of Done）

> **文档定位**：V9 项目功能模块的完成定义与验收标准
> **适用对象**：全体开发人员、产品经理、测试人员、架构师
> **核心目标**：解决"模块孤岛化开发"问题，杜绝"代码写完但用户用不了"的半成品模块
> **配套文档**：
> - `docs/guides/team-handbook/06-team-operation-guide.md` — 团队开发操作指南
> - `docs/reference/09-quality-gates_reference.md` — 质量门禁
> - `docs/guides/component-admission-policy.md` — 组件新增准入政策

---

## 目录

1. [什么是"功能模块完成"](#一什么是功能模块完成)
2. [模块完成 6 要素（DoD Checklist）](#二模块完成-6-要素dod-checklist)
3. [孤岛模块检测方法](#三孤岛模块检测方法)
4. [模块验收流程](#四模块验收流程)
5. [常见问题与答疑](#五常见问题与答疑)

---

## 一、什么是"功能模块完成"

### 1.1 完成的定义

**完成 = 代码写完 + 测试通过 + 有入口 + 可被用户发现和使用**

一个功能模块只有同时满足以下条件，才算真正"完成"：

| 维度 | 说明 | 反面示例 |
|------|------|----------|
| **代码写完** | 核心功能代码实现完整，无 TODO 占位符 | "这部分先空着，以后再补" |
| **测试通过** | 单元测试 + 集成测试通过，核心路径有覆盖 | "功能跑通了，测试后面再补" |
| **有入口** | 用户能通过路由/菜单/按钮等方式进入模块 | "代码在那，但用户不知道怎么进" |
| **可被发现** | 有文档说明、有功能介绍、用户能理解怎么用 | "功能做了，但没人知道有这个功能" |

### 1.2 半成品的定义

**半成品 = 未完成，不能标记为 done**

以下情况均属于半成品，**不得**在迭代计划中标注"已完成"：

1. **有代码无入口**：Store/Service/UI 都写了，但没有路由注册，用户找不到
2. **有入口无文档**：功能能进，但没有使用说明，用户不知道怎么用
3. **有功能无测试**：功能看起来能用，但没有测试保障，质量不可控
4. **有 UI 无状态**：页面画好了，但没有真正的状态管理和数据持久化
5. **有局部无整体**：子功能做了几个，但主流程走不通

> **经验教训**：「框架与业务必须同步落地」——不要建空壳框架，业务要跟上。
> 来源：`docs/lessons/process/lessons-architecture-review-2026-07-16.md`

### 1.3 为什么需要模块 DoD

| 问题 | 根因 | DoD 解决方式 |
|------|------|-------------|
| 模块做了但用户用不了 | 只有代码没有入口 | 入口层强制检查 |
| 功能上线后没人用 | 没有文档和引导 | 文档层强制检查 |
| 模块之间互相孤立 | 各自为政，缺少全局视角 | 6 要素统一验收 |
| 技术债务越积越多 | 半成品不断叠加 | 不达标不能合入 |
| 迭代进度虚报 | 半成品也算完成 | 统一完成标准 |

---

## 二、模块完成 6 要素（DoD Checklist）

> **新模块开发完成后，必须满足以下 6 个要素，方可标记为"已完成"并合入主分支。**

### 2.1 类型层：类型定义完整

**标准**：模块涉及的所有数据类型都有明确定义，存放在 `types/modules/` 下。

**检查项**：
- [ ] 模块核心数据结构有 `interface` 或 `type` 定义
- [ ] 类型定义存放在 `src/types/modules/{moduleName}.types.ts`
- [ ] 枚举值、常量、动作类型有明确类型
- [ ] API 请求/响应格式有类型定义
- [ ] 类型导出方式符合项目规范（从 types/ 统一导出）

**示例结构**：
```typescript
// src/types/modules/pool.types.ts
export interface PoolItem {
  id: string;
  name: string;
  stocks: string[];
  createdAt: number;
  updatedAt: number;
}

export type PoolAction = 'add' | 'remove' | 'rename';
export type PoolStatus = 'active' | 'archived';
```

**验证命令**：
```bash
npm run typecheck   # 类型检查 0 errors
```

---

### 2.2 服务层：业务逻辑封装完整

**标准**：模块的业务逻辑封装在 Service 层，经 DataBridge 访问数据。

**检查项**：
- [ ] 业务逻辑封装在 `src/services/{moduleName}/` 下
- [ ] 写操作全部走 DataBridge 信封协议（`dataBridge.forward`）
- [ ] 读操作通过 `dataBridge.query` 或 Store 获取
- [ ] Service 不直接操作 DOM，不依赖 React
- [ ] 有错误处理和降级逻辑
- [ ] 关键业务操作有日志记录

**示例结构**：
```typescript
// src/services/pool/poolService.ts
export const poolService = {
  async createPool(name: string): Promise<PoolItem> {
    const envelope = EnvelopeFactory.create({
      source: 'poolService',
      target: 'pool',
      action: 'create',
      payload: { name },
    });
    await dataBridge.forward(envelope);
    // ...
  },
};
```

**验证命令**：
```bash
npm run audit:layers   # 分层检查 0 violations
```

---

### 2.3 状态层：Store 实现完整

**标准**：模块状态通过 Zustand Store 管理，有初始化/重置/广播能力。

**检查项**：
- [ ] Store 定义在 `src/store/use{ModuleName}Store.ts`
- [ ] 使用 `withBroadcast` 中间件，支持跨标签页同步
- [ ] 有完整的状态结构（数据 + loading + error）
- [ ] 有初始化方法（`init` / `fetch`）
- [ ] 有重置方法（`reset` / `clear`）
- [ ] Store action 有 JSDoc 注释
- [ ] Store 有单元测试覆盖

**示例结构**：
```typescript
// src/store/usePoolStore.ts
export const usePoolStore = create<PoolState>()(
  withBroadcast(
    (set, get) => ({
      pools: [],
      loading: false,
      error: null,
      fetchPools: async () => { /* ... */ },
      addPool: async (name) => { /* ... */ },
      reset: () => set({ pools: [], loading: false, error: null }),
    }),
    { name: 'pool' }
  )
);
```

**验证命令**：
```bash
npm test -- --run src/store/usePoolStore.test.ts   # Store 测试通过
```

---

### 2.4 UI 层：页面或组件实现完整

**标准**：模块的用户界面实现完整，可正常交互和展示。

**检查项**：
- [ ] 页面组件存放在 `src/pages/{moduleName}/`
- [ ] 复用组件存放在 `src/components/{level}/`
- [ ] UI 组件只经 Store 取数，不直连 dataLayer
- [ ] 有 loading / empty / error 三态处理
- [ ] 颜色使用设计令牌，无硬编码
- [ ] 核心交互有单元测试或集成测试
- [ ] 响应式布局适配主要屏幕尺寸

**验证命令**：
```bash
npm run lint:colors     # 颜色硬编码检查
npm run audit:atomic    # 组件分层检查
npm test -- --run src/pages/MyPage.test.tsx  # UI 测试
```

---

### 2.5 入口层：有明确的访问入口

**标准**：用户可以通过某种方式发现并进入该模块。

**检查项**：
- [ ] 在路由表 `src/router/routes.ts`（已重构，不再存在） 中注册了路由
  - 或者：有明确的调用入口（如其他页面的按钮/链接）
- [ ] 路由路径命名规范，与模块名一致
- [ ] 如果是菜单项，已在导航配置中登记
- [ ] 入口可从首页或主导航到达（不超过 3 次点击）
- [ ] 路由有对应的页面组件，非空壳

**验证命令**：
```bash
npm run audit:routes    # 路由一致性检查 0 漂移
```

**路由注册示例**：
```typescript
// src/router/routes.ts（已重构，不再存在）
export const routes = [
  {
    path: '/pool',
    element: <PoolPage />,
    meta: { title: '股票池', icon: 'pool' },
  },
];
```

---

### 2.6 文档层：有功能说明和使用指南

**标准**：模块有配套的功能文档，用户和开发者都能理解其用途和用法。

**检查项**：
- [ ] 有功能说明文档（面向用户）
  - 位置：`docs/reference/{moduleName}-contract.md` 或对应目录
  - 内容：功能介绍、使用场景、操作说明
- [ ] 有技术文档（面向开发者）
  - 位置：`docs/explanation/design/` 或 `docs/reference/`
  - 内容：架构设计、数据结构、API 说明
- [ ] 模块在功能清单 `feature-entry-list.md` 中有登记
- [ ] 代码中有完整的 JSDoc 注释

**文档层级要求**：

| 模块类型 | 用户文档 | 技术文档 | 功能清单登记 |
|----------|---------|---------|-------------|
| 核心业务模块 | 必须 | 必须 | 必须 |
| 支撑功能模块 | 建议 | 必须 | 必须 |
| 基础设施模块 | 不需要 | 必须 | 建议 |

---

## 三、孤岛模块检测方法

> **孤岛模块**：有代码实现但没有入口、用户无法访问的模块。
> 定期检测孤岛模块，防止模块越做越多但用户可用功能没增长。

### 3.1 自动化检测

#### 方法一：`audit:deadcode` 死代码审计

```bash
npm run audit:deadcode
```

**检测内容**：
- 未注册的页面组件
- 未被引用的 Store / Service
- 未使用的工具函数

**判断孤岛模块的标准**：
- 页面组件存在但 `routes.ts` 中无注册 → 孤岛
- Store + Service + UI 三件套齐全但无路由 → 孤岛
- 文件存在超过 2 个迭代但无任何引用 → 孤岛

#### 方法二：路由一致性审计

```bash
npm run audit:routes
```

**检测内容**：
- 孤儿路由（有路由无页面）
- 未注册页面（有页面无路由）
- 路径不匹配

#### 方法三：moduleManifest 检查

如果项目使用 `moduleManifest` 管理模块清单：

```bash
# 检查 active 状态的模块是否都有路由入口
grep -r "active" src/constants/moduleManifest.ts
```

**检测逻辑**：
1. 遍历 `moduleManifest` 中所有 `status: 'active'` 的模块
2. 检查每个模块是否在 `routes.ts` 中有对应路由
3. 没有路由的 → 标记为孤岛模块候选

### 3.2 人工检测清单

除了自动化检测，以下情况也可能是孤岛模块，需要人工排查：

- [ ] 模块有完整实现，但在产品需求文档中找不到对应功能
- [ ] 模块有路由入口，但导航菜单中没有，用户不知道怎么进
- [ ] 模块功能完整，但没有任何测试用例
- [ ] 模块创建超过 3 个月，但没有任何修改记录
- [ ] 模块的 Store / Service 没有任何其他模块引用

### 3.3 检测周期与责任人

| 检测方式 | 周期 | 责任人 | 输出 |
|----------|------|--------|------|
| `audit:deadcode` | 每次 CI 运行 | 自动化 | CI 报告 |
| `audit:routes` | 每次 CI 运行 | 自动化 | CI 报告 |
| 全面孤岛模块扫描 | 每个迭代末 | 架构组 | 孤岛模块清单 |
| 人工排查 | 每季度 | 各模块负责人 | 模块状态更新 |

### 3.4 孤岛模块处理流程

```
发现孤岛模块 → 确认是否还有价值 → 
  ├─ 有价值 → 补入口 + 补文档 → 转为正常模块
  ├─ 待定 → 标记为 WIP → 限期 1 个迭代补齐
  └─ 无价值 → 标记 deprecated → 1 个迭代后删除
```

**处理原则**：
1. **能补则补**：如果模块功能有价值，优先补齐入口和文档
2. **限时整改**：给 WIP 状态设明确期限，超期自动降级
3. **及时清理**：确认无用的模块及时删除，避免技术债务累积

---

## 四、模块验收流程

### 4.1 验收总流程

```
开发完成 → 开发者自测 → 提交 PR → DoD 检查 → Code Review → 合入 → 验证上线
```

### 4.2 各阶段详细说明

#### 阶段 1：开发完成 + 自测

开发者完成功能开发后，对照 DoD 6 要素进行自查：

- [ ] 类型层：类型定义完整，`typecheck` 通过
- [ ] 服务层：Service 封装完整，`audit:layers` 通过
- [ ] 状态层：Store 实现完整，有初始化/重置/广播
- [ ] UI 层：页面/组件实现完整，有三态处理
- [ ] 入口层：路由已注册，`audit:routes` 通过
- [ ] 文档层：功能文档已编写

**自测命令清单**：
```bash
npm run typecheck       # 类型检查
npm run lint            # 代码规范
npm run audit:layers    # 分层审计
npm run audit:routes    # 路由一致性
npm test -- --run       # 单元测试
npm run build           # 生产构建
```

#### 阶段 2：提交 PR + DoD 自查

在 PR 描述中填写"模块 DoD 自查"section（见 PR 模板）：

- 勾选已完成的 DoD 检查项
- 说明未完成项的原因和计划
- 附上功能截图或录屏

#### 阶段 3：DoD 检查 + Code Review

**审查者需确认**：
1. DoD 6 要素全部达标（或未达标项有合理解释）
2. 代码质量符合规范
3. 测试覆盖达标
4. 文档同步更新

**审查分工**：
- **功能正确性**：产品经理 / 测试人员
- **代码质量 + 架构合规**：资深开发 / 架构组
- **文档完整性**：技术文档负责人

#### 阶段 4：合入 + 验证

- 所有检查通过后合入主分支
- 合入后在开发环境验证功能可用
- 确认入口可访问、功能正常流转

### 4.3 PR 模板中的模块 DoD section

PR 模板中增加"模块新增专项检查"section（仅新增模块时勾选）：

```markdown
### 模块新增专项检查（仅新增模块时勾选）
- [ ] 新模块已有路由入口（routes.ts 中注册）
- [ ] 新模块在 moduleManifest 中登记
- [ ] 新模块 6 要素齐全（类型/服务/状态/UI/入口/文档）
```

详细内容见 `.github/pull_request_template.md`。

### 4.4 特殊情况处理

#### 情况 1：模块太大，一个迭代做不完

**处理方式**：
- 拆分为多个子模块，每个子模块独立满足 DoD
- 或者：使用 Feature Flag 控制，主入口隐藏，子功能逐个上线
- 不允许：半成品模块直接合入主分支并暴露给用户

#### 情况 2：纯技术模块，没有 UI

**处理方式**：
- UI 层检查项可豁免
- 但必须有：完整的类型定义 + Service/SDK + 文档 + 测试
- 必须有明确的调用方（消费方先行原则）

#### 情况 3：重构旧模块

**处理方式**：
- 按 DoD 标准检查重构后的模块
- 如果旧模块本身不满足 DoD，重构时一并补齐
- 不能以"重构"为由降低标准

---

## 五、常见问题与答疑

### Q1：模块很小（比如只有一个简单页面），也要满足 6 要素吗？

**A**：是的，但可以简化。小模块的类型定义可能只有几个 interface，文档可能只有一段说明，但不能为零。核心是**有**，而不是**多**。

### Q2：入口层必须是路由吗？能不能是其他模块里的一个按钮？

**A**：可以。只要用户能通过合理的路径发现并进入该功能，就满足入口层要求。但必须有明确的入口，不能是"只有开发者知道 URL"的隐藏功能。

### Q3：文档层一定要写正式文档吗？代码注释行不行？

**A**：视模块重要性而定。核心业务模块必须有独立文档；小型工具模块可以用 JSDoc + README 代替。但完全没有文档是不允许的。

### Q4：如果模块做到一半需求变了，怎么办？

**A**：已完成的部分如果能独立使用，按 DoD 标准验收后合入；如果不能独立使用，要么在分支上继续等，要么删除已写的代码（不要合入半成品）。

### Q5：DoD 和质量门禁是什么关系？

**A**：质量门禁（`audit:layers` / `audit:hardcode` 等）是**技术层面的底线要求**，DoD 是**产品层面的完成标准**。DoD 包含质量门禁，但范围更广——除了技术质量，还包括可用性、可发现性、文档完整性。

---

> **维护说明**：本标准由架构组和产品组共同维护，随项目迭代持续更新。如有疑问或建议，请提交 Issue 或联系架构组。
