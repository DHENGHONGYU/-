# v6-pro-cockpit UI 组件参考（输入舱）

> **Status: Future Reference / Deferred**  
> 本文档为外部参考蓝图，仅用于与 V9 当前 UI 体系对齐参考，禁止直接作为当前 V9 代码依据。任何落地须先经过 ADR 评审并更新 `docs/01~10` 规格。

> 对 `D:\v6-pro-cockpit` 进行只读探索，筛选可复用于 V9 输入舱的 UI 组件与设计模式。

---

## 1. 入口与导航

### `src/apps/input/InputApp.tsx`

V6 输入舱本身已是一个完整原型，使用 **Tabs 导航**组织四大功能：

- 意向股票池
- 热点推荐池
- 接口测试
- 频率配置

设计要点：
- 激活态使用靛青下划线 `theme.colors.primary.blue`。
- 主按钮填充靛青，次按钮白底+靛青边框。
- 支持快捷键 `1/2/3/4` 切 Tab，`C` 采集，`R` 刷新，`I` 打开批量导入。

**V9 映射**：已拆分的 `/input`、`/input/bulk-import`、`/input/hot-sectors`、`/input/data-test` 可保留 Tab/侧边栏切换的交互语义。

---

## 2. 录入看板（意向股票池）

### `src/apps/input/InputApp.tsx` 内 `IntentionPoolPanel`

- **批量解析输入**：左侧 `textarea` + 右侧「➕ 添加导入」，显示 `已存: {pool.length}/{maxPoolSize}`。
- **解析逻辑**：支持 `600519 贵州茅台`、`600519,贵州茅台`、`600519.SH`。
- **股票列表**：复选框、质量指示圆点、代码/名称、状态 Badge（已入库/待采集）、日期、删除按钮。
- **选中态**：行背景切换为 `info.bg`。
- **采集进度**：全局采集 + 批量采集双进度条。
- **状态反馈**：collecting → done / error，错误行带「🔄 重试」。

**V9 映射**：`InputDashboard` 可引入质量指示圆点、复选批量操作、采集进度条、错误重试。

### `src/components/StockSearch.tsx`

- 防抖搜索（350ms）。
- 下拉表格：名称代码 / 现价 / 涨跌 / 行业 / PE/PB / 市值 / 操作。
- A股/港股 Badge、涨跌幅红绿 + Trending 图标。
- 键盘导航 ↑/↓/Enter/Esc，点击外部关闭。

**V9 映射**：录入看板的单条添加可替换为搜索下拉组件，提升录入体验。

### `src/apps/analysis/panels/V6ScorePanel.tsx` 候选列表

- 紧凑行：首字母头像、名称代码、PE/PB/ROE、现价、涨跌幅。
- 顶部搜索过滤 + 模型 Select + 开始评分 Button。

**V9 映射**：`PoolBoard` 的卡片可补充头像与更多行情字段，或增加紧凑列表视图切换。

---

## 3. 批量导入

### `src/apps/input/InputApp.tsx` 内 `showImportModal`

- 固定定位模态框，`rgba(0,0,0,0.5)` 遮罩。
- 标题 + 格式说明 + `textarea` + 取消/确认按钮。
- 确认后解析并合并到本地池，上限 50 只。
- Toast 反馈导入数量。

**V9 映射**：`BulkImportPanel` 已升级为页面；可进一步增加：
- 解析预览表格（code / name / symbol / 有效状态）
- 错误行高亮
- 导入结果统计与状态列表

### `src/agents/input/StockInputAgent.ts`

- 封装搜索/添加/移除/批量/导入导出。
- 批量导入含校验、去重、上限控制。

**V9 映射**：`batchImportService.importStocks` 可参考其校验与上限逻辑。

---

## 4. 热门板块

### `src/apps/input/InputApp.tsx` 内 `HotSpotPoolPanel`

- 板块卡片网格：`auto-fit, minmax(180px, 1fr)`。
- 选中态：边框加粗 + `info.bg` 背景。
- 评分 Badge：按分数段映射不同背景/文字色。
- 五因子进度条：景气 / 资金 / 估值 / β / 量能。
- 关联股票推荐：可「➕ 加入意向池」，已加入变灰禁用。

### `src/apps/analysis/panels/HotSectorPanel.tsx`

- 排名 `#1/#2/#3`、申万三级分类、板块强度计算、轮动建议文案。

**V9 映射**：`HotSectorPanel` 可迁移卡片网格 + 因子进度条 + 排名/轮动文案，接入 V9 板块评分数据。

---

## 5. 采集测试

### `src/apps/input/InputApp.tsx` 内 `ApiTestPanel`

- 数据源列表：akshare / ifind / yahoo / tianyancha / scholar / cache。
- 状态 Badge：idle / testing / ok / error。
- 延迟显示：`☑ 正常 (${r.latency}ms)`。
- 独立测试按钮，每行一个，带 disabled testing 状态。
- 真实行情获取：输入代码 → 展示价格/涨跌幅/成交量/买卖五档。
- 数据清洗检查：异常值/缺失值/状态。

### `src/components/collect/CollectMonitor.tsx`

- 深色监控大屏：背景 `#1a1d29`，卡片 `#0d1117`。
- 大进度条（24px 高）渐变青绿到天青。
- 7 维度状态卡、`grid-cols-3` 统计面板、红绿箭头变动率、等宽字体日志流。

### `src/components/collect/CollectParamPanel.tsx`

- 预设策略模板 Tag 按钮。
- 额度预估仪表盘。
- 单维度配置行：启用 Switch、维度色块、重要性 Badge、频率下拉、月调用预估、数据源优先级排序、缓存 TTL。
- 未保存 Amber 警告条。

**V9 映射**：`DataTestPanel` 可扩展为：
- 数据源健康度列表（带延迟）
- 真实行情探测卡片
- 采集进度监控视图
- 采集参数配置抽屉

---

## 6. 进度/状态列表面板

### `src/components/ScoringProgress.tsx`

- 头部统计：完成数/失败数/均分 + 顶部渐变进度条。
- 单条进度行：序号、状态圆图标、股票名称、状态说明、评分结果、失败原因、耗时。
- 状态配置映射：pending/scoring/success/error。

**V9 映射**：批量导入结果、采集测试任务列表均可复用该「状态驱动行列表」模式。

---

## 7. 基础组件与设计令牌

### V6 输入舱配色（宋瓷主题）

| 用途 | 令牌 | 色值 |
|------|------|------|
| 主强调 | `theme.colors.primary.blue` | `#2E5C8A` 靛青 |
| 辅助强调 | `theme.colors.primary.purple` | `#6B5B8E` 钧紫 |
| 背景 | `theme.colors.background.songci` | `#E8E4E0` 官窑粉青 |
| 浅背景 | `theme.colors.info.bg` | `#D4E5F0` 汝窑天青 |
| 错误 | `theme.colors.error.main` | `#C73E3A` 朱砂红 |
| 成功 | `theme.colors.success.teal` | `#06A77D` |

### 组件文件

- `src/components/ui/card.tsx` —— 圆角卡片
- `src/components/ui/badge.tsx` —— 胶囊 Badge
- `src/components/ui/table.tsx` —— 标准表格
- `src/components/ui/progress.tsx` —— Radix Progress
- `src/components/ui/tabs.tsx` —— Radix Tabs
- `src/components/ui/button.tsx` —— CVA 变体按钮

**V9 映射**：基础组件已具备，可借鉴 V6 的配色映射与状态色配置。

---

## 8. 数据流约定

- 意向池 key：`v6_intention_pool_v4`
- 事件总线：`eventBus.emit("ui:poolUpdated")`、`eventBus.emit("data:collectTask")`
- DataBridge 同步：`dataBridge.syncIntentionToScreener()`
- 数据源类型：`akshare | ifind | yahoo | tianyancha | scholar | cache`

**V9 映射**：V9 已采用 `DataBridge` + `dataLayer` + 事件总线，可直接沿用数据流约定。

---

## 9. V9 子页复用建议速查

| V9 子页 | 推荐复用 V6 模式 |
|--------|------------------|
| 录入看板 | `IntentionPoolPanel` 列表、质量圆点、`StockSearch`、候选列表紧凑卡片 |
| 批量导入 | 导入弹窗流程、`StockInputAgent` 校验、`ScoringProgress` 状态列表 |
| 热门板块 | `HotSpotPoolPanel` 卡片网格、五因子进度条、`HotSectorPanel` 排名文案 |
| 采集测试 | `ApiTestPanel` 数据源列表、`CollectMonitor` 大屏、`CollectParamPanel` 配置行 |

---

## 10. 可直接迁移的代码片段

### 批量解析

```ts
const lines = text.split(/[\n,;、]/).map(s => s.trim()).filter(Boolean)
```

### 状态 Badge 色映射

```ts
const statusColors = {
  ok: { bg: '#D4E5F0', color: '#2E5C8A' },
  error: { bg: '#FCE8E8', color: '#C73E3A' },
  testing: { bg: '#E8E4E0', color: '#6B5B8E' },
  idle: { bg: '#F5F0EB', color: '#666' },
}
```

### 简易进度条

```tsx
<div className="h-2 rounded-full bg-muted overflow-hidden">
  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
</div>
```
