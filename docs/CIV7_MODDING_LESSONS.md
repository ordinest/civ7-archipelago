# Civilization VII Modding Lessons

Practical lessons for modding Civ 7's UI layer and localization data,
distilled from building `civ7-archipelago` and from studying
SeelingCat's "Et Cetera" Workshop mod (id 3553557269), which is the
clearest reference implementation in the wild for the per-tier display
pattern that drives any seed-aware text override of progression trees.

Complements `CIV7_RUNTIME_REFERENCE.md`, which covers the runtime API
surface (events, payloads, FireTuner). This doc is about the **mod
packaging mechanics**: how files reach the engine, what the engine
does with them, and which knobs in the modinfo matter.

## How a Civ 7 mod is loaded

Mods live in `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\<mod-id>\`.
The engine reads the `.modinfo` XML and processes the actions inside
each `<ActionGroup>` against its `<Criteria>`. Action groups can be
gated by criteria like `<AgeInUse>`, `<RuleSetInUse>`, or `<AlwaysMet>`
for runtime-wide actions.

Action types relevant to UI / text mods:

- **`<UIScripts>`** registers `.js` files into the V8 isolate that runs
  the in-game UI (Coherent Gameface / cohtml). These are entry-point
  scripts the engine loads directly.
- **`<ImportFiles>`** copies files into the engine's virtual file
  system at the same path the engine expects them. This is how you
  override a `.chunk.js` that the engine imports by path rather than
  registers explicitly. The engine does **not** execute these files
  directly; it serves them when something else asks for that path.
- **`<UpdateText>`** runs SQL-shaped XML against the `LocalizedText`
  database. Inside it, `<Replace Tag Text/>` rows update existing LOC
  rows but cannot insert genuinely new keys.
- **`<UpdateDatabase>`** runs SQL-shaped XML against the gameplay
  database (units, modifiers, traits, progression-tree-node-unlocks).
- **Top-level `<LocalizedText>`** (sibling of `<ActionGroups>`, not
  inside one) gives the engine an insert-or-replace pass on whatever
  file you point it at, so genuinely new LOC keys you author take
  effect. `<UpdateText>` on its own will not insert new keys.

## File-path override

Mods override engine files by **shipping a file at the same path the
engine expects**. The engine resolves at load time; higher
`<LoadOrder>` on the action group wins on collisions. For UI files
under `ui/...`, the path is relative to the mod root and mirrors
`Base/modules/base-standard/ui/...` in the install tree.

Concretely: to override
`Base/modules/base-standard/ui/tree-grid/tree-card.js`, your mod ships
`<mod-root>/ui/tree-grid/tree-card.js` and registers it in
`<UIScripts>` (entry-point) or `<ImportFiles>` (engine-imported chunk).

The `.gdextension`-style relative-path trick from other engines
doesn't apply; Civ 7 wants the file at the mirrored path.

## The UI is a V8 isolate, the layer is Solid-flavoured JSX

Civ 7's UI runtime is Coherent Gameface with a V8 backend. The UI
codebase compiles JSX (Solid-style reactive primitives: `Show`,
`createComponent`, `insert`, `_$owner = getOwner()`) into the
shipped `.js` files. Mod overrides ship the compiled JS; there is no
JSX source available, no rebuild step, no module bundler involved
when you patch.

Practical consequence: a patch to an override file is read by the
engine **as-is**. If your patch breaks reactivity (forgetting `.get`,
returning a stale closure, calling `Locale.compose` on a key that
should have been deferred to L10n.Compose), the symptom is silent
display garbage, not a thrown error.

## Custom elements via `defineLegacyComponent`

The actual on-screen card element registered in the DOM is
`<tree-card-v2 name="<node-hash>">`, **defined inline in
`screen-tech-tree.js`** via `defineLegacyComponent`, not in the file
called `tree-card.js`. The naming is misleading.

Lesson: never assume the file name matches the element. Probe the live
DOM in-game (a tuner-evaluated `document.querySelectorAll(...)` is
enough) to find the actual rendered tag, then grep that tag name
across the shipped UI source under
`Base/modules/base-standard/ui/` to find where it's defined.

## The render chain spans multiple files; coherent bundle required

Et Cetera modifies eight files. None of them work in isolation,
because the LOC-key-to-display-text resolution path crosses multiple
modules and the **first** module on that path pre-resolves the key
into composed text before passing it onward.

The canonical chain for a tree-card node name:

1. `ui/tree-grid/tree-grid.chunk.js` — vanilla pre-composes
   `nodeInfo.Name` with `Locale.compose(...)` and passes the resulting
   string downward. Et Cetera's patch drops the `Locale.compose` call
   so the raw LOC key survives:
   ```js
   const localeName = nodeInfo.Name ?? nodeInfo.ProgressionTreeNodeType;
   ```
2. `ui/tree-grid/tree-card.js` — the card consumes the (now raw) LOC
   key plus `tier`/`depthUnlocked` data and does the per-tier fallback
   lookup:
   ```js
   if (Locale.keyExists(this.name + "_" + (i+1))) {
       techName = this.name + "_" + (i + 1)
   }
   ```
3. `ui/tech-tree/screen-tech-tree.js` — defines `tree-card-v2` and the
   tech-tree screen render; needs the same fallback for both the card
   `name` prop and the `L10n.Compose` text node inside the tree.
4. `ui/utilities/utilities-textprovider.chunk.js` — `getUnlockTargetName`
   needs the same fallback for any other surface that asks "what's
   this node's display name at depth N?".
5. `ui/tech-civic-complete/screen-tech-civic-complete.js` — completion
   popup uses the same `<base>_<depth>` pattern for the quote and
   author keys, not just the name.
6. `ui/sub-system-dock/panel-sub-system-dock.js` — HUD culture and
   tech buttons use a slightly different display format
   (`Locale.compose(name + "_" + depth) + " (" + Locale.compose("LOC_UI_TREE_MASTERY") + ")"`).
7. `ui/screens/choosers/culture-chooser/culture-chooser.js` — research
   chooser, format `"LOC_UI_TREE_MASTERY: <name>"`.
8. `ui/screens/choosers/tech-chooser/tech-chooser.js` — same as
   culture-chooser, for tech.

Across all of them the fallback pattern is identical:

```js
let depthNumeral = nodeData.depthUnlocked + 1;  // or props.level + 1
if (Locale.keyExists(name + "_" + depthNumeral)) {
    name = Locale.compose(name + "_" + depthNumeral);
} else {
    name = Locale.compose(name);
    depthNumeral = Locale.toRomanNumeral(props.level + 1);
    // ... fall back to "<name> II"
}
```

The footgun: if you patch only some of these files, the parts you
didn't patch still pre-compose or still emit the roman-numeral
fallback. Symptoms include the tooltip card showing raw `LOC_X_NAME_2`
while the tree node shows the correct text, or the tree showing
`Writing II` while the chooser shows the correct mastery name.

**Lesson:** when overriding LOC-key rendering, treat the entire render
chain as one indivisible patch. Confirm via probe that every surface
in the chain (tree, tooltip, chooser, HUD, completion popup) renders
correctly before declaring the change done.

## Per-tier LOC fallback convention: `<base_NAME_LOC>_<tier>`

The pattern Et Cetera proves out and that the AP mod adopts: for a
node whose base name is `LOC_TECH_AGRICULTURE_NAME`, the engine looks
up `LOC_TECH_AGRICULTURE_NAME_2` for the mastery tier (depth 2). If
the key exists, that text wins; if not, fall back to the vanilla
`"<base> II"` roman-numeral construction.

This is a **convention enforced by the UI patches**, not a built-in
engine feature. Without the patches, the engine never looks up
`_<tier>` keys; the suffix is invisible to vanilla.

The convention extends beyond names: Et Cetera applies the same
fallback to `Quote` and `QuoteAuthor` in the completion popup.

## UIScripts vs ImportFiles

- Files the engine loads as entry points → `<UIScripts>`. These
  typically include `screen-*.js`, `panel-*.js`, `*-chooser.js`,
  `tree-card.js`. They have side effects (register custom elements,
  attach event listeners) on load.
- Files imported by path from other files → `<ImportFiles>`. These
  are the `*.chunk.js` files. The engine pulls them in via dynamic
  import based on the path string, so they only need to be present at
  the expected path.

Et Cetera's split (and the AP mod's) puts the five `screen-*` /
`panel-*` / `*-chooser` / `tree-card` files under UIScripts and the
three `*.chunk.js` files under ImportFiles. Match this split when
overriding the render chain.

## LOC key injection requires the top-level `<LocalizedText>` block

`<UpdateText>` inside an action group runs as `<Replace>` against
existing rows. New LOC keys (e.g. `LOC_TECH_AGRICULTURE_NAME_2` for
the mastery override) will not be inserted by `<UpdateText>` alone;
the row has to exist first.

The fix is a top-level `<LocalizedText>` block as a sibling of
`<ActionGroups>` at the modinfo root, pointing at the same override
file:

```xml
<LocalizedText>
    <File>text/en_us/ap_text_overrides.xml</File>
</LocalizedText>
```

This gives the engine an insert-or-replace pass and lets genuinely new
tier keys land. Verified live with `Locale.keyExists("LOC_TECH_WRITING_NAME_2")`
returning `true` after a connect-and-write cycle.

## Override file format and inline-attribute `<Replace>`

The XML the engine accepts for text overrides is:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Database>
    <EnglishText>
        <Replace Tag="LOC_TECH_AGRICULTURE_NAME" Text="My override"/>
        <Replace Tag="LOC_TECH_AGRICULTURE_NAME_2" Text="My mastery override"/>
    </EnglishText>
</Database>
```

The inline `Tag` / `Text` attribute form is what Et Cetera ships and
what the AP companion now emits. Multi-line child-element form
(`<Replace><Tag>...</Tag><Text>...</Text></Replace>`) is also
accepted in the engine but is harder to escape correctly for arbitrary
item names.

XML-escape `&`, `<`, `>`, `"` in the `Text` attribute. Don't try to
embed newlines; the engine treats the text as a single line.

File path: `text/en_us/ap_text_overrides.xml`. Civ 7 looks for
locale-specific text under `text/<locale>/`. Shipping the override
under `data/` does not work for text rows; the engine doesn't scan
`data/` for LocalizedText files.

## Modinfo Properties that matter

`<Package>` controls how the mod is packaged for the Workshop and how
the engine treats it on load. `<Package>Mod</Package>` is the right
value for runtime mods; omitting it produces silently-not-loaded
behaviour in some cases.

`<AffectsSavedGames>` defaults to `1`. Set it to `0` for mods that
only change UI rendering or text, so saves don't tag themselves as
dependent on the mod. AP overrides are runtime-only and safe to
disable mid-save, hence `0`.

`<LoadOrder>` controls collision precedence when multiple mods touch
the same LOC keys or override the same file. Higher loads later;
later wins. Et Cetera uses 100; AP uses 500 so its per-seed text wins
even with Et Cetera enabled (though the two mods overlap on the
mastery-render machinery, so running both is redundant rather than
conflicting).

## ActionGroup criteria

The minimal always-on criterion is:

```xml
<Criteria id="always"><AlwaysMet/></Criteria>
```

Use `scope="game"` on the action group for runtime UI/text mods so the
group activates when a game is in progress. The frontend `scope` is
for shell-level UI (main menu, mod browser).

## Live probing is the iteration loop

Civ 7's mod load is the slow loop (restart-the-game, sometimes
restart-Steam). The fast loop is tuner-injected JS into the running
isolate. The probe pattern:

1. Boot the game with `EnableTuner 1` set.
2. Send the probe over the FireTuner socket
   (`127.0.0.1:4318`) as `[len][type=3][CMD:65535:<js>\0]`.
3. Read back the JSON-stringified last expression.

Useful probes:

- `Locale.keyExists("LOC_X")` — does the LOC row exist post-load?
- `Locale.compose("LOC_X")` — what does it resolve to?
- `document.querySelectorAll("tree-card-v2")` — what's actually rendered?
- `JSON.stringify(document.querySelector("tree-card-v2").attributes)` —
  what attrs is the engine giving the custom element?

The `tests/_probe_*` files in this repo are runnable examples.

## When a mod doesn't behave: order of investigation

In rough order of "most likely":

1. Did the action group load at all? Look for the mod id in
   `%LOCALAPPDATA%\...\Logs\Modding.log` at game start. A missing
   `<Package>` or malformed XML kills the group silently.
2. Are the files at the paths the engine expects? `text/en_us/`, not
   `data/`; `ui/tree-grid/tree-card.js`, not `tree-card.js` at root.
3. Is the LOC key getting inserted? Probe `Locale.keyExists`; if it's
   false, the top-level `<LocalizedText>` block is probably missing
   or the path is wrong.
4. Is the LOC key resolving correctly? Probe `Locale.compose`; if it
   returns the raw key, the UI patch is calling it on a string that
   was already composed earlier in the chain (the tree-grid.chunk.js
   pre-composition trap).
5. Are all the render-chain files patched? Probe the actual rendered
   DOM. If the tree renders right but the tooltip doesn't, find the
   tooltip's source file and patch it too.
6. Did a higher-LoadOrder mod clobber yours? Audit the install dir
   for mods touching the same files.

## What we deliberately did not do

- Runtime DB mutation. There is no JS API in the UI isolate to alter
  the gameplay database (no `Modifiers.add`, no `Traits.grant`, no
  `GameInfo.X.insert`). Anyone telling you there is is wrong. All
  data changes go through `<UpdateDatabase>` SQL at mod-load time.
- Cross-isolate calls. The tuner runs in a different V8 isolate than
  the UI. Tuner-injected DOM patches don't survive; mod-source patches
  via `<UIScripts>` do.
- Per-LOC-key `<Database>`-scoped action groups. The
  `<LocalizedText>` block at modinfo root is simpler and covers the
  insert-or-replace need.

## Attribution

SeelingCat's "Et Cetera" Workshop mod (id 3553557269) is the reference
implementation for the per-tier display pattern documented above. The
eight UI files in this mod are copied verbatim from that mod with
attribution headers in each file. If you're modding the tree-card
render chain, install Et Cetera first and study its modinfo and JS
diffs against the shipped UI source under
`Base/modules/base-standard/ui/`.
