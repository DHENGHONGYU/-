from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_check = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

garbled_hex_patterns = [
    'c3a6c289c2b9c3a6c2acc2a1',
    'c3a9c2abc298c3a4c2bbc2b7',
    'c3a5c28fc291c3a5c287c2ba',
    'c3a5c29bc29ec3a6c2bbc2a4'
]

for filepath in files_to_check:
    full_path = BASE_DIR / filepath
    with open(full_path, "rb") as f:
        content = f.read()
    
    content_hex = content.hex()
    print(f"\n=== {filepath} ===")
    for pattern in garbled_hex_patterns:
        if pattern in content_hex:
            print(f"  FOUND hex pattern: {pattern}")
            idx = content_hex.find(pattern)
            byte_idx = idx // 2
            context = content[max(0, byte_idx-30):byte_idx+80]
            print(f"  Decoded: {context.decode('utf-8', errors='replace')}")
        else:
            print(f"  NOT FOUND hex pattern: {pattern}")