---
title: V9 项目开发历程系统梳理
type: reports
domain: project
phase: retrospective
tier: reference
status: active
maintainer: Architecture Team
summary: "文档定位：从项目管理和软件工程视角，系统性梳理 V9 项目的开发全过程，呈现开发脉络、关键决策、挑战与解决方案，帮助团队快速掌握项目全貌。 阅读时长：20 分钟 数据来源：9 份 ADR、36..."
tags: [project, spec, report, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log: 
---

# V9 智能投研复盘系统 — 项目开发历程系统梳理

> **文档定位**：从项目管理和软件工程视角，系统性梳理 V9 项目的开发全过程，呈现开发脉络、关键决策、挑战与解决方案，帮助团队快速掌握项目全貌。
> **阅读时长**：20 分钟
> **数据来源**：9 份 ADR、36 条经验教训、12 份审计报告、实施计划、质量门禁、变更日志等 50+ 份文档

---

## 目录

1. [项目概览](#一项目概览)
2. [开发历程时间轴](#二开发历程时间轴)
3. [各阶段深度梳理](#三各阶段深度梳理)
   - 3.1 需求分析阶段
   - 3.2 架构设计阶段
   - 3.3 编码实现阶段
   - 3.4 测试与质量阶段
   - 3.5 部署与运维阶段
4. [关键架构决策点](#四关键架构决策点adr)
5. [经验教训知识库](#五经验教训知识库)
6. [技能沉淀与方法论](#六技能沉淀与方法论)
7. [与最佳实践对比分析](#七与最佳实践对比分析)
8. [后续改进建议](#八后续改进建议)

---

## 一、项目概览

### 1.1 系统定位

| 维度 | 描述 |
|------|------|
| **产品名称** | V9 智能投研复盘系统 |
| **核心愿景** | 成为中国 A 股个人投资者的研究基础设施 |
| **产品定位** | 不替代券商交易软件，而是研究、分析、决策、复盘的独立工具 |
| **技术架构** | 纯前端 PWA（Browser-Only），无后端服务 |
| **数据存储** | 本地 IndexedDB，用户数据完全自管 |
| **目标用户** | 初级投资者、进阶研究者、长期价值投资者 |

### 1.2 核心价值主张

1. 从"凭感觉买股票" → "数据驱动的研究决策"
2. 从"买完就忘" → "完整的认知积累与复盘闭环"
3. 从"零散信息" → "结构化的知识库与模式识别"
4. 从"追涨杀跌" → "基于 V6 九维评分的系统筛选"
5. 从"单一策略" → "多因子 + 板块轮动 + 择时的组合策略"

### 1.3 设计哲学

- **宋瓷美学**：汝窑天青、官窑粉青、朱砂红、象牙白、高级灰
- **不切屏原则**：所有功能在当前舱内通过 Tab/面板切换实现
- **数据血缘**：每个评分、信号、订单必须可追溯其来源数据版本
- **可删除性**：交易层是可选插件，删除后研究体系完整运行

> **关联文档**：[01-vision-and-goals.md](file:///g:/FinSightV9/docs/reference/01-vision-and-goals.md)

---

## 二、开发历程时间轴

### Phase 0：立项与架构决策（2026-06-20 ~ 06-21）

**核心事件**：确定纯前端架构路线

| 日期 | 事件 | 关键产出 |
|------|------|----------|
| 06-20 | ADR-001 决策 | 纯前端无后端架构（规避合规风险、降低运维成本） |
| 06-20 | ADR-002 决策 | IndexedDB 替代 localStorage（容量、性能、结构） |
| 06-21 | ADR-003 决策 | DataBridge 统一写入网关（ACL、审计、广播） |
| 06-21 | ADR-004 决策 | HashRouter 静态托管方案（适配免费托管） |

### Phase 1：基础骨架搭建（2026-06-22 ~ 06-25）

**核心事件**：五层架构 + 五舱框架落地

| 日期 | 事件 | 关键产出 |
|------|------|----------|
| 06-23 | ADR-005 决策 | PortalShell 深色 Kimi 布局（五舱门户框架） |
| 06-24 | ADR-006 决策 | 输入舱拆分为四子页面 |
| 06-24 | ADR-007 决策 | 补齐筛选/信号/复盘引擎 |
| 06-24 | ADR-008 决策 | 采用 V6 核心资源交易策略 |
| 06-25 | ADR-009 决策 | V6 Pro JSON 全量导出迁移 |
| 06-25 | 规格文档 | Agent Runtime、DataFlow Engine、输入舱业务规格 |
| 06-25 | 数据层 | IndexedDB Schema、数据迁移规范 |

### Phase 2：功能填充与迭代（2026-06-26 ~ 07-05）

**核心事件**：核心功能逐步落地，质量体系建立

| 阶段 | 重点工作 | 关键产出 |
|------|----------|----------|
| 数据采集 | Python 采集服务 + 前端适配 | fetcher 三层架构、采集进度面板 |
| 评分引擎 | V6 九维评分 + LLM 智能评分 | v6ScoreService、intelligentScoreService |
| 股票池 | 五态流转 + 看板/列表视图 | poolTransitionEngine、PoolBoard 组件 |
| 交易引擎 | 信号生成 + 仓位管理 + 风控 | signalGenerator、positionSizer、riskEngine |
| 原子组件 | Atomic Design 四层体系 | atoms/molecules/organisms/templates |
| 质量门禁 | 13 项质量门禁建立 | audit:layers、audit:hardcode、audit:routes 等 |

### Phase 3：架构治理与优化（2026-07-06 ~ 07-16）

**核心事件**：系统性架构清理、债务偿还、体系完善

| 阶段 | 重点工作 | 关键产出 |
|------|----------|----------|
| 架构清理 | 跨层违规修复、目录归位 | architecture-cleanup SKILL、11 个域 63 文件迁移 |
| DataBridge 完善 | 系统管理方法、迁移直写 | init/exportAll/importAll/resetAll 四方法 |
| 文档治理 | Frontmatter 注入、健康度评分 | 31 份文档全部 ?? 健康 |
| 经验沉淀 | 36 条结构化教训 | lessons-learned.md（P0:9 / P1:20 / P2:7） |
| 开发流程 | SOP 标准化 | development-workflow-sop.md（四阶段 14 步门禁） |

> **关联文档**：[timeline-report.md](file:///g:/FinSightV9/docs/reports/retrospectives/timeline-report.md)、[v9-current-state-review.md](file:///g:/FinSightV9/docs/reports/retrospectives/v9-current-state-review.md)

---

## 三、各阶段深度梳理

### 3.1 需求分析阶段

#### 3.1.1 需求来源与约束

| 约束类型 | 具体内容 | 对技术选型的影响 |
|----------|----------|-----------------|
| **合规约束** | 金融数据投资建议涉及合规风险，个人开发者难以承担监管责任 | 纯前端架构，AI 输出标注"仅供参考" |
| **成本约束** | 独立开发者无法承担服务器运维成本（数据库、CDN、SSL、备案） | 静态托管、本地存储、PWA 离线 |
| **隐私约束** | 用户持仓、交易记录等敏感数据不应上传第三方服务器 | 本地 IndexedDB，数据不出浏览器 |
| **离线需求** | 用户需要在无网络环境下查看已采集的数据 | Service Worker 缓存 + 本地数据 |

#### 3.1.2 需求分析方法

- **用户分层**：初级投资者 → 进阶研究者 → 长期价值投资者
- **场景拆解**：选股 → 评分 → 模拟交易 → 持仓复盘 闭环
- **竞品分析**：V6 Pro 产品差异全量对比（256 项差异）
- **V 模型映射**：需求 ? 功能规格 ? 架构设计 ? 代码实现 ? 测试验证

#### 3.1.3 关键产物

| 产物 | 路径 | 说明 |
|------|------|------|
| 愿景与目标 | [01-vision-and-goals.md](file:///g:/FinSightV9/docs/reference/01-vision-and-goals.md) | 系统定位、用户画像、价值主张 |
| 功能规格 | [02-functional-specs.md](file:///g:/FinSightV9/docs/reference/02-functional-specs.md) | 功能清单、用户故事、验收标准 |
| 竞品分析 | [v6pro-ui-page-diff-report.md](file:///g:/FinSightV9/docs/explanation/design/v6pro-ui-page-diff-report.md) | V6 Pro vs V9 全量差异对比 |
| 迁移分析 | [v6pro-to-v9-migration-analysis.md](file:///g:/FinSightV9/docs/explanation/design/v6pro-to-v9-migration-analysis.md) | 源码比对与模块梳理 |

---

### 3.2 架构设计阶段

#### 3.2.1 架构设计原则

1. **纯前端优先**：最大化本地计算，最小化服务依赖
2. **分层隔离**：六层架构，依赖单向流动
3. **数据自管**：用户数据完全本地存储，隐私优先
4. **可插拔设计**：交易层可选，研究层独立完整
5. **信封化写入**：所有写操作经 DataBridge 统一网关

#### 3.2.2 六层架构体系

```
┌─────────────────────────────────────────────────┐
│  L6 外部依赖层：mcp/、fetcher/、llm/            │
│  MCP Server、数据采集、LLM 调用                   │
├─────────────────────────────────────────────────┤
│  L5 展示层：pages/、components/、portal/、cockpit/│
│  页面、可复用 UI 组件、门户导航、驾驶舱            │
├─────────────────────────────────────────────────┤
│  L4 应用层：apps/（输入/分析/交易/输出/总控五舱）  │
│  五舱应用入口、业务编排、子页面组合                 │
├─────────────────────────────────────────────────┤
│  L3 引擎/服务层：services/、core/                 │
│  业务服务、筛选/评分/交易/风控/采集引擎、DataBridge│
├─────────────────────────────────────────────────┤
│  L2 数据层：data/                                 │
│  IndexedDB 封装、统一数据接口、类型定义            │
├─────────────────────────────────────────────────┤
│  L1 基础设施层：lib/、config/、constants/         │
│  事件总线、日志、工具函数、各类配置、主题令牌       │
└─────────────────────────────────────────────────┘
```

**依赖方向规则**：上层可依赖下层，下层不可依赖上层
- L5/L4 → 只能依赖 L3/L2，禁止直接调用 dataLayer 或 db 写操作
- L3 → 只能依赖 L2/L1，写入必须经 DataBridge.forward()
- L2 → 数据层封装 IndexedDB，提供统一 CRUD 接口
- L1 → 零业务依赖，纯基础设施

#### 3.2.3 核心设计模式

| 模式 | 应用场景 | 实现位置 |
|------|----------|----------|
| **信封模式** | 跨模块写操作 | `src/core/databridge.ts` |
| **状态机模式** | 股票池流转 | `src/core/poolTransitionEngine.ts` |
| **仓库模式** | 数据访问层 | `src/data/dataLayer.ts` |
| **发布订阅** | 跨组件通信 | `src/lib/eventBus.ts` |
| **策略模式** | 评分因子计算 | `src/services/scoring/v6-engine/calculators/` |
| **原子设计** | UI 组件体系 | `src/components/{atoms,molecules,organisms,templates}/` |

#### 3.2.4 关键架构文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 架构契约 | [AGENTS.md](file:///g:/FinSightV9/AGENTS.md) | AI 行为约束、分层规则、目录规范 |
| 系统蓝图 | [v9-system-blueprint.md](file:///g:/FinSightV9/docs/reference/v9-system-blueprint.md) | 整体架构蓝图、模块依赖 |
| 架构标准 | [03-architecture-standards.md](file:///g:/FinSightV9/docs/reference/03-architecture-standards.md) | 架构设计标准与规范 |
| 数据架构 | [v9-data-relationship-er.md](file:///g:/FinSightV9/docs/explanation/v9-data-relationship-er.md) | 数据关系 ER 图 |
| 数据宪法 | [V9数据宪法.md](file:///g:/FinSightV9/docs/reference/V9%E6%95%B0%E6%8D%AE%E5%AE%AA%E6%B3%95.md) | 数据治理最高准则 |

---

### 3.3 编码实现阶段

#### 3.3.1 开发工作流 SOP

```
┌─────────────────────────────────────────────────┐
│  Phase 1: 编码前（查询 → 设计 → 验证基线）        │
│    ↓ AI 记忆查询 / 任务图建立 / 架构审计 / 四步集成│
├─────────────────────────────────────────────────┤
│  Phase 2: 编码中（开发 → 实时纠偏 → 本地测试）    │
│    ↓ 分层守护 / 颜色令牌 / JSDoc 补齐 / 复杂度监控 │
├─────────────────────────────────────────────────┤
│  Phase 3: 编码后（提交 → 门禁验证 → 覆盖率追踪）  │
│    ↓ Husky 14 步阻断门禁 + 测试分层 / 文档同步     │
├─────────────────────────────────────────────────┤
│  Phase 4: 上线后（日志 → 复盘 → 知识沉淀）        │
│    ↓ 结构化变更日志 / 质量指标快照 / 经验教训入库   │
└─────────────────────────────────────────────────┘
```

#### 3.3.2 四步集成契约（新增模块）

任何新模块必须按以下顺序逐步实现，每步可独立回滚：

| 步骤 | 内容 | 位置 | 验证 |
|------|------|------|------|
| **Step 1** | 类型定义 | `src/types/modules/` 或 `src/data/types/` | `tsc --noEmit` |
| **Step 2** | Store 状态 | `src/store/`（Zustand + withBroadcast） | 单元测试 |
| **Step 3** | Service 服务 | `src/services/`（经 DataBridge 写数据） | `audit:layers` |
| **Step 4** | UI 组件 | `src/pages/` 或 `src/components/`（仅经 Store 取数） | 集成测试 |

#### 3.3.3 编码规范要点

| 规范类别 | 核心规则 | 验证方式 |
|----------|----------|----------|
| **类型安全** | 禁止 any、禁止 @ts-ignore、外部输入用 zod 验证 | `tsc --noEmit` + ESLint |
| **零硬编码** | 引擎层阈值从配置注入、UI 层用颜色令牌、≥3 位数字提取 const | `audit:hardcode` + `lint:colors` |
| **分层合规** | 禁止跨层调用、禁止直写 db、写操作必须走 DataBridge | `audit:layers` |
| **日志规范** | 核心分支 logger.info、错误日志含 context、前缀 `[模块名] 操作名` | 代码审查 |
| **事件清理** | subscribe ? unsubscribe 配对、定时器清理、禁止 EventBus.clear() | `audit:hardcode` 专项检查 |
| **文档注释** | 公共函数/组件/Hook/Store 必须补 JSDoc | `audit:docs` |

#### 3.3.4 组件体系（Atomic Design）

```
src/components/
├── atoms/          ← 原子组件（43+）：Button、Input、Card、Badge...
├── molecules/      ← 分子组件（19+）：FormField、MetricCard、SearchBar...
├── organisms/      ← 组织组件（63+）：PoolBoard、CollectionProgressPanel...
├── templates/      ← 模板组件：DashboardLayout、SidebarLayout...
└── ui/             ← 兼容层（纯 re-export shim），向后兼容
```

**迁移策略**：物理迁移 + shim 兼容 → 消费者零改动 → 逐步清理 shim

#### 3.3.5 关键编码文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 开发工作流 SOP | [development-workflow-sop.md](file:///g:/FinSightV9/docs/reference/development-workflow-sop.md) | 四阶段完整工作流 |
| 编码规范 | [coding-conventions.md](file:///g:/FinSightV9/docs/reference/coding-conventions.md) | 一页速查编码规范 |
| 复杂度治理 | [complexity-governance.md](file:///g:/FinSightV9/docs/reference/complexity-governance.md) | 代码复杂度管控 |
| JSDoc 规范 | [jsdoc-convention.md](file:///g:/FinSightV9/docs/reference/jsdoc-convention.md) | 文档注释规范 |
| 原子组件体系 | [atomic-component-system.md](file:///g:/FinSightV9/docs/reference/atomic-component-system.md) | UI 组件层级定义 |

---

### 3.4 测试与质量阶段

#### 3.4.1 质量门禁体系（13 项）

| # | 门禁项 | 目标 | 命令 | 当前状态 |
|---|--------|------|------|----------|
| 1 | TypeScript 类型检查 | 0 errors | `tsc --noEmit` | ? 通过 |
| 2 | ESLint 代码规范 | 0 warnings/errors | `npm run lint` | ? 通过 |
| 3 | 单元测试 | 全部通过 | `npm run test` | ? 5300+ 通过 |
| 4 | 生产构建 | 产物生成成功 | `npm run build` | ? 通过 |
| 5 | 跨层调用审计 | 0 违规 | `npm run audit:layers` | ? 0 违规 |
| 6 | 硬编码审计 | 0 业务硬编码 | `npm run audit:hardcode` | ?? 基线债务 |
| 7 | 死代码审计 | 0 空壳/漂移 | `npm run audit:deadcode` | ? 通过 |
| 8 | 测试覆盖率 | core≥85% services≥70% | `npm run coverage` | ?? 部分达标 |
| 9 | E2E 冒烟测试 | 0 失败 | `npm run test:e2e` | ? 通过 |
| 10 | 路由一致性 | 0 漂移 | `npm run audit:routes` | ? 64/64 |
| 11 | PWA 离线验证 | SW 注册成功 | 手动/Playwright | ?? 待建立 |
| 12 | 数据蓝图一致性 | Store/类型/文档一致 | `validate:blueprint` | ? 通过 |
| 13 | 踩坑规则门禁 | 0 ERROR | `python scripts/pitfall_check.py` | ? 通过 |

#### 3.4.2 测试策略分层

| 测试层级 | 框架 | 覆盖目标 | 示例 |
|----------|------|----------|------|
| **单元测试** | Vitest + jsdom | 工具函数、纯计算逻辑 | poolTransitionEngine.test.ts |
| **服务测试** | Vitest + fake-indexeddb | 业务服务、数据层 | fetcherService.test.ts |
| **集成测试** | Vitest + DataBridge mock | 跨模块交互、数据流 | databridge.test.ts |
| **E2E 测试** | Playwright | 关键用户路径、页面渲染 | 输出舱 20 个用例 |
| **类型测试** | Expect<Equals> | 类型安全、泛型约束 | user-type.spec.ts |

#### 3.4.3 审计工具链

| 工具 | 用途 | 检测内容 |
|------|------|----------|
| `audit:layers` | 分层合规 | 跨层调用违规、依赖方向检查 |
| `audit:hardcode` | 硬编码检测 | 魔法数字、硬编码颜色、业务阈值 |
| `audit:routes` | 路由一致性 | 注册 vs 实际路径比对、孤儿路由 |
| `audit:deadcode` | 死代码检测 | 空壳文件、未使用导出、未注册页面 |
| `audit:docs` | 文档一致性 | 代码-文档双向一致性 |
| `audit:atomic` | 组件层级 | 原子组件边界违规 |
| `audit:tokens` | 设计令牌 | UI 硬编码颜色检测 |
| `audit:db-references` | 数据库引用 | Store/Schema/ACL 一致性 |

#### 3.4.4 关键质量文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 质量门禁 | [09-quality-gates.md](file:///g:/FinSightV9/docs/reference/09-quality-gates.md) | 13 项门禁详解 |
| 测试策略 | [testing-strategy.md](file:///g:/FinSightV9/docs/reference/testing-strategy.md) | 分层测试策略 |
| 技术债管理 | [tech-debt.md](file:///g:/FinSightV9/docs/explanation/design/tech-debt.md) | 技术债登记与跟踪 |
| 代码质量看板 | [v9-code-quality-audit-report-20260629.md](file:///g:/FinSightV9/docs/reports/audit/v9-code-quality-audit-report-20260629.md) | 代码质量审计报告 |
| 踩坑规则门禁 | [踩坑规则门禁指南.md](file:///g:/FinSightV9/docs/reference/%E8%B8%A9%E5%9D%91%E8%A7%84%E5%88%99%E9%97%A8%E7%A6%81%E6%8C%87%E5%8D%97.md) | 14 条踩坑规则 |

---

### 3.5 部署与运维阶段

#### 3.5.1 构建产物结构

```
dist/
├── index.html              # 入口 HTML
├── assets/
│   ├── index-*.js          # 主入口 chunk
│   ├── vendor-*.js         # 框架 chunk（react、zustand、dayjs）
│   ├── ui-*.js             # UI 组件 chunk
│   ├── charts-*.js         # 图表 chunk（recharts、lightweight-charts）
│   ├── pdf-*.js            # PDF 导出 chunk（懒加载）
│   ├── excel-*.js          # Excel 处理 chunk（懒加载）
│   └── index-*.css         # Tailwind + 全局样式
├── icons/                  # PWA 图标
├── manifest.json           # PWA 配置
└── health-report.json      # 架构健康报告
```

#### 3.5.2 部署方案

| 方案 | 适用场景 | 配置要点 |
|------|----------|----------|
| **GitHub Pages** | 开源项目、免费托管 | HashRouter、base 路径配置 |
| **Vercel** | 快速部署、自动 CI | Environment Variables、自定义域名 |
| **Netlify** | 静态托管、边缘函数 | _redirects、_headers 配置 |
| **本地部署** | 私有化部署 | nginx 静态资源配置 |

#### 3.5.3 数据迁移策略

- **版本管理**：`DB_VERSION` 递增，每次 Schema 变更编写迁移脚本
- **迁移接口**：`Migration` 接口统一 `migrate(db)` 方法
- **向前兼容**：新代码可旧数据，通过迁移脚本自动升级
- **导入导出**：全量 JSON 导入/导出，支持跨设备数据迁移

#### 3.5.4 关键运维文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 部署基线 | [deployment.md](file:///g:/FinSightV9/docs/reference/deployment.md) | 构建产物、部署配置、回滚方案 |
| 运行手册 | [runbook.md](file:///g:/FinSightV9/docs/explanation/runbook.md) | 日常运维操作指南 |
| 回滚方案 | [buildscoredocdiff-rollback-plan.md](file:///g:/FinSightV9/docs/reports/release-management/buildscoredocdiff-rollback-plan.md) | 版本回滚预案 |
| 发布检查清单 | [pre-testing-checklist.md](file:///g:/FinSightV9/docs/04-testing/pre-testing-checklist.md) | 发布前检查项 |

---

## 四、关键架构决策点（ADR）

### ADR-001：纯前端无后端架构

- **决策日期**：2026-06-20
- **状态**：Accepted
- **背景**：合规风险、运维成本、数据隐私、离线需求
- **决策**：采用 Browser-Only PWA，无后端服务
- **备选方案**：Serverless、混合架构、Electron 桌面应用
- **后果**：零运维成本 + 数据隐私 + 离线可用，但计算能力受限

> **详细文档**：[adr-001-pure-frontend-architecture.md](file:///g:/FinSightV9/docs/explanation/adr-001-pure-frontend-architecture.md)

### ADR-002：IndexedDB 替代 localStorage

- **决策日期**：2026-06-20
- **状态**：Accepted
- **背景**：localStorage 5MB 容量不足、同步阻塞 UI、无索引查询
- **决策**：IndexedDB 作为唯一本地持久化方案
- **备选方案**：localStorage、sql.js、OPFS
- **后果**：容量扩展到 50MB+、异步不阻塞、支持索引查询

> **详细文档**：[adr-002-indexeddb-over-localstorage.md](file:///g:/FinSightV9/docs/reference/adr-002-indexeddb-over-localstorage.md)

### ADR-003：DataBridge 统一写入网关

- **决策日期**：2026-06-21
- **状态**：Accepted（v1.1.0 增补系统管理方法）
- **背景**：来源不可追溯、权限分散、审计缺失、无事件广播
- **决策**：所有跨模块写操作经 `DataBridge.forward(envelope)`
- **备选方案**：直写 dataLayer、Repository 模式、Middleware 拦截
- **后果**：可审计 + 可追溯 + ACL 控制 + 自动广播，但增加样板代码

> **详细文档**：[adr-003-databridge-over-direct-datalayer.md](file:///g:/FinSightV9/docs/reference/adr-003-databridge-over-direct-datalayer.md)

### ADR-004：HashRouter 静态托管

- **决策日期**：2026-06-21
- **状态**：Accepted
- **背景**：静态托管不支持 history 模式的服务端 fallback
- **决策**：使用 HashRouter 适配免费静态托管
- **影响**：URL 带 `#`，但部署简单，无需服务端配置

### ADR-005：PortalShell 深色 Kimi 布局

- **决策日期**：2026-06-23
- **状态**：Accepted
- **背景**：金融研究工具需要沉浸式深色体验
- **决策**：五舱门户框架 + 深色模式默认
- **影响**：宋瓷美学设计语言、统一导航体验

### ADR-006 ~ ADR-009

| ADR | 日期 | 决策 | 关键影响 |
|-----|------|------|----------|
| ADR-006 | 06-24 | 输入舱拆分为四子页面 | Dashboard / BulkImport / HotSector / DataTest |
| ADR-007 | 06-24 | 补齐筛选/信号/复盘引擎 | 三引擎支撑投研闭环 |
| ADR-008 | 06-24 | 采用 V6 核心资源交易策略 | 继承成熟交易方法论 |
| ADR-009 | 06-25 | V6 Pro JSON 全量导出迁移 | 历史数据平滑过渡 |

> **ADR 目录**：[adr/](file:///g:/FinSightV9/docs/explanation/adr/)

---

## 五、经验教训知识库

### 5.1 教训统计总览

| 严重级 | 数量 | 占比 | 核心特征 |
|--------|------|------|----------|
| ?? P0 | 9 | 25.0% | 系统阻断性、数据丢失、进程崩溃、功能名不副实 |
| ?? P1 | 20 | 55.6% | 架构决策、类型安全、文档断层、调试效率、分层合规 |
| ?? P2 | 7 | 19.4% | 可维护性、状态管理、知识噪音、方法论差距 |

**总 36 条**结构化教训，覆盖 11 个主题域。

### 5.2 Top 10 关键教训

| # | 教训 | 严重级 | 一句话总结 |
|---|------|--------|----------|
| 1 | **"配置恢复" ≠ "功能恢复"** | ?? P0 | 6 个 MCP Server 注册表有但源码缺失，恢复操作须三重验证 |
| 2 | **注册时静默失败的危害** | ?? P0 | module not found 仅打日志不抛异常，错误被淹没 |
| 3 | **Agent 运行时与业务脱节** | ?? P0 | 5 个 Agent 全是空壳，AI 功能直接调用 LLM 绕过框架 |
| 4 | **Engine 双实例导致状态隔离** | ?? P0 | Engine 层独立 new AgentRuntime，全局单例白建 |
| 5 | **业务参数硬编码泛滥** | ?? P0 | 1,913 个 magic numbers，评分引擎配置化率仅 13% |
| 6 | **core/databridge 未捕获 Promise** | ?? P0 | 59 处未处理 rejection，可能导致进程崩溃 |
| 7 | **React Router v7 行为变更** | ?? P0 | 嵌套 Routes 绝对路径匹配失效，导致白屏 |
| 8 | **应用层跨层调用 L6** | ?? P0 | L4 直接 import L6 fetcher/llm，违反六层架构 |
| 9 | **RBAC 文档断层** | ?? P1 | 代码已实现完整权限系统，核心文档完全无记录 |
| 10 | **静态分析易被表面现象误导** | ?? P1 | 仅看代码误诊为"路由未注册"，实际需运行时证据 |

### 5.3 按主题分类的教训

#### 主题 1：MCP Server 治理（教训 1-6）
- 配置恢复 ≠ 功能恢复（配置+源码+启动日志三重验证）
- 注册时禁止静默失败
- 诊断必须先验证事实基线
- 文档-代码绑定规则
- 参数复杂度门禁（≤5 个参数）
- Store 持久化设计须考虑数据生命周期

#### 主题 2：Agent 运行时与架构（教训 7-10）
- 框架与业务必须同步落地
- 单例模式需明确约束和文档
- 配置字段必须有对应的消费逻辑
- 初始化必须纳入 bootstrap 流程

#### 主题 3：代码质量与硬编码（教训 11-12）
- 业务参数必须配置化
- Promise 必须捕获 rejection

#### 主题 4：UI 与路由层（教训 14-15）
- 第三方库升级后必须验证关键行为
- 严格遵循分层架构隔离

#### 主题 5：类型系统与分层合规（教训 16-17）
- 禁止 any 和 as 泛滥
- 明确规则的例外场景

#### 主题 6：数据层与状态管理（教训 18, 28-33）
- 组件状态按四步集成上提 Store
- 新增 Store 必须同步四个位置（STORE_NAME/Schema/ACL/dataLayer）
- 业务实体类型应归位数据层
- services 层直写 dataLayer 是 ACL 隐患
- ENVELOPE_ACTION 必须补 ACTION_TO_STORE_MAP
- dataLayer barrel 与 STORE_NAME 保持对齐
- 迁移 dataLayer 直接访问应复用 helpers

#### 主题 7：文档与知识管理（教训 19-20）
- 文档同步纳入功能交付 DoD
- 核心数字用脚本生成而非硬编码

#### 主题 8：测试策略（教训 21）
- 测试用例基于配置生成而非文件存在性

#### 主题 9：调试方法论（教训 23）
- 科学调试流程：假设 → 证伪 → 证据 → 修复 → 验证

#### 主题 10：SKILL 与代码差距（教训 24）
- 方法论与代码实现必须同步交付

#### 主题 11：架构分层与目录归位（教训 25-27）
- 语义重复与目录错位会绕过静态审计
- Store 层直接依赖 data/ 是隐蔽跨层违规
- 业务常量跨层重复会污染依赖图

### 5.4 预防措施清单

#### 每次提交前（开发者自检，5 分钟）
- [ ] `npm run audit:layers` → 0 violations
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run audit:hardcode` → 确认非误报
- [ ] 新增文件已同步注册（Registry/Store/Config/Routes）
- [ ] 新增配置字段有对应的消费逻辑

#### 每次 PR 合并前（代码评审，10 分钟）
- [ ] 新增 MCP Server 通过 9 项检查清单
- [ ] 新增 Agent 有真实 handler，非占位符
- [ ] 新增功能：AGENTS.md / architecture.md / data-definition.md 至少更新一份
- [ ] 新增业务参数已迁移到配置层
- [ ] 新增测试：单元测试覆盖 + 关键路径 e2e 覆盖

#### 每次版本发布前（发布审计，30 分钟）
- [ ] 文件存在性 vs 配置注册一致性（Glob 扫描）
- [ ] 文档-代码双向一致性
- [ ] 全量测试通过（单元 + e2e）
- [ ] 质量门禁全通过
- [ ] Router 版本兼容性验证
- [ ] SKILL 方法论与代码权重表对齐

> **完整文档**：[lessons-learned.md](file:///g:/FinSightV9/docs/reports/retrospectives/lessons-learned.md)、[lessons-learned-summary.md](file:///g:/FinSightV9/docs/reports/retrospectives/lessons-learned-summary.md)

---

## 六、技能沉淀与方法论

### 6.1 SKILL 技能体系

| SKILL | 用途 | 核心方法论 |
|-------|------|-----------|
| **v6-stock-analysis-model** | 个股分析模型 | L-1 到 L8 九层分析框架 |
| **v6-docx-output** | Word 报告输出 | 专业排版格式规范 |
| **architecture-cleanup** | 架构清理 | 先扫描真相源、再小步重构、每步验证 |
| **architecture-radar-scan** | 架构雷达扫描 | 六层架构无损探测、热力风险图 |
| **architecture-debt-remediation** | 架构债务修复 | 分层违规、死组件、大组件重构 |
| **docs-as-mirror** | 文档编写 | Truth-First、Scan-Before-Write |
| **test-driven-development** | TDD 开发 | 测试先行、红→绿→重构 |
| **type-safety-contract** | 类型安全 | 六步安全契约：锚定→扫描→方案→守卫→执行→验证 |
| **constant-migration** | 常量迁移 | 业务常量归位、批量修复导入路径 |
| **databridge-migration** | DataBridge 迁移 | 直接 dataLayer → 信封协议 |
| **db-reference-audit** | 数据库引用审计 | STORE_NAME ? Schema ? ACL 一致性 |
| **v9-gatekeeper** | 前置门禁 | 5 类历史错误的前置拦截 |
| **industry-score-mapping** | 行业评分映射 | SKILL-C/SKILL-N 评分提取 |
| **writing-plans** | 任务规划 | 多步骤任务的计划制定 |

### 6.2 核心方法论

#### 6.2.1 飞轮方法论（AI 辅助开发）

```
需求 → 设计 → 实现 → 审计 → 修复 → 验证 → 沉淀
 ↑                                            ↓
 └────────────────────────────────────────────┘
```

**关键步骤**：
1. **AI 生成**：基于需求生成代码/文档
2. **自动化审计**：运行 audit:layers/hardcode/docs/routes 等
3. **问题定位**：根据审计输出定位问题
4. **AI 修复**：指导 AI 修复违规项
5. **验证闭环**：再次运行审计确认修复
6. **知识沉淀**：将新模式/新规则沉淀到 SKILL

#### 6.2.2 科学调试流程

```
假设 → 证伪 → 证据 → 修复 → 验证
```

- **假设**：基于静态分析提出根因假设
- **证伪**：用运行时证据推翻错误假设
- **证据**：收集新证据定位真实根因
- **修复**：针对真实根因实施修复
- **验证**：确认修复有效且无副作用

> **经验来源**：输出舱不显示问题排查（教训 23）

#### 6.2.3 文档治理方法论

**四大核心原则**（docs-as-mirror）：
1. **Truth-First**：先读取真相源再编写文档
2. **Scan-Before-Write**：编写前扫描实际文件系统
3. **Exhaustiveness**：穷尽性原则覆盖所有文件归属
4. **Bidirectional Linking**：双向引用防止信息孤岛

**保鲜度评分算法**：
- 更新时效性 (40%)：≤30天=100分，31-90天=60分，>90天=20分
- 代码一致性 (35%)：关联代码路径存在且匹配=100分
- 变更日志完整性 (15%)：有完整 Frontmatter + Change Log = 100分
- 索引引用 (10%)：在索引中被正确引用=100分

#### 6.2.4 Token 优化方法论

**实测 Token 消耗分布**：
| 消耗环节 | 占比 | 优化方向 |
|----------|------|----------|
| 脚本重复解析 | 35% | 知识图谱预构建 |
| AI 重复搜索 | 25% | 持久化记忆索引 |
| 架构合规检查 | 15% | 自动化审计工具 |
| 硬编码识别 | 10% | audit:hardcode 脚本 |
| 事件监听检查 | 10% | 专项检测脚本 |
| 文档生成与更新 | 5% | 模板化 + 自动化 |

**优化目标**：通过知识持久化和自动化，节省 50-60% Token 消耗

> **详细文档**：[token-optimization-best-practices.md](file:///g:/FinSightV9/docs/reports/lessons-learned/token-optimization-best-practices.md)

---

## 七、与最佳实践对比分析

### 7.1 对比维度总览

| 维度 | V9 当前实践 | 行业最佳实践 | 差距评估 | 成熟度 |
|------|-------------|-------------|----------|--------|
| 需求管理 | 用户分层 + 场景拆解 + 竞品分析 | 需求评审 + 用户故事 + 验收标准 | 基本对齐 | ???? |
| 架构设计 | ADR + 六层架构 + 设计模式 | TOGAF / DDD / Clean Architecture | 有特色 | ???? |
| 编码规范 | 类型安全 + 零硬编码 + 分层审计 | Clean Code + SOLID + 代码审查 | 工具化强 | ????? |
| 测试策略 | 五层测试 + 13 项质量门禁 | 测试金字塔 + CI/CD 自动化 | 覆盖全面 | ???? |
| CI/CD | Husky 预提交 + 本地门禁 | GitHub Actions + 多环境部署 | 缺少 CI | ??? |
| 文档体系 | Frontmatter + 健康度评分 + 双向链接 | Diátaxis + Docs as Code | 体系完整 | ????? |
| 经验沉淀 | 36 条结构化教训 + SKILL 体系 | 事后复盘 + 知识库 + 培训 | 系统性强 | ????? |
| 项目管理 | 实施计划 + 任务依赖 + 风险登记 | Scrum / Kanban + 燃尽图 | 敏捷度待提升 | ??? |

### 7.2 各阶段详细对比

#### 7.2.1 需求分析阶段

**V9 特点**：
- ? 清晰的愿景定位和价值主张
- ? 用户分层明确（初级/进阶/长期价值）
- ? 竞品分析细致（V6 Pro 全量差异对比）
- ? 约束条件分析充分（合规/成本/隐私/离线）
- ?? 缺少正式的需求评审流程
- ?? 用户故事和验收标准不够结构化

**最佳实践对标**：
- 应建立需求变更管理流程
- 需求应与测试用例双向追溯
- 应引入用户反馈闭环机制

**改进建议**：
1. 建立需求模板（用户故事 + 验收标准 + 优先级）
2. 需求变更走 ADR 类似的决策记录流程
3. 每个功能需求对应测试用例编号

---

#### 7.2.2 架构设计阶段

**V9 特点**：
- ? 9 份 ADR 完整记录关键决策
- ? 六层架构分层清晰，依赖方向明确
- ? 设计模式应用得当（信封、状态机、发布订阅）
- ? AGENTS.md 作为架构契约，约束 AI 开发
- ? 数据血缘、可删除性等特色设计原则
- ?? 架构评审流程不够形式化
- ?? 架构决策的影响分析不够系统

**最佳实践对标**：
- ADR 流程非常规范，优于多数中小团队
- 六层架构是 Clean Architecture 的本地化变体
- 缺少架构适应性设计（可扩展性评估）

**改进建议**：
1. 建立架构评审 Checklist（ADR 模板已较完善）
2. 增加架构 Fitness Function（适配度函数）
3. 定期进行架构复盘（当前已有审计驱动的复盘）

---

#### 7.2.3 编码实现阶段

**V9 特点**：
- ? 四步集成契约（类型→Store→Service→UI），非常有特色
- ? 开发工作流 SOP 标准化（四阶段 14 步门禁）
- ? 自动化审计工具链（audit:layers/hardcode/routes/atomic 等）
- ? 编码规范完善，工具化 enforcement 强
- ? Atomic Design 组件体系完整
- ?? 代码审查主要依赖自动化，人工审查不足
- ?? 结对编程/同伴审查机制缺失

**最佳实践对标**：
- 自动化程度非常高，工具链建设领先
- 四步集成契约是很好的增量开发实践
- 人工代码审查可进一步加强

**改进建议**：
1. 建立代码审查 Checklist（已有 CODE-REVIEW.md）
2. 引入关键模块双人审查机制
3. 定期代码走查（Code Walkthrough）

---

#### 7.2.4 测试与质量阶段

**V9 特点**：
- ? 13 项质量门禁，覆盖全面
- ? 五层测试策略（单元/服务/集成/E2E/类型）
- ? 质量门禁基线明确，可度量
- ? 审计工具丰富，自动化程度高
- ?? CI/CD 流水线未建立（本地执行门禁）
- ?? 测试覆盖率目标未完全达成
- ?? 性能测试、安全测试较薄弱

**最佳实践对标**：
- 质量门禁体系完整，理念先进
- 缺少 CI 流水线是最大短板
- 测试分层合理，与测试金字塔一致

**改进建议**：
1. 建立 GitHub Actions CI 流水线
2. 逐步提升测试覆盖率到目标值
3. 补充性能基准测试和安全渗透测试

---

#### 7.2.5 部署与运维阶段

**V9 特点**：
- ? 纯前端部署，简单可靠
- ? 构建产物按功能分包，优化首屏加载
- ? PWA 支持离线访问
- ? 数据迁移策略完善（DB_VERSION + 迁移脚本）
- ?? 部署自动化程度不高
- ?? 监控和告警机制缺失
- ?? 灰度发布/回滚机制不够成熟

**最佳实践对标**：
- 纯前端部署本身就是最佳实践之一
- 缺少运维监控是纯前端的常见短板
- 数据迁移方案设计良好

**改进建议**：
1. 接入 Vercel/Netlify 自动部署
2. 引入前端监控（如 Sentry）
3. 完善版本回滚预案和演练

---

### 7.3 V9 项目的独特优势

对比一般软件开发项目，V9 在以下方面具有显著特色和优势：

#### 优势 1：文档体系化程度极高
- Frontmatter 元数据标准化
- 健康度评分机制
- 双向链接和索引体系
- 文档-代码双向一致性检测
- **成熟度**：?????（行业先进水平）

#### 优势 2：经验沉淀机制完善
- 36 条结构化教训，分级分类
- 每次审计后更新知识库
- SKILL 体系将方法论代码化
- 预防措施清单可操作
- **成熟度**：?????（远超一般团队）

#### 优势 3：自动化审计工具链
- audit:layers 分层合规检查
- audit:hardcode 硬编码检测
- audit:routes 路由一致性
- audit:atomic 组件层级
- audit:db-references 数据库引用
- **成熟度**：?????（工具化程度领先）

#### 优势 4：架构契约驱动开发
- AGENTS.md 作为最高约束
- ADR 记录每一个关键决策
- 四步集成契约指导增量开发
- AI 辅助开发有明确的行为边界
- **成熟度**：????（架构驱动的典范）

---

### 7.4 主要改进空间

| 优先级 | 改进领域 | 具体建议 | 预期收益 |
|--------|----------|----------|----------|
| P0 | CI/CD 流水线 | 建立 GitHub Actions，自动化门禁和测试 | 提交即验证，减少人工操作 |
| P0 | 监控体系 | 接入前端错误监控和性能监控 | 快速发现线上问题 |
| P1 | 测试覆盖率 | 逐步提升到 core≥85% services≥70% | 降低回归风险 |
| P1 | 人工代码审查 | 关键模块双人审查机制 | 提升代码设计质量 |
| P2 | 需求管理流程 | 标准化用户故事和验收标准 | 需求更清晰，减少返工 |
| P2 | 性能测试 | 建立性能基准和回归测试 | 防止性能退化 |
| P2 | 灰度发布 | 按用户比例灰度发布 | 降低版本风险 |

---

## 八、后续改进建议

### 8.1 短期改进（1-2 周）

1. **建立 CI 流水线**
   - 使用 GitHub Actions 自动化质量门禁
   - PR 触发自动化测试和审计
   - 主分支保护策略

2. **接入前端监控**
   - 集成 Sentry 错误监控
   - Web Vitals 性能监控
   - 用户行为分析（可选）

3. **完善 PWA 离线体验**
   - Service Worker 缓存策略优化
   - 离线状态提示和降级方案
   - 离线功能清单文档化

### 8.2 中期改进（1-2 月）

1. **测试覆盖率提升**
   - 制定覆盖率提升计划
   - 优先覆盖核心引擎（评分、交易、风控）
   - 增加 E2E 测试场景

2. **性能优化专项**
   - 建立性能基准测试
   - 大样本回测性能优化
   - 首屏加载优化

3. **安全加固**
   - XSS 防护全面审查
   - 存储加密验证
   - CSP 策略完善

### 8.3 长期演进（3-6 月）

1. **架构演进**
   - 评估 V10 架构白皮书
   - 考虑 Electron 桌面版本
   - 云同步方案评估

2. **团队协作**
   - 引入项目管理工具（Jira/Linear）
   - 建立迭代规划机制
   - 定期技术分享会

3. **知识体系**
   - 完善 SKILL 体系
   - 建立新人 Onboarding 路径
   - 技术博客/知识库建设

### 8.4 文档体系优化

1. **建立文档更新自动化**
   - 代码变更触发文档更新检查
   - 自动生成 API 文档
   - 自动更新数据字典

2. **文档质量持续提升**
   - 定期文档健康度复盘
   - 文档贡献者激励机制
   - 用户文档体验优化

---

## 附录 A：关键文档索引

### A.1 核心架构文档

| 文档 | 路径 | 重要性 |
|------|------|--------|
| AGENTS.md | [AGENTS.md](file:///g:/FinSightV9/AGENTS.md) | ????? 最高约束 |
| 愿景与目标 | [01-vision-and-goals.md](file:///g:/FinSightV9/docs/reference/01-vision-and-goals.md) | ????? |
| 质量门禁 | [09-quality-gates.md](file:///g:/FinSightV9/docs/reference/09-quality-gates.md) | ????? |
| 架构标准 | [03-architecture-standards.md](file:///g:/FinSightV9/docs/reference/03-architecture-standards.md) | ???? |
| 数据宪法 | [V9数据宪法.md](file:///g:/FinSightV9/docs/reference/V9%E6%95%B0%E6%8D%AE%E5%AE%AA%E6%B3%95.md) | ???? |

### A.2 经验教训文档

| 文档 | 路径 | 重要性 |
|------|------|--------|
| 经验教训完整版 | [lessons-learned.md](file:///g:/FinSightV9/docs/reports/retrospectives/lessons-learned.md) | ????? |
| 经验教训摘要版 | [lessons-learned-summary.md](file:///g:/FinSightV9/docs/reports/retrospectives/lessons-learned-summary.md) | ???? |
| Token 优化最佳实践 | [token-optimization-best-practices.md](file:///g:/FinSightV9/docs/reports/lessons-learned/token-optimization-best-practices.md) | ??? |

### A.3 流程规范文档

| 文档 | 路径 | 重要性 |
|------|------|--------|
| 开发工作流 SOP | [development-workflow-sop.md](file:///g:/FinSightV9/docs/reference/development-workflow-sop.md) | ????? |
| 编码规范 | [coding-conventions.md](file:///g:/FinSightV9/docs/reference/coding-conventions.md) | ???? |
| 实施计划 | [08-implementation-plan.md](file:///g:/FinSightV9/docs/explanation/design/08-implementation-plan.md) | ???? |
| 技术债管理 | [tech-debt.md](file:///g:/FinSightV9/docs/explanation/design/tech-debt.md) | ??? |

---

## 附录 B：数据统计

### B.1 文档统计

| 类别 | 数量 | 说明 |
|------|------|------|
| ADR 决策记录 | 9 份 | 架构关键决策 |
| 经验教训 | 36 条 | P0:9 / P1:20 / P2:7 |
| 质量门禁 | 13 项 | 类型/规范/测试/审计/安全 |
| 审计工具 | 8+ 个 | layers/hardcode/routes/atomic 等 |
| 健康文档 | 31 份 | 全部 ?? 健康状态 |
| SKILL 技能 | 14+ 个 | 架构/测试/文档/开发等 |

### B.2 代码统计（估算）

| 指标 | 数值 | 说明 |
|------|------|------|
| 源代码目录 | 20+ | config/core/data/lib/services/store 等 |
| Zustand Store | 49 个 | 含三分拆池 Store |
| MCP Server | 若干 | 含 UI/Agent/系统等角色 |
| 单元测试 | 5300+ | 44+ 测试文件 |
| E2E 测试 | 20+ | 输出舱等关键路径 |
| 组件数量 | 125+ | atoms(43) + molecules(19) + organisms(63) + templates |

---

> **文档维护说明**：建议每次重大版本发布后更新本文件，保持项目历程的可追溯性。
> **反馈渠道**：如有补充或修正，请提交到架构组评审。
