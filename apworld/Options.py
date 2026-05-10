"""YAML options for the Civ 7 Archipelago world.

Smoke test: minimal options. DeathLink supported per the AP convention
even if not exercised in the smoke flow. Real options (boostsanity-equivalent
Mastery toggle, attribute-point count range, ideology mapping mode, etc.)
layer in here as the design expands.
"""

from dataclasses import dataclass

from Options import DeathLink, PerGameCommonOptions


@dataclass
class Civ7Options(PerGameCommonOptions):
    death_link: DeathLink
