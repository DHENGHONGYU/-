from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_check = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

garbled_hex_patterns = [
    'e58f91e587ba', 
    'e59b9ee6bba4'
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
            print(f"  Position: byte {byte_idx}")
            context = content[max(0, byte_idx-30):byte_idx+50]
            print(f"  Context: {context}")
            print(f"  Decoded: {context.decode('utf-8', errors='replace')}")
        else:
            print(f"  NOT FOUND hex pattern: {pattern}")