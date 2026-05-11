# Civilization VII Archipelago

Multiworld randomizer integration for [Sid Meier's Civilization VII](https://civilization.2k.com/civ-vii/),
built on the [Archipelago](https://archipelago.gg) framework.

A Civ 7 player joins an Archipelago multiworld with friends playing other
AP-supported games. Tech and civic completions in Civ 7 send items to other
players' games. Items those friends find can come back as tech, civic,
mastery, or attribute-point unlocks delivered straight into the Civ 7 game.

The architecture is **mod-only**: the AP client lives inside the Civ 7 mod
itself, connects to the AP server over WebSocket directly from the mod's
JavaScript, and mutates Civ 7's database at game-creation time so the
tech tree, civic tree, and other surfaces render AP item names natively.
No external Python helper is required at play time.

(Patterned originally on [hesto2's Civ 6 AP world](https://github.com/hesto2/civilization_vi_apworld),
adapted for Civ 7's three-Age structure, ideology branches, narrative
discoveries, and Coherent Gameface UI runtime.)

## What gets randomized

| Civ 7 mechanic                                  |   Items | Locations | Notes                                                                                                                                                                                                   |
| ----------------------------------------------- | ------: | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tech and civic nodes (common trees, all 3 Ages) |      74 |        87 | Free roots get a location check on completion but no item, since vanilla lets you research them from turn 1. Modern's vanilla ideology branches collapse into 3 generic Tier slots resolved at runtime. |
| Mastery completions                             |      43 |        43 | Item grants the depth-2 unlock via `GRANT_TREE_NODE` with `FullyUnlock=0`.                                                                                                                              |
| Legacy Path milestones                          |      36 |        36 | 4 paths × 3 milestones × 3 Ages. Item advances the path via `Players.LegacyPaths.addLegacyPathEvent`.                                                                                                   |
| Civ-unique civic-tree slots                     |      12 |        12 | 4 slots per Age. Resolved at delivery to the player's chosen civilization's unique civic tree. Civs with fewer than 4 nodes leave trailing slots as no-ops.                                             |
| Pantheon Founded                                |       — |         1 | Antiquity check fired by `PantheonFounded` engine event.                                                                                                                                                |
| Religion + beliefs                              |       — |         5 | Exploration. 1 `ReligionFounded` check + 4 progressive belief-adopted slots.                                                                                                                            |
| Wonder Built                                    |       — |        63 | Fired on `WonderCompleted` (deduplicated, since the engine fires it twice per wonder), or on capturing settlement with Wonder in it (in case AI built it first).                                        |
| Discovery Found slots                           |       — |        15 | 5 per Age. Fired on `NotificationDismissed` filtered by the `CHOOSE_DISCOVERY_STORY_DIRECTION` hash.                                                                                                    |
| Attribute-point thresholds                      |      16 |        16 | Item grants a wildcard attribute point via `addWildcardAttributePoints(1)`.                                                                                                                             |
| Progressive Age                                 |       2 |         — | AP-side region gate. Age transitions in-game still run through vanilla mechanics; the AP item controls when later-Age locations become fillable.                                                        |
| Filler                                          |      95 |         — | Yields (Gold, Happiness, Influence), Units (Settler, Military, Merchant, Commander, Admiral), Settlement Boosts (Population, Production, Food; settlement selected randomly)                            |
| **Total**                                       | **278** |   **278** | Default; caps 6-9 (Pantheon, Religion, Wonders, Discoveries) are YAML-toggleable, all-off reduces the pool to 194.                                                                                      |

Archipelago requires equal pool sizes; the categories are asymmetric by
necessity. Some Civ 7 events only fire (Legacy Paths' locations have
items now, but pantheon / religion / wonder / discovery checks are
location-only — the engine has no AP-grantable form) and some can
only be granted (Progressive Age has no in-game trigger to mirror as
a check). Filler takes the slack.

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

At the top level there are only two components: the Archipelago server
that hosts the seed, and Civ 7 with the mod loaded.

```
+--------------------+                      +-----------------------+
|  Archipelago       |  <--- WebSocket --->  |  Civ 7 + AP mod (JS) |
|  multiworld server |                      |                       |
+--------------------+                      +-----------------------+
```

The mod is the AP client. There is no external process at play time.

### End-to-end session flow

```
[Civ 7 main menu — shell scope]
   |
   |  Mod loads its AP connection panel.
   |  Player enters server URL / slot / password and presses Connect.
   |  Mod opens a WebSocket to the AP server; AP handshake completes;
   |  the panel reports the slot joined.
   |
   v
[Player presses Start Game]
   |
   v
[Loading screen — game scope]
   |
   |  Mod's game-scope script fires.
   |  Mod scouts the AP server (LocationScouts -> LocationInfo)
   |  to learn which item each location holds for this seed.
   |  Mod mutates Civ 7's database so tech / civic / wonder /
   |  discovery / legacy-path locations carry their AP-item names
   |  in place of the vanilla LOC strings.
   |  Civ 7 finishes building the rest of the world.
   |
   v
[In-game]
   |
   |  Tech tree, civic tree, and tooltips render AP item names from
   |  the mutated database -- no UI hooks, no Locale interception.
   |
   |  Forward (check) direction:
   |      Player completes a node -> mod's TechNodeCompleted /
   |      CultureNodeCompleted / WonderCompleted / NotificationDismissed
   |      / etc. listener queues the AP location code and sends
   |      LocationChecks to the AP server.
   |
   |  Receive (item) direction:
   |      AP server pushes a ReceivedItems package -> mod applies the
   |      effect: GRANT_TREE_NODE for tech / civic / mastery,
   |      addLegacyPathEvent for legacy paths,
   |      addWildcardAttributePoints for attribute points, etc.
   |      Items targeting a later Age get buffered until
   |      PlayerAgeTransitionComplete fires.
```

### Pieces of the repo

`apworld/` is the Python AP world. It defines items, locations, regions,
rules, and options. It lives at `worlds/civ_7/` inside an Archipelago
install and is read by the AP server at generation and play time.

`mod/` is the Civ 7 mod. It contains both **shell-scope** scripts (the AP
connection panel that loads at the main menu) and **game-scope** scripts
(the in-game AP client and event handlers that load when a game is
created or loaded).

`client/Civ7Client.py` exists as developer tooling only. It runs an AP
client via a FireTuner socket against a live game, used during
development to drive end-to-end smoke tests without going through the
in-game UI. Players never need it.

## Current capability

| Capability                                                                                 | Status                                  |
| ------------------------------------------------------------------------------------------ | --------------------------------------- |
| Mod loads into Civ 7's UI script isolate                                                   | working                                 |
| Tech and civic node completions queue AP location checks                                   | working (live-verified)                 |
| Mastery completions distinguished via `data.nodeDepth === 2`                               | working (live-verified)                 |
| Civ-unique civic-tree node detection (by tree hash)                                        | working (live-verified)                 |
| `PantheonFounded` listener                                                                 | working (live-verified)                 |
| `ReligionFounded` / `BeliefAdded` listeners                                                | wired; not yet exercised in Exploration |
| `WonderCompleted` with constructible-type deduplication                                    | working (live-verified)                 |
| Discovery detection via `NotificationDismissed` + type hash                                | working (live-verified)                 |
| `LegacyPathMilestoneCompleted` listener                                                    | working                                 |
| Attribute-point milestone queueing                                                         | working                                 |
| Cross-Age item buffering until `PlayerAgeTransitionComplete`                               | working                                 |
| Runtime grant of techs / civics / masteries via `GRANT_TREE_NODE`                          | working (live-verified)                 |
| Runtime grant of legacy paths via `addLegacyPathEvent`                                     | working (live-verified)                 |
| Civ-unique civic-slot grant (resolved against player's civ)                                | working                                 |
| In-Age and cross-Age single-slot end-to-end roundtrip                                      | working (live-verified)                 |
| Modern ideology slot mapping (waits for player's ideology pick)                            | wired; needs Modern-Age verification    |
| In-game shell-scope AP connection panel                                                    | not yet built                           |
| In-mod WebSocket AP client                                                                 | not yet built                           |
| Database mutation at game-creation to display AP item names                                | not yet built                           |
| Suppression of vanilla unlocks on in-game completion (research-grade randomizer behaviour) | not yet built                           |
| Multi-slot multiworld validation                                                           | not yet exercised                       |

## Install

> The **player-facing flow** (open Civ 7 → main menu → AP panel → enter
> server URL → Connect → Start Game) is the target. The shell-scope panel
> and in-mod WebSocket client that close out that flow are not yet
> built; see *Current capability* for which pieces are still pending.
>
> The flow documented below is the **developer flow** for running
> end-to-end smoke tests today. It runs a separate Python AP client and
> bridges into the mod via FireTuner. Players won't need any of this
> once the in-game panel ships.

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

In a second terminal, start the dev client:

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
