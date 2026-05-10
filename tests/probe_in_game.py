"""In-game probe for the open verification questions.

Covers tasks #23-26: confirms engine event names, the legacy-path API,
the mastery-completion event behaviour, and the civ-specific resolution
surface for cap 5. Connects via FireTuner, injects a probe object that
shadows the mod's listeners with named hooks, and lets the operator
trigger in-game actions while we drain captured payloads.

Run from project root with the AP venv, with Civ 7 mid-session:

    .venv/Scripts/python.exe tests/probe_in_game.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from client.TunerClient import Civ7TunerClient, TunerError  # noqa: E402


# JS injection: a self-contained probe object on Game._AP_PROBE.
# Idempotent: skips re-registration if Game._AP_PROBE already exists.
PROBE_INSTALL_JS = r"""
(function() {
    if (Game._AP_PROBE && Game._AP_PROBE.installed) {
        return JSON.stringify({reinstalled: false});
    }
    const probe = {
        installed: true,
        buffer: [],
        push: function(name, data) {
            try {
                this.buffer.push({event: name, data: data, t: Date.now()});
            } catch (e) {
                this.buffer.push({event: name, err: String(e), t: Date.now()});
            }
        }
    };
    Game._AP_PROBE = probe;

    // Candidate event names for caps 6-9 and a few diagnostics.
    const eventCandidates = [
        "PantheonFounded",
        "ReligionFounded",
        "BeliefAdded",
        "BeliefAdopted",
        "BeliefUnlocked",
        "WonderCompleted",
        "WonderBuilt",
        "GoodyHutReward",
        "GoodyHutPopped",
        "DiscoveryActivated",
        "ImprovementActivated",
        "TechNodeCompleted",
        "CultureNodeCompleted",
        "LegacyPathMilestoneCompleted"
    ];
    for (const name of eventCandidates) {
        try {
            engine.on(name, function(data) {
                probe.push(name, data);
            });
        } catch (e) {
            probe.push("__listener_error__", {event: name, err: String(e)});
        }
    }

    Game.AP_ProbeDrain = function() {
        const drained = probe.buffer.splice(0, probe.buffer.length);
        return JSON.stringify(drained);
    };

    Game.AP_ProbeAPI = function() {
        const out = {};
        try {
            const pid = GameContext.localPlayerID;
            out.localPlayerID = pid;
            const player = Players.get(pid);
            out.player_exists = !!player;
            if (player) {
                out.player_keys = (function() {
                    const k = [];
                    for (const x in player) k.push(x);
                    return k;
                })();
                out.has_LegacyPaths = !!player.LegacyPaths;
                if (player.LegacyPaths) {
                    out.legacy_paths_keys = (function() {
                        const k = [];
                        for (const x in player.LegacyPaths) k.push(x);
                        return k;
                    })();
                    out.legacy_paths_methods = (function() {
                        const m = [];
                        for (const x in player.LegacyPaths) {
                            if (typeof player.LegacyPaths[x] === "function") m.push(x);
                        }
                        return m;
                    })();
                }
                out.has_Culture = !!player.Culture;
                if (player.Culture) {
                    out.culture_methods = (function() {
                        const m = [];
                        for (const x in player.Culture) {
                            if (typeof player.Culture[x] === "function") m.push(x);
                        }
                        return m;
                    })();
                    try {
                        out.chosen_ideology = (typeof player.Culture.getChosenIdeology === "function")
                            ? player.Culture.getChosenIdeology() : null;
                    } catch (e) { out.chosen_ideology_err = String(e); }
                }
                out.has_Identity = !!player.Identity;
                if (player.Identity) {
                    out.identity_methods = (function() {
                        const m = [];
                        for (const x in player.Identity) {
                            if (typeof player.Identity[x] === "function") m.push(x);
                        }
                        return m;
                    })();
                }
                out.has_Religion = !!player.Religion;
                if (player.Religion) {
                    out.religion_methods = (function() {
                        const m = [];
                        for (const x in player.Religion) {
                            if (typeof player.Religion[x] === "function") m.push(x);
                        }
                        return m;
                    })();
                }
            }
        } catch (e) {
            out.player_err = String(e);
        }

        try {
            out.GameInfo_keys = (function() {
                const k = [];
                for (const x in GameInfo) k.push(x);
                return k;
            })().filter(x => /Civic|Civ|Unique|Building|Leader|Tree|Belief|Religion|Wonder|GoodyHut/i.test(x));
        } catch (e) { out.GameInfo_err = String(e); }

        try {
            // Inspect one ProgressionTreeNode to see what fields exist
            // and whether Name resolves to a localization key or display.
            const node = GameInfo.ProgressionTreeNodes.lookup("NODE_TECH_AQ_AGRICULTURE");
            if (node) {
                const sample = {};
                for (const k in node) {
                    try {
                        const v = node[k];
                        if (typeof v !== "function") sample[k] = v;
                    } catch (e) { sample[k + "_err"] = String(e); }
                }
                out.sample_node = sample;
            } else {
                out.sample_node = "lookup returned null";
            }
        } catch (e) { out.sample_node_err = String(e); }

        try {
            out.PlayerOperationTypes_GRANT_TREE_NODE = PlayerOperationTypes.GRANT_TREE_NODE;
        } catch (e) { out.player_op_err = String(e); }

        try {
            const ageType = GameContext.currentAge;
            out.currentAge = ageType;
            const ageDef = (GameInfo.Ages && ageType) ? GameInfo.Ages.lookup(ageType) : null;
            out.currentAge_def = ageDef ? {
                AgeType: ageDef.AgeType,
                Name: ageDef.Name,
            } : null;
        } catch (e) { out.age_err = String(e); }

        return JSON.stringify(out);
    };
    return JSON.stringify({reinstalled: true, listeners: eventCandidates.length});
})()
"""


async def call_ap(client: Civ7TunerClient, js_expr: str):
    response = await client.eval_js(js_expr)
    body = response.body
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body


async def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "install"

    client = Civ7TunerClient()
    try:
        await client.connect()
    except TunerError as e:
        print(f"[probe] FAIL: {e}")
        return 1

    if mode == "install":
        install = await call_ap(client, PROBE_INSTALL_JS)
        print(f"[probe] install: {install}")
        api = await call_ap(client, "Game.AP_ProbeAPI()")
        print("[probe] === API surface ===")
        print(json.dumps(api, indent=2, default=str))
    elif mode == "drain":
        events = await call_ap(client, "Game.AP_ProbeDrain()")
        print(f"[probe] drained {len(events) if isinstance(events, list) else 0} events:")
        if isinstance(events, list):
            for entry in events:
                print(json.dumps(entry, indent=2, default=str))
        else:
            print(repr(events))
    elif mode == "status":
        status = await call_ap(client, "Game.AP_Status()")
        print(json.dumps(status, indent=2, default=str))
    elif mode == "eval":
        expr = sys.argv[2]
        result = await call_ap(client, expr)
        print(json.dumps(result, indent=2, default=str) if not isinstance(result, str) else result)
    elif mode == "evalfile":
        src = Path(sys.argv[2]).read_text(encoding="utf-8")
        result = await call_ap(client, src)
        print(json.dumps(result, indent=2, default=str) if not isinstance(result, str) else result)
    else:
        print(f"[probe] unknown mode {mode!r}")
        await client.close()
        return 2

    await client.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
