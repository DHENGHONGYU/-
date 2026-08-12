---
title: 第四次工业革命稀缺核心资源 — 交易策略解析与 V9 采用方案
version: v0.9.0-strategy-review
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v0.9.0-strategy-review
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-06-24
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
# 第四次工业革命稀缺核心资源 — 交易策略解析与 V9 采用方案

> **Status**: Accepted / Phase 1 Implemented  
> **Version**: v0.9.0-strategy-review  
> **Last Updated**: 2026-06-24
>
> 本文档解析 `D:/v6-pro-cockpit` 中围绕"第四次工业革命稀缺核心资源"的交易策略，结合 A 股市场公开研究资料，提出在 V9 中采用该策略的落地方案。  
> 任何代码落地前须先通过 ADR 评审（见 `docs/explanation/implementation/adr/2026-06-24-adopt-v6-core-resource-trading-strategy.md`）。

---

## 1. 策略来源与定位

### 1.1 来源

- **原始实现**：`D:/v6-pro-cockpit`
- **核心文件**：
  - `src/data/v6StrategyEngine.ts` — 策略引擎主实现
  - `src/config/strategyRules.ts` — 建仓/止盈/T+0/仓位规则
  - `src/config/weights.ts` / `src/config/thresholds.ts` — 评分权重与阈值
  - `src/agents/trading/TradingOrchestrator.ts` — 交易编排器
  - `src/agents/trading/paperTrading.ts` — 模拟盘引擎
  - `src/data/sectorData.ts` / `src/data/sectorSkillData.ts` — 行业/主题评分
  - `src/components/trading/PortfolioManager.tsx` — 组合管理 UI

### 1.2 策略目标

以**第四次工业革命稀缺核心资源**为主题，构建一个**长期核心仓 + 中期战术仓**的持仓组合：

- **核心稀缺仓**：8 只稀缺资源龙头，占总资金 40%，持有周期 2–3 年。
- **价值洼地藏**：估值分高但综合分中等的逆向标的。
- **热门追涨仓**：板块轮动 TOP5 + 筹码集中度上升的短线标的。

本文重点聚焦**核心稀缺仓**的解析与 V9 采用。

---

## 2. "第四次工业革命稀缺核心资源"定义

### 2.1 产业链稀缺要素

| 产业方向 | 稀缺核心资源 | 关键说明 |
|----------|-------------|----------|
| AI 与大模型 | 智能算力、高质量数据、算法人才、电力/温控 | 大模型训练/推理对算力呈指数级需求，算力成为核心制约[^1][^2] |
| 半导体 | 先进制程产能、GPU/CPU/ASIC、光刻机及零部件、光刻胶、电子特气、HBM/先进封装 | 高端 GPU 与 CoWoS 产能是 AI 芯片主要瓶颈[^4][^7] |
| 新能源/新材料 | 锂、钴、镍、稀土永磁、铜、铝、镓、锗、铟 | 电动车、储能、AI 算力拉动能源金属需求[^5][^6] |
| 先进制造/机器人 | 高端数控机床、工业软件、减速器、伺服电机、稀土磁材、PEEK | 机器人与汽车/航空对精密零部件需求旺盛[^19] |
| 量子计算 | 超导材料、光量子芯片、稀释制冷机、低温测控 | 对上游材料与极端运行环境要求苛刻[^14] |
| 生物科技 | 基因测序仪、生物数据库、CXO/CDMO 产能 | 创新药研发链条关键环节[^15][^20] |

### 2.2 A 股主题映射（资料示例，非推荐）

| 稀缺资源 | A 股细分板块 | 代表性公司/标的（资料示例） |
|----------|-------------|---------------------------|
| 算力芯片/AI 服务器 | GPU/CPU/ASIC/FPGA、AI 服务器、光模块、PCB | 寒武纪、海光信息、景嘉微、龙芯中科、中科曙光、浪潮信息、工业富联、中际旭创、新易盛、沪电股份等[^1][^2][^8] |
| 存储芯片 | DRAM/NAND 模组、主控芯片、内存接口 | 澜起科技、江波龙、佰维存储、国科微[^1] |
| 半导体设备/材料 | 刻蚀、薄膜沉积、光刻胶、大硅片、电子特气 | 北方华创、中微公司、华海清科、沪硅产业、南大光电、张江高科、江丰电子等[^1][^7][^8] |
| 先进封装/HBM | 封测、2.5D/3D 封装、晶圆级封装 | 长电科技、通富微电、华天科技、深科技等[^13] |
| 稀土/能源金属 | 稀土开采/磁材、锂/钴/镍、钨、锗、镓 | 北方稀土、中国稀土、洛阳钼业、紫金矿业、赣锋锂业、天齐锂业、华友钴业、厦门钨业、云南锗业等[^5][^6][^17] |
| 机器人/先进制造 | 工业机器人、减速器、伺服系统 | 汇川技术、埃斯顿、绿的谐波、双环传动等[^19] |
| 量子计算 | 量子通信、量子计算设备 | 国盾量子、神州信息[^14] |
| 生物科技 | 基因测序、CXO/CDMO、创新药 | 华大基因、华大智造、药明康德、康龙化成、昭衍新药等[^15][^20] |

### 2.3 相关 ETF / 主题指数（资料示例）

| 主题 | 代表 ETF（场内代码） | 跟踪指数 |
|------|---------------------|----------|
| 半导体全产业链 | 国联安半导体 ETF（512480）、国泰 CES 半导体芯片 ETF（512760） | 中证全指半导体、中华交易服务半导体芯片指数[^7] |
| 科创板芯片 | 科创芯片 ETF（588200） | 上证科创板芯片指数[^7][^8] |
| 人工智能/AI 算力 | 人工智能 AIETF（515070）、科创人工智能 ETF 华夏（589010） | 中证人工智能主题指数、上证科创板人工智能指数[^8] |
| 新能源车/新能源 | 新能源车 ETF（159806/515030） | 中证新能源汽车指数[^11] |
| 稀土/有色 | 稀土 ETF 嘉实（516150）、有色金属 ETF（159871） | 中证有色金属指数、中证工业有色金属主题指数[^17][^18] |
| 机器人 | 机器人 ETF（562500） | 中证机器人指数[^19] |

---

## 3. v6-pro-cockpit 原策略解析

### 3.1 8 只核心稀缺标的（原策略内置）

| # | 名称 | 代码 | 主题 | 资源类型 | 综合分 | 估值分 | 权重 | 核心稀缺资源 |
|---|------|------|------|---------|--------|--------|------|-------------|
| 1 | 腾讯控股 | 0700.HK | AI 平台+数据资产 | 数据资产 | 4.36 | 4.5 | **8%** | 微信 14 亿用户数据 + 腾讯混元大模型 + 游戏 AI |
| 2 | 北方华创 | 002371.SZ | 半导体设备国产替代 | 半导体设备 | 4.25 | 4.1 | 5% | 半导体设备平台型龙头 + 刻蚀/薄膜/PVD 全覆盖 |
| 3 | 中兴通讯 | 000063.SZ | 5G+算力网络 | 通信网络 | 4.22 | 4.5 | 4% | 5G 基站全球第二 + 算力服务器 + 芯片设计 |
| 4 | 工业富联 | 601138.SH | AI 服务器代工 | AI 算力 | 4.21 | 4.3 | 5% | 英伟达 AI 服务器核心代工厂 + 全球服务器制造龙头 |
| 5 | 中芯国际 | 00981.HK | 半导体代工国产替代 | 半导体代工 | 4.21 | 4.3 | 4% | 大陆唯一先进制程代工 + 国产芯片命脉 |
| 6 | 科大讯飞 | 002230.SZ | AI 语音+大模型 | AI 算法 | 4.21 | 4.5 | 4% | 讯飞星火大模型 + AI 语音绝对龙头 |
| 7 | 中国移动 | 600941.SH | 通信基础设施+数据要素 | 数据资产 | 4.21 | 4.5 | 5% | 9 亿移动用户数据 + 智算中心 + 5G-A 网络 |
| 8 | 海康威视 | 002415.SZ | AI 安防+机器视觉 | 机器视觉 | 4.21 | 4.5 | 5% | 全球安防第一 + AI 视觉算法 + 工业机器人 |

**组合统计**：平均综合分 4.23，平均估值分 4.41，总权重 40%。

### 3.2 评分模型

#### V6 L0-L8 九层漏斗评分（0–5 分制）

| 层级 | 名称 | 权重 | 说明 |
|------|------|------|------|
| L0 | STEEP 宏观扫描 | 10% | 政策/经济/社会/技术/生态 |
| L1 | 护城河分析 | 15% | 品牌/渠道/网络效应/数据资产/转化成本 |
| L2 | 市场/竞品分析 | 10% | TAM/竞争格局/份额/定价权 |
| L3F | 财务分析 | 10% | ROE/成长性/现金流/营运资本 |
| L3V | 估值分析 | 10% | PE/PB/PS/EV/EBITDA/股息 |
| L4 | 情景推演 | 10% | 牛/基/熊三情景概率加权 |
| L5 | T-M 矩阵 | 5% | 技术成熟度 × 市场成熟度 |
| L6 | Hype Cycle | 7% | 市场预期/渗透率/监管/媒体热度 |
| L7 | 第二曲线 | 15% | 多品牌/出海/收购/新品类 |
| L8 | 技术筹码 | 8% | 趋势/支撑/机构持仓/筹码分布 |

#### 评级阈值

| 评级 | 分数阈值 | 中文标签 |
|------|---------|---------|
| 买入 | ≥4.5 | 买入 |
| 增持 | ≥4.0 | 增持 |
| 中性 | ≥3.0 | 中性 |
| 减持 | ≥2.0 | 减持 |
| 卖出 | <2.0 | 卖出 |

### 3.3 选股标准（20 进 13 筛选）

| 规则 ID | 规则名 | 条件 |
|---------|--------|------|
| R1 | 综合分门槛 | 综合分 > 3.6 |
| R2 | 低估值高质补偿 | 不满足（估值分 < 2.5 且 综合分 < 4.0） |
| R3 | 价值洼地估值要求 | 价值洼地型须 估值分 > 4.0 |

筛选结果按综合分降序，取前 13 只。

### 3.4 仓位分配规则

```
POSITION_RULES = {
  totalAllocationPct: 40,   // 核心稀缺总仓位
  singleMaxPct: 8,          // 单只最大占比
  singleMinPct: 4,          // 单只最小占比
  cashReservePct: 15,       // 现金储备
}
```

### 3.5 建仓规则（分步建仓，越跌越买）

| 批次 | 触发条件 | 价格比率 | 本次投入 | 累计仓位 |
|------|---------|---------|---------|---------|
| 首批 | 当前价直接买入 | 1.00 | 25% | 25% |
| 第二批 | 股价下跌 5% | 0.95 | 20% | 45% |
| 第三批 | 股价下跌 8% | 0.92 | 20% | 65% |
| 第四批 | 股价下跌 10% | 0.90 | 20% | 85% |
| 第五批 | 股价下跌 15% | 0.85 | 15% | 100% |

### 3.6 止盈规则（动态止盈，涨 10% 卖 20%）

| 累计涨幅 | 卖出比例 | 剩余仓位 |
|---------|---------|---------|
| 10% | 20% | 80% |
| 20% | 20% | 60% |
| 30% | 20% | 40% |
| 40% | 20% | 20% |

最终保留 20% 底仓。

### 3.7 止损规则

| 类型 | 阈值 | 操作 |
|------|------|------|
| 硬止损 | 下跌 7% | 全仓卖出 |
| 移动止损 | 从最高点回撤 10% | 卖出一半 |
| 时间止损 | 持仓 60 天 | 全仓卖出 |

### 3.8 风控与执行保护

- 买入信号置信度 ≥ 0.6
- V6 综合分 ≥ 3.6
- 必须通过 BacktestGateway（胜率 > 40%，回撤 << 25%，Sharpe > 0.5）
- 单行业上限 30%，单标的上限 15%（组合级）/ 25%（模拟盘）
- 现金储备 10%–15%

---

## 4. V9 当前交易舱现状与差距

### 4.1 当前已实现

| 模块 | 文件 | 状态 |
|------|------|------|
| 交易舱 UI | `src/apps/trading/TradingApp.tsx` | ✅ 单页卡片式界面 |
| 信号生成 | `src/services/trading/signalGenerator.ts` | ✅ 基于 MA/RSI/量比/MACD 的简单技术信号 |
| 仓位计算 | `src/services/trading/positionSizer.ts` | ✅ 半 Kelly 公式，3%–15% 单票仓位 |
| 风控 | `src/services/trading/riskEngine.ts` | ✅ 冷却期、仓位上限、数据新鲜度等 |
| 订单 | `src/services/trading/tradingService.ts` | ✅ 模拟买入/卖出，订单流水 |
| 信号持久化 | `src/services/trading/tradingService.ts` + `dataLayer.signals` | ✅ 刚落地 |

### 4.2 与核心稀缺策略的差距

| 能力维度 | V9 现状 | v6-pro-cockpit | 是否缺失 |
|----------|---------|----------------|----------|
| 主题/行业映射 | `Stock` 无行业/主题字段 | `REV4_STOCKS` 内置 theme/resourceType | ✅ 缺失 |
| 评分驱动选股 | 信号完全基于技术指标，未读评分 | `TradingOrchestrator` 综合评分与策略筛选 | ✅ 缺失 |
| 策略规则引擎 | 无 20 进 13、价值洼地、核心稀缺规则 | `V6StrategyEngine` + `strategyRules.ts` | ✅ 缺失 |
| 分步建仓/金字塔加仓 | `positionSizer` 只算一次目标股数 | 正/倒金字塔加仓计划 | ✅ 缺失 |
| 动态止盈/止损 | 无止盈止损逻辑 | 动态止盈、硬止损/移动止损/时间止损 | ✅ 缺失 |
| 择时引擎 | 简单技术信号 | `TimingAgent` 四维度择时 | ✅ 缺失 |
| 组合级仓位分配 | 单票独立计算 | 主题权重 + 集中度控制 + 再平衡 | ✅ 缺失 |
| 模拟盘资金/成本 | 无手续费、无资金扣减 | 完整账户模型与绩效指标 | ✅ 缺失 |
| 批量下单/自动执行 | 仅支持单票手动买卖 | `generateTradingSignals` + `executeSimulatedTrades` | ✅ 缺失 |
| 主题仓位上限 | 无行业/主题风控 | `IndustryScore.sectorSnapshot.positionPct` | ✅ 缺失 |

---

## 5. V9 采用方案

### 5.1 架构守护者三问自检

| 问题 | 回答 |
|------|------|
| 是否触及调用方向铁律？ | 否。新增模块位于 L3 `services/trading/`，由 L4 `TradingApp` 调用，符合上层调用下层原则。 |
| 是否修改 IndexedDB Schema？ | 是。需在 `Stock` 中增加 `industryCode` / `theme` / `sector` 字段；可能新增 `portfolios` / `portfolioHoldings` Store。必须通过 ADR 评审。 |
| 对应哪个文档？ | 本方案文档 + ADR-008；落地后同步更新 `docs/02-functional-specs.md`、`docs/05-engine-specs.md`、`docs/10-glossary.md`、`docs/08-implementation-plan.md`。 |

### 5.2 落地范围（MVP）

建议分两个阶段落地：

#### 阶段 A：核心稀缺主题持仓组合（短期）

1. **Schema 扩展**
   - `Stock` 增加 `industryCode?: string`、`theme?: string[]`、`sector?: string`。
   - 新增 `Portfolio` / `PortfolioHolding` 类型（可先用内存/Store 持久化）。

2. **主题映射配置**
   - 新建 `src/config/themeRegistry.ts`：定义"第四次工业革命稀缺核心资源"主题及其映射的 `industryCode` / `theme` 关键词。
   - 初始可内置 8 只核心标的的映射，后续支持用户自定义。

3. **评分消费层**
   - 在 `tradingService` 或新建 `src/services/trading/scoringAdapter.ts` 中读取 `v6Scores` / `intelligentScores` / `industryScores`。
   - 把综合分 ≥ 4.0 的 watching 股票纳入核心稀缺候选池。

4. **组合构建器**
   - 新建 `src/services/trading/portfolioBuilder.ts`：
     - 按主题分组
     - 按评分排序
     - 按 `IndustryScore.sectorSnapshot.positionPct` 分配主题仓位
     - 输出多只股票的目标持仓（symbol / targetShares / targetWeight）

5. **交易舱 UI 扩展**
   - 在 `TradingApp` 新增"核心稀缺"页签或面板。
   - 展示主题持仓组合、目标权重、当前权重、偏离度、再平衡建议。

#### 阶段 B：完整策略引擎（中期）

1. **策略规则引擎**
   - 新建 `src/services/trading/strategyEngine.ts`：实现 20 进 13 筛选、价值洼地、热门追涨分类。

2. **建仓/止盈/止损执行**
   - 扩展 `positionSizer.ts`：正/倒金字塔加仓计划。
   - 新建 `src/services/trading/takeProfitEngine.ts`、`stopLossEngine.ts`。

3. **模拟盘引擎增强**
   - 完善 `tradingService` 中订单金额计算：加入手续费、滑点、印花税、资金扣减。
   - 增加账户现金、持仓市值、净值曲线、绩效统计。

4. **自动执行与回测**
   - 新建 `src/services/trading/tradingOrchestrator.ts`：串联评分→策略筛选→信号→仓位→风控→止损止盈→交易建议。
   - 与复盘引擎（ReviewEngine）联动，记录信号-订单血缘。

### 5.3 与 V9 现有能力的复用

| 现有能力 | 复用方式 |
|----------|----------|
| `screeningEngine.ts` | 已支持 candidate→screened→deepDive 晋升，可扩展为 deepDive→watching 的自动晋升 |
| `v6ScoreService.ts` | 直接读取 `V6Score.score` 与 `factors` 作为选股门槛与排序 |
| `intelligentScoreService.ts` | 用 `overallScore` 与 `dimensionScores` 补充个股质量判断 |
| `industryScoreService.ts` | 用 `sectorSnapshot.positionPct` 作为主题仓位上限 |
| `stockpoolService.transitionStock()` | 将核心稀缺候选股从 `deepDive` 推进到 `watching` |
| `tradingService.scanWatchingSignals()` | 在 watching 池上生成买入/卖出/加仓/止盈信号 |
| `riskEngine.ts` | 扩展主题集中度、单行业上限、组合回撤等风控规则 |

### 5.4 需要新增/修改的文件清单

| 类型 | 文件路径 | 说明 |
|------|----------|------|
| 配置 | `src/config/themeRegistry.ts` | 主题-行业-标的映射 |
| 配置 | `src/config/strategyRules.ts` | 建仓/止盈/止损/仓位规则 |
| 服务 | `src/services/trading/scoringAdapter.ts` | 评分消费适配 |
| 服务 | `src/services/trading/portfolioBuilder.ts` | 组合构建 |
| 服务 | `src/services/trading/strategyEngine.ts` | 策略规则引擎 |
| 服务 | `src/services/trading/takeProfitEngine.ts` | 止盈引擎 |
| 服务 | `src/services/trading/stopLossEngine.ts` | 止损引擎 |
| 服务 | `src/services/trading/tradingOrchestrator.ts` | 交易编排器 |
| 服务 | `src/services/trading/paperTradingEngine.ts` | 增强模拟盘 |
| UI | `src/apps/trading/panels/CoreResourcePanel.tsx` | 核心稀缺组合面板 |
| UI | `src/apps/trading/panels/PortfolioRebalancePanel.tsx` | 再平衡面板 |
| 类型 | `src/data/types.ts` | 扩展 Stock / 新增 Portfolio 类型 |
| 数据层 | `src/data/dataLayer.ts` | 新增 portfolioStore |
| 测试 | `tests/portfolioBuilder.test.ts` 等 | 覆盖组合构建、再平衡、风控 |

### 5.5 风险与注意事项

1. **外部参考文档管控**：`D:/v6-pro-cockpit` 及其报告在 V9 中标记为 `Future Reference / Deferred`。落地前必须通过 ADR-008 评审，禁止直接复制代码。
2. **数据依赖**：V6 评分当前仍部分依赖模拟数据，策略效果取决于真实数据完整度。
3. **A 股/H 股差异**：原策略包含港股（腾讯、中芯国际 H、中国移动 H），V9 当前聚焦 A 股，需支持多市场或调整标的池。
4. **合规声明**：本策略仅用于模拟盘研究与复盘，不提供真实交易建议。

---

## 6. 参考资料

- `D:/v6-pro-cockpit/src/data/v6StrategyEngine.ts`
- `D:/v6-pro-cockpit/src/config/strategyRules.ts`
- `D:/v6-pro-cockpit/src/agents/trading/TradingOrchestrator.ts`
- `D:/v6-pro-cockpit/src/data/sectorSkillData.ts`
- `docs/explanation/implementation/trading-core-factors.md`
- 公开研究资料来源见本文第 2 节表格脚注。

---

## 7. 下一步行动

1. 评审并接受 ADR-008。
2. 按阶段 A 落地核心稀缺主题持仓组合 MVP。
3. 同步更新 `docs/02-functional-specs.md`、`docs/05-engine-specs.md`、`docs/10-glossary.md`。
4. 补充 `tests/portfolioBuilder.test.ts` 与 `tests/themeRegistry.test.ts`。
5. 运行质量门禁：`npm run lint && npm run test && npm run build && npm run audit:layers`。
