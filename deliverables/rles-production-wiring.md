# RLES 生产化接线（真实数据源落地）

> 日期：2026-08-17 | 关联：RLES 评价体系代码全链路已闭环（2026-08-16）
> 目的：把 RLES 两个"生产化扩展点"（市场宽度 / 三条禁令风险）从 mock/占位切换为真实后端源，
> 并补齐剩余生产化项的后端端点。

## 一、后端端点（`python/data_service/collect_endpoints.py`）

### 1. `POST /api/collect/breadth` — 市场宽度（MAS Breadth 真实源）
- 新增 `fetch_market_breadth()`：东财 `push2.eastmoney.com/api/qt/clist/get`（fs 覆盖沪深京 A 股），
  取 `f3` 涨跌幅，统计 上涨/下跌/平盘/涨停/跌停。
- 涨停/跌停判定兼容 10%（主板）与 20%（双创/北交所）：`f3>=9.9` 或 `>=19.9` 记涨停；`f3<=-9.9` 或 `<=-19.9` 记跌停。
- 60s 模块级缓存（`_BREADTH_CACHE`），避免高频打满东财。
- 任意失败（超时/异常/返回空）→ 返回 `success=False`，前端 resilient 入口回退 cockpit mock。
- 新增模型：`BreadthData{up,down,flat,totalStocks,limitUp,limitDown,asOf}`。

### 2. `POST /api/collect/risk` — 风险黑名单（ST/退市/违规 真实源）
- 新增 `fetch_stock_risk_flags(symbol)`：后端 `BACKEND_FORBIDDEN_STOCKS`（权威黑名单，空占位）
  + 腾讯名称推导（交易所强制 `ST`/`*ST`/`退市` 前缀，权威度高）。
- 返回 `flags: string[]`（格式 `category:reason`，如 `st:名称含*ST风险警示` / `delisting:名称含退市`）。
- 腾讯名称查询失败不影响黑名单判定（try/except 兜住）。
- 新增模型：`RiskCollectRequest{symbol}` / `RiskCollectData{symbol,name,flags,asOf}`。

## 二、前端接线

| 文件 | 改动 |
|---|---|
| `src/config/apiPaths.ts` | 新增 `API_COLLECT_BREADTH` / `API_COLLECT_RISK` 常量（消除硬编码） |
| `breadthFactor.ts` | `fetchMarketBreadthLive()` 由 TODO 桩改为真实 `fetch(API_COLLECT_BREADTH)` → 映射 `MarketBreadthInput` |
| `hardRiskDetector.ts` | `fetchStockRiskFlagsLive(symbol)` 由 TODO 桩改为真实 `fetch(API_COLLECT_RISK?symbol=)` → 映射 `string[]` |
| `types.score.ts` | `V6Score` 补 `name?: string`（runV6Score 早已在运行时填充，仅补契约） |
| `reviewLaunchStore.ts` | 市场宽度改接 `fetchMarketBreadthResilient()`（优先真实、回退 mock）；三条禁令改接 `detectHardRisksResilient(target, v6Score?.name)`（优先后端、回退显式表+名称兜底） |

启用真实源：前端 `.env` 置 `RLES_USE_LIVE_BREADTH=true`（默认 false，使用 mock）。风险源无需开关，
`detectHardRisksResilient` 默认即尝试后端 `/api/collect/risk`。

## 三、测试

- 后端 `test_collect_endpoints.py`：新增 `TestCollectBreadth`（3 用例：计数/空负载降级/网络失败降级）
  + `TestCollectRisk`（4 用例：ST 检测/退市检测/干净股/名称查询失败仍正常），全部 mock 网络，**7/7 通过**。
- 前端 `breadthFactor.test.ts` / `hardRiskDetector.test.ts`：各新增 4 个 fetch mock 用例（映射/非 2xx/
  success=false/网络异常），**RLES 引擎套件 37/37 通过**。

## 四、门禁结果（全绿）

| 门禁 | 结果 |
|---|---|
| `py_compile collect_endpoints.py` | OK |
| `tsc --noEmit`（清缓存 `--incremental false`） | 0 错误 |
| `tsc:prod`（含测试文件） | 0 错误 |
| `vitest rles-engine` | 37/37 |
| `audit:layers` | 0 违规（1 警告在并发 Agent 未提交文件 `researchPipelineOrchestrator.ts`，非本任务） |
| `audit:acl-consistency` | 0 ERROR / 0 WARN |
| 后端 pytest（breadth/risk） | 7/7 |

## 五、剩余生产化项（非本任务范围）

1. **`runLiveBacktest` 实盘复核**：函数已实现（`rlesBacktest.ts`），依赖后端 8000 在线 + 网络；
   本地沙箱无运行中的后端且网络不确定，未执行实跑（非确定性）。上线后调用 `runLiveBacktest(symbols)` 即可。
2. **历史 V6 按时点重算**：需"历史 V6 评分服务"（评估日时点态 V6），属较大架构项，列为后续专项。
3. **`BACKEND_FORBIDDEN_STOCKS` 权威同步**：当前为空占位，生产应从交易所退市预警/ST/处罚/立案公告每日同步维护。
