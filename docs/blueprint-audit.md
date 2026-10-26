# Blueprint audit: what is built and what is not

This compares the blueprint (the 33-section plan we discussed) with the code. "Built" means it exists and passes the server and UI test harnesses. **Nothing has been run in a real browser or on a phone yet.** I wrote this from my notes of the blueprint; if you remember something we discussed that is not on this list, tell me and I will add it.

## Built

| Area | Status | Where |
|---|---|---|
| Campus map, buildings, two floors, stairs, roads | Built | `campus-map.md` |
| Walking, camera, walk pad, tap-to-walk, overview map | Built | `3d-renderer.md` |
| Social presence, talk, whispers, emotes, invites, follow, join in | Built | phases 2 to 4 |
| Group behaviour (social gravity) | Built | phase 5 |
| Event engine and campus buzz | Built | phase 6 |
| Money, food, gifts, work spots | Built | `economy.md` |
| Mischief (steal, prank, sneaking, guards) | Built | phase 8 |
| Social memory ("known for") | Built | phase 9 |
| Chichi culture | Built | phase 10 |
| Student Center, DJ, six tracks, event nights, entry fee, gate guard, stage slots | Built | `3d-plan.md` B to D |
| Classes: bell, attendance, instructors speaking | Built | phase E |
| Campus day: one clock, free time, dusk, party, bedtime, dawn | Built | `day-cycle.md` |
| Day/night sky, weather, sound | Built | `3d-renderer.md` |
| Recreation Ground (football), Social Ground | Built | phase G |
| Marketplace stall (drink, bracelet, charm) | Built | `economy.md` |
| **Campus Jobs Board** (blueprint section 9): students post paid jobs, others claim, money held until accepted | **Built now** | `jobs-and-lectures.md` |
| Computer errands (deliveries) | Built, now the "Campus work" tab | `jobs-and-lectures.md` |
| **Lecture / presentation area** with lectern, whiteboard, benches, listeners and questions | **Built now** | `jobs-and-lectures.md` |

## Built since the first audit (Phase K)
| Area | Status |
|---|---|
| College choice, GPA and standing | Built (see `academics-security-grounds.md`) |
| Instructor moods and assignments | Built |
| Schedule reminders and the today's-classes card | Built |
| Patrol guards, sight and incidents | Built |
| Library study, reading and quiet zone | Built |
| Sprint Track race and Carousel | Built |
| NPC performer routines (dance changes, wandering party-goers, House Singer) | Built |

## Dropped by your decision
- The prefect (NPC and election)
- Real accounts and sign-in, real photo textures, profanity filter and blocking, upstairs bots

## Still open (honest list)
- Nothing has run in a real browser or on a phone yet.
- Guards cannot chase: a catch is instant. There is no incident report screen, only campus news.
- Instructors are still scenery that speaks; they have no walking routines.
- The race has no lanes enforcement (no false-start penalty).
- Grades only come from class and assignments; there is no graduation or year progression.


## Update
Guards accepted, no incident screen. Remaining open: nothing run in a real browser, music never heard, textures procedural.
