---
skill_id: V9-SKILL-V6-DOCX-OUTPUT
name: "v6-docx-output"
description: "V6股票分析报告专业Word文档输出技能。包含：一句话总结注入规则、专业排版格式规范（封面/字体/表格/评分条/结论框/页眉页脚）、docx-js生成脚本模板。Invoke when 导出V6分析报告到专业Word格式、生成stock分析报告.docx文件、批量输出V6报告时。"
version: v1.0.7
last_updated: 2026-08-23
change_log:
  - version: v1.0.7
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 6 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.6
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.5 / 正文 v1.0.4) → 取真值 max=1.0.5 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 4 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-11
mandatory: false
---

# V6股票分析报告专业Word文档输出规范 — v1.0.7

> **版本**: v1.0.7 | **日期**: 2026-08-21 | **校验基准**: FinSightV9 code_version 2.0.0-rc.1
> **任务性质**: SOP 执行（V6 Markdown→专业Word转换），允许输出 docx 到 outputs/v6-docx/，禁止一句话总结漏注入、禁止字体/颜色令牌与主题规范不一致
> **输出格式**: 阶段化 SOP 矩阵 + 一句话总结注入后 Markdown + 生成 docx 文件（命名规范：{股票名称}_V6v4.3价值分析报告.docx）

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「Word 报告输出」「docx 输出」「分析报告文档」「导出 Word」「生成V6报告」；或导出专业 Word 格式时
- **显式触发 2**：批量导出触发（对 2+ 股票进行批量 V6 分析，需要一次性导出多份 Word 报告）；或需要验证 Word 输出的封面、字体、评分条、结论框等格式是否合规
- **脚本/审计触发 3**：`v6-stock-analysis-model` 输出完整 L-1~L8 报告后，自动触发 Word 导出流水线；或 `npm run audit:skill-coverage` 报告 docx 输出注册表漂移
- **脚本/审计触发 4**：生成脚本报 docx-js API 调用失败 / 表格 width/pct 总和溢出 / 字体颜色令牌与 theme.tokens.ts 不一致；或 vitest 快照断言 docx 结构不匹配
- **设计/协议触发 5**：一句话总结注入规则版本变更、专业排版格式规范（封面/字体/表格/评分条/结论框/页眉页脚）升级、主题令牌 theme.tokens.ts 颜色调整后存量 docx 模板重评；V6 报告章节模板（16 章节）扩展后 docx 章节映射同步

**不触发场景**（减少误激活，至少 2 条）：
- 纯 Markdown 格式的 V6 报告生成（走 `v6-stock-analysis-model` 直接输出 MD）
- 其他 Skill 的文档输出（如行业评分 JSON 导出）

**协作 Skill（链式调用，至少 1~3 个）**：
- `v6-stock-analysis-model`：本 Skill 的上游数据源（V6 L-1~L8 完整报告 Markdown）
- `v6-stock-analysis-model` §输出报告结构（16 章节模板）作为 §三 Phase 1 章节映射依据
- `audit:skill-coverage`：完成后核验注册完整性

---

## 二、前置检查清单（先扫后改，**先通过再动手**，按表格列出）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | V6 报告 Markdown 已生成 | 检查对应股票目录下 index.md 或传入内容对象 | 12 个强制章节齐全（L-1~L8+L3c 共12层，对应一句话总结注入点） |
| 2 | docx-js 依赖可用 | `require('docx')` 或 `npm ls docx` | docx 包已安装，版本兼容 Document/Packer/Table/Paragraph 等核心类 |
| 3 | 颜色规范与主题令牌对齐 | 对照 §一颜色常量表（18 色）与 theme.tokens.ts | 色值完全一致（COLORS.deepBlue=1F4E79 等 18 项） |
| 4 | 输出目录就绪 | 检查 `./outputs/v6-docx/` | 目录存在且有写入权限；不存在则创建 |
| 5 | 注册表四端一致 | 运行 `npm run audit:skill-coverage` | v6-docx-output 不出现 Missing/Duplicate |

> **铁律**：上表任一项未通过 → 先修复前置问题，再推进。禁止依赖 docx 包未安装就调生成脚本。

---

## 三、阶段化 SOP（按 Phase 0~N 组织，**每阶段必写目标 + 交付物清单 + 代码/文档模板**）

### Phase 0 — 一句话总结注入（12 章节）

**目标**：在 L-1~L8 + L3c 共 12 个强制章节开头注入一句话总结（20 字以内，精准概括该层核心判断）。

**交付物**：
1. **12 强制章节注入表**（章节×一句话总结要求）：
   ```
   1. L-1 行业评分估值    → 行业归属、赛道评级、L-1 综合得分
   2. L0 STEEP 宏观扫描 → 五维宏观判断 + 核心驱动/风险
   3. L1 护城河         → 护城河类型 + 宽度 + 核心壁垒
   4. L2 竞品格局       → 竞争地位 + 领先幅度 + 主要对手
   5. L3a 财务健康      → 核心指标亮点 + 风险点
   6. L3b 估值水平      → 估值水位 + PE/PB + 目标空间
   7. L3c IPC 业绩兑现  → IPC 临界点阶段 + 核心催化事件
   8. L4 情景推演       → 三情景 + 概率加权合理价
   9. L5 T-M 矩阵       → 技术-市场象限 + 战略含义
   10. L6 Hype Cycle    → 所处阶段 + 投资含义
   11. L7 第二曲线      → 各曲线阶段 + 核心弹性 + 催化剂
   12. L8 技术与筹码    → 筹码状态 + 技术信号 + 操作建议
   ```
2. **注入格式模板**（两种等价写法）：
   ```markdown
   **📌 一句话总结：** [20字以内精准概括]
   # 或加粗前置格式：
   **[一句话总结]** [内容，20字以内]
   ```

### Phase 1 — Word 排版参数装配（页面+字体+颜色+边框+页眉页脚）

**目标**：按照 §三排版规范装配所有格式常量，保证所有输出报告格式统一。

**交付物**：
1. **页面设置**：A4 纵向 / 上下 2.54cm / 左右 3.17cm
2. **10 类字体规范**（中英文字体+字号+颜色）：正文/封面标题/封面副标题/H1/H2/H3/表格标题行/表格数据/页眉/页脚
3. **封面结构**（6 行模板）：V6股票分析报告 / 股票名称 / 股票代码 / 报告日期+当前评级+核心定性 / 分隔线 / V6 v4.3 分层递进式个股分析模型+机构
4. **4 类表格样式**：标题行深蓝(1F4E79)白字 / 奇偶行交替灰 / 1pt 灰边框 / 对齐规范
5. **5 级评分条颜色**（5 色对应评级）：≥4.5绿 / 4.0-4.49浅绿 / 3.5-3.99黄 / 3.0-3.49橙 / <3.0红
6. **4 类结论框**：橙(核心投资逻辑/风险) / 绿(IPC) / 蓝(SCD筹码) / 紫(综合评级)
7. **页眉页脚**：页眉「V6 v4.3 报告 + 股票名(代码)」带分隔线 / 页脚「仅供参考+第X/Y页」

### Phase 2 — docx-js 脚本生成并保存

**目标**：运行 docx-js 生成脚本（已在本 SKILL.md §中固化），输出 docx 并校验命名。

**交付物**：
1. **生成脚本核心工厂函数**（与原 SKILL.md §三同步）：
   ```
   textRun() / paragraph() / h1()/h2()/h3()
   conclusionBox(橙/绿/蓝/紫)
   dataTable(headers+rows+colWidths)
   scoreCell(score)
   generateReport(reportData) → 返回 Buffer
   ```
2. **命名规范强制**：
   ```
   {股票名称}_V6v4.3价值分析报告.docx
   例：天赐材料_V6v4.3价值分析报告.docx
   ```
3. **批量生成脚本**：遍历股票数组 → 读 MD → 注入一句话总结 → 生成 → 保存到 `./outputs/v6-docx/`

### Phase 3 — 人工抽检（至少抽查 3 份不同标的）

**目标**：至少抽查 3 份 Word 文档的 8 个格式要点，确认排版无重大偏差。

**交付物**：
1. **抽检打勾表**（3 份标的 × 8 项）：
   ```
   标的 1：[天赐材料]
   [ ] 封面 6 行齐全
   [ ] 12 章节一句话总结均已注入
   [ ] H1/H2/H3 颜色（深蓝/中蓝/黑）正确
   [ ] 评分条颜色与综合评匹配
   [ ] 综合评级框 紫色(7030A0/EAD1DC)
   [ ] 表格奇偶行交替 + 深蓝表头白字
   [ ] 页眉页脚带分隔线且内容正确
   [ ] 命名符合 {股票名称}_V6v4.3价值分析报告.docx
   ```

---

## 四、陷阱与经验教训（**至少 6 条，基于实战提炼，禁止空话**）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 一句话总结漏注入某章节（通常 L3c / L5 / L7） | 报告不完整，不符合 v4.3 PRD 强制 12 章节要求 | Phase 0 注入后逐章 Grep：12 个章节标题 × `一句话总结` 正则匹配，缺一即 FAIL |
| 2 | 颜色硬编码与 theme.tokens 不一致 | 报告与 UI 界面色值差异，品牌不统一 | COLORS 常量 18 项先与 `src/constants/theme.tokens.ts` 对齐再启动生成；抽审 3 份报告时 Grep 色值字符串 |
| 3 | docx-js CJK 字体未指定 eastAsia | 中文字体回退宋体，不符合 Microsoft YaHei 规范 | 所有 textRun() 的 font 参数必须包含 `{ ascii: ASCII_FONT, hAnsi: ASCII_FONT, eastAsia: CJK_FONT }` 三段式 |
| 4 | 评分条色与评级不符（如综合分 4.7 拿黄色） | 视觉错误，评级信号混乱 | scoreCell() 函数五档阈值（4.5/4.0/3.5/3.0）与 V6 评级映射表（≥4.5买入 等）严格绑定，禁止自调 |
| 5 | 批量生成时文件名中文乱码（GBK/UTF-8） | 文件损坏或打不开 | Node.js 写入文件名统一用 UTF-8；Windows 下 fs.writeFileSync 的 encoding 默认 utf8，无需额外转换；必要时用 iconv-lite |
| 6 | 页眉页脚 PageNumber 不显示（Word 显示「第 X/共 Y 页」空值） | 页码失效，专业度下降 | Footer 必须使用 `PageNumber.CURRENT` 和 `PageNumber.TOTAL_PAGES`（而非字符串「X/Y」占位），并在 sections.footers.default 配置 |
| 7 | 一句话总结超长（>20 字） | 章节开头一行放不下，排版溢出 | Phase 0 注入时对总结内容取 length ≤ 20；超长部分抛错重试让 LLM 缩短；对 12 章节逐条断言 |
| 8 | docx-js 表格 `width.size` 总和 ≠ 100 或 `type` 误用 `dxa`/未声明 | 表格渲染超出版心右侧，Word 中显示不完整；用户滚动才能看到全表；与 UI 版表格宽度严重不对齐 | Phase 2 生成前校验：所有 TableWidths 常量用 Pct 模式（`type: 'pct'`），size 总和严格 = 100（多栏合计断言）；抽审时用「页面宽度 100%」预览对比 UI 中表格是否完整无横向滚动条 |

---

## 五、完成交付物清单（**必要且充分条件，少一项 = 未完成**）

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 一句话总结已注入 12 章节 | 注入后的 Markdown / docx 各章节 | Grep 12 个章节标题下均有「一句话总结」字样；字数 ≤20 字/条 |
| 2 | 颜色规范 18 项与 theme.tokens 对齐 | COLORS 常量 vs theme.tokens.ts | 色值字符串比对完全一致（1F4E79/2E75B6/70AD47 等） |
| 3 | 生成的 docx 文件（命名规范） | `./outputs/v6-docx/` 目录 | 命名格式 `{股票名称}_V6v4.3价值分析报告.docx`；存在并可用 Word 打开 |
| 4 | 抽检 3 份打勾表全绿 | Phase 3 检查表 | 3 份 × 8 项 = 24 项全部打勾通过 |
| 5 | SKILL.md Frontmatter 升版 | [SKILL.md](file:///d:/FinSightV9/.agents/skills/v6-docx-output/SKILL.md) | version=v1.0.2 / last_updated=2026-08-21 / change_log 含「5 段式骨架模板」信号 |
| 6 | skill-registry.json description 同步 | [skill-registry.json](file:///d:/FinSightV9/.trae/skills/skill-registry.json) | description 含 4 条具体触发条件摘要 |
| 7 | 生产类型检查通过 | `npm run tsc:prod` | 0 error |
| 8 | 架构审计通过 | `npm run audit:layers` + `npm run audit:skill-coverage` | 0 ERROR 0 WARN |
