# 设计令牌清理工作总结 Commit 记录归档

> **归档日期**：2026-08-14  
> **归档目的**：供项目 Wiki 参考，记录设计令牌清理工作总结的完整提交链  
> **涉及提交数**：4 个

---

## 提交链总览

```
508c84f  feat(config): 应用 Apple Business 设计令牌到全局主题与基础组件
         ↓
75b2d61  refactor(config): 移除旧版 tokens 管道并接入运行时令牌验证
         ↓
801395d  fix(components): 修复 Toast/ErrorState 模块缺失导出导致的 tsc:prod 阻塞
         ↓
87ae340  docs(design-tokens): 修正提交说明 — 801395d 包含令牌清理工作
```

---

## 提交 1：508c84f

```
commit 508c84f5e46bdab3138219850e01cd042948fd7d
Author: V9 Dev
Date:   2026-08-15 00:53:16

    feat(config): 应用 Apple Business 设计令牌到全局主题与基础组件
    
    - 全局令牌层：primary #007AFF / 背景 #F2F2F7 / 卡片纯白 / 圆角 1rem / CJK 字距调整
    - 排版阶梯：display/h1 字距归零（适配 CJK），字体栈加入 DM Sans / SF Pro Display
    - 组件对齐：Card 去边框改阴影悬浮（shadow-elevation-1），PageHeader 空值守卫
    - 布局令牌：主内容区 bg-background（白卡片悬浮浅灰底），导航激活 surface-2 + 主色
```

### 文件变更（8 个文件，+168/-95）

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/components/atoms/Card.tsx` | 修改 | +6 / -1 |
| `src/components/templates/PageHeader.tsx` | 修改 | +7 / -2 |
| `src/constants/theme/theme.tokens.base.ts` | 修改 | +1 / -1 |
| `src/constants/theme/theme.tokens.color.ts` | 修改 | +23 / -13 |
| `src/constants/theme/theme.tokens.design.ts` | 修改 | +3 / -3 |
| `src/constants/theme/theme.tokens.portal.ts` | 修改 | +5 / -5 |
| `src/index.css` | 修改 | +119 / -66 |
| `tailwind.config.js` | 修改 | +4 / -4 |

---

## 提交 2：75b2d61

```
commit 75b2d610bdb82ba53e4754abea0f50a62e8df874
Author: V9 Dev
Date:   2026-08-15 01:14:34

    refactor(config): 移除旧版 tokens 管道并接入运行时令牌验证
```

### 文件变更（8 个文件，+414/-839）

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `design-tokens/project-to-figma.json` | 修改 | +1 / -1 |
| `design-tokens/tokens.json` | 删除 | -239 |
| scripts/generate-tokens.ts | 删除 | -233 |
| src/generated/tokens.css | 删除 | -176 |
| src/generated/tokens.ts | 删除 | -189 |
| `src/lib/designTokenVerifier.test.ts` | 新增 | +274 |
| `src/lib/designTokenVerifier.ts` | 新增 | +134 |
| `src/main.tsx` | 修改 | +5 / -1 |

---

## 提交 3：801395d

```
commit 801395d427d7b038e8982fc98cb444bfdfa7653e
Author: V9 Dev
Date:   2026-08-15 01:40:52

    fix(components): 修复 Toast/ErrorState 模块缺失导出导致的 tsc:prod 阻塞
```

### 文件变更（21 个文件，+1288/-252）

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `.gitignore` | 修改 | +3 |
| `CHANGELOG.md` | 修改 | +48 / -1 |
| `README.md` | 修改 | +6 / -2 |
| `docs/guides/design-to-code-workflow.md` | 新增 | +433 |
| `docs/guides/team-handbook/01-design-philosophy.md` | 修改 | +9 / -5 |
| `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` | 新增 | +257 |
| `docs/releases/COMMIT-design-token-cleanup.md` | 新增 | +115 |
| `docs/releases/PR-design-token-cleanup.md` | 新增 | +67 |
| `dogfood-output/e2e-theme-dark.png` | 新增 |  |
| `dogfood-output/e2e-theme-light.png` | 新增 |  |
| `dogfood-output/token-verify-v5.png` | 新增 |  |
| `scripts/README.md` | 修改 | -1 |
| scripts/generate/generate-tokens.ts | 删除 | -233 |
| `StockPriceChangeBadge.tsx` | 新增 | +5 |
| `Toaster.tsx` | 新增 | +5 |
| `src/components/atoms/index.ts` | 修改 | +1 / -3 |
| `src/components/molecules/ErrorState.tsx`（原名 AppErrorState.tsx） | 新增 | +326 |
| `ErrorState.tsx` | 修改 | +2 / -2 |
| `src/components/molecules/states/index.ts` | 修改 | +2 / -2 |
| `src/components/organisms/output/ReviewWizard.tsx` | 修改 | +4 / -3 |
| `src/store/themeStore.ts` | 修改 | +5 |

---

## 提交 4：87ae340

```
commit 87ae340c0c54a18fc5aa0f54195fc6ec3b0271d9
Author: V9 Dev
Date:   2026-08-15 01:50:29

    docs(design-tokens): 修正提交说明 — 801395d 包含令牌清理工作
    
    ## 修正说明
    
    前序提交 801395d（fix(components): 修复 Toast/ErrorState 模块缺失导出导致的 tsc:prod 阻塞）
    因 IDE 并发 git 操作，将令牌清理文件与组件重命名文件混合提交。
    
    本提交补充说明 801395d 实际包含的令牌清理内容（14 个文件）：
    
    ### 删除
    - scripts/generate/generate-tokens.ts — 旧版令牌生成器（遗漏副本）
    
    ### 新增
    - docs/guides/design-to-code-workflow.md — Design→Code 工作流规范 v1.2.0
    - docs/release-notes/RELEASE-NOTES-design-token-cleanup.md — 发布说明
    - docs/releases/COMMIT-design-token-cleanup.md — Commit 信息文档
    - docs/releases/PR-design-token-cleanup.md — PR 描述模板
    - dogfood-output/e2e-theme-light.png — E2E 测试截图
    - dogfood-output/e2e-theme-dark.png — E2E 测试截图
    - dogfood-output/token-verify-v5.png — 令牌验证截图
    
    ### 修改
    - .gitignore — 新增 src/generated/ 防护规则
    - CHANGELOG.md — 新增 2026-08-15 变更条目
    - README.md — 更新版本日期、技术亮点、文档链接
    - docs/guides/team-handbook/01-design-philosophy.md — 更新令牌链路 + 豁免列表
    - scripts/README.md — 移除已删除的 generate-tokens.ts 条目
    - src/store/themeStore.ts — 集成主题切换自动重验证
    
    ### 验证结果（10 项全通过）
    - --color-*/generated/tokens/generate-tokens.ts/#157958: 全部 0 残留
    - npm run build: exit 0 | 单元测试: 17/17 | tsc: 0 新错误
    - 生产构建零开销（DEV 守卫 + tree-shake）
    
    Refs: 801395d, 75b2d61
```

### 文件变更（0 个文件，+0/-0）

空提交（`--allow-empty`），无文件变更。

---


## 统计汇总

| 指标 | 数值 |
|------|------|
| 提交数 | 4 |
| 涉及文件数（去重） | 37 |
| 删除文件数 | 5 |
| 新增文件数 | 12 |
| 修改文件数 | 20 |
| 代码行数变化 | +1870 / -1186 |

---

## 相关文档

- [设计令牌清理工作总结总结报告](./SUMMARY-design-token-cleanup-v3.md)

