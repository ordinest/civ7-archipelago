"""Decode the most recent AP archive and dump the actual location/item mapping
as the SERVER sees it (vs what the apworld module declares)."""
import sys
import zipfile
from pathlib import Path

AP_ROOT = Path.home() / "source" / "Archipelago"
archives = sorted((AP_ROOT / "Generated_Output").glob("AP_*.zip"))
arch = archives[-1]
print(f"[inspect] {arch.name}")

# AP archives are zip-of-multiworld; the .archipelago file is a pickle
sys.path.insert(0, str(AP_ROOT))
import ModuleUpdate  # type: ignore
ModuleUpdate.update_ran = True
from worlds.civ_7.Locations import LOCATION_TABLE  # type: ignore

# Dump every location code → name from the apworld module the server uses
print(f"[inspect] Locations module path: {Path(__import__('worlds.civ_7.Locations', fromlist=['__file__']).__file__)}")
target_codes = {5042500, 5042501, 5042502, 5042503}
for name, data in LOCATION_TABLE.items():
    if data.code in target_codes:
        print(f"  {data.code}: '{name}' (civ7_node_id={data.civ7_node_id})")

# Find the Antiquity Legacy Path: Military 2 location
for name, data in LOCATION_TABLE.items():
    if "Antiquity Legacy Path: Military 2" in name:
        print(f"\n'{name}' lives at code {data.code}")
        break
