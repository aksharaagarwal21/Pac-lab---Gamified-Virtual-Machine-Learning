import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BASE_COLUMNS,
  RAW_DATASETS,
  STAGE_HEALTH,
  buildPythonProgram,
  computeStats,
  dataHealth,
  formatValue,
  transformDataset,
} from '../src/experiments/sims/dataRescueModel.js'

const close = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be close to ${expected}`)
}

const completeChoices = {
  fillMissing: { Age: 'median', Salary: 'median' },
  removeDuplicates: true,
  normalizeCity: 'lower',
  fixInvalidAge: true,
  encoding: 'onehot',
  outlier: 'cap',
  scaling: 'standard',
  featureEngineering: true,
}

test('the primary mission is the exact seven-row messy dataset from the brief', () => {
  assert.deepEqual(BASE_COLUMNS, ['Name', 'Age', 'City', 'Salary', 'Experience', 'Bought'])
  assert.equal(RAW_DATASETS.primary.length, 7)
  assert.deepEqual(RAW_DATASETS.primary.map(({ id, ...row }) => row), [
    { Name: 'Aman', Age: 21, City: 'Chennai', Salary: 35000, Experience: 1, Bought: 'Yes' },
    { Name: 'Akshara', Age: null, City: 'Delhi', Salary: 48000, Experience: 2, Bought: 'No' },
    { Name: 'Riya', Age: 22, City: 'chennai', Salary: 42000, Experience: 2, Bought: 'Yes' },
    { Name: 'Riya', Age: 22, City: 'chennai', Salary: 42000, Experience: 2, Bought: 'Yes' },
    { Name: 'Kabir', Age: 190, City: 'Mumbai', Salary: 900000, Experience: 3, Bought: 'No' },
    { Name: 'Neha', Age: 24, City: 'DELHI', Salary: null, Experience: 3, Bought: 'Yes' },
    { Name: 'Arjun', Age: 20, City: 'Bangalore', Salary: 30000, Experience: 1, Bought: 'No' },
  ])
  assert.deepEqual(RAW_DATASETS.primary.map(row => row.id), [
    'aman', 'akshara', 'riya-a', 'riya-b', 'kabir', 'neha', 'arjun',
  ])

  const challengeStats = computeStats(RAW_DATASETS.challenge)
  assert.equal(RAW_DATASETS.challenge.length, 7)
  assert.equal(challengeStats.missingTotal, 2)
  assert.equal(challengeStats.duplicateCount, 1)
  assert.ok(challengeStats.numeric.Age.max > 120)
  assert.ok(challengeStats.numeric.Salary.max > 10 * challengeStats.numeric.Salary.median)
})

test('partial median choices fill only the selected column and never mutate raw data', () => {
  const before = JSON.stringify(RAW_DATASETS.primary)
  const ageOnly = transformDataset(RAW_DATASETS.primary, { fillMissing: { Age: 'median' } })

  assert.equal(ageOnly.rows.find(row => row.id === 'akshara').Age, 22)
  assert.equal(ageOnly.rows.find(row => row.id === 'neha').Salary, null)
  assert.equal(ageOnly.stats.missingTotal, 1)
  assert.deepEqual(ageOnly.metadata.operations.filled, [
    { id: 'akshara', column: 'Age', method: 'median', value: 22 },
  ])
  assert.equal(JSON.stringify(RAW_DATASETS.primary), before)
})

test('cleanup removes only the clone, lowercases cities, and repairs Age 190 with a valid median', () => {
  const result = transformDataset(RAW_DATASETS.primary, {
    fillMissing: 'median',
    removeDuplicates: true,
    normalizeCity: true,
    fixInvalidAge: true,
  })

  assert.equal(result.rows.length, 6)
  assert.deepEqual(result.metadata.operations.removedDuplicateIds, ['riya-b'])
  assert.deepEqual([...new Set(result.rows.map(row => row.City))].sort(), [
    'bangalore', 'chennai', 'delhi', 'mumbai',
  ])
  assert.equal(result.rows.find(row => row.id === 'kabir').Age, 22)
  assert.equal(result.rows.find(row => row.id === 'neha').Salary, 42000)
})

test('one-hot and label encoding are deterministic and expose X/y metadata', () => {
  const oneHot = transformDataset(RAW_DATASETS.primary, {
    removeDuplicates: true,
    normalizeCity: true,
    encoding: 'onehot',
  })
  assert.ok(!oneHot.columns.includes('City'))
  assert.deepEqual(oneHot.columns.filter(column => column.startsWith('City_')), [
    'City_bangalore', 'City_chennai', 'City_delhi', 'City_mumbai',
  ])
  assert.equal(oneHot.targetColumn, 'Bought')
  assert.ok(!oneHot.featureColumns.includes('Bought'))
  assert.equal(oneHot.X.length, oneHot.y.length)
  assert.deepEqual(oneHot.y, ['Yes', 'No', 'Yes', 'No', 'Yes', 'No'])

  const labelled = transformDataset(RAW_DATASETS.primary, {
    normalizeCity: true,
    encoding: 'label',
  })
  assert.deepEqual(labelled.metadata.encodingMap, {
    bangalore: 0,
    chennai: 1,
    delhi: 2,
    mumbai: 3,
  })
  assert.equal(labelled.rows.find(row => row.id === 'aman').City, 1)
})

test('outlier decisions keep, cap, or remove Kabir deterministically', () => {
  const shared = {
    fillMissing: 'median',
    removeDuplicates: true,
    normalizeCity: true,
    fixInvalidAge: true,
  }
  const kept = transformDataset(RAW_DATASETS.primary, { ...shared, outlier: 'keep' })
  const capped = transformDataset(RAW_DATASETS.primary, { ...shared, outlier: 'cap' })
  const removed = transformDataset(RAW_DATASETS.primary, { ...shared, outlier: 'remove' })

  assert.equal(kept.rows.find(row => row.id === 'kabir').Salary, 900000)
  close(capped.rows.find(row => row.id === 'kabir').Salary, capped.metadata.outlier.upperFence)
  assert.equal(removed.rows.some(row => row.id === 'kabir'), false)
  assert.equal(removed.rows.length, 5)
})

test('feature engineering, 80/20 split, and standard scaling use training rows only', () => {
  const result = transformDataset(RAW_DATASETS.primary, completeChoices)

  assert.ok(result.columns.includes('Salary_Per_Experience'))
  assert.equal(result.split.trainCount, 4)
  assert.equal(result.split.testCount, 2)
  assert.deepEqual(result.split.testIds, ['neha', 'arjun'])

  for (const column of Object.keys(result.metadata.scalingFits)) {
    const values = result.split.train.X.map(row => row[column]).filter(value => typeof value === 'number')
    close(values.reduce((sum, value) => sum + value, 0) / values.length, 0)
  }

  const ageFit = result.metadata.scalingFits.Age
  const arjun = result.rows.find(row => row.id === 'arjun')
  close(arjun.Age, (20 - ageFit.mean) / ageFit.standardDeviation)
  assert.equal(result.rows.find(row => row.id === 'aman').Salary_Per_Experience, 35000)
})

test('min-max preview fits train data and transforms held-out values with that fit', () => {
  const result = transformDataset(RAW_DATASETS.primary, {
    fillMissing: 'median',
    removeDuplicates: true,
    normalizeCity: true,
    fixInvalidAge: true,
    outlier: 'cap',
    scaling: { method: 'minmax', columns: ['Age', 'Salary'] },
  })
  const trainingAges = result.split.train.X.map(row => row.Age)
  close(Math.min(...trainingAges), 0)
  close(Math.max(...trainingAges), 1)
  const fit = result.metadata.scalingFits.Age
  close(result.rows.find(row => row.id === 'arjun').Age, (20 - fit.min) / (fit.max - fit.min))
})

test('health starts at 31 and reaches exactly 100 after all ten meaningful stages', () => {
  assert.deepEqual(STAGE_HEALTH, [31, 33, 43, 53, 60, 75, 82, 92, 96, 98, 100])
  assert.equal(dataHealth(0), 31)
  assert.equal(dataHealth(10), 100)
  assert.equal(dataHealth(new Set([0, 1, 2])), 53)
  assert.equal(dataHealth(['inspection', 'missing', 'duplicates']), 53)
  assert.equal(dataHealth(Array(10).fill(true)), 100)
})

test('Python builder preserves choices and prevents scaling leakage', () => {
  const code = buildPythonProgram(completeChoices)
  assert.match(code, /df\["Age"\] = df\["Age"\]\.fillna\(df\["Age"\]\.median\(\)\)/)
  assert.match(code, /df = df\.drop_duplicates\(\)\.copy\(\)/)
  assert.match(code, /df\["City"\] = df\["City"\]\.str\.lower\(\)/)
  assert.match(code, /pd\.get_dummies\(df, columns=\["City"\], dtype=int\)/)
  assert.match(code, /df\["Salary_Per_Experience"\]/)
  assert.match(code, /scaler = StandardScaler\(\)/)

  const splitPosition = code.indexOf('train_test_split(')
  const fitPosition = code.indexOf('scaler.fit_transform(X_train[numeric_columns])')
  const testTransformPosition = code.indexOf('scaler.transform(X_test[numeric_columns])')
  assert.ok(splitPosition >= 0 && splitPosition < fitPosition)
  assert.ok(fitPosition < testTransformPosition)
  assert.equal(code.includes('scaler.fit_transform(df'), false)
  assert.equal(code.includes('scaler.fit_transform(X_test'), false)
})

test('display formatting is beginner friendly', () => {
  assert.equal(formatValue(null), 'NULL')
  assert.equal(formatValue(900000), '9,00,000')
  assert.equal(formatValue(-0), '0')
  assert.equal(formatValue('Yes'), 'Yes')
})
