#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CI 工作流触发路径匹配单元测试
验证 .github/workflows/embedding-health-check.yml 的路径过滤器：
- embedding 相关文件变更 → 正确触发工作流
- 无关文件变更 → 正确跳过工作流

运行方式: python tests/test_ci_trigger_paths.py
退出码: 0=全部通过, 1=有失败
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


# ──────────────────────────────────────────────
# 核心逻辑：从 YAML 提取触发路径 + 匹配
# ──────────────────────────────────────────────

def load_trigger_paths(workflow_path=WORKFLOW_FILE):
    """从工作流 YAML 文件解析 pull_request.paths 触发列表"""
    with open(workflow_path, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    on_config = spec.get("on") or spec.get(True) or {}
    pr_config = on_config.get("pull_request", {})
    paths = pr_config.get("paths", [])
    if not paths:
        raise ValueError(f"未找到 pull_request.paths 配置: {workflow_path}")
    return paths


def matches_any(changed_file, patterns):
    """
    检查 changed_file 是否匹配任一 glob pattern。
    GitHub Actions 使用 minimatch 语义：* 不跨 /，** 跨 /。
    当前 patterns 均为精确路径，fnmatch 足够。
    """
    for pattern in patterns:
        # 用 fnmatchcase 而非 fnmatch，确保大小写敏感（匹配 Linux runner 行为）
        if fnmatch.fnmatchcase(changed_file, pattern):
            return True
    return False


def should_trigger(changed_files, patterns):
    """
    判断一组变更文件是否应触发工作流。
    GitHub Actions 语义：任一文件匹配 paths → 触发。
    """
    return any(matches_any(f, patterns) for f in changed_files)


# ──────────────────────────────────────────────
# 测试用例
# ──────────────────────────────────────────────

# 1. 应该触发的文件（工作流 paths 中列出的每一项本身）
SHOULD_TRIGGER = [
    ("backend/embedding_service.py",       "embedding 服务主代码"),
    ("backend/embedding_daemon.py",        "daemon 进程代码"),
    ("backend/requirements.txt",           "Python 依赖清单"),
    ("scripts/verify-embedding-dtype.py",  "dtype 验证脚本"),
    ("scripts/embedding.env",              "embedding 环境配置"),
    (".github/workflows/embedding-health-check.yml", "工作流自身"),
]

# 2. 不应触发的文件（典型无关变更）
SHOULD_NOT_TRIGGER = [
    ("backend/collect_endpoints.py",              "AkShare 采集服务"),
    ("backend/embedding_utils.py",                "名称相似但未列入 paths"),
    ("backend/__init__.py",                       "后端包初始化"),
    ("src/App.tsx",                               "前端入口"),
    ("src/components/Dashboard.tsx",              "前端组件"),
    ("src/hooks/useStockData.ts",                 "前端 Hook"),
    ("package.json",                              "Node 依赖"),
    ("package-lock.json",                         "Node 锁文件"),
    ("tsconfig.json",                             "TS 配置"),
    ("vite.config.ts",                            "Vite 配置"),
    ("README.md",                                 "项目 README"),
    ("CHANGELOG.md",                              "变更日志"),
    ("docs/memopt-bge-large-zh-v1.5-4workers.md", "内存优化设计文档"),
    ("docs/README.md",                            "文档索引"),
    (".github/workflows/ci.yml",                  "其他工作流"),
    (".gitignore",                                "Git 忽略配置"),
    ("scripts/cleanup-storage.ts",                "存储清理脚本"),
    ("scripts/start-embedding-daemon.ps1",        "daemon 启动脚本（未列入 paths）"),
]

# 3. 边界情况
EDGE_CASES = [
    # (changed_file, expected_trigger, description)
    ("backend/embedding_service.py.bak",          False, "embedding_service.py 的备份文件"),
    ("backend/embedding_service.test.py",         False, "embedding_service 的测试文件（未列入 paths）"),
    ("backend/embedding_service/",                False, "同名目录（非精确文件匹配）"),
    ("scripts/embedding.env.bak",                 False, "env 备份文件"),
    ("scripts/verify-embedding-dtype.py.old",     False, "验证脚本旧版备份"),
    ("BACKEND/EMBEDDING_SERVICE.PY",              False, "大小写不同的路径（Linux 区分大小写）"),
    ("backend/embedding_service.py",              True,  "精确匹配（重复确认）"),
    (".github/workflows/embedding-health-check",  False, "缺少 .yml 后缀"),
]

# 4. 多文件变更场景（模拟真实 PR）
MULTI_FILE_SCENARIOS = [
    {
        "name": "PR 含 embedding 变更 + 前端变更",
        "files": ["backend/embedding_service.py", "src/App.tsx", "package.json"],
        "expected": True,
    },
    {
        "name": "PR 仅含前端 + 文档变更",
        "files": ["src/Dashboard.tsx", "docs/README.md", "CHANGELOG.md"],
        "expected": False,
    },
    {
        "name": "PR 含工作流自身变更 + 其他",
        "files": [".github/workflows/embedding-health-check.yml", "src/hooks/useData.ts"],
        "expected": True,
    },
    {
        "name": "PR 仅含依赖更新",
        "files": ["backend/requirements.txt"],
        "expected": True,
    },
    {
        "name": "PR 含 50 个无关文件",
        "files": [f"src/component_{i}.tsx" for i in range(50)],
        "expected": False,
    },
    {
        "name": "PR 含 49 个无关文件 + 1 个 embedding 文件",
        "files": [f"src/component_{i}.tsx" for i in range(49)] + ["backend/embedding_service.py"],
        "expected": True,
    },
]


# ──────────────────────────────────────────────
# 测试运行器
# ──────────────────────────────────────────────

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []

    def check(self, condition, description, detail=""):
        if condition:
            self.passed += 1
        else:
            self.failed += 1
            self.failures.append(f"  FAIL: {description}" + (f" | {detail}" if detail else ""))

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"  总计: {total} | 通过: {self.passed} | 失败: {self.failed}")
        if self.failures:
            print(f"  失败详情:")
            for f in self.failures:
                print(f)
        print(f"{'='*60}")
        return self.failed == 0


def run_tests():
    """运行全部测试"""
    print("=" * 60)
    print("  CI 工作流触发路径匹配单元测试")
    print(f"  工作流文件: {os.path.relpath(WORKFLOW_FILE, REPO_ROOT)}")
    print("=" * 60)

    # 前置：加载触发路径
    patterns = load_trigger_paths()
    print(f"\n触发路径 patterns ({len(patterns)} 项):")
    for p in patterns:
        print(f"  - {p}")

    result = TestResult()

    # ── 测试 1: 每个 pattern 应匹配自身 ──
    print(f"\n--- 测试 1: pattern 自匹配 ({len(SHOULD_TRIGGER)} 项) ---")
    for filepath, desc in SHOULD_TRIGGER:
        matched = matches_any(filepath, patterns)
        result.check(matched, f"{filepath} 应触发 ({desc})")
        status = "PASS" if matched else "FAIL"
        print(f"  [{status}] {filepath:55s} → trigger={matched}")

    # ── 测试 2: 无关文件不应触发 ──
    print(f"\n--- 测试 2: 无关文件跳过 ({len(SHOULD_NOT_TRIGGER)} 项) ---")
    for filepath, desc in SHOULD_NOT_TRIGGER:
        matched = matches_any(filepath, patterns)
        result.check(not matched, f"{filepath} 不应触发 ({desc})")
        status = "PASS" if not matched else "FAIL"
        print(f"  [{status}] {filepath:55s} → trigger={matched}")

    # ── 测试 3: 边界情况 ──
    print(f"\n--- 测试 3: 边界情况 ({len(EDGE_CASES)} 项) ---")
    for filepath, expected, desc in EDGE_CASES:
        matched = matches_any(filepath, patterns)
        result.check(matched == expected, f"{filepath} ({desc})",
                     f"expected={expected}, got={matched}")
        status = "PASS" if matched == expected else "FAIL"
        print(f"  [{status}] {filepath:55s} → trigger={matched} (expected={expected})")

    # ── 测试 4: 多文件 PR 场景 ──
    print(f"\n--- 测试 4: 多文件 PR 场景 ({len(MULTI_FILE_SCENARIOS)} 项) ---")
    for scenario in MULTI_FILE_SCENARIOS:
        triggered = should_trigger(scenario["files"], patterns)
        expected = scenario["expected"]
        result.check(triggered == expected, scenario["name"],
                     f"expected={expected}, got={triggered}")
        status = "PASS" if triggered == expected else "FAIL"
        file_count = len(scenario["files"])
        print(f"  [{status}] {scenario['name']}")
        print(f"         files={file_count} → trigger={triggered} (expected={expected})")

    # ── 测试 5: 缓存 key 格式 ──
    print(f"\n--- 测试 5: 缓存 key 格式验证 ---")
    with open(WORKFLOW_FILE, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    steps = spec["jobs"]["dtype-verify"]["steps"]
    cache_step = next(s for s in steps if s.get("uses", "").startswith("actions/cache"))
    cache_key = cache_step["with"]["key"]
    cache_restore = cache_step["with"]["restore-keys"]

    # key 应包含模型名 + OS + 版本号
    has_model = "bge-large-zh-v1.5" in cache_key
    has_os = "${{ runner.os }}" in cache_key
    has_version = "-v1" in cache_key or "-v2" in cache_key
    has_restore = "bge-large-zh-v1.5" in cache_restore and "${{ runner.os }}" in cache_restore

    result.check(has_model, "缓存 key 包含模型名", f"key={cache_key}")
    result.check(has_os, "缓存 key 包含 runner.os", f"key={cache_key}")
    result.check(has_version, "缓存 key 包含版本号", f"key={cache_key}")
    result.check(has_restore, "restore-keys 包含模型名和 OS 前缀", f"restore={cache_restore}")

    for check, desc, detail in [
        (has_model, "key 含模型名", cache_key),
        (has_os, "key 含 runner.os", cache_key),
        (has_version, "key 含版本号", cache_key),
        (has_restore, "restore-keys 含前缀", cache_restore.strip()),
    ]:
        status = "PASS" if check else "FAIL"
        print(f"  [{status}] {desc}: {detail}")

    # ── 测试 6: 工作流结构完整性 ──
    print(f"\n--- 测试 6: 工作流结构完整性 ---")
    on_config = spec.get("on") or spec.get(True) or {}
    has_pr_trigger = "pull_request" in on_config
    has_dispatch = "workflow_dispatch" in on_config
    pr_branches = on_config.get("pull_request", {}).get("branches", [])
    has_main_branch = "main" in pr_branches
    has_develop_branch = "develop" in pr_branches
    job_has_continue_on_error = spec["jobs"]["dtype-verify"].get("continue-on-error") is not None
    job_timeout = spec["jobs"]["dtype-verify"].get("timeout-minutes", 0)

    for check, desc in [
        (has_pr_trigger, "pull_request 触发器存在"),
        (has_dispatch, "workflow_dispatch 手动触发存在"),
        (has_main_branch, "PR 目标分支含 main"),
        (has_develop_branch, "PR 目标分支含 develop"),
        (job_has_continue_on_error, "continue-on-error 设置（advisory 模式）"),
        (job_timeout >= 10, f"timeout-minutes >= 10 (实际={job_timeout})"),
    ]:
        result.check(check, desc)
        status = "PASS" if check else "FAIL"
        print(f"  [{status}] {desc}")

    return result


def main():
    try:
        result = run_tests()
        ok = result.summary()
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"\nFATAL: 测试执行异常: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(2)


if __name__ == "__main__":
    main()
