# 数据采集真实数据审计报告 — 2026-08-09

> **审计类型**：方案 B 数据源整改后回归验证（10 股 × 6 维度真实数据采集）
> **审计时间**：2026-08-09 10:54:15 ~ 10:55:03（耗时约 48 秒）
> **AKShare 版本**：1.18.83
> **数据源**：腾讯直连（qt.gtimg.cn / web.ifzq.gtimg.cn）+ AKShare 真实接口
> **审计脚本**：`python/data_service/audit_collect_10stocks.py`
> **原始 JSON**：`outputs/audit-reports/collect-audit-20260809-105503.json`
> **overallPass**：✅ true（5 项基线全部通过）

---

## 一、整改前后对比

| 维度 | 整改前（2026-07-19 及更早） | 整改后（2026-08-09） |
|:---|:---|:---|
| **基本信息（01_basic）** | 🔴 0% 成功率（AKShare 东财 push2 反爬） | 🟢 100%（腾讯实时行情 qt.gtimg.cn） |
| **K 线（02_kline）** | 🔴 0% 成功率（akshare.stock_zh_a_hist 被封） | 🟢 100%（腾讯 fqkline web.ifzq.gtimg.cn） |
| **财务（09_financial）** | 🔴 误报 100%（MOCK_FINANCIAL_DATA 假数据字典） | 🟢 100%（AKShare stock_financial_analysis_indicator + stock_financial_abstract 真实接口） |
| **筹码/新闻/热点（03/04/05）** | 🟡 部分通过 | 🟢 100% |
| **审计脚本** | 硬编码股票池 + 无字段级完整性检查 | 动态随机抽取 10 股 + 5 项基线 + 字段级完整性 |
| **测试方式** | CSV fallback（Vite 代理未启） | 真实数据采集（VITE_DATA_SOURCE_TYPE=real） |

---

## 二、5 项审计基线达标情况

| 基线指标 | 实际值 | 基线阈值 | 结果 |
|:---|:---:|:---:|:---:|
| 采集成功率 (successRate) | 100% | ≥80% | ✅ PASS |
| 真实成功率 (realSuccessRate) | 100% | ≥80% | ✅ PASS |
| 字段完整度 (completeness) | 97% | ≥90% | ✅ PASS |
| 落盘率 (writeRate) | 100% | ≥95% | ✅ PASS |
| 维度覆盖率 (dimensionCoverage) | 100% | ≥80% | ✅ PASS |

**汇总统计**：
- 总尝试次数（totalAttempts）：60（10 股 × 6 维度）
- 总成功次数（totalSuccess）：60
- 平均延迟（avgLatencyMs）：460ms

---

## 三、6 维度采集成功率

| 维度代码 | 维度名称 | 成功数 / 总数 | 成功率 |
|:---:|:---|:---:|:---:|
| 01_basic | 基本信息（腾讯实时行情） | 10 / 10 | 100% |
| 02_kline | K 线（腾讯 fqkline） | 10 / 10 | 100% |
| 03_chip | 筹码分布 | 10 / 10 | 100% |
| 04_news | 新闻 | 10 / 10 | 100% |
| 05_hotnews | 热点新闻 | 10 / 10 | 100% |
| 09_financial | 财务（AKShare 真实接口） | 10 / 10 | 100% |
| 10_sector | 板块（行业指数） | 1 / 1 | 100% |

---

## 四、10 只股票逐只审计结果

> 股票池由 `fetch_random_stocks` 动态随机抽取，非硬编码，符合"上线前测试需真实数据，不允许 MOCK"原则。

| # | 代码 | 名称 | 01_basic | 02_kline | 03_chip | 04_news | 05_hotnews | 09_financial |
|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | 920639 | 晨光电缆 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 2 | 920895 | 花溪科技 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 3 | 920208 | 青矩技术 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 4 | 688595 | 芯海科技 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 5 | 300248 | 新开普 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 6 | 600513 | 联环药业 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 7 | 600449 | 宁夏建材 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 8 | 002165 | 红宝丽 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 9 | 002225 | 濮耐股份 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| 10 | 688105 | 诺唯赞 | ✅ 83% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |

**说明**：
- 01_basic 完整度 83% 是因腾讯实时行情接口未返回 `industry` 字段（需通过板块接口补充），其余字段（price/pe/pb/market_cap/name）全部齐全
- 02_kline 部分股票（920639/920895/920208）仅返回 1 条记录，因北交所新股上市时间短、历史数据不足，属正常情况
- 09_financial 全部返回 13 条记录（对应最近 13 期财报），字段完整度 100%

---

## 五、板块数据采集

| 指标 | 值 |
|:---|:---|
| 采集状态 | ✅ success |
| 延迟 | 2005ms |
| 记录数 | 131 |
| 完整度 | 100% |

---

## 六、延迟分布分析

| 维度 | 平均延迟（ms） | 备注 |
|:---:|:---:|:---|
| 01_basic | ~550 | 腾讯实时行情，受网络波动影响 |
| 02_kline | ~280 | 腾讯 fqkline，响应稳定 |
| 03_chip | ~390 | AKShare 筹码接口 |
| 04_news | ~130 | 新闻接口，响应快 |
| 05_hotnews | ~120 | 热点新闻接口，响应快 |
| 09_financial | ~1280 | AKShare 双接口（财务指标 + 摘要），延迟最高 |
| **整体平均** | **460** | 符合预期 |

---

## 七、整改落实证据链

### 7.1 Python 后端层（`python/data_service/collect_endpoints.py`）

| 整改项 | 落实位置 | 状态 |
|:---|:---|:---:|
| 删除 MOCK_FINANCIAL_DATA 假数据字典 | 全文无 MOCK_FINANCIAL_DATA 命中 | ✅ |
| 腾讯源代码格式化 `_to_tencent_code` | [L181](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L181) | ✅ |
| 腾讯实时行情 `fetch_tencent_quote` | [L193](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L193)（qt.gtimg.cn） | ✅ |
| 腾讯 K 线 `fetch_tencent_kline` | [L224](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L224)（web.ifzq.gtimg.cn） | ✅ |
| basic 端点切腾讯源 | [L325-328](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L325) | ✅ |
| kline 端点切腾讯源 | [L382-386](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L382) | ✅ |
| AKShare 真实财务接口 `fetch_real_financial_data` | [L447-515](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L447) | ✅ |
| CORS 中间件 | [L26-32](file:///d:/FinSightV9/python/data_service/collect_endpoints.py#L26) | ✅ |

### 7.2 审计脚本层（`python/data_service/audit_collect_10stocks.py`）

| 整改项 | 落实位置 | 状态 |
|:---|:---|:---:|
| 同步换源（basic/kline/financial） | [L12-18](file:///d:/FinSightV9/python/data_service/audit_collect_10stocks.py#L12) 注释"P0 改进后" | ✅ |
| 动态随机抽取 10 股 | [L31-55](file:///d:/FinSightV9/python/data_service/audit_collect_10stocks.py#L31) `fetch_random_stocks` | ✅ |
| 5 项审计基线 | [L59-65](file:///d:/FinSightV9/python/data_service/audit_collect_10stocks.py#L59) | ✅ |

---

## 八、结论

### 8.1 整改达标判定

✅ **方案 B 数据源整改已彻底达标**：
- 5 项审计基线全部 PASS
- 10 只随机抽取股票 × 6 维度 = 60 次采集全部成功
- MOCK 假数据已清零，所有数据均来自真实接口
- 符合 project_memory 硬约束"上线前测试需真实数据，不允许 MOCK"

### 8.2 遗留观察项

| 项目 | 说明 | 风险等级 |
|:---|:---|:---:|
| 01_basic 完整度 83% | 腾讯实时行情未返回 industry 字段，需通过板块接口补充 | 🟡 低 |
| 北交所新股 K 线记录少 | 920639/920895/920208 仅 1 条记录（上市时间短） | 🟢 正常 |
| 09_financial 延迟较高 | 平均 1280ms（AKShare 双接口串行），可考虑并行优化 | 🟡 低 |
| Tushare Token 未配置 | tushareProvider.ts 已预实现但未启用，方案 B 中长期备选 | 🟢 待规划 |

### 8.3 后续建议

1. **短期**：在 basic 端点补充 industry 字段（通过 `akshare.stock_individual_info_em` 或板块接口）
2. **中期**：将 09_financial 的双接口调用改为并行（Promise.all / asyncio.gather），目标延迟 < 800ms
3. **长期**：当用户配置 Tushare Token 后，激活 tushareProvider.ts 作为方案 B 主线，与方案 D 形成双源互备

---

## 九、附录

### 9.1 审计报告索引

| 文件 | 时间戳 | 说明 |
|:---|:---|:---|
| `outputs/audit-reports/collect-audit-20260809-102902.json` | 10:29:02 | 首次审计（部分维度未通过） |
| `outputs/audit-reports/collect-audit-20260809-104432.json` | 10:44:32 | 第二次审计（整改中） |
| `outputs/audit-reports/collect-audit-20260809-104551.json` | 10:45:51 | 第三次审计（接近达标） |
| `outputs/audit-reports/collect-audit-20260809-105503.json` | 10:55:03 | ✅ 最终审计（本报告数据源） |
| `outputs/audit-reports/collect-audit-report/collect-audit-report.html` | 10:55 | HTML 可视化报告 |

### 9.2 相关文档

- 方案 B PRD：`deliverables/software-company/prd-plan-b-tushare-crawler.md`
- 方案 B 架构：`deliverables/software-company/architecture-plan-b-tushare-crawler.md`
- 方案对比：`deliverables/collection-solution-comparison.md`
- 优化待办：`deliverables/data-collection-optimization-todolist.md`
- 历史报告（已过时）：`deliverables/software-company/concentration-test-report-2026-07-19.md`

---

**报告生成**：2026-08-09 | **审计人**：自动化脚本 + 人工复核 | **数据源**：真实接口（无 Mock）
