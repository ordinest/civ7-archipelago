"""Count the apworld's items pool and locations pool by category.

Independent of the AP venv: loads the extracted data directly and the
local apworld data modules without going through the apworld package's
__init__ (which depends on Archipelago).
"""

import importlib.util
import sys
import types
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "apworld" / "data"
EXTRACTED_DIR = DATA_DIR / "extracted"


def _load(name: str, path: Path) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    sys.modules.setdefault("apworld", types.ModuleType("apworld"))
    sys.modules.setdefault("apworld.data", types.ModuleType("apworld.data"))
    sys.modules.setdefault("apworld.data.extracted", types.ModuleType("apworld.data.extracted"))

    _load("apworld.data.extracted.tech_unlocks", EXTRACTED_DIR / "tech_unlocks.py")
    _load("apworld.data.extracted.civic_unlocks", EXTRACTED_DIR / "civic_unlocks.py")
    _load("apworld.data.nodes", DATA_DIR / "nodes.py")
    bundles = _load("apworld.data.bundles", DATA_DIR / "bundles.py")
    for n in ("antiquity_civics", "antiquity_techs", "exploration_civics",
              "exploration_techs", "modern_civics", "modern_techs"):
        _load(f"apworld.data.{n}", DATA_DIR / f"{n}.py")

    # Replicate registry's masterable_nodes() logic in isolation.
    nodes = []
    for n in ("antiquity_techs", "antiquity_civics", "exploration_techs",
              "exploration_civics", "modern_techs", "modern_civics"):
        m = sys.modules[f"apworld.data.{n}"]
        attr = next(a for a in dir(m) if a.endswith("_NODES"))
        nodes.extend(getattr(m, attr))

    progression_count = sum(1 for n in nodes if not n.is_free_root)
    masterable_count = sum(
        1 for n in nodes
        if not n.is_free_root and bundles.has_mastery(n.node_id)
    )
    # Civ-unique progressive slots (capability 5).
    civ_trees = _load("apworld.data.extracted.civ_unique_trees",
                      EXTRACTED_DIR / "civ_unique_trees.py")
    civic_tree_slots = (civ_trees.ANTIQUITY_UNIQUE_MAX_NODES
                        + civ_trees.EXPLORATION_UNIQUE_MAX_NODES
                        + civ_trees.MODERN_UNIQUE_MAX_NODES)
    unique_building_slots = 3 * 2  # 3 ages x 2 slots

    # Caps 6-9: pantheon (1), religion founded (1), belief slots (4),
    # wonder slots (3 per age x 3), discovery slots (5 per age x 3).
    extra_locations = 1 + 1 + 4 + (3 * 3) + (5 * 3)

    print(f"total nodes: {len(nodes)}")
    print(f"non-free-root (= base items): {progression_count}")
    print(f"masterable (= mastery items): {masterable_count}")
    print(f"civic-tree slots: {civic_tree_slots}")
    print(f"unique-building slots: {unique_building_slots}")
    locations_total = (len(nodes) + masterable_count + 36 + 16
                       + civic_tree_slots + unique_building_slots
                       + extra_locations)
    items_progression = (progression_count + masterable_count + 36
                         + civic_tree_slots + unique_building_slots
                         + 2 + 16)
    filler = locations_total - items_progression
    print(f"items pool target = {progression_count} base + {masterable_count} mastery + 36 LP + {civic_tree_slots} civic-tree + {unique_building_slots} unique-building + 2 PA + 16 attr + {filler} filler")
    print(f"locations pool target = {len(nodes)} base + {masterable_count} mastery + 36 legacy + 16 attr + {civic_tree_slots} civic-tree + {unique_building_slots} unique-building")
    print(f"locations total = {locations_total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
