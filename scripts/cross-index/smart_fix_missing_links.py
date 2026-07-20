import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
RELATION_INDEX_PATH = DOCS_DIR / "00-meta" / "ai-index" / "relation-index.json"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_filesystem_index():
    fs_index = {}
    for md_file in DOCS_DIR.rglob("*.md"):
        rel_path = str(md_file.relative_to(BASE_DIR)).replace("\\", "/")
        filename = md_file.name
        if filename not in fs_index:
            fs_index[filename] = []
        fs_index[filename].append(rel_path)
    
    return fs_index

def fix_missing_links_in_file(filepath, fs_index):
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
        
        base_link = re.sub(r'\?.*$', '', raw_link)
        base_link = re.sub(r'#.*$', '', base_link)
        
        filename = Path(base_link).name
        
        if not filename.endswith('.md'):
            return match.group(0)
        
        if filename in fs_index:
            candidates = fs_index[filename]
            if len(candidates) == 1:
                new_link = candidates[0]
                if new_link != base_link:
                    print(f"  FIX: [{text}]({raw_link}) -> [{text}]({new_link})")
                    fixed_count += 1
                    return f"[{text}]({new_link})"
            elif len(candidates) > 1:
                for priority_dir in ['docs/how-to/', 'docs/guides/', 'docs/explanation/', 'docs/reports/', 'docs/reference/', 'docs/ai/', 'docs/prompts/', 'docs/ops/']:
                    priority_candidates = [c for c in candidates if c.startswith(priority_dir)]
                    if len(priority_candidates) == 1:
                        new_link = priority_candidates[0]
                        print(f"  FIX: [{text}]({raw_link}) -> [{text}]({new_link})")
                        fixed_count += 1
                        return f"[{text}]({new_link})"
                
                new_link = candidates[0]
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
    print("Loading relation-index.json...")
    relation_index = load_json(RELATION_INDEX_PATH)
    
    print("Building filesystem index...")
    fs_index = build_filesystem_index()
    
    active_unresolved = relation_index.get("active_unresolved", {})
    
    doc_id_to_path = {}
    for key, value in relation_index.get("links", {}).items():
        if value.get("path"):
            doc_id_to_path[key] = value["path"]
    
    total_fixed = 0
    files_processed = 0
    
    print("Processing files with unresolved links...")
    for source_doc_id, links in active_unresolved.items():
        if not links:
            continue
        
        source_path = doc_id_to_path.get(source_doc_id)
        
        if not source_path:
            for key, path in doc_id_to_path.items():
                if key.endswith(source_doc_id):
                    source_path = path
                    break
        
        if not source_path:
            continue
        
        filepath = BASE_DIR / source_path
        if not filepath.exists():
            continue
        
        print(f"\nProcessing: {source_path}")
        fixed = fix_missing_links_in_file(filepath, fs_index)
        total_fixed += fixed
        files_processed += 1
    
    print(f"\n{'='*50}")
    print(f"Summary:")
    print(f"  Files processed: {files_processed}")
    print(f"  Links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()