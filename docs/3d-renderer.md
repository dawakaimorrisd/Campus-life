# 3D renderer (vertical slice)

The campus is now drawn in realistic 3D with Three.js. The game server and `packages/shared` are unchanged: only `apps/web` has a new renderer. The old Phaser 2D renderer has been removed.

> **Status: written but not yet run.** It was built in a sandbox that could not install `three` (npm registry blocked). The world builder was executed in Node against a small three.js stand-in: it builds with no errors (about 63 meshes, 43 materials, ~49k triangles after removing the forest, no bad geometry), but nothing has been rendered on a screen or a phone yet. Expect tuning on first run.

## Phases E to H changes
- Files: `life-ui.ts` (class chip, jobs card, market card), `map-ui.ts` (campus map), `ball3d.ts` (football), `sky3d.ts` (day cycle, weather, rain). Server: `classes.ts`, `jobs.ts`, `market.ts`, `ball.ts`, `weather.ts`. Rules and tuning in `packages/shared/src/life.ts`. See [3d-plan.md](3d-plan.md) and [economy.md](economy.md).
- Keys: **K** kick, **M** map, **P** party preview, **Esc** close cards. URL tuning still works (`?sun=` and `?hemi=` set the daytime brightness; the day cycle scales from them).

## Phase D changes
- Event nights: announcement chip, door guard card (pay or sneak), stage booking card, performers on the stage, crowd cheers pay. UI is in `night-ui.ts`; rules are on the server in `night.ts`. See [3d-plan.md](3d-plan.md).

## Phase C changes
- NPC DJ on the server, six synthesised tracks, 15 second slots, volume and mute, now playing chip, crowd energy, confetti, DJ shouts. See [3d-plan.md](3d-plan.md).

## Phase B changes
- Student Center interior: stage, DJ booth, speakers, dance floor, guard post with rope, string lights (`venue3d.ts`), plus NPCs for the DJ, dancers and guard.
- Party-mode lighting preview (P key or `?party=1`).

## Phase A changes
- Open campus: no forest; coconut palms in straight lines along the main and left roads; low perimeter wall.
- Boy / girl avatars (`avatar.gender`, optional, default boy).
- Walk pad (hold and drag) bottom-left. Instructors / Administrator stand at the whiteboards.
- Fixed stale `classroom_a/b` zone names (server, shared, scene) so everything uses the five colleges and the upstairs hallway.
- See [3d-plan.md](3d-plan.md) for the phases.

## Run it
```
npm install        # adds three and refreshes package-lock.json (do NOT use npm ci yet)
npm run dev
```
Open `/play?stats=1` for an fps / draw-call overlay.

## URL options
| Param | Meaning |
|---|---|
| `?q=0/1/2` | Quality tier (pixel ratio 1 / 1.5 / 2; shadows only at 2). Auto-lowers if fps < 26 |
| `?sun= &hemi= &exp=` | Sun light, sky light, exposure (if it looks too dark/bright) |
| `?dist= &pitch=` | Camera distance and pitch |
| `?stats=1` | Show fps overlay |
| `?party=1` | Student Center party lights on (same as pressing **P** in the game) |

If WebGL is missing, or the 3D view fails to start, a short message asks the player to try another browser.

## How it works
- 1 tile = 1 metre. Game px / 32 = world metres (x, z).
- `geo.ts` builds merged geometry; `world3d.ts` builds the campus from `CAMPUS_MAP` (walls, doors, windows, roofs, huts, staircase, furniture, instanced chairs and trees); `avatar3d.ts` draws people; `Campus3D.ts` handles input, camera, overlays and all server messages.
- Camera: 3/4 follow, Q/E or the ⟲ ⟳ buttons turn in 90° steps (so WASD still matches the server's directions), pinch / wheel zoom.
- Walls, roofs and trees never hide you: a dithered see-through tube is cut between camera and player in the shader.
- Phone performance: merged static geometry, instancing, Lambert materials, blob shadows, quality tiers.
- Textures are generated in code (`textures.ts`). Replace a function body with a real photo texture to upgrade a surface.
- Style reference: the three campus photos (blue-banded cream walls, terracotta floors, barred windows, laterite paths, teal-pillared huts).

## Files
`Campus3D.ts` (scene, input, messages) · `world3d.ts` (campus, street lamps, window glow) · `avatar3d.ts` (people, five dance styles) · `venue3d.ts` (Student Center party lights) · `sky3d.ts` (hour from the campus clock, weather, rain) · `music.ts` (synthesised tracks, bell, rain) · `ball3d.ts` · `life-ui.ts` (clock chip, jobs, market) · `night-ui.ts` (door card, stage) · `map-ui.ts` (overview map) · `textures.ts`, `geo.ts`.

## Not built yet
Real photo textures (the photos were never available as files), more interior detail, fewer draw calls per avatar, and a real-browser tuning pass for lighting and phones.
