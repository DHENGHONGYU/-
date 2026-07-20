---
title: 冗余设计专项端到端验证报告（R1–R5�?
type: reports
domain: qa
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "Version：v1.0 | 日期�?026-07-14 关联方案：`docs/reports/e2e-verify-25stocks-plan.md`（维�?F · v1.1�?>..."
tags: [qa, test, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---orts
domain: qa
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [qa, test, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 冗余设计专项端到端验证报告（R1–R5�?
> **Version**：v1.0 | **日期**�?026-07-14
> **关联方案**：`docs/reports/e2e-verify-25stocks-plan.md`（维�?F · v1.1�?> **测试脚本**：`tests/e2e-verify-redundancy.integration.test.ts`
> **机器可读**：`outputs/e2e-verify-redundancy.report.json`
> **抽样**：种�?`20260714`，规�?25 股；强制失败注入�?`directDataAPI` �?6 个真实源 getter（`tencentQuote`/`sinaQuote`/`akshareQuote`/`tencentBatchQuotes`/`sinaBatchQuotes`/`neteaseHistory`）上�?`vi.mock` 抛错，确保确定性、离线、可复现�?
---

## 一、总评：冗余设�?100 / 优秀

| 子指�?| 结果 | 一句话 |
|---|---|---|
| R1 配置层冗余（静态） | �?通过 | quote �?`tencent→sina→mock`，末端恒 `mock` 安全�?|
| R2 降级可用性（动态·强制失败） | �?通过 | 真实源全失败 �?优雅降级�?`mock`，`fallbackChain` 记录失败源、无异常 |
| R3 写入幂等性（动态） | �?通过 | �?symbol 采集×3 / 评分×3 �?库内记录数恒�?1 |
| R4 故障隔离（动态） | �?通过 | 25 股注�?1 只异�?�?24 完成�? 隔离�? 崩溃 |
| R5 采集�?数据源兜底（动态） | �?通过 | 未知�?ID 被安全跳过、`mock` 兜底、不抛异�?|

维度得分 = R1–R5 均�?= **100**（优秀）。总耗时 **93ms**（预�?<60s）�?
---

## 二、按「三�?总舱」逐舱解读

冗余设计维度对应的是"软件做不�?的能力——A–E 五维验证"做对"，F 验证"做不�?。其基座贯穿五舱�?
### 输入�?`input`（冗余基座：安全�?+ 兜底�?- **R1**：录入触发的采集链在配置层即具备 `mock` 终端安全网——`resolveQuoteChain` 解析出的 quote 链为 `['tencent','sina','mock']`，长�?�?2 且末端恒 `mock`；`buildDefaultSourcePriority` 兜底保证**任何维度都至少含 mock**，即"永远不会因为没有数据源而整体失�?�?- **R5**：录入若携带未知/不支持的数据�?ID（如 `unknownX`），降级链会**安全跳过**该源并继续向 `mock` 兜底，录入不抛异常�?- 结论：输入舱的冗余基座健全——单点故障（某行情源挂掉）不会阻断录入�?
### 分析�?`analysis`（冗余基座：可降�?+ 幂等�?- **R2**：分析所需实时行情在真实源（腾�?新浪）全部失败时�?*自动降级�?mock 且不中断**，`source==='mock'`、`fallbackChain` 完整记录降级轨迹。这意味着离线/断网环境下分析内核（V6 评分）仍可运行�?- **R3**：V6 评分落库**幂等**——同一 symbol 重复评分 ×3，库�?`v6Score` 记录数恒�?1（keyPath 同键 upsert）。这�?重试/补偿不污�?的硬契约：分析任务即使被重试、被重放，也不会产生重复评分�?- ⚠️ **与既有缺�?F2 的关�?*�?5 股报告中�?F2（`PutHandler` 未解�?`{store,data}` 信封，致 K 线从未触�?`dailyQuotes`）会�?重试采集"在适配器层失败；但 **R3 证明存储层幂等契约本身健�?*——一�?F2 修复，重试即可安全去重�?- ⚠️ **K 线仅 mock 单源（F4�?*：见第三节�?
### 交易�?`trading`（冗余基座：写入幂等�?- **R3**：信�?订单的写入路径同样依�?`keyPath` 同键 upsert 契约，重复下�?重复信号生成不会在库内产生重复记录——这是交易侧"重试安全"的冗余保证�?- 注：交易下单�?25 股报告中�?F2（行情未持久�?�?`checkOrderRisk` 拒单）�?`orderOk=0`，但那属�?*数据可达�?*问题，与"冗余设计"维度的幂等契约无直接冲突；R3 仅验证存储层去重契约�?
### 汇聚�?`output`（冗余基座：故障隔离�?- **R4**：单只股票在采集/评分链路中抛出异常（本测试注�?1 只强制故障），汇聚层**隔离**该异常——其�?24 只全部完成、故�?1 只被标记�?tainted、整个批�?*不中断、不崩溃**。这直接保证"一只股票的数据�?异常，不会污染研究报�?复盘等汇聚产�?�?
### 总控�?`command`（冗余基座：全局治理�?- **R2 + R5**：全局降级与数据源/采集器兜底契约健全（单点故障可降级、未知源可跳过）�?- **R4**：全局故障隔离能力经实测可观测�?4/25 隔离成功），为总控的健康度遥测、异常矩阵提供可信的底层冗余基座�?- 结论：总控舱所监控�?系统是否做不�?，其下层冗余机制本专项已逐项证实�?
---

## 三、发现项（Finding�?
### F4 �?K 线采集链恒为 `mock` 单源，无真实源冗�?降级深度（中·冗余缺口�?- **现象**：`resolveKlineChain(dimension)` �?quote 链中 `id==='mock'` 的子集；�?`buildDefaultSourcePriority` 永远注入 `mock`，故 **K 线解析链恒为 `['mock']`**。`tryKlineSource` 仅支�?`netease`/`mock` 两种源，`tencent`/`sina`/`akshare` 直接 `warn("不支�?K �?)` 并跳过�?- **冗余含义**：K 线数据永远走**单一 mock �?*，没�?真实�?�?mock"的降级深度。在冗余设计语义下，这是**单点 mock**——若 mock 生成器异常，K 线将无兜底�?- **证据**：`resolveKlineChain(多源维度) === ["mock"]`（见报告 `klineChain`）�?- **修复建议（二选一�?*�?  1. **有意单源**：若 K 线在「日常开发」离线边界下只需 mock，请显式�?`resolveKlineChain` 注释 + 文档声明"K 线仅 Mock，有意设�?，消�?疑似缺口"的歧义；
  2. **接入真实�?*：为 K 线接入真实源（如 AKShare/网易历史），形成 `[akshare, netease, mock]` 多源降级链，真正具备冗余深度�?
> 说明：F4 不影�?R2/R3/R4/R5 的通过（mock 兜底本身工作正常），它是一�?*设计意图待澄�?*的冗余缺口，优先级中�?
---

## 四、与 25 股主报告的衔�?
| 维度 | 25 股主报告 | 冗余专项 |
|---|---|---|
| 数据准确�?/ 流程完整�?/ 异常 / 性能 / 治理 | input100/analysis100/trading67/output50/command75（总分 78 合格�?| �?|
| **冗余设计（F�?* | �?| **100 / 优秀**（R1–R5 全绿�?|

- 主报告的 `trading=67` �?F2（K 线落库信封缺陷）级联导致；冗余专项证�?*存储层幂等契约健�?*，F2 修复后交易舱冗余基座即可完整生效�?- 两报告合并时，建议将"冗余"作为第六个等权参与舱/总评（权�?0.15，见方案 v1.1 §五），形�?**A–F 六维**完整考评�?
---

## 五、交付物

| 文件 | 用�?|
|---|---|
| `docs/reports/e2e-verify-redundancy-report.md` | 本按舱解读报�?|
| `tests/e2e-verify-redundancy.integration.test.ts` | 可复现的冗余 E2E 验证（R1–R5�?|
| `outputs/e2e-verify-redundancy.report.json` | 机器可读度量 + 发现�?|
| `docs/reports/e2e-verify-25stocks-plan.md`（v1.1�?| 维度 F 定义 + 实施计划第八�?|
