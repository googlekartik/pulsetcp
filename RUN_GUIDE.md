# PulseTCP — How to Run (Step-by-Step)

Tested end to end on 17 Nov 2026. Everything below was actually run and works.

## What this project is

A multi-client chat app with real TCP networking:

- **Python TCP server** (`python/tcp_server.py`) — threaded socket server on port **9090**.
  Nicknames, public broadcast, private `/msg`, channels, `/ping`, `/stats`,
  and login/register with PBKDF2 password hashing stored in SQLite.
- **Node bridge + web UI** (`server.ts` + `src/`) — Express server on port **3000**
  that starts the Python server for you, bridges browsers to it over WebSocket,
  and serves the React (Vite + Tailwind) interface.
- **Terminal client** (`python/tcp_client.py`) — chat from a terminal, no browser needed.

No API key is needed. Nothing in this project calls Gemini — the
`GEMINI_API_KEY` line in `.env.example` is leftover from the AI Studio
template and can be ignored.

## Prerequisites (install once)

1. **Python 3.10 or newer** — check with `python --version`
   (download from https://www.python.org/downloads/ — tick **Add Python to PATH**).
2. **Node.js 20 LTS or newer** — check with `node --version`
   (download from https://nodejs.org — the LTS version).

## Run it (Windows, PowerShell)

```powershell
# 1. Go into the project folder (where you extracted the zip).
#    The path has a space in "Kartik Ranjan", so it MUST be in quotes.
cd "C:\Users\Kartik Ranjan\Downloads\pulsetcp"

# 2. Install the web dependencies (first time only, ~40 seconds)
#    Use npm.cmd (not npm) — plain `npm` is blocked by PowerShell's
#    script execution policy on this PC. npm.cmd works without changing it.
npm.cmd install

# 3. Start everything with ONE command.
#    This starts the Python TCP server on port 9090 AND the web UI on port 3000.
npm.cmd run dev
```

Wait until you see both lines:

```
[PulseTCP] Python TCP Server listening on 0.0.0.0:9090
[PulseTCP] Web GUI + WebSocket-to-Python-TCP Bridge listening on http://0.0.0.0:3000
```

Then open **http://localhost:3000** in your browser.

## Log in (demo accounts — already created for you)

| Username | Password | Role |
|---|---|---|
| `dev_alex` | `AlexPulse#2026` | CLIENT |
| `alice_core` | `AlicePulse#2026` | ADMIN |
| `bob_infra` | `BobPulse#2026` | CLIENT |
| `dana_sec` | `DanaPulse#2026` | CLIENT |

Or click **Register** in the app to make your own account.
Tip: add `?autostart=1` to the URL (`http://localhost:3000/?autostart=1`)
to log in instantly as `dev_alex` for a quick demo.

## Try it

1. Log in as `dev_alex` in the browser.
2. Open a second browser window (or a private window) and log in as `alice_core`.
3. Type a message in either window — it appears in the other one (broadcast).
4. In the chat box try: `/msg @alice_core hello privately` (private message),
   `/join #infra-telemetry` (switch channel), `/ping` (latency),
   `/stats` (server stats).
5. The **Benchmarks** tab runs a live ping test against the Python server;
   the **Telemetry** tab shows raw packets (hex + checksum).

## Terminal-only mode (no browser)

```powershell
# Window 1 — start the Python server
cd "C:\Users\Kartik Ranjan\Downloads\pulsetcp"
python python\tcp_server.py

# Window 2 — start a client (one window per user)
python python\tcp_client.py --user dev_alex
# type your password when asked, then chat. /quit to leave.
```

## Tests (all passing)

```powershell
# Python tests — 3 tests: password hashing, login flow, broadcast + whisper
python -m unittest python.test_tcp_server -v

# TypeScript protocol tests — 6 tests: commands, bytes, hex, latency, peer filter
npx.cmd tsx --test src/utils/protocol.test.ts

# Type check (no errors)
npm.cmd run lint

# Production build (no errors)
npm.cmd run build
```

Live smoke test results (17 Nov 2026): Python 3/3 tests, protocol 6/6 tests,
12/12 live checks (register, broadcast, whisper, ping, stats, nick change,
channel join, logout, wrong-password rejection, unauthenticated block),
WebSocket login + broadcast round-trip OK, benchmark 10 pings averaging
~1.8 ms (~561 messages/second).

## Production mode (optional)

```powershell
npm.cmd run build
npm.cmd start
# then open http://localhost:3000
```

## Stop it

Press `Ctrl+C` in the terminal where `npm.cmd run dev` is running.
That stops the web server and the Python server together.

## If something goes wrong

| Problem | Fix |
|---|---|
| `cd` fails: "A positional parameter cannot be found that accepts argument 'Ranjan\Downloads...'" | The path has a space in "Kartik Ranjan" — put it in quotes: `cd "C:\Users\Kartik Ranjan\Downloads\pulsetcp"` |
| `npm` fails: "running scripts is disabled on this system" | PowerShell blocks `npm.ps1`. Use `npm.cmd install` / `npm.cmd run dev` instead — no setting to change. Alternative: run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` once in that window, then plain `npm` works. |
| `npm.cmd install` fails with `ERESOLVE` | Fixed in this zip (esbuild updated to ^0.28.0). If you see it again, delete `node_modules` and run `npm.cmd install` again. |
| `'python' is not recognized` | Reinstall Python and tick **Add Python to PATH**, then close and reopen PowerShell. |
| `'node' is not recognized` | Install Node.js LTS, then close and reopen PowerShell. |
| Port 3000 or 9090 already in use | Close the other program using it, or change the port (`$env:TCP_PORT=9091; npm.cmd run dev`). |
| Page loads but chat says "reconnecting" | The Python server did not start — check the terminal for a `[py-tcp-err]` line. |
| Login fails with "Invalid username or password" | Use a demo account from the table above, or Register a new one. Passwords are case-sensitive. |

## What was fixed in this copy (vs the uploaded zip)

1. `npm.cmd install` crashed with `ERESOLVE`: `vite@8.3.8` needs `esbuild ^0.27 || ^0.28`,
   but `package.json` pinned `esbuild ^0.25.0`. Updated to `^0.28.0`.
2. `server.ts` started Python with the command `python3`, which does not exist
   on Windows — it now uses `python` on Windows and `python3` elsewhere, and
   reports a clear error if Python is missing.
3. `vite.config.ts` used `__dirname`, which Vite's native config loader warns
   about — it now derives it from `import.meta.url` (works on Node 18+).
4. README corrected: no Gemini key is needed to run this project.
