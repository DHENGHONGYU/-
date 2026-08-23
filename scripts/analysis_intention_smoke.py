"""UI smoke test: 分析舱 intent 作用域 (输入舱 -> 分析舱 交接)."""
from playwright.sync_api import sync_playwright
import os
import shutil

BASE = "http://localhost:5199"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get("PLAYWRIGHT_CHROME", shutil.which("chrome")),
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error",) else None)
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

        page.goto(f"{BASE}/#/analysis?scope=intention", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(6000)  # allow lazy modules + indexdb init
        page.wait_for_load_state("networkidle", timeout=30000)

        title = page.title()
        body_text = page.evaluate("document.body.innerText")
        url = page.url

        # 截图
        page.screenshot(path="/tmp/analysis-intention.png", full_page=True)

        print("=== URL ===")
        print(url)
        print("=== TITLE ===")
        print(title)
        print("=== V6 评分卡片关键元素 ===")
        checks = [
            "分析舱 · V6 九维评分",
            "加载全部标的",
            "加载意向候选池",
            "意向候选池",  # scope badge
            "全量标的",
            "批量评分",
            "运行评分",
            "暂无标的",
            "暂无意向候选",
        ]
        for c in checks:
            print(f"  {c!r}: {'FOUND' if c in body_text else 'missing'}")
        print("=== 页面文本片段(前1200字符) ===")
        print(body_text[:1200].replace("\n", " | "))
        print("=== CONSOLE ERRORS ===")
        if errors:
            for e in errors:
                print("  " + e)
        else:
            print("  (无控制台错误)")
        browser.close()

if __name__ == "__main__":
    main()
