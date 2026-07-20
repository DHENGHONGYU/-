import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
index_path = BASE_DIR / 'docs/00-meta/ai-index/relation-index.json'

with open(index_path, "r", encoding="utf-8") as f:
    data = json.load(f)

if 'active_unresolved' in data:
    print("=== Active Unresolved Links ===")
    for doc_id, links in data['active_unresolved'].items():
        if isinstance(links, list):
            print(f"\n{doc_id}:")
            for link_entry in links:
                if isinstance(link_entry, dict):
                    print(f"  - {link_entry.get('link', link_entry)}")
                else:
                    print(f"  - {link_entry}")