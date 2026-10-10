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
