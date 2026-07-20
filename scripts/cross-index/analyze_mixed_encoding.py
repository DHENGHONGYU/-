from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/reference/meta/registry-index.md'
full_path = BASE_DIR / filepath

with open(full_path, "rb") as f:
    content = f.read()

print(f"File size: {len(content)} bytes")

for i in range(0, len(content), 1000):
    chunk = content[i:i+1000]
    try:
        chunk.decode('utf-8')
    except UnicodeDecodeError as e:
        pos = int(str(e).split('position ')[1].split('-')[0])
        actual_pos = i + pos
        print(f"\nError at byte {actual_pos}")
        print(f"Context ({actual_pos-20} to {actual_pos+20}):")
        print(f"  Bytes: {content[actual_pos-20:actual_pos+20]}")
        print(f"  Hex: {content[actual_pos-20:actual_pos+20].hex()}")
        try:
            print(f"  UTF-8 decode: {content[actual_pos-20:actual_pos+20].decode('utf-8', errors='replace')}")
        except:
            pass
        break