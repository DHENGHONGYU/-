---
doc_id: V9-DOC-REF-943
title: "KPI 口径目录（Store → MetricCard 消费映射）"
domain: data
status: active
last_updated: 2026-08-15
---

# KPI 口径目录（Store → MetricCard 消费映射）

> 本文档由 P2-3 治理自动整理（2026-08-13），列出 V9 系统 3 个核心 Store 中所有带 `KPI-XX` 编号字段的口径、单位、阈值建议和消费者。
> 产品/运营可据此理解每个指标卡的含义；开发可据此定位 Store 字段和 @example 消费代码。

---

## 1. sevenDimConfigStore（七维采集配置）

| KPI-ID | 字段名 | 单位 | 口径 | 范围/默认 | 刷新时机 | 消费者 MetricCard |
|--------|--------|------|------|-----------|----------|-------------------|
| KPI-01 | `activeTemplate` | — | 策略模板 ID（full/lite/conservative/custom） | @default `'full'` | `applyTemplate()` / `saveConfig()` | 模板切换下拉框 |
| KPI-02 | `dimensions` | — | 10 维度采集管线配置数组 | 10 项 | `toggleDimension / setDimension*` | 「已启用 X/10 维度」MetricCard |
| KPI-03 | `global` | — | 全局限流/批量/超时/通知策略 | maxSymbols=1000 | `setGlobalPolicy()` | 配置面板 |
| KPI-04 | `symbolCount` | 只 | 本次采集预期标的数 | [1, 1000] @default 40 | `setSymbolCount()` | 「预期采集标的数」MetricCard（color=info） |
| KPI-05 | `historyDays` | 交易日 | 基本面指标样本窗口 | @default 252 | `setHistoryDays()` | 「历史回溯窗口」MetricCard（color=purple） |
| KPI-06 | `collectProgress` | % | (已完成维度任务数 × 权重) / 总任务数 × 100 | [0, 100] @default 0 | `COLLECTION_EVENTS.TASK_PROGRESS` | 「采集中...」MetricCard（color=warning） |
| KPI-07 | `getCollectionConfig()` | — | 导出完整采集配置结构化对象（含 version + updatedAt） | — | `runCollection()` / `saveConfig()` | 内部消费 |
| KPI-DER-01 | `enabledCount()` | 个 | `dimensions.filter(d => d.enabled).length` | 0~10 | 实时计算 | 「已启用维度」MetricCard（color=scoreHigh） |
| KPI-DER-02 | `monthlyCallEstimate()` | 次/月 | 维度 × 频率 × 标的数 线性预估 | ≥0 | 实时计算 | 「月度调用预估」MetricCard（color=emerald） |

---

## 2. collectionRuntimeStore（采集运行时质量）

| KPI-ID | 字段名 | 单位 | 口径 | 范围 | 刷新时机 | 消费者 MetricCard | 阈值建议 |
|--------|--------|------|------|------|----------|-------------------|----------|
| KPI-01 | `overallProgress` | % | (∑ 已完成子任务权重) / (∑ 全部权重) × 100 | [0, 100] | `BATCH_PROGRESS` 事件 | HomePage 环形进度 | — |
| KPI-02 | `stats.successRate` | % | successCollects / totalCollects × 100（含 Mock） | [0, 100] | 每次 SOURCE_* 事件 | 「采集成功率」MetricCard | <80 → danger 红 |
| KPI-02 | `stats.realSuccessRate` | % | (success - mockSuccess) / (total - mock) × 100 | [0, 100] 或 0 | 同上 | change 展示「实 XX%」 | — |
| KPI-02 | `stats.completeness` | % | 字段级完整率（成功字段数 ÷ 目标 schema 字段数）× 100 | [0, 100] | SOURCE_SUCCESS 后 | 「字段完整率」MetricCard | <70 → warning 琥珀 |
| KPI-02 | `stats.writeRate` | % | writeSuccess / writeTotal × 100 | [0, 100] | WRITE_* 事件 | 「写入成功率」MetricCard | <95 → warning 琥珀 |
| KPI-02 | `stats.avgLatency` | ms | 平均端到端延迟（请求→writeSuccess 返回） | ≥0 | 每次任务 COMPLETE | 「平均端到端延迟」MetricCard | >2000 → warning；>3000 → danger |
| KPI-02 | `stats.fallbackCount` | 次 | 主源失败后 Fallback 链路成功/失败总次数 | ≥0 | FALLBACK / FALLBACK_FAIL | change 展示 | >successRate×2 → 主源不稳定 |
| KPI-02 | `stats.totalCollects` | 次 | 累计采集请求数 | ≥0 | 每次 SOURCE_* 事件 | 内部统计 | — |
| KPI-02 | `stats.successCollects` | 次 | 累计成功请求数（含 Fallback 成功） | ≥0 | 同上 | 内部统计 | — |
| KPI-02 | `stats.mockCollects` | 次 | 使用 mock 源的请求数 | ≥0 | 同上 | change 展示「含 mock N 次」 | — |
| KPI-02 | `stats.sourceCounts` | 次/源 | 各数据源调用次数分布 {tushare,tencent,sina,netease,akshare,mock} | 每项 ≥0 | 每次请求结束 | change 展示 Top 2 源 | — |
| KPI-02 | `stats.writeSuccess` | 次 | DataBridge.forward() 写入成功次数 | ≥0 | WRITE_SUCCESS | change 展示「N/M」 | — |
| KPI-02 | `stats.writeTotal` | 次 | 尝试写入总数（含 WRITE_FAIL） | ≥0 | WRITE_* 事件 | change 展示 | — |

### 质量报警阈值速查

| 指标 | 正常 | 警告 | 危险 | MetricCard color |
|------|------|------|------|-------------------|
| successRate | ≥90 | 70~89 | <70 | scoreHigh / scoreMid / scoreLow |
| completeness | ≥85 | 60~84 | <60 | scoreHigh / scoreMid / scoreLow |
| writeRate | ≥95 | 85~94 | <85 | scoreHigh / scoreMid / scoreLow |
| avgLatency | ≤800 | 801~2000 | >2000 | scoreHigh / scoreMid / scoreLow |

---

## 3. dataflowStore（数据流引擎健康）

> @internal — 已实现但当前无 UI 层消费者，待产品规划接入（建议接入点：SystemMonitor / EngineStatus 健康仪表盘）

| KPI-ID | 字段名 | 单位 | 口径 | 刷新时机 | 消费者 MetricCard（规划中） | 阈值建议 |
|--------|--------|------|------|----------|-----------------------------|----------|
| KPI-01 | `connected` | — | 引擎是否至少 1 条活连接 | DATAFLOW_CONNECTED/DISCONNECTED | 「数据引擎状态」MetricCard | — |
| KPI-02 | `channels` | Map | channelName → {订阅者数, 最后发布时间戳} | updateChannelSubscribers() | 「活跃通道/总通道」MetricCard | lastPublish-Date.now()>60s 且 subscribers>0 → 卡死 |
| KPI-03 | `cache` | Map | 最近一次 publish 的 payload（按 channel） | updateCache() | 调试面板 | — |
| KPI-04 | `stats.publishes` | 次 | 累计发布次数 | refreshStats() | change 展示「累计 N」 | — |
| KPI-04 | `stats.publishesPerSecond` | msg/s | 最近 5s 滑动窗口 TPS | refreshStats() | 「发布吞吐」MetricCard | queueSize>0 → warning |
| KPI-04 | `stats.dropped` | 次 | 因订阅者异常被丢弃的消息数 | refreshStats() | change 展示「丢弃 N」 | >0 → warn |
| KPI-04 | `stats.avgLatencyMs` | ms | publish→onNext 平均调度延迟 | refreshStats() | 「平均调度延迟」MetricCard | >16ms → 掉帧 |
| KPI-04 | `stats.queueSize` | 条 | 发布队列积压 | refreshStats() | change 展示 | >0 持续增加 → backpressure |

---

## 维护说明

- **更新时机**：新增 Store KPI 字段时，在 JSDoc 注释中加 `KPI-XX:` 前缀，本目录随 P2 治理同步
- **来源文件**：
  - [sevenDimConfigStore.ts](file:///d:/FinSightV9/src/store/sevenDimConfigStore.ts)
  - [collectionRuntimeStore.ts](file:///d:/FinSightV9/src/store/collectionRuntimeStore.ts)
  - [dataflowStore.ts](file:///d:/FinSightV9/src/store/dataflowStore.ts)
- **消费者组件**：[MetricCard.tsx](file:///d:/FinSightV9/src/components/molecules/MetricCard.tsx)
