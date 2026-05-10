"""Smoke-test driver for the Civ 7 apworld.

Bypasses ModuleUpdate's per-world dependency checks (which try to install
deps for every world in the AP repo) and runs generation directly.

Run from the Archipelago repo root with the AP venv active:

    .venv/Scripts/python.exe path/to/run_generation.py
"""

import os
import sys
from pathlib import Path

# Locate the Archipelago repo root. Default sibling path; override via env.
AP_ROOT = Path(os.environ.get("ARCHIPELAGO_ROOT", Path.home() / "source" / "Archipelago"))
if not (AP_ROOT / "Generate.py").exists():
    raise SystemExit(f"Archipelago repo not found at {AP_ROOT}; set ARCHIPELAGO_ROOT")

sys.path.insert(0, str(AP_ROOT))
os.chdir(AP_ROOT)

# Disable ModuleUpdate before any AP module imports it.
import ModuleUpdate  # noqa: E402
ModuleUpdate.update_ran = True  # short-circuit the per-world dep check

# Now the rest of AP can import safely.
from Generate import main as generate_main  # noqa: E402
from Main import main as er_main  # noqa: E402


if __name__ == "__main__":
    sys.argv = [
        "Generate.py",
        "--player_files_path", "Players",
        "--outputpath", "Generated_Output",
        "--skip_prog_balancing",
    ]
    erargs, seed = generate_main()
    print(f"\n[smoke] Generate.main() returned seed={seed}")
    multiworld = er_main(erargs, seed)
    print(f"[smoke] Main.main() returned multiworld with "
          f"{len(multiworld.worlds)} world(s)")
    print(f"[smoke] item pool size: {len(multiworld.itempool)}")
    print(f"[smoke] state.has check for completion: "
          f"{multiworld.completion_condition[1](multiworld.state)}")
