"""Inspect the most recent generated archive's location codes."""
import json
import sys
import zipfile
from pathlib import Path

AP_ROOT = Path.home() / "source" / "Archipelago"
archives = sorted((AP_ROOT / "Generated_Output").glob("AP_*.zip"))
assert archives, "no archives"
arch = archives[-1]
print(f"[inspect] {arch.name}")

with zipfile.ZipFile(arch) as zf:
    names = zf.namelist()
    print("[inspect] files in archive:")
    for n in names:
        print(f"  {n}")

    # data_package.json or location_name_to_id is what server uses
    candidates = [n for n in names if "data_package" in n.lower() or "location" in n.lower()]
    for cand in candidates:
        with zf.open(cand) as f:
            body = f.read().decode("utf-8", errors="replace")
            print(f"\n[inspect] {cand} (first 500 chars):")
            print(body[:500])
