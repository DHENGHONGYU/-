#!/usr/bin/env python3
"""Add missing `pool: 'research'` to inline Stock mocks in test files."""

import re
import sys
from pathlib import Path

FILES = [
    "tests/AnalysisApp.test.tsx",
    "tests/InputApp.test.tsx",
    "tests/ScoreDocPage.test.tsx",
    "tests/StrategySnapshotPage.test.tsx",
    "tests/TradingApp.test.tsx",
    "tests/__tests__/integration/mcp-servers.integration.test.ts",
    "tests/__tests__/integration/pool-acl.integration.test.ts",
    "tests/__tests__/types/data-types.spec.ts",
    "tests/batchImportService.test.ts",
    "tests/blueprints/dataRelationship.test.ts",
    "tests/dataLayer.test.ts",
    "tests/databridge.test.ts",
    "tests/fetcherFinancial.test.ts",
    "tests/fetcherKline.test.ts",
    "tests/fetcherService.test.ts",
    "tests/intelligentScore.test.ts",
    "tests/scoringAdapter.test.ts",
    "tests/screeningEngine.test.ts",
    "tests/signalGenerator.test.ts",
    "tests/signalPersistence.test.ts",
    "tests/strategyEngine.test.ts",
    "tests/strategySnapshotService.test.ts",
    "tests/themeRegistry.test.ts",
    "tests/tradingService.test.ts",
    "tests/v6Lifecycle.test.ts",
]

# Match an object literal that has symbol, researchStatus, and source, but no pool.
# We use a regex that captures the opening and the source line, then insert pool.
# This is intentionally conservative: object must start on a line with `{` and contain
# `source:` (single/double quoted) followed by a comma, and no `pool:` anywhere inside.
OBJ_RE = re.compile(
    r"(?P<before>\{\s*\n(?P<indent>[ \t]*)symbol:\s*['\"][^'\"]+['\"],\s*\n"
    r"(?:\s*[\w$]+:\s*.+,\s*\n)*?)"
    r"(?P<srcLine>(?P=indent)\s+source:\s*['\"][^'\"]+['\"],)\s*\n"
    r"(?P<after>(?:\s*[\w$]+:\s*.+,\s*\n)*)"
    r"(?=\s*\})",
    re.MULTILINE,
)


def has_pool(text: str, start: int, end: int) -> bool:
    return "pool:" in text[start:end]


def process_file(path: Path) -> int:
    original = path.read_text(encoding="utf-8")
    result = []
    last = 0
    count = 0

    for m in OBJ_RE.finditer(original):
        # Ensure the object contains researchStatus and lacks pool.
        obj_start = m.start()
        obj_end = original.find("}", m.start())
        if obj_end == -1:
            continue
        obj_text = original[obj_start:obj_end]
        if "researchStatus:" not in obj_text:
            continue
        if "pool:" in obj_text:
            continue

        # Insert pool after the source line.
        src_line = m.group("srcLine")
        indent = m.group("indent")
        new_src = f"{src_line}\n{indent}  pool: 'research',"
        result.append(original[last:m.start("srcLine")])
        result.append(new_src)
        last = m.end("srcLine")
        count += 1

    result.append(original[last:])
    new_text = "".join(result)
    if new_text != original:
        path.write_text(new_text, encoding="utf-8")
    return count


def main() -> int:
    total = 0
    for rel in FILES:
        path = Path(rel)
        if not path.exists():
            print(f"SKIP (missing): {rel}")
            continue
        n = process_file(path)
        total += n
        print(f"{rel}: {n} insertion(s)")
    print(f"Total insertions: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
