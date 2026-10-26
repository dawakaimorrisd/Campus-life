# The campus map

> The ground layout was redesigned: see [3d-plan.md](3d-plan.md) for the plan view (gate at the bottom, main road to the Student Block, Admin Block and Palaver Hut either side, one coconut line, a side road, Back Palaver and Student Center behind the Student Block). Where numbers below disagree, `map.ts` and 3d-plan.md win.

Built from the design documents. 72 by 111 tiles of 32 px. The ground campus is rows 0 to 77;
the upstairs floor is a separate island from row 84 down. Source: `packages/shared/src/map.ts`.

## Ground floor

| Place | Notes |
|---|---|
| Entrance gate | Players spawn here. A teal WELCOME / BCC / ENTRANCE banner. Blue car behind a hedge, motorcycle on the dirt road |
| Administrative Block | One story. A hallway along the south and one Administrative Hall with a reception counter (the Administrator stands behind it). The hall's chairs are pulled down around tables; spare chairs are stacked by the wall. There are no department offices |
| Student Block, Student Hall | Two entrance doors. Chairs with writing tablets in rows facing a whiteboard. A door on the east side leads to the staircase room |
| Staircase | Walk onto the top steps to go up. Straight, steep, white handrails |
| Student Center | Separate building with a red roof edge, scattered tables and chairs, wrappers on the floor, a counter, and the yellow front-end loader outside |
| Palaver Hut | Open-air pavilion with a conical roof, teal pillars and a ring of concrete benches. The roof fades when you stand under it |
| Back Palaver | A larger open-air eating area with a serving stall on its north edge and tables under the roof |

## Upstairs (Student Block)

Reached by the staircase in the Student Hall. A long corridor (dark grey concrete strip, a small
table, a red bucket) divides the floor. North: College of Criminal Justice, College of Nursing and
Midwifery, College of Business and Public Administration. South, opposite: the Library, College of
Agriculture, College of Education. Each college has chairs in rows facing a whiteboard and an instructor.

## Interaction objects

- **Seats** (about 170): benches, chairs, desks, table sides, derived from furniture so they always match what is drawn.
- **Food stall**: stand within about 1.75 tiles of the Back Palaver counter to buy a plate.
- **Staircase portals**: 4 steps down to up, 3 up to down.

## Zones

Zones drive the HUD label, muffled speech between indoors and outdoors, and invite destinations:
Administrative Hall, Admin Hallway, Student Hall, Staircase, Student Center,
Upstairs Hallway, the five Colleges, Library, Palaver Hut, Back Palaver.

## Changing the map

Edit `buildCampusMap()` and both client and server pick it up. Run the reachability checks in
`testing.md` afterwards: every zone, seat and the food counter must be reachable from the gate.


## Spots (Phase 7)

Food counter (10 LD), music at the Student Center (15 LD), moto by the gate (5 LD), shelve books in the Library, stack chairs in the Admin block. Stand within 56 px and the action button appears.

## New places (Phases E to H)
- **Sprint Track:** tiles x3..18, y13..20 (zone `sprint_track`), start line x3..4, flag at x17. **Carousel:** tiles x8..11, y9..12.
- **Library spots:** Study at the tables (row 104), Read a book (row 101, east half), Shelve books (row 101, west half).
- **Lecture Area:** north-east, tiles x60..70, y6..19 (zone `lecture_area`): lectern, whiteboard, benches.
- **Marketplace and Jobs Board:** the Jobs kiosk is at tiles x19..28, y36..39 with a Jobs Clerk. The stall: west of the Student Block, a striped stall (tiles x6..15, y36..38), market road along y43..45 from the Student Hall apron. Zone `marketplace`.
- **Recreation Ground:** north-west, pitch x4..23, y22..32 with goals at both ends (goal mouth rows 25 to 29). Zone `recreation`. The shared ball starts at (14, 27.5).
- **Social Ground:** east of the coconut palms, x61..69, y28..49, benches around a shade tree. Zone `social_ground`.
- **Jobs board:** cork board on the west wall of the Student Hall (x31, y29..33).
- **NPCs added:** Market Seller (the prefect was removed later).
- **Student Center dance floor:** x45..52, y6..13. Eight NPC party-goers stand on it during the party (hidden otherwise). Street lamps stand along the roads and glow at night.


## Games
Games desk with the Games Attendant at the Recreation Ground, sprint track with six lanes, carousel north of the track.
