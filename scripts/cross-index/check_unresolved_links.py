import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
index_path = BASE_DIR / 'docs/00-meta/ai-index/relation-index.json'

with open(index_path, "r", encoding="utf-8") as f:
    data = json.load(f)

garbled_chars = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

has_garbled = False

for key in ['active_unresolved', 'archived_unresolved']:
    if key in data:
        for doc_id, links in data[key].items():
            if isinstance(links, list):
                for link in links:
                    if any(c in link for c in garbled_chars):
                        print(f"Garbled link in {key}/{doc_id}: {link}")
                        has_garbled = True

if not has_garbled:
    print("No garbled links found in unresolved links!")