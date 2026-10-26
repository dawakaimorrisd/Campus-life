# Phase 6: Event engine

**Question:** does the campus notice when something interesting happens?

## What it does
`EventEngine` (apps/game-server/src/events.ts) watches the world once a second and announces things as `campus_event` messages: a toast plus a pulsing ring on the map for about 45 seconds. If the thing is off screen, an arrow at the screen edge points to it. If it happens right next to you, no toast (you already see it).

Events: a crowd gathering (4+ people), people eating together, a group sitting together for a while, a group splitting up, a stolen plate, music playing, people escaping class, someone being looked for, and Chichi buzz.

## Anti-spam rules
- Per-key cooldowns (a gathering at the same place does not repeat for 2 minutes).
- An 8 second global gap between events.
- Only high priority events (a theft, a mass escape) may skip the gap.
