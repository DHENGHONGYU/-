"""
快速测试：用 datacenter-web API 搜索一致预期和评级的正确 reportName
"""
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:5173', timeout=15000)
        page.wait_for_load_state('networkidle')

        # ── 测试 datacenter-web API（已有代理 /api/proxy/em-datacenter）──
        print("=" * 70)
        print("测试 datacenter-web API 一致预期/评级 reportName")
        print("=" * 70)
        
        # 尝试多种 reportName 模式
        patterns = [
            # 盈利预测
            'RPT_DMSK_FN_INVESTSUMM_STAT',
            'RPT_DMSK_FN_INVESTSUMM',
            'RPT_DMSK_FN_PROFITFORECAST',
            'RPT_DMSK_FN_PROFIT',
            'RPT_DMSK_FN_EARNINGSFORECAST',
            'RPT_DMSK_FN_EPSFORECAST',
            # 评级
            'RPT_DMSK_FN_MAINRATING',
            'RPT_DMSK_FN_RATING',
            'RPT_DMSK_FN_STOCKRATING',
            # 预测汇总
            'RPT_DMSK_FN_FORECAST',
            'RPT_DMSK_FN_ESTIMATE',
            'RPT_DMSK_FN_CONSENSUS',
            # 其他可能
            'RPT_DMSK_FN_YJFX',  # 业绩分析
            'RPT_DMSK_FN_YLYC',  # 盈利预测
            'RPT_F10_FINANCE_PROFITFORECAST',
            'RPT_F10_FINANCE_INVESTSUMM',
            'RPT_F10_FINANCE_MAINRATING',
        ]
        
        working = []
        for rn in patterns:
            result = page.evaluate(f"""
                async () => {{
                    const base = '/api/proxy/em-datacenter/api/data/v1/get';
                    const params = new URLSearchParams({{
                        reportName: '{rn}',
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
                        return {{ rn: '{rn}', success: d.success || false, msg: d.message || '', count: (d.result && d.result.data) ? d.result.data.length : 0 }};
                    }} catch(e) {{
                        return {{ rn: '{rn}', success: false, msg: text.substring(0, 60) }};
                    }}
                }}
            """)
            if result['success'] and result['count'] > 0:
                print(f"  ✓ {rn}: OK, count={result['count']}")
                working.append(rn)
            elif result['success']:
                print(f"  ~ {rn}: OK but empty, count={result['count']}")
            elif '报表配置不存在' not in result.get('msg', ''):
                print(f"  ? {rn}: {result['msg'][:80]}")
        
        print(f"\n  可用的 reportName: {working if working else '无'}")

        # ── 也试试 datacenter.eastmoney.com 的 API ──
        print("\n" + "=" * 70)
        print("测试 datacenter.eastmoney.com API (em-dc 代理)")
        print("=" * 70)
        
        for rn in patterns:
            result = page.evaluate(f"""
                async () => {{
                    const base = '/api/proxy/em-dc/securities/api/data/v1/get';
                    const params = new URLSearchParams({{
                        reportName: '{rn}',
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
                        return {{ rn: '{rn}', success: d.success || false, msg: d.message || '', count: (d.result && d.result.data) ? d.result.data.length : 0 }};
                    }} catch(e) {{
                        return {{ rn: '{rn}', success: false, msg: text.substring(0, 60) }};
                    }}
                }}
            """)
            if result['success'] and result['count'] > 0:
                print(f"  ✓ {rn}: OK, count={result['count']}")
                working.append(rn)
            elif result['success']:
                print(f"  ~ {rn}: OK but empty, count={result['count']}")
            elif '报表配置不存在' not in result.get('msg', ''):
                print(f"  ? {rn}: {result['msg'][:80]}")

        browser.close()

if __name__ == '__main__':
    main()