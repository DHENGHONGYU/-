# FinSightV9 方案 B 整改增量 PRD

## 变更范围

### 新增模块
- `src/services/data-collector/tushareProvider.ts`：Tushare Pro API 统一封装
- `src/services/data-collector/crawlerProvider.ts`：爬虫补充层（东财/新浪/Baostock）
- `src/services/data-collector/tushareAdapter.ts`：Tushare 响应字段 → 业务类型转换
- `tests/tushareProvider.test.ts`：Tushare 封装层单元测试
- `tests/crawlerProvider.test.ts`：爬虫补充层单元测试

### 修改模块
- `src/types/modules/collection.types.ts`：扩展 `QuoteDataSourceId` 加入 `tushare`
- `src/config/dataSourceRegistry.ts`：注册 Tushare 数据源，配置默认优先级链
- `src/config/marketDataEndpoints.ts`：新增 Tushare 端点常量（可选自建代理）
- `src/services/data-collector/dataSourceOrchestrator.ts`：在 quote/kline 降级链中加入 Tushare
- `src/services/data-collector/multiSourceFetcher.ts`：维度 03-08 优先走 Tushare，其次爬虫补充
- `src/services/data-collector/collectionPipeline.ts`：source 标签识别 Tushare，失败登记缺失报告

### 不修改模块
- `src/store/*`：状态层接口保持不变
- `src/pages/input/*`：UI 层不改动，仅通过 store 观察采集状态

---

## Tushare Pro 能力分析

### 套餐说明
- **Tushare Pro 5000 积分套餐**：约 500 元/年，提供 5000 积分/年基础额度
- 积分消耗规则：基础日线 `daily` 约 0.5 积分/次，特色数据约 2-20 积分/次
- 5000 积分可支持：约 2000 次特色数据调用或 10000 次日线调用
- 单次调用建议通过服务端缓存/本地 IndexedDB 缓存，避免重复消耗积分

### 8 维度接口映射

| 维度 | 名称 | Tushare 接口 | 参数 | 返回字段 | 单次积分 | 更新频率 |
|------|------|-------------|------|---------|---------|---------|
| 01 | 基本信息 | `stock_basic` | ts_code, list_status | ts_code, name, industry, list_date | 0.2 | 日更 |
| 01 | 实时行情 | `daily` 当日 | trade_date, ts_code | open, high, low, close, vol, amount | 0.5 | 日更 |
| 02 | K线 | `daily` / `adj_factor` | ts_code, start_date, end_date | trade_date, open, high, low, close, vol, amount, adj_factor | 0.5 | 日更 |
| 03 | 筹码 | `stk_holdernumber` / `stk_holdernumber_em` | ts_code, ann_date | holder_num, holder_num_change | 2 | 季度 |
| 04 | 重大事项 | `anns` 公告 | ts_code, ann_date | title, content_url | 2 | 日更 |
| 05 | 热点新闻 | `major_news` / `news` | start_date, end_date | title, content, datetime | 2 | 日更 |
| 06 | 行业竞品 | `stock_basic` + `industry` | - | industry, name, market | 0.2 | 日更 |
| 07 | 关联指数 | `index_daily` | ts_code, start_date, end_date | close, change | 0.5 | 日更 |
| 08 | 研报中心 | `report_rc` / `report_pg` | ts_code | title, analyst, rating, org_name | 5 | 日更 |

### Tushare 覆盖不足项
- 03 筹码：最新股东户数数据有季度延迟，需要爬虫补充东财 F10 股东户数
- 04 重大事项：公告正文需要 content_url 二次抓取
- 05 热点新闻：Tushare 新闻库为摘要，需要东方财富/新浪财经补充全文
- 06 行业竞品：Tushare 行业分类较粗，需东财行业细分
- 07 关联指数：需要计算端基于 K 线做 Pearson 相关性
- 08 研报：Tushare 研报覆盖有限，需爬虫补充东财研报中心

---

## 爬虫补充策略

### 爬虫层职责
爬虫层作为 Tushare 的降级/补充，不直接替代 Tushare，仅在以下场景启用：
1. Tushare 返回空或字段缺失
2. Tushare 调用失败/积分不足
3. 维度本身不在 Tushare 覆盖范围内

### 各维度爬虫映射

| 维度 | 主源 | 爬虫补充 | 说明 |
|------|------|---------|------|
| 01 | Tushare | 腾讯/新浪直连 | 实时行情走 Tushare daily，盘中走腾讯直连 |
| 02 | Tushare | Baostock | 前复权 K线优先 Baostock，Tushare 后复权校验 |
| 03 | Tushare | 东财股东户数 | 通过 F10 股东户数页面抓取 |
| 04 | Tushare | 东财公告 | `data.eastmoney.com/notices/detail/` |
| 05 | Tushare | 东财新闻/新浪 7x24 | 抓取新闻标题与时间 |
| 06 | Tushare | 东财行业分类 | `data.eastmoney.com/stockdata/` |
| 07 | Tushare | 计算端 | 基于 K 线数据做 Pearson/Beta 计算 |
| 08 | Tushare | 东财研报 | `data.eastmoney.com/report/` |

### 反爬与节流
- 单 IP 请求间隔：≥ 1.5 秒（东财），≥ 0.5 秒（新浪）
- User-Agent 轮换：提供 3 套常见浏览器 UA
- 失败重试：最多 2 次，退避 1s → 3s
- 降级：连续失败 2 次 → 切换数据源 → Mock
- 服务端代理：生产环境通过后端 `/api/crawler/*` 代理，避免浏览器 CORS

---

## 数据精度与完整性要求

| 维度 | 必填字段 | 更新频率 | 可接受缺失率 | 精度要求 |
|------|---------|---------|-------------|---------|
| 01 | symbol, name, price, change, volume | 日更 | 0% | 价格 2 位小数，成交量整数 |
| 02 | date, open, high, low, close, volume | 日更 | ≤ 0.1% | 价格 2 位小数，成交量整数 |
| 03 | shareholderCount, avgSharesPerHolder | 季度 | ≤ 5% | 整数 |
| 04 | title, date, source, url | 日更 | ≤ 10% | 日期精确到天 |
| 05 | title, date, source | 日更 | ≤ 10% | 日期精确到小时 |
| 06 | industry, competitors[] | 周更 | ≤ 2% | 行业名称一致 |
| 07 | indexCode, correlation, beta | 日更 | ≤ 2% | 相关系数 4 位小数 |
| 08 | title, author, institution, rating, date | 日更 | ≤ 15% | 日期精确到天 |

---

## 成本预算

| 项目 | 年成本 | 说明 |
|------|--------|------|
| Tushare Pro 5000 积分 | 500 元 | 主数据源 |
| 服务器/代理 | 0 元 | 复用现有 Vite dev proxy / 后端 |
| 爬虫池 | 0 元 | 单 IP 节流，无需代理池 |
| 合计 | **500 元** | 符合个人研究预算 |

---

## 用户故事与验收标准

### 用户故事 1：K 线真实数据恢复
- **作为** 投研用户，**我希望** 输入股票后 K 线数据来自真实市场而非 Mock，**从而** 进行准确技术分析
- **验收标准**：
  - 输入 600519.SH 后，K 线数据与 Tushare/Baostock 当日数据一致
  - 返回字段包含 open/high/low/close/volume/amount
  - 数据量 ≥ 最近 250 个交易日
  - 数据 source 标签为 `tushare` 或 `baostock`，不为 `mock`

### 用户故事 2：筹码数据真实可溯
- **作为** 投研用户，**我希望** 筹码/股东户数数据来自公开披露，**从而** 评估筹码集中度变化
- **验收标准**：
  - 600519.SH 的 shareholderCount 与 Tushare `stk_holdernumber` 或东财 F10 一致
  - 数据更新频率为季度
  - 失败时登记缺失报告，用户可见

### 用户故事 3：采集失败可见
- **作为** 投研用户，**我希望** 采集失败时能看到具体原因和数据来源，**从而** 判断数据可信度
- **验收标准**：
  - 每个维度采集结果带 `source` 标签（tushare/crawler/tencent/mock）
  - 失败时 `error` 字段非空，且登记到 missingReportDetector
  - 监控页面区分真实数据与 Mock 数据

---

## 待确认事项

1. **Tushare Token**：用户是否已有 Tushare Pro Token？如没有，需先注册并充值 5000 积分。
2. **服务端部署**：爬虫请求是否走后端代理？当前为 Vite 前端项目，浏览器环境爬虫受限。
3. **AKShare 本地服务**：是否接受启动一个 Python 本地服务（`akshare`）作为爬虫补充？
4. **复权方式**：K 线使用前复权还是后复权？默认推荐前复权。
5. **公告正文**：是否需要抓取公告全文？还是仅标题/摘要即可？

---

## 对架构师的输入建议

### 关键约束
- `QuoteDataSourceId` 类型为枚举，新增 `tushare` 需修改类型定义并在全库生效
- 浏览器环境无法直接调用 Tushare（CORS），必须通过 Vite proxy 或后端转发
- 所有写入必须走 `dataBridge.forward()`，禁止直接写 `db`
- Tushare 响应字段命名（snake_case）与业务类型（camelCase）需转换层

### 推荐实现顺序
1. 类型扩展：在 `collection.types.ts` 中加入 `tushare`
2. 注册数据源：在 `dataSourceRegistry.ts` 注册 Tushare 元数据
3. 封装 Tushare Provider：`tushareProvider.ts` 负责 Token、签名、基础请求
4. 封装爬虫 Provider：`crawlerProvider.ts` 负责东财/新浪/Baostock 抓取
5. 适配器：`tushareAdapter.ts` 将 Tushare 字段转换为业务类型
6. 改造编排器：`dataSourceOrchestrator.ts` 加入 Tushare 降级链
7. 改造多源拉取：`multiSourceFetcher.ts` 维度 03-08 优先 Tushare
8. 补测试与门禁验证

### 必须明确的依赖
- `TUSHARE_API_TOKEN`：环境变量或运行时配置
- `VITE_TUSHARE_PROXY_URL`：Vite proxy 转发地址（可选自建后端）
- 爬虫后端服务：若不走后端，浏览器环境爬虫能力受限
