import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
master_index_path = BASE_DIR / 'docs/00-meta/ai-index/master-index.json'

with open(master_index_path, "r", encoding="utf-8") as f:
    master_index = json.load(f)

print(f"Keys: {list(master_index.keys())}")

if 'links' in master_index:
    first_key = list(master_index['links'].keys())[0]
    print(f"\nFirst links key: {first_key}")
    print(f"First links value: {master_index['links'][first_key]}")