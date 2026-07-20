import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
index_path = BASE_DIR / 'docs/00-meta/ai-index/relation-index.json'

with open(index_path, "r", encoding="utf-8") as f:
    data = json.load(f)

garbled_chars = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

has_garbled = False
for doc_id, entry in data.items():
    if 'unresolved_links' in entry:
        for link in entry['unresolved_links']:
            if any(c in link for c in garbled_chars):
                print(f"Garbled link in {doc_id}: {link}")
                has_garbled = True

if not has_garbled:
    print("No garbled links found in relation-index.json")