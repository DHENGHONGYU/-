---
title: e2e-verify-25stocks-plan
tier: T2
status: active
type: reports
domain: project
doc_id: V9-DOC-AUTO-B727AE
code_version: 2.0.0
summary: 当前整体数据校对测试尚未覆盖全流程端到端校验。本测试随机抽取 25 只股票，沿系统真实服务层（`src/services/*`）跑通"录入→采集→评分→信号→订单→池流转"全链路，按模块逐一评估实现质量。
maintainer: V9 Architecture Team
phase: retrospective
---


## 一、背景与范围

当前整体数据校对测试尚未覆盖**全流程端到端**校验。本测试随机抽取 **25 只股票**，沿系统真实服务层（`src/services/*`）跑通"录入→采集→评分→信号→订单→池流转"全链路，按模块逐一评估实现质量。

### 离线边界声明（必须明确）

外部行情（腾讯/新浪需代理）、AKShare（需本地 Python）、LLM 分析（需 API Key）当前**均不可达**。系统已设计为四层降级链末端落 **Mock 数据源**（`src/config/dataSourceRegistry.ts` 中 `mock.enabled=true`）。因此本测试：

- ✅ **真实运行**系统的服务层、池流转引擎、V6 评分引擎、信号生成器、订单服务、DataBridge/Envelope 写入链路（与 UI 无关，UI 只是呈现层）。
- ✅ 全部采集路径**强制 `sourcePriority: ['mock']`**，完全离线、可复现。
- ⚠️ **不校验"真实市场数据准确性"**（无实时行情）；改为以更高标准校验**数据管道的正确性、结构合法性、引擎确定性与系统稳定性**。
- ⚠️ **LLM 驱动的分析编排（`analysisOrchestrator.callLLM`）不在本测试范围**；分析舱的量化内核（V6 评分、板块/洼地分析为纯计算）予以覆盖，LLM 部分标注为 Mock 边界。
title: e2e-verify-25stocks-plan
tier: T2
status: active
type: reports
doc_id: V9-DOC-QA-107
domain: qa
code_version: 2.0.0

---

## 二、"三舱+总舱"架构原理解读（基于代码实证）

经对 `../../AGENTS.md`、`src/config/routes.ts`、`PortalShell.tsx`、各池 store 与 `poolTransitionEngine.ts` 的逐条核对，本系统的权威架构为**五舱**：`input / analysis / trading / output / command`。

其中：

| 角色 | 舱 | 说明 |
|---|---|---|
| **三舱（业务处理舱）** | `input` → `analysis` → `trading` | 数据增值主链路，与代码中的**三池三分拆** `intention / research / position` **一一映射** |
| **总舱（总控舱）** | `command` | 系统的"控制塔"，横向监控全系统健康度、编排 Agent/MCP，**不直接承载业务分析**（`../../reference/command-cabin-spec.md`） |
| **汇聚舱** | `output` | 三舱产物的**收敛输出**：研究报告、交易复盘、仪表盘 |

> 注：V9 文档与代码中**不存在"三舱"作为页面舱的概念**——V10 蓝图的"三舱硬隔离（研究/交易/系统）"已被 V9 明确否决（`../reference/v9-system-blueprint_reference.md` 第 272 行"五舱架构（不改为三舱）"）。本测试所称"三舱"特指**三个业务处理舱（input/analysis/trading）**，对应"三池"。

### 本测试的解读映射

```
【输入舱 input】   录入候选 → 落 意向池(intention)         ← 三池之一
       │
【分析舱 analysis】 V6 评分 / 板块·洼地分析 → 研究池(research)  ← 三池之一
       │
【交易舱 trading】  信号生成 → 订单 → 持仓池(position)          ← 三池之一
       │
【汇聚舱 output】  读取三池产物 → 研究报告 / 复盘
       │
【总控舱 command】 横读全系统 store + 数据蓝图/一致性校验 + 异常/性能遥测  ← 总舱治理
```

---

## 三、标的抽样方法

1. **构建宇宙（≥30 只，确保可抽 25）**：合并
   - `MOCK_STOCK_LIBRARY`（`src/services/input/mockStockLibrary.ts`，15 只，含 industry/pe/pb/marketCap）
   - `CORE_RESOURCE_SYMBOL_WHITELIST`（`src/config/symbols.ts`，19 只）
   - 按 `^\d{6}\.(SH|SZ|HK)$` 校验代码合法性，按 `symbol` 去重。
2. **种子随机**：固定种子 `RANDOM_SEED = 20260714`，线性同余 RNG 做 Fisher–Yates 洗牌后取前 25 只，**保证每次运行结果可复现**（与 `e2e/full-flow-20-stocks.spec.ts` 同思路）。
3. **随机抽样体现"随机"**：并非硬编码 25 只，而是从宇宙中随机抽取，每次换种子可得不同样本。

---

## 四、考核维度、指标与通过标准

五个维度对应五个质量关切；每个维度在五个舱上各有检查点。

### 维度 A：数据准确性（Data Accuracy）
> 关注：写入库的数据是否符合接口契约、数值是否在合法域。

| 舱 | 检查点 | 通过标准 |
|---|---|---|
| 输入 | 导入 Stock：`symbol`/`name` 非空、`pool==='intention'`、必填字段存在 | 100% |
| 采集 | `RealtimeQuote.price>0`、`change` 有限；`KlineBar[]` 长度==请求天数，每根 `high>=max(open,close)`、`low<=min(open,close)`、`volume>=0`；`DailyQuotes.symbol` 匹配 | 100% |
| 分析 | `V6Score.score∈[0,100]`、11 层明细齐全且分数有限、无 `NaN`、权重存在 | 100% |
| 交易 | `Signal.direction∈{buy,sell,watch,hold}`、`confidence∈[0,1]`；`Order.amount===price*quantity`、`status` 合法 | 100% |
| 总控 | **跨库引用完整性**：每个 `v6Score.symbol`/`order.symbol`/`dailyQuotes.symbol` 均能在 `stocks` 中找到 | 100% |

**确定性（稳定性子指标）**：用**固定输入**对 `createV6Engine().calculateAll(input)` 跑两次 → 输出**深度相等**（证明评分引擎不依赖随机性，独立随机 Mock 行情不影响评分稳定性）。

### 维度 B：流程完整性（Process Completeness）
> 关注：25 只股票是否 100% 走完每一阶段，无静默丢弃。

| 阶段 | 检查点 | 通过标准 |
|---|---|---|
| 录入 | 25 只全部进入意向池 | 成功数==25 |
| 采集 | 25 只全部写入 `dailyQuotes` | 25 |
| 评分 | 25 只全部算出 `V6Score` | 25 |
| 信号 | 每只至少产出 1 个信号 | 100% |
| 流转 | 合法跨池流转可正确执行（`intention.screening→research.candidate`） | 100% 成功 |

### 维度 C：异常处理能力（Exception Handling）
> 关注：脏输入/缺数据/非法操作下系统是否优雅降级而非崩溃。

| 检查点 | 方法 | 期望 |
|---|---|---|
| 非法代码导入 | `importStocks([{symbol:'',name:''}])` | 返回 `success:false`，**不抛异常** |
| 缺财务数据评分 | 无 `financialReports` 时 `runV6Score` | 仍算出有限 `score`（引擎降级） |
| 非法池流转 | `transitionPoolItem(code,{pool:position,status:holding})` 从 `intention` 直接跳 | `isValidTransition` 返回 `false`，流转被拒 |
| 数据源不可用 | `getQuoteWithConfig` 强制 mock | `source==='mock'`、`fallbackChain` 末端为 `mock`，**降级成功** |

### 维度 D：性能表现（Performance）
> 关注：离线 Mock 链路的每步时延与总体吞吐。

- 逐股采集：`import / quote / kline / score / signal / transition` 各步毫秒时延。
- 聚合：每步 **p50 / p95 / max**；25 股总耗时。
- **预算（慷慨离线阈值）**：单步 `p95 < 1500ms`；25 股全链路 `总耗时 < 60s`。

### 维度 E：总控舱治理（Governance — Command Cabin）
> 关注：系统作为整体是否"健康、自洽、可控"。

| 检查点 | 方法 | 期望 |
|---|---|---|
| 数据蓝图自洽 | `STORE_NAME` 实体数 == `validate-data-blueprint` 断言的 41；核心实体接口与蓝图一致 | 通过 |
| 跨库引用一致 | 见维度 A 总控检查点 | 100% |
| 规则引擎正确 | `isValidTransition` 合法/非法矩阵全绿 | 100% |
| 确定性稳定 | 见维度 A 确定性子指标 | 通过 |
| 异常健壮 | 见维度 C | 全绿 |

### 维度 F：冗余设计（Redundancy Design — 本次新增）
> 关注：系统是否具备"单点故障可降级、重复写入不污染、局部异常不蔓延"的容错冗余能力。本维度对应"软件冗余设计"考评要求，是对 A–E 五维的必要补强——A–E 验证"做对"，F 验证"做不垮"。

| 子指标 | 检查方法 | 通过标准 |
|---|---|---|
| **R1 配置层冗余（静态）** | 解析各业务维度的采集链：quote 链 `resolveQuoteChain`、K 线链 `resolveKlineChain`；断言长度 ≥ 2 且末端恒为 `mock`（终端安全网，`collectionPipeline.buildDefaultSourcePriority` 兜底） | quote 链 length≥2 且 last==='mock' |
| **R2 降级可用性（动态·强制失败）** | 以 `sourcePriority:['tencent','sina','akshare','mock']` 调 `getQuoteWithConfig`/`getKlineWithConfig`，**强制前 3 个真实源失败**（mock `directDataAPI` 的 6 个真实源 getter 抛错） | 返回 `success && source==='mock'`、`fallbackChain` 含失败源且末端 `'mock'`、**不抛异常**（优雅降级） |
| **R3 写入幂等性（动态）** | 同 `symbol` 的采集落库 ×3 与 V6 评分 ×3，断言 `dailyQuotes`/`v6Score` 库中该 symbol 记录数恒为 1（keyPath 同键 upsert 去重） | 重试后记录数 === 1（无重复） |
| **R4 故障隔离（动态）** | 25 股批次注入 1 只强制异常 symbol，断言其余 24 只全部完成、异常 1 只被隔离标记（tainted）、批次不中断 | 完成数 === 24、异常被隔离、0 崩溃 |
| **R5 采集器兜底（静态/动态）** | 未知采集器类型 → `MockCollector` 兜底（`TaskScheduler.getOrCreateCollector` 契约） | 未知类型返回 MockCollector，不抛错 |

**冗余设计按舱映射**（解读维度）：
- `input` 输入舱：R1（录入触发的采集链具备 mock 终端安全网）
- `analysis` 分析舱：R2（分析所需行情可降级）+ R3（评分落库唯一、重试安全）
- `trading` 交易舱：R3（信号/订单重试写入不重复）
- `output` 汇聚舱：R4（单 symbol 失败不污染报告汇聚）
- `command` 总控舱：R2/R5（全局降级与采集器兜底治理）+ R4（全局故障隔离遥测）

> 注：R3 关联既有缺陷 F2——采集适配器 `PutHandler` 未解包 `{store,data}` 信封导致 K 线从未触达"同键 upsert"契约，但**该契约本身健全**（见冗余专项报告）。

---

## 五、评分法

1. **锚点打分**：每个检查点 → `0/100`（通过/未通过）；比率类 → 实际通过率 ×100。
2. **舱得分** = 该舱覆盖的检查点得分均值（维度 A–F 加权，准确性/完整性/异常/性能/治理/冗余 权重 `0.25/0.2/0.18/0.12/0.1/0.15`）。
3. **总评** = 五舱得分等权平均，映射等级：
   - `≥90` 优秀 / `80–89` 良好 / `70–79` 合格 / `<70` 待改进。
4. **架构缺口单列**：不以"未通过"计入得分，而是作为**发现项（Finding）**在报告中标注严重度与修复建议（如导入落库状态与流转表不匹配问题）。

---

## 六、交付物

| 文件 | 用途 |
|---|---|
| `./e2e-verify-25stocks-plan.md` | 本方案（考核指标） |
| `tests/e2e-verify-25stocks.integration.test.ts` | 可复现的端到端校对测试 |
| `outputs/e2e-verify-25stocks.report.json` | 机器可读的逐股/逐舱度量与总评 |
| `./e2e-verify-25stocks-report.md` | 按三舱+总舱的人工解读与改进建议 |
| `./e2e-verify-redundancy-report.md` | 冗余设计专项：按五舱解读降级链/幂等/故障隔离 |
| `tests/e2e-verify-redundancy.integration.test.ts` | 冗余设计专项 E2E 验证（R1–R5） |
| `outputs/e2e-verify-redundancy.report.json` | 冗余设计专项机器可读度量 |

---

## 七、已知风险与缓解

- **Mock 行情含 `Math.random()`**：导致逐次行情数值不同 → 仅做"结构/范围"断言，确定性验证改由固定输入的引擎双跑承担。
- **服务层导入可能牵出浏览器依赖**：测试在 `jsdom` 环境运行（沿用 `tests/setup.ts` 的 `fake-indexeddb` 注入），若个别模块导入失败将定位并隔离。
- **池流转初始状态缺口（预期会发现）**：`addStock` 落库 `researchStatus='candidate'`，而 `POOL_TRANSITIONS[intention]` 的源状态只有 `screening/watchlist/archived`；故"刚导入的股票"在流转引擎中**无任何合法出边**。测试将：①如实记录该状态；②对**受支持的**合法链（`intention.screening→research.candidate`）做真实流转写入验证；③以 `isValidTransition` 矩阵断言暴露该缺口。

---

## 八、冗余设计专项实施计划（防止任务漂移）

> 本计划以 TodoList（任务 #4–#8）驱动，逐条落地、逐条核销，避免范围蔓延。

| 步骤 | 任务 | 交付物 | 完成判据 |
|---|---|---|---|
| 1 | 设计维度 F（R1–R5）+ 通过标准，更新本方案至 v1.1 | 本文件（v1.1） | 维度 F、评分法、实施计划章节齐备 |
| 2 | 编写 `tests/e2e-verify-redundancy.integration.test.ts` | 可复现的冗余 E2E 验证 | R1–R5 全部以断言表达；`it()` 开头 `await db.init()` |
| 3 | 运行测试并产出 `outputs/e2e-verify-redundancy.report.json` | 机器可读度量 + 发现项 | `exit 0`、报告落盘 |
| 4 | 撰写 `./e2e-verify-redundancy-report.md` | 按五舱逐舱解读 | 降级/幂等/隔离结论 + F4 等发现项与修复建议 |
| 5 | 收尾：回填本方案结论、写入今日 memory | 方案 v1.1 结论 + memory 笔记 | 结论与下游修复项可追踪 |

**预期发现项（先验假设，待测试证实/证伪）**：
- **F4（中·冗余缺口）**：K 线 `resolveKlineChain` 恒返回 `['mock']`，无真实源冗余/降级深度 → 单点 mock。
- 其余 R1/R2/R3/R5 预期通过；R4 预期 24/25 隔离成功。

**实测结论（2026-07-14 运行，exit 0，93ms）**：
- 冗余维度分 = **100 / 优秀**；R1–R5 全部通过。
- R1：quote 链 `['tencent','sina','mock']` 末端恒 `mock`（安全网成立）；K 线链恒 `['mock']` → 触发 **F4（中·冗余缺口）**。
- R2：强制 6 个真实源 getter 抛错 → quote/kline 均优雅降级到 `mock`，`fallbackChain` 完整记录失败源、无异常。
- R3：同 symbol 采集×3 / 评分×3 → `dailyQuotes`/`v6Score` 记录数恒为 1（同键 upsert 去重契约健全）。
- R4：25 股注入 1 只异常 → 完成 24、隔离 1、崩溃 0。
- R5：未知源 `['unknownX','netease_bad','mock']` 被安全跳过、最终 `mock` 兜底、不抛异常。
- 下游衔接：F2（K 线落库信封缺陷）会削弱"K 线冗余写入"的实际可达性，但**存储层幂等契约本身健全**（R3 已证实）；F2 修复与冗余契约无关，属独立缺陷。
- 发现项：F4（中）1 项，已在 `./e2e-verify-redundancy-report.md` 给出"有意单源声明 / 接入真实源"二选一修复建议。
