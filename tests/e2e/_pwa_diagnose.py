"""PWA 诊断脚本：
  D1: GET /sw.js HTTP 200 ?
  D2: 手动 navigator.serviceWorker.register('/sw.js') 能否成功？
  D3: virtual:pwa-register 产物 chunk（assets/virtual_pwa-register-*.js）HTTP 可达性？
  D4: 在 window 上注入标志位后 navigate，看我们 registerSW 有没有运行？
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8080"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    # D1: fetch /sw.js 直接在 page context 里做（同源）
    print("--- D1: /sw.js 同源 fetch ---")
    page.goto(BASE, wait_until="domcontentloaded", timeout=15000)
    d1 = page.evaluate("async () => { const r = await fetch('/sw.js', {cache:'no-store'}); return { status: r.status, type: r.headers.get('content-type')||'', length: (await r.text()).length }; }")
    print(f"  D1 => {d1}")
    assert d1["status"] == 200, "/sw.js HTTP 非 200 → 构建产物缺失或 URL 错"

    # D2: 手动 register('/sw.js')
    print("--- D2: 手动 navigator.serviceWorker.register('/sw.js') ---")
    d2 = page.evaluate("""async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            // 等待 activating → active 最多 6s
            for (let i = 0; i < 60; i++) {
                if (reg.active) break;
                await new Promise(r => setTimeout(r, 100));
            }
            const keys = await caches.keys();
            const sizes = {};
            for (const k of keys) sizes[k] = (await (await caches.open(k)).keys()).length;
            return { ok: true, scope: reg.scope, active: !!reg.active, controllerBeforeReload: !!navigator.serviceWorker.controller, caches: sizes };
        } catch (e) {
            return { ok: false, error: String(e) };
        }
    }""")
    print(f"  D2 => {d2}")

    # D2 续：reload 后看 controller 是否接管 + 离线是否可达
    if d2.get("ok"):
        page.reload(wait_until="domcontentloaded", timeout=20000)
        controller = page.evaluate("!!navigator.serviceWorker.controller")
        print(f"  D2-controller after reload: {controller}")
        # 离线测试
        context.set_offline(True)
        page.wait_for_timeout(400)
        try:
            r = page.goto(BASE, wait_until="domcontentloaded", timeout=15000)
            print(f"  D2-offline reload: status={r.status if r else 'N/A'}")
        except Exception as e:
            print(f"  D2-offline reload: FAILED {e!r:.200}")
        context.set_offline(False)

    # D3: virtual:pwa-register 对应 chunk 存在？
    print("--- D3: assets/virtual_pwa-register-*.js fetch ---")
    d3 = page.evaluate("""async () => {
        const html = document.documentElement.outerHTML;
        const scripts = [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
        const chunk = scripts.find(s => s.includes('virtual_pwa-register'));
        if (!chunk) return { chunk: null, status: null };
        const r = await fetch(chunk, {cache:'no-store'});
        return { chunk, status: r.status, length: (await r.text()).length };
    }""")
    print(f"  D3 => {d3}")

    # D4: 检查 main.tsx 里 scheduleRegisterPwaSW 是否真的执行过？
    #     改代码之前没埋标志位，这里通过日志反推：先看 window 上有没有 virtual module 相关错误。
    print("--- D4: 打开主入口 JS 中是否存在 registerSW 引用 ---")
    d4 = page.evaluate("""() => {
        const scripts = [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
        return scripts.filter(s => s.startsWith('/assets/index'));
    }""")
    print(f"  D4 => main entry chunks: {d4}")

    browser.close()
    print("\n--- 诊断完成 ---")
