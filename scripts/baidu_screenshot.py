"""百度首页截图脚本：Playwright 打开百度首页并保存截图."""
import os
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"d:\FinSightV9\outputs\screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-features=RendererCodeIntegrity",
            "--disable-extensions",
            "--disable-component-update",
            "--no-first-run",
        ],
    )
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto("https://www.baidu.com", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2000)
    shot = os.path.join(OUTPUT_DIR, "baidu-homepage.png")
    page.screenshot(path=shot, full_page=True)
    print(f"截图已保存: {shot}")
    browser.close()