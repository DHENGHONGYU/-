---
title: V9 前端应用测试质量审计报告
type: explanation
domain: qa
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计日期：2026-06-29 审计范围：所有 `*.test.ts` / `*.test.tsx` 文件 审计维度：测试覆盖度评估、边界条件测试、集成测试 审计方式：静态代码分析 + Vitest..."
tags: [qa, quality, audit, test]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-106
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-QA-034, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-QA-102, docs/archive/reference-historical/v9-code-quality-audit-report-20260629.md, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 前端应用测试质量审计报告

> 审计日期：2026-06-29  
> 审计范围：所有 `*.test.ts` / `*.test.tsx` 文件  
> 审计维度：测试覆盖度评估、边界条件测试、集成测试  
> 审计方式：静态代码分析 + Vitest 运行采样 + Playwright 配置检查

---

## 一、测试覆盖度评估

### 1.1 总体统计

| 指标 | 数量 | 备注 |
|------|------|------|
| 测试文件总数 | **100** | 含 `src/` 内联 + `tests/` 目录 |
| describe 测试套件数 | **242** | 平均每个文件 2.4 个套件 |
| 测试用例总数 (it/test) | **1,422** | 平均每个文件 14.2 个用例 |
| 每个 describe 平均用例数 | 5.9 | 套件粒度较细 |

### 1.2 测试文件分布

#### 按目录分布

| 目录 | 测试文件数 | 占比 | 代表模块 |
|------|-----------|------|---------|
| `src/store/` | 24 | 24% | 状态管理层（Zustand Stores） |
| `src/services/` | 27 | 27% | 业务服务层 |
| `tests/` | ~29 | 29% | 顶层集成/页面测试 |
| `src/core/` | 4 | 4% | 核心基础设施 |
| `src/hooks/` | 3 | 3% | React Hooks |
| `src/pages/` | 4 | 4% | 页面组件 |
| 其他（config/lib 等） | 9 | 9% | 配置、工具库等 |

#### Store 层覆盖详情（24/24 ≈ 100% 已覆盖）

| Store 文件 | 是否有测试 | 主要测试点 |
|-----------|-----------|-----------|
| poolStore | ? | 增删改查、状态流转、订阅机制 |
| orderStore | ? | 订单 CRUD、状态变更、持久化 |
| positionStore | ? | 持仓计算、合并逻辑 |
| signalStore | ? | 信号生成、排序、异常处理 |
| dualStrategyStore | ? | 双策略引擎、派生函数、订阅 |
| disciplineStore | ? | 纪律评分、回滚机制 |
| holdingsStore | ? | 持仓管理 |
| backtestStore | ? | 回测状态管理 |
| marketDataStore | ? | 行情数据缓存、订阅 |
| stockAnalysisStore | ? | 个股分析状态机 |
| sectorAnalysisStore | ? | 板块分析状态 |
| strategySnapshotStore | ? | 策略快照管理 |
| localKnowledgeStore | ? | 本地知识库 CRUD |
| industryScoreStore | ? | 行业评分流程 |
| intelligentScoreStore | ? | 智能评分流程 |
| scoreDocStore | ? | 评分文档管理 |
| commandStore | ? | 命令面板状态 |
| workflowStore | ? | 工作流状态 |
| dataflowStore | ? | 数据流状态 |
| agentStore | ? | Agent 运行时状态 |
| widgetStore | ? | 组件面板管理 |
| pageStore | ? | 页面状态管理 |
| hotSectorStore | ? | 热门板块状态 |
| analysisNewsStore | ? | 分析资讯状态 |

> **结论**：Store 层覆盖率达到 **100%**（24/24 个 Store 均有对应测试文件），是项目中测试最完善的层级。

#### Service 层覆盖详情（27 个服务有测试）

| 服务类别 | 已测试服务数 | 代表服务 |
|---------|-------------|---------|
| 评分引擎 | 9 | v6ScoreService、l0_l1_l2、l3、l4_l5_l6、l7_l8、lMinus1、valuePitAnalyzer、hotSectorAnalyzer、rotationSignalDetector |
| 数据获取 | 4 | fetcherClient、fetcherAdapter、fetcherInterceptor、strategyDataAdapter |
| 系统服务 | 3 | systemService、bootstrapService、localDocService |
| 分析服务 | 3 | analysisService、dataFreshnessGuard、dataFusionEngine |
| LLM 服务 | 2 | llmClient、llmClient.multimodel |
| 交易服务 | 1 | tradeReviewAI |
| 新闻服务 | 1 | stockLinker |
| 统一服务 | 1 | unifiedStockService |
| 数据采集 | 1 | TaskScheduler |
| Skill 提示词 | 2 | intelligentScoreSkill、industryScoreSkill |

### 1.3 未覆盖核心模块识别

通过静态扫描，以下核心模块**尚未发现**独立测试文件：

| 模块类别 | 未覆盖模块 | 风险等级 | 说明 |
|---------|-----------|---------|------|
| **数据层** | `src/data/db.ts` (IndexedDB 封装) | ?? 中高 | 核心数据持久化层，虽通过 service 间接测试，但缺少直接单元测试 |
| **数据层** | `src/core/databridge.ts` | ?? 中高 | 数据总线核心，通过集成测试间接覆盖 |
| **组件层** | `src/components/` (UI 组件库) | ?? 中 | 大量通用 UI 组件缺少单元测试（依赖页面级测试间接覆盖） |
| **组件层** | `src/cockpit/widgets/` (仪表盘组件) | ?? 中 | 仪表盘 Widget 组件缺少独立测试 |
| **引擎层** | `src/showcase/index.ts` (主引擎) | ?? 中 | 核心引擎入口，缺少独立测试 |
| **引擎层** | `src/agents/agentRuntime.ts` | ?? 中 | Agent 运行时，缺少独立测试 |
| **核心层** | `src/core/dataflow/dataflowEngine.ts` | ?? 中 | 数据流引擎，通过 store 间接测试 |
| **工具库** | `src/lib/logger.ts` | ?? 低 | 日志工具（注：tests/logger.test.ts 存在，已覆盖） |
| **配置层** | `src/config/routes.ts` | ?? 低 | 路由配置，缺少路由完整性测试 |

### 1.4 覆盖率阈值配置（来自 vite.config.ts）

```typescript
thresholds: {
  'src/core/**':   { statements: 55, branches: 75, functions: 60, lines: 55 },
  'src/data/**':   { statements: 35, branches: 35, functions: 35, lines: 35 },
  'src/lib/**':    { statements: 70, branches: 65, functions: 80, lines: 70 },
  'src/services/**': { statements: 70, branches: 65, functions: 70, lines: 70 },
}
```

> 配置了分级覆盖率阈值，core/services 要求较高（70% 语句覆盖率），data 层要求较低（35%）。

---

## 二、边界条件测试分析

### 2.1 总体评估

| 边界条件类别 | 出现频次（匹配行数） | 覆盖充分度 |
|-------------|---------------------|-----------|
| 空数据 / null / undefined | ~2,176 | ???? 充分 |
| 异常输入 / 错误路径 | 高 | ???? 充分 |
| 边界值测试 | 中高 | ??? 较充分 |
| 并发 / 竞态条件 | 中 | ??? 较充分 |

> 注：通过正则匹配 `空|null|undefined|empty|边界|异常|错误|失败|invalid|error|throw|reject` 等关键词，在测试文件中匹配到 **2,176 行**相关代码，平均每个测试文件约 22 行边界/异常测试代码。

### 2.2 边界条件测试亮点

#### 2.2.1 Store 层异常处理模式

几乎所有 Store 测试均覆盖以下异常场景：

```typescript
// 典型模式（以 localKnowledgeStore 为例）
it('loadDocs: 失败应设置 error', async () => {
  mockListLocalDocs.mockResolvedValue({ success: false, error: '加载失败' })
  await useLocalKnowledgeStore.getState().loadDocs()
  expect(useLocalKnowledgeStore.getState().error).toBe('加载失败')
})

it('loadDocs: 异常应设置 error 并保持 loading=false', async () => {
  mockListLocalDocs.mockRejectedValue(new Error('Network error'))
  await useLocalKnowledgeStore.getState().loadDocs()
  expect(useLocalKnowledgeStore.getState().error).toBe('Network error')
  expect(useLocalKnowledgeStore.getState().loading).toBe(false)
})

it('loadDocs: 非 Error 异常应使用默认错误消息', async () => {
  mockListLocalDocs.mockRejectedValue('timeout') // 字符串异常
  await useLocalKnowledgeStore.getState().loadDocs()
  expect(useLocalKnowledgeStore.getState().error).toBe('无法加载本地文档')
})
```

**覆盖的错误类型**：
- ? Service 返回 `{ success: false }` 业务失败
- ? Service 抛出 `Error` 对象异常
- ? Service 抛出非 Error 类型异常（字符串等）
- ? 网络超时 / 连接失败
- ? 空数据输入（空数组、空字符串、null）

#### 2.2.2 并发锁测试

多个 Store 测试验证了并发锁机制：

| Store | 测试点 |
|-------|-------|
| poolStore | `refresh 并发锁（isRefreshing=true 时跳过）` |
| dualStrategyStore | `fetchScores 并发锁（isRefreshing=true 跳过）` |
| disciplineStore | `recalculate 并发锁`、`无报告时启动 isRefreshing 并在完成后释放` |
| signalStore | `设置 loading / isRefreshing 状态` |

#### 2.2.3 评分引擎边界值测试

V6 评分引擎的计算器测试包含大量边界值验证：

**估值判定边界**（l0_l1_l2.test.ts）：
- 低估：PE低 + 高增长
- 合理：中等 PE
- 高估：较高 PE
- 极高：极高 PE
- 亏损：PE < 0
- 无PE：PE undefined
- 芯片行业特殊阈值

**信号强度边界**（dualStrategyStore.test.ts）：
- `confidence >= 0.7 → strong`
- `confidence >= 0.4 → medium`
- 否则 `weak`

#### 2.2.4 空数据与边界输入

| 测试场景 | 示例文件 | 测试点 |
|---------|---------|-------|
| 空股票池 | signalStore.test.ts | `股票池为空 → signals 为空` |
| 空 symbol | intelligentScoreStore.test.ts | `symbol 为空时清空历史` |
| 空 code | industryScoreStore.test.ts | `code 为空时清空历史` |
| 非法股票代码 | poolStore.test.ts | `股票不存在返回 false` |
| 空分组名 | poolStore.test.ts | `空分组名返回 false` |
| LLM 未配置 | intelligentScoreStore.test.ts | `LLM 未配置时设置错误并展开配置` |
| 边界 limit 值 | signalStore.test.ts | `topSignals: limit 大于总数`、`signals 为空` |

### 2.3 边界条件测试不足点

| 类别 | 不足点 | 风险等级 | 建议 |
|------|-------|---------|------|
| 数值边界 | 极端大值/极小值测试较少 | ?? 中 | 增加数值溢出、精度丢失场景测试 |
| 时间边界 | 时区、夏令时、闰日测试缺失 | ?? 中 | 增加时间相关边界测试 |
| 并发深度 | 仅测试单次并发锁，缺少高并发场景 | ?? 中 | 增加并发压力测试（如 100 次并发调用） |
| 内存边界 | 大数据量下的内存/性能测试缺失 | ?? 中高 | 增加大数据量（1000+ 股票）场景测试 |
| 组件边界 | UI 组件的边界 props 测试不足 | ?? 中高 | 为核心 UI 组件补充边界 props 测试 |

---

## 三、集成测试与 E2E 测试分析

### 3.1 E2E 测试（Playwright）

#### 配置概览

- **测试框架**：Playwright (`@playwright/test v1.61.1`)
- **测试目录**：`e2e/`
- **基础 URL**：`http://localhost:4173`（使用 `vite preview` 启动）
- **浏览器**：Chromium (Desktop Chrome)
- **重试机制**：CI 环境下重试 2 次
- **追踪**：首次失败时录制 trace
- **截图**：仅失败时截图

#### 现有 E2E 测试用例

| 测试文件 | 测试套件 | 用例数 | 覆盖业务流程 |
|---------|---------|-------|-------------|
| `e2e/pool-group.spec.ts` | 股票池分组 | 5 | 分组 UI 控件展示、新建分组、录入股票到新分组、分组筛选、分组删除（待确认） |

> **E2E 测试覆盖率：约 1 个测试文件，5 个测试用例**  
> 与安装指南中提到的 "5 条 E2E 核心链路" 存在差异，需确认其他 E2E 测试文件位置或状态。

#### E2E 覆盖缺口

根据 V9 系统核心业务模块，以下关键流程**缺少** E2E 测试：

| 核心业务流程 | 优先级 | 说明 |
|-------------|-------|------|
| 股票录入与池管理 | P0 | 部分覆盖（pool-group.spec.ts） |
| 个股评分流程 | P0 | V6 评分、智能评分端到端流程未覆盖 |
| 板块分析流程 | P1 | 热门板块、价值洼地、轮动信号 |
| 交易复盘流程 | P1 | 订单录入、纪律评分、交易回顾 |
| 数据导入导出 | P1 | V6 迁移、JSON 导入导出 |
| 本地知识库 | P2 | 文档导入、搜索、分类 |
| 仪表盘驾驶舱 | P2 | Widget 布局、自定义看板 |
| PWA 离线能力 | P2 | 离线访问、缓存策略 |

### 3.2 组件集成测试

#### 页面级测试（React Testing Library）

| 测试文件 | 位置 | 用例数 | 覆盖页面 |
|---------|------|-------|---------|
| AnalysisApp.test.tsx | tests/ | ~8 | 分析应用主页面 |
| InputApp.test.tsx | tests/ | ~8+ | 录入应用主页面 |
| OutputApp.test.tsx | tests/ | 3 | 导出应用主页面 |
| TradingApp.test.tsx | tests/ | ~15 | 交易应用主页面 |
| CommandApp.test.tsx | tests/ | ~4 | 命令面板 |
| NewsPage.test.tsx | tests/ | ~4 | 资讯页面 |
| ScoreDocPage.test.tsx | tests/ | ~4 | 评分文档页面 |
| StrategySnapshotPage.test.tsx | tests/ | ~4 | 策略快照页面 |
| StrategySnapshotPage.lifecycle.test.tsx | tests/ | ~7 | 策略快照生命周期 |
| LocalKnowledgePage.test.tsx | tests/ | ~7 | 本地知识库页面 |
| IntelligentScorePage.test.tsx | tests/ | ~6 | 智能评分页面 |
| IndustryScorePage.test.tsx | tests/ | ~6 | 行业评分页面 |
| StockAnalysisPage.test.tsx | src/pages/analysis/ | 5 | 个股分析页面 |
| SectorAnalysisPage.test.tsx | src/pages/analysis/ | 5 | 板块分析页面 |
| HotSectorPage.test.tsx | src/pages/analysis/ | 5 | 热门板块页面 |
| ValuePitPage.test.tsx | src/pages/analysis/ | 5 | 价值洼地页面 |
| CoreResourcePanel.test.tsx | tests/ | ~5 | 核心资源面板 |
| HotSectorWidget.test.tsx | tests/ | ~4 | 热门板块组件 |
| ValuePitWidget.test.tsx | tests/ | ~4 | 价值洼地组件 |
| MigrationPanel.test.tsx | tests/ | ~4+ | 迁移面板组件 |
| NewsFeed.test.tsx | tests/news-v6/ | ~8 | 资讯流组件 |

> **组件/页面集成测试总计**：约 20+ 个测试文件，130+ 个用例。

#### 集成测试特点

1. **Mock 策略完善**：广泛使用 `vi.spyOn` 和 `vi.mock` 模拟 service 层
2. **用户交互模拟**：使用 `@testing-library/user-event` 模拟真实用户操作
3. **异步等待**：使用 `waitFor` 和 `findBy*` 处理异步渲染
4. **错误路径测试**：覆盖服务失败、网络异常等场景（如 OutputApp 导出失败）

### 3.3 服务层集成测试

以下测试涉及多模块协作，属于集成测试范畴：

| 测试文件 | 集成范围 |
|---------|---------|
| unifiedStockService.test.ts | 多数据源融合（stock + quotes + v6Score + rotation + ...） |
| dataFusionEngine.test.ts | 数据融合引擎多通道集成 |
| dualStrategyEngine.test.ts | 双策略引擎端到端 |
| strategyEngine.test.ts | 策略引擎整体流程 |
| localDocService.test.ts | 文档服务 + IndexedDB 集成 |
| fetcher/dataSourceProvider.test.ts | 多数据源提供者集成 |
| engine.test.ts | 主引擎集成 |

---

## 四、测试质量综合评分

### 4.1 评分矩阵

| 维度 | 权重 | 得分 | 说明 |
|------|------|------|------|
| **测试覆盖度** | 40% | **85/100** | Store 层 100% 覆盖，Service 层覆盖较全，组件层覆盖不足 |
| **边界条件测试** | 30% | **82/100** | 异常路径覆盖充分，数值/时间/并发深度边界可加强 |
| **集成测试** | 30% | **65/100** | 页面级集成测试较好，E2E 测试严重不足（仅 1 个文件） |
| **综合得分** | 100% | **78.4/100** | B 级（良好） |

### 4.2 等级评定

```
综合评分：78.4 / 100 → 等级：B (良好)

S (95+): 卓越
A (85-94): 优秀
B (70-84): 良好  ← 当前
C (55-69): 合格
D (<55): 待改进
```

---

## 五、改进建议

### P0 - 高优先级（建议立即处理）

1. **补充 E2E 核心链路测试**
   - 目标：至少覆盖 5 条核心业务流程（与安装指南描述一致）
   - 建议增加：个股评分 E2E、交易复盘 E2E、数据迁移 E2E
   - 预期收益：显著提升集成测试得分（+15 分）

2. **补充核心数据层直接测试**
   - 目标：为 `src/data/db.ts` 和 `src/core/databridge.ts` 增加独立单元测试
   - 建议覆盖：DB 初始化、事务、错误恢复、数据迁移
   - 预期收益：降低数据层风险，提升底层可靠性

### P1 - 中优先级（建议下个迭代处理）

3. **加强 UI 组件单元测试**
   - 目标：为 `src/components/ui/` 下的核心通用组件补充测试
   - 建议从高频使用组件开始：Button、Input、Table、Modal、Card 等
   - 预期收益：提升组件层质量，减少回归 bug

4. **增加边界值深度测试**
   - 目标：补充极端数值、大数据量、高并发场景测试
   - 具体：1000+ 股票池性能、数值精度边界、并发压力测试
   - 预期收益：提升系统鲁棒性

5. **补充 Widget 组件测试**
   - 目标：为 `src/cockpit/widgets/` 下的仪表盘组件补充测试
   - 预期收益：保障驾驶舱功能稳定性

### P2 - 低优先级（长期优化）

6. **可视化覆盖率门禁**
   - 配置 CI 中的覆盖率报告上传与趋势追踪
   - 逐步提升各层级覆盖率阈值

7. **测试类型分层标记**
   - 使用 `@vitest/browser` 或标签系统明确区分：单元测试 / 集成测试 / 组件测试

8. **属性测试（Property-based Testing）**
   - 对评分引擎等纯函数模块引入 fast-check 等属性测试框架

---

## 六、附录：测试文件完整清单

### src/store/ (24 个文件)

1. `poolStore.test.ts` - 股票池状态管理
2. `orderStore.test.ts` - 订单状态管理
3. `positionStore.test.ts` - 持仓状态管理
4. `signalStore.test.ts` - 信号状态管理
5. `dualStrategyStore.test.ts` - 双策略状态
6. `disciplineStore.test.ts` - 纪律评分状态
7. `holdingsStore.test.ts` - 持仓管理状态
8. `backtestStore.test.ts` - 回测状态
9. `marketDataStore.test.ts` - 行情数据状态
10. `stockAnalysisStore.test.ts` - 个股分析状态
11. `sectorAnalysisStore.test.ts` - 板块分析状态
12. `strategySnapshotStore.test.ts` - 策略快照状态
13. `localKnowledgeStore.test.ts` - 本地知识库状态
14. `industryScoreStore.test.ts` - 行业评分状态
15. `intelligentScoreStore.test.ts` - 智能评分状态
16. `scoreDocStore.test.ts` - 评分文档状态
17. `commandStore.test.ts` - 命令面板状态
18. `workflowStore.test.ts` - 工作流状态
19. `dataflowStore.test.ts` - 数据流状态
20. `agentStore.test.ts` - Agent 状态
21. `widgetStore.test.ts` - 组件面板状态
22. `pageStore.test.ts` - 页面状态
23. `hotSectorStore.test.ts` - 热门板块状态
24. `analysisNewsStore.test.ts` - 分析资讯状态

### src/services/ (27 个文件)

1. `scoring/v6-engine/calculators/l0_l1_l2.test.ts`
2. `scoring/v6-engine/calculators/l3.test.ts`
3. `scoring/v6-engine/calculators/l4_l5_l6.test.ts`
4. `scoring/v6-engine/calculators/l7_l8.test.ts`
5. `scoring/v6-engine/calculators/lMinus1.test.ts`
6. `scoring/v6-engine/v6-engine.test.ts`
7. `scoring/v6ScoreService.test.ts`
8. `scoring/valuePitAnalyzer.test.ts`
9. `scoring/hotSectorAnalyzer.test.ts`
10. `scoring/rotationSignalDetector.test.ts`
11. `scoring/intelligentScoreSkill.test.ts`
12. `scoring/industryScoreSkill.test.ts`
13. `fetcher/fetcherClient.test.ts`
14. `fetcher/fetcherAdapter.test.ts`
15. `fetcher/fetcherInterceptor.test.ts`
16. `fetcher/strategyDataAdapter.test.ts`
17. `system/systemService.test.ts`
18. `system/bootstrapService.test.ts`
19. `analysis/analysisService.test.ts`
20. `analysis/__tests__/dataFreshnessGuard.test.ts`
21. `analysis/dataFusionEngine.test.ts`
22. `llm/llmClient.test.ts`
23. `llm/llmClient.multimodel.test.ts`
24. `trading/tradeReviewAI.test.ts`
25. `news/stockLinker.test.ts`
26. `unifiedStockService.test.ts`
27. `data-collector/TaskScheduler.test.ts`

### tests/ 目录 (约 29+ 个文件)

- 页面级测试：AnalysisApp、InputApp、OutputApp、TradingApp、CommandApp
- 功能页面：NewsPage、ScoreDocPage、StrategySnapshotPage、LocalKnowledgePage、IntelligentScorePage、IndustryScorePage
- 组件测试：CoreResourcePanel、HotSectorWidget、ValuePitWidget、MigrationPanel、ui-components
- 服务测试：localDocService、dualStrategyEngine、strategyEngine、databridgePriority、outputStore
- 基础设施：pwa、logger、eventBus、engine、queryBuilder、useDebounce
- 新闻模块：newsStore.subscriptions、newsStore.bookmarks、news-v6/NewsPage、news-v6/NewsFeed
- Fetcher 测试：fetcher/dataSourceProvider
- 数据采集：services/MarketDataAdapter、services/MockCollector
- Agent 相关：agentRegistry、agentHealthMonitor、agentConfigManager
- 数据桥接：databridgeStore、databridgeAdapter
- 引擎相关：engineStore、engine

### e2e/ 目录 (1 个文件)

1. `pool-group.spec.ts` - 股票池分组 E2E 测试

---

> **审计结论**：V9 前端应用的测试体系整体处于**良好水平**。Store 层测试覆盖率达到 100%，边界条件测试较为充分，体现了良好的单元测试实践。主要短板在于 E2E 测试数量不足（与文档描述存在差距）以及 UI 组件层的单元测试覆盖度较低。建议优先补充核心业务链路的 E2E 测试，以提升整体测试质量等级。

— 审计结束 —
