"""最小连通性测试"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # 测试外部网站
    try:
        page.goto("https://example.com", timeout=10000)
        print(f"✅ 外部网站连通: {page.title()}")
    except Exception as e:
        print(f"❌ 外部网站失败: {e}")

    # 测试本地
    try:
        page.goto("http://127.0.0.1:5173/", timeout=10000, wait_until="domcontentloaded")
        print(f"✅ 本地连通: {page.title()}")
    except Exception as e:
        print(f"❌ 本地失败: {e}")

    browser.close()