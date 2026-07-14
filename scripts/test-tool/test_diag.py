"""Playwright 连通性诊断 — 多种方式测试"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # 尝试不带沙箱启动
    browser = p.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    )
    page = browser.new_page()

    urls = [
        "http://localhost:5173/",
        "http://127.0.0.1:5173/",
        "http://192.168.3.10:5173/",
        "http://[::1]:5173/",
    ]

    for url in urls:
        try:
            page.goto(url, timeout=5000, wait_until="commit")
            print(f"✅ {url} -> {page.title()}")
        except Exception as e:
            print(f"❌ {url} -> {str(e)[:80]}")

    # 尝试用 evaluate 做 fetch
    try:
        result = page.evaluate("""
            async () => {
                try {
                    const r = await fetch('http://localhost:5173/');
                    return {ok: r.ok, status: r.status};
                } catch(e) {
                    return {error: e.message};
                }
            }
        """)
        print(f"📡 fetch localhost: {result}")
    except Exception as e:
        print(f"❌ fetch test: {e}")

    browser.close()