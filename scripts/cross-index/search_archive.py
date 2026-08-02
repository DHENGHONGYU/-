import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
archive_dir = str(BASE_DIR / "docs" / "archive")

patterns = ['RCA-report', 'file-wandering', 'optimization-prompt', 'task-list']

for pattern in patterns:
    found = []
    for root, dirs, files in os.walk(archive_dir):
        for f in files:
            if pattern in f:
                rel_path = os.path.relpath(os.path.join(root, f), str(BASE_DIR / "docs")).replace('\\', '/')
                found.append(rel_path)
    print(f'Pattern "{pattern}":')
    if found:
        for f in found:
            print(f'  {f}')
    else:
        print('  NOT FOUND')