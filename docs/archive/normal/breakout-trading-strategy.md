---
doc_id: V9-DOC-EXP-956
title: 断线交易策略（breakout-trading）
version: v1.1.0
last_updated: 2026-08-10
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v1.1.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-10
---

# 断线交易策略（breakout-trading）

> **Status**: Active
> **Version**: v1.1.0（v4.7 资金流向二次确认 + 实时预警系统）
> **Last Updated**: 2026-08-10
>
> 本文档定义 V9 的断线交易策略（breakout-trading），属于技术面分析模块（L8 技术筹码层）。该策略基于换手率 × 量比 的能量强度判断趋势延续或反转，识别 8 种断线交易风格并给出对应的交易纪律。
> v1.1 新增：v4.7 资金流向二次确认（降低假突破误报率）+ FakeBreakoutAlertPush 实时预警系统。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略定义

断线交易策略（breakout-trading）是 V9 技术面分析体系中的核心策略，基于**换手率 × 量比**的协同能量判断，识别 8 种不同的突破风格并给出对应的交易纪律。

### 核心理念

- **能量驱动**：换手率 × 量比 = 能量值，能量等级决定交易仓位与止盈止损
- **风格分类**：8 种断线风格对应不同的市场状态与操作策略
- **风险优先**：假突破（fake_breakout）优先级高于所有有效突破类型
- **资金确认**：v4.7 新增资金流向二次确认，主力净流入时降级假突破，降低误报率
- **实时预警**：FakeBreakoutAlertPush 监控自选列表，触发假突破时自动发出 critical 预警
- **纪律严明**：每种风格有明确的交易信号类型和操作纪律

### 与 L1-L4 基本面层的关系

| 层级 | 分析维度 | 与断线策略的关系 |
|------|---------|-----------------|
| L-1 行业评分 | 行业景气度 | 行业高分可提升断线的胜率预期 |
| L0 宏观扫描 | STEEP 因素 | 政策/技术环境影响断线持续性 |
| L1 护城河 | 竞争优势 | 有护城河的标的突破更可靠 |
| L2 竞品格局 | 行业地位 | 龙头标的突破引领性更强 |
| L3 财务/估值 | 基本面质量 | 高增长+低估值的突破风险更低 |
| L4 情景推演 | 未来目标价 | 与断线目标价交叉验证 |

**设计原则**：L1-L4 基本面分析与 L8 技术分析**完全独立**，互不干扰。综合评分通过加权聚合实现，不存在逻辑冲突。

---

## 2. 核心指标体系

### 2.1 能量计算

```
能量 = 20日均换手率(小数) × 量比

示例：
  5%换手 × 5.0量比 = 0.25 → L5 爆炸能量
  3%换手 × 2.5量比 = 0.075 → L3 活跃能量
  16%换手 × 1.0量比 = 0.16 → L5 爆炸能量（但可能是假突破！）
```

### 2.2 能量等级划分

| 等级 | 名称 | 阈值 | 建议仓位 | 止盈 | 止损 |
|------|------|------|---------|------|------|
| L5 | 爆炸能量 | raw ≥ 0.15 | 70% | 25% | 10% |
| L4 | 激进能量 | raw ≥ 0.08 | 50% | 18% | 8% |
| L3 | 活跃能量 | raw ≥ 0.05 | 35% | 12% | 6% |
| L2 | 温和能量 | raw ≥ 0.01 | 20% | 8% | 5% |
| L1 | 冷清能量 | raw < 0.01 | 观望 | - | - |

### 2.3 断线交易风格（8 种）

| 优先级 | 风格 | 代码 | 判定条件 | 交易信号 |
|--------|------|------|---------|---------|
| 1 | 狙击型 | `sniper_breakout` | L5+ & tpct≥5% & v≥2.5 | `golden_buy` |
| 2 | 动量型 | `momentum_breakout` | L3+ & tpct≥3% & v≥2 | `golden_buy` |
| **3** | **假突破** | **`fake_breakout`** | **tpct≥8% & v<1.5** | **`escape`** |
| 4 | 试探型 | `probe_breakout` | tpct<2% & v≥5 | `follow_buy` |
| 5 | 稳健型 | `steady_breakout` | L3+ & tpct 2-5% & v≥1.5 | `hold` |
| 6 | 价值型 | `value_breakout` | L2 & tpct<3% & v 1-2.5 | `hold` |
| 7 | 观望型 | `breakout_watch` | L1 冷清能量 | `wait` |
| 8 | 无特征 | `no_breakout` | 其他情况 | `wait` |

---

## 3. 假突破判定逻辑（核心风险控制）

### 3.1 假突破定义

**假突破 = 高换手率 + 低量比 = 存量对倒诱多**

```
判定条件（AND 关系）：
  1. 20日均换手率百分比 tpct ≥ 8%
  2. 量比 v < 1.5（严格小于，不含 1.5）
```

### 3.2 判定优先级

假突破在 8 种风格中排第 3 位，**优先于稳健型和价值型**：

```
优先级链路：
  狙击型(L5+/tpct≥5/v≥2.5) → 动量型(L3+/tpct≥3/v≥2) → 假突破(tpct≥8/v<1.5)
                                                        ↓
                                                  试探型(tpct<2/v≥5) → 稳健型 → 价值型
```

**设计意图**：确保高换手+低量比的危险场景不会被误判为有效突破。即使能量等级很高（如 16%×1=0.16=L5），只要量比不配合，一定是假突破。

### 3.3 核心代码实现

```typescript
// l7_l8.ts — v4.7 含资金流向二次确认
export function classifyBreakoutStyle(
  turnover: number | undefined,
  volumeRatio: number | undefined,
  energy: TurnoverVolumeEnergy,
  fundFlow?: FundFlowContext,  // ★ v4.7 新增
): BreakoutTradeStyle {
  const t = turnover ?? 0.001
  const v = volumeRatio ?? 0.5
  const tpct = t * 100

  if (energy.level >= 4 && tpct >= 5 && v >= 2.5) return 'sniper_breakout'
  if (energy.level >= 3 && tpct >= 3 && v >= 2) return 'momentum_breakout'

  // ★ v4.7 假突破判定：技术条件 + 资金流向二次确认
  if (tpct >= 8 && v < 1.5) {
    // 主力净流入 → 降级为 no_breakout（降低误报率）
    if (fundFlow?.mainForceNet !== undefined && fundFlow.mainForceNet > 0) {
      return 'no_breakout'
    }
    return 'fake_breakout'
  }

  if (tpct < 2 && v >= 5) return 'probe_breakout'
  if (energy.level >= 3 && tpct >= 2 && tpct < 5 && v >= 1.5) return 'steady_breakout'
  if (energy.level >= 2 && tpct < 3 && v >= 1 && v < 2.5) return 'value_breakout'
  if (energy.level === 1) return 'breakout_watch'
  return 'no_breakout'
}
```

### 3.4 交易纪律

当触发假突破时，系统输出以下交易信号：

| 字段 | 值 | 说明 |
|------|------|------|
| `breakoutStyle` | `'fake_breakout'` | 断线风格 |
| `tradeSignal.type` | `'escape'` | 立即逃离 |
| `type` | `'fakeup'` | 对倒陷阱 |
| `opportunityScore` | 1.5/5 | 最低档 |
| `action` | `'先跑，安全第一'` | 操作建议 |

### 3.5 边界值说明

| 场景 | tpct | v | 结果 | 原因 |
|------|------|---|------|------|
| 边界 1 | 8% | 1.5 | ❌ 不是假突破 | v < 1.5 严格小于 |
| 边界 2 | 8% | 1.4 | ✅ 是假突破 | 两个条件均满足 |
| 边界 3 | 7.9% | 1.0 | ❌ 不是假突破 | tpct 不满 8% |
| 边界 4 | 16% | 1.5 | ❌ 不是假突破 | v = 1.5 不满足 < 1.5 |

### 3.6 v4.7 资金流向二次确认

基于复盘报告发现"L5 假突破案例全部伴随主力净流出"，v4.7 新增资金流向二次确认机制：

| 条件 | 结果 | 说明 |
|------|------|------|
| tpct≥8% & v<1.5 & 主力净流出 | `fake_breakout` | 确认假突破（真阳性） |
| tpct≥8% & v<1.5 & 主力净流入 | `no_breakout` | 降级（降低误报率） |
| tpct≥8% & v<1.5 & 无资金数据 | `fake_breakout` | 向后兼容（保持原有行为） |

**FundFlowContext 数据来源**：

```typescript
// 从 QuoteData 提取
const fundFlow: FundFlowContext = {
  mainForceNet: safeLast(q.mainForceFlow),       // 主力资金最新净流入
  northboundNet: last - prev(q.northboundHoldings), // 北向资金净流入
  marginChange: last - prev(q.marginBalance),      // 融资余额变动
}
```

**误报率降低验证**：

| 股票 | 换手率 | 量比 | 主力净流入 | v4.6 判定 | v4.7 判定 |
|------|-------|------|---------|----------|----------|
| 恒瑞医药 | 9.5% | 1.2 | +3.2亿 | fake_breakout ⚠️ | no_breakout ✅ |
| 牧原股份 | 11% | 0.9 | +1.8亿 | fake_breakout ⚠️ | no_breakout ✅ |

---

## 4. 与 L1-L4 基本面层的冲突检查

### 4.1 各层独立原则

V6 评分引擎采用**分层独立计算**架构：

```
LayerInput（统一输入）
    │
    ├─→ L-1 行业评分 → Score_L-1
    ├─→ L0 宏观扫描  → Score_L0
    ├─→ L1 护城河   → Score_L1
    ├─→ L2 竞品格局  → Score_L2
    ├─→ L3 财务/估值 → Score_L3
    ├─→ L4 情景推演  → Score_L4
    ├─→ L5 T-M矩阵  → Score_L5
    ├─→ L6 Hype周期 → Score_L6
    ├─→ L7 第二曲线  → Score_L7
    └─→ L8 技术筹码  → Score_L8 ← 假突破在此层
    │
    └─→ 加权聚合 → CompositeScore
```

### 4.2 冲突分析结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| L1 护城河 × 假突破 | ✅ 无冲突 | L1 基于行业定性分析，L8 基于量价技术分析 |
| L2 竞品 × 假突破 | ✅ 无冲突 | L2 基于同行对比，L8 基于个股技术形态 |
| L3 财务 × 假突破 | ✅ 无冲突 | L3 基于财务数据，L8 基于交易数据 |
| L4 情景 × 假突破 | ✅ 无冲突 | L4 基于未来情景推演，L8 基于当前技术信号 |
| 层间数据依赖 | ✅ 无冲突 | 各层独立计算，仅共享 LayerInput |
| 风险警告叠加 | ✅ 无冲突 | 独立产生风险，聚合时合并展示 |
| L1-L4 × v4.7 资金确认 | ✅ 无冲突 | 资金流向数据仅用于 L8 内部假突破判定，不改变 L1-L4 计算逻辑 |
| L1-L4 × 实时预警 | ✅ 无冲突 | 预警系统独立于评分引擎，仅监控行情数据不干预评分流程 |
| 预警 × 评分聚合 | ✅ 无冲突 | 预警通过 eventBus 异步广播，不阻塞或修改 V6 引擎评分流程 |

### 4.3 交叉验证场景

| 场景 | L1-L4 基本面 | L8 技术面 | 综合结果 |
|------|-------------|----------|---------|
| 好公司假突破 | 高分（龙头、高增长） | fake_breakout（escape） | ⚠️ 高分公司技术面恶化，谨慎 |
| 差公司真突破 | 低分（基本面差） | sniper_breakout（golden_buy） | 📊 短期技术突破，长期存疑 |
| 好公司真突破 | 高分 + 有效突破 | 综合高信心买入 | ✅ 双击验证 |
| 差公司假突破 | 低分 + 假突破 | 坚决回避 | ⛔ 双向否决 |

---

## 5. 代码索引

| 文件 | 核心函数 | 说明 |
|------|---------|------|
| `l7_l8.ts` | `classifyBreakoutStyle()` | 断线交易风格分类（v4.7 含 fundFlow 参数） |
| `l7_l8.ts` | `computeTurnoverVolumeEnergy()` | 能量等级计算（L371-L412） |
| `l7_l8.ts` | `buildChipFlowSignal()` | 信号构建（v4.7 传入 fundFlow） |
| `l7_l8.ts` | `detectMainForceChipFlow()` | 主力筹码变动检测（v4.7 提取资金流向） |
| `fakeBreakoutAlert.ts` | `FakeBreakoutAlertPush` | 实时假突破预警器（v1.1 新增） |
| `engine.ts` | `V6ScoreEngine.calculateAll()` | 引擎主流程（L171-L214） |
| `engine.ts` | `V6ScoreEngine.aggregate()` | 聚合计算（L217-L263） |
| `thresholds.ts` | `L8_FAKE_BREAKOUT_*` | 假突破资金流向确认阈值（v4.7 新增） |

---

## 6. 实时预警系统（v1.1 新增）

### 6.1 架构

```
行情推送                          预警系统                          通知
─────────                    ──────────────                    ────────
MARKET_QUOTE_UPDATE  ──→  FakeBreakoutAlertPush  ──→  CHIP_ANOMALY_DETECTED
     eventBus              ├─ 检查监控列表                  eventBus
                           ├─ 检查技术条件
                           │  (tpct≥8% & v<1.5)
                           ├─ 计算能量等级
                           ├─ v4.7 资金流向二次确认
                           │  (mainForceNet > 0 → 降级)
                           ├─ 确定 alert level
                           │  (L5+流出→critical)
                           └─ emit alert
```

### 6.2 预警级别

| 级别 | 条件 | 说明 |
|------|------|------|
| 🔴 critical | L5 能量 + 假突破 + 主力净流出 | 最高危险，立即逃离 |
| 🟠 warning | L4 能量 + 假突破 | 高风险，减仓防范 |
| ℹ️ info | L3 及以下 + 假突破 | 提示性预警 |
| ❌ 不预警 | 主力净流入（v4.7 降级） | 误报率降低 |

### 6.3 监控列表管理

```typescript
// 添加监控股票
alertPush.addWatchSymbols([
  { symbol: 'SH-600519', name: '贵州茅台' },
  { symbol: 'SZ-000858', name: '五粮液' },
  // ...
])

// 启动预警
alertPush.start()

// 查询预警
alertPush.getCriticalAlerts()  // 获取严重预警
alertPush.getAlerts('SH-600519')  // 获取指定股票预警
```

### 6.4 与评分引擎的关系

预警系统与 V6 评分引擎**完全独立**：

| 维度 | V6 评分引擎 | 预警系统 |
|------|-----------|---------|
| 触发方式 | 定时/手动批量评分 | 实时行情推送 |
| 数据源 | LayerInput（全量数据） | 行情更新事件 |
| 输出 | CompositeScore（综合评分） | FakeBreakoutAlert（预警通知） |
| 通信 | 同步调用 | eventBus 异步广播 |
| 独立性 | 不依赖预警系统 | 不依赖评分引擎 |

**无冲突保证**：预警系统仅监控行情数据并调用 `classifyBreakoutStyle()` 纯函数，不修改 V6 引擎的任何状态或评分流程。

---

## 附录：测试覆盖

| 测试文件 | 用例数 | 覆盖内容 |
|---------|-------|---------|
| `breakout-walkthrough.test.ts` | 16 | 10 只典型股票 + 能量计算 + 假突破边界 + v4.7 资金确认 |
| `daily-fake-breakout-scan.test.ts` | 5 | 10 只股票扫描 + L5 专项 + 边界 + 交叉验证 + 误报降低 |
| `fakeBreakoutAlert.test.ts` | 6 | 监控列表管理 + 预警触发 + 对照验证 + 移除监控 |
| `fakeBreakoutAlert-realtime.test.ts` | 6 | 逐笔推送 + 批量推送 + 对照 + 字段完整性 + 完整场景 + 边界 |
| `l7_l8.test.ts` | 20+ | L7 第二曲线 + L8 筹码评估 |

**测试结果**：全部通过 ✅（总计 53+ 测试用例）

---

> **文档结论**：断线交易策略的假突破检测逻辑（含 v4.7 资金流向二次确认）和实时预警系统（FakeBreakoutAlertPush）与 L1-L4 基本面分析层**无任何冲突**。各层独立计算、加权聚合的架构确保了技术信号与基本面信号的正确结合。预警系统通过 eventBus 异步广播，不干预 V6 评分引擎流程。假突破的高优先级设计 + 资金流向二次确认保证了风险控制的有效性和低误报率。
