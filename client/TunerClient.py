"""FireTuner socket bridge for Civ 7.

Wire protocol verified against a running Civ 7 instance:

    SEND framing:
        [4 bytes: payload length, little-endian uint32]
        [4 bytes: message type = 3, little-endian uint32]
        [payload: "CMD:65535:<javascript>\\0"]

    RECEIVE framing (per response):
        [4 bytes: body length, little-endian uint32]
        [4 bytes: message type = 3, little-endian uint32]
        [body: <result string>\\0]

The body is the JavaScript expression's return value, coerced to a
string by the V8 isolate. `console.log(x)` returns "undefined";
`1 + 1` returns "2"; `JSON.stringify(...)` returns the JSON text.

This means the Civ 6 APSTART/APEND framing convention is not needed
for Civ 7: we read the return value directly from the socket. Mod
accessors should `return` JSON strings rather than `console.log` them.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from struct import pack, unpack


TUNER_HOST: str = "127.0.0.1"
TUNER_PORT: int = 4318

MSG_TYPE_COMMAND: int = 3
CMD_PREFIX: bytes = b"CMD:65535:"
NULL: bytes = b"\x00"


logger = logging.getLogger(__name__)


@dataclass
class TunerResponse:
    """One frame received from the tuner."""

    body: str  # null-terminator stripped, utf-8 decoded
    msg_type: int


class TunerError(RuntimeError):
    """Raised on protocol failures."""


class Civ7TunerClient:
    """Send JavaScript to a running Civ 7 game over FireTuner.

    Civ 7 must be launched with `EnableTuner 1` in
    `%LOCALAPPDATA%\\Firaxis Games\\Sid Meier's Civilization VII\\AppOptions.txt`,
    and a game session must be in progress (the tuner socket binds when
    the game starts and only stays open while it is running).
    """

    def __init__(self, host: str = TUNER_HOST, port: int = TUNER_PORT) -> None:
        self.host = host
        self.port = port
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None

    async def connect(self) -> None:
        try:
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port), timeout=2.0
            )
        except (OSError, asyncio.TimeoutError) as e:
            raise TunerError(
                f"Failed to connect to FireTuner at {self.host}:{self.port}. "
                f"Confirm Civ 7 is running with EnableTuner 1, in a game "
                f"session, with no firewall blocking. Underlying: {e}"
            ) from e
        logger.info("connected to FireTuner at %s:%d", self.host, self.port)

    async def close(self) -> None:
        if self._writer is not None:
            self._writer.close()
            try:
                await self._writer.wait_closed()
            except Exception:
                pass
        self._reader = None
        self._writer = None

    async def eval_js(self, js: str, timeout: float = 2.0) -> TunerResponse:
        """Send a JavaScript expression to the game and read its return value.

        The returned `TunerResponse.body` is the V8 string coercion of
        whatever the expression evaluates to. `JSON.stringify(...)`
        returns clean JSON text the caller decodes with `json.loads`.

        Civ 7 may push unsolicited frames on the tuner stream (engine
        events, mod log lines, etc.). We drain any pending frames before
        sending, then keep reading until we see a frame whose body is
        the response to OUR command. The protocol does not include a
        sequence number, so we use "first non-empty body after our send"
        as the heuristic. Empty-body frames are typically engine acks or
        keep-alives.
        """
        if self._writer is None or self._reader is None:
            raise TunerError("eval_js called before connect")

        # Drain any pending bytes from prior unsolicited frames.
        while True:
            try:
                stale = await asyncio.wait_for(self._reader.read(65536), timeout=0.05)
                if not stale:
                    break
            except asyncio.TimeoutError:
                break

        payload = CMD_PREFIX + js.encode("utf-8") + NULL
        frame = pack("<II", len(payload), MSG_TYPE_COMMAND) + payload

        self._writer.write(frame)
        await self._writer.drain()

        # Read frames until we get one with a non-empty body. Bound by
        # `timeout` total wait.
        loop = asyncio.get_event_loop()
        deadline = loop.time() + timeout
        while True:
            remaining = max(0.0, deadline - loop.time())
            try:
                header = await asyncio.wait_for(self._reader.readexactly(8), timeout=remaining)
            except (asyncio.TimeoutError, asyncio.IncompleteReadError) as e:
                raise TunerError(f"Timed out reading tuner response header: {e}") from e

            body_len, msg_type = unpack("<II", header)
            remaining = max(0.0, deadline - loop.time())
            try:
                body_bytes = await asyncio.wait_for(
                    self._reader.readexactly(body_len), timeout=remaining
                )
            except (asyncio.TimeoutError, asyncio.IncompleteReadError) as e:
                raise TunerError(
                    f"Timed out reading tuner response body ({body_len} bytes): {e}"
                ) from e

            if body_len == 0:
                # Likely an ack or keep-alive; keep reading.
                logger.debug("skipping empty tuner frame (msg_type=%d)", msg_type)
                continue
            body = body_bytes.rstrip(b"\x00").decode("utf-8", errors="replace")
            return TunerResponse(body=body, msg_type=msg_type)


async def _smoke_test() -> None:  # pragma: no cover - manual
    logging.basicConfig(level=logging.INFO)
    client = Civ7TunerClient()
    await client.connect()
    response = await client.eval_js("typeof Game.AP_Status")
    print("typeof Game.AP_Status =", response.body)
    if response.body == "function":
        print("Mod is loaded; calling AP_Status:")
        status = await client.eval_js("Game.AP_Status()")
        print("status:", status.body)
    await client.close()


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(_smoke_test())
