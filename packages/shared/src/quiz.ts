/**
 * Class quizzes: once a lesson the instructor asks the room one question. A right answer pays a little and counts
 * as a participation mark. Questions are short and about the college's subject; the Student Hall gets general studies.
 */
export const QUIZ_ANSWER_MS = 20_000;
export const QUIZ_PAY = 3;
export const QUIZ_FIRST_BONUS = 2;
export const QUIZ_MARK = 4;
/**
 * The questions of one class, as shares of its length (they match CLASS_SEGMENTS). 'mcq' is a three-way question,
 * 'tf' a quick true-or-false. Windows are real seconds but never more than the given share of the class.
 */
export interface QuizSlot { at: number; kind: 'mcq' | 'tf'; windowMs: number; maxFrac: number }
export const QUIZ_SLOTS: readonly QuizSlot[] = [
  { at: 0.2, kind: 'mcq', windowMs: 20_000, maxFrac: 0.07 },
  { at: 0.35, kind: 'tf', windowMs: 12_000, maxFrac: 0.045 },
  { at: 0.41, kind: 'tf', windowMs: 12_000, maxFrac: 0.045 },
  { at: 0.47, kind: 'tf', windowMs: 12_000, maxFrac: 0.045 },
  { at: 0.6, kind: 'mcq', windowMs: 20_000, maxFrac: 0.07 }
];
export const QUIZ_TF_PAY = 1;
export const QUIZ_TF_STREAK_BONUS = 2;

export interface QuizQ { q: string; options: [string, string, string]; answer: 0 | 1 | 2 }

export const QUIZ_BANK: Record<string, readonly QuizQ[]> = {
  general: [
    { q: 'Which is the capital of Liberia?', options: ['Monrovia', 'Gbarnga', 'Buchanan'], answer: 0 },
    { q: 'How many days are in a week?', options: ['Five', 'Seven', 'Ten'], answer: 1 },
    { q: 'What is 12 + 8?', options: ['18', '20', '22'], answer: 1 },
    { q: 'What do plants need to make food?', options: ['Sunlight', 'Plastic', 'Silence'], answer: 0 },
    { q: 'Which word is a noun?', options: ['Quickly', 'Book', 'Run'], answer: 1 },
    { q: 'What is the first rule of good study?', options: ['Skip class', 'Listen and ask', 'Copy everything'], answer: 1 }
  ],
  cj: [
    { q: 'A witness statement should be written...', options: ['Exactly as given', 'With guesses added', 'Only from memory of others'], answer: 0 },
    { q: 'Chain of custody is about...', options: ['Keeping evidence tracked', 'Guarding a gate', 'Writing laws'], answer: 0 },
    { q: 'Who decides guilt in court?', options: ['The police', 'The judge or jury', 'The witness'], answer: 1 },
    { q: 'First thing at a crime scene?', options: ['Move everything', 'Keep the scene safe', 'Take photos of friends'], answer: 1 },
    { q: 'An alibi means...', options: ['Being elsewhere at the time', 'A kind of weapon', 'A court fee'], answer: 0 },
    { q: 'Evidence must be...', options: ['Labelled and recorded', 'Washed', 'Shared online'], answer: 0 }
  ],
  nursing: [
    { q: 'Before touching a patient you should...', options: ['Wash your hands', 'Eat', 'Sit down'], answer: 0 },
    { q: 'A normal adult resting pulse is about...', options: ['20 a minute', '70 a minute', '200 a minute'], answer: 1 },
    { q: 'A good midwife first...', options: ['Listens', 'Leaves', 'Writes the bill'], answer: 0 },
    { q: 'Clean water prevents...', options: ['Infection', 'Sleep', 'Growth'], answer: 0 },
    { q: 'Temperature is measured with a...', options: ['Thermometer', 'Ruler', 'Compass'], answer: 0 },
    { q: 'Patient records should be...', options: ['Accurate and private', 'Posted on the wall', 'Guessed'], answer: 0 }
  ],
  business: [
    { q: 'Profit is revenue minus...', options: ['Cost', 'Tax only', 'Sales'], answer: 0 },
    { q: 'A budget is...', options: ['A plan for money', 'A kind of tax', 'A bank'], answer: 0 },
    { q: 'Public administration serves...', options: ['The public', 'Only managers', 'Nobody'], answer: 0 },
    { q: 'If you buy at 5 and sell at 8, profit per item is...', options: ['3', '5', '13'], answer: 0 },
    { q: 'A receipt is proof of...', options: ['Payment', 'Birth', 'Travel'], answer: 0 },
    { q: 'Good customer service means...', options: ['Listening to customers', 'Closing early', 'Raising prices'], answer: 0 }
  ],
  agri: [
    { q: 'Rice grows best with...', options: ['Plenty of water', 'No water', 'Only sand'], answer: 0 },
    { q: 'Good soil is the farmer\'s...', options: ['Bank', 'Radio', 'Fence'], answer: 0 },
    { q: 'Which is a root crop?', options: ['Cassava', 'Rice', 'Pepper'], answer: 0 },
    { q: 'Rotating crops helps...', options: ['Keep soil healthy', 'Stop rain', 'Make noise'], answer: 0 },
    { q: 'Compost is made from...', options: ['Plant and food waste', 'Plastic', 'Metal'], answer: 0 },
    { q: 'Weeds should be removed because they...', options: ['Steal water and food', 'Help seeds', 'Make shade for rice'], answer: 0 }
  ],
  education: [
    { q: 'A lesson plan is...', options: ['A guide for teaching', 'A school bell', 'A uniform'], answer: 0 },
    { q: 'A good teacher...', options: ['Explains and checks understanding', 'Only talks', 'Never asks'], answer: 0 },
    { q: 'Every child can...', options: ['Learn', 'Not learn', 'Only copy'], answer: 0 },
    { q: 'Praise should be...', options: ['Specific and honest', 'Never given', 'Only to the best'], answer: 0 },
    { q: 'Classroom rules work best when they are...', options: ['Clear and fair', 'Secret', 'Changed daily'], answer: 0 },
    { q: 'Learning twice means...', options: ['Teaching what you learned', 'Failing', 'Sleeping'], answer: 0 }
  ]
};

export interface QuizState { id: number; kind: 'mcq' | 'tf'; q: string; options: string[]; endsAt: number; now: number }
