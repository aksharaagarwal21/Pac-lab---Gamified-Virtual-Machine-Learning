// The ten experiments of the ML Maze, in unlock order.
export const LABS = [
  { id: 1, title: 'Data Pre-processing for Machine Learning', mission: 'DATA CLEANUP', tier: 'ROOKIE', xp: 120 },
  { id: 2, title: 'Linear Regression', mission: 'LINE FITTING', tier: 'ROOKIE', xp: 160 },
  { id: 3, title: 'Cross-Validation for Model Evaluation', mission: 'FOLD TESTING', tier: 'EXPLORER', xp: 200 },
  { id: 4, title: 'Logistic Regression for Binary Classification', mission: 'YES OR NO', tier: 'EXPLORER', xp: 240 },
  { id: 5, title: 'Principal Component Analysis (PCA)', mission: 'DIMENSION SHRINK', tier: 'CHALLENGER', xp: 280 },
  { id: 6, title: 'Support Vector Machine Classification', mission: 'MARGIN MASTER', tier: 'CHALLENGER', xp: 320 },
  { id: 7, title: 'K-Means Clustering', mission: 'GROUP HUNT', tier: 'EXPERT', xp: 360 },
  { id: 8, title: 'Decision Tree Classification', mission: 'TREE SPLITS', tier: 'EXPERT', xp: 400 },
  { id: 9, title: 'Random Forest Classification', mission: 'FOREST VOTE', tier: 'MASTER', xp: 500 },
  { id: 10, title: 'Artificial Neural Network using Perceptron Learning', mission: 'NEURON SPARK', tier: 'LEGENDARY', xp: 1000, final: true },
]

export const getLab = (id) => LABS.find((lab) => lab.id === Number(id))

export const labNumber = (id) => String(id).padStart(2, '0')
