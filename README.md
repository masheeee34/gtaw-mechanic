# GTAW Mechanic

Standalone mechanic job for FiveM: vehicle diagnostics, interactive repairs, garage stock and repair history. No framework required.

- **NUI** in React + TypeScript, styled after the GTA World UI. All player-facing text is in French.
- **Client** in JavaScript: does every check and computation it can, to keep the server light.
- **Server** in C# with Entity Framework Core and Pomelo (MySQL): owns permissions, stock and history.

## Features

- **No command needed**: walking up to a car inside a garage shows `[E] Inspecter le véhicule` (mechanics only), a GTAW-style prompt drawn by the NUI like every key prompt of the job. F7 or `/mecano` also work.
- **3D diagnostic**: the mechanic takes out a tablet, then the camera goes close to the worst parts one by one, while each spot appears on the car, and comes back to the whole car before the menu slides in on the right. It reads the vehicle's real state (engine, fuel tank, bodywork and doors, windows, each tire), with a health bar and status per part. Parts the model does not have, like the side wheels of a bike, are skipped.
- **3D view of the car**, while the menu is open:
  - a marker on the car itself for each part, and one for each broken window, damaged door and dent, placed on the model's bones. Dents come from the game's own deformation, probed around the body, light or heavy;
  - click a marker (or a part in the list, or a repair in the history) to move the camera onto it and see its detail: health, the game's raw readings (engine temperature and oil, fuel), the part needed and « Lancer la réparation »;
  - drag to turn around the car and raise the camera, mouse wheel to zoom, `← →` to turn, `Échap` back to the whole car;
  - « Transparence » makes the bodywork see-through, for the mechanic only;
  - the advised repair order: what can catch fire or stop the car first, then safety, then looks. The menu shows the first repair with its reason, and every part to repair has its step number, in the list and on the car;
  - notes pinned on a spot of the car (« Rayure portière AVD, déjà présente »), kept per plate in the database and shown at the same spot to the next mechanic.
- **The player does the job, in the world**:
  1. "Réparer" in the menu closes it and sends the mechanic to the garage's parts rack (marker on the ground).
  2. `[E]` takes the part: the mechanic bends down to pick it up, then carries it in both hands (a tire, a box of engine parts, a car door, a jerry can… set per item in `config.json`). No sprinting, jumping or getting into a car while carrying.
  3. A marker shows where to install it on the car (the right wheel, the hood, the fuel cap…). `[E]` there turns the mechanic to the part, opens the hood if needed, plays the work animation and starts the mini-game. A tire takes two: the nuts are loosened and the old wheel comes off and lies on the floor (every player around sees the car without it, and the server gives the wheel back if the mechanic disconnects), then the new wheel goes on and the nuts are tightened.
     - **Skill check**: stop the needle inside the zone. The zone shrinks and the needle speeds up each round.
     - **Lug nuts**: tighten the nuts in a star pattern, like a real wheel. Any first nut and either direction are accepted, with a time limit and a mistake budget.
     - **Wire connect**: each wire has a colour, the same colours are shuffled on the other side: connect every pair before the time runs out, with two mistakes allowed.
     - **Pressure gauge**: the pressure leaks and each pump pushes it up. Keep the needle in the green zone long enough; too much pressure bursts the line, an empty gauge fails.
  4. How well the mini-game went sets how well the part is repaired: a careful job restores it completely, a rushed one leaves it at 85 % (and the /ame says so). Fail it and the part goes back in your hands to retry at the car. `[Backspace]` gives up at any time (not X: GTAW uses X for its interaction wheel) and puts the part back on the shelf.
- **Grease**: each repair leaves the mechanic a little dirtier, on hands and clothes, visible to every player, until they wash at the garage's workbench (`[E] Se laver les mains`).
- **/ame (written roleplay)**: each action shows `* Name action` above the mechanic's head for players within 20 m, in French and in the /ame colour: the tablet diagnostic, taking a part, starting the work, taking a wheel off and fitting the new one, finishing (or rushing it), failing, putting a part back. The server only relays an action id and a part id (validated, rate-limited); every client writes the text itself, so nobody can make another player display free text.
- **Garage stock**: taking a part consumes the garage's stock, stored in MySQL. Abandoned or unused parts go back on the shelf, including when the player disconnects or the resource restarts. Admins restock with a command.
- **Repair history** per plate, across garages.
- **Search** across parts, stock and history, by name, description or category.

## How it works

```
 [E] near a car in a garage (prompt only shown to mechanics: checkAccess once per session)
        │
 CLIENT (JS)  tablet scan animation ──────────────┐ in parallel
        │  openSession(garageId, vehicleNetId)    │
 SERVER (C#)  ACE, player in garage, vehicle close, reads the plate → stock + history
        │                                         │
 CLIENT       diagnoses each part from the natives, opens the menu (NUI)
        │
 NUI          "Réparer" → menu hides, the job starts in the world
        │
 CLIENT       marker at the rack → [E] → takePart(garageId, partId)
 SERVER       ACE, player at the rack, one part per player → takes it off the stock
        │
 CLIENT       carry animation + prop → marker at the part → [E] → work animation + mini-game
        │  repair(garageId, vehicleNetId, partId)
 SERVER       ACE, position, the player really holds that part → logs the repair
        │  ok
 CLIENT       only now fixes the vehicle, then the menu comes back
```

Design choices:

- **Client-first.** Prompts, markers, zone checks, diagnostics, labels, animations, props and mini-games all run on the client. The per-frame loop only exists while there is a prompt or a job to show. The server is only asked for what a client cannot be trusted with: one round trip to open the menu, one to take the part, one to log the repair. No tick on the server.
- **The server re-validates everything** it is sent: permission, position (in the garage, at the rack, next to the car), and which part the player holds. It reads the plate itself instead of trusting the client, since the plate keys the history.
- **Parts in hand.** The server remembers the part each player took (`PartsInHand`). A repair can only be logged for a part actually held, a player can only hold one at a time, and an abandoned or orphaned part (disconnect) goes back on the shelf.
- **Concurrency.** Stock quantity is an EF Core concurrency token, so two mechanics cannot both take the last tire.
- **Bodywork.** GTA can only restore doors and deformation with `SetVehicleFixed`, which repairs everything. The client snapshots the other parts and breaks them again, so only the bodywork changes.
- **EF Core 3.1 + Pomelo 3.2.7.** FXServer runs C# on Mono, which loads .NET Standard 2.0 assemblies. Newer EF Core and Pomelo versions need .NET 6+, so 3.1 is the newest that fits.
- **Testable server.** `GtawMechanic.Core` has no FiveM dependency: the config, the EF model and the stock and history logic are tested on plain .NET against SQLite. `GtawMechanic.Server` is the thin FiveM layer.

## Project layout

```
config.json                 garages, items, parts, mini-games (read by client and server)
fxmanifest.lua
sql/install.sql             tables, created on server start
client/src/                 JS client, bundled with esbuild into client/dist/client.js
  main.js                   prompt, inspection, repair job, NUI callbacks
  job.js                    repair job stages and objectives (pure)
  diagnostics.js            vehicle state → per-part diagnosis (pure)
  props.js, assets.js       carried props and tablet, model and animation loading
  world.js                  ground markers, /ame text, keys
  camera.js, view.js        3D view: scripted camera, spots projected on the car (view.js is pure)
  wheels.js                 tire change: wheel off and on (list kept by the server), loose wheels on the floor
  grime.js                  grease on the mechanic (state bag), washing
  emotes.js                 French /ame lines (pure)
  vehicle.js                natives: read state, apply repairs
  animation.js, approach.js walking to the part, animations
  rpc.js, nui.js            request/response over net events, NUI messages and callbacks
  config.js, zones.js       config.json validation, garage zones (pure)
  messages.js               French error messages
web/src/                    React NUI, built with Vite into web/dist
  minigames/                skill check, lug nuts, wire connect, pressure gauge (pure rules + components)
  views/                    Diagnostics, Stock, History, scan and repair overlays
  components/               side panel, markers on the real car, key prompt, notifications
server/
  GtawMechanic.Core/        config, EF Core model, MechanicService (stock, history, notes), /ame and rate limits (netstandard2.0)
  GtawMechanic.Server/      BaseScript: events, access checks, restock command (net472)
  GtawMechanic.Tests/       xUnit tests
```

## Requirements

- FXServer with **OneSync** enabled
- MySQL or MariaDB
- To build: Node.js 20+ and the .NET SDK 8+

## Usage

- **F7** (rebindable in the game's key bindings) or `/mecano`, next to a vehicle, inside a garage.
- `mecano_restock <garage> <item> <amount>`: adds parts to a garage (console or admin).

## Configuration

Everything lives in `config.json`:

| Key | Purpose |
|---|---|
| `permission` | ACE permission a mechanic needs (`gtaw.mechanic`) |
| `interactionDistance` | Max distance to the vehicle, in meters |
| `historyLimit` | Repairs shown per plate |
| `thresholds` | Health limits for the *good* and *worn* statuses |
| `garages` | Zones where the menu works: id, label, center, radius |
| `items` | Parts the garages stock |
| `startingStock` | Quantity each garage starts with, per item |
| `parts` | What can be repaired: type, item and quantity used, animation, mini-game settings |

Both sides validate the file on start and fail with a readable message if it is wrong.

The MySQL connection string comes from the `gtaw_mechanic_db` convar. On start, the server creates its three tables (`mechanic_stock`, `mechanic_repairs`, `mechanic_notes`) from `sql/install.sql` and gives every garage its starting stock.

## Development

```bash
npm run dev:web        # NUI in the browser with demo data and hot reload, no game needed
npm run watch          # rebuild the client and the NUI on save, then `restart gtaw-mechanic` in the server console
npm run build:server   # rebuild the C# server after a change, then `restart gtaw-mechanic`
npm run typecheck      # TypeScript, plus the JS client checked against @citizenfx/client natives
npm test               # Vitest (client + NUI) and xUnit (server)
```

What the tests cover:

- **Client (Vitest)**: diagnostics for every part type, garage zones, the request/response layer (timeouts, concurrent requests, bad payloads), config validation, where the mechanic stands for each part, the 3D view's spots (windows, doors, dents) and camera poses, engine readings, the tire change stages, repair quality, /ame texts, wheel numbering, grease levels.
- **NUI (Vitest + Testing Library)**: the rules, components and quality of the four mini-games, the diagnostics view and advised order, the markers and notes on the car, the key prompt, notifications, and full flows through the app: a tire repair from click to updated diagnosis, errors, search, closing.
- **Server (xUnit + SQLite)**: config parsing, starting stock, repairs consuming the right garage's stock, out-of-stock, history order and limit, restock, /ame validation and rate limit, pinned notes (length, position, limit per vehicle, deletion on the right plate), connection string checks, and a check that `sql/install.sql` matches the EF Core model.
- **Server against a real MySQL/MariaDB (opt-in)**: the same path as in game (Pomelo, `sql/install.sql`, `MechanicService`), including four mechanics racing for the last tire. Point `GTAW_MECHANIC_TEST_DB` at a disposable database to run them; they are skipped otherwise:
  ```bash
  GTAW_MECHANIC_TEST_DB="Server=127.0.0.1;Database=gtaw_test;User=gtaw;Password=...;" npm run test:server
  ```

## Security note

Pomelo 3.2.7 pins MySqlConnector 0.69, which can leak the database password to a man-in-the-middle when `SslMode` is `VerifyCA` or `VerifyFull` without `SslCa` ([GHSA-473q-m89c-ghf8](https://github.com/advisories/GHSA-473q-m89c-ghf8)). The fix only exists in MySqlConnector 2.6.1, which no Pomelo version loadable by FXServer accepts. The server refuses that connection string setup at startup instead (`ConnectionStringCheck`), and the advisory is suppressed in the NuGet audit with that justification.
