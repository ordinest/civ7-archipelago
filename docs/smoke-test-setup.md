# Setup and verification walkthrough

A guided run through the install, the in-game smoke test (no AP server
needed, just the mod and the Python tuner client), and the end-to-end
multiworld test (AP server plus client plus the running game).

## Prerequisites

- Civilization VII installed on the same machine.
- A clone of [ArchipelagoMW/Archipelago](https://github.com/ArchipelagoMW/Archipelago)
  with its Python venv set up. The python executable referenced below is
  the one inside that venv.
- Python 3.12 or newer.
- A clone of this repo.

## Install the mod and enable FireTuner

```
python tests/setup_mod_install.py
```

This copies the contents of `mod/` into Civ 7's user-mods directory at
`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\civ7-archipelago\`,
then sets `EnableTuner 1` (and `EnableDebugPanels 1`) in
`AppOptions.txt` in the same directory. The script is idempotent. If it
reports the Civ 7 user directory does not exist, launch Civ 7 once
through Steam to generate the directory tree and re-run.

Mod files are copied rather than symlinked; Civ 7's mod scanner does
not follow Windows symlinks. After editing the mod source, re-run the
script to push the changes through.

## In-game smoke test

This verifies the tuner-mod bridge directly, without an AP server. It
confirms the mod loaded, that engine events fire location checks, and
that received items grant techs.

Launch Civilization VII via Steam. In the in-game mod browser, enable
**Civilization VII Archipelago**. Start a new single-player game. Any
leader works; the test only needs Antiquity active. Play to turn 1.

In another terminal:

```
python tests/smoke_in_game.py
```

The driver connects to FireTuner at `127.0.0.1:4318`, probes
`Game.AP_Status()`, pulls the current queue, prompts you to research a
tech in-game, pulls the queue again, then injects an Antiquity Tech:
Pottery delivery and asks you to confirm it landed in the tech tree.

Success looks like a JSON status response from the mod, the tech node
ID showing up in the queue after research, the Pottery injection
returning `{ok: true, status: "ok"}`, and Pottery visibly researched in
the in-game tech tree.

## End-to-end multiworld test

This spins up the AP server and the AP-server-connected client and
wires both ends to the running game.

With Civ 7 in a game session at turn 1 and the mod enabled:

```
python tests/run_generation.py
```

Generates a fresh seed under `Archipelago/Generated_Output/`.

```
python tests/orchestrate_test.py
```

Runs the AP server with the latest archive, starts the Civ7Client
connected to the server, lets the round-trip run for a few seconds,
then prints the tail of both logs and shuts everything down.

The server will report the slot joining (`Tester ... has joined`) and
location checks landing (`(Team #1) Tester sent ... to ...`). The
client log will show `connected to FireTuner` and `sent N location
checks`.

If the AP server has trouble binding to port 38281 because a previous
run left a process holding it, the client log will show a connection
refused; close the lingering process or change ports.

## Manual server + client

For a real play session you want the server and client running
independently rather than through the orchestrator.

```
python tests/run_server.py \
    --port 38281 --host 127.0.0.1 --loglevel info \
    path/to/Archipelago/Generated_Output/AP_*.zip
```

In another terminal:

```
python client/Civ7Client.py --connect 127.0.0.1:38281 --name Tester
```

The client opens an AP CommonContext CLI. Type `/civ7_status` to see
the mod's reported state. Standard AP commands like `/connect`,
`/disconnect`, `!hint`, `!release` work too.

## Diagnostics

If the smoke driver reports the mod is not loaded, the most common
causes are: Civ 7 launched before `EnableTuner 1` was set in
`AppOptions.txt` (relaunch); the mod was enabled via the browser but
Civ 7 has not been restarted since (relaunch); or the mod source was
edited but the install script has not been re-run since (re-run).

If FireTuner is unreachable, confirm Civ 7 is running and in a game
session. The tuner socket binds at game start and only stays open
while the game is running.

The Civ 7 log files are in
`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Logs\`.
`Modding.log` shows which mods loaded at game start and which actions
were applied. `[AP]` lines from the mod's `console.log` calls show up
in the per-channel logs.
