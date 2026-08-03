---
title: 2026-07-05-color-refactor-p2
tier: T2
status: active
type: reference
domain: project
doc_id: V9-DOC-AUTO-5F8369
code_version: 2.0.0
summary: 日期: 2026-07-05
maintainer: V9 Architecture Team
phase: maintenance
---

# 颜色硬编码治理 - P2 批次技术日志

**日期**: 2026-07-05  
**版本**: v2.0.0  
**批次**: P2 - 全量迁移剩余文件 + CI 门禁集成

---

## 任务概述

完成剩余 30 个文件的颜色硬编码重构，建立 CI 门禁集成，编写颜色令牌使用指南文档。

---

## 完成内容

### 1. ESLint 规则集成（eslint.config.js）

**修改内容**:
- 导入自定义规则插件：`import noHardcodedColors from './scripts/eslint-plugin-no-hardcoded-colors.js'`
- 注册插件：`'no-hardcoded-colors': noHardcodedColors`
- 启用规则：`'no-hardcoded-colors/no-hardcoded-tailwind-colors': 'warn'`

**验证**: ✅ ESLint 规则生效，自动检测颜色硬编码

---

### 2. Package.json 脚本添加

**新增脚本**:
```json
"lint:colors": "eslint src/ --ext .ts,.tsx --rule 'no-hardcoded-colors/no-hardcoded-tailwind-colors: error' --max-warnings 0"
```

**用途**: 专门用于颜色硬编码检查，CI 门禁调用

---

### 3. CI Workflow 更新（.github/workflows/quality-check.yml）

**修改内容**:
- 在 `audit` job 中添加 `npm run lint:colors` 步骤
- 确保每次 PR 和 push 都检查颜色硬编码

**验证**: ✅ CI 流程完整，颜色检查已集成

---

### 4. Pre-commit 钩子更新（.husky/pre-commit）

**修改内容**:
```bash
# 颜色硬编码门禁检查（v2.0.0 新增）
npm run lint:colors --quiet
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 颜色硬编码检查未通过，已阻止提交"
  echo "   请使用颜色令牌系统（COLOR_SHADES, twText, twBg, twBorder）替代硬编码颜色类"
  echo "   参考：AGENTS.md §3.5 颜色令牌使用规范"
  echo "   或使用 git commit --no-verify 跳过检查（不推荐）"
  echo ""
  exit 1
fi
```

**验证**: ✅ Pre-commit 钩子生效，本地提交前自动检查

---

## 5. 剩余 30 个文件迁移

**批次 1：高违规文件（6 个）**
- MultiFactorFilterPanel.tsx - 11 处替换
- SectorRotationHeatmap.tsx - 7 处替换
- ScoreFactorDeltaPanel.tsx - 6 处替换
- HotSectorPage.tsx - 6 处替换
- ScoreFactorWaterfall.tsx - 5 处替换
- AnalysisTemplateCards.tsx - 5 处替换

**批次 2：中等违规文件（7 个）**
- Toast.tsx - 5 处替换
- ErrorState.tsx - 4 处替换
- AgentFeedbackPage.tsx - 5 处替换
- AgentHubPage.tsx - 4 处替换
- StrategySnapshotPage.tsx - 3 处替换
- NewsCard.tsx - 4 处替换
- LogStreamPanel.tsx - 2 处替换

**批次 3：低违规文件（17 个）**
- Badge.tsx - 2 处替换
- Button.tsx - 1 处替换
- DatePicker.tsx - 1 处替换
- Dialog.tsx - 1 处替换
- List.tsx - 1 处替换
- Sheet.tsx - 1 处替换
- Slider.tsx - 1 处替换
- Table.tsx - 1 处替换
- Toggle.tsx - 1 处替换
- Tabs.tsx - 2 处替换
- NewsPage.tsx - 2 处替换
- AgentTriggerPage.tsx - 2 处替换
- GenericAgentDetail.tsx - 1 处替换
- V6ScoringAgentDetail.tsx - 1 处替换
- MCPServerDashboardPage.tsx - 1 处替换
- HomePage.tsx - 1 处替换
- SevenDimConfigPage.tsx - 1 处替换
- TradeModal.tsx - 1 处替换

**验证**: ✅ 所有文件重构完成，类型检查通过

---

### 6. 违规清单缓存更新

**更新内容**:
- `totalViolations`: 116 → 0
- `files`: 33 个 → 0 个
- `remediationPlan.P2.status`: "pending" → "completed"

**验证**: ✅ 违规清单已更新，0 处颜色违规

---

## 技术决策

### 1. CI 门禁策略

**决策**: 在 CI 中添加独立的 `lint:colors` 步骤，而非集成到现有 `lint` 步骤

**理由**:
- 独立步骤便于问题定位和修复
- 可以单独控制是否阻塞 CI
- 便于统计颜色硬编码违规趋势

### 2. Pre-commit 钩子策略

**决策**: 在 pre-commit 中添加颜色检查，使用 `--quiet` 模式

**理由**:
- 本地提交前即时反馈，避免问题流入 CI
- `--quiet` 模式减少输出噪音
- 提供清晰的错误提示和修复指引

### 3. 令牌选择策略

**决策**: 优先使用 `twText/twBg/twBorder` 辅助函数，复杂场景使用 `COLOR_SHADES`

**理由**:
- 辅助函数在动态拼接场景下更灵活
- `COLOR_SHADES` 提供完整的色阶定义，类型安全
- 保持代码可读性和一致性

---

## 质量指标

| 指标 | 重构前 | 重构后 | 改善 |
|------|--------|--------|------|
| 颜色硬编码数 | 116 处 | 0 处 | -100% |
| 涉及文件数 | 33 个 | 0 个 | -100% |
| Token 消耗/扫描 | ~20,000 | 0 | -100% |
| 类型安全 | ✅ | ✅ | 保持 |
| CI 门禁 | ❌ | ✅ | 新增 |
| Pre-commit 检查 | ❌ | ✅ | 新增 |

---

## 后续计划

### 已完成

- ✅ P0 批次：建立规范与缓存机制
- ✅ P1 批次：重构 TOP 5 热点文件
- ✅ P2 批次：全量迁移剩余文件 + CI 门禁集成

### 未来优化

1. **ESLint 规则增强**
   - 添加自动修复功能（`--fix`）
   - 支持更多颜色模式检测

2. **颜色令牌系统扩展**
   - 添加更多语义化令牌（如 `success`、`warning`、`info`）
   - 支持自定义主题切换

3. **文档完善**
   - 编写颜色令牌使用指南（已完成，见 AGENTS.md §3.5）
   - 添加视频教程

---

## 验证命令

```powershell
# 类型检查
npx tsc --noEmit

# 颜色硬编码扫描
npm run lint:colors

# 完整审计
npm run audit:hardcode -- --export-inventory

# 查看违规清单
cat docs/reports/hardcoded-colors-inventory.json
```

---

## 相关文件

- `AGENTS.md` - §3.5 颜色令牌使用规范
- `eslint.config.js` - ESLint 规则配置
- `scripts/quality/eslint-plugin-no-hardcoded-colors.js` - 自定义 ESLint 规则
- `package.json` - `lint:colors` 脚本
- `.github/workflows/quality-check.yml` - CI 配置
- `.husky/pre-commit` - Pre-commit 钩子
- `src/constants/theme.tokens.ts` - 颜色令牌定义
- `docs/reports/hardcoded-colors-inventory.json` - 违规清单缓存

---

**状态**: ✅ 完成  
**下一步**: 颜色硬编码治理已完成，进入持续维护阶段
