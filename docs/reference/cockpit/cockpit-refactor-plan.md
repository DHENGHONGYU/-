---
doc_id: V9-DOC-REF-919
title: "驾驶舱重构方案总结"
domain: data
status: active
last_updated: 2026-08-15
code_version: 2.0.0-rc.2
---
covers_code:
  - src/cockpit/core/widgetRegistry.ts
  - src/constants/cockpit.constants.ts
  - src/types/modules/widget.types.ts


# 驾驶舱重构方案总结

## 一、问题诊断

### 1.1 UI组件无法及时显示的根因

| 问题 | 严重度 | 说明 |
|------|--------|------|
| **26个Widget同时挂载** | 高 | 首屏同时加载所有组件，无懒加载/虚拟化机制 |
| **全量重渲染** | 中 | data/loadingMap/errorMap变化导致所有WidgetWrapper重渲染 |
| **console.log残留** | 中 | WidgetWrapper中有7处console.log，每次渲染都触发 |
| **双通道数据不一致** | 高 | MarketDataProvider 和 marketDataStore 各自独立订阅 |
| **3套状态系统并存** | 高 | widgetRegistry + MarketDataProvider + marketDataStore |

### 1.2 污染/阻断的可能性

| 问题 | 严重度 | 说明 |
|------|--------|------|
| **分类系统失效** | 高 | 所有Widget被归类为"other"（createInstance未传递category） |
| **布局迁移导致全部失效** | 高 | 26个Widget实例被清理，布局全部失效 |
| **window.location.reload()** | 中 | 重置布局时硬刷新，中断所有未保存状态 |
| **原生confirm对话框** | 中 | 浏览器原生confirm阻断整个页面交互 |
| **SafeWrapper双层包裹** | 低 | WidgetEngine和CockpitShell各一层防御性包裹 |

---

## 二、重构方案

### 2.1 按用户工作流重新组织界面

**设计理念**：从"股票智能研究和复盘"的底层逻辑出发，按消费使用者的思维路径组织界面。

#### 四大工作流分类

| 分类 | 定位 | 用户场景 | 包含Widget |
|------|------|----------|------------|
| **智能研究** | 核心工作流 | 从市场扫描到深度研究的完整路径 | 14个 |
| **交易复盘** | 复盘工作流 | 从交易概览到技能提升的复盘体系 | 9个 |
| **实时监控** | 辅助监控 | 持仓、信号与风险的实时跟踪 | 1个 |
| **系统运维** | 底层支撑 | 引擎状态、性能监控与系统架构 | 4个 |

#### 智能研究工作流（3个子阶段）

```
市场扫描 → 机会筛选 → 深度研究
    ↓          ↓           ↓
  大盘指数    KAI评分    股票池看板
  板块热力图  热门板块    研究池管理
  市场情绪    价值洼地    投资画像
  资金流向               AI模型对比
  产业链图谱             个股深度分析
```

#### 交易复盘工作流（3个子阶段）

```
交易概览 → 复盘分析 → 纪律检视
    ↓          ↓           ↓
  持仓概览    AI交易复盘   仓位控制
  盈亏分析    信号质量复盘 风险监控
  自选股
  自选股异动
```

### 2.2 数据层统一（消除双通道不一致）

**统一架构**：
```
                    taskScheduler
                         │
                         ▼
            marketDataStore (唯一真相源)
                    ┌────┴────┐
                    ▼         ▼
           Widget消费     Page消费
```

**关键改进**：
- 统一以 `marketDataStore` 为单一真相源（Single Source of Truth）
- Provider 仅负责初始化全局订阅和启动采集任务
- 所有状态（data/loadingMap/errorMap）均从 Store 读取
- 彻底消除双通道数据不一致风险

### 2.3 Widget懒加载（解决显示延迟）

**实现机制**：Intersection Observer API

```
首屏可见区域 → 立即加载组件
视口外300px → 显示占位骨架，等待滚动进入
已加载组件 → 保持状态，不再重复加载
```

**性能收益**：
- 首屏仅加载可见区域的5-8个Widget（而非全部26个）
- 滚动时渐进加载，用户无感知
- 减少首屏内存占用和JS执行时间

### 2.4 分批数据采集（降低首屏压力）

**策略**：
- 第0ms：启动"智能研究"类Widget的采集任务（首屏核心内容）
- 第500ms：启动其他类别的采集任务（延迟加载，不阻塞首屏）

**收益**：
- 首屏核心数据更快就绪
- 避免同时发起26个请求导致的网络拥塞
- 浏览器资源更集中于首屏渲染

### 2.5 代码异味清理

| 问题 | 修复方案 |
|------|----------|
| 7处console.log | 全部移除，改用logger.debug |
| window.location.reload() | 改用状态更新（layoutKey）触发重新初始化 |
| 原生confirm对话框 | 自定义ConfirmDialog组件，无阻断 |
| SafeWrapper双层包裹 | 移除CockpitShell中的重复包裹，保留Engine层全局防御 |
| localStorage直接操作 | 保留工具函数封装，新增布局版本号机制 |

---

## 三、修改的文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/cockpit/CockpitShell.tsx` | 完整重构：懒加载、工作流分类、自定义对话框、移除console.log、状态重置 |
| `src/cockpit/core/widgetRegistry.ts` | 修复createInstance的category传递bug，重新组织默认布局 |
| `src/cockpit/providers/MarketDataProvider.tsx` | 统一数据源到Store，分批启动采集任务 |
| `src/constants/cockpit.constants.ts` | 新增WIDGET_CATEGORIES分类体系，重新归类所有Widget |
| `src/types/modules/widget.types.ts` | 新增subCategory字段 |

---

## 四、布局版本

- **当前版本**：v5（分栏面板布局：市场全景/研究筛选/持仓复盘/信号监控/系统状态）

**版本演进**：
- v3：工作流分类（research/review/monitor/system）+ ReactGridLayout 4 列网格
- v4：精简至 12 个核心 Widget（已废弃，用户要求保留全部 26 个）
- v5：全部 26 Widget 保留 + 5 面板分栏 + 左右两列 CSS grid + 折叠持久化

**自动迁移**：
- 检测到旧版本布局时自动重置为新布局
- 用户可通过"重置布局"随时恢复默认

---

## 五、v5 分栏面板布局方案（2026-07-20）

### 5.1 设计动机

v3/v4 的单层 ReactGridLayout 4 列网格存在严重信息过载：

| 问题 | 量化 |
|------|------|
| 默认 Widget 数 | 26 个全部展开 |
| 页面总高度 | ~6800px（约 7 屏） |
| 首屏可见 Widget | 仅 5-6 个（80% 被隐藏） |
| 字体对比度不足 | CardTitle 缺少 text-foreground，数据文本 gray-400 过浅 |

用户要求：**保留全部 26 个 Widget**，通过分栏 + 折叠机制解决过载，而非精简。

### 5.2 五面板架构

按投资者决策流分为 5 个可折叠面板：

| 面板 | 决策阶段 | Widget 数 | 默认状态 | 强调色 |
|------|----------|----------|----------|--------|
| 市场全景 | 了解大环境 | 5 | 展开 | blue |
| 研究筛选 | 发现机会 | 8 | 展开 | emerald |
| 持仓复盘 | 了解状态 | 8 | 折叠 | amber |
| 信号监控 | 实时追踪 | 1 | 折叠 | purple |
| 系统状态 | 运维监控 | 4 | 折叠 | gray |

### 5.3 面板内部布局

采用原生 CSS grid（`grid-cols-1 lg:grid-cols-2`）替代 ReactGridLayout：

- **大 Widget**（cols ≥ 3）：占整行（`lg:col-span-2`）
- **小 Widget**（cols ≤ 2）：左右并排（`lg:col-span-1`）
- 移动端自动降级为单列

### 5.4 PanelSection 组件

新增 `PanelSection` 组件（CockpitShell.tsx 内部）：

- 独立折叠/展开，状态持久化到 localStorage（key: `v9_panel_*`）
- 面板标题栏含图标、标题、描述、Widget 计数
- 左侧强调色边框（`border-l-2`）区分面板

### 5.5 颜色令牌合规

面板强调色集中定义在 `cockpit.constants.ts` 的 `PANEL_ACCENT_COLORS` 常量中，避免硬编码散落在 JSX 中。

### 5.6 字体对比度修复

| 位置 | 修复前 | 修复后 |
|------|--------|--------|
| CardTitle（CockpitShell 5 处） | `text-base` | `text-base text-foreground` |
| CardTitle（WidgetStateShell） | `text-base font-semibold` | `text-base font-semibold text-foreground` |
| MarketIndicesWidget 数据 | `twText('gray', 400)` | `text-muted-foreground`（CSS 变量语义类；原 `twText('gray', 500)` 已废弃） |
| 占位骨架 Card | `className="opacity-60"` | 移除 opacity |

### 5.7 代码清理

移除 v3 遗留的 ReactGridLayout 相关代码：

- 删除 `loadLayout()` / `saveLayout()` / `sanitizeLayout()` / `saveMigrationLog()` 函数
- 删除 `LayoutStorageData` 接口
- 清理未使用导入：`Badge` / `ReactGridLayout` / `WIDGET_CATEGORIES` / `GRID_*`

### 5.8 性能收益

| 指标 | v3 | v5 |
|------|----|----|
| 首屏渲染 Widget | 26 | 13（2 个面板展开） |
| 页面总高度 | ~6800px | ~2500px（默认折叠 3 面板） |
| 布局复杂度 | ReactGridLayout + 拖拽 | 原生 CSS grid |
| 字体可读性 | gray-400 + opacity-60 | gray-500 + text-foreground |

---

## 六、后续优化建议

1. **虚拟滚动**：对于大量 Widget 的场景，可考虑引入虚拟列表
2. **数据预取**：基于用户行为预测，提前加载可能需要的数据
3. **骨架屏优化**：为每个 Widget 定制更精确的骨架屏
4. **错误边界增强**：增加 Widget 级别的错误恢复机制
5. **性能监控**：接入 Web Vitals 监控首屏性能指标
6. **工作区模式**：按场景预设布局（盘前扫描/盘中监控/盘后复盘），一键切换面板展开状态
7. **可见性采集**：不可见 Widget 暂停/降频数据采集，结合 IntersectionObserver
