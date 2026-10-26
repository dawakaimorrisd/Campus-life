# Running and testing

## Run it (GitHub Codespaces)

```bash
cp .env.example .env     # once
npm install              # once
npm run db:up            # Postgres in Docker
npm run dev              # web on 5173, game server on 8080
```

Open the forwarded port 5173. If the page sits on "Connecting to campus", open the Ports tab,
right-click 8080, and set Port Visibility to Public (friends on their own phones need this too).

`npm run bots -- 12` adds 12 fake students who walk, sit, chat, eat and react.

## Test checklist for Phases 2 to 4

**Phase 2: presence**
- Walk to the Concrete benches around the Palaver Hut. White rings appear on free seats nearby. Tap one to sit; tap elsewhere or press a key to stand.
- Tap another player: a panel opens. Buttons that need you to be closer are disabled, with a hint.
- Walk up the staircase in the Student Hall. You arrive upstairs; the HUD label changes.

**Phase 3: talk**
- Press Enter, type, send. A bubble appears over your head and fades. People close by see it; people far away or on the other floor do not.
- "Say" opens quick phrases. "React" sends an emote.
- Tap a player, choose Whisper. Only you two see it.

**Phase 4: verbs**
- Invite someone to the Library. They get a card; if they accept they walk there, upstairs included.
- Follow someone through a door and up the stairs.
- Buy a plate at the Back Palaver (10 LD), sit, and watch yourself eat. Give it to someone instead.
- Ask for help; another player offers; stay together for 7 seconds. The helper earns 15 LD.
- Mischief: take someone's plate while they eat. They get a "chase them" notice and a "Take plate back" button. Turn mischief off on one device and check that it blocks both directions.

## Test checklist for Phases 5 to 10

**5 and 6: groups and events**
- Run `npm run bots -- 14`. Soft glows appear under clusters of 3+. Walk to one.
- Toasts appear ("a crowd is gathering at ..."), a pulsing ring marks the place, an arrow points to it when it is off screen. Events should not spam.
- Tap a player, choose Invite all nearby.

**7: money**
- Stand at the food counter, the Student Center music spot, the moto by the gate, the Library shelves, the Admin chairs. The big button changes each time. Check your LD changes. Reload: money stays.

**8: mischief**
- In a classroom, press Slip out. Do it with 2 or 3 friends within 15 seconds to trigger an event.
- Steal a plate: victim runs faster for a few seconds. Steal 3 times: you show an eyes marker and mischief locks for 3 minutes.

**9 and 10: memory and Chichi**
- Help or eat with someone, then tap them: a sentence about you two appears. Rejoin: a recap notice.
- Help many people: after a while a "known for" label shows on your panel and the campus says people are talking about you.

## What to look for

Do avatars look smooth on a phone? Does a second tab push the first off? Does leaving mid-help
clean up for the other person? Does the crowd feel alive with bots running? Note anything that
feels unnatural; that is the real test of the first milestone.

## Developer checks

```bash
npm run typecheck
curl localhost:8080/health      # {"ok":true,"players":N}
```


## One pass over the whole 3D game (after Phases A to H)

Run `npm install`, then `npm run dev`. Open `/play?stats=1`. Add `npm run bots -- 12` in a second terminal so the campus has people. Tap once anywhere to turn the sound on.

1. **Join:** choose Boy or Girl. You arrive at the BCC gate with two security guards. Hold the walk pad (bottom left) to move; ⟲ ⟳ turn the camera; + − zoom.
2. **Campus map:** tap 🗺 (or press M). Tap the Student Hall; your student walks there.
3. **Classes:** the first class begins about 15 seconds after the server starts (the chip top-left says Class 1 of 4). Walk into a classroom and stay about 40 seconds. At the bell you should get +8 LD. Instructors speak lines (their mood changes them).
4. **Jobs board:** in the Student Hall stand by the cork board on the west wall and use the action button. Take an errand and walk to the place. You should be paid on arrival.
5. **Marketplace:** go west along the road from the Student Hall apron. Stand at the striped stall, press the action button, buy the energy drink (you walk faster) and the glow bracelet (✨ over your head).
5b. **Jobs Board:** at the Marketplace kiosk (teal, with the Jobs Clerk) press the action button. Post a job (you lose the reward). With a second phone or browser, claim it, walk next to the poster and tap Hand in; the poster taps Accept and the worker is paid. Also try Cancel and letting the deadline run out (money returns).
5c. **Lecture Area:** north-east paved area. Stand at the lectern, pick a topic and talk in chat. Others sit on the benches, clap and tap Ask a question. Check the 🎙️ over your head and the pay.
5d. **Colleges and grades:** at first join a card asks for your college. After a class the 🎓 chip shows your GPA and an assignment. Go upstairs to the Library and press the action button at the tables: stay still 12 seconds to hand it in. Chat a lot in the Library to get shushed.
5e. **Guards:** watch the three patrol guards walk their rounds. With a second phone, steal a plate in front of one: the thief is fined and the plate goes back.
5f. **Sprint race and carousel:** north of the football pitch, press the button at the start line (a friend must join within 20 seconds), run to the flag and back. Try the carousel by the track.
6. **Football:** go to the Recreation Ground (north-west). Walk into the ball, or press Kick / K. Try to score for +5 LD.
7. **Social Ground:** east of the coconut palms. Sit on a bench by the big tree.
8. **Party and event night:** after the second free time the sky turns to dusk and a notice says to go to the Student Center. The guard asks for 30 LD (pay, or try to sneak in). Inside, stand on the dance floor and you dance by yourself; the 💃 Dance button also works anywhere. Tap the event chip to book Singer or Dancer; others clap to cheer you.
9. **Music:** ♪ opens volume and mute. Move in and out of the Student Center: the party gets loud inside and muffled outside.
10. **Day and night:** the sky follows the campus clock: bright all day, dusk, then a dark night with glowing windows and street lamps. Rain showers fall now and then.
11. **Free time and specials:** during the 15 minute free time a gold special chip appears now and then (double errands, double goals, story time, market half price).
12. **Company:** stand with two friends, tap Tell a story, then Tell a joke (others tap Laugh). Wave at a stranger. Each pays a little; look at your money.
13. **Bedtime and dawn:** after the party the door closes (the guard says come back tomorrow), the music stops and the night circle pays more. At dawn you get the passing-the-night bonus and a recap of yesterday.

To see everything quickly, set `CLOCK_SCALE=0.1` (a day in about 5 minutes) or `CLOCK_START=dusk` for the night first. See `docs/day-cycle.md`.

Useful switches: `CLOCK_SCALE=0.1`, `CLOCK_START=dusk`, `CLOCK=off`, `PARTY=always`, `PARTY=off`, `ENTRY_FEE=0`, `WEATHER=rain` (set in the game server's environment).

If something looks or sounds wrong, send me the browser console (F12, Console) and a screenshot.


## Phase L
Try in order: pick a college; attend class 1 and 2 and watch the chip move through Teaching, Quiz, Discussion, Quick round, Practice, Review, Assignments; answer the true/false round; open the Games desk (🎮 at the Recreation Ground) and join football with a friend; run the race; ride the carousel. Use CLOCK_SCALE=0.2 for a faster day.
