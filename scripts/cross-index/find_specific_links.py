import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_check = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

patterns_to_find = [
    r'\?2026-07-08\.md',
    r'\?r01\.md',
    r'\?r03\.md',
    r'../../explanation/',
    r'../explanation/',
    r'../../_pending-review/',
    r'../_pending-review/'
]

for filepath in files_to_check:
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    print(f"\n=== {filepath} ===")
    for pattern in patterns_to_find:
        matches = re.findall(r'\[[^\]]+\]\(([^)\s]+)\)', content)
        for path in matches:
            if pattern in path:
                print(f"  Pattern '{pattern}': {path}")