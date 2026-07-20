import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

wrong_mappings = {
    'completeness-pro文档整理待办清单.md': 'completeness-profile-batch3.md'
}

def fix_wrong_replacements_in_file(filepath):
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
    
    for wrong, correct in wrong_mappings.items():
        if wrong in content:
            content = content.replace(wrong, correct)
            fixed_count += 1
            print(f"  FIX: {wrong} -> {correct}")
    
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
                if any(wrong in content for wrong in wrong_mappings.keys()):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files with wrong replacements")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_wrong_replacements_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total wrong replacements fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()