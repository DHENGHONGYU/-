import json

RELATION_INDEX = 'docs/00-meta/ai-index/relation-index.json'

def main():
    with open(RELATION_INDEX, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    active_unresolved = data.get('active_unresolved', {})
    
    print(f"Total active unresolved sources: {len(active_unresolved)}\n")
    
    for source_doc_id, links in active_unresolved.items():
        source_path = None
        documents = data.get('links', {})
        for doc_id, info in documents.items():
            if isinstance(info, dict) and info.get('path') and doc_id == source_doc_id:
                source_path = info.get('path')
                break
        
        if not source_path:
            continue
        
        print(f"Source: {source_path}")
        print(f"  Unresolved links: {len(links)}")
        for link_obj in links:
            raw_link = link_obj.get("link", "")
            resolved = link_obj.get("resolved", "")
            print(f"    Link: {raw_link}")
            if resolved:
                print(f"    Resolved: {resolved}")
        print()

if __name__ == "__main__":
    main()