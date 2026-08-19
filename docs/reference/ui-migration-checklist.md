---
title: UI 组件迁移检查清单
type: reference
domain: architecture
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "适用于跨舱、跨目录、跨模块的 UI 组件迁移或重构，确保引用关系无遗漏、质量门禁不中断。"
tags: [architecture, migration, checklist]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-ARCH-019
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# UI 组件迁移检查清单

> 适用于跨舱、跨目录、跨模块的 UI 组件迁移或重构，确保引用关系无遗漏、质量门禁不中断。

## 迁移前准备

- [ ] 明确迁移原因与目标位置（原子/分子/业务/页面组件）
- [ ] 梳理待迁移组件的**所有导入方**（使用 `grep` 或 IDE 查找引用）
- [ ] 确认目标目录的命名规范与现有组件分类
- [ ] 备份或建立基线分支，确保可回滚

## 文件迁移

- [ ] 将组件文件移动到目标目录
- [ ] 同步移动相关样式文件、类型文件、测试文件
- [ ] 删除原目录下的空文件夹或过期文件
- [ ] 更新组件内部相对路径引用（如 `./utils`、`../hooks`）

## 引用更新

- [ ] 更新所有 import 路径（使用 IDE 全局替换 + 人工复核）
- [ ] 更新 barrel export（如 `../../src/showcase/index.ts`、`../../src/components/widgets/index.ts`）
- [ ] 更新路由配置（如 `src/config/routes.ts`）
- [ ] 更新左侧导航/顶部导航配置
- [ ] 更新页面入口文件中的组件引用
- [ ] 更新 Storybook/示例页中的组件引用

## Store 与 Service 归属

- [ ] 确认迁移后的组件消费的 Store 是否仍在合法层级
- [ ] 确认相关 Hook/Service 是否需要随组件一起迁移
- [ ] 检查是否有 `dataLayer` 或 `db` 的直接引用被意外带入新位置
- [ ] 确保 `EventBus` 订阅与取消订阅配对完整

## 样式与令牌

- [ ] 检查组件内是否存在硬编码颜色（HEX 或 Tailwind 数字颜色类）
- [ ] 将颜色替换为 `THEME_TOKENS` / `COLOR_TOKENS` / `COLOR_SHADES` / `STOCK_COLOR_TOKENS`
- [ ] 检查图标尺寸是否使用 `THEME_TOKENS.iconSizes`
- [ ] 检查字体/字号是否使用 `THEME_TOKENS.typography`
- [ ] 确认暗色模式类名只修改 `dark:*` 段，不动亮色 `stone` 系

## 测试与门禁

- [ ] 移动并重命名对应的单元测试/集成测试文件
- [ ] 更新测试文件中的 import 路径
- [ ] 运行 `npx tsc --noEmit`
- [ ] 运行 `npm run audit:layers`
- [ ] 运行 `npm run lint:colors`
- [ ] 运行相关测试 `npm run test -- --run`
- [ ] 如迁移涉及页面，运行 E2E 测试

## 文档同步

- [ ] 更新 `../explanation/03-architecture-standards.md`（已归档） 中相关模块说明
- [ ] 更新 `../explanation/06-routing-specs.md`（已归档） 路由表（如涉及路由）
- [ ] 更新组件目录说明或 Storybook 示例
- [ ] 在 `CHANGELOG.md` 中记录迁移内容

## 迁移后验证

- [ ] 在浏览器中打开受影响页面，确认渲染正常
- [ ] 检查浏览器控制台无报错、无 404
- [ ] 确认暗色/亮色模式切换正常
- [ ] 确认相关交互（弹窗、表单、Tab 切换）正常
- [ ] 确认移动端/响应式布局未受影响

## 迁移收尾：全文件类型扫描（必须执行）

> **背景**：迁移完成后，源码（.tsx/.ts）中的旧路径引用通常已清理干净，但**非源码文件**（文档、脚本注释、AI 行为契约、配置）中的旧路径引用容易被遗漏。这些引用虽然不影响编译，但会误导 AI 辅助开发工具和人类开发者使用已删除的旧路径。

- [ ] 执行全文件类型扫描（不仅限于 .tsx/.ts）：

```bash
# 扫描所有文件类型中的旧路径引用，排除构建产物
grep -rn "@/components/旧路径/" \
  --include="*.tsx" --include="*.ts" --include="*.md" \
  --include="*.json" --include="*.mjs" --include="*.cjs" \
  --include="*.yaml" --include="*.yml" --include="*.sh" \
  src/ scripts/ docs/ prompts/ AGENTS.md .husky/ \
  | grep -v "coverage" | grep -v "dist-test" | grep -v "eslint-" \
  | grep -v "docs/reports/" | grep -v "patch-bundle"
```

- [ ] 检查 **AGENTS.md**（AI 行为契约）中的目录结构描述是否已更新
- [ ] 检查 **docs/ 中的活跃指南文档**（非历史报告）的代码示例是否使用新路径
- [ ] 检查 **scripts/ 中的审计脚本**是否有硬编码的旧路径（含注释）
- [ ] 检查 **prompts/ 中的 AI 提示词模板**是否引用旧路径
- [ ] 检查 **.husky/ 中的钩子脚本**是否引用旧路径
- [ ] 确认构建产物（coverage/、dist-test/、docs/reports/）中的旧路径**无需手动修改**（会自动重新生成）

## 常见陷阱

| 陷阱 | 表现 | 排查方法 |
|------|------|----------|
| 旧目录残留引用 | 构建时报 `Cannot find module` | `grep -r "旧路径" src/` |
| barrel export 未更新 | 运行时组件为 undefined | 检查 `index.ts` 导出 |
| 路由未同步 | 页面空白或 404 | 检查 `routes.ts` 与导航配置 |
| 硬编码颜色回潮 | `lint:colors` 失败 | 运行 `npm run lint:colors` |
| 测试路径未更新 | 测试找不到源文件 | 运行 `npm run test -- --run` |
| **非源码旧路径残留** | **AI 生成错误代码 / 文档误导开发者** | **全文件类型扫描（见上方"迁移收尾"节）** |

