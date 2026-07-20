import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

def build_filesystem_index():
    fs_index = {}
    for md_file in DOCS_DIR.rglob("*.md"):
        rel_path = str(md_file.relative_to(BASE_DIR)).replace("\\", "/")
        filename = md_file.name
        if filename not in fs_index:
            fs_index[filename] = []
        fs_index[filename].append(rel_path)
    return fs_index

def fix_garbled_links_in_file(filepath, fs_index):
    content = None
    for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
        try:
            with open(filepath, "r", encoding=enc) as f:
                content = f.read()
                original_encoding = enc
                break
        except:
            continue
    
    if content is None:
        print(f"  WARNING: Cannot decode file: {filepath}")
        return 0
    
    fixed_count = 0
    
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    def replace_link(match):
        nonlocal fixed_count
        text = match.group(1)
        raw_link = match.group(2).strip()
        
        if raw_link.startswith("http://") or raw_link.startswith("https://"):
            return match.group(0)
        if raw_link.startswith("#"):
            return match.group(0)
        
        base_link = re.sub(r'\?.*$', '', raw_link)
        base_link = re.sub(r'#.*$', '', base_link)
        
        filename = os.path.basename(base_link)
        
        if filename in fs_index:
            candidates = fs_index[filename]
            if len(candidates) == 1:
                new_link = candidates[0]
                if new_link != base_link:
                    print(f"  FIX: {raw_link} -> {new_link}")
                    fixed_count += 1
                    return f"[{text}]({new_link})"
        
        return match.group(0)
    
    new_content = link_pattern.sub(replace_link, content)
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
    
    return fixed_count

def main():
    print("Loading filesystem index...")
    fs_index = build_filesystem_index()
    print(f"Indexed {len(fs_index)} unique filenames")
    
    garbled_patterns = [
        'v9-Ŀ�깦���嵥',
        '�ĵ���������嵥',
        'file.md',
        'file:///'
    ]
    
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if any(pattern in content for pattern in garbled_patterns):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"\nFound {len(files_to_check)} files with garbled links")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_garbled_links_in_file(filepath, fs_index)
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()