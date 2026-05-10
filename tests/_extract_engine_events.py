"""Extract the unique engine event names referenced in Civ 7's shipped JS."""
import re
import sys
from pathlib import Path

src = Path(sys.argv[1]).read_text(encoding="utf-8")
names = sorted(set(re.findall(r'engine\.on\("([A-Za-z][A-Za-z0-9]+)"', src)))
for n in names:
    print(n)
print(f"\n[total] {len(names)} unique event names", file=sys.stderr)
