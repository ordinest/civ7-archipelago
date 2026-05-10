"""Locations for the Civ 7 Archipelago world.

A location is a slot the AP fill algorithm places an item into; the item
is delivered to the receiving player when the slot is "checked" in-game.
Currently scope: base completion of every Antiquity tech and civic node.
Mastery, Legacy Path, and Attribute Point locations are reserved for
later phases.
"""

from dataclasses import dataclass

from BaseClasses import Location

from .data.legacy_paths import LEGACY_MILESTONES
from .data.nodes import Age
from .data.registry import ALL_NODES, masterable_nodes


# Default attribute-point milestone count. Mirrors DEFAULT_ATTRIBUTE_POINT_COUNT
# in Items.py; YAML-tunable later. Each milestone fires when the player
# has earned N cumulative attribute points in-game.
DEFAULT_ATTRIBUTE_POINT_LOCATION_COUNT: int = 16


def attribute_point_location_name(n: int) -> str:
    """Display name for the Nth cumulative-attribute-point milestone."""
    return f"Attribute Points Earned: {n}"


# Item and location ID spaces. AP global; offset from item base to keep
# disjoint when debugging. See Items.py for the item base.
CIV_VII_AP_LOCATION_ID_BASE: int = 5042500


@dataclass(frozen=True)
class Civ7LocationData:
    name: str
    code: int  # AP-global location ID
    region: str
    civ7_node_id: str | None = None  # internal Civ 7 node ID this completion check ties to


class Civ7Location(Location):
    game: str = "Civilization VII"


def _build_location_table() -> dict[str, Civ7LocationData]:
    """Enumerate all Civ 7 AP locations.

    1. One base-completion location per progression node, regardless of
       whether the node is a free root. Free roots still produce an AP
       check when the player completes them in-game; only their item is
       omitted from the pool.
    2. One mastery-completion location per masterable node. Masterable
       means the node has explicit UnlockDepth=2 entries in vanilla XML;
       other nodes' mastery completion may not fire a useful event.
    3. One Legacy Path Milestone location per Age x path x tier.
    """
    table: dict[str, Civ7LocationData] = {}
    next_id = CIV_VII_AP_LOCATION_ID_BASE

    for node in ALL_NODES:
        table[node.item_name] = Civ7LocationData(
            name=node.item_name,
            code=next_id,
            region=node.age.value,
            civ7_node_id=node.node_id,
        )
        next_id += 1

    for node in masterable_nodes():
        table[node.mastery_location_name] = Civ7LocationData(
            name=node.mastery_location_name,
            code=next_id,
            region=node.age.value,
            civ7_node_id=node.node_id,
        )
        next_id += 1

    for milestone in LEGACY_MILESTONES:
        table[milestone.location_name] = Civ7LocationData(
            name=milestone.location_name,
            code=next_id,
            region=milestone.age.value,
            civ7_node_id=milestone.civ7_milestone_id,
        )
        next_id += 1

    # Attribute-point milestones live in the Antiquity region (i.e., always
    # reachable from start) since the player earns attribute points across
    # all Ages and we do not want these gated by Age progression.
    for n in range(1, DEFAULT_ATTRIBUTE_POINT_LOCATION_COUNT + 1):
        name = attribute_point_location_name(n)
        table[name] = Civ7LocationData(
            name=name,
            code=next_id,
            region=Age.ANTIQUITY.value,
            civ7_node_id=None,
        )
        next_id += 1

    return table


LOCATION_TABLE: dict[str, Civ7LocationData] = _build_location_table()
LOCATION_NAME_TO_ID: dict[str, int] = {n: d.code for n, d in LOCATION_TABLE.items()}
