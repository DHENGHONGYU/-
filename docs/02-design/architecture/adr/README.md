---
title: V9 架构决策记录（ADR）主索引
status: active
owner: 架构组 / docs 治理组
updated: 2026-07-12
---

# V9 架构决策记录（ADR）主索引

> **定位**：本文是 `docs/architecture/adr/` 的顶层入口，统管 V9 全生命周期架构决策。任何影响分层边界、数据流方向、技术选型或模块职责的决策，必须在此登记。
> **权威契约**：`AGENTS.md`（工程分层 + 四步集成） + `docs/GOVERNANCE.md`（文档生命周期）。
> **关联文档**：`../architecture/overview.md`（全局架构）、`../../02-design/05-engine-specs.md`（引擎规格）、`../../02-design/06-routing-specs.md`（路由规格）。

---

## 1. ADR 编号规则

| 规则 | 说明 | 示例 |
|------|------|------|
| **格式** | `ADR-XXX`（3 位零左填充，连续递增） | `ADR-001`、`ADR-010` |
| **起始号** | V9 项目从 `ADR-001` 开始，不继承 V6 编号 | — |
| **分配权** | 架构组唯一有权分配编号；个人分支不得预占 | 须经架构评审或 async RFC 讨论 |
| **文件命名** | `adr-XXX-{kebab-case-title}.md`（全小写，英文优先） | `adr-001-pure-frontend-architecture.md` |
| **状态流转** | `proposed` → `accepted` / `rejected` / `superseded` → `deprecated` | 见 §3 状态定义 |
| **废止规则** | 被新 ADR 取代时，原 ADR 状态改为 `superseded`，须在新 ADR 中标注 `supersedes: ADR-XXX` | 示例：ADR-009 废止 ADR-007 部分条款 |

### 1.1 什么决策需要 ADR

**必须写 ADR（强制）**：
- 新增/删除一个 `src/` 分层（如新增 `src/agents/` Agent 调度层）
- 修改 `DataBridge` 信封结构或 ACL 矩阵
- 引入新的外部依赖（数据库、框架、协议）
- 修改引擎 L3 计算层的算法或评分因子
- 变更路由加载链架构（三级 → 二级/四级）
- 修改颜色令牌体系 L1-L6 的层级定义

**建议写 ADR（推荐）**：
- 新增服务子域（24 子域之外）
- 变更 Store 广播机制（`withBroadcast` → 其他方案）
- 引入新的质量门禁规则
- 舱室间数据流方向变更

**无需 ADR**：
- 纯 UI 布局调整（无架构影响）
- 单一组件/Hook 内部实现重构
- 文档排版、注释补充
- 单元测试补全（无接口变更）

---

## 2. ADR 模板结构

每份 ADR 必须包含以下七节。如某节不适用，标注「N/A」而非删除。

```markdown
---
title: ADR-XXX: [一句话决策标题]
status: proposed | accepted | rejected | superseded | deprecated
owner: [决策 owner]
decision_date: YYYY-MM-DD
supersedes: ADR-YYY  # 仅当被取代时填写
superseded_by: ADR-ZZZ  # 仅当状态为 superseded 时填写
---

# ADR-XXX: [标题]

## 1. 背景（Context）
- 触发此决策的问题、约束或机会
- 相关的业务/技术上下文
- 引用相关 issue、PR 或前置 ADR

## 2. 决策（Decision）
- 最终选定的方案（一句话 + 详细说明）
- 决策理由（Why this? Why not others?）
- 与 `AGENTS.md` 分层规则、引擎规格、路由规格的兼容性说明

## 3. 备选方案（Alternatives Considered）
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| A | ... | ... | 未采纳，理由 |
| B | ... | ... | 未采纳，理由 |

## 4. 后果（Consequences）
- 正面影响
- 负面影响 / 引入的技术债（须同步登记到 `TECH-DEBT.md`）
- 对既有模块的影响范围（哪些 store/service/page 需要改）

## 5. 实施与验证（Implementation & Validation）
- 实施步骤 checklist
- 验证命令（如 `npm run audit:layers`、`tsc --noEmit`）
- 回滚条件与回滚步骤

## 6. 关联文档（Related Documents）
- 引用的架构文档（使用相对路径）
- 后续细化的设计文档（如 `02-design/*-spec.md`）
- 代码入口文件（如 `src/core/databridge.ts`）

## 7. 状态变更记录（Status Log）
| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| YYYY-MM-DD | proposed | [name] | 初始提案 |
| YYYY-MM-DD | accepted | [name] | 架构评审通过 |
```

---

## 3. ADR 状态定义

| 状态 | 含义 | 谁可变更 | 退出条件 |
|------|------|----------|----------|
| **proposed** | 已提案，待评审 | 提案人 | 评审通过 → accepted；评审否决 → rejected |
| **accepted** | 已接受，生效中 | 架构组 | 被新 ADR 取代 → superseded；技术栈淘汰 → deprecated |
| **rejected** | 已否决，不采纳 | 架构组 | 无（归档参考） |
| **superseded** | 已被新 ADR 取代 | 架构组（自动） | 无（保留历史记录） |
| **deprecated** | 因技术栈淘汰而失效 | 架构组 | 无（保留历史记录） |

> **注意**：`accepted` 的 ADR 不等于不可变更。若需修改已接受的 ADR，优先通过新增 ADR 并标注 `supersedes` 实现，而非直接修改原文。保证决策历史可追溯。

---

## 4. 已有 ADR 清单

> **来源**：以下 ADR 从仓库已有文档中推断（原文件散落在 `docs/01-requirements/`、`docs/03-development/`、`docs/05-deployment/`、`docs/06-project-management/` 等目录，由架构组评估后统一迁移或引用到 `docs/architecture/adr/`）。
> **TODO[架构组]**：P1 阶段完成 ADR 文件的物理归集，将散落文件统一迁移到 `docs/architecture/adr/`，并更新原位置的软链接/重定向说明。

### 4.1 已接受（Accepted）

| 编号 | 标题 | 决策日期 | 状态 | 原始文件位置 | 影响范围 | 关联文档 |
|:---:|------|:---|:---|:---|:---|:---|
| **ADR-001** | 纯前端无后端架构 | 2026-06-20 | accepted | `docs/01-requirements/2026-06-20-pure-frontend-architecture.md` | 全系统 | `overview.md` §1、`AGENTS.md` §一 |
| **ADR-002** | IndexedDB 替代 localStorage | 2026-06-20 | accepted | `docs/01-requirements/2026-06-20-indexeddb-over-localstorage.md` | 数据持久层 | `AGENTS.md` §八、`05-engine-specs.md` §1.1 |
| **ADR-003** | DataBridge 替代直接 dataLayer 写入 | 2026-06-21 | accepted | `docs/06-project-management/2026-06-21-databridge-over-direct-datalayer.md` | 核心数据流 | `overview.md` §4、`05-engine-specs.md` §4 |
| **ADR-004** | HashRouter 静态托管方案 | 2026-06-21 | accepted | `docs/05-deployment/2026-06-21-hashrouter-for-static-hosting.md` | 路由/部署 | `06-routing-specs.md` §1 |
| **ADR-005** | PortalShell 深色 Kimi 经典布局 | 2026-06-23 | accepted | `docs/03-development/2026-06-23-portalshell-dark-kimi-layout.md` | UI 架构 | `AGENTS.md` §3.5、令牌体系 |
| **ADR-006** | 输入舱拆分为四子页面 | 2026-06-24 | accepted | `docs/03-development/2026-06-24-input-cabin-subpages.md` | input 舱 | `06-routing-specs.md` §3.2、`cabins-overview.md` §1 |
| **ADR-007** | 补齐筛选引擎、信号持久化与复盘引擎 | 2026-06-24 | accepted（部分 superseded） | `docs/03-development/2026-06-24-pool-screening-signal-persistence-review-engine.md` | analysis/trading/output | `05-engine-specs.md` §3.7-3.8；部分条款被 ADR-009 取代 |
| **ADR-008** | 采用 V6 "第四次工业革命稀缺核心资源" 交易策略 | 2026-06-24 | accepted | `docs/01-requirements/2026-06-24-adopt-v6-core-resource-trading-strategy.md` | trading 舱 | `fourth-industrial-revolution-core-resource-strategy.md`、`05-engine-specs.md` §3.3 |
| **ADR-009** | 引入热门板块与价值洼地双策略体系 | 2026-06-27 | accepted | [TODO] 推断文件：`docs/02-design/2026-06-27-dual-strategy-system.md` | analysis/trading | `05-engine-specs.md` §2.5、`cabins-overview.md` §4 |

### 4.2 关键架构决策摘要

#### ADR-001 纯前端架构
- **核心决策**：V9 作为纯前端 PWA 运行，无后端服务，数据自管于本地 IndexedDB。
- **关键约束**：所有外部 API 调用须经 `fetcher` 服务，禁止浏览器直连第三方敏感接口。
- **引用**：`docs/01-requirements/v9-system-blueprint.md` §2.1

#### ADR-002 IndexedDB 替代 localStorage
- **核心决策**：放弃 localStorage（容量/性能限制），采用 IndexedDB 作为唯一本地持久化方案。
- **关键约束**：schema 变更必须递增 `DB_VERSION`（`src/config/dbConfig.ts`），新增 store 须在 `STORE_NAME` + `ACL_MATRIX` 注册。
- **引用**：`AGENTS.md` §八

#### ADR-003 DataBridge 统一写入
- **核心决策**：所有数据写操作须经 `DataBridge.forward()`，禁止 services 层直接调用 `db.put()`/`dataLayer.save()`。
- **关键约束**：`StandardEnvelope` 必须含 `source/target/action/traceId/timestamp`；ACL 矩阵校验模块-Store-操作三元组。
- **引用**：`AGENTS.md` §一（依赖方向）、`mcp-coupling-analysis-report.md` §2
- **待改进**：`routeToDB()` 当前为 30+ case 的 switch，建议改为策略模式（见 `mcp-coupling-analysis-report.md` §问题 1）。

#### ADR-004 HashRouter 静态托管
- **核心决策**：采用 `HashRouter` 替代 `BrowserRouter`，适配 GitHub Pages 等静态托管场景。
- **关键约束**：`src/config/routes.ts` 集中注册全部 62 条路由，禁止页面组件内硬编码路径。
- **引用**：`06-routing-specs.md` §1

#### ADR-005 PortalShell 深色布局
- **核心决策**：全站采用深色 Kimi 经典布局为默认主题，亮色为可选；`PortalShell` 作为五舱统一导航容器。
- **关键约束**：宋韵美学——亮色用 `stone` 暖灰系，暗色统一 `neutral` 高级灰；颜色必须走令牌体系（L1-L6）。
- **引用**：`AGENTS.md` §3.5、`design-token-mapping.md`

#### ADR-006 输入舱子页面拆分
- **核心决策**：输入舱从单一页面拆分为 8 子页面（录入看板、批量导入、热门板块、采集测试、本地知识库、七维配置、抓取配置、采集监控）。
- **关键约束**：`InputApp` 分发器使用 else-if 链 + `React.lazy()` 加载子页面。
- **引用**：`06-routing-specs.md` §3.2

#### ADR-007 补齐筛选/信号/复盘引擎
- **核心决策**：补齐 `screening`（选股筛选）、`signal`（信号持久化）、`review`（交易复盘）三个缺失引擎。
- **状态说明**：`accepted` 但部分条款被 ADR-009 取代（ADR-009 引入更完整的双策略体系，覆盖 ADR-007 中「热门板块」与「价值洼地」相关条款）。
- **引用**：`05-engine-specs.md` §2.5、§3.7-3.8

#### ADR-008 采用 V6 核心资源交易策略
- **核心决策**：复用 V6-pro-cockpit 的「第四次工业革命稀缺核心资源」主题策略，包括主题定义、行业代码白名单、评分过滤与等权分配逻辑。
- **关键约束**：`themeRegistry.ts` 定义主题规则；`portfolioBuilder.ts` 实现组合构建；删除 trading 舱后研究体系保持完整。
- **引用**：`fourth-industrial-revolution-core-resource-strategy.md`、`05-engine-specs.md` §3.3

#### ADR-009 引入双策略评分体系
- **核心决策**：新增「热门板块策略」与「价值洼地策略」两条独立选股路径，输出 `HotSectorScore`/`ValuePitScore`，并配套轮动信号检测引擎。
- **关键约束**：`dualStrategyRules.ts` 集中配置阈值；`hotSectorAnalyzer.ts`/`valuePitAnalyzer.ts`/`rotationSignalDetector.ts` 为 L3 纯计算层；五因子十六指标模型已落地，上层 Widget 待完善。
- **引用**：`05-engine-specs.md` §2.5、`v9-system-blueprint.md` §2.4.1
- **待完善**：`HotSectorScore`/`ValuePitScore` 类型与 Store 待新增；Analyzer 与 Widget 待实现。

---

## 5. 新建 ADR 的 SOP

### 5.1 创建流程

```
Step 1: 识别架构决策需求
    ↓ 判断是否达到 ADR 门槛（见 §1.1）
Step 2: 在 ADR 主索引（本文件）预留编号
    ↓ 向架构组申请编号；禁止自行分配
Step 3: 使用 §2 模板创建 `adr-XXX-{title}.md`
    ↓ 放置于 `docs/architecture/adr/`
Step 4: 填写七节内容，确保关联文档引用准确
    ↓ 运行 `npm run audit:docs` 检查文档-代码同步
Step 5: 提交 async RFC 或架构评审会议
    ↓ 评审通过后，状态改为 `accepted`
Step 6: 同步更新本索引的「已有 ADR 清单」
    ↓ 如替换旧 ADR，更新旧 ADR 状态为 `superseded`
Step 7: 如决策涉及代码变更，执行 `tsc --noEmit` + `audit:layers` 验证
    ↓ 验证通过后合并
Step 8: 如引入技术债，同步登记到 `docs/02-design/TECH-DEBT.md`
```

### 5.2 评审 checklist

```markdown
- [ ] ADR 编号唯一且连续，无跳号/重号
- [ ] 文件命名符合 `adr-XXX-{kebab-case}.md`
- [ ] 包含标准七节（背景/决策/备选/后果/实施验证/关联文档/状态变更）
- [ ] 决策与 `AGENTS.md` 分层规则无冲突（跨层调用检查通过）
- [ ] 决策与引擎 L3 纯计算层职责无冲突（无副作用）
- [ ] 关联文档路径正确（使用相对路径，如 `../../02-design/05-engine-specs.md`）
- [ ] 如涉及 DB schema 变更，已确认 `DB_VERSION` 递增方案
- [ ] 如新增 EnvelopeAction，已确认 ACL 矩阵更新方案
- [ ] 回滚条件明确，回滚后系统可恢复到决策前状态
- [ ] 技术债已评估并同步登记（如适用）
```

### 5.3 与代码变更的联动

| ADR 涉及范围 | 必须同步的文件 | 验证命令 |
|-------------|---------------|---------|
| 新增分层/目录 | `AGENTS.md` §一、`overview.md` §2 | `audit:layers` |
| 新增服务子域 | `services-catalog.md` | `tsc --noEmit` |
| 新增/修改 Store | `dbConfig.ts`（`STORE_NAME`/`DB_VERSION`/`ACL_MATRIX`） | `tsc --noEmit` |
| 新增路由 | `routes.ts`、`06-routing-specs.md` | `audit:deadcode` |
| 新增引擎模块 | `05-engine-specs.md` | `npm test -- --run` |
| 新增颜色令牌 | `theme.tokens.ts`、`design-token-mapping.md` | `lint:colors`、`audit:tokens` |
| 新增 data definition | `DATA_DICTIONARY_INDEX.md` | `audit:docs` |

---

## 6. ADR 与 `02-design/` 设计文档的关系

### 6.1 职责边界

| 维度 | `docs/architecture/adr/` | `docs/02-design/` |
|------|------------------------|-------------------|
| **定位** | **Why** — 为什么做这个架构决策 | **How** — 如何具体实现 |
| **粒度** | 高（模块/分层/技术选型） | 中低（接口/算法/UI/数据流） |
| **生命周期** | 与项目同寿（决策历史不可删） | 随代码迭代更新（过期进 `07-archive/`） |
| **读者** | 架构师、技术负责人、新成员 | 开发者、测试工程师、UI 设计师 |
| **变更频率** | 低（决策一旦接受很少变更） | 高（随实现细化持续更新） |

### 6.2 引用关系

```
ADR（决策） → 引用 → 02-design 设计文档（实现规格）
    ↓                              ↑
    └─ 实施完成后，设计文档中的实现细节反向验证 ADR 的可行性
```

**示例**：
- ADR-003（DataBridge 统一写入）决定「所有写操作经 DataBridge」→ `02-design/05-engine-specs.md` §4 详细定义 Envelope 结构、Action 清单、ACL 矩阵、执行流程。
- ADR-009（双策略体系）决定「引入 HotSectorScore + ValuePitScore」→ `02-design/05-engine-specs.md` §2.5 详细定义五因子模型、十六指标、轮动信号触发条件。

### 6.3 与 `02-design/00-README.md` 的索引衔接

`02-design/00-README.md` 在其 §1.8「架构决策记录」中列出了 ADR-001~ADR-009 的原始文件路径。当 ADR 文件归集到 `docs/architecture/adr/` 后：

1. 本文件（`adr/README.md`）成为 ADR 的**唯一主索引**。
2. `02-design/00-README.md` 的 §1.8 应改为**引用**本文件（而非重复列出 ADR 清单），避免信息副本。
3. `02-design/00-README.md` 保留 ADR 的「关联代码目录映射」和「文档分类索引」职责，不重复维护 ADR 状态。

> **TODO[docs 治理组]**：P1 阶段更新 `02-design/00-README.md` §1.8，将 ADR 清单改为引用 `docs/architecture/adr/README.md`，并删除重复列出的 ADR 文件路径表。

---

## 7. 待决策项（未来 ADR 预留）

> 以下项已由架构组识别为潜在架构决策点，但尚未形成正式 ADR。待条件成熟时按 §5 SOP 创建。

| 预留编号 | 候选主题 | 触发条件 | 预估优先级 | 当前状态 |
|:---:|------|------|:---:|------|
| ADR-010 | 策略模式重构 `DataBridge.routeToDB()` | `routeToDB()` case 数 > 40 或 2 人同时修改冲突 | P1 | 待提案，见 `mcp-coupling-analysis-report.md` §问题 1 |
| ADR-011 | 查询信封（QueryEnvelope）统一读操作 | 读操作缓存/审计/权限校验需求明确 | P2 | 待提案，见 `mcp-coupling-analysis-report.md` §问题 2 |
| ADR-012 | 事件名称统一常量化 | 事件名称分散在 ≥ 5 个文件 | P2 | 待提案，见 `mcp-coupling-analysis-report.md` §问题 3 |
| ADR-013 | 按舱室代码分割（`manualChunks`） | 首屏 bundle > 500KB 或 Lighthouse 性能评分 < 90 | P2 | 待提案，见 `06-routing-specs.md` §4.2 |
| ADR-014 | 路由守卫（数据存在性/离线守卫） | Phase 2 功能开发启动 | P2 | 待提案，见 `06-routing-specs.md` §5.3 |
| ADR-015 | 增量解析 `extract-code-graph.ts` | 月度 Token 消耗 > 50K 或 CI 耗时 > 5min | P2 | 待提案，见 `AGENTS.md` §7.1 |
| ADR-016 | Agent 调度层（`src/agents/`） | V10 规划启动，多 Agent 协同需求明确 | P3 | 待提案，见 `05-engine-specs.md` §1.5 |
| ADR-017 | Trading Gateway 抽象（模拟/真实券商切换） | 真实交易接入需求明确 | P3 | 待提案，见 `05-engine-specs.md` §1.5 |
| ADR-018 | `MemoryCache` 集成 `DataBridge` | 高频读操作性能瓶颈确认（IndexedDB 延迟 > 50ms） | P2 | 待提案，见 `mcp-coupling-analysis-report.md` §问题 4 |
| ADR-019 | 数据层直写 db 全面清理 | `dataLayer` 中直接 `db.put()` 的方法数 > 10 | P1 | 待提案，见 `mcp-coupling-analysis-report.md` §问题 5 |
| ADR-020 | 暗色模式主题切换架构（CSS 变量 vs Tailwind dark:） | 暗色模式覆盖率 < 80% 或用户反馈切换闪烁 | P2 | 待提案，见 `AGENTS.md` §3.5.6（豁免规则） |

---

## 8. 治理与维护

### 8.1 责任矩阵

| 角色 | 职责 |
|------|------|
| **架构组** | ADR 编号分配、评审、状态变更、技术债评估 |
| **docs 治理组** | 本索引维护、ADR 文件归集、与 `02-design/` 索引衔接 |
| **各舱 owner** | 舱内架构变更的 ADR 提案、实施验证 |
| **工程效能** | ADR 关联的 `audit:*` 门禁配置、CI 集成 |

### 8.2 保鲜规则

- 每季度复核一次「待决策项」表，将已满足触发条件的项转为正式 ADR。
- 已 `accepted` 的 ADR 若发现与代码实现不一致，由 `audit:docs` 拦截，须修正文档或回滚代码。
- 新增的 `superseded`/`deprecated` ADR 须在当次提交内更新本索引。

### 8.3 质量门禁

| 门禁 | 触发时机 | 检查内容 |
|------|---------|---------|
| `audit:docs` | 每次提交 | ADR 文件路径与索引一致性、关联文档存在性 |
| `tsc --noEmit` | ADR 涉及代码变更时 | 类型安全（新增接口、类型变更） |
| `audit:layers` | ADR 涉及分层变更时 | 跨层调用违规 |
| 人工评审 | ADR 状态 `proposed` → `accepted` | 决策合理性、与既有 ADR 的兼容性 |

---

## 9. 附录：快速入口

- **新增 ADR 从哪开始** → 阅读 §1.1（门槛判断）→ §5（SOP）→ 使用 §2（模板）
- **查看已有 ADR 在哪** → §4.1（清单）→ 原始文件位置（待归集）
- **ADR 与 design 文档怎么配合** → §6（职责边界 + 引用关系）
- **技术债怎么登记** → 本 ADR §4（后果）+ `../02-design/TECH-DEBT.md`
- **回滚怎么操作** → 各 ADR 的 §5（实施与验证）中的回滚步骤

---

_本文档由文档治理整改（P0）创建，随 ADR 归集（P1）和架构演进持续更新。_
