# FinSightV9 P0 优化建议 — 代码重构方案与待办事项

| 字段 | 值 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-08-04 |
| 文档范围 | P0 优先级 3 项建议的重构方案、待办事项、验收标准 |
| 上游报告 | [2026-08-04-tech-debt-remediation-report.md](./2026-08-04-tech-debt-remediation-report.md) §4.1 |
| 预计工作量 | 22-30 工时（含测试与门禁配置） |

---

## 一、P0-A：类型契约三方同步机制

### 1.1 问题陈述

本次技术债修复中 **32% 的错误**源于类型契约漂移：类型定义更新后，mock 数据、测试用例、调用方未同步更新。典型案例：

- `widget.types.ts` 放宽 `price` 为 `number | undefined` 后，`WatchlistWidget` 未同步
- `ProfileItem` 新增 `sentiment`/`relatedLayers` 字段后，`profileService.test.ts` mock 未补
- `PortfolioHolding` 放宽为可选后，`CoreResourcePanel` 未处理空值

### 1.2 重构方案

#### 阶段 1：规范文档化（2 工时）

**目标**：在 [CONTRIBUTING.md](file:///d:/FinSightV9/CONTRIBUTING.md) 中明确"类型变更三同步"规则。

**改动清单**：
- 在 `CONTRIBUTING.md` 新增 §3.4 "类型变更三同步规则"章节
- 内容包含：
  - 三方定义：类型定义（`src/types/**`）+ mock 数据（`tests/fixtures/**`）+ 调用方（`src/**`）
  - 同步要求：必须同 PR 提交，禁止跨 PR 拆分
  - PR 模板新增 checkbox："✅ 已确认类型变更三方同步"
- 在 [docs/guidelines/](file:///d:/FinSightV9/docs/guidelines/) 添加类型契约治理 wiki

**验收标准**：
- [ ] CONTRIBUTING.md 包含"类型变更三同步"章节
- [ ] PR 模板 (.github/pull_request_template.md) 新增 checkbox
- [ ] 至少 2 名团队成员 Review 通过

#### 阶段 2：Pre-commit Hook 增强（4 工时）

**目标**：当 `src/types/**/*.ts` 有变更时，自动触发 `tsc:test` 阻断测试类型漂移。

**改动清单**：
- 修改 [.husky/pre-commit](file:///d:/FinSightV9/.husky/pre-commit)，新增逻辑：
  ```bash
  # 检测类型定义文件是否在暂存区
  TYPE_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "^src/types/.*\.ts$" || true)
  if [ -n "$TYPE_FILES" ]; then
    echo "[pre-commit] 检测到类型定义变更，触发 tsc:test ..."
    npm run tsc:test || { echo "[pre-commit] tsc:test 失败，类型契约可能漂移"; exit 1; }
  fi
  ```
- 配套 lint-staged 配置：对 `src/types/**` 变更触发 `tsc:prod`

**验收标准**：
- [ ] pre-commit 脚本包含类型变更检测逻辑
- [ ] 修改 `src/types/**/*.ts` 后提交，自动触发 `tsc:test`
- [ ] 测试用例类型不匹配时，提交被阻断
- [ ] 在 README 或 docs/guides/ 记录此机制

#### 阶段 3：CI Job 独立化（3 工时）

**目标**：将 `tsc:prod` + `tsc:test` 从单元测试中解耦，作为独立 CI Job，失败立即阻断合并。

**改动清单**：
- 修改 [.github/workflows/](file:///d:/FinSightV9/.github/workflows/) 下的 CI 配置：
  ```yaml
  types-check:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run tsc:prod
      - run: npm run tsc:test
  ```
- 在分支保护规则中将 `types-check` 设为必需状态检查

**验收标准**：
- [ ] GitHub Actions 新增 `types-check` Job
- [ ] Job 失败时 PR 无法合并
- [ ] Job 平均执行时间 < 2 分钟

### 1.3 待办事项清单

| # | 任务 | 负责人 | 工时 | 优先级 | 依赖 |
|---|------|-------|------|--------|------|
| A1 | 在 CONTRIBUTING.md 新增"类型变更三同步"章节 | TBD | 1h | P0 | - |
| A2 | 修改 PR 模板添加同步 checkbox | TBD | 0.5h | P0 | A1 |
| A3 | 编写类型契约治理 wiki | TBD | 0.5h | P0 | A1 |
| A4 | 修改 .husky/pre-commit 添加类型变更检测 | TBD | 2h | P0 | - |
| A5 | 配置 lint-staged 对 src/types/** 触发 tsc:prod | TBD | 1h | P0 | A4 |
| A6 | 本地验证 pre-commit 阻断效果 | TBD | 1h | P0 | A4, A5 |
| A7 | 新增 GitHub Actions types-check Job | TBD | 2h | P0 | - |
| A8 | 配置分支保护必需状态检查 | TBD | 0.5h | P0 | A7 |
| A9 | 端到端验证：故意制造类型漂移测试 CI 阻断 | TBD | 0.5h | P0 | A7, A8 |

**合计**：9 工时

---

## 二、P0-B：ESLint `no-unsafe-member-access` 升级为 error

### 2.1 问题陈述

本次修复中 **14% 的错误**是 `unknown` 类型防御不足导致。当前 ESLint 配置中 `@typescript-eslint/no-unsafe-member-access` 为 `warn` 级别，不阻断提交，导致历史 `unsafe` 用法持续累积。

### 2.2 重构方案

#### 阶段 1：现状基线评估（2 工时）

**目标**：扫描全项目 `unsafe` 用法数量，建立治理基线。

**改动清单**：
- 执行 `npx eslint src/ --ext .ts,.tsx --rule '{"@typescript-eslint/no-unsafe-member-access": "error"}' --max-warnings 9999`
- 输出错误清单到 `docs/reports/eslint-unsafe-baseline.md`
- 按目录分类统计：`src/services/`、`src/components/`、`src/store/`、`src/core/` 等
- 识别"低垂果实"（easy fixes）：仅需添加 `as Record<string, unknown>` 断言的简单情况

**验收标准**：
- [ ] 生成 `docs/reports/eslint-unsafe-baseline.md` 报告
- [ ] 报告包含按目录/错误类型分布的统计表
- [ ] 识别出至少 50% 的"低垂果实"

#### 阶段 2：批量修复低垂果实（6 工时）

**目标**：批量修复简单 `unsafe` 用法，将错误数降低至可管理范围。

**改动清单**：
- 编写一次性修复脚本 `scripts/audit/fix-unsafe-member-access.cjs`：
  - 自动为 `unknown` 变量添加 `as Record<string, unknown>` 断言
  - 自动将 `obj.prop` 改写为 `String(obj.prop)` / `Number(obj.prop)`
  - 提供 `--dry-run` 模式预览变更
- 分批提交（按目录分组，每批 ≤ 20 文件），避免大 PR 难以 Review
- 每批提交后运行 `npm run test` 验证回归

**验收标准**：
- [ ] 修复脚本支持 `--dry-run` 与 `--execute` 模式
- [ ] 至少修复 60% 的 `unsafe` 用法
- [ ] 每批提交后测试套件全部通过
- [ ] 提交记录遵循约定式提交（`fix(eslint): 批量修复 unsafe-member-access - 第 N 批`）

#### 阶段 3：升级规则为 error（2 工时）

**目标**：将 ESLint 规则升级为 `error`，强制阻断新违规。

**改动清单**：
- 修改 [eslint.config.js](file:///d:/FinSightV9/eslint.config.js)：
  ```javascript
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  ```
- 修改 `package.json` 的 `lint` 脚本，将 `--max-warnings 2000` 改为 `--max-warnings 0`
- 配套更新 [docs/guidelines/](file:///d:/FinSightV9/docs/guidelines/) 中的 ESLint 规范文档

**验收标准**：
- [ ] eslint.config.js 中 5 个 unsafe 系列规则均为 `error`
- [ ] `npm run lint` 退出码为 0（无 warning 无 error）
- [ ] CI 流水线 lint Job 通过

#### 阶段 4：剩余复杂用例治理（4 工时）

**目标**：处理无法自动修复的复杂 `unsafe` 用法（如第三方 API 响应、动态数据结构）。

**改动清单**：
- 逐个分析剩余 `unsafe` 用法，判断处理策略：
  - 策略 A：添加 Zod / io-ts 运行时类型校验
  - 策略 B：提取类型守卫函数（`isXxx`）
  - 策略 C：添加 `// eslint-disable-next-line` 注释 + 详细理由
- 对于第三方 API 响应，在 `src/services/fetcher/` 层统一添加响应体校验

**验收标准**：
- [ ] 所有 `unsafe` 用法均有明确处理策略
- [ ] 使用 `eslint-disable` 的位置必须附带理由注释
- [ ] 第三方 API 响应层有运行时类型校验

### 2.3 待办事项清单

| # | 任务 | 负责人 | 工时 | 优先级 | 依赖 |
|---|------|-------|------|--------|------|
| B1 | 执行 ESLint 扫描生成 unsafe 基线报告 | TBD | 1h | P0 | - |
| B2 | 按目录分类统计 unsafe 用法 | TBD | 1h | P0 | B1 |
| B3 | 编写 fix-unsafe-member-access.cjs 自动修复脚本 | TBD | 2h | P0 | B1 |
| B4 | 分批执行自动修复（第 1 批：src/services/） | TBD | 1.5h | P0 | B3 |
| B5 | 分批执行自动修复（第 2 批：src/components/） | TBD | 1.5h | P0 | B3 |
| B6 | 分批执行自动修复（第 3 批：src/store/ + src/core/） | TBD | 1.5h | P0 | B3 |
| B7 | 分批执行自动修复（第 4 批：剩余目录） | TBD | 1.5h | P0 | B3 |
| B8 | 升级 eslint.config.js 5 个 unsafe 规则为 error | TBD | 0.5h | P0 | B4-B7 |
| B9 | 修改 package.json lint 脚本为 --max-warnings 0 | TBD | 0.5h | P0 | B8 |
| B10 | 处理复杂 unsafe 用例（Zod 校验 + 类型守卫） | TBD | 4h | P0 | B8 |
| B11 | 端到端验证：lint + tsc + test 全绿 | TBD | 1h | P0 | B10 |

**合计**：16 工时

---

## 三、P0-C：安全格式化工具统一收口

### 3.1 问题陈述

本次修复发现 `safeFormatNumber` 在多个 Widget 组件中被错误调用（传 `undefined` vs 传 `0`）。当前状态：

| 状态 | 说明 |
|------|------|
| ✅ API 入口已收口 | [src/lib/format.ts](file:///d:/FinSightV9/src/lib/format.ts) 通过 `re-export` 暴露 4 个函数 |
| ✅ 实现模块独立 | [src/lib/safeFormat.ts](file:///d:/FinSightV9/src/lib/safeFormat.ts) 包含完整实现 + JSDoc + 示例 |
| ✅ 4 个文件已正确使用 | WatchlistWidget / MarketIndicesWidget / CoreResourcePanel / ScoreSnapshot |
| ❌ **100 个文件仍直接调用 `.toFixed()`** | 未迁移到 `safeFormatNumber`，存在运行时 TypeError 风险 |

### 3.2 重构方案

#### 阶段 1：迁移分类与优先级评估（2 工时）

**目标**：将 100 个 `.toFixed()` 调用文件分为 3 类，确定迁移优先级。

**改动清单**：
- 编写扫描脚本 `scripts/audit/scan-tofixed-usage.cjs`：
  - 扫描所有 `*.toFixed(N)` 调用
  - 提取上下文（前 3 行 + 后 1 行）
  - 分类标记：
    - `MUST_MIGRATE`：金融数据展示（price/score/change/volume 等字段）
    - `SHOULD_MIGRATE`：图表数据格式化（Chart 组件中的 tooltip/formatter）
    - `OPTIONAL`：纯计算场景（变量类型已确定为 number）
  - 输出 `docs/reports/tofixed-migration-audit.md`
- 评估每类文件数量与迁移工作量

**验收标准**：
- [ ] 生成 `docs/reports/tofixed-migration-audit.md` 报告
- [ ] 100 个文件完成分类标记
- [ ] 报告包含迁移工作量评估表

#### 阶段 2：批量迁移 MUST_MIGRATE 类（8 工时）

**目标**：迁移所有金融数据展示场景，消除运行时 TypeError 风险。

**改动清单**：
- 按目录分批迁移（每批 ≤ 15 文件）：
  - 第 1 批：`src/components/cabin/`（ScoreItem、IntelligentScoreBasisCard 等）
  - 第 2 批：`src/components/organisms/`（PoolCard、ScoreDocVersionTable 等）
  - 第 3 批：`src/cockpit/widgets/`（PortfolioOverviewWidget、WatchlistMoversWidget 等）
  - 第 4 批：`src/pages/analysis/`（IntelligentScorePage、IndustryScorePage 等）
  - 第 5 批：`src/apps/`（AnalysisApp、TradingFlowPage 等）
- 迁移规则：
  - `value.toFixed(2)` → `safeFormatNumber(value, 2)`
  - `value.toFixed(2) + '%'` → `safeFormatPercent(value, 2)`
  - `parseInt(value.toFixed(0))` → `safeFormatInt(value)`
- 每批迁移后运行 `npm run test` 验证

**验收标准**：
- [ ] 所有 `MUST_MIGRATE` 类文件完成迁移
- [ ] 每批提交后测试套件通过
- [ ] 提交记录：`refactor(format): 迁移 .toFixed() 到 safeFormatNumber - 第 N 批`

#### 阶段 3：迁移 SHOULD_MIGRATE 类（4 工时）

**目标**：迁移图表组件中的格式化逻辑，统一图表 tooltip 行为。

**改动清单**：
- 按目录分批迁移：
  - `src/components/chart/`（ScoreRadar、PieChart、ValuationDistribution 等）
  - `src/components/organisms/analysis/`（ScoreFactorWaterfall、IntelligentScoreExplanation 等）
- 迁移规则：
  - 图表 tooltip formatter 中 `${value.toFixed(2)}` → `${safeFormatNumber(value, 2)}`
  - 注意保持 Recharts/Echarts 的 formatter 签名不变

**验收标准**：
- [ ] 所有 `SHOULD_MIGRATE` 类文件完成迁移
- [ ] 图表组件视觉回归测试通过（如有）
- [ ] 提交记录遵循约定式提交

#### 阶段 4：ESLint 自定义规则强制（3 工时）

**目标**：编写自定义 ESLint 规则 `no-raw-tofixed`，禁止在标记为 `financial` 的目录直接调用 `.toFixed()`。

**改动清单**：
- 新建 [scripts/quality/eslint-plugin-no-raw-tofixed.js](file:///d:/FinSightV9/scripts/quality/eslint-plugin-no-raw-tofixed.js)：
  ```javascript
  module.exports = {
    meta: { type: 'problem', schema: [{ type: 'array', items: { type: 'string' } }] },
    create(context) {
      const restrictedDirs = context.options[0] || ['src/components', 'src/cockpit', 'src/apps']
      const filePath = context.getFilename()
      if (!restrictedDirs.some(d => filePath.includes(d))) return {}
      return {
        CallExpression(node) {
          if (node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'toFixed') {
            context.report({ node, message: '禁止直接调用 .toFixed()，请使用 safeFormatNumber' })
          }
        }
      }
    }
  }
  ```
- 在 [eslint.config.js](file:///d:/FinSightV9/eslint.config.js) 中注册该规则
- 添加规则文档 [docs/guides/eslint-rules.md](file:///d:/FinSightV9/docs/guides/eslint-rules.md)

**验收标准**：
- [ ] ESLint 自定义规则 `v9/no-raw-tofixed` 实现
- [ ] 规则仅在指定目录生效
- [ ] 单元测试覆盖规则（至少 5 个用例：正例/反例/边界）
- [ ] 规则文档完整

#### 阶段 5：单元测试边界覆盖（2 工时）

**目标**：为 `safeFormatNumber` 添加 6 种边界用例测试，确保防御性。

**改动清单**：
- 在 [src/lib/format.test.ts](file:///d:/FinSightV9/src/lib/format.test.ts) 添加测试用例：
  - `null` 输入返回 `'--'`
  - `undefined` 输入返回 `'--'`
  - `NaN` 输入返回 `'--'`
  - `Infinity` / `-Infinity` 输入返回 `'--'`
  - 负数输入返回正确格式（`-3.14`）
  - 大数输入返回正确格式（`Number.MAX_SAFE_INTEGER`）
  - 自定义 fallback 生效
- 覆盖率目标：`src/lib/safeFormat.ts` 行覆盖 100%、分支覆盖 100%

**验收标准**：
- [ ] 6 种边界用例均有测试
- [ ] `npm run test:unit -- src/lib/format.test.ts` 通过
- [ ] 覆盖率报告显示 100% / 100%

### 3.3 待办事项清单

| # | 任务 | 负责人 | 工时 | 优先级 | 依赖 |
|---|------|-------|------|--------|------|
| C1 | 编写 scan-tofixed-usage.cjs 扫描脚本 | TBD | 1h | P0 | - |
| C2 | 生成 tofixed-migration-audit.md 分类报告 | TBD | 1h | P0 | C1 |
| C3 | 迁移第 1 批：src/components/cabin/ | TBD | 1.5h | P0 | C2 |
| C4 | 迁移第 2 批：src/components/organisms/ | TBD | 2h | P0 | C2 |
| C5 | 迁移第 3 批：src/cockpit/widgets/ | TBD | 1.5h | P0 | C2 |
| C6 | 迁移第 4 批：src/pages/analysis/ | TBD | 1.5h | P0 | C2 |
| C7 | 迁移第 5 批：src/apps/ | TBD | 1.5h | P0 | C2 |
| C8 | 迁移 SHOULD_MIGRATE：src/components/chart/ | TBD | 2h | P0 | C2 |
| C9 | 迁移 SHOULD_MIGRATE：src/components/organisms/analysis/ | TBD | 2h | P0 | C2 |
| C10 | 编写 eslint-plugin-no-raw-tofixed.js 自定义规则 | TBD | 1.5h | P0 | C3-C9 |
| C11 | 注册规则到 eslint.config.js + 文档 | TBD | 0.5h | P0 | C10 |
| C12 | 编写规则单元测试（5+ 用例） | TBD | 1h | P0 | C10 |
| C13 | 补充 safeFormat 6 种边界用例测试 | TBD | 1h | P0 | - |
| C14 | 验证覆盖率 100% / 100% | TBD | 0.5h | P0 | C13 |
| C15 | 端到端验证：lint + tsc + test 全绿 | TBD | 1h | P0 | C10-C14 |

**合计**：21 工时

---

## 四、综合待办事项汇总

### 4.1 按优先级排序

| 优先级 | 任务编号 | 任务描述 | 工时 |
|--------|---------|---------|------|
| P0 | A1-A3 | 类型契约三方同步规范文档化 | 2h |
| P0 | A4-A6 | Pre-commit Hook 增强本地验证 | 4h |
| P0 | A7-A9 | CI types-check Job 独立化 | 3h |
| P0 | B1-B2 | ESLint unsafe 基线评估 | 2h |
| P0 | B3-B7 | 批量修复 unsafe 用法 | 8h |
| P0 | B8-B11 | ESLint 规则升级 + 复杂用例治理 | 6h |
| P0 | C1-C2 | .toFixed() 迁移分类评估 | 2h |
| P0 | C3-C7 | MUST_MIGRATE 批量迁移 | 8h |
| P0 | C8-C9 | SHOULD_MIGRATE 批量迁移 | 4h |
| P0 | C10-C12 | ESLint 自定义规则强制 | 3h |
| P0 | C13-C15 | 单元测试边界覆盖 + 端到端验证 | 2.5h |

**总计**：44.5 工时

### 4.2 关键里程碑

| 里程碑 | 完成任务 | 预计日期 |
|--------|---------|---------|
| M1：规范与门禁就位 | A1-A9, B8-B9 | 第 1 周末 |
| M2：ESLint unsafe 治理完成 | B1-B11 | 第 2 周末 |
| M3：.toFixed() 迁移完成 | C1-C9 | 第 3 周末 |
| M4：自定义规则与测试覆盖 | C10-C15 | 第 4 周初 |

### 4.3 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 批量迁移引入回归 | 中 | 每批 ≤ 15 文件，提交后必跑测试 |
| ESLint 规则升级阻塞团队提交 | 高 | 先批量修复，再升级规则；分批灰度 |
| 自定义 ESLint 规则误报 | 中 | 提供单元测试 + `// eslint-disable` 逃生口 |
| 第三方 API 响应类型校验成本高 | 中 | 优先在 fetcher 层统一处理，使用 Zod schema |

---

## 五、附录

### 5.1 相关文件清单

| 文件路径 | 用途 |
|---------|------|
| [src/lib/format.ts](file:///d:/FinSightV9/src/lib/format.ts) | API 入口（re-export） |
| [src/lib/safeFormat.ts](file:///d:/FinSightV9/src/lib/safeFormat.ts) | 实现模块 |
| [src/lib/format.test.ts](file:///d:/FinSightV9/src/lib/format.test.ts) | 单元测试 |
| [eslint.config.js](file:///d:/FinSightV9/eslint.config.js) | ESLint 配置 |
| [.husky/pre-commit](file:///d:/FinSightV9/.husky/pre-commit) | Pre-commit Hook |
| [CONTRIBUTING.md](file:///d:/FinSightV9/CONTRIBUTING.md) | 贡献规范 |
| [.github/workflows/](file:///d:/FinSightV9/.github/workflows/) | CI 配置 |

### 5.2 验证命令

```bash
# 1. ESLint unsafe 基线扫描
npx eslint src/ --ext .ts,.tsx --rule '{"@typescript-eslint/no-unsafe-member-access": "error"}' --max-warnings 9999

# 2. .toFixed() 用法扫描
node scripts/audit/scan-tofixed-usage.cjs

# 3. 类型检查
npm run tsc:prod && npm run tsc:test

# 4. 完整测试
npm run test

# 5. ESLint 自定义规则测试
npx mocha scripts/quality/eslint-plugin-no-raw-tofixed.test.js
```
