---
title: 组件新增准入政策
type: guide
domain: frontend
phase: development
status: active
maintainer: Architecture Team
summary: "本文档规定 V9 项目中新增 UI 组件的准入门槛、审批流程和 WIP 管理机制，解决设计系统前瞻性储备缺乏准入门槛的问题，确保每一个新增组件都有明确的消费场景和业务价值。"
tags: [component, governance, admission, policy, atomic-design]
version: v1.0.0
last_updated: 2026-07-25
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-GUIDE-021
tier: T1
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-25
---

# 组件新增准入政策

> **文档定位**：V9 设计系统的组件准入门槛与治理规范
> **适用对象**：全体前端开发人员、UI 设计师、架构师
> **核心目标**：解决"设计系统前瞻性储备缺乏准入门槛"问题，杜绝无消费场景的"僵尸组件"
> **配套文档**：
> - `docs/guides/team-handbook/03-ui-components.md` — UI 组件设计思路
> - `docs/reference/atomic-component-system.md` — 原子设计体系
> - `../archive/historical-2026-08-16/batch7/docs/explanation/component-deprecation-policy.md（已归档）` — 组件废弃政策

---

## 目录

1. [准入原则](#一准入原则)
2. [新组件准入 Checklist](#二新组件准入-checklistpr-合并前必须完成)
3. [WIP 组件管理](#三wip-组件管理)
4. [前瞻性储备申请流程](#四前瞻性储备申请流程)
5. [违规处理与监督机制](#五违规处理与监督机制)

---

## 一、准入原则

### 1.1 消费方先行原则

**先有明确的消费场景，再创建组件。**

- 组件必须由**实际业务需求**驱动，而非"可能会用到"的预判
- 禁止为了"设计系统完整性"而创建没有消费方的组件
- 至少有一个页面或上层组件明确需要使用该组件，方可立项开发

> **反面教材**："我觉得将来可能需要一个 Table 组件，先做出来放着" —— 禁止。
> **正确姿势**："股票池页面需要一个可排序、可多选的表格，抽成 Table 组件复用" —— 允许。

### 1.2 最小可用原则

**不做前瞻性储备，只做当前迭代需要的组件。**

- 组件功能范围严格限定在当前迭代的实际需求内
- 不提前实现"将来可能需要"的 props、variant 或能力
- 预留扩展空间即可，功能随消费方增长逐步迭代

| 做法 | 正确 / 错误 | 说明 |
|------|-------------|------|
| 只实现当前页面用到的 3 个 props | ✅ 正确 | 最小可用 |
| 参考 Ant Design 把 20 个 props 全做了 | ❌ 错误 | 过度设计 |
| 预留扩展点（如 children / className） | ✅ 正确 | 预留空间 |
| 做 5 种 variant 但只有 1 种在用 | ❌ 错误 | 前瞻性冗余 |

### 1.3 分层归属原则

**明确原子/分子/有机体/模板分层，不跨层越界。**

新增组件必须准确归入以下层级之一，由 `audit:atomic` 强制校验：

| 层级 | 组成 | 禁止 import | 典型组件 |
|------|------|-------------|----------|
| **Atom** | Tailwind / Tokens | Store/Service/Molecule/Organism/业务 | Button, Input, Card, Badge |
| **Molecule** | Atom | Organism/Store/Service/业务 | FormField, MetricCard, Alert, Dialog |
| **Organism** | 任意层级（含 Store/Service/Hook） | — | PoolBoard, CollectionProgress, ScoreRadar |
| **Template** | Molecule + Atom | 业务数据 / Store / Service | PageContainer, DashboardLayout |

**判断方法**：
1. 组件是否依赖 Store/Service？→ Organism
2. 组件是否只依赖其他原子组件？→ Molecule
3. 组件是否不含任何子组件、纯样式封装？→ Atom
4. 组件是页面布局骨架、无业务逻辑？→ Template

---

## 二、新组件准入 Checklist（PR 合并前必须完成）

> **所有新增组件的 PR 必须通过以下全部检查项，方可合并。**
> **审查者**：前端负责人 / 架构组

### 2.1 业务需求验证

- [ ] 有明确的业务需求或设计稿支撑（附需求链接或设计稿截图）
- [ ] 需求来自当前迭代的实际业务场景，非前瞻性储备
- [ ] 组件的功能范围与需求严格对应，无额外的"预留功能"

### 2.2 注册与登记

- [ ] 已在 `src/components/componentRegistry.ts` 中登记
  - `name`：组件名，PascalCase，全局唯一
  - `level`：`atom` / `molecule` / `organism` / `template`
  - `sourcePath`：组件源文件路径
  - `status`：`active`
  - `description`：一句话描述组件用途
  - **`consumers`：消费方列表（至少一个）**
- [ ] 命名不与现有组件冲突（全局搜索组件名确认无重复）

### 2.3 消费方验证

- [ ] 至少有一个页面或上层组件实际 `import` 使用该组件
- [ ] `consumers` 字段中登记的消费方与实际 import 一致
- [ ] 消费方不是测试文件或示例代码（必须是真实业务代码）

### 2.4 质量保障

- [ ] 有单元测试覆盖核心交互（`src/components/**/*.test.tsx`）
  - Atom：快照测试 + 事件回调测试
  - Molecule：核心功能测试 + 边界情况
  - Organism：Store 交互测试 + 主要流程
- [ ] 有 JSDoc 注释和使用示例
  - 组件顶部有 `@description` 说明用途
  - Props 有 `@param` 注释
  - 复杂组件有使用示例代码
- [ ] 符合原子设计分层原则（`npm run audit:atomic` 通过，0 violations）
- [ ] 颜色使用设计令牌，无硬编码（`npm run lint:colors` 通过）

### 2.5 导出与引用

- [ ] 如果是通用组件（atom / molecule），已在对应 barrel `index.ts` 中导出
  - `src/components/atoms/index.ts`
  - `src/components/molecules/index.ts`
  - `src/components/organisms/index.ts`
  - `src/components/templates/index.ts`
- [ ] Organism / Template 视情况决定是否 barrel 导出（业务组件通常不导出）
- [ ] 引用路径统一使用 `@/components/{level}/{ComponentName}`

### 2.6 准入检查快速命令

```bash
# 一次性跑所有组件相关检查
npm run audit:atomic     # 原子分层合规
npm run lint:colors      # 颜色硬编码检查
npm run audit:jsdoc      # JSDoc 完整性
npm run typecheck        # 类型检查
npm test -- --run src/components/YourComponent.test.tsx  # 组件测试
```

---

## 三、WIP 组件管理

### 3.1 什么是 WIP 组件

**WIP（Work In Progress）组件**：功能尚未完全开发完成，但因分阶段交付需要，提前合入代码库的组件。

### 3.2 允许创建 WIP 组件的场景

只有以下情况可以创建 WIP 状态的组件：

1. **大型功能分阶段交付**：组件是大型功能的一部分，当前迭代只完成部分功能
2. **跨团队协作依赖**：其他团队/模块需要提前依赖该组件的基础能力
3. **渐进式重构**：旧组件迁移过程中，新组件先以 WIP 状态接入

> **不允许的情况**：
> - "先建个壳，以后再填" —— 禁止
> - "不确定要不要，先放着看看" —— 禁止
> - 单纯为了不浪费代码而合入 —— 禁止

### 3.3 WIP 组件的登记要求

WIP 组件在 `componentRegistry.ts` 中的登记格式：

```typescript
{
  name: 'NewComponent',
  level: 'molecule',
  sourcePath: 'src/components/molecules/NewComponent.tsx',
  status: 'wip',              // 标记为 wip
  description: 'xxx 组件（开发中，预计 v2.1 完成）',
  consumers: ['PageA'],       // 必须有至少一个消费方
  wip: {
    startedAt: '2026-07-25',  // 开始日期
    expectedComplete: '2026-08-08',  // 预计完成日期（最多 2 个迭代）
    owner: '张三',            // 负责人
    todo: [                   // 待完成事项清单
      '实现编辑模式',
      '补充单元测试',
      '完善 JSDoc 文档'
    ]
  }
}
```

### 3.4 WIP 组件的约束

- **最长存活期**：**2 个迭代**（约 4 周）
- **使用限制**：WIP 组件只能用于内部开发，禁止在正式发布版本中暴露给用户
- **可见性控制**：如涉及 UI，应通过功能开关（Feature Flag）隐藏
- **测试要求**：核心功能必须有测试，未完成部分可标记为 `test.todo`
- **文档要求**：必须在组件注释中标注 `@wip` 标签和预计完成时间

### 3.5 WIP 超期处理流程

```
超期 1 个迭代 → 发提醒给负责人 → 给出延期理由 + 新的预计完成时间
超期 2 个迭代 → 自动降级为 deprecated → 发通知给团队
超期 3 个迭代 → 确认无消费方 → 删除组件 + 从 registry 移除
```

**具体步骤**：

1. **第 1 次超期（+1 迭代）**
   - 架构组发送提醒给 WIP 负责人
   - 负责人需在 3 个工作日内给出延期理由和新的完成时间
   - 新的完成时间最多再延长 1 个迭代

2. **第 2 次超期（+2 迭代）**
   - 自动将 `status` 改为 `deprecated`
   - 在团队周会上通报
   - 组件代码保留，但禁止新增消费方

3. **第 3 次超期（+3 迭代）**
   - 确认无活跃消费方后，删除组件代码
   - 从 `componentRegistry.ts` 中移除
   - 记录到架构债务清单

---

## 四、前瞻性储备申请流程

### 4.1 什么情况需要申请

如果确实需要开发**当前无消费方但预判未来有明确需求**的组件（前瞻性储备），必须通过正式申请流程，不得直接创建。

**典型适用场景**：
- 下一个迭代已确认需要，但当前迭代提前开发可提高效率
- 多个团队同步推进，需要提前约定组件接口
- 基础设施级组件，业务方尚未接入但架构规划已明确

### 4.2 申请内容

提交"组件储备申请"需包含以下信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| **组件名称** | 拟创建的组件名 | `AdvancedTable` |
| **组件层级** | atom / molecule / organism / template | `organism` |
| **用途说明** | 组件解决什么问题 | 支持虚拟滚动、列自定义、行内编辑的高级表格 |
| **预期消费方** | 哪些模块/页面会使用（至少 2 个） | 股票池页面、持仓列表页面 |
| **预计接入时间** | 消费方预计在哪个迭代接入 | 2026 年 8 月迭代（v2.2） |
| **负责人** | 组件开发和维护负责人 | 张三 |
| **技术方案** | 简要技术实现思路 | 基于 react-table 封装，支持 10000+ 行虚拟滚动 |

### 4.3 审批流程

```
提交申请 → 前端负责人初审 → 架构负责人终审 → 通过 → 创建储备组件
                                    ↓
                                  驳回 → 说明理由
```

**审批人**：
- **初审**：前端负责人（评估合理性、技术方案可行性）
- **终审**：架构负责人（评估架构影响、资源投入）

**审批通过标准**：
1. 有明确的未来需求规划（非空泛预判）
2. 至少 2 个预期消费方（避免单点依赖）
3. 预计接入时间不超过 2 个迭代
4. 技术方案与现有架构一致
5. 人力投入可控（不影响当前迭代交付）

### 4.4 储备组件的管理

- `componentRegistry.ts` 中 `status` 标记为 `reserved`
- 组件可以只有接口定义（TypeScript types），没有完整实现
- 储备组件**不计入**组件数量统计和覆盖率考核
- 必须在 `consumers` 字段中登记"预期消费方"（标注 `expected`）

```typescript
{
  name: 'AdvancedTable',
  level: 'organism',
  sourcePath: 'src/components/organisms/AdvancedTable.tsx',
  status: 'reserved',          // 储备状态
  description: '高级表格组件（储备，预计 v2.2 接入）',
  consumers: [
    'PoolPage (expected)',     // 预期消费方
    'PositionList (expected)'
  ],
  reserved: {
    requestedAt: '2026-07-25',
    expectedIntegration: '2026-08-20',
    owner: '张三',
    approvedBy: ['前端负责人A', '架构负责人B']
  }
}
```

### 4.5 自动降级机制

> **超过预计接入时间 1 个迭代仍未接入 → 自动降级**

1. **储备 → WIP**：如果已开始开发但消费方延迟接入 → 转入 WIP 管理
2. **储备 → Deprecated**：如果消费方需求取消 → 直接标记废弃
3. **储备 → 删除**：如果超过 2 个迭代仍无消费方接入 → 删除代码

**降级处理由架构组每月巡检执行**，结果在团队周会上通报。

---

## 五、违规处理与监督机制

### 5.1 违规类型

| 违规类型 | 严重级 | 处理方式 |
|----------|--------|----------|
| 未登记就创建组件 | P1 | 补登记 + 审查是否符合准入 |
| 无消费方的"僵尸组件" | P1 | 限期补充消费方或删除 |
| 分层错误（放错目录） | P1 | 移动到正确目录 + 修复引用 |
| WIP 超期未处理 | P2 | 按超期流程自动降级 |
| 储备组件超期未接入 | P2 | 自动降级 + 通报 |
| 前瞻性储备未申请 | P1 | 补申请或删除 |

### 5.2 监督方式

1. **`audit:atomic` 自动检测**：每次 CI 运行时检测未登记组件
2. **`audit:deadcode` 死代码检测**：检测无引用的组件
3. **架构组月度巡检**：检查 WIP / reserved 状态组件的存活情况
4. **PR 模板自检**：新增组件必须勾选准入 Checklist

### 5.3 申诉机制

- 如果认为某条规则不适用于当前场景，可向架构组提交申诉
- 申诉需说明：违规情况、申请豁免的理由、替代方案
- 架构组在 3 个工作日内给出答复

---

> **维护说明**：本政策由架构组维护，随项目迭代持续更新。如有疑问或建议，请提交 Issue 或联系架构组。
