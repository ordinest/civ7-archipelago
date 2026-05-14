"""Generate the hidden AP nodes XML for the Q1 unlock-decoupling.

Reads `apworld/data/extracted/{tech,civic}_unlocks.py` and emits
`mod/data/ap_hidden_nodes.xml`, which the mod ships under
`<UpdateDatabase>` in `archipelago.modinfo`.

For each non-free-root, non-civ-unique source tree node, the XML emits:
  - A `<Types>` row registering `NODE_AP_<source_id>` as a KIND_TREE_NODE.
  - A `<ProgressionTreeNodes>` row placing the hidden node in the same
    Age tree as the source (e.g. NODE_TECH_AQ_POTTERY hosts to
    TREE_TECHS_AQ).
  - `<ProgressionTreeNodeUnlocks>` rows mirroring the source's unlock
    entries (all depths, including RequiredTraitType-gated civ-unique
    variants and Hidden=true children — the engine handles per-civ
    filtering and modifier dispatch).
  - A `<Delete>` row stripping the source node's own unlock entries so
    natural research / civic adoption no longer auto-grants them. The
    AP-delivered hidden-node grant is the only path to the unlocks.

Skipped:
  - Free-root nodes: per DESIGN.md these are not AP items because the
    player gets them at game start. They keep their vanilla unlock
    rows untouched.
  - Civ-unique civic nodes (`NODE_CIVIC_<AGE>_<CIV>_*` where CIV is not
    MAIN): handled separately by capability 5's slot mechanism.

Run from repo root:

    .venv/Scripts/python.exe tests/build_hidden_nodes_xml.py

Re-run after the extractor refreshes `apworld/data/extracted/*.py`.
"""

from __future__ import annotations

import importlib.util
import sys
import types
import xml.sax.saxutils as saxutils
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EXTRACTED_DIR = REPO_ROOT / "apworld" / "data" / "extracted"
NODES_FILE = REPO_ROOT / "mod" / "data" / "ap_hidden_nodes.xml"
STRIPS_FILE = REPO_ROOT / "mod" / "data" / "ap_strip_vanilla_unlocks.xml"
FALLBACK_TEXT_FILE = REPO_ROOT / "mod" / "text" / "en_us" / "ap_hidden_nodes_fallback.xml"


# --------------------------------------------------------------------
# Free-root nodes (per DESIGN.md): the engine grants these at game
# start, so the player can research them turn 1 in vanilla. They're
# not AP items; their unlocks stay vanilla-bound.
# --------------------------------------------------------------------

FREE_ROOTS: frozenset[str] = frozenset({
    # Antiquity
    "NODE_TECH_AQ_AGRICULTURE",
    "NODE_CIVIC_AQ_MAIN_CHIEFDOM",
    # Exploration
    "NODE_TECH_EX_CARTOGRAPHY",
    "NODE_TECH_EX_ASTRONOMY",
    "NODE_TECH_EX_MACHINERY",
    "NODE_TECH_EX_ECONOMICS",
    "NODE_CIVIC_EX_MAIN_PIETY",
    # Modern
    "NODE_TECH_MO_ACADEMICS",
    "NODE_TECH_MO_STEAM_ENGINE",
    "NODE_TECH_MO_MILITARY_SCIENCE",
    "NODE_TECH_MO_MODERNIZATION",
    "NODE_CIVIC_MO_MAIN_NATURAL_HISTORY",
    "NODE_CIVIC_MO_MAIN_SOCIAL_QUESTION",
})


# --------------------------------------------------------------------
# Age tags and host trees. The source node ID encodes its Age via the
# `_AQ_` / `_EX_` / `_MO_` infix.
# --------------------------------------------------------------------

AGE_TAGS: dict[str, str] = {
    "AQ": "Antiquity",
    "EX": "Exploration",
    "MO": "Modern",
}

TECH_HOST: dict[str, str] = {
    "AQ": "TREE_TECHS_AQ",
    "EX": "TREE_TECHS_EX",
    "MO": "TREE_TECHS_MO",
}

CIVIC_HOST: dict[str, str] = {
    "AQ": "TREE_CIVICS_AQ_MAIN",
    "EX": "TREE_CIVICS_EX_MAIN",
    "MO": "TREE_CIVICS_MO_MAIN",
}


def _load_data_module(name: str) -> types.ModuleType:
    """Load `apworld/data/extracted/<name>.py` standalone."""
    src = EXTRACTED_DIR / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"extracted.{name}", src)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {src}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _classify(node_id: str) -> tuple[str, str] | None:
    """Return (system, age_code) or None if the node is excluded.

    system is one of "tech" / "civic". age_code is one of "AQ"/"EX"/"MO".
    Excludes free roots and civ-unique civic nodes.
    """
    if node_id in FREE_ROOTS:
        return None
    if node_id.startswith("NODE_TECH_"):
        for code in AGE_TAGS:
            prefix = f"NODE_TECH_{code}_"
            if node_id.startswith(prefix):
                return ("tech", code)
        return None
    if node_id.startswith("NODE_CIVIC_"):
        for code in AGE_TAGS:
            prefix = f"NODE_CIVIC_{code}_MAIN_"
            if node_id.startswith(prefix):
                return ("civic", code)
        return None
    return None


def _hidden_id(source_id: str) -> str:
    # Strip the redundant "NODE_" prefix from the source id so the
    # final hidden id is NODE_AP_TECH_AQ_X rather than NODE_AP_NODE_TECH_AQ_X.
    bare = source_id[len("NODE_"):] if source_id.startswith("NODE_") else source_id
    return f"NODE_AP_{bare}"


def _fallback_display(source_id: str, system: str, age_code: str) -> str:
    """Derive a readable AP-item-style fallback name from a source id.

    Examples:
      NODE_TECH_AQ_POTTERY        -> "Antiquity Tech: Pottery"
      NODE_TECH_AQ_ANIMAL_HUSBANDRY -> "Antiquity Tech: Animal Husbandry"
      NODE_TECH_EX_FUTURE_TECH    -> "Exploration Tech: Future Tech"
      NODE_CIVIC_AQ_MAIN_CODE_OF_LAWS -> "Antiquity Civic: Code Of Laws"

    Used as the LOC fallback when the AP companion hasn't written a
    per-seed override for the hidden node's Name key.
    """
    age_name = AGE_TAGS[age_code]
    system_label = "Tech" if system == "tech" else "Civic"
    # Strip the known prefix (NODE_TECH_<AGE>_ or NODE_CIVIC_<AGE>_MAIN_)
    # then title-case the remainder with spaces.
    if system == "tech":
        prefix = f"NODE_TECH_{age_code}_"
    else:
        prefix = f"NODE_CIVIC_{age_code}_MAIN_"
    tail = source_id[len(prefix):] if source_id.startswith(prefix) else source_id
    display = " ".join(part.capitalize() for part in tail.split("_"))
    return f"{age_name} {system_label}: {display}"


def _loc_key(hidden_id: str) -> str:
    return f"LOC_{hidden_id}_NAME"


def _xml_attr(value: str) -> str:
    """Quote a string for use inside an XML attribute."""
    return saxutils.quoteattr(value)


def _collect_rows(
    unlocks_modules: dict[str, types.ModuleType],
) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    """Walk all source nodes and produce five row lists:
    (type_rows, node_rows, unlock_rows, delete_rows, loc_rows).
    Stable ordering.
    """
    type_rows: list[str] = []
    node_rows: list[str] = []
    unlock_rows: list[str] = []
    delete_rows: list[str] = []
    loc_rows: list[str] = []

    for module_name, mod in unlocks_modules.items():
        for varname in dir(mod):
            if not varname.endswith("_NODE_UNLOCKS"):
                continue
            table = getattr(mod, varname)
            for source_id, entries in sorted(table.items()):
                cls = _classify(source_id)
                if cls is None:
                    continue
                system, age_code = cls
                host_tree = (TECH_HOST if system == "tech" else CIVIC_HOST)[age_code]
                hidden_id = _hidden_id(source_id)
                loc_key = _loc_key(hidden_id)

                type_rows.append(
                    f'        <Row Type={_xml_attr(hidden_id)} Kind="KIND_TREE_NODE"/>'
                )
                node_rows.append(
                    f'        <Row ProgressionTreeNodeType={_xml_attr(hidden_id)} '
                    f'ProgressionTree={_xml_attr(host_tree)} Cost="1" '
                    f'Name={_xml_attr(loc_key)}/>'
                )

                for entry in entries:
                    parts = [
                        f'ProgressionTreeNodeType={_xml_attr(hidden_id)}',
                        f'TargetKind={_xml_attr(entry.target_kind)}',
                        f'TargetType={_xml_attr(entry.target_type)}',
                        f'UnlockDepth="{entry.unlock_depth}"',
                    ]
                    if entry.required_trait:
                        parts.append(f'RequiredTraitType={_xml_attr(entry.required_trait)}')
                    if entry.hidden:
                        parts.append('Hidden="true"')
                    unlock_rows.append(
                        f'        <Row {" ".join(parts)}/>'
                    )

                delete_rows.append(
                    f'        <Delete ProgressionTreeNodeType={_xml_attr(source_id)}/>'
                )

                fallback = _fallback_display(source_id, system, age_code)
                loc_rows.append(
                    f'        <Replace Tag={_xml_attr(loc_key)} Text={_xml_attr(fallback)}/>'
                )

    return type_rows, node_rows, unlock_rows, delete_rows, loc_rows


def _emit_nodes_xml(type_rows, node_rows, unlock_rows) -> str:
    """ap_hidden_nodes.xml: defines the hidden AP tree nodes and their
    unlock rows. Additive — does not modify vanilla. Safe to ship alone.
    """
    out: list[str] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!--',
        '  Generated by tests/build_hidden_nodes_xml.py.',
        '  Do not edit by hand; re-run the generator.',
        '',
        '  Defines hidden AP-controlled tree nodes hosted in the existing',
        '  per-Age tech and civic trees. Each carries the unlock rows the',
        '  corresponding vanilla source node owns, so GRANT_TREE_NODE on',
        '  the hidden node applies the same unlocks the vanilla node would.',
        '  The mod calls GRANT_TREE_NODE on these in response to AP item',
        '  delivery. Additive; does not modify vanilla unlock rows.',
        '-->',
        '<Database>',
        '    <Types>',
    ]
    out.extend(type_rows)
    out.append('    </Types>')
    out.append('    <ProgressionTreeNodes>')
    out.extend(node_rows)
    out.append('    </ProgressionTreeNodes>')
    out.append('    <ProgressionTreeNodeUnlocks>')
    out.extend(unlock_rows)
    out.append('    </ProgressionTreeNodeUnlocks>')
    out.append('</Database>')
    out.append('')
    return "\n".join(out)


def _emit_fallback_loc_xml(loc_rows) -> str:
    """ap_hidden_nodes_fallback.xml: default Name strings for every
    hidden AP node's Name LOC key. Wired into the modinfo's
    <LocalizedText> before the per-seed companion file so the AP
    companion's seed-specific names win on collision when connected.
    Without this, the unlock popup shows the raw LOC key.
    """
    out: list[str] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!--',
        '  Generated by tests/build_hidden_nodes_xml.py.',
        '  Do not edit by hand; re-run the generator.',
        '',
        '  Fallback display names for hidden-AP-node Name LOC keys.',
        '  Used when the AP companion has not (yet) written its per-seed',
        '  overrides for these keys; the companion file is loaded after',
        '  this one in the modinfo LocalizedText block and wins on',
        '  collision when connected.',
        '-->',
        '<Database>',
        '    <EnglishText>',
    ]
    out.extend(loc_rows)
    out.append('    </EnglishText>')
    out.append('</Database>')
    out.append('')
    return "\n".join(out)


def _emit_strip_xml(delete_rows) -> str:
    """ap_strip_vanilla_unlocks.xml: removes the vanilla unlock rows
    from the source tree nodes so research alone no longer auto-grants
    them. Ship this ONLY when the mod runtime + companion are ready to
    deliver the unlocks via AP items; otherwise offline play breaks.
    """
    out: list[str] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!--',
        '  Generated by tests/build_hidden_nodes_xml.py.',
        '  Do not edit by hand; re-run the generator.',
        '',
        '  Strips the vanilla unlock rows from every non-free-root,',
        '  non-civ-unique source tree node. Research / civic adoption',
        '  alone no longer auto-grants the unlocks; the AP-delivered',
        '  hidden-node grant becomes the only path.',
        '',
        '  Ship only when the mod runtime is wired to grant hidden',
        '  nodes via AP delivery AND the companion is writing per-seed',
        '  LOC overrides. Without both, offline play loses access to',
        '  every non-free-root unlock.',
        '-->',
        '<Database>',
        '    <ProgressionTreeNodeUnlocks>',
    ]
    out.extend(delete_rows)
    out.append('    </ProgressionTreeNodeUnlocks>')
    out.append('</Database>')
    out.append('')
    return "\n".join(out)


def main() -> int:
    if not EXTRACTED_DIR.exists():
        print(f"FAIL: {EXTRACTED_DIR} not found; run extract_civ7_data.py first")
        return 1

    modules = {
        "tech": _load_data_module("tech_unlocks"),
        "civic": _load_data_module("civic_unlocks"),
    }

    type_rows, node_rows, unlock_rows, delete_rows, loc_rows = _collect_rows(modules)

    NODES_FILE.parent.mkdir(parents=True, exist_ok=True)
    NODES_FILE.write_text(
        _emit_nodes_xml(type_rows, node_rows, unlock_rows), encoding="utf-8"
    )
    STRIPS_FILE.write_text(_emit_strip_xml(delete_rows), encoding="utf-8")
    FALLBACK_TEXT_FILE.parent.mkdir(parents=True, exist_ok=True)
    FALLBACK_TEXT_FILE.write_text(_emit_fallback_loc_xml(loc_rows), encoding="utf-8")

    print(f"[build] wrote {NODES_FILE}")
    print(f"  hidden nodes: {len(type_rows)}")
    print(f"  unlock rows:  {len(unlock_rows)}")
    print(f"[build] wrote {STRIPS_FILE}")
    print(f"  vanilla strips: {len(delete_rows)}")
    print(f"[build] wrote {FALLBACK_TEXT_FILE}")
    print(f"  fallback LOC rows: {len(loc_rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
