---
title: 质量门禁实测基线�?026-06-25�?
type: explanation
domain: qa
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 概述 本文档记�?`智能投研复盘系统 V9` �?`2026-06-25` 的质量门禁实测基线，作为后续 Phase 2 / Phase 3..."
tags: [qa, quality, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-097
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 质量门禁实测基线�?026-06-25�?
## 1. 概述

本文档记�?`智能投研复盘系统 V9` �?`2026-06-25` 的质量门禁实测基线，作为后续 Phase 2 / Phase 3 收敛的参照点。所有数据来自当日本地执行结果，环境�?Windows + Node.js + npm�?
---

## 2. 实测基线

| 门禁�?| 命令 | 结果 | 备注 |
|--------|------|------|------|
| TypeScript 类型检�?| `tsc --noEmit` | �?通过 | 无类型错�?|
| ESLint 静态检�?| `npm run lint` | �?通过 | �?lint 错误 |
| 单元测试 | `npm test -- --run` | �?44 files / 291 tests 通过 | 包含新增 V6 迁移 19 个单元测�?|
| 生产构建 | `npm run build` | �?通过 | 输出�?`dist/` |
| E2E 测试 | `npm run test:e2e` | �?5/5 通过 | Playwright 用例全部通过 |
| 分层审计 | `npm run audit:layers` | ⚠️ 0 违规 / 2 警告 | `ScoreDocPage.tsx`、`StrategySnapshotPage.tsx` �?`dataLayer` |
| 硬编码审�?| `npm run audit:hardcode` | ⚠️ 389 �?| 283 静默回退 + 29 Tailwind 颜色 + 77 魔法数字 |
| 死代码审�?| `npm run audit:deadcode` | ⚠️ 11 �?| 6 条件返回 null + 5 未注册页�?|

---

## 3. 问题分类与收敛计�?
### 3.1 必须收敛项（Phase 2 结束前）

| 问题 | 数量 | 收敛目标 | 说明 |
|------|------|----------|------|
| 分层违规（读 `dataLayer`�?| 2 处警�?| 0 | `ScoreDocPage.tsx`、`StrategySnapshotPage.tsx` 需通过 `DataBridge` 或专�?service 读取数据，禁�?UI 层直接访�?`dataLayer` |

### 3.2 建议收敛项（Phase 2 逐步处理�?
| 问题 | 数量 | 收敛目标 | 说明 |
|------|------|----------|------|
| Tailwind 颜色硬编�?| 29 �?| �?10 | 颜色值应统一使用 `tailwind.config.js` 主题 token �?CSS 变量 |
| 魔法数字 | 77 �?| �?30 | 业务阈值、评分权重、比例常量应抽取为命名常�?|

### 3.3 当前可接受的过渡期行�?
| 问题 | 数量 | 原因 |
|------|------|------|
| 静默回退（fallback 值） | 283 �?| 大部分为 UI 组件的默认值、可选链兜底、迁移转换中的安全回退，属于防御性编码，不阻塞发�?|
| 死代码（条件返回 null�?| 6 �?| 多为未实现占位页面或权限/功能开关，保留结构便于 Phase 3 填充 |
| 死代码（未注册页面） | 5 �?| 已创建但尚未接入路由的页面，属于 Feature Flag 式保留，不影响运行时 |

---

## 4. 覆盖率阈值配�?
`vite.config.ts` 已配置覆盖率阈值：

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  thresholds: {
    'src/core/**': { statements: 85, branches: 85, functions: 85, lines: 85 },
    'src/data/**': { statements: 85, branches: 85, functions: 85, lines: 85 },
    'src/lib/**': { statements: 85, branches: 85, functions: 85, lines: 85 },
    'src/services/**': { statements: 70, branches: 70, functions: 70, lines: 70 },
  },
  exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'tests/**'],
}
```

### 4.1 当前覆盖率状�?
- 当前覆盖�?*未达�?*，主要原因是�?  - `src/services/` 下新�?V6 迁移服务、转换函数虽已补�?19 个单元测试，但分支覆盖率仍未达到 70%�?  - `src/data/**` �?IndexedDB 相关逻辑依赖浏览器环境，部分分支难以�?jsdom 中覆盖�?  - `src/core/**` 部分工具函数和类型守卫缺少测试�?
### 4.2 后续补充计划

- Phase 2 优先补齐 `src/services/system/v6MigrationService.ts` 的分支覆盖，目标达到 `src/services/**` 阈�?70%�?- Phase 2 中晚期补�?`src/data/db.ts` 的升级逻辑测试，使�?`fake-indexeddb` 模拟 IndexedDB�?- Phase 3 �?`src/core/**` 覆盖率提升至 85% 以上�?
---

## 5. 复现命令

```bash
# 类型检�?npx tsc --noEmit

# Lint
npm run lint

# 单元测试
npm test -- --run

# 构建
npm run build

# E2E
npm run test:e2e

# 审计脚本
npm run audit:layers
npm run audit:hardcode
npm run audit:deadcode
```

---

## 6. 相关文件

- `vite.config.ts`：覆盖率阈值配置�?- `eslint.config.js`：Lint 规则�?- `package.json`：脚本定义�?- `scripts/audit-dead-code.ts`：死代码审计脚本�?- `scripts/audit-hardcode.ts`：硬编码审计脚本�?- `scripts/audit-layer-calls.ts`：分层调用审计脚本�?