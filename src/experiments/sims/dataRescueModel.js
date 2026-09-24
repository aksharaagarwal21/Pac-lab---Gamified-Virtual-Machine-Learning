const BASE_COLUMNS = Object.freeze([
  'Name',
  'Age',
  'City',
  'Salary',
  'Experience',
  'Bought',
])

const freezeRows = rows => Object.freeze(rows.map(row => Object.freeze({ ...row })))

const PRIMARY_DATASET = freezeRows([
  { id: 'aman', Name: 'Aman', Age: 21, City: 'Chennai', Salary: 35000, Experience: 1, Bought: 'Yes' },
  { id: 'akshara', Name: 'Akshara', Age: null, City: 'Delhi', Salary: 48000, Experience: 2, Bought: 'No' },
  { id: 'riya-a', Name: 'Riya', Age: 22, City: 'chennai', Salary: 42000, Experience: 2, Bought: 'Yes' },
  { id: 'riya-b', Name: 'Riya', Age: 22, City: 'chennai', Salary: 42000, Experience: 2, Bought: 'Yes' },
  { id: 'kabir', Name: 'Kabir', Age: 190, City: 'Mumbai', Salary: 900000, Experience: 3, Bought: 'No' },
  { id: 'neha', Name: 'Neha', Age: 24, City: 'DELHI', Salary: null, Experience: 3, Bought: 'Yes' },
  { id: 'arjun', Name: 'Arjun', Age: 20, City: 'Bangalore', Salary: 30000, Experience: 1, Bought: 'No' },
])

// A second seven-row rescue mission with the same teachable faults as the brief:
// two missing cells, a clone, mixed city casing, one impossible age, and one salary outlier.
const CHALLENGE_DATASET = freezeRows([
  { id: 'meera', Name: 'Meera', Age: 25, City: 'Pune', Salary: 52000, Experience: 2, Bought: 'Yes' },
  { id: 'dev', Name: 'Dev', Age: null, City: 'Jaipur', Salary: 41000, Experience: 1, Bought: 'No' },
  { id: 'sara-a', Name: 'Sara', Age: 27, City: 'pune', Salary: 56000, Experience: 3, Bought: 'Yes' },
  { id: 'sara-b', Name: 'Sara', Age: 27, City: 'pune', Salary: 56000, Experience: 3, Bought: 'Yes' },
  { id: 'ishaan', Name: 'Ishaan', Age: 205, City: 'Kochi', Salary: 780000, Experience: 4, Bought: 'No' },
  { id: 'tara', Name: 'Tara', Age: 29, City: 'JAIPUR', Salary: null, Experience: 4, Bought: 'Yes' },
  { id: 'vikram', Name: 'Vikram', Age: 23, City: 'Hyderabad', Salary: 36000, Experience: 1, Bought: 'No' },
])

export const RAW_DATASETS = Object.freeze({
  primary: PRIMARY_DATASET,
  challenge: CHALLENGE_DATASET,
})

export const DEFAULT_CHOICES = Object.freeze({
  fillMissing: Object.freeze({}),
  removeDuplicates: false,
  normalizeCity: false,
  fixInvalidAge: false,
  encoding: 'none',
  outlier: 'keep',
  scaling: 'none',
  scaleColumns: Object.freeze(['Age', 'Salary']),
  featureEngineering: false,
  testSize: 0.2,
})

// Stage gains total 69, taking the health meter from 31 to 100. The larger gains
// belong to operations that actually repair/prepare data, rather than arbitrary XP.
const HEALTH_GAINS = Object.freeze([2, 10, 10, 7, 15, 7, 10, 4, 2, 2])

export const STAGE_HEALTH = Object.freeze(
  HEALTH_GAINS.reduce((values, gain) => [...values, values.at(-1) + gain], [31]),
)

const STAGE_KEYS = Object.freeze([
  'inspection',
  'missing',
  'duplicates',
  'cleaning',
  'encoding',
  'outliers',
  'scaling',
  'feature-engineering',
  'x-y',
  'train-test',
])

/**
 * Return data health for either a completed-stage count or an iterable of stages.
 * Numeric iterable entries are zero-based indexes when 0 is present, otherwise
 * 1..10 are treated as the human-facing stage numbers. Stage key strings work too.
 */
export function dataHealth(completedStages = 0) {
  if (Number.isFinite(completedStages)) {
    const count = Math.max(0, Math.min(10, Math.trunc(completedStages)))
    return STAGE_HEALTH[count]
  }

  if (completedStages == null) return STAGE_HEALTH[0]

  let entries
  if (Array.isArray(completedStages) && completedStages.every(value => typeof value === 'boolean')) {
    entries = completedStages.flatMap((complete, index) => complete ? [index] : [])
  } else if (typeof completedStages[Symbol.iterator] === 'function') {
    entries = [...completedStages]
  } else if (typeof completedStages === 'object') {
    entries = Object.entries(completedStages).flatMap(([stage, complete]) => complete ? [stage] : [])
  } else {
    return STAGE_HEALTH[0]
  }

  const numeric = entries.filter(value => Number.isInteger(value))
  const zeroBased = numeric.includes(0)
  const indexes = new Set()

  for (const value of entries) {
    if (Number.isInteger(value)) {
      const index = zeroBased ? value : value - 1
      if (index >= 0 && index < HEALTH_GAINS.length) indexes.add(index)
      continue
    }

    const key = String(value).trim().toLowerCase().replaceAll('_', '-')
    const keyIndex = STAGE_KEYS.indexOf(key)
    if (keyIndex >= 0) indexes.add(keyIndex)
    else {
      const match = key.match(/^stage-?(\d+)$/)
      if (match) {
        const stageNumber = Number(match[1])
        if (stageNumber >= 1 && stageNumber <= 10) indexes.add(stageNumber - 1)
      }
    }
  }

  return 31 + [...indexes].reduce((health, index) => health + HEALTH_GAINS[index], 0)
}

const isMissing = value => value == null || (typeof value === 'number' && Number.isNaN(value))
const visibleColumns = rows => {
  const seen = new Set()
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      if (column !== 'id' && column !== '_split') seen.add(column)
    }
  }
  return [...seen]
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length

const quantile = (values, fraction) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const mode = values => {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([left, leftCount], [right, rightCount]) => {
      if (leftCount !== rightCount) return rightCount - leftCount
      if (typeof left === 'number' && typeof right === 'number') return left - right
      return String(left).localeCompare(String(right))
    })[0]?.[0] ?? null
}

const duplicateSignature = (row, columns) => JSON.stringify(columns.map(column => row[column] ?? null))

export function computeStats(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const columns = visibleColumns(safeRows)
  const missingByColumn = Object.fromEntries(
    columns.map(column => [column, safeRows.filter(row => isMissing(row[column])).length]),
  )
  const numeric = {}
  const categories = {}

  for (const column of columns) {
    const present = safeRows.map(row => row[column]).filter(value => !isMissing(value))
    const values = present.filter(value => typeof value === 'number' && Number.isFinite(value))
    if (present.length > 0 && values.length === present.length) {
      const average = mean(values)
      numeric[column] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        mean: average,
        median: quantile(values, 0.5),
        q1: quantile(values, 0.25),
        q3: quantile(values, 0.75),
        standardDeviation: Math.sqrt(mean(values.map(value => (value - average) ** 2))),
      }
    } else if (present.length > 0) {
      categories[column] = [...new Set(present)].sort((a, b) => String(a).localeCompare(String(b)))
    }
  }

  const seen = new Set()
  const duplicateIds = []
  for (const row of safeRows) {
    const signature = duplicateSignature(row, columns)
    if (seen.has(signature)) duplicateIds.push(row.id)
    else seen.add(signature)
  }

  return {
    rowCount: safeRows.length,
    columnCount: columns.length,
    columns,
    missingByColumn,
    missingTotal: Object.values(missingByColumn).reduce((sum, count) => sum + count, 0),
    duplicateCount: duplicateIds.length,
    duplicateIds,
    numeric,
    categories,
  }
}

const normalizeMethod = method => {
  const normalized = typeof method === 'string' ? method.trim().toLowerCase() : method
  return ['mean', 'median', 'mode'].includes(normalized) ? normalized : null
}

const choiceForColumn = (choice, column) => {
  if (typeof choice === 'string') return normalizeMethod(choice)
  if (!choice || typeof choice !== 'object') return null
  const direct = choice[column]
  const caseInsensitive = Object.entries(choice).find(([key]) => key.toLowerCase() === column.toLowerCase())?.[1]
  return normalizeMethod(direct ?? caseInsensitive)
}

const normalizeChoices = choices => {
  const source = choices && typeof choices === 'object' ? choices : {}
  const scalingSource = source.scaling ?? source.scaler ?? source.scale ?? DEFAULT_CHOICES.scaling
  const encodingSource = source.encoding ?? source.encoder ?? DEFAULT_CHOICES.encoding
  let outlier = String(source.outlier ?? source.outlierAction ?? DEFAULT_CHOICES.outlier).toLowerCase()
  if (outlier === 'clip') outlier = 'cap'
  if (!['keep', 'investigate', 'cap', 'remove'].includes(outlier)) outlier = 'keep'

  const scaling = typeof scalingSource === 'object'
    ? String(scalingSource.method ?? scalingSource.type ?? 'none').toLowerCase()
    : String(scalingSource).toLowerCase()
  const encoding = typeof encodingSource === 'object'
    ? String(encodingSource.method ?? encodingSource.type ?? 'none').toLowerCase()
    : String(encodingSource).toLowerCase()
  const requestedTestSize = Number(source.testSize ?? source.split?.testSize ?? DEFAULT_CHOICES.testSize)

  return {
    fillMissing: source.fillMissing ?? source.missingStrategy ?? source.missing ?? DEFAULT_CHOICES.fillMissing,
    removeDuplicates: Boolean(source.removeDuplicates ?? source.dropDuplicates),
    normalizeCity: source.normalizeCity ?? source.cityCase ?? source.cleanCity ?? false,
    fixInvalidAge: source.fixInvalidAge ?? source.invalidAge ?? false,
    encoding: ['onehot', 'one-hot', 'dummy'].includes(encoding)
      ? 'onehot'
      : ['label', 'ordinal'].includes(encoding) ? 'label' : 'none',
    outlier,
    scaling: ['standard', 'standardize', 'zscore', 'z-score'].includes(scaling)
      ? 'standard'
      : ['minmax', 'min-max', 'normalize', 'normalization'].includes(scaling) ? 'minmax' : 'none',
    scaleColumns: source.scaleColumns
      ?? (typeof scalingSource === 'object' ? scalingSource.columns : null)
      ?? DEFAULT_CHOICES.scaleColumns,
    featureEngineering: Boolean(
      source.featureEngineering ?? source.addSalaryPerExperience ?? source.engineerFeature,
    ),
    encodeTarget: Boolean(source.encodeTarget),
    testSize: Number.isFinite(requestedTestSize)
      ? Math.max(0.05, Math.min(0.5, requestedTestSize))
      : DEFAULT_CHOICES.testSize,
  }
}

const replacementFor = (rows, column, method) => {
  const values = rows.map(row => row[column]).filter(value => !isMissing(value))
  if (!values.length) return null
  if (method === 'mode') return mode(values)
  const numericValues = values.filter(value => typeof value === 'number' && Number.isFinite(value))
  if (numericValues.length !== values.length) return null
  return method === 'mean' ? mean(numericValues) : quantile(numericValues, 0.5)
}

const makeOneHotName = category => {
  const suffix = String(category).trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `City_${suffix || 'missing'}`
}

const makeSplit = (rows, testSize) => {
  if (!rows.length) return { trainIds: [], testIds: [] }
  const testCount = rows.length === 1 ? 0 : Math.max(1, Math.ceil(rows.length * testSize))
  const firstTestIndex = rows.length - testCount
  return {
    trainIds: rows.slice(0, firstTestIndex).map(row => row.id),
    testIds: rows.slice(firstTestIndex).map(row => row.id),
  }
}

const scaledValue = (value, fit, method) => {
  if (isMissing(value)) return value
  if (method === 'standard') return (value - fit.mean) / (fit.standardDeviation || 1)
  return (value - fit.min) / (fit.max - fit.min || 1)
}

/**
 * Apply the player's choices without mutating the supplied rows. The returned rows
 * are the table preview; X/y and split metadata are always available for later stages.
 */
export function transformDataset(raw = RAW_DATASETS.primary, choices = {}) {
  if (!Array.isArray(raw)) throw new TypeError('transformDataset expects an array of rows')

  const options = normalizeChoices(choices)
  const initialRows = raw.map((row, index) => ({ ...row, id: row.id ?? `row-${index + 1}` }))
  let rows = initialRows.map(row => ({ ...row }))
  const operations = {
    filled: [],
    removedDuplicateIds: [],
    normalizedCities: [],
    repairedAges: [],
    outliers: [],
    engineered: [],
  }

  for (const column of ['Age', 'Salary']) {
    const method = choiceForColumn(options.fillMissing, column)
    if (!method) continue
    const replacement = replacementFor(rows, column, method)
    if (isMissing(replacement)) continue
    rows = rows.map(row => {
      if (!isMissing(row[column])) return row
      operations.filled.push({ id: row.id, column, method, value: replacement })
      return { ...row, [column]: replacement }
    })
  }

  if (options.removeDuplicates) {
    const seen = new Set()
    rows = rows.filter(row => {
      const signature = duplicateSignature(row, BASE_COLUMNS)
      if (!seen.has(signature)) {
        seen.add(signature)
        return true
      }
      operations.removedDuplicateIds.push(row.id)
      return false
    })
  }

  const cityCase = options.normalizeCity === true
    ? 'lower'
    : String(options.normalizeCity || '').toLowerCase()
  if (cityCase === 'lower' || cityCase === 'lowercase' || cityCase === 'upper' || cityCase === 'uppercase') {
    const toUpper = cityCase.startsWith('upper')
    rows = rows.map(row => {
      if (isMissing(row.City)) return row
      const next = toUpper ? String(row.City).toUpperCase() : String(row.City).toLowerCase()
      if (next !== row.City) operations.normalizedCities.push({ id: row.id, from: row.City, to: next })
      return { ...row, City: next }
    })
  }

  if (options.fixInvalidAge) {
    const validAges = rows
      .map(row => row.Age)
      .filter(age => typeof age === 'number' && Number.isFinite(age) && age >= 0 && age <= 120)
    const configured = typeof options.fixInvalidAge === 'number' ? options.fixInvalidAge : null
    const replacement = configured ?? quantile(validAges, 0.5)
    if (!isMissing(replacement)) {
      rows = rows.map(row => {
        const invalid = typeof row.Age === 'number' && (row.Age < 0 || row.Age > 120)
        if (!invalid) return row
        operations.repairedAges.push({ id: row.id, from: row.Age, to: replacement })
        return { ...row, Age: replacement }
      })
    }
  }

  const salaries = rows
    .map(row => row.Salary)
    .filter(value => typeof value === 'number' && Number.isFinite(value))
  const q1 = quantile(salaries, 0.25)
  const q3 = quantile(salaries, 0.75)
  const iqr = q1 == null || q3 == null ? null : q3 - q1
  const lowerFence = iqr == null ? null : q1 - 1.5 * iqr
  const upperFence = iqr == null ? null : q3 + 1.5 * iqr
  const isSalaryOutlier = row => (
    typeof row.Salary === 'number'
    && lowerFence != null
    && (row.Salary < lowerFence || row.Salary > upperFence)
  )
  operations.outliers = rows.filter(isSalaryOutlier).map(row => ({ id: row.id, value: row.Salary }))

  if (options.outlier === 'remove') rows = rows.filter(row => !isSalaryOutlier(row))
  else if (options.outlier === 'cap') {
    rows = rows.map(row => {
      if (!isSalaryOutlier(row)) return row
      return { ...row, Salary: Math.max(lowerFence, Math.min(upperFence, row.Salary)) }
    })
  }

  if (options.featureEngineering) {
    rows = rows.map(row => {
      const value = typeof row.Salary === 'number' && typeof row.Experience === 'number' && row.Experience !== 0
        ? row.Salary / row.Experience
        : null
      operations.engineered.push({ id: row.id, column: 'Salary_Per_Experience', value })
      return { ...row, Salary_Per_Experience: value }
    })
  }

  const encodingMap = {}
  if (options.encoding !== 'none') {
    const cities = [...new Set(rows.map(row => row.City).filter(value => !isMissing(value)))]
      .sort((a, b) => String(a).localeCompare(String(b)))
    cities.forEach((city, index) => { encodingMap[city] = index })

    if (options.encoding === 'label') {
      rows = rows.map(row => ({ ...row, City: isMissing(row.City) ? null : encodingMap[row.City] }))
    } else {
      rows = rows.map(row => {
        const encoded = { ...row }
        delete encoded.City
        for (const city of cities) encoded[makeOneHotName(city)] = Number(row.City === city)
        return encoded
      })
    }
  }

  if (options.encodeTarget) {
    rows = rows.map(row => ({ ...row, Bought: row.Bought === 'Yes' ? 1 : row.Bought === 'No' ? 0 : row.Bought }))
  }

  const splitIds = makeSplit(rows, options.testSize)
  const trainIdSet = new Set(splitIds.trainIds)
  const preScaleColumns = visibleColumns(rows).filter(column => !['Name', 'Bought'].includes(column))
  const requestedScaleColumns = Array.isArray(options.scaleColumns)
    ? options.scaleColumns.filter(column => preScaleColumns.includes(column))
    : DEFAULT_CHOICES.scaleColumns.filter(column => preScaleColumns.includes(column))
  const scalingFits = {}

  if (options.scaling !== 'none') {
    for (const column of requestedScaleColumns) {
      const trainingValues = rows
        .filter(row => trainIdSet.has(row.id))
        .map(row => row[column])
        .filter(value => typeof value === 'number' && Number.isFinite(value))
      if (!trainingValues.length) continue
      const average = mean(trainingValues)
      scalingFits[column] = {
        min: Math.min(...trainingValues),
        max: Math.max(...trainingValues),
        mean: average,
        standardDeviation: Math.sqrt(mean(trainingValues.map(value => (value - average) ** 2))),
      }
    }

    rows = rows.map(row => {
      const scaled = { ...row }
      for (const [column, fit] of Object.entries(scalingFits)) {
        scaled[column] = scaledValue(row[column], fit, options.scaling)
      }
      return scaled
    })
  }

  const columns = visibleColumns(rows)
  const featureColumns = columns.filter(column => column !== 'Bought')
  const targetColumn = 'Bought'
  const toFeatures = row => Object.fromEntries(featureColumns.map(column => [column, row[column]]))
  const X = rows.map(toFeatures)
  const y = rows.map(row => row[targetColumn])
  const trainRows = rows.filter(row => trainIdSet.has(row.id))
  const testIdSet = new Set(splitIds.testIds)
  const testRows = rows.filter(row => testIdSet.has(row.id))
  const split = {
    testSize: options.testSize,
    trainIds: splitIds.trainIds,
    testIds: splitIds.testIds,
    trainCount: trainRows.length,
    testCount: testRows.length,
    train: { ids: splitIds.trainIds, X: trainRows.map(toFeatures), y: trainRows.map(row => row[targetColumn]) },
    test: { ids: splitIds.testIds, X: testRows.map(toFeatures), y: testRows.map(row => row[targetColumn]) },
  }

  return {
    rows,
    columns,
    featureColumns,
    targetColumn,
    X,
    y,
    split,
    stats: computeStats(rows),
    initialStats: computeStats(initialRows),
    metadata: {
      choices: options,
      operations,
      encodingMap,
      outlier: { q1, q3, iqr, lowerFence, upperFence },
      scalingFits,
      xLabel: 'INPUT / FEATURES',
      yLabel: 'ANSWER / TARGET',
    },
  }
}

const pythonFillExpression = method => (
  method === 'mode' ? 'mode().iloc[0]' : `${method}()`
)

/** Build the complete Pandas/scikit-learn program for the learner's choices. */
export function buildPythonProgram(choices = {}) {
  const options = normalizeChoices(choices)
  const lines = [
    'import pandas as pd',
    'from sklearn.model_selection import train_test_split',
  ]

  if (options.scaling === 'standard') lines.push('from sklearn.preprocessing import StandardScaler')
  if (options.scaling === 'minmax') lines.push('from sklearn.preprocessing import MinMaxScaler')

  lines.push(
    '',
    '# Load and inspect the same dataset repaired in the factory.',
    'df = pd.read_csv("customers.csv")',
    'print(df.head())',
    'print(df.shape)',
    'print(df.info())',
    'print(df.dtypes)',
    'print(df.isnull().sum())',
  )

  for (const column of ['Age', 'Salary']) {
    const method = choiceForColumn(options.fillMissing, column)
    if (method) lines.push(`df["${column}"] = df["${column}"].fillna(df["${column}"].${pythonFillExpression(method)})`)
  }

  if (options.removeDuplicates) lines.push('df = df.drop_duplicates().copy()')

  const cityCase = options.normalizeCity === true
    ? 'lower'
    : String(options.normalizeCity || '').toLowerCase()
  if (cityCase === 'lower' || cityCase === 'lowercase') lines.push('df["City"] = df["City"].str.lower()')
  if (cityCase === 'upper' || cityCase === 'uppercase') lines.push('df["City"] = df["City"].str.upper()')

  if (options.fixInvalidAge) {
    lines.push('invalid_age = df["Age"].notna() & ~df["Age"].between(0, 120)')
    if (typeof options.fixInvalidAge === 'number') {
      lines.push(`df.loc[invalid_age, "Age"] = ${options.fixInvalidAge}`)
    } else {
      lines.push('valid_age_median = df.loc[df["Age"].between(0, 120), "Age"].median()')
      lines.push('df.loc[invalid_age, "Age"] = valid_age_median')
    }
  }

  if (options.outlier === 'cap' || options.outlier === 'remove') {
    lines.push(
      'q1 = df["Salary"].quantile(0.25)',
      'q3 = df["Salary"].quantile(0.75)',
      'iqr = q3 - q1',
      'lower_fence, upper_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr',
    )
    if (options.outlier === 'cap') lines.push('df["Salary"] = df["Salary"].clip(lower_fence, upper_fence)')
    else lines.push('df = df[df["Salary"].between(lower_fence, upper_fence) | df["Salary"].isna()].copy()')
  } else if (options.outlier === 'investigate') {
    lines.push('# The salary outlier was flagged for investigation and deliberately kept.')
  }

  if (options.encoding === 'onehot') lines.push('df = pd.get_dummies(df, columns=["City"], dtype=int)')
  if (options.encoding === 'label') {
    lines.push(
      'city_labels = {city: index for index, city in enumerate(sorted(df["City"].dropna().unique()))}',
      'df["City"] = df["City"].map(city_labels)',
    )
  }

  if (options.featureEngineering) {
    lines.push('df["Salary_Per_Experience"] = df["Salary"] / df["Experience"]')
  }
  if (options.encodeTarget) lines.push('df["Bought"] = df["Bought"].map({"No": 0, "Yes": 1})')

  lines.push(
    '',
    '# X contains inputs; y contains only the answer the model must learn.',
    'X = df.drop("Bought", axis=1)',
    'y = df["Bought"]',
    '',
    '# Split first so the test set cannot teach the preprocessing step.',
    'X_train, X_test, y_train, y_test = train_test_split(',
    '    X,',
    '    y,',
    `    test_size=${options.testSize},`,
    '    random_state=42',
    ')',
  )

  if (options.scaling !== 'none') {
    const scaleColumns = Array.isArray(options.scaleColumns) ? options.scaleColumns : DEFAULT_CHOICES.scaleColumns
    lines.push(`numeric_columns = [column for column in ${JSON.stringify(scaleColumns)} if column in X_train.columns]`)
    const scaler = options.scaling === 'standard' ? 'StandardScaler' : 'MinMaxScaler'
    lines.push(
      `scaler = ${scaler}()`,
      '# Learn scaling values from training data only; reuse them on test data.',
      'X_train = X_train.copy()',
      'X_test = X_test.copy()',
      'X_train[numeric_columns] = scaler.fit_transform(X_train[numeric_columns])',
      'X_test[numeric_columns] = scaler.transform(X_test[numeric_columns])',
    )
  }

  lines.push(
    '',
    'print("Train rows:", len(X_train))',
    'print("Test rows:", len(X_test))',
  )

  return `${lines.join('\n')}\n`
}

export function formatValue(value) {
  if (isMissing(value)) return 'NULL'
  if (typeof value !== 'number') return String(value)
  const safeValue = Object.is(value, -0) ? 0 : value
  return safeValue.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(safeValue) ? 0 : 2,
  })
}

export { BASE_COLUMNS }
