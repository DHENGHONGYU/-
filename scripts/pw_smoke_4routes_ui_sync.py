"""UI一致化批次 · 4路由烟雾测试 V3 (静态 dist / vite preview 端口 4173)"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r'd:\FinSightV9')
OUT = ROOT / 'outputs' / 'ui-design'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:4173'
SELECTORS = {
    'home':        ['h1:has-text("智能投研复盘系统 V9")', '[role="main"]', 'main', 'nav[aria-label]'],
    'trading':     ['h1,h2,[role="heading"]', 'main', 'section', '.card'],
    'command-hub': ['h1,h2', 'main', 'a[href^="/command/config"]'],
    'config':      ['h1:has-text("配置管理")', 'main', 'button'],
}
ROUTES = [('/', 'home'), ('/trading', 'trading'), ('/command', 'command-hub'), ('/command/config', 'config')]
errors: list[str] = []
console: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='zh-CN')
    page = ctx.new_page()

    def on_console(msg):
        if msg.type == 'error':
            console.append(f'[{key}] {msg.text}')

    page.on('console', on_console)

    for url, key in ROUTES:
        try:
            page.goto(BASE + url, wait_until='load', timeout=30000)
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f'smoke-{key}.png'), full_page=True)
            hit = False
            for s in SELECTORS[key]:
                try:
                    loc = page.locator(s).first
                    if loc.count() > 0 and loc.is_visible(timeout=1200):
                        hit = True; break
                except Exception:
                    continue
            ok = hit
            print(f'[V3 preview] {key:12s} → {url:20s} screenshot=YES  hit_selector={"1" if ok else "0"}  console_err={sum(1 for x in console if x.startswith(f"[{key}]")):2d}')
            if not ok:
                errors.append(f'{key}: 关键 selector 未命中: {SELECTORS[key]}')
        except Exception as e:
            errors.append(f'{key}: 导航失败: {type(e).__name__}: {e!s}')
    ctx.close()
    browser.close()

if console:
    (OUT / 'smoke-console-errors.log').write_text('\n'.join(console), encoding='utf-8')
if errors:
    sys.stderr.write('\n❌ O4 FAIL V3 preview:\n  - ' + '\n  - '.join(errors) + '\n')
    sys.exit(1)
print('\n✅ 4 路由烟雾 V3 (preview dist) 全通过 = 4/4 导航成功 + 关键selector命中 + 截图落盘')
sys.exit(0)
