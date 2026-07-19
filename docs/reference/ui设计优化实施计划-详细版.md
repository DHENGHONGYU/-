---
title: ui设计优化实施计划-详细�?
type: reference
domain: project
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "P0 决策：将 tokens.json �?primary/ring 由蓝改为 emerald（与运行时绿色品牌一致），使「规范源」不再自相矛盾；并据实记录管线断裂，"
tags: [project, implementation, design, optimization, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-111
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: project
tier: important
doc_id: V9-DOC-PROJ-111
status: active
maintainer: V9 Architecture Team
summary: "P0 决策：将 tokens.json �?primary/ring 由蓝改为 emerald（与运行时绿色品牌一致），使「规范源」不再自相矛盾；并据实记录管线断裂，"
tags: [project, implementation, design, optimization, plan]
phase: design
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# UI 设计优化实施计划（详细版�?
> 合并《UI设计优化实操方案 V6×V9×WorkBuddy》与《UI设计原则基线与创新水准》两份分析，
> 落地�?*可逐步执行、可验收**的实施计划，并标注本回合已执行的增量�?> 配套文档：`UI设计优化实操方案_V6×V9×WorkBuddy.html`、`UI设计原则基线与创新水准_V9.html`

---

## 0. 关键发现（本回合实测，决�?P0 走向�?
1. **运行时强调色是绿色，但令牌管线是断裂�?* —�?这是「单一真相源」漂移的真实证据�?   - `tailwind.config.js` �?`primary` 映射�?`hsl(var(--primary))`；真正生效的 `--primary` �?`src/index.css` �?`:root{--primary:160 84% 31%}`（绿）手写定义，�?Tailwind 全站消费�?   - `scripts/generate-tokens.ts` �?`design-tokens/tokens.json`（原 primary = `blue.500` 蓝）生成 `src/generated/tokens.css`，但其输出的变量名是 `--color-primary` / `--color-ring`（而非 `--primary`/`--ring`）�?   - **`--color-primary` �?`src` 中无任何引用**（已 grep 确认），是未被消费的「死变量」；它不会覆�?`index.css` �?`--primary`。因此界面实际一直是**绿色**�?   - 结论：令牌管线断裂——`tokens.json` 声称是单一真相源，但其生成的变量命名与 Tailwind 消费�?`--primary` 不匹配，`--primary` 实际�?`index.css` 手写、并未由 `tokens.json` 驱动�?2. **WCAG 实测**（见 `scripts/other/a11y-contrast.cjs` 输出）：�?emerald 主色配白字对比度�?3.4�?.8，满�?*大字�?粗体 AA(3:1)**，但未达**正文 AA(4.5:1)**；`emerald.700(#15803d)` 白字�?5.02，可满足严格正文 AA。index.css 注释「≥4.5:1」对正文不严谨�?
**P0 决策**：将 `tokens.json` �?primary/ring 由蓝改为 emerald（与运行时绿色品牌一致），使「规范源」不再自相矛盾；并据实记录管线断裂，作为 P4（令�?lint + 真·单一真相源）的明确整治项——推荐修正生成器使其输出 `--primary`（而非 `--color-primary`），�?`tokens.json` 真正驱动 UI。蓝色白字对比度更弱，故不取蓝�?
---

## 0.5 参考设计与设计原则

### 参考方�?
**设计参�?*：[Kimi Agent PWA](https://hslqownhhwaig.ok.kimi.link/)

**设计特征**�?- PWA 移动端优�?- shadcn/ui 组件体系
- HSL CSS 变量主题
- Widget 化驾驶舱
- 翡翠绿强调色�?10b981�?
### 设计原则

#### 核心原则

1. **移动端优�?*：主要使用场景为平板/桌面研究，但需适配移动端浏�?   - 响应式断点：375px（移动）�?768px（平板）�?1024px（桌面）�?1440px（大屏）
   - 触摸友好：按钮最小尺�?44×44px，间�?�?px
   - 性能优化：首屏加�?<2s，交互响�?<100ms

2. **PWA 体验**：可安装、离线可用、主题色 #10b981（翡翠绿�?   - Service Worker 缓存策略：静态资�?Cache First，API 数据 Network First
   - Manifest 配置：支持添加到主屏幕，全屏显示
   - 离线功能：已评分数据可查看，新评分需联网

3. **Widget �?*：驾驶舱由可配置 Widget 网格组成
   - 网格系统�?2 列布局，支�?1×1�?×1�?×2�?×1 等尺�?   - 拖拽排序：用户可自定�?Widget 位置和大�?   - 独立刷新：每�?Widget 可独立刷新数�?
4. **五舱工作�?*：输�?�?分析 �?交易 �?输出 �?总控，不切屏
   - 舱室导航：顶�?Tab 切换，保持上下文连贯
   - 数据流转：舱室间通过 Store 共享数据，避免重复加�?   - 状态同步：跨舱室操作实时同步，避免数据不一�?
5. **宋瓷美学 + 现代极简**：以象牙�?暖灰为底，翡翠绿为行动色，朱砂红为警示色
   - 色彩体系�?     - 背景色：`#faf9f7`（象牙白�? `#f5f5f5`（暖灰）
     - 强调色：`#10b981`（翡翠绿）用于按钮、链接、成功状�?     - 警示色：`#dc2626`（朱砂红）用于错误、删除、危险操�?     - 中性色：`#6b7280`（中灰）用于次要文本
   - 排版规范�?     - 标题：`font-weight: 600`，行�?1.2
     - 正文：`font-weight: 400`，行�?1.6
     - 字号�?4px（正文）�?16px（小标题）→ 20px（标题）�?24px（大标题�?   - 间距系统�?     - 基础单位�?px
     - 常用间距�?px�?2px�?6px�?4px�?2px�?8px
   - 圆角规范�?     - 小组件：4px
     - 卡片�?px
     - 模态框�?2px

#### 实施原则

1. **原创性实�?*：以参考方案为灵感来源，确保进行原创性实现而非直接复制
   - 分析参考方案的设计意图和用户体验目�?   - 结合 V9 项目的业务特点和技术栈进行创新
   - 避免像素级复制，注重设计精神的传�?
2. **完整性保�?*：设计必须完整包含参考方案中的所有关键设计元素和界面功能，同时保留其核心用户体验
   - 关键功能：评分流程、数据展示、交互反�?   - 核心体验：信息层次清晰、操作路径简洁、视觉呈现统一
   - 功能清单：逐一对照参考方案，确保无遗�?
3. **用户视角优先**：严格从终端用户视角评估和采纳参考方案，优先考虑可用性、可访问性和直观的交互流程，而非技术实现细�?   - 可用性测试：邀�?3-5 名目标用户进行任务测�?   - 可访问性：符合 WCAG 2.1 AA 标准（对比度 �?.5:1，键盘可访问�?   - 交互流程：用户完成核心任务的步骤 �? �?
4. **卓越视觉呈现**：最终的静�?UI 组件应达到卓越的视觉呈现效果
   - **精确的排�?*�?     - 字体：系统字体栈（`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`�?     - 对齐：文本左对齐，数字右对齐，标题居�?     - 层次：通过字号、字重、颜色建立清晰的视觉层次
   - **一致的间距**�?     - 使用 4px 基础单位的倍数�?px�?2px�?6px�?4px�?2px�?8px�?     - 同类元素间距保持一致（如列表项间距统一�?8px�?     - 使用 CSS 变量管理间距，便于全局调整
   - **和谐的色彩方�?*�?     - 遵循 60-30-10 法则�?0% 主色（背景）�?0% 辅助色（卡片）�?0% 强调色（按钮�?     - 色彩语义一致：成功=绿色、警�?橙色、错�?红色、信�?蓝色
     - 暗色模式：使�?HSL 色彩空间，调整亮度和饱和�?   - **响应式表�?*�?     - 移动优先：从小屏幕开始设计，逐步增强到大屏幕
     - 弹性布局：使�?Flexbox �?Grid，避免固定宽�?     - 图片优化：使�?`srcset` �?`sizes` 属性，适配不同分辨�?     - 断点测试：在 375px�?68px�?024px�?440px 四个断点验证布局

### 设计验收标准

#### 视觉验收

- [ ] 色彩方案符合宋瓷美学（象牙白/暖灰�?+ 翡翠绿强�?+ 朱砂红警示）
- [ ] 排版层次清晰（标�?> 小标�?> 正文 > 辅助文本�?- [ ] 间距一致（使用 4px 基础单位的倍数�?- [ ] 圆角统一（小组件 4px、卡�?8px、模态框 12px�?
#### 功能验收

- [ ] 五舱工作流完整（输入 �?分析 �?交易 �?输出 �?总控�?- [ ] Widget 化驾驶舱可配置（拖拽排序、独立刷新）
- [ ] PWA 可安装、离线可�?- [ ] 移动端适配�?75px 不崩�?
#### 性能验收

- [ ] 首屏加载 <2s（Lighthouse Performance �?0�?- [ ] 交互响应 <100ms
- [ ] 无布局偏移（CLS <0.1�?
#### 可访问性验�?
- [ ] 对比�?�?.5:1（WCAG AA�?- [ ] 键盘可访问（Tab 顺序合理�?- [ ] 屏幕阅读器友好（ARIA 标签完整�?
---

## 1. 设计水准基线（原�?�?现状评分�?
| # | 原则 | 水位 | 承载阶段 |
|---|------|------|----------|
| �?| 视觉层次 | �?55% | P0/P2 |
| �?| 留白节奏 | �?50% | P0/P2 |
| �?| 色彩节制(60-30-10) | �?60% | P0/P4 |
| �?| 排版秩序 | �?58% | P0/P2 |
| �?| 状态可�?Nielsen�? | �?35% | P1/P3 |
| �?| 一致�?令牌) | �?75% | P0/P4 |
| �?| 渐进披露 | �?30% | P5 |
| �?| 容错安心 | �?45% | P3/P5 |
| �?| 签名母题 | �?25% | P2 |
| �?| 有意义的�?| �?50% | P2/P5 |

强项=一致�?�?；最�?签名母题(�?/渐进披露(�?/状态可�?�?。提升策�?把低分项拉到目标线，不推倒重来�?
---

## 2. 详细实施计划（P0–P6�?
每阶段：`目标 �?具体步骤(文件/命令) �?依赖 �?验收 �?风险`�?*�?本回合已执行**�?*�?计划中（需视觉/CI 验证�?*�?
### �?P0 设计基线固化�?�? 天）
- **目标**：令牌单一真相�?+ 主色 AA 校验 + 单强调色公约�?- 步骤�?  1. �?新建 `scripts/other/a11y-contrast.cjs` 并运行，产出对比度报告（�?§0）�?  2. �?调和 `design-tokens/tokens.json`：`light.primary`/`light.ring`/`dark.primary`/`dark.ring` �?`blue.500/400` 改为 `emerald.600/700`；运行生成器重写 `src/generated/tokens.css` + `tokens.ts`（注：生成的 `--color-primary` 仍是死变量，但规范源不再自相矛盾）�?  3. �?对齐 `src/constants/theme/theme.tokens.design.ts` �?`SEMANTIC_COLOR_ROLES.primary.raw` �?`#059669`�?  4. �?`AGENTS.md §三` 增补：① 单一克制强调色公约；�?令牌管线一致性规则（tokens.json 为源，generated 须与 index.css 一致，主色=emerald）�?- 验收：`node scripts/a11y-contrast.cjs` 可跑；`grep -n "primary.*blue\|ring.*blue" design-tokens/tokens.json` 零命中；`npm run audit:docs`�?- 风险：低（tokens.json 为生成源，可回滚）�?
### �?P1 暗色优先 & 主题体验�?�? 天）
- **目标**：驾驶舱/分析舱默认暗�?+ 持久�?+ �?FOUC�?- 步骤�?  1. 新增/调整 `src/core/ThemeProvider.tsx`（`withBroadcast` �?Tab 同步，符�?AGENTS.md），驾驶舱默�?`dark` 且持久化�?  2. 补全暗色令牌；核�?`chartColors.ts` 暗色变体对比度�?  3. `index.html` 内联脚本�?CSS 加载前读持久化值设 `data-theme`，消除首屏闪白�?  4. **对齐主题属�?*：确�?`ThemeProvider` �?`data-theme` �?`generated/tokens.css` �?`[data-theme]` 一致（已一致），并�?`index.css` �?`.dark` �?`data-theme` 双轨统一，避免两套变量并存漂移�?- 依赖：P0。验收：驾驶舱暗色覆盖率 100%、无 FOUC、跨 Tab 同步。风险：中（暗色令牌覆盖）�?
### �?P2 统一视觉锚点（签名母题）�?�? 天中的组件部分）
- **目标**：植�?V9 专属签名母题，统一�?WidgetShell 收口�?- 步骤�?  1. �?新建 `src/components/cockpit/SignalSpectrum.tsx`：全局「信号强度谱」母题（弱→强渐�?+ 标记），引用 `SEMANTIC_COLOR_ROLES`/令牌，无硬编码色�?  2. �?核查全部 cockpit widget �?`WidgetShell.tsx` 渲染；未接入者统一收口，顶部挂锚点条�?- 依赖：P0。验收：核心 widget 100% �?WidgetShell；锚点组件单测通过。风险：低�?
### �?P3 交互与状态标准（3�? 天中的组件部分）
- **目标**：loading/empty/error/skeleton 四�?+ 微动效令牌�?- 步骤�?  1. �?新建 `src/components/ui/states/{Loading,Empty,Error,Skeleton}.tsx`，引�?`THEME_TOKENS`/`SEMANTIC_COLOR_ROLES`，无硬编码色�?  2. �?`src/constants/theme/theme.tokens.base.ts` �?`THEME_TOKENS` 新增 `motion`（duration/easing）令牌�?  3. �?核心 8 �?widget 接入四态（推广）�?- 依赖：P0。验收：核心 widget 四态覆�?�?0%；动效零魔法时长。风险：中（改造较多）�?
### �?P4 令牌迁移债清�?& 视觉 QA 闸门�?�? 天）
- **目标**：lint 禁裸 Tailwind 色类 + 令牌一致性扫�?CI 闸门�?- 步骤�?  1. ESLint(flat config) 加规则禁 `text-/bg-/border-(red|blue|green|�?-\d+` 裸类（白名单 `STOCK_COLOR_TOKENS` 固定红绿）。分�?PR：先规则(warning)再清�?error)�?  2. `scripts/other/token-scan.cjs` 扫描源码裸色类，CI 卡点�?  3. Playwright 截图 diff 受本环境沙箱限制，标�?*本地手动闸门**�?- 依赖：P0–P3。验收：裸色�?0 命中（白名单除外）；CI 红则阻断。风险：中�?
### �?P5 结果优先呈现 & 渐进披露�?�? 天）
- **目标**：复盘「成品卡�? 向导式复盘�?- 步骤�?  1. 新建 `src/components/atoms/Result.tsx`（可预览/分享/导出）�?  2. 输入/输出舱引入分步引导（模式切换），老手可跳过�?- 依赖：P2。验收：成品卡可预览/导出；向导可跳过。风险：中�?
### �?P6 移动适配 & 常态化巡检（持续）
- **目标**：核心舱室响应式 + 巡检 skill 固化�?- 步骤�?  1. 驾驶�?复盘卡断点适配（≤375px 不崩）�?  2. `SkillManage` 沉淀「参考站逆向比对」为 `ui-design-audit` skill�?- 依赖：P1。验收：移动断点不崩；skill 可用。风险：低�?
---

## 3. 验收闸门（对�?AGENTS.md�?
| 阶段 | 必须通过的闸�?|
|------|----------------|
| P0 | `node scripts/a11y-contrast.cjs`；`npm run audit:docs`；`npx tsc --noEmit` |
| P1 | `npm run audit:layers`；`npm run test -- --run` |
| P2 | `npm run audit:layers`；tsc；锚点单�?|
| P3 | `npm run test -- --run`；四态覆�?|
| P4 | CI lint gate；`scripts/other/token-scan.cjs` |
| P5 | tsc；test |
| P6 | 手动移动验真；skill 沉淀 |

**回滚纪律**：每阶段可独立回滚；回滚后重�?`tsc --noEmit` + `audit:layers` + `test --run` + `audit:docs`�?
---

## 4. 本回合已落地产物

| 类型 | 文件 | 说明 |
|------|------|------|
| 新增 | `scripts/other/a11y-contrast.cjs` | WCAG AA 对比度校验，可运�?|
| 修改 | `design-tokens/tokens.json` | primary/ring 蓝→emerald（与运行�?文档一致） |
| 生成 | `src/generated/tokens.css`、`src/generated/tokens.ts` | �?tokens.json 重新生成 |
| 修改 | `src/constants/theme/theme.tokens.design.ts` | `SEMANTIC_COLOR_ROLES.primary.raw` �?`#059669` |
| 修改 | `../../AGENTS.md` | §�?增补单强调色 + 令牌管线一致性公�?|
| 新增 | `src/components/cockpit/SignalSpectrum.tsx` | 签名母题组件（P2�?|
| 新增 | `src/components/ui/states/{Loading,Empty,Error,Skeleton}.tsx` | 四态组件（P3�?|
| 修改 | `src/constants/theme/theme.tokens.base.ts` | `THEME_TOKENS.motion` 动效令牌（P3�?|
| 文档 | `ui设计优化实施计划-详细�?md` | 本计�?|

> 待视�?CI 验证后执行：P1 主题切换、P4 lint/CI、P5 向导、P6 移动（详�?§2）�?
## 5. 验证方式
- 本地 `npm run dev` �?强调色应统一为绿色（emerald），不再蓝绿并存�?- `node scripts/a11y-contrast.cjs` 查看对比度报告�?- `npx tsc --noEmit` 校验新增 TS 类型安全�?
---

## 6. 关键功能模块设计规范（P7�?
> 基于参考网页设计理念（Widget化驾驶舱、五舱工作流、宋瓷美学）与项目现状，补充四个关键功能模块的详细设计�?
### 6.1 数据采集完整流程与用户交互界�?
#### 6.1.1 设计目标

创建�?数据源配�?�?采集任务创建 �?实时监控 �?结果验证"的完整闭环，让用户清晰了解数据采集的每个环节�?
#### 6.1.2 界面架构�?步向导式�?
```
数据采集流程
├── 步骤1：数据源配置（选择数据维度、配置API参数�?├── 步骤2：采集策略（频率、优先级、缓存策略）
├── 步骤3：任务预览（确认配置、预估资源消耗）
└── 步骤4：执行监控（实时日志、进度追踪、异常处理）
```

#### 6.1.3 核心组件

**A. 数据采集向导组件（DataCollectionWizard�?*

- **位置**：`src/components/organisms/input/DataCollectionWizard.tsx`
- **功能**�?  - 4步向导式流程，每步可独立回退
  - 步骤指示器显示当前进�?  - 每步完成后自动验证配置有效�?  - 支持保存为模板，下次快速复�?
**B. 数据源配置步骤（DataSourceConfigStep�?*

- **功能**�?  - 7维度数据源选择（基础行情、K线、财务、新闻、研报、行业、自定义�?  - 每个维度显示数据源状态（可用/不可�?需要配置）
  - API参数配置（Base URL、API Key、请求频率限制）
  - 数据质量预估（基于历史成功率�?
**界面布局**�?
```tsx
<div className="space-y-4">
  <Alert>
    <AlertTitle>数据源配�?/AlertTitle>
    <AlertDescription>选择需要采集的数据维度，并配置对应的API参数</AlertDescription>
  </Alert>
  
  <div className="grid gap-3">
    {DIMENSIONS.map(dim => (
      <Card key={dim.code} className={cn(
        "cursor-pointer transition-all",
        selectedDimensions.includes(dim.code) && "ring-2 ring-primary"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedDimensions.includes(dim.code)}
                  onCheckedChange={(checked) => toggleDimension(dim.code, checked)}
                />
                <h3 className="font-semibold">{dim.name}</h3>
                <Badge variant={dim.available ? 'success' : 'destructive'}>
                  {dim.available ? '可用' : '需配置'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{dim.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  历史成功�? {dim.successRate}%
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  平均延迟: {dim.avgLatency}ms
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
</div>
```

**C. 采集策略步骤（CollectionStrategyStep�?*

- **功能**�?  - 采集频率配置（实�?每小�?每日/自定义Cron�?  - 优先级设置（�?�?低，影响资源分配�?  - 缓存策略（TTL、失效策略）
  - 失败重试策略（重试次数、间隔、降级方案）

**D. 任务预览步骤（TaskPreviewStep�?*

- **功能**�?  - 汇总所有配置，生成任务摘要
  - 预估资源消耗（API调用次数、预计耗时、存储占用）
  - 显示潜在风险（数据源不稳定、频率过高等�?  - 支持保存为模�?
**E. 执行监控步骤（ExecutionMonitorStep�?*

- **功能**�?  - 实时任务状态（运行�?已完�?失败/暂停�?  - 进度条显示（总体进度 + 各维度进度）
  - 实时日志流（可暂停、搜索、过滤）
  - 异常处理（重试、跳过、终止）
  - 性能指标（成功率、平均延迟、吞吐量�?
#### 6.1.4 数据流设�?
```typescript
// Store 状态管�?interface CollectionWizardState {
  // 向导状�?  currentStep: number
  isOpen: boolean
  
  // 步骤1：数据源配置
  selectedDimensions: string[]
  apiConfigs: Record<string, ApiConfig>
  
  // 步骤2：采集策�?  frequency: 'realtime' | 'hourly' | 'daily' | 'custom'
  cronExpression: string
  priority: 'high' | 'medium' | 'low'
  cacheTTL: number
  cacheStrategy: 'stale-while-revalidate' | 'cache-first' | 'network-first'
  
  // 步骤3：任务预�?  taskName: string
  saveAsTemplate: boolean
  
  // 步骤4：执行监�?  taskId: string | null
  taskStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  dimensionProgress: DimensionProgress[]
  logs: LogEntry[]
  
  // Actions
  setStep: (step: number) => void
  toggleDimension: (code: string, checked: boolean) => void
  updateApiConfig: (code: string, config: ApiConfig) => void
  startTask: () => Promise<void>
  pauseTask: () => void
  resumeTask: () => void
  stopTask: () => void
}
```

#### 6.1.5 交互流程

1. **用户点击"新建采集任务"** �?打开向导弹窗
2. **步骤1**：选择数据维度，配置API参数 �?点击"下一�?
3. **步骤2**：配置采集策�?�?点击"下一�?
4. **步骤3**：预览任务配置，确认无误 �?点击"开始采�?
5. **步骤4**：实时监控任务执行，查看日志和进�?6. **任务完成**：显示成功提示，可查看采集结果或创建新任�?
---

### 6.2 大模型调用参数配置界面与用户互动设计

#### 6.2.1 设计目标

提供透明、可控的 LLM 配置界面，让用户清晰了解每个因子�?LLM 使用情况、资源消耗和成本�?
#### 6.2.2 界面架构（三区域布局�?
```
LLM 配置界面
├── 左侧：模型选择与基础配置
�?  ├── 模型预设选择（DeepSeek/Kimi/硅基流动/自定义）
�?  ├── API 参数配置（Base URL、API Key、Model�?�?  └── 高级参数（Temperature、Max Tokens、Timeout�?├── 中间：因子级 LLM 控制
�?  ├── 全局 LLM 开�?�?  ├── 各因子独立开关（8维度�?�?  └── 因子权重调整
└── 右侧：使用统计与成本
    ├── 今日/本月调用次数
    ├── Token 消耗统�?    ├── 成本估算
    └── 按因�?模型分类统计
```

#### 6.2.3 核心组件

**A. 模型预设选择器（ModelPresetSelector�?*

- **功能**�?  - 预设模型快速选择（DeepSeek、Kimi、硅基流动等�?  - 自定义模型配置（Base URL、API Key、Model�?  - 模型能力对比（上下文窗口、价格、速度�?  - 连接测试按钮

**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>模型选择</CardTitle>
    <CardDescription>选择预设或自定义配置 LLM 模型</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>模型提供�?/Label>
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger>
          <SelectValue placeholder="选择模型预设" />
        </SelectTrigger>
        <SelectContent>
          {LLM_MODEL_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.name} ({preset.provider})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {selectedPreset === 'custom' && (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input
            value={config.baseURL}
            onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
          />
        </div>
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? '隐藏' : '显示'}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Input
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="deepseek-chat"
          />
        </div>
      </div>
    )}

    <Button
      variant="outline"
      className="w-full"
      onClick={handleTestConnection}
      disabled={isTesting}
    >
      {isTesting ? '测试�?..' : '测试连接'}
    </Button>

    {testResult && (
      <Alert variant={testResult.success ? 'default' : 'destructive'}>
        <AlertTitle>{testResult.success ? '连接成功' : '连接失败'}</AlertTitle>
        <AlertDescription>{testResult.message}</AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

**B. 因子�?LLM 控制面板（FactorLlmControlPanel�?*

- **功能**�?  - 全局 LLM 开关（一键启�?禁用所有因子的 LLM 增强�?  - 各因子独立开关（8维度：基础面、技术面、资金面、消息面等）
  - 因子权重调整滑块
  - LLM 增强标记（显示哪些因子使用了 LLM�?
**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>因子�?LLM 控制</CardTitle>
        <CardDescription>精细控制每个评分因子�?LLM 增强</CardDescription>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="global-llm" className="text-sm">全局开�?/Label>
        <Switch
          id="global-llm"
          checked={globalLlmEnabled}
          onCheckedChange={setGlobalLlmEnabled}
        />
      </div>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {SCORE_FACTORS.map((factor) => (
      <div key={factor.code} className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`factor-${factor.code}`}
              checked={factorOverrides[factor.code]?.enabled ?? false}
              onCheckedChange={(checked) => toggleFactorLlm(factor.code, checked)}
              disabled={!globalLlmEnabled}
            />
            <Label htmlFor={`factor-${factor.code}`} className="font-medium">
              {factor.name}
            </Label>
            {factorOverrides[factor.code]?.enabled && (
              <Badge variant="secondary" className="text-xs">
                <Brain className="mr-1 h-3 w-3" />
                LLM 增强
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            权重: {factor.weight.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          {factor.description}
        </p>
      </div>
    ))}
  </CardContent>
</Card>
```

**C. 使用统计面板（UsageStatsPanel�?*

- **功能**�?  - 今日/本月调用次数统计
  - Token 消耗统计（输入/输出/总计�?  - 成本估算（基于模型价格）
  - 按因子分类统计（哪些因子消耗最多）
  - 按模型分类统计（多模型场景）
  - 趋势图表（近7�?30天调用趋势）

**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>使用统计</CardTitle>
    <CardDescription>LLM 调用统计与成本估�?/CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">今日调用</p>
          <p className="text-2xl font-bold text-primary">{stats.todayCalls}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">本月调用</p>
          <p className="text-2xl font-bold text-primary">{stats.monthCalls}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Token 消�?/p>
          <p className="text-2xl font-bold text-primary">{formatToken(stats.tokenUsage.total)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">成本估算</p>
          <p className="text-2xl font-bold text-primary">${stats.costEstimate.toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>

    <Tabs defaultValue="byFactor">
      <TabsList>
        <TabsTrigger value="byFactor">按因�?/TabsTrigger>
        <TabsTrigger value="byModel">按模�?/TabsTrigger>
        <TabsTrigger value="trend">趋势</TabsTrigger>
      </TabsList>
      <TabsContent value="byFactor">
        <div className="space-y-2">
          {Object.entries(stats.callsByFactor).map(([factor, count]) => (
            <div key={factor} className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">{factor}</span>
              <div className="flex items-center gap-2">
                <Progress value={(count / stats.todayCalls) * 100} className="w-24 h-2" />
                <span className="text-sm font-medium">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="byModel">
        {/* 按模型分类统�?*/}
      </TabsContent>
      <TabsContent value="trend">
        {/* 趋势图表 */}
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

#### 6.2.4 数据流设�?
```typescript
// Store 状态管�?interface LlmConfigState {
  // 基础配置
  selectedPreset: string
  config: {
    baseURL: string
    apiKey: string
    model: string
    maxTokens: number
    temperature: number
    timeout: number
  }
  
  // 因子控制
  globalLlmEnabled: boolean
  factorOverrides: Record<string, {
    enabled: boolean
    weight: number
    usedLlm?: boolean
  }>
  
  // 使用统计
  usageStats: {
    todayCalls: number
    monthCalls: number
    tokenUsage: { input: number; output: number; total: number }
    costEstimate: number
    callsByFactor: Record<string, number>
    callsByModel: Record<string, number>
  }
  
  // Actions
  setPreset: (presetId: string) => void
  updateConfig: (config: Partial<LlmConfig>) => void
  toggleGlobalLlm: (enabled: boolean) => void
  toggleFactorLlm: (factorCode: string, enabled: boolean) => void
  testConnection: () => Promise<TestResult>
  refreshStats: () => Promise<void>
}
```

#### 6.2.5 交互流程

1. **用户进入 LLM 管理页面** �?自动加载当前配置和使用统�?2. **选择模型预设** �?自动填充 Base URL �?Model
3. **配置 API Key** �?加密存储�?localStorage
4. **调整因子级控�?* �?启用/禁用特定因子�?LLM 增强
5. **测试连接** �?验证 API Key 和模型可用�?6. **查看使用统计** �?了解调用量、Token 消耗和成本
7. **保存配置** �?应用到后续评分任�?
---

### 6.3 交易流程界面设计与操作逻辑

#### 6.3.1 设计目标

提供完整的交易流程管理界面，�?策略生成 �?订单执行 �?持仓管理 �?风险控制"的全链路覆盖�?
#### 6.3.2 界面架构（四区域布局�?
```
交易流程界面
├── 左侧：策略与信号
�?  ├── 交易信号列表（买�?卖出/持有�?�?  ├── 策略快照（历史策略记录）
�?  └── 信号强度指示�?├── 中间：订单执�?�?  ├── 订单创建表单
�?  ├── 订单列表（待执行/已执�?已取消）
�?  └── 执行进度追踪
├── 右侧：持仓管�?�?  ├── 持仓列表（股票、数量、成本、盈亏）
�?  ├── 持仓分析（行业分布、风险敞口）
�?  └── 快速操作（加仓/减仓/平仓�?└── 底部：风险控�?    ├── 风险指标（VaR、最大回撤、夏普比率）
    ├── 止损/止盈规则
    └── 风险预警
```

#### 6.3.3 核心组件

**A. 交易信号面板（TradingSignalPanel�?*

- **功能**�?  - 实时交易信号展示（买�?卖出/持有�?  - 信号强度指示（弱/�?强）
  - 信号来源标记（V6评分/智能评分/自定义策略）
  - 一键下单（从信号直接创建订单）

**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>交易信号</CardTitle>
    <CardDescription>基于评分和策略生成的交易信号</CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    {signals.map((signal) => (
      <Card key={signal.id} className={cn(
        "border-l-4",
        signal.action === 'buy' && "border-l-red-500",
        signal.action === 'sell' && "border-l-green-500",
        signal.action === 'hold' && "border-l-gray-500"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={
                  signal.action === 'buy' ? 'destructive' :
                  signal.action === 'sell' ? 'success' : 'outline'
                }>
                  {signal.action === 'buy' ? '买入' :
                   signal.action === 'sell' ? '卖出' : '持有'}
                </Badge>
                <span className="font-semibold">{signal.symbol}</span>
                <span className="text-sm text-muted-foreground">{signal.name}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  信号强度: {signal.strength}%
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  目标�? {signal.targetPrice}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime(signal.generatedAt)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {signal.reason}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => createOrderFromSignal(signal)}
            >
              下单
            </Button>
          </div>
        </CardContent>
      </Card>
    ))}
  </CardContent>
</Card>
```

**B. 订单执行面板（OrderExecutionPanel�?*

- **功能**�?  - 订单创建表单（股票代码、方向、数量、价格、订单类型）
  - 订单列表（待执行/已执�?已取消）
  - 执行进度追踪（订单状态实时更新）
  - 订单历史记录

**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>订单执行</CardTitle>
    <CardDescription>创建和管理交易订�?/CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <form onSubmit={handleCreateOrder} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>股票代码</Label>
          <Input
            value={orderForm.symbol}
            onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value })}
            placeholder="600519.SH"
          />
        </div>
        <div className="space-y-2">
          <Label>交易方向</Label>
          <Select
            value={orderForm.side}
            onValueChange={(value) => setOrderForm({ ...orderForm, side: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">买入</SelectItem>
              <SelectItem value="sell">卖出</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>数量（股�?/Label>
          <Input
            type="number"
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) })}
            placeholder="100"
          />
        </div>
        <div className="space-y-2">
          <Label>价格（元�?/Label>
          <Input
            type="number"
            step="0.01"
            value={orderForm.price}
            onChange={(e) => setOrderForm({ ...orderForm, price: parseFloat(e.target.value) })}
            placeholder="1800.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>订单类型</Label>
        <RadioGroup
          value={orderForm.type}
          onValueChange={(value) => setOrderForm({ ...orderForm, type: value })}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="limit" id="limit" />
            <Label htmlFor="limit">限价�?/Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="market" id="market" />
            <Label htmlFor="market">市价�?/Label>
          </div>
        </RadioGroup>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? '提交�?..' : '创建订单'}
      </Button>
    </form>

    <div className="space-y-3">
      <h3 className="font-semibold">订单列表</h3>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    order.status === 'executed' ? 'success' :
                    order.status === 'pending' ? 'default' : 'outline'
                  }>
                    {order.status === 'executed' ? '已执�? :
                     order.status === 'pending' ? '待执�? : '已取�?}
                  </Badge>
                  <span className="font-medium">{order.symbol}</span>
                  <span className={order.side === 'buy' ? 'text-red-500' : 'text-green-500'}>
                    {order.side === 'buy' ? '买入' : '卖出'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {order.quantity}�?@ {order.price}�?· {formatTime(order.createdAt)}
                </div>
              </div>
              {order.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelOrder(order.id)}
                >
                  取消
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </CardContent>
</Card>
```

**C. 持仓管理面板（PositionManagementPanel�?*

- **功能**�?  - 持仓列表（股票、数量、成本、当前价、盈亏）
  - 持仓分析（行业分布、风险敞口）
  - 快速操作（加仓/减仓/平仓�?  - 盈亏统计（总盈亏、今日盈亏、盈亏比例）

**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>持仓管理</CardTitle>
    <CardDescription>当前持仓与盈亏分�?/CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">总盈�?/p>
          <p className={cn(
            "text-2xl font-bold",
            totalPnl >= 0 ? 'text-red-500' : 'text-green-500'
          )}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">今日盈亏</p>
          <p className={cn(
            "text-2xl font-bold",
            todayPnl >= 0 ? 'text-red-500' : 'text-green-500'
          )}>
            {todayPnl >= 0 ? '+' : ''}{todayPnl.toFixed(2)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">持仓市�?/p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalValue)}
          </p>
        </CardContent>
      </Card>
    </div>

    <div className="space-y-3">
      {positions.map((position) => (
        <Card key={position.symbol}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{position.symbol}</span>
                  <span className="text-sm text-muted-foreground">{position.name}</span>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">持仓数量</p>
                    <p className="font-medium">{position.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">成本�?/p>
                    <p className="font-medium">{position.costPrice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">当前�?/p>
                    <p className="font-medium">{position.currentPrice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">盈亏</p>
                    <p className={cn(
                      "font-medium",
                      position.pnl >= 0 ? 'text-red-500' : 'text-green-500'
                    )}>
                      {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
                      ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddPosition(position.symbol)}
                >
                  加仓
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReducePosition(position.symbol)}
                >
                  减仓
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </CardContent>
</Card>
```

**D. 风险控制面板（RiskControlPanel�?*

- **功能**�?  - 风险指标展示（VaR、最大回撤、夏普比率）
  - 止损/止盈规则配置
  - 风险预警（超阈值提醒）
  - 仓位控制建议

**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>风险控制</CardTitle>
    <CardDescription>风险指标与预�?/CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">VaR (95%)</p>
          <p className="text-2xl font-bold text-primary">{riskMetrics.var.toFixed(2)}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">最大回�?/p>
          <p className="text-2xl font-bold text-primary">{riskMetrics.maxDrawdown.toFixed(2)}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">夏普比率</p>
          <p className="text-2xl font-bold text-primary">{riskMetrics.sharpeRatio.toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>

    <div className="space-y-3">
      <h3 className="font-semibold">止损/止盈规则</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>止损比例 (%)</Label>
          <Input
            type="number"
            value={stopLossPercent}
            onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
            placeholder="10"
          />
        </div>
        <div className="space-y-2">
          <Label>止盈比例 (%)</Label>
          <Input
            type="number"
            value={takeProfitPercent}
            onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value))}
            placeholder="20"
          />
        </div>
      </div>
    </div>

    {riskAlerts.length > 0 && (
      <Alert variant="destructive">
        <AlertTitle>风险预警</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1">
            {riskAlerts.map((alert, idx) => (
              <li key={idx}>{alert}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

#### 6.3.4 数据流设�?
```typescript
// Store 状态管�?interface TradingState {
  // 交易信号
  signals: TradingSignal[]
  
  // 订单
  orders: Order[]
  orderForm: OrderForm
  
  // 持仓
  positions: Position[]
  
  // 风险控制
  riskMetrics: RiskMetrics
  stopLossPercent: number
  takeProfitPercent: number
  riskAlerts: string[]
  
  // Actions
  createOrder: (order: OrderForm) => Promise<void>
  cancelOrder: (orderId: string) => Promise<void>
  addPosition: (symbol: string, quantity: number) => Promise<void>
  reducePosition: (symbol: string, quantity: number) => Promise<void>
  updateRiskRules: (rules: RiskRules) => void
  refreshRiskMetrics: () => Promise<void>
}
```

#### 6.3.5 交互流程

1. **查看交易信号** �?从评分结果或策略生成
2. **创建订单** �?填写订单表单或从信号一键下�?3. **订单执行** �?实时更新订单状�?4. **持仓管理** �?查看持仓盈亏，快速加�?减仓
5. **风险控制** �?配置止损/止盈规则，接收风险预�?
---

### 6.4 输出内容展示格式与交互方�?
#### 6.4.1 设计目标

提供多样化的输出内容展示格式，支持研报复盘、交易复盘、评分报告等多种场景，并提供便捷的导出和分享功能�?
#### 6.4.2 界面架构（三区域布局�?
```
输出内容展示
├── 左侧：内容列�?�?  ├── 研报复盘列表
�?  ├── 交易复盘列表
�?  ├── 评分报告列表
�?  └── 自定义报告列�?├── 中间：内容详�?�?  ├── 报告头部（标题、时间、标签）
�?  ├── 报告正文（Markdown渲染�?�?  ├── 数据可视化（图表、表格）
�?  └── 操作按钮（编辑、导出、分享）
└── 右侧：元数据与操�?    ├── 报告元数据（创建时间、更新时间、标签）
    ├── 导出选项（PDF/JSON/Markdown�?    ├── 分享设置（公开/私有/链接分享�?    └── 版本历史
```

#### 6.4.3 核心组件

**A. 内容列表面板（ContentListPanel�?*

- **功能**�?  - 多类型内容列表（研报复盘、交易复盘、评分报告）
  - 搜索与过滤（按标题、标签、时间范围）
  - 排序（最新、最热、评分最高）
  - 快速预览（悬停显示摘要�?
**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>内容列表</CardTitle>
      <Button size="sm" onClick={createNewReport}>
        <Plus className="h-4 w-4 mr-1" />
        新建
      </Button>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="flex gap-2">
      <Input
        placeholder="搜索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1"
      />
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="research">研报</SelectItem>
          <SelectItem value="trade">交易</SelectItem>
          <SelectItem value="score">评分</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-2">
      {reports.map((report) => (
        <Card
          key={report.id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            selectedReportId === report.id && "ring-2 ring-primary"
          )}
          onClick={() => selectReport(report.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{report.typeLabel}</Badge>
                  <h3 className="font-semibold">{report.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {report.summary}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(report.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {report.viewCount}
                  </span>
                  {report.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </CardContent>
</Card>
```

**B. 内容详情面板（ContentDetailPanel�?*

- **功能**�?  - Markdown 渲染（支持代码块、表格、图表）
  - 数据可视化嵌入（Recharts 图表�?  - 实时编辑（Markdown 编辑器）
  - 版本对比（历史版�?diff�?
**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>{report.title}</CardTitle>
        <CardDescription>
          {formatTime(report.createdAt)} · {report.typeLabel}
        </CardDescription>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={toggleEdit}>
          {isEditing ? '预览' : '编辑'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              导出
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportToPDF(report)}>
              导出 PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToMarkdown(report)}>
              导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToJSON(report)}>
              导出 JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={shareReport}>
          <Share2 className="h-4 w-4 mr-1" />
          分享
        </Button>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    {isEditing ? (
      <MarkdownEditor
        value={report.content}
        onChange={(content) => updateReport(report.id, { content })}
      />
    ) : (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" {...props} />
              </div>
            ),
            code: ({ node, inline, ...props }) =>
              inline ? (
                <code className="bg-muted px-1 rounded" {...props} />
              ) : (
                <pre className="bg-muted p-4 rounded overflow-x-auto">
                  <code {...props} />
                </pre>
              ),
          }}
        >
          {report.content}
        </ReactMarkdown>
      </div>
    )}
  </CardContent>
</Card>
```

**C. 元数据与操作面板（MetadataPanel�?*

- **功能**�?  - 报告元数据展示（创建时间、更新时间、标签）
  - 导出选项（PDF/JSON/Markdown�?  - 分享设置（公开/私有/链接分享�?  - 版本历史（查看和恢复历史版本�?
**界面布局**�?
```tsx
<Card>
  <CardHeader>
    <CardTitle>元数�?/CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>创建时间</Label>
      <p className="text-sm">{formatTime(report.createdAt)}</p>
    </div>
    <div className="space-y-2">
      <Label>更新时间</Label>
      <p className="text-sm">{formatTime(report.updatedAt)}</p>
    </div>
    <div className="space-y-2">
      <Label>标签</Label>
      <div className="flex flex-wrap gap-2">
        {report.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
    </div>

    <Separator />

    <div className="space-y-2">
      <Label>分享设置</Label>
      <Select
        value={report.visibility}
        onValueChange={(value) => updateReport(report.id, { visibility: value })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">私有</SelectItem>
          <SelectItem value="link">链接分享</SelectItem>
          <SelectItem value="public">公开</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Separator />

    <div className="space-y-2">
      <Label>版本历史</Label>
      <div className="space-y-2">
        {report.versions.map((version) => (
          <div
            key={version.id}
            className="flex items-center justify-between py-2 border-b"
          >
            <div>
              <p className="text-sm font-medium">{version.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(version.createdAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => restoreVersion(version.id)}
            >
              恢复
            </Button>
          </div>
        ))}
      </div>
    </div>
  </CardContent>
</Card>
```

#### 6.4.4 数据流设�?
```typescript
// Store 状态管�?interface OutputState {
  // 内容列表
  reports: Report[]
  selectedReportId: string | null
  searchQuery: string
  filterType: 'all' | 'research' | 'trade' | 'score'
  
  // 内容详情
  selectedReport: Report | null
  isEditing: boolean
  
  // Actions
  loadReports: () => Promise<void>
  selectReport: (id: string) => void
  createReport: (report: Partial<Report>) => Promise<void>
  updateReport: (id: string, updates: Partial<Report>) => Promise<void>
  deleteReport: (id: string) => Promise<void>
  exportReport: (id: string, format: 'pdf' | 'markdown' | 'json') => Promise<void>
  shareReport: (id: string, visibility: 'private' | 'link' | 'public') => Promise<void>
  restoreVersion: (versionId: string) => Promise<void>
}
```

#### 6.4.5 交互流程

1. **查看内容列表** �?搜索、过滤、排�?2. **选择报告** �?查看详情
3. **编辑报告** �?切换到编辑模式，修改内容
4. **导出报告** �?选择导出格式（PDF/JSON/Markdown�?5. **分享报告** �?设置分享权限（私�?链接/公开�?6. **版本管理** �?查看历史版本，恢复到指定版本

---

## 7. 实施优先级与验收标准

### 7.1 实施优先�?
| 模块 | 优先�?| 预计工时 | 依赖 |
|------|--------|----------|------|
| 数据采集流程 | P0 | 3-4�?| �?|
| LLM 配置界面 | P0 | 2-3�?| �?|
| 交易流程界面 | P1 | 3-4�?| 数据采集 |
| 输出内容展示 | P1 | 2-3�?| �?|

### 7.2 验收标准

#### 数据采集流程

- [ ] 4步向导流程完整可�?- [ ] 数据源配置可保存和复�?- [ ] 实时监控日志流正�?- [ ] 任务可暂停、继续、终�?- [ ] 性能指标准确展示

#### LLM 配置界面

- [ ] 模型预设选择正常
- [ ] API Key 加密存储
- [ ] 因子�?LLM 控制生效
- [ ] 使用统计准确
- [ ] 成本估算合理

#### 交易流程界面

- [ ] 交易信号展示正常
- [ ] 订单创建和取消正�?- [ ] 持仓管理功能完整
- [ ] 风险控制指标准确
- [ ] 止损/止盈规则生效

#### 输出内容展示

- [ ] 内容列表搜索过滤正常
- [ ] Markdown 渲染正确
- [ ] 导出功能可用（PDF/JSON/Markdown�?- [ ] 分享设置生效
- [ ] 版本历史可恢�?
### 7.3 技术约�?
- 所有组件必须使�?`THEME_TOKENS` / `COLOR_TOKENS` / `COLOR_SHADES`，禁止硬编码颜色
- 所�?Store 必须通过 `withBroadcast` 实现�?Tab 广播
- 所有页面必须通过 `React.lazy()` 懒加�?- 所�?API 调用必须包含错误处理�?loading 状�?- 所有表单必须包含验证和错误提示
