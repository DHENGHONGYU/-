# 代码审查快速指南

> **PR**：安全格式化迁移 + 类型定义放宽  
> **提交 ID**：`34b27d53`  
> **审查预估时间**：30-45 分钟（P0 必审） / 60 分钟（P1+P2 全量）

---

## 一、高风险修改点（必须审查）

### 1.1 类型定义放宽（影响面最广）

| 风险等级 | 文件 | 行号 | 变更内容 | 审查要点 |
|---------|------|------|---------|---------|
| **高** | `src/types/modules/widget.types.ts` | 105-114 | `MarketIndexData.price/change/changePercent` 从 `number` 改为 `number \| undefined` | 确认放宽理由是否充分（停牌/非交易时段/采集失败） |
| **高** | `src/types/modules/widget.types.ts` | 143-148 | `WatchlistData.price/changePercent` 同上 | 同上 |
| **高** | `src/data/types/types.portfolio.ts` | 13-24 | `PortfolioHolding.price/marketValue/score` 同上 | 确认持仓数据中这些字段确实可能缺失 |

**审查要点**：类型放宽是协变安全的（`number` 是 `number | undefined` 的子类型），但所有消费方必须处理 `undefined`。TypeScript 编译器已强制检查所有消费方。

### 1.2 服务层空值处理（逻辑正确性）

| 风险等级 | 文件 | 行号 | 变更内容 | 审查要点 |
|---------|------|------|---------|---------|
| **高** | `src/services/trading/watchlistMoversService.ts` | 36-42 | `valid` 过滤器增加 `changePercent` 校验 | 确认过滤逻辑不会误删有效数据 |
| **高** | `src/services/trading/watchlistMoversService.ts` | 44-56 | 排序使用 `?? 0` | 确认 `?? 0` 不影响排序结果（已过滤无效数据） |
| **高** | `src/services/trading/watchlistMoversService.ts` | 63-69 | `toMover` 映射使用 `?? 0` | 确认下游消费 `WatchlistMover.price` 时 `0` 不会导致问题 |
| **高** | `src/services/useCase/rebalancePortfolio.useCase.ts` | 114 | `marketValue` 求和使用 `?? 0` | 确认 `totalValue` 计算在 `marketValue` 为 undefined 时不会偏差 |
| **高** | `src/services/useCase/rebalancePortfolio.useCase.ts` | 125-126 | `price` 除法前添加 `&& holding.price` 检查 | 确认跳过无价格持仓的再平衡是预期行为 |

### 1.3 组件层除零防护（运行时安全）

| 风险等级 | 文件 | 行号 | 变更内容 | 审查要点 |
|---------|------|------|---------|---------|
| **高** | `src/apps/trading/panels/CoreResourcePanel.tsx` | 212-219 | 新增 `formatPositionRatio` 函数 | 确认除零检查 `denominator === 0` 是否正确 |
| **中** | `src/apps/trading/panels/CoreResourcePanel.tsx` | 207-210 | `formatNumber` 参数改为可空 | 确认 `isValidNumber` 守卫逻辑正确 |

---

## 二、中风险修改点（建议审查）

### 2.1 组件空值处理

| 风险等级 | 文件 | 审查要点 |
|---------|------|---------|
| **中** | `src/cockpit/widgets/WatchlistWidget.tsx` | `getChangeIcon` / `getChangeColor` 在 `undefined` 时返回灰色图标和灰色文本 |
| **中** | `src/cockpit/widgets/MarketIndicesWidget.tsx` | 同上 |
| **中** | `src/apps/trading/panels/CoreResourcePanel.tsx` | 评分/价格/市值列在 `undefined` 时显示 `--` |

### 2.2 服务层空值合并

| 风险等级 | 文件 | 审查要点 |
|---------|------|---------|
| **中** | `src/services/portfolio/portfolioService.ts:69` | `addHolding` 中 `holding.marketValue ?? 0` 是否正确 |
| **中** | `src/services/portfolio/portfolioService.ts:108` | `removeHolding` 中 `holding.marketValue ?? 0` 是否正确 |
| **中** | `src/services/trading/portfolioBuilder.ts:116` | 权重计算中 `h.price ?? 0` 是否正确 |

### 2.3 批量替换修复

| 风险等级 | 文件 | 审查要点 |
|---------|------|---------|
| **中** | `src/apps/analysis/AnalysisApp.tsx` | import 语句位置是否正确（脚本插入导致语法错误后手动修复） |
| **中** | `src/cockpit/widgets/PortfolioOverviewWidget.tsx` | 同上 |
| **中** | `src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx:169` | `(score * weight).toFixed(3)` 手动替换为 `safeFormatNumber(score * weight, 3)` |

---

## 三、低风险修改点（可选审查）

### 3.1 自动化批量替换（30 个文件，49 处）

这些文件由 `scripts/audit/scan-tofixed-mid-risk.mjs` 脚本自动替换，模式统一：`value.toFixed(n)` → `safeFormatNumber(value, n)`。

**抽查建议**：随机抽取 3-5 个文件确认替换正确性即可。

| 代表文件 | 替换次数 |
|---------|---------|
| `src/pages/analysis/BacktestPage.tsx` | 5 |
| `src/pages/trading/components/TradeModal.tsx` | 4 |
| `src/cockpit/widgets/SectorHeatmapWidget.tsx` | 3 |
| `src/components/atoms/StockPriceChange.tsx` | 1 |

### 3.2 预存在问题修复

| 风险等级 | 文件 | 审查要点 |
|---------|------|---------|
| **低** | `src/core/dataflow/dataflowEngine.ts:150` | `event.(Array.isArray(...)` 语法错误修复 |
| **低** | `src/mcp/servers/trading/tradingServer.ts:313` | `JSON.parse` 类型断言改进 |
| **低** | `src/services/data-collector/MarketDataAdapter.ts:188` | `FUND_FLOW_NAMES[raw.type]` 索引类型修复 |

---

## 四、审查流程

### 4.1 推荐审查顺序

```
Step 1（10分钟）：审查类型定义变更
  → widget.types.ts（5 字段）
  → types.portfolio.ts（3 字段）
  → 确认放宽理由

Step 2（15分钟）：审查高风险服务层
  → watchlistMoversService.ts（过滤 + 排序逻辑）
  → rebalancePortfolio.useCase.ts（除法 + 跳过逻辑）
  → portfolioService.ts（加减法空值合并）
  → portfolioBuilder.ts（权重计算）

Step 3（10分钟）：审查核心组件
  → WatchlistWidget.tsx（空值渲染）
  → MarketIndicesWidget.tsx（空值渲染）
  → CoreResourcePanel.tsx（除零防护）

Step 4（5分钟）：审查工具函数
  → format.ts（4 个安全格式化函数）

Step 5（5分钟）：抽查批量替换
  → 随机抽取 3-5 个文件
  → 确认 import 和替换正确
```

### 4.2 审查检查清单

- [ ] 类型定义放宽的 8 个字段是否有充分的业务理由
- [ ] `watchlistMoversService` 的过滤逻辑不会误删有效数据
- [ ] `rebalancePortfolio.useCase` 中跳过无价格持仓的行为是预期的
- [ ] `CoreResourcePanel` 的除零防护覆盖所有除法路径
- [ ] `safeFormatNumber` 函数在所有边界场景下返回正确值
- [ ] 批量替换的文件 import 语法正确
- [ ] 没有遗漏的 `.toFixed()` 调用（可通过全局搜索确认）

### 4.3 验证命令

```bash
# 类型检查
npx tsc -p tsconfig.prod.json --noEmit

# 单元测试
npx vitest run src/lib/format.test.ts

# 搜索残留的 .toFixed() 调用
# 使用 Grep 工具搜索 \.toFixed\( 模式
```

---

## 五、高风险修改点速查表

| # | 文件 | 行号 | 风险 | 一句话说明 |
|---|------|------|------|-----------|
| 1 | `widget.types.ts` | 108-110 | 高 | `MarketIndexData` 3 个字段改为可空 |
| 2 | `widget.types.ts` | 146-147 | 高 | `WatchlistData` 2 个字段改为可空 |
| 3 | `types.portfolio.ts` | 20-22 | 高 | `PortfolioHolding` 3 个字段改为可空 |
| 4 | `watchlistMoversService.ts` | 36-42 | 高 | 过滤器增加 `changePercent` 校验 |
| 5 | `rebalancePortfolio.useCase.ts` | 125 | 高 | `price` 缺失时跳过再平衡 |
| 6 | `CoreResourcePanel.tsx` | 212-219 | 高 | 新增 `formatPositionRatio` 防除零 |

---

**指南生成日期**：2026-08-04
