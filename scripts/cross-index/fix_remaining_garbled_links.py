import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

fixes = {
    '报�?': '报告',
    '方�?': '方案',
    '演�?': '演练',
    '定�?': '定义',
    '整合�?': '整合版',
    '中�?': '中心',
    '总控�?': '总控舱',
    '核心资�?': '核心资源',
    '解析�?': '解析/',
    '测�?': '测试',
}

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for old, new in fixes.items():
        content = content.replace(old, new)
    
    content = content.replace(' �?', ' / ')
    
    if content != original:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"No changes needed for {filepath}")

for filepath in files_to_fix:
    fix_file(filepath)

print("\nDone!")