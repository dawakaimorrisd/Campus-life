# The campus economy

All amounts are in LD. Everyone starts with 100 LD. The server is the only place money changes.

## Ways to earn
| Source | Pay | Notes |
|---|---|---|
| Work spots (Library shelves, Admin chairs) | 8 | 8 seconds of standing still, 45 s cooldown per spot |
| Helping someone with an assignment | 15 | pair cooldown 5 minutes |
| Attending a class | 8 (4 if late) | be in a classroom for half the lesson; four lessons a day |
| Campus work errand | 12 to 25 | a delivery against a time limit, one student per errand |
| Jobs Board job | 10 to 60, set by the poster | paid by another student, not created by the game; held until accepted, refunded if not done |
| Class extras | +3 home college room, +2 Dean's List, +2 cheerful instructor | on top of 8 LD attendance |
| Assignment (Library study) | 10 (15 on Inspired days) | 3 LD for a study session without one; reading a book 4 |
| Sprint race | 12 winner, 3 other finishers | free to enter |
| Carousel | costs 2, pays 3 back when you ride with company | |
| Giving a lecture | 4 per listener (max 6) + 2 per clap (max 6) | listeners are paid 3; 2.5 min cooldown |
| Asking / answering a question in a lecture | 2 / 3 | answer within 30 s |
| Scoring a goal | 5 | once per 20 seconds per player |
| Good company, stories, jokes, meeting new friends, passing the night | 1 to 30 | see `day-cycle.md` |
| Free-time specials | x2 on errands, goals or social pay | 90 seconds, announced to everyone |
| Performing on stage | package price back plus 5 per cheer (up to 12 cheers) | a good crowd means a profit |
| Gifts from friends | any | the Give button |

## Fines
| A guard catches a thief with a stolen plate | 10 LD to the victim |

## Ways to spend
| Sink | Cost |
|---|---|
| A plate at the Back Palaver | 10 |
| Moto ride | 5 |
| Playing the snack-counter music | 15 |
| Event night entry | 30 (or try sneaking in, 35% chance, 20 s lockout) |
| Singer package | 45 |
| Dancer package | 35 |
| Energy drink | 8 |
| Glow bracelet | 10 |
| Lucky charm | 15 |

## Tuning
Constants live in `packages/shared/src/constants.ts` (older features), `night.ts` (event nights) and `life.ts`
(classes, jobs, market, ball, weather). Server switches: `ENTRY_FEE`, `PARTY`, `PARTY_ON_MIN`, `PARTY_OFF_MIN`,
`CLOCK=off`, `CLOCK_SCALE`, `CLOCK_START`, `WEATHER=auto|clear|rain`.

A rough day: four classes (about 30), two free-time windows of errands, goals and company (100 to 200), and then the
party: entry 30, perhaps a stage package, and a dawn bonus for passing the night. At dawn the game shows how much
you earned yesterday. If testing shows money piles up or runs dry, change the numbers above, not the code.


## Phase L pay
Quiz right answer 3 LD (first +2); true/false 1 LD (3 in a row +2); football goal 4, win 8, draw 3, lose 2; race win 12, finish 3; carousel fare 2, company bonus 3; promotion 25/year, graduation 150.
