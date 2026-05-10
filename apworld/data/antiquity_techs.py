"""Antiquity tech tree node data.

Source: Civ 7 install at `Base/modules/age-antiquity/data/progression-trees-tech.xml`.
16 nodes in `TREE_TECHS_AQ`. Agriculture is the free root.
"""

from .nodes import Age, ProgressionNode, TreeKind


_T = TreeKind.TECH
_AQ = Age.ANTIQUITY


ANTIQUITY_TECH_NODES: tuple[ProgressionNode, ...] = (
    ProgressionNode("NODE_TECH_AQ_AGRICULTURE", _AQ, _T, "Agriculture", cost=1,
                    is_free_root=True, has_mastery=False),
    ProgressionNode("NODE_TECH_AQ_POTTERY", _AQ, _T, "Pottery", cost=70,
                    prereqs=("NODE_TECH_AQ_AGRICULTURE",), has_mastery=False),
    ProgressionNode("NODE_TECH_AQ_ANIMAL_HUSBANDRY", _AQ, _T, "Animal Husbandry", cost=70,
                    prereqs=("NODE_TECH_AQ_AGRICULTURE",), has_mastery=False),
    ProgressionNode("NODE_TECH_AQ_SAILING", _AQ, _T, "Sailing", cost=85,
                    prereqs=("NODE_TECH_AQ_AGRICULTURE",), has_mastery=False),
    ProgressionNode("NODE_TECH_AQ_WRITING", _AQ, _T, "Writing", cost=125,
                    prereqs=("NODE_TECH_AQ_POTTERY",)),
    ProgressionNode("NODE_TECH_AQ_IRRIGATION", _AQ, _T, "Irrigation", cost=125,
                    prereqs=("NODE_TECH_AQ_POTTERY", "NODE_TECH_AQ_ANIMAL_HUSBANDRY"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_AQ_MASONRY", _AQ, _T, "Masonry", cost=125,
                    prereqs=("NODE_TECH_AQ_ANIMAL_HUSBANDRY",)),
    ProgressionNode("NODE_TECH_AQ_CURRENCY", _AQ, _T, "Currency", cost=245,
                    prereqs=("NODE_TECH_AQ_SAILING", "NODE_TECH_AQ_WRITING")),
    ProgressionNode("NODE_TECH_AQ_BRONZE_WORKING", _AQ, _T, "Bronze Working", cost=255,
                    prereqs=("NODE_TECH_AQ_WRITING", "NODE_TECH_AQ_IRRIGATION")),
    ProgressionNode("NODE_TECH_AQ_WHEEL", _AQ, _T, "Wheel", cost=245,
                    prereqs=("NODE_TECH_AQ_IRRIGATION", "NODE_TECH_AQ_MASONRY")),
    ProgressionNode("NODE_TECH_AQ_NAVIGATION", _AQ, _T, "Navigation", cost=430,
                    prereqs=("NODE_TECH_AQ_CURRENCY",)),
    ProgressionNode("NODE_TECH_AQ_ENGINEERING", _AQ, _T, "Engineering", cost=430,
                    prereqs=("NODE_TECH_AQ_CURRENCY", "NODE_TECH_AQ_BRONZE_WORKING")),
    ProgressionNode("NODE_TECH_AQ_MILITARY_TRAINING", _AQ, _T, "Military Training", cost=430,
                    prereqs=("NODE_TECH_AQ_BRONZE_WORKING", "NODE_TECH_AQ_WHEEL")),
    ProgressionNode("NODE_TECH_AQ_MATHEMATICS", _AQ, _T, "Mathematics", cost=738,
                    prereqs=("NODE_TECH_AQ_ENGINEERING",)),
    ProgressionNode("NODE_TECH_AQ_IRON_WORKING", _AQ, _T, "Iron Working", cost=738,
                    prereqs=("NODE_TECH_AQ_MILITARY_TRAINING",), has_mastery=False),
    ProgressionNode("NODE_TECH_AQ_FUTURE_TECH", _AQ, _T, "Future Tech", cost=1255,
                    prereqs=("NODE_TECH_AQ_NAVIGATION", "NODE_TECH_AQ_IRON_WORKING",
                             "NODE_TECH_AQ_MATHEMATICS"),
                    is_terminal=True, has_mastery=False),
)
