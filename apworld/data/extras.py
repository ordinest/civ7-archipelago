"""Extra-check declarations for caps 6-9 (Pantheon, Religion, Wonders,
Discoveries).

These capabilities all add locations only (no new items); the items pool
is balanced by additional filler. Pure-check pattern; the in-game mod
fires the matching engine event and the player gets whatever the
multiworld placed there.

Slot counts here are studio defaults; cap 13 will gate them with YAML
toggles, but the static LOCATION_TABLE always enumerates them so AP's
class-level location_name_to_id stays stable.
"""

from .nodes import Age


# Cap 6: a single Pantheon Founded check. Civ 7 only allows one pantheon
# belief per civ; no further pantheon picks beyond the initial one.
PANTHEON_LOCATION_NAME: str = "Pantheon Founded"


# Cap 7: Religion Founded + 4 Belief Adopted slots. Civ 7 religions have
# Founder, Enhancer, and two Worshipper-style beliefs; 4 slots covers
# any reasonable belief count.
RELIGION_FOUNDED_LOCATION_NAME: str = "Religion Founded"
RELIGION_BELIEF_SLOT_COUNT: int = 4


def religion_belief_location_name(slot: int) -> str:
    return f"Religious Belief Adopted Slot {slot}"


# Cap 8: Wonders. Three progressive slots per Age. The Nth wonder the
# player completes in a given Age fires the Nth slot location for that
# Age. With 21/12/14 wonders available across the three Ages, three
# slots per Age is comfortably reachable in a normal game.
WONDER_SLOTS_PER_AGE: int = 3


def wonder_location_name(age: Age, slot: int) -> str:
    return f"{age.value} Wonder Built Slot {slot}"


# Cap 9: Discoveries (Goody Huts). Five progressive slots per Age. Maps
# count and goody-hut density vary, so five is a conservative reach.
DISCOVERY_SLOTS_PER_AGE: int = 5


def discovery_location_name(age: Age, slot: int) -> str:
    return f"{age.value} Discovery Found Slot {slot}"


def all_wonder_locations() -> list[tuple[Age, int, str]]:
    out: list[tuple[Age, int, str]] = []
    for age in Age:
        for slot in range(1, WONDER_SLOTS_PER_AGE + 1):
            out.append((age, slot, wonder_location_name(age, slot)))
    return out


def all_discovery_locations() -> list[tuple[Age, int, str]]:
    out: list[tuple[Age, int, str]] = []
    for age in Age:
        for slot in range(1, DISCOVERY_SLOTS_PER_AGE + 1):
            out.append((age, slot, discovery_location_name(age, slot)))
    return out


def all_religion_belief_locations() -> list[tuple[int, str]]:
    return [
        (slot, religion_belief_location_name(slot))
        for slot in range(1, RELIGION_BELIEF_SLOT_COUNT + 1)
    ]
