import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
RELATION_INDEX = DOCS_DIR / "00-meta" / "ai-index" / "relation-index.json"
MASTER_INDEX = DOCS_DIR / "00-meta" / "ai-index" / "master-index.json"

def load_relation_index():
    with open(RELATION_INDEX, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_master_index():
    with open(MASTER_INDEX, 'r', encoding='utf-8') as f:
        return json.load(f)

def build_filename_index(master_index):
    index = {}
    documents = master_index.get('documents', {})
    for doc_id, info in documents.items():
        path = info.get('path', '')
        if path.endswith('.md'):
            filename = Path(path).name.lower()
            if filename not in index:
                index[filename] = []
            index[filename].append(path)
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
            priority_dirs = ['docs/explanation/', 'docs/reference/', 'docs/how-to/', 'docs/reports/', 'docs/design/', 'docs/_pending-review/', 'docs/00-meta/']
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
                priority_dirs = ['docs/explanation/', 'docs/reference/', 'docs/how-to/', 'docs/reports/', 'docs/design/', 'docs/_pending-review/', 'docs/00-meta/']
                for priority_dir in priority_dirs:
                    priority_candidates = [c for c in candidates if c.startswith(priority_dir)]
                    if priority_candidates:
                        return priority_candidates[0]
                return candidates[0]
    
    return None

def fix_unresolved_links(relation_index, filename_index):
    active_unresolved = relation_index.get('active_unresolved', {})
    fixed_count = 0
    
    for source_doc_id, links in active_unresolved.items():
        source_path = None
        documents = relation_index.get('links', {})
        for doc_id, info in documents.items():
            if isinstance(info, dict) and info.get('path') and doc_id == source_doc_id:
                source_path = info.get('path')
                break
        
        if not source_path:
            continue
        
        full_path = BASE_DIR / source_path
        
        content = None
        for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
            try:
                with open(full_path, "r", encoding=enc) as f:
                    content = f.read()
                    break
            except:
                continue
        
        if content is None:
            continue
        
        link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
        file_changed = False
        
        def replace_link(match):
            nonlocal file_changed, fixed_count
            text = match.group(1)
            raw_link = match.group(2).strip()
            
            if raw_link.startswith("http://") or raw_link.startswith("https://"):
                return match.group(0)
            if raw_link.startswith("#"):
                return match.group(0)
            
            filename = Path(raw_link).name
            if not filename.endswith('.md'):
                return match.group(0)
            
            best_path = find_best_match(filename, filename_index)
            
            if best_path:
                new_link = best_path
                print(f"  FIX: [{text}]({raw_link}) -> [{text}]({new_link})")
                file_changed = True
                fixed_count += 1
                return f"[{text}]({new_link})"
            
            return match.group(0)
        
        new_content = link_pattern.sub(replace_link, content)
        
        if file_changed:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"\nUpdated: {source_path}")
    
    return fixed_count

def main():
    print("Loading relation index...")
    relation_index = load_relation_index()
    
    print("Loading master index...")
    master_index = load_master_index()
    
    print("Building filename index...")
    filename_index = build_filename_index(master_index)
    print(f"Indexed {len(filename_index)} unique filenames\n")
    
    active_unresolved = relation_index.get('active_unresolved', {})
    print(f"Total active unresolved sources: {len(active_unresolved)}")
    
    total_fixed = fix_unresolved_links(relation_index, filename_index)
    
    print(f"\n{'='*60}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()