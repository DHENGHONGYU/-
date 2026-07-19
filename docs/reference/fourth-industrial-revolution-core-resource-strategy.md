---
title: 第四次工业革命稀缺核心资�?�?交易策略解析�?V9 采用方案
type: reference
domain: backend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "以第四次工业革命稀缺核心资源为主题，构建一个长期核心仓 + 中期战术仓的持仓组合�?
tags: [backend, strategy, trading, reference, service, api]
version: v0.9.0
last_updated: 2026-06-24
code_version: 2.0.0
doc_id: V9-DOC-BACK-010
change_log: 
---

# 第四次工业革命稀缺核心资�?�?交易策略解析�?V9 采用方案

> **Status**: Accepted / Phase 1 Implemented  
> **Version**: v0.9.0-strategy-review  
> **Last Updated**: 2026-06-24
>
> 本文档解�?`D:/v6-pro-cockpit` 中围�?第四次工业革命稀缺核心资�?的交易策略，结合 A 股市场公开研究资料，提出在 V9 中采用该策略的落地方案�? 
> 任何代码落地前须先通过 ADR 评审（见 `./2026-06-24-adopt-v6-core-resource-trading-strategy.md`）�?
---

## 1. 策略来源与定�?
### 1.1 来源

- **原始实现**：`D:/v6-pro-cockpit`
- **核心文件**�?  - `src/services/scoring/v6-engine/engine.ts` �?策略引擎主实�?  - `src/config/strategyRules.ts` �?建仓/止盈/T+0/仓位规则
  - `src/config/thresholds.ts` / `src/config/thresholds.ts` �?评分权重与阈�?  - `src/services/trading/tradingService.ts` �?交易编排�?  - `src/services/trading/dualStrategyEngine.ts` �?模拟盘引�?  - `src/data/sectorDefinitions.ts` / `src/data/sectorSkillData.ts` �?行业/主题评分
  - `src/pages/trading/PortfolioPage.tsx` �?组合管理 UI

### 1.2 策略目标

�?*第四次工业革命稀缺核心资�?*为主题，构建一�?*长期核心�?+ 中期战术�?*的持仓组合：

- **核心稀缺仓**�? 只稀缺资源龙头，占总资�?40%，持有周�?2�? 年�?- **价值洼地藏**：估值分高但综合分中等的逆向标的�?- **热门追涨�?*：板块轮�?TOP5 + 筹码集中度上升的短线标的�?
本文重点聚焦**核心稀缺仓**的解析与 V9 采用�?
---

## 2. "第四次工业革命稀缺核心资�?定义

### 2.1 产业链稀缺要�?
| 产业方向 | 稀缺核心资�?| 关键说明 |
|----------|-------------|----------|
| AI 与大模型 | 智能算力、高质量数据、算法人才、电�?温控 | 大模型训�?推理对算力呈指数级需求，算力成为核心制约[^1][^2] |
| 半导�?| 先进制程产能、GPU/CPU/ASIC、光刻机及零组件、光刻胶、电子特气、HBM/先进封装 | 高端 GPU �?CoWoS 产能�?AI 芯片主要瓶颈[^4][^7] |
| 新能�?新材�?| 锂、钴、镍、稀土永磁、铜、铝、镓、锗、铟 | 电动车、储能、AI 算力拉动能源金属需求[^5][^6] |
| 先进制�?机器�?| 高端数控机床、工业软件、减速器、伺服电机、稀土磁材、PEEK | 机器人与汽车/航空对精密零组件需求旺盛[^19] |
| 量子计算 | 超导材料、光量子芯片、稀释制冷机、低温测�?| 对上游材料与极端运行环境要求苛刻[^14] |
| 生物科技 | 基因测序仪、生物数据库、CXO/CDMO 产能 | 创新药研发链条关键环节[^15][^20] |

### 2.2 A 股主题映射（资料示例，非推荐�?
| 稀缺资�?| A 股细分板�?| 代表性公�?标的（资料示例） |
|----------|-------------|---------------------------|
| 算力芯片/AI 服务�?| GPU/CPU/ASIC/FPGA、AI 服务器、光模块、PCB | 寒武纪、海光信息、景嘉微、龙芯中科、中科曙光、浪潮信息、工业富联、中际旭创、新易盛、沪电股份等[^1][^2][^8] |
| 存储芯片 | DRAM/NAND 模组、主控芯片、内存接�?| 澜起科技、江波龙、佰维存储、国科微[^1] |
| 半导体设�?材料 | 刻蚀、薄膜沉积、光刻胶、大硅片、电子特�?| 北方华创、中微公司、华海清科、沪硅产业、南大光电、张江高科、江丰电子等[^1][^7][^8] |
| 先进封装/HBM | 封测�?.5D/3D 封装、晶圆级封装 | 长电科技、通富微电、华天科技、深科技等[^13] |
| 稀�?能源金属 | 稀土开�?磁材、锂/�?镍、钨、锗、镓 | 北方稀土、中国稀土、洛阳钼业、紫金矿业、赣锋锂业、天齐锂业、华友钴业、厦门钨业、云南锗业等[^5][^6][^17] |
| 机器�?先进制�?| 工业机器人、减速器、伺服系�?| 汇川技术、埃斯顿、绿的谐波、双环传动等[^19] |
| 量子计算 | 量子通信、量子计算设�?| 国盾量子、神州信息[^14] |
| 生物科技 | 基因测序、CXO/CDMO、创新药 | 华大基因、华大智造、药明康德、康龙化成、昭衍新药等[^15][^20] |

### 2.3 相关 ETF / 主题指数（资料示例）

| 主题 | 代表 ETF（场内代码） | 跟踪指数 |
|------|---------------------|----------|
| 半导体全产业�?| 国联安半导体 ETF�?12480）、国�?CES 半导体芯�?ETF�?12760�?| 中证全指半导体、中华交易服务半导体芯片指数[^7] |
| 科创板芯�?| 科创芯片 ETF�?88200�?| 上证科创板芯片指数[^7][^8] |
| 人工智能/AI 算力 | 人工智能 AIETF�?15070）、科创人工智�?ETF 华夏�?89010�?| 中证人工智能主题指数、上证科创板人工智能指数[^8] |
| 新能源车/新能�?| 新能源车 ETF�?59806/515030�?| 中证新能源汽车指数[^11] |
| 稀�?有色 | 稀�?ETF 嘉实�?16150）、有色金�?ETF�?59871�?| 中证有色金属指数、中证工业有色金属主题指数[^17][^18] |
| 机器�?| 机器�?ETF�?62500�?| 中证机器人指数[^19] |

---

## 3. v6-pro-cockpit 原策略解�?
### 3.1 8 只核心稀缺标的（原策略内置）

| # | 名称 | 代码 | 主题 | 资源类型 | 综合�?| 估值分 | 权重 | 核心稀缺资�?|
|---|------|------|------|---------|--------|--------|------|-------------|
| 1 | 腾讯控股 | 0700.HK | AI 平台+数据资产 | 数据资产 | 4.36 | 4.5 | **8%** | 微信 14 亿用户数�?+ 腾讯混元大模�?+ 游戏 AI |
| 2 | 北方华创 | 002371.SZ | 半导体设备国产替�?| 半导体设�?| 4.25 | 4.1 | 5% | 半导体设备平台型龙头 + 刻蚀/薄膜/PVD 全覆�?|
| 3 | 中兴通讯 | 000063.SZ | 5G+算力网络 | 通信网络 | 4.22 | 4.5 | 4% | 5G 基站全球第二 + 算力服务�?+ 芯片设计 |
| 4 | 工业富联 | 601138.SH | AI 服务器代�?| AI 算力 | 4.21 | 4.3 | 5% | 英伟�?AI 服务器核心代工厂 + 全球服务器制造龙�?|
| 5 | 中芯国际 | 00981.HK | 半导体代工国产替�?| 半导体代�?| 4.21 | 4.3 | 4% | 大陆唯一先进制程代工 + 国产芯片命脉 |
| 6 | 科大讯飞 | 002230.SZ | AI 语音+大模�?| AI 算法 | 4.21 | 4.5 | 4% | 讯飞星火大模�?+ AI 语音绝对龙头 |
| 7 | 中国移动 | 600941.SH | 通信基础设施+数据要素 | 数据资产 | 4.21 | 4.5 | 5% | 9 亿移动用户数�?+ 智算中心 + 5G-A 网络 |
| 8 | 海康威视 | 002415.SZ | AI 安防+机器视觉 | 机器视觉 | 4.21 | 4.5 | 5% | 全球安防第一 + AI 视觉算法 + 工业机器�?|

**组合统计**：平均综合分 4.23，平均估值分 4.41，总权�?40%�?
### 3.2 评分模型

#### V6 L0-L8 九层漏斗评分�?�? 分制�?
| 层级 | 名称 | 权重 | 说明 |
|------|------|------|------|
| L0 | STEEP 宏观扫描 | 10% | 政策/经济/社会/技�?生�?|
| L1 | 护城河分�?| 15% | 品牌/渠道/网络效应/数据资产/转化成本 |
| L2 | 市场/竞品分析 | 10% | TAM/竞争格局/份额/定价�?|
| L3F | 财务分析 | 10% | ROE/成长�?现金�?营运资本 |
| L3V | 估值分�?| 10% | PE/PB/PS/EV/EBITDA/股息 |
| L4 | 情景推演 | 10% | �?�?熊三情景概率加权 |
| L5 | T-M 矩阵 | 5% | 技术成熟度 × 市场成熟�?|
| L6 | Hype Cycle | 7% | 市场预期/渗透率/监管/媒体热度 |
| L7 | 第二曲线 | 15% | 多品�?出海/收购/新品�?|
| L8 | 技术筹�?| 8% | 趋势/支撑/机构持仓/筹码分布 |

#### 评级阈�?
| 评级 | 分数阈�?| 中文标签 |
|------|---------|---------|
| 买入 | �?.5 | 买入 |
| 增持 | �?.0 | 增持 |
| 中�?| �?.0 | 中�?|
| 减持 | �?.0 | 减持 |
| 卖出 | <2.0 | 卖出 |

### 3.3 选股标准�?0 �?13 筛选）

| 规则 ID | 规则�?| 条件 |
|---------|--------|------|
| R1 | 综合分门�?| 综合�?> 3.6 |
| R2 | 低估值高质补�?| 不满足（估值分 < 2.5 �?综合�?< 4.0�?|
| R3 | 价值洼地估值要�?| 价值洼地型�?估值分 > 4.0 |

筛选结果按综合分降序，取前 13 只�?
### 3.4 仓位分配规则

```
POSITION_RULES = {
  totalAllocationPct: 40,   // 核心稀缺总仓�?  singleMaxPct: 8,          // 单只最大占�?  singleMinPct: 4,          // 单只最小占�?  cashReservePct: 15,       // 现金储备
}
```

### 3.5 建仓规则（分步建仓，越跌越买�?
| 批次 | 触发条件 | 价格比率 | 本次投入 | 累计仓位 |
|------|---------|---------|---------|---------|
| 首批 | 当前价直接买�?| 1.00 | 25% | 25% |
| 第二�?| 股价下跌 5% | 0.95 | 20% | 45% |
| 第三�?| 股价下跌 8% | 0.92 | 20% | 65% |
| 第四�?| 股价下跌 10% | 0.90 | 20% | 85% |
| 第五�?| 股价下跌 15% | 0.85 | 15% | 100% |

### 3.6 止盈规则（动态止盈，�?10% �?20%�?
| 累计涨幅 | 卖出比例 | 剩余仓位 |
|---------|---------|---------|
| 10% | 20% | 80% |
| 20% | 20% | 60% |
| 30% | 20% | 40% |
| 40% | 20% | 20% |

最终保�?20% 底仓�?
### 3.7 止损规则

| 类型 | 阈�?| 操作 |
|------|------|------|
| 硬止�?| 下跌 7% | 全仓卖出 |
| 移动止损 | 从最高点回撤 10% | 卖出一�?|
| 时间止损 | 持仓 60 �?| 全仓卖出 |

### 3.8 风控与执行保�?
- 买入信号置信�?�?0.6
- V6 综合�?�?3.6
- 必须通过 BacktestGateway（胜�?> 40%，回�?<< 25%，Sharpe > 0.5�?- 单行业上�?30%，单标的上限 15%（组合级�? 25%（模拟盘�?- 现金储备 10%�?5%

---

## 4. V9 当前交易舱现状与差距

### 4.1 当前已实�?
| 模块 | 文件 | 状�?|
|------|------|------|
| 交易�?UI | `src/apps/trading/TradingApp.tsx` | �?单页卡片式界�?|
| 信号生成 | `src/services/trading/signalGenerator.ts` | �?基于 MA/RSI/量比/MACD 的简单技术信�?|
| 仓位计算 | `src/services/trading/positionSizer.ts` | �?�?Kelly 公式�?%�?5% 单票仓位 |
| 风控 | `src/services/trading/riskEngine.ts` | �?冷却期、仓位上限、数据新鲜度�?|
| 订单 | `src/services/trading/tradingService.ts` | �?模拟买入/卖出，订单流�?|
| 信号持久�?| `src/services/trading/tradingService.ts` + `dataLayer.signals` | �?刚落�?|

### 4.2 与核心稀缺策略的差距

| 能力维度 | V9 现状 | v6-pro-cockpit | 是否缺失 |
|----------|---------|----------------|----------|
| 主题/行业映射 | `Stock` 无行�?主题字段 | `REV4_STOCKS` 内置 theme/resourceType | �?缺失 |
| 评分驱动选股 | 信号完全基于技术指标，未读评分 | `TradingOrchestrator` 综合评分与策略筛�?| �?缺失 |
| 策略规则引擎 | �?20 �?13、价值洼地、核心稀缺规�?| `V6StrategyEngine` + `strategyRules.ts` | �?缺失 |
| 分步建仓/金字塔加�?| `positionSizer` 只算一次目标股�?| �?倒金字塔加仓计划 | �?缺失 |
| 动态止�?止损 | 无止盈止损逻辑 | 动态止盈、硬止损/移动止损/时间止损 | �?缺失 |
| 择时引擎 | 简单技术信�?| `TimingAgent` 四维度择�?| �?缺失 |
| 组合级仓位分�?| 单票独立计算 | 主题权重 + 集中度控�?+ 再平�?| �?缺失 |
| 模拟盘资�?成本 | 无手续费、无资金扣减 | 完整账户模型与绩效指�?| �?缺失 |
| 批量下单/自动执行 | 仅支持单票手动买�?| `generateTradingSignals` + `executeSimulatedTrades` | �?缺失 |
| 主题仓位上限 | 无行�?主题风控 | `IndustryScore.sectorSnapshot.positionPct` | �?缺失 |

---

## 5. V9 采用方案

### 5.1 架构守护者三问自检

| 问题 | 回答 |
|------|------|
| 是否触及调用方向铁律�?| 否。新增模块位�?L3 `services/trading/`，由 L4 `TradingApp` 调用，符合上层调用下层原则�?|
| 是否修改 IndexedDB Schema�?| 是。需�?`Stock` 中增�?`industryCode` / `theme` / `sector` 字段；可能新�?`portfolios` / `portfolioHoldings` Store。必须通过 ADR 评审�?|
| 对应哪个文档�?| 本方案文�?+ ADR-008；落地后同步更新 `./02-functional-specs.md`、`./05-engine-specs.md`、`./10-glossary.md`、`./08-implementation-plan.md`�?|

### 5.2 落地范围（MVP�?
建议分两个阶段落地：

#### 阶段 A：核心稀缺主题持仓组合（短期�?
1. **Schema 扩展**
   - `Stock` 增加 `industryCode?: string`、`theme?: string[]`、`sector?: string`�?   - 新增 `Portfolio` / `PortfolioHolding` 类型（可先用内存/Store 持久化）�?
2. **主题映射配置**
   - 新建 `src/config/themeRegistry.ts`：定�?第四次工业革命稀缺核心资�?主题及其映射�?`industryCode` / `theme` 关键词�?   - 初始可内�?8 只核心标的的映射，后续支持用户自定义�?
3. **评分消费�?*
   - �?`tradingService` 或新�?`src/services/trading/scoringAdapter.ts` 中读�?`v6Scores` / `intelligentScores` / `industryScores`�?   - 把综合分 �?4.0 �?watching 股票纳入核心稀缺候选池�?
4. **组合构建�?*
   - 新建 `src/services/trading/portfolioBuilder.ts`�?     - 按主题分�?     - 按评分排�?     - �?`IndustryScore.sectorSnapshot.positionPct` 分配主题仓位
     - 输出多只股票的目标持仓（symbol / targetShares / targetWeight�?
5. **交易�?UI 扩展**
   - �?`TradingApp` 新增"核心稀�?页签或面板�?   - 展示主题持仓组合、目标权重、当前权重、偏离度、再平衡建议�?
#### 阶段 B：完整策略引擎（中期�?
1. **策略规则引擎**
   - 新建 `src/services/trading/strategyEngine.ts`：实�?20 �?13 筛选、价值洼地、热门追涨分类�?
2. **建仓/止盈/止损执行**
   - 扩展 `positionSizer.ts`：正/倒金字塔加仓计划�?   - 新建 `src/services/trading/riskEngine.ts`、`stopLossEngine.ts`�?
3. **模拟盘引擎增�?*
   - 完善 `tradingService` 中订单金额计算：加入手续费、滑点、印花税、资金扣减�?   - 增加账户现金、持仓市值、净值曲线、绩效统计�?
4. **自动执行与回�?*
   - 新建 `src/services/trading/tradingService.ts`：串联评分→策略筛选→信号→仓位→风控→止损止盈→交易建议�?   - 与复盘引擎（ReviewEngine）联动，记录信号-订单血缘�?
### 5.3 �?V9 现有能力的复�?
| 现有能力 | 复用方式 |
|----------|----------|
| `screeningEngine.ts` | 已支�?candidate→screened→deepDive 晋升，可扩展�?deepDive→watching 的自动晋�?|
| `v6ScoreService.ts` | 直接读取 `V6Score.score` �?`factors` 作为选股门槛与排�?|
| `intelligentScoreService.ts` | �?`overallScore` �?`dimensionScores` 补充个股质量判断 |
| `industryScoreService.ts` | �?`sectorSnapshot.positionPct` 作为主题仓位上限 |
| `stockpoolService.transitionStock()` | 将核心稀缺候选股�?`deepDive` 推进�?`watching` |
| `tradingService.scanWatchingSignals()` | �?watching 池上生成买入/卖出/加仓/止盈信号 |
| `riskEngine.ts` | 扩展主题集中度、单行业上限、组合回撤等风控规则 |

### 5.4 需要新�?修改的文件清�?
| 类型 | 文件路径 | 说明 |
|------|----------|------|
| 配置 | `src/config/themeRegistry.ts` | 主题-行业-标的映射 |
| 配置 | `src/config/strategyRules.ts` | 建仓/止盈/止损/仓位规则 |
| 服务 | `src/services/trading/scoringAdapter.ts` | 评分消费适配 |
| 服务 | `src/services/trading/portfolioBuilder.ts` | 组合构建 |
| 服务 | `src/services/trading/strategyEngine.ts` | 策略规则引擎 |
| 服务 | `src/services/trading/riskEngine.ts` | 止盈引擎 |
| 服务 | `src/services/trading/riskEngine.ts` | 止损引擎 |
| 服务 | `src/services/trading/tradingService.ts` | 交易编排�?|
| 服务 | `src/services/trading/dualStrategyEngine.ts` | 增强模拟�?|
| UI | `src/apps/trading/panels/CoreResourcePanel.tsx` | 核心稀缺组合面�?|
| UI | `src/apps/trading/panels/ExecutionPlanPanel.tsx` | 再平衡面�?|
| 类型 | `src/data/types.ts` | 扩展 Stock / 新增 Portfolio 类型 |
| 数据�?| `src/data/dataLayer.ts` | 新增 portfolioStore |
| 测试 | `tests/portfolioBuilder.test.ts` �?| 覆盖组合构建、再平衡、风�?|

### 5.5 风险与注意事�?
1. **外部参考文档管�?*：`D:/v6-pro-cockpit` 及其报告�?V9 中标记为 `Future Reference / Deferred`。落地前必须通过 ADR-008 评审，禁止直接复制代码�?2. **数据依赖**：V6 评分当前仍部分依赖模拟数据，策略效果取决于真实数据完整度�?3. **A �?H 股差�?*：原策略包含港股（腾讯、中芯国�?H、中国移�?H），V9 当前聚焦 A 股，需支持多市场或调整标的池�?4. **合规声明**：本策略仅用于模拟盘研究与复盘，不提供真实交易建议�?
---

## 6. 参考资�?
- `D:/v6-pro-cockpit/src/data/v6StrategyEngine.ts`
- `D:/v6-pro-cockpit/src/config/strategyRules.ts`
- `D:/v6-pro-cockpit/src/agents/trading/TradingOrchestrator.ts`
- `D:/v6-pro-cockpit/src/data/sectorSkillData.ts`
- `../explanation/trading-core-factors.md`
- 公开研究资料来源见本文第 2 节表格脚注�?
---

## 7. 下一步行�?
1. 评审并接�?ADR-008�?2. 按阶�?A 落地核心稀缺主题持仓组�?MVP�?3. 同步更新 `./02-functional-specs.md`、`./05-engine-specs.md`、`./10-glossary.md`�?4. 补充 `tests/portfolioBuilder.test.ts` �?`tests/themeRegistry.test.ts`�?5. 运行质量门禁：`npm run lint && npm run test && npm run build && npm run audit:layers`�?