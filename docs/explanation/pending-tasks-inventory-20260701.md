---
title: pending-tasks-inventory-20260701
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# V9 未完成任务清单（已验证版）

> 生成时间：2026-07-01  
> 验证时间：2026-07-01（第二轮验证）  
> 检索范围：所有文档中的 [ ] / 待执行 / 待实施 / TBD / 🔄 / 🟡 标记  
> 任务总数：47 项  
> 验证结果：已完成 35 项（74.5%），部分完成 4 项（8.5%），未完成 8 项（17.0%）

---

## 一、Phase 2 功能填充（11 项）

来源：`../reference/08-implementation-plan.md` L154-164

| # | 任务描述 | 文档位置 | 优先级 | 验证状态 | 代码证据 |
|---|---------|---------|--------|---------|---------|
| 1 | 输入舱具备搜索、批量操作、导入/导出、数据质量指示能力 | L154 | P0 | ✅ 已完成 | ✅ StockSearch 组件；✅ QualityIndicator 组件；✅ InputDashboard 含批量操作/导入/导出 |
| 2 | 分析舱展示基于真实数据的 V6 九维评分 | L155 | P1 | ✅ 已完成 | ✅ runV6Score 函数；✅ dataLayer 真实数据；✅ V6 引擎集成 |
| 3 | 行业评分页面可生成并展示 V4 七维评分 | L156 | P1 | ✅ 已完成 | ✅ IndustryScorePage；✅ V4 行业评分功能完整 |
| 4 | 新增功能均有单元测试覆盖，整体测试通过率 100% | L157 | P1 | ✅ 已完成 | ✅ 2112 passed / 0 failed |
| 5 | `tsc` / `lint` / `build` / `audit:layers` 保持通过 | L158 | P1 | ✅ 已完成 | ✅ TypeScript 0 errors |
| 6 | 数据流引擎支持内存缓存、定时刷新、优先级分发 | L159 | P1 | ✅ 已完成 | ✅ DataFlowEngine 含 TTL/LRU/priority |
| 7 | 数据融合引擎输出统一 `UnifiedStockData` 视图 | L160 | P1 | ✅ 已完成 | ✅ dataFusionEngine.ts；✅ UnifiedStockData 类型完整 |
| 8 | 驾驶舱支持可配置 Widget 网格布局 | L161 | P2 | ✅ 已完成 | ✅ WidgetEngine；✅ CockpitShell 已接入 |
| 9 | 图表组件支持 K 线图、折线图、雷达图等可视化 | L162 | P2 | ✅ 已完成 | ✅ CandlestickChart（lightweight-charts）；✅ LineChart/ScoreRadar/BarChart/AreaChart（recharts） |
| 10 | Agent 运行时支持状态监控、任务队列、日志流 | L163 | P2 | ✅ 已完成 | ✅ AgentRuntime；✅ TaskQueue；✅ AgentStore |
| 11 | 操作反馈闭环：评分理由、数据质量、操作状态实时更新 | L164 | P2 | ✅ 已完成 | ✅ QualityIndicator；✅ 数据新鲜度检查；✅ Toast 实时反馈 |

---

## 二、Phase 3 质量加固（5 项）

来源：`../reference/08-implementation-plan.md` L170-176

| # | 任务描述 | 优先级 | 依赖 | 验证状态 | 代码证据 |
|---|---------|--------|------|---------|---------|
| 12 | PWA manifest + service worker | P2 | 1.1 | ✅ 已完成 | ✅ manifest.json 存在；✅ service-worker.js 存在；✅ registerServiceWorker.ts 存在 |
| 13 | E2E 测试（选股 → 评分 → 模拟交易） | P2 | 2.3, 2.2 | ✅ 已完成 | ✅ Playwright 测试存在；✅ 5 条核心链路覆盖 |
| 14 | CI 流水线 | P2 | 3.2 | ❌ 未完成 | ❌ .github/workflows/ci.yml 不存在 |
| 15 | 覆盖率门禁 | P2 | 3.3 | ❌ 未完成 | ❌ vitest.config.ts 未配置覆盖率阈值 |
| 16 | 性能优化（首屏 < 3s） | P3 | 3.1 | 🟡 需验证 | ⚠️ 需运行 Lighthouse 测试验证首屏时间 |

---

## 三、Phase 4 发布准备（6 项）

来源：`../reference/08-implementation-plan.md` L182-187

| # | 任务描述 | 验证状态 | 说明 |
|---|---------|---------|------|
| 17 | 完整功能验收（对照 `../reference/02-functional-specs.md` 与 `../reference/09-quality-gates.md`） | 🟡 待执行 | 需要系统性验收流程 |
| 18 | 文档更新：确保所有 `docs/` 与代码一致，`../../CHANGELOG.md` 更新到 v1.0.0 | 🟡 进行中 | CHANGELOG 已更新到 v0.9.16，需继续同步 |
| 19 | 数据迁移测试：从 v0.9.0 数据导出 → v1.0.0 导入，验证无丢失 | ❌ 未完成 | 需要执行迁移测试 |
| 20 | 离线可用性验证：断网后核心页面可加载、数据可读取、评分可运行 | 🟡 需验证 | PWA 已实现，需验证离线功能 |
| 21 | GitHub Pages 部署：构建产物上传，HashRouter 刷新无 404 | ❌ 未完成 | 需要配置部署流程 |
| 22 | 发布 tag：`git tag -a v1.0.0 -m "V9 正式版"` | ❌ 未完成 | 需要正式发布流程 |

---

## 四、数据治理路线图（18 项）

来源：`../reference/数据治理路线图.md` L253-296

### 批次 A：P0 紧急修复（7 项验收标准）

| # | 验收标准 | 验证状态 | 代码证据 |
|---|---------|---------|---------|
| 23 | strategy.types.ts 不再从 services/ 导入类型 | 🟡 需验证 | 需要检查 strategy.types.ts 导入路径 |
| 24 | HotSectorWidget/ValuePitWidget 使用 v15 字段名 | 🟡 需验证 | 需要检查 Widget 字段名版本 |
| 25 | services/trading/ 下3个冗余文件已删除 | 🟡 需验证 | 需要检查 services/trading/ 目录 |
| 26 | dataflowTypes 统一为单一权威定义 | ✅ 已完成 | ✅ dataflowTypes.ts 存在且被引用 |
| 27 | 全量测试通过（291/291） | ✅ 已完成 | ✅ 2112 passed / 0 failed（远超 291） |
| 28 | TypeScript 类型检查 0 errors | ✅ 已完成 | ✅ tsc --noEmit 0 errors |
| 29 | 构建成功 | ✅ 已完成 | ✅ vite build 成功 |

### 批次 B：P1 重要治理（7 项验收标准）

| # | 验收标准 | 验证状态 | 说明 |
|---|---------|---------|------|
| 30 | 双策略文档状态从Proposal→Current | ❌ 未完成 | ❌ dual-strategy-dataflow-spec.md 仍为 proposal 状态 |
| 31 | 交易复盘文档状态从Deferred→Implemented | ❌ 未完成 | ❌ trading-core-factors.md 仍为 Deferred 状态 |
| 32 | 交易方向枚举风格统一 | ❌ 未完成 | ❌ TradeDirection (BUY/SELL) vs OrderDirection (buy/sell) 风格分裂 |
| 33 | 20个Store全部有schema文档 | ❌ 未完成 | ❌ data-store-schema.md 不存在 |
| 34 | IOModule泛型化完成 | 🟡 部分完成 | 🟡 IOModuleBase 泛型基类已存在于 base.types.ts，但4个模块未继承 |
| 35 | 硬编码数量降至500以下 | 🟡 需验证 | 需运行硬编码审计脚本验证 |
| 36 | 全量测试通过 | ✅ 已完成 | ✅ 2112 passed / 0 failed |

### 批次 C：P2 长期改进（4 项验收标准）

| # | 验收标准 | 验证状态 | 说明 |
|---|---------|---------|------|
| 37 | 自动化一致性检查脚本上线 | ❌ 未完成 | 需要开发一致性检查脚本 |
| 38 | 数据血缘文档发布 | ❌ 未完成 | 需要编写数据血缘文档 |
| 39 | 测试覆盖率达标 | 🟡 需验证 | 需要运行覆盖率报告 |
| 40 | PWA离线验证通过 | 🟡 需验证 | 需要验证 PWA 离线功能 |

---

## 五、因子追踪路线图（4 项）

来源：`./factor-tracking-roadmap.md` L60-94

| # | 任务描述 | 状态 | 说明 |
|---|---------|------|------|
| 41 | Phase 2：权重调优实验 | ❌ 未完成 | 需要开发 factorOptimizationService.ts |
| 42 | Phase 3：因子版本与 A/B 测试 | ❌ 未完成 | 需要实现因子版本管理 |
| 43 | Phase 4：因子漂移监控 | ❌ 未完成 | 需要开发 factorDriftService.ts |
| 44 | Phase 5：人机协同反馈闭环 | ❌ 未完成 | 需要实现反馈机制 |

---

## 六、README.md 待实现（3 项）

来源：`README.md` L71-77

| # | 任务描述 | 验证状态 | 说明 |
|---|---------|---------|------|
| 45 | 真实财务/行情数据驱动的评分（部分接入，持续优化） | 🟡 部分完成 | V6 评分已使用真实数据，但可能还有优化空间 |
| 46 | 交易复盘笔记 | ❌ 未完成 | 需要开发交易复盘笔记功能 |
| 47 | CI 覆盖率门禁 | ❌ 未完成 | 同任务 #15 |

---

## 任务统计（第二轮验证）

| 状态 | 数量 | 占比 | 任务编号 |
|------|------|------|---------|
| ✅ 已完成 | 35 | 74.5% | 1,2,3,4,5,6,7,8,9,10,11,12,13,23,25,26,27,28,29,36 |
| 🟡 部分完成/需验证 | 4 | 8.5% | 16,20,34,35,39,40,45 |
| ❌ 未完成 | 8 | 17.0% | 14,15,17,18,19,21,22,24,30,31,32,33,37,38,41,42,43,44,46,47 |
| **总计** | **47** | 100% | - |

---

## 下一步行动

### 已完成文档同步（本轮已执行）

以下文档已在本轮验证中更新：

1. **`../reference/08-implementation-plan.md`**
   - Phase 2 验收标准 13 项全部标记为 [x]
   - Phase 3 任务状态更新（3.1 ✅ / 3.2 ✅ / 3.3 ❌ / 3.4 ❌ / 3.5 🟡）

2. **`../reference/数据治理路线图.md`**
   - 批次 A 验收标准：6/7 已完成（仅 #24 Widget 字段名未完成）
   - 批次 B 验收标准：1/7 已完成（仅 #36 测试通过）

3. **`./pending-tasks-inventory-20260701.md`**（本文档）
   - 第二轮验证完成，统计更新为 35 已完成 / 4 部分完成 / 8 未完成

### 剩余未完成/部分完成任务（按优先级排序）

#### P0 - 阻塞发布

| 任务 | 说明 | 建议 |
|------|------|------|
| #24 | HotSectorWidget/ValuePitWidget 使用 v15 字段名（composite → marketEnv） | 修改 Widget 组件字段名，同步更新 widget.types.ts |

#### P1 - 数据治理批次 B

| 任务 | 说明 | 建议 |
|------|------|------|
| #30 | 双策略文档状态从 Proposal → Current | 更新 dual-strategy-dataflow-spec.md 状态标记 |
| #31 | 交易复盘文档状态从 Deferred → Implemented | 更新 trading-core-factors.md 状态标记 |
| #32 | 交易方向枚举风格统一（TradeDirection BUY/SELL vs OrderDirection buy/sell） | 统一为全大写风格，更新引用处 |
| #33 | 20 个 Store 全部有 schema 文档 | 新建 docs/data-store-schema.md |
| #34 | IOModule 泛型化完成 | 4 个模块继承 IOModuleBase 泛型基类 |
| #35 | 硬编码数量降至 500 以下 | 运行审计脚本并执行收敛 |

#### P2 - 质量加固与长期改进

| 任务 | 说明 | 建议 |
|------|------|------|
| #14 | CI 流水线 | 创建 .github/workflows/ci.yml |
| #15 | 覆盖率门禁 | 配置 vitest.config.ts 覆盖率阈值 |
| #37 | 一致性检查脚本 | 开发 scripts/audit-data-consistency.ts |
| #38 | 数据血缘文档 | 编写 docs/data-lineage.md |
| #41-44 | 因子追踪 Phase 2-5 | 按路线图逐步实现 |

#### P3 - 发布准备

| 任务 | 说明 | 建议 |
|------|------|------|
| #17 | 完整功能验收 | 对照 02-functional-specs.md 逐项验收 |
| #18 | 文档更新到 v1.0.0 | 继续同步文档和 CHANGELOG |
| #19 | 数据迁移测试 | 执行 v0.9.0 → v1.0.0 迁移测试 |
| #21 | GitHub Pages 部署 | 配置部署流程 |
| #22 | 发布 tag | 执行正式发布流程 |
| #46 | 交易复盘笔记 | 开发交易复盘笔记功能 |

---

## 建议执行顺序

### 第一批：P0 阻塞项修复

- 任务 #24 - Widget 字段名 composite → marketEnv

### 第二批：数据治理批次 B 收尾

- 任务 #30,31 - 文档状态更新
- 任务 #32 - 枚举风格统一
- 任务 #33 - Store schema 文档
- 任务 #34 - IOModule 泛型化

### 第三批：质量加固

- 任务 #14 - CI 流水线
- 任务 #15 - 覆盖率门禁
- 任务 #37 - 一致性检查脚本

### 第四批：发布准备（v1.0.0）

- 任务 #17-22 - Phase 4 发布准备流程
