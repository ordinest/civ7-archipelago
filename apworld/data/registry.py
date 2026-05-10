"""Master registry of progression nodes across all Ages and trees.

Single source of truth for Items, Locations, Regions, Rules. Adding a new
Age or tree means adding the data module and importing it here; downstream
code does not need to know which Age/tree a node belongs to.
"""

from .antiquity_civics import ANTIQUITY_CIVIC_NODES
from .antiquity_techs import ANTIQUITY_TECH_NODES
from .bundles import has_mastery as _has_mastery_in_data
from .exploration_civics import EXPLORATION_CIVIC_NODES
from .exploration_techs import EXPLORATION_TECH_NODES
from .modern_civics import MODERN_CIVIC_NODES
from .modern_techs import MODERN_TECH_NODES
from .nodes import Age, ProgressionNode, TreeKind


# Order matters for stable AP item-id assignment: items get IDs in the
# order they appear here. Adding new nodes at the END preserves IDs for
# existing items, which matters for save-game compatibility across patches.
ALL_NODES: tuple[ProgressionNode, ...] = (
    *ANTIQUITY_TECH_NODES,
    *ANTIQUITY_CIVIC_NODES,
    *EXPLORATION_TECH_NODES,
    *EXPLORATION_CIVIC_NODES,
    *MODERN_TECH_NODES,
    *MODERN_CIVIC_NODES,
)


NODES_BY_ID: dict[str, ProgressionNode] = {n.node_id: n for n in ALL_NODES}


def nodes_in_age(age: Age) -> tuple[ProgressionNode, ...]:
    return tuple(n for n in ALL_NODES if n.age == age)


def progression_nodes() -> tuple[ProgressionNode, ...]:
    """Nodes that produce AP items (every node except free roots)."""
    return tuple(n for n in ALL_NODES if not n.is_free_root)


def terminal_nodes() -> tuple[ProgressionNode, ...]:
    """Nodes whose collection-as-item indicates Age completion."""
    return tuple(n for n in ALL_NODES if n.is_terminal)


def masterable_nodes() -> tuple[ProgressionNode, ...]:
    """Nodes that can usefully be mastered: must have UnlockDepth=2 entries
    in the extracted XML data, AND not be a free root (free-root masteries
    aren't AP items because the base isn't an item either).

    The hand-set `has_mastery` flag on each ProgressionNode is treated as
    a hint; the bundle data is the source of truth.
    """
    return tuple(
        n for n in ALL_NODES
        if not n.is_free_root and _has_mastery_in_data(n.node_id)
    )
