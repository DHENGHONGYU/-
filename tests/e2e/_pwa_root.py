"""PWA 根因诊断：全量 console + pageerror + SW 事件监听"""
import os, json, sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8080/"
ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "pwa-root")
os.makedirs(ART, exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
            service_workers="allow",
        )
        page = ctx.new_page()

        all_logs = []
        page.on("console", lambda m: all_logs.append(("console", m.type, m.text)))
        page.on("pageerror", lambda e: all_logs.append(("pageerror", str(e))))
        page.on("crash", lambda _: all_logs.append(("CRASH",)))
        page.on("close", lambda _: all_logs.append(("CLOSE",)))

        # 打开页面并等待 15 秒
        try:
            page.goto(URL, wait_until="load", timeout=60000)
        except Exception as e:
            print(f"goto ERROR: {e}")

        page.wait_for_timeout(15000)

        # 状态评估
        state = page.evaluate("""async () => {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                function to(w){ return w ? { state: w.state, scriptURL: w.scriptURL } : null; }
                let ready;
                try { ready = await navigator.serviceWorker.ready; } catch(e){ ready = 'ERROR: '+String(e); }
                const cachesInfo = {};
                try {
                    for (const n of await caches.keys()) {
                        const c = await caches.open(n);
                        cachesInfo[n] = (await c.keys()).length;
                    }
                } catch(e){ cachesInfo.__error = String(e); }
                return {
                    regCount: regs.length,
                    registrations: regs.map(r => ({
                        scope: r.scope,
                        installing: to(r.installing),
                        waiting: to(r.waiting),
                        active: to(r.active),
                    })),
                    ready: typeof ready === 'string' ? ready :
                        ready && typeof ready === 'object' && 'scope' in ready ? {
                            scope: ready.scope,
                            installing: to(ready.installing), waiting: to(ready.waiting),
                            active: to(ready.active),
                        } : String(ready),
                    controller: navigator.serviceWorker.controller ? {
                        scriptURL: navigator.serviceWorker.controller.scriptURL,
                        state: navigator.serviceWorker.controller.state,
                    } : null,
                    caches: cachesInfo,
                    globalErrors: typeof window.__pwa_errors !== 'undefined' ? window.__pwa_errors : null,
                };
            } catch (e) {
                return { evaluateError: String(e)+'\\n'+(e&&e.stack||'') };
            }
        }""")

        print("=== [1] ALL LOGS (console + pageerror) ===")
        for row in all_logs:
            if row[0] == "console":
                if row[1] in ("error", "warning") or ("pwa" in row[2] or "register" in row[2] or "SW" in row[2] or "schedule" in row[2] or "logger" in row[2] or "main" in row[2] or "scheduleRegisterPwaSW" in row[2] or "bootstrap" in row[2]):
                    print(f"  [{row[1]:7s}] {row[2][:400]}")
                elif row[1] == "error":
                    print(f"  [ERROR  ] {row[2][:400]}")
            else:
                print(f"  >> {row[0]} :: {row[1][:600] if len(row)>1 else ''}")

        print("\n=== [2] 最终 SW 状态 ===")
        print(json.dumps(state, ensure_ascii=False, indent=2))

        page.screenshot(path=os.path.join(ART, "root.png"), full_page=True)
        with open(os.path.join(ART, "all_logs.json"), "w", encoding="utf-8") as f:
            json.dump(all_logs, f, ensure_ascii=False, indent=2)
        with open(os.path.join(ART, "state.json"), "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        print(f"\n输出目录: {ART}")

        try:
            browser.close()
        except Exception:
            pass

        reg_count = state.get("regCount", 0)
        controller_ok = state.get("controller") is not None
        precache_n = sum(v for k,v in state.get("caches", {}).items() if k.startswith("workbox-precache") and isinstance(v,int))
        print(f"\n判定：registrations={reg_count}, controller={controller_ok}, precache_total={precache_n}")
        if reg_count > 0 and controller_ok and precache_n >= 200:
            print("✅ PWA 通过")
            sys.exit(0)
        else:
            print("❌ PWA 未通过")
            sys.exit(1)

if __name__ == "__main__":
    main()
