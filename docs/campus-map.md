# The campus map

Built from the design documents. 72 by 111 tiles of 32 px. The ground campus is rows 0 to 63;
the upstairs floor is a separate island from row 84 down. Source: `packages/shared/src/map.ts`.

## Ground floor

| Place | Notes |
|---|---|
| Entrance gate | Players spawn here. A teal WELCOME / BCC / ENTRANCE banner. Blue car behind a hedge, motorcycle on the dirt road |
| Administrative Block | One story. A long hallway along the south (notices, DEPT OF AGRICULTURE plaque), the Dept of Agriculture office (west) and the Administrative Hall (east). The hall's chairs are pulled down around tables; spare chairs are stacked by the office wall |
| Student Block, Student Hall | Two entrance doors. Chairs with writing tablets in rows facing a whiteboard. A door on the east side leads to the staircase room |
| Staircase | Walk onto the top steps to go up. Straight, steep, white handrails |
| Student Center | Separate building with a red roof edge, scattered tables and chairs, wrappers on the floor, a counter, and the yellow front-end loader outside |
| Palaver Hut | Open-air pavilion with a conical roof, teal pillars and a ring of concrete benches. The roof fades when you stand under it |
| Back Palaver | A larger open-air eating area with a serving stall on its north edge and tables under the roof |

## Upstairs (Student Block)

Reached by the staircase in the Student Hall. A long corridor (dark grey concrete strip, a small
table, a red bucket) with Classroom 1 and Classroom 2 to the north (same room template as the
Student Hall) and the Library to the south (shelves, tables, quieter).

## Interaction objects

- **Seats** (about 170): benches, chairs, desks, table sides, derived from furniture so they always match what is drawn.
- **Food stall**: stand within about 1.75 tiles of the Back Palaver counter to buy a plate.
- **Staircase portals**: 4 steps down to up, 3 up to down.

## Zones

Zones drive the HUD label, muffled speech between indoors and outdoors, and invite destinations:
Dept of Agriculture, Administrative Hall, Admin Hallway, Student Hall, Staircase, Student Center,
Classroom 1, Classroom 2, Upstairs Corridor, Library, Palaver Hut, Back Palaver.

## Changing the map

Edit `buildCampusMap()` and both client and server pick it up. Run the reachability checks in
`testing.md` afterwards: every zone, seat and the food counter must be reachable from the gate.


## Spots (Phase 7)

Food counter (10 LD), music at the Student Center (15 LD), moto by the gate (5 LD), shelve books in the Library, stack chairs in the Admin block. Stand within 56 px and the action button appears.
