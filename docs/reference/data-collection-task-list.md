---
title: data-collection-task-list
tier: important
code_version: "2.0.0-rc.1"
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# 数据采集模块开发任务清单

> 基于差距分析报告 + 路由UI校对报告 + 用户需求
> 
> 日期：2026-07-01 | 版本：v2.0（补充时序控制+数据传递规范）

---

## 任务总览

| 任务组 | 任务数 | 优先级 | 目标 |
|:---|:---:|:---:|:---|
| A. 批量导入增强 | 4 | P0 | 支持CSV/Excel/JSON多格式文件导入 |
| B. 真实数据采集 | 4 | P0 | 接入腾讯/新浪/网易真实行情API |
| C. UI/UX优化 | 4 | P1 | 参照成熟APP标准优化交互体验 |
| D. 缺失模块框架 | 2 | P1 | 采集任务监控+抓取引擎配置 |
| E. 测试验证 | 3 | P0 | 功能+性能+用户体验测试 |
| F. 时序控制规范 | 3 | P0 | 确保数据时间一致性和完整性 |
| G. 数据传递规范 | 3 | P0 | 确保数据传递路径可靠和格式正确 |
| H. 质量监控与异常处理 | 2 | P0 | 监控指标+异常处理流程 |

---

## A. 批量导入增强（P0）

| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| A-1 | 多格式文件解析服务 | 在batchImportService中新增CSV/Excel(.xlsx)/JSON三种文件解析器；CSV用PapaParse逻辑、Excel用SheetJS(xlsx库)逻辑、JSON支持数组对象格式 | 3种格式均能正确解析为BulkImportRow[] |
| A-2 | 文件上传UI组件 | BulkImportPanel新增拖拽上传区域(file dropzone)；支持点击选择文件；显示文件名/大小/格式；解析后自动预览 | 拖拽+点击两种方式均可用 |
| A-3 | 行级状态标签 | 预览表格新增"状态"列，显示valid(绿)/duplicate(黄)/invalid(红)三种标签；重复代码自动标黄 | 每行有明确状态标签 |
| A-4 | 导入进度+模板下载 | 新增导入进度条(Progress组件)；新增"下载导入模板"按钮(导出CSV模板) | 进度实时更新+模板可下载 |

## B. 真实数据采集（P0）

| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| B-1 | 腾讯财经直连API | 新增directDataAPI.ts，实现tencentQuote(code)/tencentBatchQuotes(codes)/tencentKline(code,period,count)；通过HTTP请求qt.gtimg.cn获取实时行情 | 能获取真实股票行情数据 |
| B-2 | 新浪+网易备用API | 实现sinaQuote(code)/sinaBatchQuotes(codes)通过hq.sinajs.cn；实现neteaseHistory(code,start,end)通过quotes.163.com CSV解析 | 两个备用源均可获取数据 |
| B-3 | 四层降级编排 | 新增dataSourceOrchestrator.ts，实现getQuote(code)按腾讯→新浪→AKShare→Mock顺序降级；getKline(code,days)按网易→腾讯K线→AKShare→Mock降级 | 单源故障自动切换备用源 |
| B-4 | 采集结果写入 | 采集成功后通过DataBridge.forward()写入IndexedDB stocks store；更新Stock的dataQuality标记；触发EventBus事件通知UI刷新 | 采集数据持久化+UI自动更新 |

## C. UI/UX优化（P1）

| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| C-1 | BulkImportPanel视觉重构 | 参照成熟APP(同花顺/东方财富)设计标准：卡片式布局、步骤指引(1上传→2预览→3导入)、文件类型图标、拖拽高亮区 | 视觉呈现专业、交互流畅 |
| C-2 | InputDashboard布局优化 | 统计卡片增加趋势指示器；股票搜索区增加快捷操作按钮；看板列宽自适应；空状态插图 | 布局符合成熟APP标准 |
| C-3 | SevenDimConfigPage视觉增强 | 策略模板卡片增加颜色标识(蓝/绿/橙/紫/红)；维度开关增加动画过渡；额度预估增加可视化仪表盘 | 视觉层次清晰 |
| C-4 | 采集页面统一加Skeleton | DataTestPanel/HotSectorPanel/BulkImportPanel加载状态统一使用Skeleton骨架屏；空状态使用插图+引导文案 | 无白屏/无突兀渲染 |

## D. 缺失模块框架（P1）

| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| D-1 | CollectTaskPage框架 | 新建采集任务监控页(/input/collect-task)；3Tab布局(任务列表/评分卡片/采集日志)；任务列表含状态/进度/耗时 | 框架可渲染+路由可访问 |
| D-2 | FetcherConfigPage框架 | 新建抓取引擎配置页(/input/fetcher)；数据源列表+连通性测试+采集日志面板 | 框架可渲染+路由可访问 |

## E. 测试验证（P0）

| 编号 | 任务 | 具体内容 | 完成标准 |
|:---:|:---|:---|:---|
| E-1 | 批量导入测试 | 测试CSV/Excel/JSON三种格式解析；测试行级状态标签；测试重复检测；测试文件大小限制 | 所有测试用例通过 |
| E-2 | 数据采集测试 | 测试四层降级逻辑(Mock模式)；测试采集结果写入；测试EventBus通知 | 所有测试用例通过 |
| E-3 | 集成测试+报告 | 运行完整vitest套件；tsc编译检查；生成测试报告 | 0编译错误+全测试通过 |

---

## F. 时序控制规范（P0）

### F-1 维度采集执行顺序与依赖关系

```
用户触发采集
  │
  ├─ Phase 1: 基础数据（无依赖，可并行）
  │   ├─ 01_basic   (月度, TTL 43200min)  ← 腾讯实时行情
  │   ├─ 02_kline   (日频, TTL 180min)    ← 网易历史K线
  │   └─ 07_index   (周频, TTL 10080min)  ← 腾讯指数行情
  │
  ├─ Phase 2: 分析数据（依赖 Phase 1 的 basic 数据）
  │   ├─ 03_chip     (3日, TTL 4320min)   ← 需 01_basic 完成
  │   ├─ 06_industry (周频, TTL 10080min)  ← 需 01_basic 完成
  │   └─ 08_research (日频, TTL 180min)    ← 需 01_basic 完成
  │
  ├─ Phase 3: 事件数据（独立流，实时监听）
  │   ├─ 04_events (日频, TTL 180min)
  │   └─ 05_news   (日频, TTL 180min)
  │
  └─ Phase 4: 聚合写入（依赖 Phase 1+2 完成）
      └─ DataBridge.forward() → IndexedDB → EventBus 通知
```

| 规则 | 说明 |
|:---|:---|
| Phase 1 并行 | 01/02/07 三个维度无依赖，使用 Promise.all 并行采集 |
| Phase 2 串行等待 | 03/06/08 依赖 01_basic 的 stock 基础信息，须等 Phase 1 完成 |
| Phase 3 独立 | 04/05 为事件流，不阻塞其他维度 |
| Phase 4 屏障 | 所有维度完成后统一写入，避免部分写入导致数据不一致 |
| 超时控制 | 单维度采集超时 30s 自动降级到下一数据源 |
| 间隔控制 | 同一维度两次采集间隔 ≥ frequency 配置的最小间隔 |

### F-2 批量导入时序控制

```
用户上传文件
  │
  ├─ Step 1: 文件解析 (同步, ≤2s)
  │   └─ CSV/Excel/JSON → BulkImportRow[]
  │
  ├─ Step 2: 行级校验 (同步, ≤1s)
  │   ├─ 格式校验：代码6位数字 + 名称非空
  │   ├─ 重复检测：与现有候选池比对
  │   └─ 标记状态：valid / duplicate / invalid
  │
  ├─ Step 3: 逐行导入 (异步, 每行≤3s)
  │   ├─ 按批次(batchSize=10)分组
  │   ├─ 每批使用 Promise.all 并行
  │   └─ 批次间间隔 200ms（避免并发冲击）
  │
  └─ Step 4: 结果汇总 (同步)
      ├─ 统计 success/failed/duplicate
      ├─ DataBridge.forward('stocks.bulkImported', ...)
      └─ EventBus.emit('HOLDINGS_DATA_LOADED')
```

### F-3 采集频率与时间窗口

| 维度 | 频率 | 采集窗口 | 缓存TTL | 说明 |
|:---|:---|:---|:---|:---|
| 01_basic | 月度 | 每月1日 09:30 | 43200min(30天) | 基础信息变动低频 |
| 02_kline | 日频 | 每日 16:00 | 180min(3h) | 收盘后采集 |
| 03_chip | 3日 | 周一/四 16:00 | 4320min(3天) | 筹码分布中频 |
| 04_events | 日频 | 每日 09:00 | 180min(3h) | 开盘前检查公告 |
| 05_news | 日频 | 每日 09:00 | 180min(3h) | 开盘前检查新闻 |
| 06_industry | 周频 | 每周五 16:00 | 10080min(7天) | 行业数据周频 |
| 07_index | 周频 | 每周五 16:00 | 10080min(7天) | 指数数据周频 |
| 08_research | 日频 | 每日 16:00 | 180min(3h) | 收盘后采集研报 |

---

## G. 数据传递规范（P0）

### G-1 数据传递路径与格式标准

```
[数据源API] ──HTTP/JSON──→ [directDataAPI.ts] ──Normalize──→ [dataSourceOrchestrator.ts]
                                                                    │
                                    ┌───────────────────────────────┘
                                    ▼
                              [DataBridge.forward()]
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              [IndexedDB]    [EventBus]      [Pinia/Zustand]
              stocks store   事件广播         Store 更新
                                    │
                                    ▼
                              [React 组件渲染]
```

| 传递环节 | 格式标准 | 接口协议 | 验证机制 |
|:---|:---|:---|:---|
| API → directDataAPI | 腾讯: JS分隔符文本；新浪: JS变量赋值；网易: CSV | HTTP GET, charset=GBK | 响应非空 + 字段数校验 |
| directDataAPI → Orchestrator | StockQuote 标准接口对象 | TypeScript 接口约束 | 字段类型校验 + 数值范围校验 |
| Orchestrator → DataBridge | Envelope<T> 信封格式 | DataBridge.forward() | ACL 权限校验 + schema 验证 |
| DataBridge → IndexedDB | Stock 类型对象 | dataLayer.stocks.put() | keyPath 校验 + 事务回滚 |
| DataBridge → EventBus | 事件名 + payload | EventBus.emit() | 事件名白名单 + payload schema |

### G-2 批量导入数据传递路径

```
[文件] ──FileReader──→ [batchImportService.parseFile()]
                                │
                    ┌───────────┘
                    ▼
              [BulkImportRow[]]
              含 status: valid/duplicate/invalid
                    │
                    ▼
              [importStocks(rows)]
              逐行 → addStock() → dataLayer.stocks.add()
                    │
                    ▼
              [DataBridge.forward('stocks.bulkImported')]
                    │
              ┌─────┴─────┐
              ▼           ▼
        [IndexedDB]  [EventBus.emit('HOLDINGS_DATA_LOADED')]
              │
              ▼
        [usePoolDataFromStore.refresh()]
```

### G-3 数据传递质量监控指标

| 指标 | 计算方式 | 告警阈值 | 处理动作 |
|:---|:---|:---|:---|
| 采集成功率 | success / total × 100% | < 80% | 触发降级 + 告警日志 |
| 数据完整率 | 非空字段数 / 总字段数 | < 90% | 标记 dataQuality=partial |
| 采集延迟 | responseEnd - requestStart | > 5s | 记录慢查询 + 切换备用源 |
| 写入成功率 | putSuccess / putTotal | < 95% | 重试 3 次 + 记录错误 |
| 事件投递率 | eventReceived / eventSent | < 100% | 重发 + 补偿机制 |
| 格式校验通过率 | validRows / totalRows | < 95% | 拦截 + 标记 invalid |

---

## H. 质量监控与异常处理（P0）

### H-1 异常处理流程

```
采集失败
  │
  ├─ 网络超时(30s) ──→ 切换备用数据源 ──→ 记录降级日志
  │                                           │
  │                                    └─ 全部源失败 ──→ 返回 Mock 数据 + 标记 dataQuality=mock
  │
  ├─ 格式错误 ──→ 记录错误字段 ──→ 跳过该字段 ──→ 标记 dataQuality=partial
  │
  ├─ 写入失败 ──→ 重试 3 次(间隔 1s) ──→ 仍失败 ──→ 记录到失败队列 ──→ EventBus.emit('COLLECT_WRITE_FAILED')
  │
  └─ 降级链耗尽 ──→ 返回缓存数据 ──→ 标记 dataQuality=stale ──→ logger.warn('[Orchestrator] All sources failed, using cache')
```

### H-2 监控指标采集点

| 采集点 | 位置 | 记录内容 | 输出方式 |
|:---|:---|:---|:---|
| 采集开始 | directDataAPI.ts 请求前 | source + code + dimension + timestamp | logger.info |
| 采集成功 | directDataAPI.ts 响应后 | source + code + latency + fieldCount | logger.info |
| 采集失败 | directDataAPI.ts catch | source + code + error + fallback | logger.error |
| 降级触发 | dataSourceOrchestrator.ts | from → to + reason | logger.warn |
| 写入成功 | DataBridge.routeToDB() | store + action + key | logger.info |
| 写入失败 | DataBridge.routeToDB() catch | store + action + error | logger.error |
| 批量导入 | batchImportService.ts | total + success + failed + duration | logger.info |

---

## 执行计划

### 并行 Agent 分配

| Agent | 任务组 | 执行内容 |
|:---|:---|:---|
| Agent A | A-1~A-4 | 批量导入增强（服务层+UI组件） |
| Agent B | B-1~B-4 + F-1~F-3 + G-1~G-3 + H-1~H-2 | 真实数据采集+时序控制+数据传递+监控 |
| Agent C | C-1~C-4 + D-1~D-2 | UI/UX优化+缺失模块框架 |
| Agent D | E-1~E-3 | 测试验证（待A/B/C完成后执行） |
