// 生成自包含的 SVG→PNG 转换页（base64 内联，无需服务器，双击即用）
const fs = require('fs');
const path = require('path');

const figs = [
  {f:'fig1-architecture.svg', t:'图1 · 4指挥官×20分身架构'},
  {f:'fig2-memory-layer.svg', t:'图2 · 三层记忆文件结构'},
  {f:'fig3-expert-center.svg', t:'图3 · 专家中心配置流程'},
  {f:'fig4-comparison.svg', t:'图4 · 改造前后时间对比'},
  {f:'fig5-pitfalls-overview.svg', t:'图5 · 5个踩坑概览'},
  {f:'fig6-solution-flow.svg', t:'图6 · 工作模式决策流'}
];

const dir = path.join(__dirname, 'images');
const data = figs.map(({f,t}) => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const b64 = Buffer.from(content).toString('base64');
  const m = content.match(/viewBox="0 0 (\d+) (\d+)"/);
  const w = m ? +m[1] : 680, h = m ? +m[2] : 400;
  return { f, t, b64, w, h, name: f.replace('.svg','.png') };
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>配图转 PNG · 一键导出（自包含版）</title>
<style>
  :root{--bg:#fafaf9;--panel:#fff;--border:#e7e5e4;--text:#1c1917;--muted:#78716c;--accent:#10b981;--accent-bg:#ecfdf5}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;padding:28px 20px}
  .wrap{max-width:880px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .sub{color:var(--muted);font-size:13px;margin-bottom:8px}
  .bar{background:var(--accent-bg);border:1px solid #a7f3d0;border-radius:10px;padding:12px 18px;margin:16px 0;font-size:13px;color:#065f46;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .bar button{background:var(--accent);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
  .bar button:hover{background:#059669}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
  .cell{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px}
  .cell h3{font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)}
  .cell .prev{background:var(--bg);border-radius:6px;overflow:hidden;margin-bottom:10px;min-height:60px}
  .cell .prev img{width:100%;height:auto;display:block}
  .cell button{width:100%;background:#1c1917;color:#fff;border:none;padding:9px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer}
  .cell button:hover{background:#292524}
  .ok{color:var(--accent);font-size:12px;margin-top:6px;text-align:center}
  footer{text-align:center;color:var(--muted);font-size:11px;margin-top:24px}
</style>
</head>
<body>
<div class="wrap">
  <h1>配图转 PNG · 一键导出</h1>
  <p class="sub">6 张示意图 · 2 倍高清 · 自包含离线版（双击即用，无需联网）</p>
  <div class="bar">
    <span>点击右侧按钮依次下载全部 6 张 PNG</span>
    <button id="allBtn">全部下载</button>
  </div>
  <div class="grid" id="grid"></div>
  <footer>SVG → PNG · base64 内联 · 本地浏览器渲染 · 无网络依赖</footer>
</div>
<script>
const FIGS = ${JSON.stringify(data)};
const grid = document.getElementById('grid');
const ready = {};

FIGS.forEach((fig, i) => {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = '<h3>'+fig.t+'</h3><div class="prev"></div>';
  const btn = document.createElement('button');
  btn.textContent = '下载 PNG';
  btn.disabled = true;
  const status = document.createElement('div');
  cell.appendChild(btn);
  cell.appendChild(status);
  grid.appendChild(cell);

  const svgText = atob(fig.b64);
  const blob = new Blob([svgText], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    cell.querySelector('.prev').appendChild(img);
    ready[i] = {img, w:fig.w, h:fig.h, name:fig.name};
    btn.disabled = false;
    btn.onclick = () => downloadPng(i, status);
    status.className='ok'; status.textContent='就绪 · '+fig.w+'×'+fig.h;
  };
  img.onerror = () => { status.className='ok'; status.textContent='渲染失败'; };
  img.src = url;
});

function downloadPng(i, status){
  const r = ready[i]; if(!r) return;
  const c = document.createElement('canvas');
  c.width = r.w*2; c.height = r.h*2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(0,0,c.width,c.height);
  ctx.scale(2,2);
  ctx.drawImage(r.img, 0, 0, r.w, r.h);
  c.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = r.name;
    document.body.appendChild(a); a.click(); a.remove();
    status.className='ok'; status.textContent='已下载 '+r.name;
  },'image/png');
}

document.getElementById('allBtn').onclick = async () => {
  for(let i=0;i<FIGS.length;i++){
    if(ready[i]){
      downloadPng(i, grid.children[i].querySelector('div:last-child'));
      await new Promise(r=>setTimeout(r,600));
    }
  }
};
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'convert-standalone.html'), html, 'utf8');
console.log('Generated convert-standalone.html (' + html.length + ' bytes)');
