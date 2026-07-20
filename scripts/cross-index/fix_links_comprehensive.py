import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

link_replacements = {
    '../../explanation/b批次高价值孤儿集成状态报告?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../explanation/b批次高价值孤儿集成状态报告?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../../explanation/design/发布计划与评审?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../explanation/design/发布计划与评审?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '发布计划与评审?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../../explanation/design/回滚方案与演练?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '../explanation/design/回滚方案与演练?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '回滚方案与演练?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md'
}

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    changes = 0
    
    for old, new in link_replacements.items():
        if old in content:
            content = content.replace(old, new)
            changes += 1
            print(f"  REPLACED: {old} -> {new}")
    
    if content != original:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    return changes

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        changes = fix_file(filepath)
        if changes > 0:
            print(f"  Total changes: {changes}")
        else:
            print("  No changes needed")

if __name__ == "__main__":
    main()