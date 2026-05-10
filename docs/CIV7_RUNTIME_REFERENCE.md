# Civilization VII Runtime Reference

What the Civ 7 mod runtime actually exposes, verified by live probing against
the shipped game (Steam build, Civ 7 1.x, December 2025 patch). Written
because the modding documentation in this area is thin and partly
incorrect: third-party event-name lists circulate that name events the
engine never emits, and the canonical reference is buried in
`Sid Meier's Civilization VII/Base/modules/core/data/gamecore-events.xml`
and the shipped UI scripts. This document collects what we learned
building `civ7-archipelago` so others don't have to re-derive it.

If you find an error here, open an issue or PR against the
`civ7-archipelago` repo.

## Where the runtime lives

Civ 7 ships a V8 JavaScript isolate that runs both UI scripts and
gameplay-mod scripts. Mods register `.js` files into this isolate via
the `<UIScripts>` action in their `.modinfo`. The isolate has access to:

- `Game` (top-level), `Game.PlayerOperations`, `Game.ProgressionTrees`
- `Players`, `Players.get(playerId)`, `Players.isParticipant(id)`
- `GameInfo` (the database of game data, indexed by type strings)
- `GameContext` (game-instance state — only `localPlayerID` and
  `localObserverID` are exposed; common myths like `GameContext.currentAge`
  do not exist)
- `engine` — the event bus, exposing `engine.on("EventName", handler)`
- `PlayerOperationTypes` — an enum of player-operation type IDs
- `console.log` — appears in Civ 7's per-channel logs at
  `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Logs\`

There is no Lua. There is no Modbuddy-equivalent gameplay scripting
language outside JS. C++ gameplay code emits events the JS isolate
subscribes to.

## FireTuner

Setting `EnableTuner 1` in
`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\AppOptions.txt`
opens a tuner socket on `127.0.0.1:4318`. The wire protocol is binary:
`[4-byte length][4-byte type=3][CMD:65535:<js>\0]`. The JS payload is
evaluated in the gameplay isolate; the response is the last expression's
value, JSON-stringified. This is the primary tool for probing the
runtime API surface without writing a full mod.

Civ 7 ships canonical tuner panels at
`Base/Platforms/Windows/Config/TunerPanels/*.ltp` that show example
calls into player operations and gameplay APIs. Read these before
guessing API shapes.

## Canonical engine events

The full list of engine events the game can emit is at
`Base/modules/core/data/gamecore-events.xml`. Subscribing to a name
that isn't in this file is silently a no-op. The events relevant to a
typical mod are below, with confirmed payload shapes from live
probing.

### Tech and civic completion

```
engine.on("TechNodeCompleted", handler);
engine.on("CultureNodeCompleted", handler);
```

Payload: `{player, tree, activeNode, nodeDepth, completionType, previousNodeCompleted}`.

- `player` is the player ID that completed the node.
- `tree` is the hash of the `ProgressionTreeType` (look up via
  `GameInfo.ProgressionTrees.lookup(treeType).$hash`).
- `activeNode` is the hash of the `ProgressionTreeNodeType`; resolves
  via `GameInfo.ProgressionTreeNodes.lookup(activeNode)`.
- **`nodeDepth` distinguishes base completion (1) from mastery (2).**
  The same event name fires twice for masterable nodes — first with
  `nodeDepth=1`, again with `nodeDepth=2` when the mastery tier
  completes. There is no separate `MasteryCompleted` event.
- `completionType=1` means a fully-completed node. Other values
  represent partial / steal / boost completions.

### Legacy path milestones

```
engine.on("LegacyPathMilestoneCompleted", handler);
```

Payload: `{player, milestone}`. `milestone` is a hash; resolve via
`GameInfo.AgeProgressionMilestones.lookup(milestone)` to a row with
`.AgeProgressionMilestoneType` (e.g. `"ANTIQUITY_SCIENCE_MILESTONE_1"`).

To advance a legacy path programmatically:
`Players.get(playerId).LegacyPaths.addLegacyPathEvent(legacyPathId, 1)`.
`legacyPathId` is the canonical type string, e.g.
`"LEGACY_PATH_ANTIQUITY_SCIENCE"`. There is also
`grantReward(rewardHash)` if you want to grant the path's reward
directly.

### Religion

```
engine.on("PantheonFounded", handler);     // {belief, player}
engine.on("ReligionFounded", handler);     // {player, ...}
engine.on("BeliefAdded", handler);         // {player, belief, ...}
engine.on("CityReligionChanged", handler);
engine.on("CityReligionFollowersChanged", handler);
engine.on("UrbanReligionChanged", handler);
engine.on("RuralReligionChanged", handler);
```

In Civ 7, pantheons are an Antiquity-Age mechanic. Religion founding
and belief adoption are in Exploration Age. There is one belief per
pantheon and Civ 7 does not allow further pantheon picks; the
`PantheonFounded` event fires once per player per game.

`Players.get(pid).Religion` exposes `hasPantheon()`, `canCreateReligion()`,
`hasCreatedReligion()`, `getReligionType()`, `getBeliefs()`,
`getNumBeliefsEarned()`, `getNumPantheons()`, `getHolyCityName()`.

### Wonders and constructibles

```
engine.on("WonderCompleted", handler);
engine.on("ConstructibleAddedToMap", handler);
engine.on("ConstructibleRemovedFromMap", handler);
```

`WonderCompleted` payload:
`{constructibleType, constructibleClass, district: {owner, id, type}, constructible: {owner, id, type}, location: {x, y}}`.

**`WonderCompleted` fires twice per wonder.** Deduplicate on
`constructibleType` if you care about a one-time signal.

`ConstructibleAddedToMap` payload adds `percentComplete` to the same
shape. It fires at *placement* (`percentComplete=0`) and at
*completion* (`percentComplete=100`). Buildings and improvements use
this event; wonders use it *and* `WonderCompleted`.

`constructibleClass` is a hash of the class string. Confirmed hashes
from probing:
- `-767798966` corresponds to BUILDING / IMPROVEMENT (regular constructibles)
- `-2128205823` corresponds to WONDER

These are hashes of the underlying class strings; resolve dynamically
by iterating `GameInfo.Constructibles` and matching the
`ConstructibleClass` field.

The owner of the constructible is on `data.district.owner` and
`data.constructible.owner` — both contain the player ID that built it.
Filter on `=== GameContext.localPlayerID` for local-player events.

### Notifications

```
engine.on("NotificationAdded", handler);
engine.on("NotificationActivated", handler);
engine.on("NotificationDismissed", handler);
engine.on("NotificationRefreshRequested", handler);
```

Notification events are the cleanest local-player-attribution
mechanism in Civ 7. Payloads include
`{id: {owner, id, type}, byUser?, type?}`:

- `id.owner` is the player ID the notification was raised for. The
  engine only raises a notification for the relevant player, so
  filtering on `id.owner === GameContext.localPlayerID` cleanly
  excludes AI / city-state / barbarian-triggered notifications.
- `id.type=20` is the notification subsystem internal type (constant).
- `data.type` on `NotificationDismissed` is the hash of the
  notification *kind* (e.g. choose-tech, choose-discovery, choose-pantheon).

There are 127 notification kinds in
`GameInfo.Types` filtered by `Kind == "KIND_NOTIFICATION"`. The
relevant ones for gameplay hooks:

| Notification | Hash | Use |
|---|---|---|
| `NOTIFICATION_CHOOSE_PANTHEON` | -1806242486 | Pantheon picker |
| `NOTIFICATION_CHOOSE_RELIGION` | -1493314258 | Religion founding |
| `NOTIFICATION_CHOOSE_BELIEF` | 661452396 | Belief adoption |
| `NOTIFICATION_CHOOSE_TECH` | 1496184008 | Tech picker |
| `NOTIFICATION_CHOOSE_CULTURE_NODE` | 71225182 | Civic picker |
| `NOTIFICATION_CHOOSE_GOLDEN_AGE` | -706533092 | Golden age picker |
| `NOTIFICATION_CHOOSE_NARRATIVE_STORY_DIRECTION` | 2002548776 | Regular narrative event |
| `NOTIFICATION_CHOOSE_DISCOVERY_STORY_DIRECTION` | 1287223640 | **Discovery (goody hut equivalent)** |
| `NOTIFICATION_CHOOSE_AUTO_NARRATIVE_STORY_DIRECTION` | 1575192022 | Auto-narrative |
| `NOTIFICATION_COMMAND_UNITS` | -28491459 | Unit command |

**Discoveries are NarrativeStories, not GoodyHuts.** The legacy
`GoodyHutReward` event exists for the old goody-hut subsystem
(`age-*/data/goody-huts.xml` rows like `GOODYHUT_GOLD`,
`GOODYHUT_SCIENCE`) but it does **not** fire for Discoveries, which
are `<UIActivation>DISCOVERY</UIActivation>` narrative-story rows
defined in `age-*/data/discovery-stories.xml`. The reliable hook for a
discovery being completed by the local player is:

```
engine.on("NotificationDismissed", (data) => {
    if (data.id.owner !== GameContext.localPlayerID) return;
    if (data.type !== 1287223640) return;  // CHOOSE_DISCOVERY_STORY_DIRECTION
    // local player just selected a discovery reward
});
```

### Player turn lifecycle

```
engine.on("LocalPlayerTurnBegin", handler);
engine.on("LocalPlayerTurnEnd", handler);
engine.on("PlayerTurnActivated", handler);    // any player
engine.on("PlayerTurnDeactivated", handler);
engine.on("PlayerAgeTransitionComplete", handler);
engine.on("AttributePointsChanged", handler);
engine.on("PlayerYieldChanged", handler);
engine.on("PlayerUnlockChanged", handler);
engine.on("PlayerUnlockProgressChanged", handler);
```

`LocalPlayerTurnBegin/End` are the simplest hooks for per-turn
bookkeeping; they only fire for the local player.

`PlayerAgeTransitionComplete` fires when the player transitions
between Ages (Antiquity → Exploration → Modern). Useful for retrying
delivery of items the mod buffered because their target wasn't in the
current Age's data.

## Data tables

`GameInfo` is the database of game data, with rows indexed by their
type string. The relevant tables for typical gameplay mods:

- `GameInfo.Types` — every typed entity has a row here with
  `{Type, Hash, Kind}`. **The canonical name-to-hash mapping** for any
  type in the game. Iterate when you have a hash and need to resolve
  it. 10,458 rows in the base game.
- `GameInfo.Ages` — Antiquity / Exploration / Modern, with
  `{AgeType, Name}`. `Name` is a localization key
  (`"LOC_AGE_ANTIQUITY_NAME"`); `AgeType` is the canonical engine
  string (`"AGE_ANTIQUITY"`).
- `GameInfo.Civilizations` — playable civs.
  `UniqueCultureProgressionTree` points at the civ-specific civic tree
  (e.g. Rome → `"TREE_CIVICS_AQ_ROME"`).
- `GameInfo.CivilizationTraits` — links civilizations to traits
  (`TRAIT_ROME`, `TRAIT_ANTIQUITY_CIV`, etc.). One civ has many traits.
- `GameInfo.Buildings`, `GameInfo.Constructibles`,
  `GameInfo.Wonders`, `GameInfo.UniqueQuarters` — building data.
  Civilization-specific buildings have a `TraitType` field pointing at
  one of the civ's traits.
- `GameInfo.Beliefs` — pantheon and religion beliefs. Distinguish via
  `BeliefClassType` (`"BELIEF_CLASS_PANTHEON"` vs founder / enhancer /
  worshipper).
- `GameInfo.ProgressionTrees`, `GameInfo.ProgressionTreeNodes` — tech
  and civic trees and their nodes.
- `GameInfo.AgeProgressionMilestones` — legacy path milestones.

Every `Lookup` method takes either the canonical type string
(`"NODE_TECH_AQ_AGRICULTURE"`) or the hash. The returned row has
`$index`, `$hash`, plus the data columns.

`Name`, `Description`, `Tooltip` fields are *always* localization keys
(`"LOC_TECH_AGRICULTURE_NAME"`), never display strings. Use the game's
localization API if you need the display.

## Player operations

`Game.PlayerOperations.sendRequest(playerId, operationType, args)`
issues a player action. The `operationType` is from
`PlayerOperationTypes` (e.g. `PlayerOperationTypes.GRANT_TREE_NODE`).

Operations the existing `civ7-archipelago` mod uses:
- `GRANT_TREE_NODE` with `{ProgressionTreeNodeType: <$index>, FullyUnlock: 1}` —
  fully unlocks a tech or civic node. `FullyUnlock=0` advances by one
  depth tier (useful for granting masteries on already-unlocked nodes).
- `FOUND_PANTHEON`, `FOUND_RELIGION`, `ADD_BELIEF` — religion-system
  actions; require the player to be eligible.

Full list of operations (probed from `PlayerOperationTypes` enum):
`ADD_BELIEF`, `ADVANCED_START_*`, `ASSIGN_RESOURCE`, `ASSIGN_WORKER`,
`BUY_ATTRIBUTE_TREE_NODE`, `CHANGE_GOVERNMENT`, `CHANGE_TRADE_ROUTE`,
`CHANGE_TRADITION`, `CHOOSE_ARTIFACT_PLAYER`, `CHOOSE_CITY_STATE_BONUS`,
`CHOOSE_GOLDEN_AGE`, `CHOOSE_NARRATIVE_STORY_DIRECTION`,
`CHOOSE_SYNCRETISM_INFRASTRUCTURE`, `CHOOSE_SYNCRETISM_UNITS`,
`DECLARE_WAR`, `EXECUTE_SCRIPT`, `EXTEND_GAME`, `FORM_ALLIANCE`,
`FOUND_PANTHEON`, `FOUND_RELIGION`, `GRANT_TREE_NODE`,
`LAND_CLAIM`, `LEVY_MILITARY`, `MAKE_PEACE`, `MOVE_GREAT_WORK`,
`PROMOTE_TOWN_TO_CITY`, `RECRUIT_GREAT_PERSON`, `REJECT_GREAT_PERSON`,
`SELECT_CAPITAL`, `SET_CULTURE_TREE_NODE`, `SET_TECH_TREE_NODE`,
`START_TRADE_ROUTE`, `UNLOCK_POLICIES`, plus diplomatic-action variants.

**No `GRANT_BUILDING` / `COMPLETE_BUILDING` / `PRODUCE_IMMEDIATELY`
operation exists.** Granting a specific building to a player as a
reward requires a workaround — typically a free-production modifier
attached at runtime or a UI prompt that places the building.

## Player subsystems

`Players.get(playerId)` returns a player handle with a fixed set of
subsystem accessors. Confirmed from probing:

- `Ages` — `{age, getNumStartCities, getLastAge}`. `age` is the
  current Age type hash; resolve via `GameInfo.Ages.lookup(age)`.
- `Culture` — civic-tree state, ideology, traditions. Notable methods:
  `getActiveTree`, `getResearching`, `getLastCompletedNodeType`,
  `getChosenIdeology`, `getUnlockedTraditions`, `getNumCultureSlots`.
- `Identity` — attribute points. `addWildcardAttributePoints(N)` adds
  N generic attribute points; `getAvailableAttributePoints`,
  `getSpentAttributePoints` for queries.
- `Techs` — tech-tree state (parallel to `Culture`).
- `LegacyPaths` — see above. `addLegacyPathEvent(pathId, count)` is the
  grant API; `grantReward(rewardHash)` grants the path reward directly.
- `Religion` — pantheon / religion / belief state.
- `Cities`, `Districts`, `Units`, `Constructibles` — empire collections.
- `Diplomacy`, `Espionage`, `Trade`, `Treasury` — economic/diplomatic.
- `GoodyHut` — exists as a subsystem but exposes no enumerable methods
  via `for..in`. Discoveries route through notifications, not this
  subsystem.

## Civ-specific resolution patterns

These are the patterns used by `civ7-archipelago` to resolve
civilization-specific content at runtime:

**Player's civilization → civic tree**:
```
const p = Players.get(GameContext.localPlayerID);
const civDef = GameInfo.Civilizations.lookup(p.civilizationType);
const treeType = civDef.UniqueCultureProgressionTree;  // e.g. "TREE_CIVICS_AQ_ROME"
const tree = GameInfo.ProgressionTrees.lookup(treeType);
// Enumerate tree nodes
const nodes = [];
for (let i = 0; i < GameInfo.ProgressionTreeNodes.length; i++) {
    const n = GameInfo.ProgressionTreeNodes[i];
    if (n && n.ProgressionTree === treeType) nodes.push(n);
}
```

**Player's civilization → unique buildings**:
```
const civDef = GameInfo.Civilizations.lookup(p.civilizationType);
const traits = new Set();
for (let i = 0; i < GameInfo.CivilizationTraits.length; i++) {
    const r = GameInfo.CivilizationTraits[i];
    if (r && r.CivilizationType === civDef.CivilizationType) traits.add(r.TraitType);
}
const uniqueBuildings = [];
for (let i = 0; i < GameInfo.Buildings.length; i++) {
    const b = GameInfo.Buildings[i];
    if (b && b.TraitType && traits.has(b.TraitType)) uniqueBuildings.push(b);
}
```

Rome's traits, for reference: `TRAIT_ANTIQUITY_CIV`, `TRAIT_ROME`,
`TRAIT_ROME_ABILITY`, `TRAIT_ATTRIBUTE_CULTURAL`,
`TRAIT_ATTRIBUTE_MILITARISTIC`.

`UniqueQuarters` is a parallel table that lists per-civ unique
quarters with `{BuildingType1, BuildingType2, TraitType}` — Rome's
`QUARTER_FORUM` → `BUILDING_BASILICA` + `BUILDING_TEMPLE_OF_JUPITER`.

**Unique buildings are unlocked by their civ-specific civic tree
nodes**, not by being the matching civilization alone. The unlock rows
live in `age-<age>/data/progression-trees-culture-unique.xml`:

```
<Row ProgressionTreeNodeType="NODE_CIVIC_AQ_ROME_CIVIS_ROMANUS"
     TargetKind="KIND_CONSTRUCTIBLE"
     TargetType="BUILDING_BASILICA"
     UnlockDepth="1"/>
```

Granting the civic node via `GRANT_TREE_NODE` automatically unlocks
the building tied to it. There is no separate "unlock unique building"
mechanism — the civic node is the unlock. Note that the canonical
unlock data spans BOTH `progression-trees-culture-common.xml` (shared
nodes) AND `progression-trees-culture-unique.xml` (civ-specific
nodes); extractors must parse both.

## Common mistakes to avoid

- **Don't assume `GameContext.currentAge` exists.** It doesn't. Use
  `Players.get(pid).Ages.age` and `GameInfo.Ages.lookup()`.
- **Don't trust event-name lists from third-party docs.** Several
  community wikis name events that aren't in `gamecore-events.xml` —
  `NarrativeChoiceMade`, `ImprovementRemovedFromMap`,
  `NarrativeQuestCompleted` and others are documented but not emitted.
  Always cross-reference against the canonical XML file.
- **Don't treat `Name` fields as display strings.** They're
  localization keys.
- **Don't expect `GoodyHutReward` to fire for Discoveries.** The two
  subsystems coexist; Discoveries are narratives.
- **Don't use `ConstructibleRemovedFromMap` for goody-hut detection.**
  It fires identically for every player's removal of a neutral
  improvement; you cannot attribute. Use `NotificationDismissed` with
  the discovery type hash instead.
- **Don't assume `WonderCompleted` fires once.** It fires twice per
  wonder. Dedupe on `constructibleType`.
- **Don't rely on `#[export]` auto-generated getters** (in mods that
  use Rust via gdext) — Civ 7 doesn't have a Rust extension surface,
  but the analogous Civ 7 lesson is: explicit accessors over implicit
  patterns. The `for..in` enumeration of `player.GoodyHut` returns
  empty even though methods exist on it.

## Probing methodology

`civ7-archipelago` includes a probe harness at
`tests/probe_in_game.py`. Pattern:

1. Connect to the FireTuner socket (`Civ7TunerClient`).
2. Inject probe state (event listeners, API inspectors) into the
   gameplay isolate via the tuner.
3. Trigger in-game actions.
4. Drain the captured-event buffer via `Game.AP_ProbeDrain()`.

This is the most effective workflow for verifying engine API behaviour
without ship cycles on a full mod. See `tests/probe_in_game.py`,
`tests/_probe_surface.js`, `tests/_probe_civ.js`,
`tests/_probe_class_hashes.js`, `tests/_probe_notif_type.js`, and
`tests/_probe_canonical_listeners.js` for the templates used to
derive the contents of this document.

## Acknowledgements

This document was derived from live probing during the construction
of `civ7-archipelago` in November 2026. Where the shipped Civ 7 UI
scripts proved authoritative (e.g.
`base-standard/ui/cinematic/cinematic-manager.chunk.js`,
`base-standard/ui/diplo-ribbon/model-diplo-ribbon.chunk.js`,
`base-standard/ui/quest-tracker/narrative-quest-manager.js`,
`base-standard/ui/unlocks/unlocks-manager.js`,
`base-standard/ui/narrative-event/*`), citations are inline. Cross-
referenced against `gamecore-events.xml` for the canonical event
vocabulary.
