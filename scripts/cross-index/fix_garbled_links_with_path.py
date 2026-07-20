import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

def decode_garbled(garbled):
    try:
        return garbled.encode('latin-1').decode('utf-8')
    except:
        return garbled

def fix_garbled_links_in_file(filepath):
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
    
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    fixed_count = 0
    
    def replace_link(match):
        nonlocal fixed_count
        text = match.group(1)
        raw_link = match.group(2).strip()
        
        if raw_link.startswith("http://") or raw_link.startswith("https://"):
            return match.group(0)
        if raw_link.startswith("#"):
            return match.group(0)
        
        has_garbled = any(c in raw_link for c in ['ä', 'æ', 'ç'])
        if not has_garbled:
            return match.group(0)
        
        decoded_link = decode_garbled(raw_link)
        
        if decoded_link != raw_link:
            print(f"  FIX: [{text}]({raw_link}) -> [{text}]({decoded_link})")
            fixed_count += 1
            return f"[{text}]({decoded_link})"
        
        return match.group(0)
    
    new_content = link_pattern.sub(replace_link, content)
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
    
    return fixed_count

def main():
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if any(c in content for c in ['ä', 'æ', 'ç']):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files with potential garbled links")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_garbled_links_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total garbled links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()