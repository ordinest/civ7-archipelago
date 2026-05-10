"""Items for the Civ 7 Archipelago world.

Items are the things players send and receive across the multiworld.
Currently scope: Antiquity tech and civic nodes (excluding free roots),
plus filler items for fill stability.
"""

from dataclasses import dataclass

from BaseClasses import Item, ItemClassification

from .data.civ_uniques import (
    all_civic_tree_items,
)
from .data.legacy_paths import LEGACY_MILESTONES
from .data.nodes import Age
from .data.registry import masterable_nodes, nodes_in_age, progression_nodes


# AP item ID base. Each game has a unique offset to keep IDs globally distinct
# in the multiworld. Civ 6 uses 5041000 (hesto2/civilization_vi_apworld).
# Picking 5042000 for Civ 7. Third-party-only for now; not coordinated with
# the main ArchipelagoMW project, which is fine for friend-group internal use.
CIV_VII_AP_ITEM_ID_BASE: int = 5042000


# Progressive Age item: collected once unlocks Exploration access, twice
# unlocks Modern. The standard AP "progressive item" pattern.
PROGRESSIVE_AGE_ITEM: str = "Progressive Age"


# Attribute Point item. The player receives a generic wildcard attribute
# point that the in-game mod grants via the player's attribute pool.
# Multiple copies may exist in the pool to match the count of attribute-
# point milestone locations.
ATTRIBUTE_POINT_ITEM: str = "Attribute Point"


# Default number of attribute-point items / milestones. YAML-tunable in
# a later phase. Conservative default; a typical full Civ 7 game yields
# more than this many points across Future Tech / Civic repeats and
# masteries, so 16 milestones should be reachable by most players.
DEFAULT_ATTRIBUTE_POINT_COUNT: int = 16


# Synthetic event item paired with the Civ 7 Victory Trigger event
# location. Code is None (not in the AP item-id space). The in-game mod
# fires the matching event location when vanilla Civ 7 victory triggers;
# the player receives this event item, which satisfies the
# `goal=normal_victory` completion condition.
VICTORY_EVENT_ITEM: str = "Civ 7 Victory"


# Filler items. Non-progression flavour rewards that pad the items pool to
# match the locations pool and give AP fill swap-headroom.
FILLER_ITEMS: tuple[str, ...] = (
    "Civ 7 Filler: Production Boost",
    "Civ 7 Filler: Gold Boost",
    "Civ 7 Filler: Free Settler",
    "Civ 7 Filler: Free Builder",
    "Civ 7 Filler: Faith Burst",
    "Civ 7 Filler: Population Growth",
)


def _count_progressive_age_items() -> int:
    """One Progressive Age item per Age beyond the starting one.

    Antiquity is the starting region; players reach it for free. Each
    additional Age in the registry adds one Progressive Age item to the
    pool. With Antiquity + Exploration in scope, we have 1. Adding Modern
    will bring it to 2.
    """
    ages_present = {n.age for n in progression_nodes()}
    return max(0, len(ages_present) - 1)


@dataclass(frozen=True)
class Civ7ItemData:
    """Static metadata for a Civ 7 AP item."""

    name: str
    code: int | None  # AP-global item ID; None = event-only item
    classification: ItemClassification
    civ7_node_id: str | None = None  # internal Civ 7 node ID, for runtime grant


class Civ7Item(Item):
    game: str = "Civilization VII"


def _build_item_table() -> dict[str, Civ7ItemData]:
    """Enumerate all Civ 7 AP items: progression nodes, Progressive Age,
    Attribute Point, and filler. Note that Progressive Age and Attribute
    Point each have one entry in the table even though multiple copies
    may exist in the pool.
    """
    table: dict[str, Civ7ItemData] = {}
    next_id = CIV_VII_AP_ITEM_ID_BASE

    for node in progression_nodes():
        table[node.item_name] = Civ7ItemData(
            name=node.item_name,
            code=next_id,
            classification=ItemClassification.progression,
            civ7_node_id=node.node_id,
        )
        next_id += 1

    # Mastery items (capability 3): one per masterable node. Distinct from
    # the base item, so the multiworld can deliver them independently.
    # Granting in-mod uses GRANT_TREE_NODE with FullyUnlock=0 (advance
    # one depth tier), called separately for base and mastery.
    for node in masterable_nodes():
        table[node.mastery_item_name] = Civ7ItemData(
            name=node.mastery_item_name,
            code=next_id,
            classification=ItemClassification.useful,
            civ7_node_id=node.node_id,
        )
        next_id += 1

    # Legacy Path milestone items (capability 4 bidirectional): one per
    # milestone. Mod uses `Players.LegacyPaths.addLegacyPathEvent` (or
    # equivalent) on receive to advance the player's path progress.
    for ms in LEGACY_MILESTONES:
        table[ms.item_name] = Civ7ItemData(
            name=ms.item_name,
            code=next_id,
            classification=ItemClassification.useful,
            civ7_node_id=ms.civ7_milestone_id,
        )
        next_id += 1

    # Civ-unique progressive items (capability 5). The mod resolves each
    # slot to the actual civ-specific node or building at delivery time
    # based on the player's chosen civ.
    for _age, _slot, name in all_civic_tree_items():
        table[name] = Civ7ItemData(
            name=name,
            code=next_id,
            classification=ItemClassification.progression,
        )
        next_id += 1

    table[PROGRESSIVE_AGE_ITEM] = Civ7ItemData(
        name=PROGRESSIVE_AGE_ITEM,
        code=next_id,
        classification=ItemClassification.progression,
    )
    next_id += 1

    table[ATTRIBUTE_POINT_ITEM] = Civ7ItemData(
        name=ATTRIBUTE_POINT_ITEM,
        code=next_id,
        classification=ItemClassification.useful,
    )
    next_id += 1

    for filler_name in FILLER_ITEMS:
        table[filler_name] = Civ7ItemData(
            name=filler_name,
            code=next_id,
            classification=ItemClassification.filler,
        )
        next_id += 1

    # Event item: not in the AP item-id space; locked to the matching
    # event location at world setup time.
    table[VICTORY_EVENT_ITEM] = Civ7ItemData(
        name=VICTORY_EVENT_ITEM,
        code=None,
        classification=ItemClassification.progression,
    )

    return table


ITEM_TABLE: dict[str, Civ7ItemData] = _build_item_table()
ITEM_NAME_TO_ID: dict[str, int] = {
    n: d.code for n, d in ITEM_TABLE.items() if d.code is not None
}


def create_item(name: str, player: int) -> Civ7Item:
    data = ITEM_TABLE[name]
    return Civ7Item(name, data.classification, data.code, player)
