/**
 * convert-handbook-to-html.mjs
 * 复用仓库内已存在的 markdown-it（node_modules/protobufjs/cli/node_modules/markdown-it）
 * 将 docs/team-handbook/ 下的 Markdown 手册转换为统一主题的 HTML，
 * 并直接检索仓库内相关的现成高质量 HTML 资料作为补充，输出到 docs/team-handbook-html/。
 *
 * 用法：node scripts/convert-handbook-to-html.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // 仓库根目录（scripts/ 的上一级），不硬编码盘符/用户名
const MD = require(path.join(ROOT, 'node_modules/protobufjs/cli/node_modules/markdown-it'));

const SRC = path.join(ROOT, 'docs/team-handbook');
const OUT = path.join(ROOT, 'docs/team-handbook-html');
const SUPP = path.join(OUT, 'supplementary');
const BASE = path.join(ROOT, 'outputs/pre-launch-review/redundant-files/docs-reports-archive');

// 手册元数据：文件名(无后缀) -> { title, dim }
const HANDBOOKS = [
  { file: 'README', title: '总导航 · 团队手册地图', dim: '导航' },
  { file: '01-design-philosophy', title: '① 设计与原创思路', dim: '设计 & 原创' },
  { file: '02-architecture', title: '② 整体架构设计', dim: '架构' },
  { file: '03-ui-components', title: '③ UI 组件设计', dim: 'UI 组件' },
  { file: '04-model-runtime', title: '④ 模型运行机制', dim: '模型运行' },
  { file: '05-competitive-analysis', title: '⑤ 竞品对比分析', dim: '竞品对比' },
];

// 直接检索到的仓库内高质量 HTML 补充资料（按维度映射，去重、取权威路径）
const SUPPLEMENTS = [
  { src: path.join(BASE, 'html/architecture-radar-scan/architecture-radar-scan.html'),
    name: 'V9架构360度雷达扫描报告_v3.0.html', dim: '② 整体架构',
    note: '架构合规、分层、依赖方向的 360° 扫描，对应维度 ②' },
  { src: path.join(BASE, 'html/v9-mcp-architecture-refactoring-plan/v9-mcp-architecture-refactoring-plan.html'),
    name: 'V9_MCP架构梳理与重构方案.html', dim: '② 整体架构 / ④ 模型运行',
    note: 'MCP Server 架构解耦与重构规划，对应维度 ②/④' },
  { src: path.join(BASE, 'design/v9-interaction-flows.html'),
    name: 'V9_各功能板块人机交互时序.html', dim: '③ UI 组件',
    note: '各功能板块人机交互时序图，对应维度 ③' },
  { src: path.join(ROOT, 'docs/explanation/v9-mcp-analysis.html'),
    name: 'V9_MCP架构解耦分析.html', dim: '④ 模型运行',
    note: 'Agent / LLM / 15 个 MCP Server 生态专项分析，对应维度 ④' },
  { src: path.join(BASE, 'html/mcp-agent-gap-analysis/mcp-agent-gap-analysis.html'),
    name: 'V9_MCP_Server与Agent功能遗漏诊断.html', dim: '④ 模型运行',
    note: 'MCP Server & Agent 管理群功能遗漏诊断，对应维度 ④' },
  { src: path.join(ROOT, 'docs/06-project-management/plans/UI设计原则基线与创新水准_V9.html'),
    name: 'UI设计原则基线与创新水准_V9.html', dim: '① 设计与原创 / ③ UI',
    note: '宋韵美学、设计令牌与创新水准基线，对应维度 ①/③' },
  { src: path.join(ROOT, 'docs/06-project-management/plans/UI设计优化实操方案_V6×V9×WorkBuddy.html'),
    name: 'UI设计优化实操方案_V6×V9×WorkBuddy.html', dim: '③ UI 组件',
    note: 'UI 优化落地方案，对应维度 ③' },
  { src: path.join(ROOT, 'docs/06-project-management/plans/UI设计对照与成熟度评估_V6vsV9.html'),
    name: 'UI设计对照与成熟度评估_V6vsV9.html', dim: '③ UI / ⑤ 竞品',
    note: 'V6 与 V9 的 UI 对照与成熟度评估（内部竞品），对应维度 ③/⑤' },
  { src: path.join(BASE, 'html/v9-audit-report/v9-audit-report.html'),
    name: 'V9_界面全面排查报告.html', dim: '延伸 · 质量',
    note: '界面全面排查报告，质量治理延伸阅读' },
  { src: path.join(BASE, 'html/v9-post-dev-review/v9-post-dev-review.html'),
    name: 'V9_开发后复盘与流程优化报告.html', dim: '延伸 · 治理',
    note: '开发后复盘与流程优化，工程治理延伸阅读' },
  { src: path.join(BASE, 'code-graph-visualization.html'),
    name: 'V9_项目代码知识图谱.html', dim: '延伸 · 代码',
    note: '代码知识图谱可视化，技术资产延伸阅读' },
];

// ---- 宋韵亮色主题 CSS（stone 暖灰底 + emerald 强调，遵循项目设计令牌）----
const CSS = `
:root{
  --bg:#fafaf9; --panel:#ffffff; --border:#e7e5e4; --text:#292524;
  --text2:#57534e; --muted:#a8a29e; --accent:#10b981; --accent-bg:#ecfdf5;
  --code-bg:#f5f5f4;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.75;font-size:15px}
.layout{display:flex;align-items:flex-start;min-height:100vh}
.sidebar{position:sticky;top:0;align-self:flex-start;width:240px;flex-shrink:0;height:100vh;
  overflow-y:auto;background:var(--panel);border-right:1px solid var(--border);padding:24px 18px}
.sidebar h2{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px}
.sidebar a{display:block;color:var(--text2);text-decoration:none;font-size:14px;padding:7px 10px;
  border-radius:8px;margin-bottom:2px}
.sidebar a:hover{background:var(--accent-bg);color:#047857}
.sidebar a.active{background:var(--accent);color:#fff}
.sidebar .sub{font-size:11px;color:var(--muted);margin:14px 0 6px;padding-left:10px}
.content{flex:1;max-width:880px;margin:0 auto;padding:40px 48px 80px}
article h1{font-size:30px;font-weight:800;letter-spacing:-.5px;margin:0 0 6px;
  border-bottom:3px solid var(--accent);padding-bottom:14px}
article h2{font-size:22px;font-weight:700;margin:38px 0 12px;padding-left:12px;border-left:4px solid var(--accent)}
article h3{font-size:18px;font-weight:700;margin:26px 0 8px;color:var(--text)}
article h4{font-size:15.5px;font-weight:700;margin:18px 0 6px;color:var(--text2)}
article p{margin:10px 0;color:var(--text2)}
article ul,article ol{padding-left:24px;margin:10px 0;color:var(--text2)}
article li{margin:5px 0}
article a{color:var(--accent);text-decoration:none;border-bottom:1px solid #a7f3d0}
article a:hover{color:#047857}
article code{background:var(--code-bg);border:1px solid var(--border);border-radius:5px;padding:1px 6px;
  font-size:13px;font-family:'SFMono-Regular',Consolas,monospace;color:#be123c}
article pre{background:var(--code-bg);border:1px solid var(--border);border-radius:12px;padding:18px 20px;
  overflow-x:auto;margin:14px 0}
article pre code{background:none;border:none;padding:0;color:#1c1917;font-size:13px;line-height:1.6}
article blockquote{border-left:4px solid var(--accent);background:var(--accent-bg);margin:14px 0;
  padding:12px 18px;border-radius:0 10px 10px 0;color:#065f46}
article table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px}
article th,article td{border:1px solid var(--border);padding:9px 12px;text-align:left}
article th{background:var(--panel);font-weight:700;color:var(--text)}
article tr:nth-child(even) td{background:#fcfcfb}
article hr{border:none;border-top:1px solid var(--border);margin:32px 0}
article img{max-width:100%;border-radius:10px;border:1px solid var(--border)}
pre.mermaid{background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;}
footer{text-align:center;color:var(--muted);font-size:12px;margin-top:48px;padding-top:20px;border-top:1px solid var(--border)}
.back{display:inline-block;margin-bottom:18px;color:var(--accent);text-decoration:none;font-size:13px}
`;

const md = MD({ html: true, linkify: true, typographer: true });

// 把 ```mermaid 代码块转换为 mermaid 可识别的 <pre class="mermaid">
function postProcessMermaid(html) {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_m, inner) => `<pre class="mermaid">${inner}</pre>`
  );
}

function sidebarNav(activeFile) {
  const links = HANDBOOKS.map(
    (h) => `<a href="${h.file}.html"${h.file === activeFile ? ' class="active"' : ''}>${h.title}</a>`
  ).join('\n    ');
  return `<aside class="sidebar">
    <h2>团队体系手册</h2>
    <a href="index.html">📑 总览索引</a>
    <div class="sub">手册正文</div>
    ${links}
    <div class="sub">补充资料</div>
    <a href="supplementary/index.html">📁 高质量补充 HTML</a>
  </aside>`;
}

function pageTemplate({ title, activeFile, body }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · FinSightV9 团队手册</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
  ${sidebarNav(activeFile)}
  <main class="content"><article>
    <a class="back" href="index.html">← 返回总览</a>
    ${body}
    <footer>FinSightV9 智能投研复盘系统 · 团队体系手册 · 由 markdown-it 自动转换生成</footer>
  </article></main>
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: true, theme: 'base',
      themeVariables: { primaryColor:'#ecfdf5', lineColor:'#57534e', fontFamily:'sans-serif' } });
  }
</script>
</body>
</html>`;
}

function buildIndex() {
  const cards = HANDBOOKS.filter((h) => h.file !== 'README')
    .map(
      (h) => `<div class="card">
      <div class="badge">${h.dim}</div>
      <a href="${h.file}.html">${h.title}</a>
      <p>${dimDesc(h.dim)}</p>
    </div>`
    )
    .join('\n    ');

  const suppByDim = {};
  for (const s of SUPPLEMENTS) {
    (suppByDim[s.dim] ||= []).push(s);
  }
  const suppHtml = Object.entries(suppByDim)
    .map(
      ([dim, items]) => `<div class="dim">
      <h3>${dim}</h3>
      <ul>${items
        .map((s) => `<li><a href="supplementary/${encodeURIComponent(s.name)}">${s.name}</a><br><span class="note">${s.note}</span></li>`)
        .join('\n      ')}</ul>
    </div>`
    )
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FinSightV9 团队体系手册 · 总览</title>
<style>${CSS}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.card a{font-size:17px;font-weight:700;color:var(--text);text-decoration:none}
.card a:hover{color:var(--accent)}
.card p{font-size:13px;color:var(--muted);margin:8px 0 0}
.dim{margin:18px 0;padding:16px 20px;background:var(--panel);border:1px solid var(--border);border-radius:12px}
.dim h3{margin:0 0 8px;color:var(--accent)}
.dim .note{font-size:12px;color:var(--muted)}
.legend{font-size:12px;color:var(--muted);background:var(--accent-bg);border:1px solid #a7f3d0;
  border-radius:10px;padding:12px 16px;margin:16px 0;line-height:1.6}
</style>
</head>
<body>
<div class="content" style="max-width:960px">
  <h1 style="border:none;padding:0">FinSightV9 团队体系手册</h1>
  <p class="legend">本手册由 6 份核心 Markdown 手册（<b>统一 HTML 版</b>）+ 11 份仓库内<b>高质量 HTML 补充资料</b>组成，
  覆盖「设计原创 / 整体架构 / UI 组件 / 模型运行 / 竞品对比」五大维度，供团队快速理解与协作。<br>
  ⚠️ Mermaid 架构图在联网环境下由 CDN 自动渲染；离线时以代码块呈现，亦可用 GitHub / VS Code / Typora 查看原始 .md。</p>

  <h2>一、核心手册（HTML 版）</h2>
  <div class="cards">
    ${cards}
  </div>

  <h2>二、直接检索的高质量 HTML 补充资料</h2>
  ${suppHtml}

  <footer>FinSightV9 智能投研复盘系统 · 团队体系手册 · 由 markdown-it 自动转换生成</footer>
</div>
</body>
</html>`;
}

function buildSuppIndex() {
  const rows = SUPPLEMENTS.map(
    (s, i) => `<tr><td>${i + 1}</td><td><a href="${encodeURIComponent(s.name)}">${s.name}</a></td>
    <td>${s.dim}</td><td>${s.note}</td></tr>`
  ).join('\n    ');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>高质量 HTML 补充资料索引</title>
<style>${CSS}</style>
</head>
<body>
<div class="content" style="max-width:960px">
  <h1 style="border:none;padding:0">高质量 HTML 补充资料</h1>
  <p><a class="back" href="index.html">← 返回总览</a></p>
  <p class="legend">以下为直接从仓库检索、与五大维度高度相关的现成 HTML 成品（来源：docs/explanation、docs/06-project-management/plans、outputs/pre-launch-review 报告归档）。</p>
  <table>
    <thead><tr><th>#</th><th>文件</th><th>对应维度</th><th>说明</th></tr></thead>
    <tbody>
    ${rows}
    </tbody>
  </table>
  <footer>FinSightV9 智能投研复盘系统 · 团队体系手册</footer>
</div>
</body>
</html>`;
}

function dimDesc(dim) {
  const m = {
    '设计 & 原创': '项目定位、设计哲学、宋韵美学与 L1–L6 令牌体系。',
    '架构': '五层架构、23 目录分层、DataBridge 数据流与扩展能力。',
    'UI 组件': '原子设计层级边界、Widget 注册、lint:colors 门禁与协作约定。',
    '模型运行': 'V6 引擎、采集流水线、Worker 池、Agent/LLM/MCP 生态。',
    '竞品对比': '竞品矩阵、四大差异化支柱与战略建议。',
  };
  return m[dim] || '';
}

// ---- 执行 ----
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SUPP, { recursive: true });

let ok = 0;
for (const h of HANDBOOKS) {
  const mdPath = path.join(SRC, h.file + '.md');
  if (!fs.existsSync(mdPath)) { console.warn('跳过（缺失）:', mdPath); continue; }
  const raw = fs.readFileSync(mdPath, 'utf8');
  const body = postProcessMermaid(md.render(raw));
  fs.writeFileSync(path.join(OUT, h.file + '.html'), pageTemplate({ title: h.title, activeFile: h.file, body }));
  ok++;
}
console.log(`✅ 手册转换完成：${ok}/${HANDBOOKS.length} 份`);

// 复制补充 HTML 资料
let sok = 0;
for (const s of SUPPLEMENTS) {
  if (!fs.existsSync(s.src)) { console.warn('补充缺失:', s.src); continue; }
  fs.copyFileSync(s.src, path.join(SUPP, s.name));
  sok++;
}
console.log(`✅ 补充资料归集完成：${sok}/${SUPPLEMENTS.length} 份`);

fs.writeFileSync(path.join(OUT, 'index.html'), buildIndex());
fs.writeFileSync(path.join(SUPP, 'index.html'), buildSuppIndex());
console.log('✅ 索引页已生成：index.html / supplementary/index.html');
