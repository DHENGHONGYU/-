---
title: "directDataAPI Bug 修复说明（2026-08-09）"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# directDataAPI Bug 修复说明（2026-08-09）

## 概述

本文档记录 `src/services/fetcher/directDataAPI.ts`、`vite.config.ts` 及集成测试文件 `directDataAPI.integration.test.ts` 中发现的 6 类 Bug 及其修复方案。涉及 Vite proxy 配置、港股代码转换、JSON 解析错误、腾讯/新浪港股行情字段错位、GBK 编码转换、gzip 解压等问题。

---

## Bug 1: createTextResponse 中 JSON.parse 导致测试初始化失败

### 严重等级

P1 严重（测试阻塞）

### 问题描述

集成测试文件中的 `createTextResponse` 辅助函数在 mock 初始化阶段直接调用 `JSON.parse(text)`：

```typescript
// 修复前（有 Bug）
function createTextResponse(text: string, status = 200): Response {
  return {
    json: vi.fn().mockResolvedValue(JSON.parse(text)),  // ← 初始化时就执行 JSON.parse
  } as unknown as Response
}
```

当传入非 JSON 文本（如腾讯行情 `v_sh600519="1~贵州茅台~..."`）时，`JSON.parse` 立即抛出 `SyntaxError`，导致测试用例无法执行。

### 根因分析

`mockResolvedValue(JSON.parse(text))` 中 JavaScript 先求值参数 `JSON.parse(text)` 再传给 `mockResolvedValue`。对于非 JSON 文本必然失败。浏览器中 `Response.json()` 的真实行为是仅在调用时才解析响应体。

### 修复方案

改为延迟解析 + try-catch：

```typescript
json: vi.fn().mockImplementation(() => {
  try {
    return Promise.resolve(JSON.parse(text))
  } catch (err) {
    return Promise.reject(err)  // 与浏览器行为一致
  }
}),
```

### 影响范围

- 文件：`src/services/fetcher/directDataAPI.integration.test.ts`
- 影响测试用例：约 30 个使用 `createTextResponse` 传入非 JSON 文本的用例

---

## Bug 2: 新浪港股行情字段错位

### 严重等级

P1 严重（数据正确性）

### 问题描述

`parseSinaQuote` 使用固定的 A 股字段索引解析所有行情响应，但新浪港股响应字段顺序与 A 股不同，导致港股行情数据字段错位。

### 根因分析

**新浪 A 股响应**：
```
var hq_str_sh600519="名称,开盘,昨收,当前价,最高,最低,...,日期,时间,...";
       [0]     [1]   [2]    [3]    [4]  [5]         [26]  [27]
```

**新浪港股响应**：
```
var hq_str_rt_hk00700="英文名,中文名,开盘,昨收,最高,最低,当前价,涨跌额,涨跌幅,...,日期,时间,...";
       [0]      [1]    [2]   [3]   [4]  [5]   [6]    [7]     [8]          [17]  [18]
```

代码按 A 股固定索引解析导致：`name`="TENCENT"（应为腾讯控股）、`price`=479.2（实为昨收价，应为 478.8 当前价）、`volume/amount`=0（索引越界）。

### 修复方案

1. 修改正则从 `/hq_str_\w+="([^"]*)"/` 改为 `/hq_str_(\w+)="([^"]*)"/`，捕获前缀
2. 前缀 `rt_hk` 开头 → 调用新增的 `parseSinaHkQuote` 函数
3. 新增 `parseSinaHkQuote` 函数，使用港股专用字段索引：

| 字段 | 港股索引 | A 股索引 |
|---|---|---|
| 中文名 | [1] | [0] |
| 开盘价 | [2] | [1] |
| 昨收价 | [3] | [2] |
| 最高价 | [4] | [4] |
| 最低价 | [5] | [5] |
| 当前价 | [6] | [3] |
| 涨跌额 | [7] | 计算 |
| 涨跌幅 | [8] | 计算 |
| 成交额 | [11] | [30] |
| 成交量 | [12] | [29] |
| 日期 | [17] (YYYY/MM/DD) | [26] (YYYY-MM-DD) |
| 时间 | [18] | [27] |

4. 港股日期格式 `YYYY/MM/DD` 统一替换为 `YYYY-MM-DD` 以兼容 `parseSinaTimestamp`
5. `sinaBatchQuotes` 中 segCode 提取正则从 `/^(sh|sz|bj)/` 改为 `/^(sh|sz|bj|rt_hk)/`，正确处理港股前缀

### 影响范围

- 文件：`src/services/fetcher/directDataAPI.ts`（`parseSinaQuote` L480-528 + 新增 `parseSinaHkQuote` L553-588）
- 影响场景：降级链中腾讯失败后通过新浪获取港股行情时数据错位
- 不影响 A 股行情

---

## Bug 3: v_pv_none_match 场景的测试预期错误

### 严重等级

P2 优化（测试预期不准确）

### 问题描述

原测试预期 `tencentKline` 收到 `v_pv_none_match` 响应时"返回空数组（不抛异常）"，但实际代码行为是抛出 `DirectDataAPIError`。

### 根因分析

`v_pv_none_match="1";` 是纯文本响应（非 JSON）。`tencentKline` 调用 `response.json()` 时抛出 `SyntaxError`，被 catch 块包装为 `DirectDataAPIError`。这是预期且合理的行为——非 JSON 响应应抛错，让上层 orchestrator 捕获后降级。

### 修复方案

修正测试预期从"返回空数组"改为"抛出 Error"：

```typescript
// 修复后
test('0700.HK → v_pv_none_match 响应（非 JSON）→ 抛出 Error（触发上层降级）', async () => {
  mockFetch.mockResolvedValue(createTextResponse(TENCENT_KLINE_VPV_NONE_MATCH))
  await expect(tencentKline('0700.HK', 'day', 10)).rejects.toThrow()
})
```

### 影响范围

- 文件：`src/services/fetcher/directDataAPI.integration.test.ts`
- 影响测试用例：2 个

---

## Bug 4: 腾讯港股行情字段错位

### 严重等级

P1 严重（数据正确性）

### 问题描述

`parseTencentQuote` 使用固定的 A 股字段索引解析所有行情响应，但腾讯港股响应字段顺序与 A 股完全不同，导致港股行情数据字段错位。

### 根因分析

**腾讯 A 股响应**（38+ 字段）：
```
v_sh600519="1~贵州茅台~600519~1309.22~1308.55~1308.66~24976~...~20260807~15:00:00/...";
         [0]  [1]     [2]    [3]       [4]       [5]      [6]       [30]     [31]
```
A 股字段：[1]name [2]code [3]price [4]prevClose [5]open [6]volume(手) [30]date [31]time [33]high [34]low [37]amount(万元)

**腾讯港股响应**（仅 10 字段）：
```
v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";
          [0]  [1]      [2]   [3]      [4]       [5]    [6]          [7]            [8] [9]
```
港股字段：[1]name [2]code [3]price [4]change(涨跌额) [5]changePercent(涨跌幅) [6]volume [7]amount

**代码按 A 股索引解析港股导致**：

| 字段 | 期望值 | 实际解析值 | 原因 |
|---|---|---|---|
| prevClose | 479.2 | -0.4 | fields[4] 是涨跌额，非昨收价 |
| open | 479.0 | -0.08 | fields[5] 是涨跌幅，非开盘价 |
| high | 483.2 | 0 | fields[33] 越界 |
| low | 475.4 | 0 | fields[34] 越界 |
| volume | 16319939 | 1631993900 | fields[6] 被 *100（港股不需要） |
| amount | 7803757295.25 | 0 | fields[37] 越界 |

### 修复方案

1. 修改正则从 `/v_\w+="([^"]+)"/` 改为 `/v_(\w+)="([^"]+)"/`，捕获变量名前缀
2. 前缀 `s_hk` 开头 → 调用新增的 `parseTencentHkQuote` 函数
3. 新增 `parseTencentHkQuote` 函数，使用港股专用字段索引：

| 字段 | 港股索引 | A 股索引 | 说明 |
|---|---|---|---|
| name | [1] | [1] | 相同 |
| code | [2] | [2] | 相同 |
| price | [3] | [3] | 相同 |
| change | [4] | 计算 | 港股直接提供涨跌额 |
| changePercent | [5] | 计算 | 港股直接提供涨跌幅 |
| volume | [6] | [6]*100 | 港股已是原始单位 |
| amount | [7] | [37]*10000 | 港股已是原始单位 |
| prevClose | price-change | [4] | 港股不提供，由推导得出 |
| open | 0 | [5] | 港股不提供 |
| high | 0 | [33] | 港股不提供 |
| low | 0 | [34] | 港股不提供 |
| timestamp | Date.now() | [30]+[31] | 港股不提供日期时间 |

### 影响范围

- 文件：`src/services/fetcher/directDataAPI.ts`（`parseTencentQuote` L215-264 + 新增 `parseTencentHkQuote` L293-322）
- 影响场景：腾讯行情获取港股实时数据时字段错位
- `tencentBatchQuotes` 自动继承修复（调用 `parseTencentQuote`）

---

## Bug 5: Vite proxy GBK→UTF-8 编码转换缺失

### 严重等级

P1 严重（中文显示）

### 问题描述

腾讯和新浪行情 API 返回 GBK 编码文本，但浏览器 `fetch` 以 UTF-8 解析，导致中文名称显示为乱码。

### 根因分析

- 腾讯 `https://qt.gtimg.cn/q=sh600519` 返回 GBK 编码的 `v_sh600519="1~贵州茅台~..."`
- 新浪 `https://hq.sinajs.cn/list=sh600519` 返回 GBK 编码的 `var hq_str_sh600519="贵州茅台,..."`
- Vite proxy 默认直接透传响应流，不做编码转换
- 浏览器 `Response.text()` 以 UTF-8 解码 GBK 字节流 → 中文乱码

### 修复方案

在 Vite proxy 配置中为腾讯和新浪行情代理添加 `selfHandleResponse: true` + `TextDecoder('gbk')` 编码转换：

```typescript
'/api/proxy/tencent': {
  target: 'https://qt.gtimg.cn',
  changeOrigin: true,
  rewrite: (path) => '/q=' + path.replace('/api/proxy/tencent/', ''),
  headers: { Referer: 'https://finance.qq.com' },
  selfHandleResponse: true,  // 手动处理响应
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes, req, res) => {
      const chunks: Buffer[] = []
      // 根据上游响应头选择解压流（gzip/deflate/br/none）
      const encoding = (proxyRes.headers['content-encoding'] ?? '').toLowerCase()
      let stream: NodeJS.ReadableStream = proxyRes
      if (encoding.includes('gzip')) stream = proxyRes.pipe(zlib.createGunzip())
      else if (encoding.includes('deflate')) stream = proxyRes.pipe(zlib.createInflate())
      else if (encoding.includes('br')) stream = proxyRes.pipe(zlib.createBrotliDecompress())
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const utf8Text = new TextDecoder('gbk').decode(buffer)  // GBK → UTF-8
        res.statusCode = proxyRes.statusCode ?? 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(utf8Text)
      })
    })
  },
},
```

新浪行情代理（`/api/proxy/sina`）配置相同。

### 影响范围

- 文件：`vite.config.ts`（L222-287）
- 影响场景：浏览器端通过 Vite proxy 获取腾讯/新浪行情时中文名称乱码
- 修复后：A 股（贵州茅台、五粮液、宁德时代等）和港股（腾讯控股、阿里巴巴-W、汇丰控股等）中文名称均正确显示

---

## Bug 6: selfHandleResponse 未处理 gzip 压缩

### 严重等级

P1 严重（功能阻塞）

### 问题描述

Bug 5 修复后，使用 `selfHandleResponse: true` 手动处理响应，但腾讯/新浪 API 返回 gzip 压缩响应（`Content-Encoding: gzip`），直接用 `TextDecoder('gbk')` 解码 gzip 字节流导致解析失败，所有行情请求返回空数据。

### 根因分析

- `selfHandleResponse: true` 时，`http-proxy` 不会自动解压响应
- 腾讯 API 响应头 `Content-Encoding: gzip`，响应体是 gzip 压缩的 GBK 字节流
- 直接 `TextDecoder('gbk').decode(gzipBuffer)` 产出乱码，`parseTencentQuote` 无法匹配正则 → 返回 null → 抛出 "解析腾讯行情失败"

### 修复方案

在编码转换前先根据 `Content-Encoding` 头选择解压流：

```typescript
const encoding = (proxyRes.headers['content-encoding'] ?? '').toLowerCase()
let stream: NodeJS.ReadableStream = proxyRes
if (encoding.includes('gzip')) stream = proxyRes.pipe(zlib.createGunzip())
else if (encoding.includes('deflate')) stream = proxyRes.pipe(zlib.createInflate())
else if (encoding.includes('br')) stream = proxyRes.pipe(zlib.createBrotliDecompress())
// 后续从 stream（而非 proxyRes）收集数据
stream.on('data', ...)
stream.on('end', () => {
  const buffer = Buffer.concat(chunks)
  const utf8Text = new TextDecoder('gbk').decode(buffer)  // 解压后再 GBK→UTF-8
  ...
})
```

需要在文件顶部导入 `zlib`：

```typescript
import zlib from 'node:zlib'
```

### 影响范围

- 文件：`vite.config.ts`（L5 新增 import + L234-239/L267-272 解压逻辑）
- 影响场景：`selfHandleResponse: true` 模式下所有 gzip/deflate/br 压缩响应

---

## 其他已识别问题（未修复，记录待后续处理）

### P2: 魔法数字

| 位置 | 值 | 含义 | 建议 |
|---|---|---|---|
| L109, L119, L129 | `5` | 港股代码补零长度 | 抽常量 `HK_CODE_LENGTH` |
| L232 | `100` | 手→股乘数 | 补 `SHOU_TO_GU_MULTIPLIER` |
| L237 | `100` | 百分比乘数 | 补 `PERCENT_MULTIPLIER` |

### P2: 网易代码潜在碰撞

`getNeteaseCode` 中深市 A 股与港股都使用 `1` 前缀：`000858.SZ`→`1000858`，`000858.HK`→`1000858`（5 位补零后相同）。

### P2: 批量行情 code 格式不一致

`tencentQuote` 返回 `code:'600519.SH'`（带后缀），但 `tencentBatchQuotes` 返回 `code:'600519'`（裸码）。

### P2: ESLint 警告（6 处）

`strict-boolean-expressions` 和 `prefer-optional-chain` 警告，均为低风险。

---

## 测试覆盖总结

集成测试文件 `directDataAPI.integration.test.ts` 共 79 个测试用例，覆盖 16 大类场景：

| # | 场景类别 | 用例数 | 覆盖内容 |
|---|---|---|---|
| 1 | A 股行情 | 2 | 腾讯行情解析 + Vite proxy URL 验证 |
| 2 | 港股行情 | 3 | s_hk00700 代码转换 + 行情解析 + 9988.HK |
| 3 | A 股 K 线 | 3 | qfqday 解析 + Vite proxy URL + 深市代码 |
| 4 | 港股 K 线 | 3 | 空数据降级 + URL 验证 + v_pv_none_match |
| 5 | 新浪行情 | 3 | 港股 rt_hk00700 + A 股 sh600519 + Vite proxy |
| 6 | Vite proxy 路径 | 2 | 同源路径验证 + 不含绝对 URL |
| 7 | 异常降级 | 9 | 网络错误/HTTP 500/403/502/AbortError |
| 8 | 行情解析异常 | 5 | 空响应/格式不匹配/字段不足 |
| 9 | K 线数据降级 | 5 | qfqday 缺失/day 降级/data 缺失/无匹配 key |
| 10 | 港股代码边界 | 5 | 4 位补零/5 位数字/小写后缀/带空格 |
| 11 | 批量行情 | 7 | A 股+港股混合/空数组/部分失败/URL 未编码 |
| 12 | 网易历史 K 线 | 8 | CSV 解析/A 股/港股/空响应/HTTP 500/AbortError |
| 13 | 降级编排 | 4 | tencent→sina/tencent→netease 链式降级 |
| 14 | 特殊代码 | 10 | ETF/可转债/科创板/创业板/港股/纯数字 |
| 15 | JSON 解析失败 | 6 | HTML 错误页/空字符串/结构异常/qfqday 异常 |
| 16 | 代码转换函数 | 4 | getMarketPrefix/buildTencentCode/buildSinaCode/getNeteaseCode |

单元测试 `directDataAPI.marketPrefix.test.ts` 共 22 个用例，覆盖 5 个代码转换函数。

---

## 实际验证结果

### 2026-08-09 浏览器验证

开发环境（http://localhost:3002/）实际采集验证：

**字段映射验证**（腾讯+新浪双源对比）：

| 字段 | 腾讯源 | 新浪源 | 验证结果 |
|---|---|---|---|
| price | 478.8 | 478.8 | PASS - 两源一致 |
| prevClose | 479.2 (推导) | 479.2 | PASS - 两源一致 |
| change | -0.4 | -0.4 | PASS - 两源一致 |
| changePercent | -0.08 | -0.083 | PASS - 微小精度差异 |
| volume | 16319939 | 16319939 | PASS - 两源一致 |
| amount | 7803757295.25 | 7803757295.25 | PASS - 两源一致 |
| source | 'tencent' | 'sina' | PASS |

**编码转换验证**：

| 股票 | 类型 | name | 验证结果 |
|---|---|---|---|
| 600519.SH | A 股 | 贵州茅台 | PASS |
| 000858.SZ | A 股 | 五粮液 | PASS |
| 300750.SZ | A 股 | 宁德时代 | PASS |
| 510300.SH | ETF | 沪深300ETF华泰柏瑞 | PASS |
| 0700.HK | 港股 | 腾讯控股 | PASS |
| 9988.HK | 港股 | 阿里巴巴-W | PASS |
| 0005.HK | 港股 | 汇丰控股 | PASS |

- **CORS 验证**：所有请求走 Vite proxy 同源路径，无 CORS 错误
- **降级验证**：港股行情请求同时出现 `/api/proxy/tencent/` 和 `/api/proxy/sina/`，证明腾讯→新浪降级链路生效

### 测试状态

- 135 个测试全部通过（34 港股专项 + 79 集成 + 22 单元）
- tsc 0 错误（本次修改文件零类型错误）
- ESLint 0 错误（6 个 warning，均为低风险）

---

## Bug 7: 测试数据样本字段不完整导致 high/low 索引越界

### 严重等级

P2 优化（测试数据质量）

### 问题描述

`directDataAPI.hkQuote.test.ts` 中的腾讯 A 股测试数据样本 `TENCENT_A_600519` 仅包含 32 个字段（索引 0-31），但 `parseTencentQuote` 从 `fields[33]`/`fields[34]` 取 high/low，索引越界导致 `safeNumber(undefined)` 返回 0。

测试用例 "A 股行情不触发港股解析路径" 断言 `expect(q.high).not.toBe(0)` 失败：

```
AssertionError: expected +0 not to be +0 // Object.is equality
 ❯ directDataAPI.hkQuote.test.ts:487:24
    486|     expect(q.high).not.toBe(0)
    487|     expect(q.low).not.toBe(0)
```

### 根因分析

真实腾讯 A 股响应包含 40+ 字段（含买卖盘档位），high 在 `fields[33]`、low 在 `fields[34]`、amount 在 `fields[37]`。测试数据样本截断了日期时间后的字段，导致索引越界。

### 修复方案

在测试数据样本 `15:00:00/00/` 之后补充 `~~1315.28~1301.00~~327456.00`，使 `fields[33]=1315.28`（high）、`fields[34]=1301.00`（low）、`fields[37]=327456.00`（amount，万元），贴合真实腾讯 A 股响应结构。

### 影响范围

- 文件：`src/services/fetcher/directDataAPI.hkQuote.test.ts`（TENCENT_A_600519 数据样本）
- 影响测试用例：1 个（"A 股行情不触发港股解析路径"）

---

## 修复文件清单

| 文件 | 修改内容 |
|---|---|
| `src/services/fetcher/directDataAPI.ts` | Bug 2/4：parseSinaQuote + parseTencentQuote 港股字段错位修复，新增 parseSinaHkQuote + parseTencentHkQuote |
| `src/services/fetcher/directDataAPI.integration.test.ts` | Bug 1/3：createTextResponse JSON.parse 修复 + v_pv_none_match 预期修正 + 港股行情断言更新 |
| `vite.config.ts` | Bug 5/6：Vite proxy GBK→UTF-8 编码转换 + gzip 解压 + 提取 createGbkProxyResHandler/createProxyErrorHandler 公共函数 + 上游错误处理 |
| `src/services/fetcher/directDataAPI.hkQuote.test.ts` | Bug 7：港股行情解析专项测试（34 用例）+ TENCENT_A_600519 数据样本补全 high/low/amount 字段 |
| `src/services/fetcher/directDataAPI.marketPrefix.test.ts` | 代码转换函数单元测试（22 个用例） |

---

## 相关文档

- [V9-DOC-BACK-012] directDataAPI 数据采集模块文档
- [V9-DOC-DATA-047] 市场数据端点配置文档
- [V9-DOC-FRONT-020] Vite proxy 配置文档
