# 阶段 3+4 变更日志（2026-08-09）

## 概述

本文档记录 V9 项目 directDataAPI 模块在阶段 3（批量行情 code 格式统一 + 关键分支日志）和阶段 4（vite.config.ts 纳入 tsc 门禁）中的所有变更，以及后续的 branchLogger 工具函数封装与跨模块推广。

---

## 阶段 3：批量行情 code 格式统一 + 关键分支日志

### 问题背景

`tencentQuote` 返回带后缀代码（如 `600519.SH`、`0700.HK`），但 `tencentBatchQuotes` / `sinaBatchQuotes` 从响应裸码字段提取代码（如 `600519`、`00700`），导致同一接口不同入口返回的 code 格式不一致，下游消费方需特殊处理。

### 修改文件

#### 1. `src/services/fetcher/directDataAPI.ts`

**变更类型**：核心逻辑调整 + 日志增强

| 函数 | 行号 | 变更内容 |
|---|---|---|
| `tencentBatchQuotes` | L370-408 | 构建 `codeMap`（`buildTencentCode(c) → c`），通过响应前缀 `sh600519`/`s_hk00700` 反向映射恢复带后缀代码；映射失败时回退到裸码并记录 debug 日志 |
| `sinaBatchQuotes` | L693-736 | 构建 `codeMap`（`buildSinaCode(c) → c`），通过响应前缀 `sh600519`/`rt_hk00700` 反向映射恢复带后缀代码；映射失败时回退到去前缀裸码并记录 debug 日志 |
| `parseTencentQuote` | L244-249 | A 股/港股分叉点添加 `blog.branchSwitch` 日志（debug 级别，批量安全） |
| `parseSinaQuote` | L581-586 | A 股/港股分叉点添加 `blog.branchSwitch` 日志（debug 级别，批量安全） |
| `tencentQuote` | L205-207 | 单次入口添加 `blog.branchSwitch` 日志（info 级别，含 code/name/price，生产可见） |
| `sinaQuote` | L557-559 | 单次入口添加 `blog.branchSwitch` 日志（info 级别，含 code/name/price，生产可见） |
| `getNeteaseCode` | L135-136 | 碰撞守卫添加 `blog.guardWarn` 日志（warn 级别） |
| 文件头部 | L38, L42 | 新增 `import { createBranchLogger, type BranchLogger }`；创建 `const blog = createBranchLogger(logger, 'directDataAPI')` |

**关键逻辑**：
- 批量行情通过 `codeMap` 反向映射保证 code 格式与单次调用一致
- 映射回退策略：无法映射时回退到裸码（向后兼容），记录 debug 日志供排查
- 日志分级：单次入口 info（生产可见），批量循环内 debug（避免刷屏），守卫告警 warn

#### 2. `src/services/fetcher/directDataAPI.integration.test.ts`

**变更类型**：测试断言更新 + 新增测试用例

| 变更项 | 行号 | 内容 |
|---|---|---|
| 断言更新 | L664-672 | `expect(quotes[0]!.code).toBe('600519')` → `.toBe('600519.SH')`；`'00700'` → `'0700.HK'` |
| 断言更新 | L694 | `'600519'` → `'600519.SH'` |
| 新增测试 | L739-752 | `tencentBatchQuotes: 深市 A 股 + 港股 → code 均带后缀（.SZ/.HK）` |
| 新增测试 | L755-768 | `sinaBatchQuotes: 深市 A 股 + 港股 → code 均带后缀（.SZ/.HK）` |
| 新增测试 | L768-782 | `tencentBatchQuotes: 超长港股代码（>5 位）→ buildTencentCode 补零后仍正常请求` |
| 新增测试 | L784-795 | `tencentBatchQuotes: 格式统一 — 返回 code 与 tencentQuote 格式一致（均带后缀）` |

---

## 阶段 4：vite.config.ts 纳入 tsc 门禁

### 问题背景

`vite.config.ts` 不在任何 tsconfig 的 include 范围内，无 tsc/ESLint 自动化门禁，类型错误只能靠运行时发现。

### 修改文件

#### 1. `tsconfig.prod.json`

**变更类型**：配置扩展

| 字段 | 修改前 | 修改后 |
|---|---|---|
| `include` | `["src/**/*"]` | `["src/**/*", "vite.config.ts"]` |
| `types` | `["vite/client"]` | `["vite/client", "node"]` |

#### 2. `vite.config.ts`

**变更类型**：类型冲突修复 + 未使用参数修复

| 行号 | 修改前 | 修改后 | 原因 |
|---|---|---|---|
| L1 | `import { defineConfig } from 'vitest/config'` | `import { defineConfig, type UserConfig } from 'vite'` | vitest 2.1 嵌套 vite 副本与根 vite 6.0 的 Plugin 类型冲突 |
| L254 | `resolveDependencies(_filename, deps, context)` | `resolveDependencies(_filename, deps, _context)` | `noUnusedParameters` 门禁 |
| L324 | `})` | `} as UserConfig)` | vite 的 defineConfig 不接受 test 字段，用断言绕过 Excess Property Check |

**类型冲突根因**：`vitest@2.1` 内部嵌套了 `vite` 副本（`node_modules/vitest/node_modules/vite`），与根 `vite@6.0` 的 `Plugin` 类型不兼容。改用根 vite 的 `defineConfig` 后统一类型来源。

---

## branchLogger 工具函数封装

### 新建文件

#### `src/lib/branchLogger.ts`

**目的**：封装三类常见日志模式，供 directDataAPI / orchestrator / dataBridge 等模块复用，统一日志风格。

| 函数 | 签名 | 默认级别 | 适用场景 |
|---|---|---|---|
| `logBranchSwitch` | `(logger, ns, point, branch, context?, level?)` | `'debug'` | if/else 分支切换（A 股/港股分叉） |
| `logFallback` | `(logger, ns, strategy, input, fallback, extra?, level?)` | `'debug'` | 映射/策略回退（codeMap 回退、降级链） |
| `logGuardWarn` | `(logger, ns, guardName, reason, context?)` | `'warn'` | 前置条件守卫（碰撞风险、字段不足） |
| `createBranchLogger` | `(logger, ns)` → `{branchSwitch, fallback, guardWarn}` | — | 工厂函数，绑定 logger+namespace |

**设计决策**：
- `level` 参数可选，默认 debug（批量安全），单次入口可传 info（生产可见）
- 统一命名空间前缀 `[<ns>] <action>:`，便于 grep 聚合排查
- `guardWarn` 固定 warn 级别（异常场景必须可见）

### branchLogger 跨模块推广

以下 3 个模块的 6 处内联日志重构为 branchLogger 调用：

#### 1. `src/services/fetcher/dataSourceRegistry.ts`

| 行号 | 修改前 | 修改后 |
|---|---|---|
| L6, L9 | — | 新增 `import { createBranchLogger }` + `const blog = createBranchLogger(logger, 'DataSourceRegistry')` |
| L34 | `logger.warn('[DataSourceRegistry] All providers unhealthy, falling back to "..."')` | `blog.fallback('getActiveProvider', 'all-unhealthy', fallback.name, {}, 'warn')` |

#### 2. `src/services/fetcher/orchestrator/adapters/marketDataFetcher.ts`

| 行号 | 修改前 | 修改后 |
|---|---|---|
| L13, L27 | — | 新增 `import { createBranchLogger }` + `const blog = createBranchLogger(logger, 'MarketDataFetcher')` |
| L60 | `logger.warn('[MarketDataFetcher] 未知行情源, 回退 Mock', { source, code })` | `blog.fallback('fetchQuoteBySource', String(source), 'mock', { code }, 'warn')` |
| L81 | `logger.warn('[MarketDataFetcher] 未知K线源, 回退 Mock', { source, code, days })` | `blog.fallback('fetchKlineBySource', String(source), 'mock', { code, days }, 'warn')` |

#### 3. `src/services/fetcher/orchestrator/resilienceChain.ts`

| 行号 | 修改前 | 修改后 |
|---|---|---|
| L17, L30 | — | 新增 `import { createBranchLogger }` + `const blog = createBranchLogger(logger, 'ResilienceChain')` |
| L109 | `logger.warn('[ResilienceChain] 降级', { from, to, reason })` | `blog.fallback('${operation} 降级链', current, next, { reason }, 'warn')` |
| L111 | `logger.warn('[ResilienceChain] 降级链末端失败', { from, reason })` | `blog.guardWarn('${operation} 降级链末端', 'from=${current} reason=${lastReason}', {})` |
| L115 | `logger.warn('[ResilienceChain] ${operation} 降级链耗尽, 返回 Mock', { code, lastReason })` | `blog.guardWarn('${operation} 降级链耗尽', '返回 Mock, lastReason=${lastReason}', { code })` |

---

## 验证结果

| 验证项 | 结果 |
|---|---|
| `npm run tsc:prod`（含 vite.config.ts + branchLogger.ts） | EXIT:0，零错误 |
| vitest（directDataAPI 3 文件） | 141/141 通过 |

---

## 修改文件清单

| 文件 | 阶段 | 变更类型 |
|---|---|---|
| `src/services/fetcher/directDataAPI.ts` | 3 + branchLogger | 核心逻辑 + 日志重构 |
| `src/services/fetcher/directDataAPI.integration.test.ts` | 3 | 断言更新 + 4 个新测试 |
| `tsconfig.prod.json` | 4 | 配置扩展 |
| `vite.config.ts` | 4 | 类型冲突修复 |
| `src/lib/branchLogger.ts` | branchLogger | 新建工具函数 |
| `src/services/fetcher/dataSourceRegistry.ts` | branchLogger 推广 | 日志重构 |
| `src/services/fetcher/orchestrator/adapters/marketDataFetcher.ts` | branchLogger 推广 | 日志重构 |
| `src/services/fetcher/orchestrator/resilienceChain.ts` | branchLogger 推广 | 日志重构 |

---

## 代码审查要点

1. **code 格式统一**：批量行情的 `codeMap` 反向映射是否覆盖所有响应前缀（`sh`/`sz`/`bj`/`s_hk`/`rt_hk`）
2. **日志分级**：单次入口 info vs 批量循环 debug 的区分是否正确（避免批量场景 info 刷屏）
3. **映射回退安全性**：`codeMap.get() ?? fallback` 回退到裸码是否会导致下游消费方异常
4. **vite 类型冲突**：`as UserConfig` 断言是否掩盖了其他潜在类型问题（test 字段运行时仍由 vitest 读取）
5. **branchLogger level 参数**：warn 级别的 fallback 调用是否合理（降级链是预期行为还是异常）
