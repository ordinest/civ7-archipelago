"""One-shot installer for the Civ 7 AP mod.

Creates the Civ 7 user-mods directory if missing and symlinks (or copies
on failure) the project's `mod/` directory into it. Idempotent: safe to
re-run after edits.

Run from the repo root:

    .venv/Scripts/python.exe tests/setup_mod_install.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MOD_SRC = REPO_ROOT / "mod"

# Civ 7 user data lives at %LOCALAPPDATA%\Firaxis Games\Sid Meier's
# Civilization VII\, NOT Documents\My Games\... (that was the Civ 6
# convention). Verified on this install: AppOptions.txt and Mods/
# both live here.
CIV7_USERDATA = (
    Path.home() / "AppData" / "Local" / "Firaxis Games" / "Sid Meier's Civilization VII"
)
MODS_DIR = CIV7_USERDATA / "Mods"
MOD_DST = MODS_DIR / "civ7-archipelago"
APP_OPTIONS = CIV7_USERDATA / "AppOptions.txt"

# Stale path that earlier setup runs created. We clean it up if found.
LEGACY_DOCS_MOD = (
    Path.home() / "Documents" / "My Games" / "Sid Meier's Civilization VII"
    / "Mods" / "civ7-archipelago"
)


def main() -> int:
    if not MOD_SRC.exists():
        print(f"[setup] FAIL: mod source not found at {MOD_SRC}")
        return 1

    print(f"[setup] mod source:      {MOD_SRC}")
    print(f"[setup] Civ 7 user dir:  {CIV7_USERDATA}")
    print(f"[setup] target mod dir:  {MOD_DST}")
    print()

    if not CIV7_USERDATA.exists():
        print(f"[setup] FAIL: Civ 7 user dir does not exist at {CIV7_USERDATA}.")
        print(f"        Launch Civ 7 once to generate it, then re-run.")
        return 2
    MODS_DIR.mkdir(parents=True, exist_ok=True)

    # Clean up the stale Documents path some earlier setup runs may have
    # created. Civ 7 does not use Documents/My Games for mods.
    if LEGACY_DOCS_MOD.exists() or LEGACY_DOCS_MOD.is_symlink():
        if LEGACY_DOCS_MOD.is_symlink():
            LEGACY_DOCS_MOD.unlink()
            print(f"[setup] cleaned up stale symlink at {LEGACY_DOCS_MOD}")
        else:
            shutil.rmtree(LEGACY_DOCS_MOD)
            print(f"[setup] cleaned up stale directory at {LEGACY_DOCS_MOD}")

    if MOD_DST.exists() or MOD_DST.is_symlink():
        if MOD_DST.is_symlink():
            print(f"[setup] symlink already exists at {MOD_DST}; "
                  f"removing and re-linking")
            MOD_DST.unlink()
        else:
            print(f"[setup] target dir already exists at {MOD_DST}; "
                  f"removing and replacing")
            shutil.rmtree(MOD_DST)

    # Civ 7's mod scanner does not follow Windows symlinks, so we copy.
    # Re-run this script after editing the mod source to refresh.
    shutil.copytree(MOD_SRC, MOD_DST)
    print(f"[setup] copied to {MOD_DST}")
    print(f"[setup] note: copy is one-way; re-run this script after mod edits.")

    # AppOptions.txt: only touch if Civ 7 has already created it. Otherwise
    # let Civ 7 generate it on first launch and instruct the user to enable
    # tuner manually (we do not know the rest of the file's expected format).
    if APP_OPTIONS.exists():
        text = APP_OPTIONS.read_text(encoding="utf-8")
        before = text
        if "EnableTuner" not in text:
            text = text.rstrip() + "\nEnableTuner 1\n"
        else:
            # Replace value with 1 if currently disabled.
            new_lines = []
            for line in text.splitlines():
                if line.strip().startswith("EnableTuner"):
                    new_lines.append("EnableTuner 1")
                else:
                    new_lines.append(line)
            text = "\n".join(new_lines) + "\n"
        if "EnableDebugPanels" not in text:
            text = text.rstrip() + "\nEnableDebugPanels 1\n"
        else:
            new_lines = []
            for line in text.splitlines():
                if line.strip().startswith("EnableDebugPanels"):
                    new_lines.append("EnableDebugPanels 1")
                else:
                    new_lines.append(line)
            text = "\n".join(new_lines) + "\n"
        if text != before:
            APP_OPTIONS.write_text(text, encoding="utf-8")
            print(f"[setup] updated AppOptions.txt: EnableTuner=1, "
                  f"EnableDebugPanels=1")
        else:
            print(f"[setup] AppOptions.txt already has EnableTuner=1 and "
                  f"EnableDebugPanels=1")
    else:
        print()
        print("[setup] AppOptions.txt does not exist yet.")
        print("        Launch Civ 7 once to generate it, then re-run this "
              "script (or edit manually):")
        print(f"            File:  {APP_OPTIONS}")
        print( "            Add:   EnableTuner 1")
        print( "                   EnableDebugPanels 1")

    print()
    print("[setup] done. Next:")
    print("  1. Launch Civilization VII via Steam.")
    print("  2. Open the in-game mod browser; enable 'Civilization VII Archipelago'.")
    print("  3. Start a single-player game; get to turn 1.")
    print("  4. From a terminal:")
    print("       ~/source/Archipelago/.venv/Scripts/python.exe \\")
    print("         ~/source/civ7-archipelago/tests/smoke_in_game.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
