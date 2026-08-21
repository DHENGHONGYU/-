---
title: docs/lessons/extreme-timeout-test-report-2026-08-09.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 极端网络超时测试总结报告（2026-08-09）

## 概述

本报告总结 `directDataAPI.integration.test.ts` 中新增的"极端网络超时场景"测试块的覆盖情况、潜在风险点及改进建议。

---

## 测试执行结果

| 指标 | 数值 |
|---|---|
| 测试文件 | `src/services/fetcher/directDataAPI.integration.test.ts` |
| 新增用例数 | 16 |
| 通过率 | 16/16（100%） |
| 执行耗时 | 1.08s |
| 测试 ID | V9-TEST-ST-189（扩展） |

---

## 覆盖率分析

### 按场景分类

| 类别 | 用例数 | 覆盖的数据源 | 覆盖的异常类型 |
|---|---|---|---|
| 全链路超时降级 | 3 | 腾讯 + 新浪 | AbortError、TypeError |
| HTTP 网关错误 | 5 | 腾讯、新浪、网易 | 502、503、504 |
| 响应体读取失败 | 2 | 腾讯行情、腾讯 K 线 | text() reject、json() reject |
| 混合异常场景 | 3 | 腾讯→新浪、腾讯→网易 | HTTP 500→AbortError、TypeError→502 |
| 边界超时场景 | 4 | 腾讯（连续 3 次）、批量行情 | 持续超时、批量全超时、批量网络错误 |

### 按数据源覆盖

| 数据源 | 覆盖的异常场景 | 用例数 |
|---|---|---|
| `tencentQuote` | AbortError、TypeError、502、503、504、text()失败、持续超时 | 8 |
| `sinaQuote` | AbortError、TypeError、502 | 4 |
| `tencentKline` | AbortError、json()失败 | 3 |
| `neteaseHistory` | 503 | 1 |
| `tencentBatchQuotes` | 全部超时 | 1 |
| `sinaBatchQuotes` | 全部网络错误 | 1 |

### 按降级链覆盖

| 降级路径 | 覆盖场景 | 用例数 |
|---|---|---|
| 腾讯→新浪（行情） | 间歇性超时恢复、混合异常全失败 | 4 |
| 腾讯→网易（K 线） | 超时后降级成功 | 1 |
| 全链路耗尽 | 所有源均超时/网络错误 | 3 |

---

## 潜在风险点

### P1 风险：降级链无退避间隔（已修复）

- **风险描述**：`ResilienceChain.runFallbackChain` 源切换时无延迟，高并发下所有请求同时降级，导致下一源瞬间流量尖峰
- **影响范围**：高并发批量行情请求（如 `tencentBatchQuotes` 处理 10+ 股票时全部超时）
- **修复方案**：添加指数退避 + jitter（`RESILIENCE_BACKOFF_BASE_MS=200ms`，`RESILIENCE_BACKOFF_MAX_MS=2000ms`）
- **状态**：本次已修复

### P2 风险：Mock 兜底数据可能掩盖生产故障

- **风险描述**：降级链耗尽时返回 `mockQuote(code)`，生产环境可能静默使用 Mock 数据而不知情
- **影响范围**：所有数据源不可用时（如网络分区），用户看到的是 Mock 行情而非错误提示
- **缓解措施**：`blog.guardWarn` 已记录 warn 日志（`降级链耗尽`），但需配合告警系统
- **建议**：在 `runFallbackChain` 返回 Mock 前检查是否为生产环境，生产环境可考虑抛错或发送告警

### P2 风险：30s 超时对降级链总耗时的累积效应

- **风险描述**：`DIRECT_DATA_API_TIMEOUT_MS = 30000`（30s），降级链 4 个源全部超时需 120s
- **影响范围**：单次 `fetchQuote` 最坏情况 120s 才返回 Mock，用户体验差
- **缓解措施**：实际场景中 30s 超时极少触发（通常网络错误瞬时返回），但 DNS 解析超时可能接近 30s
- **建议**：考虑为降级链设置总超时预算（如 45s），超时后直接返回 Mock

### P3 风险：批量行情无部分降级

- **风险描述**：`tencentBatchQuotes` 单次 fetch 获取所有股票行情，失败后整体降级到 `sinaBatchQuotes`，无法对单只股票单独降级
- **影响范围**：批量请求中 1 只股票超时导致全部降级
- **建议**：低优先级，当前批量行情通常 5-10 只股票，整体降级可接受

---

## 未覆盖场景（后续改进建议）

| 场景 | 优先级 | 说明 |
|---|---|---|
| DNS 解析失败（ENOTFOUND） | P2 | `TypeError` 已覆盖通用网络错误，但 DNS 失败有特定错误码 |
| 连接被拒绝（ECONNREFUSED） | P3 | 上游服务宕机场景，与 TypeError 类似 |
| 响应体不完整（stream 中断） | P3 | fetch 成功但 body 流中断，与 text() reject 类似 |
| 并发超时（多 code 同时降级） | P2 | 需集成测试验证退避 jitter 效果 |
| 超时后重试同一源成功 | P3 | 当前降级链不重试同一源，直接切换到下一源 |

---

## 测试代码位置

- 文件：`src/services/fetcher/directDataAPI.integration.test.ts`
- 行号：L1123-L1312
- 测试块：`describe('极端网络超时场景', ...)`

---

## 结论

极端网络超时测试覆盖了全链路降级、网关错误、响应体异常、混合异常和边界超时 5 大类 16 个用例，验证了降级逻辑的健壮性。所有用例通过，降级链在异常场景下能正确抛错或恢复数据。结合本次新增的指数退避优化，高并发场景下的稳定性已进一步提升。
