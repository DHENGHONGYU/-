# 假突破判定逻辑 — 技术文档

> 模块：`src/services/scoring/v6-engine/calculators/l7_l8.ts`
> 函数：`classifyBreakoutStyle()` (L426-L444)
> 版本：v4.6
> 最后更新：2026-08-10

---

## 1. 定义与本质

**假突破** = 高换手率 + 低量比 = 存量对倒诱多

| 维度 | 说明 |
|------|------|
| 现象 | 换手率很高但量比偏低 |
| 本质 | 量价背离 — 无新增资金进场，存量资金左手倒右手 |
| 目的 | 制造放量突破假象，吸引散户跟风后出货 |

### 有效突破 vs 假突破

```
有效突破：换手率与量比同向放大（新增资金进场）
  例：5%换手 × 5.0量比 = 0.25 (L5 爆炸能量) → sniper_breakout

假突破：换手率高但量比低（存量对倒）
  例：16%换手 × 1.0量比 = 0.16 (L5 爆炸能量) → fake_breakout ⚠️
```

---

## 2. 判定优先级（代码实现）

`classifyBreakoutStyle()` 按以下优先级从高到低判断，**假突破排第 3**：

```typescript
// l7_l8.ts L436-L443
if (energy.level >= 4 && tpct >= 5 && v >= 2.5) return 'sniper_breakout'    // 1. 狙击型
if (energy.level >= 3 && tpct >= 3 && v >= 2)    return 'momentum_breakout' // 2. 动量型
if (tpct >= 8 && v < 1.5)                         return 'fake_breakout'    // 3. ⚠️ 假突破
if (tpct < 2 && v >= 5)                           return 'probe_breakout'   // 4. 试探型
if (energy.level >= 3 && tpct >= 2 && tpct < 5 && v >= 1.5) return 'steady_breakout' // 5. 稳健型
if (energy.level >= 2 && tpct < 3 && v >= 1 && v < 2.5)  return 'value_breakout'  // 6. 价值型
if (energy.level === 1)                           return 'breakout_watch'   // 7. 观望型
return 'no_breakout'                                                          // 8. 无特征
```

### 设计要点

- `fake_breakout` 优先级高于 `steady_breakout` / `value_breakout`
- 确保高换手 + 低量比的危险场景**不会被误判为有效突破**
- 狙击型/动量型优先于假突破：因为高量比（≥2.5/≥2）本身排除了量比背离

---

## 3. 核心判定条件

```typescript
// l7_l8.ts L438
if (tpct >= 8 && v < 1.5) return 'fake_breakout'
```

| 参数 | 条件 | 说明 |
|------|------|------|
| `tpct` | `>= 8` | 换手率百分比（小数 × 100） |
| `v` | `< 1.5` | 量比倍数（严格小于，不含 1.5） |

### 关键特性

- **即使能量等级很高**（如 16% × 1.0 = 0.16 → L5 爆炸能量），只要满足上述条件，**一定是假突破**
- 能量高 ≠ 有效突破，**量价背离才是核心判据**
- 仅看换手率 × 量比 = 能量是危险的，必须看量比是否配合

---

## 4. 典型案例验证

### 测试用例（来自 breakout-walkthrough.test.ts）

| 股票 | 换手率 | 量比 | 能量 | 判定 | 交易信号 | 筹码类型 |
|------|-------|------|------|------|---------|---------|
| R1-006.SZ | 8% | 1.0 | L4 激进 | `fake_breakout` | `escape` | `fakeup` |
| BD-010.SZ | 16% | 1.0 | L5 爆炸 | `fake_breakout` | `escape` | `fakeup` |

### 案例分析

**BD-010.SZ（极端假突破案例）**
- 换手率：16%（死亡换手级别）
- 量比：1.0（刚好持平）
- 能量：16% × 1.0 = 0.16 → L5 爆炸能量
- **判定结果：假突破**（tpct=16 ≥ 8，v=1.0 < 1.5）
- 交易信号：`escape`（立即逃离）
- 说明：能量越高、诱多陷阱越危险

---

## 5. 交易纪律

### 信号输出（buildChipFlowSignal）

当触发假突破时，系统生成以下信号：

| 字段 | 值 | 说明 |
|------|------|------|
| `breakoutStyle` | `'fake_breakout'` | 断线交易风格 |
| `tradeSignal.type` | `'escape'` | 交易类型：逃离 |
| `type` | `'fakeup'` | 筹码流类型：对倒陷阱 |
| `opportunityScore` | 1.5 | 机会评分（最低档） |
| `action` | `'先跑，安全第一'` | 操作建议 |

### 操作纪律

- **立即逃离**：不等反弹、不抱侥幸
- **坚决回避**：避免被高换手率诱惑
- **仓位管理**：清仓或极低仓位试探

---

## 6. 边界值测试

### 必须严格遵守的边界

| 场景 | tpct | v | 结果 | 原因 |
|------|------|---|------|------|
| 边界 1 | 8% | 1.5 | **不是**假突破 | v < 1.5 严格小于 |
| 边界 2 | 8% | 1.4 | **是**假突破 | 两个条件均满足 |
| 边界 3 | 7.9% | 1.0 | **不是**假突破 | tpct 不满 8% |
| 边界 4 | 16% | 1.5 | **不是**假突破 | v = 1.5 不满足 < 1.5 |

### 回归验证

调整阈值后必须回归验证上述边界场景，确保：
- 边界值严格性（`>=` vs `>`、`<` vs `<=`）
- 跨场景一致性（不同能量等级下的假突破判定）

---

## 7. 与能量等级的关系

### 能量计算公式

```typescript
// l7_l8.ts L371-L412
const energy = turnover * volumeRatio // 换手率 × 量比

// 能量等级划分
raw >= 0.15  → L5 爆炸能量
raw >= 0.08  → L4 激进能量
raw >= 0.05  → L3 活跃能量
raw >= 0.01  → L2 温和能量
其余         → L1 冷清能量
```

### 交叉验证：高能量 + 假突破

| 场景 | 换手率 | 量比 | 能量 | 风格判定 |
|------|-------|------|------|---------|
| 真突破 | 5% | 5.0 | 0.25 (L5) | `sniper_breakout` ✅ |
| **假突破** | **16%** | **1.0** | **0.16 (L5)** | **`fake_breakout`** ⚠️ |

**关键洞察**：L5 爆炸能量可能同时是假突破，必须用量比验证。

---

## 8. 相关函数索引

| 函数 | 位置 | 说明 |
|------|------|------|
| `classifyBreakoutStyle()` | L426-L444 | 断线交易风格分类（核心判定） |
| `computeTurnoverVolumeEnergy()` | L371-L412 | 能量等级计算 |
| `buildChipFlowSignal()` | L323-L358 | 信号构建（含日志） |
| `detectMainForceChipFlow()` | L463-L743 | 主力筹码变动检测（12 种模式） |

---

## 附录：测试覆盖

测试文件：`src/services/scoring/v6-engine/calculators/breakout-walkthrough.test.ts`

| 测试套件 | 用例数 | 覆盖内容 |
|---------|-------|---------|
| 10 只典型股票穿行测试 | 10 | 8 种风格 × 5 级能量全覆盖 |
| 能量计算直接验证 | 1 | `computeTurnoverVolumeEnergy()` |
| 假突破识别直接验证 | 1 | `classifyBreakoutStyle()` 含边界值 |
| 假突破交易信号验证 | 1 | `tradeSignal.type = escape` |

**测试结果**：全部 13 个用例通过 ✅
