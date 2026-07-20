import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_check = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

for filepath in files_to_check:
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    links = re.findall(r'\[([^\]]+)\]\(([^)\s]+)\)', content)
    print(f"\n=== {filepath} ===")
    for text, path in links:
        if '?' in path or path.startswith('../'):
            print(f"  [{text}]({path})")