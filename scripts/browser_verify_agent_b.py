"""Phase B 浏览器验证脚本：覆盖 Agent 子模块所有页面与关键检查。
用法：python scripts/browser_verify_agent_b.py [server_base_url]
默认 http://localhost:3001
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright, Page, Browser, ConsoleMessage, Request

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001"
SHOT_DIR = Path("docs/implementation/phase-b-screenshots")
SHOT_DIR.mkdir(parents=True, exist_ok=True)

CHROMIUM_EXECUTABLE = os.environ.get(
    "PLAYWRIGHT_CHROMIUM_PATH",
    r"C:\Users\huawei\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe",
)

PAGES_TO_VISIT: list[dict[str, Any]] = [
    {"name": "agent-hub", "path": "#/command/agents", "expect": ["智能体总控台", "总控舱"]},
    {"name": "agent-registry", "path": "#/command/agents/registry", "expect": ["智能体注册表", "注册"]},
    {"name": "agent-detail-v6", "path": "#/command/agents/registry/v6-scoring-agent", "expect": ["V6 评分智能体", "评分层级"]},
    {"name": "agent-detail-fetcher", "path": "#/command/agents/registry/fetcher-agent", "expect": ["采集智能体"]},
    {"name": "agent-detail-notfound", "path": "#/command/agents/registry/non-existent", "expect": ["未找到", "不存在"]},
    {"name": "placeholder-trigger", "path": "#/command/agents/trigger", "expect": ["触发"]},
    {"name": "placeholder-tasks", "path": "#/command/agents/tasks", "expect": ["任务"]},
    {"name": "placeholder-custom", "path": "#/command/agents/custom", "expect": ["自定义"]},
    {"name": "placeholder-llm", "path": "#/command/agents/llm", "expect": ["LLM"]},
    {"name": "placeholder-capability-graph", "path": "#/command/agents/capability-graph", "expect": ["能力图谱"]},
    {"name": "placeholder-dag-scheduler", "path": "#/command/agents/dag-scheduler", "expect": ["DAG"]},
    {"name": "placeholder-feedback", "path": "#/command/agents/feedback", "expect": ["反馈"]},
]


def setup_network_and_console_listeners(page: Page, report: dict[str, Any]) -> None:
    def on_console(msg: ConsoleMessage) -> None:
        report.setdefault("console", []).append({
            "type": msg.type,
            "text": msg.text,
            "location": msg.location,
        })

    def on_request(req: Request) -> None:
        try:
            resp = req.response()
            if resp is not None:
                status = resp.status
                if status >= 400:
                    report.setdefault("network_errors", []).append({
                        "url": req.url,
                        "status": status,
                        "method": req.method,
                    })
                report.setdefault("network", []).append({
                    "url": req.url,
                    "status": status,
                    "method": req.method,
                    "time_ms": resp.request.timing.get("responseEnd", 0) - req.timing.get("startTime", 0),
                })
        except Exception:
            pass

    page.on("console", on_console)
    page.on("requestfinished", on_request)


def visit_page(browser: Browser, page_cfg: dict[str, Any], base_url: str) -> dict[str, Any]:
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    report: dict[str, Any] = {
        "name": page_cfg["name"],
        "url": f"{base_url}/{page_cfg['path']}",
        "expect": page_cfg.get("expect", []),
        "console": [],
        "network_errors": [],
        "network": [],
    }
    setup_network_and_console_listeners(page, report)

    try:
        page.goto(report["url"])
        page.wait_for_load_state("networkidle", timeout=15000)
        # 额外等待 React/Vite 渲染与 Agent 初始化
        page.wait_for_timeout(1200)

        text = page.inner_text("body")
        missing = [e for e in report["expect"] if e not in text]
        report["expect_match"] = len(missing) == 0
        report["missing_expect"] = missing
        report["body_text_sample"] = text[:500].replace("\n", " ")

        # 截图
        shot_path = SHOT_DIR / f"{page_cfg['name']}.png"
        page.screenshot(path=str(shot_path), full_page=True)
        report["screenshot"] = str(shot_path)

        # 性能计时（Navigation Timing）
        perf = page.evaluate(
            """() => {
                const p = performance.getEntriesByType('navigation')[0];
                if (!p) return null;
                return {
                    domContentLoadedEventEnd: p.domContentLoadedEventEnd,
                    loadEventEnd: p.loadEventEnd,
                    responseEnd: p.responseEnd,
                    domComplete: p.domComplete,
                };
            }"""
        )
        report["perf"] = perf

    except Exception as exc:
        report["error"] = str(exc)
        shot_path = SHOT_DIR / f"{page_cfg['name']}_error.png"
        try:
            page.screenshot(path=str(shot_path), full_page=True)
            report["screenshot"] = str(shot_path)
        except Exception:
            pass
    finally:
        context.close()

    return report


def main() -> int:
    print(f"[browser_verify_agent_b] Starting verification against {BASE_URL}")
    reports: list[dict[str, Any]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROMIUM_EXECUTABLE)
        try:
            for cfg in PAGES_TO_VISIT:
                print(f"  -> {cfg['name']}: {cfg['path']}")
                reports.append(visit_page(browser, cfg, BASE_URL))
        finally:
            browser.close()

    summary_path = SHOT_DIR / "report.json"
    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(reports, f, ensure_ascii=False, indent=2)

    print(f"\n[browser_verify_agent_b] Reports saved to {summary_path}")
    all_ok = True
    for r in reports:
        status = "OK" if r.get("expect_match") and not r.get("error") and not r.get("network_errors") else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(f"  [{status}] {r['name']}: expect_match={r.get('expect_match')} error={r.get('error')} network_errors={len(r.get('network_errors', []))}")
        if r.get("missing_expect"):
            print(f"      missing: {r['missing_expect']}")
        if r.get("network_errors"):
            for ne in r["network_errors"]:
                print(f"      network error: {ne['method']} {ne['status']} {ne['url']}")
        console_errors = [c for c in r.get("console", []) if c["type"] in ("error", "warning")]
        if console_errors:
            print(f"      console errors/warnings: {len(console_errors)}")
            for c in console_errors[:3]:
                print(f"        [{c['type']}] {c['text'][:200]}")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
