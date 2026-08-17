"""
快速验证 Playwright 脚本 - 用更长的超时
"""
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("导航到 Vite 服务器...")
        try:
            page.goto('http://localhost:5173', timeout=60000, wait_until='domcontentloaded')
            print("OK - 页面加载\n")
        except Exception as e:
            print(f"导航失败: {e}")
            browser.close()
            return

        # Test 1: BonusFinancing
        print("=== Test 1: 分红配股 ===")
        try:
            result = page.evaluate("""
                async () => {
                    const resp = await fetch('/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519');
                    const text = await resp.text();
                    try {
                        const data = JSON.parse(text);
                        const records = data.fhyx || data.data || [];
                        return { ok: true, count: records.length, first: records[0] || null };
                    } catch(e) {
                        return { ok: false, error: 'JSON parse error', preview: text.substring(0, 200) };
                    }
                }
            """)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:
            print(f"  失败: {e}")

        # Test 2: push2
        print("\n=== Test 2: 股本结构 (push2) ===")
        try:
            result = page.evaluate("""
                async () => {
                    const resp = await fetch('/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39');
                    const text = await resp.text();
                    try {
                        const data = JSON.parse(text);
                        return { ok: true, data: data.data || data };
                    } catch(e) {
                        return { ok: false, error: 'JSON parse error', preview: text.substring(0, 200) };
                    }
                }
            """)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:
            print(f"  失败: {e}")

        # Test 3: Consensus (datacenter-web)
        print("\n=== Test 3: 一致预期 (datacenter-web) ===")
        consensus_ok = False
        for rn in ['RPT_DMSK_FN_INVESTSUMM_STAT', 'RPT_DMSK_FN_FORECAST', 'RPT_DMSK_FN_CONSENSUS', 'RPT_DMSK_FN_PROFITFORECAST', 'RPT_DMSK_FN_EARNINGSFORECAST']:
            try:
                result = page.evaluate(f"""
                    async () => {{
                        const base = '/api/proxy/em-datacenter/api/data/v1/get';
                        const params = new URLSearchParams({{
                            reportName: '{rn}',
                            columns: 'SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT',
                            filter: '(SECURITY_CODE="600519")',
                            pageNumber: '1', pageSize: '3',
                            sortTypes: '-1', sortColumns: 'FORECAST_YEAR',
                            source: 'WEB', client: 'WEB',
                        }});
                        const resp = await fetch(base + '?' + params.toString());
                        const text = await resp.text();
                        try {{
                            const d = JSON.parse(text);
                            return {{ rn: '{rn}', success: d.success || false, msg: d.message || '', count: (d.result && d.result.data) ? d.result.data.length : 0 }};
                        }} catch(e) {{
                            return {{ rn: '{rn}', success: false, msg: text.substring(0, 80) }};
                        }}
                    }}
                """)
                if result['success'] and result['count'] > 0:
                    print(f"  ✓ {rn}: {result['count']} 条")
                    consensus_ok = True
                elif result['success']:
                    print(f"  ~ {rn}: OK but empty")
                elif '报表配置不存在' not in result.get('msg', ''):
                    print(f"  ? {rn}: {result['msg'][:80]}")
            except Exception as e:
                print(f"  ✗ {rn}: {e}")
        if not consensus_ok:
            print("  → 所有 reportName 均失败")

        # Test 4: Rating (datacenter-web)
        print("\n=== Test 4: 评级汇总 (datacenter-web) ===")
        rating_ok = False
        for rn in ['RPT_DMSK_FN_MAINRATING', 'RPT_DMSK_FN_RATING']:
            try:
                result = page.evaluate(f"""
                    async () => {{
                        const base = '/api/proxy/em-datacenter/api/data/v1/get';
                        const params = new URLSearchParams({{
                            reportName: '{rn}',
                            columns: 'SECURITY_CODE,RATING_BUY,RATING_OVERWEIGHT,RATING_HOLD,RATING_UNDERWEIGHT,RATING_SELL,CONSENSUS_RATING,CONSENSUS_TARGET_PRICE',
                            filter: '(SECURITY_CODE="600519")',
                            pageNumber: '1', pageSize: '1',
                            source: 'WEB', client: 'WEB',
                        }});
                        const resp = await fetch(base + '?' + params.toString());
                        const text = await resp.text();
                        try {{
                            const d = JSON.parse(text);
                            return {{ rn: '{rn}', success: d.success || false, msg: d.message || '', count: (d.result && d.result.data) ? d.result.data.length : 0 }};
                        }} catch(e) {{
                            return {{ rn: '{rn}', success: false, msg: text.substring(0, 80) }};
                        }}
                    }}
                """)
                if result['success'] and result['count'] > 0:
                    print(f"  ✓ {rn}: {result['count']} 条")
                    rating_ok = True
                elif result['success']:
                    print(f"  ~ {rn}: OK but empty")
                elif '报表配置不存在' not in result.get('msg', ''):
                    print(f"  ? {rn}: {result['msg'][:80]}")
            except Exception as e:
                print(f"  ✗ {rn}: {e}")
        if not rating_ok:
            print("  → 所有 reportName 均失败")

        browser.close()
        print("\n完成！")

if __name__ == '__main__':
    main()