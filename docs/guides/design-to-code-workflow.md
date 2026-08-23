---
title: "Design→Code 工作流规范"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.2
change_log:
  - version: v1.0.2
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v1.0.1) → R2 PATCH++(v1.0.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
- version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

---
title: Design→Code 工作流规范
type: how-to
domain: frontend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "定义从视觉设计产物（.zip）到可运行生产代码的端到端工作流，包含 6 项强制门禁与交付物清单。目标读者：设计师、前端开发者、Code Reviewer。"
tags: [workflow, design, frontend, audit, tokens]
version: v1.2.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-GUIDE-DESIGN-CODE-001
referenced_by: [V9-DOC-QA-065, V9-DOC-PROJ-016]
change_log:
  - version: v1.2.0
    changes: "新增第 3.3 节令牌验证 Utility 文档（API 参考 + 使用场景 + 设计约束）"
    date: 2026-08-15
  - version: v1.1.0
    changes: "旧版令牌残留检查标记为已完成并归档；新增第 10 节验证记录"
    date: 2026-08-15
  - version: v1.0.0
    changes: "建立 Design→Code 工作流规范，对齐 V5 Apple Business Design Tokens 落地"
    date: 2026-08-15
---

# Design→Code 工作流规范

> **Status**: Active
> **Version**: v1.0.0
> **适用范围**: 所有涉及 UI 视觉设计→前端代码实现的变更
> **强制等级**: 设计师与前端开发者必须遵守
> **配套文档**: [09. 质量门禁](09-quality-gates.md)（门禁标准定义）、[coding-conventions.md](standards/coding-conventions.md)

---

## 1. 工作流总览

```
Design 模式（视觉设计）
         │
         ▼
   导出 .zip（设计产物 + 视觉资源）
         │
         ▼
Code 模式（接收 .zip + 生成指令）
         │
         ▼
   生成代码 → 需遵守：
   ├── 架构分层（audit:layers）
   ├── 原子设计（audit:atomic）
   ├── 颜色令牌（audit:hardcode）
   ├── 类型安全（tsc --noEmit）
   ├── 组件注册（audit:widget-registry）
   └── 测试通过（npm run test）
         │
         ▼
   可运行的生产代码
```

本工作流由两个角色（设计师 / 前端开发者）协作完成，6 项门禁为**硬性门槛**，任何一项未通过禁止合并。

---

## 2. Design 模式 — 设计师职责

### 2.1 设计令牌定义

设计师在 Figma / Sketch 等工具中定义设计令牌，必须对齐以下真相源：

| 令牌类别 | 真相源文件 | 关键令牌示例 |
|----------|------------|--------------|
| 色彩 | [src/index.css](../../src/index.css) `:root` | `--primary` (Apple Blue #007AFF)、`--background` (#F2F2F7)、`--card` (#FFFFFF) |
| A 股涨跌色 | 同上 | `--stock-up` (红涨)、`--stock-down` (绿跌) — 豁免主题切换 |
| 圆角 | 同上 | `--radius: 1rem` (16px) |
| 阴影层级 | 同上 | `--shadow-sm/md/lg`（静态 alpha≤0.05 / 浮层 alpha≤0.08） |
| 排版 | [tailwind.config.js](../../tailwind.config.js) `fontSize` | `display/h1-h6/body-lg/body/body-sm/caption/overline` |
| 字体栈 | 同上 `fontFamily.sans` | DM Sans → SF Pro Display → Inter → PingFang SC → Microsoft YaHei |

> ⚠ **禁令**: 设计稿中禁止引入与上述令牌命名空间冲突的新令牌（如旧版 `--color-*`）。新令牌须先在 [index.css](../../src/index.css) 落地后再用于设计稿。

### 2.2 .zip 交付物清单

设计稿完成后导出 `.zip`，必须包含以下产物：

```
finsight-v9-ui-review-delivery-v{N}.zip
├── *.html                    # 各舱室视觉稿（home/input/cockpit/analysis/trading/output）
├── colors_and_type.css       # 设计令牌 CSS（供开发者比对，不直接引入项目）
├── *.design                  # 原始设计文件（Figma/Sketch 导出）
├── assets/                   # 图片/SVG/字体等视觉资源
└── validation-report.json    # 设计稿自检报告（颜色对比度、字号层级等）
```

### 2.3 设计稿自检清单

交付前设计师须完成以下自检：

- [ ] 主色为 Apple Blue `#007AFF`（HSL `210 100% 50%`）
- [ ] 背景色为 `#F2F2F7`（HSL `240 24% 96%`）
- [ ] 卡片使用阴影而非边框分隔（`shadow-sm/md/lg`，禁止 `border`）
- [ ] 圆角统一为 16px（`--radius`）
- [ ] 涨红跌绿（A 股配色，非美股配色）
- [ ] CJK 字距为 `0`（不使用负字距）
- [ ] 暗色模式变量已定义（`.dark` 类）

---

## 3. Code 模式 — 前端开发者职责

### 3.1 接收 .zip 后的预处理

1. **解压至 `dogfood-output/ui-reference/`**（与历史交付物并列，便于版本对比）
2. **比对 `colors_and_type.css` 与 [src/index.css](../../src/index.css)**：确认设计令牌已落地，如有差异先更新 `index.css`
3. **确认无旧版令牌残留**：搜索 `--color-*`、`--spacing-*`、`--fontSize-*` 等旧命名空间，应为 0 结果

> ✅ **验证已完成（2026-08-15）**: 旧版 `tokens.css` 及其生成管道（`generate-tokens.ts` / `design-tokens/tokens.json`）已彻底清除。`src/index.css` 为唯一真相源（V5 Apple Business Design）。运行时验证 15 项令牌全部通过，4 个旧版令牌（`--color-primary`、`--color-secondary`、`--spacing-1`、`--fontSize-body`）均为空。详见 [验证记录](#10-验证记录)。

### 3.2 代码实现规范

#### 3.2.1 组件分层（原子设计）

组件必须按以下层级归位，禁止跨层：

```
src/components/
├── atoms/          # 原子组件（Button、Input、Badge 等单一职责）
├── molecules/      # 分子组件（SearchBar、FormField 等原子组合）
├── organisms/      # 生物组件（Header、Sidebar、Card 等分子组合）
├── templates/      # 模板组件（SidebarLayout 等页面骨架）
├── widgets/        # 业务组件（WidgetRegistry 注册的舱室组件）
├── cockpit/        # 驾驶舱专属组件
├── cabin/          # 舱室专属组件
├── chart/          # 图表组件
├── common/         # 通用工具组件
└── registry/       # 组件注册中心
```

#### 3.2.2 设计令牌使用

- **Tailwind 类名优先**：`bg-background`、`text-primary`、`shadow-elevation-1` 等
- **避免内联样式**：确需动态值时使用 `hsl(var(--token))` 形式
- **禁止硬编码色值**：`#007AFF`、`rgb(0,122,255)` 等直接写法禁止（除 `index.css` 令牌定义处）

#### 3.2.3 主题切换

- 明/暗模式通过 `.dark` 类切换，所有颜色变量在 `:root` 与 `.dark` 中成对定义
- A 股涨跌色（`--stock-up/down`）豁免主题切换，两套模式下保持一致

### 3.3 令牌验证 Utility

项目内置 [src/lib/designTokenVerifier.ts](../../src/lib/designTokenVerifier.ts)，提供运行时令牌验证能力，封装了 15 项 V5 令牌采集、期望值对比、旧版残留检测逻辑。

#### API 参考

| 函数 | 签名 | 返回值 | 适用场景 |
|------|------|--------|----------|
| `collectDesignTokens` | `(el?: Element) => TokenVerificationResult` | 结构化令牌数据 | 测试、其他模块获取令牌数据（不输出日志） |
| `verifyDesignTokens` | `(el?: Element) => TokenVerificationResult` | 同上 | 采集 + 输出结构化日志（含期望值对比） |
| `verifyDesignTokensOnReady` | `() => void` | `void` | 应用入口一键调用（自动处理 DOM 就绪 + DEV 守卫） |

#### 返回值结构

```typescript
interface TokenVerificationResult {
  theme: 'light' | 'dark'
  tokens: Record<string, string>      // 15 个 V5 令牌的实际值
  legacyTokens: Record<string, string> // 4 个旧版令牌（应为空）
  expected: Record<string, string>     // 当前主题的期望值
  missing: string[]                    // 缺失的令牌 key
  mismatched: string[]                 // 与期望值不匹配的 key
  legacyFound: string[]                // 仍存在旧版令牌的 key
  passed: boolean                      // 是否全部通过
}
```

#### 使用场景与最佳实践

**场景 1：应用入口初始化验证**

```typescript
// src/main.tsx
import { verifyDesignTokensOnReady } from '@/lib/designTokenVerifier'
verifyDesignTokensOnReady()  // DEV 环境自动验证，生产构建 tree-shake 移除
```

**场景 2：主题切换后重新验证**

```typescript
import { verifyDesignTokens } from '@/lib/designTokenVerifier'

useThemeStore.subscribe(() => {
  verifyDesignTokens()  // 主题切换后立即重新验证
})
```

**场景 3：单元测试中断言令牌状态**

```typescript
import { collectDesignTokens } from '@/lib/designTokenVerifier'

const result = collectDesignTokens()
expect(result.passed).toBe(true)
expect(result.missing).toEqual([])
```

#### 设计约束

- **DEV 守卫**：所有函数内部检查 `import.meta.env.DEV`，生产构建时 Vite 将整段代码 tree-shake 移除，零运行时开销
- **零依赖**：仅依赖 `@/lib/logger`，不引入任何框架耦合
- **纯函数**：`collectDesignTokens` 无副作用，可在任何环境（含测试）安全调用
- **测试覆盖**：17 个单元测试覆盖 light/dark 模式、缺失/不匹配/旧版残留等场景，详见 [designTokenVerifier.test.ts](../../src/lib/designTokenVerifier.test.ts)

---

## 4. 6 项强制门禁

代码生成完成后，必须依次通过以下 6 项门禁。任何一项失败禁止合并到 `main` 分支。

### 4.1 架构分层审计（audit:layers）

| 项 | 值 |
|----|-----|
| **命令** | `npm run audit:layers` |
| **脚本** | [scripts/audit/audit-layer-calls.ts](../../scripts/audit/audit-layer-calls.ts) |
| **目标** | 0 违规、0 警告 |
| **检查内容** | core/ 层禁止直接操作 dataLayer；services/ 层禁止跨域调用；components/ 层禁止直接访问 store |

### 4.2 原子设计审计（audit:atomic）

| 项 | 值 |
|----|-----|
| **命令** | `npm run audit:atomic` |
| **脚本** | [scripts/audit/audit-atomic.ts](../../scripts/audit/audit-atomic.ts) |
| **目标** | 组件归位正确、无跨层引用 |
| **检查内容** | atoms 不引用 molecules；molecules 不引用 organisms；层级依赖方向正确 |

### 4.3 颜色令牌审计（audit:hardcode）

| 项 | 值 |
|----|-----|
| **命令** | `npm run audit:hardcode` |
| **脚本** | [scripts/audit/audit-hardcode.ts](../../scripts/audit/audit-hardcode.ts) |
| **目标** | 0 硬编码颜色、0 硬编码阈值 |
| **检查内容** | 扫描 `#hex`、`rgb()`、`rgba()` 等硬编码色值；扫描魔法数字阈值 |

> 💡 **配套命令**: `npm run lint:colors`（ESLint 颜色专用规则）、`npm run audit:colorTokens`（令牌一致性）

### 4.4 类型安全检查（tsc --noEmit）

| 项 | 值 |
|----|-----|
| **命令** | `npm run tsc:prod` |
| **目标** | 0 errors |
| **配置** | [tsconfig.prod.json](../../tsconfig.prod.json)（排除测试文件，仅校验生产代码） |
| **检查内容** | 类型错误、`any` 滥用、未使用声明 |

> ⚠ **禁止**: 不得使用 `// @ts-ignore` 绕过类型错误，须修复根因。

### 4.5 组件注册审计（audit:widget-registry）

| 项 | 值 |
|----|-----|
| **命令** | `npm run audit:widget-registry` |
| **脚本** | [scripts/audit/audit-widget-registry.ts](../../scripts/audit/audit-widget-registry.ts) |
| **目标** | 注册一致性 100% |
| **检查内容** | WidgetRegistry 中注册的组件与实际导出一致；无僵尸注册；无未注册的页面引用 |

### 4.6 测试通过（npm run test）

| 项 | 值 |
|----|-----|
| **命令** | `npm run test` |
| **目标** | 全部通过（预存失败已在 [vite.config.ts](../../vite.config.ts) `PREEXISTING_TEST_FAILURES` 中排除） |
| **检查内容** | 单元测试 + 集成测试 + 组件测试 |

> 💡 **新增组件须补充测试**: 参考 [testing-strategy.md](testing-strategy.md)

---

## 5. 完整门禁链一键执行

依次执行所有门禁（耗时约 5-10 分钟）：

```bash
# 1. 架构分层
npm run audit:layers

# 2. 原子设计
npm run audit:atomic

# 3. 颜色令牌
npm run audit:hardcode
npm run lint:colors

# 4. 类型安全
npm run tsc:prod

# 5. 组件注册
npm run audit:widget-registry

# 6. 测试
npm run test

# 7. 生产构建（最终验证）
npm run build
```

或执行项目预置的全量审计命令（包含上述门禁及其他审计项）：

```bash
npm run audit
```

---

## 6. 交付物清单

Code 模式完成后，须交付以下产物：

| 产物 | 位置 | 说明 |
|------|------|------|
| 源代码 | `src/` | 遵循分层规范的新增/修改代码 |
| 设计令牌 | [src/index.css](../../src/index.css) | 如有令牌变更，更新真相源 |
| 组件注册 | [src/components/registry/](../../src/components/registry/) | 新增 Widget 须注册 |
| 单元测试 | `src/**/*.test.ts(x)` | 新增组件须配套测试 |
| 门禁报告 | `outputs/` | 审计脚本输出（可选） |
| Dogfood 报告 | `../../dogfood-output/report.md` | UI 上线前测试报告（参考 [dogfood SKILL](.trae-cn/skills/dogfood)） |

---

## 7. 异常处理

### 7.1 设计令牌冲突

**场景**: 设计稿引入了与 `index.css` 冲突的新令牌（如旧版 `--color-primary`）。

**处理**:
1. 以 [src/index.css](../../src/index.css) 为唯一真相源
2. 设计稿中的冲突令牌视为无效，须设计师修订后重新交付
3. 如确需新增令牌，先在 `index.css` 落地，再用于设计稿

### 7.2 门禁失败

**场景**: 某项门禁未通过。

**处理**:
1. 禁止使用 `--no-verify` 绕过 git hook
2. 禁止在 `PREEXISTING_TEST_FAILURES` 中新增排除项（除非经架构评审）
3. 修复根因后重新执行门禁链

### 7.3 设计稿与实现不一致

**场景**: 实现后的 UI 与设计稿视觉不符。

**处理**:
1. 运行 [dogfood SKILL](.trae-cn/skills/dogfood) 进行 UI 上线前测试
2. 生成 `../../dogfood-output/report.md` 记录差异点
3. 差异分为 Critical / High / Medium / Low 四级，Critical 必须修复后才能上线

---

## 8. 角色职责矩阵

| 职责 | 设计师 | 前端开发者 | Code Reviewer |
|------|--------|------------|---------------|
| 定义设计令牌 | ✅ 主导 | 🔄 协同 | ⚠ 审查 |
| 导出 .zip 交付物 | ✅ 主导 | — | — |
| 令牌落地 index.css | 🔄 协同 | ✅ 主导 | ⚠ 审查 |
| 组件分层实现 | — | ✅ 主导 | ⚠ 审查 |
| 执行 6 项门禁 | — | ✅ 主导 | ⚠ 抽检 |
| Dogfood UI 测试 | — | ✅ 主导 | ⚠ 抽检 |
| 合并到 main | — | — | ✅ 主导 |

---

## 9. 参考文档

- [09. 质量门禁](09-quality-gates.md) — 门禁标准完整定义
- [coding-conventions.md](standards/coding-conventions.md) — 编码规范
- [component-admission-policy.md](component-admission-policy.md) — 组件准入策略
- [widget-development-guide.md](widget-development-guide.md) — Widget 开发指南
- [testing-strategy.md](testing-strategy.md) — 测试策略
- [踩坑规则门禁指南](踩坑规则门禁指南.md) — 踩坑规则

---

## 10. 验证记录

### 10.1 旧版令牌残留检查（2026-08-15 完成）

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `src/index.css` 中 `--color-*` 定义 | ✅ 0 处 | 全文核查，仅注释中提及禁令 |
| `src/index.css` 中 `--spacing-*` / `--fontSize-*` | ✅ 0 处 | 使用 `--fs-*` 命名空间 |
| `src/` 全目录 `--color-primary` 引用 | ✅ 仅 3 处 | 全部位于 [main.tsx](../../src/main.tsx) 运行时验证代码（防御性探测） |
| 旧版 `tokens.css` 文件 | ✅ 已删除 | src/generated/tokens.css 不存在 |
| 旧版 `generate-tokens.ts` 脚本 | ✅ 已删除 | scripts/generate-tokens.ts 不存在 |
| 旧版 `design-tokens/tokens.json` | ✅ 已删除 | `design-tokens/tokens.json` 不存在 |
| `package.json` `generate:tokens` 脚本 | ✅ 已移除 | `prebuild` 钩子不再调用 |
| 生产 bundle 旧令牌残留 | ✅ 0 处 | `npm run build` 后 `dist/` 搜索 `TokenVerify` 为 0 |

### 10.2 运行时令牌加载验证（2026-08-15 完成）

通过 Playwright 自动化在 `http://127.0.0.1:5199` 执行运行时验证，[main.tsx](../../src/main.tsx) 中的 `_verifyDesignTokens()` 函数输出以下结果：

| 令牌类别 | 令牌 | 实际值 | 期望值 | 状态 |
|----------|------|--------|--------|------|
| 核心色彩 | `--primary` | `210 100% 50%` | `210 100% 50%` | ✅ |
| 核心色彩 | `--background` | `240 24% 96%` | `240 24% 96%` | ✅ |
| 核心色彩 | `--card` | `0 0% 100%` | `0 0% 100%` | ✅ |
| A 股 | `--stock-up` | `0 84% 60%` | 红涨 | ✅ |
| A 股 | `--stock-down` | `142 56% 49%` | 绿跌 | ✅ |
| 圆角 | `--radius` | `1rem` | 16px | ✅ |
| 阴影 | `--shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.04)` | alpha≤0.05 | ✅ |
| 阴影 | `--shadow-lg` | `0 8px 24px -8px rgba(0,0,0,0.08)` | alpha≤0.08 | ✅ |
| 排版 | `--fs-display` | `1.75rem` | 28px | ✅ |
| 旧版残留 | `--color-primary` | （空） | 应为空 | ✅ |
| 旧版残留 | `--spacing-1` | （空） | 应为空 | ✅ |

**总结**: 15 项令牌全部通过，4 个旧版令牌均为空，0 页面错误。

截图证据: [dogfood-output/token-verify-v5.png](../../dogfood-output/token-verify-v5.png)

---

## 11. 变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-08-15 | 建立 Design→Code 工作流规范，对齐 V5 Apple Business Design Tokens 落地 |
| v1.1.0 | 2026-08-15 | 旧版令牌残留检查标记为已完成并归档；新增第 10 节验证记录（静态检查 + 运行时验证） |
