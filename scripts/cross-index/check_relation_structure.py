import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
index_path = BASE_DIR / 'docs/00-meta/ai-index/relation-index.json'

with open(index_path, "r", encoding="utf-8") as f:
    data = json.load(f)

first_key = list(data.keys())[0]
print(f"First key: {first_key}")
print(f"First entry: {json.dumps(data[first_key], indent=2, ensure_ascii=False)}")