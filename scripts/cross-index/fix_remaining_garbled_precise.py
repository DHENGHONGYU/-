import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

garbled_mappings = {
    '../../explanation/bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../../explanation/design/åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../../explanation/design/åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '../explanation/bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../explanation/design/åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../explanation/design/åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    'åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    'åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md'
}

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

def fix_links_in_file(filepath):
    full_path = BASE_DIR / filepath
    
    content = None
    for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
        try:
            with open(full_path, "r", encoding=enc) as f:
                content = f.read()
                break
        except:
            continue
    
    if content is None:
        print(f"  ERROR: Could not read file")
        return 0
    
    fixed_count = 0
    for old, new in garbled_mappings.items():
        if old in content:
            content = content.replace(old, new)
            fixed_count += 1
            print(f"  FIX: {old} -> {new}")
    
    if fixed_count > 0:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    return fixed_count

def main():
    total_fixed = 0
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        fixed = fix_links_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*60}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()