---
title: 热门赛道策略（hot-momentum）
version: v1.0.0
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: active
---

# 热门赛道策略（hot-momentum）

> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档定义 V9 的热门赛道策略（hot-momentum），属于四分类体系中的第二梯队。该策略以板块动量为核心，筛选身处热门板块且动量指标达标的标的，追求短期趋势收益。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略定义

热门赛道策略（hot-momentum）是 V9 四分类选股体系中优先级第二的分类（与 value-bargain 并列第二梯队）。该策略的核心逻辑是 **"板块已在动，跟着趋势走"**，识别处于热门板块且动量指标强劲的标的，执行短期趋势交易。

### 核心理念

- **趋势跟随**：板块已经在动，顺势而为，不逆势操作。
- **快进快出**：持有期短（3-15 天），止损紧（-8%），止盈快（+15% 卖 50%）。
- **动量驱动**：以板块动量（priceToMA20）和热门行业排名为核心筛选条件。
- **高风险高回报**：高估值、高涨幅、高波动，需要严格止损。

---

## 2. 触发条件与阈值

### 2.1 分类判定条件

```
hot-momentum 判定条件（全部满足）：
  1. 综合分 >= compositeMin（3.0）
  2. sector 非空，且属于热门 TOP5 板块
  3. 动量（priceToMA20）>= hotMomentumMinMomentum（0.05，即 5%）
```

### 2.2 四分类阈值

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| compositeMin | 3.0 | `strategyRules.ts` | 综合分最低门槛 |
| hotMomentumTopSectors | 5 | `strategyRules.ts` | 热门板块 TOP N 数量 |
| hotMomentumMinMomentum | 0.05 | `strategyRules.ts` | 最小动量（priceToMA20，5%） |

### 2.3 双策略评分阈值

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| hotSectorV6Min | 3.5 | `dualStrategyRules.ts` | 进入热门五维评分的 V6 最低分 |
| hotSectorImmediateThreshold | 4.0 | `dualStrategyRules.ts` | HotSectorScore >= 4.0 → 立即跟进 |
| hotSectorProbeThreshold | 3.5 | `dualStrategyRules.ts` | HotSectorScore 3.5-4.0 → 试探性跟进 |

### 2.4 动作规则

| HotSectorScore | 动作 | 仓位 |
|----------------|------|------|
| > 4.0 | **立即跟进** | 5%-8% |
| 3.5 - 4.0 | **试探性跟进** | 2%-3% |
| < 3.5 | 不追 | 0% |

---

### 2.5 热门板块检索定义（精准定义）

> 本节明确"热门板块"的可量化定义与检索协议，作为 hot-momentum 分类条件 #2（sector 属于热门 TOP N）的**唯一判定依据**。
> 2026-08-09 新增，消除原"热门"无定义、检索硬编码 Mock、匹配方式脆弱三类问题。

#### 2.5.1 板块代码体系

采用**申万行业分类（SW 分类）**，与 `RotationSectorScore` 的 `swLevel1/swLevel2/swLevel3` 字段对齐：

| 层级 | 字段 | 用途 | 示例 |
|:---|:---|:---|:---|
| 申万一级 | `swLevel1` | 粗粒度分组 | "电子" |
| 申万二级 | `swLevel2` / `sectorCode` | **热门检索主键** | "半导体"（`801120.SW`）|
| 申万三级 | `swLevel3` | 细分定位 | "半导体设备" |

- `sectorCode` 采用申万二级代码（如 `801120.SW`），为热门匹配的**唯一键**。
- `Stock.industryCode` 须在 basic 采集时填充为申万二级代码，确保 `isHotSector` 可精确匹配（见 2.5.4）。

#### 2.5.2 "热门"判定标准

**定义**：在指定评分日期，板块轮动综合得分 `total`（五因子加权，0-100）排名 TOP N 的板块即为"热门板块"。

| 要素 | 值 | 配置位置 |
|:---|:---|:---|
| 排序指标 | `RotationSectorScore.total`（0-100）| `types.rotation.ts` |
| 取前 N | `hotMomentumTopSectors`（默认 5）| `strategyRules.ts` |
| 观察周期 | 评分日当日（五因子基于近 5 个交易日数据计算）| Python `/api/collect/sectors` |
| 评分日期 | `scoreDate`（取最新）| `rotationScoreStore.getLatestBySector` |

**五因子构成**（已存在于 `RotationSectorScore` 实体）：

| 因子 | 字段 | 数据来源 |
|:---|:---|:---|
| 景气 | `f1Jingqi` | 行业景气度 |
| 资金 | `f2Zijin` | 主力资金净流入 |
| 估值 | `f3Guzhi` | PE/PB 历史分位 |
| β+相关 | `f4Beta` | 相对大盘 β 系数 |
| 量能 | `f5Nengliang` | 成交量放大倍数 |
| **综合总分** | `total` (0-100) | 五因子加权 |

> `total` 即"板块强度分"，与双策略的 `HotSectorScore`（0-5）是**不同分制**，详见 2.5.5。

#### 2.5.3 检索协议（数据链路）

```
AKShare 申万板块接口（ak.sw_index_* / ak.stock_board_industry_*）
  → Python /api/collect/sectors（新增）
    → 计算五因子 → RotationSectorScore
      → rotationScoreStore.save（持久化到 IndexedDB rotationScores store）
        → hotSectorService.getHotSectors() 读取最新 scoreDate 的 TOP N
          → hotSectorQueryUseCase
            → strategyEngine.fetchTopHotSectors
              → isHotSector 匹配
```

**关键变更**：废弃 `hotSectorService.ts` 中硬编码的 `HOT_SECTORS` 样本数组，改为读取 `rotationScoreStore`。

#### 2.5.4 板块匹配规则（isHotSector）

废弃原字符串模糊匹配（`includes` 双向），改为**两段式精确匹配**：

```typescript
// 改造前（脆弱）：Stock.sector 中文名 vs HotSector.name 中文名，includes 双向
function isHotSector(sector: string, topHotSectors: HotSector[]): boolean {
  const normalized = sector.toLowerCase()
  return topHotSectors.some((s) =>
    normalized.includes(s.name.toLowerCase()) ||
    s.name.toLowerCase().includes(normalized),
  )
}

// 改造后（两段式精确）：
// 1. 主匹配：Stock.industryCode vs HotSector.code，申万二级代码严格相等
// 2. 回退匹配：industryCode 缺失时，Stock.sector vs HotSector.name，中文名精确相等（非 includes）
function isHotSector(
  industryCode: string | null,
  sectorName: string | null,
  topHotSectors: HotSector[],
): boolean {
  if (industryCode) {
    return topHotSectors.some((s) => s.code === industryCode)
  }
  if (sectorName) {
    return topHotSectors.some((s) => s.name === sectorName)
  }
  return false
}
```

**两段式匹配设计理由**：
- **主匹配（industryCode）**：申万二级代码精确相等，最高精度，无歧义。
- **回退匹配（sectorName）**：当 `Stock.industryCode` 未填充时（basic 采集尚未接入行业代码），使用 `Stock.sector` 中文名与 `HotSector.name` 精确相等匹配。相比废弃的 `includes` 模糊匹配，精确相等避免了"半导体设备"误匹配"半导体"的问题。
- **未来路径**：basic 采集接入 AKShare `stock_individual_info_em` 行业字段后，所有 Stock 将填充 `industryCode`，回退匹配将自然失效，全部走主匹配路径。

#### 2.5.5 两套 score 分制澄清

| score | 分制 | 含义 | 产出环节 | 消费方 |
|:---|:---|:---|:---|:---|
| `RotationSectorScore.total` | 0-100 | 板块强度分（五因子加权）| 检索层（判定"是否热门"）| `isHotSector` 选 TOP N |
| `HotSectorScore.score` | 0-5 | 热门板块策略评分（五维）| 评分层（判定"跟进动作"）| `HotSectorWidget` 展示 |

- **检索层**用 `total` 选出 TOP N 板块（哪些板块热门）
- **评分层**对已入选板块用 `HotSectorScore` 决定动作（立即跟进/试探/不追）
- 两者**不可混用**，分制不同、用途不同、产出环节不同。

#### 2.5.6 HotSector 接口字段映射

`hotSectorService.HotSector` 作为检索层对外契约（消费方 `strategyEngine` / `HotSectorWidget` 不破坏），字段由 `RotationSectorScore` 映射：

| HotSector 字段 | RotationSectorScore 来源 | 说明 |
|:---|:---|:---|
| `code` | `sectorCode` | 申万二级代码（匹配键）|
| `name` | `sectorName` | 板块中文名（展示）|
| `score` | `total` | 板块强度分（0-100）|
| `trend` | 由 `total` 派生 | `≥70` → `up` / `≤30` → `down` / 否则 `neutral` |
| `factors.momentum` | `f1Jingqi` + `f5Nengliang` 加权 | 景气+量能 |
| `factors.fundFlow` | `f2Zijin` | 资金因子 |
| `factors.valuation` | `f3Guzhi` | 估值因子 |
| `factors.sentiment` | `f1Jingqi` | 景气含情绪 |
| `stocks` | `poolStocks` | 相关股票池标的 |

#### 2.5.7 改造影响清单

| 层 | 文件 | 变更 |
|:---|:---|:---|
| Python 后端 | `python/data_service/collect_endpoints.py` | 新增 `/api/collect/sectors`，接 AKShare 申万板块接口，计算五因子 |
| Python 后端 | `collect_basic` | 补充返回 `industry_code`（申万二级），填充 `Stock.industryCode` |
| 采集层 | `src/services/data-collector/collectors/LiveCollector.ts` | `collectHotSectors` 改调 `/api/collect/sectors`，返回 `RotationSectorScore` |
| 持久化 | `MarketDataAdapter` + 采集调度 | 采集后 `rotationScoreStore.save` 持久化 |
| 检索层 | `src/services/input/hotSectorService.ts` | `getHotSectors` 改读 `rotationScoreStore`，按 `total` DESC 取 TOP N |
| 匹配层 | `src/services/trading/strategyEngine.ts` | `isHotSector` 两段式：`industryCode === code` 主匹配 + `sector === name` 精确回退 |
| 数据字典 | `docs/reference/v9核心数据字典与类型定义(整合版).md` | 补充 `total` 与 `HotSectorScore.score` 分制说明 |

---

## 3. 三梯队位置

热门赛道策略属于 **第二梯队（中等优先级）**，与价值洼地策略并列。

```
第一梯队：core-scarce
第二梯队：hot-momentum + value-bargain  ← 本策略
第三梯队：watchlist
```

### 梯队关系

- hot-momentum 在 core-scarce 判定之后执行，未被 core-scarce 匹配的标的才进入热门赛道判定。
- hot-momentum 与 value-bargain 并列第二梯队，但 hot-momentum 判定优先级高于 value-bargain。
- 若标的动量衰减或板块热度下降，可降级为 watchlist。

---

## 4. 与双策略评分的关系

热门赛道策略在四分类选股层完成分类后，**可进一步接受双策略评分增强**：

### 4.1 HotSectorScore 五维评分

| 维度 | 权重 | 核心指标 | 数据来源 |
|:---|:---|:---|:---|
| **动量强度** | 35% | 板块强度 Score、涨跌幅排名、成交量放大、资金连续流入、相对强弱 RS | `daily_quotes`（MA20/MA60、涨幅）、sectorStrength |
| **情绪热度** | 25% | 舆情热度排名、散户情绪、龙虎榜机构买入、涨停板数量 | 行业评分、新闻热度、资金净流入 |
| **技术突破** | 20% | 突破形态、MACD 信号、RSI 状态、均线系统 | RSI、MACD、成交量突破 |
| **估值风险** | 15% | PE 相对水平、PB 历史分位、市值流动性、股息率 | PE/PB 分位、PEG |
| **大盘环境** | 5% | 大盘趋势、系统性风险 | 指数数据 |

### 4.2 评分与分类的关系

```
四分类结果：hot-momentum
  → 双策略评分：HotSectorAnalyzer 计算 HotSectorScore
  → 输出：HotSectorScore（含五维得分 + action 建议）
  → 消费：HotSectorWidget 驾驶舱展示
```

---

## 5. 止盈止损差异化配置

| 配置项 | 值 | 配置位置 | 说明 |
|--------|-----|----------|------|
| 止损线 | **-8%** | `dualStrategyRules.ts` (`hotSectorStopLossPct`) | 硬性止损，不补仓 |
| 止盈线 | **+15%** | `dualStrategyRules.ts` (`hotSectorTakeProfitPct`) | 触发后卖出 50% 仓位 |
| 止盈卖出比例 | **50%** | `dualStrategyRules.ts` (`hotSectorTakeProfitSellRatio`) | 减半仓锁定利润 |
| 持有期 | 3-15 天（平均 7 天） | -- | 快进快出，不恋战 |
| 仓位上限 | 5%-8%（跟进）/ 2%-3%（试探） | -- | 单票仓位 |
| 补仓策略 | 不补仓 | -- | 止损即出，不逆势加仓 |

### 止损执行规则

- 跌破 -8% 立即执行止损，不设缓冲。
- 不因"反弹预期"推迟止损。
- 止损后 24 小时冷却期内禁止同标的再次买入。

---

## 6. 策略执行流程

```
1. 输入标的列表（非 core-scarce）
2. 获取标的综合评分、sector、动量（priceToMA20）
3. 获取热门板块 TOP5 列表
4. 判定：综合分 >= 3.0 AND sector 热门 AND 动量 >= 5%
   → 是：分类为 hot-momentum
   → 否：进入 value-bargain 判定
5. 双策略评分：HotSectorAnalyzer 计算 HotSectorScore
6. 动作判定：
   - HotSectorScore > 4.0 → 立即跟进（5-8%）
   - 3.5 <= HotSectorScore <= 4.0 → 试探（2-3%）
   - < 3.5 → 不追
7. 驾驶舱 HotSectorWidget 展示评分与建议
```

---

## 7. 代码层映射

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| 四分类引擎 | `src/services/trading/strategyEngine.ts` | `classify()` 中优先级 2 判定 |
| 热门板块分析器 | `src/services/scoring/hotSectorAnalyzer.ts` | 五维评分（动量35%/情绪25%/技术20%/估值15%/大盘5%） |
| 双策略编排引擎 | `src/services/trading/dualStrategyEngine.ts` | 编排分析器并输出结果 |
| 四分类阈值 | `src/config/strategyRules.ts` | 动量/板块/综合分阈值 |
| 双策略阈值 | `src/config/dualStrategyRules.ts` | 评分/动作/止盈止损阈值 |
| 热门板块服务 | `src/services/input/hotSectorService.ts` | 热门板块数据获取 |
| 热门板块 Widget | `src/cockpit/widgets/HotSectorWidget.tsx` | 驾驶舱展示 |

---

## 8. 风险控制

| 风险项 | 应对措施 |
|--------|----------|
| 板块热度快速消退 | 动量阈值（5%）作为筛选器，剔除动量不足的标的 |
| 追高被套 | -8% 硬性止损，不补仓，不扛单 |
| 大盘系统性下跌 | 大盘环境因子占 HotSectorScore 的 5%，大盘走弱时降低评分 |
| 过度交易 | 单日最大交易次数 5 次（风控引擎约束） |

---

## 9. 相关文档

- [选股策略总文档](./stock-selection-strategy.md)
- [价值洼地策略](./value-bargain-strategy.md)
- [ADR-009: 双策略体系](../implementation/adr/2026-06-27-dual-strategy-system.md)
- [架构文档](../architecture/v9-strategy-architecture.md)
- [引擎规格](../05-engine-specs.md)