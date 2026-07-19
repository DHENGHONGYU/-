---
title: "数据流完整性审计与修复标准工作流"
summary: "覆盖数据采集板块内部数据传递、按钮-数据联动、跨板块数据传递、数据呈现全链路的完整性审计与修复流程。基于 FinSightV9 采集链路 ①-⑦+ACL 修复全流程的 20 条教训提炼，对标业界 WAP 模式与数据质量门禁最佳实践。"
agent_created: true
trigger:
  - 排查按钮点击无响应/功能键不可点击
  - 数据采集链路断裂诊断
  - 板块间数据传递异常
  - KPI/看板数据与实际不一致（假绿灯）
  - 新增 EnvelopeAction 或写入新 store
  - 修改 ACL_MATRIX 或 DataBridge handler
  - Mock 数据切换到真实数据
  - Vite 缓存导致代码更新不生效
  - 数据流完整性审计
  - 采集维度覆盖度验证
---

# 数据流完整性审计与修复标准工作流

> **核心铁律**：数据流的每一个环节——从按钮点击到最终呈现——都必须有可追溯的验证证据。
> 门禁全绿 ≠ 数据正确；KPI 100% ≠ 写入成功。**不验证就不信任。**

---

## 一、问题全景图

数据流完整性问题按链路位置分为 5 层，每层有典型故障模式：

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 服务连通层                                              │
│  ├─ 后端服务未启动 → /health 拒绝连接（78% 控制台错误来源）         │
│  ├─ CORS 预检失败 → GET 请求携带不必要的 Content-Type              │
│  └─ 端口冲突 → dev server 实例叠加，HMR 缓存过期代码               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: 数据形状层                                              │
│  ├─ payload 包装不匹配 → {store,data} vs 扁平记录                  │
│  ├─ Handler 未注册 → action 找不到 handler → fallback 裸 put       │
│  ├─ 关键字段缺失 → symbol 为空导致 InsertStock 拒绝                │
│  └─ ACL 权限遗漏 → module 无 write 权限 → Permission denied       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: 数据接线层                                              │
│  ├─ Mock 数据源未替换 → 采集用 MOCK_STOCK_LIBRARY 而非用户导入      │
│  │   → 专项诊断使用 `mock-data-diagnosis` skill（三维扫描法）           │
│  ├─ 维度覆盖不全 → 8 维配置但仅 2 维实现，6 维 unsupported          │
│  ├─ 假按钮/TODO → UI 存在但 onClick 未接线或返回"未实现"            │
│  └─ Store 纯内存 → 刷新即丢失，持久化链路断裂                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: 状态管理层                                              │
│  ├─ 假绿灯 → KPI 显示 100% 但实际写入失败（recordWrite 未对称调用）  │
│  ├─ taskId 粒度过粗 → 全批次共用 1 个 taskId，无法按股票追溯        │
│  ├─ 锁定过宽 → isClickable 全页锁定，非采集维度按钮也被禁用         │
│  └─ 布尔状态表达不足 → isCollecting(boolean) 无法表达并发维度状态   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: 数据呈现层                                              │
│  ├─ KPI 口径错误 → 统计写入成功率但不检查写入内容                   │
│  ├─ 维度状态不反映真实 → "未就绪"掩盖了"已配置但未执行"             │
│  ├─ 下拉菜单不全 → DataTestPanel 维度下拉只有 2 项（应为 8 项）     │
│  └─ 汇总看板空占位 → 框架在但内容为 TODO/placeholder               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、经验教训（21 条 → 7 类根因）

### A 类：搜索范围不完整（3 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L1 | 不信"声称 N 处"，必须全量 Grep | 报告称 payload 形状问题 2 处，实际 3 处（dataSourceOrchestrator.ts:579 漏报） | 诊断报告模板增加搜索命令 + 命中行数字段 |
| L2 | 搜索范围必须覆盖全文件类型 | 旧路径残留仅在 .tsx 搜索，漏了 .md/.json/.cjs | 扫描范围明确定义：`.tsx .ts .md .json .mjs .cjs .yaml .sh` |
| L3 | Agent 摘要需独立验证 | Agent 声称"29 页崩溃"，隔离 context 实测全部正常（dev server 被压崩的误报） | Trust but verify：Agent 写代码后必须检查实际变更 |

### B 类：生产构建门禁红灯（2 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L4 | tsc --noEmit + tsc:prod 双检 | tsc:prod 报 TS6133 死常量，tsc --noEmit 不报 | pre-commit hook 双检并列 |
| L5 | Vite 缓存导致代码更新不生效 | 改了 5 文件但旧 dev server 仍报"模块未更新" | 多文件改动后必须 `rm -rf node_modules/.vite && npx vite --force` |

### C 类：数据形状与权限一致性（4 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L6 | EnvelopeAction 写入新 store 必须同步更新 ACL_MATRIX | 03-08 维度写入 news/sectorScores/researchLogs 但 fetcher 无 write 权限 → 20 条 ACL 错误 | 新增 action→store 映射时，必须检查 ACL_MATRIX 并补全 |
| L7 | Handler 必须注册到 PutHandler | saveTraceRecord 未注册 → fallback 到裸 put → keyPath 失败 | grep `ENVELOPE_ACTION.xxx` 确认每个 action 都在 handler 注册表 |
| L8 | payload 形状必须与 handler 期望一致 | `{store, data}` 包装被当作完整记录写入 → keyPath 无值 | 统一约定：DataBridge.forward payload 必须是扁平记录 |
| L9 | 关键字段必须有兜底覆盖 | quote.symbol 为空导致 InsertStock 拒绝 | 函数参数 symbol 覆盖 quote.symbol（上游已归一化） |

### D 类：真实数据接线（3 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L10 | Mock 数据源必须替换为真实用户输入 | 采集用 MOCK_STOCK_LIBRARY 而非 intentionPoolStore | resolveDefaultSymbols() 从 useIntentionPoolStore.getState().items 读取 |
| L11 | 维度覆盖必须与配置一致 | 配置 8 维开关但 pipeline 只实现 2 维 | DIMENSION_TO_MODE 全映射 + mock 生成器兜底 |
| L12 | 假按钮必须标记或移除 | MCP fetch_market_data 返回"尚未实现" | 统一用 `disabled + tooltip` 替代可点击但无响应 |

### E 类：状态管理与假绿灯（3 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L13 | recordWrite 必须对称调用 | try 里调 recordWrite(true)，catch 里漏 recordWrite(false) → 假绿灯 | grep 每个 try 对应的 catch 必须有 recordWrite(false) |
| L14 | 并发状态禁止用 boolean | isCollecting(boolean) 无法表达"维度 01 采集中但 02 可操作" | 用 collectingDimensions: string[] 替代 isCollecting: boolean |
| L15 | taskId 必须按股票×维度粒度 | 全批次共用 1 个 taskId → 监控页只有 1 行 | taskId = `{parent}-{symbol}-{dimCode}` |

### F 类：构建与环境（2 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L16 | dev server 端口冲突导致静默失败 | 3000 被占，vite silent fallback 到其他端口 | 启动后必须 curl 验证端口可达 |
| L17 | GET 请求不应携带 Content-Type | fetcherClient GET 带 Content-Type → 触发 CORS 预检 → 预检失败 | GET 请求不设 Content-Type；POST/PUT 才设 |

### G 类：数据呈现口径（4 条）

| # | 教训 | 实证 | 可执行措施 |
|---|---|---|---|
| L18 | KPI 必须反映真实写入结果 | 写入成功率 100% 但实际 trace_records 全失败 | KPI 数据源必须与写入结果同源（qualityMetrics） |
| L19 | 维度状态必须区分"未配置/已配置未执行/执行中/完成" | "未就绪"掩盖了多种状态 | 状态枚举：unconfigured → ready → collecting → completed → error |
| L20 | 汇总看板不能是空占位 | 8 个 Tab 但 2 个是 placeholder | TODO 占位必须标注 `[示例]` 或 `[开发中]` |
| L21 | KPI 假红灯（2026-07-18 深度复测发现） | 任务 361/361 完成但 KPI 显示 0% — `recordCollect()` 从未调用 + 采集完成后 `refreshStats()` 未调用 | 1. runSingleTrace 6 个 return 点加 `recordCollect()`<br>2. `runCollection` 完成后加 `runtime.refreshStats()`<br>3. 教训：qualityMetrics 有两个统计维度（collect + write），必须都调用 |

---

## 三、SKILL 执行流程

### 阶段 1: 服务连通性诊断（10 分钟）

```bash
# 1.1 检查后端服务
curl -s http://localhost:8000/health || echo "FETCHER_DOWN"

# 1.2 检查 dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/

# 1.3 检查 CORS 预检
curl -s -D- -X OPTIONS \
  -H "Origin: http://localhost:3005" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:8000/health

# 1.4 如果服务未启动 → 创建 mock 服务
node temp/mock-fetcher-server.cjs &
```

**检查清单**：
- [ ] /health 返回 200
- [ ] 控制台 0 条 ERR_CONNECTION_REFUSED
- [ ] 顶栏显示"采集正常"（非"采集断连"）
- [ ] GET 请求无 CORS 预检失败

### 阶段 2: 数据形状与权限审计（15 分钟）

```bash
# 2.1 搜索 payload 包装问题
grep -rn '{ store, data }' src/services/data-collector/  # 应 0 结果
grep -rn '{store, data}' src/services/data-collector/    # 应 0 结果

# 2.2 搜索未注册的 action
# 列出所有 ENVELOPE_ACTION.xxx 使用点
grep -rn 'ENVELOPE_ACTION\.' src/services/ | grep -oP 'ENVELOPE_ACTION\.\w+' | sort -u
# 列出所有已注册的 action
grep -n 'ENVELOPE_ACTION\.' src/core/databridgeHandlers.ts | grep -oP 'ENVELOPE_ACTION\.\w+' | sort -u
# 对比差异

# 2.3 搜索 ACL 权限缺口
# 列出 DIMENSION_TO_ACTION 中所有目标 store
grep -A1 'DIMENSION_TO_ACTION' src/services/data-collector/collectionPipeline.ts
# 对比 ACL_MATRIX[MODULE_ID.fetcher].write 列表
grep -A20 'MODULE_ID.fetcher' src/config/dbConfig.ts
```

**检查清单**：
- [ ] 0 处 `{store, data}` 包装残留
- [ ] 每个 ENVELOPE_ACTION.xxx 都在 PutHandler 注册
- [ ] 每个 DIMENSION_TO_ACTION 目标 store 都在 ACL_MATRIX.write 列表
- [ ] writeQuoteToStock 的 symbol 由函数参数覆盖

### 阶段 3: 真实数据接线验证（10 分钟）

```bash
# 3.1 验证 resolveDefaultSymbols 读真实数据源
grep -A5 'function resolveDefaultSymbols' src/store/sevenDimConfigStore.ts
# 应看到 useIntentionPoolStore.getState().items，而非 MOCK_STOCK_LIBRARY

# 3.2 验证维度覆盖
grep -A10 'DIMENSION_TO_MODE' src/services/data-collector/collectionPipeline.ts
# 应有 01-08 全部映射

# 3.3 验证 mock 生成器存在
grep 'generateMock' src/services/data-collector/collectionPipeline.ts
# 应有 chip/news/competitor/index/research 5 个生成器
```

**检查清单**：
- [ ] resolveDefaultSymbols 从 intentionPoolStore 读取
- [ ] DIMENSION_TO_MODE 8 维全映射
- [ ] 03-08 维度有 mock 生成器 + writeMockDimensionData 写入链路
- [ ] runSingleTrace 03-08 分支存在且非 unsupported

### 阶段 4: 状态管理与假绿灯排查（10 分钟）

```bash
# 4.1 搜索 recordWrite 不对称
grep -B5 -A10 'recordWrite' src/services/data-collector/collectionPipeline.ts
# 每个 try{ recordWrite(true) } 必须有 catch{ recordWrite(false) }

# 4.2 搜索布尔状态替代集合
grep 'isCollecting' src/store/sevenDimConfigStore.ts
# 应替换为 collectingDimensions: string[]

# 4.3 验证 taskId 粒度
grep 'taskId' src/services/data-collector/collectionPipeline.ts | head -5
# 应有 `${parentTaskId}-${symbol}-${dimensionCode}` 格式
```

**检查清单**：
- [ ] 每个 recordWrite(true) 都有对应的 recordWrite(false)
- [ ] 并发状态用 string[] 而非 boolean
- [ ] taskId 按股票×维度粒度
- [ ] KPI 数据源与写入结果同源

### 阶段 5: 端到端验证（15 分钟）

```bash
# 5.1 清 Vite 缓存 + 重启
rm -rf node_modules/.vite
npx vite --port 3005 --force

# 5.2 启动 mock 采集服务
node temp/mock-fetcher-server.cjs &

# 5.3 运行 E2E 脚本
node temp/e2e-8dim.cjs

# 5.4 验证编译
npx tsc --noEmit
npm run tsc:prod
```

**验证矩阵**：

| 验证点 | 目标 | 实测方法 |
|---|---|---|
| 控制台错误 | 0 | Playwright console listener |
| fetcher /health 错误 | 0 | 过滤 ERR_CONNECTION_REFUSED |
| trace_records 写入错误 | 0 | 过滤 keyPath |
| symbol 缺失错误 | 0 | 过滤 symbol missing |
| 维度 unsupported 错误 | 0 | 过滤 unsupported |
| ACL 错误 | 0 | 过滤 Permission denied |
| 批量导入 | N 条全有效 | 检查"共 N 条 / 有效 N" |
| 采集成功率 | 100% | KPI 卡片 |
| 写入成功率 | 100% | KPI 卡片 |
| 维度覆盖 | 8/8 列出 | 监控页维度卡片 |

### 阶段 6: 门禁验证（全绿方可交付）

```bash
# 类型检查（双检）
npx tsc --noEmit
npm run tsc:prod

# 分层审计
npm run audit:layers    # 0 violations
npm run audit:atomic    # 0 violations

# 相关单元测试
node ./node_modules/vitest/vitest.mjs run tests/__tests__/sevenDimConfigStore.test.ts

# 全局残留检查
grep -rn 'isCollecting' tests/__tests__/sevenDimConfigStore.test.ts  # 仅初始化和完成断言
grep -rn '{ store, data }' src/services/data-collector/              # 0 结果
grep -rn 'MOCK_STOCK_LIBRARY' src/                                   # 0 结果
```

---

## 四、测试方案（5 大场景 × 22 用例）

### 场景 S1: 按钮状态实时响应（P0，5 用例）

| 用例 | 操作 | 期望 |
|---|---|---|
| S1-1 | 文本为空 → 确认导入按钮 | disabled |
| S1-2 | 填入有效文本 → 确认导入按钮 | enabled |
| S1-3 | 采集启动 → 非采集维度按钮 | enabled（按维度锁定） |
| S1-4 | 采集启动 → 采集维度按钮 | disabled + tooltip |
| S1-5 | 采集完成 → 所有按钮 | enabled |

### 场景 S2: 数据链路完整性（P0，5 用例）

| 用例 | 操作 | 期望 |
|---|---|---|
| S2-1 | 批量导入 5 只 → 检查 intentionPoolStore | items.length === 5 |
| S2-2 | 触发采集 → 检查 collectionRuntimeStore | taskStatuses 非空 |
| S2-3 | 采集完成 → 检查 DataBridge 写入 | 0 错误 |
| S2-4 | 采集完成 → 检查 IndexedDB | trace_records 有数据 |
| S2-5 | 刷新页面 → 检查 store 水合 | loadPersistedTraces 恢复任务 |

### 场景 S3: 异常边界（P0，7 用例）

| 用例 | 操作 | 期望 |
|---|---|---|
| S3-1 | fetcher 服务宕机 → 触发采集 | 降级到 mock，不崩溃 |
| S3-2 | 传入空股票列表 → 触发采集 | 提前 return，不报错 |
| S3-3 | 传入无效股票代码 → 触发采集 | 跳过无效行，继续采集 |
| S3-4 | ACL 权限缺失 → 触发采集 | 错误信息清晰，不假绿灯 |
| S3-5 | DB 写入失败 → 检查 KPI | 写入成功率 < 100% |
| S3-6 | 维度配置为 disabled → 触发采集 | 跳过该维度 |
| S3-7 | 并发触发两次采集 | 第二次被守卫拦截 |

### 场景 S4: 跨板块数据传递（P1，3 用例）

| 用例 | 操作 | 期望 |
|---|---|---|
| S4-1 | 输入舱导入 → 分析舱查看 | 股票池可见 |
| S4-2 | 输入舱采集 → 驾驶舱查看 | 采集状态同步 |
| S4-3 | SPA 导航（不刷新）→ store 保持 | 状态不丢失 |

### 场景 S5: 数据呈现准确性（P1，2 用例）

| 用例 | 操作 | 期望 |
|---|---|---|
| S5-1 | 采集完成 → 监控页 KPI | 成功率/延迟/写入率与实际一致 |
| S5-2 | 采集完成 → 维度卡片 | 8 维全部显示状态（非"未就绪"） |

---

## 五、对标借鉴

### 5.1 Write-Audit-Publish (WAP) 模式

**来源**：MatrixOne Git4Data、LinkedIn (Christopher Gambill)

**核心理念**：Green pipeline can lie — 成功执行 ≠ 数据正确。

**本项目对标**：
| WAP 阶段 | 业界做法 | 本项目现状 | 改进措施 |
|---|---|---|---|
| Write | 数据先写入 staging | 数据直接写 IndexedDB | 增加 staging 校验层 |
| Audit | SQL 断言检查数据质量 | 无质量校验 | 增加 recordWrite 后校验（symbol 非空、字段完整） |
| Publish | 校验通过才合并到生产表 | 无合并步骤 | 增加 publish gate（校验通过才更新 UI KPI） |

**落地建议**：在 `writeQuoteToStock` 和 `writeMockDimensionData` 之后增加 `auditRecord()` 断言：
```typescript
function auditRecord(store: string, record: Record<string, unknown>): void {
  if (store === 'stocks' && !record.symbol) throw new Error('stocks record missing symbol')
  if (store === 'trace_records' && !record.traceId) throw new Error('trace record missing traceId')
}
```

### 5.2 数据质量仪表盘最佳实践

**来源**：Acceldata、IBM Data Integrity Testing、Monte Carlo

**6 维数据质量指标**：
| 指标 | 定义 | 本项目对应 |
|---|---|---|
| Accuracy | 数据值与真实值一致 | 采集的行情数据与实际行情对比 |
| Completeness | 必填字段全部填充 | symbol/name/price 非空率 |
| Consistency | 跨系统/跨表数据一致 | stocks 与 daily_quotes 的 symbol 一致 |
| Timeliness | 数据新鲜度 | 最近采集时间 < 24h |
| Validity | 数据符合格式规则 | stock code 匹配 `[0-9]{6}` |
| Integrity | 引用关系完整 | daily_quotes.stock_id 在 stocks 中存在 |

**改进措施**：在监控页增加"数据质量"Tab，展示 6 维指标的实时分数。

### 5.3 ACL 权限矩阵一致性

**来源**：Frontegg Access Control Matrix、SingleStore Permissions Matrix

**最佳实践**：
1. 权限在 API 层强制，而非仅依赖 UI
2. 权限变更需审计日志
3. 定期审计权限矩阵与实际使用的一致性

**本项目对标**：
- ACL_MATRIX 已在 DataBridge 层强制（AclEngine.assert）
- **缺失**：无"action→store 配对一致性"自动扫描门禁
- **改进**：新增 `audit:acl-consistency` 脚本，扫描所有 `ENVELOPE_ACTION.xxx` 使用点，与 ACL_MATRIX 对比

### 5.4 Flux/React 单向数据流测试

**来源**：Flux 应用测试策略 (CSDN)

**三层测试**：
| 层级 | 测试内容 | 本项目对应 |
|---|---|---|
| Store 单元测试 | Action 响应、状态变化 | sevenDimConfigStore.test.ts |
| 组件集成测试 | View 与 Store 交互 | 缺失（建议补充） |
| 数据流 E2E | 完整用户旅程 | e2e-8dim.cjs |

**改进措施**：补充组件集成测试——渲染七维配置页，模拟点击采集按钮，验证 store 状态变化。

### 5.5 Zustand Store 测试模式

**来源**：Hope's Corner Store Mocking、Zustand Testing Guide

**关键模式**：
1. `beforeEach` 重置 store 到初始状态
2. 外部依赖 store 必须种子化
3. Mock 含初始化逻辑的模块用 `importActual`
4. 测试行为而非实现（不关心 store 内部结构，只关心 action 被调用）

**本项目对标**：
- 已有 `beforeEach` 种子化 intentionPoolStore
- 已有 `importActual` 模式
- **缺失**：组件集成测试层
- **改进**：增加 `sevenDimConfig.integration.test.tsx`，测试"点击采集 → store 变化 → UI 更新"完整链路

### 5.6 Palantir Foundry 管道稳定性

**来源**：Palantir Foundry Stability Recommendations

**最佳实践**：
1. 版本所有变更（PR + code review）
2. 隔离不稳定数据集（validation step）
3. 避免部分运行（要么全跑要么不跑）

**本项目对标**：
- 已有 PR + husky 门禁
- **缺失**：采集维度的 validation step（维度 05-08 未就绪时不应允许"全量采集"）
- **改进**：在 `runCollection` 前增加维度就绪度检查

### 5.7 数据管道 Data Product Mindset

**来源**：Ascend.io Data Pipeline Best Practices

**核心理念**：把数据管道当作产品来设计——先理解用户需求，再构建管道。

**5 个最佳实践**：
1. Adopt a Data Product Mindset
2. Prioritize Data Integrity
3. Implement Data Observability
4. Automate Testing and Validation
5. Document Data Lineage

**本项目对标**：
- Data Product Mindset：用户需要"输入 50 只 → 采集 → 看板展示"完整体验
- Data Integrity：已修复 payload 形状 + ACL 权限
- **缺失**：Data Observability（采集过程的可观测性）
- **改进**：监控页增加"数据新鲜度"指标（最近一次成功采集时间）

---

## 六、关联文档

| 文档 | 路径 | 内容 |
|---|---|---|
| 采集链路诊断报告 | `outputs/reports/2026-07-17-collection-flow-diagnosis.md` | 7 步修复计划 + P0/P1 清单 |
| 全站交互审计报告 | `outputs/reports/2026-07-18-full-site-interaction-audit.md` | 40 页 237 按钮遍历结果 |
| 8 维验证报告 | `outputs/reports/2026-07-18-collect-8dim-validation.md` | ACL 修复 + 端到端验证 |
| 采集链路经验总结 | `outputs/reports/2026-07-18-collection-pipeline-lessons-and-skill.md` | 16 条教训 + SKILL v1 |
| 采集链路测试技能 | `.workbuddy/skills/collection-pipeline-testing/SKILL.md` | ①-⑦ 修复流程 |
| Mock 诊断技能 | `.workbuddy/skills/mock-data-diagnosis/SKILL.md` | 三维 Mock 残留扫描 |
| 架构契约 | `AGENTS.md` | 分层规则 + 四步集成 |
| 项目记忆 | `.workbuddy/memory/2026-07-18.md` | 当日工作记录 |

---

## 七、快速诊断命令速查

```bash
# ── 服务连通 ──
curl -s http://localhost:8000/health                    # fetcher 健康
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/  # dev server

# ── 数据形状 ──
grep -rn '{ store, data }' src/services/data-collector/  # payload 包装残留
grep -rn 'MOCK_STOCK_LIBRARY' src/                       # mock 股票池残留

# ── 权限一致性 ──
grep -A20 'MODULE_ID.fetcher' src/config/dbConfig.ts | grep -c 'STORE_NAME'  # write 权限数
grep 'ENVELOPE_ACTION\.' src/core/databridgeHandlers.ts | grep -oP 'ENVELOPE_ACTION\.\w+' | sort -u  # 已注册 action

# ── 维度覆盖 ──
grep -A10 'DIMENSION_TO_MODE' src/services/data-collector/collectionPipeline.ts  # 应有 01-08
grep 'generateMock' src/services/data-collector/collectionPipeline.ts            # mock 生成器

# ── 假绿灯 ──
grep -B5 -A10 'recordWrite' src/services/data-collector/collectionPipeline.ts    # 对称性检查

# ── 编译门禁 ──
npx tsc --noEmit          # 类型检查
npm run tsc:prod          # 生产构建检查
npm run audit:layers      # 分层审计

# ── Vite 缓存清理 ──
rm -rf node_modules/.vite && npx vite --force
```
