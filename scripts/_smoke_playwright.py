from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:3001/")
    page.wait_for_load_state("networkidle", timeout=15000)
    print("TITLE:", page.title())
    print("URL:", page.url)
    print("BODY:", page.inner_text("body")[:300].replace("\n", " "))
    page.screenshot(path="docs/implementation/phase-b-screenshots/_smoke.png", full_page=True)
    browser.close()
    print("OK")
