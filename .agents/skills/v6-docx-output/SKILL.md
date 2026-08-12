---
name: "v6-docx-output"
description: "V6股票分析报告专业Word文档输出技能。包含：一句话总结注入规则、专业排版格式规范（封面/字体/表格/评分条/结论框/页眉页脚）、docx-js生成脚本模板。Invoke when user asks to export V6 analysis reports to professional Word format, or when generating stock analysis reports as .docx files."
version: v1.0.1
last_updated: 2026-08-11
code_version: "2.0.0-rc.1"
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-11)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-11
---

# V6股票分析报告专业Word文档输出规范

## v1.0 概述

本技能定义V6个股分析报告从Markdown转换为专业Word文档的完整标准，确保所有输出报告格式统一、排版专业、可读性高。

## 一、每章节「一句话总结」注入规则

### 注入时机
每次生成或更新V6个股分析报告时，必须在每个主要章节的开头添加一句话总结。

### 注入格式
```
**📌 一句话总结：** [精准概括该层核心判断，20字以内]
```
或Markdown加粗格式：
```
**[一句话总结]** 该层核心判断内容，20字以内
```

### 强制注入的12个章节

| # | 章节名称 | 一句话总结要求 |
|:---:|---------|-------------|
| 1 | L-1行业评分估值 | 概括行业归属、赛道评级、L-1综合得分 |
| 2 | L0 STEEP宏观扫描 | 概括五维宏观判断和核心驱动/风险 |
| 3 | L1护城河分析 | 概括护城河类型、宽度、核心壁垒 |
| 4 | L2竞品格局 | 概括竞争地位、领先幅度、主要对手 |
| 5 | L3a财务健康 | 概括核心财务指标亮点和风险点 |
| 6 | L3b估値水平 | 概括估値水位、PE/PB水平、目标空间 |
| 7 | L3c IPC业绩兑现临界点 | 概括IPC临界点阶段和核心催化事件 |
| 8 | L4情景推演 | 概括三种情景和概率加权合理价 |
| 9 | L5 T-M矩阵 | 概括技术-市场象限定位和战略含义 |
| 10 | L6 Hype Cycle | 概括所处阶段和投资含义 |
| 11 | L7第二曲线 | 概括各曲线阶段、核心弹性和催化剂 |
| 12 | L8技术与筹码 | 概括筹码状态、技术信号和操作建议 |

### 示例

```
## L-1 | 行业评分估值

**📌 一句话总结：** 电解液+六氟双赛道高β共振，天赐一体化α显著跑赢行业，L-1综合得分3.5分。

### 行业归属
...
```

---

## 二、专业Word排版规范

### 1. 页面设置

| 参数 | 值 |
|------|-----|
| 纸张大小 | A4 (210mm × 297mm) |
| 页面方向 | 纵向 |
| 上边距 | 2.54cm (1440 DXA) |
| 下边距 | 2.54cm (1440 DXA) |
| 左边距 | 3.17cm (1800 DXA) |
| 右边距 | 3.17cm (1800 DXA) |

### 2. 字体规范

| 用途 | 英文字体 | 中文字体 | 字号 | 颜色 |
|------|---------|---------|------|------|
| 正文 | Arial | Microsoft YaHei | 10.5pt (21) | 000000 (黑) |
| 封面标题 | Arial | Microsoft YaHei | 26pt 加粗 | 1F4E79 (深蓝) |
| 封面副标题 | Arial | Microsoft YaHei | 16pt | 404040 |
| H1标题 (章名) | Arial | Microsoft YaHei | 16pt 加粗 | 1F4E79 (深蓝) |
| H2标题 (节名) | Arial | Microsoft YaHei | 13pt 加粗 | 2E75B6 (中蓝) |
| H3标题 (小节) | Arial | Microsoft YaHei | 11pt 加粗 | 000000 |
| 表格标题行 | Arial | Microsoft YaHei | 10pt 加粗 | FFFFFF (白) |
| 表格数据 | Arial | Microsoft YaHei | 10pt | 000000 |
| 页眉 | Arial | Microsoft YaHei | 9pt | 808080 |
| 页脚 | Arial | Microsoft YaHei | 9pt | 808080 |
| 风险提示 | Arial | Microsoft YaHei | 9pt | 808080 |

### 3. 封面结构

```
┌─────────────────────────────────────────────┐
│                                             │
│          V6股票分析报告                      │
│          [股票名称]                          │
│          [股票代码]                          │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  报告日期：[日期]                           │
│  当前评级：[评级] [综合分]                  │
│  核心定性：[一句话定性]                      │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  V6 v4.3 分层递进式个股分析模型             │
│  [机构名称/分析师]                          │
│                                             │
└─────────────────────────────────────────────┘
```

### 4. 表格样式

#### 标题行
- 背景色：`1F4E79` (深蓝)
- 文字色：`FFFFFF` (白)
- 字号：10pt 加粗
- 垂直对齐：居中

#### 数据行
- 奇数行背景色：`FFFFFF` (白)
- 偶数行背景色：`F2F2F2` (浅灰)
- 交替色便于阅读

#### 边框
- 所有边框：1pt，`D0D0D0` (灰色)
- 无粗边框，统一1pt

#### 对齐
- 表头：居中
- 数字列：右对齐
- 文本列：左对齐

### 5. 评分条（彩色评分可视化）

综合评分速览表中的得分列使用彩色评分条：

| 评分范围 | 颜色 | 色值 |
|---------|------|------|
| ≥4.5 (买入) | 绿色 | `70AD47` |
| 4.0-4.49 (增持) | 浅绿 | `A9D18E` |
| 3.5-3.99 (中性) | 黄色 | `FFC000` |
| 3.0-3.49 (中性) | 橙色 | `F4B183` |
| <3.0 (减持/卖出) | 红色 | `FF0000` |

示例实现（docx-js）：
```javascript
function getScoreColor(score) {
  if (score >= 4.5) return "70AD47"; // 绿色
  if (score >= 4.0) return "A9D18E"; // 浅绿
  if (score >= 3.5) return "FFC000"; // 黄色
  if (score >= 3.0) return "F4B183"; // 橙色
  return "FF0000"; // 红色
}
```

### 6. 结论框样式

#### 重要结论框（橙色）
- 边框：1.5pt，`FF8C00` (橙色)
- 背景色：`FFF2CC` (浅橙)
- 内边距：8pt
- 用于：核心投资逻辑、重大风险提示

#### IPC临界点结论框（绿色）
- 边框：1.5pt，`70AD47` (绿色)
- 背景色：`E2EFDA` (浅绿)
- 内边距：8pt
- 用于：IPC临界点阶段判定、业绩兑现信号

#### SCD筹码结论框（蓝色）
- 边框：1.5pt，`2E75B6` (蓝色)
- 背景色：`DEEAF1` (浅蓝)
- 内边距：8pt
- 用于：筹码博弈态势、机构/散户信号

#### 综合评级框（紫色）
- 边框：2pt，`7030A0` (紫色)
- 背景色：`EAD1DC` (浅紫)
- 内边距：10pt
- 用于：综合评级、目标价、置信度

### 7. 页眉页脚

#### 页眉
- 左对齐：`V6 v4.3 股票分析报告`
- 右对齐：`[股票名称]（[股票代码]）`
- 分隔线：0.75pt，`D0D0D0`，下方
- 字号：9pt，颜色：`808080`

#### 页脚
- 左对齐：`仅供参考，不构成投资建议`
- 右对齐：`第 X 页 / 共 Y 页`
- 分隔线：无
- 字号：9pt，颜色：`808080`

---

## 三、docx-js生成脚本模板

```javascript
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');

const CJK_FONT = 'Microsoft YaHei';
const ASCII_FONT = 'Arial';

// ====== 颜色常量 ======
const COLORS = {
  deepBlue: '1F4E79',
  midBlue: '2E75B6',
  white: 'FFFFFF',
  black: '000000',
  gray: '808080',
  lightGray: 'F2F2F2',
  borderGray: 'D0D0D0',
  green: '70AD47',
  lightGreen: 'A9D18E',
  yellow: 'FFC000',
  orange: 'F4B183',
  red: 'FF0000',
  orangeBox: 'FF8C00',
  orangeBg: 'FFF2CC',
  greenBox: '70AD47',
  greenBg: 'E2EFDA',
  blueBox: '2E75B6',
  blueBg: 'DEEAF1',
  purpleBox: '7030A0',
  purpleBg: 'EAD1DC',
};

// ====== 边框工厂函数 ======
const makeBorder = (color = COLORS.borderGray, size = 4) =>
  ({ style: BorderStyle.SINGLE, size, color });
const makeBorders = (color = COLORS.borderGray) => ({
  top: makeBorder(color), bottom: makeBorder(color),
  left: makeBorder(color), right: makeBorder(color)
});

// ====== 文字运行工厂 ======
function textRun(text, opts = {}) {
  const { bold = false, color = COLORS.black, size = 21, font = CJK_FONT } = opts;
  return new TextRun({
    text,
    bold,
    color,
    size,
    font: { ascii: font, hAnsi: font, eastAsia: CJK_FONT }
  });
}

// ====== 段落工厂 ======
function paragraph(children, opts = {}) {
  const { spacing = { before: 60, after: 60 }, align = AlignmentType.LEFT } = opts;
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing,
    alignment: align
  });
}

// ====== 标题工厂 ======
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [textRun(text, { bold: true, color: COLORS.deepBlue, size: 32 })],
    spacing: { before: 240, after: 120 }
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [textRun(text, { bold: true, color: COLORS.midBlue, size: 26 })],
    spacing: { before: 180, after: 90 }
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [textRun(text, { bold: true, size: 22 })],
    spacing: { before: 120, after: 60 }
  });
}

// ====== 结论框工厂 ======
function conclusionBox(label, content, type = 'orange') {
  const colorMap = {
    orange: { border: COLORS.orangeBox, bg: COLORS.orangeBg },
    green: { border: COLORS.greenBox, bg: COLORS.greenBg },
    blue: { border: COLORS.blueBox, bg: COLORS.blueBg },
    purple: { border: COLORS.purpleBox, bg: COLORS.purpleBg }
  };
  const { border, bg } = colorMap[type] || colorMap.orange;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: makeBorders(border),
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
        width: { size: 9360, type: WidthType.DXA },
        children: [paragraph([
          textRun(`📌 ${label} `, { bold: true, size: 21 }),
          textRun(content, { size: 21 })
        ])]
      })]
    })]
  });
}

// ====== 表格工厂 ======
function dataTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      borders: makeBorders(COLORS.borderGray),
      shading: { fill: COLORS.deepBlue, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      width: { size: colWidths[i], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      children: [paragraph(
        [textRun(h, { bold: true, color: COLORS.white, size: 20 })],
        { align: AlignmentType.CENTER }
      )]
    }))
  });

  const dataRows = rows.map((row, rowIdx) => {
    const bg = rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray;
    return new TableRow({
      children: row.map((cell, colIdx) => new TableCell({
        borders: makeBorders(COLORS.borderGray),
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        width: { size: colWidths[colIdx], type: WidthType.DXA },
        children: [paragraph(
          [textRun(String(cell), { size: 20 })],
          { align: colIdx > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT }
        )]
      }))
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

// ====== 评分单元格工厂 ======
function scoreCell(score, colWidth = 1500) {
  let bgColor = COLORS.red;
  if (score >= 4.5) bgColor = COLORS.green;
  else if (score >= 4.0) bgColor = COLORS.lightGreen;
  else if (score >= 3.5) bgColor = COLORS.yellow;
  else if (score >= 3.0) bgColor = COLORS.orange;

  return new TableCell({
    borders: makeBorders(COLORS.borderGray),
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    width: { size: colWidth, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [paragraph(
      [textRun(score.toFixed(2), { bold: true, color: COLORS.white, size: 20 })],
      { align: AlignmentType.CENTER }
    )]
  });
}

// ====== 生成文档 ======
async function generateReport(reportData) {
  const {
    stockName,
    stockCode,
    reportDate,
    rating,
    compositeScore,
    sections = [] // 各章节内容
  } = reportData;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: ASCII_FONT, hAnsi: ASCII_FONT, eastAsia: CJK_FONT },
            size: 21
          }
        }
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1',
          basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, color: COLORS.deepBlue,
            font: { ascii: ASCII_FONT, hAnsi: ASCII_FONT, eastAsia: CJK_FONT } },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0,
            keepNext: false, keepLines: false }
        },
        {
          id: 'Heading2', name: 'Heading 2',
          basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: COLORS.midBlue,
            font: { ascii: ASCII_FONT, hAnsi: ASCII_FONT, eastAsia: CJK_FONT } },
          paragraph: { spacing: { before: 180, after: 90 }, outlineLevel: 1,
            keepNext: false, keepLines: false }
        },
        {
          id: 'Heading3', name: 'Heading 3',
          basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true,
            font: { ascii: ASCII_FONT, hAnsi: ASCII_FONT, eastAsia: CJK_FONT } },
          paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 2,
            keepNext: false, keepLines: false }
        },
      ]
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1800, bottom: 1440, left: 1800 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              textRun('V6 v4.3 股票分析报告', { color: COLORS.gray, size: 18 }),
              textRun('    ' + stockName + '（' + stockCode + '）', {
                color: COLORS.gray, size: 18
              })
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderGray } },
            spacing: { after: 100 }
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              textRun('仅供参考，不构成投资建议    ', { color: COLORS.gray, size: 18 }),
              new TextRun({
                children: [PageNumber.CURRENT, textRun(' / '), PageNumber.TOTAL_PAGES],
                color: COLORS.gray, size: 18,
                font: { ascii: ASCII_FONT, hAnsi: ASCII_FONT, eastAsia: CJK_FONT }
              })
            ],
            spacing: { before: 100 }
          })]
        })
      },
      children: [
        // ====== 封面 ======
        new Paragraph({
          children: [textRun('V6股票分析报告', {
            bold: true, size: 52, color: COLORS.deepBlue
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 1440, after: 360 }
        }),
        new Paragraph({
          children: [textRun(stockName, {
            bold: true, size: 36, color: COLORS.black
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 }
        }),
        new Paragraph({
          children: [textRun(stockCode, {
            size: 24, color: COLORS.gray
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 720 }
        }),
        // 分隔线
        new Paragraph({
          children: [textRun('─'.repeat(40), { color: COLORS.borderGray, size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 360, after: 360 }
        }),
        new Paragraph({
          children: [
            textRun('报告日期：', { bold: true, size: 22 }),
            textRun(reportDate, { size: 22 })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 }
        }),
        new Paragraph({
          children: [
            textRun('综合评级：', { bold: true, size: 22 }),
            textRun(rating + ' ' + compositeScore.toFixed(2), {
              bold: true, size: 22, color: COLORS.deepBlue
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 720 }
        }),
        new Paragraph({
          children: [textRun('─'.repeat(40), { color: COLORS.borderGray, size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 360, after: 360 }
        }),
        new Paragraph({
          children: [textRun('V6 v4.3 分层递进式个股分析模型', {
            size: 18, color: COLORS.gray
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 60 }
        }),
        // 封面分页
        new Paragraph({ children: [new PageBreak()] }),

        // ====== 报告内容 ======
        // 各章节在此动态插入
        ...sections,

        // ====== 风险提示 ======
        h1('风险提示'),
        conclusionBox('免责声明', '本报告基于公开信息和V6分析框架生成，仅供投资研究参考，不构成投资建议。股票投资有风险，入市需谨慎。过往业绩不代表未来表现。', 'orange'),
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

// ====== 使用示例 ======
// const reportData = {
//   stockName: '天赐材料',
//   stockCode: '002709.SZ',
//   reportDate: '2026-05-29',
//   rating: '增持',
//   compositeScore: 4.61,
//   sections: [
//     h1('L-1 行业评分估值'),
//     conclusionBox('一句话总结', '电解液+六氟双赛道...', 'blue'),
//     // ... 其他章节
//   ]
// };
// const buffer = await generateReport(reportData);
// fs.writeFileSync('output.docx', buffer);
```

---

## 四、使用流程

### 单份报告生成流程

```
1. 读取MD文件 → 提取各章节内容
2. 注入一句话总结 → 在每个L0-L8章节前添加
3. 按docx-js模板生成 → 调用generateReport函数
4. 保存到V6模型文档文件夹 → `./outputs/v6-docx/`（路径可按实际部署环境配置）
```

### 批量报告生成

```javascript
const stocks = [
  { name: '天赐材料', code: '002709.SZ', path: '...\\天赐材料\\index.md' },
  { name: '先导智能', code: '300450.SZ', path: '...\\先导智能\\index.md' },
  // ...
];

for (const stock of stocks) {
  const mdContent = fs.readFileSync(stock.path, 'utf8');
  const reportData = parseMDToReportData(mdContent, stock);
  reportData.sections = injectSummaries(reportData.sections);
  const buffer = await generateReport(reportData);
  fs.writeFileSync(`V6模型文档\\${stock.name}_V6v4.3价值分析报告.docx`, buffer);
}
```

---

## 五、输出文件命名规范

```
{股票名称}_V6v4.3价值分析报告.docx
```

示例：
- `天赐材料_V6v4.3价值分析报告.docx`
- `先导智能_V6v4.3价值分析报告.docx`
- `中际旭创_V6v4.3价值分析报告.docx`
- `腾讯控股_V6v4.3价值分析报告.docx`
- `万华化学_V6v4.3价值分析报告.docx`

---

## 版本记录

- **v1.0** 2026-06-01：初始版本，包含一句话总结注入规则、专业排版规范、docx-js模板
