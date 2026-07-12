from playwright.sync_api import sync_playwright

exe = r"C:\Users\huawei\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=exe)
    page = b.new_page()
    console_logs = []
    page.on("console", lambda m: console_logs.append(f"[{m.type}] {m.text[:200]}"))

    page.goto("http://localhost:3001/")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    print("URL:", page.url)
    print("TITLE:", page.title())
    html = page.content()
    print("HTML length:", len(html))
    print("--- first 1500 chars ---")
    print(html[:1500])
    print()
    print("--- body text first 800 ---")
    print(page.inner_text("body")[:800])
    print()
    print("--- console logs ---")
    for l in console_logs:
        print(" ", l)
    b.close()
