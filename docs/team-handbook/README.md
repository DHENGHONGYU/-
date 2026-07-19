---
title: TODO-ADD-TITLE
type: reference
domain: project
phase: planning
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "team-handbook directory document index and navigation entry"
tags: [project, guide, list, checklist, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-183
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# FinSightV9 团队体系手册（Team Handbook�?
> 版本基线：以 `AGENTS.md`（架构契约，当前 v1.4.6）为权威真相源�?> 适用对象：新加入的开发者、设计师、产品与架构评审人员�?> 目标：用一�?*统一、层次分�?*的文档，让团队成员在 30 分钟内建立对系统"设计意图 �?架构 �?组件 �?模型 �?竞品"的整体认知，并能在协作中快速定位约束与扩展点�?
---

## 一、为什么需要这份手�?
FinSightV9 是一�?*纯前端、本地优先的个人 A 股投研复盘系�?*（React + TypeScript + Zustand + IndexedDB + Web Worker + MCP）。项目文档分散在 `docs/` �?800+ 文件中，且存在多版本号并存、部分文档与代码漂移的现象�?
本手册把分散�?设计思路、架构、组件规范、模型运行、竞品定�?**收敛到同一目录**，作为团队分享与 onboarding 的单一入口。它不是文档的替代品，而是**导航�?+ 精华萃取**�?
> ⚠️ 文档漂移提示（编写时已核正）
> 1. **Gateway 网关**：`docs/reference/gateway-write-permission-spec.md` 描述�?`dataGateway.execute()` �?*目标架构**，当�?`core/databridge.ts` 仍直�?`import { db }` 写库，尚未收口。手册中相关处已标注"目标/现状"�?> 2. **MCP 规模**：当前为 **15 �?enabled Server**（P0 清理后），非早期文档所述的"20+"�?> 3. **五因�?*：指**板块轮动五因�?*（合成种子，UI �?示例"），与个�?V6 十一层引擎、九维智能评分是**三个不同概念**，请勿混淆�?
---

## 二、文档地图（5 维度 + 索引�?
| 编号 | 文档 | 解决什么问�?| 关键产出 |
|------|------|--------------|----------|
| 00 | `README.md`（本文件�?| 全局导航与术�?| 文档地图、权威基线、约�?|
| 01 | `01-design-philosophy.md` | 我们**为什�?*这样设计 | 设计哲学、宋韵美学、令牌体系、原创思路 |
| 02 | `02-architecture.md` | 系统**怎么�?*、模�?*怎么�?* | 分层规则、数据流、五舱、扩展能�?|
| 03 | `03-ui-components.md` | UI **怎么�?*�?*怎么复用** | 原子设计、Widget 三处注册、颜色门�?|
| 04 | `04-model-runtime.md` | 模型**怎么�?*、数�?*怎么�?* | V6 引擎、采集流水线、Agent/LLM/MCP |
| 05 | `05-competitive-analysis.md` | 我们**凭什�?*差异�?| 竞品矩阵、差异化支柱、能力差�?|

建议阅读顺序�?*00 �?01 �?02 →（前端�?03 / 算法�?04）→ 05**�?
---

## 三、核心术语（速查�?
| 术语 | 含义 |
|------|------|
| **�?/ Cabin** | 五大业务域：`input`(输入) / `analysis`(分析) / `trading`(交易) / `output`(输出) / `command`(总控)�?|
| **Store** | Zustand 状态容器（�?50 个），经 `withBroadcast` �?Tab 广播�?|
| **Envelope（标准信封）** | `{ meta, payload }` 统一写消息，�?`DataBridge.forward()` 路由�?|
| **DataBridge** | 唯一切面入口：校验信�?�?ACL 鉴权 �?审计 �?路由 �?广播�?|
| **Widget** | 驾驶舱可拖拽/可缩放单元，数据收敛�?`MarketData` �?`useMarketData()` 注入�?|
| **Token（设计令牌）** | L1–L6 分层颜色/尺寸变量，UI 颜色必须引用，禁止硬编码�?|
| **MCP** | Model Context Protocol，接入第三方工具/数据的扩展协议层�?5 �?Server）�?|
| **Worker �?* | `V6ScoreTaskScheduler` 管理 �? �?Web Worker，把评分计算移出主线程�?|

---

## 四、协作约定（写给所有人�?
1. **架构�?`AGENTS.md` 为真相源**：修改分层、目录、依赖前先读它；文档与代码冲突时以代�?契约为准，并同步修文档�?2. **四步集成顺序不可�?*：类�?�?Store �?Service/Builder �?UI；每步可独立回滚�?3. **颜色与令�?*：任�?UI 颜色必须走令牌；A �?*红涨绿跌**固定，不随主题变化�?4. **门禁是底�?*：提交前 `lint:colors` / `audit:atomic` / `audit:layers` / `audit:tokens` / `audit:jsdoc` / `audit:complexity` 不得新增违规�?5. **文档同步**：新�?迁移模块后，�?`docs/00-meta/doc-trigger-action-map.md` 同步触发文档（路径移动必须同�?3 处：映射表、TRIGGER_RULES、README）�?
---

## 五、如何扩展这份手�?
- 本目录是**手工萃取的精�?*，不应被自动生成脚本覆盖；如需纳入新维度，新增 `0X-*.md` 并在本表登记�?- 底层细节仍指�?`docs/explanation/`（架构类）、`docs/reference/`（规范类）、`docs/how-to/`（实操类）、`prompts/`（AI 提示词模板）�?- 架构图可视化源文件见 `docs/architecture/architecture-diagrams.html`�?
> 本手册为团队内部资料，所�?AI 输出均标�?仅供参考，非投资建�?�?