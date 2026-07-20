# V9 数据采集质量 × 效率结合分析与社区案例比对评分报告

> **版本**: v1.0 | **日期**: 2026-07-20
> **输入**: 本地 11 份采集相关 MD/HTM 文档 + 采集链路代码审计 + 社区 6 个优秀案例检索
> **产出**: 质量诊断清单、效率×质量结合点分析、社区比对评分、整体策略建议、补充代码模块

---

## 一、执行摘要

V9 数据采集的核心矛盾**不是架构设计**（多源降级框架、12 条 proxy、三件套监控契约均已就位），而是**真实数据接入率低 + 质量信号未参与效率决策**：

| 关键事实 | 数值 | 出处 |
|---|---|---|
| 采集能力实质实现度 | **~12%** | gap-analysis / route-ui-audit 独立得出同一数字 |
| 8 维真实接入（整改前） | 0~1 维可用，K 线 100% Mock | collection-feasibility-report |
| 8 维真实接入（整改后基线） | 2 维可靠（01/02，成功率 >95%）+ 4 维需适配 + 2 维待替换 | 同上 |
| 静态降级链 | 链顺序硬编码，不感知源健康；mock 强制兜底且 `success:true` 落库 | dataSourceOrchestrator.ts |
| 完整率统计 | `recordCompleteness()` 生产零调用，completeness 恒 0 | qualityMetricsCollector.ts |
| 退避重试 | `fetcherInterceptor` 有完整指数退避但**生产零引用**；fetcherClient 为 tight-loop 重试 | fetcher/ |
| 社区基准得分（10 分制加权） | V9 现状 **3.5** vs 最优案例 **7.5** | 本报告 §四 |

**一句话结论**：V9 需要从「静态降级链 + Mock 兜底」升级为「质量分驱动的自适应源编排」，本次已交付核心模块 `adaptiveSourceOrchestrator.ts`（17 项测试通过），作为该升级的第一步。

---

## 二、本地文档与代码诊断：采集质量低的根因清单

### 2.1 文档侧（11 份文档共识 TOP 问题）

1. **真实数据接入率极低，Mock/Stub 大面积残留** — gap-analysis 测得 0/8 真实接入、Python `collect_endpoints.py` 全为 Mock Stub；route-ui-audit 测得实质完整度 12%、四层降级仅 1/4 层可用；feasibility-report 测得整改前 K 线 100% Mock（网易 DNS 不可达）。
2. **已接入源大量无效/失效链路** — 3 个东财端点因反爬失效（rc:102 / 空响应 / stockCode 过滤失效）被标 UNAVAILABLE；腾讯 `proxy.finance.qq.com` 非公开域名；新浪 L3 返回 HTML 致 `resp.json()` 必失败；网易源已失效仍在注册表（data-collection-optimization-analysis.html 逐项验证）。
3. **降级链设计缺陷** — 无 Token/Key 的源（Tushare/DeepSeek）排在 L1，每次请求"先失败再降级"白白增加延迟；LLM 被误用为"数据源"而非"增强层"。
4. **数据质量不可观测** — 错误被静默吞掉；Mock 与真实无区分（后由 `_source/_fallbackReason` 血缘标记缓解）；六维质量评分实现度仅 5%。
5. **维度 07 correlation/beta 硬编码为 0** — "分析价值为零"，修复 ROI 最高（约 2h，验收标准茅台 correlation 0.5–0.9）。
6. **资讯/新闻采集能力最弱** — 05 维度为唯一 🔴 阻塞维度（东财 push2 需 Cookie/反爬令牌）。
7. **稳定性基建缺失** — 无熔断、无限流、missingReportDetector 默认关闭、调度未实现。

### 2.2 代码侧（链路审计新增发现）

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| C1 | Mock 行情以 `success:true` 真实落库，计入 successRate | dataSourceOrchestrator.ts L88/L414-438 | 假绿灯：监控显示成功但库中是随机价 |
| C2 | `resolveQuoteChain` 强制 push 'mock'，与 `allowMockFallback: !PROD` 配置意图矛盾 | collectionPipeline.ts L224-225 vs L875 | 生产禁 mock 的配置实际不生效 |
| C3 | `recordCompleteness()` 生产零调用 | qualityMetricsCollector.ts | 完整率恒 0，`checkAlerts()` 完整率告警失效 |
| C4 | `realSuccessRate` 已计算但页面未消费（KPI 卡与 DataQualityTab 仍用含 mock 的 successRate） | CollectTaskStatsCards / DataQualityTab | 监控口径失真 |
| C5 | 指数退避死代码；fetcherClient tight-loop 重试；tushareProvider 注释声称重试但无实现 | fetcher/fetcherInterceptor.ts / fetcherClient.ts L81 | 429/5xx 时放大上游压力，加速封禁 |
| C6 | 无限流器、无熔断器、无并发控制（workerPool 零引用）、无增量采集（K线每次全量覆盖） | data-collector/ | 批量采集耗时随 股票数×维度数 线性放大；QUOTA_EXCEEDED 直接降级 |
| C7 | 采集链路零 Zod 校验；契约校验 warn-only 不阻断 | contractValidation.ts | 脏数据可入库 |
| C8 | news id 在 dateTime 缺失时 fallback `Date.now()` | tushareAdapter.ts L143 | 同一新闻重复采集产生重复记录（幂等破坏） |
| C9 | `directDataAPI.ts` 双份副本（646 vs 499 行，签名互不兼容） | fetcher/ vs data-collector/ | 即 AGENTS.md P1-6 已知缺陷 |
| C10 | `mockDataCollection.ts`（998 行 Mock 生成器）滞留生产 services 目录 | data-collector/ | 违反分层规则，应迁 `src/fixtures/` |

---

## 三、效率 × 质量结合点分析

### 3.1 现状：质量与效率是两条互不相交的平行线

```
现状数据流（断裂）：
  采集执行 ──静态链──▶ dataSourceOrchestrator（不感知质量，不感知延迟）
       │
       └─▶ qualityMetricsCollector（记录 realSuccessRate/avgLatency/completeness）
                                          │
                                          ▼
                              仅用于 UI 展示，◀── 且 UI 还没消费 realSuccessRate
                              不回流影响调度决策
```

具体断点：

1. **质量指标不参与源选择**：orchestrator 链顺序写死 `tushare→tencent→sina→…`，即使 tushare 连续 100 次失败（无 Key），每次请求仍先打 tushare 付出 10s 超时再降级——**质量信息存在但没回流**。
2. **效率指标不参与质量判断**：avgLatency 已统计，但延迟劣化（如某源从 200ms 退化到 8s）不触发任何动作；文档 4 定义的"采集延迟 >5s 切换备用源"未实现。
3. **mock 污染双向放大**：mock 计入 successRate（质量口径失真）→ 监控显示健康 → 无人修复失效源 → 真实成功率持续走低。realSuccessRate 正是为打破此循环设计，但未消费。
4. **无反馈闭环**：社区成熟实践的共同点是"采集结果 → 健康评分 → 调度决策"闭环，V9 目前只有前两步的半成品。

### 3.2 结合模型：质量×效率双维评分驱动自适应编排

本次补充的 `adaptiveSourceOrchestrator.ts` 实现如下结合模型：

```
qualityScore   = 0.4 × realSuccessRate + 0.3 × completenessRate + 0.3 × (1 − mockRatio)
efficiencyScore = 1/(1+ln(1+ewmaLatency/1000)) × tokenBucketAvailability
combinedScore  = qualityWeight × quality + efficiencyWeight × efficiency
                 （熔断 open 的源恒为 0，沉底）

采集结果 ─▶ recordSourceResult() ─▶ EWMA 更新 + 熔断联动 + 评分刷新
                                              │
                                              ▼
调度决策 ◀── orderChainAdaptive()（按 combinedScore 降序重排降级链）
```

该模型的三个关键设计取舍（对照社区实践）：

- **EWMA 而非滑动窗口**：TradingAgents 用自适应缓存 TTL、resilience 文献普遍用 EWMA，单次请求 O(1) 更新，浏览器端无需维护窗口数组。
- **熔断优先于评分**：open 源直接 combinedScore=0 而非参与打分，避免"评分抖动导致半死源反复被选中"（对照 circuit-breaker 文献的 fail-fast 原则）。
- **质量/效率权重可配**：`AdaptiveSourceConfig.qualityWeight/efficiencyWeight` 允许盘前批量场景调高效率权重、复盘分析场景调高质量权重——这是"效率与质量结合"的落点，不是固定公式。

### 3.3 尚未结合、建议后续接入的点

| 结合点 | 现状 | 建议 |
|---|---|---|
| 完整率 → 调度 | recordCompleteness 零调用 | 在 writeQuoteToStock/writeKlineToDailyQuotes 接入，纳入 qualityScore |
| 跨源一致性 → 质量分 | 无（方案对比文档提出"偏差 >1% 告警"但未实现） | 双源同取时计算偏差率，作为 consistencyRate 纳入评分 |
| 新鲜度 → 效率 | freshnessGuard 服务 analysis 域，未接采集侧 | K线按 DB 最大 trade_date 增量拉取，既提质（避免全量覆盖写）又提效 |
| 配额 → 源排序 | QUOTA_EXCEEDED 直接降级 | 令牌桶 + 退避队列，Tushare 积分耗尽自动沉底而非每次报错 |

---

## 四、社区优秀案例比对评分

### 4.1 案例清单与核心做法

| 案例 | 类型 | 核心做法 | 来源 |
|---|---|---|---|
| **TradingAgents-CN** | 多智能体交易框架 | 数据源注册表 + 自动选源（Tushare→AKShare→BaoStock）；L1 Redis/L2 MongoDB/L3 文件三级自适应缓存；新闻三级质量过滤与相关性打分 | [架构分析](https://zhichai.net/topic/176360520)、[框架解析](https://refft.com/hsliuping_TradingAgents-CN.html) |
| **QUANTAXIS** | 一站式量化框架 | 数据爬取→清洗存储→分析回测全链路本地闭环；标准化协议 + 一键运维更新；事件驱动多线程引擎 | [GitHub](https://github.com/yutiansut/QUANTAXIS)、[火山引擎文章](https://developer.volcengine.com/articles/7383077405021192243) |
| **market_data_fetcher** | MCP 数据服务 | Longport/AKShare/Yahoo 自动降级链，MCP 协议封装 | [GitHub](https://github.com/xhqing/market_data_fetcher) |
| **Java 主备架构（cnblogs）** | 工程实践文章 | 主备源选择器；Redis 5min 缓存 + 降级返回最近缓存；UA 池 + 单 IP 60 次/分频率控制；成功率 <90% Prometheus 告警；DTO 字段非空校验 | [cnblogs](https://www.cnblogs.com/Chary/articles/19488039) |
| **a-share-content-automation** | Skill 知识库 | AKShare 端点实测覆盖清单；陷阱文档（iloc[-1] 取最新、非交易日校验、涨跌停过滤、push2 晚间不可用的 Sina 兜底时段表） | [LobeHub](https://lobehub.com/skills/pebynn-hermes-config-a-share-content-automation) |
| **Great Expectations / Pandera** | 数据质量方法论 | Expectation Suite 即"数据的单元测试"；Fail-fast 质量门；schema 推断快速起步；流式场景采样校验 | [GX 指南](https://www.datatoinsights.ai/blog/great-expectations-the-complete-guide-to-ensuring-data-quality-in-modern-data-pipelines-baac3d)、[endjin 对比](https://endjin.com/blog/a-look-into-pandera-and-great-expectations-for-data-validation) |
| **Resilience 模式文献** | 韧性工程方法论 | 令牌桶限流 + 指数退避全抖动 + 熔断器三件套；Retry-After 优先；幂等键防重复；429 比例/重试深度/熔断状态为核心指标 | [backoff 指南](https://sreschool.com/blog/exponential-backoff)、[配额管理](https://truto.one/blog/how-to-manage-third-party-api-quotas-across-internal-microservices/)、[429 风暴防御](https://www.mfun.ink/en/2026/03/18/go-openai-429-5xx-storm-defense-token-bucket-backoff-circuit-breaker/) |

### 4.2 评分模型与结果

评分维度（权重）：数据源接入与降级编排 20% / 数据质量校验与治理 25% / 效率机制（限流/缓存/并发/增量）20% / 可观测性与告警 15% / 质量×效率联动 10% / 工程化与测试 10%。10 分制。

| 案例 | 接入编排 20% | 质量治理 25% | 效率机制 20% | 可观测 15% | 质量×效率联动 10% | 工程化 10% | **加权总分** |
|---|---|---|---|---|---|---|---|
| **V9 现状** | 4 | 3 | 3 | 4 | 1 | 6 | **3.5** |
| **V9 + 本次模块（已交付）** | 4 | 4 | 6 | 4 | 7 | 7 | **4.9** |
| TradingAgents-CN | 9 | 7 | 8 | 6 | 7 | 7 | **7.5** |
| QUANTAXIS | 8 | 8 | 7 | 6 | 5 | 8 | **7.2** |
| a-share-content-automation | 7 | 8 | 6 | 6 | 6 | 7 | **6.8** |
| Java 主备架构 | 7 | 6 | 7 | 8 | 5 | 6 | **6.6** |
| market_data_fetcher | 8 | 5 | 6 | 5 | 5 | 7 | **6.0** |

> 方法论参照（不参与系统总分）：Great Expectations/Pandera 在"质量治理"单维为 10 分标杆；Resilience 文献在"效率机制"单维为 9 分标杆。V9 的 GX 对应物应是已规划的 Zod schema 校验（`src/schema/`）+ 契约校验升级为可配置阻断。

### 4.3 差距解读

- **V9 最大的单一短板是"质量×效率联动"（1 分）**：所有成熟案例都有某种形式的反馈闭环（自动选源 / 降级返回缓存 / 成功率告警触发处置），V9 此前完全没有。本次模块将该项拉至 7 分。
- **效率机制（3 分）是第二短板**：退避死代码、无限流、无并发、无增量——而效率低会反噬质量（tight-loop 重试加速 IP 封禁 → 更多源失效 → 更多 mock）。
- **V9 的比较优势在工程化纪律**（分层契约、测试基建、血缘标记、三件套），6 分已接近 QUANTAXIS；补齐质量治理后有望快速追赶。
- **TradingAgents 的注册表 + 三级缓存**和 **a-share skill 的端点实测清单/陷阱文档**是最值得直接借鉴的两项低成本实践。

---

## 五、整体策略建议（是否有更好的策略？）

**有。** 当前策略本质是"静态降级链 + Mock 兜底"，社区更优策略收敛为一句话：**「源健康评分驱动的自适应编排 + 本地数据资产化 + 质量门 fail-fast」**。分三层落地：

### P0（1~2 天，质量止血）

1. **监控口径切换**：KPI 卡与 DataQualityTab 改用/并列 `realSuccessRate`（数据已存在，只差 UI 消费）。
2. **生产禁写 mock 行情**：`resolveQuoteChain` 不再强制 push 'mock'，让 `allowMockFallback` 生效；全源失败返回 `success:false` 而非随机价落库。
3. **接通 recordCompleteness**：写入路径调用完整率统计，激活 `checkAlerts()` 完整率告警。
4. **接入本次模块**：`orderChainAdaptive` 接入 `dataSourceOrchestrator.resolveQuoteChain`，`recordSourceResult` 包裹各源采集调用——静态链变自适应链。
5. **退避接入**：`fetcherInterceptor.calculateBackoff` 接入 fetcherClient 与 tushareProvider（或删除死代码统一走新模块的 `computeRetryDelayMs`）。

### P1（1 周，效率×质量闭环）

6. **源级令牌桶 + 配额退避**：Tushare 积分/东财按 IP 限速纳入令牌桶；429/QUOTA_EXCEEDED 进退避队列而非直接降级（对照 resilience 三件套）。
7. **增量采集**：K线按 dailyQuotes 最大 trade_date 增量拉取；news 按 lastCollectedAt 增量；news id 改内容 hash 修复幂等。
8. **有限并发**：handleCollectAllDims 串行双循环接入 workerPool（任务清单文档已定：批次 10 并行、批间隔 200ms）。
9. **校验升级**：采集写入接入 `src/schema/` Zod 校验（GX/Pandera 的 TS 对应物），契约校验从 warn-only 升级为可配置阻断 + 隔离区。
10. **端点实测清单**：参照 a-share skill，为 12 条 proxy + 各源端点建立"实测可用性登记表 + 陷阱文档"（含时段性失效如 push2 晚间兜底）。

### P2（2~4 周，资产化与进阶）

11. **本地数据资产层**：参照 QUANTAXIS/TradingAgents，建立 IndexedDB 之上的多级缓存与"数据资产清单"消费视图，采集从"按需实时拉"转向"预构建字典 + 增量维护"（东财 5000+ 行业字典方案已在 TODOLIST）。
12. **跨源一致性校验**：双源同取偏差 >1% 告警（方案对比文档已提出），consistencyRate 纳入质量分。
13. **directDataAPI 双份收敛**（P1-6 阶段 2）+ mockDataCollection 迁 fixtures + taskStatuses 持久化。
14. **黑天鹅/资讯引擎**：按 gap-analysis 的 P0/P1 路线推进资讯爬虫 MVP + 三级去重 + 事件 Schema。

---

## 六、本次交付的补充代码

| 交付物 | 路径 | 验证 |
|---|---|---|
| 自适应源编排模块（399 行） | `src/services/data-collector/adaptiveSourceOrchestrator.ts` | `tsc --noEmit` 生产+测试双配置零错误 |
| 单元测试（17 例） | `tests/__tests__/services/adaptiveSourceOrchestrator.spec.ts` | vitest 17/17 通过 |

导出清单：`TokenBucketLimiter`（按源隔离的令牌桶）、`SourceCircuitBreaker`（closed/open/half-open 三态熔断）、`recordSourceResult()`（EWMA 指标 + 熔断联动）、`computeCombinedScore()`（质量×效率综合分）、`orderChainAdaptive()`（降级链自适应重排，open 沉底）、`computeRetryDelayMs()`（指数退避+全抖动）、`DEFAULT_ADAPTIVE_CONFIG`。

**设计说明**：模块自包含、零侵入——不修改 orchestrator 现有逻辑，`orderChainAdaptive` 作为独立函数待 P0-4 集成时调用；`SourceHealthMetrics` 额外引入 `mockRatio` 字段（质量分公式需要 (1−mockRatio)，无法从 realSuccessRate 严格推导）。

---

## 附录 A：本地文档输入清单

1. `docs/explanation/design/data-collection-architecture.md`（v0.9.0，架构设计）
2. `docs/explanation/design/data-collection-gap-analysis.md`（v1.0，差距 ~88%）
3. `docs/reference/collection-contract.md`（v1.0.0，⚠️ 中文内容损坏，仅骨架可读）
4. `docs/reference/data-collection-task-list.md`（v2.0，六指标告警阈值）
5. `docs/reference/data-collection-route-ui-audit.md`（v1.0，实质完整度 12%）
6. `docs/reference/网页测试检索校对纳入采集方案分析.md`（⚠️ 中文内容损坏）
7. `deliverables/data-collection-optimization-todolist.md`（2026-07-19）
8. `deliverables/collection-solution-comparison.md`（2026-07-19，方案 D 推荐）
9. `deliverables/collection-feasibility-report.md`（2026-07-19）
10. `deliverables/personal-research-low-cost-data-collection-report.md`（v1.0）
11. `data-collection-optimization-analysis/data-collection-optimization-analysis.html`（2026-07-19）

> ⚠️ 附带发现：文档 3、6 中文内容已不可逆损坏（编码写入事故，全部替换为 `?`），且 docs-backup 目录无完好副本，建议从 git 历史恢复或重新生成——否则 AGENTS.md"文档即真相源"约束在该两处失效。

## 附录 B：社区来源清单

- TradingAgents-CN 架构分析: https://zhichai.net/topic/176360520 ；框架解析: https://refft.com/hsliuping_TradingAgents-CN.html ；数据源选型实践: https://blog.gitcode.com/e8ac527f108c4e4b23b88dfe35cdc560.html
- QUANTAXIS: https://github.com/yutiansut/QUANTAXIS ；https://developer.volcengine.com/articles/7383077405021192243
- market_data_fetcher: https://github.com/xhqing/market_data_fetcher
- Java 主备架构: https://www.cnblogs.com/Chary/articles/19488039
- a-share-content-automation: https://lobehub.com/skills/pebynn-hermes-config-a-share-content-automation
- Great Expectations: https://www.datatoinsights.ai/blog/great-expectations-the-complete-guide-to-ensuring-data-quality-in-modern-data-pipelines-baac3d ；https://www.conduktor.io/glossary/great-expectations-data-testing-framework ；Pandera 对比: https://endjin.com/blog/a-look-into-pandera-and-great-expectations-for-data-validation
- Resilience 模式: https://sreschool.com/blog/exponential-backoff ；https://truto.one/blog/how-to-manage-third-party-api-quotas-across-internal-microservices/ ；https://www.mfun.ink/en/2026/03/18/go-openai-429-5xx-storm-defense-token-bucket-backoff-circuit-breaker/ ；https://totoro-jam.github.io/battle-tested-patterns/patterns/retry-backoff/
