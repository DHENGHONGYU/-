# 技术复盘：Vite Proxy 配置与港股代码转换（2026-08-09）

## 概述

本次复盘聚焦 directDataAPI 模块中 Vite proxy 行情代理配置和港股代码转换逻辑的修复过程。共修复 7 类 Bug，新增 135 个测试用例，涉及 `vite.config.ts`、`src/services/fetcher/directDataAPI.ts` 及 3 个测试文件。

相关文档：[directDataAPI-bugfix-2026-08-09.md](../lessons/directDataAPI-bugfix-2026-08-09.md)

---

## 一、问题时间线

| 阶段 | 问题 | 影响 |
|---|---|---|
| 初始开发 | Vite proxy 直接透传 GBK 响应 | 中文名称乱码 |
| 修复编码 | 添加 TextDecoder('gbk') 但未处理 gzip | gzip 响应解码失败，行情全空 |
| 修复 gzip | 添加 zlib 解压流但未处理上游错误 | DNS 失败时客户端无响应 |
| 修复错误 | 添加 error handler 但未检查 headersSent | 可能重复发送响应头 |
| 港股行情 | parseTencentQuote/parseSinaQuote 按A股索引解析港股 | 字段错位（prevClose=-0.4, volume*100） |
| 测试验证 | createTextResponse 初始化时 JSON.parse | 非文本响应 mock 初始化即崩溃 |
| 测试数据 | TENCENT_A_600519 样本仅 32 字段 | fields[33]/[34] 越界，high/low=0 |

**核心教训**：每一层修复都可能引入新问题，必须逐层验证而非批量修改后统一测试。

---

## 二、Vite Proxy 配置复盘

### 2.1 架构设计

```
浏览器 fetch → Vite proxy (同源) → 上游 API (腾讯/新浪)
                    ↓
         selfHandleResponse: true
                    ↓
         gzip 解压 → GBK→UTF-8 → 返回浏览器
```

**关键决策**：使用 `selfHandleResponse: true` 手动处理响应，而非依赖 http-proxy 默认透传。

**原因**：
- 腾讯/新浪 API 返回 GBK 编码，浏览器以 UTF-8 解析必乱码
- 上游响应可能 gzip/deflate/br 压缩，需先解压再解码
- 需统一错误响应格式（502 + JSON body）

### 2.2 GBK 编码转换

```typescript
const utf8Text = new TextDecoder('gbk').decode(buffer)
res.setHeader('Content-Type', 'text/plain; charset=utf-8')
res.end(utf8Text)
```

**踩坑点**：`TextDecoder('gbk')` 在 Node.js 中需要 ICU 支持。Node 18+ 默认包含 full-icu，但低版本可能不支持 'gbk' 编码。

### 2.3 gzip 解压

```typescript
const rawEncoding = proxyRes.headers['content-encoding']
const encoding = String(Array.isArray(rawEncoding) ? (rawEncoding[0] ?? '') : (rawEncoding ?? '')).toLowerCase()
let stream: NodeJS.ReadableStream = proxyRes
if (encoding.includes('gzip')) stream = proxyRes.pipe(zlib.createGunzip())
else if (encoding.includes('deflate')) stream = proxyRes.pipe(zlib.createInflate())
else if (encoding.includes('br')) stream = proxyRes.pipe(zlib.createBrotliDecompress())
```

**踩坑点**：
1. `content-encoding` 头类型为 `string | string[] | undefined`，直接 `.toLowerCase()` 会抛异常
2. `selfHandleResponse: true` 时 http-proxy 不会自动解压，必须手动处理
3. 后续 `data`/`end` 事件必须绑定到解压后的 `stream`，而非原始 `proxyRes`

### 2.4 错误处理

两层错误处理：

| 层级 | 事件 | 触发场景 | 响应 |
|---|---|---|---|
| 连接层 | `proxy.on('error')` | DNS 失败/连接拒绝 | 502 + JSON |
| 流处理层 | `stream.on('error')` | 解压失败/解码异常 | 502 + JSON |

**关键守卫**：两个 error handler 均检查 `res.headersSent || res.writableEnded`，避免重复发送响应头导致 `ERR_STREAM_WRITE_AFTER_END`。

### 2.5 公共函数提取

最终将 proxyRes 处理器和 error 处理器提取为公共函数，腾讯和新浪代理共用：

```typescript
function createGbkProxyResHandler(upstreamName: string) { ... }
function createProxyErrorHandler(upstreamName: string) { ... }

// 使用
'/api/proxy/tencent': {
  selfHandleResponse: true,
  configure: (proxy) => {
    proxy.on('proxyRes', createGbkProxyResHandler('Tencent'))
    proxy.on('error', createProxyErrorHandler('Tencent'))
  },
},
```

**收益**：消除腾讯/新浪代理配置的重复代码（各 ~30 行 → 1 行调用），错误处理逻辑统一维护。

---

## 三、港股代码转换复盘

### 3.1 代码格式规范

| 数据源 | A 股格式 | 港股格式 | 示例 |
|---|---|---|---|
| 腾讯行情 | `sh600519` | `s_hk00700` | 港股 5 位补零 |
| 新浪行情 | `sh600519` | `rt_hk00700` | 港股 5 位补零 |
| 腾讯 K 线 | `sh600519` | `s_hk00700` | 同行情 |
| 网易历史 | `0600519` | `100700` | 沪市前缀 0，深市前缀 1，港股前缀 1 |

**关键函数**：`getMarketPrefix` / `buildTencentCode` / `buildSinaCode` / `getNeteaseCode` / `stripCodeSuffix`

### 3.2 字段映射差异

**核心问题**：腾讯/新浪的 A 股和港股响应字段顺序完全不同，不能用同一套索引解析。

#### 腾讯行情字段对比

| 字段 | A 股索引 | 港股索引 | 差异说明 |
|---|---|---|---|
| name | [1] | [1] | 相同 |
| price | [3] | [3] | 相同 |
| prevClose | [4] | price-change | 港股不提供，推导 |
| open | [5] | 0 | 港股不提供 |
| volume | [6]*100 | [6] | A 股单位为手，港股已是原始单位 |
| high | [33] | 0 | 港股不提供 |
| low | [34] | 0 | 港股不提供 |
| amount | [37]*10000 | [7] | A 股单位为万元，港股已是原始单位 |
| change | 计算 | [4] | 港股直接提供 |
| changePercent | 计算 | [5] | 港股直接提供 |

#### 新浪行情字段对比

| 字段 | A 股索引 | 港股索引 | 差异说明 |
|---|---|---|---|
| name | [0] | [1] | 港股 [0] 是英文名 |
| price | [3] | [6] | 完全不同位置 |
| open | [1] | [2] | — |
| prevClose | [2] | [3] | — |
| volume | [29] | [12] | 完全不同位置 |
| amount | [30] | [11] | 完全不同位置 |
| date | [26] YYYY-MM-DD | [17] YYYY/MM/DD | 日期分隔符不同 |

### 3.3 解析路径分叉

通过正则捕获变量名前缀实现 A 股/港股解析路径分叉：

```typescript
// 腾讯：捕获 v_xxx="..." 中的 xxx
const match = text.match(/v_(\w+)="([^"]+)"/)
const prefix = match[1] ?? ''
if (prefix.startsWith('s_hk')) {
  return parseTencentHkQuote(fields, code)  // 港股路径
}
// A 股路径...

// 新浪：捕获 hq_str_xxx="..." 中的 xxx
const match = text.match(/hq_str_(\w+)="([^"]*)"/)
const prefix = match[1] ?? ''
if (prefix.startsWith('rt_hk')) {
  return parseSinaHkQuote(fields, code)  // 港股路径
}
// A 股路径...
```

### 3.4 降级编排

```
tencentQuote(0700.HK)  ──失败──→  sinaQuote(0700.HK)  ──失败──→  AKShare/Mock
        │                              │
        ↓                              ↓
   s_hk00700                     rt_hk00700
   字段 [1-7]                    字段 [1-18]
   open/high/low=0               open/high/low 有值
```

**关键点**：降级时两个源的 volume/amount 单位一致（原始单位），但字段索引不同。降级链中的字段映射必须各自独立正确。

---

## 四、测试策略复盘

### 4.1 测试分层

| 层级 | 文件 | 用例数 | 覆盖内容 |
|---|---|---|---|
| 单元测试 | marketPrefix.test.ts | 22 | 5 个代码转换函数 |
| 集成测试 | integration.test.ts | 79 | Vite proxy URL + 降级 + 异常 |
| 专项测试 | hkQuote.test.ts | 34 | 港股行情字段 + 编码 + 边界 |

### 4.2 Mock 策略

```typescript
// 拦截所有 fetch 请求，返回预设响应
vi.stubGlobal('fetch', mockFetch)

// mock Response 的关键：延迟 JSON 解析
function createTextResponse(text: string): Response {
  return {
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockImplementation(() => {
      try { return Promise.resolve(JSON.parse(text)) }
      catch (err) { return Promise.reject(err) }  // 与浏览器行为一致
    }),
  } as unknown as Response
}
```

**踩坑点**：`mockResolvedValue(JSON.parse(text))` 会在初始化时立即执行 `JSON.parse`，非 JSON 文本直接抛异常。必须改为 `mockImplementation` 延迟解析。

### 4.3 测试数据完整性

**问题**：测试数据样本 `TENCENT_A_600519` 截断了真实响应中的买卖盘档位字段，导致 `fields[33]`/`fields[34]` 越界。

**教训**：测试数据样本应尽量贴合真实响应结构，至少包含代码所访问的所有字段索引。截断数据可能掩盖索引越界问题。

### 4.4 测试覆盖场景

- A 股行情（腾讯 + 新浪）：字段映射 + Vite proxy URL
- 港股行情（腾讯 + 新浪）：代码转换（5 位补零）+ 字段映射隔离
- K 线数据：qfqday/day 降级 + v_pv_none_match + 腾讯不支持港股 K 线
- 降级编排：腾讯→新浪链式降级 + 字段一致性验证
- 异常处理：网络错误/HTTP 500/403/502/AbortError/字段不足/JSON 解析失败
- 代码转换边界：1/2/5 位数字/前导零/ETF/可转债/科创板/创业板
- GBK 解码验证：模拟 Vite proxy 转换后的中文文本解析

---

## 五、经验教训

1. **逐层验证**：编码转换、gzip 解压、错误处理应逐层添加并验证，而非一次性修改后统一测试。每一层修复都可能引入新问题。

2. **类型安全**：`content-encoding` 头类型为 `string | string[] | undefined`，直接调用字符串方法会抛异常。Node.js HTTP 头部必须按规范处理多值情况。

3. **响应守卫**：所有 error handler 必须检查 `res.headersSent || res.writableEnded`，避免重复发送响应头。

4. **字段索引分叉**：不同市场（A 股/港股）、不同数据源（腾讯/新浪/网易）的字段顺序各不相同，不能假设统一格式。正则捕获前缀 + 分叉解析是最稳妥的方案。

5. **单位差异**：A 股 volume 单位为手（需 *100）、amount 单位为万元（需 *10000）；港股已是原始单位。解析时必须区分市场，避免错误放大。

6. **测试数据真实性**：测试数据样本应覆盖代码访问的所有字段索引，截断数据会掩盖索引越界问题。

7. **Mock 延迟解析**：`Response.json()` 的 mock 应延迟解析（`mockImplementation`），而非初始化时立即 `JSON.parse`（`mockResolvedValue`），以匹配浏览器真实行为。

---

## 六、后续改进建议

| 优先级 | 建议 | 说明 |
|---|---|---|
| P2 | 抽常量 `HK_CODE_LENGTH=5` | 港股代码补零长度，当前硬编码 |
| P2 | 抽常量 `SHOU_TO_GU_MULTIPLIER=100` | A 股手→股乘数 |
| P2 | 网易代码碰撞修复 | 深市 A 股与港股前缀均为 `1`，5 位补零后可能碰撞 |
| P2 | 批量行情 code 格式统一 | tencentQuote 返回带后缀，tencentBatchQuotes 返回裸码 |
| P3 | vite.config.ts 纳入 tsc/ESLint | 当前配置文件不在 tsconfig 范围内，无自动化门禁 |
| P3 | Content-Security-Policy 收紧 | connect-src 当前放行 'self' https:，应收紧为精确行情域名白名单 |
