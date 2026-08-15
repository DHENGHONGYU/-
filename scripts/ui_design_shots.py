"""截图基线/对比脚本：对六个舱室 + 首页各截一张图，用于设计应用前后对比."""
import os, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"
# 动态解析 Playwright Chromium 路径（避免硬编码用户绝对路径，支持跨机器移植）
_EXE_DEFAULT = r"ms-playwright\chromium-1228\chrome-win64\chrome.exe"
EXE = os.path.join(
    os.environ.get("LOCALAPPDATA", r"C:\Users"),
    _EXE_DEFAULT,
)
if not os.path.exists(EXE):
    # 兜底：让 Playwright 自行查找已安装浏览器
    EXE = None
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "outputs", "ui-design"))
TAG = sys.argv[1] if len(sys.argv) > 1 else "before"
FILTER = set(sys.argv[2:])  # 可选：仅截图指定的路由名（如 cockpit input）

ROUTES = {
    "home": "/#/",
    "cockpit": "/#/cockpit",
    "input": "/#/input",
    "input-hot": "/#/input/hot-sectors",
    "analysis": "/#/analysis",
    "trading": "/#/trading",
    "output": "/#/output",
    "command": "/#/command",
}
os.makedirs(ROOT, exist_ok=True)

with sync_playwright() as p:
    profile = os.path.join(ROOT, f"profile-{TAG}")
    os.makedirs(profile, exist_ok=True)
    browser = p.chromium.launch(
        headless=True,
        executable_path=EXE,
        args=[
            "--no-sandbox",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-features=RendererCodeIntegrity",
            "--disable-extensions",
            "--disable-component-update",
            "--no-first-run",
            "--disable-features=OptimizationHints,MediaRouter",
        ],
    )
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = ctx.new_page()
    page.set_default_timeout(20000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    for name, path in ROUTES.items():
        if FILTER and name not in FILTER:
            continue
        shot = os.path.join(ROOT, f"{TAG}-{name}.png")
        try:
            page.goto(BASE + path, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"  FAIL goto {name}: {e}")
            errors.append(str(e))
            continue
        page.wait_for_timeout(3000)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass
        try:
            page.screenshot(path=shot, full_page=False, timeout=15000)
            print(f"  saved {shot}")
        except Exception as e:
            print(f"  FAIL {name}: {e}")
    browser.close()

print("done. errors:", len(errors))
if errors:
    for e in errors[:10]:
        print("  ", e)
