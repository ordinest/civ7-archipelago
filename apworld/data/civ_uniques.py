"""Civ-unique progressive-item declarations.

Each Age has civ-specific civic trees (3 or 4 nodes per civ, max 4).
Per-civ randomization is not supported by the AP framework (all
randomization decisions happen at generation, before the player picks
a civ in-game), so we use the standard "progressive item" pattern:
declare N generic items per Age, the mod resolves the Nth slot to
whichever civ the player picked at delivery.

Note on unique buildings: Civ 7 routes unique-building unlocks through
the civ-specific civic tree (e.g. NODE_CIVIC_AQ_ROME_CIVIS_ROMANUS
unlocks BUILDING_BASILICA at UnlockDepth=1). Granting the civic node
via these civic-tree-slot items already unlocks the building as a side
effect, so we deliberately do not expose unique buildings as a
separate item / location kind.
"""

from .extracted.civ_unique_trees import (
    ANTIQUITY_UNIQUE_MAX_NODES,
    EXPLORATION_UNIQUE_MAX_NODES,
    MODERN_UNIQUE_MAX_NODES,
)
from .nodes import Age


# Civic tree slots per Age. Equal to the largest civic-tree size across
# all civilizations playable in that Age. Civs with fewer nodes have
# trailing slots that resolve to a no-op at delivery.
CIVIC_TREE_SLOTS_PER_AGE: dict[Age, int] = {
    Age.ANTIQUITY: ANTIQUITY_UNIQUE_MAX_NODES,
    Age.EXPLORATION: EXPLORATION_UNIQUE_MAX_NODES,
    Age.MODERN: MODERN_UNIQUE_MAX_NODES,
}


def civic_tree_item_name(age: Age, slot: int) -> str:
    return f"{age.value} Civ Civic Tree Slot {slot}"


def civic_tree_location_name(age: Age, slot: int) -> str:
    return f"{age.value} Civ Civic Tree Slot {slot} Completed"


def all_civic_tree_items() -> list[tuple[Age, int, str]]:
    out: list[tuple[Age, int, str]] = []
    for age, count in CIVIC_TREE_SLOTS_PER_AGE.items():
        for slot in range(1, count + 1):
            out.append((age, slot, civic_tree_item_name(age, slot)))
    return out


def all_civic_tree_locations() -> list[tuple[Age, int, str]]:
    out: list[tuple[Age, int, str]] = []
    for age, count in CIVIC_TREE_SLOTS_PER_AGE.items():
        for slot in range(1, count + 1):
            out.append((age, slot, civic_tree_location_name(age, slot)))
    return out
