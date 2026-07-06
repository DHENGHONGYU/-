from playwright.sync_api import sync_playwright

exe = r"C:\Users\huawei\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=exe)
    page = b.new_page()
    console_errors = []
    page.on("console", lambda m: console_errors.append(f"[{m.type}] {m.text[:300]}") if m.type in ("error", "warning") else None)

    # 先访问根路径
    page.goto("http://localhost:3001/")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # 然后导航到 hash 路由
    page.goto("http://localhost:3001/#/command/agents")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    print("URL:", page.url)
    print("TITLE:", page.title())
    body = page.inner_text("body")
    print("BODY first 1000:")
    print(body[:1000])
    print()
    print("Console errors/warnings:", len(console_errors))
    for e in console_errors[:5]:
        print(" ", e)

    page.screenshot(path="docs/implementation/phase-b-screenshots/_hub_via_hash.png", full_page=True)
    b.close()
