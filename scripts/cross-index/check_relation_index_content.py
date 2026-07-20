import json

with open('docs/00-meta/ai-index/relation-index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = data.get('active_unresolved', {})
for doc_id, links in active.items():
    for link in links:
        raw_link = link.get('link', '')
        resolved = link.get('resolved', '')
        if '\u00e5' in raw_link or '\u00e6' in raw_link or '\u00c3' in raw_link:
            print(f'{doc_id}:')
            print(f'  link: {repr(raw_link)}')
            print(f'  resolved: {repr(resolved)}')
            print()