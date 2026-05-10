"""Modern civic (culture-common) tree node data.

Source: Civ 7 install at
`Base/modules/age-modern/data/progression-trees-culture-common.xml`.
The vanilla file has 19 progression nodes: 10 main tree + 9 ideology
branch nodes (3 ideologies x 3 nodes each).

We apply the **progressive ideology fix**:
the 9 ideology-specific nodes are NOT in the AP pool. Instead, we declare
3 generic ideology slots (Tier 1, 2, 3). The in-game JS mod maps each
generic slot onto whichever ideology the player picked at runtime.

Result: 10 main + 3 generic ideology = 13 nodes from Modern culture.
Three free roots (Modernization, Natural History, Social Question).
"""

from .nodes import Age, ProgressionNode, TreeKind


_C = TreeKind.CIVIC
_MO = Age.MODERN


# Synthetic node IDs for the progressive ideology slots. The mod maps
# completion of these onto whichever ideology branch the player took.
IDEOLOGY_TIER_1_NODE_ID: str = "NODE_CIVIC_MO_IDEOLOGY_TIER_1"
IDEOLOGY_TIER_2_NODE_ID: str = "NODE_CIVIC_MO_IDEOLOGY_TIER_2"
IDEOLOGY_TIER_3_NODE_ID: str = "NODE_CIVIC_MO_IDEOLOGY_TIER_3"


MODERN_CIVIC_NODES: tuple[ProgressionNode, ...] = (
    # Main tree
    ProgressionNode("NODE_CIVIC_MO_MAIN_MODERNIZATION", _MO, _C, "Modernization", cost=1600,
                    is_free_root=True),
    ProgressionNode("NODE_CIVIC_MO_MAIN_NATURAL_HISTORY", _MO, _C, "Natural History", cost=1600,
                    is_free_root=True),
    ProgressionNode("NODE_CIVIC_MO_MAIN_SOCIAL_QUESTION", _MO, _C, "Social Question", cost=1600,
                    is_free_root=True, has_mastery=False),
    ProgressionNode("NODE_CIVIC_MO_MAIN_POLITICAL_THEORY", _MO, _C, "Political Theory", cost=2750,
                    prereqs=("NODE_CIVIC_MO_MAIN_MODERNIZATION",
                             "NODE_CIVIC_MO_MAIN_NATURAL_HISTORY",
                             "NODE_CIVIC_MO_MAIN_SOCIAL_QUESTION"),
                    has_mastery=False),
    ProgressionNode("NODE_CIVIC_MO_MAIN_GLOBALISM", _MO, _C, "Globalism", cost=3750,
                    prereqs=("NODE_CIVIC_MO_MAIN_POLITICAL_THEORY",)),
    ProgressionNode("NODE_CIVIC_MO_MAIN_NATIONALISM", _MO, _C, "Nationalism", cost=3750,
                    prereqs=("NODE_CIVIC_MO_MAIN_POLITICAL_THEORY",)),
    ProgressionNode("NODE_CIVIC_MO_MAIN_CAPITALISM", _MO, _C, "Capitalism", cost=7500,
                    prereqs=("NODE_CIVIC_MO_MAIN_GLOBALISM",)),
    ProgressionNode("NODE_CIVIC_MO_MAIN_MILITARISM", _MO, _C, "Militarism", cost=7500,
                    prereqs=("NODE_CIVIC_MO_MAIN_NATIONALISM",)),
    ProgressionNode("NODE_CIVIC_MO_MAIN_HEGEMONY", _MO, _C, "Hegemony", cost=7500,
                    prereqs=("NODE_CIVIC_MO_MAIN_GLOBALISM", "NODE_CIVIC_MO_MAIN_NATIONALISM")),
    ProgressionNode("NODE_CIVIC_MO_MAIN_FUTURE_CIVIC", _MO, _C, "Future Civic", cost=8000,
                    prereqs=("NODE_CIVIC_MO_MAIN_HEGEMONY",
                             "NODE_CIVIC_MO_MAIN_MILITARISM",
                             "NODE_CIVIC_MO_MAIN_CAPITALISM"),
                    is_terminal=True, has_mastery=False),
    # Progressive ideology slots. Reachable once Political Theory is researched.
    ProgressionNode(IDEOLOGY_TIER_1_NODE_ID, _MO, _C, "Ideology Tier 1", cost=2750,
                    prereqs=("NODE_CIVIC_MO_MAIN_POLITICAL_THEORY",), has_mastery=False),
    ProgressionNode(IDEOLOGY_TIER_2_NODE_ID, _MO, _C, "Ideology Tier 2", cost=3250,
                    prereqs=(IDEOLOGY_TIER_1_NODE_ID,), has_mastery=False),
    ProgressionNode(IDEOLOGY_TIER_3_NODE_ID, _MO, _C, "Ideology Tier 3", cost=4500,
                    prereqs=(IDEOLOGY_TIER_2_NODE_ID,), has_mastery=False),
)
