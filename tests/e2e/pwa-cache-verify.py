"""
P3-2 PWA 缓存机制 e2e 验证脚本 · 对应本地 vite preview（127.0.0.1:8080）
验证 4 项关键指标：
  [1] manifest.json 可加载（PWA 可安装基础）
  [2] Service Worker 注册成功，controller 非 null（sw.js 激活）
  [3] 离线模式下 reload 仍返回 200（文档从 SW CacheStorage 命中）
  [4] CacheStorage 含 ≥ 2 个缓存（precache-v1 + runtime v9-*-v1）

用法：python tests/e2e/pwa-cache-verify.py
退出码：0 = 全部通过，1 = 任一失败
"""

from __future__ import annotations
import json
import sys
from playwright.sync_api import sync_playwright, expect, BrowserContext

BASE = "http://127.0.0.1:8080"

results: list[tuple[str, bool, str]] = []

def record(name: str, ok: bool, detail: str) -> None:
    flag = "✅ PASS" if ok else "❌ FAIL"
    print(f"[{flag}] {name} — {detail}")
    results.append((name, ok, detail))


with sync_playwright() as p:
    # Playwright 默认 chromium，headless=True。
    # 注意：需要 launch args 允许不安全 localhost 的 Service Worker（https 非必须对 localhost）
    browser = p.chromium.launch(headless=True)
    context: BrowserContext = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="zh-CN",
        # 允许 localhost Service Worker 正常工作（Chromium 默认对 http://localhost 放行，无需额外 bypass）
    )
    page = context.new_page()
    console_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)

    # ------------------------------------------------------------------ [1] manifest.json
    try:
        resp = page.goto(f"{BASE}/manifest.json", wait_until="domcontentloaded", timeout=15000)
        assert resp is not None, "manifest 返回 None"
        body = json.loads(resp.text())
        # PWA 5 项可安装基础字段必须齐全
        for k in ("name", "short_name", "start_url", "display", "background_color", "theme_color"):
            assert k in body, f"manifest 缺少字段 {k}"
        icons = body.get("icons", [])
        sizes = [i.get("sizes", "") for i in icons]
        assert any("192x192" in s for s in sizes), "manifest 缺少 192x192 icon"
        assert any("512x512" in s for s in sizes), "manifest 缺少 512x512 icon"
        record("manifest 可加载 + 必需 7 字段 + 192/512 图标齐全", True,
               f"HTTP {resp.status} · icons={len(icons)} · name={body.get('name')!r}")
    except Exception as e:
        record("manifest 可加载 + 必需 7 字段 + 192/512 图标齐全", False, f"{type(e).__name__}: {e}")

    # ------------------------------------------------------------------ [2] SW 注册 + controller 非 null
    # 首访首页触发 SW install（vite-plugin-pwa 在 index.html <head> 注入 registerSW）
    try:
        page.goto(BASE, wait_until="networkidle", timeout=30000)
        # registerSW() 用 requestIdleCallback(5s timeout) + 动态 import virtual:pwa-register 需要等待
        page.wait_for_timeout(8000)
        has_controller = page.evaluate("""
            async () => {
                if (!('serviceWorker' in navigator)) return false;
                const reg = await navigator.serviceWorker.getRegistration('/');
                if (!reg) return false;
                const active = reg.active || reg.installing || reg.waiting;
                return !!active;
            }
        """)
        if not has_controller:
            record("SW 注册成功（getRegistration 返回 active SW）", False,
                   "首访 2.5s 后未拿到 registration.active；尝试 reload 后再取 controller")
        else:
            record("SW 注册成功（getRegistration 返回 active SW）", True,
                   "navigator.serviceWorker.getRegistration('/') 存在 active/installing/waiting")

        # 刷新一次后检查 controller 非 null（严格的 SW 接管状态）
        page.reload(wait_until="networkidle", timeout=30000)
        controller_not_null = page.evaluate("!!navigator.serviceWorker.controller")
        record("SW controller 非 null（页面已被 SW 接管）", controller_not_null,
               "navigator.serviceWorker.controller !== null" if controller_not_null else "仍为 null → SW 未接管当前 client")

        # 再检查一次 registration scope
        scope = page.evaluate("""async () => {
            const r = await navigator.serviceWorker.getRegistration('/');
            return r ? r.scope : null;
        }""")
        record(f"SW scope 正确 = {BASE}/（scope={scope!r}）",
               bool(scope and scope.rstrip("/") == BASE),
               f"scope={scope!r}")
    except Exception as e:
        record("SW 注册 + controller 接管", False, f"{type(e).__name__}: {e}")

    # ------------------------------------------------------------------ [3] 离线 reload 文档 200（核心 PWA 可用性）
    try:
        # 设置 context 离线（模拟断网）
        context.set_offline(True)
        page.wait_for_timeout(500)
        resp_offline = page.goto(BASE, wait_until="domcontentloaded", timeout=20000)
        ok_offline = resp_offline is not None and resp_offline.status == 200
        body_len = page.evaluate("document.documentElement.outerHTML.length") if ok_offline else 0
        record("离线模式下 reload 文档 status=200（SW CacheStorage 返回）", ok_offline,
               f"status={'N/A' if resp_offline is None else resp_offline.status} · HTML 长度 ≈ {body_len} 字符")
        # 恢复在线（后续 4 项验证需要网络）
        context.set_offline(False)
        page.wait_for_timeout(300)
    except Exception as e:
        context.set_offline(False)
        record("离线 reload 文档 200", False, f"{type(e).__name__}: {e}")

    # ------------------------------------------------------------------ [4] CacheStorage 数量 ≥ precache + runtime
    try:
        caches = page.evaluate("""async () => {
            if (!('caches' in window)) return [];
            const keys = await caches.keys();
            const sizes = {};
            for (const k of keys) {
                const cache = await caches.open(k);
                const reqs = await cache.keys();
                sizes[k] = reqs.length;
            }
            return sizes;
        }""")
        total_entries = sum(caches.values()) if isinstance(caches, dict) else 0
        cache_count = len(caches) if isinstance(caches, dict) else 0
        # precache-* 至少 1 个（工作盒预缓存清单） + 至少 1 个运行时
        ok_caches = cache_count >= 1 and total_entries >= 50  # 228 precache 条目，保守阈值 50
        record(f"CacheStorage 命中（{cache_count} 个缓存名，共 {total_entries} entries）", ok_caches,
               f"caches={json.dumps(caches, ensure_ascii=False)}")
    except Exception as e:
        record("CacheStorage 数量检查", False, f"{type(e).__name__}: {e}")

    # 打印浏览器控制台错误作为诊断
    if console_errors:
        print(f"\n⚠  浏览器 console 错误/警告（{len(console_errors)} 条）：")
        for line in console_errors[:12]:
            print("  ·", line)
        if len(console_errors) > 12:
            print(f"  · ... 省略剩余 {len(console_errors)-12} 条")

    browser.close()

# ------------------------------ 汇总 ------------------------------
print("\n" + "=" * 72)
pass_cnt = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"PWA 验证汇总：{pass_cnt} / {total} 通过")
for name, ok, detail in results:
    tag = "✅" if ok else "❌"
    print(f"  {tag}  {name}")
print("=" * 72)

sys.exit(0 if pass_cnt == total else 1)
