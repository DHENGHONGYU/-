---
skill_id: V9-SKILL-COLLECTION-PIPE
name: "collection-pipeline-testing"
description: "数据采集管线（data-collector）端到端测试与门禁。Invoke when 改动 src/services/data-collector/**、src/store/sevenDimConfigStore.ts、src/types/modules/collection.types.ts，或相关 vitest 失败；用于验证采集主链路（多源编排、MCP 源接入、CLI 桥接、降级与计分）在类型安全、层合规与真实取数层面的完整性。上线前测试必须跑本技能（禁止 MOCK）。"
version: v1.0.5
last_updated: 2026-08-23
change_log:
  - version: v1.0.5
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 5 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.4
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.3 / 正文 v1.0.2) → 取真值 max=1.0.3 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 3 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-16
mandatory: true
---

# 数据采集管线测试技能 (Collection Pipeline Testing) — v1.0.5

> **版本**: v1.0.5 | **日期**: 2026-08-21 | **校验基准**: V9 v2.0.0-rc.1 + sevenDimConfigStore 七维配置基线
> **性质**: 质量门禁（mandatory），改动采集链路前/后必须跑通；上线前测试禁止 MOCK，必须真实取数
> **输出格式**: 门禁退出码 + 采集质量报告（含 MCP 穿透链路可用率、CLI 真实取数可用率）

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求验证采集链路完整性（七维配置改动后、实采数据源新增/调整后、MCP 源接入后），或上线前真实取数门禁（禁止 MOCK）
- **显式触发 2**：怀疑 MCP 返回解析多加了一层 `{data}` 包装、CLI 默认未追加 `--raw` 导致 parseJson 崩、Windows `spawn('npx')` 未加 `shell:true`（仅 E2E 实测能暴露）、ACL 角色配置错误导致 UI 层拒读
- **脚本/审计触发 3**：相关 vitest 失败（尤其 `e2eWestockQuality.test.ts` / `e2eWestockMcpChain.test.ts` / `westockMcpSource.test.ts`）；或 `npm run collection-pipeline:prod` / `data-collector:dry-run` 门禁 FAIL
- **脚本/审计触发 4**：`npm run tsc:prod` 在采集域报出类型错误、或 `npm run audit:layers` 报 data-collector 相关跨层违规；MCP 接入变更导致 ACL 矩阵失配
- **设计/协议触发 5**：新增/调整任何实采数据源（含 MCP Server 接入，如 `marketdata:westock`）、或调整 `SourcePriorityManager` / `QualityMetricsCollector` / `DegradationScorer` 参数与降级阈值；采集域模块评审强制过 E2E 门禁

**不触发场景 · 减少误激活**：
- 不涉及采集链路的纯前端 UI 改动（不碰 src/services/data-collector / sevenDimConfigStore / collection.types）；
- 纯文档修改、纯 README 文案更新。

**协作 Skill / 链式调用**：
- 采集域配置变更→`collection-pipeline-governance`（七维配置安全修改、降级阈值与计分策略调整、月度 API 预算评估）；
- 数据流兜底审计→`v9-data-flow-integrity-audit`（采集→分析→筛选→复盘→报告五段持久化兜底）；
- 十域同步校对→`v9-module-sync-checklist`（新增 MCP Server/注册表变更时，类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆十域与代码同批落地）；
- DB 引用一致性→`db-reference-audit`（涉及 STORE_NAME / ENVELOPE_ACTION 变动时后验）。

---

## 二、前置检查

> **铁律（mandatory 红线）**：① 上线前测试禁止使用 MOCK 数据，必须真实取数跑通（可用率 ≥ 95%）；② 采集链路涉及 MCP 源时，`e2eWestockMcpChain.test.ts` 必须全绿（穿透 mcpBridge.callTool → MCPClientImpl → MCPServerBase → handler → WestockCliBridge 完整链路 4 个确定性用例）；③ `npm ci` 后不得用 `npm install` 回退（防止依赖漂移导致 E2E 行为不一致）；④ 禁止跳过 `tsc:prod` 与 `audit:layers`（哪怕单元测试全绿，这两项 FAIL 仍视为整体 FAIL）；⑤ 每次测试前先保存"变更前基线"快照，FAIL 时需与基线对比，禁止把历史残差计入本次；⑥ Windows 环境下 `spawn('npx')` 必须 `shell:true`（npx 仅提供 npx.cmd，未设置将 ENOENT）；⑦ 腾讯自选股 CLI 默认吐 Markdown 表格，必须追加全局 `--raw` 参数，否则 `parseJson` 必崩→源永远降级。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 依赖完整性与版本锁定 | `npm ci`（禁止 `npm install`）；`npm ls --depth=0 2>&1 \| grep -E '(WARN\|ERR\|unmet)'` 应为空 | 依赖树干净；package-lock.json 不产生 diff |
| 2 | 采集链路真相源路径确认 | `Test-Path src/services/data-collector/**`；`Test-Path src/store/sevenDimConfigStore.ts`；`Test-Path src/types/modules/collection.types.ts`；Grep `sevenDimConfig` 于 `scripts/audit/*` | 4 条路径全存在；相关审计脚本引用正确 |
| 3 | MCP Server 与 ACL 真相源 | 读 `.trae/mcp.json`（若启用 marketdata:westock）；Grep `mcpAclMatrix` + `westock_` 于 `src/core/mcpAclInterceptor.ts` | MCP 路径正确；ACL 放行规则已登（system 角色整链放行、UI 角色 westock_* 只读） |
| 4 | 测试基线保存（tsc/audit/test） | `git status --short > outputs/collection-test-before.txt`；记录 `npx tsc --noEmit` 既有错误数；记录 `npm run audit:layers` 现状 | 有变更前快照；历史残差不混入本次判定 |
| 5 | 真实取数环境可用性（如跑 live） | 检查网络连通：`Test-NetConnection -ComputerName xg.10jqka.com.cn -Port 80`（自选股接口）；检查 `$env:WESTOCK_LIVE_E2E` 是否设置 | 接口可达 200；若需 live E2E，环境变量已设置 |
| 6 | CLI 桥接参数核对（致命项） | 检查 `src/services/data-collector/adapters/westockCliBridge.ts`：① CLI 参数是否含 `--raw`；② Windows `spawn('npx', ...)` 是否带 `shell:true` | 2 项同时满足，否则 MCP 穿透→CLI 端到端必降级 |
| 7 | MCP 返回格式核对（致命项） | 检查 `src/services/data-collector/sources/westockMcpSource.ts` 解析逻辑：`toToolResult(data)` 直接 `JSON.stringify(data)` 进 `content[0].text`，解析端应直接 `JSON.parse(text)`，勿假设 `{data:...}` 包装层 | 解析无多余包装层假设，否则字段读空→降级 |

---

## 三、阶段化 SOP

按 5 个 Phase 顺序执行，Phase 1-2 为基础门禁（每次必过），Phase 3 为单元测试，Phase 4 为 MCP 穿透回归（涉及 MCP 源时必跑），Phase 5 为真实 CLI 端到端（上线前必跑）。禁止跨越 Phase 直接跑 4/5。

### **目标**：`tsc:prod` 0 错误 + `audit:layers` 0 违规 + 相关 vitest PASS；MCP 穿透链路 4/4 passed；真实 CLI 可用率 ≥ 95%（live E2E 开启时）。

### Phase 1 · 类型安全门禁（全量 + 生产子集双保险）

**交付物**: tsc 0 错误报告

```powershell
# 全量类型检查（发现所有编译期问题）
npx tsc --noEmit

# 生产子集类型门禁（与 AGENTS.md 路由表对齐；注意：全量仍可能含 src/components/chart/** 既有未提交错误，与本链路无关时记录基线）
npm run tsc:prod
```

**判定规则**：`tsc:prod` 必须 0 错误才算 PASS；`tsc --noEmit` 如果存在历史错误，需逐条与变更前基线对比，确认"本次未新增"。

### Phase 2 · 跨层调用合规审计

**交付物**: audit:layers 0 违规报告

```powershell
npm run audit:layers
```

**判定规则**：采集链路（data-collector / sevenDimConfigStore）不得出现 `store/components → dataLayer/db` 裸直接访问；写操作必须过 DataBridge 信封（参照 `databridge-migration`）。任何违规 = FAIL。

### Phase 3 · 采集链路单元测试（每次必跑）

**交付物**: vitest 采集域 PASS 报告

```powershell
node node_modules/vitest/vitest.mjs run src/services/data-collector
```

**目标与检查**：
1. **源适配器单元**：`westockMcpSource.test.ts` 等全部通过；降级逻辑（MCP 不可用→CLI 回退）行为符合预期。
2. **质量与计分**：`QualityMetricsCollector` / `DegradationScorer` 单测验证阈值、计分单调性。
3. **多源编排**：`SourcePriorityManager` 优先级与 fallback 链符合配置。

### Phase 4 · MCP 穿透链路 E2E（涉及 MCP 源时必跑）

**交付物**: 4 passed / 1 skipped 穿透报告（含 ACL 放行 + 字段透传 + CLI 失败降级 4 个确定性用例）

```powershell
# 单跑穿透全链 E2E（默认 4 passed / 1 skipped：mcpBridge.callTool → MCPClientImpl → MCPServerBase → handler → WestockCliBridge 完整链路）
node node_modules/vitest/vitest.mjs run src/services/data-collector/e2eWestockMcpChain.test.ts
```

**关键验证点**：
- **ACL 双层放行**：`caller:'system'` 整链放行；UI 角色经 `mcpAclMatrix` 仅 `westock_*` 只读。
- **字段透传**：payload 字段从 MCP tool → CLI 参数无遗漏、无错位。
- **CLI 失败降级**：模拟 CLI 不可用时，降级路径正确触发且可观测（quality 得分降、source 标记 fallback）。

### Phase 5 · 真实 CLI 端到端（上线前必跑，禁止 MOCK）

**交付物**: 真实取数报告（可用率 ≥ 95%）

```powershell
# 开启真实 CLI 端到端（需网络 + 腾讯自选股 CLI；默认 skip；手动开启）
$env:WESTOCK_LIVE_E2E="1"; node node_modules/vitest/vitest.mjs run src/services/data-collector/e2eWestockQuality.test.ts
```

**强制约束**（项目 memory 硬约束）：
- 上线前测试 **必须** 设置 `WESTOCK_LIVE_E2E=1` 跑真实数据；MOCK 测试视为"未验证"，不允许提交发布。
- 可用率 ≥ 95% = PASS；< 95% 必须定位根因（CLI 参数缺 `--raw` / `shell:true` / 接口超时 / 字段变更），不得带病上线。

---

## 四、陷阱与经验教训

| # | 陷阱 / 反模式 | 后果 | 规避方法 |
|---|-------------|------|---------|
| 1 | `toToolResult(data)` 解析假设存在 `{data}` 包装层 | MCP 返回全部字段读空→源永远降级→七维配置无数据→下游板块/个股分析全空 | 解析端 `JSON.parse(text)` 直接取，不加 `.data`；单测断言"返回结构不含 data 包装" |
| 2 | 腾讯自选股 CLI 未加 `--raw` | 默认吐 Markdown 表格，`parseJson` 必崩 | 适配器参数硬编码追加 `--raw`；在 Phase 2 前置检查第 6 项表格化核对 |
| 3 | Windows `spawn('npx')` 未设 `shell:true` | `ENOENT` 直接抛错，CLI 桥接整条不可用（仅 E2E 实测能暴露，单测 mock 不到） | spawn 选项硬编码 `{ shell: true }`（Windows 下 npx 实际是 npx.cmd） |
| 4 | MCP ACL 角色错配（UI 发号但未授权） | ACL 拒读→MCP 调用 `ACL_PERMISSION_DENIED`→静默降级→质量分骤降 | 新增 `westock_*` tool 时同步更新 `mcpAclMatrix`；Phase 4 E2E 含 ACL 用例 |
| 5 | 用 `npm install` 替代 `npm ci`（尤其 CI/CD） | 依赖漂移导致 E2E 行为与本地不一致（vitest/tsx 版本差会导致透传路径变） | 所有脚本/CI 强制 `npm ci`；红线清单声明禁止 `npm install` |
| 6 | 跳过 Phase 1/2 直接跑 E2E | tsc/audit 失败时 E2E 的异常不是真实采集问题，浪费排查时间 | 严格按 Phase 1→2→3→4→5 顺序；Phase 失败立即终止并回滚 |
| 7 | MOCK 测试冒充"上线前已验证"（违反 memory 硬约束） | 上线后真实接口格式变更/超时/限流直接打爆生产 | 发布门禁必须检查 `WESTOCK_LIVE_E2E=1` 的真实取数报告（≥ 95%），无报告 = 不发布 |
| 8 | 未保存"变更前基线"就改代码 | tsc/audit FAIL 时无法判断是本次引入还是历史残差，反复来回拉锯 | 每次 Phase 0 先 `git status --short` + 既有错误数快照（前置检查 4 项） |

---

## 五、完成交付物清单

| # | 交付物 | 对应 Phase / 来源 | 验证方法 |
|---|--------|------------------|---------|
| 1 | `npm ci` 依赖完整性报告 | 前置检查 1 | `npm ls --depth=0` 无 WARN/ERR/unmet |
| 2 | `tsc --noEmit` 全量类型检查记录 | Phase 1 | 0 错误 或 与基线对比"本次 0 新增错误" |
| 3 | `npm run tsc:prod` 生产子集 PASS | Phase 1 | exit 0，无 TS 错误输出 |
| 4 | `npm run audit:layers` 0 违规报告 | Phase 2 | exit 0，无 store/components → dataLayer 违规 |
| 5 | `vitest run src/services/data-collector` 单元测试报告 | Phase 3 | 所有采集域单测 PASS；无 FAIL/skip 非预期 |
| 6 | MCP 穿透链路 E2E 报告（4 passed） | Phase 4（涉及 MCP 时） | `e2eWestockMcpChain.test.ts` 4/4 passed，ACL+字段+降级 3 类用例全绿 |
| 7 | 真实 CLI 端到端 Live E2E 报告 | Phase 5（上线前必跑） | `WESTOCK_LIVE_E2E=1` 开启；可用率 ≥ 95%；真实数据样例落盘 |
| 8 | 采集质量得分与降级趋势快照 | Phase 3-5 汇总 | `QualityMetricsCollector` 输出的各源质量分、降级次数可追溯 |
| 9 | 变更前 → 变更后 git diff 对比表 | 前置检查 4 + 所有 Phase | `git diff --stat` 变更范围符合预期，无越权跨目录修改 |
| 10 | 七维配置（若涉及）回归检查清单 | Phase 1-5 + collection-pipeline-governance 协同 | 启用/停用维度、频率、模板配置未误改；月度 API 预算阈值未漂移 |
| 11 | 十域同步校对（若涉及注册表变更） | v9-module-sync-checklist 协同 | 类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆 十域与代码同批落地 |
| 12 | 修复/新增 Handler 四位置同步（若涉及写操作） | databridge-migration 协同 | ENVELOPE_ACTION 定义 + Handler 实现 + Registry 注册 + ACTION_TO_STORE_MAP 映射 4/4 对齐 |
| 13 | DB 引用一致性（若涉及 STORE_NAME/ENVELOPE_ACTION） | db-reference-audit 协同 | STORE_NAME ↔ Schema/Migration 对齐，ACL_MATRIX 合法 |
| 14 | 门禁合并结论 PASS/FAIL + 阻断原因 | 所有 Phase 综合 | 全绿 = PASS；任一 FAIL = 阻断，附具体 path:line + 修复建议 |

**必要且充分条件**：
- 必要条件：上述 1-5（基础门禁）+ 6（涉及 MCP 时）+ 7（上线前时）至少全部满足；
- 充分条件：1-14 项全 PASS，且本次修改未引入新的类型错误、跨层违规与 E2E FAIL，且与变更前基线对比"无新增红/黄项"。

> 缺任意必要条件 → 禁止声称"采集链路已验证"。
