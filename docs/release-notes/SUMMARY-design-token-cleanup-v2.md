# 设计令牌清理工作总结报告

> **报告日期**：2026-08-14  
> **报告类型**：技术重构总结  
> **涉及提交**：4 个（508c84f → 75b2d61 → 801395d → 87ae340）  
> **总体状态**：✅ 已完成

---

## 一、工作背景

### 问题描述

清除旧版双套令牌系统，确立 V5 Apple Business Design Tokens 唯一真相源，封装运行时验证 Utility，集成主题切换自动重验证

### 清理目标

1. 彻底移除旧版系统/文件
2. 确立新的唯一真相源
3. 补全文档与测试覆盖

---

## 二、提交链

| # | Commit Hash | 时间 | 类型 | 说明 |
|---|-------------|------|------|------|
| 1 | `508c84f` | 00:53:16 | feat(config) | 应用 Apple Business 设计令牌到全局主题与基础组件 |
| 2 | `75b2d61` | 01:14:34 | refactor(config) | 移除旧版 tokens 管道并接入运行时令牌验证 |
| 3 | `801395d` | 01:40:52 | fix(components) | 修复 Toast/ErrorState 模块缺失导出导致的 tsc:prod 阻塞 |
| 4 | `87ae340` | 01:50:29 | docs(design-tokens) | 修正提交说明 — 801395d 包含令牌清理工作 |

---

## 三、涉及的文件列表

### 按变更类型分类

#### 删除的文件（5 个）

| `design-tokens/tokens.json` | `75b2d61` | 239 行 |
| scripts/generate-tokens.ts | `75b2d61` | 233 行 |
| src/generated/tokens.css | `75b2d61` | 176 行 |
| src/generated/tokens.ts | `75b2d61` | 189 行 |
| scripts/generate/generate-tokens.ts | `801395d` | 233 行 |

#### 新增的文件（12 个）

| `src/lib/designTokenVerifier.test.ts` | `75b2d61` | 274 行 |
| `src/lib/designTokenVerifier.ts` | `75b2d61` | 134 行 |
| `docs/guides/design-to-code-workflow.md` | `801395d` | 433 行 |
| `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` | `801395d` | 257 行 |
| `docs/releases/COMMIT-design-token-cleanup.md` | `801395d` | 115 行 |
| `docs/releases/PR-design-token-cleanup.md` | `801395d` | 67 行 |
| `dogfood-output/e2e-theme-dark.png` | `801395d` |  |
| `dogfood-output/e2e-theme-light.png` | `801395d` |  |
| `dogfood-output/token-verify-v5.png` | `801395d` |  |
| `StockPriceChangeBadge.tsx` | `801395d` | 5 行 |
| `Toaster.tsx` | `801395d` | 5 行 |
| `src/components/molecules/ErrorState.tsx`（原名 AppErrorState.tsx） | `801395d` | 326 行 |

#### 修改的文件（20 个）

| `src/components/atoms/Card.tsx` | `508c84f` | +6/-1 |
| `src/components/templates/PageHeader.tsx` | `508c84f` | +7/-2 |
| `src/constants/theme/theme.tokens.base.ts` | `508c84f` | +1/-1 |
| `src/constants/theme/theme.tokens.color.ts` | `508c84f` | +23/-13 |
| `src/constants/theme/theme.tokens.design.ts` | `508c84f` | +3/-3 |
| `src/constants/theme/theme.tokens.portal.ts` | `508c84f` | +5/-5 |
| `src/index.css` | `508c84f` | +119/-66 |
| `tailwind.config.js` | `508c84f` | +4/-4 |
| `design-tokens/project-to-figma.json` | `75b2d61` | +1/-1 |
| `src/main.tsx` | `75b2d61` | +5/-1 |
| `.gitignore` | `801395d` | +3 |
| `CHANGELOG.md` | `801395d` | +48/-1 |
| `README.md` | `801395d` | +6/-2 |
| `docs/guides/team-handbook/01-design-philosophy.md` | `801395d` | +9/-5 |
| `scripts/README.md` | `801395d` | /-1 |
| `src/components/atoms/index.ts` | `801395d` | +1/-3 |
| `ErrorState.tsx` | `801395d` | +2/-2 |
| `src/components/molecules/states/index.ts` | `801395d` | +2/-2 |
| `src/components/organisms/output/ReviewWizard.tsx` | `801395d` | +4/-3 |
| `src/store/themeStore.ts` | `801395d` | +5 |



---

## 四、关键变更点

> ⚠️ **请手动补充本节**：描述本次清理的关键技术变更点、设计决策、架构影响等。

---

## 五、验证结果

### 构建与测试

| 检查项 | 结果 |
|--------|------|
| `npm run build` | ✅ / ❌ |
| 单元测试 | ✅ / ❌ |
| TypeScript 类型检查 | ✅ / ❌ |
| E2E 测试 | ✅ / ❌ |

> ⚠️ **请手动补充**：提交前验证检查项和结果。

---

## 六、影响范围

### 运行时影响

> ⚠️ **请手动补充**：描述对生产环境、开发环境、性能等方面的影响。

### 文档影响

> ⚠️ **请手动补充**：列出受影响的文档及其更新内容。

---

## 七、经验教训

> ⚠️ **请手动补充**：总结本次清理工作中的经验教训，避免未来重复同样的问题。

