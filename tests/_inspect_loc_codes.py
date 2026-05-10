"""Print which AP location code each tech/civic node ID maps to."""
import os
import sys
from pathlib import Path

AP_ROOT = Path.home() / "source" / "Archipelago"
sys.path.insert(0, str(AP_ROOT))
os.chdir(AP_ROOT)

import ModuleUpdate  # type: ignore
ModuleUpdate.update_ran = True

from worlds.civ_7.Locations import LOCATION_TABLE  # type: ignore

ag_base = None
ag_mastery = None
five_oh_zero = None
five_oh_one = None
for name, data in LOCATION_TABLE.items():
    if data.civ7_node_id == "NODE_TECH_AQ_AGRICULTURE":
        if "Mastery" in name:
            ag_mastery = (name, data.code)
        else:
            ag_base = (name, data.code)
    if data.code == 5042500:
        five_oh_zero = (name, data.code, data.civ7_node_id)
    if data.code == 5042501:
        five_oh_one = (name, data.code, data.civ7_node_id)

print(f"AGRICULTURE base:    {ag_base}")
print(f"AGRICULTURE mastery: {ag_mastery}")
print(f"Location at code 5042500: {five_oh_zero}")
print(f"Location at code 5042501: {five_oh_one}")

node_to_code = {
    data.civ7_node_id: data.code
    for data in LOCATION_TABLE.values()
    if data.civ7_node_id is not None
}
print(f"\nnode_to_code['NODE_TECH_AQ_AGRICULTURE'] = {node_to_code.get('NODE_TECH_AQ_AGRICULTURE')}")
