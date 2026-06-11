# Idle Formation

Idle Formation is a browser-based idle autobattler prototype. The game uses plain HTML, CSS, and JavaScript with spreadsheet-style CSV balance data, local browser saves, continuous combat rounds, unit synergies, item-slot upgrades, and prestige progression.

## Run locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://localhost:4173/
```

There is no build step and no runtime dependency install is required. The app is served as static files.

If `npm` is available, this is also wrapped as:

```sh
npm run start
```

## Test

```sh
node --test
```

The tests validate balance sheet loading, shop and trait behavior, continuous combat progression, item-slot logic, combat event records, and prestige reset math.

If `npm` is available, this is also wrapped as:

```sh
npm test
```

## Project layout

```text
balance/              CSV balance sheets for units, traits, items, levels, stages, economy, prestige, and offline rules
src/app.js            Browser UI, rendering, events, save/import/export controls, and combat animation hooks
src/balance.js        CSV parsing and balance normalization
src/game.js           Core game simulation, combat, economy, item slots, traits, progression, and prestige
src/storage.js        IndexedDB/localStorage save handling
test/                 Node test suite
index.html            Static app shell
styles.css            Browser UI styling
design.md             Game design document
autobattle.md         Autobattler design research notes
idlegame.md           Idle game design research notes
```

## Save data

Progress is stored locally in the browser using IndexedDB with a localStorage fallback. The app also supports manual save export and import from the top bar.

## Balance data

Progression math and content are intentionally externalized in `balance/*.csv` so gameplay values can be edited and tested without changing simulation code.

## License

No license has been selected yet.
