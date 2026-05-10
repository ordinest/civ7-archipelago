"""Generate the mod's item-to-node mapping from the apworld registry.

Output: `mod/scripts/ap_item_map.js`. Loaded before `archipelago.js` via
the `<UIScripts>` ordering in `archipelago.modinfo`. Exposes
`Game._AP_ITEM_TO_NODE` as a flat object keyed by AP item display
name. Special items (Progressive Age, Attribute Point, Modern Ideology
Tier 1/2/3) are emitted with `null` node IDs and a `kind` tag so the
mod's handleReceiveItem can dispatch by item kind.

Re-run after any apworld registry change:

    .venv/Scripts/python.exe tests/build_mod_item_map.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import importlib.util
import types

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "apworld" / "data"


def _load_data_module(name: str) -> types.ModuleType:
    """Load `apworld/data/<name>.py` standalone, without triggering
    `apworld/__init__.py` (which imports Archipelago internals).

    The data modules only depend on `apworld.data.nodes`, which we
    register under the qualified name first so subsequent loads can
    `from .nodes import ...`.
    """
    qualified = f"apworld.data.{name}"
    if qualified in sys.modules:
        return sys.modules[qualified]
    spec = importlib.util.spec_from_file_location(
        qualified, DATA_DIR / f"{name}.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[qualified] = module
    spec.loader.exec_module(module)
    return module


# Pre-register parent packages as empty namespaces so relative imports
# work (`from .nodes import ...`).
sys.modules.setdefault("apworld", types.ModuleType("apworld"))
sys.modules.setdefault("apworld.data", types.ModuleType("apworld.data"))

# Load extracted data files first (used by bundles).
EXTRACTED_DIR = DATA_DIR / "extracted"
sys.modules.setdefault(
    "apworld.data.extracted", types.ModuleType("apworld.data.extracted")
)
for extracted_name in ("tech_unlocks", "civic_unlocks", "civ_unique_trees"):
    spec = importlib.util.spec_from_file_location(
        f"apworld.data.extracted.{extracted_name}",
        EXTRACTED_DIR / f"{extracted_name}.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[f"apworld.data.extracted.{extracted_name}"] = module
    spec.loader.exec_module(module)

_load_data_module("nodes")
_load_data_module("antiquity_civics")
_load_data_module("antiquity_techs")
_load_data_module("exploration_civics")
_load_data_module("exploration_techs")
_load_data_module("modern_civics")
_load_data_module("modern_techs")
legacy_paths = _load_data_module("legacy_paths")
bundles = _load_data_module("bundles")
registry = _load_data_module("registry")
civ_uniques = _load_data_module("civ_uniques")

modern_civics = sys.modules["apworld.data.modern_civics"]

progression_nodes = registry.progression_nodes
masterable_nodes = registry.masterable_nodes
LEGACY_MILESTONES = legacy_paths.LEGACY_MILESTONES
all_civic_tree_items = civ_uniques.all_civic_tree_items
IDEOLOGY_TIER_1_NODE_ID = modern_civics.IDEOLOGY_TIER_1_NODE_ID
IDEOLOGY_TIER_2_NODE_ID = modern_civics.IDEOLOGY_TIER_2_NODE_ID
IDEOLOGY_TIER_3_NODE_ID = modern_civics.IDEOLOGY_TIER_3_NODE_ID

# These constants don't depend on AP; mirror them here so the build
# script does not need to import apworld.Items (which does).
ATTRIBUTE_POINT_ITEM = "Attribute Point"
PROGRESSIVE_AGE_ITEM = "Progressive Age"


# Synthetic node IDs that need special runtime handling rather than a
# direct GRANT_TREE_NODE call. The mod selects an actual ideology branch
# at runtime based on the player's chosen ideology.
IDEOLOGY_TIER_NODE_IDS = frozenset({
    IDEOLOGY_TIER_1_NODE_ID,
    IDEOLOGY_TIER_2_NODE_ID,
    IDEOLOGY_TIER_3_NODE_ID,
})


def build_table() -> dict[str, dict]:
    """Return AP item display name -> { kind, ... }.

    Kinds:
      - "tree_node":          grant via PlayerOperationTypes.GRANT_TREE_NODE
                              (FullyUnlock=0 advances by one depth tier).
      - "tree_node_mastery":  grant a second depth tier on the same node;
                              the mod calls GRANT_TREE_NODE again.
      - "ideology_tier":      grant the corresponding tier of the
                              player's chosen ideology at receive time.
      - "legacy_path":        advance the named legacy path by one
                              milestone via Players.LegacyPaths.
      - "civ_civic_slot":     unlock the player's civ-specific civic
                              tree node at the given slot index. Side
                              effect: also unlocks the civ's unique
                              building tied to that node (per
                              progression-trees-culture-unique.xml).
      - "progressive_age":    no in-game effect; AP-side region marker.
      - "attribute_point":    grant an attribute point via the runtime
                              API.
    """
    table: dict[str, dict] = {}

    for node in progression_nodes():
        if node.node_id == IDEOLOGY_TIER_1_NODE_ID:
            table[node.item_name] = {"kind": "ideology_tier", "tier": 1}
        elif node.node_id == IDEOLOGY_TIER_2_NODE_ID:
            table[node.item_name] = {"kind": "ideology_tier", "tier": 2}
        elif node.node_id == IDEOLOGY_TIER_3_NODE_ID:
            table[node.item_name] = {"kind": "ideology_tier", "tier": 3}
        else:
            table[node.item_name] = {
                "kind": "tree_node",
                "node_id": node.node_id,
            }

    for node in masterable_nodes():
        table[node.mastery_item_name] = {
            "kind": "tree_node_mastery",
            "node_id": node.node_id,
        }

    for ms in LEGACY_MILESTONES:
        table[ms.item_name] = {
            "kind": "legacy_path",
            "legacy_path_id": ms.civ7_legacy_path_id,
            "milestone": ms.milestone,
        }

    for age, slot, name in all_civic_tree_items():
        table[name] = {
            "kind": "civ_civic_slot",
            "age": age.value,
            "slot": slot,
        }

    table[PROGRESSIVE_AGE_ITEM] = {"kind": "progressive_age"}
    table[ATTRIBUTE_POINT_ITEM] = {"kind": "attribute_point"}

    return table


def emit_js(table: dict[str, dict]) -> str:
    """Pretty-print the mapping as a JavaScript file."""
    body = json.dumps(table, indent=4, sort_keys=True)
    return (
        "// Generated by tests/build_mod_item_map.py from the apworld registry.\n"
        "// Do not edit by hand. Re-run the build script after registry changes.\n"
        "\n"
        f"Game._AP_ITEM_TO_NODE = {body};\n"
    )


def main() -> int:
    table = build_table()
    out = REPO_ROOT / "mod" / "scripts" / "ap_item_map.js"
    out.write_text(emit_js(table), encoding="utf-8")
    counts = {}
    for entry in table.values():
        counts[entry["kind"]] = counts.get(entry["kind"], 0) + 1
    print(f"[build] wrote {out}")
    print(f"[build] {len(table)} entries: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
