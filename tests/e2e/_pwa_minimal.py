"""PWA 验证极简版：全新 chromium user-dir，避免任何脏缓存/console 监听副作用"""
import asyncio
import os
import shutil
import tempfile
from playwright.sync_api import sync_playwright, expect

PREVIEW_URL = "http://127.0.0.1:8080/"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACT_DIR = os.path.join(SCRIPT_DIR, "artifacts", "pwa-clean")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def main():
    with sync_playwright() as p:
        tmp_user = tempfile.mkdtemp(prefix="pwa_chromium_")
        try:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=tmp_user,
                headless=True,
                viewport={"width": 1440, "height": 900},
                ignore_https_errors=True,
                # 避免 requestIdleCallback 被节流：启用 idle 调度
                args=[
                    "--enable-features=IdleDetection,ServiceWorkerImportedScriptsCaching",
                    "--disable-background-timer-throttling",
                ],
            )
            page = browser.new_page()
            # Step 1: 打开页面 + 等待 SW 注册
            page.goto(PREVIEW_URL, wait_until="load", timeout=60000)
            page.wait_for_timeout(500)  # 首屏挂载
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
            # scheduleRegisterPwaSW 使用 requestIdleCallback / setTimeout(500) / queueMicrotask
            page.wait_for_timeout(7000)  # 稳等 SW 注册 + install + activate 完整链路

            # 抓当前状态
            state = page.evaluate("""async () => {
                const regs = await navigator.serviceWorker.getRegistrations();
                const reg = regs[0] || null;
                function sr(s) { return s ? s.state : null; }
                let cacheInfo = {};
                try {
                    const names = await caches.keys();
                    for (const n of names) {
                        const c = await caches.open(n);
                        const keys = await c.keys();
                        cacheInfo[n] = keys.length;
                    }
                } catch (e) { cacheInfo['error'] = String(e); }
                const controller = navigator.serviceWorker.controller
                    ? { scriptURL: navigator.serviceWorker.controller.scriptURL,
                        state: navigator.serviceWorker.controller.state } : null;
                return {
                    registrations: regs.map(r => ({
                        scope: r.scope,
                        installing: sr(r.installing),
                        waiting: sr(r.waiting),
                        active: sr(r.active),
                    })),
                    controller,
                    cacheInfo,
                };
            }""")
            print("=== SW 状态（首次加载安装后）===")
            import json
            print(json.dumps(state, ensure_ascii=False, indent=2))

            # Step 2: 离线访问
            browser.set_offline(True)
            page.wait_for_timeout(500)
            offline_page = browser.new_page()
            ok = True
            try:
                offline_page.goto(PREVIEW_URL, wait_until="load", timeout=30000)
                title = offline_page.title()
                body_text = offline_page.locator("body").inner_text(timeout=15000)
                offline_hit = "Chrome 目前无法访问" not in body_text and \
                              "无法访问此网站" not in body_text and \
                              "ERR_INTERNET_DISCONNECTED" not in body_text
                print(f"\n=== 离线访问 ===")
                print(f"  URL loaded: OK, title={title}")
                print(f"  页面命中（非浏览器离线错误页）={offline_hit}")
                offline_screenshot = os.path.join(ARTIFACT_DIR, "offline.png")
                offline_page.screenshot(path=offline_screenshot, full_page=True)
                print(f"  离线页面截图: {offline_screenshot}")
                if not offline_hit:
                    ok = False
                    offline_html = os.path.join(ARTIFACT_DIR, "offline.html")
                    with open(offline_html, "w", encoding="utf-8") as f:
                        f.write(offline_page.content())
                    print(f"  ⚠ 离线失败，HTML 已保存: {offline_html}")
            except Exception as e:
                ok = False
                print(f"  ⚠ 离线加载抛错: {e}")

            # Step 3: 命中 precache-v2 >= 200
            precache_count = 0
            for k, v in state.get("cacheInfo", {}).items():
                if k.startswith("precache-v2") and isinstance(v, int):
                    precache_count = v
            print(f"\n=== 缓存汇总 ===")
            print(f"  precache-v2 条目数 = {precache_count}（目标 >= 220）")
            print(f"  controller = {state.get('controller') is not None}")
            print(f"  active SW 数量 = {sum(1 for r in state.get('registrations', []) if r.get('active'))}")

            screenshot = os.path.join(ARTIFACT_DIR, "home.png")
            page.screenshot(path=screenshot, full_page=True)
            print(f"\n截图: {screenshot}")

            try:
                browser.close()
            except:
                pass
            # 结果判定
            if precache_count >= 220 and state.get("controller") is not None and ok:
                print("\n✅ PWA 验证通过：SW controller 生效 + precache 完整 + 离线访问正常")
                exit(0)
            else:
                print(f"\n❌ PWA 验证未通过：precache={precache_count} (>=220?), controller={state.get('controller')}, offline={ok}")
                exit(1)
        finally:
            try:
                shutil.rmtree(tmp_user, ignore_errors=True)
            except:
                pass

if __name__ == "__main__":
    main()
