import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

def fix_file_urls_in_file(filepath):
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
    
    file_url_pattern = re.compile(r'\[([^\]]+)\]\(file:///[a-zA-Z]:/([^)]+)\)')
    
    matches = list(file_url_pattern.finditer(content))
    if not matches:
        return 0
    
    fixed_count = 0
    for match in matches:
        text = match.group(1)
        full_path = match.group(2).replace('\\', '/')
        
        rel_path = None
        if full_path.startswith('FinSightV9/docs/'):
            rel_path = full_path[len('FinSightV9/docs/'):]
        elif full_path.startswith('FinSightV9/'):
            rel_path = full_path[len('FinSightV9/'):]
        
        if rel_path and rel_path.endswith('.md'):
            old_full = match.group(0)
            new_full = f"[{text}]({rel_path})"
            content = content.replace(old_full, new_full)
            fixed_count += 1
            print(f"  FIX: [{text}](file:///{full_path}) -> [{text}]({rel_path})")
    
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
                if 'file:///' in content:
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files with file:// links")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_file_urls_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total file:// links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()