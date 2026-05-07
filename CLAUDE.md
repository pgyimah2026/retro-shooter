# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step. Open the file directly in any browser:

```
retro-shooter/index.html
```

Or from the terminal:
```powershell
start retro-shooter/index.html
```

## Git & GitHub Workflow

**After every piece of work — no exceptions — commit and push to GitHub so no progress is ever lost.**

Remote: `https://github.com/pgyimah2026/retro-shooter` (branch `master`)

Rules:
1. Stage only the relevant files (never `git add -A` blindly)
2. Commit message format: short imperative subject line, then a blank line, then a brief body explaining *why* the change was made
3. Push immediately after every commit — never leave committed work unpushed
4. If multiple logical changes were made in one session, split them into separate commits before pushing

This applies to every task: feature additions, bug fixes, tweaks, and file additions alike. The goal is that the GitHub repo always reflects the current working state of the project.

## Architecture — `retro-shooter/index.html`

The entire game lives in one self-contained HTML file (~840 lines). All CSS, JS, and canvas markup are inline — no external dependencies, no modules, no bundler.

### Constants (top of `<script>`)
- `CONFIG` — canvas size, speeds, grid dimensions, Y-positions of key zones
- `C` — colour palette
- `SP` — all sprite data as 2D `0`/`1` arrays; rendered by `drawSprite(ctx, sprite, x, y, color, scale)`
- `SCORE_BY_ROW` — point values indexed by enemy row (row 0 = 30 pts, rows 3–4 = 10 pts)

### Class hierarchy

```
Game                  ← main controller; owns all state
├── Player            ← movement, shoot, explode/invincibility timer
├── EnemyGrid         ← 11×5 formation; marching, descent, enemy shooting
│   └── Enemy[]       ← individual alien; row determines sprite/colour/score
├── Bullet[]          ← shared class for both player (dy<0) and enemy (dy>0) bullets
├── Shield[]          ← 22×16 grid of 3×3 px cells; per-cell destruction
└── UFO               ← mystery ship; spawns every 25 s, crosses left→right
```

### Game loop
`requestAnimationFrame` → `Game._loop(ts)` → `_update(dt)` + `_render()` every frame. `dt` is capped at 50 ms to avoid spiral-of-death on tab resume.

### State machine
`MENU → PLAYING → LEVEL_COMPLETE → PLAYING (level++)` or `GAME_OVER → MENU`. State drives both update and render dispatch.

### Collision
All collision is AABB via `aabbOverlap(a, b)`. Pairs checked each frame: player bullets↔enemies, player bullets↔shields, enemy bullets↔player, enemy bullets↔shields, enemy bodies↔shields (destroys shield cells as formation descends into them).

### Level scaling (inside `EnemyGrid`)
- Step interval: `max(0.10, 0.80 − (level−1)×0.06)` seconds at full grid; scales further as enemies die
- Shoot interval: `max(0.40, 2.00 − (level−1)×0.15)` seconds
- Grid origin Y starts lower every 2 levels: `80 + floor((level−1)/2)×16`

### Sprite rendering
`drawSprite(ctx, sprite2dArray, x, y, color, scale=2)` — iterates the array and calls `ctx.fillRect` for each `1` bit. Scale 2 means each bit = 2×2 px block. No image files are used anywhere.

### Persistence
High score only, via `localStorage` key `siHigh`.
