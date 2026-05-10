"""Antiquity civic (culture-common) tree node data.

Source: Civ 7 install at
`Base/modules/age-antiquity/data/progression-trees-culture-common.xml`.
14 nodes in `TREE_CIVICS_AQ_MAIN`. Chiefdom is the free root.
Civ-specific civic trees (`progression-trees-culture-unique.xml`) are
intentionally NOT included; per design they stay vanilla in-game.
"""

from .nodes import Age, ProgressionNode, TreeKind


_C = TreeKind.CIVIC
_AQ = Age.ANTIQUITY


ANTIQUITY_CIVIC_NODES: tuple[ProgressionNode, ...] = (
    ProgressionNode("NODE_CIVIC_AQ_MAIN_CHIEFDOM", _AQ, _C, "Chiefdom", cost=90,
                    is_free_root=True, has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_MYSTICISM", _AQ, _C, "Mysticism", cost=125,
                    prereqs=("NODE_CIVIC_AQ_MAIN_CHIEFDOM",)),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_DISCIPLINE", _AQ, _C, "Discipline", cost=125,
                    prereqs=("NODE_CIVIC_AQ_MAIN_CHIEFDOM",)),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_PUBLIC_LIFE", _AQ, _C, "Public Life", cost=245,
                    prereqs=("NODE_CIVIC_AQ_MAIN_MYSTICISM",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_CODE_OF_LAWS", _AQ, _C, "Code of Laws", cost=245,
                    prereqs=("NODE_CIVIC_AQ_MAIN_MYSTICISM", "NODE_CIVIC_AQ_MAIN_DISCIPLINE")),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_TACTICS", _AQ, _C, "Tactics", cost=245,
                    prereqs=("NODE_CIVIC_AQ_MAIN_DISCIPLINE",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_ENTERTAINMENT", _AQ, _C, "Entertainment", cost=450,
                    prereqs=("NODE_CIVIC_AQ_MAIN_PUBLIC_LIFE",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_CITIZENSHIP", _AQ, _C, "Citizenship", cost=450,
                    prereqs=("NODE_CIVIC_AQ_MAIN_CODE_OF_LAWS",)),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_ORG_MILITARY", _AQ, _C, "Organized Military", cost=450,
                    prereqs=("NODE_CIVIC_AQ_MAIN_TACTICS",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_LITERACY", _AQ, _C, "Literacy", cost=600,
                    prereqs=("NODE_CIVIC_AQ_MAIN_CITIZENSHIP",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_SKILLED_TRADES", _AQ, _C, "Skilled Trades", cost=600,
                    prereqs=("NODE_CIVIC_AQ_MAIN_CITIZENSHIP",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_PHILOSOPHY", _AQ, _C, "Philosophy", cost=750,
                    prereqs=("NODE_CIVIC_AQ_MAIN_LITERACY",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_COMMERCE", _AQ, _C, "Commerce", cost=750,
                    prereqs=("NODE_CIVIC_AQ_MAIN_SKILLED_TRADES",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_AQ_MAIN_FUTURE_CIVIC", _AQ, _C, "Future Civic", cost=1000,
                    prereqs=("NODE_CIVIC_AQ_MAIN_ENTERTAINMENT",
                             "NODE_CIVIC_AQ_MAIN_PHILOSOPHY",
                             "NODE_CIVIC_AQ_MAIN_COMMERCE",
                             "NODE_CIVIC_AQ_MAIN_ORG_MILITARY"),
                    is_terminal=True, has_mastery=False),
)
