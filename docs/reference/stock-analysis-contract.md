---
title: stock-analysis-contract
type: reference
domain: project
phase: requirements
tier: important
status: draft
maintainer: 架构�?summary: "定义 stock-analysis 子域的接口契约、职责边界、数据流与依赖关系�?
tags: [project, contract, analysis, stocks, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-107
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# stock-analysis-contract.md �?个股分析子域接口契约

> **定位**：定�?`stock-analysis` 子域的接口契约、职责边界、数据流与依赖关系�? 
> **Source**：`./services-catalog.md`�?4 子域总览）、`../../AGENTS.md` §一（分层规则）�?
---

## 1. 职责边界

### 1.1 核心职责

- **个股深度分析数据供给**：提供投资画像（InvestmentProfile）、KAI 综合评分（KaiScore）、AI 大模型对比（ModelComparison）等深度分析数据，供驾驶�?Widget 消费�?- **股票池监控数据供�?*：提供自选股/监控池列表（StockPool）及其分页查询能力，支持股票�?Widget 的实时展示�?- **智能聊天数据交互**：提供个�?市场分析聊天历史（ChatHistory）与消息发送（sendChatMessage）能力，支撑智能对话 Widget�?- **双策略评分数据供�?*：提供热门板块（HotSectorData）与价值洼地（ValuePitData）策略评分数据，用于策略 Widget 展示�?
> **现状说明**：当前子域仅包含 `MockStockAnalysisProvider`（Mock 数据提供者），所有方法均为静�?Mock 实现。生产环境需替换�?REST/WebSocket 真实数据源�?
### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层�?|
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单�?|
| 禁止事项 | 禁止直写 IndexedDB（须�?`DataBridge.forward()`�?|
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）、`cockpit/`（驾驶舱层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据�?|
|----------|------|--------|
| `data-collector` | 上游：采集编�?| `MockStockAnalysisProvider` �?`MockCollector` �?`collect()` 中按 endpoint 路由调用，生�?`RawMarketData` 后进�?`MarketDataAdapter` |
| `cockpit` | 下游：直接消�?| `MarketDataProvider` �?`sendChatMessage()` 中直接调�?`MockStockAnalysisProvider.sendChatMessage()`（MOCK 模式�?|
| `llm` | 下游：替代消�?| `MarketDataProvider` �?REST 模式下调�?`llmGateway.streamingChat()` 替代 `MockStockAnalysisProvider` 的聊天功�?|

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface�?
> **说明**：`stock-analysis` 子域本身未声明独立的类型文件（如 `stock-analysisTypes.ts`）。其相关类型定义�?`src/types/modules/widget.types.ts` 统一提供。以下为该子域直接消费的类型摘录�?
```typescript
// 来源：src/types/modules/widget.types.ts

export interface AnalysisScores {
  profile: InvestmentProfile
  kai: KaiScore
}

export interface InvestmentProfile {
  tags: string[]
  metrics: ProfileMetric[]
}

export interface ProfileMetric {
  name: string
  score: number
  description?: string
  icon?: string
}

export interface KaiScore {
  totalScore: number
  sentiment: number
  trend: number
  flow: number
  dimensions: KaiDimension[]
  detailDistribution: KaiDetailItem[]
}

export interface KaiDimension {
  name: string
  score: number
  weight: number
  status: string
  color: string
}

export interface KaiDetailItem {
  dimensionName: string
  itemName: string
  score: number
  weight: number
  color: string
}

export interface ModelComparison {
  leftModel: ModelInfo
  rightModel: ModelInfo
  dimensions: CompareDimension[]
  riskHint: string
}

export interface ModelInfo {
  id: string
  name: string
  version: string
  score: number
}

export interface CompareDimension {
  name: string
  leftScore: number
  rightScore: number
  weight: number
}

export interface StockPool {
  stocks: StockPoolItem[]
  total: number
  page: number
  pageSize: number
}

export interface StockPoolItem {
  code: string
  name: string
  price: number
  changePercent: number
  turnover: string
  turnoverRate: string
  statusColor: string
  statusLabel: string
}

export interface ChatHistory {
  target: string
  targetType: 'stock' | 'market'
  messages: ChatMessage[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface HotSectorData {
  symbol: string
  name: string
  score: number
  action: 'immediate' | 'probe' | 'ignore'
  dimensions: {
    momentum: number
    sentiment: number
    technical: number
    valuation: number
    composite: number
  }
}

export interface ValuePitData {
  symbol: string
  name: string
  score: number
  action: 'immediate' | 'probe' | 'wait' | 'ignore'
  rotationSignal: boolean
  dimensions: {
    catalyst: number
    valuation: number
    chip: number
    rotation: number
    liquidity: number
    composite: number
  }
}
```

### 2.2 主入口函�?
> **说明**：`stock-analysis` 子域当前无统一�?`index.ts` 入口文件。唯一导出�?`MockStockAnalysisProvider` 类，�?7 个静态方法�?
| 函数 | 签名 | 职责 | 备注 |
|------|------|------|------|
| `getAnalysisScores()` | `() => Promise<AnalysisScores>` | 返回投资画像 + KAI 评分 | �?500ms 模拟延迟 |
| `getModelComparison()` | `() => Promise<ModelComparison>` | 返回 AI 大模型对比数�?| �?600ms 模拟延迟 |
| `getStockPool()` | `(page?: number, pageSize?: number) => Promise<StockPool>` | 返回股票池列�?| �?450ms 模拟延迟 |
| `getChatHistory()` | `(target?: string) => Promise<ChatHistory>` | 返回标的聊天历史 | �?700ms 模拟延迟 |
| `getHotSectors()` | `() => Promise<HotSectorData[]>` | 返回热门板块策略评分 | �?500ms 模拟延迟 |
| `getValuePit()` | `() => Promise<ValuePitData[]>` | 返回价值洼地策略评�?| �?500ms 模拟延迟 |
| `sendChatMessage()` | `(target: string, _question: string) => Promise<ChatMessage>` | 模拟发送消息并返回助手回复 | �?1200ms 模拟延迟 |

> **TODO[子域 owner]**：生产环境需新增 `stock-analysisService.ts` 主入口，封装真实 REST/WebSocket 调用，当�?`MockStockAnalysisProvider` 仅保留用于单元测试和开发环境�?
### 2.3 事件接口

> **说明**：当�?`stock-analysis` 子域未实�?`EventBus` 发布/订阅。数据消费由 `MockCollector` 的轮询模式或 `MarketDataProvider` 的直接调用驱动。待主入口重构后，需补充以下事件接口�?
| 事件�?| 发布�?| 订阅�?| 说明 |
|--------|--------|--------|------|
| `stock-analysis:loaded` | `StockAnalysisService` | `store/analysisScoresStore` | 分析数据加载完成 |
| `stock-analysis:error` | `StockAnalysisService` | `errorBus` | 错误上报 |

---

## 3. 数据�?
```
[MockStockAnalysisProvider / 未来真实 API]
    �?MockStockAnalysisProvider.{method}()
    �?[分支 A：MockCollector.collect() 路由]
    �?MockCollector.wrapData() �?RawMarketData
    �?MarketDataAdapter.adapt() �?MarketData
    �?widgetRegistry / MarketDataProvider
    �?Zustand Store (withBroadcast)
    �?cockpit Widgets / pages

[分支 B：MarketDataProvider.sendChatMessage() 直接调用]
    �?MockStockAnalysisProvider.sendChatMessage()
    �?ChatMessage �?直接注入 Widget 本地会话
```

---

## 4. 配置与依�?
### 4.1 依赖白名单（lib/�?
> **说明**：当�?`stock-analysis` 子域未直接依�?`lib/` 白名单中的基础设施模块（如 `logger`、`eventBus`、`format`、`errors`）。Mock 数据生成器使用纯函数实现，无外部依赖�?
| 依赖 | 路径 | 用�?| 当前状�?|
|------|------|------|----------|
| logger | `@/lib/logger` | 日志输出 | �?未使用（当前 Mock 无日志） |
| EventBus | `@/lib/eventBus` | 事件发布/订阅 | �?未使�?|
| format | `@/lib/format` | 数据格式�?| �?未使�?|
| errors | `@/lib/errors` | 错误类型定义 | �?未使�?|

> **TODO[子域 owner]**：生产环境主入口实现后，必须接入 `logger` �?`errors` 模块，并考虑通过 `EventBus` 发布数据就绪事件�?
### 4.2 其他依赖

| 依赖 | 路径 | 用�?| 合规�?|
|------|------|------|--------|
| nanoid | `nanoid` | 生成聊天消息 ID | �?第三方库（工具） |
| widget.types | `@/types/modules/widget.types` | 类型定义（零依赖层） | �?合规 |
| cockpit.constants | `@/constants/cockpit.constants` | 常量引用（零依赖层） | �?合规 |

### 4.3 配置�?
> **说明**：当前子域无独立配置项。Mock 行为�?`src/constants/cockpit.constants.ts` 中的 `LLM_MODEL_VERSIONS`、`KAI_DIMENSION_NAMES`、`STOCK_POOL_STATUS_COLORS`、`INVESTMENT_PROFILE_METRICS` 等常量驱动。生产环境接入真�?API 后，需新增 `src/config/analysisTemplatesConfig.ts` 存储 API 端点、超时时间、重试策略等配置�?
| 配置�?| 当前�?| 说明 | 来源 |
|--------|--------|------|------|
| `MOCK_STOCK_NAMES` | 硬编�?12 �?| 模拟股票�?| 代码内常�?|
| `PROFILE_TAGS` | 8 个标�?| 模拟用户画像 | 代码内常�?|
| `KAI_DETAIL_ITEMS` | 6 维度 × 4 细项 | KAI 评分细项 | 代码内常�?|
| `COMPARE_DIMENSIONS` | 8 个维�?| 模型对比维度 | 代码内常�?|
| `RISK_HINTS` | 4 条文�?| 风险提示 | 代码内常�?|

---

## 5. 测试策略

> **说明**：当�?`stock-analysis` 子域未设�?`__tests__` 目录或测试文件。测试覆盖由上游 `MockCollector` �?`MarketDataAdapter` 的集成测试间接提供�?
| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `../../src/services/news/__tests__/` | �?待创建：Mock 数据生成器、纯函数（randomScore、getScoreLabel 等） |
| 集成测试 | `tests/services/MarketDataAdapter.test.ts` | `MarketDataAdapter` �?`analysisScores`、`modelComparison`、`stockPool` 等类型的适配逻辑 |
| Mock 策略 | `src/services/stock-analysis/mockStockAnalysisProvider.ts` | 当前文件本身即为 Mock 提供者，�?`MockCollector` �?`MarketDataProvider` 消费 |

> **TODO[子域 owner]**：创�?`__tests__/mockStockAnalysisProvider.test.ts`，覆�?`MockStockAnalysisProvider` �?7 个静态方法，断言返回数据符合 `widget.types` 接口约束�?
---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作�?|
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿：基�?`MockStockAnalysisProvider` 单文件现状，梳理职责、接口、数据流与待办事�?| 架构�?|

---

> **TODO[子域 owner]**�?> 1. 创建 `stock-analysisService.ts` 主入口，封装真实 API 调用，保�?`MockStockAnalysisProvider` 用于测试�?> 2. 补充 `__tests__` 目录，实现单元测试覆盖�?> 3. 接入 `DataBridge.forward()` 写入 IndexedDB，避免直接透传 Mock 数据�?UI�?> 4. 接入 `logger` �?`eventBus` 基础设施�?> 5. 完成后运�?`tsc --noEmit` + `audit:layers` 验证�?