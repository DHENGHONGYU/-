import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

old_path = 'archive/docs/archive/ARCHIVE_INDEX.md'
new_path = 'docs/archive/ARCHIVE_INDEX.md'

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
    
    if old_path in content:
        content = content.replace(old_path, new_path)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return 1
    return 0

def main():
    files_fixed = 0
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if old_path in content:
                    print(f"Fixing: {md_file.relative_to(BASE_DIR)}")
                    files_fixed += fix_links_in_file(md_file)
        except:
            pass
    
    print(f"\nTotal files fixed: {files_fixed}")

if __name__ == "__main__":
    main()