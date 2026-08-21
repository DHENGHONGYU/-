---
title: "文件系统映射规范"
domain: proj
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 文件系统映射规范

> 文档编号：V9-DOC-DATA-031  
> 状态：v1.0 设计完成  
> 关联文档：[V9-DOC-DATA-028] ADR-010 · [V9-DOC-DATA-029] 八域资料体系设计 · [V9-DOC-HOW-003] 数据导入导出指南  
> 最近更新：2026-07-20

---

## 1. 设计原则

### 第一性原则
- **不另起炉灶**：复用现有 `dataManager.export/import`、`file-import` 解析器体系、`localDocService` 目录扫描能力
- **IndexedDB 为真相源**：本地文件是镜像/导出物，不是主存储，单向同步（DB → 文件）
- **增量同步**：基于 `updatedAt` 时间戳做差异同步，避免全量重写
- **人类可读优先**：目录结构和文件命名符合研究员的工作习惯，便于人工查阅和版本管理（Git）

---

## 2. 目录结构

每只股票对应一个独立目录，按八域（D1-D8）组织资料：

```
{workspace}/
├── stocks/                          # 股票库根目录
│   ├── {symbol}_{name}/             # 单只股票目录（如：600519_贵州茅台）
│   │   ├── profile.json             # 资料包元数据（StockProfile）
│   │   ├── score/                   # 评分结果
│   │   │   ├── v6-latest.json       # 最新 V6 评分
│   │   │   ├── v6-history/          # 历史评分快照
│   │   │   │   └── {date}.json
│   │   │   └── evidence/            # 评分证据链
│   │   │       └── {layerId}.md     # 每层证据汇总（Markdown）
│   │   │
│   │   ├── D1_行业产业/             # D1 → L-1 行业评分
│   │   │   ├── reports/             # 行业研报
│   │   │   ├── data/                # 行业数据引用
│   │   │   └── notes.md             # 行业研究笔记
│   │   │
│   │   ├── D2_宏观环境/             # D2 → L0 STEEP扫描
│   │   │   ├── news/                # 宏观新闻
│   │   │   ├── data/                # 经济指标数据
│   │   │   └── notes.md
│   │   │
│   │   ├── D3_公司基本面/           # D3 → L1 护城河
│   │   │   ├── notices/             # 公司公告
│   │   │   ├── reports/             # 公司研报
│   │   │   ├── financials/          # 财务报表（CSV/JSON）
│   │   │   └── notes.md
│   │   │
│   │   ├── D4_竞争对比/             # D4 → L2 竞品格局
│   │   │   ├── peers/               # 竞品数据
│   │   │   ├── reports/             # 行业对比研报
│   │   │   └── notes.md
│   │   │
│   │   ├── D5_财务分析/             # D5 → L3a 财务健康
│   │   │   ├── statements/          # 三表数据
│   │   │   ├── derived/             # 衍生指标（杜邦/估值分位等）
│   │   │   │   └── metrics.json
│   │   │   └── notes.md
│   │   │
│   │   ├── D6_估值定价/             # D6 → L3v 估值水平
│   │   │   ├── valuation/           # 估值模型
│   │   │   ├── consensus/           # 一致预期
│   │   │   └── notes.md
│   │   │
│   │   ├── D7_成长前沿/             # D7 → L4/L5/L6
│   │   │   ├── scenarios/           # 情景推演
│   │   │   ├── t-matrix/            # T-M矩阵
│   │   │   ├── hype-cycle/          # Hype周期
│   │   │   └── notes.md
│   │   │
│   │   └── D8_市场信号/             # D8 → L7/L8
│   │       ├── community/           # 社区帖子
│   │       ├── technical/           # 技术指标
│   │       ├── chips/               # 筹码数据
│   │       └── notes.md
│   │
│   └── _index.json                  # 股票列表索引
│
├── tags/                            # 标签库
│   └── all-tags.json                # 全量标签 + 使用统计
│
├── export/                          # 导出物
│   ├── v9-export-{date}-v{ver}.json # 全量数据导出（与现有格式一致）
│   └── reports/                     # 生成的分析报告
│
└── import/                          # 待导入文件（由 file-import 处理）
    └── {source}/                    # 按来源分目录
```

---

## 3. 文件命名规则

### 3.1 资料条目文件

```
{date}_{source}_{slug}.{ext}
```

| 部分 | 说明 | 示例 |
|------|------|------|
| date | 发布日期 YYYYMMDD | `20260719` |
| source | 来源标识 | `eastmoney` / `guba` / `company` |
| slug | 标题缩写（英文/拼音，小写，连字符分隔，≤50字符） | `zhongbao-yujia-100-zeng` |
| ext | 文件格式 | `.md` / `.json` / `.pdf` / `.txt` |

**示例**：`20260719_eastmoney_zhongbao-yujia-100zeng.md`

### 3.2 评分文件

```
v6-score-{YYYYMMDD}.json      # 历史评分快照
v6-latest.json                # 最新评分（软链接/复制）
evidence-{layerId}.md         # 某层证据汇总
```

### 3.3 财务数据文件

```
{reportType}-{reportDate}.csv  # 财务报表 CSV
derived-metrics.json           # 衍生指标
```

---

## 4. 文件格式规范

### 4.1 资料条目（Markdown + Front Matter）

每个资料条目导出为 Markdown 文件，元数据放在 Front Matter 中，与 Obsidian / Notion 等主流笔记工具兼容：

```markdown
---
id: "abc123"
symbol: "600519"
domain: "D3"
itemType: "report"
source: "eastmoney"
sourceUrl: "https://..."
author: "中信证券"
publishedAt: 2026-07-19
collectedAt: 2026-07-19T10:30:00
qualityScore: 85
dataQuality: "high"
sentiment: "positive"
topicTags: ["白酒", "消费"]
relatedLayers: ["l1", "l3f"]
evidenceWeight: 0.7
---

# 贵州茅台中报点评：业绩超预期，全年目标上调

## 核心观点

1. 上半年营收同比增长 18%，超市场预期
2. 直销渠道占比提升至 45%，结构优化
3. 上调全年营收增速目标至 15%

## 正文

...（正文内容，按需截断或完整写入）
```

### 4.2 资料包元数据（JSON）

`profile.json` 对应 `StockProfile` 类型，完整保存各域统计和评分。

### 4.3 评分证据（Markdown）

每层证据汇总为 Markdown 文件，便于人类阅读：

```markdown
# L1 护城河评分证据

> 得分：4.2 / 5.0  
> 证据数量：8 条  
> 覆盖率：85%

## 正向证据

### 1. ROE 达 28%（行业领先）
- 类型：衍生指标（杜邦分析）
- 权重：0.8
- 贡献：+0.7
- 详情：净利率 52% × 资产周转率 0.45 × 权益乘数 1.2

### 2. 研发投入占比 15%
- 类型：衍生指标（成长质量）
- 权重：0.6
- 贡献：+0.5
- ...

## 负向证据

### 1. 商誉占净资产 25%（减值风险）
- 类型：衍生指标（风险预警）
- 权重：0.5
- 贡献：-0.4
- ...

## 资料条目证据

| 标题 | 来源 | 情绪 | 权重 |
|------|------|------|------|
| ... | ... | ... | ... |
```

### 4.4 衍生指标（JSON）

`derived/metrics.json` 对应 `DerivedMetricsResult` 类型。

---

## 5. 同步协议

### 5.1 同步方向

```
IndexedDB (真相源)
    │
    ├─► 导出同步（DB → 文件系统）：定时/手动触发
    │
    └─◄ 导入同步（文件系统 → DB）：仅 import/ 目录，通过 file-import 解析器
```

### 5.2 导出同步流程

1. **触发方式**
   - 手动：设置 → 资料同步 → 导出到本地
   - 自动：评分完成后自动触发（可选，默认关闭）

2. **增量策略**
   - 记录上次同步时间 `lastSyncAt`
   - 只导出 `updatedAt > lastSyncAt` 的资料条目
   - 删除：DB 中已删除的条目，在文件系统中移至 `.trash/` 目录（不直接删）

3. **幂等保证**
   - 每个文件路径由 `{domain}/{type}/{date}_{source}_{slug}.md` 唯一确定
   - 内容哈希一致则跳过写入

### 5.3 导入同步流程

复用现有 `file-import` 体系：
- 扫描 `import/` 目录
- 匹配解析器（markdown/json/csv）
- 解析后通过 `profileItemStore.save()` 写入
- 自动识别 domain / itemType / tags

### 5.4 冲突解决

- 原则：**DB 为准**，文件系统修改不自动回写 DB
- 如需从文件导入，必须经过 import/ 目录的显式导入流程
- 导出时如遇文件已修改，发出警告但仍覆盖（保留冲突副本：`filename.conflict-{timestamp}.md`）

---

## 6. 与现有体系的集成点

| 现有组件 | 复用方式 | 新增内容 |
|---------|---------|---------|
| `dataManager.export()` | 全量 JSON 导出格式不变 | 新增 profile 相关 store |
| `file-import` 解析器 | 复用 6 种解析器 | 新增 profile 专用 Markdown 解析器 |
| `localDocService` | 复用目录扫描能力 | 新增八域目录结构识别 |
| `scoreDocService` | 复用 Markdown 生成模式 | 新增证据链 Markdown 导出 |
| `backtestExportService` | 复用动态加载 xlsx/jspdf 模式 | 可选：资料包 Excel 导出 |
| `export-contract.md` | 遵循导出服务接口契约 | 新增 profile 导出接口 |

---

## 7. 实现路径

### Phase 1：导出能力（MVP）
- 单只股票资料包导出（Markdown + JSON）
- 评分证据链导出（Markdown）
- 衍生指标导出（JSON）
- 手动触发，不做自动同步

### Phase 2：导入能力
- profile Markdown 解析器（解析 Front Matter）
- import/ 目录扫描与自动导入
- 标签自动识别与创建

### Phase 3：双向同步
- 增量同步（基于时间戳）
- 冲突检测与警告
- 自动同步选项（默认关闭）

### Phase 4：版本管理
- Git 集成（可选）
- 变更历史记录
- 回滚能力

---

## 8. 配置项

在现有 settings 体系中新增：

```typescript
interface ProfileSyncSettings {
  /** 本地工作区根目录 */
  workspacePath: string
  /** 是否启用自动导出 */
  autoExportEnabled: boolean
  /** 自动导出触发条件 */
  autoExportTrigger: 'score_complete' | 'daily' | 'manual'
  /** 导出格式 */
  exportFormats: Array<'markdown' | 'json' | 'csv'>
  /** 是否包含全文内容 */
  includeFullContent: boolean
  /** 增量同步 / 全量同步 */
  syncMode: 'incremental' | 'full'
}
```
