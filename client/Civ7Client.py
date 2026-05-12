"""Civilization VII Archipelago client.

Bridges the Archipelago multiworld server (websocket) and the running
Civ 7 game (FireTuner). Subclass of `CommonContext` so it gets the
standard AP client UX: connect/disconnect, item-link, hint/release/etc.

Run from the Archipelago repo root with our apworld installed:

    cd ~/source/Archipelago
    .venv/Scripts/python.exe path/to/Civ7Client.py [server:port] [slot]

Or invoke directly; the script handles the path setup itself.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
AP_ROOT = Path.home() / "source" / "Archipelago"

# Civ 7 user data lives at %LOCALAPPDATA%\Firaxis Games\Sid Meier's
# Civilization VII\. The installed mod (where Civ 7 reads modinfo
# actions from at game start) is here, NOT in the repo source tree.
CIV7_USERDATA = (
    Path.home() / "AppData" / "Local" / "Firaxis Games" / "Sid Meier's Civilization VII"
)
MOD_INSTALL_DIR = CIV7_USERDATA / "Mods" / "civ7-archipelago"

# Order matters: AP root must precede the project so Archipelago modules
# resolve before our local namespace.
sys.path.insert(0, str(AP_ROOT))
sys.path.insert(0, str(REPO_ROOT))


# Importing TunerClient is safe because we moved it out of the apworld
# package. No AP deps.
from client.TunerClient import Civ7TunerClient, TunerError  # noqa: E402

# AP framework. These imports require Archipelago to be importable, which
# is true when running this script from the AP venv with AP_ROOT on path.
import ModuleUpdate  # noqa: E402
ModuleUpdate.update_ran = True  # short-circuit the per-world dep check

import Utils  # noqa: E402, F401
from CommonClient import (  # noqa: E402
    CommonContext,
    ClientCommandProcessor,
    get_base_parser,
    gui_enabled,
    logger,
    server_loop,
)


# Apworld access. The apworld lives at worlds/civ_7/ in the AP install
# (placed there by tests/test_smoke_generation.py refresh, or the user's
# own install copy). We need its ITEM_TABLE and LOCATION_TABLE so we can
# map between AP IDs and Civ 7 internal node IDs.
try:
    from worlds.civ_7.Items import ITEM_TABLE  # type: ignore[import-not-found]
    from worlds.civ_7.Locations import LOCATION_TABLE  # type: ignore[import-not-found]
    from worlds.civ_7.data.extracted.node_names import (  # type: ignore[import-not-found]
        NODE_NAME_LOC_KEYS,
    )
    from worlds.civ_7.data.extracted.civ_unique_trees import (  # type: ignore[import-not-found]
        ANTIQUITY_UNIQUE_CIVIC_TREES,
        EXPLORATION_UNIQUE_CIVIC_TREES,
        MODERN_UNIQUE_CIVIC_TREES,
    )
except ImportError as exc:
    raise SystemExit(
        f"Civ 7 apworld not importable. Ensure it is copied to "
        f"{AP_ROOT}/worlds/civ_7/ (run pytest in the project to refresh). "
        f"Underlying: {exc}"
    )


# ---------------------------------------------------------------------
# Mappings: Civ 7 internal IDs <-> AP IDs
# ---------------------------------------------------------------------

# Civ 7 node ID (string) -> AP location code (int).
# The mod queues internal node IDs; we send AP location codes to the server.
_LOCATION_NODE_TO_CODE: dict[str, int] = {
    data.civ7_node_id: data.code
    for data in LOCATION_TABLE.values()
    if data.civ7_node_id is not None
}

# Special-cased synthetic node IDs that the mod emits for non-tree-node
# locations: attribute-point milestones, etc. These also need to map to
# AP location codes.
_SPECIAL_LOCATION_NAME_TO_CODE: dict[str, int] = {
    name: data.code for name, data in LOCATION_TABLE.items()
}


# Civ 7 internal node ID -> AP mastery-location code. The mod queues
# "MASTERY:<node_id>" for the second completion of a tree node; this map
# resolves the node ID part to the mastery location.
_MASTERY_NODE_TO_CODE: dict[str, int] = {}
for _data in LOCATION_TABLE.values():
    if _data.civ7_node_id is not None and "Mastery:" in _data.name:
        _MASTERY_NODE_TO_CODE[_data.civ7_node_id] = _data.code


def resolve_location_to_code(node_id: str) -> int | None:
    """Map a queued mod-side string to its AP location code.

    The mod queues several string formats:
      - Civ 7 internal node ID for tech/civic base completions and
        Legacy Path milestones; resolved via _LOCATION_NODE_TO_CODE.
      - "MASTERY:<node_id>" for second-tier (mastery) completions.
      - "AP_ATTRIBUTE_POINT_<N>" for cumulative-attribute milestones.
      - AP location *display name* for pure-check locations introduced
        in caps 6-9 (Pantheon, Religion, Belief, Wonder, Discovery).
    """
    if node_id in _LOCATION_NODE_TO_CODE:
        return _LOCATION_NODE_TO_CODE[node_id]

    if node_id.startswith("MASTERY:"):
        underlying = node_id.removeprefix("MASTERY:")
        return _MASTERY_NODE_TO_CODE.get(underlying)

    if node_id.startswith("AP_ATTRIBUTE_POINT_"):
        n = node_id.removeprefix("AP_ATTRIBUTE_POINT_")
        ap_name = f"Attribute Points Earned: {n}"
        return _SPECIAL_LOCATION_NAME_TO_CODE.get(ap_name)

    # Direct AP location-name fallback for pure-check locations.
    return _SPECIAL_LOCATION_NAME_TO_CODE.get(node_id)


# Reverse map: AP location code -> mod-side identifier. Used to push
# the location-info table to the mod indexed by the same identifier the
# tree-rendering code already has handy. Mastery codes get the
# "MASTERY:<node_id>" form so the mod can look up either kind from a
# tree-node ID.
def _build_code_to_modside_identifier() -> dict[int, str]:
    out: dict[int, str] = {}
    for name, data in LOCATION_TABLE.items():
        if data.code is None:
            continue
        # Mastery locations share civ7_node_id with their base; key
        # them under the MASTERY: synthetic prefix so they're
        # distinguishable from base completions.
        if data.civ7_node_id is not None:
            if "Mastery:" in name:
                out[data.code] = f"MASTERY:{data.civ7_node_id}"
            else:
                out[data.code] = data.civ7_node_id
        elif name.startswith("Attribute Points Earned: "):
            n = name.removeprefix("Attribute Points Earned: ")
            out[data.code] = f"AP_ATTRIBUTE_POINT_{n}"
        else:
            # Pure-check locations: pantheon, religion, beliefs,
            # wonders, discoveries, civic-tree slots. The mod queues
            # these by display name.
            out[data.code] = name
    return out


_CODE_TO_MODSIDE_IDENTIFIER: dict[int, str] = _build_code_to_modside_identifier()


# Mastery locations key on "MASTERY:<node_id>" via the mod-side identifier.
# Map each mastery identifier to the depth-2 LOC override key the mod's
# modified tree-card.js looks up (`<base name LOC>_2`).
def _mastery_loc_key(modside_identifier: str) -> str | None:
    if not modside_identifier.startswith("MASTERY:"):
        return None
    node_id = modside_identifier.removeprefix("MASTERY:")
    base_loc = NODE_NAME_LOC_KEYS.get(node_id)
    if not base_loc:
        return None
    return f"{base_loc}_2"


# Civ-unique civic tree node LOC keys grouped by Age + slot index.
# For an AP location like "Antiquity Civ Civic Tree Slot 1 Completed",
# we want to override every civ's first Antiquity-unique civic node's
# display name with that location's AP item. Whichever civ the player
# picks, their tree shows the AP item on the right node.
_CIV_UNIQUE_TREES_BY_AGE: dict[str, dict[str, tuple[str, ...]]] = {
    "Antiquity": ANTIQUITY_UNIQUE_CIVIC_TREES,
    "Exploration": EXPLORATION_UNIQUE_CIVIC_TREES,
    "Modern": MODERN_UNIQUE_CIVIC_TREES,
}


def _civ_unique_slot_loc_keys(age: str, slot: int) -> list[str]:
    """Return every LOC key for the `slot`-th (1-indexed) node of every
    civ-unique civic tree in the given Age. Civs with fewer than `slot`
    nodes contribute nothing.
    """
    out: list[str] = []
    trees = _CIV_UNIQUE_TREES_BY_AGE.get(age, {})
    for _tree_id, nodes in trees.items():
        if slot - 1 < len(nodes):
            node_id = nodes[slot - 1]
            loc_key = NODE_NAME_LOC_KEYS.get(node_id)
            if loc_key is not None:
                out.append(loc_key)
    return out


_CIV_CIVIC_SLOT_RE = re.compile(
    r"^(Antiquity|Exploration|Modern) Civ Civic Tree Slot (\d+) Completed$"
)


# AP item code (int) -> AP item name (string) for delivery to the mod.
_ITEM_CODE_TO_NAME: dict[int, str] = {
    data.code: data.name for data in ITEM_TABLE.values()
}


def resolve_item_code_to_name(code: int) -> str | None:
    return _ITEM_CODE_TO_NAME.get(code)


# ---------------------------------------------------------------------
# Civ7Context
# ---------------------------------------------------------------------


class Civ7CommandProcessor(ClientCommandProcessor):
    """In-client commands. /civ7status etc."""

    def _cmd_civ7_status(self) -> bool:
        """Print the mod's reported status."""
        self.ctx.run_async(self.ctx.print_civ7_status())
        return True


class Civ7Context(CommonContext):
    game: str = "Civilization VII"
    items_handling: int = 0b111  # local + remote + starting inventory
    command_processor = Civ7CommandProcessor

    def __init__(self, server_address: str | None, password: str | None) -> None:
        super().__init__(server_address, password)
        self.tuner = Civ7TunerClient()
        self.tuner_connected: bool = False
        self.tuner_lock = asyncio.Lock()
        self.delivered_item_indexes: set[int] = set()
        self.poll_task: asyncio.Task | None = None

    # ------- AP CommonContext hooks -------

    async def server_auth(self, password_requested: bool = False) -> None:
        if password_requested and not self.password:
            await super().server_auth(password_requested)
        await self.get_username()
        await self.send_connect()

    def on_package(self, cmd: str, args: dict) -> None:
        if cmd == "Connected":
            logger.info("Connected to AP server as slot %s.", args.get("slot"))
            self.delivered_item_indexes.clear()
            asyncio.create_task(self._scout_all_locations())
        elif cmd == "ReceivedItems":
            asyncio.create_task(self._deliver_items(args))
        elif cmd == "LocationInfo":
            asyncio.create_task(self._handle_location_info(args))

    # ------- Tuner / mod bridge -------

    async def ensure_tuner(self) -> bool:
        if self.tuner_connected:
            return True
        async with self.tuner_lock:
            # Double-checked locking: another coroutine may have
            # connected while we were waiting for the lock.
            if self.tuner_connected:
                return True
            try:
                await self.tuner.connect()
            except TunerError as e:
                logger.warning("FireTuner not reachable yet: %s", e)
                return False
            self.tuner_connected = True
            # Probe for the mod.
            try:
                r = await self.tuner.eval_js("typeof Game.AP_Status")
                if r.body != "function":
                    logger.warning(
                        "Mod is not loaded (typeof Game.AP_Status = %r). "
                        "Verify the mod is enabled in Civ 7 and you are in a "
                        "game session.", r.body)
                    self.tuner_connected = False
                    await self.tuner.close()
                    return False
            except TunerError as e:
                logger.warning("Tuner mod probe failed: %s", e)
                self.tuner_connected = False
                await self.tuner.close()
                return False
            logger.info("FireTuner connected; mod responsive.")
            return True

    async def pull_checks(self) -> list[int]:
        """Drain the in-game queue and translate to AP location codes."""
        if not self.tuner_connected:
            return []
        async with self.tuner_lock:
            r = await self.tuner.eval_js("Game.AP_GetUnsentCheckedLocations()")
        try:
            node_ids = json.loads(r.body)
        except json.JSONDecodeError:
            logger.warning("queue pull returned non-JSON: %r", r.body)
            return []
        codes: list[int] = []
        for node_id in node_ids:
            code = resolve_location_to_code(node_id)
            if code is None:
                logger.warning("queued node %r has no AP location code", node_id)
                continue
            codes.append(code)
        return codes

    async def _scout_all_locations(self) -> None:
        """Send LocationScouts for every location in our slot.

        AP replies with a LocationInfo package whose `locations` field
        carries one NetworkItem per scouted location, describing the
        item placed there and which player receives it. We write the
        result to the mod's `data/ap_text_overrides.xml` so that Civ 7
        renders the AP item at each tree-card location natively via
        the <UpdateText> action on next mod load.
        """
        codes = sorted(_CODE_TO_MODSIDE_IDENTIFIER.keys())
        if not codes:
            return
        await self.send_msgs([{
            "cmd": "LocationScouts",
            "locations": codes,
            "create_as_hint": 0,
        }])

    async def _handle_location_info(self, args: dict) -> None:
        """Process a LocationInfo reply: build a LOC-key -> AP-item-text
        map and write the mod's <UpdateText> override file into the
        installed mod directory. Civ 7 reads the file on next
        new-game-start, baking AP names into the game's database; the
        tree-card UI then renders them natively, no runtime UI hooks.
        """
        overrides: dict[str, str] = {}
        for net_item in args.get("locations", []):
            loc_code = getattr(net_item, "location", None)
            item_code = getattr(net_item, "item", None)
            target_slot = getattr(net_item, "player", None)
            if loc_code is None or item_code is None or target_slot is None:
                continue
            identifier = _CODE_TO_MODSIDE_IDENTIFIER.get(loc_code)
            if identifier is None:
                continue
            item_name: str | None = None
            try:
                item_name = self.item_names.lookup_in_slot(target_slot, item_code)
            except Exception:
                pass
            if not item_name:
                item_name = resolve_item_code_to_name(item_code)
            if not item_name:
                item_name = f"item_{item_code}"

            # Tech / civic / civ-unique-civic base completions: identifier
            # is the ProgressionTreeNodeType. Direct override via the
            # node's Name LOC key.
            loc_key = NODE_NAME_LOC_KEYS.get(identifier)
            if loc_key is not None:
                overrides[loc_key] = item_name
                continue

            # Mastery completions: identifier is "MASTERY:<node_id>".
            # Our modified tree-card.js looks up `<base name LOC>_2`
            # for the depth-2 tier name; emit that key.
            mastery_key = _mastery_loc_key(identifier)
            if mastery_key is not None:
                overrides[mastery_key] = item_name
                continue

            # Civ-unique civic tree slot locations: identifier looks like
            # "Antiquity Civ Civic Tree Slot 1 Completed". Override the
            # slot-th node of every civ's unique tree in that Age so
            # whichever civ the player picks, the AP item lands on the
            # right node.
            m = _CIV_CIVIC_SLOT_RE.match(identifier)
            if m:
                age, slot_str = m.group(1), m.group(2)
                for slot_loc_key in _civ_unique_slot_loc_keys(age, int(slot_str)):
                    overrides[slot_loc_key] = item_name
                continue

            # Other location categories (mastery, pantheon, religion,
            # wonders, discoveries, legacy-path milestones,
            # attribute-point thresholds, progressive age) do not have
            # a 1-to-1 vanilla LOC key we can override. Their display
            # is handled by a separate AP-tracker surface (planned).
        self._write_text_override_file(overrides)

    def _write_text_override_file(self, overrides: dict[str, str]) -> None:
        """Write the mod's per-seed `text/en_us/ap_text_overrides.xml`.

        Civ 7 reads this file via the modinfo's <UpdateText> and
        <LocalizedText> declarations at new-game-start.

        Keys that vanilla already defines (e.g. LOC_TECH_AGRICULTURE_NAME)
        are emitted with `<Replace>` semantics. Keys we are introducing
        (mastery `_NAME_2` variants that have no vanilla row) are
        emitted with `<Row>` (INSERT) — Civ 7's text loader rejects
        `<Replace>` for non-existent rows on some builds, which would
        leave the key unbound and our render-time `Locale.keyExists`
        lookup would always miss.
        """
        target_dir = MOD_INSTALL_DIR / "text" / "en_us"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / "ap_text_overrides.xml"
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<!-- Generated by the Civ 7 AP companion. Per-seed; rewritten on each scout. -->',
            "<Database>",
            "\t<EnglishText>",
        ]
        for loc_key, item_name in sorted(overrides.items()):
            safe = (item_name
                    .replace("&", "&amp;")
                    .replace('"', "&quot;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;"))
            # `<Replace>` for both new and existing keys, mirroring
            # SeelingCat's "Et Cetera" exactly. Et Cetera introduces
            # new `_NAME_2` keys via <Replace> and the engine accepts
            # them, so the element name itself isn't the discriminator.
            lines.append(f'\t\t<Replace Tag="{loc_key}" Text="{safe}"/>')
        lines.append("\t</EnglishText>")
        lines.append("</Database>")
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")
        logger.info(
            "wrote %d AP text overrides to %s", len(overrides), target
        )

    async def push_item(self, ap_item_name: str) -> bool:
        """Forward a received AP item to the in-game mod."""
        if not self.tuner_connected:
            return False
        # JSON-encode the string for safe interpolation into JS.
        js_name = json.dumps(ap_item_name)
        async with self.tuner_lock:
            r = await self.tuner.eval_js(
                f"Game.AP_HandleReceiveItem({js_name})"
            )
        try:
            result = json.loads(r.body)
        except json.JSONDecodeError:
            logger.warning("HandleReceiveItem returned non-JSON: %r", r.body)
            return False
        ok = bool(result.get("ok"))
        if not ok:
            logger.warning("mod refused item %r: %r", ap_item_name, result)
        return ok

    async def _deliver_items(self, args: dict) -> None:
        items = args.get("items", [])
        index_start = args.get("index", 0)
        for offset, item in enumerate(items):
            absolute_index = index_start + offset
            if absolute_index in self.delivered_item_indexes:
                continue
            # AP's NetworkItem is a NamedTuple with fields (item, location,
            # player, flags); access by attribute or index, not dict-style.
            code = getattr(item, "item", None)
            if code is None and isinstance(item, (list, tuple)) and item:
                code = item[0]
            name = resolve_item_code_to_name(code)
            if name is None:
                logger.warning("received unknown item code %s", code)
                continue
            ok = await self.push_item(name)
            if ok:
                self.delivered_item_indexes.add(absolute_index)

    async def print_civ7_status(self) -> None:
        if not await self.ensure_tuner():
            logger.info("Cannot reach the mod; status unavailable.")
            return
        async with self.tuner_lock:
            r = await self.tuner.eval_js("Game.AP_Status()")
        logger.info("Civ 7 mod status: %s", r.body)

    def run_gui(self) -> None:
        """Launch the player-facing companion GUI.

        Built on Archipelago's `kvui.GameManager`, which provides the
        standard AP message-log surface plus auxiliary tabs we register.
        Mirrors the pattern in `worlds/factorio/Client.py`.
        """
        from kvui import GameManager  # lazy import; pulls in Kivy

        class Civ7Manager(GameManager):
            logging_pairs = [
                ("Client", "Archipelago"),
                ("client.TunerClient", "FireTuner"),
            ]
            base_title = "Archipelago Civilization VII Companion"

        self.ui = Civ7Manager(self)
        self.ui_task = asyncio.create_task(self.ui.async_run(), name="UI")

    # ------- Background polling -------

    async def poll_loop(self) -> None:
        """Poll the game queue and forward checks to the AP server."""
        try:
            while not self.exit_event.is_set():
                try:
                    if not self.tuner_connected:
                        ok = await self.ensure_tuner()
                        if not ok:
                            await asyncio.sleep(2.0)
                            continue
                    if self.server is None or not self.server.socket.open:
                        await asyncio.sleep(1.0)
                        continue
                    codes = await self.pull_checks()
                    if codes:
                        new_codes = [
                            c for c in codes
                            if c not in self.locations_checked
                        ]
                        if new_codes:
                            self.locations_checked.update(new_codes)
                            await self.send_msgs([{
                                "cmd": "LocationChecks",
                                "locations": new_codes,
                            }])
                            logger.info("sent %d location checks: %s",
                                        len(new_codes), new_codes)
                except TunerError as e:
                    logger.warning("tuner error in poll loop: %s", e)
                    self.tuner_connected = False
                    try:
                        await self.tuner.close()
                    except Exception:
                        pass
                except Exception as e:
                    logger.exception("poll loop error: %s", e)
                await asyncio.sleep(1.0)
        finally:
            try:
                await self.tuner.close()
            except Exception:
                pass


async def run() -> None:
    parser = get_base_parser(description="Civilization VII Archipelago Client")
    parser.add_argument("--name", help="Slot name to auto-authenticate as.")
    args = parser.parse_args()

    ctx = Civ7Context(args.connect, args.password)
    if args.name:
        ctx.auth = args.name
    server_task = asyncio.create_task(server_loop(ctx), name="ServerLoop")
    poll_task = asyncio.create_task(ctx.poll_loop(), name="Civ7Poll")

    if gui_enabled:
        ctx.run_gui()
    ctx.run_cli()

    await ctx.exit_event.wait()
    server_task.cancel()
    poll_task.cancel()
    await ctx.shutdown()


def launch() -> None:
    Utils.init_logging("Civ7Client")
    logging.getLogger("client.TunerClient").setLevel(logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    launch()
