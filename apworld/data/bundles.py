"""Aggregate access to per-Age unlock bundles.

The extracted data lives per-Age in `apworld/data/extracted/`.
This module provides cross-Age accessors so other code can query
"is this node masterable?" or "give me the unlocks for this node at
this depth?" without knowing which Age the node belongs to.
"""

from .extracted.tech_unlocks import (
    ANTIQUITY_NODE_UNLOCKS as ANT_TECH,
    EXPLORATION_NODE_UNLOCKS as EXP_TECH,
    MODERN_NODE_UNLOCKS as MOD_TECH,
)
from .extracted.civic_unlocks import (
    ANTIQUITY_NODE_UNLOCKS as ANT_CIV,
    EXPLORATION_NODE_UNLOCKS as EXP_CIV,
    MODERN_NODE_UNLOCKS as MOD_CIV,
)


# Combined map: node_id -> tuple of Unlock entries (across all depths).
NODE_UNLOCKS: dict[str, tuple] = {
    **ANT_TECH, **EXP_TECH, **MOD_TECH,
    **ANT_CIV, **EXP_CIV, **MOD_CIV,
}


def has_mastery(node_id: str) -> bool:
    """A node is considered masterable if any of its declared unlocks
    is at UnlockDepth=2. Vanilla Civ 7 lets the player buy a node a
    second time regardless, but for AP purposes "no UnlockDepth=2
    entries" means mastery is a no-op grant we should skip.
    """
    entries = NODE_UNLOCKS.get(node_id, ())
    return any(e.unlock_depth == 2 for e in entries)


def unlocks_at_depth(node_id: str, depth: int) -> tuple:
    """Return the unlock entries for `node_id` at the given depth (1 or 2)."""
    entries = NODE_UNLOCKS.get(node_id, ())
    return tuple(e for e in entries if e.unlock_depth == depth)
