export type LandingFeatureTone = 'orange' | 'violet' | 'blue' | 'green' | 'sky' | 'indigo';

export interface LandingFeatureItem {
  id: string;
  title: string;
  description: string;
  tone: LandingFeatureTone;
}

export const LANDING_FEATURES_INTRO = {
  eyebrow: 'Features',
  title: 'Everything you need to shape your study flow',
  description:
    'Edit this section directly. Add more cards, rename titles, and rewrite descriptions without touching the surrounding layout.',
};

export const LANDING_FEATURES: LandingFeatureItem[] = [
  {
    id: 'snap-and-solve',
    title: 'Snap & Solve',
    description: 'Capture a question quickly from the page and move it into Oryx without retyping.',
    tone: 'orange',
  },
  {
    id: 'deep-explanations',
    title: 'Deep Explanations',
    description: 'Show the answer with structure that is easier to review than a raw one-line result.',
    tone: 'violet',
  },
  {
    id: 'learning-modes',
    title: 'Learning Modes',
    description: 'Switch the explanation style before the thread starts so the response matches the task.',
    tone: 'blue',
  },
  {
    id: 'private-by-design',
    title: 'Private by Design',
    description: 'Keep account data, solve history, and progress tied to the same signed-in workflow.',
    tone: 'green',
  },
];

export interface LandingReviewItem {
  id: string;
  quote: string;
  name: string;
  role: string;
  accent: string;
}

export const LANDING_REVIEWS_INTRO = {
  eyebrow: 'Student Reviews',
  titlePrefix: 'Loved by students',
  titleHighlight: 'everywhere',
};

export const LANDING_REVIEWS: LandingReviewItem[] = [
  {
    id: 'sarah',
    quote: 'OryxSolver turns confusing questions into clear steps. I actually understand the material now.',
    name: 'Sarah M.',
    role: 'High School Junior',
    accent: 'from-pink-500 to-rose-400',
  },
  {
    id: 'james',
    quote: 'Exam mode is perfect for studying. The answers are structured the way my professors grade.',
    name: 'James K.',
    role: 'College Freshman',
    accent: 'from-indigo-500 to-violet-400',
  },
  {
    id: 'emily',
    quote: 'The extension is smooth and the explanations are consistent. It saves me hours each week.',
    name: 'Emily R.',
    role: 'Senior Student',
    accent: 'from-emerald-500 to-teal-400',
  },
];
