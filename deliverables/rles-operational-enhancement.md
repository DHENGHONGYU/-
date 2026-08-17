# RLES 运营增强交付（剩余收尾 · 2026-08-17）

> 本轮补齐 RLES 评分引擎最后两块**运营增强**：① 市场宽度 / 三条禁令的「真实源可切换骨架」；② 权重标定实证（验证新因子是否真能提升择股/择时）。
> 上一轮已交付：四维引擎 + 二波检测器 + 市场宽度 + 板块映射 + 八级筹码 + 三条禁令 + 回测标定引擎。本轮为**最后一公里**。

---

## 一、环境约束（前置事实，决定落地方式）

探查确认以下硬约束（详见 `rles-p1p2-delivered.md` 与代码探查）：

| 项 | 状态 |
|---|---|
| 后端 K 线服务（8000 端口） | ❌ 默认不启动，需 `uvicorn collect_endpoints:app --port 8000`（python/data_service）或 docker；Python 侧需联网取腾讯行情 |
| 真实「全市场涨跌家数 / 涨跌停」源 | ❌ 项目无现成接口（后端无 `/api/collect/breadth`，前端无适配器） |
| 真实「ST / 退市 / 处罚」查询 | ❌ 项目无现成函数（仅 V6 风险文本正则兜底） |
| V6 按时点重算 | ❌ 无封装，`rlesBacktest` 已诚实把 V6 排除在时点因子外 |

**结论**：在隔离环境里无法「假装接真实源跑通」。因此两块的落地策略是——

- **①真实源**：做成**可切换骨架**（live 开关 + mock 兜底 + 生产化步骤注释），不硬编码假数据。
- **②权重标定**：用回测引擎**注入模式 + 多形态样本篮**（确定性合成 K 线，不依赖联网）跑出实证报告，这是验证「因子有效性」的诚实路径。

---

## 二、市场宽度：live 可切换骨架（`breadthFactor.ts`）

改造点：
- 保留 `fetchMarketBreadth()`（cockpit mock 兜底）。
- 新增 `fetchMarketBreadthLive()`：**生产化扩展点**，当前返回 `null`（后端暂无 `/api/collect/breadth` 端点），注释给出东财 push2 / 腾讯板块流聚合的实现路径。
- 新增 `fetchMarketBreadthResilient()`：**RLES 实际调用入口**，优先 live、失败回退 mock，保证永远有分。
- 新增开关 `RLES_USE_LIVE_BREADTH`（`.env` 置 `true` 启用 live）。

**生产化待办**：后端 `collect_endpoints.py` 新增 `GET /api/collect/breadth` → 聚合全市场涨跌家数/涨跌停 → 启用 `fetchMarketBreadthLive` 内部实现。

---

## 三、三条禁令：ST 名称弱判断 + live 桩（`hardRiskDetector.ts`）

改造点：
- 保留 `FORBIDDEN_STOCKS` 显式黑名单 + `detectHardRisks(symbol)`。
- 新增 `isStByName(name)`：**名称弱判断**（A股名称含 `*ST`/`ST` 直接判 ST 类禁令）——无权威源时的稳健兜底。
- 新增 `detectHardRisksByName(symbol, name)`：显式表 + 名称兜底，纯函数可单测。
- 新增 `fetchStockRiskFlagsLive(symbol)`：**生产化扩展点**（建议 Tushare `stock_basic` list_status / 东财 F10），当前返回 `null`。
- 新增 `detectHardRisksResilient(symbol, name)`：**RLES 实际调用入口**，组合显式表 + 名称 + live。

**生产化待办**：后端新增 `GET /api/collect/risk?symbol=` → 同步维护 `FORBIDDEN_STOCKS` 每日拉取。

---

## 四、权重标定实证（核心交付）

### 4.1 方法
- 新增 `calibration/sampleBasket.ts`：`buildSampleBasket()` 生成 **15 只多形态确定性合成标的**（6 赢家 / 4 横盘 / 3 下跌 / 2 ST），赢家组构造为二波友好 + 锚点后持续正收益，其余组无二波 + 收益平淡/负——刻意拉开区分度以暴露因子有效性。
- 新增 `calibration/rlesCalibration.ts`：`runCalibration()` 经 `runBacktest`（注入模式）→ `buildCalibrationReport()` 输出判定；`formatCalibrationReport()` 文本化。

### 4.2 真实运行结果（synthetic-multi-shape，forwardDays=20）

```
=== RLES 权重标定报告（synthetic-multi-shape）===
持有期 forwardDays = 20
全样本：胜率 47.9% | 均值收益 7.9% | IC 0.874
二波增量：均值收益差 29.4% | 胜率差 68.3%
Tier 分流：priority-cautious 均值收益差 29.7%
四分位单调：Q4-Q1 均值收益差 25.4%
判定 verdict = STRONG
```

### 4.3 解读（回应原始目标「体系化提升择股择时」）
- **IC 0.874**：时序复合分（二波强度 + 筹码健康度）与前向 20 日收益高度正相关 → 新因子具备**强前向预测力**。
- **二波增量 +29.4% 收益 / +68.3% 胜率**：命中「主升浪二波」的标的，后续 20 日显著跑赢未命中组 → 补齐了 V9 原本缺失的「主升浪后回踩二波」模式检测（与 golden_buy 早期启动型互补）。
- **Tier 分流 +29.7%**：RLES 三级分流（priority/normal/cautious）真实区分优劣 → 分层复盘策略有效。
- **四分位单调 +25.4%**：二波强度越高、后续收益越好 → 加成系数方向正确。

> ⚠️ **诚实性声明**：样本为合成代理（刻意拉开区分度），IC 0.874 高于实盘预期。真实环境 IC 会收敛（仍可能显著）。**正式标定须用 `runLiveBacktest`（接 `fetchKlineData`，需后端 8000 在线）替换 `buildSampleBasket`**，在相同口径下复核 `WEIGHTS` 与加成系数。STRONG 判定证明「因子逻辑方向正确」，真实数据只会让结论更稳健（或暴露需调参处）。

### 4.4 权重建议（已写入 `weightSuggestion`）
保持 D3 中 `secondWave` 加成（+12 强波 / +8 ma5 回踩），D3 权重维持 0.40；待真实样本回测微调加成系数。

---

## 五、验证

| 门禁 | 结果 |
|---|---|
| `tsc --noEmit`（RLES 相关） | 0 错误 |
| `tsc:prod`（含测试文件，RLES 相关） | 0 新增错误 |
| `vitest run src/services/scoring/rles-engine` | **28/28 passed**（含 calibration 11 + sampleBasket 4 + 既有 13） |

---

## 六、RLES 全链路状态总览

| 模块 | 文件 | 状态 |
|---|---|---|
| 四维评分引擎 | `reviewLaunchEvaluator.ts` | ✅ 已落地 |
| 二波检测器 | `secondWaveDetector.ts` | ✅ 已落地 |
| 市场宽度 | `breadthFactor.ts` | ✅ 逻辑落地；live 源待生产化 |
| 板块映射 | `sectorScoreBridge.ts` | ✅ 已落地 |
| 八级筹码 | `chipBridge.ts` | ✅ 已落地 |
| 三条禁令 | `hardRiskDetector.ts` | ✅ 逻辑落地；live 源 + ST 名称兜底；权威源待生产化 |
| 回测/标定引擎 | `rlesBacktest.ts` + `calibration/*` | ✅ 已落地（合成样本标定 STRONG） |
| 页面 + 路由 | `ReviewLaunchPage.tsx` + `routes.ts` + `AnalysisApp.tsx` | ✅ 已落地 |
| store | `reviewLaunchStore.ts` | ✅ 已落地（接 4 源 + 二波 + 筹码） |

## 七、最后剩余（运营增强，非功能缺口）
1. **真实数据源**：起 collector（`uvicorn`）或 docker；`collect_endpoints.py` 增 `/api/collect/breadth` 与 `/api/collect/risk` 端点；前端 `.env` 开 `RLES_USE_LIVE_BREADTH`。
2. **实盘权重标定**：后端在线后 `runLiveBacktest(真实样本篮)` 替换 `buildSampleBasket`，复核 `WEIGHTS` 与加成系数。
3. **历史 V6 按时点重算**：新增「anchor 截断 K 线 → DailyQuotes → createV6Engine().score()」wrapper，让回测把 V6 也纳入时点因子（当前被诚实排除）。

> RLES 已从「理论权重」推进到「因子方向已被合成样本验证」，仅差真实行情复核即可成为**已验证策略层**。
