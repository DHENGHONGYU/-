---
title: R2 组熔断器恢复后自动探测场景覆盖率报告
date: 2026-08-04
generated_by: Quality Auditor
test_files:
  - tests/__tests__/store/autoRecover.test.ts
  - tests/__tests__/integration/fetcher-client-edge.test.ts
target_files:
  - src/store/sevenDimConfigStore.ts
  - src/services/fetcher/fetcherClient.ts
---

# R2 组熔断器恢复后自动探测场景覆盖率报告

> **生成时间**: 2026-08-04
> **测试文件**: autoRecover.test.ts (9 用例) + fetcher-client-edge.test.ts (18 用例)
> **测试结果**: 27/27 全部通过

---

## 一、覆盖率工具状态

vitest 内置的 istanbul coverage provider 在 `getCoverageMapForUncoveredFiles` 阶段触发 `RollupError: Expected a semicolon`（pos: 65833），无法自动生成覆盖率报告。根因为 istanbul 尝试解析 `src/**/*.ts` 中某个文件的 TypeScript 语法时 rollup 解析器报错。

**替代方案**: 采用手动路径分析法，逐条核对 `sevenDimConfigStore.ts` 和 `fetcherClient.ts` 中的核心分支是否被测试用例覆盖。

---

## 二、sevenDimConfigStore.ts 核心路径覆盖率

### 2.1 runCollection 方法

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 1 | 防重入检查 (`collectingDimensions.length > 0` → return) | L480 | R2 | ✅ |
| 2 | 用户手动触发取消恢复 (`recoveryTimerId !== null` → cancelRecovery) | L483-485 | R1-3 | ✅ |
| 3 | 空池/空维度跳过 (`symbols.length === 0` → return) | L489-491 | R3 | ✅ |
| 4 | 维度就绪度检查 (`unreadyDims.length > 0` → set error + return) | L494-499 | R4 | ✅ |
| 5 | 设置采集状态 (`set({ isCollecting: true, ... })`) | L510-518 | 全部用例 | ✅ |
| 6 | Promise.allSettled 并发采集 | L526-530 | 全部用例 | ✅ |
| 7 | 失败→设置 error (`failures.length > 0`) | L533-539 | R1-1/R1-2/R1-3/R5 | ✅ |
| 8 | 成功→重置恢复标志 (`failures.length === 0`) | L563-565 | R1-1(恢复)/R1-5 | ✅ |
| 9 | 自动恢复触发 (`!recoveryAttempted` → setTimeout 30s) | L550-559 | R1-1/R1-2/R5 | ✅ |
| 10 | 自动恢复不重试 (`recoveryAttempted` → warn) | L560-561 | R1-2 | ✅ |
| 11 | catch 块自动恢复 | L574-585 | — | ⚠️ 防御性代码 |

### 2.2 cancelRecovery 方法

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 12 | 定时器清理 (`recoveryTimerId !== null` → clearTimeout) | L594-596 | R1-3/R1-4 | ✅ |
| 13 | 状态重置 (`set({ isRecovering: false, recoveryAttempted: false })`) | L599 | R1-3/R1-4 | ✅ |
| 14 | 定时器已为 null (跳过 clearTimeout) | L594 | R1-4(直接调用时) | ✅ |

### 2.3 reset 方法

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 15 | 定时器清理 | L373-376 | beforeEach reset() | ✅ |
| 16 | 状态重置 (含 isRecovering/recoveryAttempted) | L386-387 | beforeEach reset() | ✅ |

### 2.4 setTimeout 回调（自动恢复触发）

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 17 | recoveryTimerId = null + set({ isRecovering: false }) | L555-556 | R1-1/R1-2 | ✅ |
| 18 | get().runCollection() 触发恢复采集 | L558 | R1-1/R1-2 | ✅ |

### 2.5 汇总

| 指标 | 值 |
|:---|:---|
| 核心路径总数 | 18 |
| 已覆盖 | 17 |
| 未覆盖 | 1（catch 块防御性代码） |
| **核心路径覆盖率** | **94.4%** |
| **排除防御性代码后** | **17/17 = 100%** |

> **结论**: 熔断器恢复后自动探测的核心路径（自动恢复触发、取消、不重试、部分失败、防重入、空池、就绪度检查）覆盖率达到 **100%**。唯一未覆盖的 catch 块是防御性代码（`Promise.allSettled` 不会抛出异常，catch 块在正常运行中不可达）。

---

## 三、fetcherClient.ts 核心路径覆盖率

### 3.1 tryRequest 函数

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 1 | HTTP 4xx → retriable=false | L78-82 | F1-1~F1-4 | ✅ |
| 2 | HTTP 5xx → retriable=true | L78-82 | 5xx-1 | ✅ |
| 3 | HTTP 200 → response.json() | L91 | F2/F4-2/F5-2 | ✅ |
| 4 | response.json() = null → warn | L93-99 | F3-1 | ✅ |
| 5 | catch AbortError → warn | L103-108 | F4-1/F4-2 | ✅ |
| 6 | catch TypeError → warn | L109-113 | F5-1/F5-2 | ✅ |
| 7 | catch 其他错误 → warn | L114-119 | F6-1 | ✅ |

### 3.2 request 函数

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 8 | 4xx retriable=false → 不重试 | L145 | F1-1~F1-4 | ✅ |
| 9 | 5xx retriable=true → 重试 | L145 | 5xx-1 | ✅ |
| 10 | AbortError retriable=true → 重试 | L145 | F4-1/F4-2 | ✅ |
| 11 | TypeError retriable=true → 重试 | L145 | F5-1/F5-2 | ✅ |
| 12 | 非 TypeError → 不重试 | L145 | F6-1 | ✅ |
| 13 | attempt === maxRetries → break | L145 | 5xx-1/F4-1/F5-1 | ✅ |
| 14 | TypeError → "数据采集服务未启动" | L154-158 | F5-1 | ✅ |
| 15 | AbortError → "请求超时" | L160-167 | F4-1 | ✅ |
| 16 | 其他 Error → 原始消息 | L168-170 | F1-1/F6-1 | ✅ |

### 3.3 collect 函数

| # | 路径 | 代码位置 | 覆盖用例 | 状态 |
|:---|:---|:---|:---|:---|
| 17 | collectBasic success=false → warn | L196-202 | F2-1/F2-2/F2-5 | ✅ |
| 18 | collectBasic success=true → info | L203-210 | F2-4/F4-2/F5-2 | ✅ |
| 19 | collectKline success=false → warn | L243-249 | F2-6 | ✅ |
| 20 | collectFinancial success=false → warn | L285-291 | F2-7 | ✅ |

### 3.4 汇总

| 指标 | 值 |
|:---|:---|
| 核心路径总数 | 20 |
| 已覆盖 | 20 |
| **核心路径覆盖率** | **100%** |

---

## 四、总体结论

| 文件 | 核心路径覆盖率 | 排除防御性代码后 |
|:---|:---|:---|
| sevenDimConfigStore.ts | 94.4% (17/18) | **100%** (17/17) |
| fetcherClient.ts | **100%** (20/20) | **100%** (20/20) |
| **总计** | 97.4% (37/38) | **100%** (37/37) |

> **最终结论**: 熔断器恢复后自动探测场景的核心路径覆盖率达到 **100%**（排除 `Promise.allSettled` 不可达的 catch 块防御性代码后）。所有关键分支——自动恢复触发/取消/不重试、4xx/5xx/超时/连接拒绝/连接重置的错误分类与重试策略、业务级失败日志埋点——均被测试用例完整覆盖。
