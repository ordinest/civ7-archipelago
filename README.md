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
cascade are not yet exercised against real seeds. Full design is in
[`docs/DESIGN.md`](docs/DESIGN.md).

## What gets randomized

The randomized content comes from the structures Civ 7 itself uses to
gate progress: the per-Age tech and civic trees, the Mastery system on
those trees, the Legacy Paths, and the attribute-point pool that drives
leader development.

**Items the multiworld can deliver back into your Civ 7 game:**

- Each tech node from the common (non-civ-specific) tech tree of every
  Age. Antiquity has 16, Exploration has 15, Modern has 16. Free-root
  nodes (Agriculture, Cartography/Astronomy/Machinery, Academics/Steam
  Engine/Military Science) are excluded because vanilla Civ 7 lets you
  research them from turn 1; an AP unlock for them adds nothing.
- Each civic node from the common civic tree of every Age. Antiquity 14,
  Exploration 13, Modern 16 (the last with the progressive-ideology
  treatment described below). Free roots excluded.
- A `Progressive Age` item collected once unlocks Exploration access in
  the apworld's region graph and twice unlocks Modern. The actual Age
  transition in-game still runs through Civ 7's normal mechanics; the
  AP item is the multiworld-side gate that controls when later-Age
  locations become reachable for fill.
- Attribute Points. A wildcard point lands in the player's identity
  pool and can be spent on any attribute tree (Cultural, Economic,
  Militaristic, etc.) just like a point earned through play.
- Filler. Production and gold boosts, free settlers and builders,
  faith bursts, population growth. Padding to balance items against
  locations.

**Locations that fire AP checks when triggered in-game:**

- The first completion of each randomized tech and civic node.
- A separate Mastery completion check for each masterable node (the
  Civ 7 second-purchase that grants the UnlockDepth=2 rewards). Roughly
  37 of these across all three Ages.
- All 36 Legacy Path milestones: 4 paths (Cultural, Economic, Military,
  Scientific), 3 milestones each, across 3 Ages.
- 16 attribute-point milestones at cumulative thresholds. The mod
  tracks total points earned and fires the next milestone each time
  one is crossed.

The total pool sits around 184 items and 184 locations. Items pool size
is padded with filler so the two match.

**Region gating across Ages:**

```
Antiquity --[Progressive Age 1]--> Exploration --[Progressive Age 2]--> Modern
```

Antiquity is reachable from start. Reaching Exploration requires one
copy of `Progressive Age` in the player's collected items, Modern
requires two. The win condition is collecting every terminal node
(Future Tech and Future Civic in each Age).

**Progressive ideology in Modern.** Civ 7's Modern culture tree has
nine ideology branch nodes: three starter ideologies and three
follow-on nodes per ideology. A given playthrough only researches one
ideology, so the other six branch nodes are unreachable. The apworld
sidesteps this by declaring three generic items (`Modern Civic:
Ideology Tier 1`, `Tier 2`, `Tier 3`). The in-game JS mod resolves
each tier slot to the matching node of whichever ideology the player
picks at runtime.

**Cross-Age item buffering.** Civ 7's engine only resolves progression
nodes from the player's currently-active Age. A Modern tech delivered
during Antiquity can not be granted directly. The mod buffers any such
item and retries on `PlayerAgeTransitionComplete`, so receiving a
later-Age unlock early is safe.

**What is not randomized:**

- Civ-specific civic trees. A given playthrough only exposes the trees
  of the civilizations the player picks per Age, so most of the pool
  would be unreachable on any seed. These stay vanilla in-game.
- Religion in Exploration. Civ 7's religion is a Beliefs system rather
  than a progression tree, so it does not map onto the AP node model.
  Could be revisited later as Legacy-Path-adjacent event checks.
- The 98 individual attribute-tree nodes. A player only earns enough
  points in any single game to fill a fraction of them, so individual
  nodes-as-locations would always leave most unreachable. The
  attribute-point milestones above replace them.

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
