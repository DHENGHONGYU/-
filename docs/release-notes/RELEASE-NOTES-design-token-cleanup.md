---
title: docs/release-notes/RELEASE-NOTES-design-token-cleanup.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# FinSightV9 设计令牌清理与验证 Utility 重构 — Release Notes

**发布日期**: 2026-08-15
**版本类型**: 技术债清理 + Utility 封装
**影响范围**: 设计令牌系统、主题切换、开发时验证
**前序状态**: 双套令牌系统并存（Apple Business V5 + 旧版 slate）

---

## 变更摘要

| 分类 | 变更项 | 严重程度 | 影响范围 |
|------|--------|---------|---------|
| 🗑️ **旧令牌清除** | 删除 tokens.css / tokens.ts / generate-tokens.ts / tokens.json | **P0 阻塞** | 令牌系统唯一性 |
| 📦 **Utility 封装** | 新增 designTokenVerifier.ts 模块（3 个导出函数） | **P1 严重** | 开发时验证能力 |
| 🧪 **测试覆盖** | 17 个单元测试 + Playwright E2E 验证 | **P1 严重** | 回归防护 |
| 📝 **文档更新** | Design→Code 工作流规范 v1.0→v1.2 + CHANGELOG | **P2 优化** | 团队参考 |
| 🔗 **主题集成** | themeStore 主题切换后自动重验证 | **P2 优化** | 开发体验 |

---

## 1. 旧版双套令牌系统清除（P0）

### 问题

项目存在两套并行令牌系统：
- **V5 Apple Business**（`src/index.css`）：主色 `#007AFF`、背景 `#F2F2F7`、16px 圆角
- **旧版 slate**（src/generated/tokens.css）：暗色 primary `#157958`（翡翠绿），与 Apple Blue 冲突

暗色模式切换时存在色值错乱风险。

### 清除清单

| 文件 | 类型 | 操作 |
|------|------|------|
| src/generated/tokens.css | 旧版 slate 色彩令牌（178 行） | 已删除 |
| src/generated/tokens.ts | 旧版 TypeScript 常量 | 已删除 |
| scripts/generate-tokens.ts | 令牌自动生成器 | 已删除 |
| `design-tokens/tokens.json` | 旧版令牌源数据 | 已删除 |
| `package.json` `prebuild` 钩子 | `generate:tokens` 调用 | 已移除 |
| `src/main.tsx` `import` | `import './generated/tokens.css'` | 已移除 |

### 保留项

- `src/index.css` — **唯一真相源**（V5 Apple Business Design Tokens）
- `design-tokens/figma-to-project.json` / `project-to-figma.json` — Figma 设计工具同步映射（非运行时令牌，保留）

---

## 2. 设计令牌验证 Utility 模块（P1）

### 新增文件

**[src/lib/designTokenVerifier.ts](../../src/lib/designTokenVerifier.ts)**

| 函数 | 签名 | 用途 |
|------|------|------|
| `collectDesignTokens(el?)` | `(el?: Element) => TokenVerificationResult` | 纯函数，采集 15 个 V5 令牌 + 4 个旧版令牌 |
| `verifyDesignTokens(el?)` | `(el?: Element) => TokenVerificationResult` | 采集 + 输出结构化日志（含期望值对比） |
| `verifyDesignTokensOnReady()` | `() => void` | 便捷封装（DOM 就绪 + DEV 守卫） |

### 设计约束

- **DEV 守卫**：所有函数内部 `import.meta.env.DEV` 检查，生产构建 Vite tree-shake 完全移除
- **零依赖**：仅依赖 `@/lib/logger`
- **纯函数**：`collectDesignTokens` 无副作用，可在测试中安全调用

---

## 3. 主题切换自动重验证集成（P2）

### 修改文件

**[src/store/themeStore.ts](../../src/store/themeStore.ts)**

在 `applyTheme()` 函数中集成验证逻辑：

```typescript
function applyTheme(resolvedMode: 'light' | 'dark'): void {
  // ... 应用主题到 DOM ...
  if (import.meta.env.DEV) {
    requestAnimationFrame(() => verifyDesignTokens())
  }
}
```

### 覆盖路径

`applyTheme()` 是所有主题切换的必经之路，覆盖 5 条路径：

| 路径 | 触发场景 |
|------|----------|
| `setMode(mode)` | 用户手动选择主题 |
| `toggleTheme()` | 一键明暗切换 |
| `cycleMode()` | PortalShell 顶栏循环切换 |
| `initSystemThemeListener` | 系统主题变化（mode=system 时） |
| `onRehydrateStorage` | 页面刷新后从 localStorage 恢复 |

`requestAnimationFrame` 确保在浏览器重新计算 CSS 变量后才验证，避免读到旧值。

---

## 4. main.tsx 简化

### 修改前（120 行内联验证逻辑）

```typescript
if (import.meta.env.DEV) {
  const _verifyDesignTokens = () => { /* 120 行 */ }
  // ...
}
```

### 修改后（2 行）

```typescript
import { verifyDesignTokensOnReady } from '@/lib/designTokenVerifier'
verifyDesignTokensOnReady()
```

---

## 5. 测试覆盖

### 单元测试

**[src/lib/designTokenVerifier.test.ts](../../src/lib/designTokenVerifier.test.ts)** — 17 个用例

| 函数 | 用例数 | 覆盖场景 |
|------|--------|----------|
| `collectDesignTokens` | 10 | light/dark 模式、缺失令牌、不匹配令牌、旧版残留、多种异常并存、默认参数、令牌数量 |
| `verifyDesignTokens` | 4 | DEV=false 跳过、DEV=true 通过/失败日志、返回值一致性 |
| `verifyDesignTokensOnReady` | 3 | DEV=false 跳过、DOM loading 注册事件、DOM complete 直接执行 |

```
Test Files  1 passed (1)
     Tests  17 passed (17)
  Duration  1.08s
```

### E2E 测试（Playwright）

| 场景 | 结果 |
|------|------|
| Light 模式初始加载 | `--primary: 210 100% 50%` ✅ |
| 切换到 Dark 模式 | `--primary: 210 100% 60%` ✅ |
| 切回 Light 模式 | `--primary: 210 100% 50%` ✅ |
| Dark 模式 TokenVerify 日志 | 92 条，验证全部通过 ✅ |
| 旧版 `--color-primary` | light/dark 均为空 ✅ |
| 页面错误 | 0 个 ✅ |

截图证据：
- `dogfood-output/e2e-theme-light.png`
- `dogfood-output/e2e-theme-dark.png`
- `dogfood-output/token-verify-v5.png`

---

## 6. 构建验证

```
npm run build
✓ 3223 modules transformed
✓ built in ~12s
exit code: 0
```

### 生产 Bundle Tree-shake 验证

在 `dist/assets/index-*.js` 中搜索：

| 关键词 | 结果 |
|--------|------|
| `TokenVerify` | 0 处 ✅ |
| `旧版 tokens.css` | 0 处 ✅ |
| `MISSING` | 0 处 ✅ |

DEV 守卫验证通过，生产环境零运行时开销。

---

## 7. 旧版 Token 残留全面检查

| 检查项 | 结果 |
|--------|------|
| `src/` 中 `--color-*` 令牌定义 | 0 处 ✅ |
| `src/` 中 `--spacing-*` / `--fontSize-*` / `--borderRadius-*` 定义 | 0 处 ✅ |
| `src/` 中 `tokens.css` / `generated/tokens` 引用 | 0 处 ✅ |
| `src/generated/` 目录 | 不存在 ✅ |
| `package.json` `generate:tokens` 脚本 | 已移除 ✅ |
| `src/main.tsx` 中旧版 import | 已移除 ✅ |
| `design-tokens/` 目录 | 仅 Figma 映射文件（非运行时令牌） ✅ |
| 审计报告中的引用 | `scripts/audit/docs/reports/` 中的审计产物（非源码） ✅ |

**结论**: 旧版令牌系统已彻底清除，无残留。

---

## 8. 文档更新

### [docs/guides/design-to-code-workflow.md](../guides/design-to-code-workflow.md) — v1.0.0 → v1.2.0

| 版本 | 变更 |
|------|------|
| v1.0.0 | 建立 Design→Code 工作流规范 |
| v1.1.0 | 旧版令牌残留检查标记为已完成；新增第 10 节验证记录 |
| v1.2.0 | 新增第 3.3 节令牌验证 Utility 文档（API 参考 + 使用场景 + 设计约束） |

### [CHANGELOG.md](../../CHANGELOG.md)

新增 `## [Unreleased] - 2026-08-15` 区块，包含 Added / Changed / Removed / Verified / Documentation 五个分类。

---

## 9. 文件变更清单

### 新增

| 文件 | 说明 |
|------|------|
| `src/lib/designTokenVerifier.ts` | 令牌验证 Utility 模块 |
| `src/lib/designTokenVerifier.test.ts` | 17 个单元测试 |
| `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` | 本发布说明 |

### 修改

| 文件 | 说明 |
|------|------|
| `src/main.tsx` | 内联验证逻辑 → 2 行 import + 调用 |
| `src/store/themeStore.ts` | `applyTheme()` 集成自动重验证 |
| `docs/guides/design-to-code-workflow.md` | v1.2.0（新增第 3.3 节 + 第 10 节） |
| `CHANGELOG.md` | 新增 2026-08-15 条目 |
| `package.json` | 移除 `prebuild` 中的 `generate:tokens` |

### 删除

| 文件 | 说明 |
|------|------|
| src/generated/tokens.css | 旧版 slate 色彩令牌 |
| src/generated/tokens.ts | 旧版 TypeScript 常量 |
| scripts/generate-tokens.ts | 令牌自动生成器 |
| `design-tokens/tokens.json` | 旧版令牌源数据 |

---

## 10. Git 提交准备

本发布说明涵盖的所有变更已通过以下验证：

- ✅ `npm run build` — exit 0
- ✅ `npx vitest run src/lib/designTokenVerifier.test.ts` — 17/17 通过
- ✅ `npx tsc --noEmit` — 无新类型错误
- ✅ Playwright E2E — light/dark 切换验证通过，0 页面错误
- ✅ 生产 bundle tree-shake — `TokenVerify` 零残留
- ✅ 旧版 token 全面搜索 — 0 残留

可提交到 Git 仓库。
