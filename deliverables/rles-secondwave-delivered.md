# RLES · 主升浪二波检测器（secondWaveDetector）落地交付

> 来源：deliverables/strategy-consolidated-and-reviewlaunch-evaluation.md 逆向"分级回踩 v3.2"五步法
> 前序：rles-implementation-delivered.md（RLES 骨架）
> 日期：2026-08-16

## 本次交付内容

激活 RLES 引擎 D3「时机成熟度」里预留的二波因子，补齐 V9 相对外部策略**真正缺失的模式检测器**
（golden_buy 偏向"低位价涨=早期启动型"，而对方是"主升浪后回踩二波型"）。

### 1. 新增 `src/services/scoring/rles-engine/secondWaveDetector.ts`
纯函数 `detectSecondWave(bars: KlineBar[], options?): SecondWaveSignal`，零副作用、可单测。

**五步法 → 算法映射**
| 逆向步骤 | 实现 |
|---|---|
| ① 主升浪识别 | `uptrendPct60>0.5`（默认）或 `uptrendPct20>0.3` |
| ② 突破放量 5 倍 | 量比 = 当日量 / 前一日量比均线(MA5)；`maxVolumeRatio≥5` 记 +15，≥3 记 +6 |
| ③ 分级回踩 | 峰值回撤 3%~35% 判定 hadPullback；当前价贴近 MA5/10/20（±1.5%）定层级，ma5+20 / ma10+14 / ma20+8 |
| ④ 试盘/二波 | 放量长上影（上影占比≥0.6 且量≥1.5×量比均线）或 突破前高（排除最近 2 根自比）→ strong_wave +12 |
| ⑤ MAS 宽度 | 本检测器不含，由 RLES `marketBreadth` 承接 |

输出：`detected / strength(0-100) / signalType(strong_wave｜pullback｜trial｜none) / pullbackLevel / uptrendPct60/20 / maxVolumeRatio / hasTrialShadow / hasBreakout / maLevels / details[]`。

**防御**：K线<25 根直接降级（返回 detected=false, strength=0）；内部按 date 排序，乱序输入安全。

### 2. 引擎接入 `reviewLaunchEvaluator.ts`
- `RlesInput.secondWaveSignal` 由 `number|null` 升级为富结构 `SecondWaveSignal|null`。
- D3 时机成熟度改为**差异化加成**：命中后 strong_wave +12 / pullback 按回踩层级 +8/+6/+4 / trial +6；强度分作 0.1 权重项。
- 公式现状：`D3 = clamp(ratingBase×0.5 + goldenBoost + sectorFund×0.2 + secondWaveStrength×0.1 + secondWaveBoost)`（ratingBase 仍占主导，二波作增强而非主导，符合"择时增强"定位）。

### 3. Store 接线 `reviewLaunchStore.ts`
`runEvaluation` 中：`runV6Score` 后追加 `fetchKlineData({symbol, daily, qfq, count:120})` → `detectSecondWave(history)` → 写入 `RlesInput.secondWaveSignal` 与 store 状态。K线获取失败**降级为中性**（不阻断评估），仅告警。

### 4. 页面展示 `ReviewLaunchPage.tsx`
新增「主升浪二波形态诊断」卡片：命中/类型/强度 Badge + 60/20日涨幅、最大量比、试盘、突破、MA5/10/20 + 归因明细列表。

### 5. 单测 `secondWaveDetector.test.ts`（4 passed）
主升浪+放量+长上影→strong_wave / 横盘无量→none / K线不足→安全降级 / 乱序日期→排序后正确。

## 验证结果
- `npx tsc --noEmit`（过滤 secondWave/reviewLaunch）：**0 错误**
- `npm run tsc:prod`（过滤）：**0 新增错误**
- `vitest run secondWaveDetector.test.ts`：**4/4 passed**

## 可调参数（默认值）
`uptrendPct60=0.5, uptrendPct20=0.3, breakoutVolRatio=5, volumeWindow=5, lookback=60, trialShadowRatio=0.6, trialVolMultiple=1.5`

## 后续建议（按价值）
1. **P1 breadthFactor（MAS 市场宽度）** → 接入 `marketBreadth`，激活 D3 宽度加分（对方实盘系统核心广度因子，V9 仅有板块景气/风格，缺干净 breadth 指标）。
2. **P2 股票→板块映射 + rotationScore** → 激活 D2 板块景气（当前中性 50）、D3 板块资金 F2。
3. **P2 evaluateChip（八级筹码）** → 激活 D4 筹码风险（PAS/BIAS/PRO 区分吸筹/派发，支撑"大盘放量=派发"语义）。
4. **P2 三条禁令** → 写入 `hardRisks`，触发风险降级 ×0.73。

> 注：secondWaveDetector 与 golden_buy 是互补双模（早期启动 vs 主升浪二波），后续可在 D3 做"双模 OR"融合评分。
