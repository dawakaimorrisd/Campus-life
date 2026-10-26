# Campus Life 3D: full plan and build phases

This revisits the Full Game Design Blueprint and splits what is left into build phases. Each phase ends with something you can play and test.

The one rule behind all of it: **people + place + simple verbs + time + spontaneous events = stories.** Every phase must make the campus feel more alive, not just look nicer.

## The campus (what is true now)

Walking in from the BCC gate at the bottom, going up (north):

```
        [Back Palaver] ---- road ----> [Student Center]        (both BEHIND the Student Block)
              |                         
        back road ---------------------------+
                                             |
        [ STUDENT BLOCK ]  Student Hall doors|   side road
              ^   (main road leads straight to its doors)       |
              |                                                 |
 [Admin Block] | main     [Palaver Hut]   | coconut | side      |
 (a bit ahead) | entrance  + concrete     | trees   | road      |
               | road      benches        | (one line)         |
               +------ cross road --------------------------+
            [Security post]  GATE  [Security guards]   "WELCOME / BCC / ENTRANCE"
```

- **Main entrance road:** from the gate straight to the Student Block's doors. The **Administrative Block** is on its west side and sits a little ahead (further up) of the **Palaver Hut** on its east side.
- **Palaver Hut:** in the middle between the main road and the coconut trees, with **concrete benches** around it and along the trees.
- **Coconut trees:** one straight line, east of the hut. They run from the gate up toward the Student Block. Nothing else: the campus is clean and open.
- **Side road:** beyond the coconut trees, heading straight up. It turns along the back of the Student Block and reaches the **Back Palaver**. From there a road leads to the **Student Center**, so both are "beyond" the Student Block.
- **Security:** two guards stand at the gate posts next to a security booth, by the welcome sign.
- **No department offices.** The Dept of Agriculture is removed; the Administrative Block is one hall (with a reception counter and the Administrator) plus its hallway. College of Agriculture upstairs stays.
- **Student Block, ground floor:** Student Hall (rows of chairs with writing tablets, whiteboard, an Instructor), then the staircase through the interior door.
- **Student Block, upstairs:** the stairs arrive in a **hallway that divides the classes**. North: Criminal Justice, Nursing and Midwifery, Business and Public Administration. South, opposite: **Library**, Agriculture, Education. Chairs in rows facing a whiteboard, with an Instructor at each board (scenery now, real NPCs in Phase E).

## Additions I recommend (my own ideas, ranked by how much they drive the game)

1. **A campus bell and a daily rhythm** (Phase E): class bell rings, the campus empties toward classes, then floods back to the Palaver Hut and Center. This alone makes the world feel alive and gives everyone a shared clock.
2. **Notice boards** at the Student Hall and Admin hall (Phase F): classes cancelled, events tonight, jobs wanted. The world tells you where to go instead of a menu.
3. **Roadside sellers along the coconut line** (Phase F): a water and snack seller, a roasted-corn or pepper-soup stand. Cheap food on the way creates small stops and small stories.
4. **Motorbike taxi (okada) at the gate** (Phase G): pay to be dropped near the Center or Back Palaver, and a friend can ride along. Fun and a money sink.
5. **Gate security that matters** (Phase D and E): guards check people at event nights and watch for sneaking, and can be persuaded (blueprint section 7).
6. **Day, evening and night lighting** (Phase H): evening glow at the Palaver Hut, string lights and a bass-lit Student Center at night. The same campus feels different at different times.
7. **Weather**: rain makes puddles real and sends people under the Palaver Hut roof together. Rain is also a reason to crowd and talk.
8. **Photo spot** at the WELCOME sign and a "snap a picture together" action: easy way to remember friends (social memory).
9. **Friends list and "find friend" arrow**: tap a friend's name and an arrow points to where they are. Removes the "where is everyone" friction that kills social games on big maps.
10. **Gentle first-time guide**: a short walk with a campus senior NPC from the gate to the Palaver Hut so new students learn the verbs without a tutorial screen.

## People

- Players choose **Boy or Girl** on the welcome screen. Girls have a different build, a skirt, long hair and a ponytail tie. Older saved avatars load as boys.

## Moving without tapping every time

- **Walk pad** (bottom-left of the screen): hold and drag to walk in 8 directions, let go to stop. It is faint until touched so it does not clutter the view. It always follows the screen, even after you turn the camera.
- Still works: tap the ground to walk there, keyboard WASD / arrows, tap a seat to sit.
- Next ideas, only if testing shows they are needed: double-tap to run, "follow friend" button on a player's panel (already in the game).

## Phases

| Phase | What you get | Status |
|---|---|---|
| **A. Look and control** | 3D campus slice, open palm-lined roads, boy/girl avatars, walk pad, upstairs hallway with 5 colleges + Library, instructors at boards, plan | **Built (needs your phone test)** |
| **B. Student Center interior** | Stage, DJ booth, speakers, dance floor, audience area, food counter, seating, entrance guard post, string lights | **Built (needs your phone test)** |
| **C. DJ and music** | NPC DJ who picks a random party track every 15 seconds, music engine, NPC dancers, floor dancing, crowd energy | **Built (needs your phone test)** |
| **D. Event nights** | Schedule, announcement, entry fee, gate guard, singer/dancer packages and slots (blueprint section 33), closing | **Built (needs your phone test)** |
| **E. Classes come alive** | Instructors and administrators as real NPCs, class schedule, attendance, late entry, guards | **Built (needs your phone test)** |
| **F. Work and money** | Assignment jobs board, Marketplace, economy tuning | **Built (needs your phone test)** |
| **G. Grounds and navigation** | Social Ground, Recreation Ground, lecture/presentation area, overview-map travel | **Built (needs your phone test)** |
| **H. Polish** | Real photo textures, lighting and weather, ambience sounds, device performance pass | **Built, except real photo textures (see below)** |
| **I. The campus day** | One clock: classes, two 15 minute free times, dusk, party, bedtime, dawn; dancing, social rewards, night look | **Built (needs your phone test)** |

## Phase B: what is in the Student Center now

Inside (door on the west wall, facing the road from the Back Palaver):
- **Guard post** just inside the door: a table with a cash box, two rope posts with a velvet rope, a **Security** guard.
- **Dance floor** (8 by 8 tiles) in the middle. Grey and calm by day; in party mode the tiles flip between two colours on the beat.
- **Stage** against the east wall, raised 0.6 m, with a purple curtain, a lighting truss, lamps and a "STUDENT CENTER LIVE" banner. Not walkable yet (performers use it in Phase D).
- **DJ booth** beside the stage: two turntables, a mixer, a laptop, an LED equaliser panel. The **DJ** stands behind it in a closed-off pocket. Players cannot walk in.
- **Two tall PA speakers** with a glowing strip, and **three dancers** on the stage.
- **Snack counter** on the north wall, **tables, chairs and benches** on the south and west, **string lights** across the room.
- **Party mode** (preview now): press **P**, or open the game with `?party=1`. Lights pulse, spotlight beams sweep, the DJ and dancers dance. In Phase C the server's event switches this on and off, and the DJ's track picks the beat.

## Phase C: the DJ and the music (what is built)

- **The DJ is a server NPC** (`apps/game-server/src/dj.ts`). While the party is on, every **15 seconds** he picks a random track (never the same twice in a row) and shouts a line. One message tells every phone what to play and when it began, so everyone hears the same bar.
- **Six synthesised tracks** (`music.ts`): Afrobeat, Highlife, Hipco, Amapiano, Reggae, Gospel House. Nothing is downloaded and there are no rights issues. Each has its own tempo, drums, bass, chords and hook.
- **Sound controls:** the **♪** button (left side) opens a mute button and a volume slider; both are remembered. They only affect the party music, never chat or game sounds. Browsers keep sound off until you touch the page, so the "now playing" chip says "Tap anywhere to turn the sound on" first.
- **Loudness by place:** full inside the Student Center, a muffled leak through the walls when you are outside and close, silent when far away.
- **Now playing chip** at the top while you are near: track name and a 15-second progress bar.
- **Lights follow the DJ:** the floor, string lights and spotlights pulse on the track's own beat, in time across phones.
- **Crowd energy** (0 to 1) comes from how many people are in the room and how many are dancing. More energy means brighter beams; a full floor (0.6 and up) makes confetti fall; the DJ shouts when the floor is full and nudges when it is empty.
- **Floor dancing:** dancing counts toward crowd energy. Since Phase I you dance with a button or automatically on the dance floor, and the dance lasts until you move.
- **Party schedule (now, Phase I):** the party opens with the campus clock (phase *party*, 4 minutes, after dusk) and closes at bedtime. `PARTY=auto` (a repeating timer, `PARTY_ON_MIN` / `PARTY_OFF_MIN`), `always` and `off` still exist for testing. See [day-cycle.md](day-cycle.md).
- **Preview without a server:** press **P** or use `?party=1`; a pretend DJ runs locally.

## Phase D: event nights (what is built)

- **Cycle:** dusk (1 minute) is the **announcement** (campus notice, guard and DJ shout, event chip with the entry fee). The party then runs 4 minutes with a **last-dance warning for the final 30 seconds**; at bedtime the door is **closed** and the guard sends latecomers home.
- **The guard at the door:** while a night is on, anyone without a ticket who steps into the Student Center is stopped at the door and a card appears: **Pay the entry fee (30 LD)**, **Try to sneak in**, or **Not now**. The guard speaks a line over his head. People already inside when the doors open are not turned away.
- **Sneaking in:** 35% chance. If caught, the guard sends you back and you wait 20 seconds before trying again. It only works if your mischief setting is on.
- **Audience is free:** inside, watching, chatting and floor dancing cost nothing.
- **Stage packages:** tap the event chip to see **4 slots of 30 seconds** and book **Singer (45 LD)** or **Dancer (35 LD)**. You need a ticket and must be inside. One slot per person. If you are not inside when your turn comes you miss it, no refund.
- **On stage:** you are lifted onto the stage, can't walk off until your 30 seconds end, and the room's energy stays up. The DJ introduces you and thanks you.
- **Crowd pay:** you get your package price back plus **5 LD for every cheer** (clap, dance, laugh, wave from people inside, max 3 per person, up to 12 cheers). A good crowd turns a profit.
- **Tunable:** `ENTRY_FEE=0` removes the door fee entirely (default 30); `PARTY=clock|auto|always|off`. Prices and slot counts are in `packages/shared/src/night.ts`.
- **All server-checked** (`apps/game-server/src/night.ts`). A modified client can't walk past the guard, book without paying, or perform without a slot.
- **Known limits:** Performers are not given a mic or special animation beyond dancing. NPC dancers on stage are still scenery.

## Phase E: classes come alive (what is built)
- **A campus bell.** Lesson (75 s), bell, break (105 s), bell... Since Phase I the classes are slaved to the campus clock: four lessons a day, two before each free time. The chip at the top left shows the current phase and a countdown.
- **Attendance.** Be inside a classroom (Student Hall or any college room; not the Library) for at least half the lesson and you are marked present: **+8 LD**. Arrive after the first 15 seconds and you are **late: +4 LD**. Leave early and you get no mark. The server counts it.
- **Instructors lecture.** While class is on, instructors speak lines suited to their college (law, nursing, business, agriculture, education).
- **Class prefect:** removed by your decision. The bell alone starts and ends class.
- **Not yet built:** instructors walking between rooms, hands-up questions, guards sweeping for people skipping class. The existing "slip out of class" mischief still works.

## Phase F: work and money (what is built)
- **Correction:** the real Jobs Board (students post paid jobs for each other) was missing and is now built in Phase J. What is described next is the computer errand board, now the "Campus work" tab.
- **Errand board** on the west wall of the Student Hall. Three errands at a time, each a delivery to a place on campus with a time limit (60 to 100 seconds) and pay of **12 to 25 LD**. One student per errand; other students see who has taken it. Reach the place in time to be paid, run out of time and the errand goes back on the board. A purple chip shows your errand and time left (tap it to give it back).
- **Marketplace** (west of the Student Block, a striped stall with a seller): **Energy drink 8 LD** (walk faster 40 s), **Glow bracelet 10 LD** (you glow and your dancing counts double at parties, 3 min), **Lucky charm 15 LD** (better odds of sneaking past the guard, 5 min).
- **Money in and out** is in [economy.md](economy.md).

## Phase G: grounds and navigation (what is built)
- **Recreation Ground:** a small football pitch with goals, mown stripes and lines. **One shared ball** for everyone. Walk into it to dribble, or tap **Kick** (or press K) when you are close. A goal is announced to the campus, the scorer earns **5 LD** (once every 20 seconds), and the ball restarts at the centre.
- **Social Ground:** east of the coconut palms, benches around a big shade tree and a table. A place to sit and talk.
- **Campus map** (the 🗺 button, or M): tap a place and your student walks there by the normal roads and stairs. The Student Center pulses pink while a party or event night is on.
- **Lecture Area:** built later, see Phase J.

## Phase H: polish (what is built)
- **Day and night.** The sky follows the campus clock (Phase I): bright through classes and free time, a slow dusk, a moonlit night, dawn. Everyone sees the same hour. Inside buildings the lights stay readable at night. Windows and street lamps glow after dark.
- **Weather.** Clear, cloudy, then rain showers (60 to 100 seconds), shared by everyone and independent of the clock. Rain streaks follow the camera (fewer on weaker phones) and you hear rain on the roofs, quieter indoors.
- **Sounds:** a bell for class, rain, all on the same ♪ volume control and mute.
- **Performance:** rain and everything new scales with the phone's quality tier; the new places add about 1,500 triangles.
- **Not possible from here: real photo textures.** The three campus photos were never available as files in the build environment, so the textures are still drawn in code. To use the photos, put them in `apps/web/static/tex/` and I will map them onto walls, floor and grass in the next round.

## Student Center and DJ: detailed plan (Phases B, C, D)

### The room (Phase B)
- **Stage** at the far end, raised 0.6 m, with a back curtain, two tall speakers and a lighting truss.
- **DJ booth** at the stage's left: a table with a mixer and laptop, a light-up front panel, the DJ NPC standing behind it.
- **Dance floor** in front of the stage: a checker of coloured tiles that light up with the beat.
- **Audience area** behind the dance floor (benches and stools), and the **food counter** along the side wall so everyday food still works when there is no event.
- **Entrance guard post** just inside the door: a rope, a small table with a cash box, a **Guard NPC**.
- Lived-in details from the blueprint: wrappers on tables, a bucket, notices on the wall, bottles, bags on chairs, a worn banner reading the event name.
- Two modes, one room: **everyday mode** (bright, food and chat) and **event mode** (lights dim, coloured lights, haze, speakers pulse).

### The DJ and the music (Phase C)
- The **DJ is a server NPC.** While an event runs, every **15 seconds** the DJ picks a random track from the playlist (never the same one twice in a row) and announces it, e.g. "Hipco time!". Everyone hears the same track at the same moment.
- **Tracks are made in the game itself** (a small synthesiser in the browser: drums, bass, chords, melody), so there are no downloads and **no music rights problems**. Starter set of 6 styles: Afrobeat, Highlife, Hipco (Liberian hip hop beat), Amapiano-style groove, Reggae one-drop, Gospel-house. A real recording can replace any of them later.
- **Controls:** a volume slider and a mute button that do not affect chat or game sounds. Music gets quieter outside the building and loud inside. Mute is remembered.
- **DJ behaviour:** announces the next track, gives shout-outs ("Who is in the building?!"), reacts when the floor is full, takes a short break between sets.

### Making it lively (Phases C and D)
- **NPC dancers** on the stage with 3 to 4 routines that change with the track, so the stage is never empty.
- **Floor dancing:** any admitted student can dance with one tap, no payment and no timing game. Nearby dancers get a small "vibe" glow when they dance together.
- **Crowd energy:** a meter that rises with the number of people dancing. At thresholds the lights get brighter, confetti falls, the DJ shouts out the room. This is the shared "something is happening" feeling.
- **Reactions:** cheer, clap, whistle emotes that float above heads; the audience faces the stage but is never forced to.
- **Light show:** floor tiles, spotlights and string lights on the beat. All cheap effects, kept light for phones.
- **Outside the door:** the sound leaks out and a few people stand around, so the event is noticed from the road. An off-screen arrow points to the event for people far away (already built).
- **Stories to notice:** sneaking in past the guard, a friend group dancing in a circle, a performer's slot, someone stealing the last food as everyone dances.

### Event nights (Phase D, from blueprint section 33)
- 8 to 10 minute event with a five-minute headline set. Announcement, reminder, entry, music, closing warning, soft ending, no forced teleport.
- Three separate permissions: **entry fee** (pay the guard or try to talk past him), **audience** (watch, talk, floor dance, free), **stage** (singer or dancer package plus a reserved slot, 2 or 3 per event, 30 to 45 seconds each, server-checked).
- Clear prices and slot availability shown **before** payment.

## Principles for every phase
- Phone first: merged geometry, instancing, quality tiers, one pixel-ratio cap. Check fps with `?stats=1`.
- Server is the authority; the 3D view only draws.
- Lived-in, not just pretty: worn surfaces, bags, books, bottles, notices.
- Nothing mandatory: the game suggests, the student chooses.
- Test each phase before starting the next (see [testing.md](testing.md)).


## Phase I: the campus day (what is built)
- **One master clock** (`apps/game-server/src/clock.ts`, plan in `packages/shared/src/clock.ts`) drives classes, free time, party, bedtime, dawn and the sky. Order: class, break, class, break, **free 15 min**, class, break, class, break, **free 15 min**, dusk 1 min, party 4 min, bedtime 1 min, dawn 30 s. Class and break keep their old lengths (75 s and 105 s).
- **Free time:** do anything; earn LD by errands, football, stories, jokes, meeting people. A gold **special** (double errands, double goals, story-time bonus, market half price) appears every few minutes for 90 seconds.
- **Night:** a slow dusk, then a dark sky with glowing windows and street lamps. Dusk tells everyone to go to the Student Center. The party lasts 4 minutes, then bedtime (door closed, music off, group time pays 1.5x), then dawn.
- **Dancing fixed:** a Dance button, auto-dance on the dance floor, five styles, tempo from the music, eight NPC party-goers.
- **Social rewards** (`spirit.ts`): company, stories, jokes, waving at new people, passing the night, and a dawn recap of yesterday's earnings.
- **Removed:** the 2D Phaser fallback. Details and tables: [day-cycle.md](day-cycle.md).
- **Known limits:** nothing here has run in a real browser or on a phone yet. Performers still have no special animation; NPC revelers only dance in place.

## Phase J: Jobs Board and Lecture Area (what is built)
- **Campus Jobs Board** at the Marketplace kiosk (blueprint section 9): post, claim, hand in, accept, with the reward held in escrow. Auto-accept after 90 s, refund on expiry or cancel.
- **Lecture Area** with a lectern, whiteboard and benches: talks, listeners, clapping and questions, all paid.
- **Blueprint audit:** [blueprint-audit.md](blueprint-audit.md) lists what is built, partly built and not built.
- Details: [jobs-and-lectures.md](jobs-and-lectures.md).

## Phase K: academics, security, library, recreation (what is built)
Colleges and GPA, instructor moods, assignments, Library study, patrol guards with incidents, Sprint Track race, Carousel, performer routines. See [academics-security-grounds.md](academics-security-grounds.md).
