---
title: pre-testing-checklist
type: reference
domain: qa
phase: testing
tier: important
status: active
maintainer: V9 Architecture Team
summary: "本清单用于在系统上线前，对测试活动进行系统化、可执行的准备工作校对。通过按系统模块和功能模块拆分准备项，确保测试范围完整、环境就绪、数据可用、用例充分、人员职责清晰，从而支持上线前全面诊断和问题排查。"
tags: [qa, checklist, test, testing, audit]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-004
related_docs: [V9-DOC-PROD-009, V9-DOC-QA-009, V9-DOC-QA-032, V9-DOC-ARCH-032, V9-DOC-PROJ-272]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-295]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 智能投研复盘系统 · 测试前准备清单

> **版本**: v1.0.0 ｜ **更新日期**: 2026-07-15 ｜ **适用范围**: V9 系统上线前全面测试准备
> **编制依据**:
> - 项目现有 [`APP上线前体检清单_v9.html`](./audit-reports/audit/APP上线前体检清单_v9.html)（78 项体检清单）
> - [`production-release-checklist-skill.md`](../explanation/production-release-checklist-skill.md)
> - [`v9-体系化上线测试-todo-list.md`](../explanation/v9-体系化上线测试-todo-list.md)
> - 行业标准：Front-End-Checklist / Cortex Release Checklist / CloudBees Deployment Checklist / 证监会《证券期货业软件测试指南》/ 华泰&中信证券移动金融客户端规范

---

## 1. 清单说明

### 1.1 目的

本清单用于在系统上线前，对测试活动进行系统化、可执行的准备工作校对。通过按系统模块和功能模块拆分准备项，确保测试范围完整、环境就绪、数据可用、用例充分、人员职责清晰，从而支持上线前全面诊断和问题排查。

### 1.2 优先级定义

| 优先级 | 含义 | 上线前要求 |
| :--- | :--- | :--- |
| **P0 阻断** | 缺失将直接导致发布阻塞或重大事故 | 必须完成并通过 |
| **P1 高优** | 显著影响质量、稳定性或用户体验 | 建议上线前完成 |
| **P2 中优** | 影响局部质量或效率 | 上线前或首迭代内完成 |
| **P3 低优** | 优化项，可在后续迭代补强 | 记录并排期 |

### 1.3 使用方式

1. **发布评审前 1 周**启动逐项校对；
2. 每项准备完成后在「状态」列标记：未开始 / 进行中 / 已完成 / 不适用；
3. **所有 P0 项必须「已完成」**，方可进入测试执行阶段；
4. 本清单应结合 [`v9-目标功能清单.md`](../explanation/v9-目标功能清单.md) 与 [`test-catalog.md`](../reference/test-catalog.md) 使用；
5. 发现新增风险时，应及时回填为清单条目持续迭代。

---

## 2. 测试前准备总览

### 2.1 四阶段准备流程

```
阶段 1: 环境就绪（测试环境、数据、工具链）
    ↓
阶段 2: 代码与构建就绪（CI 门禁、分支冻结、基线确认）
    ↓
阶段 3: 测试资产就绪（用例、脚本、Mock、fixtures）
    ↓
阶段 4: 人员与流程就绪（分工、评审、值班、回滚预案）
    ↓
进入测试执行 → 问题跟踪 → 回归验证 → 发布评审
```

### 2.2 测试准入条件（Stage Gate）

| 准入项 | 通过标准 | 验证命令/方法 |
| :--- | :--- | :--- |
| 代码冻结 | 功能分支已合并，release 分支不再接受新特性 | 分支保护规则 + PR 清单 |
| CI 地基全绿 | 分层、硬编码、死代码、文档同步、类型检查均通过 | `npm run audit:layers` / `audit:hardcode` / `audit:deadcode` / `audit:docs` / `tsc:prod` |
| 测试基线全绿 | `test:clean` 14/14 通过，无新增失败 | `npm run test:clean` |
| 关键 E2E 就绪 | 核心用户路径脚本已完成并通过预演 | `npm run test:e2e -- --grep "smoke"` |
| 环境隔离 | 测试/预发/生产环境配置分离，无生产密钥混入 | `grep` / `npm run audit:hardcode` |

---

## 3. 通用测试前准备项（跨模块）

### 3.1 环境准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| ENV-01 | 测试环境部署完成 | P0 | 测试/预发环境可访问，版本号与待测分支一致 | [ ] |
| ENV-02 | 环境变量清单核对 | P0 | `.env` / `.env.local` 中无生产密钥，`VITE_DATA_SOURCE_TYPE` 可切换 mock/rest/websocket | [ ] |
| ENV-03 | 浏览器与设备矩阵确认 | P1 | 明确目标浏览器（Chrome/Edge/Safari/Firefox）及最低版本 | [ ] |
| ENV-04 | 网络环境配置 | P1 | 弱网、断网、代理环境可用；REST / WebSocket / Mock 三数据源可切换 | [ ] |
| ENV-05 | 测试数据隔离 | P1 | 测试数据库/IndexedDB 与生产隔离，可独立重置 | [ ] |
| ENV-06 | 监控与告警环境就绪 | P1 | 错误上报、web-vitals、业务埋点可在测试环境接收 | [ ] |

### 3.2 代码与构建准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| BUILD-01 | 类型检查通过 | P0 | `tsc:prod` 0 error；`tsc:test` 0 error（或已确认非阻塞） | [ ] |
| BUILD-02 | 分层依赖合规 | P0 | `npm run audit:layers` 0 violations / 0 warnings | [ ] |
| BUILD-03 | 硬编码清理 | P0 | `npm run audit:hardcode` 0 告警（颜色、端点、阈值、密钥） | [ ] |
| BUILD-04 | 死代码清理 | P0 | `npm run audit:deadcode` 0 死代码；条件返回 `null` 已确认是预期保护 | [ ] |
| BUILD-05 | 文档同步 | P1 | `npm run audit:docs` 0 drift；路由/契约/数据字典已更新 | [ ] |
| BUILD-06 | 构建产物校验 | P1 | `npm run build` 成功；包体积未超预算；无 SourceMap 密钥泄露 | [ ] |
| BUILD-07 | 路由可达 | P1 | `npm run audit:routes` 全路由可达，404 兜底正常 | [ ] |
| BUILD-08 | 令牌合规 | P1 | `npm run lint:colors` / `verify:tokens` 0 告警 | [ ] |

### 3.3 测试资产准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| ASSET-01 | 单元测试基线确认 | P0 | `npm run test:clean` 全绿；8 个排除测试文件原因已记录并有修复计划 | [ ] |
| ASSET-02 | E2E 脚本准备 | P1 | Playwright 关键路径脚本已覆盖 5 舱核心流程 | [ ] |
| ASSET-03 | 视觉回归基线 | P1 | 已确认 5 个基线截图；新增 UI 变更已更新基线 | [ ] |
| ASSET-04 | Mock 与 Fixtures | P1 | `tests/fixtures/`、`tests/mockStockData.ts`、LLM Mock 数据已就位 | [ ] |
| ASSET-05 | 覆盖率基线 | P1 | 全局 Statements≥80%，`src/core/**` Branches≥75% | [ ] |
| ASSET-06 | 测试排除清单同步 | P2 | `test:clean` 与 `test:known` 双向一致；`audit:tests` 通过 | [ ] |
| ASSET-07 | 性能预算 | P2 | LCP/INP/CLS 目标已定义；Lighthouse CI 或本地基线已跑 | [ ] |

### 3.4 人员与流程准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| PROC-01 | 测试分工明确 | P0 | 各模块 Owner、QA、开发、运维责任人已确认 | [ ] |
| PROC-02 | 缺陷跟踪流程 | P0 | 缺陷分级（P0/P1/P2/P3）、流转、验收标准已明确 | [ ] |
| PROC-03 | 发布与回滚预案 | P0 | 回滚触发条件、RTO/RPO 目标、回滚脚本/标签已就绪 | [ ] |
| PROC-04 | 灰度策略确认 | P1 | 1%→10%→50%→100% 灰度计划；功能开关可秒级关闭 | [ ] |
| PROC-05 | 上线值班安排 | P1 | 上线后 4h 黄金观察期值班人员与告警响应通道已确认 | [ ] |
| PROC-06 | 合规免责留痕 | P2 | 个人研究工具定位、AI 免责声明、数据本地化说明已文档化 | [ ] |

---

## 4. 按系统模块列示测试准备项目

### 4.1 门户与驾驶舱（Portal & Cockpit）

> 对应目录：`src/portal/`、`src/cockpit/`、`src/pages/HomePage.tsx`

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| COCKPIT-01 | 首页入口测试 | P0 | 首页 `/` 可访问，四舱导航与快捷入口无 404 | [ ] |
| COCKPIT-02 | 驾驶舱渲染 | P0 | `/cockpit` 多 Widget 仪表盘正常渲染，无空白/崩溃 | [ ] |
| COCKPIT-03 | Widget 引擎准备 | P1 | `widgetEngine` / `widgetRegistry` 注册同步；A–E 类 Widget 可加载 | [ ] |
| COCKPIT-04 | 响应式布局 | P1 | `react-grid-layout` 在不同分辨率/缩放（125%/150%）下不溢出错位 | [ ] |
| COCKPIT-05 | 数据采集状态监控 | P1 | 驾驶舱数据状态指示器（加载/成功/失败）已准备验证数据 | [ ] |
| COCKPIT-06 | 主题切换 | P2 | 暗色/亮色切换一致；股票红涨绿跌固定色不随主题变化 | [ ] |
| COCKPIT-07 | 空状态与错误态 | P2 | 无 Widget 数据、加载失败时有明确提示，不白屏 | [ ] |

### 4.2 输入舱（Input Cabin）

> 对应目录：`src/apps/input/`、`src/pages/input/`；功能：录入看板、批量导入、热门板块、本地知识库、采集测试

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| INPUT-01 | 输入舱 Hub 导航 | P0 | `/input/hub` 导航与概览可用，路由跳转正常 | [ ] |
| INPUT-02 | 录入看板数据准备 | P0 | 候选池管理 fixtures 就绪；股票增删改查验证数据覆盖 | [ ] |
| INPUT-03 | 批量导入测试数据 | P1 | 批量导入模板/样例 CSV/Excel 已准备；异常格式文件已收集 | [ ] |
| INPUT-04 | 热门板块数据 | P1 | 热门板块 Mock 数据就绪；一键加入候选池流程可验证 | [ ] |
| INPUT-05 | 本地知识库数据 | P1 | 本地知识库搜索/筛选测试数据已准备；`localKnowledgeStore` 初始状态已定义 | [ ] |
| INPUT-06 | 三数据源切换 | P1 | Mock / REST / WebSocket 在输入舱采集流程中可切换，视图零侵入 | [ ] |
| INPUT-07 | 采集测试面板 | P2 | `/input/data-test` 面板测试数据与断言已准备 | [ ] |
| INPUT-08 | 数据质量校验 | P2 | 缺失字段、异常值、空数组等脏数据注入方案已准备 | [ ] |

### 4.3 分析舱（Analysis Cabin）

> 对应目录：`src/apps/analysis/`、`src/pages/analysis/`；功能：V4 行业评分、V6 个股评分、智能评分、行业分析、策略回测、评分文档、智能资讯

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| ANALYSIS-01 | 分析舱 Hub 导航 | P0 | `/analysis/hub` 导航可用，各分析入口可点击 | [ ] |
| ANALYSIS-02 | V4 行业评分 | P0 | 行业评分输入数据、权重配置、预期输出已准备 | [ ] |
| ANALYSIS-03 | V6 个股评分 | P0 | 11 层评分（L-1~L8）fixtures 就绪；边界值用例已设计 | [ ] |
| ANALYSIS-04 | 智能评分 | P0 | LLM 增强成功/失败/超时/限流 Mock 已准备 | [ ] |
| ANALYSIS-05 | 策略回测 | P1 | 回测输入参数、历史 K 线数据、预期结果已准备 | [ ] |
| ANALYSIS-06 | 评分文档 | P2 | 评分文档版本库测试数据已准备 | [ ] |
| ANALYSIS-07 | 智能资讯（V9 + V6） | P2 | 新闻/情绪分析 Mock 数据；股票关联测试用例已准备 | [ ] |
| ANALYSIS-08 | 评分一致性 | P1 | KAI 评分、SCORE_LEVELS、信号分级边界值用例已设计 | [ ] |
| ANALYSIS-09 | 异常评分清理 | P1 | NaN / Infinity / 超范围评分注入方案已准备 | [ ] |
| ANALYSIS-10 | 图表渲染 | P2 | Recharts / lightweight-charts 大数据点渲染测试数据已准备 | [ ] |

### 4.4 交易舱（Trading Cabin）

> 对应目录：`src/apps/trading/`、`src/pages/trading/`；功能：交易信号、策略快照、交易持仓、风控、订单

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| TRADING-01 | 交易舱 Hub 导航 | P0 | `/trading/hub` 导航可用 | [ ] |
| TRADING-02 | 交易信号面板 | P0 | 观察池、订单、信号、策略组合 fixtures 已准备 | [ ] |
| TRADING-03 | 交易持仓 | P0 | 持仓列表查询/筛选/分页/补仓/平仓/CVS 导出测试数据已准备 | [ ] |
| TRADING-04 | 风控引擎 | P0 | 止损（-10%）、止盈（+30%）、最大回撤用例已设计 | [ ] |
| TRADING-05 | 订单管理 | P1 | 订单生成、状态流转（PENDING→FILLED/CANCELLED）测试数据已准备 | [ ] |
| TRADING-06 | 策略快照 | P2 | 策略快照查看 fixtures 已准备 | [ ] |
| TRADING-07 | 组合权重 | P1 | 组合权重分配、行业分散化、仓位计算边界用例已设计 | [ ] |
| TRADING-08 | 数据一致性 | P1 | Mock 交易 API 与真实接口字段对齐；`mock-trade-api` 中间件配置已核对 | [ ] |

### 4.5 输出舱（Output Cabin）

> 对应目录：`src/apps/output/`、`src/pages/output/`；功能：数据导出、研究报告生成

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| OUTPUT-01 | 输出舱渲染 | P0 | `/output` 页面可访问，仪表盘/输出中心正常渲染 | [ ] |
| OUTPUT-02 | JSON/CSV 导出 | P1 | 导出内容完整性、表头、精度、中文/￥/% 编码测试样例已准备 | [ ] |
| OUTPUT-03 | Excel 导出 | P2 | `.xlsx` 多工作表、格式正确性测试样例已准备 | [ ] |
| OUTPUT-04 | 评分报告 | P1 | 评分报告模板；11 层评分明细、综合评级、投资建议验证点已定义 | [ ] |
| OUTPUT-05 | 策略报告 | P1 | 策略报告模板；入选股票、分类理由、仓位建议验证点已定义 | [ ] |
| OUTPUT-06 | 导出数据一致性 | P1 | 导出数据与界面显示数据抽样比对方案已准备 | [ ] |
| OUTPUT-07 | 可视化输出 | P2 | 雷达图、K 线图渲染测试数据与断言已准备 | [ ] |

### 4.6 指令舱/总控舱（Command Cabin）

> 对应目录：`src/apps/command/`、`src/pages/command/`；功能：系统监控、配置管理、数据重置、V6 迁移、MCP 看板、智能体看板

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| COMMAND-01 | 总控舱 Hub 导航 | P0 | `/command/hub`、`/command` 导航与系统监控可用 | [ ] |
| COMMAND-02 | 系统配置 | P1 | 配置项变更测试数据；配置保存/重置/生效验证方案已准备 | [ ] |
| COMMAND-03 | 数据重置 | P1 | 数据重置/清理操作二次确认与影响范围测试用例已设计 | [ ] |
| COMMAND-04 | V6 迁移 | P1 | V6→V9 迁移 fixtures；迁移前后数据一致性验证方案已准备 | [ ] |
| COMMAND-05 | MCP 看板 | P2 | MCP Server 注册/状态/ACL 测试数据；`mcp-verify.spec.ts` 预演通过 | [ ] |
| COMMAND-06 | 智能体看板 | P2 | Agent 注册、健康、任务队列测试数据已准备 | [ ] |
| COMMAND-07 | 权限控制 | P2 | 若存在多角色，导航与数据按权限过滤验证用例已设计 | [ ] |

### 4.7 系统支撑层（Core / Data / Services / Store）

> 对应目录：`src/core/`、`src/data/`、`src/services/`、`src/store/`、`src/lib/`

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| CORE-01 | DataBridge 信封 | P0 | `forward()` / `query()` 路由；`ENVELOPE_ACTION` 双注册已校验 | [ ] |
| CORE-02 | ACL 权限矩阵 | P0 | `ACL_MATRIX` 白名单；越权写入用例已设计 | [ ] |
| CORE-03 | 内存缓存 | P1 | LRU / TTL 命中与淘汰测试数据已准备 | [ ] |
| CORE-04 | 事件总线 | P1 | EventBus 订阅/清理；跨 Tab `withBroadcast` 联动测试环境已准备 | [ ] |
| CORE-05 | IndexedDB 持久化 | P1 | 版本迁移、写入中断、损坏恢复测试方案已准备 | [ ] |
| CORE-06 | 数据源适配器 | P1 | `MarketDataAdapter` 缺字段兜底；Mock/REST/WS 三端结构对齐 | [ ] |
| CORE-07 | Store 状态管理 | P1 | ~50+ Zustand Store 初始状态；~23 个缺测试 Store 已识别并制定补齐计划 | [ ] |
| CORE-08 | 服务子域 | P2 | 22 个业务服务子域关键路径 fixtures 已梳理 | [ ] |
| CORE-09 | 错误与降级 | P1 | LLM 401/429/网络错误、数据源失败降级用例已设计 | [ ] |
| CORE-10 | 会话与凭证 | P1 | 登录态过期/续期/登出清理；敏感数据本地加密验证方案已准备 | [ ] |

---

## 5. 按测试类型列示准备项目

### 5.1 功能测试准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| FT-01 | 核心流程 E2E 脚本 | P0 | 登录 → 选股/复盘 → 评分 → 导出 主流程脚本就绪 | [ ] |
| FT-02 | 页面/Widget 渲染 | P1 | 5 舱 + 驾驶舱首屏渲染检查表 | [ ] |
| FT-03 | 表单与交互 | P1 | 股票搜索、筛选、配置表单边界值用例 | [ ] |
| FT-04 | 空/异常态 | P1 | 无数据、加载中、错误、超时 UI 反馈检查表 | [ ] |
| FT-05 | 关键操作防错 | P2 | 清空/导出/删除/重置二次确认用例 | [ ] |

### 5.2 性能测试准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| PERF-01 | 性能预算 | P1 | LCP<2.5s、INP<200ms、CLS<0.1；包体积预算已定义 | [ ] |
| PERF-02 | Lighthouse 基线 | P1 | 核心页面 Lighthouse 基线已跑并记录 | [ ] |
| PERF-03 | 包体积分析 | P1 | `vite build` + `stats.html` 分析；无超大 vendor | [ ] |
| PERF-04 | 长列表数据 | P2 | 万级股票池/历史记录虚拟化测试数据已准备 | [ ] |
| PERF-05 | 内存泄漏 | P2 | 长时间运行 + DevTools Memory 堆快照对比方案 | [ ] |
| PERF-06 | 负载/压力 | P2 | k6/Artillery 核心接口压测脚本（目标 QPS≥1000） | [ ] |

### 5.3 安全测试准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-01 | 密钥泄露检查 | P0 | bundle / SourceMap / env 中无硬编码密钥 | [ ] |
| SEC-02 | XSS 防护 | P0 | `<script>` / `<img onerror>` / 富文本注入用例已设计 | [ ] |
| SEC-03 | 依赖漏洞 | P1 | `npm audit` 0 high/critical；SCA 扫描已接入或人工核对 | [ ] |
| SEC-04 | CSRF / 重放 | P1 | 跨站请求/重放测试用例已设计 | [ ] |
| SEC-05 | 输入校验 | P1 | 异常/超长/特殊字符输入用例已设计 | [ ] |
| SEC-06 | 会话安全 | P1 | 登出后重放、本地存储加密验证用例 | [ ] |
| SEC-07 | 错误信息泄露 | P2 | 主动触发错误，确认不暴露堆栈/路径/密钥 | [ ] |
| SEC-08 | 第三方 SDK 评估 | P2 | SDK 清单、采集范围、供应商合规性已核对 | [ ] |

### 5.4 兼容性测试准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| COMP-01 | 浏览器矩阵 | P1 | Chrome/Edge/Safari/Firefox 主流版本实测计划 | [ ] |
| COMP-02 | 分辨率与缩放 | P1 | 1080p/2K/4K + 100%/125%/150% 缩放检查表 | [ ] |
| COMP-03 | 移动端/平板 | P2 | 若支持触控则布局与手势测试计划 | [ ] |
| COMP-04 | 图表跨浏览器 | P2 | 自绘图表/lightweight-charts 跨浏览器截图对比 | [ ] |
| COMP-05 | 编码与时区 | P2 | 中文/emoji、跨日时区、脏数据检查表 | [ ] |

### 5.5 数据完整性测试准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| DATA-01 | 持久化可靠性 | P1 | IndexedDB 写入/读取/版本迁移测试数据与异常注入方案 | [ ] |
| DATA-02 | 刷新/跨 Tab 一致 | P1 | 状态持久化刷新后不丢、不串；`withBroadcast` 同步验证 | [ ] |
| DATA-03 | 数据源结构对齐 | P1 | Mock/REST/WS 经 Adapter 对齐；schema 对比方案 | [ ] |
| DATA-04 | 脏数据健壮性 | P1 | 极端值/空数组/超大数/NaN/Infinity 注入方案 | [ ] |
| DATA-05 | 导出一致性 | P1 | 导出数据与界面数据抽样比对 | [ ] |
| DATA-06 | 时区正确性 | P2 | 行情/复盘时间戳统一；跨日切分与排序验证 | [ ] |

### 5.6 监控与运维测试准备

| 编号 | 准备项 | 优先级 | 具体内容 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| MON-01 | 前端监控 | P1 | web-vitals + JS Error / UnhandledRejection 上报验证 | [ ] |
| MON-02 | 业务埋点 | P2 | 选股/复盘/导出/对话等核心事件埋点校验 | [ ] |
| MON-03 | 告警演练 | P1 | 错误率/白屏/接口失败告警注入与触发验证 | [ ] |
| MON-04 | 日志规范 | P2 | 关键路径 `logger.info` + context 输出检查 | [ ] |
| MON-05 | 灰度开关 | P1 | 功能开关 1%→10%→50%→100% 演练方案 | [ ] |
| MON-06 | 降级方案 | P2 | 接口/WS 限流降级到 Mock/缓存 演练方案 | [ ] |

---

## 6. 测试执行命令速查

### 6.1 CI 地基（必须零违规）

```powershell
npm run audit:layers        # → 0 violations, 0 warnings
npm run audit:hardcode      # → 0 告警（含密钥/颜色/锚点）
npm run audit:deadcode      # → 0 死代码
npm run audit:docs          # → 0 drift
npx tsc --noEmit            # → 0 error
```

### 6.2 测试基线（必须全绿）

```powershell
npm run test:clean          # → 0 fail（当前基线 14/14）
npm run test:known          # → 8 个排除文件调试用
npm run test:e2e            # → Playwright 核心路径
npm run test:e2e:visual     # → 视觉回归
npm run coverage            # → 覆盖率报告
```

### 6.3 安全扫描（必须零高危）

```powershell
npm audit                   # → 0 high/critical
# 渗透测试: OWASP ZAP / Burp Suite
# 代码安全: GitHub CodeQL / SonarQube
```

### 6.4 性能基线（必须达标）

```powershell
npm run build               # → 包体积 < budget
npx lighthouseci            # → LCP<2.5s, INP<200ms, CLS<0.1
# 负载测试: k6 / Artillery
```

### 6.5 发布准备

```powershell
npm run audit:routes        # → 全路由可达
npm run lint:colors         # → 颜色令牌 0 告警
npm run verify:tokens       # → 令牌体系合规
```

---

## 7. 状态追踪汇总

| 模块/维度 | P0 项数 | P1 项数 | P2 项数 | 已完成 | 进行中 | 未开始 | 不适用 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 通用准备 | 6 | 12 | 5 | | | | |
| 门户与驾驶舱 | 2 | 3 | 2 | | | | |
| 输入舱 | 2 | 4 | 2 | | | | |
| 分析舱 | 3 | 5 | 2 | | | | |
| 交易舱 | 3 | 3 | 2 | | | | |
| 输出舱 | 1 | 4 | 2 | | | | |
| 指令舱/总控舱 | 1 | 3 | 3 | | | | |
| 系统支撑层 | 2 | 5 | 3 | | | | |
| 功能测试 | 1 | 4 | 0 | | | | |
| 性能测试 | 0 | 4 | 2 | | | | |
| 安全测试 | 2 | 4 | 2 | | | | |
| 兼容性测试 | 0 | 2 | 3 | | | | |
| 数据完整性测试 | 0 | 5 | 1 | | | | |
| 监控与运维测试 | 0 | 4 | 2 | | | | |
| **合计** | **23** | **62** | **33** | | | | |

> 使用说明：在「状态」列手动勾选或替换为 ? / ?? / ? / N/A；所有 P0 项完成后方可进入测试执行阶段。

---

## 8. 关联文档

- [`APP上线前体检清单_v9.html`](./audit-reports/audit/APP上线前体检清单_v9.html) — 78 项上线体检清单
- [`v9-体系化上线测试-todo-list.md`](../explanation/v9-体系化上线测试-todo-list.md) — 体系化上线测试 TODO
- [`production-release-checklist-skill.md`](../explanation/production-release-checklist-skill.md) — 发布检查清单 Skill
- [`v9-目标功能清单.md`](../explanation/v9-目标功能清单.md) — 26 项功能清单
- [`test-catalog.md`](../reference/test-catalog.md) — 测试目录与策略
- [`v9-test-cases.md`](../reference/v9-test-cases.md) — 测试用例清单
- [`system-architecture.md`](../explanation/system-architecture.md) — 系统架构与设计文档
- [`runbook.md`](../explanation/runbook.md) — 运维基线

---

*本文档由 AI 辅助生成，经人工复核后纳入 V9 测试知识体系。随系统迭代持续更新。*
