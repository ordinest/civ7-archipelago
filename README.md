# Civilization VII Archipelago

Multiworld randomizer integration for [Sid Meier's Civilization VII](https://civilization.2k.com/civ-vii/),
built on the [Archipelago](https://archipelago.gg) framework.

A Civ 7 player joins an Archipelago multiworld with friends playing other
AP-supported games. Tech and civic completions in Civ 7 send items to other
players' games. Items those friends find can come back as tech, civic,
mastery, or attribute-point unlocks delivered straight into the Civ 7 game.

The architecture follows [hesto2's Civ 6 AP world](https://github.com/hesto2/civilization_vi_apworld)
and adapts it for Civ 7's JavaScript runtime, three-Age structure, and ideology
branches.

A working v0.3 single-player slot runs end to end. Multi-slot and the in-Age
cascade are not yet exercised against real seeds.

## What gets randomized

| Civ 7 mechanic | Items | Locations | Notes |
|---|---:|---:|---|
| Tech nodes (common trees, all 3 Ages) | 40 | 47 | Free roots (Agriculture, Cartography, Astronomy, Machinery, Academics, Steam Engine, Military Science) get a location check on completion but no item, since vanilla lets you research them from turn 1. |
| Civic nodes (common trees, all 3 Ages) | 34 | 40 | Free roots (Chiefdom, Economics, Piety, Modernization, Natural History, Social Question) excluded as items for the same reason. Modern's 9 vanilla ideology branches collapse into 3 generic Tier slots resolved at runtime. |
| Mastery completions | — | 37 | Granted alongside the tech via `FullyUnlock=1`, so no separate item. |
| Legacy Path milestones | — | 36 | 4 paths × 3 milestones × 3 Ages. Engine has no AP-grantable form. |
| Attribute-point thresholds | 16 | 16 | Item grants a wildcard attribute point via `addWildcardAttributePoints(1)`. |
| Progressive Age | 2 | — | AP-side region gate. Age transitions in-game still run through vanilla mechanics; the AP item controls when later-Age locations become fillable. |
| Filler | 84 | — | Production, gold, settlers, builders, faith, population. |
| **Total** | **176** | **176** | |

Archipelago requires equal pool sizes; the categories are asymmetric by
necessity. Some Civ 7 events only fire (Legacy Paths, masteries on
their own, free-root completions) and some can only be granted
(Progressive Age has no in-game trigger to mirror as a check). Filler
takes the slack.

Region gating across Ages:

```
Antiquity --[Progressive Age 1]--> Exploration --[Progressive Age 2]--> Modern
```

Antiquity is reachable from start. Win condition is collecting every
terminal node (Future Tech and Future Civic in each Age).

The mod buffers any item targeting a node outside the player's current
Age and retries on `PlayerAgeTransitionComplete`, so receiving a
later-Age unlock early is safe.

**Not randomized:** civ-specific civic trees (per-game subset too
small), Exploration religion (Beliefs system, not a tree), individual
attribute-tree nodes (player point budget covers only a fraction).

## How it fits together

```
+--------------------+       +-------------------+       +----------------+
|  Archipelago       | <---> |  Civ7Client.py    | <---> |  Civ 7         |
|  multiworld server |  ws   |  (Python)         | tuner |  + AP mod (JS) |
+--------------------+       +-------------------+       +----------------+
```

`apworld/` is the Python AP world. It defines items, locations, regions,
rules, and options, and lives at `worlds/civ_7/` inside an Archipelago
install.

`mod/` is the in-game JavaScript mod that Civ 7 loads via its `<UIScripts>`
action. It listens for `TechNodeCompleted`, `CultureNodeCompleted`,
`LegacyPathMilestoneCompleted`, `AttributePointsChanged`, and
`PlayerAgeTransitionComplete`. It exposes `Game.AP_*` accessors that the
Python client reads over FireTuner. Granting an item runs through
`Game.PlayerOperations.sendRequest(..., GRANT_TREE_NODE, ...)` for tech
and civic, and `player.Identity.addWildcardAttributePoints(N)` for
attribute points.

`client/Civ7Client.py` is an Archipelago `CommonContext` subclass. It opens
the AP server websocket, opens a FireTuner socket on `127.0.0.1:4318`, polls
the in-game queue once a second, sends `LocationChecks` to the server when
checks accumulate, and forwards `ReceivedItems` into the mod via
`Game.AP_HandleReceiveItem(name)`.

## Current capability

| Capability | Status |
|---|---|
| FireTuner wire protocol (`CMD:65535:` framing, return-value reads) | working |
| Mod loads into Civ 7 gameplay JS isolate | working |
| `TechNodeCompleted` / `CultureNodeCompleted` listeners | working |
| `LegacyPathMilestoneCompleted` listener | working |
| `AttributePointsChanged` to attribute-point milestone locations | working |
| Runtime grant of techs and civics via `GRANT_TREE_NODE` | working |
| Runtime grant of attribute points via `addWildcardAttributePoints` | working |
| Civ7Client polls and sends `LocationChecks` to the server | working |
| Civ7Client forwards `ReceivedItems` to the mod | working |
| Cross-Age item buffering until `PlayerAgeTransitionComplete` | working |
| Modern ideology slot mapping (waits for player's ideology pick) | partial |
| Multi-slot multiworld validation | not yet exercised |
| In-Age cascade against a real seed (no developer-injected seed) | not yet exercised |

## Install

You need Civilization VII (PC), a clone of
[ArchipelagoMW/Archipelago](https://github.com/ArchipelagoMW/Archipelago)
with a working Python venv, Python 3.12 or newer, and
[uv](https://docs.astral.sh/uv/) for environment management.

Clone this repo. Drop `apworld/` into your Archipelago install at
`worlds/civ_7/`. The pytest in this repo refreshes that copy automatically
during test runs.

Run the install script. It copies the in-game mod into Civ 7's user-mods
directory and toggles `EnableTuner 1` in `AppOptions.txt`:

```bash
python tests/setup_mod_install.py
```

Launch Civ 7. Enable "Civilization VII Archipelago" in the in-game mod
browser. Start a single-player game.

Place a player YAML for your slot in your Archipelago install's
`Players/` directory. A starter template lives at
[`civilization_vii.yaml`](civilization_vii.yaml) at this repo's root.
Edit the `name:` line and any options, then copy:

```bash
cp civilization_vii.yaml path/to/Archipelago/Players/yourname.yaml
```

Generate a seed (run from anywhere with the Archipelago venv on path):

```bash
python tests/run_generation.py
```

Start the AP server with the generated archive:

```bash
python tests/run_server.py \
    --port 38281 --host 127.0.0.1 --loglevel info \
    path/to/Archipelago/Generated_Output/AP_*.zip
```

In a second terminal, start the client:

```bash
python client/Civ7Client.py --connect 127.0.0.1:38281 --name Tester
```

A walkthrough with verification steps is in
[`docs/smoke-test-setup.md`](docs/smoke-test-setup.md).

## Tests

```bash
uv run --with pytest pytest tests/test_smoke_generation.py -v
```

This regenerates the apworld in your Archipelago install, runs an
end-to-end seed generation, asserts the item-pool size and the resulting
archive.

The runtime smoke driver in `tests/smoke_in_game.py` runs interactively
against a live Civ 7 game. The end-to-end orchestrator in
`tests/orchestrate_test.py` spawns the AP server and the client together
and reports the round-trip.

## Acknowledgements

[hesto2](https://github.com/hesto2) for the Civ 6 AP world that this
project is patterned on. [ghost-ng/FiretunerTerminal](https://github.com/ghost-ng/FiretunerTerminal)
for the reverse-engineered Civ 7 tuner wire protocol. The Archipelago
project and its contributors.

## License

MIT, see [`LICENSE`](LICENSE).
