"""Civilization VII Archipelago world.

Full three-Age design: tech and civic trees across Antiquity,
Exploration, and Modern, plus mastery completions, Legacy Path
milestones, and attribute-point milestones. See `docs/DESIGN.md` for
the full design and `docs/smoke-test-setup.md` for the runtime stack.

The architecture mirrors hesto2's Civ 6 apworld
(https://github.com/hesto2/civilization_vi_apworld), adapted for Civ 7's
JavaScript runtime and three-Age structure.
"""

from BaseClasses import Tutorial
from worlds.AutoWorld import WebWorld, World

from .Items import (
    ATTRIBUTE_POINT_ITEM,
    DEFAULT_ATTRIBUTE_POINT_COUNT,
    FILLER_ITEMS,
    ITEM_NAME_TO_ID,
    ITEM_TABLE,
    PROGRESSIVE_AGE_ITEM,
    Civ7Item,
    _count_progressive_age_items,
    create_item,
)
from .Locations import LOCATION_NAME_TO_ID
from .Options import Civ7Options
from .Regions import create_regions
from .Rules import set_rules


class Civ7Web(WebWorld):
    theme = "stone"
    tutorials = [
        Tutorial(
            "Multiworld Setup Guide",
            "A guide to setting up Civilization VII for Archipelago multiworld.",
            "English",
            "setup_en.md",
            "setup/en",
            ["civ7-archipelago contributors"],
        ),
    ]


class Civ7World(World):
    """Civilization VII randomizer."""

    game = "Civilization VII"
    options_dataclass = Civ7Options
    options: Civ7Options
    topology_present = True
    web = Civ7Web()

    item_name_to_id = ITEM_NAME_TO_ID
    location_name_to_id = LOCATION_NAME_TO_ID

    def create_item(self, name: str) -> Civ7Item:
        return create_item(name, self.player)

    def create_items(self) -> None:
        """Push items into the multiworld pool.

        Pool composition:
          - One copy per non-free-root progression node (tech/civic).
          - N copies of Progressive Age, where N = (Ages in scope) - 1.
          - Filler items cycling through FILLER_ITEMS until pool size
            matches the world's location count.
        """
        from .data.registry import progression_nodes

        for node in progression_nodes():
            self.multiworld.itempool.append(self.create_item(node.item_name))

        for _ in range(_count_progressive_age_items()):
            self.multiworld.itempool.append(self.create_item(PROGRESSIVE_AGE_ITEM))

        for _ in range(DEFAULT_ATTRIBUTE_POINT_COUNT):
            self.multiworld.itempool.append(self.create_item(ATTRIBUTE_POINT_ITEM))

        # Pad with filler to match location count exactly.
        target = sum(
            1
            for region in self.multiworld.regions
            if region.player == self.player
            for _ in region.locations
        )
        added = (
            len(progression_nodes())
            + _count_progressive_age_items()
            + DEFAULT_ATTRIBUTE_POINT_COUNT
        )
        deficit = target - added
        for i in range(deficit):
            self.multiworld.itempool.append(
                self.create_item(FILLER_ITEMS[i % len(FILLER_ITEMS)])
            )

    def create_regions(self) -> None:
        create_regions(self)

    def set_rules(self) -> None:
        set_rules(self)
