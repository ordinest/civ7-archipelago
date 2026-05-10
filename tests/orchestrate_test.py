"""End-to-end test orchestrator.

Spawns the AP server and the Civ7Client, streams both, monitors the
in-game queue, and reports the result.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
AP_ROOT = Path.home() / "source" / "Archipelago"
AP_PYTHON = AP_ROOT / ".venv" / "Scripts" / "python.exe"
SERVER_LOG = Path(os.environ.get("TEMP", "/tmp")) / "ap_server.log"
CLIENT_LOG = Path(os.environ.get("TEMP", "/tmp")) / "ap_client.log"


def latest_archive() -> Path:
    out_dir = AP_ROOT / "Generated_Output"
    archives = sorted(out_dir.glob("AP_*.zip"))
    assert archives, f"no archives in {out_dir}"
    return archives[-1]


def spawn(cmd: list[str], log: Path) -> subprocess.Popen:
    log.write_text("")
    f = log.open("ab", buffering=0)
    return subprocess.Popen(
        cmd,
        stdout=f,
        stderr=subprocess.STDOUT,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )


def main() -> int:
    archive = latest_archive()
    print(f"[orch] using archive {archive.name}")

    server = spawn(
        [str(AP_PYTHON), str(REPO_ROOT / "tests" / "run_server.py"),
         "--port", "38281", "--host", "127.0.0.1", "--loglevel", "info",
         str(archive)],
        SERVER_LOG,
    )
    print(f"[orch] server pid={server.pid}; log {SERVER_LOG}")
    deadline = time.monotonic() + 15.0
    hosting = False
    while time.monotonic() < deadline:
        time.sleep(0.5)
        try:
            text = SERVER_LOG.read_text(errors="replace")
        except FileNotFoundError:
            continue
        if "Hosting game" in text:
            hosting = True
            break
    if not hosting:
        print("[orch] server didn't reach 'Hosting game' within 15s; tail:")
        for line in SERVER_LOG.read_text(errors="replace").splitlines()[-10:]:
            print(f"  {line}")
        server.terminate()
        return 1
    print("[orch] server is hosting")

    client = spawn(
        [str(AP_PYTHON), str(REPO_ROOT / "client" / "Civ7Client.py"),
         "--connect", "127.0.0.1:38281",
         "--name", "Tester",
         "--nogui"],
        CLIENT_LOG,
    )
    print(f"[orch] client pid={client.pid}; log {CLIENT_LOG}")
    time.sleep(15)  # let the cascade run

    print("\n--- client log tail ---")
    for line in CLIENT_LOG.read_text(errors="replace").splitlines()[-30:]:
        print(f"  {line}")
    print("\n--- server log tail ---")
    for line in SERVER_LOG.read_text(errors="replace").splitlines()[-15:]:
        print(f"  {line}")

    print("\n[orch] terminating both processes")
    client.terminate()
    server.terminate()
    try:
        client.wait(timeout=5)
    except subprocess.TimeoutExpired:
        client.kill()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
    return 0


if __name__ == "__main__":
    sys.exit(main())
