import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

links_to_fix = [
    {
        'file': 'explanation/design/00-readme.md',
        'old_link': 'docs/explanation/design/00-readme.md',
        'new_link': './00-readme.md'
    },
    {
        'file': 'explanation/design/databridge改进建议整改报告.md',
        'old_link': 'docs/explanation/design/databridge改进建议整改报告.md',
        'new_link': './databridge改进建议整改报告.md'
    }
]

def fix_link_in_file(filepath, old_link, new_link):
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
    
    pattern = re.compile(r'\[([^\]]+)\]\(\s*' + re.escape(old_link) + r'\s*\)')
    matches = list(pattern.finditer(content))
    
    if not matches:
        return 0
    
    fixed_count = 0
    for match in matches:
        text = match.group(1)
        old_full = match.group(0)
        new_full = f"[{text}]({new_link})"
        content = content.replace(old_full, new_full)
        fixed_count += 1
        print(f"  FIX: [{text}]({old_link}) -> [{text}]({new_link})")
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    
    return fixed_count

def main():
    total_fixed = 0
    for item in links_to_fix:
        filepath = DOCS_DIR / item['file']
        if not filepath.exists():
            print(f"File not found: {filepath}")
            continue
        
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_link_in_file(filepath, item['old_link'], item['new_link'])
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()