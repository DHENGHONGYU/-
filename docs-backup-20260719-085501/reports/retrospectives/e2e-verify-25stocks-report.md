---
title: 25 只股票全流程端到端校对测??按舱分析报告
type: reports
domain: qa
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "Version：v1.0 | 日期?026-07-14 Source：考核方案..."
tags: [qa, test, analysis]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 25 只股票全流程端到端校对测??按舱分析报告

> **Version**：v1.0 | **日期**?026-07-14
> **Source**：考核方案 [`e2e-verify-25stocks-plan.md`](./e2e-verify-25stocks-plan.md) · 机器可读报告 [`outputs/e2e-verify-25stocks.report.json`](../../outputs/e2e-verify-25stocks.report.json) · 测试脚本 [`tests/e2e-verify-25stocks.integration.test.ts`](../../../tests/e2e-verify-25stocks.integration.test.ts)
> **测试环境**：Vitest + jsdom + `fake-indexeddb`；强?`sourcePriority:['mock']`，完全离线、可复现（种?`20260714`?
---

## 一、总评

| 指标 | 结果 |
|---|---|
| 抽样 | 25 / 宇宙 29（种?20260714，可复现?|
| 五舱均分（综合得分） | **78 / 100 ?等级「合格?* |
| 维度通过?| 准确?75% · 完整?100% · 异常 100% · 性能 100% · 总控治理 33% |
| 总耗时 | **134 ms**（预?<60s，达?`budgetOk=true`?|
| 高严重度发现 | **2 ?*（F2 落库缺陷、F3 引擎确定性——后者经根因分析实为测试桩挥发性误报，详见 §六） |

**一句话结论**：系统的**服务层骨架、池流转规则引擎、Mock 降级链路、性能指标**均表现稳健（完整?异常/性能三维度满分）；但**数据落库链路存在致命缺陷（F2?*，其破坏半径直接波及交易舱（行情新鲜度门禁饿??全部买单被风控拦截）与总控舱的跨库引用完整性，是本次「合格」而非「良好」的根本原因?
---

## 二、按「三?+ 总舱 + 汇聚舱」逐舱解读

> 架构原理解读见考核方案 §二：三舱 `input ?analysis ?trading` 与代码三?`intention / research / position` 一一映射；`command` 为总控舱；`output` 为三舱产物汇聚舱?
### 2.1 输入?`input` —?得分 **100** ?
| 检查点 | 结果 |
|---|---|
| 批量导入 25 ?| `importOk` **25/25 = 100%**（落 `intention` 池） |
| Mock 实时行情 | `quoteOk` 100%，`source==='mock'`、`fallbackChain` 末端?`mock`（降级成功） |
| 历史 K 线（60 根） | `klineOk` 100%，`high≥max(open,close)`、`low≤min(open,close)`、`volume?` 结构合法 |
| 行情价回?| 通过 `updateStock` 信封?`price/pe/pb/marketCap` 写回 `stocks`（供下游下单与评分） |

**解读**：录入与采集（Mock 链路）完全跑通，数据**结构合法?*达标。这是系统「能跑」的基石，输入舱零失分?
### 2.2 分析?`analysis` —?得分 **100**（但?F3 治理扣分）⚠?
| 检查点 | 结果 |
|---|---|
| V6 评分全量 | `scoreOk` 25/25 = 100% |
| 分数?| `scoreInRange` 100%，`score ?[0,100]` |
| 层级有限?| `layersFinite` 100%?1 ?`score/weight` 均有限） |
| ?NaN | `hasNoNaN` 100% |
| 确定性（治理?| ?`determinismOk=false`（F3，根因见 §六，实为时间戳挥发性） |

**关键观察**?5 只标?V6 综合分高度聚集于 **2.29?.54（均值≈2.4 / 5.0?*，对应「watch / 中性」评级；信号最强方?`strongestDir` 全部?`"watch"`。这?*合成 Mock 输入缺少真实基本?*（`pe/pb/roe/marketCap` 多为测试默认占位值、K 线为确定性正弦波）一致——引擎在「信息贫乏」输入下给出保守中性分?*合理且安?*的行为，并非缺陷?
`analysis` 舱业务分满分，仅在总控治理维度?F3（确定性断言）被扣——?F3 经根因分析系**测试桩误?*（见 §六），故分析舱的**真实实现质量应视为达?*?
### 2.3 交易?`trading` —?得分 **67** ?
| 检查点 | 结果 |
|---|---|
| 信号生成 | `signalOk` 25/25 = 100%（方?置信度域合法?|
| 池流转（合法链） | `transitionOk` 25/25 = 100%（`intention.screening ?research.candidate ?research.screened`?|
| **下单（买入）** | **`orderOk` 0/25 = 0%** ?唯一失分?|

**根因链（?F2 直接因果?*：交易舱下单经由 `createBuyOrder ?createOrderWithRiskCheck ?checkOrderRisk`（`src/services/trading/riskEngine.ts`）。其**第一道门禁（行情新鲜度，?72?4 行）**会按 `symbol` 查询 `dailyQuotes` ?`updatedAt`；若查不到记录即 `blocks.push('无有效行情数?)`，风控直接否决?
由于 **F2 缺陷导致 K 线数据从未写?`daily_quotes`**（store 在读回时?0 条有效记录），风控新鲜度门禁**对全?25 只标的均返回「无有效行情数据」→ 买单 100% 被拦??`orderOk=false` ?交易舱得分跌?67?
> 这说明交易舱的低?*不是交易/风控逻辑本身的错?*（信号生成、池流转、订单构?`buildOrder` ?`amount=price*quantity` 计算均正确），而是**上游落库缺陷（F2）沿数据依赖向下游的级联破坏**。修?F2 后，交易舱预期可回升至满分区间?
### 2.4 汇聚?`output` —?得分 **50** ⚠️

| 检查点 | 结果 |
|---|---|
| 产物可读（V6 列表齐全 + 池可读） | `assembledOk=true` ✅（25 ?V6 评分齐全、intention/research 池可读） |
| 跨库引用完整?| `referentialIntegrity=false` ❌（`dailyQuotes=0`、`orders=0`，不满足 `dqSymbols.size===25`?|

**解读**：三舱产物的**汇聚与呈现层本身健康**（`assembledOk=true`，研究池 25 只、V6 评分 25 份均可读）。失分来自「引用完整性」断言——?`dailyQuotes=0 / orders=0` 正是 F2 与其级联破坏（交易舱无单）在汇聚层的投影。汇聚舱?*受害?*，非责任方?
### 2.5 总控?`command` —?得分 **75** ⚠️

| 检查点 | 结果 |
|---|---|
| 数据蓝图自洽 | `blueprintStoreCount=41`（实体数达标）✅ |
| 异常矩阵? 项） | **全绿** ✅（非法导入不抛错、非法流转被拒、Mock 降级成功、规则矩阵正确） |
| 性能预算 | `budgetOk=true` ✅（总耗时 134ms?|
| 确定性稳?| ?`determinismOk=false`（F3，误报，?§六） |
| 治理（引用完整） | ?同上，受 F2 级联影响 |

**解读**：总控舱的**「控制塔」职责（健康度遥测、规则矩阵、异常矩阵、性能门禁）全部正?*——这是系统「可控、可观测、优雅降级」的有力证据。失分仅来自两项治理断言（确定性、引用完整），二者均**根源?F2 的落库缺陷或其测试桩的挥发?*（F3），非总控逻辑本身问题?
---

## 三、维度通过率明?
| 维度 | 通过?| 说明 |
|---|---|---|
| 数据准确?(A) | 75% | 录入/评分/信号?100%，唯 `orderOk`（交易下单）0% 拉低 |
| 流程完整?(B) | 100% | 25 只全链路无静默丢弃（任一环节失败项已?try/catch 包住，保证全部跑完） |
| 异常处理 (C) | 100% | 脏输?非法流转/Mock 降级/规则矩阵全绿 |
| 性能 (D) | 100% | 各步 p95 ?<15ms，总耗时 134ms |
| 总控治理 (E) | 33% | 蓝图达标，但确定?+ 引用完整性两项未?|

---

## 四、性能表现

| 步骤 | p50 (ms) | p95 (ms) | max (ms) | 预算 p95<1500 | 评价 |
|---|---|---|---|---|---|
| import | 0.30 | 0.60 | 0.97 | ?| 极快 |
| quote (mock) | 0.027 | 0.041 | 0.047 | ?| 极快 |
| kline (mock) | 0.11 | 0.15 | 0.98 | ?| 极快 |
| score (V6) | 0.84 | 1.65 | 3.96 | ?| ?|
| signal | 0.15 | 0.42 | 8.75 | ?| 快（个别峰值来自首?JIT?|
| transition | 2.07 | **13.45** | **15.45** | ?| 最重步骤，但仍远低于预?|

**结论**：离?Mock 链路性能优异，瓶颈在池流转（`transition`，p95?3ms，含 `updateStock` 合并 + 两次 `transitionPoolItem` 落库），但距 1500ms 预算仍有 **>100× 余量**。性能维度不构成任何风险?
---

## 五、发现项（Findings?
### 🔴 F2 · `dailyquotes-persist-defect`（高严重?· 真实缺陷 · 已复现）

- **所在舱**：输?分析（落库链路）
- **标题**：采集管?`daily_quotes` 落库信封结构错误（K 线数据实际从未持久化?- **根因**?  `src/services/data-collector/collectionPipeline.ts` ?`writeKlineToDailyQuotes()` 发出?`saveDailyQuotes` 信封 `payload` ?`{ store, data }`；?`DataBridge` ?`PutHandler.handle()`（`src/core/databridgeHandlers.ts` ?73 行）执行 `await db.put(store, payload)` —?**将整?`{store,data}` 对象当作一条记录落?*?  由于 `daily_quotes` ?`keyPath='symbol'`（`src/data/db-schema.ts` ?217 行），而该对象**没有 `symbol` 顶层?*，IndexedDB 抛出 `DataError: Data provided to an operation does not meet requirements`，写入失败?- **破坏半径**?  - 分析?V6 读取 `dailyQuotes` 时得到空数据（评分被迫降?失真）；
  - 交易舱风控「行情新鲜度」门禁饿??全部买单被拒（?.3 根因）；
  - 汇聚?/ 总控舱跨库引用完整性失败（§2.4/§2.5）?- **复现证据**：测试以真实管线写法 `{ store: STORE_NAME.dailyQuotes, data: probeDq }` 写入探针 ?IndexedDB 拒绝 / 回读?`null` ?`dqPipelineDefectConfirmed=true`?- **修复建议**?  1. （推荐）修正 `PutHandler` ?`saveDailyQuotes` 的处理：落库前提?`payload.data`（`db.put(store, payload.data)`）；
  2. 或修?`writeKlineToDailyQuotes` 直接?`DailyQuotes` 对象作为 envelope `payload`（与测试内联正确写法一致）?  > 注：本测试为保证下游 V6 可验证，在逐股循环?*改用正确?`DailyQuotes` 对象作为 payload** 落库，故逐股 `dqPersistOk=true`；但?*不代表真实管线可落库**——这正是 F2 必须高严重度的原因?
### 🟡 F3 · `engine-nondeterministic`（高严重度标?· 经根因分析为「测试桩挥发性误报」）

- **所在舱**：分析（治理?- **原始现象**：`createV6Engine().calculateAll(固定输入)` 双跑，`JSON.stringify` 结果不相??`determinismOk=false`?- **根因（实测确认）**：对 `src/services/scoring/v6-engine/**` 全量检索，**不存?* `Math.random` / `Crypto` / `nanoid` 等任何随机源；引擎的 11 层计算器均为输入的纯函数。双跑不等价的唯一来源?`aggregate()` ?`CompositeScore` 上盖?**`timestamp: Date.now()`**（`engine.ts` ?262 行），以?`measureAsync` 可能附加的性能计时字段。两?`await` 之间 `Date.now()` 必然不同 ?序列化字节不等?- **结论与重?*?*V6 评分数学本身是确定性的**（综合分稳定??.4），F3 反映的并非评分不稳定，而是**测试用「全?`JSON.stringify` 字节比对」对易变字段过敏**。建议将 F3 由「高」重判为「低 / 信息性」，并做以下任一项修正：
  1. 确定性断言仅比?*结构字段**（`score` + `layerDetails`），排除 `timestamp` / 性能元数据；
  2. 或在引擎的确定性测试模式下冻结 `timestamp`（注入固定时钟）?- **价?*：此发现暴露?*测试桩的脆弱?*——若不经根因分析，会误报一个「高严重度引擎缺陷」误导后续排期。已在本报告澄清?
### ?未触发但需关注的潜伏设计张力（F1 类，本次未入 findings?
考核方案中预设的 F1（「导入落库状态与池流转表不匹配」）本次**未触?*，原因是规则矩阵断言 `isValidTransition('intention','candidate','research','candidate')===false`（非法被正确拒绝，`ok=true`）。但底层设计张力仍在?
- `addStock` 将新录入标的写为 `(pool=intention, researchStatus=candidate)`?- ?`POOL_TRANSITIONS[intention]` ?*合法源状态只?* `{screening, watchlist, archived}`?*不含 `candidate`**?- 即「刚导入的股票」在流转引擎?*没有任何合法出边**，必须外部把它改?`screening` 才能晋升研究池（本测试在流转前显?`updateStock({researchStatus:'screening'})` 规避了此问题）?
**建议**：将此张力纳入治理检查（断言「每?`intention` 池标的均存在至少一条合法出边」），或?`addStock` 中把初值对?`INTENTION_STATUS.screening`，从根本上消除死锁?
---

## 六、根因链路图（一句话串起全部失分?
```
F2 落库缺陷
  └─ PutHandler ?{store,data} 整体落库，daily_quotes ?symbol ??IndexedDB DataError
       ├─?daily_quotes 永远为空（governance: dailyQuotes=0, dqCoverage=0?       ?     ├─?分析舱读不到行情（评分被迫保守，?math 正确?       ?     ├─?交易舱风控「新鲜度」门禁饿??全部买单被拒（trading 67?       ?     └─?汇聚?总控?跨库引用完整性失败（output 50 / command 治理失分?       └─?交易?orderOk=0（级联破坏，非交易逻辑错误?
F3 确定性断言失败
  └─ 测试用全?JSON 字节比对，对 CompositeScore.timestamp:Date.now() 过敏
         └─?误报「引擎非确定性」；实测引擎无随机源，数学确定性成??重判为低/信息?```

**核心结论**：本次「合格（78）」的失分**几乎全部可追溯到单一根因 F2**（落库信封结构错误），其破坏半径贯穿三舱 + 汇聚 + 总控；F3 为测试桩误报。修?F2 后，预期五舱得分可全面回升，总评有望进入「良好（?0）」?
---

## 七、改进建议（按优先级?
| 优先?| 建议 | 预期收益 |
|---|---|---|
| **P0** | 修复 F2：`PutHandler` 落库前提?`payload.data`（`src/core/databridgeHandlers.ts` ?73 行），或修正 `writeKlineToDailyQuotes` 信封结构 | 打?K 线持久化 ?连锁修复交易舱下单（?7→~100）、汇?总控引用完整?|
| **P0** | 将本 E2E 测试纳入 CI 门禁（当前为独立 `it`，不阻塞?| 防止 F2 类落库回归，固化「全流程可跑 + 数据自洽」基?|
| **P1** | 修正 F3 测试桩：确定性比对排?`timestamp`/性能字段，或?F3 重判为低严重?| 消除误报，避免误导排?|
| **P1** | 消除 F1 潜伏张力：`addStock` 初值对?`INTENTION_STATUS.screening`，或 `POOL_TRANSITIONS[intention]` 增加 `candidate` 源状?| 解除「刚导入股票无合法出边」死?|
| **P2** | 交易舱风控「新鲜度」门禁在 `dailyQuotes` 缺失时应区分「数据未到」与「数据过期」，避免静默全拒（可?warning 而非?block?| 提升降级健壮性与可观测?|
| **P2** | ?V6 引擎补充「含真实基本面」的集成基线用例，验证评分区分度（当?Mock 输入下评分高度聚??.4?| 防止「评分机械地给出中性分」类隐性退?|

### 7.1 实施结果?026-07-14 已全部落?✅）

> 六项改进建议均已?TODOLIST 逐条执行并验证通过；验证命?`npm run test:e2e-verify` ?`Test Files 3 passed (3), Tests 3 passed (3)`（exit 0）?
| 优先?| ?| 实施落点 | 验证 |
|---|---|---|---|
| **P0** | 修复 F2 | `collectionPipeline.writeKlineToDailyQuotes` ?`dataSourceOrchestrator.collectAndSaveKline` 信封 `payload` ?`{store,data}` 包裹改为直接?`DailyQuotes` 对象（对?`fetcherService.sendSaveDailyQuotes` 契约，与 `PutHandler` ?`db.put(store, payload)` 一致） | 25 ?E2E 落库断言 `db.get(dailyQuotes, symbol)` 含顶?`updatedAt` |
| **P0** | 纳入 CI 门禁 | `package.json` 新增 `test:e2e-verify` 脚本?5 ?E2E + 冗余设计 E2E + V6 区分度基线三件套）；`.husky/pre-push` ?`test:clean` 后新?`[3.5]` 步骤接入 | pre-push 全链路（db 引用审计 ?目录审计 ?单测 ?E2E ?构建?|
| **P1** | 修正 F3 测试?| 25 ?E2E ?V6 `calculateAll` 以「相同输入双跑、仅比对结构性字段（score + layerDetails），排除 `timestamp`/性能元数据」判定确定?| 双跑 `strip` ?`toEqual` 通过 |
| **P1** | 消除 F1 死锁 | `inputService.addStock` / 批量导入初?`researchStatus` ?`RESEARCH_STATUS.candidate` 改为 `INTENTION_STATUS.screening`（对?`DEFAULT_POOL_STATUS[intention]`）；移除不再使用?`RESEARCH_STATUS` 导入 | 导入?`db.get(stocks)` ?`researchStatus==='screening'` |
| **P2** | 风控新鲜度健壮化 | `riskEngine.checkOrderRisk`：「数据未到」→ `warnings`（降级放行）；「数据过期」→ 维持 `blocks` 硬阻断。配?`dbConfig` ?`[MODULE_ID.trading].read` 增加 `STORE_NAME.dailyQuotes`，使风控行情查询可达（此前恒走「无数据」分支，逻辑不可达） | `checkOrderRisk({dailyQuotes 新鲜})` ?`ok=true`；`checkOrderRisk({?dailyQuotes})` ?`warnings` 含「无有效行情数据」且 `ok=true` |
| **P2** | V6 区分度基?| 新增 `tests/v6-score-discrimination.integration.test.ts`? 只差异化标的（A 低估?高盈?上升、B 高估?低盈?下降、C 中性横盘），断言 A>B ?spread>0.5 | `A.score - B.score > 0.5` 通过 |

> **附：ACL 联动修复**：P2 风控新鲜度原本「恒走无数据分支」的根因?`trading` 模块?`dailyQuotes` ?ACL（仅 `fetcher` 写、`analyzer`/`tradinghub`/`strategy` 读）。为让「过期硬阻断」可达，?`[MODULE_ID.trading].read` 增加 `STORE_NAME.dailyQuotes`；该扩展符合风险控制的合理数据需求，?`../../AGENTS.md` 未逐模块枚?ACL 读列表、无需文档同步?
---

## 八、附?
### 8.1 抽样标的（种?20260714?5/29?
```
688041.SH 600519.SH(贵州茅台) 601318.SH(中国平安) 600900.SH(长江电力)
603799.SH 688981.SH 600030.SH(中信证券) 601012.SH(隆基绿能)
000858.SZ(五粮? 600036.SH(招商银行) 000063.SZ 300059.SZ(东方财富)
300750.SZ(宁德时代) 600941.SH 603501.SH 603893.SH
002230.SZ(科大讯飞) 002594.SZ(比亚? 688256.SH 000001.SZ(平安银行)
600276.SH(恒瑞医药) 002050.SZ 600111.SH 300124.SZ 002371.SZ
```

### 8.2 逐股结果摘要（节选）

| 标的 | import | quote | kline | dqPersist | score | signal | order | transition |
|---|---|---|---|---|---|---|---|---|
| 全部 25 ?| ?| ?| ?| ?| ??.4) | ?watch) | ?| ?|

- `score` 值域 2.29?.54（均值≈2.4 / 5.0），`strongestDir` 全为 `watch`?- `importedStatus` 全为 `intention/candidate`?- `orderOk=false` 一致（F2 级联，见 §?§五）?
### 8.3 方法论声?
- **离线边界**：外部行?/ LLM / AKShare 均不可达，全链路强制 Mock，故不校验「真实市场数据准确性」，改为高标校验**管道正确性、结构合法性、引擎确定性、系统稳定?*?- **可复?*：固定种?LCG（线性同余）?Fisher–Yates 洗牌，换种子即可得不同样本?- **不静默丢?*：逐股每步 `try/catch`?5 只全跑完，失败项以字段标记而非中断，确保「流程完整性」可被准确度量?
---

> **本报告的定位**：考核方案（§指标）?机器可读报告（§数据）?本报告（§人工解读与根因）。三者共同构成「指标确定→校对测试→逐舱解读」闭环?