# Phase 5: Group behaviour

**Question:** does social gravity exist?

## What it does
- The server groups players into clusters every second (union-find, players within 120 px on the same floor are linked).
- Clusters of 3 or more are broadcast as `groups` (position rounded, size, kind: chat, eating, walking, study). The client draws a soft glow under them: yellow for chat, orange for eating, blue for studying, white for walking together.
- Bigger groups get a bigger glow, so a crowd is visible from a distance and pulls people in.
- **Invite all nearby** (player panel) sends one invite to everyone within about 10 tiles, up to 8 people. Replies come back per person, quietly, so nobody is spammed.

## Not included
No group chat channels, no group roles, no leader. A group is only what the server sees.

## Try it
Walk 3 people (or bots) together and stand still. A glow should appear. Use Invite all nearby to Back Palaver.
