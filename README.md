# CANE — North Queensland Sugarcane Empire

An incremental/management game. Plant cane, grow it, harvest it, haul it to the mill, crush it into sugar, sell it. Money buys upgrades. Upgrades move numbers. Numbers go up.

## Play it

Open `index.html` in any browser — it's fully self-contained (no server, no CDN, no internet required after the initial load).

**On iPhone:** open in Safari → Share → Add to Home Screen. Launches fullscreen.

## The pipeline

```
paddock (grow) → harvest → bins (siding) → trucks → mill yard → crush → sugar → sell
```

Each arrow is a bottleneck. Bins full = harvest stops. Mill yard full = trucks stop. The game is clearing each jam while building toward the next one.

## Progression

| Track | What it does |
|-------|-------------|
| **Growing** | More hectares, faster growth cycles, higher yield per ha |
| **Harvesting** | Harvester fleet (auto), better choppers, manual knife tap |
| **Haulage** | Trucks (auto), siding bin capacity, rail siding (big multiplier) |
| **Milling** | Crushing rate, CCS % (sugar per tonne), mill yard capacity |
| **Market** | Sugar price via the marketing co-op |

Two automation buildings: **Planting contractor** (auto-replants ratoons) and **Forward contract** (auto-sells sugar — essential before closing the tab).

## Prestige

Once you've earned $50k lifetime, the **Co-op** tab lets you sell the farm. You keep **mill shares** — each one gives a permanent +10% to everything. The farm resets; the shares don't. Runs compound.

## Save

Autosaves to `localStorage` every 3 seconds. Coming back after time away triggers an offline catch-up (up to 8 hours).

## Rebuild

Single-file React component: `CaneGame.jsx`

```sh
npm install
# build Tailwind CSS from source + esbuild bundle + assemble index.html
./node_modules/.bin/tailwindcss -c tailwind.config.js -i tw.css -o game.css --minify && \
npx esbuild entry.jsx --bundle --minify --loader:.jsx=jsx \
  --define:process.env.NODE_ENV='"production"' --outfile=bundle.js
# then inline into index.html (see build script or do it manually)
```
