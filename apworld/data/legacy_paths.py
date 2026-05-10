"""Legacy Path milestone data for Civ 7 AP.

Source: Civ 7 install at
`Base/modules/age-<age>/data/victories.xml` (`<AgeProgressionMilestones>`).

Each Age has 4 Legacy Paths (Science, Military, Culture, Economic). Each
path has 3 milestones (1, 2, 3 = Golden Age). 4 paths * 3 * 3 Ages = 36
location candidates.

These are LOCATIONS only, not items. AP fill places filler at them; in
game, completing a milestone fires the AP location check. No corresponding
item exists in the pool.
"""

from dataclasses import dataclass
from enum import StrEnum

from .nodes import Age


class LegacyPathType(StrEnum):
    SCIENCE = "Science"
    MILITARY = "Military"
    CULTURE = "Culture"
    ECONOMIC = "Economic"


@dataclass(frozen=True)
class LegacyMilestone:
    """One Legacy Path milestone location."""

    age: Age
    path: LegacyPathType
    milestone: int  # 1, 2, or 3
    civ7_milestone_id: str  # e.g. ANTIQUITY_SCIENCE_MILESTONE_1

    @property
    def location_name(self) -> str:
        return f"{self.age.value} Legacy Path: {self.path.value} {self.milestone}"


_MILESTONE_PER_AGE = ((LegacyPathType.SCIENCE, "SCIENCE"),
                      (LegacyPathType.MILITARY, "MILITARY"),
                      (LegacyPathType.CULTURE, "CULTURE"),
                      (LegacyPathType.ECONOMIC, "ECONOMIC"))


def _build_milestones() -> tuple[LegacyMilestone, ...]:
    out: list[LegacyMilestone] = []
    for age, age_id in ((Age.ANTIQUITY, "ANTIQUITY"),
                        (Age.EXPLORATION, "EXPLORATION"),
                        (Age.MODERN, "MODERN")):
        for path, path_id in _MILESTONE_PER_AGE:
            for ms in (1, 2, 3):
                out.append(LegacyMilestone(
                    age=age,
                    path=path,
                    milestone=ms,
                    civ7_milestone_id=f"{age_id}_{path_id}_MILESTONE_{ms}",
                ))
    return tuple(out)


LEGACY_MILESTONES: tuple[LegacyMilestone, ...] = _build_milestones()
