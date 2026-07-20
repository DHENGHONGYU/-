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
        fs_index[rel_path.lower()] = rel_path
    return fs_index

def main():
    print("Loading relation-index.json...")
    relation_index = load_json(RELATION_INDEX_PATH)
    
    active_unresolved = relation_index.get("active_unresolved", {})
    
    fs_index = build_filesystem_index()
    
    query_links = []
    missing_links = []
    chinese_links = []
    
    for source_doc_id, links in active_unresolved.items():
        if not links:
            continue
        
        for link_obj in links:
            raw_link = link_obj.get("link", "")
            resolved = link_obj.get("resolved", "")
            
            if "?" in raw_link:
                base_link = re.sub(r'\?.*$', '', raw_link)
                base_link = re.sub(r'#.*$', '', base_link)
                query_links.append({
                    'source': source_doc_id,
                    'raw': raw_link,
                    'base': base_link,
                    'exists': base_link.lower() in fs_index
                })
            else:
                missing_links.append({
                    'source': source_doc_id,
                    'raw': raw_link,
                    'resolved': resolved
                })
                
                has_chinese = any('\u4e00' <= c <= '\u9fff' for c in raw_link)
                if has_chinese:
                    chinese_links.append({
                        'source': source_doc_id,
                        'raw': raw_link,
                        'resolved': resolved
                    })
    
    print(f"\n=== Query Params Links ({len(query_links)}) ===")
    resolved_qp = [l for l in query_links if l['exists']]
    unresolved_qp = [l for l in query_links if not l['exists']]
    print(f"Resolved after stripping params: {len(resolved_qp)}")
    print(f"Still unresolved: {len(unresolved_qp)}")
    
    print(f"\n=== Chinese Links ({len(chinese_links)}) ===")
    for link in chinese_links[:30]:
        print(f"  {link['raw']} -> {link['resolved']}")
    
    print(f"\n=== Missing File Links ({len(missing_links)}) ===")
    print(f"Total missing_file: {len(missing_links)}")
    
    print(f"\n=== Total Active Unresolved: {sum(len(v) for v in active_unresolved.values())} ===")

if __name__ == "__main__":
    main()