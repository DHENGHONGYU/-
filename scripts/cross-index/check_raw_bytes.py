from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/reference/meta/registry-index.md'
full_path = BASE_DIR / filepath

with open(full_path, "rb") as f:
    content = f.read()

lines = content.split(b'\n')
for i, line in enumerate(lines[230:240], 231):
    print(f"Line {i}: {line}")
    print(f"  Hex: {line.hex()}")
    print(f"  UTF-8: {line.decode('utf-8', errors='replace')}")
    print()