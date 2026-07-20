from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = BASE_DIR / 'docs/reference/meta/registry-index.md'

with open(filepath, "rb") as f:
    content = bytearray(f.read())

print(f"Original length: {len(content)}")

i = 0
fixed_count = 0
while i < len(content):
    if content[i] >= 0xF0:
        if i + 3 < len(content):
            i += 4
        else:
            del content[i]
            fixed_count += 1
    elif content[i] >= 0xE0:
        if i + 2 < len(content):
            i += 3
        else:
            del content[i]
            fixed_count += 1
    elif content[i] >= 0xC0:
        if i + 1 < len(content):
            i += 2
        else:
            del content[i]
            fixed_count += 1
    else:
        i += 1

print(f"Fixed {fixed_count} broken UTF-8 sequences")
print(f"New length: {len(content)}")

with open(filepath, "wb") as f:
    f.write(content)

print("File saved")