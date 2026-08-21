---
doc_id: V9-DOC-GUIDE-052
title: "V9 团队开发操作指南"
domain: project
status: active
last_updated: 2026-08-17
---
covers_code:
  - src/constants/cockpit.constants.ts
  - src/core/acl.ts
  - src/cockpit/core/widgetRegistry.ts


---
title: 团队开发操作指南
type: reference
domain: project
phase: development
tier: important
status: active
maintainer: Architecture Team
summary: "**文档定位**：团队日常开发的统一操作手册，整合开发流程、编码规范、质量门禁、协作约定、问题排查等内容 **适用对象**：全体开发人员、测试人员、架构师 **阅读方式**：按章节查阅，或通过目..."
tags: [project, guide, reference, component, governance, documentation]
version: v1.0.1
last_updated: 2026-08-12
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-121
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.1
    changes: "新增 6.4 防止工作树回退与安全提交（8 条 Git 策略），对齐 2026-08-12 P1 修复回退复盘"
    date: 2026-08-12
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
---

# V9 团队开发操作指南

> **文档定位**：团队日常开发的统一操作手册，整合开发流程、编码规范、质量门禁、协作约定、问题排查等内容
> **适用对象**：全体开发人员、测试人员、架构师
> **阅读方式**：按章节查阅，或通过目录快速定位具体操作
> **配套资料**：`team-handbook/`（设计思路）、`how-to/`（专项指南）、`reference/`（详细规范）

---

## 目录

### 第一篇：入门与环境
1. [快速上手指南](#一快速上手指南)
2. [开发环境搭建](#二开发环境搭建)
3. [项目结构速览](#三项目结构速览)

### 第二篇：开发工作流
4. [开发工作流 SOP](#四开发工作流-sop)
5. [四步集成契约](#五四步集成契约)
6. [Git 协作规范](#六git-协作规范)
7. [代码评审指南](#七代码评审指南)

### 第三篇：编码规范
8. [编码规范速查](#八编码规范速查)
9. [类型安全契约](#九类型安全契约)
10. [组件开发规范](#十组件开发规范)
11. [设计令牌与颜色](#十一设计令牌与颜色)

### 第四篇：质量与测试
12. [质量门禁清单](#十二质量门禁清单)
13. [测试策略与实践](#十三测试策略与实践)
14. [审计工具使用指南](#十四审计工具使用指南)

### 第五篇：架构与设计
15. [架构分层规则](#十五架构分层规则)
16. [DataBridge 写入规范](#十六databridge-写入规范)
17. [Store 开发指南](#十七store-开发指南)
18. [Service 开发指南](#十八service-开发指南)
19. [Widget 开发指南](#十九widget-开发指南)

### 第六篇：问题排查与经验
20. [常见问题排查](#二十常见问题排查)
21. [经验教训速查](#二十一经验教训速查)
22. [调试方法论](#二十二调试方法论)

### 第七篇：文档与知识
23. [文档编写规范](#二十三文档编写规范)
24. [知识沉淀与分享](#二十四知识沉淀与分享)

---

---

## 第一篇：入门与环境

### 一、快速上手指南

#### 1.1 新人 30 分钟入门路径

| 阶段 | 时间 | 阅读内容 | 目标 |
|------|------|----------|------|
| **第 1 步** | 5 min | [team-handbook/README.md](./README.md) | 了解手册结构、核心术语 |
| **第 2 步** | 5 min | [team-handbook/01-design-philosophy.md](./01-design-philosophy.md) | 理解设计哲学和宋韵美学 |
| **第 3 步** | 10 min | [team-handbook/02-architecture.md](./02-architecture.md) | 掌握六层架构和数据流 |
| **第 4 步** | 5 min | 前端看 [03-ui-components.md](./03-ui-components.md) / 算法看 [04-model-runtime.md](./04-model-runtime.md) | 深入各自领域 |
| **第 5 步** | 5 min | 本篇操作指南（本文） | 掌握日常开发操作 |

#### 1.2 必须知道的 5 个核心概念

| 概念 | 一句话解释 | 详细位置 |
|------|-----------|----------|
| **舱（Cabin）** | 五大业务域：输入/分析/交易/输出/总控 | team-handbook/02-architecture.md |
| **Envelope（信封）** | 统一写消息格式 `{ meta, payload }`，经 DataBridge 路由 | team-handbook/02-architecture.md §3 |
| **DataBridge** | 唯一切面入口：校验→鉴权→审计→路由→广播 | team-handbook/02-architecture.md §3 |
| **设计令牌（Token）** | L1–L6 分层颜色/尺寸变量，UI 颜色必须引用 | team-handbook/01-design-philosophy.md §4 |
| **四步集成** | 类型→Store→Service→UI，每步可独立回滚 | 本篇 §5 |

---

### 二、开发环境搭建

#### 2.1 环境要求

```
Node.js >= 18.x
pnpm >= 8.x （或 npm >= 9.x）
VS Code（推荐）
```

#### 2.2 快速启动

```bash
# 1. 克隆项目
git clone <repo-url>
cd FinSightV9

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器访问
# http://localhost:5173
```

#### 2.3 推荐 VS Code 插件

| 插件 | 用途 | 必选 |
|------|------|------|
| ESLint | 代码规范检查 | ? |
| Prettier | 代码格式化 | ? |
| TypeScript Vue Plugin | TypeScript 支持 | ? |
| Tailwind CSS IntelliSense | Tailwind 提示 | ? |
| React Developer Tools | React 调试 | ? |
| Redux DevTools | Zustand 状态调试 | ? |
| Error Lens | 行内错误提示 | ? |

#### 2.4 常用命令速查

| 命令 | 用途 | 何时运行 |
|------|------|----------|
| `npm run dev` | 启动开发服务器 | 日常开发 |
| `npm run build` | 生产构建 | 发布前 |
| `npm run preview` | 预览构建产物 | 构建后验证 |
| `npm run test` | 运行单元测试 | 提交前 |
| `npm run test:watch` | 监听模式测试 | TDD 开发 |
| `npm run test:e2e` | 运行 E2E 测试 | 发布前 |
| `npm run coverage` | 测试覆盖率 | 定期检查 |
| `npm run lint` | ESLint 检查 | 提交前 |
| `npm run lint:fix` | 自动修复 lint 问题 | 提交前 |
| `npm run typecheck` | TypeScript 类型检查 | 提交前 |
| `npm run audit:layers` | 分层合规审计 | 新增/移动模块后 |
| `npm run audit:hardcode` | 硬编码审计 | 提交前 |
| `npm run audit:atomic` | 组件层级审计 | 新增组件后 |
| `npm run audit:tokens` | 设计令牌审计 | UI 变更后 |
| `npm run audit:jsdoc` | JSDoc 完整性审计 | 新增公共函数后 |
| `npm run audit:routes` | 路由一致性审计 | 新增页面后 |
| `npm run audit:complexity` | 复杂度审计 | 定期检查 |

---

### 三、项目结构速览

#### 3.1 源码目录结构（src/）

```
src/
├── apps/                  # L4 应用层：五舱入口（input/analysis/trading/output/command）
├── pages/                 # L5 表现层：页面组件
├── components/            # L5 表现层：可复用组件
│   ├── atoms/             #   原子组件（Button/Input/Card...）
│   ├── molecules/         #   分子组件（FormField/MetricCard...）
│   ├── organisms/         #   组织组件（PoolBoard/CollectionProgress...）
│   └── templates/         #   模板组件（PageContainer/DashboardLayout...）
├── cockpit/               # L5 驾驶舱：Widget 系统
├── portal/                # L5 门户：PortalShell 五舱导航
├── services/              # L3 服务层：业务服务
│   ├── scoring/           #   评分引擎（V6/智能/轮动）
│   ├── data-collector/    #   数据采集服务
│   ├── analysis/          #   分析服务
│   └── trading/           #   交易服务
├── core/                  # L3 核心层：基础设施核心
│   ├── databridge.ts      #   DataBridge 统一写入网关
│   ├── envelope.ts        #   信封消息格式
│   ├── acl.ts             #   ACL 权限控制
│   ├── eventBus.ts        #   事件总线
│   └── memoryCache.ts     #   内存缓存
├── store/                 # L2 状态层：Zustand Stores（约 50 个）
├── data/                  # L2 数据层：IndexedDB 封装
│   ├── dataLayer.ts       #   统一数据访问层
│   └── db/                #   IndexedDB 原始操作
├── lib/                   # L1 基础设施：工具函数
├── config/                # L1 配置层：运行时配置
├── constants/             # L1 常量层：业务常量
├── types/                 # L1 类型层：TypeScript 类型
├── hooks/                 # 自定义 React Hooks
├── utils/                 # 工具函数（辅助）
└── workers/               # Web Workers（评分计算等）
```

#### 3.2 文档目录结构（docs/）

```
docs/
├── team-handbook/         # 团队体系手册（5 份，入门必读）
├── how-to/                # 操作指南（专项 How-to）
├── reference/             # 技术参考（规范/契约/API）
├── explanation/           # 架构解释（设计思路/ADR/深度解析）
├── tutorials/             # 教程（入门 step-by-step）
├── reports/               # 报告（审计/复盘/经验教训）
│   └── retrospectives/    #   复盘报告
├── 00-meta/               # 元文档（目录指南/治理规则）
└── assets/                # 静态资源
```

---

## 第二篇：开发工作流

### 四、开发工作流 SOP

#### 4.1 四阶段工作流总览

```
┌─────────────────────────────────────────────────┐
│  Phase 1: 编码前（查询 → 设计 → 验证基线）        │
│    AI 记忆查询 / 任务图建立 / 架构审计 / 四步集成  │
├─────────────────────────────────────────────────┤
│  Phase 2: 编码中（开发 → 实时纠偏 → 本地测试）    │
│    分层守护 / 颜色令牌 / JSDoc 补齐 / 复杂度监控   │
├─────────────────────────────────────────────────┤
│  Phase 3: 编码后（提交 → 门禁验证 → 覆盖率追踪）  │
│    13 项质量门禁 + 测试分层 / 文档同步             │
├─────────────────────────────────────────────────┤
│  Phase 4: 上线后（日志 → 复盘 → 知识沉淀）        │
│    结构化变更日志 / 质量指标快照 / 经验教训入库     │
└─────────────────────────────────────────────────┘
```

#### 4.2 Phase 1：编码前（DoD：设计就绪）

| 步骤 | 操作 | 验证 | 耗时 |
|------|------|------|------|
| 1.1 | AI 记忆查询：检索历史经验，避免重复踩坑 | ExperienceRecall / 记忆搜索 | 5 min |
| 1.2 | 任务图建立：拆解任务，明确依赖关系 | TodoWrite / 任务清单 | 5 min |
| 1.3 | 架构审计：确认变更范围符合分层规则 | 读 AGENTS.md + 相关 ADR | 5 min |
| 1.4 | 四步集成规划：确定类型/Store/Service/UI 各步产出 | 四步集成契约 | 5 min |
| 1.5 | 基线验证：确认当前代码可构建、测试通过 | `npm run build && npm run test` | 2 min |

> **DoD（完成定义）**：有明确的任务拆解、架构合规性确认、基线验证通过

#### 4.3 Phase 2：编码中（DoD：功能完成）

| 步骤 | 操作 | 验证 | 频率 |
|------|------|------|------|
| 2.1 | 按四步集成顺序开发 | 每步独立验证 | 全程 |
| 2.2 | 分层守护：import 时检查层级 | 不跨层引用 | 每次 import |
| 2.3 | 颜色令牌：UI 颜色走令牌，不硬编码 | `lint:colors` | 实时 |
| 2.4 | JSDoc 补齐：公共函数/组件/Store 补注释 | `audit:jsdoc` | 每完成一个模块 |
| 2.5 | 复杂度监控：函数不超过 50 行，圈复杂度 ≤ 10 | `audit:complexity` | 每完成一个模块 |
| 2.6 | 本地测试：单元测试 + 手动验证 | `npm run test` + 浏览器 | 每完成一个功能 |

> **DoD**：功能实现完成、lint 通过、类型通过、单元测试通过、手动验证通过

#### 4.4 Phase 3：编码后（DoD：可提交）

| 步骤 | 操作 | 命令 | 必选 |
|------|------|------|------|
| 3.1 | TypeScript 类型检查 | `npm run typecheck` | ? |
| 3.2 | ESLint 代码规范 | `npm run lint` | ? |
| 3.3 | 单元测试 | `npm run test` | ? |
| 3.4 | 分层合规审计 | `npm run audit:layers` | ? |
| 3.5 | 硬编码审计 | `npm run audit:hardcode` | ? |
| 3.6 | 组件层级审计（如涉及） | `npm run audit:atomic` | ? |
| 3.7 | 设计令牌审计（如涉及 UI） | `npm run audit:tokens` | ? |
| 3.8 | JSDoc 审计 | `npm run audit:jsdoc` | ? |
| 3.9 | 路由一致性（如涉及路由） | `npm run audit:routes` | ? |
| 3.10 | 测试覆盖率检查 | `npm run coverage` | ? |
| 3.11 | 生产构建验证 | `npm run build` | ? |
| 3.12 | 文档同步：按触发清单更新文档 | 参考 doc-trigger-action-map.md | ? |

> **DoD**：所有必选门禁通过，文档已同步更新

#### 4.5 Phase 4：上线后（DoD：知识沉淀）

| 步骤 | 操作 | 产出 |
|------|------|------|
| 4.1 | 结构化变更日志 | 更新 CHANGELOG.md |
| 4.2 | 质量指标快照 | 记录门禁结果、覆盖率、构建时间 |
| 4.3 | 经验教训入库 | 新问题/新教训添加到 lessons-learned.md |
| 4.4 | 文档健康度检查 | 检查相关文档新鲜度 |

---

### 五、四步集成契约

> **核心原则**：任何新模块必须按以下顺序逐步实现，每步可独立回滚。

#### 5.1 Step 1：类型定义

**位置**：`src/types/modules/` 或 `src/data/types/`

```typescript
// 示例：src/types/modules/mymodule.types.ts
export interface MyModuleItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type MyModuleAction = 'add' | 'update' | 'delete';
```

**验证**：`npm run typecheck` 通过

#### 5.2 Step 2：Store 状态

**位置**：`src/store/`（Zustand + withBroadcast）

```typescript
// 示例：src/store/useMyModuleStore.ts
import { create } from 'zustand';
import { withBroadcast } from './middleware/withBroadcast';

interface MyModuleState {
  items: MyModuleItem[];
  addItem: (item: MyModuleItem) => void;
  removeItem: (id: string) => void;
}

export const useMyModuleStore = create<MyModuleState>()(
  withBroadcast(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
    }),
    { name: 'myModule' }
  )
);
```

**验证**：单元测试通过

#### 5.3 Step 3：Service 服务

**位置**：`src/services/`（经 DataBridge 写数据）

```typescript
// 示例：src/services/myModule/myModuleService.ts
import { dataBridge } from '@/core/databridge';
import { EnvelopeFactory } from '@/core/envelope';

export const myModuleService = {
  async addItem(item: MyModuleItem) {
    const envelope = EnvelopeFactory.create({
      source: 'myModuleService',
      target: 'myModule',
      action: 'addItem',
      payload: item,
    });
    await dataBridge.forward(envelope);
  },

  async getItems() {
    return dataBridge.query('myModule', 'getAll');
  },
};
```

**验证**：`npm run audit:layers` 0 违规

#### 5.4 Step 4：UI 组件

**位置**：`src/pages/` 或 `src/components/`（仅经 Store 取数）

```tsx
// 示例：src/components/organisms/MyModuleList.tsx
import { useMyModuleStore } from '@/store/useMyModuleStore';

export function MyModuleList() {
  const items = useMyModuleStore((s) => s.items);

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

**验证**：集成测试通过 + 手动验证

> **详细指南**：
> - [how-to-add-store.md](../how-to/how-to-add-store.md)
> - [how-to-add-service.md](../how-to/how-to-add-service.md)
> - [how-to-add-widget.md](../how-to/how-to-add-widget.md)

---

### 六、Git 协作规范

#### 6.1 分支策略

| 分支 | 用途 | 命名规则 |
|------|------|----------|
| `main` | 主分支，稳定版本 | — |
| `develop` | 开发分支 | — |
| `feature/*` | 功能开发 | `feature/模块名-功能描述` |
| `fix/*` | Bug 修复 | `fix/问题描述` |
| `refactor/*` | 重构 | `refactor/重构描述` |
| `docs/*` | 文档更新 | `docs/更新描述` |

#### 6.2 提交规范（Conventional Commits）

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**：

| type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(scoring): add nine-dimension score` |
| `fix` | Bug 修复 | `fix(databridge): fix unhandled promise rejection` |
| `refactor` | 重构（不改变功能） | `refactor(store): split pool store` |
| `docs` | 文档更新 | `docs(handbook): add team operation guide` |
| `test` | 测试相关 | `test: add unit tests for v6 engine` |
| `chore` | 构建/工具/依赖 | `chore: upgrade zustand to 4.5` |
| `style` | 格式（不影响逻辑） | `style: fix eslint warnings` |
| `perf` | 性能优化 | `perf(worker): optimize score calculation` |
| `revert` | 回滚 | `revert: revert previous commit` |

#### 6.3 PR 描述模板

```markdown
## 变更概述
<一句话描述变更内容>

## 变更类型
- [ ] feat（新功能）
- [ ] fix（Bug 修复）
- [ ] refactor（重构）
- [ ] docs（文档）
- [ ] test（测试）
- [ ] chore（构建/工具）

## 验证清单
- [ ] TypeScript 类型检查通过（`npm run typecheck`）
- [ ] ESLint 检查通过（`npm run lint`）
- [ ] 单元测试通过（`npm run test`）
- [ ] 分层审计通过（`npm run audit:layers`）
- [ ] 硬编码审计通过（`npm run audit:hardcode`）
- [ ] 生产构建成功（`npm run build`）
- [ ] 相关文档已更新
- [ ] 相关测试已添加/更新

## 影响范围
<列出受影响的模块>

## 截图（如涉及 UI）
<附上截图>
```

#### 6.4 防止工作树回退与安全提交（2026-08-12 新增）

> **背景**：2026-08-12 P1 硬编码修复曾两度被并行/自动化 Git 操作（`pull --rebase` / `reset` / `merge`）重置而丢失，需重构提交纪律以杜绝"改完即丢"。

**根因**：未提交的修改停留在工作树，任何并发 Git 操作（脚本、CI、多 worktree、他人 `reset`）都可能将其清空；工作树不是可靠存储。

**8 条防回退 Git 策略**：

| # | 策略 | 说明 |
|---|------|------|
| 1 | **改动立即提交** | 完成一个原子改动后立刻 `git commit`，不要积压多个未提交改动；工作树只保留"当前正在改"的增量 |
| 2 | **重构前先提交基线** | 任何重构/大改之前，先把当前稳定状态提交，形成可回退的还原点 |
| 3 | **使用独立分支** | 大改动在 `feature/*` / `refactor/*` 分支上进行，避免直接污染 `main`/`develop` |
| 4 | **拦截破坏性命令** | 提交前先 `git status` 核对未提交文件与目标一致；对 `reset --hard` / `checkout .` / `clean -f` 等命令保持高度警惕，需二次确认 |
| 5 | **关键提交用 `git commit --only <paths>`** | 明确限定提交路径，物理阻止无关文件混入；禁止 `git add -A`（易误暂存敏感/无关文件） |
| 6 | **先核对暂存文件数再提交** | 提交前 `git status` 统计暂存文件数，与目标数量比对，不一致立即排查，绝不盲目提交 |
| 7 | **禁止 `--no-verify` 跳过钩子** | 除非显式获准，绝不以跳过 pre-commit 钩子（lint-staged/doc:gate/tsc）为代价换取提交成功 |
| 8 | **并发环境用专用 worktree/终端** | 避免同一仓库被多个自动化进程同时 `pull/reset/merge`；明确各进程操作边界，减少竞争窗口 |

**判断"是否需要立即提交"的口诀**：
- 修改在 `src/` 且被 `audit:*` / `tsc:prod` 覆盖 → 通过后**立即提交**
- 改动跨 2+ 层（如同时改 Service 与 UI）→ 拆分为独立逻辑提交
- 提交被钩子阻断 → **先修根因**（如修正失效文档路径），不要 `--no-verify`

---

### 七、代码评审指南

#### 7.1 评审清单

| 检查项 | 重点 | 严重级 |
|--------|------|--------|
| **架构分层** | 是否跨层调用、是否直写 db | ?? P0 |
| **类型安全** | 是否有 any、是否有类型断言滥用 | ?? P0 |
| **DataBridge** | 写操作是否经 DataBridge | ?? P0 |
| **颜色令牌** | UI 颜色是否走令牌、是否硬编码 | ?? P1 |
| **JSDoc** | 公共函数/组件是否有注释 | ?? P1 |
| **复杂度** | 函数是否过长、圈复杂度是否过高 | ?? P1 |
| **测试覆盖** | 核心逻辑是否有测试 | ?? P1 |
| **命名规范** | 变量/函数/文件命名是否清晰 | ?? P2 |
| **代码风格** | 是否符合项目代码风格 | ?? P2 |
| **文档同步** | 是否同步更新相关文档 | ?? P1 |

#### 7.2 评审要点

**架构层面**：
- 新增模块是否符合六层架构规则
- 依赖方向是否正确（上层依赖下层）
- 写操作是否经 DataBridge 信封化

**代码质量**：
- 函数职责单一，不超过 50 行
- 避免深层嵌套（不超过 3 层）
- 魔法数字提取为常量或配置
- 错误处理完善，无静默失败

**可维护性**：
- 命名清晰，表达意图
- 注释说明"为什么"而非"做什么"
- 可测试性好，依赖注入清晰

> **详细指南**：[code-review-guide.md](../how-to/code-review-guide.md)、[CODE-REVIEW.md](../CODE-REVIEW.md)

---

## 第三篇：编码规范

### 八、编码规范速查

#### 8.1 TypeScript 规范

| 规则 | 说明 | 验证 |
|------|------|------|
| 禁止 `any` | 必须使用明确类型，外部输入用 zod 验证 | ESLint + typecheck |
| 禁止 `@ts-ignore` | 用类型守卫替代 | ESLint |
| 禁止类型断言滥用 | `as` 仅在确定类型更窄时使用 | 代码评审 |
| 优先 interface | 对象类型用 interface，联合类型用 type | 代码评审 |
| 导出类型 | 公共类型从 types/ 导出，不 inline 定义 | 代码评审 |

#### 8.2 React 规范

| 规则 | 说明 |
|------|------|
| 函数组件 | 全部使用函数组件 + Hooks |
| 状态位置 | 局部状态用 useState，跨组件用 Store |
| 副作用 | 统一放在 useEffect，注意 cleanup |
| 性能优化 | useMemo/useCallback 仅在需要时使用 |
| 组件拆分 | 超过 200 行考虑拆分，保持职责单一 |

#### 8.3 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `UserProfileCard` |
| Hook | camelCase，use 开头 | `usePoolBoard` |
| 函数 | camelCase，动词开头 | `calculateScore` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_WEIGHTS` |
| 接口/类型 | PascalCase，I 前缀可选 | `ScoreConfig` |
| Store | useXxxStore | `usePoolStore` |
| Service | xxxService | `poolService` |
| 文件（组件） | PascalCase.tsx | `UserProfileCard.tsx` |
| 文件（工具/服务） | kebab-case.ts | `pool-service.ts` |

#### 8.4 日志规范

```typescript
// ? 正确：含模块名 + 操作 + 上下文
logger.info('[DataBridge] forward envelope', {
  source: envelope.meta.source,
  action: envelope.meta.action,
  traceId: envelope.meta.traceId,
});

// ? 错误：无上下文，信息不足
console.log('forward success');
```

**日志级别使用**：
- `logger.error`：错误/异常（必须有 stack）
- `logger.warn`：告警/降级（可恢复的异常）
- `logger.info`：关键业务流程节点
- `logger.debug`：调试信息（开发环境）

#### 8.5 事件清理规范

```typescript
// ? 正确：subscribe ? unsubscribe 配对
useEffect(() => {
  const unsubscribe = eventBus.subscribe('dataChanged', handler);
  return () => unsubscribe();  // 清理函数
}, []);

// ? 错误：无清理，导致内存泄漏
useEffect(() => {
  eventBus.subscribe('dataChanged', handler);
}, []);
```

> **详细规范**：[coding-conventions.md](../../reference/coding-conventions.md)

---

### 九、类型安全契约

> **六步安全契约**：不变式锚定 → 影响范围扫描 → 变更方案 → 边界守卫 → 分层原子执行 → tsc+类型级测试验证

#### 9.1 类型变更检查清单

- [ ] 不变式锚定：哪些类型约束不能破坏？
- [ ] 影响范围扫描：全局搜索引用，列出所有受影响文件
- [ ] 变更方案：明确修改路径（类型定义 → 实现 → 消费方）
- [ ] 边界守卫：any/never/null 的边界处理
- [ ] 分层执行：按依赖顺序原子修改，每步可回滚
- [ ] 验证通过：`tsc --noEmit` + 类型级测试

> **详细指南**：type-safety-contract SKILL

---

### 十、组件开发规范

#### 10.1 原子设计层级

| 层级 | 组成 | 禁止 import |
|------|------|-------------|
| **Atom** | Tailwind / Tokens | Store/Service/Molecule/Organism/业务 |
| **Molecule** | Atom | Organism/Store/Service/业务 |
| **Template** | Molecule + Atom | 业务数据 / Store / Service |
| **Organism** | 任意层级（含 Store/Service/Hook） | — |

**验证**：`npm run audit:atomic`

#### 10.2 组件 Props 规范

```tsx
// ? 正确：明确 Props 类型，可选值有默认值
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
}: ButtonProps) {
  // ...
}
```

---

### 十一、设计令牌与颜色

#### 11.1 六层令牌体系

| 层 | 令牌 | 用途 |
|----|------|------|
| L1 | `THEME_TOKENS` | 通用语义色/尺寸/间距/圆角/排版 |
| L2 | `COLOR_TOKENS` | 业务语义色（涨跌/状态/评分等级） |
| L3 | `COLOR_SHADES` | 色阶与 Tailwind 文本/背景/边框映射 |
| L4 | `chartColors.ts` | 图表专用调色板 |
| L5 | `STOCK_COLOR_TOKENS` | **股票红涨绿跌固定色**（不随主题） |
| L6 | `SEMANTIC_COLOR_ROLES` | 主题感知 CSS 变量 |

#### 11.2 红涨绿跌铁律

- A 股**红涨绿跌**为固定业务色，不随主题变化
- 必须使用 `STOCK_COLOR_TOKENS`，禁止用 `COLOR_TOKENS.up/down` 替代
- 暗色模式下亦不变

**验证**：`npm run lint:colors` + `npm run audit:tokens`

> **详细说明**：[team-handbook/01-design-philosophy.md](./01-design-philosophy.md) §4

---

## 第四篇：质量与测试

### 十二、质量门禁清单

#### 12.1 13 项质量门禁总览

| # | 门禁项 | 命令 | 目标 | 必选 |
|---|--------|------|------|------|
| 1 | TypeScript 类型检查 | `tsc --noEmit` | 0 errors | ? |
| 2 | ESLint 代码规范 | `npm run lint` | 0 warnings/errors | ? |
| 3 | 单元测试 | `npm run test` | 全部通过 | ? |
| 4 | 生产构建 | `npm run build` | 产物生成成功 | ? |
| 5 | 跨层调用审计 | `npm run audit:layers` | 0 violations | ? |
| 6 | 硬编码审计 | `npm run audit:hardcode` | 0 业务硬编码 | ? |
| 7 | 死代码审计 | `npm run audit:deadcode` | 0 空壳/漂移 | ? |
| 8 | 测试覆盖率 | `npm run coverage` | core≥85% services≥70% | ? |
| 9 | E2E 冒烟测试 | `npm run test:e2e` | 0 失败 | ? |
| 10 | 路由一致性 | `npm run audit:routes` | 0 漂移 | ? |
| 11 | PWA 离线验证 | 手动/Playwright | SW 注册成功 | ? |
| 12 | 数据蓝图一致性 | `validate:blueprint` | Store/类型/文档一致 | ? |
| 13 | 踩坑规则门禁 | `python scripts/pitfall_check.py` | 0 ERROR | ? |

#### 12.2 提交前必跑清单（5 分钟）

```bash
# 1. 类型检查
npm run typecheck

# 2. Lint 检查
npm run lint

# 3. 单元测试
npm run test

# 4. 分层审计
npm run audit:layers

# 5. 硬编码审计
npm run audit:hardcode

# 6. 构建验证
npm run build
```

> **详细说明**：[09-quality-gates.md](../09-quality-gates.md)

---

### 十三、测试策略与实践

#### 13.1 测试分层

| 层级 | 框架 | 覆盖目标 | 位置 |
|------|------|----------|------|
| 单元测试 | Vitest + jsdom | 工具函数、纯计算逻辑 | `src/**/*.test.ts` |
| 服务测试 | Vitest + fake-indexeddb | 业务服务、数据层 | `src/services/**/*.test.ts` |
| 集成测试 | Vitest + DataBridge mock | 跨模块交互、数据流 | `tests/integration/` |
| E2E 测试 | Playwright | 关键用户路径、页面渲染 | `tests/e2e/` |
| 类型测试 | Expect<Equals> | 类型安全、泛型约束 | `src/**/*.spec.ts` |

#### 13.2 什么必须测

- ? 核心引擎（评分/交易/风控）：必须有单元测试
- ? DataBridge：必须有集成测试
- ? Store 状态转换：必须有单元测试
- ? 工具函数：必须有单元测试
- ? 复杂计算逻辑：必须有单元测试
- ? UI 组件：关键组件有快照测试
- ? E2E：核心用户路径有 E2E 测试

#### 13.3 测试编写原则

1. **AAA 模式**：Arrange（准备）→ Act（执行）→ Assert（断言）
2. **单一职责**：每个测试用例只测一个点
3. **独立运行**：测试之间不共享状态
4. **描述清晰**：test 描述说明"测什么、期望什么"
5. **边界覆盖**：正常值 + 边界值 + 异常值

> **详细指南**：[testing-strategy.md](../testing-strategy.md)

---

### 十四、审计工具使用指南

#### 14.1 audit:layers — 分层合规审计

**用途**：检查跨层调用违规

```bash
npm run audit:layers
```

**常见违规与修复**：

| 违规类型 | 原因 | 修复方案 |
|----------|------|----------|
| L5 → L2 直连 | 组件直接 import dataLayer | 改经 Store 或 Service |
| services 直写 db | service 直接 import db | 改用 DataBridge.forward() |
| lib 依赖 services | 工具函数依赖业务 | 下沉到 core 或注入参数 |

#### 14.2 audit:hardcode — 硬编码审计

**用途**：检测魔法数字、硬编码颜色、业务阈值

```bash
npm run audit:hardcode
```

**常见违规与修复**：

| 违规类型 | 修复方案 |
|----------|----------|
| 魔法数字 | 提取到 constants/ 或 config/ |
| 硬编码颜色 | 改用设计令牌 |
| 业务阈值 | 迁移到配置层，支持运行时覆盖 |

#### 14.3 audit:atomic — 组件层级审计

**用途**：检查原子设计层级违规

```bash
npm run audit:atomic
```

**常见违规**：Atom 引用 Store/Service、Molecule 引用 Organism

#### 14.4 audit:routes — 路由一致性

**用途**：检查注册路由与实际文件是否一致

```bash
npm run audit:routes
```

**检查项**：孤儿路由、未注册页面、路径不匹配

#### 14.5 audit:complexity — 复杂度审计

**用途**：检测代码复杂度过高

```bash
npm run audit:complexity
```

**阈值**：
- 函数行数：≤ 50 行
- 圈复杂度：≤ 10
- 嵌套深度：≤ 3 层

---

## 第五篇：架构与设计

### 十五、架构分层规则

#### 15.1 六层架构与依赖方向

```
L6 外部依赖层：mcp/、fetcher/、llm/
    ↑ 可被上层调用
L5 展示层：pages/、components/、portal/、cockpit/
    ↑
L4 应用层：apps/（五舱入口）
    ↑
L3 引擎/服务层：services/、core/
    ↑
L2 数据层：data/
    ↑
L1 基础设施层：lib/、config/、constants/、types/
```

**核心规则**：上层可依赖下层，下层不可依赖上层

#### 15.2 各层职责与约束

| 层 | 可依赖 | 禁止依赖 | 关键约束 |
|----|--------|----------|----------|
| L5 表现层 | store / services | 直连 db / dataLayer | 仅经 Store 取数 |
| L4 应用层 | services / store / core | 直连 db | 业务编排，不写数据 |
| L3 服务层 | core / data / lib | 直连 db（写必须经 DataBridge） | 业务逻辑封装 |
| L3 core | — | pages/components/apps/lib 业务模块 | 纯基础设施 |
| L2 数据层 | lib / config / types | 任何上层模块 | 数据访问封装 |
| L1 基础设施 | 零依赖 | 任何运行时模块 | 纯工具/配置/类型 |

**验证**：`npm run audit:layers`

> **详细架构**：[team-handbook/02-architecture.md](./02-architecture.md)、[AGENTS.md](../../meta/AGENTS.md)

---

### 十六、DataBridge 写入规范

#### 16.1 为什么用 DataBridge

- ? 可审计：所有写入有记录
- ? 可追溯：traceId 追踪来源
- ? ACL 控制：细粒度权限
- ? 自动广播：写后自动通知订阅方
- ? 统一入口：所有写操作一个入口

#### 16.2 信封消息格式

```typescript
interface StandardEnvelope {
  meta: {
    source: string;           // 来源模块
    target: string;           // 目标 Store/资源
    action: string;           // 操作类型
    traceId: string;          // 追踪 ID
    timestamp: number;        // 时间戳
    userId?: string;          // 用户 ID
  };
  payload: Record<string, any>; // 数据负载
}
```

#### 16.3 正确写入流程

```typescript
import { dataBridge } from '@/core/databridge';
import { EnvelopeFactory } from '@/core/envelope';

// ? 正确：经 DataBridge 写入
async function addScore(score: ScoreData) {
  const envelope = EnvelopeFactory.create({
    source: 'scoreService',
    target: 'scores',
    action: 'add',
    payload: score,
  });
  await dataBridge.forward(envelope);
}

// ? 错误：直接写 db
async function addScore(score: ScoreData) {
  await db.scores.put(score);  // 禁止！
}
```

#### 16.4 读取数据

```typescript
// 读操作：dataBridge.query 或直接 dataLayer
const scores = await dataBridge.query('scores', 'getAll');
```

> **注意**：读操作可直接走 dataLayer，但写操作必须经 DataBridge

---

### 十七、Store 开发指南

#### 17.1 Store 四件套

新增 Store 必须同步四个位置：

| # | 位置 | 说明 |
|---|------|------|
| 1 | `src/data/types/xxx.types.ts`（占位示例，非实际文件） | 类型定义 |
| 2 | `src/data/schema/xxx.schema.ts`（占位示例，非实际文件） | IndexedDB Schema |
| 3 | `src/store/useXxxStore.ts`（占位示例，非实际文件） | Zustand Store |
| 4 | `src/core/acl.ts` 中 ACL_MATRIX | 权限配置 |

#### 17.2 Store 模板

```typescript
import { create } from 'zustand';
import { withBroadcast } from './middleware/withBroadcast';
import { dataBridge } from '@/core/databridge';

interface XxxState {
  // 状态
  items: XxxItem[];
  loading: boolean;
  error: string | null;

  // 同步操作
  setItems: (items: XxxItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 异步操作
  fetchItems: () => Promise<void>;
  addItem: (item: XxxItem) => Promise<void>;
}

export const useXxxStore = create<XxxState>()(
  withBroadcast(
    (set, get) => ({
      items: [],
      loading: false,
      error: null,

      setItems: (items) => set({ items }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      fetchItems: async () => {
        set({ loading: true, error: null });
        try {
          const items = await dataBridge.query('xxx', 'getAll');
          set({ items });
        } catch (e) {
          set({ error: (e as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      addItem: async (item) => {
        // 写操作经 DataBridge
        const envelope = EnvelopeFactory.create({
          source: 'xxxStore',
          target: 'xxx',
          action: 'add',
          payload: item,
        });
        await dataBridge.forward(envelope);
        // 自动广播后 Store 会更新，无需手动 set
      },
    }),
    { name: 'xxx' }
  )
);
```

> **详细指南**：[how-to-add-store.md](../how-to/how-to-add-store.md)、[store-integration-guide.md](../../reference/ai/store-integration-guide.md)

---

### 十八、Service 开发指南

#### 18.1 Service 职责

- 封装业务逻辑
- 协调多个 Store/数据源
- 业务规则验证
- 错误处理与降级
- 不直接操作 DOM，不依赖 React

#### 18.2 Service 模板

```typescript
import { dataBridge } from '@/core/databridge';
import { EnvelopeFactory } from '@/core/envelope';
import { logger } from '@/lib/logger';

export const xxxService = {
  /**
   * 描述业务操作
   * @param param 参数说明
   * @returns 返回值说明
   * @throws 什么情况下抛出异常
   */
  async doSomething(param: XxxParam): Promise<XxxResult> {
    logger.info('[xxxService] doSomething', { param });

    // 1. 参数验证
    if (!param.id) {
      throw new Error('[xxxService] param.id is required');
    }

    // 2. 业务逻辑
    const result = await someBusinessLogic(param);

    // 3. 写操作经 DataBridge
    const envelope = EnvelopeFactory.create({
      source: 'xxxService',
      target: 'xxx',
      action: 'update',
      payload: result,
    });
    await dataBridge.forward(envelope);

    logger.info('[xxxService] doSomething success', { resultId: result.id });
    return result;
  },
};
```

> **详细指南**：[how-to-add-service.md](../how-to/how-to-add-service.md)、[service-integration-guide.md](../../archive/historical-2026-08-16/batch7/docs/reference/ai/service-integration-guide.md（已归档）)

---

### 十九、Widget 开发指南

#### 19.1 Widget 三处注册

新增 Widget 必须同步三个位置：

| # | 位置 | 说明 |
|---|------|------|
| 1 | `src/cockpit/core/widgetRegistry.ts` | 注册组件和默认布局 |
| 2 | `src/constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG` | 配置元信息 |
| 3 | `src/constants/cockpit.constants.ts` 的 `WIDGET_DEFAULT_DATA_SOURCE` | 数据源配置 |

**验证**：`npm run audit:widget-registry`

#### 19.2 Widget 开发步骤

1. 在 `src/cockpit/widgets/` 下创建组件
2. 使用 `useMarketData()` 获取数据
3. 复用 `WidgetStateShell` 四态外壳
4. 在三处注册
5. 验证 `audit:widget-registry` 通过

> **详细指南**：[how-to-add-widget.md](../how-to/how-to-add-widget.md)、[widget-development-guide.md](../widget-development-guide.md)

---

## 第六篇：问题排查与经验

### 二十、常见问题排查

#### 20.1 类型检查失败

```bash
# 运行类型检查
npm run typecheck
```

**常见原因**：
- 新增类型未导出
- import 路径错误
- 类型不匹配
- 泛型参数缺失

**排查步骤**：
1. 查看 tsc 报错信息，定位文件和行号
2. 检查相关类型定义是否正确
3. 检查 import 路径是否正确
4. 不确定时用类型守卫收窄类型

---

#### 20.2 分层审计违规

```bash
npm run audit:layers
```

**常见违规**：

| 违规模式 | 修复方案 |
|----------|----------|
| 组件直接 import dataLayer | 改经 Store 或 Service 获取数据 |
| Service 直接写 db | 改用 DataBridge.forward() |
| lib 层依赖 services | 将依赖下沉到 core 或通过参数注入 |

---

#### 20.3 硬编码审计警告

```bash
npm run audit:hardcode
```

**修复优先级**：
1. ?? 业务阈值 → 移到 config/
2. ?? 颜色值 → 改用设计令牌
3. ?? 魔法数字 → 提取为常量
4. ?? 测试用例中的数字 → 可豁免

---

#### 20.4 组件层级违规

```bash
npm run audit:atomic
```

**常见问题**：
- Atom 组件引用了 Store → 应提升为 Molecule 或 Organism
- Molecule 引用了 Organism → 重新考虑组件归属
- 组件放错了目录 → 移动到正确层级

---

#### 20.5 白屏/页面不显示

**排查步骤**：
1. 打开 DevTools 查看 Console 错误
2. 检查 Network 面板是否有资源加载失败
3. 检查路由配置是否正确
4. 检查组件导入路径是否正确
5. 检查 Store 初始化是否有异常

> **注意**：React Router v7 嵌套 Routes 行为变更——绝对路径在嵌套 Routes 中可能失效，需要用相对路径或调整路由结构。

---

#### 20.6 状态不同步/数据不更新

**常见原因**：
- 写操作没经 DataBridge，没触发广播
- Store 没有正确使用 withBroadcast
- 组件没订阅正确的 Store 状态
- 引用没变导致不重新渲染（深拷贝问题）

**排查步骤**：
1. 确认写操作走 DataBridge
2. 确认 Store 用了 withBroadcast
3. 在 DevTools 中检查 Store 状态
4. 检查组件是否正确订阅状态

---

### 二十一、经验教训速查

#### 21.1 Top 10 教训

| # | 教训 | 严重级 | 一句话提醒 |
|---|------|--------|-----------|
| 1 | "配置恢复" ≠ "功能恢复" | ?? P0 | 配置有了≠源码有了，三重验证 |
| 2 | 注册时禁止静默失败 | ?? P0 | 失败就抛异常，不要只打日志 |
| 3 | 框架与业务必须同步落地 | ?? P0 | 不要建空壳框架，业务要跟上 |
| 4 | 单例模式需明确约束 | ?? P0 | Engine 独立 new 实例，单例白建 |
| 5 | 业务参数必须配置化 | ?? P0 | 不要硬编码 1,913 个魔法数字 |
| 6 | Promise 必须捕获 rejection | ?? P0 | 未处理 rejection 可能导致崩溃 |
| 7 | 第三方库升级验证关键行为 | ?? P0 | Router v7 嵌套路径行为变了 |
| 8 | 严格遵循分层架构 | ?? P0 | L4 直接 import L6 是违规 |
| 9 | 文档同步纳入 DoD | ?? P1 | 代码写完≠功能完，文档要同步 |
| 10 | 静态分析易被表面误导 | ?? P1 | 不要只看代码下结论，要运行时证据 |

#### 21.2 预防检查清单

**每次提交前**（5 分钟）：
- [ ] `npm run audit:layers` → 0 violations
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run audit:hardcode` → 确认非误报
- [ ] 新增文件已同步注册（Registry/Store/Config/Routes）
- [ ] 新增配置字段有对应的消费逻辑

**每次 PR 合并前**（10 分钟）：
- [ ] 新增 MCP Server 通过 9 项检查清单
- [ ] 新增 Agent 有真实 handler，非占位符
- [ ] 新增功能：相关文档至少更新一份
- [ ] 新增业务参数已迁移到配置层
- [ ] 新增测试：单元测试覆盖 + 关键路径 e2e 覆盖

**每次版本发布前**（30 分钟）：
- [ ] 文件存在性 vs 配置注册一致性
- [ ] 文档-代码双向一致性
- [ ] 全量测试通过（单元 + e2e）
- [ ] 质量门禁全通过
- [ ] Router 版本兼容性验证
- [ ] SKILL 方法论与代码权重表对齐

> **完整教训库**：[development-lessons-learned.md（已归档）](../../archive/normal/reports/development-lessons-learned.md)、lessons-learned-summary.md（已归档）

---

### 二十二、调试方法论

#### 22.1 科学调试五步法

```
假设 → 证伪 → 证据 → 修复 → 验证
```

**Step 1：提出假设**
- 基于静态分析和错误信息
- 列出可能的根因（至少 2-3 个）

**Step 2：证伪排除**
- 用运行时证据推翻错误假设
- 不要停留在"看起来像是"

**Step 3：收集证据**
- 定位真实根因
- 用 console/debugger/网络面板收集证据

**Step 4：实施修复**
- 针对真实根因修复
- 不要用 workaround 掩盖问题

**Step 5：验证修复**
- 确认修复有效
- 确认没有引入新问题
- 回归测试相关功能

#### 22.2 调试工具

| 工具 | 用途 |
|------|------|
| React DevTools | 组件树、Props、State、Hooks |
| Redux DevTools | Zustand Store 状态查看 |
| Chrome DevTools | 断点调试、性能分析、网络 |
| Application 面板 | IndexedDB 数据查看 |
| Console | 日志输出、错误堆栈 |

---

## 第七篇：文档与知识

### 二十三、文档编写规范

#### 23.1 Frontmatter 模板

```yaml
---
title: 文档标题
tier: important | reference | supporting
code_version: 2.0.0
version: v1.0.0
last_updated: 2026-07-17
maintainer: 维护者
status: active | deprecated | draft
change_log:
  - date: 2026-07-17
    author: 作者
    desc: 变更描述
---
```

#### 23.2 文档分类（Diátaxis）

| 类型 | 用途 | 位置 |
|------|------|------|
| **Tutorials（教程）** | 入门学习，step-by-step | `docs/guides/tutorials/` |
| **How-to（指南）** | 面向目标的操作步骤 | `docs/guides/how-to/` |
| **Reference（参考）** | 技术规范、API、配置 | `docs/reference/` |
| **Explanation（解释）** | 设计思路、深度解析 | `docs/explanation/` |

#### 23.3 文档四大原则（docs-as-mirror）

1. **Truth-First**：先读取真相源（代码）再编写文档
2. **Scan-Before-Write**：编写前扫描实际文件系统
3. **Exhaustiveness**：穷尽性原则覆盖所有文件归属
4. **Bidirectional Linking**：双向引用防止信息孤岛

#### 23.4 文档更新触发

新增/修改模块后，按 `docs/meta/doc-trigger-action-map.md` 同步更新相关文档。

**最低要求**：
- 新增功能 → 至少更新一份 reference 文档
- 新增 Store/Service → 更新数据定义文档
- 新增页面 → 更新路由文档
- 架构变更 → 更新 ADR 或架构文档

> **详细规范**：[doc-style-standard.md](../../meta/doc-style-standard.md)、[jsdoc-convention.md](../../reference/jsdoc-convention.md)

---

### 二十四、知识沉淀与分享

#### 24.1 经验沉淀机制

**触发场景**：
- 踩到新坑 → 添加到 lessons-learned.md
- 找到好方法 → 沉淀为 SKILL 或 How-to
- 架构决策 → 记录为 ADR
- 项目复盘 → 写入 retrospectives/

**记录要求**：
- 背景：什么情况下发生的
- 现象：具体表现是什么
- 根因：根本原因是什么
- 解决方案：怎么解决的
- 预防措施：怎么避免再发生

#### 24.2 SKILL 技能体系

项目沉淀了多个 SKILL 方法论，可在开发中直接调用：

| SKILL | 用途 | 调用场景 |
|-------|------|----------|
| `architecture-cleanup` | 架构清理 | 跨层违规、目录归位 |
| `architecture-radar-scan` | 架构雷达扫描 | 全面健康度检查 |
| `architecture-debt-remediation` | 架构债务修复 | 大组件重构、死组件清理 |
| `docs-as-mirror` | 文档编写 | 新增/更新技术文档 |
| `test-driven-development` | TDD 开发 | 新功能开发 |
| `type-safety-contract` | 类型安全 | 修改 TypeScript 类型前 |
| `v9-gatekeeper` | 前置门禁 | 代码变更前 |
| `databridge-migration` | DataBridge 迁移 | 直写 dataLayer → 信封协议 |
| `constant-migration` | 常量迁移 | 业务常量归位 |
| `db-reference-audit` | 数据库引用审计 | DB 定义一致性检查 |

#### 24.3 团队分享建议

- **每周技术分享**：15-30 分钟，分享踩坑经验或新学知识
- **每月架构复盘**：回顾架构健康度，识别改进点
- **每季度文档体检**：检查文档新鲜度，更新过时内容
- **经验教训入库**：随时记录，定期整理分级

---

## 附录

### 附录 A：快速链接

| 类别 | 文档 | 路径 |
|------|------|------|
| **入门** | 团队手册 README | [team-handbook/README.md](./README.md) |
| | 设计哲学 | [01-design-philosophy.md](./01-design-philosophy.md) |
| | 架构总览 | [02-architecture.md](./02-architecture.md) |
| **架构契约** | AGENTS.md | [AGENTS.md](../../meta/AGENTS.md) |
| | 架构标准 | [03-architecture-standards.md](../../archive/historical-2026-08-16/batch7/docs/explanation/03-architecture-standards.md（已归档）) |
| **开发流程** | 开发工作流 SOP | [development-workflow-sop.md](../../archive/historical-2026-08-16/batch7/docs/reference/development-workflow-sop.md（已归档）) |
| | 编码规范 | [coding-conventions.md](../../reference/coding-conventions.md) |
| | 质量门禁 | [09-quality-gates.md](../09-quality-gates.md) |
| **专项指南** | 新增 Store | [how-to-add-store.md](../how-to/how-to-add-store.md) |
| | 新增 Service | [how-to-add-service.md](../how-to/how-to-add-service.md) |
| | 新增 Widget | [how-to-add-widget.md](../how-to/how-to-add-widget.md) |
| | 代码评审 | [code-review-guide.md](../how-to/code-review-guide.md) |
| **经验教训** | 完整教训库 | [development-lessons-learned.md（已归档）](../../archive/historical-2026-08-16/batch6/docs/reports/project-management/development-lessons-learned.md（已归档）) |
| | 教训摘要 | lessons-learned-summary.md（已归档） |
| | 项目历程 | project-development-journey.md（已归档） |

### 附录 B：命令速查

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run preview      # 预览构建

# 检查
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run lint:fix     # 自动修复

# 测试
npm run test         # 单元测试
npm run test:watch   # 监听模式
npm run test:e2e     # E2E 测试
npm run coverage     # 覆盖率

# 审计
npm run audit:layers    # 分层合规
npm run audit:hardcode  # 硬编码
npm run audit:atomic    # 组件层级
npm run audit:tokens    # 设计令牌
npm run audit:jsdoc     # JSDoc
npm run audit:routes    # 路由一致性
npm run audit:complexity # 复杂度
```

---

> **维护说明**：本指南随项目迭代持续更新，如有遗漏或错误请提交 PR 或联系架构组。
> **反馈建议**：欢迎补充实用的操作技巧和排查经验，共同完善团队知识库。
