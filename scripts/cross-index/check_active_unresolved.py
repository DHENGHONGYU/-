import json

with open('docs/00-meta/ai-index/relation-index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = data.get('active_unresolved', {})
for doc_id, links in active.items():
    print(f'{doc_id}:')
    for link in links:
        print(f'  link: {link.get("link")}')
        print(f'  resolved: {link.get("resolved")}')
    print()