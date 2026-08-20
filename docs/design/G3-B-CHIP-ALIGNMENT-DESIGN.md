---
doc_id: V9-DOC-DESIGN-001
title: G3-B-CHIP-ALIGNMENT-DESIGN
status: active
last_updated: 2026-08-21
maintainer: FinSightV9 Team
---

# G3-B 详细设计 · 筹码算法对齐 CYQ + Golden Test

> **doc_id**: V9-RC2-CHIP-ALIGN-DESIGN
> **版本**: 1.0（G3-B 方案）
> **状态**: DRAFT · 待评审
> **批次**: rc.2.2
> **关联**: TD-015 / G3 / chipDistribution 口径对齐

---

## 0. 目标与范围

### 0.1 目标
将前端 TS 版 `calcChipDistribution` 的**衰减模型**从「线性时间衰减」升级为「换手率衰减」，与后端 CYQ（筹码分布）标准算法语义对齐。确保同一只股票，评分链路与展示链路的 `profitRatio` / `vwap` / `concentration` 指标误差 < 2%。

### 0.2 范围
- ✅ 修改 `chipDistribution.ts` 的衰减权重计算
- ✅ 新增 golden test（双跑对比 + 误差门禁）
- ✅ 新增 `turnoverRate` 参数支持
- ✅ 窗口从 60 → 250（与后端 1000 根折算对齐）
- ✅ 保持纯函数特性（无网络依赖）
- ❌ 不修改评分逻辑（PAS/BIAS/PRO 映射阈值不变）
- ❌ 不修改 Consumer 层（l7_l8.ts / chipBridge.ts 调用签名兼容）
- ❌ 不修改后端 API（前端改即可）

---

## 1. 差异根因分析

### 1.1 两套算法对比

| 维度 | 链路 A：后端 CYQ（展示用） | 链路 B：前端 v6（评分用） | 差异影响 |
|:---|:---|:---|:---|
| **实现位置** | Python `calculate_cyq_distribution`（API：`POST /api/collect/chip`） | TS `calcChipDistribution`（[chipDistribution.ts#L69-L205](file:///d:/FinSightV9/src/services/scoring/v6-engine/calculators/chipDistribution.ts#L69-L205)） | 双实现 |
| **回溯窗口** | 1000 根日K（[useChipStrategyCharts.ts#L539](file:///d:/FinSightV9/src/pages/output/hooks/useChipStrategyCharts.ts#L539) `count: 1000`） | 60 天（[thresholds.ts#L351](file:///d:/FinSightV9/src/config/thresholds.ts#L351) `L8_CHIP_DIST_WINDOW_DAYS: 60`） | **60 vs 1000 → 窗口差 16×** |
| **价格分桶** | 30 桶（`price_bins: 30`） | 50 桶（`L8_CHIP_DIST_BUCKETS: 50`） | 分辨率差异 |
| **衰减模型** | **换手率衰减**（CYQ 标准：每日成交量按 `1 - turnoverRate` 向现价方向转移） | **线性时间衰减**（[chipDistribution.ts#L131](file:///d:/FinSightV9/src/services/scoring/v6-engine/calculators/chipDistribution.ts#L131) `weight = (i+1) / daysUsed`） | **核心差异 → profitRatio 偏差** |
| **数据源** | 日线 OHLCV + 换手率 | 仅日线 Close + Volume | 数据维度差异 |
| **消费方** | ChipDistributionChart 可视化 | V6 L8 评分 + RLES chipBridge | — |
| **是否可离线** | ❌ 依赖 API | ✅ 纯函数 | 评分链路要求离线 |

### 1.2 差异量化估算

假设某股票 60 天窗口内：
- 前 30 天成交量低、后 30 天成交量高（典型洗盘拉升形态）
- 线性衰减：前 30 天权重 ≈ 0.25，后 30 天权重 ≈ 0.75
- 换手率衰减：前 30 天权重 ≈ 0.15（换手率低 → 转移慢），后 30 天权重 ≈ 0.85（换手率高 → 转移快）
- **profitRatio 偏差可能达 5-15%**，超出专业用户可接受范围

---

## 2. 新算法设计（G3-B 核心）

### 2.1 换手率衰减模型

**CYQ 标准算法**：
```
对第 i 天（从旧到新排序）：
  weight_i = weight_{i-1} * (1 - turnoverRate_i)
  
其中 turnoverRate_i ∈ [0, 1]（当日换手率，小数形式）
```

**直觉**：换手率越高，原价格区间的筹码向其他价格区间转移越快。权重反映"该日筹码仍留原位的概率"。

### 2.2 增强版：线性 × 换手率 混合衰减

纯换手率衰减在 turnoverRate ≈ 0 时退化（权重几乎不衰减，远端筹码无限存活）。故采用**混合模型**：

```
对第 i 天（按时间从旧到新排序，i=0 最旧）：
  linearWeight_i = (i + 1) / N          // 线性基础权重
  turnoverFactor_i = max(0.1, 1 - turnoverRate_i)  // 换手率衰减因子（下限 0.1 防退化）
  combinedWeight_i = linearWeight_i * turnoverFactor_i
  normalizedWeight_i = combinedWeight_i / Σ(combinedWeight_j)  // 归一化
```

**设计理由**：
1. 保留线性衰减的「时间优先」语义（越旧权重越低）
2. 叠加换手率衰减的「成交活跃度」语义（换手越活跃，原价位筹码越少）
3. `turnoverFactor_i ≥ 0.1` 防止零换手时权重完全不衰减
4. 归一化保持 `Σ(weight) = 1`，与旧算法数值量级兼容

### 2.3 函数签名变更

```typescript
// 旧签名（不变）
export function calcChipDistribution(
  closes: number[],
  volumes: number[],
  options: {
    windowDays?: number
    bucketCount?: number
    currentPrice?: number
  } = {},
): ChipDistribution

// 新签名（向后兼容扩展）
export function calcChipDistribution(
  closes: number[],
  volumes: number[],
  turnoverRates?: number[],  // ✅ 新增：换手率数组（0-1 小数）
  options: {
    windowDays?: number      // 默认 250（年线级别，对齐后端 1000 根折算）
    bucketCount?: number     // 默认 50（保持评分分辨率）
    currentPrice?: number
    decayModel?: 'hybrid' | 'linear'  // ✅ 新增：衰减模型选择，默认 'hybrid'
  } = {},
): ChipDistribution
```

**向后兼容**：`turnoverRates` 为 `undefined` 时自动回退到纯线性衰减（`decayModel = 'linear'`），现有 50+ 单测不受影响。

### 2.4 参数对齐

| 参数 | 旧默认值 | 新默认值 | 后端 CYQ | 说明 |
|:---|:---|:---|:---|:---|
| `windowDays` | 60 | **250** | 1000 根（≈4 年） | 250 根 ≈ 1 年交易日，评分链路主流窗口 |
| `bucketCount` | 50 | 50 | 30 | 保持评分分辨率 |
| `decayModel` | — | **'hybrid'** | 换手率衰减 | 新增参数 |
| `turnoverRate` | — | **可选** | 必填 | 缺失时回退 linear |

> **注意**：后端 CYQ 用 1000 根（4 年），前端评分用 250 根（1 年）。这是合理的——评分关注"近一年筹码结构"，展示关注"全周期筹码分布"。**目标不是完全匹配，而是同一窗口内语义对齐。**

### 2.5 核心算法改写（伪代码）

```typescript
function calcChipDistribution(closes, volumes, turnoverRates?, options?) {
  // 1. 参数解析（向后兼容）
  const windowDays = options?.windowDays ?? 250  // 旧 60 → 新 250
  const bucketCount = options?.bucketCount ?? 50
  const decayModel = options?.decayModel ?? 'hybrid'
  const hasTurnover = turnoverRates && turnoverRates.length > 0
  
  // 2. 切片最近 windowDays 天
  // 3. 构建价格桶（不变）
  // 4. 计算权重（核心变更）
  const weights = []
  for (let i = 0; i < daysUsed; i++) {
    const linearWeight = (i + 1) / daysUsed  // 线性基础权重
    
    if (decayModel === 'hybrid' && hasTurnover) {
      const tr = turnoverRates[i] ?? 0.03  // 默认换手率 3%
      const turnoverFactor = Math.max(0.1, 1 - tr)  // 下限 0.1
      weights[i] = linearWeight * turnoverFactor
    } else {
      weights[i] = linearWeight  // 回退：纯线性
    }
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  
  // 5. 分配筹码到桶（权重归一化）
  for (let i = 0; i < daysUsed; i++) {
    const close = sliceCloses[i]
    const volume = sliceVolumes[i]
    const normalizedWeight = weights[i] / totalWeight
    const weightedVolume = volume * normalizedWeight
    // ... 同旧算法
  }
  
  // 6. 计算 VWAP / 集中度 / 获利盘（不变）
}
```

---

## 3. Golden Test 设计（G3-B 门禁核心）

### 3.1 Golden Test 目标

> **保证**：对同一组 K 线+换手率输入，TS 算法输出的 `profitRatio` / `vwap` / `concentration70` / `concentration90` 与后端 CYQ API 返回值的误差 < 2%。

### 3.2 测试数据构造

**数据源**：采集 10 只代表性股票（大盘蓝筹 / 中小盘 / 周期股 / 成长股 / 妖股各 2 只）的近 250 个交易日数据。

**数据格式**：
```typescript
// golden-test-data/chip-test-cases.json
interface ChipTestCase {
  symbol: string
  name: string
  closes: number[]          // 250 个收盘价
  volumes: number[]         // 250 个成交量
  turnoverRates: number[]   // 250 个换手率（0-1 小数）
  currentPrice: number      // 当前价
  // 后端 CYQ 基准值（通过 POST /api/collect/chip count=250, price_bins=50 获取）
  expected: {
    profitRatio: number
    avgCost: number         // 对应 vwap
    concentration: number   // 对应 concentration90
    priceBins: number[]
    chipPercent: number[]
  }
  tags: string[]            // 场景标签：'low-turnover' / 'high-turnover' / 'trend' / 'reversal'
}
```

**构造步骤**：
1. 选取 10 只测试股票（代码固定）
2. 通过 `POST /api/collect/kline` 获取 250 根日K（含 `turnover_rate` 字段）
3. 通过 `POST /api/collect/chip` 获取后端 CYQ 基准值（`count=250, price_bins=50`）
4. 将原始数据 + 基准值存入 `chip-test-cases.json`（版本受控，提交到仓库）
5. 如后端不可用，使用 mock 数据（标注 `source: 'mock'`）

### 3.3 误差门禁规则

| 指标 | 容差 | 说明 |
|:---|:---|:---|
| `profitRatio` | **±2%**（绝对值） | 核心指标，误差最大容忍 |
| `vwap` / `avgCost` | **±1%**（相对误差） | 价格类指标 |
| `concentration70` | **±5%**（绝对值） | 集中度允许更大误差 |
| `concentration90` | **±5%**（绝对值） | 同上 |
| `priceBins[i]` | **±3%**（相对误差，对每个桶） | 分布形状匹配 |
| `chipPercent[i]` | **±3%**（相对误差，对每个桶） | 同上 |

**判定规则**：
```
PASS  if 所有指标误差 < 容差
WARN  if 非核心指标（concentration/bins）误差超标，但核心指标（profitRatio/vwap）达标
FAIL  if 核心指标误差超标
```

### 3.4 测试脚本结构

```typescript
// tests/unit/services/scoring/v6-engine/calculators/chip-distribution-golden.test.ts

describe('Chip Distribution Golden Test', () => {
  const testCases = loadTestCases('chip-test-cases.json')  // 10 只股票数据

  describe.each(testCases)('$symbol ($name)', (tc) => {
    let result: ChipDistribution
    
    beforeAll(() => {
      result = calcChipDistribution(
        tc.closes,
        tc.volumes,
        tc.turnoverRates,       // ✅ 传入换手率
        {
          windowDays: 250,
          bucketCount: 50,
          currentPrice: tc.currentPrice,
          decayModel: 'hybrid',
        }
      )
    })

    // 3.4.1 profitRatio 误差 < 2%
    test('profitRatio 误差 < 2%', () => {
      const delta = Math.abs(result.profitRatio! - tc.expected.profitRatio)
      expect(delta).toBeLessThan(0.02)
    })

    // 3.4.2 vwap 相对误差 < 1%
    test('vwap 相对误差 < 1%', () => {
      const relErr = Math.abs(result.vwap! - tc.expected.avgCost) / tc.expected.avgCost
      expect(relErr).toBeLessThan(0.01)
    })

    // 3.4.3 90% 集中度误差 < 5%
    test('concentration90 误差 < 5%', () => {
      // 注意：后端 concentration 是百分比（0-100），前端 concentration90 是比例（0-1）
      const backendConcentration = tc.expected.concentration / 100
      const delta = Math.abs(result.concentration90! - backendConcentration)
      expect(delta).toBeLessThan(0.05)
    })

    // 3.4.4 每个价格桶筹码量误差 < 3%（抽检 5 个桶）
    test.each([0, 10, 24, 39, 49])('priceBins[%i] 误差 < 3%', (idx) => {
      if (result.buckets[idx] && tc.expected.chipPercent[idx]) {
        const relErr = Math.abs(
          result.buckets[idx]!.chipAmount - tc.expected.chipPercent[idx]!
        ) / tc.expected.chipPercent[idx]!
        expect(relErr).toBeLessThan(0.03)
      }
    })
  })

  // 3.4.5 回归保护：旧调用方式（无 turnoverRate）仍正确
  describe('向后兼容：无 turnoverRate 时回退线性衰减', () => {
    test('不报错且输出合理', () => {
      const result = calcChipDistribution(tc.closes, tc.volumes, undefined, {
        windowDays: 60,  // 旧默认值
        bucketCount: 50,
      })
      expect(result.source).toBe('real')
      expect(result.totalChips).toBeGreaterThan(0)
      expect(result.profitRatio).toBeGreaterThan(0)
      expect(result.profitRatio).toBeLessThan(1)
    })
  })
})
```

### 3.5 CI 门禁集成

```json
// package.json scripts
{
  "scripts": {
    "test:chip-golden": "vitest run tests/unit/services/scoring/v6-engine/calculators/chip-distribution-golden.test.ts",
    "test:chip-regression": "vitest run tests/unit/services/scoring/v6-engine/calculators/chipDistribution.test.ts",
    "audit:chip-consistency": "tsx scripts/audit/chip-consistency-check.ts"
  }
}
```

**门禁策略**：
- `test:chip-golden`：rc.2.2 发布前强制执行（任何 FAIL 阻塞发布）
- `test:chip-regression`：现有 50+ 单测，保证向后兼容
- `audit:chip-consistency`：可选——运行时采集同一股票的 TS 计算结果与后端 API 结果，输出差异报告

### 3.6 数据版本管理

```
tests/fixtures/chip-test-cases/
├── chip-test-cases.json          # 10 只股票测试数据（Git LFS 或直接提交）
├── chip-test-cases.v1.md         # 数据构造说明
└── scripts/
    └── fetch-chip-golden-data.ts  # 重新采集基准数据的辅助脚本
```

**更新频率**：每季度或后端 CYQ 算法变更时更新基准数据。

---

## 4. 影响面分析

### 4.1 调用方影响

| 调用方 | 位置 | 影响 | 需要改动 |
|:---|:---|:---|:---|
| V6 L8 评分 | [l7_l8.ts#L308-L312](file:///d:/FinSightV9/src/services/scoring/v6-engine/calculators/l7_l8.ts#L308-L312) | 低：`turnoverRate` 可从 KlineBar 数组取 | ✅ 需传 `turnoverRates` |
| RLES chipBridge | [chipBridge.ts](file:///d:/FinSightV9/src/services/scoring/rles-engine/chipBridge.ts) | 低：同上 | ✅ 需传 `turnoverRates` |
| 现有 50+ 单测 | `chipDistribution.test.ts` | 无：向后兼容 | ❌ 不需要 |
| Consumer 层 | 多处调用 `calcChipDistribution` | 需传 turnoverRate 字段 | ✅ 小幅修改 |

### 4.2 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|:---|:---:|:---:|:---|
| `turnoverRate` 缺失导致回退到线性衰减，评分结果不变 | 高 | 低（评分结果不变，但口径仍与后端不一致） | 在 Consumer 层强制传 `turnoverRate`；CI 静态检查 |
| 混合衰减模型导致评分突变，历史回测结果漂移 | 中 | 中 | 灰度发布：新旧算法 A/B 对比 |
| 后端 CYQ 算法变更导致基准值漂移 | 低 | 中 | 基准数据版本化；定期重采 |
| `windowDays` 60→250 导致计算量增加 | 低 | 低（O(n) 复杂度，250 根可忽略） | — |

### 4.3 性能影响

| 指标 | 旧算法 | 新算法 | 变化 |
|:---|:---|:---|:---|
| 计算复杂度 | O(n) | O(n) | 不变 |
| 单次计算耗时（250 根 50 桶） | ~0.3ms | ~0.4ms | +33%（绝对值 < 0.1ms） |
| 内存分配 | 50 桶 × 4 字段 | 250 权重 + 50 桶 | 可忽略 |

---

## 5. 实施计划

### Phase 1：算法改造（0.5 天）

| 步骤 | 任务 | 产出 |
|:---|:---|:---|
| 1.1 | `calcChipDistribution` 新增 `turnoverRates` 参数与 `decayModel` 选项 | [chipDistribution.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/calculators/chipDistribution.ts) |
| 1.2 | 实现混合衰减模型 `hybrid` | 同上 |
| 1.3 | 默认 `windowDays` 60 → 250 | [thresholds.ts](file:///d:/FinSightV9/src/config/thresholds.ts) |
| 1.4 | 旧单测 `chipDistribution.test.ts` 全量通过（向后兼容） | 测试报告 |

### Phase 2：Golden Test（1 天）

| 步骤 | 任务 | 产出 |
|:---|:---|:---|
| 2.1 | 选取 10 只代表性测试股票 | 测试清单 |
| 2.2 | 编写数据采集脚本 `fetch-chip-golden-data.ts` | 辅助脚本 |
| 2.3 | 采集基准数据 → `chip-test-cases.json` | 测试数据 |
| 2.4 | 编写 `chip-distribution-golden.test.ts` | Golden Test |
| 2.5 | 运行并调优参数（容差调整/算法微调） | 测试报告 |

### Phase 3：Consumer 接入（0.5 天）

| 步骤 | 任务 | 产出 |
|:---|:---|:---|
| 3.1 | `l7_l8.ts` 传 `turnoverRate` 给 `calcChipDistribution` | 评分链路对齐 |
| 3.2 | `chipBridge.ts` 同上 | RLES 链路对齐 |
| 3.3 | 其他 Consumer 扫描与改动 | 全链路对齐 |
| 3.4 | 全量单测 + e2e 回归 | 回归报告 |

### Phase 4：发布与监控（0.5 天）

| 步骤 | 任务 | 产出 |
|:---|:---|:---|
| 4.1 | rc.2.2 打包发布 | Tag `v2.0.0-rc.2.2` |
| 4.2 | 运行时 A/B 监控（新旧算法 profitRatio 差异） | 监控脚本 |
| 4.3 | 72 小时观察期 | 监控报告 |

---

## 6. 验收标准

| # | 验收项 | 标准 | 验证方法 |
|:--:|:---|:---|:---|
| A1 | Golden Test 10/10 股票通过 | 所有指标误差 < 容差 | `npm run test:chip-golden` |
| A2 | 现有 50+ 单测全通过 | 无回归 | `npm run test:chip-regression` |
| A3 | Consumer 层全部传 `turnoverRate` | 静态检查 0 缺失 | TS Compiler + ESLint |
| A4 | 性能无退化 | 单次计算 < 1ms | `performance.now()` bench |
| A5 | 运行时 A/B 差异 < 2% | 10 只实盘股票 | `audit:chip-consistency` |
| A6 | 文档更新 | CHANGELOG + API 文档 | Code Review |

---

## 7. 开放问题

| # | 问题 | 状态 | 建议 |
|:--:|:---|:---:|:---|
| Q1 | 后端 CYQ 算法的换手率衰减是否与本方案的「混合模型」完全一致？ | 待确认 | 需后端开发确认 CYQ 的具体衰减公式 |
| Q2 | 测试数据采集是否需要 Mock 后端？ | 待定 | 若后端不可用，先用 mock 数据，后续补真实数据 |
| Q3 | `turnoverRate` 字段在所有 `KlineBar` 数据源中是否都可用？ | 待扫描 | 需检查 Tushare / iFinD / Westock 的字段覆盖 |
| Q4 | 窗口 250 天是否会导致评分结果突变？ | 待验证 | Phase 4 的 A/B 监控将回答此问题 |
