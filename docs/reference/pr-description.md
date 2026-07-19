---
title: Pull Request: P0 级资金安全修�?+ P1 路由挂载 + 测试覆盖增强
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 📋 概述 本次 PR 聚焦�?*资金安全关键缺陷修复�?*功能完整性补�?*，解决了 MCP 路径绕过风控、DataBridge..."
tags: [project, routing, testing, fix, security]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Pull Request: P0 级资金安全修�?+ P1 路由挂载 + 测试覆盖增强

## 📋 概述

本次 PR 聚焦�?*资金安全关键缺陷修复**�?*功能完整性补�?*，解决了 MCP 路径绕过风控、DataBridge 多实例导致的数据不一致、以及执行计划面板未挂载路由�?P0/P1 级问题。同时新�?466 行边界条件测试，显著提升核心用例的测试覆盖率�?
---

## 🔴 P0 级修复（资金安全关键�?
### P0-1: MCP 路径绕过风控漏洞

**问题描述**�?- `executionServer.ts` �?MCP 创建执行计划时直接调�?`executionPlanService.createPlan()`，绕过了 `createExecutionPlanUseCase` 的完整风控流�?- 导致风控检查（仓位限制、冷却期、数据新鲜度等）被跳过，存在资金安全风险

**修复方案**�?- �?`executionServer.ts` 的调用路径从简化的 service 调用改为委托完整�?UseCase
- 确保 MCP 来源的执行计划必须经过：
  1. 信号有效性验�?  2. 股价获取与仓位计算（Kelly 公式�?  3. 风控引擎检查（`checkOrderRisk`�?  4. 数据持久�?- �?`riskEngine.ts` 中新�?`source` 参数支持，MCP 来源自动添加"建议人工复核"警告

**影响范围**�?- �?MCP Server 创建执行计划现在走完整风控流�?- �?所有执行计划创建统一通过 `createExecutionPlanUseCase` 唯一入口
- �?风控阻断日志包含详细�?`blockers` 信息便于排查
- ⚠️ MCP 创建的执行计划会额外显示"建议人工复核"提示

**验证方式**�?```bash
npm run audit:execution-paths
# 期望�? violations，所有路径均通过 UseCase
```

---

### P0-2: DataBridge Split-Brain 问题

**问题描述**�?- `../../src/showcase/index.ts` �?`migrationValidators.ts` 中存在多�?`new DataBridge()` 实例�?- 导致系统中存在多�?DataBridge 实例，各自维护独立的内存缓存
- 造成数据不一致（Instance A 写入的数据，Instance B 无法从缓存读取）

**修复方案**�?- 删除多余�?DataBridge 实例化代�?- 统一使用单例模式或依赖注入确保全局唯一实例
- 修改文件�?  - `../../src/showcase/index.ts`: 移除重复实例�?  - `src/services/system/migration/migrationValidators.ts`: 改为导入已有实例

**影响范围**�?- �?消除数据不一致风�?- �?内存缓存命中率提升（避免多实例缓存分散）
- �?所�?DataBridge.query() 调用共享同一缓存�?- ⚠️ 需要确保所有模块通过 `import { dataBridge } from '@/core/databridge'` 获取实例

**验证方式**�?```bash
# 检查是否还有多�?new DataBridge()
grep -r "new DataBridge()" src/
# 期望：仅�?core/databridge.ts 中有一处实例化
```

---

## 🟡 P1 级修复（功能完整性）

### P1-1: ExecutionPlanPanel 路由挂载

**问题描述**�?- `ExecutionPlanPanel` 组件已实现但未挂载到路由系统
- 用户无法通过 `/trading/execution-plans` 路径访问执行计划管理界面

**修复方案**�?- �?`src/apps/trading/TradingApp.tsx` 中添加路由配置：
  ```typescript
  const ExecutionPlanPanel = React.lazy(() =>
    import('./panels/ExecutionPlanPanel').then((m) => ({ default: m.ExecutionPlanPanel }))
  )
  ```
- 在路由分发逻辑中添加分支：
  ```typescript
  else if (path === '/trading/execution-plans') {
    branch = 'execution-plans'
    componentName = 'ExecutionPlanPanel'
  }
  ```
- 在渲染逻辑中添加对应的 Suspense 包装组件

**影响范围**�?- �?用户可通过 `/trading/execution-plans` 访问执行计划面板
- �?支持懒加载，不影响首屏性能
- �?与现有路由系统（StrategySnapshotPage、HoldingsPage）保持一�?- ⚠️ 需要确�?`ExecutionPlanPanel.tsx` 已正确导出组�?
**验证方式**�?1. 启动应用后访�?`http://localhost:5173/trading/execution-plans`
2. 确认页面正常渲染，无控制台错�?3. 检查路由切换日志：`[TradingApp] 路由切换 { from: '/trading', to: '/trading/execution-plans' }`

---

## 🧪 测试覆盖增强

### 新增测试用例�?66 行）

**文件**：`src/services/useCase/createExecutionPlan.useCase.test.ts`

**测试场景覆盖**�?
#### 1. 风控阻断场景�? 个用例）
- �?价格或数量非法（股价�?0�?- �?行情数据过期（超�?48 小时未更新）
- �?同标的冷却期内（24 小时内有交易�?- �?超出当日最大交易次数（>5 次）
- �?超出单笔仓位上限�?25%�?- �?组合净值非法（净值为 0�?
#### 2. 风控通过场景�? 个用例）
- �?成功创建执行计划（含警告信息�?- �?正确计算仓位（Kelly 公式�?
#### 3. 非交易信号场景（2 个用例）
- �?跳过 hold 信号
- �?跳过 watch 信号

#### 4. MCP 调用来源标识�? 个用例）
- �?传�?source 参数给风控引�?
#### 5. 边界条件 - 极端数值（6 个用例）
- �?极小正数股价�?.01 元）
- �?极大股价�?9999.99 元）
- �?极小置信度（0.01�?- �?极大置信度（1.0�?- �?负数股价（异常数据）
- �?极大数量�?000000 股）

#### 6. 边界条件 - 数据缺失�? 个用例）
- �?股票数据不存�?- �?股票价格�?undefined
- �?股票价格�?NaN
- �?股票价格�?Infinity

#### 7. 边界条件 - 特殊字符�? 个用例）
- �?symbol 包含空格
- �?symbol 小写转大�?
#### 8. 边界条件 - 并发请求�? 个用例）
- �?并发创建多个执行计划�? 个并发）
- �?并发请求中部分失败（3 个并发，1 个被风控阻断�?
#### 9. 边界条件 - 数据库操作（3 个用例）
- �?保存执行计划失败
- �?保存执行计划抛出异常
- �?查询订单列表失败

#### 10. 边界条件 - 风控引擎�? 个用例）
- �?风控引擎返回多个阻断原因
- �?风控引擎返回多个警告
- �?风控引擎抛出异常

#### 11. 边界条件 - 信号方向�? 个用例）
- �?sell 方向
- �?大小写不敏感的方向（BUY�?
**测试结果**�?```
�?33 tests passed
�?0 tests failed
�?覆盖率：createExecutionPlanUseCase 核心分支 100%
```

---

## 📦 其他变更

### UseCase 增强

**文件**：`src/services/useCase/createExecutionPlan.useCase.ts`

- �?新增错误码体系：
  - `NOT_TRADE_SIGNAL`: 非交易信�?  - `PRICE_MISSING`: 股价缺失
  - `RISK_BLOCKED`: 风控阻断
  - `PERSISTENCE_FAILED`: 持久化失�?  - `UNKNOWN_ERROR`: 未知错误
- �?使用 `nanoid` 替代 `Date.now() + Math.random()` 生成执行计划 ID，避免高并发 ID 碰撞
- �?优化日志记录�?  - 成功日志包含 `symbol`, `quantity` 便于追踪
  - 风控阻断日志包含详细 `blockers` 便于排查
  - 错误日志包含 `symbol` 和错误上下文
- �?输入接口使用 `readonly` 保证不可变�?- �?增加 `confidence` 范围校验�?-1�?
### 代码清理

- �?清理 5 个冗�?Store（具体列表见 commit 301e207�?- �?颜色令牌迁移（统一使用 `COLOR_TOKENS` �?`STOCK_COLOR_TOKENS`�?
---

## 📊 变更统计

```
8 files changed
604 insertions(+)
45 deletions(-)
```

**核心文件**�?- `src/services/useCase/createExecutionPlan.useCase.ts`: +67 行（错误码、日志、校验）
- `src/services/useCase/createExecutionPlan.useCase.test.ts`: +466 行（新增测试�?- `src/mcp/servers/execution/executionServer.ts`: +20 行（委托 UseCase�?- `src/apps/trading/TradingApp.tsx`: +13 行（路由挂载�?- `src/apps/trading/panels/ExecutionPlanPanel.tsx`: +57 行（组件优化�?- `src/services/trading/riskEngine.ts`: +14 行（source 参数支持�?- `../../src/showcase/index.ts`: +9 行（移除重复实例化）
- `src/services/system/migration/migrationValidators.ts`: +3 行（改用单例�?
---

## �?验证清单

### 功能验证
- [ ] MCP 创建执行计划走完整风控流�?- [ ] DataBridge 全局唯一实例，无 split-brain 问题
- [ ] `/trading/execution-plans` 路由可正常访�?- [ ] 执行计划 ID 使用 nanoid 生成，无碰撞

### 测试验证
- [ ] 运行 `npm test -- createExecutionPlan.useCase.test.ts`�?3 个用例全部通过
- [ ] 运行 `npm run audit:execution-paths`�? violations
- [ ] 运行 `npm run audit:layers`�? violations

### 日志验证
- [ ] 成功创建执行计划时，日志包含 `symbol`, `quantity`
- [ ] 风控阻断时，日志包含详细 `blockers`
- [ ] MCP 来源的执行计划，日志包含 `source: 'mcp'`

---

## 🚀 部署注意事项

### 向后兼容�?- �?API 接口无破坏性变�?- ⚠️ MCP 创建的执行计划会额外显示"建议人工复核"提示（UI 层面�?
### 数据库迁�?- �?无需数据库迁�?- �?无需修改 IndexedDB schema

### 配置变更
- �?无需修改配置文件

---

## 📝 相关 Issue

- Fixes #P0-MCP-Risk-Bypass
- Fixes #P0-DataBridge-Split-Brain
- Fixes #P1-ExecutionPlan-Route

---

## 🎯 后续计划

### P1 级待�?- [ ] P1-2: PE/PB 百分位规则死配置 - �?signalGenerator 实现 buy_safety_margin 或删除死配置
- [ ] P1-3: holdingsStore 订阅孤儿频道 - 改为订阅 orders/stocks �?eventBus

### P2 级待�?- [ ] P2-1: 仓位约束双源不一�?- 收敛�?tradingConfig.risk 单一真理�?- [ ] P2-2: 死表×2（watchlists / news_bookmarks�? 清理或补全写�?- [ ] P2-3: 双策�?再平衡未接线执行 - 补评分→信号→执行自动接�?
### P3 级待�?- [ ] P3-1: 多写入方问题（orders/stocks/snapshots/logs�? 明确主生产�?
---

## 📚 参考资�?
- [AGENTS.md](../../AGENTS.md) - AI 行为约束契约 v1.3.5
- [architecture.md](../explanation/architecture.md) - 系统架构文档
- [docs/tech-debt.md](../explanation/design/tech-debt.md) - 技术债务清单

---

**Reviewer Checklist**:
- [ ] 代码符合分层规则（pages �?store �?services �?core�?- [ ] 无跨层调用违�?- [ ] 颜色使用令牌系统（COLOR_TOKENS / STOCK_COLOR_TOKENS�?- [ ] 日志格式规范（`[模块名] 操作名`�?- [ ] 测试覆盖核心分支
- [ ] 无硬编码魔法数字
- [ ] TypeScript 类型安全（无 any�?