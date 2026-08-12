# 代码审查检查清单 — 阶段 3+4 变更（2026-08-09）

> **用途**：供团队 review 本次 directDataAPI / vite.config.ts / branchLogger 变更使用。
> **对应文档**：[stage3-4-changelog-2026-08-09.md](./stage3-4-changelog-2026-08-09.md)

---

## 审查范围

| 文件 | 变更类型 |
|---|---|
| `src/services/fetcher/directDataAPI.ts` | 核心逻辑 + 日志重构 |
| `src/services/fetcher/directDataAPI.integration.test.ts` | 断言更新 + 新增测试 |
| `src/lib/branchLogger.ts` | 新建工具函数 |
| `src/services/fetcher/dataSourceRegistry.ts` | 日志重构 |
| `src/services/fetcher/orchestrator/adapters/marketDataFetcher.ts` | 日志重构 |
| `src/services/fetcher/orchestrator/resilienceChain.ts` | 日志重构 |
| `tsconfig.prod.json` | 配置扩展 |
| `vite.config.ts` | 类型冲突修复 |

---

## 检查清单

### 1. 批量行情 code 格式统一（directDataAPI.ts）

- [ ] `tencentBatchQuotes` 的 `codeMap` 反向映射是否覆盖所有响应前缀（`sh`/`sz`/`bj`/`s_hk`）
- [ ] `sinaBatchQuotes` 的 `codeMap` 反向映射是否覆盖所有响应前缀（`sh`/`sz`/`bj`/`rt_hk`）
- [ ] 映射回退到裸码时是否记录 debug 日志（`blog.fallback`）
- [ ] 回退裸码是否会导致下游消费方异常（下游是否依赖带后缀格式）
- [ ] 正则 `/v_(\w+)="([^"]+)"/` 是否能正确捕获港股前缀 `s_hk00700`

### 2. 日志分级策略（directDataAPI.ts + branchLogger.ts）

- [ ] 单次入口（`tencentQuote`/`sinaQuote`）的 `branchSwitch` 是否为 info 级别
- [ ] 批量循环内（`parseTencentQuote`/`parseSinaQuote`）的 `branchSwitch` 是否为 debug 级别
- [ ] 碰撞守卫（`getNeteaseCode`）的 `guardWarn` 是否为 warn 级别
- [ ] 批量场景下 info 日志是否会导致刷屏（验证只有单次入口用 info）
- [ ] `branchLogger` 的 `level` 参数默认值是否为 `'debug'`（批量安全）

### 3. branchLogger 工具函数（branchLogger.ts）

- [ ] `logBranchSwitch` 的 `level` 参数是否为可选（默认 `'debug'`）
- [ ] `logFallback` 的 `level` 参数是否为可选（默认 `'debug'`）
- [ ] `logGuardWarn` 是否固定 warn 级别（无 level 参数）
- [ ] `createBranchLogger` 工厂返回的 `branchSwitch`/`fallback` 是否正确透传 level 参数
- [ ] 命名空间前缀格式是否统一为 `[<ns>] <action>:`

### 4. branchLogger 跨模块推广

- [ ] `dataSourceRegistry.ts`：`blog.fallback` 的 level 是否为 `'warn'`（全部 unhealthy 是异常场景）
- [ ] `marketDataFetcher.ts`：`blog.fallback` 的 level 是否为 `'warn'`（未知源是异常场景）
- [ ] `resilienceChain.ts`：降级链切换用 `blog.fallback`，降级链耗尽用 `blog.guardWarn`
- [ ] 所有模块是否统一使用 `createBranchLogger(logger, 'ModuleName')` 初始化
- [ ] 推广后原有日志信息是否完整保留（无信息丢失）

### 5. vite.config.ts 类型冲突修复

- [ ] `defineConfig` 是否从 `'vite'` 导入（而非 `'vitest/config'`）
- [ ] `as UserConfig` 断言是否仅用于绕过 `test` 字段的 Excess Property Check
- [ ] `_context` 参数是否正确加下划线前缀（`noUnusedParameters` 合规）
- [ ] vitest 运行时是否仍能正确读取 `test` 配置（验证测试通过）
- [ ] `tsconfig.prod.json` 的 `include` 是否包含 `"vite.config.ts"`
- [ ] `tsconfig.prod.json` 的 `types` 是否包含 `"node"`

### 6. 网易代码碰撞守卫（directDataAPI.ts getNeteaseCode）

- [ ] 港股代码 `bare.length > HK_CODE_LENGTH` 时是否抛出 `DirectDataAPIError`
- [ ] `neteaseHistory` 是否将 `getNeteaseCode` 调用移入 try 块（确保抛错被捕获）
- [ ] 抛错后是否记录 `blog.guardWarn` 日志
- [ ] 深市 A 股（7 位）与港股（6 位）是否确实不碰撞

### 7. 常量提取（stockCode.constants.ts）

- [ ] `HK_CODE_LENGTH = 5` 是否替换了所有 `padStart(5, '0')` 硬编码
- [ ] `SHOU_TO_GU_MULTIPLIER = 100` 是否替换了手→股乘数硬编码
- [ ] `PERCENT_MULTIPLIER = 100` 是否替换了百分比乘数硬编码
- [ ] 常量命名是否语义清晰（非 magic number）

### 8. 测试覆盖

- [ ] 批量行情测试是否验证深市 + 港股混合场景
- [ ] 批量行情测试是否验证超长港股代码（>5 位）
- [ ] 批量行情测试是否验证 code 格式统一（均带后缀）
- [ ] 网易碰撞测试是否验证深市/港股不碰撞 + 超长代码抛错
- [ ] 极端网络超时测试是否覆盖全链路超时降级
- [ ] 极端网络超时测试是否覆盖 502/503/504 网关错误
- [ ] 极端网络超时测试是否覆盖响应体读取失败

### 9. 构建与门禁

- [ ] `npm run build` 是否成功（零错误）
- [ ] `npm run tsc:prod` 是否成功（零错误，含 vite.config.ts）
- [ ] vitest 集成测试是否全部通过
- [ ] CSP meta 注入是否正常（build 阶段）

---

## 风险点

| 风险 | 等级 | 缓解措施 |
|---|---|---|
| `as UserConfig` 断言掩盖 test 字段类型错误 | 低 | vitest 运行时能正确读取；tsc:prod 已通过 |
| 批量行情 codeMap 回退到裸码 | 低 | 记录 debug 日志；向后兼容 |
| branchLogger level 参数误用 | 低 | 默认 debug；guardWarn 固定 warn |
| 降级链 warn 级别日志频率 | 中 | 降级是预期行为但应监控频率 |

---

## 审查签字

- [ ] 代码审查人：_______________ 日期：_________
- [ ] 架构审查人：_______________ 日期：_________
- [ ] 安全审查人：_______________ 日期：_________
