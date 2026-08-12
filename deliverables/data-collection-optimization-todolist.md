# 数据采集优化 TODOLIST 清单

> 生成日期：2026-07-19
> 目标：零成本解锁全部 8 个维度的数据采集
> 总预估工作量：约 10 小时

---

## 🔥 P0 — 立即执行（3 项，约 4 小时）

完成后：8 维度中 7 个可用，仅剩 06 需进一步增强

---

### P0-1: 验证东财三个 proxy 可用性

| 项目 | 详情 |
|------|------|
| **优先级** | 🔴 P0 |
| **预估工时** | 0.5h |
| **影响维度** | 03 筹码 / 04 公告 / 08 研报 |
| **前置依赖** | 无 |
| **验收标准** | 三个 proxy 均返回真实数据 |

**执行步骤：**

1. 重启 dev server（`npm run dev`）
2. 用浏览器或 curl 验证三个端点：
   - `http://localhost:3000/api/proxy/em-f10/PC_HSF10/ShareholderResearch/PageAjax?code=SH600519`
   - `http://localhost:3000/api/proxy/em-notice/api/security/ann?sr=-1&page_size=5&page_index=1&ann_type=A&stock_list=600519`
   - `http://localhost:3000/api/proxy/em-reportapi/report/list?pageSize=5&pageNo=1&qType=0&code=600519`
3. 记录每个端点的返回状态和数据结构
4. 如果 proxy 不通，检查 `vite.config.ts` 中的 rewrite 规则和 headers 配置

**涉及文件：**
- `vite.config.ts`（第 190-216 行，em-datacenter/em-reportapi/em-notice/em-f10）
- `src/config/marketDataEndpoints.ts`

---

### P0-2: 维度 07 — 关联指数本地计算

| 项目 | 详情 |
|------|------|
| **优先级** | 🔴 P0 |
| **预估工时** | 2h |
| **影响维度** | 07 关联指数 |
| **前置依赖** | 维度 02 K线已通（已验证） |
| **验收标准** | 3 个指数均显示非零 correlation 和 beta 值 |

**执行步骤：**

1. **新增腾讯指数 K 线获取函数**（参考 `directDataAPI.ts` 中的腾讯 K 线实现）
   - 指数代码格式：`sh000300`（沪深300）、`sh000905`（中证500）、`sz399006`（创业板指）
   - 调用 `web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000300,day,,,60,qfq`
   - 走 `/api/proxy/tencent-kline/` 代理（已存在）

2. **重构 `fetchIndexCorrelation` 函数**（`multiSourceFetcher.ts` 第 343-406 行）
   - 当前：Tushare 计算失败后，腾讯兜底只取价格，correlation 硬编码为 0
   - 修改：Tushare 失败后，用腾讯日 K 获取标的 + 指数的 60 日数据，本地计算 Pearson + beta
   - `calculatePearson()` 和 `calculateBeta()` 函数已存在，可直接复用

3. **标的 K 线数据来源**
   - 方案 A：调用 fetcher 服务的 K 线数据（可能已缓存）
   - 方案 B：直接用腾讯 K 线 API 拉取标的 60 日数据（简单直接，推荐）

4. **验证**：对 `600519.SH` 测试，确认 correlation 在 0.5-0.9 之间（茅台与沪深300应有较高相关性）

**涉及文件：**
- `src/services/data-collector/multiSourceFetcher.ts`（`fetchIndexCorrelation` 函数）
- `src/services/data-collector/directDataAPI.ts`（新增指数 K 线获取）

---

### P0-3: 维度 05 — 热点新闻接入

| 项目 | 详情 |
|------|------|
| **优先级** | 🔴 P0 |
| **预估工时** | 1.5h |
| **影响维度** | 05 热点新闻 |
| **前置依赖** | 无 |
| **验收标准** | 新闻列表返回 10 条以上真实数据 |

**执行步骤：**

1. **调研并选定新闻源**（二选一，先试方案A）

   **方案 A：新浪财经新闻 API（推荐）**
   - 端点：`https://feed.mix.sina.com.cn/api/roll/get?pageid=155&lid=1686&num=10&versionNumber=1.2.4&k=茅台`
   - 优点：返回 JSON、支持关键词搜索、零成本
   - 需新增 Vite proxy 规则：`/api/proxy/sina-news/`

   **方案 B：同花顺新闻接口**
   - 端点：`https://news.10jqka.com.cn/tapp/news/push/stock/?code=600519`
   - 优点：按股票代码筛选更精准
   - 需确认 CORS 和反爬情况

2. **新增 Vite proxy 规则**（`vite.config.ts`）

3. **实现新闻获取函数**（`crawlerProvider.ts` 或 `multiSourceFetcher.ts`）
   - 解析返回的 JSON 数据
   - 映射到 `NewsItem` 类型
   - 加入降级链路：新接口 → Tushare → LLM → []

4. **修改 `fetchEastMoneyNews`**
   - 当前直接返回空数组（标记 UNAVAILABLE）
   - 替换为新接入的新闻源

5. **验证**：对 `600519.SH` 测试，返回 10 条以上真实新闻

**涉及文件：**
- `vite.config.ts`（新增 proxy 规则）
- `src/config/marketDataEndpoints.ts`（新增端点配置）
- `src/services/data-collector/crawlerProvider.ts`（`fetchEastMoneyNews` 替换）
- `src/services/data-collector/multiSourceFetcher.ts`（降级链路调整）

---

## ⚡ P1 — 高优先级（4 项，约 5 小时）

完成后：8 个维度全部可用，架构更精简

---

### P1-1: 维度 06 — 本地行业字典增强

| 项目 | 详情 |
|------|------|
| **优先级** | 🟠 P1 |
| **预估工时** | 2h |
| **影响维度** | 06 行业竞品 |
| **前置依赖** | Python 环境 + AkShare 已安装（已验证） |
| **验收标准** | 任意 A 股标的可返回 10+ 同行业股票 |

**执行步骤：**

1. **编写 Python 脚本**构建全市场行业分类数据
   - 使用 AkShare：`stock_info_sw()`（申万行业）或 `stock_industry_ths()`（同花顺行业）
   - 字段：股票代码、股票名称、申万一级/二级/三级行业
   - 输出 JSON 格式，约 5000+ 条记录

2. **将行业数据集成到 stockDictionary**
   - 方案 A（推荐）：构建时生成 JSON 文件，import 到 `stockDictionary.ts`
   - 方案 B：运行时从 IndexedDB 读取，首次启动时初始化
   - 扩充 `swL1` → `swL1 / swL2 / swL3` 三级行业

3. **优化 `fetchCompetitorData` 函数**（`multiSourceFetcher.ts` 第 261-336 行）
   - L1：本地字典 swL2 或 swL3 筛选（更精准）
   - L2：Tushare（有 Token 时）
   - L3：腾讯代理（当前不可用，考虑移除）
   - 返回数量：默认 20 只，可配置

4. **验证**：
   - 贵州茅台（600519）→ 白酒行业，应有 10+ 只同业
   - 宁德时代（300750）→ 电池行业，应有同业列表

**涉及文件：**
- `scripts/build-industry-dict.py`（新建）
- `src/services/stock/stockDictionary.ts`
- `src/services/data-collector/multiSourceFetcher.ts`（`fetchCompetitorData`）

---

### P1-2: 维度 08 — 研报过滤修复 + 逻辑统一

| 项目 | 详情 |
|------|------|
| **优先级** | 🟠 P1 |
| **预估工时** | 1.5h |
| **影响维度** | 08 研报中心 |
| **前置依赖** | P0-1（验证 em-reportapi proxy 可用性） |
| **验收标准** | 指定股票可返回 5+ 条对应研报 |

**执行步骤：**

1. **修复东财研报个股过滤**
   - 测试多种参数组合：`stockCode` / `secCode` / `code` / `secid`
   - 测试是否需要 `market` 参数（1=沪市，0=深市）
   - 如果所有过滤参数都不生效，采用"全量拉取+本地过滤"策略
   - 研报数据量不大（每次拉 50 条），本地过滤性能可接受

2. **统一逻辑**
   - 当前 `crawlerProvider.ts` 标记 UNAVAILABLE 但 `multiSourceFetcher.ts` 仍直接调用
   - 统一走 `crawlerProvider.ts` 的 `fetchEastMoneyResearch` 函数
   - `multiSourceFetcher.ts` 只调用 crawlerProvider，不直接拼 URL

3. **完善研报数据字段**
   - 标题、机构、评级、目标价、研究员、发布日期、PDF 链接
   - 确保 `ResearchReport` 类型字段完整映射

4. **验证**：`600519.SH` 返回 5+ 条茅台相关研报

**涉及文件：**
- `src/services/data-collector/crawlerProvider.ts`（`fetchEastMoneyResearch` 实现）
- `src/services/data-collector/multiSourceFetcher.ts`（`fetchResearchReports` 重构）
- `src/services/data-collector/dimensionDataTypes.ts`（类型核对）

---

### P1-3: 维度 01/02 — 优先级调整 + 清理无效源

| 项目 | 详情 |
|------|------|
| **优先级** | 🟡 P1 |
| **预估工时** | 0.5h |
| **影响维度** | 01 基本信息 / 02 K线 |
| **前置依赖** | 无 |
| **验收标准** | 无 Token 时首次请求不失败，直接走腾讯 |

**执行步骤：**

1. **调整默认优先级**（`dataSourceRegistry.ts`）
   - 行情：`tencent (L1) → tushare (L2) → sina (L3) → mock (L4)`
   - K线：`tencent (L1) → tushare (L2) → mock (L3)`
   - 理由：零成本、无需鉴权的源优先，避免每次先失败再降级

2. **移除网易数据源**
   - 从 `DATA_SOURCE_ENDPOINTS` 中移除或标记 deprecated
   - 从 `DEFAULT_KLINE_PRIORITY` 中移除
   - 从 `vite.config.ts` proxy 中移除（如有）

3. **验证**：无 Tushare Token 时，行情和 K 线首次请求即成功（不触发降级日志）

**涉及文件：**
- `src/config/dataSourceRegistry.ts`
- `src/config/marketDataEndpoints.ts`
- `vite.config.ts`

---

### P1-4: 维度 03/04 — 链路优化

| 项目 | 详情 |
|------|------|
| **优先级** | 🟡 P1 |
| **预估工时** | 1h |
| **影响维度** | 03 筹码 / 04 公告 |
| **前置依赖** | P0-1（东财 proxy 验证通过） |
| **验收标准** | 降级链路更短、更快，失败日志减少 |

**执行步骤：**

1. **维度 03 筹码链路优化**
   - L1：东财 F10（已验证可用）
   - L2：Tushare（有 Token 时）
   - 移除 L3 新浪 HTML 路径（返回 HTML，`resp.json()` 必失败）
   - 简化为 2 层降级，减少无效请求

2. **维度 04 公告链路优化**
   - L1：东财公告（最权威、零成本、已验证）
   - L2：Tushare 公告（有 Token 时）
   - L3：LLM 摘要增强（对东财公告做 AI 摘要，而非用 LLM 搜索公告）
   - 移除 L4 新浪 HTML 路径（同维度 03 问题）

3. **LLM 角色重新定位**
   - 从"数据源"改为"数据增强层"
   - 输入：东财/Tushare 返回的原始公告列表
   - 输出：带 AI 摘要、情感标签、事件分类的增强列表
   - 无 Key 时跳过增强，直接返回原始数据

**涉及文件：**
- `src/services/data-collector/multiSourceFetcher.ts`（`fetchChipData`, `fetchNews`）
- `src/services/data-collector/llmSearchAgent.ts`（新增摘要模式）

---

## 🌟 P2 — 增强优化（3 项，按需）

完成后：数据质量和用户体验进一步提升

---

### P2-1: LLM 摘要增强

| 项目 | 详情 |
|------|------|
| **优先级** | 🟢 P2 |
| **影响维度** | 04 公告 / 05 新闻 / 08 研报 |
| **依赖** | Kimi 会员（已有）或 DeepSeek Key |

**内容：**
- 公告：自动提取核心要点、影响评估
- 新闻：情感分析、事件分类、重要性评级
- 研报：核心观点提炼、目标价汇总、评级分布

---

### P2-2: Python ETL 服务

| 项目 | 详情 |
|------|------|
| **优先级** | 🔵 P2 |
| **影响维度** | 03 / 05 / 06 / 08 |
| **依赖** | FastAPI + AkShare 本地服务 |

**内容：**
- 批量数据补全（行业字典、股东户数、研报）
- 多源交叉验证（偏差 >1% 告警）
- 数据质量监控与自动修复

---

### P2-3: Tushare Pro 评估

| 项目 | 详情 |
|------|------|
| **优先级** | ⚪ P2 |
| **成本** | ~500 元/年（5000 积分） |
| **影响维度** | 全部 |

**内容：**
- 注册 Tushare 账号，测试免费版 120 积分
- 评估各维度接口的字段完整性和稳定性
- 如满足需求，采购 5000 积分套餐作为稳定增强

---

## 📊 进度追踪

| 阶段 | 任务数 | 完成数 | 进度 |
|------|--------|--------|------|
| P0 立即执行 | 3 | 0 / 3 | 0% |
| P1 高优先级 | 4 | 0 / 4 | 0% |
| P2 增强优化 | 3 | 0 / 3 | 0% |
| **总计** | **10** | **0 / 10** | **0%** |

---

## 🔗 相关文档

- 详细分析报告：`data-collection-optimization-analysis/data-collection-optimization-analysis.html`
- 可行性分析：`deliverables/collection-feasibility-report.md`
- 方案对比：`deliverables/collection-solution-comparison.md`
- 低成本方案调研：`deliverables/personal-research-low-cost-data-collection-report.md`
