from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
filepath = BASE_DIR / 'docs/reference/meta/registry-index.md'

with open(filepath, "rb") as f:
    raw_bytes = f.read()

print(f"Total bytes: {len(raw_bytes)}")
print(f"\nBytes around 6259:")
for i in range(6250, min(6280, len(raw_bytes))):
    print(f"  [{i}] 0x{raw_bytes[i]:02x} = '{chr(raw_bytes[i])}'")