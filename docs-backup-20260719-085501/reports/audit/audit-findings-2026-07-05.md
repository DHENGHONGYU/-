---
title: V9 项目审计报告 �?2026-07-05
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计时间�?026-07-05 审计范围：全量代码扫描（617 文件�? 审计工具：npm run audit 系列命令"
tags: [qa, audit, report]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 项目审计报告 �?2026-07-05

> 审计时间�?026-07-05  
> 审计范围：全量代码扫描（617 文件�? 
> 审计工具：npm run audit 系列命令

## 一、审计结果总览

| 审计�?| 状�?| 问题�?| 严重级别 |
|--------|------|--------|----------|
| audit:layers | �?失败 | 7 | 🔴 严重 |
| audit:hardcode | �?失败 | 1024 | 🔴 严重 |
| audit:deadcode | ⚠️ 警告 | 19 | 🟡 中等 |
| audit:docs | �?通过 | 0 | - |
| audit:routes | �?通过 | 0 | - |
| audit:mcp | �?失败 | 18 | 🔴 严重 |
| audit:token | �?失败 | 3 | 🟡 中等 |

**总计�? 项失败，2 项通过�? 项警�?*

---

## 二、详细问题清�?
### 2.1 跨层调用违规（audit:layers）�?7 �?
#### constants 层依赖业务层�? 处）

| 文件 | 行号 | 违规类型 | 依赖目标 |
|------|------|----------|----------|
| src/constants/backtest.constants.ts | 8 | constants �?store | import type { BacktestStrategy } from '@/store/backtestStore' |
| src/constants/execution.constants.ts | 6 | constants �?data | import type { ExecutionPhase } from '@/data/types' |
| src/constants/score.constants.ts | 7 | constants �?services | import type { ScoreTrendPeriod } from '@/services/analysis/scoreTrendService' |

**违反规范**：constants 层必须零依赖，禁止导入任何业务模�?
**整改方案**�?1. 将被依赖的类型定义移�?`src/types/modules/` �?`src/data/types.ts`
2. constants 文件仅保留纯常量定义，类型通过泛型或独立类型文件引�?
#### services 直接依赖 store�? 处）

| 文件 | 行号 | 违规类型 | 依赖目标 |
|------|------|----------|----------|
| src/services/backtest/BacktestEngine.ts | 28 | services �?store | import type { BacktestStrategy, BacktestResult, BacktestTrade } from '@/store/backtestStore' |
| src/services/export/backtestExportService.ts | 8 | services �?store | import type { BacktestConfig, BacktestResult, BacktestTrade } from '@/store/backtestStore' |
| src/services/system/architectureService.ts | 18 | services �?store | import { useEngineStore } from '@/store/engineStore' |
| src/services/useCase/submitOrder.useCase.ts | 18 | services �?store | import { withBroadcast } from '@/store/helpers/withBroadcast' |

**违反规范**：services 层只能依�?core/ �?data/，禁止直接依�?store/

**整改方案**�?1. 将类型定义从 store 移至 `src/types/modules/`
2. services 通过 DataBridge.forward() 提交数据，通过 Store 订阅获取数据
3. 事务工具 withBroadcast 应封装为 core/transaction.ts，services 通过 core 层调�?
---

### 2.2 硬编码问题（audit:hardcode）�?1024 �?
#### 按类别汇�?
| 类别 | 数量 | 严重级别 | 示例 |
|------|------|----------|------|
| 静默回退�?? 操作符） | 705 | 🔴 Critical | `result.error ?? '未知错误'` |
| 魔法数字 | 151 | 🟡 Major | `setTimeout(..., 3000)` |
| 硬编�?Tailwind 颜色�?| 143 | 🟡 Major | `bg-blue-500`、`text-red-600` |
| 硬编�?URL | 14 | 🟡 Major | `https://api.example.com` |
| 硬编�?API 路径 | 6 | 🟡 Major | `/api/v1/stocks` |
| 硬编码超�?| 5 | 🟡 Major | `timeout: 5000` |

#### 静默回退问题�?05 处）

**典型模式**�?```typescript
const message = result.error ?? '操作失败'  // �?静默回退
throw new Error(result.error ?? '未知错误')  // �?静默回退
```

**违反规范**：所有错误必须显式处理，禁止使用 `??` 静默回退

**整改方案**�?1. 提取错误处理工具函数 `handleError(result: DataLayerResult, context: string)`
2. 所有错误必须记录日志：`logger.error('[模块名] 操作失败', { error: result.error })`
3. 用户可见错误必须通过 Toast/Modal 提示

#### 硬编码颜色类�?43 处）

**典型模式**�?```typescript
<div className="bg-blue-500 text-white">  // �?硬编码颜�?```

**违反规范**：所有颜色必须引�?`src/constants/` 中的常量

**整改方案**�?1. 创建 `src/constants/theme.tokens.ts`，定义语义化颜色常量
2. 使用 Tailwind CSS 变量：`className={cn('bg-primary', 'text-foreground')}`
3. 图表颜色使用 `CHART_PALETTE` 常量

#### 魔法数字�?51 处）

**典型模式**�?```typescript
setTimeout(() => {...}, 3000)  // �?魔法数字
const maxRetries = 5  // �?魔法数字
```

**违反规范**�? 位以上数字必须提取为 const �?config

**整改方案**�?1. 提取�?`src/config/timeouts.ts`、`src/config/thresholds.ts`
2. 引擎参数�?`src/services/scoring/v6-engine/config.ts` 注入

---

### 2.3 死代码与路由一致性（audit:deadcode）�?19 �?
#### 条件返回 null�?9 处）

| 文件 | 行号 | 代码片段 | 需确认 |
|------|------|----------|--------|
| src/cockpit/CockpitShell.tsx | 27 | `return null` | 是否为预期空状态？ |
| src/components/analysis/score/ScoreFactorWaterfall.tsx | 106, 109, 120 | 多处条件返回 null | 是否为预期空状态？ |
| src/components/analysis/sector/SectorRotationHeatmap.tsx | 42 | `if (value === undefined) return null` | 是否为预期空状态？ |
| ... | ... | ... | ... |

**整改方案**�?1. 人工确认每处 `return null` 是否为预期的空状态处�?2. 若非预期，应替换�?Loading/Error 组件
3. 添加注释说明空状态原因：`// 数据加载中，显示空状态`

---

### 2.4 MCP 架构违规（audit:mcp）�?18 �?
#### 页面/组件直接 import services�?8 处）

| 文件 | 行号 | 违规类型 | 依赖目标 |
|------|------|----------|----------|
| src/components/analysis/news/NewsSentimentTrend.tsx | 18 | direct-service-import | @/services/news/sentimentTrendEngine |
| src/components/analysis/score/MultiPeriodTrendChart.tsx | 20 | direct-service-import | @/services/analysis/scoreTrendService |
| src/components/analysis/score/ScoreFactorWaterfall.tsx | 24 | direct-service-import | @/services/scoring/v6-engine |
| src/components/analysis/score/ScoreHistoryPanel.tsx | 11, 13 | direct-service-import | @/services/analysis/scoreDocService |
| src/components/input/StockSearch.tsx | 7 | direct-service-import | @/services/input/inputService |
| src/components/pool/PoolBoard.tsx | 4 | direct-service-import | @/services/stockpool/stockpoolService |
| src/components/pool/PoolList.tsx | 7 | direct-service-import | @/services/stockpool/stockpoolService |
| src/components/pool/usePoolData.ts | 10 | direct-service-import | @/services/stockpool/stockpoolService |
| src/components/pool/usePoolDataFromStore.ts | 18 | direct-service-import | @/services/stockpool/stockpoolService |
| src/components/strategy/StrategyGroupCard.tsx | 4 | direct-service-import | @/services/trading/strategySnapshotService |
| src/components/system/LogStreamPanel.tsx | 28 | direct-service-import | @/services/system/monitorLogService |
| src/components/system/MigrationPanel.tsx | 15 | direct-service-import | @/services/system/v6MigrationService |
| src/components/system/SystemArchitectureDiagram.tsx | 17 | direct-service-import | @/services/system/architectureService |
| src/pages/analysis/HotSectorPage.tsx | 13 | direct-service-import | @/services/scoring/hotSectorAnalyzer |
| src/pages/analysis/ValuePitPage.tsx | 15, 16 | direct-service-import | @/services/scoring/valuePitAnalyzer, rotationSignalDetector |
| src/pages/output/TradeReviewPage.tsx | 16 | direct-service-import | @/services/trading/tradeReviewAI |

**违反规范**：页�?组件只能依赖 store/ �?services/，但应通过 MCPClient 调用

**整改方案**�?1. 为每个服务子域创�?MCP Server（见 2.5 警告�?2. 页面/组件通过 `useMCPClient()` Hook 调用服务
3. 类型导入允许，但函数调用必须通过 MCP 路由

#### MCP Server 缺失�? 处警告）

| 服务子域 | 预期路径 |
|----------|----------|
| data-collector | src/mcp/servers/data-collector/data-collectorServer.ts |
| execution | src/mcp/servers/execution/executionServer.ts |
| export | src/mcp/servers/export/exportServer.ts |
| input | src/mcp/servers/input/inputServer.ts |
| trade | src/mcp/servers/trade/tradeServer.ts |

**整改方案**�?1. 按照 `src/mcp/servers/` 下现有模板创�?MCP Server
2. �?`src/mcp/core/server.ts` 中注册新 Server
3. 更新 `mcp-whitelist-policy.json` 白名�?
---

### 2.5 Token 消耗问题（audit:token）�?3 �?
| 文件 | 问题类型 | 预计浪费 |
|------|----------|----------|
| scripts/extract-code-graph.ts | 缺少增量更新（基于文�?mtime�?| 7.5M tokens/�?|
| scripts/extract-code-graph.ts | 缺少缓存机制（AST 缓存�?| 包含在上�?|
| scripts/quick-query.sh | 缺失快速查询模�?| - |

**整改方案**�?1. �?`extract-code-graph.ts` 添加文件 mtime 检查，仅重新解析变更文�?2. 添加 AST 缓存机制，避免重复解析未变更文件
3. 创建 `scripts/other/quick-query.sh`，提供常用查询模�?
---

## 三、整改优先级

### P0（阻断性）�?必须立即修复

1. **跨层调用违规**�? 处）
   - constants 层依赖业务层�? 处）
   - services 直接依赖 store�? 处）

2. **MCP 架构违规**�?8 处）
   - 页面/组件直接 import services�?8 处）
   - MCP Server 缺失�? 处）

### P1（严重）�?近期修复

3. **硬编码问�?*�?024 处）
   - 静默回退�?05 处）
   - 硬编码颜色类�?43 处）
   - 魔法数字�?51 处）

### P2（优化）�?计划修复

4. **死代码确�?*�?9 处）
   - 人工确认条件返回 null 是否为预期空状�?
5. **Token 优化**�? 处）
   - 知识图谱增量更新
   - 快速查询脚�?
---

## 四、整改时间表

| 阶段 | 时间 | 目标 | 负责�?|
|------|------|------|--------|
| �?1 �?| 2026-07-06 ~ 2026-07-12 | 完成 P0 整改（跨层违�?+ MCP 违规�?| AI + 人工确认 |
| �?2 �?| 2026-07-13 ~ 2026-07-19 | 完成 P1 整改（硬编码问题�?| AI 自动修复 |
| �?3 �?| 2026-07-20 ~ 2026-07-26 | 完成 P2 整改（死代码 + Token�?| 人工确认 + AI |
| �?4 �?| 2026-07-27 ~ 2026-08-02 | 验证 + 回归测试 | AI + 人工 |

---

## 五、验证标�?
- [ ] `npm run audit:layers` 输出�? violations, 0 warnings
- [ ] `npm run audit:hardcode` 输出：问题总数 < 100（收�?90%�?- [ ] `npm run audit:deadcode` 输出�? 处未确认空状�?- [ ] `npm run audit:mcp` 输出�? violations, 0 warnings
- [ ] `npm run audit:token` 输出�? violations
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run lint` 通过
- [ ] `npm test` 通过

---

## 六、附�?
### 6.1 审计命令速查

```bash
# 全量审计
npm run audit

# 单项审计
npm run audit:layers   # 跨层调用
npm run audit:hardcode # 硬编码检�?npm run audit:deadcode # 死代码检�?npm run audit:docs     # 文档同步
npm run audit:routes   # 路由一致�?npm run audit:mcp      # MCP 架构
npm run audit:token    # Token 消�?```

### 6.2 相关文档

- [P1 批次行动清单](../../reference/changelogs/2026-07/action-list-p1.md)
- [P1 批次完整性画像](../../reference/changelogs/2026-07/completeness-profile-p1.md)
- [MCP 耦合分析报告](../../explanation/design/mcp-coupling-analysis-report.md)
- [Token 优化最佳实践](../lessons-learned/token-optimization-best-practices.md)
