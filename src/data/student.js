// Sample progress data for the student dashboard.
// Replace with real API data once student accounts are connected.

export const PLAYER = {
  level: 4,
  rank: 'DATA CHOMPER',
  xp: 2340,
  xpNext: 3000,
  hiScore: 12450,
  streak: 6,
  bestStreak: 9,
}

export const LEVELS = [
  { id: 1, title: 'DATA BASICS', topic: 'Python, NumPy and Pandas', status: 'cleared', stars: 3 },
  { id: 2, title: 'CLEAN THE MAZE', topic: 'Data cleaning and exploration', status: 'cleared', stars: 3 },
  { id: 3, title: 'SLOPE RUNNER', topic: 'Linear regression and gradient descent', status: 'cleared', stars: 2 },
  {
    id: 4,
    title: 'SORTING GHOSTS',
    topic: 'Classification with logistic regression',
    status: 'current',
    objectives: [
      { text: 'Split the ghost dataset into train and test sets', done: true },
      { text: 'Scale the features', done: true },
      { text: 'Train a logistic regression model', done: true },
      { text: 'Beat 85% test accuracy (best so far: 81%)', done: false },
      { text: 'Plot and explain the confusion matrix', done: false },
    ],
  },
  { id: 5, title: 'TREE MAZE', topic: 'Decision trees and random forests', status: 'locked' },
  { id: 6, title: 'GHOST CLUSTERS', topic: 'K-means clustering', status: 'locked' },
  { id: 7, title: 'NEURAL CHOMP', topic: 'Neural networks', status: 'locked' },
  { id: 8, title: 'FINAL BOSS', topic: 'Model evaluation and deployment', status: 'locked' },
]

export const CURRENT_LEVEL = LEVELS.find((level) => level.status === 'current')

export function objectiveProgress(level) {
  const done = level.objectives.filter((objective) => objective.done).length
  return { done, total: level.objectives.length, percent: Math.round((done / level.objectives.length) * 100) }
}

export const DAILY_CHALLENGE = {
  title: 'TUNE THE K',
  task: 'Find a k for k-nearest neighbours that beats 90% accuracy on the fruit dataset.',
  reward: 150,
  difficulty: 2,
}

// A badge is earned when it has an `earnedOn` date. Icons use either an arcade sprite or a short glyph.
export const BADGES = [
  { name: 'FIRST CHOMP', goal: 'Finish your first lab.', sprite: 'pac', earnedOn: '02 SEP' },
  { name: 'CLEAN EATER', goal: 'Submit a dataset with zero missing values.', sprite: 'pellet', earnedOn: '04 SEP' },
  { name: 'THREE STAR RUN', goal: 'Clear any level with 3 stars.', sprite: 'star', earnedOn: '05 SEP' },
  { name: 'LINE RIDER', goal: 'Score R2 above 0.90 in a regression lab.', glyph: '.91', earnedOn: '09 SEP' },
  { name: 'STREAK X5', goal: 'Train in the lab 5 days in a row.', glyph: 'X5', earnedOn: '11 SEP' },
  { name: 'GHOST BUSTER', goal: 'Fix 10 bugs flagged by the lab ghosts.', sprite: 'ghost-red', earnedOn: '12 SEP' },
  { name: 'POWER PELLET', goal: 'Score 100% on a level quiz.', sprite: 'power' },
  { name: 'SHARP SHOOTER', goal: 'Beat 85% accuracy on the Level 4 classifier.', glyph: '85%' },
  { name: 'OVERFIT SLAYER', goal: 'Keep the train/test accuracy gap under 2%.', glyph: '2%' },
  { name: 'NEURAL NINJA', goal: 'Train a neural network above 95% accuracy.', sprite: 'ghost-cyan' },
  { name: 'TOP SCORER', goal: 'Reach #1 on the class high scores.', glyph: '#1' },
  { name: 'MAZE MASTER', goal: 'Clear all 8 levels of the maze.', glyph: '8/8' },
]

export const SKILLS = [
  { name: 'DATA PREP', value: 9 },
  { name: 'REGRESSION', value: 8 },
  { name: 'CLASSIFY', value: 5 },
  { name: 'EVALUATION', value: 4 },
  { name: 'CLUSTERING', value: 1 },
  { name: 'NEURAL NETS', value: 0 },
]

export const RUNS = [
  { level: 'LV4', name: 'LOGISTIC REGRESSION', result: 'Accuracy 81%', xp: 320, when: '2H AGO' },
  { level: 'LV4', name: 'FEATURE SCALING', result: 'Complete', xp: 150, when: 'YESTERDAY' },
  { level: 'DAY', name: 'OUTLIER HUNT', result: 'Challenge cleared', xp: 150, when: '2D AGO' },
  { level: 'LV3', name: 'LINEAR REGRESSION', result: 'R2 score 0.91', xp: 480, when: '3D AGO' },
  { level: 'LV3', name: 'GRADIENT DESCENT', result: 'Final loss 0.042', xp: 260, when: '4D AGO' },
]

export const RIVALS = [
  { id: 'ML-2026-017', score: 15980 },
  { id: 'ML-2026-008', score: 13720 },
  { id: 'ML-2026-033', score: 11905 },
  { id: 'ML-2026-021', score: 10340 },
]
