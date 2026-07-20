import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

GARBLED_CHARS = ['ä', 'æ', 'ç', 'ß', 'â', 'ã', 'å', 'ð', 'ê', 'ë', 'è', 'ï', 'î', 'í', 'ô', 'ò', 'ó', 'ù', 'û', 'ü', 'ÿ', 'ñ', '¿', '¡']

def build_filename_index():
    index = {}
    for md_file in DOCS_DIR.rglob("*.md"):
        rel_path = str(md_file.relative_to(BASE_DIR)).replace('\\', '/')
        filename = md_file.name
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
    try:
        attempts.append(garbled.encode('utf-8').decode('gbk', errors='ignore'))
    except:
        pass
    try:
        attempts.append(garbled.encode('gbk').decode('utf-8', errors='ignore'))
    except:
        pass
    attempts.append(garbled)
    return list(set(attempts))

def find_best_match(garbled, filename_index):
    attempts = decode_garbled_attempts(garbled)
    for attempt in attempts:
        for filename in filename_index.keys():
            if attempt in filename or filename in attempt:
                if len(filename_index[filename]) == 1:
                    return filename_index[filename][0], filename, attempt
                else:
                    for priority_dir in ['docs/explanation/', 'docs/design/', 'docs/reports/', 'docs/reference/', 'docs/_pending-review/']:
                        for path in filename_index[filename]:
                            if path.startswith(priority_dir):
                                return path, filename, attempt
                    return filename_index[filename][0], filename, attempt
    return None, None, None

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
        
        has_garbled_chars = any(c in raw_link for c in GARBLED_CHARS)
        if not has_garbled_chars:
            return match.group(0)
        
        filename = Path(raw_link).name
        if not filename.endswith('.md'):
            return match.group(0)
        
        best_path, matched_filename, decoded_attempt = find_best_match(filename, filename_index)
        
        if best_path:
            new_link = raw_link.replace(filename, best_path)
            print(f"  FIX: [{text}]({raw_link}) -> [{text}]({new_link})")
            print(f"       Decoded: '{decoded_attempt}' -> Matched: '{matched_filename}'")
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
    
    print("Scanning for files with garbled links...")
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if any(c in content for c in GARBLED_CHARS):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files with potential garbled links\n")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_links_in_file(filepath, filename_index)
        total_fixed += fixed
    
    print(f"\n{'='*60}")
    print(f"Total garbled links fixed: {total_fixed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()