# Jobs Board and Lecture Area

## Campus Jobs Board (Marketplace)
Where: the teal kiosk in the **Marketplace** (west of the Student Block), with a Jobs Clerk beside it. The old cork board in the Student Hall opens the same board.

**How it works**
1. Stand at the kiosk and press the action button. Three tabs: **Jobs**, **Post a job**, **Campus work** (the old computer errands).
2. **Post a job:** choose a kind (assignment help, notes, presentation help, research, errand, lost and found), a subject (a college, the library or the campus), a reward (10, 15, 20, 30, 40 or 60 LD) and a deadline (3, 5 or 10 minutes). The reward is taken from you straight away and held.
3. Another student **claims** it (one worker per job, one job at a time). They can give it back.
4. The worker walks up to you and taps **Hand in** (within about 3 tiles of the poster).
5. You tap **Accept** and the held reward goes to the worker. If you do nothing, it is accepted by itself after 90 seconds.
6. If nobody finishes before the deadline, or you cancel an unclaimed job, the reward comes back to you.

**Limits:** 12 jobs on the board, 2 of your own at a time, 15 seconds between posts. If the server restarts, held money is returned. Jobs are favours between students and **never change anyone's grades**. Helping logs a "helped" memory for both people (it shows in "known for").

## Lecture Area
Where: north-east, a paved area with a lectern, a whiteboard and benches (zone `lecture_area`).

- Stand at the lectern and press the action button, pick a topic (12 to choose from). You can talk for up to 90 seconds; Finish ends it early. Only one speaker at a time, and a 2.5 minute cooldown per person.
- While you speak, everyone within about 13 tiles hears you in chat, and you show a 🎙️ over your head.
- Listeners who stay in the area for half the talk are paid 3 LD. The speaker is paid 4 LD per listener (up to 6 listeners). Clapping pays 2 (up to 6 claps).
- The audience can tap **✋ Ask a question** (up to 3 per talk). Answer in chat within 30 seconds: the asker gets 2 LD and the answerer 3 LD.
- A talk to an empty area pays nothing. Pay is scaled by the free-time special (story time).
- The Marketplace pulses on the overview map while jobs are waiting, and the Lecture Area pulses while someone is speaking.

## Messages (see `protocol.md`)
Client: `post_job`, `board_act`, `present`, `end_talk`, `ask_question`. Server: `board`, `talk`, `open` (`lectern`). Player state `doing` can be `present`.
