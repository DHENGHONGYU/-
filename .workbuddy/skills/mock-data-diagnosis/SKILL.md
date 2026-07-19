---
skill_id: V9-SKILL-MOCK-DIAG
name: mock-data-diagnosis
description: 对前端/全栈项目做 Mock 数据残留全面诊断：数据传递链路残留、信息孤岛识别、Mock 与真实数据切换兼容性风险。适用场景：项目从开发后期/测试阶段向真实环境过渡前的 Mock 清理审计；数据流健康度检查；Mock→真实切换就绪度评估。输出遗留问题清单、风险等级（P0/P1/P2）及修复优先级建议。
title: Mock 数据残留诊断与数据校对
agent_created: true
trigger:
  - 排查Mock数据残留
  - Mock到真实数据过渡
  - 数据链路Mock残留
  - 信息孤岛诊断
  - Mock与真实数据兼容性
  - 数据检查与校对
  - mock data diagnosis
  - mock audit
  - 数据流健康度
  - Mock→真实切换
covers_docs: [V9-DOC-QA-053, V9-DOC-QA-069, V9-DOC-DATA-038, V9-DOC-DATA-048]
---9-SKILL-MOCK-DIAG
name: mock-data-diagnosis
description: 对前端/全栈项目做 Mock 数据残留全面诊断：数据传递链路残留、信息孤岛识别、Mock 与真实数据切换兼容性风险。适用场景：项目从开发后期/测试阶段向真实环境过渡前的 Mock 清理审计；数据流健康度检查；Mock→真实切换就绪度评估。输出遗留问题清单、风险等级（P0/P1/P2）及修复优先级建议。
title: Mock 数据残留诊断与数据校对
agent_created: true
trigger:
  - 排查Mock数据残留
  - Mock到真实数据过渡
  - 数据链路Mock残留
  - 信息孤岛诊断
  - Mock与真实数据兼容性
  - 数据检查与校对
  - mock data diagnosis
  - mock audit
  - 数据流健康度
  - Mock→真实切换
covers_docs: [V9-DOC-QA-053, V9-DOC-QA-069, docs/archive/doc-auto-updater-diagnosis-and-score.md, V9-DOC-DATA-038, V9-DOC-DATA-048]
---

# Mock 数据残留诊断与数据校对

对含 Mock/Stub/Fixture 体系的前端/全栈项目执行三维全面诊断，输出结构化遗留问题清单、
风险等级（P0/P1/P2）及修复优先级路线图。

## 准入条件

- 项目存在 Mock/Fixture 机制（含 `fixtures/`、`__mocks__/`、`mock*.ts`、Strategy Pattern 默认 Mock 实现等）
- 处于开发后期或向真实环境过渡阶段
- 存在分层架构契约（如 `AGENTS.md`）或明确的数据流约定

## 核心铁律

> **三维互补扫描，单维度会遗漏问题。门禁全绿与 Agent 摘要不可轻信，必须 Grep 实证二次验证。**

两个对称失败：
- **假阴性**：门禁报 0 违规，但 Mock 残留真实存在（门禁盲区）
- **假阳性**：Agent 摘要声称"N 处 Mock 残留"，但 Grep 证实实际干净

**不二次验证就交付 = 不可信。**

---

## 三维诊断流程

### 维度 1：数据传递链路中的 Mock 数据残留（5 种形态）

按以下清单逐项 Grep 扫描，每条给 `file:line` 证据：

#### 1.1 直接引用残留

```bash
# 生产代码（排除 tests/、.test.）是否 import fixtures/ 或 __mocks__/
grep -rn "from.*fixtures" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v "/tests/"

# 是否有独立 __mocks__/ 目录被生产代码引用
grep -rn "from.*__mocks__" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v "/tests/"
```

**风险信号**：Store / Service / Component 直接引用 fixtures 中的数据
**严重级判定**：Store 级引用 → P0；Service 级引用 → P1；Component 级引用 → P2

#### 1.2 初始值污染

```bash
# Store 初始状态是否用 MOCK_* 常量
grep -rn "MOCK_\|mockConfig\|mockState" src/store/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 是否 import *.mock.ts 文件
grep -rn "from.*\.mock" src/store/ src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**风险信号**：用户首次打开界面看到的是 Mock 假配置而非空状态

#### 1.3 默认策略污染（最危险形态）

```bash
# 搜索 "new Mock*" 或 "default.*Mock" 或 策略默认 Mock 实现的模式
grep -rn "new Mock[A-Z]" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 搜索获取策略时的默认 Mock 回退
grep -rn "default.*Mock\|fallback.*Mock\|Mock.*Strategy\|Mock.*Provider" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 检查 Mock 策略对应的 Real 实现是否存在
# 对每个 Mock*Strategy/Mock*Provider，grep 同名 Real* 是否存在且非空桩
grep -rn "class Mock" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**风险信号**：未注入真实策略时静默使用 Mock 策略（最常见于 DI/Provider 模式）
**严重级判定**：真实实现全量空桩 → P0；真实实现部分空桩 → P1

#### 1.4 静默降级

```bash
# 全局回退策略是否允许 Mock
grep -rn "allowMockFallback\|allowMock\|mockFallback" src/config/ src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 搜索环境判断下使用 Mock 的分支
grep -rn "USE_MOCK\|isMock\|\.DEV.*mock\|NODE_ENV.*mock" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**风险信号**：生产环境 API 失败时静默切到假数据，UI 无警告

#### 1.5 持久化污染

```bash
# 搜索 generateMock* 函数被持久化到 DB 的调用
grep -rn "generateMock\|createMock.*Articles\|mockData.*write\|mockData.*persist" src/store/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 搜索非测试代码中写入 Mock 数据到 DB
grep -rn "DataBridge.*mock\|sendWriteEnvelope.*mock\|forward.*mock\|write.*mockData" src/store/ src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**风险信号**：假数据混入持久化存储，后续查询返回混合真假数据

---

### 维度 2：信息孤岛现象识别与诊断（4 种信号）

#### 2.1 平行数据通道

```bash
# 检查是否存在多套数据获取模式并存
# Context 模式 vs Store 模式
grep -rn "createContext\|useContext.*Data\|useMarketData\|useDataSource" src/ --include="*.tsx" | grep -v "\.test\." | grep -v node_modules

# 是否有 MarketDataProvider 和 marketDataStore 两套
grep -rn "MarketDataProvider\|marketDataProvider\|marketDataStore\|useMarketDataStore" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**诊断信号**：同一数据概念有两套完全独立的获取/存储机制
**严重级判定**：数据不互通且使用者 > 10 → P0；数据不互通且使用者 <= 10 → P1

#### 2.2 同名重复模块

```bash
# 在 services/ 下找同名但不同子目录的文件
ls src/services/**/directDataAPI.ts src/services/**/marketData.ts src/services/**/stockAPI.ts 2>/dev/null
ls src/services/**/dataFetcher.ts src/services/**/adapter.ts 2>/dev/null

# 验证多份是否都被引用
for f in $(find src/services -name "directDataAPI.ts" 2>/dev/null); do
  echo "=== $f is imported by: ==="
  grep -r "from.*$(basename $f .ts)" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v node_modules | head -5
done
```

**诊断信号**：同名模块在不同子目录各有一份独立实现
**严重级判定**：两份都被生产引用且逻辑不同 → P0；一份只有测试引用 → P2

#### 2.3 Widget 数据来源声明 ≠ 实际数据流

```bash
# 检查 widgetRegistry 中声明的数据源
grep -rn "dataSource\|defaultDataSource" src/cockpit/core/widgetRegistry.ts | head -20

# 检查 Widget 实际运行时数据的来源
grep -rn "useMarketData\|useDataSource\|taskScheduler" src/cockpit/widgets/ --include="*.tsx" | head -20

# 对比：registry 声明 vs 运行时实际来源
```

**诊断信号**：Registry 声明数据源是常量占位符，实际运行时走完全不同的通道

#### 2.4 Service 绕过 DataBridge 直连 dataLayer

```bash
# 搜索 Service 中直接引用 dataLayer Store（而非经 DataBridge）
grep -rn "from.*dataLayer.*Store\|from.*dataLayerStock\|from.*dataLayerScore" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 搜索直接 import store（services 应只依赖 core/data/lib 白名单）
grep -rn "from '@/data/db\|from '@/data/dataLayer'" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 统计绕过 DataBridge 的 Service 数量
grep -rnl "from.*dataLayer.*Store\|from '@/data/db'" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | wc -l
```

**诊断信号**：Service 绕过 DataBridge ACL + 审计日志，直接操作存储层

---

### 维度 3：Mock 与真实数据切换的兼容性风险

#### 3.1 Mock 类型与规范类型不同步

```bash
# 找出 Mock 数据文件中内联定义的 interface/type（非 import 规范类型）
grep -rn "^interface\|^export interface\|^type.*=" src/services/data-collector/mockDataCollection.ts src/cockpit/data/mockDataProvider.ts src/services/trading/mockDataGenerator.ts 2>/dev/null

# 对比 @/types/ 下的规范类型定义
```

**风险**：真实 API 返回结构与 Mock 结构不同 → 运行时崩溃

#### 3.2 废弃端点/配置残留

```bash
# 搜索 config 中的废弃标记
grep -rn "DEPRECATED\|已废弃\|不可用\|已不可用\|保留占位\|legacy\|不再使用" src/config/ --include="*.ts"

# 搜索 TODO/FIXME/HACK 标记 + mock
grep -rn "TODO.*mock\|FIXME.*mock\|HACK.*mock\|TODO.*fixture\|FIXME.*fixture" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

---

## 修复优先级路线图模板

诊断结束后，按以下模板产出路线图：

### Phase 1 — P0 本周
1. 移除生产代码的 fixtures 直接引用
2. 合并同名重复模块为单实现
3. 关闭全局 allowMockFallback（生产环境）
4. 打通平行数据通道（孤岛 → 单一事实源）

### Phase 2 — P1 本月
1. 实现 Mock 策略对应的 Real 实现
2. DI Provider 移除默认 Mock 赋值
3. 消除 DataBridge 写入旁路
4. Mock 生成 action 加 DEV 守卫

### Phase 3 — P2 下月
1. Mock 数据类型同步到 @/types/ 规范类型
2. 拓展门禁规则覆盖盲区
3. 清理废弃配置/端点
4. 类型重复定义收敛

---

## 与已有技能的边界

| 技能 | 职责 | 与本技能的差异 |
|------|------|---------------|
| `architecture-pollution-review` | 架构契约违规 + 数据污染检测 | 本技能专注 Mock 残留 + 孤岛，不扫 MCP/配置单源 |
| `doc-code-dual-proofreading` | 文档-代码一致性校对 | 本技能关注 Mock 数据 vs 真实数据一致性 |
| `collection-pipeline-testing` | 采集链路测试修复 | 本技能关注链路中是否有 Mock 残留（不测试采集功能） |

---

## 交付物

- `outputs/mock-diagnosis-report-YYYY-MM-DD.html` — 完整诊断报告
  - 遗留问题清单（file:line 证据）
  - 三维度风险等级（P0/P1/P2）
  - 修复优先级路线图
  - 门禁盲区警示
  - 本轮复核纠错记录（假阳性更正）

## 关键坑（必读）

- **不要被 0 violations 骗了** — 门禁扫描范围可能小于契约，先读审计脚本源码
- **Mock 残留最危险的不是"有 Mock"而是"默认启用"** — 关注 DI/Provider 模式的默认策略
- **信息孤岛的标志是"两个"** — 两条数据流、两份同名实现、两套类型定义
- **三维互补** — 单扫一个维度至少漏掉另外两类问题；必须并行三个子智能体
- **Grep 实证是唯一事实源** — Agent 摘要只作线索
- **P0 判定标准** — 是否会导致用户在无感知情况下看到假数据？是 → P0
