"""E2E 真实链路验证：输入舱(热门板块来源一) -> 意向候选池 -> 分析舱(scope=intention) 交接.

覆盖：
  S1 种子热门板块评分（seedRotationScores，真实 A 股标的）
  S2 抽取代表股 (15-20) -> 加入代表股（写入意向候选池，screenSource=hot-sector）
  S3 录入看板「意向候选池清单」展示候选（来源=热门板块）
  S4 「送入分析舱」按钮 -> /analysis?scope=intention 自动加载意向候选池
  S5 分析舱展示候选 + 来源溯源 + 已有 V6 评分（批量评分按钮出现）
"""
from playwright.sync_api import sync_playwright
import re
import os
import shutil

BASE = "http://localhost:5199"
EXE = os.environ.get("PLAYWRIGHT_CHROME", shutil.which("chrome") or "")
SHOT_DIR = r"d:\FinSightV9\outputs\e2e-analysis-input"
import os
os.makedirs(SHOT_DIR, exist_ok=True)

PASS, FAIL = [], []

def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name} {detail}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=EXE)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

        # ── S1: 种子热门板块评分（写入 rotation_scores） ──
        page.goto(f"{BASE}/#/input/hot-sectors", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3000)
        seed = page.evaluate(
            "() => import('/src/services/scoring/seedRotationScores.ts')"
            ".then(m => m.seedRotationScores()).then(r => r)"
        )
        print(f"[S1] seedRotationScores 结果: {seed}")
        check("S1 种子写入成功(inserted>0)", seed.get("inserted", 0) > 0, str(seed))

        # ── S2: 抽取代表股 -> 加入代表股 ──
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        page.wait_for_load_state("networkidle", timeout=30000)
        page.get_by_role("button", name="抽取代表股").click()
        page.wait_for_timeout(1500)
        body = page.evaluate("document.body.innerText")
        check("S2 代表股面板出现(筛选清单)", "代表股筛选清单" in body)

        add_btn = page.get_by_role("button", name=re.compile(r"加入代表股"))
        if add_btn.count() == 0:
            check("S2 加入代表股按钮存在", False, "未找到「加入代表股」按钮")
        else:
            label = add_btn.inner_text()
            add_btn.click()
            page.wait_for_timeout(2500)
            check("S2 点击加入代表股", True, f"按钮: {label}")
        page.screenshot(path=os.path.join(SHOT_DIR, "s2-hot-sector-add.png"), full_page=False)

        # ── S3: 录入看板意向候选池清单 ──
        page.goto(f"{BASE}/#/input", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        page.wait_for_load_state("networkidle", timeout=30000)
        body = page.evaluate("document.body.innerText")
        check("S3 意向候选池清单出现", "意向候选池清单" in body)
        # 解析已采/共 N 项
        m = re.search(r"(\d+)/(\d+) 已采", body)
        total = int(m.group(2)) if m else 0
        check("S3 候选池非空", total > 0, f"共 {total} 项" if m else "未匹配计数")
        check("S3 来源=热门板块标记", "热门板块" in body)
        page.screenshot(path=os.path.join(SHOT_DIR, "s3-pool-table.png"), full_page=False)

        # ── S4: 送入分析舱 ──
        link = page.get_by_role("link", name="送入分析舱")
        if link.count() == 0:
            check("S4 送入分析舱按钮存在", False)
        else:
            check("S4 送入分析舱按钮存在", True)
            with page.expect_navigation(wait_until="domcontentloaded", timeout=60000):
                link.click()
            page.wait_for_timeout(5000)
            page.wait_for_load_state("networkidle", timeout=30000)
            check("S4 URL 携带 scope=intention", "scope=intention" in page.url, page.url)
            check("S4 分析舱自动加载意向候选池(badge)", "意向候选池" in page.evaluate("document.body.innerText"))

        # ── S5: 分析舱候选 + 来源溯源 + V6 评分 + 批量评分 ──
        body = page.evaluate("document.body.innerText")
        check("S5 展示候选标的(symbol)", any(s in body for s in ["002230", "688981", "300750", "600276"]))
        check("S5 来源溯源=热门板块", "热门板块" in body)
        check("S5 批量评分按钮出现", "批量评分" in body)
        check("S5 运行评分按钮出现", "运行评分" in body)
        page.screenshot(path=os.path.join(SHOT_DIR, "s5-analysis-intention.png"), full_page=True)

        # ── 控制台错误 ──
        real_errors = [e for e in errors if "favicon" not in e.lower()]
        print("=== CONSOLE/PAGE ERRORS ===")
        if real_errors:
            for e in real_errors:
                print("  " + e)
        else:
            print("  (无)")

        browser.close()

    print("\n==== 汇总 ====")
    print(f"PASS: {len(PASS)} | FAIL: {len(FAIL)}")
    for f in FAIL:
        print("  FAILED: " + f)
    return 0 if not FAIL else 1

if __name__ == "__main__":
    raise SystemExit(main())
