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
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
AP_ROOT = Path.home() / "source" / "Archipelago"

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
        elif cmd == "ReceivedItems":
            asyncio.create_task(self._deliver_items(args))

    # ------- Tuner / mod bridge -------

    async def ensure_tuner(self) -> bool:
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
