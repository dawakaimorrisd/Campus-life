/**
 * Campus spirit: being good company pays. Sitting with friends, telling stories and jokes, meeting new people and
 * making it through the night all earn a little money, so free time is worth spending with other people.
 */

export const GROUP_TICK_MS = 30_000;
export const GROUP_PAY = 2;
export const STORY_LINE_MS = 3600;
export const STORY_COOLDOWN_MS = 120_000;
export const STORY_TELLER_PAY = 3;
export const STORY_LISTENER_PAY = 2;
export const STORY_MAX_LISTENERS = 5;
export const JOKE_GAP_MS = 3200;
export const JOKE_WINDOW_MS = 8000;
export const JOKE_COOLDOWN_MS = 60_000;
export const JOKE_LAUGH_TELLER = 2;
export const JOKE_LAUGH_LISTENER = 1;
export const JOKE_MAX_LAUGHS = 5;
export const MEET_PAY = 5;
export const MEET_RANGE = 220;
export const MEET_MAX = 8;
/** Passing the night: stay through until dawn and join in. */
export const NIGHT_PASS_PAY = 10;
export const NIGHT_POINT_PAY = 2;
export const NIGHT_BONUS_CAP = 30;
/** During bedtime the quiet night circle pays a little extra. */
export const BEDTIME_MULT = 1.5;

export interface Story {
  title: string;
  lines: readonly string[];
}

export const STORIES: readonly Story[] = [
  { title: 'The Spider and the Rice Pot', lines: ['Long ago, Spider was hungry but too lazy to cook.', 'So he told every neighbour: "Come, the pot is ready!"', 'They all arrived, and each brought something to put in the pot.', 'That night Spider ate the best soup of his life, and learned that sharing makes the pot bigger.'] },
  { title: 'The Tortoise and the Flood', lines: ['One rainy season the river rose and everyone ran.', 'Tortoise said, "Slow is fine, but a plan is better."', 'He climbed the hill the day before the flood. His house stayed dry.', 'Moral: walk early, so you never have to run.'] },
  { title: 'The Night the Light Went Off', lines: ['One evening at BCC, the light went off during exam revision.', 'Everyone sat outside under the moon and shared what they remembered.', 'By midnight the whole class knew more than any one of them had alone.', 'They passed, and said the darkness taught them best.'] },
  { title: 'The Goat and the Gate', lines: ['A goat wanted to enter the campus without paying the guard.', 'He waited by the gate, looking very important.', 'The guard said, "Mister Goat, where is your ticket?"', 'The goat ate the ticket sign instead and was escorted out. Even goats must queue.'] },
  { title: 'The First Day at BCC', lines: ['My first day here, I walked into the wrong class and sat down proudly.', 'The instructor smiled and said, "Welcome to Criminal Justice."', 'I was studying Agriculture. I stayed an hour anyway.', 'Now I know the whole campus, and half the instructors know me.'] },
  { title: 'The Kind Drummer', lines: ['In a quiet village lived a drummer nobody noticed.', 'One night a child was lost in the forest, and he drummed all night.', 'The child followed the sound home before sunrise.', 'After that, the village never complained about his noise again.'] },
  { title: 'The Mango Tree Promise', lines: ['Two friends planted a mango tree and promised to meet under it in ten years.', 'One moved far away, the other stayed.', 'On the tenth year the tree was full, and so was the road home.', 'They ate mangoes till dark and never lost touch again.'] },
  { title: 'The Student Who Lost His Pen', lines: ['A student lost his only pen before the big test.', 'Three strangers each lent him one, without being asked.', 'He wrote the test with three pens in his hand and passed.', 'Now he always carries a spare, for the next person.'] }
];

export interface Joke {
  setup: string;
  punch: string;
}
export const JOKES: readonly Joke[] = [
  { setup: 'Why did the student bring a ladder to class?', punch: 'Because the exam was high level!' },
  { setup: 'Why was the pen so tired?', punch: 'It wrote all night for the test.' },
  { setup: 'What did the lecture notes say to the highlighter?', punch: '"You always make a big deal of everything."' },
  { setup: 'Why did the phone go to the Student Center?', punch: 'It heard there was free charging.' },
  { setup: 'Why did the chair go to the Library?', punch: 'It wanted some quiet support.' },
  { setup: 'Teacher: use "amazing" in a sentence.', punch: 'Student: "Amazing, I passed!"' },
  { setup: 'Why do students love the Palaver Hut?', punch: 'Because the best lessons are free.' },
  { setup: 'What is the fastest thing on campus?', punch: 'The rumour that class is cancelled.' },
  { setup: 'Why did the football refuse to talk?', punch: 'Everybody kept kicking it around.' },
  { setup: 'Why did the instructor wear sunglasses?', punch: 'His class was so bright.' }
];
