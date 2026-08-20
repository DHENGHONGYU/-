# UI 债务清单（QA-050）

> 文档版本：**v1.0**
> 编制日期：2026-08-20
> Doc ID：QA-050
> 执行任务：Task 11（UI 债务 4 级分级清单）
> 分级标准：Critical > High > Medium > Low

---

## 一、分级定义

| 严重度 | 定义 | 示例 | 修复优先级 |
|--------|------|------|-----------|
| **Critical** | 语义错误颜色、可访问性违规、乱码/错位 | 使用 #ff0000 危险色但语义为成功 | P0-立即修复 |
| **High** | 偏离令牌 > 20%、字号/间距非对齐值 | 主按钮使用 18px 而非 16px | P1-本迭代修复 |
| **Medium** | 偏离 5%-20% | 间距使用 10px 而非 8/12 | P2-下版本修复 |
| **Low** | 内联 vs 类名风格差异 | style={{color: '#333'}} vs className | P3-持续优化 |

---

## 二、Critical 级债务

> **目标**：Critical = 0

| ID | 文件 | 行号 | 组件类型 | 原始代码 | 建议令牌引用 | 状态 |
|----|------|------|----------|----------|------------|------|
| UD-20260820-01 | src/apps/input/InputTestDashboard.tsx | 1484 | 页面 | `border-orange-500/20 bg-orange-500/5` | `COLOR_TOKENS.warning.bg` | ⚠ 未修复 |
| UD-20260820-02 | src/apps/input/InputTestDashboard.tsx | 1051 | 页面 | `text-orange-500` | `COLOR_TOKENS.warning.text` | ⚠ 未修复 |
| UD-20260820-03 | src/apps/input/InputTestDashboard.tsx | 1289 | 页面 | `text-purple-500` | `COLOR_TOKENS.info.text` | ⚠ 未修复 |

**Critical 合计**：3 项

---

## 三、High 级债务

> **目标**：High ≤ 20（原子段 ≤ 5 + 复合段 ≤ 15）

| ID | 文件 | 行号 | 组件类型 | 原始代码 | 建议令牌引用 | 工作量 | 状态 |
|----|------|------|----------|----------|------------|--------|------|
| UD-20260820-04 | src/cockpit/widgets/CockpitShell.tsx | 462 | 复合 | `767px` 断点 | `BREAKPOINTS.mobile` | S | ⚠ 未修复 |
| UD-20260820-05 | src/hooks/useMediaQuery.ts | 19-26 | 工具 | 多处 px 断点 | `BREAKPOINTS.*` | M | ⚠ 未修复 |
| UD-20260820-06 | src/services/hybrid-proofread/reportGenerator.ts | 332 | 服务 | `max-width: 1008px` | `LAYOUT_TOKENS.reportWidth` | M | ⚠ 未修复 |
| UD-20260820-07 | src/components/organisms/output/reviewArtifact.ts | 92 | 复合 | `max-width:760px` | `LAYOUT_TOKENS.artifactWidth` | S | ⚠ 未修复 |
| UD-20260820-08 | src/components/organisms/output/reviewArtifact.ts | 107 | 复合 | `max-width:600px` | `LAYOUT_TOKENS.artifactNarrow` | S | ⚠ 未修复 |
| UD-20260820-09 | src/cockpit/widgets/*.tsx | 多处 | 复合 | `?? ''` 静默回退 | `safeCoalesce()` | M | ⚠ 未修复 |
| UD-20260820-10 | src/agents/agentRuntime.ts | 121 | 服务 | `?? ''` 静默回退 | `safeCoalesce()` | S | ⚠ 未修复 |

**High 合计**：7 项

---

## 四、Medium 级债务

> **目标**：Medium 完成率 ≥ 70%

| ID | 文件 | 行号 | 组件类型 | 原始代码 | 建议令牌引用 | 工作量 | 状态 |
|----|------|------|----------|----------|------------|--------|------|
| UD-20260820-11 | src/components/chart/BarChart.tsx | 63 | 复合 | `data ?? []` | `safeArray()` | S | ⚠ 未修复 |
| UD-20260820-12 | src/components/chart/ChipDistributionChart.tsx | 121 | 复合 | `priceMin ?? 0` | `safeNumber()` | S | ⚠ 未修复 |
| UD-20260820-13 | src/cockpit/core/widgetEngine.ts | 207 | 服务 | `widgetId ?? ''` | `safeString()` | S | ⚠ 未修复 |
| UD-20260820-14 | src/cockpit/providers/MarketDataProvider.tsx | 56 | 服务 | `instanceId ?? ''` | `safeString()` | S | ⚠ 未修复 |

**Medium 合计**：4 项

---

## 五、Low 级债务

> **目标**：Low 完成率 ≥ 30%

| ID | 文件 | 行号 | 组件类型 | 原始代码 | 建议令牌引用 | 工作量 | 状态 |
|----|------|------|----------|----------|------------|--------|------|
| UD-20260820-15 | src/components/atoms/Button.tsx | - | 原子 | 部分 style 内联 | Tailwind 类 | S | ✅ 已修复 |
| UD-20260820-16 | src/components/atoms/Input.tsx | - | 原子 | 部分 style 内联 | Tailwind 类 | S | ✅ 已修复 |

**Low 合计**：2 项（已修复 2 项）

---

## 六、统计汇总

| 严重度 | 总数 | 已修复 | 未修复 | 完成率 |
|--------|------|--------|--------|--------|
| Critical | 3 | 0 | 3 | 0% |
| High | 7 | 0 | 7 | 0% |
| Medium | 4 | 0 | 4 | 0% |
| Low | 2 | 2 | 0 | 100% |
| **合计** | **16** | **2** | **14** | **13%** |

**Critical+High 合计**：10 项 ≤ 阈值 40 项 ✅

---

## 七、修复优先级建议

### 第一轮（Task 13-14 原子组件）

| 优先级 | 债务 ID | 文件 | 说明 |
|--------|---------|------|------|
| P0 | UD-20260820-01~03 | InputTestDashboard.tsx | 硬编码颜色替换 |

### 第二轮（Task 15 复合组件）

| 优先级 | 债务 ID | 文件 | 说明 |
|--------|---------|------|------|
| P1 | UD-20260820-04~08 | CockpitShell/useMediaQuery/reportGenerator/reviewArtifact | 响应式断点令牌化 |
| P1 | UD-20260820-09~10 | agentRuntime/widgetEngine/MarketDataProvider | 静默回退修复 |

### 第三轮（Task 20 交互优化）

| 优先级 | 债务 ID | 文件 | 说明 |
|--------|---------|------|------|
| P2 | UD-20260820-11~14 | BarChart/ChipDistributionChart 等 | safeCoalesce 统一 |

---

## 八、审计日志

| 审计脚本 | 输出文件 | 结果 |
|----------|----------|------|
| audit:inlineColors | `outputs/ui-debt/audit-inline-colors.log` | 66 处（17 inline + 49 Tailwind） |
| audit:typography | `outputs/ui-debt/audit-typography.log` | 通过 ✅ |
| audit:spacing | `outputs/ui-debt/audit-spacing.log` | 16 处违规 |
| audit:hardcode | `outputs/ui-debt/audit-hardcode.log` | 多处警告 |

---

*文档版本：v1.0*
*更新日期：2026-08-20*
