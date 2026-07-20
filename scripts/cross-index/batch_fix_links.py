import os
import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
MASTER_INDEX_PATH = DOCS_DIR / "00-meta" / "ai-index" / "master-index.json"
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

def read_file_with_encoding(filepath):
    for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
        try:
            with open(filepath, "r", encoding=enc) as f:
                return f.read(), enc
        except UnicodeDecodeError:
            continue
    return None, None

def fix_links_in_file(filepath, fs_index):
    content, encoding = read_file_with_encoding(filepath)
    
    if content is None:
        print(f"  WARNING: Cannot decode file, skipping: {filepath}")
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
        if not raw_link.endswith(".md"):
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
        print(f"  Wrote file with UTF-8 encoding (was {encoding})")
    
    return fixed_count

def main():
    print("Loading filesystem index...")
    fs_index = build_filesystem_index()
    print(f"Indexed {len(fs_index)} unique filenames")
    
    print("\nLoading relation-index.json...")
    relation_index = load_json(RELATION_INDEX_PATH)
    
    active_unresolved = relation_index.get("active_unresolved", {})
    
    total_fixed = 0
    files_processed = 0
    
    print("\nProcessing files with unresolved links...")
    for source_doc_id, links in active_unresolved.items():
        if not links:
            continue
        
        source_path = None
        for doc in relation_index.get("links", {}).values():
            if doc.get("path") and "UNKNOWN" not in doc["path"]:
                outgoing = doc.get("outgoing", [])
                if outgoing is None:
                    outgoing = []
                if source_doc_id in outgoing or source_doc_id == doc.get("path"):
                    source_path = doc["path"]
                    break
        
        if not source_path:
            print(f"  WARNING: Cannot find source path for {source_doc_id}")
            continue
        
        filepath = BASE_DIR / source_path
        if not filepath.exists():
            print(f"  WARNING: File not found: {source_path}")
            continue
        
        print(f"\nProcessing: {source_path}")
        fixed = fix_links_in_file(filepath, fs_index)
        total_fixed += fixed
        files_processed += 1
    
    print(f"\n{'='*50}")
    print(f"Summary:")
    print(f"  Files processed: {files_processed}")
    print(f"  Links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()