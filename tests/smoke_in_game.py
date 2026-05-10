"""In-game smoke test driver.

Manual test of the tuner-mod bridge, no AP server required. Run with
Civ 7 launched (FireTuner enabled, mod loaded) and a game session in
progress at the main map.

Steps:
  1. Connect to FireTuner.
  2. Probe the mod via `Game.AP_Status()`. Asserts the mod responds.
  3. Pull current unsent checks (should be empty if a fresh game).
  4. Print instructions for the operator to research a tech in-game.
  5. Wait for input, then pull again. Asserts a tech node ID landed.
  6. Inject "Antiquity Tech: Pottery" via `Game.AP_HandleReceiveItem`.
     Asserts ok=true.

Run from project root with the AP venv:

    .venv/Scripts/python.exe tests/smoke_in_game.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from client.TunerClient import Civ7TunerClient, TunerError  # noqa: E402


async def call_ap(client: Civ7TunerClient, js_expr: str):
    """Invoke a JS expression and decode its JSON-stringified return value."""
    response = await client.eval_js(js_expr)
    body = response.body
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body


async def main() -> int:
    print("[smoke] connecting to FireTuner...")
    client = Civ7TunerClient()
    try:
        await client.connect()
    except TunerError as e:
        print(f"[smoke] FAIL: cannot reach tuner. {e}")
        return 1

    print("[smoke] probing Game.AP_Status()")
    type_response = await client.eval_js("typeof Game.AP_Status")
    if type_response.body != "function":
        print(f"[smoke] FAIL: Game.AP_Status is {type_response.body!r}, "
              f"expected 'function'. The mod did not load into this isolate.")
        await client.close()
        return 2
    status = await call_ap(client, "Game.AP_Status()")
    print(f"[smoke] status: {status}")

    print("[smoke] pulling current unsent checks")
    initial = await call_ap(client, "Game.AP_GetUnsentCheckedLocations()")
    print(f"[smoke] initial unsent: {initial!r}")

    print()
    print("=" * 60)
    print("ACTION FOR OPERATOR:")
    print("  1. In-game, open the tech tree.")
    print("  2. Research any Antiquity tech (Agriculture is fastest).")
    print("  3. Wait for the 'tech complete' notification.")
    print("  4. Press Enter here.")
    print("=" * 60)
    input()

    after = await call_ap(client, "Game.AP_GetUnsentCheckedLocations()")
    print(f"[smoke] new unsent: {after!r}")
    if not isinstance(after, list) or not after:
        print("[smoke] FAIL: no tech node landed in the queue.")
        await client.close()
        return 3
    print(f"[smoke] PASS: tech queue captured {after}")

    print()
    print("[smoke] injecting Game.AP_HandleReceiveItem('Antiquity Tech: Pottery')")
    grant = await call_ap(
        client, "Game.AP_HandleReceiveItem('Antiquity Tech: Pottery')"
    )
    print(f"[smoke] grant result: {grant!r}")
    if not isinstance(grant, dict) or not grant.get("ok"):
        print("[smoke] FAIL: grant returned ok=false.")
        await client.close()
        return 4

    print()
    print("=" * 60)
    print("ACTION FOR OPERATOR:")
    print("  Verify in-game that Pottery is now researched.")
    print("=" * 60)

    await client.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
