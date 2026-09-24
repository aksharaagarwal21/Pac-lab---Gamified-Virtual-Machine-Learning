// Lesson content per lab. Labs without an entry show a "coming soon" briefing.

const STUDENTS = [
  { id: 'S01', studied: 1.0, slept: 5.0, passed: 0, split: 'train' },
  { id: 'S02', studied: 2.0, slept: 6.5, passed: 0, split: 'train' },
  { id: 'S03', studied: 2.5, slept: 4.5, passed: 0, split: 'train' },
  { id: 'S04', studied: 3.5, slept: 6.0, passed: 1, split: 'train' },
  { id: 'S05', studied: 4.0, slept: 8.0, passed: 1, split: 'train' },
  { id: 'S06', studied: 4.5, slept: 3.5, passed: 0, split: 'train' },
  { id: 'S07', studied: 5.0, slept: 7.0, passed: 1, split: 'train' },
  { id: 'S08', studied: 5.5, slept: 5.5, passed: 1, split: 'train' },
  { id: 'S09', studied: 6.0, slept: 2.5, passed: 1, split: 'train' },
  { id: 'S10', studied: 1.5, slept: 8.5, passed: 0, split: 'test' },
  { id: 'S11', studied: 3.0, slept: 8.0, passed: 1, split: 'test' },
  { id: 'S12', studied: 6.5, slept: 6.5, passed: 1, split: 'test' },
]

const trainRows = STUDENTS.filter((student) => student.split === 'train')
const testRows = STUDENTS.filter((student) => student.split === 'test')

// Python-style number formatting so the code listing matches what Python would print.
const pyFloat = (value) => (Number.isInteger(value) ? value.toFixed(1) : String(value))
const pyList = (values) => `[${values.join(', ')}]`

const PROBE = [4.5, 7.0]

// Built from the dataset rows so the listing and the table can never disagree.
const CODE_LINES = [
  '# Experiment 01: train your first model',
  'from sklearn.linear_model import LogisticRegression',
  '',
  `hours_studied = ${pyList(trainRows.map((s) => pyFloat(s.studied)))}`,
  `hours_slept   = ${pyList(trainRows.map((s) => pyFloat(s.slept)))}`,
  `passed        = ${pyList(trainRows.map((s) => s.passed))}`,
  '',
  'X_train = list(zip(hours_studied, hours_slept))',
  `X_test  = ${pyList(testRows.map((s) => `(${pyFloat(s.studied)}, ${pyFloat(s.slept)})`))}`,
  `y_test  = ${pyList(testRows.map((s) => s.passed))}`,
  '',
  'model = LogisticRegression()',
  'model.fit(X_train, passed)',
  '',
  `print("Prediction for ${PROBE[0]}h study, ${PROBE[1]}h sleep:", model.predict([[${pyFloat(PROBE[0])}, ${pyFloat(PROBE[1])}]]))`,
  'print("Test accuracy:", model.score(X_test, y_test))',
]

export const LAB_CONTENT = {
  1: {
    theory: {
      stage: 'STAGE 01 · INTELLIGENCE PRIMER',
      title: 'What makes a machine',
      highlight: 'learn?',
      lead: 'Machine learning teaches computers to recognize patterns from examples—without programming every rule by hand.',
      cards: [
        { icon: 'database', title: '1. Feed Data', copy: 'Examples give the model raw experience to learn from.' },
        { icon: 'sparkles', title: '2. Find Patterns', copy: 'An algorithm discovers relationships hidden in the examples.' },
        { icon: 'target', title: '3. Predict', copy: 'The trained model applies patterns to unseen data.' },
      ],
      tip: 'A model is only as useful as the data and questions behind it.',
    },
    dataset: {
      stage: 'STAGE 02 · DATA INTAKE',
      title: 'Meet the',
      highlight: 'dataset.',
      lead: 'Twelve students logged how long they studied and slept before an exam. Nine rows train the model; three stay hidden to test it.',
      facts: [
        ['ROWS', String(STUDENTS.length)],
        ['FEATURES', '2'],
        ['TARGET', 'PASS/FAIL'],
        ['TRAIN/TEST', `${trainRows.length}/${testRows.length}`],
      ],
      rows: STUDENTS,
      tip: 'Features are the inputs (hours studied, hours slept). The target is the answer we want predicted.',
    },
    code: {
      stage: 'STAGE 03 · CODE LAB',
      title: 'Train your first',
      highlight: 'model.',
      lead: 'Fit a logistic regression on the nine training rows, then check it against the three rows it has never seen.',
      file: 'first_model.py',
      lines: CODE_LINES,
      probe: PROBE,
      tip: 'fit() learns from examples. predict() uses what was learned. score() measures accuracy on data.',
    },
    visualize: {
      stage: 'STAGE 04 · VISUALIZE',
      title: 'See the decision',
      highlight: 'boundary.',
      lead: 'Every dot is a student. The line is where the trained model switches its prediction from FAIL to PASS.',
      xLabel: 'HOURS STUDIED',
      yLabel: 'HOURS SLEPT',
      xMax: 8,
      yMax: 10,
      tip: 'Hollow dots are test students. The model never saw them while training.',
    },
    tasks: {
      stage: 'STAGE 05 · MISSION LOG',
      title: 'Clear every',
      highlight: 'objective.',
      lead: 'Finish each stage of the lab. Objectives light up automatically as you complete them.',
      items: [
        { id: 'theory', tab: 'theory', text: 'Read the intelligence primer', hint: 'Open the Theory stage.' },
        { id: 'dataset', tab: 'dataset', text: 'Inspect the training dataset', hint: 'Open the Dataset stage.' },
        { id: 'code', tab: 'code', text: 'Run the training code', hint: 'Press RUN CODE in the Code Lab.' },
        { id: 'visualize', tab: 'visualize', text: 'Reveal the decision boundary', hint: 'Press SHOW BOUNDARY in Visualize.' },
        { id: 'quiz', tab: 'quiz', text: 'Defeat the quiz boss', hint: 'Answer at least 2 of 3 questions correctly.' },
      ],
      tip: 'Select an objective to jump straight to its stage.',
    },
    quiz: {
      stage: 'STAGE 06 · QUIZ BOSS',
      title: 'Defeat the',
      highlight: 'quiz boss.',
      lead: 'Answer 3 questions. Each correct answer earns a star, and 2 stars clears the lab.',
      passMark: 2,
      questions: [
        {
          prompt: 'What does a machine learning model learn from?',
          options: ['Rules written by hand for every case', 'Examples in data', 'Random guesses', 'The screen resolution'],
          answer: 1,
          explain: 'Models find patterns in example data instead of following hand-written rules.',
        },
        {
          prompt: 'In the student dataset, what does the model predict?',
          options: ['Hours studied', 'Hours slept', 'PASS or FAIL', 'The student ID'],
          answer: 2,
          explain: 'PASS/FAIL is the target. Hours studied and hours slept are the features.',
        },
        {
          prompt: 'Why keep test rows that the model never trains on?',
          options: ['To make training faster', 'To check it works on unseen data', 'To hide its mistakes', 'Test rows are not needed'],
          answer: 1,
          explain: 'Test data shows whether the model generalises beyond the examples it memorised.',
        },
      ],
    },
  },
}
