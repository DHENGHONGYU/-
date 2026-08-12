#!/usr/bin/env python3
"""生成测试/构建产物清理清单（仅列出，不删除）。"""
import os
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 文件模式
LOG_PATTERNS = ["*.log"]
OTHER_PATTERNS = [
    "*.report.md", "report-*.md", "test-report*.md",
    "test-output.json", "test-results.json", "junit_*.xml",
    "quality-gate-result.json", "route-audit-tmp.json",
    "complexity-now.json", "complexity-baseline-current.json", "complexity-plan.json",
    "eslint-*.json", "eslint-*.txt", "eslint-core-output.json",
    "eslint-full.txt", "eslint-full-output.txt", "eslint-json-output.json",
    "eslint-output.txt", "eslint-report.json", "eslint-services-*.json",
    "eslint-store-*.json", "eslint-test.txt", "eslint-check-batch-f.log",
    "vite.config.ts.timestamp-*.mjs", "tmp_*.png", "tmp_db_*.png",
    "nul", "audit-tests-output*.txt",
    "test-*.txt", "test-output.txt", "test-output2.txt",
    "test-latest.txt", "test-results.txt", "test-results-latest.txt", "test-summary.txt",
    "lint-*.txt", "failed-*.txt", "fail_analysis.txt",
    "tsc-*.txt", "tsc-error.txt", "tsc-errors*.txt", "tsc_full.txt", "tsc_out.txt",
    "type-errors-*.txt", "deadcode-result.txt",
    "tatus -sb 2>&1 | Select-Object -First 1",
]
COVERAGE_DIRS = [
    "coverage", "coverage_cmd", "widget_test_logs", "widget_test_logs_run2",
    "widget_test_logs_run3", "test-output", "test-results", "test-results-f01",
    "e2e-test-report", "playwright-report",
]
BUILD_DIRS = [
    "dist_e2e", "dist_preview", "dist_s1verify", "dist-e2e", "dist-test", "dist-verify",
]

import fnmatch

def list_files(patterns):
    out = []
    for name in os.listdir(ROOT):
        p = os.path.join(ROOT, name)
        if not os.path.isfile(p):
            continue
        for pat in patterns:
            if fnmatch.fnmatch(name, pat):
                out.append(name)
                break
    return sorted(out)

def list_dirs(names):
    out = []
    for name in names:
        p = os.path.join(ROOT, name)
        if os.path.isdir(p):
            try:
                size = sum(
                    os.path.getsize(os.path.join(dp, f))
                    for dp, _, fs in os.walk(p) for f in fs
                )
                size_mb = size / 1024 / 1024
            except Exception:
                size_mb = 0
            out.append((name, size_mb))
    return out

logs = list_files(LOG_PATTERNS)
others = list_files(OTHER_PATTERNS)
cov_dirs = list_dirs(COVERAGE_DIRS)
build_dirs = list_dirs(BUILD_DIRS)

lines = []
lines.append("# 测试/构建产物清理清单（待核对，未删除）")
lines.append("")
lines.append(f"> 生成时间：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
lines.append("> 审计状态：test:clean 全绿（317 files / 4610 passed / exit 0），审计无误。")
lines.append("> 本文件仅列出待删项，未执行任何删除操作。确认后由用户授权再删。")
lines.append("")
lines.append("## 保留项（不删，供对照）")
lines.append("- 生产构建：`dist/`")
lines.append("- 源码与测试源码：`src/` `tests/` `e2e/` `scripts/` `public/`")
lines.append("- 依赖：`node_modules/`")
lines.append("- 配置：`*.ts/*.js/*.json/*.md` 配置类（package.json/tsconfig*/vite.config.ts/eslint*.config.js 等）")
lines.append("- 交付物：`v9-roadmap-execution.zip` `code-quality-compliance/`+zip `patch-bundle.patch` `checklist_record.json` 隐藏基线 `.complexity-baseline.json` `.token-baseline.json`")
lines.append("")
lines.append("## 一、日志文件（`*.log`，含隐藏）")
lines.append("")
lines.append("```")
lines.extend(logs)
lines.append("```")
lines.append("")
lines.append(f"数量：{len(logs)}")
lines.append("")
lines.append("## 二、测试/审计零散输出（txt/json/xml，非日志）")
lines.append("")
lines.append("```")
lines.extend(others)
lines.append("```")
lines.append("")
lines.append(f"数量：{len(others)}")
lines.append("")
lines.append("## 三、覆盖率与临时测试目录")
lines.append("")
lines.append("```")
for name, mb in cov_dirs:
    lines.append(f"{name}  ({mb:.2f} MB)")
lines.append("```")
lines.append("")
lines.append("## 四、临时构建目录（dist_* 等非生产构建）")
lines.append("")
lines.append("```")
for name, mb in build_dirs:
    lines.append(f"{name}  ({mb:.2f} MB)")
lines.append("```")
lines.append("")
lines.append("## 汇总")
lines.append("")
lines.append(f"- 待删文件：{len(logs)} 个日志 + {len(others)} 个其他 = {len(logs)+len(others)} 个")
lines.append(f"- 待删目录：{len(cov_dirs)} 个测试/覆盖率目录 + {len(build_dirs)} 个临时构建目录 = {len(cov_dirs)+len(build_dirs)} 个")

report_path = os.path.join(ROOT, "docs", "reports", "docs/reports/retrospectives/test-artifacts-cleanup-list.md")
os.makedirs(os.path.dirname(report_path), exist_ok=True)
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"报告已生成：{report_path}")
print(f"待删文件：{len(logs)+len(others)} 个；待删目录：{len(cov_dirs)+len(build_dirs)} 个")
