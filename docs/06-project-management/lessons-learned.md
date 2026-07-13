# V9 项目经验教训知识库

> **版本**: v1.0.0 | **生成日期**: 2026-07-13 | **来源**: 12 份审计报告 + 3 份历史教训文件 + 本次对话关键决策
> **覆盖范围**: MCP Server 治理、Agent 运行时、代码质量、UI 路由、类型系统、数据层、文档管理、测试策略、调试方法论、SKILL 与代码差距
> **统计**: 共 **21 条**结构化教训（P0: 9 条 | P1: 7 条 | P2: 5 条）

---

## 主题 1：MCP Server 治理

> 来源: `docs/audit/mcp-server-governance-retrospective.md`（2026-07-20）

### 教训 1："配置恢复" ≠ "功能恢复"

- **What**：MCP_SERVER_REGISTRY 中 6 个 Server（screening、stockpool、backtest、export、input、trade）被标记为 `enabled=true`，但 `src/mcp/servers/` 下对应源码文件完全不存在。启动时产生 6 条 `module not found in glob` 错误日志，但系统未终止或告警。
- **Why**：还原操作仅恢复了 Registry 配置文件，未同步恢复 server 源码。依赖方（Agent 编排）认为这些 Server 可用，实际调用失败。
- **Where**：`src/config/mcpServerRegistry.ts` 与 `src/mcp/servers/` 目录的交叉验证。
- **When**：在 PR 拆分时引入，后续版本还原时暴露。诊断于 2026-07-20 确认。
- **Who**：架构组（Registry 配置）+ 开发组（源码缺失）+ 审计者（未做文件存在性验证）。
- **How**：任何恢复操作必须执行「配置 + 源码 + 启动日志」三重验证。建立 MCP Server 健康检查清单（9 项检查点）。
- **严重级**: 🔴 P0

### 教训 2：注册时静默失败的危害

- **What**：`register.ts:60-66` 中当模块不存在时仅打印 `logger.error()` 后 `return null`，未抛出异常或触发告警。6 个缺失 Server 的注册失败被淹没在大量启动日志中。
- **Why**：设计选择「静默失败」以避免启动阻塞，但代价是错误被忽视。`audit:layers` 和 `tsc --noEmit` 均无法检测运行时 glob 缺失。
- **Where**：`src/mcp/register.ts` 的 `registerAllServers()` 方法。
- **When**：MCP Server 注册阶段，每次启动时均发生。
- **Who**：MCP 注册层开发者 + 运维（日志监控缺失）。
- **How**：① 增加 `mcpRegistry.getMissingServers()` 方法，启动时明确列出缺失 Server；② 将文件存在性预检加入 `registerAllServers()` 流程；③ 建立启动健康检查，失败即告警（非静默）。
- **严重级**: 🔴 P0

### 教训 3：诊断前提未验证

- **What**：在治理复盘第一阶段，基于"Server 已恢复"的假设进行设计意图验证，得出 6 个 Server 部分达成的结论。与文件系统交叉验证后发现前提为假，全部结论需推翻。
- **Why**：诊断工作流中缺少「先验证事实、再做判断」的强制步骤。静态分析未扫描文件存在性。
- **Where**：诊断报告初稿与文件系统交叉验证的偏差。
- **When**：2026-07-20 治理复盘诊断阶段。
- **Who**：审计组 + 架构组。
- **How**：任何诊断/评估工作必须首先建立「事实基线」（文件存在性、接口存在性、测试覆盖），确认基线后再进行功能验证。
- **严重级**: 🟡 P1

### 教训 4：文档与实现脱节

- **What**：6 个缺失 Server 的契约文档 `docs/architecture/services/*-contract.md` 已完整存在，但源码实现完全缺失。契约文档成为「未交付功能的承诺」。
- **Why**：文档创建与代码实现未绑定到同一 PR/工单。评审时只检查文档，不验证对应源码。
- **Where**：`docs/architecture/services/` 与 `src/mcp/servers/` 的对比。
- **When**：持续存在，在 2026-07-20 治理复盘中集中暴露。
- **Who**：文档评审者 + 开发者。
- **How**：建立「文档-代码绑定」规则：契约文档创建时必须同时提交源码骨架（至少含 `export class XServer extends MCPServerBase`），否则文档不合并。
- **严重级**: 🟡 P1

### 教训 5：MCP 参数复杂度未评估

- **What**：`backtest` Server 需要 8 个配置参数（strategy/startDate/endDate/initialCapital/commissionRate/slippage/maxPositionPct），即使文件存在，参数复杂度也不适合 MCP 工具调用的 schema 表达。
- **Why**：新增 MCP Tool 前未评估参数数量和复杂度。未建立「参数复杂度门禁」规则。
- **Where**：`backtest/backtestServer.ts` 的设计意图验证。
- **When**：2026-07-20 治理复盘。
- **Who**：MCP Server 设计者 + 架构评审。
- **How**：新增 MCP Tool 时，若参数超过 5 个或包含嵌套对象，必须经架构评审。提供预设模板或配置引用方式简化参数。
- **严重级**: 🟡 P2

### 教训 6：Store 持久化设计缺失

- **What**：`backtestStore` 只有 `results`（当前结果）和 `exportReport`（导出当前结果），无 `getBacktestById`/`listHistory`/`saveResult` 方法。`export` Server 即使存在，也无法获取历史回测数据。
- **Why**：设计阶段仅考虑「当前回测」的临时状态，未考虑历史数据的生命周期管理和持久化需求。
- **Where**：`src/store/backtestStore.ts`。
- **When**：设计阶段（持续影响至 2026-07-20）。
- **Who**：Store 设计者 + 需求分析。
- **How**：设计阶段必须考虑数据生命周期（临时态 → 持久态 → 归档态），对需要历史查询的数据建立 IndexedDB + DataBridge 持久化。
- **严重级**: 🟡 P2

---

## 主题 2：Agent 运行时与架构

> 来源: `docs/audit/AGENT_AUDIT_REPORT.md`（2026-06-27）

### 教训 7：Agent 运行时与业务完全脱节

- **What**：5 个已注册 Agent（v6-scoring-agent、v4-industrial-agent、llm-intelligent-agent、fetcher-agent、news-analyzer-agent）的 `runAgent()` 均为占位符（1s 延迟后返回空结果），无真实业务逻辑。所有 AI 功能完全绕过 Agent 直接调用 LLM。
- **Why**：Agent 框架先于业务需求搭建，但后续业务实现（LLM 评分、数据采集）未通过 Agent 调度，直接调用底层服务。
- **Where**：`src/agents/agentRuntime.ts` 的 `runAgent()` 与 `src/services/scoring/`、`src/hooks/cabin/` 的调用链路。
- **When**：2026-06-27 审计确认。影响所有 AI 功能调用。
- **Who**：Agent 框架开发者 + 业务服务开发者（未桥接）。
- **How**：① 为每个 Agent 注册真实 handler（V6/V4 评分调用、数据采集逻辑）；② 将 Hooks 中的直接调用改为 `agentRuntime.execute('agent-id', ...)` 调度；③ 建立 Agent 编排测试，验证 handler 被正确触发。
- **严重级**: 🔴 P0

### 教训 8：Engine 双实例导致状态隔离

- **What**：`src/engine/index.ts` 中通过 `new AgentRuntime()` 创建了独立实例，与 `src/agents/index.ts` 导出的全局单例不是同一对象。两个 AgentRuntime 的注册信息和任务互相不可见。
- **Why**：Engine 层未复用 Agent 系统的单例模式，独立实例化导致状态分裂。
- **Where**：`src/engine/index.ts:33` vs `src/agents/index.ts`。
- **When**：2026-06-27 审计确认。
- **Who**：Engine 层开发者。
- **How**：将 `new AgentRuntime()` 改为 import 共享单例 `import { agentRuntime } from '@/agents/agentRuntime'`。确保单例模式有明确的约束和文档。
- **严重级**: 🔴 P0

### 教训 9：Agent 并发控制未生效

- **What**：`AgentConfig` 中定义了 `maxConcurrent` 字段（如 5、3、2），但 `agentRuntime.execute()` 中完全未检查运行中任务数，Agent 可被无限并发执行，导致资源耗尽。
- **Why**：配置字段已定义但实现逻辑缺失。代码评审时未验证配置字段是否被消费。
- **Where**：`src/agents/agentRuntime.ts:49-119` 的 `execute()` 方法。
- **When**：2026-06-27 审计确认。
- **Who**：Agent 运行时开发者。
- **How**：在 `execute()` 中增加运行中任务数检查，超过 `maxConcurrent` 时排队或拒绝。配置字段必须有对应的实现逻辑，否则不应声明。
- **严重级**: 🔴 P0

### 教训 10：Agent 初始化不在 bootstrap 流程中

- **What**：Agent 系统通过 `src/agents/index.ts:178-184` 的模块导入副作用自动执行，不在 `bootstrapService.initializeApp()` 的控制链中。初始化时机不可控，可能在依赖未就绪时执行。
- **Why**：初始化逻辑写在模块顶层，未纳入应用启动序列。
- **Where**：`src/agents/index.ts` 与 `src/services/system/bootstrapService.ts` 的对比。
- **When**：2026-06-27 审计确认。
- **Who**：应用启动流程开发者 + Agent 系统开发者。
- **How**：在 `bootstrapService.initializeApp()` 中显式调用 `initAgentSystem()`，确保初始化顺序可控、可追踪、可回滚。
- **严重级**: 🟡 P1

---

## 主题 3：代码质量与硬编码

> 来源: `docs/audit/code-quality-audit-report.md`（2026-06-30）、`docs/audit/v9-code-quality-kanban-20260629.md`

### 教训 11：业务参数硬编码（配置化率不足）

- **What**：扫描发现 1,913 个硬编码数字（其中 89 个时间/间隔、45 个超时阈值、23 个重试次数、67 个百分比/倍数、34 个概率/权重）。评分引擎配置化率仅 13%，交易服务 27%，分析引擎 8%。`tradeReviewAI.ts` 中评分阈值 `0.7/0.5/0.3` 直接写死。
- **Why**：缺乏集中配置层，阈值/权重/公式参数分散在各业务文件中。项目未配置 `no-magic-numbers` ESLint 规则。
- **Where**：`src/services/scoring/`、`src/services/trading/` 等核心业务模块。
- **When**：2026-06-30 代码质量审计，长期累积问题。
- **Who**：各业务模块开发者 + 代码评审者（未拦截硬编码）。
- **How**：① 建立 `src/config/v6Thresholds.ts` 等配置层，所有业务参数从配置注入；② 启用 ESLint `no-magic-numbers` 规则；③ 3 位以上数字必须提取为 const 或 config；④ 引擎层阈值、权重、公式参数必须 100% 配置化。
- **严重级**: 🔴 P0

### 教训 12：core/databridge 未捕获 Promise Rejection

- **What**：`core/databridge.ts` 中 59 处未捕获的 Promise Rejection，可能导致 Node 进程崩溃（Node.js 15+ 未处理 rejection 会终止进程）。交易逻辑（34 处）和分析结果（28 处）也存在静默失败。
- **Why**：Promise 链缺少 `.catch()` 或 `try-catch` 包裹。错误处理未纳入设计规范。
- **Where**：`src/core/databridge.ts` 为核心，`src/services/trading/*.ts`（34 处）、`src/services/analysis/*.ts`（28 处）次之。
- **When**：2026-06-30 代码质量审计。
- **Who**：核心框架开发者 + 业务服务开发者。
- **How**：① 为 `core/databridge.ts` 所有 Promise 添加 `.catch()` 处理器；② 建立「核心分支必须有错误日志」的规范；③ 错误日志必须包含 `context` 对象（`logger.error('操作失败', { error: message })`）。
- **严重级**: 🔴 P0

### 教训 13：v6-engine calculators 类型不安全转换

- **What**：v6-engine calculators 从 LLM JSON 响应中提取数据时大量使用 `as` 断言（134 处），`as` 总计 504 次（每文件限 3 次）。`l0_l1_l2.ts` 34 次、`l3.ts` 28 次、`l4_l5_l6.ts` 31 次。运行时类型错误风险极高。
- **Why**：LLM 响应结构不确定，开发者用 `as` 快速规避类型检查，而非使用 `zod` 或自定义验证函数。
- **Where**：`src/services/scoring/v6-engine/calculators/*.ts`。
- **When**：2026-06-30 代码质量审计。
- **Who**：v6-engine 评分引擎开发者。
- **How**：为 LLM 响应引入 `zod` schema 验证，解析前校验 JSON 结构，失败时返回明确的错误类型，禁止使用 `as` 处理外部输入数据。
- **严重级**: 🟡 P1

---

## 主题 4：UI 与路由层

> 来源: `docs/audit/debug-output-cabin-not-rendering.md`（2026-07-04）、`docs/audit/output-cabin-remediation-report.md`（2026-07-04）

### 教训 14：React Router v7 descendant Routes 绝对路径匹配失效

- **What**：`OutputApp.tsx` 和 `InputApp.tsx` 使用嵌套 `<Routes>` + 绝对路径 `/output/*` 进行子路由分发，在 React Router v7.18.0 中 descendant Routes 不再匹配完整 URL，导致主内容区域完全空白（`main.innerHTML.length = 0`）。初始误诊为路由未注册，实际根因为 Router 版本行为变更。
- **Why**：React Router v7 的行为变更未在升级文档中充分评估。嵌套 Routes 的依赖假设（v6 行为）在新版本中失效。
- **Where**：`src/apps/output/OutputApp.tsx` 和 `src/apps/input/InputApp.tsx`。
- **When**：2026-07-04 输出舱不显示问题排查。
- **Who**：UI 开发者 + Router 升级执行者。
- **How**：① 将嵌套 `<Routes>` 替换为 `useLocation()` + 条件渲染；② 升级第三方库后必须验证关键路由行为（至少覆盖所有舱室子路由）；③ 建立 Router 版本兼容性测试（CI 中运行 Playwright 导航测试）。
- **严重级**: 🔴 P0

### 教训 15：应用层直接调用外部依赖层（跨层违规）

- **What**：`InputDashboard.tsx`（L4 应用层）直接 import `src/services/fetcher/fetcherService`（L6 外部依赖层）；`DataTestPanel.tsx` 直接调用 `fetcherService`；`MarketDataProvider.tsx` 直接调用 `llmClient`。
- **Why**：开发时为快速实现功能，绕过了 L3 服务层代理。未在代码评审时检查 `audit:layers`。
- **Where**：`src/apps/input/InputDashboard.tsx`、`src/apps/input/DataTestPanel.tsx`、`src/cockpit/providers/MarketDataProvider.tsx`。
- **When**：2026-06-29 代码质量看板审计（P0-01/02/03）。
- **Who**：输入舱和驾驶舱开发者。
- **How**：① 严格遵循六层架构隔离：L4 禁止直接调用 L6，必须通过 L3 间接调用；② 新增 L3 代理服务（如 `inputService.ts`、`dataTestService.ts`）；③ `audit:layers` 必须在 CI 中阻塞（已实现）。
- **严重级**: 🔴 P0

---

## 主题 5：类型系统与分层合规

> 来源: `docs/audit/code-quality-audit-report.md`、`docs/audit/代码质量合规审查报告_2026-07-08.md`

### 教训 16：硬编码 `any` 类型与 `as` 断言泛滥

- **What**：4 处硬编码 `any`（`List.tsx:34`、`routes.ts:12`、`tradingService.ts:67`、`stockAnalysisEngine.ts:234`），504 次 `as` 强制类型转换。`List.tsx` 的 `params: any` 可用 `unknown` + 类型守卫替代。
- **Why**：类型安全规范（`@typescript-eslint/no-explicit-any: error`）已定义但执行不严。外部数据类型不确定时倾向于 `any` 而非定义接口。
- **Where**：`src/components/ui/List.tsx`、`src/config/routes.ts`、`src/services/trading/tradingService.ts`、`src/services/analysis/stockAnalysisEngine.ts`。
- **When**：2026-06-30 代码质量审计 + 2026-07-08 合规审查。
- **Who**：各模块开发者。
- **How**：① 禁止使用 `any`，使用 `unknown` + 类型守卫；② 禁止 `@ts-ignore`（使用 `@ts-expect-error` 并附注释）；③ 所有数据结构先定义 TypeScript Interface；④ 外部 API 响应使用 `zod` 或 `io-ts` 验证。
- **严重级**: 🟡 P1

### 教训 17：服务层直连 `@/data/db`（已接受底层偏差）

- **What**：`audit:layers` 检出 11 处 services 层直接 import `@/data/db`，与 AGENTS.md「services 禁止直接写 db」存在张力。虽为项目已接受的底层偏差（migration/bootstrap/low-level 服务），但需明确契约边界。
- **Why**：部分服务（数据迁移、启动引导）需要直接访问数据库，AGENTS.md 的「禁止直接写 db」规则过于绝对，未考虑例外场景。
- **Where**：`src/services/` 中 11 处 `import ... from '@/data/db'`。
- **When**：2026-07-08 代码质量合规审查。
- **Who**：架构组 + 服务层开发者。
- **How**：在 AGENTS.md 中明确 services 层直接访问 db 的例外清单（如 `migrationService`、`bootstrapService`、`dataLayer` 本身），其余服务必须通过 `DataBridge.forward()` 写入。
- **严重级**: 🟡 P1

---

## 主题 6：数据层与状态管理

> 来源: `docs/audit/V9 架构缺陷与整改行动清单.md`（2026-06-27）、`docs/audit/audit-summary-report.md`（2026-06-27）

### 教训 18：组件状态未上提 Store（分散的 useState）

- **What**：大量组件（如 `InputDashboard.tsx` 16+ 个 `useState`、`TradingApp.tsx` 9 个 `useState`、`StrategySnapshotPage.tsx` 10 个 `useState`）使用局部状态管理，无独立 Zustand Store，状态无法跨组件共享。`outputStore`/`commandStore` 已创建但组件未接入。
- **Why**：快速实现时未遵循「四步集成契约」（类型 → Store → Service → UI）。组件层直接管理状态，导致状态分散、逻辑不可复用。
- **Where**：`src/apps/input/`、`src/apps/trading/`、`src/apps/output/`、`src/apps/command/` 等。
- **When**：2026-06-27 架构缺陷清单审计（批次 B-E）。
- **Who**：各舱室开发者。
- **How**：① 严格执行四步集成：类型定义 → Zustand Store（withBroadcast）→ Service（DataBridge）→ UI；② 组件只负责渲染，状态由 Store 持有；③ 使用 `usePoolData` 的组件必须评估是否需要独立 Store。
- **严重级**: 🟡 P2

---

## 主题 7：文档与知识管理

> 来源: `docs/audit/文档-代码双向一致性检测报告_2026-07-08.md`、`docs/audit/代码质量整改与回归测试报告_2026-07-08.md`

### 教训 19：RBAC 文档断层（代码超前、文档未同步）

- **What**：v24 引入了完整的 RBAC 权限系统（6 表 + 7 个 ENVELOPE_ACTION），但 `ARCHITECTURE.md` 和 `DATA_DEFINITION.md` 完全无 RBAC 记录。`AGENTS.md` 仅在 migration 段提及，顶部服务层清单未列 `rbac` 子域。新人从核心文档无法得知 RBAC 存在。
- **Why**：功能开发完成后未同步更新核心架构文档。文档更新未纳入功能交付的 DoD（Definition of Done）。
- **Where**：`AGENTS.md`（:16, :669）、`ARCHITECTURE.md`、`DATA_DEFINITION.md`。
- **When**：2026-07-08 文档-代码双向一致性检测。
- **Who**：RBAC 功能开发者 + 文档维护者。
- **How**：① 将「文档同步」纳入功能交付的 DoD（完成标准）；② 建立 `ARCHITECTURE.md` 和 `DATA_DEFINITION.md` 为必须更新的文档；③ 使用自动化脚本（`doc-code-consistency.cjs`）定期检测文档滞后。
- **严重级**: 🟡 P1

### 教训 20：文档数字滞后与重复过期

- **What**：`AGENTS.md` 中 `services` 子域写为 20 个（实际 21），Zustand Store 写为 47 个（实际 49）。60+ 报告文档存在重复（如两份测试覆盖率对比）和过期（如 06-27 架构报告已偏旧）。Glob 扫描上限（100 个）被 `node_modules` 截断导致「假阴性」。
- **Why**：文档维护为手动更新，与代码变更不同步。文档积累未清理，导致信息噪音。
- **Where**：`AGENTS.md` 顶部数字、`docs/` 下 60+ 份报告。
- **When**：2026-07-08 双向一致性检测。
- **Who**：文档维护者 + 团队知识管理。
- **How**：① 核心文档（AGENTS.md/ARCHITECTURE.md/DATA_DEFINITION.md）使用「引用 + 脚本生成」而非硬编码数字；② 定期清理过期文档，定唯一真相源（如加 `deprecated` 红标）；③ Glob 扫描时务必排除 `node_modules`。
- **严重级**: 🟡 P2

---

## 主题 8：测试策略与质量门禁

> 来源: `docs/audit/mcp-server-governance-retrospective.md`、`docs/audit/output-cabin-remediation-report.md`、`docs/audit/代码质量合规审查报告_2026-07-08.md`

### 教训 21：测试覆盖盲区（缺失的 Server 永远不会被测试）

- **What**：`mcp/__tests__/servers.test.ts` 只测试已存在的 Server，6 个缺失的 Server 永远不会被测试，回归测试无法发现文件缺失。`output-cabin` 无 e2e 测试，路由缺失问题只能通过手动验证发现。
- **Why**：测试用例基于文件存在性生成，缺失的文件自然不被覆盖。新增测试用例未覆盖「文件不存在」的边界场景。
- **Where**：`mcp/__tests__/servers.test.ts`、`e2e/` 目录。
- **When**：2026-07-04（输出舱）+ 2026-07-20（MCP Server）。
- **Who**：测试组 + 开发者。
- **How**：① 基于 Registry 配置生成测试用例（而非文件存在性），验证「所有注册条目都有文件」；② 新增模块时同步补充 e2e 测试（输出舱已补 20 个用例）；③ 建立「测试覆盖」为 PR 合并的强制检查项。
- **严重级**: 🟡 P2

### 教训 22：审计工具误报阻塞合并

- **What**：`audit:hardcode` 将 59 处防御性静默回退（`?? 0` / `?? ''` / `|| 兜底文案`）误判为硬编码，导致门禁 `FAIL`。`event-listener-cleanup` 未识别「订阅返回值清理」范式（`taskScheduler.subscribe()` 返回 `unsubscribe` 函数）。`ui-hardcoded-colors` 将测试文件和令牌定义文件纳入误报。
- **Why**：审计脚本的启发式规则过于严格，未区分「业务逻辑硬编码」与「防御性默认值」。
- **Where**：`scripts/audit-hardcode.ts`、`skills/quality-gate-check.cjs`。
- **When**：2026-07-08 代码质量合规审查。
- **Who**：门禁工具开发者 + 质量审计组。
- **How**：① 在审计脚本中为 `?? 0` / `?? ''` / `|| 兜底文案` 增加白名单或降级为 Warning；② 扩展 `event-listener-cleanup` 识别 `subscribeRef/unregister/off/cancel` 等返回值清理模式；③ 排除 `*.test.ts(x)` 和 `__tests__` 目录的颜色检查；④ 采用「基线 ratchet」策略：违规数只减不增，新增即拦截。
- **严重级**: 🟡 P1

---

## 主题 9：调试方法论与过程改进

> 来源: `docs/audit/debug-output-cabin-not-rendering.md`（2026-07-04）

### 教训 23：静态分析易被表面现象误导

- **What**：输出舱不显示问题初始诊断为「ROUTE_REGISTRY 缺少 `/output/*` 子路径注册」，但运行时验证脚本证明所有路径已注册。真实根因为 React Router v7 descendant Routes 路径匹配失效，而非路由缺失。前一版「路由注册补全」修复虽完成但未解决核心问题。
- **Why**：静态分析（代码扫描）只能验证「注册存在」，无法验证「运行时匹配行为」。仅通过 `main.innerHTML.length = 0` 和 `lazy chunk 未请求` 的运行时证据才定位真实根因。
- **Where**：`src/apps/output/OutputApp.tsx` 的嵌套 Routes 诊断过程。
- **When**：2026-07-04 输出舱排查。
- **Who**：调试者 + 开发者。
- **How**：遵循「假设 → 证伪 → 证据 → 修复 → 验证」的科学调试流程：先假设根因，用运行时证据证伪，再收集新证据定位真实根因。复杂问题必须结合运行时验证，不可仅依赖静态分析。
- **严重级**: 🟡 P1

---

## 主题 10：SKILL 与代码实现差距

> 来源: `docs/audit/AGENT_AUDIT_REPORT.md`（2026-06-27，§9）

### 教训 24：SKILL 方法论与代码实现严重脱节

- **What**：V6 九层分析方法论（SKILL v4.3）定义了 L-1 到 L8 的完整分析框架（含 STEEP 宏观、护城河、竞品、财务、估值、情景、T-M、Hype、第二曲线、筹码变化度等），但 `stockAnalysisEngine.ts` 中 L-1 完全缺失，L0-L8 大部分为占位符（注释"后续接入 LLM"）。7 个关键业务模块（L-1 行业评分、L3 IPC 临界点、L8 筹码变化度等）完全无代码。
- **Why**：SKILL 方法论作为文档规范，但代码实现仅完成基础框架，复杂业务逻辑（LLM 增强、多维度量化）未接入。开发与方法论团队之间的交付未对齐。
- **Where**：`src/services/analysis/stockAnalysisEngine.ts` vs `.agents/skills/v6-stock-analysis-model/SKILL.md`。
- **When**：2026-06-27 Agent 审计（§9 追加分析）。
- **Who**：方法论团队（SKILL 定义）+ 代码实现团队（stockAnalysisEngine）。
- **How**：① 建立「SKILL 方法论的代码实现跟踪矩阵」，每项方法论必须有对应的代码实现和测试用例；② 代码权重表必须与 SKILL 权重表一致（如 L-1 10%、L3 财务+估值各 10%）；③ 层命名和定义必须同步（如 L5 应为 T-M 矩阵而非 T+0 策略）。
- **严重级**: 🟡 P1

---

## 主题 11：架构分层与目录归位

> 来源: 本次架构清理任务（2026-07-13）

### 教训 25：语义重复与目录错位会绕过静态审计

- **What**：`src/services/fetcher/` 目录下长期存放 `fetcherInputService.ts`、`hotSectorService.ts`、`batchImportExecutor.ts` 等输入域（input）服务，与 `src/services/input/` 职责重叠，形成「同名不同目录」的语义重复。`audit:layers` 和 `audit:deadcode` 均报告 0 违规，因为脚本只检测跨层调用和未注册页面，不检测领域目录错位。
- **Why**：早期代码把「数据获取（fetcher）」和「候选股票录入（input）」混在同一目录；后续重构只新建了 `src/services/input/` 的部分文件，未清理旧位置，导致引用方分裂为 `@/services/fetcher/...` 和 `@/services/input/...` 两派，测试中也同时存在两种路径。
- **Where**：`src/services/fetcher/` vs `src/services/input/`，影响 `InputDashboard.tsx`、`HotSectorPanel.tsx`、`StockSearch.tsx`、`inputHubStore.ts`、`strategyEngine.ts` 及 9 个测试文件。
- **When**：2026-07-13 架构专项清理中确认并修复。
- **Who**：架构清理执行者 + 代码评审（未在 PR 阶段发现目录错位）。
- **How**：
  1. 新增 `architecture-cleanup` SKILL，要求重构前用 `diff`/`Grep` 扫描疑似重复文件和分裂的 import 路径；
  2. 将 input 域文件统一归位到 `src/services/input/`，`fetcherInputService.ts` 重命名为 `inputService.ts`；
  3. 批量更新 `src/` 与 `tests/` 的 import 路径；
  4. 把「候选池」UI 文案统一为状态机官方名称「意向候选池」，并同步更新测试中断言。
- **严重级**: 🟡 P1

### 教训 26：Store 层直接依赖 data/ 是隐蔽的跨层违规

- **What**：`customAgentStore.ts` 和 `watchlistStore.ts` 直接 `import { dataLayer } from '@/data/dataLayer'`，调用 `dataLayer.customAgents.*` 和 `dataLayer.watchlists.save()`。`audit:layers` v3.0 未报告这两处为违规（脚本未将 Store→data 导入纳入检测规则），但明确违反 `AGENTS.md`「`store/` 只能依赖 `services/` 和 `core/`」的分层规则。
- **Why**：Store 开发时为图方便直接复用 dataLayer API；审计脚本规则滞后于架构契约。
- **Where**：`src/store/customAgentStore.ts:14`、`src/store/watchlistStore.ts:22`。
- **When**：2026-07-13 架构专项清理中确认并修复。
- **Who**：Store 开发者 + 审计脚本维护者。
- **How**：
  1. 新建 `src/services/system/customAgentService.ts` 和 `src/services/trading/tradingService.ts#persistWatchlistSnapshot`，将 dataLayer 调用下沉到服务层；
  2. Store 仅依赖 Service；
  3. 同步修复 `systemService.test.ts` 中缺失的 `STORE_NAME` 和 `dataBridge.query` mock，避免测试因重构暴露的预存缺陷而失败。
- **严重级**: 🟡 P1

---

## 附录 A：预防措施清单（按执行频率）

### 每次提交前（开发者自检）

| # | 检查项 | 验证命令 |
|---|-------|---------|
| A1 | 无跨层调用违规 | `npm run audit:layers` |
| A2 | 无真实硬编码（排除静默回退） | `npm run audit:hardcode` |
| A3 | 路由一致性 | `npm run audit:routes` |
| A4 | 类型安全 | `npx tsc --noEmit` |
| A5 | 新增文件已注册到 Registry/Store/Config | 人工核对 |

### 每次 PR 合并前（代码评审）

| # | 检查项 | 检查方法 |
|---|-------|---------|
| B1 | 文档与代码同步更新（AGENTS.md/ARCHITECTURE.md/DATA_DEFINITION.md） | 人工核对文件变更列表 |
| B2 | 新增 MCP Server 通过 9 项检查清单（见附录 B） | 逐项勾选 |
| B3 | 新增 Agent 有真实 handler，非占位符 | 阅读 handler 实现 |
| B4 | 配置字段有对应的消费逻辑 | 全局搜索字段名 |
| B5 | 测试覆盖新增代码（单元测试 + e2e） | 查看测试文件变更 |

### 每次版本发布前（发布审计）

| # | 检查项 | 验证方法 |
|---|-------|---------|
| C1 | 文件存在性 vs 配置注册一致性（Glob 扫描） | `Get-ChildItem` / `find` |
| C2 | 文档-代码双向一致性 | `node scripts/doc-code-consistency.cjs --json` |
| C3 | 全量测试通过（单元 + e2e） | `npm run test -- --run` + `npm run test:e2e` |
| C4 | 质量门禁全通过（含 audit:layers/contract/routes） | `npm run audit` |
| C5 | SKILL 方法论与代码权重表对齐 | 人工比对 `agents/skills/` 与 `services/analysis/` |

---

## 附录 B：MCP Server 新增/恢复检查清单（SKILL 模板）

```markdown
## MCP Server 新增/恢复检查清单

- [ ] 文件存在性：`src/mcp/servers/{domain}/{domain}Server.ts` 存在
- [ ] 注册配置：`src/config/mcpServerRegistry.ts` 中条目已添加
- [ ] 类名一致性：`exportName` 与实际导出类名一致
- [ ] 接口实现：继承 `MCPServerBase`，实现 `info`/`listTools`/`listResources`
- [ ] 参数评估：Tool 参数数量 ≤ 5，复杂对象需评估是否适合 MCP
- [ ] 启动验证：`npm run dev` 启动无 `module not found in glob` 错误
- [ ] 测试覆盖：`mcp/__tests__/` 中有对应 Server 的单元测试
- [ ] 文档同步：`docs/architecture/services/{domain}-contract.md` 已更新
- [ ] 依赖检查：无跨层调用（`audit:layers` 通过）
- [ ] 类型安全：`tsc --noEmit` 无错误
```

---

## 附录 C：严重级分布与趋势

| 严重级 | 数量 | 占比 | 核心特征 |
|-------|------|------|---------|
| 🔴 P0 | 9 | 37.5% | 系统阻断性、数据丢失、进程崩溃、功能名不副实 |
| 🟡 P1 | 9 | 37.5% | 架构决策、类型安全、文档断层、调试效率 |
| 🟡 P2 | 6 | 25.0% | 可维护性、状态管理、知识噪音、方法论差距 |

**P0 教训聚焦三大根因**：
1. **配置与文件不同步**（MCP Server 6 个缺失）
2. **框架与业务脱节**（Agent 运行时 5 个占位符、Engine 双实例）
3. **防御缺失**（未捕获 Promise 59 处、硬编码 1,913 处）

**P1 教训聚焦两大根因**：
1. **验证流程缺失**（诊断前提未验证、参数复杂度未评估）
2. **文档滞后**（RBAC 断层、SKILL 差距）

---

> **文档归档**: 本文档已纳入 `docs/06-project-management/lessons-learned.md`
> **信息源**: `docs/audit/` 下 12 份审计报告 + `docs/reports/lessons-learned/` 下 3 份历史文件（内容为空，已标注）
> **维护建议**: 每次新增审计报告后，由架构组更新本文件，保持教训的时效性和可追踪性。
