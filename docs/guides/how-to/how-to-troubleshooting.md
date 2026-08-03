---
title: V9 常见问题排查指南
type: how-to
domain: project
phase: operation
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "面向日常使用与开发调试的 V9 故障排查手册，覆盖采集、评分、UI 渲染、性能四大类高频问题的定位步骤与修复建议"
tags: [project, troubleshooting, debug, faq, support]
version: v1.0.0
last_updated: 2026-07-19
code_version: 2.0.0
doc_id: V9-DOC-PROJ-349
related_docs: [V9-DOC-DATA-078]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-19
---

# V9 常见问题排查指南

> **版本**：v1.0.0  
> **更新日期**：2026-07-19  
> **适用范围**：使用或开发 V9 过程中遇到采集异常、评分异常、UI 渲染异常、性能劣化等问题时的自助排查手册
---

## 前置检查清单

开始排查前，请逐项确认以下基础条件：

- [ ] 使用受支持的现代浏览器（Chrome / Edge / Firefox 最新稳定版）
- [ ] 已通过 V9 应用主界面正常登录/进入系统
- [ ] 问题可稳定复现，已记录复现步骤
- [ ] 会按 F12 打开开发者工具，并切换到 Console 面板查看日志
- [ ] 会切换 Network 面板查看网络请求状态
- [ ] 会执行强制刷新（Ctrl+Shift+R / Cmd+Shift+R）
- [ ] 重要数据已备份，排查操作不会造成数据丢失

---

## 通用排查三板斧

任何异常优先按以下三步定位，80% 的问题可在三板斧内收敛。

### 步骤 1：查看控制台（Console）

1. 按 F12 打开开发者工具
2. 切换到 Console 面板
3. 按级别过滤日志：Error / Warning / Info
4. 根据日志前缀定位问题模块：
   - 采集链路问题 → 搜索 `[data-collector]` 或 `[fetcher]`
   - 评分引擎问题 → 搜索 `[V6ScoreEngine]` 或 `[scoring]`
   - 数据落库问题 → 搜索 `[databridge]` 或 `[dataLayer]`
   - UI 状态问题 → 搜索对应 `[store]` 前缀

### 步骤 2：运行审计脚本

本地命令行执行以下审计命令，快速定位结构性问题：

```bash
# 快速质量门禁（类型+关键检查）
npm run gate:quick

# 分层架构违规审计
npm run audit:layers

# 硬编码残留审计
npm run audit:hardcode

# ACL 白名单一致性审计
npm run audit:acl-consistency

# 跨文件质量审计
npm run audit:quality -- --cross-file
```

### 步骤 3：检查运行时状态（Store / 数据库）

通过开发者工具直接检查运行时数据：

```typescript
// 检查 Zustand Store 状态（控制台执行）
// 前提是项目已将 store 暴露到 window.store 或使用 React DevTools

// 检查 IndexedDB 数据
// 开发者工具 → Application → IndexedDB → V6ProDB → 展开目标 Store
```

---

## 采集类问题排查

### 问题 1：采集失败 / 采集成功数为 0

**现象**：执行采集任务后返回失败，或成功股票数为 0，无任何数据落库。

**排查步骤**：

1. **确认网络连通**
   - 检查本机网络是否正常，能否访问外部数据源
   - 查看 Network 面板中采集请求的状态码

2. **确认数据源可用**
   - 第三方数据源（akshare / 财经接口）可能被限流或维护
   - 检查 `COLLECTION_BATCH_SIZE` 是否过大触发限流

3. **查看采集日志**
   - 搜索 `[fetcher]` 或 `[data-collector]` 前缀日志
   - 定位失败发生在哪个采集通道

4. **检查 ACL 权限**
   - 确认 `fetcher` 角色对目标 store 具备 write 权限
   - 核对 `src/config/dbConfig.ts` 中的 `ACL_MATRIX`

5. **缩小范围重试**
   - 先用单只股票小批量试采
   - 成功后逐步扩大批量

**常见原因速查**：

| 原因 | 处理方式 |
|------|---------|
| 网络不通 | 检查代理/VPN，确认数据源域名可访问 |
| API 限流 | 调小 `COLLECTION_BATCH_SIZE`，增加请求间隔 |
| ACL 权限被拒 | 修正 `ACL_MATRIX`，为 fetcher 补充写权限 |
| 股票代码格式错误 | 使用标准带后缀格式（如 `600519.SH`） |
| 数据源字段变更 | 更新 fetcher 的字段映射 |

### 问题 2：采集成功但数据不完整

**现象**：采集返回成功，但落库数据字段缺失，或记录数为 0。

**排查步骤**：

1. **检查数据源返回**
   - 确认数据源本身返回了完整字段
   - 部分股票（新股/停牌）数据天然不全
   - 对比多只股票的返回结构

2. **检查采集质量分**
   - 质量分 < 80 说明数据存在明显缺口
   - 查看 `qualityScore` 的扣分明细

3. **检查落库流程**
   - 在 IndexedDB 中直接查看目标记录
   - 确认 DataBridge 信封写入无异常丢弃

**常见原因**：
- 数据源该股票确实无数据（新股/退市）
- 字段映射遗漏导致部分字段被丢弃
- 落库过程中的类型转换 bug
- 特殊股票（ST/退市整理期）被过滤规则排除

### 问题 3：采集速度异常缓慢

**现象**：采集任务长时间不完成，进度条停滞。

**排查步骤**：

1. **确认是否限流**：数据源限流会自动退避，观察日志中的重试记录
2. **检查批量大小**：批量过大导致单批耗时过长，拆小批次重试
3. **检查网络延迟**：Network 面板查看单请求耗时是否异常
4. **检查本地写入**：IndexedDB 大批量写入本身较慢，属正常现象
5. **检查并发配置**：确认并发数未被误改为 1

---

## 评分类问题排查

### 问题 1：评分为 0 / 评级恒为 strong_sell

**现象**：所有股票评分均为 0 分，或评级固定为 strong_sell。

**排查步骤**：

1. **确认输入数据存在**
   ```typescript
   // 控制台验证采集数据
   const quotes = await dataLayer.dailyQuotes.getBySymbol('600519.SH')
   const finance = await dataLayer.financialReports.getBySymbol('600519.SH')
   console.log('K线记录数：', quotes?.history?.length)
   console.log('财报状态：', finance ? '已落库' : '缺失')
   ```

2. **检查评分覆盖率**
   - 查看 `coverageRate` 是否为 0
   - 查看 `skippedLayers` 列表
   - 大量层被跳过会导致有效权重接近 0

3. **检查引擎日志**
   - 搜索 `[V6ScoreEngine]` 前缀日志
   - 检查 `sanitizeScore` 是否将输入清洗为 0（NaN / Infinity 会被兜底为 0）

4. **检查计算器注册**
   - 确认引擎实例已注册全部计算器
   - 未注册计算器的层得分默认为 0

### 问题 2：评分结果与预期严重不符

**现象**：优质股票评分异常低，或评分恒为 5 分 / 恒为 0 分。

**排查步骤**：

1. **检查权重配置**
   - 确认 `DEFAULT_WEIGHTS` 各层之和为 1.0
   - 确认近期无人改动过权重配置

2. **检查评级阈值**
   - 确认 `rating` 阈值未被误改
   - 默认值：strongBuy=4.0, buy=3.0, hold=2.0, sell=1.0

3. **检查输入数据质量**
   - 极端输入会导致极端评分
   - 负 PE、异常 ROE、空财报都会显著拉偏结果

4. **查看交叉验证结果**
   ```typescript
   const result = await runV6Score('600519.SH')
   console.log(result.data?.crossValidation)
   ```

### 问题 3：评分耗时过长（单票 > 1 秒）

**现象**：单票评分耗时明显超过正常水平。

**排查步骤**：

1. **确认数据量**：K 线历史过长（多年全量）会拉长计算时间
2. **确认批量大小**：批量评分时单票耗时会叠加，观察总耗时而非单票
3. **查看性能埋点**：`PERF.SCORING_CALCULATE_ALL` 日志记录了各阶段耗时
4. **确认机器负载**：其他重任务（构建/采集）并发会拖慢评分

**优化建议**：
- 批量评分优先使用批量入口而非循环单票调用（建议单批 ≤ 500 只）
- 非调试场景关闭审计追踪（`auditEnabled: false`）
- 大计算量场景考虑 Web Worker 卸载主线程
- 多票评分使用 `Promise.all` 并发而非串行

---

## UI 渲染类问题排查

### 问题 1：页面白屏

**现象**：打开应用后页面完全空白，或路由切换后白屏。

**排查步骤**：

1. **查看控制台报错**
   - 白屏几乎都伴随 JavaScript 运行时错误
   - 记录第一条报错的堆栈信息

2. **常见白屏原因**
   - 路由懒加载 chunk 加载失败（网络/构建问题）
   - 顶层组件抛异常
   - React 错误未被 ErrorBoundary 捕获
   - IndexedDB 初始化失败导致启动中断

3. **修复手段**
   - 强制刷新清缓存（Ctrl+Shift+R）
   - 清空站点数据后重试
   - 更换浏览器验证
   - 若为构建产物问题，重新执行构建并确认产物完整（勿用损坏的 dist）

### 问题 2：组件报错 / ErrorBoundary 兜底页

**现象**：页面局部显示错误兜底 UI，或控制台出现 Component Error。

**排查步骤**：

1. **查看错误堆栈**：定位抛错的组件与代码行
2. **检查数据形态**：报错组件通常收到了不符合预期的数据
3. **检查 Store 订阅**：确认组件订阅的 Store 字段类型正确
4. **检查 props 传递**：确认上游组件传入的 props 完整

**常见原因**：
- 数据结构变更后组件未同步（字段重命名/schema 变更）
- 空数据未防御（`undefined.map()` 类错误）
- Store selector 返回了新引用导致无限重渲染
- 异步数据未处理 loading 态

### 问题 3：数据已更新但 UI 不刷新（假死）

**现象**：后台数据已变化，但 UI 停留旧值，刷新页面后才更新。

**排查步骤**：

1. **检查 Store 订阅**
   - 用 React DevTools 查看 Store 当前值
   - 确认 action 执行后状态确实更新

2. **检查写入链路**
   - 查看 DataBridge 写入日志
   - 查看 `command_audit_logs` 确认信封已送达

3. **检查广播机制**
   - Zustand withBroadcast 跨 Tab 广播是否正常
   - 多 Tab 场景下确认广播事件未丢失

**常见原因**：
- Store 派生函数使用 `getState()` 快照而非响应式订阅（P0 类问题）
- 组件 selector 未订阅数据字段，只订阅了 loading
- 写入走了绕过 Store 的直连路径，未触发订阅通知
- 多 Tab 场景广播通道被浏览器节流

---

## 性能类问题排查

### 问题 1：页面卡顿 / 交互响应慢

**现象**：滚动卡顿、点击延迟、输入掉帧。

**排查步骤**：

1. **录制 Performance 面板**
   - 按 F12 → Performance → 开始录制
   - 复现卡顿操作
   - 停止录制，分析长任务与掉帧点

2. **常见卡顿来源**
   - 大列表未虚拟化，一次渲染上千行
   - 高频 re-render（selector 返回新引用）
   - 主线程执行重计算（评分/聚合）
   - 图表组件重复全量重绘

3. **内存检查**
   - Performance → Memory 面板录制
   - 确认是否存在持续上涨的内存（泄漏）

**优化建议**：
- 大列表启用虚拟滚动（react-window / react-virtualized）
- 使用 `React.memo` / `useMemo` / `useCallback` 稳定引用
- 重计算迁移至 Web Worker
- 图表/看板类组件按需更新而非全量重绘

### 问题 2：内存持续上涨

**现象**：使用一段时间后内存从几百 MB 涨到数 GB，页面变卡。

**排查步骤**：

1. **录制 Memory 面板对比快照**
2. **常见泄漏来源**：
   - 事件监听未在 cleanup 中移除（history 越长泄漏越多）
   - 定时器未清理（setInterval 无 clearInterval）
   - 闭包持有大对象未释放
   - 缓存无上限持续增长

3. **确认清理逻辑**：
   - useEffect 是否都返回了 cleanup
   - EventBus.subscribe 是否配对 unsubscribe
   - 组件卸载后订阅是否全部断开

**优化建议**：
- 缓存类数据启用 LRU + TTL（建议容量上限 500 条）
- 长会话场景定期清理过期的中间计算缓存
- 全局单例缓存设置容量上限
- 大对象用完后主动置空引用

### 问题 3：首屏加载缓慢

**现象**：首次打开应用白屏时间长，加载转圈久。

**排查步骤**：

1. **查看 Network 面板**
   - 确认首屏 chunk 体积是否过大
   - 确认是否存在串行加载的瀑布请求

2. **检查初始化链路**
   - IndexedDB 初始化是否阻塞首屏
   - 启动时的预加载数据量是否过大
   - 是否有同步执行的重建任务

3. **优化方向**
   - 路由级代码分割（Code Splitting）
   - 组件级懒加载（Lazy Loading）
   - 非关键数据延后加载

---

## 诊断信息收集

### 方法 1：导出控制台日志

**操作步骤**：
1. 按 F12 打开开发者工具
2. 切换到 Console 面板
3. 右键 → 另存为（Save as...）导出完整日志

**导出前建议**：
- 先清空控制台再复现问题，保证日志只包含问题时段，便于定位

### 方法 2：导出审计报告

```bash
# 导出 SARIF 格式质量审计报告
npm run audit:quality -- --format sarif > audit-report.sarif

# 导出分层审计结果
npm run audit:layers > layer-audit.txt

# 导出硬编码审计结果
npm run audit:hardcode > hardcode-audit.txt
```

审计报告的归档位置约定：
- JSON 报告归档至 `docs/reports/audit/`
- 测试审计报告归档至 `docs/guides/how-to/testing/audit-reports/audit/`

### 方法 3：导出数据快照

排查数据类问题时建议先导出快照：

1. 打开数据管理 → 数据导出
2. 导出全量 JSON 备份
3. 将备份文件随问题反馈一并提供

> **注意**：备份文件包含本地全部数据，外发前请确认不包含敏感信息。

### 方法 4：Performance 录制

1. 按 F12 → Performance
2. 点击录制按钮，复现性能问题
3. 停止录制生成 profile
4. 分析火焰图定位长任务
5. 导出 profile 文件（右键 → Save profile）随问题反馈

---

## 数据损坏应急处理

### 判定数据损坏的信号

- [ ] 应用启动即报错，指向 IndexedDB 读写异常
- [ ] 数据查询返回结构损坏的对象（字段类型错乱）
- [ ] 同一数据多次查询结果不一致
- [ ] 数据库版本号与代码声明的 `DB_VERSION` 不一致
- [ ] 迁移记录 `schema_migrations` 存在失败条目
- [ ] 大量 Store 为空但采集日志显示写入成功

### 应急处理流程

> ⚠️ **处理前务必先导出当前数据备份（即使是损坏的数据）**

1. **备份当前状态**：打开数据管理 → 全量导出
2. **尝试自动修复**：重启应用，观察 `runMigrations` 是否自动修复
3. **重置重建**：无法自动修复时执行数据重置（见场景 U 盘恢复流程）
4. **从备份恢复**：重置完成后导入最近的健康备份

### 预防措施

1. 定期备份（按使用强度确定频率）
2. 大版本升级前强制备份
3. 避免多开异常操作
4. 关注浏览器存储配额告警

> 详细操作参见 [如何导入导出与备份 V9 数据](./how-to-data-import-export.md)

---

## 问题反馈模板

排查后仍无法解决的问题，请按以下模板整理信息提交：

### 问题反馈模板

```
【问题描述】
一句话描述问题现象与影响范围

【问题分类】采集 / 评分 / UI / 性能 / 数据
【严重级别】P0 阻断 / P1 严重 / P2 一般

【复现步骤】
1. 
2. 
3. 

【期望行为】
【实际行为】

【环境信息】
- 浏览器及版本：
- 应用版本：
- 数据库版本：

【已收集的诊断信息】
- 控制台日志（附件）
- 审计报告（附件）
- 数据快照（如涉及数据问题）
```

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 采集评分流水线指南 | `./how-to-run-scoring-pipeline.md` | 采集与评分的完整运行流程 |
| 审计脚本使用指南 | `./how-to-use-audit-scripts.md` | 质量门禁与审计命令详解 |
| 数据导入导出指南 | `./how-to-data-import-export.md` | 备份恢复与数据重置操作 |
| V6 评分配置指南 | `./how-to-configure-v6-scoring.md` | 权重阈值调整与回测验证 |
| V6 评分契约 | `../reference/scoring-contract.md` | 评分口径与接口定义 |
| 数据采集契约 | `../reference/data-collector-contract.md` | 采集通道与数据格式定义 |
| 测试策略 | `./testing/testing-strategy.md` | 测试分层与回归策略 |

---

> **维护提示**：本文档随问题库的积累持续更新。发现新的高频问题或排查路径失效时，请补充对应章节并更新 `change_log`，保持排查手册与实际代码行为一致。
