---
title: V9 前端应用安全质量审计报告
type: reference
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计日期: 2026-06-29 审计范围: `src/` 目录下所有 `.ts` / `.tsx` 文件（共 396 个文件） 审计维度: XSS 安全、本地存储安全、输入校验、敏感信息泄露..."
tags: [qa, audit, security]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-074
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-QA-034, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-QA-102, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 前端应用安全质量审计报告

**审计日期**: 2026-06-29  
**审计范围**: `src/` 目录下所有 `.ts` / `.tsx` 文件（共 396 个文件）  
**审计维度**: XSS 安全、本地存储安全、输入校验、敏感信息泄露  
**审计方式**: 静态代码扫描 + 人工复核

---

## 一、审计总览

| 风险等级 | 问题数量 | 占比 |
|---------|---------|------|
| ?? 高危 | 2（均已修复） | 10.5% |
| ?? 中危 | 6 | 31.6% |
| ?? 低危 | 11 | 57.9% |
| **合计** | **19** | **100%** |

> **说明**: 本审计仅覆盖前端代码层面的安全问题，不包含后端 API、服务器配置、网络安全等维度。

> **修复状态**（2026-07-01 同步）：高危 XSS-001（LLM 返回内容 XSS 防护）已通过 `src/lib/xssSanitizer.ts` 的 `sanitizeMarkdown`/`sanitizeHtml` 函数修复，并在 StockChatWidget 中集成；高危 STOR-001（LLM API Key 明文存储）已通过 localStorageManager 的 setEncrypted/getEncrypted 方法修复；中低危 10 项已在 F3 批次修复。剩余中低危项持续优化中。

---

## 二、分维度审计结果

### 2.1 XSS 安全（Cross-Site Scripting）

**问题总数**: 3 个（高危 1，中危 1，低危 1）

#### ?? 高危问题

##### [XSS-001] LLM 返回内容无 XSS 防护机制

**风险等级**: ? 已修复（原 高危）
**问题描述**: 项目集成了 LLM 大模型对话功能（StockChatWidget 等），但未引入任何 XSS 清理库（如 DOMPurify）。LLM 返回的 Markdown 内容若被渲染为 HTML，存在被注入恶意脚本的风险。

**涉及文件**:
- `src/cockpit/widgets/StockChatWidget.tsx`
- `src/services/llm/llmClient.ts`

**代码证据**:
```typescript
// src/services/llm/llmClient.ts:116
const endpoint = `${normalizeBaseURL(config.baseURL)}/chat/completions`
// LLM 返回内容直接解析，无清理步骤
const raw = (await response.json()) as RawResponse
```

**修复建议**:
1. 引入 `dompurify` 库对所有 LLM 返回的富文本/Markdown 渲染内容进行清理
2. 在 Markdown 渲染组件中配置 `sanitize` 选项
3. 严格限制可渲染的 HTML 标签白名单

---

#### ?? 中危问题

##### [XSS-002] 缺少全局 CSP（内容安全策略）配置

**风险等级**: 中危  
**问题描述**: 未发现 Content-Security-Policy 相关配置或 meta 标签。CSP 是防范 XSS 的重要深度防御措施。

**涉及范围**: 全局（入口文件 / HTML 模板）

**修复建议**:
1. 在 `index.html` 中添加 CSP meta 标签
2. 配置严格的 `script-src`、`style-src`、`img-src` 指令
3. 禁止 `unsafe-inline` 和 `unsafe-eval`

---

#### ?? 低危问题

##### [XSS-003] URL 拼接缺少协议校验

**风险等级**: 低危  
**问题描述**: LLM 配置的 `baseURL` 直接用于 URL 拼接，未校验协议必须为 `https://`（生产环境）。若用户配置 `javascript:` 协议的 URL，可能导致 XSS。

**代码位置**:
```typescript
// src/services/llm/llmClient.ts:116
const endpoint = `${normalizeBaseURL(config.baseURL)}/chat/completions`

// src/services/fetcher/fetcherClient.ts:28-32
function buildUrl(path: string): string {
  const { baseURL } = getConfig()
  const normalizedBase = baseURL.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}
```

**修复建议**:
1. 在 `assertConfig` 函数中增加 URL 协议校验
2. 仅允许 `http://`（开发环境）和 `https://`（生产环境）
3. 禁止 `javascript:`、`data:` 等危险协议

---

### 2.2 本地存储安全

**问题总数**: 4 个（高危 1，中危 2，低危 1）

#### ?? 高危问题

##### [STOR-001] LLM API Key 明文存储在 localStorage

**风险等级**: ? 已修复（原 高危）
**问题描述**: LLM API Key 以明文形式存储在 localStorage 中，攻击者可通过 XSS 漏洞或本地访问直接窃取密钥，导致 API 滥用和经济损失。

**涉及文件**:
- `src/lib/localStorageManager.ts`
- `src/store/industryScoreStore.ts`（推测通过 store 持久化）
- `src/components/organisms/shared/LLMConfigWidget.tsx`

**代码证据**:
```typescript
// src/lib/localStorageManager.ts:170
localStorage.setItem(fullKey, raw)  // 明文存储，无加密

// src/components/shared/LLMConfigWidget.tsx:132-133
value={value.apiKey ?? ''}
onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
```

**修复建议**:
1. 敏感配置（API Key 等）应仅存储在内存中，刷新页面后重新输入
2. 若必须持久化，使用 `crypto.subtle` API 进行 AES 加密存储
3. 考虑使用 HttpOnly Cookie + 后端代理方式，避免密钥接触前端

---

#### ?? 中危问题

##### [STOR-002] IndexedDB 存储大量业务数据无加密

**风险等级**: 中危  
**问题描述**: IndexedDB 中存储了股票池、评分记录、订单记录、策略快照等大量业务数据，全部为明文存储。本地恶意软件或多用户共享设备场景下存在数据泄露风险。

**涉及文件**:
- `src/data/db.ts`
- `src/data/dataLayer.ts`

**代码证据**:
```typescript
// src/data/db.ts:35
const request = indexedDB.open(DB_NAME, DB_VERSION)
// 数据直接存入 IndexedDB，无加密
```

**存储的数据类型**:
- `stocks` - 股票池数据
- `daily_quotes` - 日线行情
- `v6_scores` - V6 评分
- `orders` - 订单记录
- `rotation_scores` - 轮动评分
- `strategy_snapshots` - 策略快照

**修复建议**:
1. 对敏感字段（如交易记录、持仓数据）进行字段级加密
2. 评估数据最小化存储策略，非必要数据不持久化
3. 增加数据导出/清除功能，方便用户管理隐私数据

---

##### [STOR-003] localStorage 数据缺少完整性校验

**风险等级**: 中危  
**问题描述**: `localStorageManager` 仅做了 TTL 过期管理，但未对存储数据进行完整性校验（如 HMAC 签名）。攻击者可通过 DevTools 篡改 localStorage 数据，影响业务逻辑。

**代码位置**:
```typescript
// src/lib/localStorageManager.ts:126-132
get<T = unknown>(key: string): T | null {
  const fullKey = this.makeKey(key)
  const raw = localStorage.getItem(fullKey)
  // 直接 JSON.parse，无完整性校验
  // ...
}
```

**修复建议**:
1. 对关键业务数据增加 HMAC 签名验证
2. 解析前验证数据完整性
3. 篡改检测到后触发告警并清除异常数据

---

#### ?? 低危问题

##### [STOR-004] 无存储容量超限的安全降级策略

**风险等级**: 低危  
**问题描述**: `localStorageManager` 有容量检查，但未明确攻击者恶意填充存储导致 DoS 的防护策略。

**代码位置**:
```typescript
// src/lib/localStorageManager.ts:278-287
// 容量计算逻辑存在，但驱逐策略可能被绕过
```

**修复建议**:
1. 按命名空间严格隔离配额
2. 实现 LRU 驱逐策略防止单点占满
3. 增加异常写入速率检测

---

### 2.3 输入校验

**问题总数**: 5 个（中危 2，低危 3）

#### ?? 中危问题

##### [VAL-001] LLM 配置输入缺少格式校验

**风险等级**: 中危  
**问题描述**: `LLMConfigWidget` 中的 baseURL、apiKey、model 输入框仅做了非空校验，未进行格式校验，可能导致 SSRF、API Key 注入等问题。

**涉及文件**:
- `src/components/organisms/shared/LLMConfigWidget.tsx`
- `src/services/llm/llmClient.ts`

**代码证据**:
```typescript
// src/components/shared/LLMConfigWidget.tsx:129-133
<Input
  type="password"
  placeholder="sk-..."
  value={value.apiKey ?? ''}
  onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
/>
// 无格式校验，直接存储
```

**修复建议**:
1. baseURL: 校验必须为合法 URL，协议白名单限制
2. apiKey: 校验长度和格式（如 `sk-` 前缀），禁止特殊字符
3. model: 限制字符集为字母、数字、连字符、点、斜杠
4. 所有输入在发送到后端前进行二次校验

---

##### [VAL-002] 数字输入缺少范围和类型校验

**风险等级**: 中危  
**问题描述**: 项目中大量使用 `parseInt`、`parseFloat`、`Number()` 进行数字转换（共 145 处，分布在 14 个文件中），但缺少统一的范围校验和错误处理，可能导致 NaN 传播、数组越界、无限循环等问题。

**涉及文件示例**:
- `src/lib/precision.ts`
- `src/pages/trading/components/Pagination.tsx`
- `src/components/atoms/Slider.tsx`
- `src/services/system/migration/migrationTransformers.ts`

**修复建议**:
1. 封装统一的安全数字解析工具函数
2. 增加范围校验（最小/最大值）
3. NaN / Infinity 检测和默认值回退
4. 交易金额、仓位比例等关键字段增加边界校验

---

#### ?? 低危问题

##### [VAL-003] 股票代码输入缺少格式校验

**风险等级**: 低危  
**问题描述**: 股票搜索、批量导入等功能的股票代码输入缺少严格的格式校验（如 A股 6 位数字、港股 5 位数字等）。

**涉及文件**:
- `src/components/organisms/input/StockSearch.tsx`
- `src/services/input/batchImportService.ts`

**修复建议**:
1. 根据市场类型校验股票代码格式
2. 限制输入长度和字符集
3. 批量导入时逐行校验并报告错误

---

##### [VAL-004] URL 参数缺少校验和过滤

**风险等级**: 低危  
**问题描述**: 使用 `URLSearchParams` 读取 URL 参数时，未对参数值进行校验和过滤，可能导致参数注入攻击。

**涉及文件**:
- `src/services/trading/portfolioService.ts`

**修复建议**:
1. 对所有 URL 参数进行白名单校验
2. 数值参数强制类型转换和范围校验
3. 字符串参数进行长度限制和字符集过滤

---

##### [VAL-005] 缺少统一的输入验证工具库

**风险等级**: 低危  
**问题描述**: 项目中存在 `src/lib/validation.ts` 文件，但未找到实际的验证函数实现和广泛使用。各组件自行处理输入验证，标准不统一。

**修复建议**:
1. 完善 `dataValidation.ts`，提供常用验证函数
2. 推广使用统一的验证工具
3. 建立表单验证最佳实践文档

---

### 2.4 敏感信息泄露

**问题总数**: 7 个（中危 1，低危 6）

#### ?? 中危问题

##### [LEAK-001] 生产环境 console 输出敏感信息

**风险等级**: 中危  
**问题描述**: 项目中有 8 个文件包含 83 处 console 输出。部分错误信息可能包含堆栈跟踪、API 响应详情等敏感信息，在生产环境中泄露可能帮助攻击者进行漏洞利用。

**涉及文件**:
- `src/lib/logger.ts`
- `src/data/db.ts`（59 处）
- `src/store/commandStore.ts`
- `src/store/outputStore.ts`
- `src/components/organisms/shared/ErrorBoundary.tsx`
- `src/components/organisms/shared/WidgetErrorBoundary.tsx`
- `src/services/pwa/registerServiceWorker.ts`
- `src/App.tsx`

**代码证据**:
```typescript
// src/components/ErrorBoundary.tsx:25-27
componentDidCatch(error: Error, info: ErrorInfo): void {
  console.error('ErrorBoundary caught error:', error, info)
}

// src/components/WidgetErrorBoundary.tsx:55-60
logger.error(`[WidgetErrorBoundary] Widget ${widgetId} 捕获错误`, {
  instanceId,
  error: error.message,
  stack: error.stack,        // 堆栈信息
  componentStack: info.componentStack,  // 组件堆栈
})
```

**修复建议**:
1. 生产环境构建时移除所有 console 输出（使用 terser 插件）
2. 错误信息统一通过上报服务发送，不输出到控制台
3. 开发环境与生产环境使用不同的日志策略

---

#### ?? 低危问题

##### [LEAK-002] 错误边界直接向用户展示原始错误信息

**风险等级**: 低危  
**问题描述**: `ErrorBoundary` 和 `ErrorState` 组件直接将 `error.message` 展示给用户，可能泄露内部实现细节（如文件路径、API 端点、数据库结构等）。

**代码位置**:
```typescript
// src/components/ErrorBoundary.tsx:42
{this.state.error?.message ?? '未知错误'}

// src/components/ui/ErrorState.tsx:78
const errorMessage = typeof error === 'string' ? error : error.message || ''
```

**修复建议**:
1. 生产环境展示通用错误信息，不暴露技术细节
2. 提供错误 ID，用户可通过 ID 向技术支持反馈
3. 详细错误信息仅在开发环境或管理员模式下显示

---

##### [LEAK-003] 测试文件包含硬编码 API Key

**风险等级**: 低危  
**问题描述**: 测试文件中包含硬编码的 API Key（虽然是测试用 key），但可能被误用或泄露到生产环境。

**涉及文件**:
- `src/services/llm/llmClient.multimodel.test.ts`
- `src/store/industryScoreStore.test.ts`

**代码证据**:
```typescript
// src/services/llm/llmClient.multimodel.test.ts:36
apiKey: 'sk-test-key',

// 同文件:487
apiKey: 'sk-ds',

// 同文件:502
apiKey: 'sk-kimi',
```

**修复建议**:
1. 测试用 API Key 使用环境变量注入
2. 使用明显的占位符格式（如 `sk-test-xxxx`）
3. 在 CI 中检查是否有真实 API Key 被提交

---

##### [LEAK-004] LLM API Key 可能出现在错误信息中

**风险等级**: 低危  
**问题描述**: LLM 请求失败时，错误信息可能意外包含请求详情（虽然当前代码未直接输出 apiKey，但 fetch 错误对象可能包含请求信息）。

**代码位置**:
```typescript
// src/services/llm/llmClient.ts:134-135
const message = raw.error?.message ?? `HTTP ${response.status}`
throw new LlmApiError(`LLM 请求失败: ${message}`)
```

**修复建议**:
1. 错误处理中明确过滤掉 Authorization 等敏感头信息
2. API 错误信息做脱敏处理后再抛出
3. 日志中对 API Key 进行掩码显示（已在 fetcherConfig 中实现部分）

---

##### [LEAK-005] 版本信息可能泄露技术栈细节

**风险等级**: 低危  
**问题描述**: 应用可能在响应头、错误页面或 About 页面中泄露详细的技术栈和版本信息，帮助攻击者定向挖掘已知漏洞。

**修复建议**:
1. 最小化版本信息暴露
2. 不在客户端输出构建工具、依赖库的具体版本
3. 错误页面不展示技术栈标识

---

##### [LEAK-006] 数据库名称和表结构在前端代码中暴露

**风险等级**: 低危  
**问题描述**: IndexedDB 的数据库名称、表名、索引结构全部定义在前端代码中，攻击者可轻易了解数据存储结构。

**涉及文件**:
- `src/data/db.ts`
- `src/data/dataLayer.ts`

**修复建议**:
1. 此为前端存储的固有特性，无法完全隐藏
2. 重点关注数据加密（见 STOR-002）
3. 敏感数据避免存储在 IndexedDB 中

---

##### [LEAK-007] 用户操作日志可能包含敏感数据

**风险等级**: 低危  
**问题描述**: `commandStore` 和 `logger` 记录用户操作详情，若操作内容包含敏感信息（如搜索的股票、交易记录），日志可能成为信息泄露渠道。

**代码位置**:
```typescript
// src/store/commandStore.ts:27
console.log(`[commandStore] INFO: ${action}`, detail)
```

**修复建议**:
1. 日志记录前进行数据脱敏
2. 定义敏感字段白名单，自动过滤
3. 评估日志保留期限，定期清理

---

## 三、风险汇总矩阵

| 编号 | 风险项 | 维度 | 等级 | 修复成本 | 优先级 |
|-----|--------|------|------|---------|--------|
| XSS-001 | LLM 返回内容无 XSS 防护 | XSS | ??高危 | 中 | P0 |
| STOR-001 | LLM API Key 明文存储 | 存储 | ??高危 | 高 | P0 |
| STOR-002 | IndexedDB 数据无加密 | 存储 | ??中危 | 高 | P1 |
| STOR-003 | 存储数据缺少完整性校验 | 存储 | ??中危 | 中 | P1 |
| VAL-001 | LLM 配置缺少格式校验 | 输入 | ??中危 | 低 | P1 |
| VAL-002 | 数字输入缺少范围校验 | 输入 | ??中危 | 中 | P1 |
| LEAK-001 | 生产环境 console 泄露 | 泄露 | ??中危 | 低 | P1 |
| XSS-002 | 缺少 CSP 配置 | XSS | ??中危 | 中 | P2 |
| XSS-003 | URL 拼接缺少协议校验 | XSS | ??低危 | 低 | P2 |
| STOR-004 | 存储容量超限防护不足 | 存储 | ??低危 | 中 | P2 |
| VAL-003 | 股票代码缺少格式校验 | 输入 | ??低危 | 低 | P2 |
| VAL-004 | URL 参数缺少校验 | 输入 | ??低危 | 低 | P2 |
| VAL-005 | 缺少统一验证工具库 | 输入 | ??低危 | 中 | P3 |
| LEAK-002 | 错误信息暴露实现细节 | 泄露 | ??低危 | 低 | P2 |
| LEAK-003 | 测试文件硬编码 Key | 泄露 | ??低危 | 低 | P3 |
| LEAK-004 | API Key 可能出现在错误中 | 泄露 | ??低危 | 低 | P2 |
| LEAK-005 | 版本信息泄露技术栈 | 泄露 | ??低危 | 低 | P3 |
| LEAK-006 | 数据库结构暴露 | 泄露 | ??低危 | - | P3 |
| LEAK-007 | 操作日志可能含敏感数据 | 泄露 | ??低危 | 中 | P3 |

---

## 四、亮点与最佳实践

本项目在安全方面也有一些做得好的地方：

1. **API Key 脱敏显示**: `fetcherConfig.ts` 中对 API Key 进行了掩码显示（前 4 位 + **** + 后 4 位）
2. **Logger 封装**: 有统一的 logger 封装，支持日志级别控制
3. **LocalStorage 封装**: `localStorageManager.ts` 提供了 TTL 过期管理和容量监控
4. **LLM 配置校验**: `llmClient.ts` 中有 `assertConfig` 函数进行非空校验
5. **错误边界**: 实现了全局和 Widget 级别的错误边界，提升了应用健壮性
6. **无 eval / new Function**: 代码中未发现 `eval` 和 `new Function` 等动态代码执行
7. **无 dangerouslySetInnerHTML**: 未发现直接设置 innerHTML 的危险操作

---

## 五、修复路线图建议

### 第一阶段（P0 - 立即修复）
- [ ] 引入 DOMPurify，对所有 LLM 返回内容进行 XSS 清理
- [ ] 评估 API Key 存储方案，改为内存存储或加密存储

### 第二阶段（P1 - 本周修复）
- [ ] 完善 LLM 配置输入的格式校验（URL 协议、API Key 格式等）
- [ ] 生产环境移除 console 输出
- [ ] 封装安全数字解析工具函数，推广使用
- [ ] 为关键存储数据增加完整性校验

### 第三阶段（P2 - 本月修复）
- [ ] 添加 CSP 内容安全策略
- [ ] 错误信息脱敏，生产环境不暴露技术细节
- [ ] 股票代码等业务输入增加格式校验
- [ ] URL 参数校验和过滤
- [ ] API Key 在错误信息和日志中脱敏

### 第四阶段（P3 - 长期优化）
- [ ] IndexedDB 敏感字段加密
- [ ] 建立统一的输入验证工具库
- [ ] 测试文件敏感信息治理
- [ ] 操作日志数据脱敏
- [ ] 存储容量安全策略优化

---

## 六、审计说明

1. **审计方法**: 本审计基于静态代码扫描，通过 grep 模式匹配 + 人工抽样验证完成
2. **覆盖率**: 覆盖 `src/` 目录下全部 396 个 TypeScript/TSX 文件
3. **局限性**:
   - 未进行动态安全测试（如 DAST）
   - 未审计第三方依赖库的安全性
   - 未审计构建配置和部署配置
   - 未进行渗透测试
4. **建议**: 本次审计发现的问题修复后，建议进行一次全面的渗透测试验证

---

**报告生成时间**: 2026-06-29  
**审计工具**: 静态代码扫描 + 人工复核  
**审计人员**: AI Security Auditor
