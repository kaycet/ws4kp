# Starfall Spire

A pixel-art wizard idle game. Gather mana, summon familiars, weave spells, and ascend for Starsigils. Every week you can also race a seeded **Rift Trial** for relics that reshape your spire.

It is fully static: no runtime dependencies, no backend, and no binary assets. Sprites are palette-indexed ASCII rasterised to canvas, and every sound comes from a WebAudio synth.

## Play locally

```bash
npm ci
npm start            # http://localhost:8080 (zero-dependency static server)
```

## What makes it different

Starfall Spire has the familiar idle loop (12 summons, 158 upgrades, spells, wisps, Focus-charged Fireballs, 88 feats and a Starsigil prestige with a 14-node talent tree). Three systems are built on top of it:

- **Celestial Alignment: a shared sky.**
  - Every 4 minutes of real time the sky favours one of your summons, which produces ×3.
  - The pick is a hash of the wall-clock epoch, so every player is under the same sky at the same moment, with no server involved.
  - It shows as a constellation drawn in the scene and a countdown chip, and it rewards owning a spread of summons instead of stacking one.
- **Rift Trials: weekly, fair, competitive.**
  - One rift per ISO week (UTC). Each rift rolls two of eight **mutators**, such as *Glass Cannon* (casts ×10, production ×0.5) or *Arcane Flux* (alignments every minute at ×5).
  - A run is a 15-minute sprint in a **separate save**, with no talents or relics, so only skill counts.
  - The wisp stream, wisp blessings and alignments come from a seeded RNG, so every runner faces identical luck.
  - Your main spire keeps producing while you're in the rift. The rift clock is wall-clock and keeps running if you close the tab.
  - Rerun as often as you like; your best score counts.
- **Echo ladder: competition without a server.**
  - Nine rival "echoes" are bots that play the exact same seeded rift on the real engine, at graded skill levels. This is deterministic and takes about 0.1 s per rift.
  - Reward tiers are defined as *beating a named echo* (Bronze, Silver, Gold, Astral). Thresholds therefore calibrate themselves to each week's mutators, which can swing scores by 10⁴.
- **Relics.** Tiers pay out **Astral Shards**, once per tier per week, plus 1 for your first run of the week. Shards buy nine relics, and you equip up to three in your main spire. For example: *Star Compass* (aligned ×5), *Hourglass of Echoes* (Temporal Rift resets Arcane Surge), and *Phoenix Quill* (start each ascension with 5 minutes of production). Choosing a loadout is the long-term strategy layer.

## Look and feel

Everything is drawn at a native 320×180 and animated procedurally:

- **Ambient scene.** Drifting dithered clouds, shooting stars, fireflies, orb motes, a blinking wizard, and additive-blended particles for glow.
- **Feedback on actions.**
  - Casts send out a shockwave. Every ~25th cast is a **Lucky** ×5 crit with a big callout and screen shake; luck is keyed off the cast count, so it's deterministic in trials.
  - Buying a summon raises a pillar of light and a rune ring where it lives in the world. Upgrades ring the wizard in gold.
  - Fireballs arc across the sky and detonate with a shockwave.
- **Moments.**
  - Constellations are traced star by star when the sky aligns.
  - Pixel-font banners mark feats, alignments, relics and Rift tier milestones.
  - Ascending lifts the wizard into a pillar of starlight, and entering a Rift tears the sky open.
- **UI motion.**
  - The mana counter rolls up and pops on windfalls.
  - Purchases flash, ready spells glint, and a nearly full Focus meter smoulders.
  - The title shimmers.
- **Cost and accessibility.** All motion is stepped to read as pixel art. It holds 60 fps with a full scene and respects `prefers-reduced-motion` and the in-game *Reduced effects* toggle.

## Architecture

```
js/data.mjs     declarative content: summons, upgrades, spells, talents, feats, relics, mutators
js/engine.mjs   pure game logic (no DOM): rates, modifiers, alignment, seeded RNG, prestige, saves
js/rift.mjs     weekly trial generation, rewards, rival-echo simulation, leaderboard adapter
js/sprites.mjs  ASCII sprites, 3x5 pixel font, cached canvas/icon rasteriser
js/scene.mjs    320x180 canvas renderer (backdrop pre-rendered once)
js/ui.mjs       DOM panels; built once, patched in place
js/audio.mjs    WebAudio synth
js/main.mjs     loop, input, dual-save persistence, offline catch-up
scripts/        build (dist + single-file bundle) and local static server
```

Performance and cost choices:

- **Cached rates.** Multipliers fold into one cached rate table, invalidated only on purchases, talents, feats, relic swaps and alignment changes. Buffs apply on read.
- **Cheap rendering.** The scene renders at native 320×180 and CSS upscales it (`image-rendering: pixelated`). The UI patches the DOM at 10 Hz, only where values changed.
- **Wall-clock simulation.** Both saves advance by wall-clock time in bounded chunks, so hidden tabs and reloads catch up accurately.
- **Untrusted saves.** Saves go through `hydrate()`, which drops unknown ids, clamps numbers, strips markup from names, and validates trial and record shapes.
- **Small deploy.** The whole deploy is about 175 KB uncompressed, served from unprivileged nginx with a tight CSP.

### Toward real leaderboards

`LocalLeaderboard` in `js/rift.mjs` exposes two async methods, `submit(trialId, entry)` and `standings(trial, you)`. A server adapter can implement the same interface. Because trials are deterministic given the seed and the player's inputs, a server can **validate a score by replaying the input log**, the same way the echoes are simulated. That is the anti-cheat path once there is a backend. Cloud saves slot in at the same boundary.

## Development

```bash
npm test         # node:test suites for the engine and rift systems
npm run lint     # airbnb ESLint config
npm run build    # dist/ (site) + dist/starfall-spire.html (single self-contained file)
npm run check    # all of the above
```

CI (`.github/workflows/ci.yml`) runs lint, tests and build on every push and PR, and uploads `dist/` as an artifact.

## Deploy

```bash
docker build -t starfall-spire .
docker run --rm -p 8080:8080 starfall-spire
```

The image is a multi-stage build that ends on `nginx-unprivileged`, with `.mjs` MIME, gzip, security headers and revalidating cache headers. Alternatively, drop `dist/` on any static host, or upload `dist/starfall-spire.html` alone, for example to itch.io.

Saves live in `localStorage` (`starfall-spire-save-v1`, plus `starfall-spire-rift-v1` during a trial). The Tome tab exports and imports a portable text scroll.
