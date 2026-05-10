"""Launcher that disables AP's per-world dep check before starting MultiServer.

Run from the AP root with the .archipelago archive as argv[1]:

    .venv/Scripts/python.exe path/to/run_server.py path/to/AP_xxx.zip
"""

import os
import sys
from pathlib import Path

AP_ROOT = Path(os.environ.get("ARCHIPELAGO_ROOT", Path.home() / "source" / "Archipelago"))
sys.path.insert(0, str(AP_ROOT))
os.chdir(AP_ROOT)

# Disable the per-world dep check. AP will still autoload all installed
# worlds, but ones with missing deps will simply be skipped.
import ModuleUpdate  # noqa: E402
ModuleUpdate.update_ran = True

# Now MultiServer can import.
import asyncio  # noqa: E402

from MultiServer import main as multiserver_main, parse_args  # noqa: E402

if __name__ == "__main__":
    asyncio.run(multiserver_main(parse_args()))
