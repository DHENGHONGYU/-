---
title: S05 · 上线前全面体检 SOP
type: sop
domain: release
phase: pre-launch
tier: T1
status: active
maintainer: V9 Architecture Team
summary: "2.0.0 正式版上线前 24 步强制体检流程：环境校验→类型双检→核心门禁→Mock清扫→真数测试→RAG幻觉门禁→复杂度不增→契约一致性→文档审计→可信测试→构建验证，附P0/P1/P2分级与6维度综合评分模板。"
tags: [sop, pre-launch, release, quality-gate, real-data, no-mock, checklist]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-005
related_docs:
  - V9-DOC-QA-065   # 质量门禁 09-quality-gates.md
  - V9-DOC-QA-116   # how-to-use-audit-scripts.md
  - V9-DOC-AUTO-67F745  # 上线前全面校验报告 v2.0.0（评分维度参考）
  - V9-DOC-REP-051  # DEPLOYMENT-CHECKLIST（部署专项参考）
referenced_by: [V9-DOC-SOP-006]
change_log:
  - version: v1.0.0
    changes: "Initial version：基于 AGENTS.md v1.6.0 22 步 pre-commit 门禁 + Husky v2 scope-guard，抽象通用上线体检流程，集成真数测试强制条款与 6 维度综合评分模板。"
    date: 2026-08-19
---

# S05 · 上线前全面体检 SOP

> **编号**：S05 · **适用场景**：候选版本（rc / release branch）向正式版本发布前的最后一次全量体检  
> **执行角色**：发布经理 / 架构师 / QA 负责人 · **预计耗时**：30–60 分钟（真数测试部分视网络情况 10–20 分钟）  
> **规范等级**：🟥 强制执行。所有 P0 项（分级表见 §3）必须 BLOCK=0 方可进入 S06 发布部署流程。任何跳步均需经 2 名架构师 + 产品总监共同签字。

---

## 参考文档清单

本文档**引用而非复制**以下成熟文档，避免重复造轮子。遇到对应章节的深度问题请跳转查阅：

| # | 文档 | 本 SOP 引用位置 | 文档版本 |
|---|------|----------------|---------|
| 1 | [质量门禁标准](../09-quality-gates.md) | §2 P0/P1/P2 分级阈值基线 | v2.5.0 |
| 2 | [如何使用质量审计脚本](./how-to/how-to-use-audit-scripts.md) | §2 各审计子步骤的输出解读与命令详解 | v1.2.0 |
| 3 | [测试策略文档](./testing-strategy.md) | §4 真数测试章节，测试分层与框架说明 | v1.2.0 |
| 4 | [上线前全面校验报告 v2.0.0](../reports/上线前全面校验报告-v2.0.0.md) | §3.4 6 维度加权评分模板（维度与权重一致，数值为模板示例） | v1.0.0 |
| 5 | [AGENTS.md v1.6.0 契约](../../../AGENTS.md) | 全程命令与阈值的唯一真相源（§七验证命令 + §十六 Bash 约定） | v1.6.0 |

---

## 一、前置条件（Prerequisites）

> ⚠️ **必须全部满足后再执行 §二 操作步骤**。任一项不满足，直接判定体检失败，返回对应阶段修复后再重做。

| # | 条件 | 验证命令 / 方法 | 通过判定 |
|---|------|---------------|---------|
| PC-1 | 当前分支为 **release/xxx** 或 **rc** 候选分支，已 rebase 到 main 最新，无未提交改动 | `git status --short` → 空输出；`git rev-parse --abbrev-ref HEAD` 匹配 `release/*` 或 `*rc*` | exit 0 + 分支名匹配 |
| PC-2 | Node.js 环境就绪，版本与 `.nvmrc` 一致（≥ 22）、`node_modules/` 完整无缺 | `node -v && cat .nvmrc && npm ls --depth=0 > $null` | 版本号匹配 + npm ls exit 0 |
| PC-3 | **真数数据服务就绪**：Python venv 已激活、AkShare 后端可启动（见 §四 真数测试章节） | `node scripts/run-venv-python.cjs -c "import akshare; print(akshare.__version__)"` | 输出版本号 ≥ 1.12.0 |
| PC-4 | 无 P0 级已知 Issue 处于「开放未修复」状态（Issue tracker 中 Label=`severity:P0` + `state:open` = 0） | 人工核对 Issue tracker 或项目看板 | 计数 = 0 |
| PC-5 | 工作区已备份或已打快照（建议 `git bundle create` / `npm run archive:run`），体检失败可无损回滚 | 确认备份文件存在且大小 > 0 | 人工 + `ls -lh` |
| PC-6 | 团队成员已确认：本次体检为**冻结期**，期间不再接受新的功能 PR，仅允许修复体检发现的 P0 Bug | 会议纪要或群消息确认 | 人工 |

---

## 二、操作步骤（24 步）

> 提示：以下步骤编号对应 Husky pre-commit 22 步 + 发布前额外 2 步（STEP 23/24）。凡标注 **[BLOCK]** 的步骤，非 0 退出码即中止体检并修复；标注 **[WARN]** 的步骤允许有告警但需登记遗留项。

### STEP 1 — 环境路径硬编码守卫 [BLOCK]

```powershell
npm run env:check
```

**作用**：拦截写死 `C:/Users/<用户名>/` 的 Windows 用户目录绝对路径硬编码，防止换电脑或换用户后静默失效。  
**预期输出**：`crossUserHardcode=0` 且 `sameUserHardcode=0`。  
**命令真相源**：`package.json → env:check`（内部调用 `env-path-guard.cjs --ci --staged`，但上线前体检要求**全量扫描**而非仅 staged，建议追加 `--all` 参数手工跑：`node scripts/env-path-guard.cjs --ci`）。

### STEP 2 — 密钥 / 敏感信息 SAST 扫描 [BLOCK]

```powershell
npm run audit:secrets
```

**作用**：全仓扫描 API Key、私钥、Token、AES 密钥等敏感明文。  
**预期输出**：`FOUND LEAKS: 0`。  
**通过标准**：0 处 Critical / 0 处 Major。Warning 级（如常见测试用假 Token）需人工确认非真实密钥后放行。

### STEP 3 — Python venv 健康校验（真数测试前置） [BLOCK]

```powershell
# 双平台统一命令（受管 venv 固化，见 AGENTS.md §十六）
node scripts/run-venv-python.cjs --verify-current
```

**预期输出**：`[venv] OK: interpreter=...\Scripts\python.exe, packages=xxx, akshare=installed`。  
**失败速查**：若报「venv not found」，参见 [S01 §Step 4](./S01-dev-env-setup.md#step-4python-虚拟环境--akshare-安装) 重装。

### STEP 4 — lint-staged / ESLint 全量检查 [BLOCK]

```powershell
npm run lint
```

**说明**：pre-commit 场景跑 `npx lint-staged`（仅 staged），但**上线体检必须全量**。使用 `npm run lint`。  
**预期输出**：`0 errors`，warnings ≤ 2000（当前 `--max-warnings 2000` 基线，目标逐步收敛）。  
**生产域警告约束**（AGENTS.md v1.6.0 强制）：`src/core/`、`src/services/`、`src/store/` 三个子域 **0 warnings**，若三域任一超阈值即 BLOCK。

### STEP 5 — 颜色硬编码门禁 [WARN]

```powershell
npm run lint:colors
```

**作用**：独立 ESLint 配置扫描裸 HEX / RGB 颜色，强制使用 theme 令牌。  
**预期输出**：0 处违规（目标 = 0）。

### STEP 6 — 生产类型检查 tsc:prod [BLOCK]

```powershell
npm run tsc:prod
```

**说明**：仅扫 `tsconfig.prod.json` 范围（源码 + lib，零测试文件），是最严格的类型门禁。  
**幻影错误修复 Tip**：若出现"昨天还能过今天报错"的幻影错误，运行 `tsc -p tsconfig.prod.json --noEmit --force`（AGENTS.md v1.6.0 推荐日常 `tsc --force`）。对应 SKILL：`v9-tsc-gate-scope-audit`。

### STEP 7 — 测试类型检查 tsc:test [WARN]

```powershell
npm run tsc:test
```

**说明**：扫源码 + 测试文件的 `tsconfig.test.json`。仅出告警不阻断，但错误数 > 50 时需登记遗留。  
**预期**：errors ≤ 50（警告模式，见 `.husky/pre-commit` §TS_TEST_COUNT）。

### STEP 8 — 架构分层调用审计 [BLOCK]

```powershell
npm run audit:layers
```

**作用**：校验 §一 AGENTS.md 分层依赖方向规则（pages/components 不得直调 dataLayer 等 14 条）。  
**预期输出**：`Violations: 0`。  
**失败修复**：引用 SKILL `architecture-debt-remediation` 六步修复流程。

### STEP 9 — 原子组件层级边界审计 [BLOCK]

```powershell
npm run audit:atomic
```

**作用**：防止 atoms → organisms → templates 层级反向依赖或越级引入。  
**预期输出**：`Atomic violations: 0`。

### STEP 10 — IndexedDB 数据库定义交叉引用审计 [BLOCK]

```powershell
npm run audit:db-references
```

**作用**：三向对齐 `STORE_NAME` 枚举 ↔ Schema/Migration ↔ `ENVELOPE_ACTION → ACTION_TO_STORE_MAP` ↔ `ACL_MATRIX`。  
**预期输出**：`DB_VERSION=35 / Stores: 53 / Mismatches: 0`（AGENTS.md v1.6.0 契约基线）。  
**失败修复**：SKILL `db-reference-audit`。

### STEP 11 — MCP 架构一致性审计 [WARN]

```powershell
npm run audit:mcp
```

**预期**：Registry 条目数 = 15（10 enabled + 5 disabled），无僵尸 Server、无悬空 Agent。见 AGENTS.md v1.6.0 §技能路由表前置段。

### STEP 12 — 文档规范检查 [WARN]

```powershell
npm run file:check
```

### STEP 13 — 文档门禁（doc:gate） [BLOCK]

```powershell
npm run doc:gate
```

### STEP 14 — 文档同步 + 版本漂移审计 [BLOCK]

```powershell
npm run audit:docs
```

**说明**：内部调用 `audit-doc-sync.ts` + `audit-version-drift.ts`，分别检查文档 ↔ 代码一致性和版本号漂移。

### STEP 15 — doc_id 注册表反向一致性（全量，非 changed-only） [BLOCK]

```powershell
npm run audit:doc-id:fix --dry-run
npm run audit:doc-id-reverse
```

**预期输出**：Blocking = 0（仅允许 missing-file 外的 WARNING）。

### STEP 16 — ACL 权限矩阵一致性 [BLOCK]

```powershell
npm run audit:acl-consistency
```

**作用**：三向对齐 `DataBridge ACL` ↔ `MCP UI ACL` ↔ `RBAC Thresholds`。  
**预期输出**：`ACL Consistency: PASS`。

### STEP 17 — Mock 模块残留清扫 [BLOCK]

```powershell
npm run audit:mock-modules
```

**🟥 上线强制**：生产代码中**禁止**残留 `from 'mock'` / `vi.mock` / `fixtures/` 引用。AGENTS.md v1.6.0 明确「上线前测试禁止 MOCK，必须真数」。  
**预期输出**：`Mock residues in src/: 0`。  
**补充清扫**（额外确认）：

```powershell
# 三维 Grep 确认（来自 v9-mock-data-diagnosis SKILL）
node -e "const fs=require('fs'); const p=require('child_process').execSync('grep -rln \"from.*mock\" src/ || echo none',{encoding:'utf8'}); console.log(p.trim())"
```

### STEP 18 — AGENTS.md 契约 ↔ 真相源一致性（--strict 全量） [BLOCK]

```powershell
npm run audit:agents-consistency:strict
```

**校验 7 项契约断言（A1~A7，AGENTS.md v1.6.0 P0）**：
- A1 Husky 22 步门禁与 pre-commit 文件对齐
- A2 scope-guard v2 规则匹配
- A3 tsc:prod / tsc:test 双 tsconfig 作用域
- A4 MCP Registry 15 条目（10+5）
- A5 DB_VERSION=35 / Stores=53
- A6 USER_SCENES 结果优先视图
- A7 设计令牌 V8 Apple 冷色调

**预期**：A1~A7 全 PASS（=7/7）。

### STEP 19 — 设计令牌映射 + 颜色单一源校验 [BLOCK]

```powershell
npm run verify:tokens
npm run verify:colorSoT
```

**预期**：2 条命令均 exit 0，0 硬编码颜色。

### STEP 20 — 复杂度债务不增扫描 [BLOCK]

```powershell
npm run complexity-scan
```

**规则**：当前 Complexity Score ≤ `.complexity-baseline.json` 基线分数。上升即 BLOCK（需人工说明为何新增复杂度不可避免，并获架构师签字）。  
**失败降级**：若基线已更新并伴随架构师审批邮件，可 WARN 放行。

### STEP 21 — JSDoc + 测试覆盖 + 消费令牌审计 [WARN]

```powershell
npm run audit:jsdoc       # JSDoc 覆盖
npm run audit:tests       # 测试文件/命名规范
npm run audit:tokens      # LLM 令牌消费基线
npm run audit:widget-registry  # Widget 三处注册一致
npm run audit:ai-output   # AI 输出合规三道校验
```

### STEP 22 — RAG 幻觉检测门禁 [BLOCK]

```powershell
npm run test:rag-gate
```

**作用**：Golden Dataset 回归 + 幻觉检测阈值，防止 V6 评分引擎出现无来源编造。  
**预期**：`ragHallucinationRegression` 全通过，Hallucination Rate ≤ 1%。  
**对应 AGENTS Hook 规则**：pre-commit §21 RAG 条件触发门禁，上线体检无论条件均强制全跑。

---

### STEP 23 — 可信单元测试（test:stable，排除 quarantine） [BLOCK]

```powershell
npm run test:stable
```

**说明**：`test:stable` = 全量 vitest 减去 `tests/quarantine.list` 隔离项。Quarantine 内的已知失败（非产品 Bug，如陈旧测试桩导致的确定性失败）已隔离不影响结果。  
**通过率阈值**：≥ **99.6%**（与 上线前全面校验报告 v2.0.0 基线一致）。  
**失败处理**：若失败 < 0.4%，需提交紧急修复 commit 并重跑；不得直接将失败项加入 quarantine（需架构师审批）。

---

### STEP 24 — 生产构建验证 [BLOCK]

```powershell
npm run build
```

**构建通过判定 = 3 条同时满足**：
1. Vite 构建 exit 0，无 ERROR 级日志
2. 产物大小约束：`total JS ≤ 6MB`、`preload JS ≤ 200KB`
3. 关键 chunk 懒加载：`transformers` / `charts` / `pdf` / `excel` 四个大体积模块均为按需加载（构建输出中可见 `lazy chunk` 标记）

---

## 三、通过标准与分级验收

### 3.1 P0 / P1 / P2 分级表（≥ 10 项 P0）

| 等级 | 含义 | 包含步骤 | 处置 |
|:---:|------|---------|------|
| 🔴 **P0 · BLOCK** | 不通过**禁止上线**（本节 ≥ 10 项） | STEP 1(env) · 2(secrets) · 6(tsc:prod) · 8(layers) · 9(atomic) · 10(db) · 13(doc:gate) · 14(docs) · 15(doc-id) · 16(ACL) · 17(Mock残留) · 18(AGENTS契约) · 19(tokens+color) · 20(complexity) · 22(RAG幻觉) · 23(test:stable) · 24(build) = **17 项** | 全部 BLOCK=0 方可进入 §3.3 评分 |
| 🟠 **P1 · WARNING** | 允许上线，但必须在 CHANGELOG 登记遗留项并排期 2 周内修复 | STEP 5(lint:colors) · 7(tsc:test) · 11(mcp) · 12(file:check) · 21(jsdoc/tests/tokens/widget/ai-output) · + P0 中被架构师降级的 WARN 项 | WARN 数 ≤ **5** 项，每项均有 Owner + Due Date |
| 🟡 **P2 · INFO** | 允许上线，排入常规迭代（4~6 周） | Lighthouse 性能分 <80、跨浏览器 Safari/Firefox 未过、IndexedDB 敏感数据未透明加密等长期优化 | INFO 项数不限，列入 Backlog 即可 |

### 3.2 Go/No-Go 决策规则

```
IF P0 任意一项 BLOCK > 0   →  NO-GO（返回修复，重做本 SOP 从 STEP 1 起）
ELSE IF P1 项数 > 5        →  NO-GO（需特批：2 架构师 + 产品总监签字）
ELSE IF 综合评分 < 80      →  NO-GO（评分模板见 §3.4）
ELSE IF 综合评分 80~89     →  CONDITIONAL-GO（需发布经理 + 架构师双审批，遗留项限期 2 周）
ELSE (≥ 90)               →  GO（无条件通过，进入 S06 发布部署）
```

### 3.3 真数测试章节（🟥 FR-5 强制条款：**禁止 MOCK，必须真数**）

> 本节独立于 STEP 1-24，是 AGENTS.md v1.6.0 新增的硬性门槛。与 P0 同等级 BLOCK。

#### 4.A 启动真数环境

```powershell
# 终端 A：启动 AkShare Python 后端（监听 8000，前置：STEP 3 venv 通过）
# 实际命令 = 后台运行以下命令（Windows PowerShell，Linux/mac 用 bash &）
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "scripts/run-venv-python.cjs","-m","uvicorn collect_endpoints:app --host 127.0.0.1 --port 8000 --reload"

# 终端 B：启动 Vite 前端开发服务器（真数模式）
$env:VITE_DATA_SOURCE_TYPE='real'   # PowerShell 设置（macOS: export VITE_DATA_SOURCE_TYPE=real）
npm run dev
```

**端口联动验证**：等待 `VITE_DATA_SOURCE_TYPE=real` 输出后，另开终端跑：

```powershell
# 健康检查（Vite 代理 → /health → AkShare 后端回铃）
Invoke-RestMethod http://127.0.0.1:5173/health
```

**预期**：返回 `{ "status": "ok", "akshare": true }`。

#### 4.B **25+ 股票真数校验清单**（覆盖沪深港美 ETF）

使用 `npm run test:e2e-verify` 官方校验套件（已内置 25 只真实股票清单 + 冗余验证 + V6 评分区分度）：

```powershell
npm run test:e2e-verify
```

**覆盖构成**（可在 `tests/e2e-verify-25stocks.integration.test.ts` 中查看具体代码）：

| 市场分类 | 数量 | 代表性代码（示例） | 采集验证维度 |
|---------|:---:|----------------|------------|
| 沪市主板 | 5 | 600519（贵州茅台）、601318（中国平安）、600036（招商银行）、600900（长江电力）、601899（紫金矿业） | 行情 + K线 + 财务 |
| 深市主板/创业板 | 5 | 000858（五粮液）、000001（平安银行）、300750（宁德时代）、300059（东方财富）、002594（比亚迪） | 行情 + K线 + 板块 |
| 港股通 | 5 | 00700（腾讯）、09988（阿里-W）、03690（美团-W）、01810（小米-W）、09618（京东-SW） | 行情 + K线 |
| 美股中概/蓝筹 | 5 | AAPL、TSLA、MSFT、NVDA、BABA | 行情 + K线 |
| ETF（股票/债券/商品） | 5 | 510300（沪深300ETF）、159915（创业板ETF）、518880（黄金ETF）、511010（国债ETF）、513100（纳指ETF） | 行情 + 净值 |

**通过标准**：三套件（25stocks / redundancy / v6-score-discrimination）通过率 **100%**，且：
- 平均采集延迟 ≤ 5 秒 / 只
- V6 评分区分度：Stock 间标准差 ≥ 8 分（防止「全 60 分」假均匀）

#### 4.C 数据质量断言（BLOCK）

```powershell
npm run validate:dataConsistency   # 数据蓝图 + 持久化三向一致
npm run validate:blueprint         # 数据血缘 Schema 验证
```

#### 4.D 结果判定

```
IF test:e2e-verify 套件 100% 通过 AND 两项 validate exit 0   → BLOCK=0
ELSE                                                           → BLOCK>0，真数数据失败，禁止上线
```

> 🔴 **禁止 MOCK 模式声明**：即使网络中断、AkShare 接口不可用，也**不得**临时切回 `VITE_DATA_SOURCE_TYPE=mock` 完成本 SOP。正确做法是标记体检失败、降级为 CONDITIONAL-GO 并附「真数环境不可用」专项审批（3 签），严禁伪造真数报告。

---

### 3.4 六维度加权综合评分模板

> 维度与权重源自 [上线前全面校验报告 v2.0.0](../reports/上线前全面校验报告-v2.0.0.md) §1.1。每次上线体检时将 **得分** 列填入实际数值。

| 维度 | 权重 | 检查项摘要 | 得分（0-100，填入） | 加权得分 = 权重×得分/100 | 等级（≥90绿/80-89黄/<80红） |
|------|:---:|-----------|:---:|:---:|:---:|
| 1. 文档完整性与一致性 | 15% | audit:docs + doc-id + 版本漂移 | ___ | ___×0.15 = ___ | 🟢/🟡/🔴 |
| 2. 架构合理性与安全性 | 20% | audit:layers + ACL + MCP + 循环依赖 | ___ | ___×0.20 = ___ | 🟢/🟡/🔴 |
| 3. 数据链完整性与安全性 | 20% | DB 引用 + 真数测试(§4) + validate:blueprint | ___ | ___×0.20 = ___ | 🟢/🟡/🔴 |
| 4. UI 组件质量 | 15% | 原子边界 + 颜色令牌 + lint:colors + audit:typography | ___ | ___×0.15 = ___ | 🟢/🟡/🔴 |
| 5. 用户体验（性能） | 15% | 构建耗时 ≤15s、preload JS≤200KB、产物≤6MB、Lighthouse | ___ | ___×0.15 = ___ | 🟢/🟡/🔴 |
| 6. 测试覆盖率与质量 | 15% | test:stable ≥99.6%、RAG 幻觉 ≤1%、E2E XSS 14/14 | ___ | ___×0.15 = ___ | 🟢/🟡/🔴 |
| **综合得分** | **100%** | | | **Σ = ___** | 🟢 ≥90 / 🟡 80-89 / 🔴 <80 |

**示例及格分**（来自历史校验 v2.0.0）：93.35 → 绿（GO）。

---

## 四、常见失败与修复（Top 5 · BLOCK 级）

| # | 失败典型症状 | 根因分类 | 标准修复命令 / 操作 | 对应 SKILL / 文档 |
|---|------------|---------|------------------|------------------|
| 1 | `tsc:prod` 报错全在 `*.test.ts`（错误类型均 TS2305/TS2322） | tsconfig 作用域误配（prod 越权扫测试） | **(1)** 确认 `tsconfig.prod.json` 的 `exclude` 含 `tests/**` + `**/*.test.*`；**(2)** `tsc -p tsconfig.prod.json --noEmit --force` 清幻影错误 | `v9-tsc-gate-scope-audit`（Spec §技能路由表） |
| 2 | `audit:layers` N 条跨层违规（典型：`pages/x.tsx 直调 dataLayer.stocks`） | 新代码绕过 DataBridge 写 | **(1)** `npm run audit:fix-p0` 自动修复常见模式（安全重构辅助）；**(2)** 手动将直调改为 `DataBridge.forward(new StandardEnvelope(action,payload))`；**(3)** 重跑 `npm run audit:layers` 验证 0 | `v9-databridge-migration`（mandatory） |
| 3 | `audit:hardcode` Critical > 0（如行业评分 `?? 0` 静默兜底） | Critical/Major 硬编码未清零 | **(1)** `npm run audit:hardcode` 定位具体 file:line；**(2)** 对 `?? 0 / || [] / '#'裸色` 三类模式改写（显式判断 + 守卫）；**(3)** 重跑确认 Critical=Major=0 | `v9-constant-migration`（常量双份定义类） |
| 4 | `audit:mock-modules` 报告 N 处 Mock 残留（`src/services/scoring/xxx.ts:5` import from mock） | 开发期 mock 忘记切换 | **(1)** Grep 定位 `from ['"]*mock['"]`、`vi.mock`、`fixtures/`；**(2)** 逐一改为真实 `services/fetcher` / `MCP` 通道；**(3)** 重跑确认 0 | `v9-mock-data-diagnosis`（Spec 技能路由表） |
| 5 | RAG 幻觉门禁 FAIL（`hallucinationDetector.test` 幻觉率 >1%） | 新 Prompt 引入编造倾向或 Golden Dataset 过期 | **(1)** `npm run test:rag-all` 跑完整 5 件套（回归+真实LLM+E2E+性能+检测）定位失败模式；**(2)** Prompt 调优或 Golden Set 增补（需经 Senior Reviewer 双审）；**(3)** 重跑 `test:rag-gate` 确认 ≤ 1% | `v6-stock-analysis-model` + `llm-api-key-release-acceptance-report` |

---

## 五、证据与归档

### 5.1 必存证据清单（每项存入 `docs/reports/pre-launch/YYYY-MM-DD_<版本号>/` 目录）

| # | 证据 | 文件命名 | 生成方式 |
|---|------|---------|---------|
| E1 | 24 步体检全过程日志（含时间戳） | `01-gate-full.log` | `npm run audit 2>&1 | Tee-Object 01-gate-full.log` + 手工补充 §真数 章节 |
| E2 | test:stable JUnit / JSON 报告 | `02-test-stable-report.xml/.json` | `vitest run --reporter=junit --outputFile.junit=...` |
| E3 | tsc:prod + tsc:test 原始输出 | `03-tsc-prod.log`、`04-tsc-test.log` | 重定向 2>&1 |
| E4 | 真数 25 股票校验结果（含 HTTP 响应摘要） | `05-realdata-25stocks.json` | `npm run test:e2e-verify -- --reporter=json` 输出 |
| E5 | 六维度综合评分表（§3.4 填写版 + 计算过程） | `06-scorecard.xlsx 或 .md` | 人工填 §3.4 模板后保存 |
| E6 | Go/No-Go 会议纪要（含签字） | `07-go-nogo-minutes.md` | §3.2 决策记录 + 参会人签名 |
| E7 | 版本号 + Git SHA 指纹 | `08-version-fingerprint.txt` | `node -e "console.log(require('./package.json').version);" ; git rev-parse HEAD > 08-version-fingerprint.txt` |
| E8 | 构建产物体积 / 哈希清单 | `09-build-manifest.json` | `npm run build:health`（内部调 `scripts/build-health-report.ts`） |

### 5.2 归档操作

```powershell
# 统一打包归档（使用项目内置归档脚本）
$folder = "docs/reports/pre-launch/$(Get-Date -Format 'yyyy-MM-dd')_v$($(node -e 'console.log(require(\"./package.json\").version)'))"
New-Item -ItemType Directory -Force $folder | Out-Null
Move-Item docs/reports/pre-launch/0[1-8]-* $folder -ErrorAction SilentlyContinue
npm run archive:run   # 增量打包到 archive/
```

---

## 六、关联阶段与跳转

- **前置阶段**：本 SOP 的所有步骤假设已通过 [S04 · 合并前集成测试 SOP](./S04-pre-merge-integration.md)。
- **后续阶段**：本 SOP 结论为 GO / CONDITIONAL-GO 时，进入 [S06 · 版本发布与部署 SOP](./S06-release-deployment.md)。
- **本 SOP 的 §4 真数测试**是独立 BLOCK 级章节，与常规 24 步门禁并行执行时可节省时间（建议分成 2 条终端：终端 1 跑 STEP 1–22；终端 2 跑 §4.A–D；最后汇合跑 STEP 23–24 + §3 评分）。

> **文档兼容性声明**：本文档 v1.0.0 基于 `AGENTS.md` v1.6.0 / code_version `2.0.0-rc.1` 编写。当 AGENTS.md 大版本升级或 code_version 次版本增加时，需按 §FR-5 要求重新评审 §2 STEP 命令、§3.1 分级阈值、§4.B 25 股票清单三处内容。
