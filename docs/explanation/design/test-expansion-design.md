---
title: docs/explanation/design/test-expansion-design.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 测试扩充设计方案

> **版本**: v1.0 | **日期**: 2026-07-12
> **适用范围**: `scripts/` 目录下所有审计与工具脚本的测试覆盖
> **核心原则**: 系统化设计、功能域合并、逻辑一致性、架构连贯性

---

## 一、设计目标

### 1.1 问题背景

当前项目 `scripts/` 目录共有 **62 个脚本文件**，其中仅 **9 个**（14.5%）有对应的测试文件，**53 个**（85.5%）缺少测试覆盖。直接按优先级逐个编写测试会导致：

- **功能冗余**：相似脚本重复实现相同的 mock 基础设施和测试逻辑
- **维护成本高**：测试文件数量过多，难以统一维护和更新
- **逻辑不连贯**：测试之间缺乏关联性，无法验证端到端流程

### 1.2 设计目标

1. **系统化分类**：将 53 个未测试脚本按功能域分类，识别可合并的模块
2. **合并测试规则**：定义合并测试的具体规则，最大化代码复用
3. **独立性判定**：明确必须独立测试的项目及其技术边界
4. **逻辑一致性**：确保新增测试与现有体系保持逻辑连贯
5. **架构保障**：建立共享测试工具模块，统一测试模式和基础设施

---

## 二、功能域分类标准

### 2.1 分类维度

| 维度 | 说明 | 示例 |
|------|------|------|
| **技术领域** | 脚本所属的技术范畴 | 颜色审计、分层调用、文档管理、MCP架构 |
| **依赖关系** | 脚本间的依赖关系 | 共享 VFS mock、共享断言工具、执行顺序依赖 |
| **副作用特性** | 是否有外部副作用 | 文件写入、数据库操作、网络请求、git命令 |
| **输出类型** | 输出的报告/数据类型 | 结构化报告、JSON数据、文本输出 |
| **执行上下文** | 执行环境要求 | 仅文件系统、需要git、需要MCP服务、需要数据库 |

### 2.2 功能域划分

基于上述维度，将 53 个未测试脚本划分为 **9 个功能域**：

#### 功能域 1：颜色与设计令牌审计（5个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `audit-color-tokens.ts` | 颜色令牌合规性审计 | 文件系统 | 无 |
| `audit-inline-colors.ts` | 内联颜色硬编码检测 | 文件系统 | 无 |
| `audit-typography.ts` | 排版令牌使用审计 | 文件系统 | 无 |
| `audit-spacing.ts` | 间距令牌使用审计 | 文件系统 | 无 |
| `verify-design-tokens.ts` | 设计令牌一致性验证 | 文件系统 | 无 |

**合并依据**：
- 共享相同的颜色令牌数据结构
- 共享相同的 VFS mock 基础设施
- 共享相同的颜色断言工具
- 无执行顺序依赖
- 无副作用

---

#### 功能域 2：架构与分层审计（5个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `audit-atomic.ts` | 原子组件审计 | 文件系统 | 无 |
| `audit-component-usage.ts` | 组件复用率审计 | 文件系统 | 无 |
| `audit-registry.ts` | Store/Component/Widget注册表验证 | 文件系统 | 无 |
| `audit-execution-paths.ts` | 执行路径审计 | 文件系统 | 无 |
| `audit-split-quality.ts` | 拆分质量审计 | 文件系统 | 无 |

**合并依据**：
- 共享相同的组件/Store 数据结构
- 共享相同的 VFS mock 基础设施
- 共享相同的架构断言工具
- 无执行顺序依赖
- 无副作用

---

#### 功能域 3：文档管理（6个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `doc-freshness-score.ts` | 文档保鲜度四维度评分 | 文件系统、git | 无 |
| `doc-update-trigger.ts` | 文档更新触发器 | 文件系统、git | 无 |
| `doc-cross-ref-sync.ts` | 文档交叉引用同步 | 文件系统 | 无 |
| `doc-version-history.ts` | 文档版本历史 | 文件系统、git | 无 |
| `daily-doc-validation.ts` | 每日文档验证 | 文件系统 | 无 |
| `pre-review-check.ts` | 审查前检查 | 文件系统 | 无 |

**合并依据**：
- 共享相同的文档数据结构
- 共享相同的 VFS mock 基础设施
- 共享相同的文档断言工具
- 部分脚本依赖 git（可统一 mock）
- 无副作用

---

#### 功能域 4：MCP 架构与数据验证（6个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `audit-mcp.ts` | MCP架构审计 | 文件系统、MCP服务 | 无 |
| `validate-acl-impact.ts` | ACL影响验证 | 文件系统 | 无 |
| `validate-data-blueprint.ts` | 数据蓝图验证 | 文件系统 | 无 |
| `validate-data-consistency.ts` | 数据一致性验证 | 文件系统 | 无 |
| `validate-json.ts` | JSON验证 | 文件系统 | 无 |
| `create-mcp-server.ts` | MCP服务器创建 | 文件系统 | 有（文件写入） |

**合并依据**：
- 共享相同的 MCP/ACL 数据结构
- 共享相同的配置文件 mock
- `create-mcp-server.ts` 有副作用，需独立测试

---

#### 功能域 5：报告生成与可视化（6个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `build-health-report.ts` | 健康报告构建 | 文件系统 | 无 |
| `generate-tech-debt-report.ts` | 技术债务报告 | 文件系统 | 无 |
| `generate-store-graph.ts` | Store图生成 | 文件系统 | 无 |
| `generate-pdf-report.ts` | PDF报告生成 | 文件系统 | 有（文件写入） |
| `audit-visual.ts` | 数据展示效果审计 | 文件系统 | 无 |
| `workflow-rule-engine.ts` | 工作流规则引擎 | 文件系统 | 无 |

**合并依据**：
- 共享相同的报告数据结构
- 共享相同的图表/可视化断言工具
- `generate-pdf-report.ts` 有副作用，需独立测试

---

#### 功能域 6：测试与质量保障（4个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `audit-tests.ts` | 测试覆盖率审计 | 文件系统 | 无 |
| `detect-duplicate-tests.ts` | 重复测试检测 | 文件系统 | 无 |
| `translate-test-descriptions.ts` | 测试描述翻译 | 文件系统 | 无 |
| `test-hybrid-proofread.ts` | 混合校对测试 | 文件系统 | 无 |

**合并依据**：
- 共享相同的测试文件数据结构
- 共享相同的测试断言工具
- 无执行顺序依赖
- 无副作用

---

#### 功能域 7：AI 记忆与代码图（4个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `build-ai-memory-index.ts` | AI记忆索引构建 | 文件系统 | 有（文件写入） |
| `query-ai-memory.ts` | AI记忆查询 | 文件系统 | 无 |
| `extract-code-graph.ts` | 代码图提取 | 文件系统 | 有（文件写入） |
| `audit-token-consumption.ts` | Token消耗审计 | 文件系统 | 无 |

**合并依据**：
- 共享相同的 AI/代码图数据结构
- `build-ai-memory-index.ts` 和 `extract-code-graph.ts` 有副作用，需独立测试

---

#### 功能域 8：自动修复与优化（7个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `auto-fix-jsdoc.ts` | JSDoc自动修复 | 文件系统 | 有（文件写入） |
| `dedup-jsdoc.ts` | JSDoc去重 | 文件系统 | 有（文件写入） |
| `fix-layer-violations.ts` | 分层违规修复 | 文件系统 | 有（文件写入） |
| `fix-silent-fallback.ts` | 静默回退修复 | 文件系统 | 有（文件写入） |
| `optimize-silent-fallback.ts` | 静默回退优化 | 文件系统 | 有（文件写入） |
| `split-constants.ts` | 常量拆分 | 文件系统 | 有（文件写入） |
| `replace-date-now-ids.ts` | ID替换 | 文件系统 | 有（文件写入） |

**合并依据**：
- 全部有副作用（文件写入）
- 每个脚本都有独立的修复逻辑
- **必须全部独立测试**

---

#### 功能域 9：系统检查闭环（4个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `system-check-loop.ts` | 系统检查闭环 | 文件系统、git、子进程 | 有（报告生成） |
| `system-health-dashboard.ts` | 健康度仪表盘 | 文件系统、子进程 | 无 |
| `quality-config.ts` | 质量配置 | 文件系统、git | 无 |
| `lessons-learned.ts` | 教训总结 | 文件系统 | 有（文件写入） |

**合并依据**：
- `system-check-loop.ts` 是核心流程编排器，需独立测试
- `quality-config.ts` 是配置核心，需独立测试
- `system-health-dashboard.ts` 依赖前两者的输出，需独立测试
- `lessons-learned.ts` 有副作用，需独立测试
- **必须全部独立测试**

---

#### 功能域 10：工具与调试脚本（5个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `changelog-query.ts` | 变更日志查询 | 文件系统 | 无 |
| `complexity-scan.ts` | 复杂度扫描 | 文件系统 | 无 |
| `measure-complexity-now.ts` | 复杂度测量 | 文件系统 | 无 |
| `anomaly-detector.ts` | 异常检测 | 文件系统 | 无 |
| `inject-frontmatter.ts` | Frontmatter注入 | 文件系统 | 有（文件写入） |

**合并依据**：
- `changelog-query.ts`、`complexity-scan.ts`、`measure-complexity-now.ts`、`anomaly-detector.ts` 可合并测试
- `inject-frontmatter.ts` 有副作用，需独立测试

---

#### 功能域 11：内部管道脚本（2个脚本）

| 脚本 | 说明 | 依赖环境 | 副作用 |
|------|------|---------|--------|
| `_audit-pipeline.ts` | 审计管道（内部） | 文件系统 | 无 |
| `_verify-pipeline-child.ts` | 管道子验证（内部） | 文件系统 | 无 |

**合并依据**：
- 内部工具脚本，共享相同的管道数据结构
- 无副作用
- 可合并测试

---

## 三、合并测试规则

### 3.1 合并条件（全部满足）

| 条件 | 说明 |
|------|------|
| **同一功能域** | 脚本属于相同的功能域（如颜色审计、架构审计） |
| **共享mock基础设施** | 需要相同的 VFS、git、配置文件 mock |
| **共享断言工具** | 使用相同的断言函数和验证逻辑 |
| **无执行顺序依赖** | 脚本之间没有执行顺序要求，可并行测试 |
| **无副作用** | 不修改文件系统、不写入数据库、不发送网络请求 |
| **输出结构一致** | 返回的报告/数据结构相似，可统一验证 |

### 3.2 合并测试文件命名规则

```
{功能域}-audit-suite.test.ts
```

**示例**：
- `color-tokens-audit-suite.test.ts`（颜色与设计令牌审计域）
- `architecture-audit-suite.test.ts`（架构与分层审计域）
- `document-management-suite.test.ts`（文档管理域）

### 3.3 合并测试文件结构

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { setupVirtualFS, expectReportStructure, expectNoViolations } from '../_helpers/vfs-helpers'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
}))

describe('颜色与设计令牌审计域', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('audit-color-tokens.ts', () => {
    // 测试用例
  })

  describe('audit-inline-colors.ts', () => {
    // 测试用例
  })

  describe('audit-typography.ts', () => {
    // 测试用例
  })

  describe('audit-spacing.ts', () => {
    // 测试用例
  })

  describe('verify-design-tokens.ts', () => {
    // 测试用例
  })
})
```

---

## 四、独立测试判定依据

### 4.1 必须独立测试的条件（满足任一）

| 条件 | 说明 | 示例脚本 |
|------|------|---------|
| **有副作用** | 修改文件系统、写入数据库、发送网络请求 | `auto-fix-jsdoc.ts`、`fix-layer-violations.ts`、`generate-pdf-report.ts` |
| **涉及外部系统交互** | 调用 git 命令、MCP 服务、数据库连接 | `audit-mcp.ts`、`build-ai-memory-index.ts`、`extract-code-graph.ts` |
| **包含独立业务逻辑** | 有独特的决策逻辑或流程编排 | `quality-config.ts`、`system-check-loop.ts`、`system-health-dashboard.ts` |
| **执行顺序依赖** | 脚本之间有执行顺序要求 | `build-ai-memory-index.ts` → `query-ai-memory.ts` |
| **输出影响其他脚本** | 输出作为其他脚本的输入 | `quality-config.ts` 的阶段配置影响 `system-check-loop.ts` |

### 4.2 独立测试文件命名规则

```
{脚本名}.test.ts
```

**示例**：
- `quality-config.test.ts`
- `system-check-loop.test.ts`
- `system-health-dashboard.test.ts`
- `audit-mcp.test.ts`
- `auto-fix-jsdoc.test.ts`

### 4.3 独立测试文件结构

遵循现有测试的"白盒模式"：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('quality-config.ts（独立测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCurrentPhase()', () => {
    // 测试环境变量指定阶段
    // 测试基于 git commit 数自动判断
    // 测试边界条件（空仓库、git命令失败）
  })

  describe('getPhaseConfig()', () => {
    // 测试三阶段配置正确性
    // 测试阶段切换逻辑
  })

  describe('validateQualityGate()', () => {
    // 测试质量门禁验证
    // 测试阈值边界条件
  })
})
```

---

## 五、共享测试工具架构

### 5.1 目录结构

```
tests/__tests__/scripts/
├── _helpers/                    # 共享测试工具模块
│   ├── vfs-helpers.ts           # VFS mock 构建器
│   ├── assertion-helpers.ts     # 断言工具函数
│   ├── mock-factories.ts        # Mock 工厂函数
│   ├── report-validators.ts     # 报告结构验证器
│   └── git-mock.ts              # Git 命令 mock
├── color-tokens-audit-suite.test.ts
├── architecture-audit-suite.test.ts
├── document-management-suite.test.ts
├── mcp-validation-suite.test.ts
├── report-generation-suite.test.ts
├── testing-quality-suite.test.ts
├── ai-memory-suite.test.ts
├── tools-utils-suite.test.ts
├── pipeline-internal-suite.test.ts
├── quality-config.test.ts       # 独立测试
├── system-check-loop.test.ts    # 独立测试
├── system-health-dashboard.test.ts  # 独立测试
├── audit-mcp.test.ts            # 独立测试
├── auto-fix-jsdoc.test.ts       # 独立测试
├── ...（其他独立测试文件）
```

### 5.2 工具模块设计

#### 5.2.1 vfs-helpers.ts

```typescript
export type VirtualFile = {
  path: string
  content: string
}

export type VirtualDirectory = {
  path: string
  files: string[]
}

export function setupVirtualFS(files: VirtualFile[]): void
export function setupVirtualDirectory(dir: VirtualDirectory): void
export function clearVirtualFS(): void
export function getMockReadFileSync(): vi.Mock
export function getMockReaddirSync(): vi.Mock
```

#### 5.2.2 assertion-helpers.ts

```typescript
export function expectReportStructure(report: unknown): void
export function expectNoViolations(report: unknown): void
export function expectViolationCount(report: unknown, count: number): void
export function expectViolationInFile(report: unknown, filePath: string): void
export function expectSeverityDistribution(report: unknown, distribution: Record<string, number>): void
```

#### 5.2.3 mock-factories.ts

```typescript
export function createColorTokenMock(): Record<string, unknown>
export function createLayerRuleMock(): Record<string, unknown>
export function createComponentRegistryMock(): Record<string, unknown>
export function createMcpAclMock(): Record<string, unknown>
export function createStoreSchemaMock(): Record<string, unknown>
```

#### 5.2.4 report-validators.ts

```typescript
export interface AuditReport {
  violations: Violation[]
  warnings: Warning[]
  summary: Summary
}

export interface Violation {
  filePath: string
  line: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  category: string
}

export function validateReport(report: unknown): AuditReport
export function filterViolationsBySeverity(report: AuditReport, severity: string): Violation[]
export function filterViolationsByCategory(report: AuditReport, category: string): Violation[]
```

#### 5.2.5 git-mock.ts

```typescript
export function mockGitLog(output: string): void
export function mockGitDiff(output: string): void
export function mockGitBranch(output: string): void
export function getGitLogCallCount(): number
export function clearGitMocks(): void
```

---

## 六、逻辑一致性保障措施

### 6.1 与现有测试模式的一致性

| 维度 | 现有模式 | 新增测试要求 |
|------|---------|-------------|
| **测试类型** | 白盒测试 | 统一使用白盒测试模式 |
| **函数导出** | `scan()` / `formatReport()` / `main()` | 统一导出这三个函数 |
| **报告结构** | `{ violations, warnings, summary }` | 统一报告结构 |
| **Mock 方式** | `vi.mock('node:fs')` | 统一使用 vi.mock |
| **测试描述** | `describe('xxx.ts v3.0（白盒测试）')` | 统一测试描述格式 |
| **边界条件** | 空目录、不存在目录、文件读取失败 | 统一覆盖边界条件 |

### 6.2 架构连贯性保障

1. **统一入口**：所有测试文件通过 `tests/__tests__/scripts/` 目录统一管理
2. **共享工具**：所有测试使用 `_helpers/` 模块提供的工具函数，避免重复实现
3. **统一断言**：使用 `assertion-helpers.ts` 提供的断言函数，确保断言逻辑一致
4. **统一报告结构**：所有审计脚本返回统一的 `AuditReport` 结构
5. **统一 Mock 策略**：使用 `mock-factories.ts` 提供的 mock 工厂，确保 mock 数据一致

### 6.3 测试质量门禁

```powershell
# 新增脚本必须同步新增测试
# 测试覆盖率低于 80% 时阻止合并
npx vitest run --coverage --reporter=html

# 测试文件必须通过类型检查
npx tsc --noEmit
```

---

## 七、实施计划

### 7.1 分阶段实施

| 阶段 | 时间 | 功能域 | 测试文件数量 | 预计工时 |
|------|------|--------|------------|---------|
| **第一阶段** | 第1周 | 颜色与设计令牌审计域 | 1个合并文件 | 8h |
| **第二阶段** | 第2周 | 架构与分层审计域、工具与调试脚本、内部管道脚本 | 3个合并文件 | 12h |
| **第三阶段** | 第3周 | 文档管理域、测试与质量保障域 | 2个合并文件 | 10h |
| **第四阶段** | 第4周 | MCP架构与数据验证域、报告生成与可视化域、AI记忆与代码图域 | 3个合并文件 + 3个独立文件 | 15h |
| **第五阶段** | 第5周 | 系统检查闭环域（4个独立文件） | 4个独立文件 | 15h |
| **第六阶段** | 第6周 | 自动修复与优化域（7个独立文件） | 7个独立文件 | 14h |
| **合计** | 6周 | - | 12个合并文件 + 14个独立文件 | 74h |

### 7.2 第一阶段详细计划

**目标**：完成颜色与设计令牌审计域的测试（5个脚本合并为1个测试文件）

**测试文件**：`color-tokens-audit-suite.test.ts`

**测试覆盖**：

| 脚本 | 测试用例 | 覆盖维度 |
|------|---------|---------|
| `audit-color-tokens.ts` | 1. 颜色令牌合规检测<br>2. 硬编码颜色检测<br>3. 豁免规则验证<br>4. 报告结构验证<br>5. 边界条件（空目录、文件读取失败） | 核心功能、边界条件 |
| `audit-inline-colors.ts` | 1. 内联颜色检测<br>2. 排除规则验证<br>3. 报告结构验证<br>4. 边界条件 | 核心功能、边界条件 |
| `audit-typography.ts` | 1. 排版令牌合规检测<br>2. 字体大小/字重/行高检查<br>3. 报告结构验证<br>4. 边界条件 | 核心功能、边界条件 |
| `audit-spacing.ts` | 1. 间距令牌合规检测<br>2. 间距值验证<br>3. 报告结构验证<br>4. 边界条件 | 核心功能、边界条件 |
| `verify-design-tokens.ts` | 1. 令牌一致性验证<br>2. 令牌完整性检查<br>3. 报告结构验证<br>4. 边界条件 | 核心功能、边界条件 |

**共享工具**：
- `_helpers/vfs-helpers.ts` - VFS mock
- `_helpers/assertion-helpers.ts` - 断言工具
- `_helpers/mock-factories.ts` - 颜色令牌 mock

---

## 八、测试文件清单汇总

### 8.1 合并测试文件（12个）

| 测试文件 | 功能域 | 包含脚本数 |
|---------|--------|-----------|
| `color-tokens-audit-suite.test.ts` | 颜色与设计令牌审计 | 5 |
| `architecture-audit-suite.test.ts` | 架构与分层审计 | 5 |
| `document-management-suite.test.ts` | 文档管理 | 6 |
| `mcp-validation-suite.test.ts` | MCP架构与数据验证（无副作用部分） | 5 |
| `report-generation-suite.test.ts` | 报告生成与可视化（无副作用部分） | 5 |
| `testing-quality-suite.test.ts` | 测试与质量保障 | 4 |
| `ai-memory-suite.test.ts` | AI记忆与代码图（无副作用部分） | 2 |
| `tools-utils-suite.test.ts` | 工具与调试脚本（无副作用部分） | 4 |
| `pipeline-internal-suite.test.ts` | 内部管道脚本 | 2 |
| `auto-fix-jsdoc.test.ts` | 自动修复（独立） | 1 |
| `fix-layer-violations.test.ts` | 分层修复（独立） | 1 |
| `generate-pdf-report.test.ts` | PDF生成（独立） | 1 |

### 8.2 独立测试文件（14个）

| 测试文件 | 脚本 | 独立原因 |
|---------|------|---------|
| `quality-config.test.ts` | `quality-config.ts` | 独立业务逻辑（阶段判断） |
| `system-check-loop.test.ts` | `system-check-loop.ts` | 核心流程编排器 |
| `system-health-dashboard.test.ts` | `system-health-dashboard.ts` | 10维度评分计算 |
| `audit-mcp.test.ts` | `audit-mcp.ts` | MCP服务交互 |
| `create-mcp-server.test.ts` | `create-mcp-server.ts` | 文件写入副作用 |
| `build-ai-memory-index.test.ts` | `build-ai-memory-index.ts` | 文件写入副作用 |
| `extract-code-graph.test.ts` | `extract-code-graph.ts` | 文件写入副作用 |
| `dedup-jsdoc.test.ts` | `dedup-jsdoc.ts` | 文件写入副作用 |
| `fix-silent-fallback.test.ts` | `fix-silent-fallback.ts` | 文件写入副作用 |
| `optimize-silent-fallback.test.ts` | `optimize-silent-fallback.ts` | 文件写入副作用 |
| `split-constants.test.ts` | `split-constants.ts` | 文件写入副作用 |
| `replace-date-now-ids.test.ts` | `replace-date-now-ids.ts` | 文件写入副作用 |
| `lessons-learned.test.ts` | `lessons-learned.ts` | 文件写入副作用 |
| `inject-frontmatter.test.ts` | `inject-frontmatter.ts` | 文件写入副作用 |

### 8.3 已有测试文件（9个）

| 测试文件 | 脚本 |
|---------|------|
| `audit-layer-calls.test.ts` | `audit-layer-calls.ts` |
| `audit-hardcode.test.ts` | `audit-hardcode.ts` |
| `audit-dead-code.test.ts` | `audit-dead-code.ts` |
| `audit-doc-sync.test.ts` | `audit-doc-sync.ts` |
| `audit-token-consumption.test.ts` | `audit-token-consumption.ts` |
| `daily-doc-validation.test.ts` | `daily-doc-validation.ts` |
| `verify-all-routes.test.ts` | `verify-all-routes.ts` |
| `audit-mapping-integrity.test.ts` | `audit-mapping-integrity.ts` |
| `audit-split-quality.test.ts` | `audit-split-quality.ts` |

### 8.4 总计

| 项目 | 数量 |
|------|------|
| 脚本总数 | 62 |
| 已有测试 | 9 |
| 合并测试文件 | 12（覆盖 40 个脚本） |
| 独立测试文件 | 14（覆盖 14 个脚本） |
| 新增测试文件 | 26 |
| 测试覆盖率 | 100% |

---

## 九、设计验证

### 9.1 验证标准

| 验证项 | 标准 | 验证方法 |
|--------|------|---------|
| **合并合理性** | 同一功能域的脚本共享 > 70% 的 mock 基础设施 | 代码审查 |
| **独立性判定** | 有副作用/外部交互的脚本全部独立测试 | 代码审查 |
| **逻辑一致性** | 新增测试与现有测试模式一致 | 测试运行 |
| **架构连贯性** | 共享工具模块被所有测试文件引用 | 代码审查 |
| **测试覆盖率** | 所有脚本测试覆盖率 ≥ 80% | `npx vitest run --coverage` |

### 9.2 验证命令

```powershell
# 运行所有测试
npx vitest run

# 运行特定功能域测试
npx vitest run color-tokens-audit-suite

# 检查测试覆盖率
npx vitest run --coverage

# 类型检查
npx tsc --noEmit
```

---

## 十、风险与应对

| 风险 | 等级 | 应对策略 |
|------|------|---------|
| 合并测试文件过大，维护困难 | 中 | 每个合并文件不超过 800 行，超过则拆分 |
| 共享工具模块变更影响所有测试 | 高 | 共享模块采用稳定接口设计，变更需经过充分测试 |
| 独立测试文件过多，执行时间长 | 中 | 使用并行测试（`--parallel`），设置合理超时 |
| 外部系统 mock 不完整 | 中 | 建立 mock 工厂，确保覆盖所有外部交互场景 |
| 测试质量门禁导致开发效率下降 | 低 | 设置合理的覆盖率阈值（≥80%），允许渐进式提升 |
