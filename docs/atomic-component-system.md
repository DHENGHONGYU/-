# V9 原子组件构成体系（Atomic Design System）

> **版本**：v1.0.0  
> **日期**：2026-07-10  
> **状态**：阶段 1（体系建立）+ 阶段 2（ui/ 物理迁移）+ 阶段 3（业务目录有机体化，步骤 0–3）已完成并验证；`chart/`、`cockpit/cabin/widgets` 仅 registry 标注  
> **适用范围**：`src/components/` 全量组件

---

## 一、设计目标

1. **最小可复用单元清晰**：每个组件都有唯一的原子层级归属，避免「放哪里都行」的随意性。
2. **组合关系可预测**：上层组件只能由相邻下层组件组合，禁止跨层级跳跃。
3. **职责边界单一**：原子无业务逻辑、分子无领域状态、有机体可接入 Store、模板只负责布局。
4. **与成熟 APP 开发体系对齐**：参考 Atomic Design（Brad Frost）、shadcn/ui 化合物件、Ant Design 分层组件库。
5. **可自动化审查**：通过目录约定 + registry，脚本可校验组件层级与导入方向。

---

## 二、原子层级定义

| 层级 | 英文名 | 定义 | 是否可含业务逻辑 | 是否可依赖 Store | 典型示例 |
|------|--------|------|------------------|------------------|----------|
| **Atom 原子** | Atom | 不可再分的最小 UI 单元，通常对应一个 HTML 元素或单一视觉标记 | ❌ 否 | ❌ 否 | Button、Input、Badge、Label、Progress、Card、Separator、Skeleton |
| **Molecule 分子** | Molecule | 2+ 原子组合，形成通用交互单元，仍与业务无关 | ❌ 否 | ❌ 否 | Alert、Dialog、DataState、FormField、MetricCard、Tabs |
| **Organism 有机体** | Organism | 面向业务领域的复合组件，可含局部状态、可调用 Hook/Service | ✅ 可含局部 | ✅ 可依赖 | PoolBoard、CollectionProgressPanel、NewsFilterPanel、RiskControlPanel |
| **Template 模板** | Template | 页面级布局骨架，无具体业务数据 | ❌ 否 | ❌ 否 | PageContainer、DashboardLayout、SidebarLayout |
| **Page 页面** | Page | 由 Template + Organism + Molecule + Atom 组装成的完整页面 | ✅ 可含 | ✅ 可依赖 | 位于 `src/pages/` |

### 组合规则

```
Page
└── Template
    └── Organism
        └── Molecule
            └── Atom
```

**强制约束**：
- Atom 只能由 Tailwind / Design Tokens 组装，**禁止 import Store/Service**。
- Molecule 只能由 Atom 组合，**禁止 import Store/Service**（纯 props 驱动）。
- Organism 可由 Molecule + Atom 组合，可 import Hooks/Stores/Services。
- Template 只能由 Molecule + Atom 组合，**禁止业务数据**。
- Page 可组合任意层级，可 import Store/Service。

---

## 三、目录结构

重构后目录结构：

```
src/components/
├── atoms/                          # 原子组件（不可再分）
│   ├── index.ts                    # 统一导出
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Label.tsx
│   ├── Progress.tsx
│   ├── Card.tsx
│   ├── Separator.tsx
│   ├── Skeleton.tsx
│   ├── Switch.tsx
│   ├── Slider.tsx
│   ├── Checkbox.tsx
│   ├── Radio.tsx
│   ├── Select.tsx
│   ├── Textarea.tsx
│   ├── Toggle.tsx
│   ├── Tooltip.tsx
│   ├── Popover.tsx
│   ├── Sheet.tsx
│   ├── Toast.tsx
│   ├── Menu.tsx
│   ├── Pagination.tsx
│   ├── Breadcrumb.tsx
│   ├── Result.tsx
│   ├── List.tsx
│   ├── Grid.tsx
│   ├── StockPriceChange.tsx
│   └── ...
├── molecules/                      # 分子组件（2+ 原子组合）
│   ├── index.ts
│   ├── Alert.tsx
│   ├── Dialog.tsx
│   ├── Tabs.tsx
│   ├── DataState.tsx
│   ├── ErrorState.tsx
│   ├── EmptyState.tsx
│   ├── LoadingState.tsx
│   ├── FormField.tsx              # 新增：Label + Input + 错误文本
│   ├── MetricCard.tsx             # 新增：Card + 标题 + 数值 + 变化指标
│   ├── SearchBar.tsx              # 新增：Input + Button + Icon
│   ├── PageHeader.tsx             # 从 ui/ 迁移
│   └── PageContainer.tsx          # 从 ui/ 迁移
├── organisms/                      # 有机体组件（业务领域复合）
│   ├── index.ts
│   ├── pool/
│   │   ├── PoolBoard.tsx
│   │   ├── PoolCard.tsx
│   │   ├── PoolColumn.tsx
│   │   └── PoolList.tsx
│   ├── collection/
│   │   ├── CollectionProgressPanel.tsx
│   │   └── CollectionReportPanel.tsx
│   ├── analysis/
│   ├── input/
│   ├── trading/
│   ├── output/
│   ├── system/
│   ├── news/
│   ├── strategy/
│   ├── localDoc/
│   ├── agent/
│   ├── cabin/
│   ├── chart/
│   └── widgets/
├── templates/                      # 页面级模板
│   ├── index.ts
│   ├── DashboardLayout.tsx
│   ├── SidebarLayout.tsx
│   └── CockpitLayout.tsx
├── shared/                         # 跨领域共享（过渡保留，最终归入 organisms/templates）
│   ├── ErrorBoundary.tsx
│   ├── PageSkeleton.tsx
│   └── WidgetErrorBoundary.tsx
└── ui/                             # 过渡期兼容目录（扁平 shim，非 ui/atoms 子目录）
    ├── index.ts                    # 聚合兼容桶（re-export 顶层 atoms/molecules）
    ├── Button.tsx                  # `export * from '@/components/atoms/Button'`
    ├── ...（37 个 shim 文件，保留到 v2.0 后删除）
```

---

## 四、组件归类映射（当前全量）

### 4.1 原子（Atoms）

从 `src/components/ui/` 提取：

| 组件 | 当前路径 | 目标路径 | 说明 |
|------|----------|----------|------|
| Button | `ui/Button.tsx` | `atoms/Button.tsx` | 单一按钮原子 |
| Input | `ui/Input.tsx` | `atoms/Input.tsx` | 单一输入框 |
| Textarea | `ui/Textarea.tsx` | `atoms/Textarea.tsx` | 单一文本域 |
| Select | `ui/Select.tsx` | `atoms/Select.tsx` | 单一选择器 |
| Checkbox | `ui/Checkbox.tsx` | `atoms/Checkbox.tsx` | 单一复选框 |
| Radio | `ui/Radio.tsx` | `atoms/Radio.tsx` | 单选 |
| Switch | `ui/Switch.tsx` | `atoms/Switch.tsx` | 开关 |
| Slider | `ui/Slider.tsx` | `atoms/Slider.tsx` | 滑块 |
| Toggle | `ui/Toggle.tsx` | `atoms/Toggle.tsx` | 切换 |
| Label | `ui/Label.tsx` | `atoms/Label.tsx` | 标签 |
| Badge | `ui/Badge.tsx` | `atoms/Badge.tsx` | 徽章 |
| Progress | `ui/Progress.tsx` | `atoms/Progress.tsx` | 进度条 |
| Separator | `ui/Separator.tsx` | `atoms/Separator.tsx` | 分隔线 |
| Skeleton | `ui/Skeleton.tsx` | `atoms/Skeleton.tsx` | 骨架屏 |
| Card | `ui/Card.tsx` | `atoms/Card.tsx` | 卡片容器 |
| Tooltip | `ui/Tooltip.tsx` | `atoms/Tooltip.tsx` | 提示 |
| Popover | `ui/Popover.tsx` | `atoms/Popover.tsx` | 气泡 |
| Sheet | `ui/Sheet.tsx` | `atoms/Sheet.tsx` | 抽屉 |
| Toast | `ui/Toast.tsx` | `atoms/Toast.tsx` | 轻提示 |
| Menu | `ui/Menu.tsx` | `atoms/Menu.tsx` | 菜单 |
| Pagination | `ui/Pagination.tsx` | `atoms/Pagination.tsx` | 分页 |
| Breadcrumb | `ui/Breadcrumb.tsx` | `atoms/Breadcrumb.tsx` | 面包屑 |
| Result | `ui/Result.tsx` | `atoms/Result.tsx` | 结果展示 |
| List | `ui/List.tsx` | `atoms/List.tsx` | 列表 |
| Grid | `ui/Grid.tsx` | `atoms/Grid.tsx` | 栅格 |
| Table | `ui/Table.tsx` | `atoms/Table.tsx` | 表格 |
| DatePicker | `ui/DatePicker.tsx` | `atoms/DatePicker.tsx` | 日期选择 |
| StockPriceChange | `ui/StockPriceChange.tsx` | `atoms/StockPriceChange.tsx` | 股价变化 |

### 4.2 分子（Molecules）

从 `src/components/ui/` 提取：

| 组件 | 当前路径 | 目标路径 | 说明 |
|------|----------|----------|------|
| Alert | `ui/Alert.tsx` | `molecules/Alert.tsx` | Icon + 标题 + 描述 + 关闭按钮 |
| Dialog | `ui/Dialog.tsx` | `molecules/Dialog.tsx` | Trigger + Overlay + Content + Header + Footer |
| Tabs | `ui/Tabs.tsx` | `molecules/Tabs.tsx` | TabsList + TabsTrigger + TabsContent |
| DataState | `ui/DataState.tsx` | `molecules/DataState.tsx` | 加载/空/错误状态组合 |
| ErrorState | `ui/ErrorState.tsx` | `molecules/ErrorState.tsx` | 错误状态分子 |
| EmptyState | `ui/EmptyState.tsx` | `molecules/EmptyState.tsx` | 空状态分子 |
| LoadingState | `ui/LoadingState.tsx` | `molecules/LoadingState.tsx` | 加载状态分子 |
| PageHeader | `ui/PageHeader.tsx` | `molecules/PageHeader.tsx` | 标题 + 操作区 |
| PageContainer | `ui/PageContainer.tsx` | `molecules/PageContainer.tsx` | 页面容器 + 间距 |
| FormField | *新增* | `molecules/FormField.tsx` | Label + Input + 错误提示 |
| MetricCard | *新增* | `molecules/MetricCard.tsx` | Card + 标题 + 数值 + 趋势 |
| SearchBar | *新增* | `molecules/SearchBar.tsx` | Input + Search Icon + Button |
| FilterChip | *新增* | `molecules/FilterChip.tsx` | Badge + 关闭按钮 |

### 4.3 有机体（Organisms）

从各业务目录迁移或保留：

| 领域 | 当前目录 | 目标目录 | 代表组件 |
|------|----------|----------|----------|
| 股票池 | `components/pool/` | `organisms/pool/` | PoolBoard、PoolCard、PoolList、PoolColumn |
| 采集 | `components/collection/` | `organisms/collection/` | CollectionProgressPanel、CollectionReportPanel |
| 分析 | `components/analysis/` | `organisms/analysis/` | ScoreHistoryPanel、IntelligentScoreExplanation、MultiFactorFilterPanel 等 |
| 输入 | `components/input/` | `organisms/input/` | CollectionPlanPanel、DataCollectionWizard、TraceReplayPanel 等 |
| 交易 | `components/trading/` | `organisms/trading/` | RiskControlPanel、OrderExecutionPanel、TradingSignalPanel |
| 输出 | `components/output/` | `organisms/output/` | ReviewWizard、ReviewArtifactCard、ReviewArtifactModal |
| 系统 | `components/system/` | `organisms/system/` | AgentHealthCard、EngineStatusCard、MigrationPanel |
| 新闻 | `components/news/` | `organisms/news/` | NewsCard、NewsFilterPanel、NewsSentimentTrend |
| 策略 | `components/strategy/` | `organisms/strategy/` | StrategyGroupCard、ChangeLogPanel |
| 本地文档 | `components/localDoc/` | `organisms/localDoc/` | LocalDocCard |
| Agent | `components/agent/` | `organisms/agent/` | GenericAgentDetail、V6ScoringAgentDetail |
| 驾驶舱 | `components/cabin/` | `organisms/cabin/` | ScoreSnapshot、ScoreSummary、IndustryHistoryCard |
| 图表 | `components/chart/` | `organisms/chart/` | LineChart、BarChart、AreaChart、CandlestickChart、GaugeChart |
| 控件 | `components/widgets/` | `organisms/widgets/` | WidgetShell |

### 4.4 模板（Templates）

从 `shared/` 提取或新增：

| 组件 | 当前路径 | 目标路径 | 说明 |
|------|----------|----------|------|
| PageContainer | `ui/PageContainer.tsx` | `templates/PageContainer.tsx` | 页面内容容器 |
| PageHeader | `ui/PageHeader.tsx` | `templates/PageHeader.tsx` | 页面标题 + 操作区（也可作为分子） |
| DashboardLayout | *新增* | `templates/DashboardLayout.tsx` | 仪表盘布局 |
| SidebarLayout | *新增* | `templates/SidebarLayout.tsx` | 侧边栏布局 |

---

## 五、导入约定

### 推荐写法

```typescript
// 原子
import { Button, Input, Badge } from '@/components/atoms'

// 分子
import { Alert, MetricCard, FormField } from '@/components/molecules'

// 有机体
import { PoolBoard } from '@/components/organisms/pool'
import { CollectionProgressPanel } from '@/components/organisms/collection'

// 模板
import { PageContainer } from '@/components/templates'
```

### 过渡写法（兼容）

```typescript
// 在 v1.x 过渡期内仍可用，v2.0 后移除
import { Button } from '@/components/ui'
import { Button } from '@/components/ui/Button'  // shim 文件保留
```

---

## 六、新增原子/分子组件

### 6.1 FormField 分子

统一表单字段组合：Label + 控件 + 错误提示 + 帮助文本。

```typescript
export interface FormFieldProps {
  label?: string
  htmlFor?: string
  error?: string
  help?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}
```

### 6.2 MetricCard 分子

统一指标卡：标题 + 数值 + 单位 + 趋势 + 变化。

```typescript
export interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  change?: string
  loading?: boolean
  className?: string
}
```

### 6.3 SearchBar 分子

搜索输入 + 搜索按钮 + 清除按钮。

### 6.4 FilterChip 分子

可关闭的筛选标签。

---

## 七、迁移路径

### 阶段 1：建立体系（已完成并验证 ✅）

- [x] 定义原子层级与目录结构
- [x] 建立 `src/components/atoms/`、`molecules/`、`organisms/`、`templates/`
- [x] 创建 `componentRegistry.ts` 记录所有组件原子层级
- [x] 迁移本次新增组件到 `organisms/`
- [x] 旧路径 `components/collection/*`、`components/pool/*` 重建为 re-export shim，保持引用兼容
- [x] 收尾验证（2026-07-10）：`tsc:prod` ✅ / `build` ✅（20.75s）/ `audit:layers` 0 违规 / `audit:routes` 62/62 / `audit:tokens` 0 违规 / `lint:colors` ✅ / `audit:docs` ✅ / `audit:hardcode` 仅既有 Warning

### 阶段 2：UI 目录原子化（v1.1）— 已完成并验证 ✅（2026-07-10）

> **落点决策**：经用户确认，直接落到**顶层 `atoms/` 与 `molecules/`**（即阶段 5 终态），而非文档原字面写的 `ui/atoms`、`ui/molecules`。`ui/` 退化为纯扁平 shim 兼容层，与 `collection/`、`pool/` 模式完全一致，避免阶段 5 二次合并。

- [x] 将 `ui/` 中 28 个原子组件物理迁移到顶层 `src/components/atoms/`（含测试随迁）
- [x] 将 `ui/` 中 9 个分子组件物理迁移到顶层 `src/components/molecules/`（含测试随迁）
- [x] 原 `ui/X.tsx` 全部改写为 `export * from '@/components/atoms|X'` 纯 shim，约 140 处消费者引用零改动
- [x] 更新 `atoms/index.ts`、`molecules/index.ts` 桶导出由 `@/components/ui/X` → `./X`
- [x] 修复脚本误加的 `PageContainer` 到 `atoms/index.ts`（实际归属 molecules）
- [x] 收尾验证（系统 Node 24 驱动 tsx）：`tsc:prod` ✅（仅 `databridge.test.ts` 预存 TS2352）/ `build` ✅ / `audit:layers` 0 违规（909 文件）/ `audit:tokens` 0 硬编码 / `audit:docs` 0 违规（302 文件）/ `audit:routes` 62/62 / `lint:colors` ✅ / `audit:hardcode` 仅 29 处基线 Warning

### 阶段 3：业务目录有机体化（v1.2）— 已完成 ✅（2026-07-11）

> **执行策略**：治理优先 + 试点先行（经用户确认）。先建 `audit:atomic` 门禁强制层级边界，再以 `input/` 为试点验证 shim 配方，随后低风险域逐域扩面。`chart/` 与 `cockpit/cabin/widgets` 因与 Widget 注册表耦合，仅 registry 标注不物理搬。

**步骤 0：构建 `audit:atomic` 层级边界审计脚本 — 已完成 ✅（2026-07-11）**

- [x] 新建 `scripts/audit-atomic.ts`：依据 `componentRegistry` + 目录推断组件层级，校验 atom 不引 store/service/molecule/organism/template/page/app、molecule 不引 organism/template/store/service、template 不引 organism/store/service；校验 ui/ shim 为纯 re-export；登记未注册业务组件
- [x] 注册 npm script `audit:atomic`
- [x] 修复行注释正则语法错误（`//\/\/.*$/gm` → `/\/\/.*$/gm`）
- [x] 修复注册表匹配逻辑：同时按 `sourcePath` 和 `targetPath` 匹配，已迁移到目标位置的组件不再误报为 unregistered
- [x] 翻转 36 条已迁移条目的 registry status `migrating` → `active`
- [x] 基线验证：0 阻断性违规、194 warning（168 stale-ui-import + 26 unregistered）

**步骤 1：`input/` 试点物理迁移到 `organisms/input/` — 已完成 ✅（2026-07-11）**

- [x] 将 `src/components/input/` 18 个 `.tsx`（含 `wizard-steps/` 子目录）物理迁移到 `src/components/organisms/input/`
- [x] 原 `input/X.tsx` 改写为纯 re-export shim，8 个消费者引用零改动
- [x] 翻转注册表对应条目 status → `active`
- [x] 收尾验证（系统 Node 24 驱动 tsx）：`tsc:prod` 0 错误 / `build` ✅ / `audit:layers` 0 违规 / `audit:atomic` 0 阻断（203 warning 过渡期预期）/ `audit:docs` 0 违规 / `audit:routes` 64 路由覆盖 / `audit:tokens` 0 硬编码 / `lint:colors` ✅ / `audit:hardcode` 29 基线 Warning

**步骤 2：低风险域逐域物理迁移 — 已完成 ✅（2026-07-11）**

- [x] `trading/`（3 文件）→ `organisms/trading/`
- [x] `output/`（4 文件，含 reviewArtifact.ts）→ `organisms/output/`
- [x] `news/`（2 文件）→ `organisms/news/`
- [x] `strategy/`（2 文件）→ `organisms/strategy/`
- [x] `agent/`（2 文件）→ `organisms/agent/`
- [x] `localDoc/`（1 文件）→ `organisms/localDoc/`
- [x] `system/`（11 文件，含 `migration/` 子目录 5 文件）→ `organisms/system/`
- [x] 补登 9 个未登记条目（AgentTaskList/LogStreamPanel/SystemArchitectureDiagram/migration 子目录/reviewArtifact.ts）
- [ ] `chart/` → 重评级为 molecule，registry 标注不物理搬（待执行重评级）
- [ ] `cockpit/cabin/widgets` → 仅 registry 标注不物理搬（Widget 注册表耦合）

**步骤 3：`analysis/` 中风险域迁移 — 已完成 ✅（2026-07-11）**

- [x] `analysis/`（13 文件，含 6 个嵌套子目录 `hub/news/score/screening/sector/signal` + 4 测试文件）→ `organisms/analysis/`（子目录结构保留，子目录感知 shim 已生成）

**收尾验证（2026-07-11 步骤 2+3）**：`tsc:prod` 0 错误 / `build` ✅（28.96s）/ `audit:layers` 0 违规 / `audit:atomic` 0 阻断（194 warning 过渡期预期）/ `audit:docs` 0 违规 / `audit:routes` exit 0 / `audit:tokens` 0 硬编码 / `lint:colors` ✅ / `audit:hardcode` 29 基线 Warning

### 阶段 4：模板提取（v1.3）— 已完成 ✅（2026-07-11）

- [x] 提取 `PageContainer` 到 `templates/`（`src/components/molecules/PageContainer.tsx` → `src/components/templates/PageContainer.tsx`；`PageHeader` 按注册表保留在 `molecules/`，属分子层复合组件）。
- [x] `DashboardLayout` / `SidebarLayout` / `CockpitLayout` 已存在于 `templates/`。
- [x] 更新 `templates/index.ts`、原子桶注释、`ui/PageContainer.tsx` shim、注册表 status `migrating` → `active`。

### 阶段 5：清理（v2.0）— 进行中

- [x] 已建立全部目标目录的真实文件与旧位置 shim（`pool/`、`scoreDoc/`、`shared/`、`ui/statusColors.ts`、`ui/states/` 等）。
- [ ] 删除所有 shim 文件
- [ ] 强制使用 `@/components/{atoms,molecules,organisms,templates}` 导入
- [ ] 更新 lint 规则禁止跨层级导入


---

## 八、质量门禁

1. **目录方向**：`atoms/` 不可 import `molecules/organisms/templates/shared/pages/stores/services`
2. **分子边界**：`molecules/` 不可 import `organisms/templates/shared/pages/stores/services`
3. **模板边界**：`templates/` 不可 import `organisms/stores/services`
4. **命名规范**：组件文件名 PascalCase；目录名 kebab-case 或 camelCase
5. **类型先行**：每个组件必须定义 `Props` interface
6. **测试伴随**：新增/迁移组件必须同步迁移测试或补充测试

未来可通过 `audit:atomic` 脚本自动检查上述规则。

---

## 九、参考标准

- **Atomic Design** by Brad Frost
- **shadcn/ui** 化合物件模式（Compound Components）
- **Ant Design** 组件分层（General / Layout / Navigation / Data Entry / Data Display / Feedback）
- **V9 AGENTS.md** 分层规则与颜色令牌规范
