from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
filepath = BASE_DIR / 'docs/reference/meta/registry-index.md'

with open(filepath, "rb") as f:
    content = bytearray(f.read())

print(f"Original length: {len(content)}")
print(f"Byte at 6259: 0x{content[6259]:02x}")
print(f"Byte at 6260: 0x{content[6260]:02x}")
print(f"Byte at 6261: 0x{content[6261]:02x}")

del content[6259]

print(f"New length: {len(content)}")

with open(filepath, "wb") as f:
    f.write(content)

print("File saved")

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()
print("UTF-8 validation passed!")