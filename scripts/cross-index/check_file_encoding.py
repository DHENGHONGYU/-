from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/reference/meta/registry-index.md'
full_path = BASE_DIR / filepath

with open(full_path, "rb") as f:
    content = f.read()

print(f"File size: {len(content)} bytes")
print(f"First 100 bytes: {content[:100]}")
print(f"First 100 bytes hex: {content[:100].hex()}")

for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
    try:
        decoded = content.decode(enc)
        print(f"\nDecoded with {enc}:")
        print(decoded[:200])
    except Exception as e:
        print(f"\nFailed to decode with {enc}: {e}")