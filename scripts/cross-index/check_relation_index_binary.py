from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/00-meta/ai-index/relation-index.json'
full_path = BASE_DIR / filepath

with open(full_path, "rb") as f:
    content = f.read()

content_str = content.decode('utf-8')

garbled_patterns = ['åå¸', 'åæ»']
for pattern in garbled_patterns:
    if pattern in content_str:
        print(f"FOUND in string: '{pattern}'")
        idx = content_str.find(pattern)
        print(f"Position: {idx}")
        print(f"Context: {content_str[idx-30:idx+50]}")
    else:
        print(f"NOT FOUND in string: '{pattern}'")

print("\nChecking raw bytes for garbled patterns...")
garbled_hex_patterns = [
    'c3a5c28fc291',
    'c3a5c29bc29e'
]
content_hex = content.hex()
for pattern in garbled_hex_patterns:
    if pattern in content_hex:
        print(f"FOUND hex: {pattern}")
    else:
        print(f"NOT FOUND hex: {pattern}")