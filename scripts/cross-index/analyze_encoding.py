from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/reference/meta/registry-index.md'
full_path = BASE_DIR / filepath

with open(full_path, "rb") as f:
    content = f.read()

title_bytes = content[13:33]
print(f"Title bytes (13-33): {title_bytes}")
print(f"Title hex: {title_bytes.hex()}")

print("\nTrying different decoding methods:")

print("\n1. Direct UTF-8 decode:")
try:
    print(f"   {title_bytes.decode('utf-8')}")
except Exception as e:
    print(f"   ERROR: {e}")

print("\n2. Latin-1 decode then UTF-8:")
latin1_str = title_bytes.decode('latin-1')
latin1_back = latin1_str.encode('latin-1')
try:
    print(f"   {latin1_back.decode('utf-8')}")
except Exception as e:
    print(f"   ERROR: {e}")

print("\n3. What the hex represents:")
hex_str = title_bytes.hex()
pairs = [hex_str[i:i+2] for i in range(0, len(hex_str), 2)]
print(f"   Byte pairs: {pairs}")

print("\n4. UTF-8 for '文档索引':")
expected = '文档索引'.encode('utf-8')
print(f"   Expected hex: {expected.hex()}")
print(f"   Expected bytes: {expected}")