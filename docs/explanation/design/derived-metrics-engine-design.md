# 衍生指标计算引擎设计规范

> 文档编号：V9-DOC-DATA-030  
> 状态：v1.0 设计完成  
> 关联文档：[V9-DOC-DATA-028] ADR-010 · [V9-DOC-DATA-029] 八域资料体系设计  
> 最近更新：2026-07-20

---

## 1. 设计目标

为八域资料体系的 **`derived_metric` 型评分证据** 提供结构化数据支撑，基于现有 `FinancialReport`（65+ 字段）和行情数据，计算常见的衍生分析指标，填补"数据 → 洞察"之间的断层。

### 第一性原则
- **不另起炉灶**：基于 `FinancialReport` 已有字段和 `INDUSTRY_BENCHMARKS` 行业基准库计算
- **复用现有体系**：计算结果通过 `ScoreEvidence.derived_metric` 类型接入证据链，不新增独立存储
- **纯函数设计**：所有计算为纯函数，输入原始数据 → 输出衍生指标，便于测试和缓存

---

## 2. 指标体系（4 大类，20+ 指标）

### 2.1 杜邦分析体系（DuPont Analysis）

| 指标 | 公式 | 说明 | 数据来源 |
|------|------|------|---------|
| ROE（净资产收益率） | 净利润 / 净资产 | 核心盈利能力指标 | 已有字段 |
| 净利率 | 净利润 / 营业收入 | 每元收入赚多少利润 | 已有字段 |
| 资产周转率 | 营业收入 / 总资产 | 资产运营效率 | 计算 |
| 权益乘数 | 总资产 / 净资产 | 杠杆水平 | 计算 |
| ROA（资产收益率） | 净利润 / 总资产 | 总资产盈利能力 | 已有字段 |
| 三因素分解 | ROE = 净利率 × 资产周转率 × 权益乘数 | 杜邦经典分解 | 计算 |

### 2.2 估值体系（Valuation）

| 指标 | 公式 | 说明 | 数据来源 |
|------|------|------|---------|
| PE（市盈率） | 总市值 / 净利润 | 估值水平 | stock.pe |
| PB（市净率） | 总市值 / 净资产 | 估值水平 | stock.pb |
| PEG | PE / 净利润增速 | 成长性调整后估值 | 计算 |
| PE 历史分位 | 当前 PE 在历史区间的百分位 | 估值相对位置 | 计算（dailyQuotes） |
| PB 历史分位 | 当前 PB 在历史区间的百分位 | 估值相对位置 | 计算（dailyQuotes） |
| 行业 PE 分位 | 当前 PE 在行业基准的位置 | 相对行业估值 | 行业基准库 |
| 股息率 | 每股分红 / 股价 | 现金回报 | 已有字段 |
| 市值估值区间 | 按 PEG/PE/PB 综合判定（低估/合理/高估） | 综合判断 | 计算 |

### 2.3 成长质量体系（Growth Quality）

| 指标 | 公式 | 说明 | 数据来源 |
|------|------|------|---------|
| 营收增速 | (本期营收 - 上期营收) / 上期营收 | 收入增长 | 已有字段 |
| 净利增速 | (本期净利 - 上期净利) / 上期净利 | 利润增长 | 已有字段 |
| 增收增利一致性 | 营收与净利增速同向度 | 增长质量 | 计算 |
| 毛利变化 | 本期毛利率 - 上期毛利率 | 盈利能力变化 | 计算 |
| 经营现金流/净利润 | 经营现金流 / 净利润 | 利润含金量 | 计算 |
| 研发强度 | 研发费用 / 营业收入 | 创新投入 | 已有字段 |

### 2.4 风险预警体系（Risk Warning）

| 指标 | 公式 | 说明 | 数据来源 |
|------|------|------|---------|
| 资产负债率 | 总负债 / 总资产 | 偿债风险 | 已有字段 |
| 流动比率 | 流动资产 / 流动负债 | 短期偿债 | 已有字段 |
| 速动比率 | (流动资产 - 存货) / 流动负债 | 即时偿债 | 计算 |
| 有息负债率 | 有息负债 / 总资产 | 财务杠杆 | 计算 |
| 商誉占比 | 商誉 / 净资产 | 减值风险 | 计算 |
| 质押比例 | 大股东质押股数 / 总股本 | 股权风险 | 已有字段 |
| 应收增速 vs 营收增速 | 应收增速 - 营收增速 | 收入质量风险 | 计算 |
| 存货周转天数变化 | 本期 - 上期 | 运营效率变化 | 计算 |

---

## 3. 计算引擎架构

```
输入层                  计算层                     输出层
───────────             ─────────                  ─────────
FinancialReport  ──┐
                   ├─►  杜邦计算器  ────┐
Stock (行情数据) ──┤                   │
                   ├─►  估值计算器  ────┤
DailyQuotes  ──────┤                   ├─►  DerivedMetricsResult
                   ├─►  成长计算器  ────┤     (结构化指标)
IndustryBenchmark ─┤                   │
                   ├─►  风险计算器  ────┘
                   │
                   └─►  分位计算器
```

### 3.1 核心接口

```typescript
interface DerivedMetricsInput {
  symbol: string
  financial: FinancialReport        // 当期财务数据
  prevFinancial?: FinancialReport   // 上期财务数据（同比/环比需要）
  stock: Stock                      // 行情 + 估值数据
  quotes?: DailyQuotes              // 历史行情（分位计算需要）
  industryBenchmark?: IndustryBenchmark  // 行业基准
}

interface DerivedMetricsResult {
  symbol: string
  calculatedAt: number
  schemaVersion: number

  // 杜邦分析
  dupont: {
    roe: number
    roa: number
    netMargin: number
    assetTurnover: number
    equityMultiplier: number
    decomposition: {
      netMarginContribution: number   // 净利率对 ROE 的贡献
      turnoverContribution: number    // 周转率对 ROE 的贡献
      leverageContribution: number    // 杠杆对 ROE 的贡献
    }
  }

  // 估值分析
  valuation: {
    pe: number
    pb: number
    peg: number
    pePercentile?: number            // 历史分位（0-1）
    pbPercentile?: number
    industryPePercentile?: number    // 行业分位（0-1）
    dividendYield: number
    rating: 'undervalued' | 'reasonable' | 'overvalued'
    score: number                    // 估值评分 0-100
  }

  // 成长质量
  growth: {
    revenueYoY: number
    netProfitYoY: number
    consistency: number              // 增收增利一致性 -1 ~ 1
    grossMarginChange: number        // 毛利率变化（百分点）
    cashFlowQuality: number          // 经营现金流/净利润
    rdRatio: number
    score: number                    // 成长质量评分 0-100
  }

  // 风险预警
  risk: {
    debtToAssetRatio: number
    currentRatio: number
    quickRatio: number
    interestBearingDebtRatio: number
    goodwillRatio: number
    pledgeRatio: number
    receivableVsRevenue: number      // 应收增速 - 营收增速
    inventoryTurnoverChange: number  // 存货周转天数变化
    warningLevel: 'safe' | 'yellow' | 'red'
    score: number                    // 风险评分（越高越安全）0-100
  }

  // 综合评分
  overallScore: number               // 综合衍生指标评分 0-100
}
```

### 3.2 评分规则

每个子维度（杜邦/估值/成长/风险）均输出 0-100 分，综合评分为加权平均：
- **杜邦（盈利能力）**：权重 30%
- **估值**：权重 25%
- **成长质量**：权重 25%
- **风险（越低越安全）**：权重 20%

---

## 4. 与证据链的集成

衍生指标计算结果通过 **`derived_metric` 型证据** 接入评分证据链：

```typescript
// 在 scoreEvidenceService 中使用
function buildEvidenceFromDerivedMetric(
  symbol: string,
  layerId: ScoreLayerId,
  metricId: string,       // 如 'dupont.roe'、'valuation.peg'
  value: number,
  benchmark: number,
  contribution: number,
  description: string,
  weight: number,
): ScoreEvidence
```

### 4.1 各层对应衍生指标

| 评分层 | 对应衍生指标 | 证据类型 |
|--------|-------------|---------|
| L1 护城河 | 杜邦 ROE 分解、研发强度 | derived_metric |
| L2 竞品格局 | 市场份额推算、毛利率对比 | derived_metric |
| L3a 财务健康 | 成长质量全维度、风险预警全维度 | derived_metric |
| L3v 估值水平 | PEG、PE/PB 分位、行业分位 | derived_metric |
| L4 情景推演 | 三情景目标价、营收推算 | derived_metric |
| L7 第二曲线 | 营收结构变化、新业务占比 | derived_metric |

---

## 5. 性能与缓存

- **计算为纯函数**：相同输入必然产生相同输出，可安全缓存
- **缓存策略**：基于 `symbol + reportDate + dataVersion` 生成缓存 key，TTL 24h
- **增量计算**：仅当财务数据或行情数据更新时才重算
- **降级处理**：缺少上期数据时，跳过同比/环比类指标，其余正常计算

---

## 6. 实现路径

1. **Phase 1**：核心计算器（杜邦 + 估值 + 成长 + 风险），纯函数实现
2. **Phase 2**：分位计算（需历史行情数据）
3. **Phase 3**：证据链集成（derived_metric 型证据生成）
4. **Phase 4**：与 V6 引擎对接（在评分时自动计算并注入）

---

## 7. 测试用例

以典型公司财务数据为基准，验证：
- 杜邦三因素分解正确性（ROE = 净利率 × 周转率 × 杠杆）
- PEG 计算边界（负增长时的处理）
- 分位计算准确性（已知数据验证百分位）
- 风险等级判定规则（红黄线阈值）
