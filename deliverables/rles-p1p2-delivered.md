# RLES 评价体系 P1–P2 因子接入交付说明

> 承接 `strategy-consolidated-and-reviewlaunch-evaluation.md` + `rles-secondwave-delivered.md`
> 本轮把 RLES 四维评分引擎剩余的 4 个预留因子全部接线落地（市场宽度 / 板块映射 / 八级筹码 / 三条禁令）。

## 一、本轮接入的 4 个因子

| 因子 | 引擎字段 | 数据源（真实接口，非编造） | 接入组件 | 权重作用 |
|------|----------|------------------------------|----------|----------|
| **① 市场宽度 MAS breadth** | `marketBreadth` | `MockMarketDataProvider.getMarketSentiment()`（up/down/limitUp/limitDown/totalStocks） | `breadthFactor.ts` | D3 时机成熟度（0.13） |
| **② 股票→板块映射** | `rotationScore` | `getSwIndustry(symbol)` 名称 → `getRotationScores()` 按 swLevel1/2/3 匹配 | `sectorScoreBridge.ts` | D2 板块景气 f1（0.30 子项）/ D3 板块资金 f2（0.20 子项） |
| **③ 八级筹码** | `chip` | `fetchKlineData` → `quotesToQuoteData` → `evaluateChip`（复用已拉 K 线） | `chipBridge.ts` | D4 风险健康度（筹码风险惩罚） |
| **④ 三条禁令** | `hardRisks` | `FORBIDDEN_STOCKS` 黑名单（显式维护扩展点） | `hardRiskDetector.ts` | D4 命中 → ×0.73 风险降级 |

## 二、新增文件（4 服务 + 3 单测）

```
src/services/scoring/rles-engine/
├── breadthFactor.ts            # ① 市场宽度：computeBreadthScore + fetchMarketBreadth
├── breadthFactor.test.ts       #   3 passed
├── sectorScoreBridge.ts        # ② 股票→板块轮动评分（名称匹配，含 5min 缓存）
├── chipBridge.ts               # ③ 八级筹码桥接（复用 K 线）
├── chipBridge.test.ts          #   2 passed
└── hardRiskDetector.ts         # ④ 三条禁令黑名单 + matchForbidden 纯函数
    └── hardRiskDetector.test.ts #   3 passed
```

## 三、修改文件

- **`reviewLaunchEvaluator.ts`**（引擎）
  - **关键修复**：D3 时机成熟度此前已读取 `breadth` 却**未参与公式**（只读不用）。现权重重排：
    `ratingBase*0.42 + sectorFund*0.2 + secondWaveStrength*0.13 + breadth*0.13 + goldenBoost + secondWaveBoost`
    市场宽度（MAS）终于真正进入时机评分。
  - D2（f1Jingqi）、D4（chip.riskLevel）此前已实现，本轮数据接通后生效。

- **`reviewLaunchStore.ts`**（store）
  - 单次拉取日线 K 线（120 根），**二波检测器 + 八级筹码共享**，避免重复请求。
  - `runEvaluation` 内依次接入：市场宽度 / 板块轮动 / 八级筹码 / 三条禁令，任一项失败均**降级中性不阻断**。
  - 新增状态字段：`marketBreadth / rotationScore / chip / hardRisks`，供页面展示。

- **`ReviewLaunchPage.tsx`**（页面）
  - 新增「增强因子明细」卡片：市场宽度(MAS) / 板块景气 f1 / 板块资金 f2 / 筹码风险等级 / 三条禁令标签 + 板块名称路径。

## 四、关键工程决策（写入代码注释，避免后续误改）

1. **V6Score 不含 industryCode** → 板块映射走 `getSwIndustry` 名称匹配轮动 `swLevel1/2/3`（轮动 `sectorCode` 是申万数字代码，无 symbol→数字码表）。
2. **市场宽度无真实源** → 当前接 `MockMarketDataProvider`（cockpit mock）；生产可替换为真实涨跌家数接口，算法 `computeBreadthScore` 不变。
3. **三条禁令黑名单为空占位** → `FORBIDDEN_STOCKS = {}`，是"额外显式禁令"扩展点（V6 的 `allRisks` 已由引擎正则自动降级）。生产应从退市预警/ST 列表/处罚公告每日同步维护。
4. **DailyQuotes 必填 updatedAt** → 构造时补 `updatedAt: Date.now()`。
5. **linter 自动格式化** → 本轮回合中 IDE linter 多次异步改写新文件（补 `updatedAt`、加 `!`、修 `swLevel2` 字段名），已重新校验确认最终态正确。

## 五、验证结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 类型安全（全量） | `npx tsc --noEmit` | ✅ 新增/修改文件 0 错误 |
| 类型安全（生产配置） | `npm run tsc:prod` | ✅ 0 新增错误（含测试文件） |
| 单元测试 | `vitest run rles-engine/` | ✅ 12/12 passed |

> ⚠️ 注意：`npx vitest` 在本环境会触发交互式安装提示卡死，须用 `./node_modules/.bin/vitest` 直接调用。

## 六、RLES 当前完整形态

```
D1 数据就绪度 ──(×conf 置信乘子)
D2 策略适配度 = 0.7·V6归一 + 0.3·板块景气f1          [② 已接]
D3 时机成熟度 = 0.42·评级 + 0.2·板块资金f2 + 0.13·二波 + 0.13·市场宽度 + 加成  [①②③ 已接]
D4 风险健康度 = 100 − (V6风险×12 + 硬风险×25 + 筹码风险)   [③④ 已接]
RLES = (0.25·D2 + 0.40·D3 + 0.35·D4) × conf(D1)
命中硬风险/致命风险 → ×0.73 + 降级一级
分流：≥80 优先 / 60–79 常规 / <60 谨慎（D1<60 强制谨慎）
```

## 七、后续可选项

- **P2 收尾**：板块轮动 `getRotationScores()` 为全量查询，可改为按 `industryCode` 精确查（需补 symbol→申万数字码映射表）。
- **生产化**：市场宽度接真实涨跌家数接口；三条禁令黑名单接权威退市/ST/处罚数据源。
- **RLES 实盘标定**：对方系统有 81.21% 精度验证，V9 的 RLES 目前是理论权重，建议用历史复盘样本做回测标定 `WEIGHTS` 与各加成系数。
