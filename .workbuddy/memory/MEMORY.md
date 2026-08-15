# FinSightV9 长期项目记忆（节选）

## 数据采集舱 MCP 化改造（腾讯自选股 SKILL 整合）
- 完成态：marketdata:westock MCP Server 已落地（13 Tool + check_health + 2 Resource），westock 置为采集链维度 04/05/08 优先级1；Electron 由 electron/westockHost.ts(main)+preload 承载，渲染进程经 window.westock IPC 委派。
- **关键实现约束（写测试必记）**：`westockServer.ts` handler 解构 `{data}` 后 `toToolResult(data)` 把 data **直接** `JSON.stringify` 进 `content[0].text`，**无 `{data}` 包装层**。解析测试结果时应直接 `JSON.parse(text)`（数组/对象本身），勿假设 `{data:...}`。
- E2E 实测：真实 CLI 可用率 100%(30/30)，质量评分 AFTER=94.0/BEFORE=0.0/评级 A。修复的致命跨平台缺陷：`spawn('npx')` 在 Windows 因 npx.cmd 不存在 ENOENT → 加 `shell:true` 解决（可用率 0%→100%）。
- CLI 必加全局 `--raw`（否则默认 markdown 表格，`parseJson` 必崩）；真实字段：研报评级 `tzpj`、机构嵌 `title【】`、时间 `time`。

## 腾讯新闻模块（平行范式）
- `TencentNewsCliBridge` **不是孤儿**：`tencentNewsServer.ts:18/138/155/171` 真实消费，NewsServer 与 WeStockServer 是平行 MCP Server。**禁止误删**。
- 真实优化项（非阻塞）：抽取 `BaseCliBridge` 供 WestockCliBridge/TencentNewsCliBridge 共用。

## 治理缺口（待对齐）
- AGENTS.md 技能路由表引用 `v9-collection-pipeline-testing`（mandatory）等 L1 物理技能，但本环境 Skill 索引**未安装**（Skill 调用报 "Can not find skill"）。相关门禁（tsc:prod/audit:layers/vitest）暂以手动执行等效替代。

## 门禁真值基线（勿被过时报告误导）
- `tsc:prod` 全量仍含 `src/components/chart/**` 8 处既有未提交错误（与 MCP 整合无关），本任务相关 src/electron 文件 0 错误。
- `audit:registry` 已 173 条全绿（Currency/Percent/OnboardingGuide 已在 atomRegistry 注册）；`AppErrorState` 缺失告警为瞬时/过渡态。
