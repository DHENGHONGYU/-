#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
GitHub Actions PR 触发模拟脚本

模拟不同类型的 PR（前端-only、后端-only、混合、文档-only 等），
验证 embedding-health-check 工作流是否在正确的场景下触发/跳过。

核心验证目标：当 PR 只修改了前端文件时，embedding 工作流必须被跳过。

运行方式: python scripts/simulate-pr-trigger.py
退出码: 0=全部符合预期, 1=有不符合预期的场景
"""
import io
import os
import sys
import yaml
import fnmatch

# 解决 Windows 终端中文编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# 仓库根目录（动态推导，无硬编码路径）
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKFLOW_FILE = os.path.join(REPO_ROOT, ".github", "workflows", "embedding-health-check.yml")


def load_trigger_paths(workflow_path=WORKFLOW_FILE):
    """从工作流 YAML 解析 pull_request.paths"""
    with open(workflow_path, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    on_config = spec.get("on") or spec.get(True) or {}
    pr_config = on_config.get("pull_request", {})
    return pr_config.get("paths", [])


def matches_any(changed_file, patterns):
    """大小写敏感的 glob 匹配（模拟 Linux runner 行为）"""
    return any(fnmatch.fnmatchcase(changed_file, p) for p in patterns)


def workflow_will_trigger(changed_files, patterns):
    """判断工作流是否会被触发（任一文件匹配即触发）"""
    return any(matches_any(f, patterns) for f in changed_files)


# ──────────────────────────────────────────────
# PR 模拟场景定义
# ──────────────────────────────────────────────

SCENARIOS = [
    # ═══ 核心验证：前端-only PR 必须跳过 embedding 工作流 ═══
    {
        "id": "frontend-only-1",
        "name": "前端组件修改（单文件）",
        "files": ["src/components/Dashboard.tsx"],
        "expected_trigger": False,
        "category": "前端-only",
    },
    {
        "id": "frontend-only-2",
        "name": "前端多文件修改（10 文件）",
        "files": [
            "src/App.tsx",
            "src/components/Dashboard.tsx",
            "src/components/StockCard.tsx",
            "src/components/ScoreGauge.tsx",
            "src/hooks/useStockData.ts",
            "src/hooks/useScoreData.ts",
            "src/pages/Home.tsx",
            "src/pages/Analysis.tsx",
            "src/services/api.ts",
            "src/types/index.ts",
        ],
        "expected_trigger": False,
        "category": "前端-only",
    },
    {
        "id": "frontend-only-3",
        "name": "前端大规模重构（30 文件）",
        "files": [f"src/components/Component_{i}.tsx" for i in range(20)]
               + [f"src/hooks/useHook_{i}.ts" for i in range(10)],
        "expected_trigger": False,
        "category": "前端-only",
    },
    {
        "id": "frontend-only-4",
        "name": "前端样式 + 配置（混合前端文件）",
        "files": [
            "src/styles/global.css",
            "src/styles/variables.css",
            "src/App.tsx",
            "tailwind.config.js",
            "postcss.config.js",
        ],
        "expected_trigger": False,
        "category": "前端-only",
    },

    # ═══ 应触发：embedding 相关 PR ═══
    {
        "id": "embedding-1",
        "name": "embedding_service.py 修改",
        "files": ["backend/embedding_service.py"],
        "expected_trigger": True,
        "category": "Embedding 变更",
    },
    {
        "id": "embedding-2",
        "name": "embedding 配置修改",
        "files": ["scripts/embedding.env"],
        "expected_trigger": True,
        "category": "Embedding 变更",
    },
    {
        "id": "embedding-3",
        "name": "验证脚本修改",
        "files": ["scripts/verify-embedding-dtype.py"],
        "expected_trigger": True,
        "category": "Embedding 变更",
    },
    {
        "id": "embedding-4",
        "name": "embedding 全栈修改（服务+配置+验证）",
        "files": [
            "backend/embedding_service.py",
            "backend/embedding_daemon.py",
            "scripts/embedding.env",
            "scripts/verify-embedding-dtype.py",
            "backend/requirements.txt",
        ],
        "expected_trigger": True,
        "category": "Embedding 变更",
    },

    # ═══ 混合 PR：前端 + embedding ═══
    {
        "id": "mixed-1",
        "name": "前端 + embedding 混合（应触发）",
        "files": [
            "src/App.tsx",
            "src/components/Dashboard.tsx",
            "backend/embedding_service.py",
        ],
        "expected_trigger": True,
        "category": "混合变更",
    },
    {
        "id": "mixed-2",
        "name": "前端 + 后端非 embedding（应跳过）",
        "files": [
            "src/App.tsx",
            "backend/collect_endpoints.py",
            "backend/__init__.py",
        ],
        "expected_trigger": False,
        "category": "混合变更",
    },

    # ═══ 文档-only PR ═══
    {
        "id": "docs-only-1",
        "name": "文档修改（单文件）",
        "files": ["docs/memopt-bge-large-zh-v1.5-4workers.md"],
        "expected_trigger": False,
        "category": "文档-only",
    },
    {
        "id": "docs-only-2",
        "name": "文档批量更新（5 文件）",
        "files": [
            "README.md",
            "CHANGELOG.md",
            "docs/README.md",
            "docs/reference/release-notes.md",
            "docs/guides/how-to/storage-cleanup-guide.md",
        ],
        "expected_trigger": False,
        "category": "文档-only",
    },

    # ═══ 配置-only PR ═══
    {
        "id": "config-only-1",
        "name": "Node 配置修改",
        "files": ["package.json", "package-lock.json", "tsconfig.json"],
        "expected_trigger": False,
        "category": "配置-only",
    },
    {
        "id": "config-only-2",
        "name": "Vite + ESLint 配置修改",
        "files": ["vite.config.ts", ".eslintrc.cjs", ".prettierrc"],
        "expected_trigger": False,
        "category": "配置-only",
    },

    # ═══ 工作流自身修改 ═══
    {
        "id": "workflow-self",
        "name": "embedding 工作流自身修改",
        "files": [".github/workflows/embedding-health-check.yml"],
        "expected_trigger": True,
        "category": "工作流变更",
    },
    {
        "id": "workflow-other",
        "name": "其他工作流修改（ci.yml）",
        "files": [".github/workflows/ci.yml"],
        "expected_trigger": False,
        "category": "工作流变更",
    },

    # ═══ 边界：名称相似但非触发文件 ═══
    {
        "id": "similar-name-1",
        "name": "名称相似的后端文件",
        "files": ["backend/embedding_utils.py"],
        "expected_trigger": False,
        "category": "边界",
    },
    {
        "id": "similar-name-2",
        "name": "embedding 启动脚本（未列入 paths）",
        "files": ["scripts/start-embedding-daemon.ps1"],
        "expected_trigger": False,
        "category": "边界",
    },
    {
        "id": "similar-name-3",
        "name": "备份文件",
        "files": ["backend/embedding_service.py.bak"],
        "expected_trigger": False,
        "category": "边界",
    },
]


def run_simulation():
    """运行全部 PR 模拟场景"""
    print("=" * 70)
    print("  GitHub Actions PR 触发模拟")
    print(f"  工作流: {os.path.relpath(WORKFLOW_FILE, REPO_ROOT)}")
    print("=" * 70)

    patterns = load_trigger_paths()
    print(f"\n触发路径 ({len(patterns)} 项): {', '.join(patterns)}")

    total = len(SCENARIOS)
    passed = 0
    failed = 0
    frontend_only_all_skipped = True  # 核心验证目标

    # 按类别分组输出
    current_category = None
    print()

    for scenario in SCENARIOS:
        # 类别分隔
        if scenario["category"] != current_category:
            current_category = scenario["category"]
            print(f"── {current_category} {'─' * (60 - len(current_category) * 2)}")

        # 执行模拟
        actual_trigger = workflow_will_trigger(scenario["files"], patterns)
        expected = scenario["expected_trigger"]
        ok = actual_trigger == expected

        # 核心验证：前端-only 场景必须全部跳过
        if scenario["category"] == "前端-only" and actual_trigger:
            frontend_only_all_skipped = False

        if ok:
            passed += 1
            status = "✅"
        else:
            failed += 1
            status = "❌"

        # 输出
        file_count = len(scenario["files"])
        trigger_str = "RUN" if actual_trigger else "SKIP"
        expected_str = "RUN" if expected else "SKIP"
        print(f"  {status} [{scenario['id']}] {scenario['name']}")
        print(f"     files={file_count:>2d}  workflow={trigger_str:4s}  expected={expected_str:4s}")

        # 失败时展示匹配详情
        if not ok:
            matched_files = [f for f in scenario["files"] if matches_any(f, patterns)]
            print(f"     ⚠️  误匹配文件: {matched_files if matched_files else '无（应为触发但未触发）'}")

    # ── 汇总 ──
    print()
    print("=" * 70)
    print(f"  场景总计: {total} | 通过: {passed} | 失败: {failed}")
    print()

    # 核心验证目标
    if frontend_only_all_skipped:
        print("  🎯 核心验证 PASS: 所有前端-only PR 均正确跳过 embedding 工作流")
    else:
        print("  🎯 核心验证 FAIL: 有前端-only PR 误触发了 embedding 工作流！")

    # 按类别统计
    categories = {}
    for s in SCENARIOS:
        cat = s["category"]
        if cat not in categories:
            categories[cat] = {"pass": 0, "fail": 0}
        if workflow_will_trigger(s["files"], patterns) == s["expected_trigger"]:
            categories[cat]["pass"] += 1
        else:
            categories[cat]["fail"] += 1

    print()
    print("  按类别统计:")
    for cat, counts in categories.items():
        status = "✅" if counts["fail"] == 0 else "❌"
        print(f"    {status} {cat:12s}  通过={counts['pass']}  失败={counts['fail']}")

    print("=" * 70)

    # 退出码
    all_pass = failed == 0 and frontend_only_all_skipped
    return all_pass


def main():
    try:
        ok = run_simulation()
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"\nFATAL: 模拟执行异常: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(2)


if __name__ == "__main__":
    main()
