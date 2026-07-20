import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
index_path = BASE_DIR / 'docs/00-meta/ai-index/relation-index.json'

with open(index_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Keys: {list(data.keys())[:10]}")
print(f"Total keys: {len(data)}")

for key, value in list(data.items())[:5]:
    print(f"\nKey: {key}")
    print(f"Type: {type(value)}")
    if isinstance(value, dict):
        print(f"Subkeys: {list(value.keys())}")
        if 'unresolved_links' in value:
            print(f"Unresolved links: {value['unresolved_links'][:5] if isinstance(value['unresolved_links'], list) else value['unresolved_links']}")