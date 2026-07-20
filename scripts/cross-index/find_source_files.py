import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
master_index_path = BASE_DIR / 'docs/00-meta/ai-index/master-index.json'

with open(master_index_path, "r", encoding="utf-8") as f:
    master_index = json.load(f)

doc_ids = ['V9-DOC-QA-010', 'V9-DOC-PROJ-119', 'V9-DOC-ARCH-004', 'V9-DOC-PROJ-182', 
           'V9-DOC-DATA-020', 'V9-DOC-PROJ-295', 'V9-DOC-DATA-065', 'V9-DOC-PROJ-193', 
           'V9-DOC-ARCH-010', 'V9-DOC-META-000']

for doc_id in doc_ids:
    for path, info in master_index.items():
        if info.get('doc_id') == doc_id:
            print(f"{doc_id}: {path}")
            break