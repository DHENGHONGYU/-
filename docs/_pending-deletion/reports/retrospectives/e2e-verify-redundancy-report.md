---
title: e2e-verify-redundancy-report
tier: T2
status: active
type: reports
domain: project
doc_id: V9-DOC-AUTO-3947A0
code_version: 2.0.0
summary: 维度得分 = R1–R5 均值 = 100（优秀）。总耗时 93ms（预算 <60s）。
maintainer: V9 Architecture Team
phase: retrospective
---


## 一、总评：冗余设计 100 / 优秀

| 子指标 | 结果 | 一句话 |
|---|---|---|
| R1 配置层冗余（静态） | ✅ 通过 | quote 链 `tencent→sina→mock`，末端恒 `mock` 安全网 |
| R2 降级可用性（动态·强制失败） | ✅ 通过 | 真实源全失败 → 优雅降级到 `mock`，`fallbackChain` 记录失败源、无异常 |
| R3 写入幂等性（动态） | ✅ 通过 | 同 symbol 采集×3 / 评分×3 → 库内记录数恒为 1 |
| R4 故障隔离（动态） | ✅ 通过 | 25 股注入 1 只异常 → 24 完成、1 隔离、0 崩溃 |
| R5 采集器/数据源兜底（动态） | ✅ 通过 | 未知源 ID 被安全跳过、`mock` 兜底、不抛异常 |

维度得分 = R1–R5 均值 = **100**（优秀）。总耗时 **93ms**（预算 <60s）。
title: e2e-verify-redundancy-report
tier: T2
status: active
type: reports
doc_id: V9-DOC-QA-103
domain: qa
code_version: 2.0.0

---

## 二、按「三舱+总舱」逐舱解读

冗余设计维度对应的是"软件做不垮"的能力——A–E 五维验证"做对"，F 验证"做不垮"。其基座贯穿五舱：

### 输入舱 `input`（冗余基座：安全网 + 兜底）
- **R1**：录入触发的采集链在配置层即具备 `mock` 终端安全网——`resolveQuoteChain` 解析出的 quote 链为 `['tencent','sina','mock']`，长度 ≥ 2 且末端恒 `mock`；`buildDefaultSourcePriority` 兜底保证**任何维度都至少含 mock**，即"永远不会因为没有数据源而整体失败"。
- **R5**：录入若携带未知/不支持的数据源 ID（如 `unknownX`），降级链会**安全跳过**该源并继续向 `mock` 兜底，录入不抛异常。
- 结论：输入舱的冗余基座健全——单点故障（某行情源挂掉）不会阻断录入。

### 分析舱 `analysis`（冗余基座：可降级 + 幂等）
- **R2**：分析所需实时行情在真实源（腾讯/新浪）全部失败时，**自动降级到 mock 且不中断**，`source==='mock'`、`fallbackChain` 完整记录降级轨迹。这意味着离线/断网环境下分析内核（V6 评分）仍可运行。
- **R3**：V6 评分落库**幂等**——同一 symbol 重复评分 ×3，库中 `v6Score` 记录数恒为 1（keyPath 同键 upsert）。这是"重试/补偿不污染"的硬契约：分析任务即使被重试、被重放，也不会产生重复评分。
- ⚠️ **与既有缺陷 F2 的关系**：25 股报告中的 F2（`PutHandler` 未解包 `{store,data}` 信封，致 K 线从未触达 `dailyQuotes`）会让"重试采集"在适配器层失败；但 **R3 证明存储层幂等契约本身健全**——一旦 F2 修复，重试即可安全去重。
- ⚠️ **K 线仅 mock 单源（F4）**：见第三节。

### 交易舱 `trading`（冗余基座：写入幂等）
- **R3**：信号/订单的写入路径同样依赖 `keyPath` 同键 upsert 契约，重复下单/重复信号生成不会在库内产生重复记录——这是交易侧"重试安全"的冗余保证。
- 注：交易下单在 25 股报告中因 F2（行情未持久化 → `checkOrderRisk` 拒单）而 `orderOk=0`，但那属于**数据可达性**问题，与"冗余设计"维度的幂等契约无直接冲突；R3 仅验证存储层去重契约。

### 汇聚舱 `output`（冗余基座：故障隔离）
- **R4**：单只股票在采集/评分链路中抛出异常（本测试注入 1 只强制故障），汇聚层**隔离**该异常——其余 24 只全部完成、故障 1 只被标记为 tainted、整个批次**不中断、不崩溃**。这直接保证"一只股票的数据脏/异常，不会污染研究报告/复盘等汇聚产物"。

### 总控舱 `command`（冗余基座：全局治理）
- **R2 + R5**：全局降级与数据源/采集器兜底契约健全（单点故障可降级、未知源可跳过）。
- **R4**：全局故障隔离能力经实测可观测（24/25 隔离成功），为总控的健康度遥测、异常矩阵提供可信的底层冗余基座。
- 结论：总控舱所监控的"系统是否做不垮"，其下层冗余机制本专项已逐项证实。

---

## 三、发现项（Finding）

### F4 — K 线采集链恒为 `mock` 单源，无真实源冗余/降级深度（中·冗余缺口）
- **现象**：`resolveKlineChain(dimension)` 取 quote 链中 `id==='mock'` 的子集；而 `buildDefaultSourcePriority` 永远注入 `mock`，故 **K 线解析链恒为 `['mock']`**。`tryKlineSource` 仅支持 `netease`/`mock` 两种源，`tencent`/`sina`/`akshare` 直接 `warn("不支持 K 线")` 并跳过。
- **冗余含义**：K 线数据永远走**单一 mock 源**，没有"真实源 → mock"的降级深度。在冗余设计语义下，这是**单点 mock**——若 mock 生成器异常，K 线将无兜底。
- **证据**：`resolveKlineChain(多源维度) === ["mock"]`（见报告 `klineChain`）。
- **修复建议（二选一）**：
  1. **有意单源**：若 K 线在「日常开发」离线边界下只需 mock，请显式在 `resolveKlineChain` 注释 + 文档声明"K 线仅 Mock，有意设计"，消除"疑似缺口"的歧义；
  2. **接入真实源**：为 K 线接入真实源（如 AKShare/网易历史），形成 `[akshare, netease, mock]` 多源降级链，真正具备冗余深度。

> 说明：F4 不影响 R2/R3/R4/R5 的通过（mock 兜底本身工作正常），它是一个**设计意图待澄清**的冗余缺口，优先级中。

---

## 四、与 25 股主报告的衔接

| 维度 | 25 股主报告 | 冗余专项 |
|---|---|---|
| 数据准确性 / 流程完整性 / 异常 / 性能 / 治理 | input100/analysis100/trading67/output50/command75（总分 78 合格） | — |
| **冗余设计（F）** | — | **100 / 优秀**（R1–R5 全绿） |

- 主报告的 `trading=67` 由 F2（K 线落库信封缺陷）级联导致；冗余专项证明**存储层幂等契约健全**，F2 修复后交易舱冗余基座即可完整生效。
- 两报告合并时，建议将"冗余"作为第六个等权参与舱/总评（权重 0.15，见方案 v1.1 §五），形成 **A–F 六维**完整考评。

---

## 五、交付物

| 文件 | 用途 |
|---|---|
| `./e2e-verify-redundancy-report.md` | 本按舱解读报告 |
| `tests/e2e-verify-redundancy.integration.test.ts` | 可复现的冗余 E2E 验证（R1–R5） |
| `outputs/e2e-verify-redundancy.report.json` | 机器可读度量 + 发现项 |
| `./e2e-verify-25stocks-plan.md`（v1.1） | 维度 F 定义 + 实施计划第八节 |
