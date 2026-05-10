"""Logic rules for the Civ 7 Archipelago world.

Each base-completion location requires the items corresponding to the
node's vanilla prereqs already in the player's state. Free-root nodes
have no prereqs (or only free-root prereqs) and are reachable from start.

Win condition is configured via the `goal` YAML option:
- normal_victory: a synthetic "Civ 7 Victory" event item, placed at a
  synthetic "Civ 7 Victory" event location that the in-game mod checks
  off when any vanilla Civ 7 victory triggers.
- legacy_paths: collect at least N golden-age (milestone-3) items,
  where N is `legacy_path_goal_count`.
- future_techs_civics: collect every terminal node item (Future Tech
  and Future Civic of each Age).
"""

from worlds.generic.Rules import set_rule

from .data.legacy_paths import LEGACY_MILESTONES
from .data.registry import ALL_NODES, NODES_BY_ID, masterable_nodes, terminal_nodes


VICTORY_EVENT_ITEM = "Civ 7 Victory"
VICTORY_EVENT_LOCATION = "Civ 7 Victory Trigger"


def set_rules(world: "Civ7World") -> None:  # noqa: F821 (forward reference)
    multiworld = world.multiworld
    player = world.player

    for node in ALL_NODES:
        non_free_prereqs = tuple(
            pid for pid in node.prereqs if not NODES_BY_ID[pid].is_free_root
        )
        if not non_free_prereqs:
            continue
        prereq_item_names = tuple(NODES_BY_ID[pid].item_name for pid in non_free_prereqs)

        def _make_rule(items: tuple[str, ...]):
            return lambda state: all(state.has(i, player) for i in items)

        set_rule(multiworld.get_location(node.item_name, player),
                 _make_rule(prereq_item_names))

    for node in masterable_nodes():
        if node.is_free_root:
            continue
        set_rule(
            multiworld.get_location(node.mastery_location_name, player),
            lambda state, item=node.item_name: state.has(item, player),
        )

    multiworld.completion_condition[player] = _completion_condition_for(world)


def _completion_condition_for(world: "Civ7World"):  # noqa: F821
    """Build the per-slot completion predicate from the goal option."""
    player = world.player
    goal = int(world.options.goal.value)

    if goal == 0:  # normal_victory
        return lambda state: state.has(VICTORY_EVENT_ITEM, player)

    if goal == 1:  # legacy_paths
        threshold = int(world.options.legacy_path_goal_count.value)
        golden_age_items = tuple(
            ms.item_name for ms in LEGACY_MILESTONES if ms.milestone == 3
        )
        return lambda state: sum(
            1 for name in golden_age_items if state.has(name, player)
        ) >= threshold

    if goal == 2:  # future_techs_civics
        terminal_names = tuple(t.item_name for t in terminal_nodes())
        return lambda state: all(state.has(name, player) for name in terminal_names)

    raise ValueError(f"unknown goal value {goal}")
