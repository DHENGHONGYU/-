from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_check = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

search_strings = ['åå¸è®¡', 'åæ»']

for filepath in files_to_check:
    full_path = BASE_DIR / filepath
    with open(full_path, "rb") as f:
        content = f.read()
    
    print(f"\n=== {filepath} ===")
    for s in search_strings:
        s_bytes = s.encode('utf-8')
        if s_bytes in content:
            print(f"  FOUND: '{s}'")
            idx = content.find(s_bytes)
            print(f"  Position: {idx}")
            print(f"  Context: {content[idx-20:idx+50]}")
            print(f"  Hex: {content[idx:idx+50].hex()}")
        else:
            print(f"  NOT FOUND: '{s}'")
    
    content_str = content.decode('utf-8')
    for s in search_strings:
        if s in content_str:
            print(f"  STRING FOUND: '{s}'")
        else:
            print(f"  STRING NOT FOUND: '{s}'")