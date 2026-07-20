import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
RELATION_INDEX_PATH = DOCS_DIR / "00-meta" / "ai-index" / "relation-index.json"
MASTER_INDEX_PATH = DOCS_DIR / "00-meta" / "ai-index" / "master-index.json"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_filesystem_index():
    fs_index = {}
    for md_file in DOCS_DIR.rglob("*.md"):
        rel_path = str(md_file.relative_to(BASE_DIR)).replace("\\", "/")
        fs_index[rel_path.lower()] = rel_path
    return fs_index

def get_doc_info(doc_id, master_index):
    for prop in master_index.get("documents", {}).keys():
        doc = master_index["documents"].get(prop, {})
        if doc.get("doc_id") == doc_id or prop == doc_id:
            return {
                "path": doc.get("path", "UNKNOWN"),
                "tier": doc.get("tier", "unknown"),
                "status": doc.get("status", "unknown")
            }
    return {"path": "UNKNOWN", "tier": "unknown", "status": "unknown"}

def main():
    print("Loading relation-index.json...")
    relation_index = load_json(RELATION_INDEX_PATH)
    
    print("Loading master-index.json...")
    master_index = load_json(MASTER_INDEX_PATH)
    
    fs_index = build_filesystem_index()
    
    active_unresolved = relation_index.get("active_unresolved", {})
    
    bucket_a = []
    bucket_b = []
    bucket_c = []
    
    for source_doc_id, links in active_unresolved.items():
        if not links:
            continue
        
        source_info = get_doc_info(source_doc_id, master_index)
        
        for link_obj in links:
            raw_link = link_obj.get("link", "")
            resolved = link_obj.get("resolved", "")
            
            if raw_link.startswith("file://"):
                bucket_c.append({
                    'source': source_doc_id,
                    'source_path': source_info['path'],
                    'source_tier': source_info['tier'],
                    'raw': raw_link,
                    'resolved': resolved,
                    'category': 'external_file_url'
                })
                continue
            
            if "?" in raw_link:
                base_link = re.sub(r'\?.*$', '', raw_link)
                base_link = re.sub(r'#.*$', '', base_link)
                
                if base_link.lower() in fs_index:
                    bucket_a.append({
                        'source': source_doc_id,
                        'source_path': source_info['path'],
                        'source_tier': source_info['tier'],
                        'raw': raw_link,
                        'resolved': resolved,
                        'base': base_link,
                        'exists': fs_index[base_link.lower()],
                        'category': 'query_params_fixable'
                    })
                else:
                    bucket_b.append({
                        'source': source_doc_id,
                        'source_path': source_info['path'],
                        'source_tier': source_info['tier'],
                        'raw': raw_link,
                        'resolved': resolved,
                        'category': 'query_params_missing'
                    })
            else:
                if raw_link.lower() in fs_index:
                    bucket_a.append({
                        'source': source_doc_id,
                        'source_path': source_info['path'],
                        'source_tier': source_info['tier'],
                        'raw': raw_link,
                        'resolved': resolved,
                        'exists': fs_index[raw_link.lower()],
                        'category': 'case_mismatch'
                    })
                else:
                    bucket_b.append({
                        'source': source_doc_id,
                        'source_path': source_info['path'],
                        'source_tier': source_info['tier'],
                        'raw': raw_link,
                        'resolved': resolved,
                        'category': 'genuinely_missing'
                    })
    
    print("\n" + "="*80)
    print("UNRESOLVED LINKS TRIAGE REPORT")
    print("="*80)
    print(f"\nTotal Active Unresolved Links: {sum(len(v) for v in active_unresolved.values())}")
    print(f"\n--- Bucket A: Fixable (files exist under different names/paths) ---")
    print(f"Count: {len(bucket_a)}")
    for link in bucket_a[:20]:
        print(f"  [{link['source_tier']}] {link['source_path']}")
        print(f"    {link['raw']} -> {link.get('exists', 'N/A')}")
    
    print(f"\n--- Bucket B: Missing Documents (need stub/placeholder creation) ---")
    print(f"Count: {len(bucket_b)}")
    unique_missing = {}
    for link in bucket_b:
        filename = re.sub(r'\?.*$', '', link['raw'])
        filename = re.sub(r'#.*$', '', filename)
        filename = Path(filename).name
        if filename not in unique_missing:
            unique_missing[filename] = []
        unique_missing[filename].append(link['source_path'])
    
    for filename, sources in sorted(unique_missing.items())[:30]:
        print(f"  {filename} (referenced by {len(sources)} files)")
    
    print(f"\n--- Bucket C: External URLs / file:// links ---")
    print(f"Count: {len(bucket_c)}")
    for link in bucket_c[:10]:
        print(f"  [{link['source_tier']}] {link['source_path']}")
        print(f"    {link['raw']}")
    
    print(f"\n--- Summary ---")
    print(f"  Bucket A (Fixable): {len(bucket_a)}")
    print(f"  Bucket B (Missing): {len(bucket_b)}")
    print(f"  Bucket C (External): {len(bucket_c)}")

if __name__ == "__main__":
    main()