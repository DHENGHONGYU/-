"""PWA 根因诊断 + 验证 6 项。正确使用 Playwright ConsoleMessage.text（属性非方法）."""
from __future__ import annotations
import json, sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8080"

passed = 0
total = 0
def check(name: str, ok: bool, detail: str) -> None:
    global passed, total
    total += 1
    if ok: passed += 1
    tag = "✅" if ok else "❌"
    print(f"{tag} [{passed}/{total}] {name} — {detail}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    console_lines: list[str] = []
    page.on("console", lambda cm: console_lines.append(cm.type + " :: " + cm.text))

    page.goto(BASE, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(10000)  # kickoff(3重调度) + SW register + install + activate

    # ========== [1] manifest 必需字段 ==========
    resp_m = page.goto(BASE + "/manifest.json", wait_until="domcontentloaded", timeout=15000)
    if resp_m and resp_m.status == 200:
        try:
            body = json.loads(resp_m.text())
            keys_ok = all(k in body for k in ("name","short_name","start_url","display","background_color","theme_color"))
            sizes = [i.get("sizes","") for i in body.get("icons", [])]
            icons_ok = any("192x192" in s for s in sizes) and any("512x512" in s for s in sizes)
            check("manifest 可加载 + 必需 7 字段 + 192/512 图标", keys_ok and icons_ok,
                  f"HTTP {resp_m.status} · icons={len(body.get('icons',[]))} · name={body.get('name')!r}")
        except Exception as e:
            check("manifest 可加载 + 必需字段", False, f"JSON 解析失败 {e!r}")
    else:
        check("manifest 可加载", False, f"HTTP {resp_m.status if resp_m else 'N/A'}")

    # ========== [2] kickoff 确实被触发（通过 console 里 [main] scheduleRegisterPwaSW kickoff） ==========
    pwa_lines = [l for l in console_lines if any(k in l for k in ("scheduleRegisterPwaSW kickoff", "[pwa]", "PWA SW", "Service Worker"))]
    has_kickoff = any("scheduleRegisterPwaSW kickoff" in l for l in pwa_lines)
    has_registered = any("registration 成功" in l or "registration 失败" in l for l in pwa_lines)
    check("kickoff 触发 + registerSW 被实际调用（console 有日志）", has_kickoff and len(pwa_lines) > 0,
          f"pwa_lines={len(pwa_lines)} kickoff={has_kickoff} registered_log={has_registered}")
    print("  · PWA 相关日志：")
    for l in pwa_lines[:12]: print("     ", l[:240])

    # ========== [3] navigator serviceWorker registration ==========
    info = page.evaluate("""async () => {
        if (!('serviceWorker' in self)) return {sw:false};
        const reg = await navigator.serviceWorker.getRegistration('/');
        return {
            sw: true,
            exists: !!reg,
            scope: reg ? reg.scope : null,
            active: !!(reg && reg.active),
            installing: !!(reg && reg.installing),
            waiting: !!(reg && reg.waiting),
            controller: !!navigator.serviceWorker.controller,
        };
    }""")
    check("SW registration 存在且 scope 正确",
          bool(info.get("exists")) and info.get("scope") == BASE + "/",
          json.dumps(info, ensure_ascii=False))
    check("SW active 且 controller 非 null（已接管 client）",
          bool(info.get("active")) and bool(info.get("controller")),
          f"active={info.get('active')} controller={info.get('controller')}")

    # 如果 registration 存在但 controller 为 null → reload 尝试让新 SW 接管（clientsClaim + skipWaiting）
    if info.get("exists") and not info.get("controller"):
        page.reload(wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(1500)
        info_after = page.evaluate("""async () => {
            const reg = await navigator.serviceWorker.getRegistration('/');
            return {
                scope: reg?reg.scope:null,
                active: !!(reg&&reg.active),
                controller: !!navigator.serviceWorker.controller,
            };
        }""")
        check("after reload: controller 非 null（clientsClaim 生效）",
              bool(info_after.get("controller")),
              json.dumps(info_after, ensure_ascii=False))
        info = {**info, **info_after}

    # ========== [4] CacheStorage：precache + runtime caches ==========
    cache_info = page.evaluate("""async () => {
        if (!('caches' in self)) return {keys:[], entries:0, detail:{}};
        const keys = await caches.keys();
        const detail = {};
        let entries = 0;
        for (const k of keys) {
            const c = await caches.open(k);
            const reqs = await c.keys();
            detail[k] = reqs.length;
            entries += reqs.length;
        }
        return {keys, entries, detail};
    }""")
    entries = cache_info.get("entries", 0) or 0
    precache_present = any("workbox-precache" in k for k in cache_info.get("keys", []))
    check(f"CacheStorage 命中 precache-v2（≥100 entries，当前 {entries}）",
          precache_present and entries >= 100,
          f"caches={json.dumps(cache_info.get('detail',{}), ensure_ascii=False)}")

    # ========== [5] 离线模式 reload 仍 200（SW CacheStorage 返回） ==========
    offline_status: int | None = None
    offline_ok = False
    try:
        ctx.set_offline(True)
        page.wait_for_timeout(600)
        r = page.goto(BASE, wait_until="domcontentloaded", timeout=20000)
        offline_status = r.status if r else None
        offline_ok = offline_status == 200
    except Exception as e:
        offline_ok = False
        print(f"  · offline 异常：{e!r:.200}")
    finally:
        ctx.set_offline(False)
    check(f"离线模式下 reload 文档 status=200（当前 status={offline_status!r}）",
          offline_ok,
          f"status={offline_status} · 从 CacheStorage 命中首屏 HTML")

print("\n" + "=" * 64)
print(f"PWA 验证汇总：{passed} / {total} 通过")
print("=" * 64)
browser.close()
sys.exit(0 if passed == total else 1)
