import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

def build_filename_index():
    index = {}
    for md_file in DOCS_DIR.rglob("*.md"):
        rel_path = str(md_file.relative_to(BASE_DIR)).replace('\\', '/')
        filename = md_file.name.lower()
        if filename not in index:
            index[filename] = []
        index[filename].append(rel_path)
    return index

def decode_garbled_attempts(garbled):
    attempts = []
    try:
        attempts.append(garbled.encode('latin-1').decode('utf-8'))
    except:
        pass
    try:
        attempts.append(garbled.encode('latin-1').decode('gbk'))
    except:
        pass
    attempts.append(garbled)
    return list(set(attempts))

def find_best_match(filename, filename_index):
    lower_name = filename.lower()
    
    if lower_name in filename_index:
        candidates = filename_index[lower_name]
        if len(candidates) == 1:
            return candidates[0]
        else:
            priority_dirs = ['docs/explanation/', 'docs/reference/', 'docs/how-to/', 'docs/reports/', 'docs/design/', 'docs/_pending-review/']
            for priority_dir in priority_dirs:
                priority_candidates = [c for c in candidates if c.startswith(priority_dir)]
                if priority_candidates:
                    return priority_candidates[0]
            return candidates[0]
    
    for attempt in decode_garbled_attempts(filename):
        attempt_lower = attempt.lower()
        if attempt_lower in filename_index:
            candidates = filename_index[attempt_lower]
            if len(candidates) == 1:
                return candidates[0]
            else:
                priority_dirs = ['docs/explanation/', 'docs/reference/', 'docs/how-to/', 'docs/reports/', 'docs/design/', 'docs/_pending-review/']
                for priority_dir in priority_dirs:
                    priority_candidates = [c for c in candidates if c.startswith(priority_dir)]
                    if priority_candidates:
                        return priority_candidates[0]
                return candidates[0]
    
    for index_name in filename_index.keys():
        if lower_name in index_name or index_name in lower_name:
            candidates = filename_index[index_name]
            if len(candidates) == 1:
                return candidates[0]
            else:
                priority_dirs = ['docs/explanation/', 'docs/reference/', 'docs/how-to/', 'docs/reports/', 'docs/design/', 'docs/_pending-review/']
                for priority_dir in priority_dirs:
                    priority_candidates = [c for c in candidates if c.startswith(priority_dir)]
                    if priority_candidates:
                        return priority_candidates[0]
                return candidates[0]
    
    return None

def fix_links_in_file(filepath, filename_index):
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
        if raw_link.startswith("file://"):
            return match.group(0)
        
        filename = Path(raw_link).name
        if not filename.endswith('.md'):
            return match.group(0)
        
        best_path = find_best_match(filename, filename_index)
        
        if best_path:
            new_link = best_path
            print(f"  FIX: [{text}]({raw_link}) -> [{text}]({new_link})")
            fixed_count += 1
            return f"[{text}]({new_link})"
        
        return match.group(0)
    
    new_content = link_pattern.sub(replace_link, content)
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
    
    return fixed_count

def main():
    print("Building filename index...")
    filename_index = build_filename_index()
    print(f"Indexed {len(filename_index)} unique filenames\n")
    
    print("Scanning for files with unresolved links...")
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
                for text, raw_link in links:
                    if not raw_link.startswith("http://") and not raw_link.startswith("https://") and not raw_link.startswith("#") and not raw_link.startswith("file://"):
                        filename = Path(raw_link).name
                        if filename.endswith('.md'):
                            files_to_check.append(md_file)
                            break
        except:
            pass
    
    print(f"Found {len(files_to_check)} files with potential unresolved links\n")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_links_in_file(filepath, filename_index)
        total_fixed += fixed
    
    print(f"\n{'='*60}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()