---
title: V9 全量审计问题详细清单
type: reports
domain: qa
phase: testing
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "审计范围: 全量代码扫描�?17 文件�?> 问题总计: 1,049 处（MCP 违规 23 + 跨层调用 7 + 硬编�?1,019�?"
tags: [qa, audit, checklist, report, testing]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 全量审计问题详细清单

> **Date**: 2026-07-05
> **数据来源**: `audit-findings-2026-07-05.md` + 审计脚本源码分析 + 代码扫描
> **审计范围**: 全量代码扫描�?17 文件�?> **问题总计**: 1,049 处（MCP 违规 23 + 跨层调用 7 + 硬编�?1,019�?
---

## 一、MCP 架构违规�?3 处）

### 1.1 页面/组件直接 import services�?8 处）

**违反规范**: 页面/组件应通过 Store 获取数据，禁止直�?import services 函数

| # | 文件 | 行号 | 依赖目标 | 违规类型 |
|---|------|------|----------|----------|
| 1 | `src/components/organisms/analysis/news/NewsSentimentTrend.tsx` | 18 | `@/services/news/sentimentTrendEngine` | direct-service-import |
| 2 | `src/components/organisms/analysis/score/MultiPeriodTrendChart.tsx` | 20 | `@/services/analysis/scoreTrendService` | direct-service-import |
| 3 | `src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx` | 24 | `@/services/scoring/v6-engine` | direct-service-import |
| 4 | `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` | 11 | `@/services/analysis/scoreDocService` | direct-service-import |
| 5 | `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` | 13 | `@/services/analysis/scoreDocService` | direct-service-import |
| 6 | `src/components/organisms/input/StockSearch.tsx` | 7 | `@/services/input/inputService` | direct-service-import |
| 7 | `src/components/organisms/pool/PoolBoard.tsx` | 4 | `@/services/stockpool/stockpoolService` | direct-service-import |
| 8 | `src/components/organisms/pool/PoolList.tsx` | 7 | `@/services/stockpool/stockpoolService` | direct-service-import |
| 9 | `src/components/organisms/pool/usePoolDataFromStore.ts` | 10 | `@/services/stockpool/stockpoolService` | direct-service-import |
| 10 | `src/components/organisms/pool/usePoolDataFromStore.ts` | 18 | `@/services/stockpool/stockpoolService` | direct-service-import |
| 11 | `src/components/organisms/strategy/StrategyGroupCard.tsx` | 4 | `@/services/trading/strategySnapshotService` | direct-service-import |
| 12 | `src/components/organisms/system/LogStreamPanel.tsx` | 28 | `@/services/system/monitorLogService` | direct-service-import |
| 13 | `src/components/organisms/system/MigrationPanel.tsx` | 15 | `@/services/system/v6MigrationService` | direct-service-import |
| 14 | `src/components/organisms/system/SystemArchitectureDiagram.tsx` | 17 | `@/services/system/architectureService` | direct-service-import |
| 15 | `src/pages/analysis/HotSectorPage.tsx` | 13 | `@/services/scoring/hotSectorAnalyzer` | direct-service-import |
| 16 | `src/pages/analysis/ValuePitPage.tsx` | 15 | `@/services/scoring/valuePitAnalyzer` | direct-service-import |
| 17 | `src/pages/analysis/ValuePitPage.tsx` | 16 | `@/services/scoring/rotationSignalDetector` | direct-service-import |
| 18 | `src/pages/output/TradeReviewPage.tsx` | 16 | `@/services/trading/tradeReviewAI` | direct-service-import |

**按服务子域分�?*:
| 服务子域 | 违规�?| 涉及文件 |
|----------|--------|----------|
| stockpool | 4 | PoolBoard, PoolList, usePoolData, usePoolDataFromStore |
| system | 3 | LogStreamPanel, MigrationPanel, SystemArchitectureDiagram |
| analysis/score | 3 | MultiPeriodTrendChart, ScoreFactorWaterfall, ScoreHistoryPanel |
| scoring | 3 | HotSectorPage, ValuePitPage(×2) |
| news | 1 | NewsSentimentTrend |
| input | 1 | StockSearch |
| trading | 1 | StrategyGroupCard |
| trade | 1 | TradeReviewPage |

**整改方案**:
1. 为缺失的 MCP Server 创建注册（见 1.2�?2. 页面/组件改为通过 `useMCPClient()` Hook �?Store 调用服务
3. 类型导入允许，但函数调用必须通过 MCP 路由

### 1.2 MCP Server 缺失�? 处警告）

| # | 服务子域 | 预期路径 | 状�?|
|---|----------|----------|------|
| 1 | data-collector | `src/mcp/servers/data-collector/dataCollectorServer.ts` | �?缺失 |
| 2 | execution | `src/mcp/servers/execution/executionServer.ts` | �?缺失 |
| 3 | export | `src/mcp/servers/portfolio/portfolioServer.ts` | �?缺失 |
| 4 | input | `src/mcp/servers/data-collector/dataCollectorServer.ts` | �?缺失 |
| 5 | trade | `src/mcp/servers/trading/tradingServer.ts` | �?缺失 |

**已有 MCP Server�?1 个）**:
analysis, backtest, fetcher, llm, news, portfolio, scoring, screening, stockpool, system, trading

**整改方案**:
1. 按照 `src/mcp/servers/` 下现有模板创�?MCP Server
2. �?`src/mcp/core/server.ts` 中注册新 Server
3. 更新 `mcp-whitelist-policy.json` 白名�?
---

## 二、跨层调用违规（7 处）

### 2.1 constants 层依赖业务层�? 处）

**违反规范**: constants 层必须零依赖，禁止导入任何业务模�?
| # | 文件 | 行号 | 依赖目标 | 违规详情 |
|---|------|------|----------|----------|
| 1 | `src/constants/backtest.constants.ts` | 8 | `@/store/backtestStore` | `import type { BacktestStrategy }` |
| 2 | `src/constants/execution.constants.ts` | 6 | `@/data/types` | `import type { ExecutionPhase }` |
| 3 | `src/constants/score.constants.ts` | 7 | `@/services/analysis/scoreTrendService` | `import type { ScoreTrendPeriod }` |

**整改方案**:
1. 将被依赖的类型定义移�?`src/types/modules/` �?`src/data/types.ts`
2. constants 文件仅保留纯常量定义
3. 类型通过独立类型文件引入

### 2.2 services 层直接依�?store�? 处）

**违反规范**: services 层只能依�?core/ �?data/，禁止直接依�?store/

| # | 文件 | 行号 | 依赖目标 | 违规详情 |
|---|------|------|----------|----------|
| 1 | `src/services/backtest/BacktestEngine.ts` | 28 | `@/store/backtestStore` | `import type { BacktestStrategy, BacktestResult, BacktestTrade }` |
| 2 | `src/services/export/backtestExportService.ts` | 8 | `@/store/backtestStore` | `import type { BacktestConfig, BacktestResult, BacktestTrade }` |
| 3 | `src/services/system/architectureService.ts` | 18 | `@/store/engineStore` | `import { useEngineStore }` |
| 4 | `src/services/trading/tradingService.ts` | 18 | `@/store/helpers/withBroadcast` | `import { withBroadcast }` |

**整改方案**:
1. 将类型定义从 store 移至 `src/types/modules/`
2. services 通过 `DataBridge.forward()` 提交数据
3. `withBroadcast` 应封装为 `core/transaction.ts`，services 通过 core 层调�?
---

## 三、硬编码问题�?,019 处）

### 3.1 按类别汇�?
| 类别 | 数量 | 严重级别 | 检测脚�?| 整改优先�?|
|------|------|----------|----------|------------|
| 静默回退（`??` / `||`�?| 705 | 🔴 Critical | `audit-hardcode.ts` | P1 |
| 魔法数字�?位以上） | 151 | 🟡 Major | `audit-hardcode.ts` | P1 |
| 硬编�?Tailwind 颜色�?| 143 | 🟡 Major | `audit-hardcode.ts` | P2（P2-C 已消�?104 处） |
| 硬编�?URL | 14 | 🟡 Major | `audit-hardcode.ts` | P1 |
| 硬编�?API 路径 | 6 | 🟡 Major | `audit-hardcode.ts` | P1 |
| **总计** | **1,019** | | | |

### 3.2 静默回退问题�?05 处）

**违反规范**: 所有错误必须显式处理，禁止使用 `??` 静默回退

**典型模式**:
```typescript
const message = result.error ?? '操作失败'     // �?静默回退
throw new Error(result.error ?? '未知错误')    // �?静默回退
const data = response.data ?? []               // �?静默回退
const count = result.count ?? 0                // �?静默回退
```

**检测模�?*（`audit-hardcode.ts` 已实现）:
- `?? []` / `|| []`
- `?? 0` / `|| 0`
- `?? ""` / `|| ""`
- `?? null` / `|| null`

**按文件分�?*（预估，需运行脚本确认具体文件�?
| 模块 | 预估数量 | 说明 |
|------|----------|------|
| services/ | ~300 | 服务层错误处�?|
| components/ | ~200 | 组件层数据回退 |
| pages/ | ~100 | 页面层状态回退 |
| core/ | ~50 | 核心层回退 |
| store/ | ~55 | 状态层回退 |

**整改方案**:
1. 提取错误处理工具函数 `handleError(result: DataLayerResult, context: string)`
2. 所有错误必须记录日志：`logger.error('[模块名] 操作失败', { error: result.error })`
3. 用户可见错误必须通过 Toast/Modal 提示
4. 对于合法的空值回退，添加注释说明原�?
### 3.3 魔法数字�?51 处）

**违反规范**: 3 位以上数字必须提取为 const �?config

**典型模式**:
```typescript
setTimeout(() => {...}, 3000)           // �?魔法数字
const maxRetries = 5                    // �?魔法数字
if (score > 80) {...}                   // �?魔法数字
```

**已排除的合法数字**（`audit-hardcode.ts` v2.1�?
- 时间常量: 1000, 60000, 3600000, 86400000, 60, 24, 3600, 86400
- HTTP 状态码: 100, 200, 201, 204, 301, 302, 400, 401, 403, 404, 500, 502, 503, 504
- 百分比和阈�? 100, 200, 500, 1000
- 业务常量: 10000, 100000, 1000000
- 常见配置: 10, 20, 30, 50, 256, 512, 1024, 2048, 4096
- 分页: 10, 20, 50, 100

**按文件分�?*（预估）:
| 模块 | 预估数量 | 说明 |
|------|----------|------|
| services/ | ~80 | 超时、重试、阈�?|
| components/ | ~40 | 动画时长、尺�?|
| core/ | ~20 | 缓存 TTL、队列大�?|
| store/ | ~11 | 状态限�?|

**整改方案**:
1. 提取�?`src/config/timeouts.ts`、`src/config/thresholds.ts`
2. 引擎参数�?`src/services/scoring/v6-engine/config.ts` 注入
3. UI 动画时长提取�?`src/constants/healthStatusStyles.ts`

### 3.4 硬编�?Tailwind 颜色类（143 处）

**违反规范**: 所有颜色必须引�?`src/constants/` 中的常量

**典型模式**:
```typescript
<div className="bg-blue-500 text-white">      // �?硬编码颜�?<span className="text-red-600">               // �?硬编码颜�?<div className="hover:bg-gray-100">           // �?硬编码颜色（含变体前缀�?```

**P2-C 批次已消�?*: 104 处（29 个文件）
**剩余**: 39 处（主要为暗色模�?`dark:*` 类）

**检测模�?*（`audit-hardcode.ts` v2.0�?
```
(hover:|focus:|dark:|group-hover:|active:|disabled:)?
(bg|text|border|shadow|ring|from|to|via|stroke|fill)-([a-z]+-[0-9]+)
```

**整改方案**:
1. 使用 `COLOR_TOKENS` 常量（`src/constants/theme.tokens.ts`�?2. 使用辅助函数 `twText()` / `twBg()` / `twBorder()`
3. 暗色模式需建设完整暗色模式令牌体系（P2-遗留-1�?
### 3.5 硬编�?URL / API 路径 / 超时值（25 处）

| 类别 | 数量 | 典型模式 | 整改目标 |
|------|------|----------|----------|
| 硬编�?URL | 14 | `https://api.example.com` | `src/config/apiPaths.ts` |
| 硬编�?API 路径 | 6 | `/api/v1/stocks` | `src/config/apiPaths.ts` |
| 硬编码超时�?| 5 | `timeout: 5000` | `src/config/timeouts.ts` |

**检测模�?*:
- URL: `/https?:\/\/[^\s'"]+/`
- API 路径: `/['"]\/api\/[^'"]+['"]/`
- 超时: `/(?:timeout|delay|interval)\s*[:=]\s*(\d{4,})/`

**整改方案**:
1. URL �?API 路径迁移�?`src/config/apiPaths.ts`
2. 超时值迁移到 `src/config/timeouts.ts`
3. 所有配置值通过 config 层注�?
---

## 四、整改优先级矩阵

### P0（阻断性）�?必须立即修复

| # | 问题类型 | 数量 | 整改方案 | 预估工时 |
|---|----------|------|----------|----------|
| 1 | constants 层依赖业务层 | 3 | 类型定义移至 `src/types/modules/` | 1h |
| 2 | services 层直接依�?store | 4 | 类型移至独立文件，通过 DataBridge 交互 | 2h |
| 3 | MCP Server 缺失 | 5 | 创建 5 �?MCP Server | 4h |

### P1（严重）�?近期修复

| # | 问题类型 | 数量 | 整改方案 | 预估工时 |
|---|----------|------|----------|----------|
| 4 | 页面/组件直接 import services | 18 | 改为通过 Store/MCPClient 调用 | 6h |
| 5 | 静默回退 | 705 | 提取错误处理工具，添�?logger | 8h |
| 6 | 魔法数字 | 151 | 提取�?const/config | 4h |
| 7 | 硬编�?URL/API/超时 | 25 | 迁移�?config �?| 2h |

### P2（优化）�?计划修复

| # | 问题类型 | 数量 | 整改方案 | 预估工时 |
|---|----------|------|----------|----------|
| 8 | 硬编�?Tailwind 颜色（暗色模式） | 39 | 建设暗色模式令牌体系 | 4h |

---

## 五、按文件索引

### 5.1 涉及多问题的文件

| 文件 | MCP违规 | 跨层违规 | 硬编�?| 总问题数 |
|------|---------|----------|--------|----------|
| `src/constants/backtest.constants.ts` | - | 1 | - | 1 |
| `src/constants/execution.constants.ts` | - | 1 | - | 1 |
| `src/constants/score.constants.ts` | - | 1 | - | 1 |
| `src/services/backtest/BacktestEngine.ts` | - | 1 | ~5 | 6 |
| `src/services/export/backtestExportService.ts` | - | 1 | ~3 | 4 |
| `src/services/system/architectureService.ts` | - | 1 | ~2 | 3 |
| `src/services/trading/tradingService.ts` | - | 1 | ~2 | 3 |
| `src/components/organisms/pool/PoolBoard.tsx` | 1 | - | ~3 | 4 |
| `src/components/organisms/pool/PoolList.tsx` | 1 | - | ~3 | 4 |
| `src/components/organisms/pool/usePoolDataFromStore.ts` | 1 | - | ~2 | 3 |
| `src/components/organisms/pool/usePoolDataFromStore.ts` | 1 | - | ~2 | 3 |
| `src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx` | 1 | - | ~5 | 6 |
| `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` | 2 | - | ~4 | 6 |
| `src/pages/analysis/ValuePitPage.tsx` | 2 | - | ~5 | 7 |

### 5.2 按服务子域汇�?
| 服务子域 | MCP违规 | 跨层违规 | 建议 MCP Server |
|----------|---------|----------|-----------------|
| stockpool | 4 | - | �?已有 |
| system | 3 | 1 | �?已有 |
| scoring | 3 | - | �?已有 |
| analysis/score | 3 | - | �?已有 |
| backtest | - | 2 | �?已有 |
| export | - | 1 | �?缺失 |
| news | 1 | - | �?已有 |
| input | 1 | - | �?缺失 |
| trading | 1 | - | �?已有 |
| trade | 1 | - | �?缺失 |
| data-collector | - | - | �?缺失 |
| execution | - | - | �?缺失 |

---

## 六、验证标�?
整改完成后执行：
```powershell
npm run audit:layers    # 期望�? violations
npm run audit:mcp       # 期望�? violations, 0 warnings
npm run audit:hardcode  # 期望：问题总数 < 100（收�?90%�?npx tsc --noEmit        # 期望�? errors
npm run build           # 期望：成�?```

---

> **下一�?*: 确认本清单后，按 P0 �?P1 �?P2 顺序执行整改
