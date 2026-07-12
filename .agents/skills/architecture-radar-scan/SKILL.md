---
name: "architecture-radar-scan"
description: "对V9项目进行六层架构无损探测，揪出设计层面的重大遗漏与隐含腐化点，输出架构热力风险图（红/黄/绿）与分级修复方案（P0阻塞/P1严重/P2优化）。复用项目自带的5个审计脚本（audit:layers/hardcode/deadcode/component-usage/docs）与ESLint静态分析，结合人工探查覆盖循环依赖、贫血模型、防腐层缺失、大组件癌变、用例缺失、僵尸代码等12类架构缺陷。Invoke when user asks for architecture health scan, architecture audit, design flaw detection, tech debt assessment, or mentions 架构扫描/架构健康度/架构雷达/腐化点检测/遗漏点排查."
---

# 架构360度雷达扫描 (Architecture 360 Radar Scan) — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-07-02 | **校验基准**: V9 v0.9.18
> **扫描性质**: 只读分析，禁止修改任何代码文件
> **输出格式**: 架构热力风险图 + P0/P1/P2分级遗漏清单 + 具体重构执行路径

---

## 一、触发条件（Invoke When）

- 用户要求对项目进行架构健康度扫描、架构审计、腐化点检测
- 用户提及"架构扫描""架构雷达""架构健康度""遗漏点排查""腐化点检测"
- 版本迭代前需要评估技术债务存量
- 重大重构前需要建立架构基线
- 定期架构巡检（建议每两周一次）

---

## 二、扫描前置：项目架构基线锚定

执行扫描前，必须先读取以下 **5 个真相源文件**，建立架构基线认知：

| 真相源 | 路径 | 锚定内容 |
|--------|------|----------|
| 路由注册表 | `src/config/routes.ts` | 35条路由、RouteCategory类型、白名单机制 |
| 数据总线 | `src/core/databridge.ts` | 唯一合法数据写入通道、三路由分支、ACL权限检查 |
| 全局类型 | `src/data/types.ts` | 全部业务实体定义（Stock/V6Score/Portfolio等约50+类型） |
| 架构说明 | `ARCHITECTURE.md` | 驾驶舱Widget架构、分层设计原则、新增Widget SOP |
| 代码规范 | `eslint.config.js` | no-explicit-any:error、no-magic-numbers:warn、类型安全规则 |

**V9代码架构分层**（扫描参照系）：

```
src/core/        ← 核心工具与类型守卫（DataBridge/ACL/Envelope/MemoryCache/EventBus）
src/data/        ← 数据层（IndexedDB/dataLayer/queryBuilder/types）
src/lib/        ← 库函数（logger/format/errors/utils/localStorageManager）
src/services/    ← 服务层（18个子域：analysis/scoring/fetcher/news/llm/...）
src/store/       ← 状态层（39个Zustand Store + helpers/withBroadcast）
src/pages/       ← 页面层（5舱：input/analysis/trading/output/command）
src/components/  ← 组件层（ui/cabin/chart/pool/news/strategy/...）
src/portal/      ← PortalShell 舱室入口层
src/config/      ← 配置层（routes/thresholds/scoreFactors/...）
src/constants/   ← 常量层（零硬编码锚点）
```

**V6评分引擎分层**（L-1到L8，11层计算器）：

```
src/services/scoring/v6-engine/
├── config.ts          ← 配置层（零硬编码，11层权重，8行业基准）
├── engine.ts          ← 引擎核心（Backtestable + OfflineMode + AuditTrail）
├── types.ts           ← 类型层（LayerId/LayerScore/CompositeScore/AuditEntry）
├── enhancer.ts        ← LLM增强器
├── factorContributions.ts
├── index.ts
└── calculators/       ← 11层计算器
    ├── lMinus1.ts     ← L-1 行业评分
    ├── l0_l1_l2.ts    ← L0 STEEP / L1 护城河 / L2 竞品
    ├── l3.ts          ← L3a 财务健康 / L3b 估值水平
    ├── l4_l5_l6.ts    ← L4 情景推演 / L5 T-M矩阵 / L6 Hype周期
    └── l7_l8.ts       ← L7 第二曲线 / L8 技术筹码
```

---

## 三、扫描流程：六层无损探测

### 总览：12项检测 × 5个自动化脚本

| 检测项 | 层级 | 自动化方式 | 退出码语义 |
|--------|------|-----------|-----------|
| 跨层调用违规 | L3 | `npm run audit:layers` | 1=有违规 |
| 硬编码/魔法数字 | L1/L4 | `npm run audit:hardcode` | 1=有Fatal级 |
| 死代码/路由漂移 | L6 | `npm run audit:deadcode` | 1=路由文件缺失 |
| 组件复用率 | L4 | `npx tsx scripts/audit-component-usage.ts` | 始终0 |
| 文档同步 | L6 | `npm run audit:docs` | 1=有未文档化文件 |
| 循环依赖 | L2 | `npx madge --circular --extensions ts src/` | 1=有循环 |
| 贫血模型 | L1 | 人工Grep + Read | — |
| 伪类型安全 | L1 | Grep `any` / `@ts-ignore` | — |
| 防腐层缺失 | L3 | Grep页面直接import service | — |
| 大组件癌变 | L4 | Grep行数 / useEffect数量 | — |
| 用例缺失 | L5 | 检查useCase目录 | — |
| AI行为约束 | 横向 | 检查.cursorrules/prompts/ | — |

### Step 0：运行自动化审计套件（5分钟）

```powershell
# 并行运行5个审计脚本（互不依赖）
npm run audit:layers    # 分层调用违规
npm run audit:hardcode  # 硬编码与静默回退
npm run audit:deadcode  # 死代码与路由一致性
npx tsx scripts/audit-component-usage.ts  # 组件复用（输出到scripts/component-audit-data.json）
npm run audit:docs      # 代码-文档同步
```

**退出码速查**：
- `audit:layers`：退出码1 = 发现跨层调用违规（violations），退出码0 = 仅有warnings
- `audit:hardcode`：退出码1 = 存在Fatal级（config层硬编码股票代码），Critical超100处仅warn
- `audit:deadcode`：退出码1 = 存在路由文件缺失，退出码0 = 仅有空函数提示
- `audit-component-usage`：始终退出0，结果写入 `scripts/component-audit-report.txt` + `component-audit-data.json`
- `audit:docs`：退出码1 = 存在未文档化的src文件

**已知绿色基线**（v0.9.18快照，供对比）：
- `@ts-ignore` = 0 处（优秀）
- `: any` 生产代码 = 0 处（仅在.test.ts中出现，共14处）
- `axios.get/post` = 0 处（全项目通过DataBridge，符合ADR）
- `audit:layers` = 0违规 / 2警告
- 路由注册 = 35条，全部可加载

### Step 1：L1-领域数据定义扫描

#### 1.1 贫血模型检测

**目标**：检查Interface是否仅包含数据字段，而业务规则散落在Service层。

**扫描路径**：
- 类型三源：`src/data/types.ts`、`src/types/base.types.ts`、`src/types/modules/*.types.ts`、`src/services/scoring/v6-engine/types.ts`
- 业务规则散落检测：对比类型定义与Service层的校验逻辑

**执行命令**：
```powershell
# 检查类型文件中是否包含方法/校验逻辑（充血模型特征）
Select-String -Path "src/data/types.ts","src/types/base.types.ts","src/types/modules/*.types.ts" -Pattern "validate|sanitize|normalize|calculate|compute" -CaseSensitive | Select-Object -First 20

# 检查Service层是否有散落的校验逻辑（金额精度、状态流转）
Select-String -Path "src/services/**/*.ts" -Pattern "validate|isValid|checkStatus|assertValid" -Exclude "*.test.ts" | Select-Object -First 30
```

**判定标准**：
- 🟢 绿色：类型定义中包含校验方法或类型守卫函数（充血模型）
- 🟡 黄色：类型定义仅含数据字段，校验逻辑集中在独立Service且单一来源
- 🔴 红色：校验逻辑散落在多个Service中，无统一入口（贫血模型+逻辑稀释）

#### 1.2 伪类型安全检测

**目标**：搜索 `any` 和 `@ts-ignore`，重点关注公共数据桥梁（Bridge）处。

**执行命令**：
```powershell
# 搜索 any 类型（排除测试文件）
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern ": any\b|as any\b|<any>" -Exclude "*.test.*" | Select-Object Path,LineNumber,Line | Format-Table -AutoSize

# 搜索 @ts-ignore / @ts-expect-error（排除测试文件）
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "@ts-ignore|@ts-expect-error|@ts-nocheck" -Exclude "*.test.*" | Select-Object Path,LineNumber,Line

# 重点关注 DataBridge / dataLayer / store 处的 any（公共数据通道）
Select-String -Path "src/core/databridge.ts","src/data/dataLayer.ts","src/store/*.ts" -Pattern ": any\b|as any\b" | Select-Object Path,LineNumber,Line
```

**判定标准**：
- 🟢 绿色：生产代码 0 处 `any`，0 处 `@ts-ignore`（v0.9.18基线已达标）
- 🟡 黄色：`any` 仅出现在类型迁移过渡期的 `TODO` 标记附近
- 🔴 红色：DataBridge/dataLayer/store 处出现 `any` → 类型系统被凿穿，重大防御漏洞

#### 1.3 数据关系孤儿检测

**目标**：查找一对多/多对多关系，检查删除父级时子级引用是否处理。

**扫描路径**：
- `src/data/types.ts` 中的关系字段（如 `Stock.orders`、`Portfolio.holdings`、`Watchlist.stocks`）
- `src/core/databridge.ts` 中的 `routeToDB()` 删除逻辑
- `src/data/dataLayer.ts` 中的 delete 操作

**执行命令**：
```powershell
# 检查 DataBridge 中删除操作是否有级联处理
Select-String -Path "src/core/databridge.ts" -Pattern "delete|remove|cascade|orphan" -CaseSensitive | Select-Object LineNumber,Line

# 检查 dataLayer 中删除操作
Select-String -Path "src/data/dataLayer.ts" -Pattern "delete|remove|cascade" -CaseSensitive | Select-Object LineNumber,Line
```

**判定标准**：
- 🟢 绿色：删除父级时显式级联删除子级，或有 `brand`/`void` 标记
- 🟡 黄色：删除父级时仅标记子级为 `orphaned`，未实际清理
- 🔴 红色：删除父级后子级数据引用悬空 → 数据完整性风险

### Step 2：L2-功能模块与边界扫描

#### 2.1 循环依赖探测

**目标**：检测模块间循环依赖，特别是 `utils/ → components/`、`modules/A ↔ modules/B`。

**执行命令**：
```powershell
# 方案A：使用项目自带审计脚本（检测分层违规，间接覆盖循环依赖）
npm run audit:layers

# 方案B：使用 madge 临时检测循环依赖（无需安装到依赖）
npx madge --circular --extensions ts src/
```

**判定标准**：
- 🟢 绿色：无循环依赖
- 🟡 黄色：存在 utils → components 的反向依赖（边界模糊）
- 🔴 红色：存在 modules/A ↔ modules/B 循环依赖 → 模块边界崩溃

#### 2.2 上帝模块检测

**目标**：统计单个文件/模块的导出数量，识别"大泥球"。

**执行命令**：
```powershell
# 统计 services 各子域 index.ts 的导出数量
Get-ChildItem -Path "src/services" -Recurse -Filter "index.ts" | ForEach-Object {
    $exports = (Select-String -Path $_.FullName -Pattern "^export " | Measure-Object).Count
    [PSCustomObject]@{ File=$_.FullName.Replace((Get-Location).Path + "\", ""); Exports=$exports }
} | Sort-Object Exports -Descending | Select-Object -First 10 | Format-Table -AutoSize

# 统计 store 文件行数（识别上帝Store）
Get-ChildItem -Path "src/store" -Recurse -Filter "*.ts" -Exclude "*.test.ts" | ForEach-Object {
    $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
    [PSCustomObject]@{ File=$_.Name; Lines=$lines }
} | Sort-Object Lines -Descending | Select-Object -First 10 | Format-Table -AutoSize
```

**判定标准**：
- 🟢 绿色：单个 `index.ts` 导出 ≤ 10 个功能
- 🟡 黄色：导出 11~15 个 → 建议子域拆分
- 🔴 红色：导出 > 15 个 或 Store 文件 > 500 行 → 遗漏子域拆分，正在变为大泥球

### Step 3：L3-数据桥与路由防腐层扫描

#### 3.1 直接裸奔检测

**目标**：检查页面组件是否直接调用 service 或 dataLayer（绕过Store/DataBridge）。

**执行命令**：
```powershell
# 检查页面是否直接 import services（绕过Store）
Select-String -Path "src/pages/**/*.tsx" -Pattern "from.*services" | Select-Object Path,LineNumber,Line | Format-Table -AutoSize

# 检查页面是否直接调用 dataLayer 写操作（audit:layers 的规则1覆盖此项）
npm run audit:layers

# 检查页面是否直接使用 axios（已知基线为0，复查确认）
Select-String -Path "src/pages/**/*.tsx","src/components/**/*.tsx" -Pattern "axios|fetch\(" | Select-Object Path,LineNumber,Line
```

**判定标准**：
- 🟢 绿色：页面通过 Store 间接调用 Service，无直接 import
- 🟡 黄色：页面直接 import Service 但仅用于读取（过渡期允许）
- 🔴 红色：页面直接调用 dataLayer 写操作 或 axios → 遗漏防腐层，API契约变更将击穿UI

#### 3.2 DTO遗漏检测

**目标**：检查后端返回字段是否在前端页面直接使用，未转换为ViewModel。

**执行命令**：
```powershell
# 检查页面中是否直接使用蛇形命名（后端字段风格）
Select-String -Path "src/pages/**/*.tsx" -Pattern "created_at|updated_at|user_id|stock_code|order_id" | Select-Object Path,LineNumber,Line

# 检查是否存在 DTO/ViewModel 转换层
Get-ChildItem -Path "src" -Recurse -Filter "*Mapper*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "src" -Recurse -Filter "*Adapter*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "src" -Recurse -Filter "*ViewModel*" -ErrorAction SilentlyContinue
```

**判定标准**：
- 🟢 绿色：存在 Adapter/Mapper 层，后端字段统一转换
- 🟡 黄色：部分模块有Adapter，部分直接使用后端字段
- 🔴 红色：页面直接使用后端字段名 → 前端逻辑被后端数据结构绑架

#### 3.3 鉴权穿透检测

**目标**：检查路由守卫是否仅判断Token，未同步验证菜单/按钮级权限点。

**执行命令**：
```powershell
# 检查路由守卫实现
Select-String -Path "src/**/*.tsx","src/**/*.ts" -Pattern "RouteGuard|AuthGuard|PermissionGuard|beforeEach|isAuthenticated" -Exclude "*.test.*" | Select-Object Path,LineNumber,Line

# 检查 ACL 实现
Select-String -Path "src/core/acl.ts" -Pattern "assert|check|permission|role" | Select-Object LineNumber,Line

# 检查按钮级权限控制
Select-String -Path "src/components/**/*.tsx","src/pages/**/*.tsx" -Pattern "hasPermission|canAccess|isAuthorized|usePermission" | Select-Object Path,LineNumber,Line
```

**判定标准**：
- 🟢 绿色：路由守卫 + ACL引擎 + 按钮级权限三层防护
- 🟡 黄色：有路由守卫但无按钮级权限控制
- 🔴 红色：仅前端判断Token，无菜单/按钮级权限 → 安全设计遗漏

### Step 4：L4-功能与UI组件关系扫描

#### 4.1 大组件癌变检测

**目标**：找出行数 > 500 行或包含 > 3 个 `useEffect`/`watch` 的组件。

**执行命令**：
```powershell
# 统计组件文件行数（排除测试文件）
Get-ChildItem -Path "src/pages","src/components","src/cockpit" -Recurse -Filter "*.tsx" -Exclude "*.test.*" | ForEach-Object {
    $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
    $effects = (Select-String -Path $_.FullName -Pattern "useEffect\(|watch\(" | Measure-Object).Count
    [PSCustomObject]@{ File=$_.FullName.Replace((Get-Location).Path + "\", ""); Lines=$lines; Effects=$effects }
} | Where-Object { $_.Lines -gt 300 -or $_.Effects -gt 3 } | Sort-Object Lines -Descending | Format-Table -AutoSize

# 使用组件审计脚本获取详细数据
npx tsx scripts/audit-component-usage.ts
# 结果输出到 scripts/component-audit-report.txt 和 component-audit-data.json
```

**判定标准**：
- 🟢 绿色：组件 < 300 行，useEffect ≤ 3
- 🟡 黄色：组件 300~500 行 或 useEffect 4~5 个
- 🔴 红色：组件 > 500 行 或 useEffect > 5 个 → 遗漏容器/展示组件分离

#### 4.2 样式硬耦合检测

**目标**：检查组件是否直接引用全局CSS类名（未通过props传递className）。

**执行命令**：
```powershell
# 检查硬编码Tailwind颜色类（audit:hardcode 的规则3覆盖此项）
npm run audit:hardcode

# 检查组件是否直接使用全局CSS类名而非CSS Module / styled
Select-String -Path "src/components/**/*.tsx","src/pages/**/*.tsx" -Pattern 'className="[^"]*(bg-|text-|border-)[a-z]+-[0-9]' -Exclude "*.test.*" | Select-Object Path,LineNumber,Line | Select-Object -First 20

# 检查是否有 className prop 传递机制
Select-String -Path "src/components/ui/*.tsx" -Pattern "className\?:" | Select-Object Path,LineNumber,Line | Measure-Object
```

**判定标准**：
- 🟢 绿色：颜色值集中在 `src/constants/` 和 `src/config/chartColors.ts`，组件通过props接收className
- 🟡 黄色：部分组件硬编码Tailwind颜色类（audit:hardcode 已检测）
- 🔴 红色：大量组件直接引用全局CSS类名，无className props → 遗漏样式封装边界

### Step 5：L5-应用层编排扫描

#### 5.1 用例缺失检测

**目标**：检查复杂交互是否存在独立的 useCase 文件。

**执行命令**：
```powershell
# 检查是否存在 useCase 目录
Test-Path "src/services/useCase"
Test-Path "src/useCases"
Test-Path "src/domain/useCases"

# 检查复杂交互逻辑是否散落在 onClick 中
Select-String -Path "src/pages/**/*.tsx","src/components/**/*.tsx" -Pattern "onClick.*=.*async|onSubmit.*=.*async" -Exclude "*.test.*" | Select-Object Path,LineNumber,Line | Select-Object -First 20

# 检查是否有 PlaceOrder / SubmitOrder 等用例文件
Get-ChildItem -Path "src" -Recurse -Filter "*PlaceOrder*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "src" -Recurse -Filter "*SubmitOrder*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "src" -Recurse -Filter "*useCase*" -ErrorAction SilentlyContinue
```

**判定标准**：
- 🟢 绿色：复杂交互有独立 useCase 文件，可复用可测试
- 🟡 黄色：复杂交互封装在自定义Hook中（useXxxAction）
- 🔴 红色：复杂交互散落在 onClick 回调中 → 遗漏业务流程显式建模，无法复用和单元测试

#### 5.2 事务边界模糊检测

**目标**：检查乐观更新是否缺少统一的 Rollback 处理。

**执行命令**：
```powershell
# 搜索乐观更新模式
Select-String -Path "src/store/**/*.ts" -Pattern "optimistic|rollback|revert|undo|snapshot" -Exclude "*.test.*" | Select-Object Path,LineNumber,Line

# 检查是否有统一的状态快照机制
Select-String -Path "src/store/**/*.ts" -Pattern "snapshot|prevState|previousState|backup" -Exclude "*.test.*" | Select-Object Path,LineNumber,Line
```

**判定标准**：
- 🟢 绿色：有统一的 Rollback/Snapshot 机制
- 🟡 黄色：部分操作有手动回滚，无统一机制
- 🔴 红色：乐观更新无回滚处理 → 遗漏状态快照机制，操作失败后状态不一致

### Step 6：L6-架构演进与废弃治理扫描

#### 6.1 僵尸代码检测

**目标**：搜索被注释的代码块或导出但无引用的变量。

**执行命令**：
```powershell
# 使用项目自带审计脚本
npm run audit:deadcode

# 搜索被注释的代码块（连续3行以上注释）
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "^\s*//.*[a-zA-Z]" -Exclude "*.test.*" | Group-Object Path | Where-Object { $_.Count -gt 5 } | Select-Object Name,Count | Sort-Object Count -Descending

# 检查导出但无引用的变量（需要结合 audit:deadcode 和 ESLint no-unused-vars）
npm run lint 2>&1 | Select-String "no-unused-vars|never used|is defined but"
```

**判定标准**：
- 🟢 绿色：僵尸代码比例 < 1%
- 🟡 黄色：僵尸代码比例 1%~5%
- 🔴 红色：僵尸代码比例 > 5% → 遗漏清理策略，技术债务利滚利

#### 6.2 依赖漂移检测

**目标**：检查 package.json 中是否存在功能重叠的库。

**执行命令**：
```powershell
# 读取 package.json 并检查功能重叠
$pkg = Get-Content "package.json" | ConvertFrom-Json

# 检查已知重叠组合
Write-Host "=== 状态管理库 ==="
$pkg.dependencies.PSObject.Properties | Where-Object { $_.Name -match "redux|zustand|pinia|recoil|jotai|valtio" } | Format-Table Name,Value

Write-Host "=== 函数工具库 ==="
$pkg.dependencies.PSObject.Properties | Where-Object { $_.Name -match "lodash|ramda|underscore|date-fns|dayjs|moment" } | Format-Table Name,Value

Write-Host "=== HTTP 客户端 ==="
$pkg.dependencies.PSObject.Properties | Where-Object { $_.Name -match "axios|ky|got|node-fetch|wretch" } | Format-Table Name,Value

Write-Host "=== 图表库 ==="
$pkg.dependencies.PSObject.Properties | Where-Object { $_.Name -match "recharts|chart.js|d3|visx|nivo|lightweight-charts|echarts" } | Format-Table Name,Value
```

**判定标准**：
- 🟢 绿色：每个功能领域仅 1 个库
- 🟡 黄色：某领域有 2 个功能重叠库（如 dayjs + date-fns）
- 🔴 红色：某领域有 3+ 个功能重叠库 → 依赖治理遗漏

---

## 四、横向元能力治理检测

### 4.1 AI行为约束检测

**目标**：检查是否存在 AI 编码规范文件。

**执行命令**：
```powershell
Test-Path ".cursorrules"
Test-Path "prompts"
Test-Path ".trae/rules"
Test-Path "AGENTS.md"
Test-Path "CLAUDE.md"
```

**判定标准**：
- 🟢 绿色：存在 `.cursorrules` 或 `prompts/` 或 `AGENTS.md`，含明确编码规范
- 🟡 黄色：仅在 `docs/` 中有零散的编码规范文档
- 🔴 红色：无任何 AI 行为约束文件 → AI 生成代码风格不一致（V9项目当前状态）

### 4.2 类型测试遗漏检测

**目标**：检查是否存在 `__tests__/types` 目录及复杂泛型类型测试。

**执行命令**：
```powershell
# 搜索类型测试目录
Get-ChildItem -Path "src","tests" -Recurse -Directory -Filter "types" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "__tests__" }

# 搜索 Expect<Equals> 类型断言
Select-String -Path "src/**/*.ts","tests/**/*.ts" -Pattern "Expect<Equals|Expect<Equals|ts-expect" | Select-Object Path,LineNumber,Line

# 确认 ts-expect 是否在依赖中
$pkg = Get-Content "package.json" | ConvertFrom-Json
$pkg.devDependencies.PSObject.Properties | Where-Object { $_.Name -match "ts-expect" } | Format-Table Name,Value
```

**判定标准**：
- 🟢 绿色：存在 `__tests__/types/` 目录，含 `Expect<Equals>` 泛型测试，CI流程有类型回归拦截
- 🟡 黄色：有类型测试文件但未纳入CI门禁
- 🔴 红色：无类型测试目录 → CI流程遗漏类型回归拦截

---

## 五、ESLint 静态分析补充

在自动化脚本之外，ESLint 是额外的静态分析维度：

```powershell
# 运行 ESLint 并捕获输出
npm run lint 2>&1 | Tee-Object -Variable lintOutput

# 统计各类规则违规
$lintOutput | Select-String "no-explicit-any|no-magic-numbers|no-unused-vars|eqeqeq|no-console|no-unsafe|strict-boolean|prefer-nullish|prefer-optional" | Group-Object { ($_ -split " ")[-1] } | Sort-Object Count -Descending
```

**ESLint 规则基线**（来自 `eslint.config.js`）：
- `@typescript-eslint/no-explicit-any: error` — 禁止 any
- `@typescript-eslint/no-unused-vars: error` — 禁止未使用变量（`^_` 前缀豁免）
- `no-magic-numbers: warn` — 魔法数字警告（豁免 0/1/2/3/4/5/10/20/50/60/100/1000）
- `eqeqeq: error` — 强制严格等号（null 豁免）
- `no-console: warn` — 仅允许 warn/error
- 类型安全规则（`no-unsafe-*` / `strict-boolean-expressions` / `prefer-nullish-coalescing` 等）均为 `warn`

---

## 六、输出格式：架构热力风险图与分级修复方案

扫描完成后，必须按以下格式输出报告。

### 6.1 架构热力风险图

用三色标记汇总各层各检测项的健康度：

| 层级 | 检测项 | 风险等级 | 发现数 | 代表性文件 | 趋势 |
|------|--------|---------|--------|-----------|------|
| L1 | 贫血模型 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L1 | 伪类型安全 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L1 | 数据关系孤儿 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L2 | 循环依赖 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L2 | 上帝模块 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L3 | 直接裸奔 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L3 | DTO遗漏 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L3 | 鉴权穿透 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L4 | 大组件癌变 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L4 | 样式硬耦合 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L5 | 用例缺失 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L5 | 事务边界模糊 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L6 | 僵尸代码 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| L6 | 依赖漂移 | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ |
| 横向 | AI行为约束 | 🟢/🟡/🔴 | N | — | ↑/→/↓ |
| 横向 | 类型测试遗漏 | 🟢/🟡/🔴 | N | — | ↑/→/↓ |

**图例**：🟢 健康 | 🟡 需关注 | 🔴 风险严重 | 趋势：↑恶化 →持平 ↓改善

### 6.2 分级遗漏清单

#### 🔴 P0 致命遗漏（阻塞发布）

> **格式要求**：列出具体文件路径 + 违反的原则 + 导致的后果

```
[P0-编号] 检测项名称
  - 文件路径: src/xxx/xxx.ts:行号
  - 违反原则: xxx原则
  - 导致后果: 线上数据错乱风险 / 安全漏洞 / 编译失败
  - 修复方向: xxx
```

**P0 判定标准**（满足任一即P0）：
- DataBridge/dataLayer/store 处出现 `any` 或 `@ts-ignore`
- 存在循环依赖导致编译或运行时错误
- 页面直接调用 dataLayer 写操作（audit:layers 违规）
- 路由注册文件缺失（audit:deadcode 退出码1）
- config 层硬编码股票代码（audit:hardcode Fatal级）

#### 🟡 P1 架构债务（近期必须重构）

> **格式要求**：列出具体模块 + 建议的解耦方案

```
[P1-编号] 检测项名称
  - 模块/文件: src/xxx/
  - 当前状态: xxx
  - 建议方案: 引入适配器模式 / 拆分子域 / 提取useCase
  - 影响范围: N个文件
```

**P1 判定标准**（满足任一即P1）：
- 单个 `index.ts` 导出 > 15 个功能
- 组件 > 500 行 或 useEffect > 5 个
- Store 文件 > 500 行
- 页面直接 import Service（绕过Store）
- 复杂交互散落在 onClick 中（无useCase）
- 僵尸代码比例 > 5%
- 无 AI 行为约束文件

#### 🟢 P2 优化空间（中长期演进）

> **格式要求**：列出可选的增强点

```
[P2-编号] 增强点名称
  - 当前状态: xxx
  - 增强方向: 引入 Monorepo / 增加 CI 类型门禁 / 统一 Adapter 层
  - 预期收益: xxx
```

**P2 判定标准**：
- 类型测试未纳入CI门禁
- 部分模块缺少DTO转换层
- 依赖有轻微重叠（2个功能相近库）
- 组件行数 300~500 行
- 文档同步有少量遗漏

### 6.3 重构执行路径

> **格式要求**：给出第一步修复动作的命令或指令，确保修复合集不会导致编译报错

```powershell
# 第一批修复（P0，阻塞性修复，需立即执行）
# 1. 修复 [P0-编号] xxx
#    具体操作: xxx
#    验证命令: npx tsc --noEmit && npm run audit:layers

# 第二批修复（P1，近期重构）
# 2. 修复 [P1-编号] xxx
#    具体操作: xxx
#    验证命令: npx tsc --noEmit && npm test -- --run

# 第三批修复（P2，中长期演进）
# 3. 修复 [P2-编号] xxx
#    具体操作: xxx
```

**执行原则**（来自项目治理规范）：
- **只做审计分析，不修改代码**（审计阶段）
- **审计发现必须包含具体文件路径或行号**
- **分批推进，每批完成后等待用户确认再继续**
- **每批修复后必须运行验证命令**：`npx tsc --noEmit && npm test -- --run && npm run lint`
- **优先级执行顺序**：P1 和 P2 优先于 P0（P0为阻塞项需单独紧急处理，P1/P2按批次推进）

---

## 七、验证命令速查

| 命令 | 用途 | 退出码 |
|------|------|--------|
| `npx tsc --noEmit` | TypeScript 类型检查 | 0=通过 |
| `npm run lint` | ESLint 静态检查 | 0=通过 |
| `npm test -- --run` | Vitest 单元测试 | 0=通过 |
| `npm run build` | 生产构建 | 0=通过 |
| `npm run audit:layers` | 分层调用审计 | 0=无违规 |
| `npm run audit:hardcode` | 硬编码审计 | 0=无Fatal级 |
| `npm run audit:deadcode` | 死代码审计 | 0=无路由缺失 |
| `npm run audit:docs` | 文档同步审计 | 0=全部文档化 |
| `npx tsx scripts/audit-component-usage.ts` | 组件复用审计 | 始终0 |
| `npx madge --circular --extensions ts src/` | 循环依赖检测 | 0=无循环 |
| `npm run audit` | 上述前4项串联 | 全通过=0 |

---

## 八、红线清单（扫描过程禁止事项）

1. **禁止修改任何代码文件** — 扫描为只读操作
2. **禁止跳过自动化脚本** — 必须先运行5个审计脚本建立数据基线
3. **禁止输出无文件路径的发现** — 每个发现必须含 `path:line`
4. **禁止将P2建议混入P0清单** — 分级必须严格
5. **禁止在未运行 `tsc --noEmit` 的情况下给出重构命令** — 确保不引入编译错误
6. **禁止忽略项目已有审计脚本** — 优先复用 `audit:*` 系列脚本，不重复造轮子
7. **禁止一次性输出所有批次** — 分批推进，等待用户确认

---

## 九、已知绿色基线（v0.9.18 快照）

以下指标在 v0.9.18 版本已达标，扫描时作为对比基准：

| 指标 | 基线值 | 状态 | 对应检测项 |
|------|--------|------|-----------|
| `@ts-ignore` 数量 | 0 | 🟢 | L1.2 伪类型安全 |
| `: any` 生产代码数量 | 0 | 🟢 | L1.2 伪类型安全 |
| `axios.get/post` 数量 | 0 | 🟢 | L3.1 直接裸奔 |
| `audit:layers` 违规数 | 0（2 warnings） | 🟢 | L3.1 直接裸奔 |
| 路由注册数 | 35 | 🟢 | L6.1 路由一致性 |
| 单元测试数 | 291+ | 🟢 | 质量基线 |
| E2E 测试 | 5/5 通过 | 🟢 | 质量基线 |
| Zustand Store 数 | 39 | — | L2.2 参考数据 |
| ts-expect 依赖 | 已安装 | 🟢 | 横向 类型测试 |

**已知黄色/红色项**（扫描时重点关注）：

| 指标 | 当前状态 | 对应检测项 | 预期等级 |
|------|---------|-----------|---------|
| `.cursorrules` / `prompts/` | 不存在 | 横向 AI行为约束 | 🔴 |
| `useCase` 目录 | 不存在 | L5.1 用例缺失 | 🔴/🟡 |
| 页面直接 import Service | 8个页面 | L3.1 直接裸奔 | 🟡 |
| `audit:hardcode` Critical | ~389处 | L1/L4 硬编码 | 🟡 |
| `audit:deadcode` 提示 | ~11处 | L6.1 僵尸代码 | 🟡 |
| `__tests__/types` 目录 | 仅在 tests/ 下 | 横向 类型测试 | 🟡 |

---

## 十、与已有SKILL的协同关系

| 已有SKILL | 协同点 |
|-----------|--------|
| `type-safety-contract` | L1.2伪类型安全检测发现类型修改需求时，转交此SKILL执行6步安全契约 |
| `v6-stock-analysis-model` | L1领域数据定义检测时，参照此SKILL的L-1到L8类型规格 |
| `sector-analysis-framework` | L2模块边界检测时，参照板块分析服务的模块划分 |
| `valuation-financial-analysis` | L5用例检测时，参照估值计算的编排流程 |

---

## 十一、使用示例

```
用户: 对项目做一次架构健康度扫描
AI: [调用 architecture-radar-scan SKILL]
    [执行 Step 0: 运行5个审计脚本]
    [执行 Step 1-6: 六层扫描]
    [执行 横向检测]
    [输出 架构热力风险图]
    [输出 P0/P1/P2 分级遗漏清单]
    [输出 重构执行路径]
```

```
用户: 检查一下有没有架构腐化点
AI: [调用 architecture-radar-scan SKILL]
    [重点执行 L2循环依赖 + L3防腐层 + L6僵尸代码]
    [输出针对性报告]
```

---

## 十二、版本记录

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-02 | 初始版本：六层无损探测 + 5个审计脚本集成 + 12项检测 + P0/P1/P2分级体系 + 已知绿色基线锚定 |
