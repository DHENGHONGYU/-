/*
 * theme-boot.js — 首屏引导脚本（原 index.html 内联脚本外置）
 *
 * 目的：
 *  1. 防 FOUC（主题闪烁）：React 挂载前同步读取主题偏好并设 data-theme/dark 类。
 *  2. HashRouter 降级：直接访问非 hash 路径时自动重定向到对应 hash 路由。
 *
 * 外置原因（P1-2 安全合规）：使 index.html 不再含内联 <script>，
 * 从而可在生产构建注入 `script-src 'self'`（禁用 unsafe-inline）的 CSP。
 * 本文件由 Vite 原样复制至 dist 根，作为同源外部脚本加载，满足 CSP。
 */
(function () {
  // ---- 1. 防 FOUC：主题预解析 ----
  try {
    var stored = localStorage.getItem('v9-theme');
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    if (resolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  } catch (e) {
    /* 无 localStorage 时静默降级为默认（暗色） */
  }

  // ---- 2. HashRouter 降级重定向 ----
  var path = window.location.pathname;
  var hash = window.location.hash;
  if (
    path !== '/' &&
    !hash &&
    !path.endsWith('.js') &&
    !path.endsWith('.css') &&
    !path.endsWith('.svg') &&
    !path.endsWith('.png') &&
    !path.endsWith('.ico')
  ) {
    window.location.replace(window.location.origin + '/#' + path);
  }
})();
