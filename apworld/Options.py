"""YAML options for the Civ 7 Archipelago world."""

from dataclasses import dataclass

from Options import Choice, DeathLink, DefaultOnToggle, PerGameCommonOptions, Range


class Goal(Choice):
    """Win condition for this slot.

    - normal_victory: any in-game Civ 7 victory triggers the win. Whatever
      victory types are enabled in the player's Civ 7 game settings count.
    - legacy_paths: collect a configurable number of Legacy Path golden
      ages (the third milestone of any path counts). Default threshold
      is 3, configurable via `legacy_path_goal_count`.
    - future_techs_civics: collect every Future Tech and Future Civic
      item (one per Age, six total).
    """
    display_name = "Goal"
    option_normal_victory = 0
    option_legacy_paths = 1
    option_future_techs_civics = 2
    default = 0


class LegacyPathGoalCount(Range):
    """When goal=legacy_paths, the number of Legacy Path golden ages
    (milestone 3 on any path) the slot must collect to win. Range 1-12
    since there are 12 total golden ages across 4 paths and 3 Ages.
    """
    display_name = "Legacy Path Goal Count"
    range_start = 1
    range_end = 12
    default = 3


class PantheonCheck(DefaultOnToggle):
    """Include the 'Pantheon Founded' check in the location pool. The
    in-game mod fires this when the player picks their pantheon belief.
    """
    display_name = "Pantheon Check"


class ReligionChecks(DefaultOnToggle):
    """Include 'Religion Founded' plus four 'Religious Belief Adopted
    Slot N' checks. The mod fires Religion Founded on ReligionFounded
    and a belief slot per BeliefAdded event in order.
    """
    display_name = "Religion Checks"


class WonderChecks(DefaultOnToggle):
    """Include three progressive 'Wonder Built Slot N' checks per Age.
    The Nth wonder the player completes in that Age fires the Nth slot.
    """
    display_name = "Wonder Checks"


class DiscoveryChecks(DefaultOnToggle):
    """Include five progressive 'Discovery Found Slot N' checks per Age,
    fired when the player pops a Goody Hut. The original goody-hut
    reward is replaced by the multiworld item placed at that slot.
    """
    display_name = "Discovery Checks"


@dataclass
class Civ7Options(PerGameCommonOptions):
    goal: Goal
    legacy_path_goal_count: LegacyPathGoalCount
    pantheon_check: PantheonCheck
    religion_checks: ReligionChecks
    wonder_checks: WonderChecks
    discovery_checks: DiscoveryChecks
    death_link: DeathLink
