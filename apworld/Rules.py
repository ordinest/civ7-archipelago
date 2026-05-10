"""Logic rules for the Civ 7 Archipelago world.

Each base-completion location requires the items corresponding to the
node's vanilla prereqs already in the player's state. Free-root nodes
have no prereqs (or only free-root prereqs) and are reachable from start.

Win condition: the terminal nodes of every active Age have been received
as items.
"""

from worlds.generic.Rules import set_rule

from .data.registry import ALL_NODES, NODES_BY_ID, masterable_nodes, terminal_nodes


def set_rules(world: "Civ7World") -> None:  # noqa: F821 (forward reference)
    multiworld = world.multiworld
    player = world.player

    for node in ALL_NODES:
        # Free-root prereqs do not produce AP items, so we exclude them
        # from the rule. A node whose only prereq is a free root is
        # therefore reachable from start without any items.
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

    # Mastery-completion rules: requires the base node's item, since you
    # cannot master a node without having researched it. Free roots still
    # need this check because masteries fire on the second purchase of
    # the node, which only happens after the first (base) completion. But
    # free-root nodes do not produce items, so their masteries are
    # reachable without any item check (Antiquity Chiefdom mastery, for
    # example).
    for node in masterable_nodes():
        if node.is_free_root:
            continue
        set_rule(
            multiworld.get_location(node.mastery_location_name, player),
            lambda state, item=node.item_name: state.has(item, player),
        )

    # Win condition: every terminal node has been collected as an item.
    # That implies the seed walked all the way through every Age's tech
    # and civic trees to their respective Future-* nodes.
    terminals = terminal_nodes()
    terminal_names = tuple(t.item_name for t in terminals)
    multiworld.completion_condition[player] = lambda state: all(
        state.has(name, player) for name in terminal_names
    )
