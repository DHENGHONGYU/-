"""Debug: find correct CapitalStructure and consensus endpoints."""
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
    page = browser.new_page()
    page.goto(BASE_URL, timeout=10000, wait_until="commit")
    page.wait_for_timeout(1000)

    # Try different CapitalStructure URL variations
    print("=== CapitalStructure URL variations ===")
    urls = [
        '/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=SH600519',
        '/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=600519',
        '/api/proxy/em-f10/PC_HSF10/ShareStructure/PageAjax?code=SH600519',
        '/api/proxy/em-f10/PC_HSF10/EquityStructure/PageAjax?code=SH600519',
    ]
    for url in urls:
        r = page.evaluate(f"""
            async () => {{
                const resp = await fetch('{url}');
                const text = await resp.text();
                const isJson = text.trim().startsWith('{{');
                return {{ isJson, preview: text.substring(0, 120) }};
            }}
        """)
        if r.get('isJson'):
            print(f"  [OK] {url}: {r.get('preview')}")
        else:
            print(f"  [NO] {url}: {r.get('preview')[:80]}")

    # Try push2 via proxy for share structure
    print("\n=== Push2 API via proxy ===")
    # First, check if there's a push2 proxy
    r = page.evaluate("""
        async () => {
            const resp = await fetch('/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39,f40,f41,f57,f58');
            const text = await resp.text();
            return { status: resp.status, preview: text.substring(0, 300) };
        }
    """)
    print(f"  Push2 proxy: {r.get('preview')[:150]}")

    # Try direct push2 with different fields
    print("\n=== Push2 direct (different fields) ===")
    r2 = page.evaluate("""
        async () => {
            try {
                const resp = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f38,f39,f57,f58');
                const text = await resp.text();
                return { status: resp.status, ok: resp.ok, preview: text.substring(0, 300) };
            } catch(e) {
                return { error: e.message };
            }
        }
    """)
    print(f"  Push2 direct: {r2}")

    browser.close()
    print("\nDone.")