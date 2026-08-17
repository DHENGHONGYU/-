"""Debug: check what Vite serves for multiSourceFetcher module."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    print("Fetching module source from Vite...")
    # Fetch the raw module to see what Vite is serving
    result = page.evaluate("""
        async () => {
            const resp = await fetch('/src/services/data-collector/multiSourceFetcher.ts');
            const text = await resp.text();
            // Check if the functions are in the served code
            const hasDividend = text.includes('fetchDividendShareData');
            const hasConsensus = text.includes('fetchConsensusAndRating');
            const hasExportDividend = text.includes('export async function fetchDividendShareData');
            const hasExportConsensus = text.includes('export async function fetchConsensusAndRating');
            // Find the last 500 chars
            const tail = text.slice(-500);
            return { 
                hasDividend, 
                hasConsensus, 
                hasExportDividend, 
                hasExportConsensus,
                totalLength: text.length,
                tail: tail
            };
        }
    """)
    
    print(f"  Total length: {result.get('totalLength')}")
    print(f"  Has 'fetchDividendShareData': {result.get('hasDividend')}")
    print(f"  Has 'fetchConsensusAndRating': {result.get('hasConsensus')}")
    print(f"  Has 'export async function fetchDividendShareData': {result.get('hasExportDividend')}")
    print(f"  Has 'export async function fetchConsensusAndRating': {result.get('hasExportConsensus')}")
    print(f"  Tail (last 500 chars):")
    print(f"    {result.get('tail', '')}")
    
    # Also try to access the module differently
    print("\n=== Trying namespace import ===")
    ns = page.evaluate("""
        async () => {
            const ns = await import('/src/services/data-collector/multiSourceFetcher.ts');
            const allKeys = [];
            for (const key in ns) {
                allKeys.push(key);
            }
            // Also check Symbol properties
            const symKeys = Object.getOwnPropertySymbols(ns).map(s => s.toString());
            // Check prototype
            const protoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(ns));
            return { allKeys, symKeys, protoKeys };
        }
    """)
    print(f"  All enumerable keys: {ns.get('allKeys')}")
    print(f"  Symbol keys: {ns.get('symKeys')}")
    print(f"  Prototype keys: {ns.get('protoKeys')}")
    
    browser.close()
    print("\nDone.")