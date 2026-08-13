# 01 · 设计与原创思路（Design & Original Thinking）

> 本文回答"**我们为什么这样设计**"。理解设计意图，团队才能在接手模块时做出符合初心的决策，而不是被历史代码牵着走。
> 权威基线：`docs/explanation/01-vision-and-goals.md`、`docs/explanation/song-aesthetics.md`、`docs/explanation/design-tokens.md`、`docs/specs/product/competitive-analysis.md`。

---

## 1. 项目定位与愿景

FinSightV9 不是又一个"看盘软件"，而是定位为：

> **中国 A 股个人投资者的「研究基础设施」**——不替代券商交易软件，而是成为研究、分析、决策、复盘的**独立工具**。

| 维度 | 交易工具（同花顺/东财） | 机构终端（Wind/iFinD） | **FinSightV9** |
|------|------------------------|------------------------|----------------|
| 核心关注 | 行情、下单、资讯 | 数据查询、研报 | **认知积累、模式识别、复盘学习** |
| 数据时效 | 实时盘中 | 实时 + 深度 | **盘后/历史回测为主** |
| 数据存储 | 云端 | 云端 | **本地 IndexedDB（数据主权）** |
| 使用频率 | 高频盯盘 | 高频专业 | **低频深度** |
| 离线 | 弱 | 弱 | **必须支持离线** |
| 架构 | 重后端 | 重后端 | **纯前端 PWA** |

**蓝海定位**：在"行情交易工具"和"机构研究终端"之间的空白地带——**个人投资研究操作系统**。

---

## 2. 四条核心设计哲学

1. **宋瓷美学（克制、温润、留白）**
   以暖灰为骨、低饱和为韵，对抗金融软件常见的信息过载与高彩度焦虑。详见 §3。

2. **不切屏原则（Continuous Workflow）**
   所有功能在**当前舱内**通过 Tab/面板切换实现，保持连续工作流，不跳出上下文。这是"五舱工作流"能成立的前提。

3. **数据血缘（Data Lineage）**
   每个评分、信号、订单必须**可追溯其来源数据版本**。这驱动了 Envelope 信封、`traceId`、采集生命周期事件、评分 `provenance` 字段等一整套设计。

4. **可删除性（Deletability）**
   交易层是**可选插件**，删除后研究体系仍完整运行。系统按"研究内核 → 可选交易扩展"分层，避免耦合。

---

## 3. 宋韵美学（Song-yun Aesthetic）

设计指南见 `docs/explanation/song-aesthetics.md`，落地令牌见 `docs/explanation/design/ui-design-system.md`（命名语言 **"Refined Finance"**）。

### 3.1 明暗双模铁律
- **亮色**：默认 `stone` 暖灰系（底 `stone-50/100`、正文 `stone-800`、强调 `emerald-500` 低饱和绿=宋韵点翠）。
- **暗色**：统一切 `neutral` 高级灰（hue 0，零彩度），**只改 `dark:*` 段，禁止改动亮色 `stone` 段**。

### 3.2 固定业务色（最重要的例外）
- **A 股红涨绿跌为固定业务色（L5）**，不随主题变化，暗色模式下亦不变。
- 禁止用 `COLOR_TOKENS.up/down` 或 `THEMOTE_TOKENS.color.success/destructive` 替代，必须走 `STOCK_COLOR_TOKENS`。

### 3.3 为什么是"克制温润"？
选择宋韵而非高彩度金融风，是因为目标用户是**长期做研究、需要低认知负担**的投资者。克制的视觉降低疲劳，留白强化重点，文化语境（汝窑天青、官窑粉青、朱砂红、象牙白、高级灰）与中国 A 股个人投资者的审美产生共鸣。

---

## 4. 设计令牌体系（Design Token System）

单一数据源链路：
```
design-tokens/tokens.json
  → scripts/generate-tokens.ts
  → src/generated/tokens.css + tokens.ts
  → src/constants/theme.tokens.ts / src/config/chartColors.ts
  → 组件层
```

### 4.1 六层令牌（L1–L6）
| 层 | 令牌 | 用途 |
|----|------|------|
| L1 | `THEME_TOKENS` | 通用语义色/尺寸/间距/圆角/排版/图标/控件尺寸 |
| L2 | `COLOR_TOKENS` | 业务语义色（涨跌/状态/评分等级/信号分级） |
| L3 | `COLOR_SHADES` + `twText/twBg/twBorder`（已废弃） | 色阶与 Tailwind 文本/背景/边框映射（已迁移至 CSS 变量语义类） |
| L4 | `chartColors.ts` | 图表专用调色板（饼图/轮动因子/市场风格/信号等级） |
| L5 | `STOCK_COLOR_TOKENS` | **股票红涨绿跌固定色**（不随主题） |
| L6 | `SEMANTIC_COLOR_ROLES` | 主题感知 CSS 变量 + 排版/海拔/布局令牌 |

### 4.2 决策树（写 UI 时怎么选）
- 股票涨跌幅 → `STOCK_COLOR_TOKENS`
- 图表配色 → `chartColors.ts`
- 特定色阶 → `COLOR_SHADES`
- 业务语义（状态/评分/信号）→ `COLOR_TOKENS`
- 暗色/悬停/Focus/渐变 → `DARK/HOVER/FOCUS/FILL/GRADIENT`
- 新模块 → 优先 `SEMANTIC_COLOR_ROLES`

> **⚠️ 废弃通知（2026-08-13）**：`twBg`/`twText`/`twBorder` 辅助函数已于 2026-08-13 全面废弃，UI 层统一使用 CSS 变量语义令牌（如 `text-foreground`、`bg-muted`、`border-border`、`text-destructive`、`bg-primary` 等）。L3 层 `COLOR_SHADES` 仍可用于 JS 逻辑取色，但 UI 层不再通过 `twText()`/`twBg()`/`twBorder()` 生成 Tailwind 类名。常用映射：`twText('slate'/'stone', 900/800)` → `text-foreground`；`twText('slate'/'stone', 500/600)` → `text-muted-foreground`；`twText('red', 600)` → `text-destructive`；`twBg('stone'/'slate', 50)` → `bg-muted`；`twBg('white')` → `bg-background`；`twBorder('stone'/'slate', 200)` → `border-border`。

### 4.3 防硬编码治理（三道门禁）
`lint:colors`（ESLint 禁 HEX/RGB/HSL 与 Tailwind 数字色类）+ `audit:tokens` + `verify:tokens`。
豁免仅限：`theme.tokens.ts`、`chartColors.ts`、`themeRegistry.ts`、`theme.config.ts`、`src/generated/*`、`tests/`。

---

## 5. 原创思路（我们与典型股票工具的巧思）

1. **双轨白盒评分**
   V6 规则评分 100% 可解释，AI 评分透明可追溯，二者交叉验证。区别于市面"黑箱 AI 投顾"——用户始终掌握最终决策权。

2. **五舱工作流 = 投资方法论软件化**
   把"输入 → 分析 → 交易 → 输出 → 总控"固化为连续工作流，配合"不切屏原则"保持心流。竞品多偏"数据查询"，V9 偏"研究方法论与复盘体系"。

3. **数据主权 / 本地优先**
   纯前端 PWA + IndexedDB，数据 100% 属于用户、零上传。这是最根本的差异化，也是隐私觉醒趋势下越来越重要的卖点。

4. **信封化 + 网关化数据治理**
   在纯前端项目里实现了接近后端的"写收口 / 审计 / 溯源"能力（`DataBridge.forward(StandardEnvelope)` + ACL 双矩阵），呼应"数据血缘"哲学。

5. **插件化可扩展（Widget + MCP + Worker）**
   驾驶舱 Widget 市场 + 15 个 MCP Server 生态 + Web Worker 计算池，演进路线是"工具 → 平台 → 生态"。

6. **认知复利 / 个人投资进化曲线**
   评分历史 + 复盘笔记 + 知识库，把"信息消费"变成"认知生产"，迁移成本即护城河。

---

## 6. 关键设计决策背后的思考逻辑

| 决策 | 选择 | 背后的逻辑 |
|------|------|------------|
| 架构形态 | 纯前端无后端（ADR-001） | 规避合规风险、零运维成本、数据隐私、离线可用 |
| 持久化 | IndexedDB 本地 | 数据主权；无服务端即无集中数据管理成本 |
| 美学 | 宋韵克制 | 降低研究疲劳、文化共鸣、差异化识别度 |
| 颜色 | 令牌化 + 红涨绿跌固定 | 主题可换、业务语义不可变、防止硬编码回潮 |
| 扩展 | 客户端多实例 + Worker + MCP | 在"无服务端"边界内最大化横向/算力扩展 |
| 评分 | 规则引擎优先、LLM 增强 | 可解释、可审计、不黑箱；LLM 仅做可选文本增强 |

> **回滚条件（ADR-001）**：当用户规模 > 1 万且需要集中数据管理时，在 V10 评估引入服务端。当前有意不追求服务端分布式。

---

## 附：本节与其他手册的关系
- 令牌落地细节 → `03-ui-components.md` §4
- 信封/网关/数据血缘的运行机制 → `02-architecture.md` §3–§4、`04-model-runtime.md` §6
- 差异化如何对比竞品 → `05-competitive-analysis.md`
