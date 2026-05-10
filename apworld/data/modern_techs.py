"""Modern tech tree node data.

Source: Civ 7 install at
`Base/modules/age-modern/data/progression-trees-tech.xml`.
16 nodes in `TREE_TECHS_MO`. Three free roots (Academics, Steam Engine,
Military Science) since the Modern tech tree branches from three
independent starting points.
"""

from .nodes import Age, ProgressionNode, TreeKind


_T = TreeKind.TECH
_MO = Age.MODERN


MODERN_TECH_NODES: tuple[ProgressionNode, ...] = (
    ProgressionNode("NODE_TECH_MO_ACADEMICS", _MO, _T, "Academics", cost=1400,
                    is_free_root=True),
    ProgressionNode("NODE_TECH_MO_STEAM_ENGINE", _MO, _T, "Steam Engine", cost=1400,
                    is_free_root=True),
    ProgressionNode("NODE_TECH_MO_MILITARY_SCIENCE", _MO, _T, "Military Science", cost=1400,
                    is_free_root=True),
    ProgressionNode("NODE_TECH_MO_ELECTRICITY", _MO, _T, "Electricity", cost=2425,
                    prereqs=("NODE_TECH_MO_ACADEMICS",)),
    ProgressionNode("NODE_TECH_MO_URBANIZATION", _MO, _T, "Urbanization", cost=2425,
                    prereqs=("NODE_TECH_MO_ACADEMICS", "NODE_TECH_MO_STEAM_ENGINE")),
    ProgressionNode("NODE_TECH_MO_COMBUSTION", _MO, _T, "Combustion", cost=2425,
                    prereqs=("NODE_TECH_MO_STEAM_ENGINE", "NODE_TECH_MO_MILITARY_SCIENCE")),
    ProgressionNode("NODE_TECH_MO_INDUSTRIALIZATION", _MO, _T, "Industrialization", cost=2425,
                    prereqs=("NODE_TECH_MO_MILITARY_SCIENCE",)),
    ProgressionNode("NODE_TECH_MO_RADIO", _MO, _T, "Radio", cost=3000,
                    prereqs=("NODE_TECH_MO_ELECTRICITY", "NODE_TECH_MO_URBANIZATION")),
    ProgressionNode("NODE_TECH_MO_FLIGHT", _MO, _T, "Flight", cost=3000,
                    prereqs=("NODE_TECH_MO_URBANIZATION", "NODE_TECH_MO_COMBUSTION"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_MO_MASS_PRODUCTION", _MO, _T, "Mass Production", cost=3000,
                    prereqs=("NODE_TECH_MO_COMBUSTION", "NODE_TECH_MO_INDUSTRIALIZATION")),
    ProgressionNode("NODE_TECH_MO_MOBILIZATION", _MO, _T, "Mobilization", cost=4000,
                    prereqs=("NODE_TECH_MO_RADIO", "NODE_TECH_MO_FLIGHT"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_MO_ARMOR", _MO, _T, "Armor", cost=4000,
                    prereqs=("NODE_TECH_MO_FLIGHT", "NODE_TECH_MO_MASS_PRODUCTION"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_MO_AERODYNAMICS", _MO, _T, "Aerodynamics", cost=6000,
                    prereqs=("NODE_TECH_MO_MOBILIZATION", "NODE_TECH_MO_ARMOR"),
                    has_mastery=False),
    ProgressionNode("NODE_TECH_MO_ROCKETRY", _MO, _T, "Rocketry", cost=8500,
                    prereqs=("NODE_TECH_MO_AERODYNAMICS",), has_mastery=False),
    ProgressionNode("NODE_TECH_MO_NUCLEAR_FISSION", _MO, _T, "Nuclear Fission", cost=8500,
                    prereqs=("NODE_TECH_MO_AERODYNAMICS",), has_mastery=False),
    ProgressionNode("NODE_TECH_MO_FUTURE_TECH", _MO, _T, "Future Tech", cost=10000,
                    prereqs=("NODE_TECH_MO_ROCKETRY", "NODE_TECH_MO_NUCLEAR_FISSION"),
                    is_terminal=True, has_mastery=False),
)
