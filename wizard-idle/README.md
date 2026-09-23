# Starfall Spire

A pixel-art wizard idle game. Gather mana, summon familiars, weave spells, catch wisps, and ascend for Starsigils that make every future run stronger.

It is fully static: no build step, no runtime dependencies, no backend. All art is drawn from palette-indexed ASCII sprites and all audio is synthesised with WebAudio, so the only assets are the source files (about 125 KB uncompressed).

## Playing

| Where | URL |
| --- | --- |
| ws4kp server (`npm start`, dev or `DIST=1`) | `http://localhost:8080/wizard-idle/` |
| nginx static image (`Dockerfile`) | `/wizard-idle/` |
| Any static host | serve this directory as-is |

Opening `index.html` straight from disk will not work, because browsers block ES modules on `file://`. Serve the directory instead, for example with `python3 -m http.server`.

### Mechanics

- **Casting.** Click or tap the spire, or press Space/Enter on the scene. Casting by hand fills **Focus**. At 100% a **Fireball** fires for 30 seconds of production. Fireballs scale off unbuffed values, so they can't be multiplied by cast buffs.
- **Summons.** There are 12 generators, from Apprentice to Genesis Rune. Costs grow ×1.15 per purchase. You can buy ×1, ×10, ×100 or Max.
- **Upgrades.** There are 158:
  - Tier doublers at 1/5/25/50/100/150/200/250/300/400 owned.
  - Wands (flat cast multipliers, then +% of mana/sec).
  - Global multipliers.
  - Cross-summon synergies.
  - Spell, wisp and focus upgrades.
- **Spells** (hotkeys 1–4). Each one unlocks through progression:
  - Arcane Surge: production ×5.
  - Channel Frenzy: casts ×10.
  - Temporal Rift: 10 minutes of production, instantly.
  - Wisp Beacon: calls three wisps at once.
- **Wisps.** Golden sprites drift across the sky every 1–3 minutes. Catch one for a Mana Windfall, Wild Magic (production ×7 for 77s) or a Spell Storm (casts ×777 for 13s).
- **Feats.** There are 83 achievements, and each one adds +1% production permanently.
- **Starfall (prestige).** Ascending converts lifetime mana into Starsigils: `floor(cbrt(lifetime / 1e9))`.
  - Each Starsigil adds +2% production forever.
  - Starsigils are also the currency for a 14-node talent constellation with prerequisites. It includes Automancy (auto-casts), Spectral Steward (auto-summons the best-payback generator), Arcane Memory (keeps wands and spell upgrades), and offline-efficiency, cooldown and wisp perks.
  - Spending Starsigils never reduces the passive bonus.
- **Offline progress.** Summons keep producing while the game is closed, at 25% efficiency with an 8h cap. Lucid Dreaming improves both.

## Architecture

```
js/data.mjs     declarative content: summons, upgrades, spells, talents, feats
js/engine.mjs   pure game logic (no DOM), unit tested under node:test
js/sprites.mjs  ASCII sprites, 3x5 pixel font, cached canvas/icon rasteriser
js/scene.mjs    320x180 canvas renderer (backdrop pre-rendered once)
js/ui.mjs       DOM panels; build once, patch in place
js/audio.mjs    WebAudio synth for all sound effects
js/main.mjs     loop, input, persistence, offline catch-up
```

Performance choices:

- **Cached multipliers.** All multipliers fold into a single cached rate table, which is invalidated only on purchases, talents and feats. Buffs are applied on read.
- **Cheap rendering.** The scene renders at native 320×180 and CSS upscales it with `image-rendering: pixelated`. A frame is a few thousand `fillRect`s at most. The dithered sky, hills and tower are rasterised once.
- **Cheap UI refresh.** The UI refreshes at 10 Hz and heavy panels at 2 Hz. `setText`/`setClass` skip DOM writes when nothing changed.
- **Wall-clock simulation.** Throttled or hidden tabs catch up in bounded chunks, so the game never drifts or freezes.
- **Untrusted saves.** Saves go through `hydrate()`, which drops unknown ids, clamps numbers, and fills defaults, so old or tampered saves still load safely.

## Development

```bash
npm run test:wizard   # engine unit tests (node:test, zero deps)
npm run lint:wizard   # repo's airbnb ESLint config
```

Saves live in `localStorage` under `starfall-spire-save-v1`. The Tome tab can export them to a portable text scroll and import them back.
