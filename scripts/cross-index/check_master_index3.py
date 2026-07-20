import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
master_index_path = BASE_DIR / 'docs/00-meta/ai-index/master-index.json'

with open(master_index_path, "r", encoding="utf-8") as f:
    master_index = json.load(f)

if 'documents' in master_index:
    first_key = list(master_index['documents'].keys())[0]
    print(f"First documents key: {first_key}")
    print(f"First documents value: {master_index['documents'][first_key]}")