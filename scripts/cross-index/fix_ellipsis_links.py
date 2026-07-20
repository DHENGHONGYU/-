import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

fixes = {
    '../archive/â€?RCA-report.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-RCA-report.md',
    '../archive/â€?file-wandering-report.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-file-wandering-report.md',
    '../archive/â€?optimization-prompt.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-optimization-prompt.md',
    '../archive/â€?task-list.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-task-list.md'
}

def fix_links_in_file(filepath):
    content = None
    for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
        try:
            with open(filepath, "r", encoding=enc) as f:
                content = f.read()
                break
        except:
            continue
    
    if content is None:
        return 0
    
    fixed_count = 0
    for old, new in fixes.items():
        if old in content:
            content = content.replace(old, new)
            fixed_count += 1
            print(f"  FIX: {old} -> {new}")
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    
    return fixed_count

def main():
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if any(old in content for old in fixes.keys()):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files to fix")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_links_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()