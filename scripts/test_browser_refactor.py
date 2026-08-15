"""
浏览器综合测试脚本 - 验证代码重构后的初始化时序链路
================================================================
测试目标：http://localhost:5201/
验证内容：
  1. 页面加载后的模块初始化日志
  2. 首次交互触发的 Agent/MCP 初始化时序
  3. FULL REGISTRATION COMPLETE 是否出现（关键修复验证）
  4. 是否存在 race condition（lazy registration 重复/失败）
"""

import json
import os
import sys
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

TARGET_URL = "http://localhost:5201/"
OUTPUT_DIR = "test_outputs"
TIMEOUT_MS = 30000
WAIT_AFTER_LOAD_MS = 3000
WAIT_AFTER_CLICK_MS = 5000
VIEWPORT = {"width": 1440, "height": 900}

EXPECTED_PATTERNS = {
    "before_interaction": {
        "should_be_present": [
            "MODULE LOADED",
            "BOOTSTRAP COMPLETE",
        ],
        "should_be_absent": [
            "TRIGGER REGISTER",
            "CORE REGISTRATION COMPLETE",
            "AGENT READY",
            "FULL REGISTRATION COMPLETE",
            "TRIGGER INIT",
            "FIRST INTERACTION",
        ],
    },
    "after_interaction": {
        "should_be_present": [
            "FIRST INTERACTION",
            "TRIGGER INIT",
            "TRIGGER REGISTER",
            "CORE REGISTRATION COMPLETE",
            "FULL REGISTRATION COMPLETE",
            "AGENT READY",
        ],
        "should_be_absent": [
            "lazy registration already started",
            "lazy registration failed",
        ],
    },
}


def classify_log_level(msg_type: str) -> str:
    mapping = {
        "log": "INFO",
        "info": "INFO",
        "warning": "WARN",
        "warn": "WARN",
        "error": "ERROR",
        "debug": "DEBUG",
    }
    return mapping.get(msg_type, msg_type.upper())


def run_test():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 70)
    print("浏览器综合测试 - 初始化时序链验证")
    print(f"目标 URL: {TARGET_URL}")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_console_logs = []
    all_page_errors = []
    all_responses = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-features=RendererCodeIntegrity",
                "--no-first-run",
            ],
        )
        context = browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=1,
        )
        page = context.new_page()

        def on_console(msg):
            entry = {
                "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                "type": msg.type,
                "level": classify_log_level(msg.type),
                "text": msg.text[:500],
                "args_count": len(msg.args),
            }
            all_console_logs.append(entry)

        def on_page_error(err):
            entry = {
                "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                "error": str(err)[:1000],
            }
            all_page_errors.append(entry)

        def on_response(response):
            url = response.url
            status = response.status
            if status >= 400 or "error" in url.lower():
                all_responses.append({
                    "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                    "url": url[:200],
                    "status": status,
                })

        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("response", on_response)

        print("\n[1/8] 打开页面并等待 networkidle...")
        try:
            page.goto(TARGET_URL, wait_until="networkidle", timeout=TIMEOUT_MS)
        except Exception as e:
            print(f"  ⚠️  networkidle 超时或出错: {e}")
            print("  → 继续等待 load 状态...")
            try:
                page.goto(TARGET_URL, wait_until="load", timeout=TIMEOUT_MS)
            except Exception as e2:
                print(f"  ❌ 页面加载失败: {e2}")
                browser.close()
                return {"error": str(e2)}

        print(f"  ✅ 页面已加载 (URL: {page.url})")
        print(f"  📄 页面标题: {page.title()}")

        print(f"\n[2/8] 等待 {WAIT_AFTER_LOAD_MS}ms 让初始化完成...")
        page.wait_for_timeout(WAIT_AFTER_LOAD_MS)

        print("\n[3/8] 截图 - 初始页面（交互前）...")
        initial_screenshot_path = os.path.join(OUTPUT_DIR, "01_initial_page.png")
        page.screenshot(path=initial_screenshot_path, full_page=True)
        print(f"  📸 初始截图已保存: {initial_screenshot_path}")

        print("\n[4/8] 检查交互前的 Console 日志模式...")
        before_logs = [log["text"] for log in all_console_logs]
        before_results = check_patterns(before_logs, EXPECTED_PATTERNS["before_interaction"])
        print_pattern_results(before_results, "交互前")

        print("\n[5/8] 点击页面触发首次交互...")
        page.mouse.click(720, 450)
        print("  🖱️  已点击页面中心")

        print(f"\n[6/8] 等待 {WAIT_AFTER_CLICK_MS}ms 让初始化链完成...")
        page.wait_for_timeout(WAIT_AFTER_CLICK_MS)

        print("\n[7/8] 截图 - 最终页面（交互后）...")
        final_screenshot_path = os.path.join(OUTPUT_DIR, "02_final_page.png")
        page.screenshot(path=final_screenshot_path, full_page=True)
        print(f"  📸 最终截图已保存: {final_screenshot_path}")

        print("\n[8/8] 检查交互后的 Console 日志模式...")
        after_logs = [log["text"] for log in all_console_logs]
        after_results = check_patterns(after_logs, EXPECTED_PATTERNS["after_interaction"])
        print_pattern_results(after_results, "交互后")

        browser.close()

    report = {
        "url": TARGET_URL,
        "timestamp": datetime.now().isoformat(),
        "initial_screenshot": initial_screenshot_path if 'initial_screenshot_path' in dir() else None,
        "final_screenshot": final_screenshot_path if 'final_screenshot_path' in dir() else None,
        "before_interaction": before_results,
        "after_interaction": after_results,
        "console_logs": all_console_logs,
        "page_errors": all_page_errors,
        "error_responses": all_responses,
        "timing_chain": extract_timing_chain(all_console_logs),
        "summary": generate_summary(before_results, after_results, all_page_errors),
    }

    report_path = os.path.join(OUTPUT_DIR, "test_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)

    print(f"\n📄 完整报告已保存: {report_path}")

    print_summary(report["summary"])

    return report


def check_patterns(log_texts: list, config: dict) -> dict:
    results = {"present": {}, "absent": {}}

    for pattern in config["should_be_present"]:
        found = any(pattern in t for t in log_texts)
        results["present"][pattern] = {
            "found": found,
            "count": sum(1 for t in log_texts if pattern in t),
        }

    for pattern in config["should_be_absent"]:
        found = any(pattern in t for t in log_texts)
        results["absent"][pattern] = {
            "found": found,
            "count": sum(1 for t in log_texts if pattern in t),
            "violation": found,
        }

    return results


def print_pattern_results(results: dict, phase: str):
    print(f"\n  ┌─ {phase}模式检查 ─┐")
    print(f"  │  应该存在:")
    for pattern, info in results["present"].items():
        icon = "✅" if info["found"] else "❌"
        print(f"  │    {icon} {pattern} (出现 {info['count']} 次)")

    print(f"  │  不应该存在:")
    for pattern, info in results["absent"].items():
        icon = "⚠️" if info["found"] else "✅"
        print(f"  │    {icon} {pattern} (出现 {info['count']} 次)")
    print(f"  └────────────────────┘")


def extract_timing_chain(logs: list) -> dict:
    timing = {}
    for log in logs:
        text = log["text"]
        ts = log["timestamp"]

        if "BOOTSTRAP START" in text:
            timing["bootstrap_start"] = {"timestamp": ts, "text": text[:200]}
        elif "BOOTSTRAP COMPLETE" in text:
            timing["bootstrap_complete"] = {"timestamp": ts, "text": text[:200]}
        elif "MODULE LOADED" in text:
            key = "agent_module_loaded" if "[Agent]" in text else "mcp_module_loaded"
            timing[key] = {"timestamp": ts, "text": text[:200]}
        elif "FIRST INTERACTION" in text:
            timing["first_interaction"] = {"timestamp": ts, "text": text[:200]}
        elif "TRIGGER INIT" in text:
            timing["trigger_init"] = {"timestamp": ts, "text": text[:200]}
        elif "TRIGGER REGISTER" in text:
            timing["trigger_register"] = {"timestamp": ts, "text": text[:200]}
        elif "CORE REGISTRATION COMPLETE" in text:
            timing["core_registration_complete"] = {"timestamp": ts, "text": text[:200]}
        elif "FULL REGISTRATION COMPLETE" in text:
            timing["full_registration_complete"] = {"timestamp": ts, "text": text[:200]}
        elif "AGENT READY" in text:
            timing["agent_ready"] = {"timestamp": ts, "text": text[:200]}

    return timing


def generate_summary(before_results: dict, after_results: dict, page_errors: list) -> dict:
    critical_checks = {
        "FULL REGISTRATION COMPLETE 出现": after_results["present"].get("FULL REGISTRATION COMPLETE", {}).get("found", False),
        "无 lazy registration 重复": not after_results["absent"].get("lazy registration already started", {}).get("found", True),
        "无 lazy registration 失败": not after_results["absent"].get("lazy registration failed", {}).get("found", True),
        "首次交互前无 TRIGGER": not before_results["absent"].get("TRIGGER REGISTER", {}).get("found", True),
        "首次交互前无 AGENT READY": not before_results["absent"].get("AGENT READY", {}).get("found", True),
        "MODULE LOADED 已加载": before_results["present"].get("MODULE LOADED", {}).get("found", False),
        "BOOTSTRAP COMPLETE 已完成": before_results["present"].get("BOOTSTRAP COMPLETE", {}).get("found", False),
        "FIRST INTERACTION 触发": after_results["present"].get("FIRST INTERACTION", {}).get("found", False),
        "TRIGGER INIT 触发": after_results["present"].get("TRIGGER INIT", {}).get("found", False),
        "TRIGGER REGISTER 触发": after_results["present"].get("TRIGGER REGISTER", {}).get("found", False),
        "CORE REGISTRATION COMPLETE": after_results["present"].get("CORE REGISTRATION COMPLETE", {}).get("found", False),
        "AGENT READY 就绪": after_results["present"].get("AGENT READY", {}).get("found", False),
    }

    passed = sum(1 for v in critical_checks.values() if v)
    total = len(critical_checks)
    all_passed = passed == total

    race_condition_fixed = (
        critical_checks["FULL REGISTRATION COMPLETE 出现"]
        and critical_checks["无 lazy registration 重复"]
        and critical_checks["无 lazy registration 失败"]
    )

    return {
        "total_checks": total,
        "passed": passed,
        "failed": total - passed,
        "all_passed": all_passed,
        "race_condition_fixed": race_condition_fixed,
        "critical_checks": critical_checks,
        "page_errors_count": len(page_errors),
        "page_errors": page_errors[:5],
    }


def print_summary(summary: dict):
    print("\n" + "=" * 70)
    print("📊 测试总结报告")
    print("=" * 70)

    print(f"\n  总检查项: {summary['total_checks']}")
    print(f"  ✅ 通过: {summary['passed']}")
    print(f"  ❌ 失败: {summary['failed']}")
    print(f"  🎯 全部通过: {'是' if summary['all_passed'] else '否'}")

    print(f"\n  🔧 关键修复验证:")
    print(f"    FULL REGISTRATION COMPLETE 出现: {'✅' if summary['critical_checks']['FULL REGISTRATION COMPLETE 出现'] else '❌'}")
    print(f"    无 lazy registration 重复:     {'✅' if summary['critical_checks']['无 lazy registration 重复'] else '❌'}")
    print(f"    无 lazy registration 失败:     {'✅' if summary['critical_checks']['无 lazy registration 失败'] else '❌'}")

    print(f"\n  ⚡ Race Condition 修复状态: {'✅ 已修复' if summary['race_condition_fixed'] else '❌ 未修复'}")

    print(f"\n  📋 详细检查结果:")
    for check, result in summary["critical_checks"].items():
        icon = "✅" if result else "❌"
        print(f"    {icon} {check}")

    if summary["page_errors_count"] > 0:
        print(f"\n  ⚠️  页面错误 ({summary['page_errors_count']} 条):")
        for err in summary["page_errors"]:
            print(f"    - {str(err)[:150]}")
    else:
        print(f"\n  ✅ 无页面错误")

    print("\n" + "=" * 70)

    return 0 if summary["all_passed"] else 1


if __name__ == "__main__":
    try:
        result = run_test()
        if "error" in result:
            print(f"\n❌ 测试失败: {result['error']}")
            sys.exit(1)
        sys.exit(0 if result["summary"]["all_passed"] else 1)
    except KeyboardInterrupt:
        print("\n测试被用户中断")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(2)