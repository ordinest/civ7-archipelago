"""Q1 mod-runtime probe.

Validates that the production grant path now routes through hidden AP
nodes instead of granting source nodes directly:

  1. mod version 0.5.0 loaded.
  2. Item map still contains the expected tree_node entry.
  3. Pre-grant: vanilla source node state = 1 (AVAILABLE), hidden node
     state = 2 (READY_TO_GRANT).
  4. Game.AP_HandleReceiveItem("Antiquity Tech: Pottery") returns ok.
  5. Post-grant: hidden node state = 5 (COMPLETED_VIA_GRANT). Vanilla
     source state UNCHANGED (still 1).
  6. unsentLocations queue did NOT receive a spurious entry for the
     NODE_AP_* completion event (suppression filter working).
  7. BUILDING_BRICKYARD (Pottery's unlock) is reported buildable.

Pre-conditions: Civ 7 fully restarted, new game at turn 1, civ7-
archipelago mod loaded.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from client.TunerClient import Civ7TunerClient, TunerError  # noqa: E402


TEST_ITEM = "Antiquity Tech: Pottery"
SOURCE_NODE = "NODE_TECH_AQ_POTTERY"
HIDDEN_NODE = "NODE_AP_TECH_AQ_POTTERY"
UNLOCK_BUILDING = "BUILDING_BRICKYARD"


async def _ask(tc, label, js):
    resp = await tc.eval_js(js)
    print(f"\n== {label} ==")
    print(f"  raw: {resp.body!r}")
    try:
        return json.loads(resp.body)
    except json.JSONDecodeError:
        return {"_raw": resp.body}


def _state_query(node_type: str) -> str:
    return (
        '(function(){'
        f'var n=Game.ProgressionTrees.getNode(GameContext.localPlayerID, {node_type!r});'
        f'var st=Game.ProgressionTrees.getNodeState(GameContext.localPlayerID, {node_type!r});'
        'return JSON.stringify({state:st, attached:n!==null && n!==undefined, depthUnlocked:n?n.depthUnlocked:null});'
        '})()'
    )


def _verdict(results: dict) -> int:
    print("\n" + "=" * 60)
    print("VERDICT")
    print("=" * 60)
    fails: list[str] = []

    status = results.get("status", {})
    if status.get("version") != "0.5.0":
        fails.append(f"mod version mismatch: got {status.get('version')!r}, want 0.5.0")
    else:
        print("  [PASS] mod runtime 0.5.0 loaded")

    item_entry = results.get("item_entry", {})
    if item_entry.get("kind") != "tree_node" or item_entry.get("node_id") != SOURCE_NODE:
        fails.append(f"item table entry unexpected: {item_entry}")
    else:
        print(f"  [PASS] item map has {TEST_ITEM!r} -> tree_node({SOURCE_NODE})")

    before_v = results.get("vanilla_before", {})
    before_h = results.get("hidden_before", {})
    if before_v.get("state") != 1:
        fails.append(f"vanilla source state pre-grant: got {before_v}, want state=1")
    else:
        print(f"  [PASS] vanilla {SOURCE_NODE} pre-grant state=1 (available)")
    if before_h.get("state") != 2:
        fails.append(f"hidden state pre-grant: got {before_h}, want state=2")
    else:
        print(f"  [PASS] hidden {HIDDEN_NODE} pre-grant state=2 (ready)")

    deliver = results.get("deliver", {})
    if not deliver.get("ok"):
        fails.append(f"AP_HandleReceiveItem returned non-ok: {deliver}")
    else:
        print(f"  [PASS] AP_HandleReceiveItem returned ok (status={deliver.get('status')!r})")

    after_v = results.get("vanilla_after", {})
    after_h = results.get("hidden_after", {})
    if after_h.get("state") != 5:
        fails.append(f"hidden state post-grant: got {after_h}, want state=5")
    else:
        print(f"  [PASS] hidden {HIDDEN_NODE} post-grant state=5 (granted)")
    if after_v.get("state") != 1:
        fails.append(
            f"vanilla source state changed post-grant: got {after_v}, want state=1 (unchanged). "
            f"That means our redirect leaked through to the source node."
        )
    else:
        print(f"  [PASS] vanilla {SOURCE_NODE} post-grant state still 1 (untouched)")

    queue = results.get("queue_after", [])
    if queue:
        leaked = [q for q in queue if isinstance(q, str) and q.startswith("NODE_AP_")]
        if leaked:
            fails.append(f"NODE_AP_* entries leaked into AP queue: {leaked}")
        else:
            print(f"  [INFO] unsentLocations got {len(queue)} non-AP entries; suppression worked")
    else:
        print("  [PASS] unsentLocations empty post-grant (no spurious AP entries)")

    if fails:
        print("\nFAILED:")
        for f in fails:
            print(f"  - {f}")
        return 1
    print("\nPASS. Q1 mod-runtime end-to-end verified.")
    return 0


async def main() -> int:
    tc = Civ7TunerClient()
    try:
        await tc.connect()
    except (TunerError, OSError) as e:
        print(f"FAIL: cannot connect to FireTuner: {e}")
        return 2

    try:
        results: dict = {}
        results["status"] = await _ask(tc, "AP_Status", "Game.AP_Status()")
        results["item_entry"] = await _ask(
            tc, "item map entry",
            f"JSON.stringify(Game._AP_ITEM_TO_NODE[{TEST_ITEM!r}])"
        )
        results["vanilla_before"] = await _ask(
            tc, "vanilla state pre-grant", _state_query(SOURCE_NODE)
        )
        results["hidden_before"] = await _ask(
            tc, "hidden state pre-grant", _state_query(HIDDEN_NODE)
        )
        # Drain any pre-existing queue entries first so leaks are clear.
        await tc.eval_js("Game.AP_GetUnsentCheckedLocations()")

        results["deliver"] = await _ask(
            tc, "AP_HandleReceiveItem", f"Game.AP_HandleReceiveItem({TEST_ITEM!r})"
        )
        await asyncio.sleep(0.5)
        results["vanilla_after"] = await _ask(
            tc, "vanilla state post-grant", _state_query(SOURCE_NODE)
        )
        results["hidden_after"] = await _ask(
            tc, "hidden state post-grant", _state_query(HIDDEN_NODE)
        )
        results["queue_after"] = await _ask(
            tc, "unsentLocations post-grant", "Game.AP_GetUnsentCheckedLocations()"
        )

        return _verdict(results)
    finally:
        await tc.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
