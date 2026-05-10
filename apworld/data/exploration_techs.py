"""Exploration tech tree node data.

Source: Civ 7 install at
`Base/modules/age-exploration/data/progression-trees-tech.xml`.
15 nodes in `TREE_TECHS_EX`. Three free roots (Cartography, Astronomy,
Machinery) since Exploration's tech tree branches from three independent
starting points.
"""

from .nodes import Age, ProgressionNode, TreeKind


_T = TreeKind.TECH
_EX = Age.EXPLORATION


EXPLORATION_TECH_NODES: tuple[ProgressionNode, ...] = (
    ProgressionNode("NODE_TECH_EX_CARTOGRAPHY", _EX, _T, "Cartography", cost=500,
                    is_free_root=True),
    ProgressionNode("NODE_TECH_EX_ASTRONOMY", _EX, _T, "Astronomy", cost=500,
                    is_free_root=True, has_mastery=False),
    ProgressionNode("NODE_TECH_EX_MACHINERY", _EX, _T, "Machinery", cost=500,
                    is_free_root=True),
    ProgressionNode("NODE_TECH_EX_GUILDS", _EX, _T, "Guilds", cost=650,
                    prereqs=("NODE_TECH_EX_CARTOGRAPHY",)),
    ProgressionNode("NODE_TECH_EX_FEUDALISM", _EX, _T, "Feudalism", cost=650,
                    prereqs=("NODE_TECH_EX_CARTOGRAPHY", "NODE_TECH_EX_ASTRONOMY"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_EX_HERALDRY", _EX, _T, "Heraldry", cost=650,
                    prereqs=("NODE_TECH_EX_ASTRONOMY", "NODE_TECH_EX_MACHINERY"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_EX_CASTLES", _EX, _T, "Castles", cost=650,
                    prereqs=("NODE_TECH_EX_MACHINERY",), has_mastery=False),
    ProgressionNode("NODE_TECH_EX_EDUCATION", _EX, _T, "Education", cost=900,
                    prereqs=("NODE_TECH_EX_GUILDS", "NODE_TECH_EX_FEUDALISM")),
    ProgressionNode("NODE_TECH_EX_SHIPBUILDING", _EX, _T, "Shipbuilding", cost=900,
                    prereqs=("NODE_TECH_EX_FEUDALISM", "NODE_TECH_EX_HERALDRY"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_EX_METALLURGY", _EX, _T, "Metallurgy", cost=900,
                    prereqs=("NODE_TECH_EX_HERALDRY", "NODE_TECH_EX_CASTLES"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_EX_ARCHITECTURE", _EX, _T, "Architecture", cost=1200,
                    prereqs=("NODE_TECH_EX_EDUCATION", "NODE_TECH_EX_SHIPBUILDING")),
    ProgressionNode("NODE_TECH_EX_METAL_CASTING", _EX, _T, "Metal Casting", cost=1200,
                    prereqs=("NODE_TECH_EX_SHIPBUILDING", "NODE_TECH_EX_METALLURGY"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_EX_URBAN_PLANNING", _EX, _T, "Urban Planning", cost=2100,
                    prereqs=("NODE_TECH_EX_ARCHITECTURE",)),
    ProgressionNode("NODE_TECH_EX_GUNPOWDER", _EX, _T, "Gunpowder", cost=2100,
                    prereqs=("NODE_TECH_EX_METAL_CASTING",), has_mastery=False),
    ProgressionNode("NODE_TECH_EX_FUTURE_TECH", _EX, _T, "Future Tech", cost=2750,
                    prereqs=("NODE_TECH_EX_URBAN_PLANNING", "NODE_TECH_EX_GUNPOWDER"),
                    is_terminal=True, has_mastery=False),
)
