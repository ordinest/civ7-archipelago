"""Unified progression-node model for Civ 7 AP.

A single dataclass for both tech and civic nodes across all three Ages.
Source of truth is the Civ 7 install XML at
`Base/modules/age-<age>/data/progression-trees-<tech|culture-common>.xml`.

Free roots are nodes the player can research from turn 1 within their
Age (no prereqs in vanilla). They are intentionally absent from the AP
items pool because the player does not need an AP grant to research them.
The location for a free root still exists, since completing the node
in-game still fires an AP location check.
"""

from dataclasses import dataclass, field
from enum import StrEnum


class Age(StrEnum):
    ANTIQUITY = "Antiquity"
    EXPLORATION = "Exploration"
    MODERN = "Modern"


class TreeKind(StrEnum):
    TECH = "Tech"
    CIVIC = "Civic"


@dataclass(frozen=True)
class ProgressionNode:
    """One node in an Age's tech or civic tree."""

    node_id: str  # internal Civ 7 ID, e.g. NODE_TECH_AQ_AGRICULTURE
    age: Age
    tree: TreeKind
    display: str  # human-readable name (e.g. "Agriculture")
    cost: int
    prereqs: tuple[str, ...] = field(default_factory=tuple)
    is_terminal: bool = False  # repeatable / age-ending node
    is_free_root: bool = False  # researchable from turn 1 within its Age
    has_mastery: bool = True  # mastery completion is a meaningful event

    @property
    def item_name(self) -> str:
        """Display name used as AP item and base-completion location name."""
        return f"{self.age.value} {self.tree.value}: {self.display}"

    @property
    def mastery_location_name(self) -> str:
        return f"{self.age.value} {self.tree.value} Mastery: {self.display}"
