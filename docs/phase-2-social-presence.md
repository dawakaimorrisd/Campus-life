# Phase 2: Social presence

**Goal:** can I naturally approach another player?

## What was built
- **The real campus**: two floors, twelve zones, about 170 seats (see `campus-map.md`).
- **Sitting and standing**: tap a free seat (white rings show seats within reach) and you walk over and sit. Walking, following or pressing Stand up gets you out of it. Sitting avatars have their own pose.
- **Staircase**: walk onto the top steps to go up or down. Pathfinding understands stairs, so any "walk there" works across floors.
- **Nearby players**: the "what are people doing" state is visible on the avatar: sitting, eating (plate in hand), asking for help (hand marker), carrying a stolen plate (running marker).
- **Interaction panel**: tap a player to see what they are doing and the actions available. Actions that need you closer are disabled with a plain explanation. It is one small panel, not buttons around every avatar.
- **Hut roofs** fade as you stand under them so you can always see who is there.

## Rules enforced by the server
A seat has one owner (including someone still walking to it). You cannot reserve a seat on another floor or more than 480 px away. Leaving the game frees your seat.

## Not yet
Sound, "leaning" or "reading" poses, chair-moving, rain shelter behaviour.
