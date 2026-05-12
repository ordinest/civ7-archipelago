"""Copy SeelingCat's "Et Cetera" Workshop mod JS file overrides into our
mod tree verbatim, preserving the relative path layout the modinfo
expects. The depth-aware `<base name LOC>_<tier>` lookup that makes
mastery tiers display distinct text only works when ALL of these files
are loaded together (Et Cetera ships them as a coherent bundle - the
tooltip, the card, the chooser screens, the completion popup, and the
sub-system-dock all touch the same render chain).

Each file is prepended with a short attribution header noting the
origin. The text XML is intentionally not copied: we maintain our own
per-seed `text/en_us/ap_text_overrides.xml` populated by the AP
companion at scout time.

Re-run after Et Cetera updates if you want to pull upstream changes.
"""
from __future__ import annotations

from pathlib import Path

ET_CETERA = Path(
    r"C:\Program Files (x86)\Steam\steamapps\workshop\content"
    r"\1295660\3553557269"
)
REPO_MOD = Path(__file__).resolve().parents[1] / "mod"

UI_SCRIPTS = [
    "ui/tree-grid/tree-card.js",
    "ui/sub-system-dock/panel-sub-system-dock.js",
    "ui/screens/choosers/culture-chooser/culture-chooser.js",
    "ui/screens/choosers/tech-chooser/tech-chooser.js",
    "ui/tech-tree/screen-tech-tree.js",
]
IMPORT_FILES = [
    "ui/tree-grid/tree-grid.chunk.js",
    "ui/utilities/utilities-textprovider.chunk.js",
    "ui/tech-civic-complete/screen-tech-civic-complete.js",
]

ATTRIBUTION_HEADER = (
    "// Civ 7 Archipelago: depth-aware tree rendering, copied verbatim\n"
    "// from SeelingCat's \"Et Cetera\" Workshop mod (id 3553557269).\n"
    "// Et Cetera implements the per-tier LOC fallback pattern\n"
    "// (`<base name LOC>_<tier>`) that lets mastery tiers display\n"
    "// distinct text - the exact mechanism the AP companion's\n"
    "// per-seed text overrides depend on. The patches span multiple\n"
    "// UI files (tooltip, card, chooser screens, completion popup,\n"
    "// sub-system-dock) and only work as a coherent bundle.\n"
    "//\n"
    "// Original author: SeelingCat. Source: Civ 7 Steam Workshop.\n"
    "//\n"
)


def main() -> int:
    if not ET_CETERA.exists():
        print(f"FAIL: Et Cetera Workshop install not found at {ET_CETERA}")
        return 1
    copied = 0
    for rel in UI_SCRIPTS + IMPORT_FILES:
        src = ET_CETERA / rel
        if not src.exists():
            print(f"WARN: missing {src}")
            continue
        dst = REPO_MOD / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        content = src.read_text(encoding="utf-8")
        dst.write_text(ATTRIBUTION_HEADER + content, encoding="utf-8")
        copied += 1
        print(f"  {rel}")
    print(f"OK: copied {copied} override files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
