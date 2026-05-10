"""Region graph for the Civ 7 Archipelago world.

One region per Age. Antiquity is reachable from start; Exploration and
Modern are gated by Progressive Age items collected. The pattern follows
the Civ 6 AP precedent (era-as-region with progressive era unlocks).
"""

from BaseClasses import MultiWorld, Region

from .data.nodes import Age
from .data.registry import progression_nodes
from .Items import PROGRESSIVE_AGE_ITEM
from .Locations import LOCATION_TABLE, Civ7Location


# Ordered list of Ages we expose. Antiquity is always first and free;
# subsequent Ages chain off Progressive Age item count.
AGE_ORDER: tuple[Age, ...] = (Age.ANTIQUITY, Age.EXPLORATION, Age.MODERN)


def _ages_with_content() -> tuple[Age, ...]:
    """Ages that have at least one progression node in the registry."""
    present = {n.age for n in progression_nodes()}
    return tuple(a for a in AGE_ORDER if a in present)


def create_regions(world: "Civ7World") -> None:  # noqa: F821 (forward reference)
    """Build regions and wire locations into them."""
    multiworld: MultiWorld = world.multiworld
    player: int = world.player

    menu = Region("Menu", player, multiworld)
    multiworld.regions.append(menu)

    # One region per Age that has registered nodes.
    age_regions: dict[Age, Region] = {}
    for age in _ages_with_content():
        region = Region(age.value, player, multiworld)
        multiworld.regions.append(region)
        age_regions[age] = region

    # Connect Menu → first Age (free) and chain subsequent Ages with
    # Progressive Age item gating.
    ordered = tuple(age_regions.keys())  # registry order, guaranteed by AGE_ORDER
    menu.connect(age_regions[ordered[0]], "Start Game")

    for index in range(1, len(ordered)):
        prev_region = age_regions[ordered[index - 1]]
        next_region = age_regions[ordered[index]]
        required_count = index  # Exploration needs 1, Modern needs 2

        prev_region.connect(
            next_region,
            f"Advance to {ordered[index].value}",
            lambda state, count=required_count: state.has(
                PROGRESSIVE_AGE_ITEM, player, count=count
            ),
        )

    # Wire all locations into their region.
    for loc_name, loc_data in LOCATION_TABLE.items():
        region = age_regions.get(Age(loc_data.region))
        if region is None:
            raise RuntimeError(
                f"Location {loc_name} targets region {loc_data.region!r} but "
                f"no Age region was created for it. Check registry contents."
            )
        loc = Civ7Location(player, loc_name, loc_data.code, region)
        region.locations.append(loc)
