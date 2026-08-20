"""PWA 诊断脚本：sw.js 是否可下载？HTTP 状态？页面加载过程中实际请求？"""
import os, json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8080/"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(SCRIPT_DIR, "artifacts", "pwa-diag")
os.makedirs(ART, exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width":1440,"height":900}, ignore_https_errors=True,
                                  service_workers="allow")
        page = ctx.new_page()
        logs = []
        page.on("console", lambda m: logs.append(("CONSOLE", m.type, m.text)))
        page.on("pageerror", lambda e: logs.append(("PAGEERR", str(e))))
        reqs = []
        page.on("request", lambda r: reqs.append(("REQ", r.method, r.url)))
        page.on("response", lambda r: reqs.append(("RESP", r.status, r.url)))

        # 1. 先直接 fetch sw.js
        print("--- 直接 fetch /sw.js 响应 ---")
        resp_sw = page.request.get(URL + "sw.js")
        print(f"  HTTP {resp_sw.status}, length={len(resp_sw.body())}")
        content = resp_sw.text()
        pre_entries = content.count('url:"') + content.count("revision:null")
        print(f"  代码总长度={len(content)}, precache url 粗略计数 ≈ {pre_entries}")
        manifest_match = '__WB_MANIFEST' in content or 'self.__WB_MANIFEST' in content
        print(f"  含 __WB_MANIFEST 占位符 = {manifest_match}（应为 False：构建后 manifest 已展开）")
        head = content[:800]
        print(f"  开头 800 字符:\n{head}")

        # 2. 打开主页面 12 秒，观察请求日志
        print("\n--- 打开首页并等待 12 秒，观察 SW 注册请求链 ---")
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(12000)

        # 3. 最终状态
        state = page.evaluate("""async () => {
            const regs = await navigator.serviceWorker.getRegistrations();
            function to(o){ return o ? { state: o.state, scriptURL: o.scriptURL } : null; }
            let ready;
            try { ready = await navigator.serviceWorker.ready; } catch(e) { ready = String(e); }
            return {
                registrations: regs.map(r => ({
                    scope: r.scope, installing: to(r.installing),
                    waiting: to(r.waiting), active: to(r.active),
                })),
                ready: ready && typeof ready === 'object' && 'scope' in ready
                    ? { scope: ready.scope,
                        installing: to(ready.installing), waiting: to(ready.waiting),
                        active: to(ready.active) } : ready,
                controller: navigator.serviceWorker.controller
                    ? { scriptURL: navigator.serviceWorker.controller.scriptURL,
                        state: navigator.serviceWorker.controller.state } : null,
            };
        }""")
        print("\n--- 最终 SW 状态 ---")
        print(json.dumps(state, ensure_ascii=False, indent=2))

        # 4. 筛选日志
        print("\n--- 关键日志（console / pageerror） ---")
        for t, a, b in logs:
            if t == "CONSOLE" and ("[pwa]" in b or "[main]" in b or "SW" in b or "service" in b.lower() or "register" in b.lower() or "error" in a.lower()):
                print(f"  [{a}] {b[:300]}")
            elif t == "PAGEERR":
                print(f"  PAGEERR: {b[:500]}")
        # 找 sw.js 请求
        print("\n--- /sw.js & /manifest.json HTTP 记录 ---")
        for t, s_or_method, u in reqs:
            if "/sw.js" in u or "manifest" in u or "workbox-" in u:
                mark = "[OK]" if (t == "RESP" and isinstance(s_or_method, int) and 200 <= s_or_method < 300) else (
                    "[!!]" if t == "RESP" else "----")
                print(f"  {mark} {t} {s_or_method}  {u}")

        # 截图
        page.screenshot(path=os.path.join(ART, "diag.png"), full_page=True)
        browser.close()

if __name__ == "__main__":
    main()
