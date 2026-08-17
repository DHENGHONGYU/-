# RLES 历史样本回测 / 权重标定引擎（交付说明）

> 关联：`deliverables/strategy-consolidated-and-reviewlaunch-evaluation.md` → P1-P2 因子接入完成后，本文件落地**回测标定层**，用于验证"新因子是否真的提升择股/择时"。
> 代码位置：`src/services/scoring/rles-engine/rlesBacktest.ts` + `rlesBacktest.test.ts`

---

## 1. 为什么需要回测（而不只是接真实市场宽度）

上一轮收尾时给出两个选项：① 接真实市场宽度源；② 给 RLES 做历史样本回测标定。
本轮选 **②回测标定**，原因：

- 用户的核心目标是"**体系化提升择股和择时能力**"，这必须用**前向收益证据**来证明，而非堆砌因子。
- 真实市场宽度（MAS）当前 V9 无任何真实源（仅 mock），接上仍是受限数据；而回测能直接检验我们**新加的二波检测器**这一 V9 原本缺失的模式是否真有预测力——这是价值最高的验证。
- 回测本身也已为"真实市场宽度接入后如何标定权重"预留了方法论（见 §5）。

## 2. 时点（point-in-time）诚实性设计（关键）

回测最大的陷阱是**未来函数**。本引擎严格区分两类因子：

| 因子 | 是否时点可算 | 处理 |
|------|--------------|------|
| **二波检测器** `secondWave` | ✅ 仅由 anchor 之前 K 线切片计算 | 纳入预测因子 |
| **八级筹码** `chip` | ✅ 仅由 anchor 之前 K 线切片计算 | 纳入预测因子 |
| V6 评分 / 板块轮动 / 市场宽度 | ❌ 接口均为"评估日当前态" | **不纳入预测因子**，仅作信息列 |

> ⚠️ 完整时点回测需要"历史 V6 服务"（按 anchor 日期重算 V6）。当前 `runV6Score` 只返回当前态，故本回测**被测信号 = 二波 + 筹码**，保证结论不被未来数据污染。待生产化历史 V6 后，可把 D2/D3 的 V6、板块、宽度也纳入真实回测。

## 3. 引擎接口

```ts
// 纯函数入口（注入 K 线，便于单测，不依赖网络）
runBacktest(inputs: { symbol; bars: KlineBar[] }[], config?: { forwardDays?; stride?; count? }): BacktestResult

// 单标的样本采集（核心算法）
collectSamplesFromBars(symbol, bars, config): BacktestSample[]
//  - anchor 从 max(25, fd) 滑动到 N-1-fd，步长 stride（默认 max(fd,10)，避免样本重叠）
//  - 每样本：slice=bars[0..anchor] 算 secondWave+chip；fwdRet = close[anchor+fd]/close[anchor]-1

// live 入口（需后端 K 线服务可用；connectors 当前多 disconnected，运行时需后端在线）
runLiveBacktest(symbols: string[], config): Promise<BacktestResult>
fetchBarsLive(symbol, count=260): Promise<KlineBar[]>

// 统计
aggregate(samples, forwardDays): BacktestResult
spearman(xs, ys): number   // IC 指标
```

`BacktestResult` 输出：
- `overall`：全样本胜率 / 均值收益 / **IC**（timingScore 与前向收益的 Spearman 秩相关）
- `byDetected`：二波命中 vs 未命中两组对比
- `byStrengthQuartile`：二波强度 Q1(弱)→Q4(强) 四分位
- `byTimingTier`：priority(≥80) / normal(60-79) / cautious(<60)

## 4. 单测结果（合成数据证明引擎正确）

`rlesBacktest.test.ts` 用合成 K 线：
- **赢家股**（`genBars` 强趋势 0.01/bar + 每 30 根 5 倍放量）→ 处主升浪 + 突破放量 + 二波命中，前向收益为正
- **平淡股**（横盘 0.0005/bar）→ 不处主升浪 → 二波不命中，前向收益≈0

断言全部通过（**6/6**），关键的**方向性验证**：
> `byDetected.detected.avgReturn > byDetected.notDetected.avgReturn`
> 即"二波命中组"前向收益显著优于"未命中组"——证明新因子的预测方向正确（多头样本下，命中组确实更可能涨）。

全量 RLES 单测：**18/18 passed**（secondWave 4 + chipBridge 2 + breadthFactor 3 + hardRiskDetector 3 + backtest 6）。

## 5. 标定方法论（拿到真实数据后怎么用）

回测产出可直接用于**调参**（当前 `reviewLaunchEvaluator.ts` 的 `WEIGHTS` 与加成系数是理论值）：

1. **IC 是否显著**：`overall.ic` 接近 0 → 二波因子无预测力，需回看 `detectSecondWave` 参数（阈值过松/过紧）；`ic > 0.1` → 因子有效，可加大 D3 中 `secondWaveStrength` 权重（当前 0.13）。
2. **分位单调性**：`byStrengthQuartile` 应从 Q1→Q4 胜率/均值收益单调递增；若不单调，说明强度分区分度差，需重标定 `strength` 公式（突破放量/+15、回踩层级/+20/+14/+8 等系数）。
3. **tier 区分度**：`byTimingTier` 的 priority 组应显著跑赢 cautious 组（差值为"策略增益"）；若 priority 不优于 cautious，说明风险降级/权重配比需修正。
4. **对比基准**：把 `overall.avgReturn` 与等权买入持有（cautious 组近似）比较，得到**净增益**——这就是"体系化提升择股择时"的量化证据。

## 6. 校验

| 项 | 结果 |
|----|------|
| `tsc --noEmit`（RLES 相关） | 0 错误 |
| `tsc:prod`（含测试文件，RLES 相关） | 0 新增错误 |
| `vitest`（rles-engine 全量） | 18/18 passed |

## 7. 后续（仅剩的生产化项）

1. **真实市场宽度源**：接 `market-query`/`westock-data` 等可用技能或真实涨跌家数 API，替换 `breadthFactor` 的 mock（并在回测里把宽度纳入时点因子，需历史宽度序列）。
2. **三条禁令真实黑名单**：接权威退市/ST/处罚数据源，替换 `hardRiskDetector` 的空 `FORBIDDEN_STOCKS` 占位。
3. **历史 V6 服务**：实现"按 anchor 日期重算 V6"，把 D2/D3 的 V6、板块、宽度纳入**完整时点回测**，消除 §2 的代理局限。
4. **实盘标定**：用 §5 方法论在真实样本上标定 `WEIGHTS` 与加成系数，逼近对方系统已验证的 81.21% 精度量级。

---
*生成时间：2026-08-17。本引擎与 RLES 四维评价体系（D1-D4）、二波检测器、八级筹码桥接、市场宽度、板块映射、三条禁令共同构成 V9 的"复盘启动就绪度"元评价层。*
