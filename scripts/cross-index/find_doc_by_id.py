import json

with open('docs/00-meta/ai-index/master-index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

doc_ids = ['V9-DOC-PROJ-149', 'V9-DOC-PROJ-174', 'V9-DOC-PROJ-176']

for doc_id in doc_ids:
    found = False
    for key, doc in data.get('documents', {}).items():
        if doc.get('doc_id') == doc_id:
            print(f'{doc_id}: {doc.get("path")}')
            found = True
            break
    if not found:
        print(f'{doc_id}: NOT FOUND')