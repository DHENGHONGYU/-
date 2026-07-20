import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
RELATION_INDEX_PATH = DOCS_DIR / "00-meta" / "ai-index" / "relation-index.json"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def decode_garbled(garbled):
    results = []
    for enc in ['latin-1', 'gbk', 'gb2312', 'big5']:
        try:
            decoded = garbled.encode('utf-8').decode(enc)
            results.append(f'{enc}: {decoded}')
        except:
            pass
        try:
            decoded = garbled.encode(enc).decode('utf-8')
            results.append(f'{enc}->utf8: {decoded}')
        except:
            pass
    return results[:3]

def main():
    print("Loading relation-index.json...")
    relation_index = load_json(RELATION_INDEX_PATH)
    
    active_unresolved = relation_index.get("active_unresolved", {})
    
    doc_id_to_path = {}
    for key, value in relation_index.get("links", {}).items():
        if value.get("path"):
            doc_id_to_path[key] = value["path"]
    
    category_stats = {
        'garbled': [],
        'truncated': [],
        'placeholder': [],
        'valid_missing': [],
        'self_reference': []
    }
    
    print("\n" + "="*80)
    print("COMPREHENSIVE ANALYSIS OF REMAINING UNRESOLVED LINKS")
    print("="*80)
    print(f"\nTotal active unresolved links: {sum(len(links) for links in active_unresolved.values())}")
    print(f"Source documents with unresolved links: {len(active_unresolved)}")
    
    for source_doc_id, links in active_unresolved.items():
        source_path = doc_id_to_path.get(source_doc_id, source_doc_id)
        
        print(f"\n{'='*60}")
        print(f"Source: {source_path}")
        print(f"{'='*60}")
        
        for link_obj in links:
            raw_link = link_obj.get("link", "")
            resolved = link_obj.get("resolved", "")
            
            print(f"\n  Raw link: {raw_link}")
            
            if resolved and resolved != raw_link:
                print(f"  Resolved: {resolved}")
            
            if any(c in raw_link for c in ['ä', 'æ', 'ç']) or '%' in raw_link:
                print("  Category: GARBLED (encoding corruption)")
                decoded = decode_garbled(raw_link)
                if decoded:
                    print("  Decode attempts:")
                    for d in decoded:
                        print(f"    {d}")
                category_stats['garbled'].append(raw_link)
            
            elif '…' in raw_link:
                print("  Category: TRUNCATED (filename truncated)")
                category_stats['truncated'].append(raw_link)
            
            elif raw_link in ['doc1.md', 'doc2.md']:
                print("  Category: PLACEHOLDER (temporary placeholder)")
                category_stats['placeholder'].append(raw_link)
            
            elif raw_link.startswith('docs/') and raw_link.endswith('.md'):
                filename = Path(raw_link).name
                if filename in ['AGENTS.md', 'ARCHIVE_INDEX.md', 'path.md']:
                    print("  Category: VALID_MISSING (document truly missing)")
                    category_stats['valid_missing'].append(raw_link)
            
            elif raw_link == resolved:
                print("  Category: SELF_REFERENCE (link resolves to itself but marked unresolved)")
                category_stats['self_reference'].append(raw_link)
            
            else:
                print("  Category: UNKNOWN")
    
    print("\n" + "="*80)
    print("CATEGORY SUMMARY")
    print("="*80)
    for category, items in category_stats.items():
        print(f"\n  {category.upper()}: {len(items)} links")
        unique_items = sorted(set(items))
        for item in unique_items[:10]:
            print(f"    - {item}")
        if len(unique_items) > 10:
            print(f"    ... and {len(unique_items) - 10} more")

if __name__ == "__main__":
    main()