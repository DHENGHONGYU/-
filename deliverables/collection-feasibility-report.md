# 8 维采集可行性分析报告

> 生成: 2026-07-19 · 基线: P0-P1 整改完成后 · 验证: 静态配置 31/31 通过 + 测试 91/91 通过

---

## 一、总体评估

| 指标 | 整改前 | 整改后 |
|------|--------|--------|
| 可真实采集的维度 | 0~1 个 (仅 01 行情可能可用) | **2 个可靠 + 4 个需适配 + 2 个待替换** |
| K线数据 | 100% Mock（网易 DNS 不可达） | **🟢 腾讯真实日 K 线** |
| 错误可视性 | 静默吞掉，用户看不到失败原因 | 分类 warn 日志 + missingReportDetector 启用 |
| Mock/真实区分 | 无 | 管线注入 `_source: 'mock'|'real'` + `_fallbackReason` |

## 二、逐维度可行性详情

### 🟢 维度 01 — 基本信息 (行情)

- **数据来源**: 腾讯 `qt.gtimg.cn` → 新浪 `hq.sinajs.cn` → Mock
- **验证状态**: ✅ 腾讯/新浪公开 API，无需鉴权，Vite proxy 已验证运行
- **可行性**: **>95% 成功**。仅当腾讯+新浪同时故障时回退 Mock
- **建议**: 无需额外改动

### 🟢 维度 02 — K线数据

- **数据来源**: 🔄 新增腾讯 `web.ifzq.gtimg.cn` (fqkline API) → Mock
- **验证状态**: ✅ 腾讯日 K API 公开可用，新 proxy 规则 `tencent-kline` 已配置
- **可行性**: **>95% 成功**。从 100% Mock 恢复为真实数据
- **建议**: 首次采集后验证 K线日期对齐和复权模式 (qfq=前复权)

### 🟡 维度 03 — 筹码分布

- **数据来源**: 新浪 `vip.stock.finance.sina.com.cn` (corp/go.php)
- **验证状态**: ⚠️ proxy 已通，但新浪页面返回 HTML 而非 JSON
- **阻因**: `safeFetch` 后 `resp.json()` 对 HTML 页面会抛异常 → 回退 Mock
- **方案**: P2 引入 HTML 解析器 (cheerio/jsdom) 抽取股东户数/集中度字段，或将端点替换为 eastmoney `push2.eastmoney.com/api/qt/stock/fflow`
- **可行性**: **需 P2 适配层**

### 🟡 维度 04/05 — 重大事项/热点新闻

- **数据来源**: 新浪 `vip.stock.finance.sina.com.cn` (公告/新闻页)
- **验证状态**: ⚠️ 同维度 03，HTML 页面 → `resp.json()` 失败
- **方案**: 
  - 短期: 接入东方财富新闻 API (`push2.eastmoney.com/api/qt/ulist`) 或新浪 RSS (`roll.finance.sina.com.cn/finance/lc/lc_news`)
  - 长期: 激活 `westock-mcp` 连接器获取结构化新闻
- **可行性**: **需 P2 RSS/API 切换**

### 🔴 维度 06 — 行业竞品

- **数据来源**: 腾讯 `proxy.finance.qq.com` (行业接口)
- **验证状态**: ❌ `proxy.finance.qq.com` **不是公开的腾讯财经 API 域名**
- **阻因**: 目标域名不存在或不可达
- **方案**: 替换为 eastmoney 行业分类 API: `push2.eastmoney.com/api/qt/clist/get` 或东方财富板块接口
- **可行性**: **需替换端点**

### 🟡 维度 07 — 关联指数

- **数据来源**: 腾讯 `qt.gtimg.cn` (指数实时行情)
- **验证状态**: ✅ 指数价格可获取；⚠️ correlation/beta 硬编码为 0
- **方案**: 维度 02 (K线) 恢复后，用标的 + 指数的 60+ 日历史价格计算 Pearson correlation 和 beta 系数
- **可行性**: **价格已通，相关性计算需 P2 启用**

### 🔴 维度 08 — 研报中心

- **数据来源**: 无 (网易 DNS 不可达) → Mock
- **验证状态**: ❌ 已确认无可用端点
- **方案**: 接入 `eastmoney data.eastmoney.com` 研报接口，或激活 `westock-mcp` 连接器
- **可行性**: **需新增端点接入**

## 三、修复效果对比矩阵

```
                         整改前                    整改后
  01 基本信息      🟢 腾讯/新浪(可用)      🟢 腾讯/新浪(可靠)
  02 K线          🔴 100% Mock           🟢 腾讯真实日K ← 从0到1
  03 筹码         🔴 Mock                🟡 待HTML适配
  04 公告         🔴 Mock                🟡 待HTML适配/RSS
  05 新闻         🔴 Mock                🟡 待HTML适配/RSS
  06 竞品         🔴 Mock                🔴 待换端点(东财)
  07 指数         🔴 Mock                🟡 价通/相关性待算
  08 研报         🔴 Mock                🔴 待新端点(东财/MCP)
```

## 四、下一步方案 (P2 优先级)

### 4.1 关键路径 (解锁维度 03-05 + 07)

| 优先级 | 任务 | 影响维度 | 预估工时 |
|--------|------|---------|---------|
| P2-1 | 维度 04/05: 东方财富新闻 API 接入 | 04, 05 | 2h |
| P2-2 | 维度 03: 东方财富资金流 API 替换新浪 | 03 | 1h |
| P2-3 | 维度 07: 基于 K2 数据的 Pearson 相关性计算 | 07 | 2h |
| P2-4 | 维度 06: 东财行业 API 替换腾讯失效端点 | 06 | 1.5h |
| P2-5 | 维度 08: 东财研报 API 接入 | 08 | 2h |

### 4.2 基础设施

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P2-6 | `multiSourceFetcher` 增加 HTML→JSON 适配器 | 处理新浪 HTML 页面 |
| P2-7 | 激活 `westock-mcp` 连接器 (如可用) | 一键解放维度 04/05/08 |

### 4.3 验证

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P2-8 | 标杆股票全维度采集 E2E 测试 | 对 `600519.SH` 执行全维度采集，校验数据非空 |
| P2-9 | 修复 `fetcherClient.test.ts` 4 个 TODO 测试 | 恢复 fetcher 层测试覆盖 |

---

## 五、当前可验证项

运行诊断脚本:
```bash
node ./node_modules/tsx/dist/cli.mjs scripts/verify-collection-pipeline.ts
```

运行采集测试:
```bash
npx vitest run tests/__tests__/integration/collection-pipeline.integration.test.ts tests/__tests__/sevenDimConfigStore.test.ts
```
