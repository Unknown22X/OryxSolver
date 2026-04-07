export interface LandingFeatureItem {
  id: string;
  title: string;
  description: string;
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
  },
  {
    id: 'deep-explanations',
    title: 'Deep Explanations',
    description: 'Show the answer with structure that is easier to review than a raw one-line result.',
  },
  {
    id: 'learning-modes',
    title: 'Learning Modes',
    description: 'Switch the explanation style before the thread starts so the response matches the task.',
  },
  {
    id: 'private-by-design',
    title: 'Private by Design',
    description: 'Keep account data, solve history, and progress tied to the same signed-in workflow.',
  },
];

export interface LandingReviewItem {
  id: string;
  quote: string;
  name: string;
  role: string;
}


export const LANDING_REVIEWS_INTRO = {
  eyebrow: 'Student Reviews',
  titlePrefix: 'Loved by students',
  titleHighlight: 'everywhere',
};

export const LANDING_REVIEWS: LandingReviewItem[] = [
  {
    id: 'sarah',
    quote: 'Literally saved me during my AP Physics homework. It explains the math better than my textbook does.',
    name: 'Sarah M.',
    role: '10th Grade',
  },
  {
    id: 'james',
    quote: "The Chrome extension is a game changer. I don't have to keep switching tabs to search for help anymore.",
    name: 'James K.',
    role: 'University Student',
  },
  {
    id: 'emily',
    quote: "It's actually clean. No ads, no unnecessary buttons, just the solution I need.",
    name: 'Emily R.',
    role: 'Beta Tester',
  },
];
