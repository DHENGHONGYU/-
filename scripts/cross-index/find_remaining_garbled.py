import json
import re

RELATION_INDEX = 'docs/00-meta/ai-index/relation-index.json'

GARBLED_CHARS = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

def main():
    with open(RELATION_INDEX, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    active_unresolved = data.get('active_unresolved', {})
    
    for source_doc_id, links in active_unresolved.items():
        source_path = None
        documents = data.get('links', {})
        for doc_id, info in documents.items():
            if isinstance(info, dict) and info.get('path') and doc_id == source_doc_id:
                source_path = info.get('path')
                break
        
        if not source_path:
            continue
        
        for link_obj in links:
            raw_link = link_obj.get("link", "")
            has_garbled = any(c in raw_link for c in GARBLED_CHARS)
            if has_garbled:
                print(f"\nSource: {source_path}")
                print(f"  Link: {raw_link}")

if __name__ == "__main__":
    main()