"""Exploration civic (culture-common) tree node data.

Source: Civ 7 install at
`Base/modules/age-exploration/data/progression-trees-culture-common.xml`.
13 main-tree nodes. Two free roots (Economics, Piety).

The Theology branch (`TREE_CIVICS_EX_BRANCH_THEOLOGY`, 2 nodes) is
intentionally omitted from this v0.1 scope. It is reveal-gated by
religion conditions and not always available; treating it as part of
the AP pool would mean some seeds have unreachable locations. Future
phase can add it as conditional content.
"""

from .nodes import Age, ProgressionNode, TreeKind


_C = TreeKind.CIVIC
_EX = Age.EXPLORATION


EXPLORATION_CIVIC_NODES: tuple[ProgressionNode, ...] = (
    ProgressionNode("NODE_CIVIC_EX_MAIN_ECONOMICS", _EX, _C, "Economics", cost=700,
                    is_free_root=True, has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_PIETY", _EX, _C, "Piety", cost=700,
                    is_free_root=True, has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_MERCANTILISM", _EX, _C, "Mercantilism", cost=900,
                    prereqs=("NODE_CIVIC_EX_MAIN_ECONOMICS",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_AUTHORITY", _EX, _C, "Authority", cost=900,
                    prereqs=("NODE_CIVIC_EX_MAIN_ECONOMICS", "NODE_CIVIC_EX_MAIN_PIETY")),
    ProgressionNode("NODE_CIVIC_EX_MAIN_INSPIRATION", _EX, _C, "Inspiration", cost=900,
                    prereqs=("NODE_CIVIC_EX_MAIN_PIETY",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_COLONIALISM", _EX, _C, "Colonialism", cost=1300,
                    prereqs=("NODE_CIVIC_EX_MAIN_MERCANTILISM",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_BUREAUCRACY", _EX, _C, "Bureaucracy", cost=1300,
                    prereqs=("NODE_CIVIC_EX_MAIN_AUTHORITY",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_DIPLOMATIC_SERVICE", _EX, _C, "Diplomatic Service", cost=1300,
                    prereqs=("NODE_CIVIC_EX_MAIN_AUTHORITY",)),
    ProgressionNode("NODE_CIVIC_EX_MAIN_SOCIETY", _EX, _C, "Society", cost=1300,
                    prereqs=("NODE_CIVIC_EX_MAIN_INSPIRATION",), has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_IMPERIALISM", _EX, _C, "Imperialism", cost=2100,
                    prereqs=("NODE_CIVIC_EX_MAIN_COLONIALISM", "NODE_CIVIC_EX_MAIN_BUREAUCRACY"),
                    has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_SOVEREIGNTY", _EX, _C, "Sovereignty", cost=2100,
                    prereqs=("NODE_CIVIC_EX_MAIN_BUREAUCRACY", "NODE_CIVIC_EX_MAIN_DIPLOMATIC_SERVICE"),
                    has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_SOCIAL_CLASS", _EX, _C, "Social Class", cost=2100,
                    prereqs=("NODE_CIVIC_EX_MAIN_DIPLOMATIC_SERVICE", "NODE_CIVIC_EX_MAIN_SOCIETY"),
                    has_mastery=False),
    ProgressionNode("NODE_CIVIC_EX_MAIN_FUTURE_CIVIC", _EX, _C, "Future Civic", cost=3000,
                    prereqs=("NODE_CIVIC_EX_MAIN_IMPERIALISM",
                             "NODE_CIVIC_EX_MAIN_SOVEREIGNTY",
                             "NODE_CIVIC_EX_MAIN_SOCIAL_CLASS"),
                    is_terminal=True, has_mastery=False),
)
