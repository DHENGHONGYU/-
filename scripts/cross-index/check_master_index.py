import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
master_index_path = BASE_DIR / 'docs/00-meta/ai-index/master-index.json'

with open(master_index_path, "r", encoding="utf-8") as f:
    master_index = json.load(f)

first_key = list(master_index.keys())[0]
print(f"First key: {first_key}")
print(f"First value type: {type(master_index[first_key])}")
print(f"First value: {master_index[first_key]}")