---
title: 数据采集模块开发任务清�?
type: reference
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "基于差距分析报告 + 路由UI校对报告 + 用户需�?> 日期�?026-07-01 | 版本：v2.0（补充时序控�?数据传递规范）"
tags: [data, collection, checklist, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 数据采集模块开发任务清�?
> 基于差距分析报告 + 路由UI校对报告 + 用户需�?> 
> 日期�?026-07-01 | 版本：v2.0（补充时序控�?数据传递规范）

---

## 任务总览

| 任务�?| 任务�?| 优先�?| 目标 |
|:---|:---:|:---:|:---|
| A. 批量导入增强 | 4 | P0 | 支持CSV/Excel/JSON多格式文件导�?|
| B. 真实数据采集 | 4 | P0 | 接入腾讯/新浪/网易真实行情API |
| C. UI/UX优化 | 4 | P1 | 参照成熟APP标准优化交互体验 |
| D. 缺失模块框架 | 2 | P1 | 采集任务监控+抓取引擎配置 |
| E. 测试验证 | 3 | P0 | 功能+性能+用户体验测试 |
| F. 时序控制规范 | 3 | P0 | 确保数据时间一致性和完整�?|
| G. 数据传递规�?| 3 | P0 | 确保数据传递路径可靠和格式正确 |
| H. 质量监控与异常处�?| 2 | P0 | 监控指标+异常处理流程 |

---

## A. 批量导入增强（P0�?
| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| A-1 | 多格式文件解析服�?| 在batchImportService中新增CSV/Excel(.xlsx)/JSON三种文件解析器；CSV用PapaParse逻辑、Excel用SheetJS(xlsx�?逻辑、JSON支持数组对象格式 | 3种格式均能正确解析为BulkImportRow[] |
| A-2 | 文件上传UI组件 | BulkImportPanel新增拖拽上传区域(file dropzone)；支持点击选择文件；显示文件名/大小/格式；解析后自动预览 | 拖拽+点击两种方式均可�?|
| A-3 | 行级状态标�?| 预览表格新增"状�?列，显示valid(�?/duplicate(�?/invalid(�?三种标签；重复代码自动标�?| 每行有明确状态标�?|
| A-4 | 导入进度+模板下载 | 新增导入进度�?Progress组件)；新�?下载导入模板"按钮(导出CSV模板) | 进度实时更新+模板可下�?|

## B. 真实数据采集（P0�?
| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| B-1 | 腾讯财经直连API | 新增directDataAPI.ts，实现tencentQuote(code)/tencentBatchQuotes(codes)/tencentKline(code,period,count)；通过HTTP请求qt.gtimg.cn获取实时行情 | 能获取真实股票行情数�?|
| B-2 | 新浪+网易备用API | 实现sinaQuote(code)/sinaBatchQuotes(codes)通过hq.sinajs.cn；实现neteaseHistory(code,start,end)通过quotes.163.com CSV解析 | 两个备用源均可获取数�?|
| B-3 | 四层降级编排 | 新增dataSourceOrchestrator.ts，实现getQuote(code)按腾讯→新浪→AKShare→Mock顺序降级；getKline(code,days)按网易→腾讯K线→AKShare→Mock降级 | 单源故障自动切换备用�?|
| B-4 | 采集结果写入 | 采集成功后通过DataBridge.forward()写入IndexedDB stocks store；更新Stock的dataQuality标记；触发EventBus事件通知UI刷新 | 采集数据持久�?UI自动更新 |

## C. UI/UX优化（P1�?
| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| C-1 | BulkImportPanel视觉重构 | 参照成熟APP(同花�?东方财富)设计标准：卡片式布局、步骤指�?1上传�?预览�?导入)、文件类型图标、拖拽高亮区 | 视觉呈现专业、交互流�?|
| C-2 | InputDashboard布局优化 | 统计卡片增加趋势指示器；股票搜索区增加快捷操作按钮；看板列宽自适应；空状态插�?| 布局符合成熟APP标准 |
| C-3 | SevenDimConfigPage视觉增强 | 策略模板卡片增加颜色标识(�?�?�?�?�?；维度开关增加动画过渡；额度预估增加可视化仪表盘 | 视觉层次清晰 |
| C-4 | 采集页面统一加Skeleton | DataTestPanel/HotSectorPanel/BulkImportPanel加载状态统一使用Skeleton骨架屏；空状态使用插�?引导文案 | 无白�?无突兀渲染 |

## D. 缺失模块框架（P1�?
| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| D-1 | CollectTaskPage框架 | 新建采集任务监控�?/input/collect-task)�?Tab布局(任务列表/评分卡片/采集日志)；任务列表含状�?进度/耗时 | 框架可渲�?路由可访�?|
| D-2 | FetcherConfigPage框架 | 新建抓取引擎配置�?/input/fetcher)；数据源列表+连通性测�?采集日志面板 | 框架可渲�?路由可访�?|

## E. 测试验证（P0�?
| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| E-1 | 批量导入测试 | 测试CSV/Excel/JSON三种格式解析；测试行级状态标签；测试重复检测；测试文件大小限制 | 所有测试用例通过 |
| E-2 | 数据采集测试 | 测试四层降级逻辑(Mock模式)；测试采集结果写入；测试EventBus通知 | 所有测试用例通过 |
| E-3 | 集成测试+报告 | 运行完整vitest套件；tsc编译检查；生成测试报告 | 0编译错误+全测试通过 |

---

## F. 时序控制规范（P0�?
### F-1 维度采集执行顺序与依赖关�?
```
用户触发采集
  �?  ├─ Phase 1: 基础数据（无依赖，可并行�?  �?  ├─ 01_basic   (月度, TTL 43200min)  �?腾讯实时行情
  �?  ├─ 02_kline   (日频, TTL 180min)    �?网易历史K�?  �?  └─ 07_index   (周频, TTL 10080min)  �?腾讯指数行情
  �?  ├─ Phase 2: 分析数据（依�?Phase 1 �?basic 数据�?  �?  ├─ 03_chip     (3�? TTL 4320min)   �?需 01_basic 完成
  �?  ├─ 06_industry (周频, TTL 10080min)  �?需 01_basic 完成
  �?  └─ 08_research (日频, TTL 180min)    �?需 01_basic 完成
  �?  ├─ Phase 3: 事件数据（独立流，实时监听）
  �?  ├─ 04_events (日频, TTL 180min)
  �?  └─ 05_news   (日频, TTL 180min)
  �?  └─ Phase 4: 聚合写入（依�?Phase 1+2 完成�?      └─ DataBridge.forward() �?IndexedDB �?EventBus 通知
```

| 规则 | 说明 |
|:---|:---|
| Phase 1 并行 | 01/02/07 三个维度无依赖，使用 Promise.all 并行采集 |
| Phase 2 串行等待 | 03/06/08 依赖 01_basic �?stock 基础信息，须�?Phase 1 完成 |
| Phase 3 独立 | 04/05 为事件流，不阻塞其他维度 |
| Phase 4 屏障 | 所有维度完成后统一写入，避免部分写入导致数据不一�?|
| 超时控制 | 单维度采集超�?30s 自动降级到下一数据�?|
| 间隔控制 | 同一维度两次采集间隔 �?frequency 配置的最小间�?|

### F-2 批量导入时序控制

```
用户上传文件
  �?  ├─ Step 1: 文件解析 (同步, �?s)
  �?  └─ CSV/Excel/JSON �?BulkImportRow[]
  �?  ├─ Step 2: 行级校验 (同步, �?s)
  �?  ├─ 格式校验：代�?位数�?+ 名称非空
  �?  ├─ 重复检测：与现有候选池比对
  �?  └─ 标记状态：valid / duplicate / invalid
  �?  ├─ Step 3: 逐行导入 (异步, 每行�?s)
  �?  ├─ 按批�?batchSize=10)分组
  �?  ├─ 每批使用 Promise.all 并行
  �?  └─ 批次间间�?200ms（避免并发冲击）
  �?  └─ Step 4: 结果汇�?(同步)
      ├─ 统计 success/failed/duplicate
      ├─ DataBridge.forward('stocks.bulkImported', ...)
      └─ EventBus.emit('HOLDINGS_DATA_LOADED')
```

### F-3 采集频率与时间窗�?
| 维度 | 频率 | 采集窗口 | 缓存TTL | 说明 |
|:---|:---|:---|:---|:---|
| 01_basic | 月度 | 每月1�?09:30 | 43200min(30�? | 基础信息变动低频 |
| 02_kline | 日频 | 每日 16:00 | 180min(3h) | 收盘后采�?|
| 03_chip | 3�?| 周一/�?16:00 | 4320min(3�? | 筹码分布中频 |
| 04_events | 日频 | 每日 09:00 | 180min(3h) | 开盘前检查公�?|
| 05_news | 日频 | 每日 09:00 | 180min(3h) | 开盘前检查新�?|
| 06_industry | 周频 | 每周�?16:00 | 10080min(7�? | 行业数据周频 |
| 07_index | 周频 | 每周�?16:00 | 10080min(7�? | 指数数据周频 |
| 08_research | 日频 | 每日 16:00 | 180min(3h) | 收盘后采集研�?|

---

## G. 数据传递规范（P0�?
### G-1 数据传递路径与格式标准

```
[数据源API] ──HTTP/JSON──�?[directDataAPI.ts] ──Normalize──�?[dataSourceOrchestrator.ts]
                                                                    �?                                    ┌───────────────────────────────�?                                    �?                              [DataBridge.forward()]
                                    �?                    ┌───────────────┼───────────────�?                    �?              �?              �?              [IndexedDB]    [EventBus]      [Pinia/Zustand]
              stocks store   事件广播         Store 更新
                                    �?                                    �?                              [React 组件渲染]
```

| 传递环�?| 格式标准 | 接口协议 | 验证机制 |
|:---|:---|:---|:---|
| API �?directDataAPI | 腾讯: JS分隔符文本；新浪: JS变量赋值；网易: CSV | HTTP GET, charset=GBK | 响应非空 + 字段数校�?|
| directDataAPI �?Orchestrator | StockQuote 标准接口对象 | TypeScript 接口约束 | 字段类型校验 + 数值范围校�?|
| Orchestrator �?DataBridge | Envelope<T> 信封格式 | DataBridge.forward() | ACL 权限校验 + schema 验证 |
| DataBridge �?IndexedDB | Stock 类型对象 | dataLayer.stocks.put() | keyPath 校验 + 事务回滚 |
| DataBridge �?EventBus | 事件�?+ payload | EventBus.emit() | 事件名白名单 + payload schema |

### G-2 批量导入数据传递路�?
```
[文件] ──FileReader──�?[batchImportService.parseFile()]
                                �?                    ┌───────────�?                    �?              [BulkImportRow[]]
              �?status: valid/duplicate/invalid
                    �?                    �?              [importStocks(rows)]
              逐行 �?addStock() �?dataLayer.stocks.add()
                    �?                    �?              [DataBridge.forward('stocks.bulkImported')]
                    �?              ┌─────┴─────�?              �?          �?        [IndexedDB]  [EventBus.emit('HOLDINGS_DATA_LOADED')]
              �?              �?        [usePoolDataFromStore.refresh()]
```

### G-3 数据传递质量监控指�?
| 指标 | 计算方式 | 告警阈�?| 处理动作 |
|:---|:---|:---|:---|
| 采集成功�?| success / total × 100% | < 80% | 触发降级 + 告警日志 |
| 数据完整�?| 非空字段�?/ 总字段数 | < 90% | 标记 dataQuality=partial |
| 采集延迟 | responseEnd - requestStart | > 5s | 记录慢查�?+ 切换备用�?|
| 写入成功�?| putSuccess / putTotal | < 95% | 重试 3 �?+ 记录错误 |
| 事件投递率 | eventReceived / eventSent | < 100% | 重发 + 补偿机制 |
| 格式校验通过�?| validRows / totalRows | < 95% | 拦截 + 标记 invalid |

---

## H. 质量监控与异常处理（P0�?
### H-1 异常处理流程

```
采集失败
  �?  ├─ 网络超时(30s) ──�?切换备用数据�?──�?记录降级日志
  �?                                          �?  �?                                   └─ 全部源失�?──�?返回 Mock 数据 + 标记 dataQuality=mock
  �?  ├─ 格式错误 ──�?记录错误字段 ──�?跳过该字�?──�?标记 dataQuality=partial
  �?  ├─ 写入失败 ──�?重试 3 �?间隔 1s) ──�?仍失�?──�?记录到失败队�?──�?EventBus.emit('COLLECT_WRITE_FAILED')
  �?  └─ 降级链耗尽 ──�?返回缓存数据 ──�?标记 dataQuality=stale ──�?logger.warn('[Orchestrator] All sources failed, using cache')
```

### H-2 监控指标采集�?
| 采集�?| 位置 | 记录内容 | 输出方式 |
|:---|:---|:---|:---|
| 采集开�?| directDataAPI.ts 请求�?| source + code + dimension + timestamp | logger.info |
| 采集成功 | directDataAPI.ts 响应�?| source + code + latency + fieldCount | logger.info |
| 采集失败 | directDataAPI.ts catch | source + code + error + fallback | logger.error |
| 降级触发 | dataSourceOrchestrator.ts | from �?to + reason | logger.warn |
| 写入成功 | DataBridge.routeToDB() | store + action + key | logger.info |
| 写入失败 | DataBridge.routeToDB() catch | store + action + error | logger.error |
| 批量导入 | batchImportService.ts | total + success + failed + duration | logger.info |

---

## 执行计划

### 并行 Agent 分配

| Agent | 任务�?| 执行内容 |
|:---|:---|:---|
| Agent A | A-1~A-4 | 批量导入增强（服务层+UI组件�?|
| Agent B | B-1~B-4 + F-1~F-3 + G-1~G-3 + H-1~H-2 | 真实数据采集+时序控制+数据传�?监控 |
| Agent C | C-1~C-4 + D-1~D-2 | UI/UX优化+缺失模块框架 |
| Agent D | E-1~E-3 | 测试验证（待A/B/C完成后执行） |
