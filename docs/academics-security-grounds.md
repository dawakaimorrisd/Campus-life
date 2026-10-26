# Academics, security, library and recreation (Phase K)

Built after the blueprint audit. Your decisions: **no prefect** (NPC and election removed) and **no extras** (accounts, photo textures, profanity filter and blocking, upstairs bots).

## Academics
- **Colleges.** The first time you join you choose one of the five colleges (once, no changes). Going to class in your home college room earns **+3 LD**. Your choice is saved in the database (`players.academic`, created automatically).
- **GPA.** Every class gives a mark: on time 4, late 3, left early 2, absent 0. An assignment finished is 4, missed is 0. GPA is the average of your last 12 marks (shown as 0.0 to 4.0). Standing: Dean's List (3.5+) pays **+2 LD** on every class you attend; Good standing, Fair and Warning have no penalty besides the number. Paid help on the Jobs Board never changes grades.
- **Instructor moods.** Each lesson has a mood (same for everybody, set by the day and lesson): Cheerful (+2 LD to everyone present), Strict (late comes after 8 s instead of 15), Relaxed (late after 30 s), Inspired (assignment pays +5). The instructor's lines change, and the people in classrooms get a notice.
- **Assignments.** After a class you attended you get an assignment for your college (due in 2 to 6 minutes). Finish it by studying at the **Library tables** (12 seconds, stay still and quiet). It pays 10 LD (15 on Inspired days). Missed assignments count as a 0 mark.
- **Study chip and card.** The 🎓 chip shows GPA and the assignment countdown; tap it for the card with your college, standing, today's four classes and the mood. A reminder appears 20 seconds before each class.

## Library
- **Study at the tables** (assignment, or 3 LD without one, 30 s cooldown), **Read a book** (4 LD, 60 s cooldown), **Shelve books** (as before).
- **Quiet zone:** more than 3 chat lines in 10 seconds gets a shush and stops your study.

## Security
- **Three patrol guards** walk fixed rounds (Recreation Ground, Marketplace, Palaver Hut, Social Ground, Lecture Area, Back Palaver, Student Hall). Their place depends only on the time, so the server and every phone agree. The guards at the gate and the Student Center door still stand still.
- A guard sees about 6 tiles in front of them. A **thief carrying a stolen plate** in view is caught: fined 10 LD, the plate and the fine go to the victim, and mischief is locked for a minute. Everyone gets the incident as campus news.
- **Loitering:** outside a classroom during a lesson in view of a guard you get a warning (once a minute, no penalty).

## Recreation Ground extras
- **Sprint Track** (north of the pitch): press the button at the start line to open a race. Others have 20 seconds to join (2 to 8 runners), then a 3 second countdown. Run to the flag and back: first home wins **12 LD**, other finishers within 8 seconds **3 LD**. 30 seconds between races. A chip shows the countdown and results.
- **Carousel** (fare **2 LD**): 12 seconds, up to 6 riders; riding with company pays **3 LD** back. The carousel turns on every phone in step.

## Performers
- The **dancers** on stage change style every 8 beats; the **party-goers** now wander the dance floor and dance where they stop. A **House Singer** takes the stage whenever no booked performer is on it.

## Tests
`acad.mts`, `guard.mts`, `rec.mts` (server), extra cases in `ui.mts` and `map.mts`.


## Update: timing, progression and games (Phase L)

**Progression.** 4 years. A term is 8 classes (`TERM_LESSONS`). To move up you need a term GPA of 2.0 and at least 60% attendance; honors need 3.5. Promotion pays 25 LD per year, graduation 150 LD. Graduates stop attending class and show "🎓 Graduate".

**Instructors.** Each room has a mood (cheerful, strict, relaxed, inspired) that sets how late counts as late and how generous they are. Two multiple-choice questions and three true/false statements per class; right answers pay and add participation marks. Office hours (after class) let you ask once per assignment for more time; strict instructors refuse.

**Assignments.** Only after classes 2 and 4. Collected at the wrap-up of the next class. Handing one in (Library study tables) pays 10 LD; missing it counts as a mark against you.

**Guards.** Accepted as built. They patrol, warn loiterers in class time and fine plate thieves. There is no incident report screen.

**Games desk.** Football (4 a side, 3 minutes or first to 5, lobby 30 s), sprint race (up to 6 lanes, false starts out), carousel (6 seats). One game at a time, waiting lists for each, and everything is joined from the Games card. Casual kickabout is free when no match is on; during a match only players can touch the ball.
