"""
详细调试：查看东财各端点的完整响应结构
"""
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:5173', timeout=15000)
        page.wait_for_load_state('networkidle')

        # ── 1. 分红配股：查看完整响应结构 ──
        print("=" * 70)
        print("1. 分红配股 (BonusFinancing) 完整响应")
        print("=" * 70)
        result = page.evaluate("""
            async () => {
                const url = '/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519';
                const resp = await fetch(url);
                const text = await resp.text();
                return text.substring(0, 3000);
            }
        """)
        try:
            data = json.loads(result)
            print(f"  顶层 keys: {list(data.keys())}")
            for k in data.keys():
                val = data[k]
                if isinstance(val, list):
                    print(f"  {k}: list[{len(val)}]")
                    if len(val) > 0:
                        item = val[0]
                        print(f"    首条 keys: {list(item.keys())[:15]}")
                        print(f"    首条: {json.dumps(item, ensure_ascii=False)[:500]}")
                elif isinstance(val, dict):
                    print(f"  {k}: dict keys={list(val.keys())[:10]}")
                else:
                    print(f"  {k}: {type(val).__name__} = {str(val)[:100]}")
        except json.JSONDecodeError:
            print(f"  非JSON: {result[:500]}")

        # ── 2. 股本结构：尝试不同 URL ──
        print("\n" + "=" * 70)
        print("2. 股本结构 (CapitalStructure) 尝试不同 URL")
        print("=" * 70)
        
        urls_to_try = [
            '/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=SH600519',
            '/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=600519.SH',
            '/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=600519',
        ]
        for url in urls_to_try:
            result = page.evaluate(f"""
                async () => {{
                    const url = '{url}';
                    const resp = await fetch(url);
                    const text = await resp.text();
                    return {{ status: resp.status, ct: resp.headers.get('content-type') || '', preview: text.substring(0, 200) }};
                }}
            """)
            is_html = 'html' in result['ct'] or result['preview'].strip().startswith('<!')
            print(f"  {url}")
            print(f"    status={result['status']} ct={result['ct']} is_html={is_html}")
            print(f"    preview: {result['preview'][:150]}")

        # ── 3. 一致预期：尝试更多 reportName ──
        print("\n" + "=" * 70)
        print("3. 一致预期: 搜索可用 reportName")
        print("=" * 70)
        search_terms = ['INVEST', 'CONSENSUS', 'FORECAST', 'ESTIMATE', 'PROFIT', 'EARNING', 'YJFX', 'YLYC']
        for term in search_terms:
            result = page.evaluate(f"""
                async () => {{
                    const base = '/api/proxy/em-dc/securities/api/data/v1/get';
                    const params = new URLSearchParams({{
                        reportName: 'RPT_DMSK_FN_{term}',
                        columns: 'SECURITY_CODE',
                        filter: '(SECURITY_CODE="600519")',
                        pageNumber: '1',
                        pageSize: '1',
                        source: 'WEB',
                        client: 'WEB',
                    }});
                    const resp = await fetch(base + '?' + params.toString());
                    const text = await resp.text();
                    try {{
                        const d = JSON.parse(text);
                        return {{ term: '{term}', ok: d.success || false, msg: d.message || '', hasData: !!(d.result && d.result.data && d.result.data.length > 0) }};
                    }} catch(e) {{
                        return {{ term: '{term}', ok: false, msg: text.substring(0, 60) }};
                    }}
                }}
            """)
            if result['ok'] or result['hasData']:
                print(f"  ✓ RPT_DMSK_FN_{term}: OK hasData={result['hasData']} msg={result['msg']}")
            elif '报表配置不存在' not in result.get('msg', ''):
                print(f"  ? RPT_DMSK_FN_{term}: {result['msg'][:80]}")

        # ── 4. 评级汇总：尝试更多 reportName ──
        print("\n" + "=" * 70)
        print("4. 评级汇总: 搜索可用 reportName")
        print("=" * 70)
        search_terms = ['RATING', 'MAINRATING', 'PJ', 'PF', 'RATE', 'GRADE', 'SCORE', 'RECOMMEND']
        for term in search_terms:
            result = page.evaluate(f"""
                async () => {{
                    const base = '/api/proxy/em-dc/securities/api/data/v1/get';
                    const params = new URLSearchParams({{
                        reportName: 'RPT_DMSK_FN_{term}',
                        columns: 'SECURITY_CODE',
                        filter: '(SECURITY_CODE="600519")',
                        pageNumber: '1',
                        pageSize: '1',
                        source: 'WEB',
                        client: 'WEB',
                    }});
                    const resp = await fetch(base + '?' + params.toString());
                    const text = await resp.text();
                    try {{
                        const d = JSON.parse(text);
                        return {{ term: '{term}', ok: d.success || false, msg: d.message || '', hasData: !!(d.result && d.result.data && d.result.data.length > 0) }};
                    }} catch(e) {{
                        return {{ term: '{term}', ok: false, msg: text.substring(0, 60) }};
                    }}
                }}
            """)
            if result['ok'] or result['hasData']:
                print(f"  ✓ RPT_DMSK_FN_{term}: OK hasData={result['hasData']} msg={result['msg']}")
            elif '报表配置不存在' not in result.get('msg', ''):
                print(f"  ? RPT_DMSK_FN_{term}: {result['msg'][:80]}")

        browser.close()

if __name__ == '__main__':
    main()