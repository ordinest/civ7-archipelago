# Civilization VII Archipelago: Design

Long-form design notes for the apworld and the runtime stack. Companion
to the [README](../README.md).

## Why this exists

A Civ 7 player wants to participate in an Archipelago multiworld with
friends who are playing other AP-supported games. Civ 7 has no first-party
AP world, and the Civ 6 AP world does not transfer directly because Civ 7
swapped Lua for JavaScript, replaced eras with Ages, restructured tech and
civic trees per Age, and added Mastery and Legacy Path systems.

The design has to deliver a working slot for a friend group, stay faithful
to Civ 7's Age and Mastery structures, and survive the cross-Age timing
problem (items for a future Age can be received in the current Age and
must not break the game).

## Reference precedent

The architecture follows [hesto2's Civ 6 apworld](https://github.com/hesto2/civilization_vi_apworld)
and its [in-game Lua mod](https://github.com/hesto2/civilization_archipelago_mod).
In Civ 6, each era is a Region; regions chain with prerequisite logic
(`era_ancient.connect(era_classical, lambda state: has_required_items(...))`);
the win condition is `state.can_reach(EraType.ERA_FUTURE.value)`. The Python
client connects to the running game via FireTuner; the in-game mod exposes
accessors that the client reads over the tuner socket; engine events fire
location checks, and grants apply received items.

Civ 7 keeps the shape and replaces the substrate. Lua becomes JavaScript
on V8. `<Components>`/`<GameplayScripts>` becomes `<ActionGroups>`/`<UIScripts>`
in the `.modinfo`. One tech/civic tree becomes three (one per Age).
Era-based regions become Age-based regions. Eurekas become Mastery
completions. Legacy Path milestones, attribute-point milestones, the
progressive ideology mapping, and the cross-Age buffer are all new.

## Verified Civ 7 modding surface

Firaxis shipped the official Modding SDK in Update 1.2.2 (June 2025) with
Steam Workshop support. The scripting runtime is JavaScript on V8. Mods
package as `.modinfo` (XML) with `<ActionGroups>` containing `UIScripts`,
`UpdateDatabase`, and the other action types that the shipped base modules
use.

Runtime hooks are registered through `engine.on(eventName, handler)`. The
events that matter for this apworld are `TechNodeCompleted`,
`CultureNodeCompleted`, `LegacyPathMilestoneCompleted`,
`AttributePointsChanged`, and `PlayerAgeTransitionComplete`. The shipped
`tech-civic-popup-manager.chunk.js` and `model-victory-progress.chunk.js`
files use the same names and payload shapes.

Runtime grants run through `Game.PlayerOperations.sendRequest(playerID,
PlayerOperationTypes.GRANT_TREE_NODE, {ProgressionTreeNodeType, FullyUnlock})`
for tech and civic. The shipped `Player.ltp` tuner panel uses this exact
call. `FullyUnlock: 1` covers base completion plus every mastery depth
on the node. Attribute points use `player.Identity.addWildcardAttributePoints(N)`,
also from the shipped tuner panel.

FireTuner listens on `127.0.0.1:4318` whenever the game is running with
`EnableTuner 1` set in
`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\AppOptions.txt`.
The wire protocol is `[4-byte uint32 length][4-byte uint32 type=3][CMD:65535:<js>\0]`
for send and the same shape for receive. The body of a response is the
JS expression's return value as a string. `JSON.stringify(...)` returns
clean JSON text; `console.log(...)` returns `"undefined"`. The Civ 6
APSTART/APEND framing is not needed.

## What gets randomised

The randomised items and locations come from the common (non-civ-specific)
tech and civic trees of all three Ages, plus mastery completions, Legacy
Path milestones, and attribute-point milestones.

| Source | Count | Notes |
|---|---|---|
| Common tech (Antiquity 16 + Exploration 15 + Modern 16) | 47 | One item per non-free-root tech |
| Common civic (Antiquity 14 + Exploration 13 + Modern 16 with progressive ideology) | 45 | Free roots and civ-uniques excluded |
| Progressive Age unlocks | 2 | Antiquity to Exploration, Exploration to Modern |
| Attribute Points | 16 | Generic wildcard; YAML-tunable |
| Filler | ~74 | Production, gold, settlers, builders, faith, population |
| Items pool total | ~184 | |

Locations follow the same shape: 47 + 45 = 92 base completions, plus
roughly 37 mastery completions on nodes that have `UnlockDepth=2` entries,
plus 36 Legacy Path milestones (4 paths times 3 milestones times 3 Ages),
plus 16 attribute-point milestones. The items pool gets padded with
filler so the two pool sizes match.

Free-root nodes are not items. Antiquity has Agriculture and Chiefdom;
Exploration has Cartography, Astronomy, Machinery, Economics, Piety;
Modern has Academics, Steam Engine, Military Science, Modernization,
Natural History, Social Question. The player can research these from
turn 1 in vanilla Civ 7, so an AP item granting one would add nothing.

Civ-specific civic trees (`progression-trees-culture-unique.xml`) are
not randomised. Each game only exposes the trees of the civilizations
the player chooses, so most of the pool would be unreachable on any
given seed. They stay vanilla in-game.

Religion in Exploration is a Beliefs system, not a progression tree.
Not in scope; could be revisited as Legacy-Path-adjacent event checks.

Attribute *tree nodes* (the 98 Cultural / Political / Economic / etc.
nodes in `progression-trees-common.xml`) are not individual locations.
A player only earns enough points to fill a fraction of them in any
game. Instead the apworld counts cumulative attribute *points earned*
and treats threshold milestones as locations.

## Regions and gating

Three Regions, one per Age. Antiquity is reachable from start.

```
Antiquity --[Progressive Age 1]--> Exploration --[Progressive Age 2]--> Modern
```

Items partition by Age. Attribute Point locations are global. Filler is
global. The win condition is every terminal node (Future Tech and Future
Civic in each Age) collected as an item.

## Progressive ideology

Civ 7's Modern culture-common tree has 19 nodes: 10 main civics, 3
ideology starter nodes, and 6 follow-on branches. Each player picks
one ideology and only researches its three nodes; the other six are
unreachable that game.

The apworld declares three generic items (Modern Civic: Ideology Tier 1,
Tier 2, Tier 3) plus three matching locations. The in-game JS mod
listens for the player's ideology pick and resolves each generic slot
to the matching node of whichever ideology was chosen at runtime. There
is no base-game XML override; the mapping is mod-side only.

## Cross-Age item buffering

The Civ 7 engine's `GameInfo.ProgressionTreeNodes.lookup(typeName)`
returns null for nodes outside the player's currently-active Age. A
later-Age item received early (a Modern tech delivered while in
Antiquity) cannot be granted directly.

The mod handles this with a `pendingItems` buffer.
`Game.AP_HandleReceiveItem` returns `{ok: true, status: "deferred"}`
when the lookup fails for a tree-node item, and pushes the name into
the buffer. The Civ7Client treats `ok: true` as delivered (whether
`status` is `"ok"` or `"deferred"`), so the AP server does not re-send.
On `PlayerAgeTransitionComplete`, `flushPendingItems()` retries every
buffered grant. Items that still cannot be granted (the new Age is
still wrong, or an ideology slot but no ideology chosen yet) stay in
the buffer.

## File layout

```
civ7-archipelago/
|- apworld/             AP world (lives at worlds/civ_7/ in AP install)
|  |- __init__.py       World class
|  |- Items.py          Item enumeration, classifications, IDs
|  |- Locations.py      Location enumeration, IDs
|  |- Regions.py        Region graph and connections
|  |- Rules.py          Logic rules and win condition
|  |- Options.py        YAML-configurable options
|  +- data/             Constants captured from Civ 7 XML
|- mod/                 In-game JavaScript mod
|  |- archipelago.modinfo
|  +- scripts/
|     |- ap_item_map.js Generated from the Python registry
|     +- archipelago.js Mod runtime
|- client/              AP-server-connected runtime
|  |- TunerClient.py    FireTuner wire-protocol client
|  +- Civ7Client.py     CommonContext subclass + poll loop
|- tests/               Generation tests, install script, orchestrators
+- docs/
   |- DESIGN.md         This file
   +- smoke-test-setup.md Runtime install and verification walkthrough
```

## Generated artefacts

`mod/scripts/ap_item_map.js` is regenerated by
`python tests/build_mod_item_map.py`. Re-run after registry edits.

## Open work

Verify the in-Age cascade against a real seed: an Antiquity item
delivered to the player at turn 1 should grant in-game, fire its own
`TechNodeCompleted`, fire the next check, repeat until Antiquity's
locations are exhausted. The architecture supports this; not yet
exercised end to end.

Multi-slot validation: a Civ 7 slot plus a non-Civ-7 AP slot, confirming
items route correctly between games and that Civ 7 receives non-Civ-7
items as filler/progression as expected.

Save persistence: an AP server reconnect after Civ 7 save reload should
resume where the slot left off rather than re-emitting checks the player
has already cleared.

Wonder completion as an optional location set, mirroring Civ 6 AP's
boostsanity-style toggle.
