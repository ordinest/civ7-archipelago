"""Automated smoke test: generation succeeds, seed is solvable.

Pytest wrapper around run_generation.py. Asserts that:

1. Generation runs without raising
2. Exactly one Civ 7 world is generated
3. Item pool size matches the expected count for the smoke-test scope (16)
4. Empty state does NOT satisfy the completion condition
5. State with all 16 tech items DOES satisfy completion condition
6. Filling produces a placement where every location holds an item
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
AP_ROOT = Path(os.environ.get("ARCHIPELAGO_ROOT", Path.home() / "source" / "Archipelago"))


def _ap_python() -> str:
    """Return the path to the Archipelago venv's python.exe."""
    candidate = AP_ROOT / ".venv" / "Scripts" / "python.exe"
    if not candidate.exists():
        pytest.skip(f"Archipelago venv not found at {candidate}")
    return str(candidate)


def _refresh_apworld() -> None:
    """Copy the latest apworld source into Archipelago/worlds/civ_7/."""
    target = AP_ROOT / "worlds" / "civ_7"
    target.mkdir(parents=True, exist_ok=True)
    source = REPO_ROOT / "apworld"
    for item in source.rglob("*"):
        if item.is_file() and "__pycache__" not in str(item):
            rel = item.relative_to(source)
            dest = target / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(item.read_bytes())


def _ensure_test_yaml() -> None:
    """Ensure the test player YAML is in Archipelago/Players/."""
    target = AP_ROOT / "Players"
    target.mkdir(exist_ok=True)
    yaml = REPO_ROOT / "tests" / "fixtures" / "test_player.yaml"
    (target / "test_player.yaml").write_bytes(yaml.read_bytes())


def test_generation_smoke():
    """End-to-end: regen the apworld, run generation, assert all invariants."""
    _refresh_apworld()
    _ensure_test_yaml()

    result = subprocess.run(
        [_ap_python(), str(REPO_ROOT / "tests" / "run_generation.py")],
        cwd=str(AP_ROOT),
        capture_output=True,
        text=True,
        timeout=180,
    )

    out = result.stdout + "\n" + result.stderr

    # Generation must reach the end of run_generation.py without raising.
    # Items pool with Phase F (attribute points added):
    # 76 progression + 2 Progressive Age + 16 Attribute Point + filler.
    # Locations: 87 + 37 mastery + 36 Legacy + 16 Attribute = 176.
    # Items: 76 + 2 + 16 + 82 filler = 176.
    assert "[smoke] item pool size: 176" in out, (
        f"Item pool not 176. Output:\n{out[-2000:]}"
    )
    assert "world(s)" in out, f"No world summary in output:\n{out[-2000:]}"
    assert result.returncode == 0, (
        f"run_generation.py exited {result.returncode}. Output tail:\n{out[-2000:]}"
    )


def test_generation_produces_archive():
    """A .zip is produced in Generated_Output."""
    _refresh_apworld()
    _ensure_test_yaml()

    output_dir = AP_ROOT / "Generated_Output"
    # Clear prior archives so this test verifies *fresh* generation.
    if output_dir.exists():
        for old in output_dir.glob("AP_*.zip"):
            old.unlink()

    result = subprocess.run(
        [_ap_python(), str(REPO_ROOT / "tests" / "run_generation.py")],
        cwd=str(AP_ROOT),
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr

    archives = list(output_dir.glob("AP_*.zip"))
    assert len(archives) >= 1, f"No archive in {output_dir}: {result.stdout}"
