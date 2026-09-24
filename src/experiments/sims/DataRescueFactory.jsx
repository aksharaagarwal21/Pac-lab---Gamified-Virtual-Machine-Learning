import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Binary,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Database,
  Factory,
  Gauge,
  Hammer,
  HeartPulse,
  LockKeyhole,
  Maximize2,
  Minimize2,
  PackageCheck,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Target,
  TerminalSquare,
  Trash2,
  TriangleAlert,
  Undo2,
  WandSparkles,
  Wrench,
  Zap,
} from 'lucide-react'
import { fullscreenElement, toggleElementFullscreen } from '../../components/lab/quizGameKit.jsx'
import { sfx } from '../../sound.js'
import {
  DEFAULT_CHOICES,
  RAW_DATASETS,
  buildPythonProgram,
  dataHealth,
  formatValue,
  transformDataset,
} from './dataRescueModel.js'
import './dataRescueFactory.css'

const STATIONS = [
  { short: 'Inspect', title: 'Data Detective', icon: ScanSearch, goal: 'Learn what every column is responsible for.' },
  { short: 'Missing', title: 'Missing Value Rescue', icon: HeartPulse, goal: 'Find two gaps and repair them without losing a person.' },
  { short: 'Duplicates', title: 'Clone Hunter', icon: Search, goal: 'Catch the customer who entered the factory twice.' },
  { short: 'Repair', title: 'Data Repair Station', icon: Wrench, goal: 'Make inconsistent labels agree and fix an impossible age.' },
  { short: 'Encode', title: 'Encoder Machine', icon: Binary, goal: 'Turn city names into fair, machine-readable switches.' },
  { short: 'Outliers', title: 'Outlier Patrol', icon: BarChart3, goal: 'Investigate the salary tower before making a decision.' },
  { short: 'Scale', title: 'Scale Balancer', icon: Gauge, goal: 'Bring age and salary onto comparable scales.' },
  { short: 'Forge', title: 'Feature Forge', icon: Hammer, goal: 'Craft useful information from columns you already have.' },
  { short: 'X / y', title: 'X / y Sorter', icon: Target, goal: 'Separate the clues from the answer the model must predict.' },
  { short: 'Split', title: 'Train / Test Splitter', icon: Split, goal: 'Protect unseen data in the testing vault.' },
  { short: 'Boss', title: 'Build the Pipeline', icon: Bot, goal: 'Assemble the complete workflow without step-by-step guidance.' },
]

const NUMERIC_COLUMNS = ['Age', 'Salary', 'Experience']
const INPUT_COLUMNS = ['Age', 'City', 'Salary', 'Experience', 'Salary_Per_Experience']
const BOSS_ORDER = ['load', 'check', 'missing', 'duplicates', 'invalid', 'encode', 'outliers', 'scale', 'feature', 'xy', 'split']
const BOSS_BLOCKS = [
  { id: 'encode', label: 'ENCODE CATEGORIES', icon: Binary },
  { id: 'load', label: 'LOAD DATA', icon: Database },
  { id: 'outliers', label: 'HANDLE OUTLIERS', icon: BarChart3 },
  { id: 'feature', label: 'FEATURE ENGINEERING', icon: Hammer },
  { id: 'check', label: 'CHECK DATA', icon: ScanSearch },
  { id: 'split', label: 'TRAIN / TEST SPLIT', icon: Split },
  { id: 'duplicates', label: 'REMOVE DUPLICATES', icon: PackageCheck },
  { id: 'scale', label: 'SCALE FEATURES', icon: Gauge },
  { id: 'invalid', label: 'FIX INVALID VALUES', icon: Wrench },
  { id: 'xy', label: 'SELECT X AND y', icon: Target },
  { id: 'missing', label: 'HANDLE MISSING VALUES', icon: HeartPulse },
]

const BOSS_WHY = {
  load: 'The factory needs a dataset before it can inspect or repair anything.',
  check: 'Inspect first. Otherwise you are changing data before you know what is broken.',
  missing: 'Repair empty cells before later calculations try to use them.',
  duplicates: 'Remove repeated records so they do not receive extra influence.',
  invalid: 'Standardize labels and repair impossible values before encoding.',
  encode: 'Categories must be consistent before they become numeric columns.',
  outliers: 'Investigate extreme values before scaling; they can distort the scale.',
  scale: 'The visual workflow balances feature ranges before model training.',
  feature: 'Create the derived feature while its source columns still have clear meaning.',
  xy: 'Choose inputs and the target before the final train/test split.',
  split: 'Reserve unseen examples, then fit learned preprocessing rules on train only.',
}

const CODE_BLANKS = [
  { code: 'df = pd.____("customers.csv")', answer: 'read_csv', options: ['open', 'read_csv', 'load_table'], why: '`read_csv` loads a comma-separated file into a Pandas DataFrame.' },
  { code: 'print(df.____())', answer: 'head', options: ['shape', 'head', 'peek'], why: '`head()` previews the first rows; `shape` is a property and does not show records.' },
  { code: 'df["Age"] = df["Age"].____(df["Age"].median())', answer: 'fillna', options: ['fillna', 'dropna', 'replace_all'], why: '`fillna()` targets the missing cells while keeping the rest of each row.' },
  { code: 'df = df.____()', answer: 'drop_duplicates', options: ['drop_columns', 'drop_duplicates', 'unique'], why: '`drop_duplicates()` returns the table without repeated rows.' },
  { code: 'df = pd.____(df, columns=["City"])', answer: 'get_dummies', options: ['get_dummies', 'label', 'make_numbers'], why: '`get_dummies()` creates one 0/1 switch column per city.' },
  { code: 'X = df.____("Bought", axis=1)', answer: 'drop', options: ['remove', 'drop', 'hide'], why: '`drop(..., axis=1)` leaves every input column except the target.' },
  { code: 'y = df["____"]', answer: 'Bought', options: ['Salary', 'Bought', 'City'], why: '`Bought` is the answer the model will learn to predict.' },
  { code: 'X_train, X_test, y_train, y_test = ____(X, y, test_size=0.2)', answer: 'train_test_split', options: ['split', 'train_test_split', 'random_split'], why: '`train_test_split` keeps 20% unseen when `test_size=0.2`.' },
]

const CODE_LEVELS = ['A · choose', 'A · choose', 'B · order', 'B · order', 'C · fill', 'C · decide', 'D · parameters', 'D · modify', 'E · compose', 'E · compose', 'FINAL · build']

const TOKEN_HELP = {
  df: 'This is our DataFrame: the whole customer dataset.',
  'df.head()': 'Ask Pandas to show the first few rows.',
  'df.isnull().sum()': 'Scan each column and count its missing cells.',
  '["Age"]': 'Select only the Age column.',
  '["Salary"]': 'Select only the Salary column.',
  'median()': 'Sort the observed values and use the middle one.',
  'fillna()': 'Replace missing values without deleting the row.',
  'duplicated()': 'Mark rows whose values repeat an earlier row.',
  'drop_duplicates()': 'Return the dataset with repeated rows removed.',
  '.str.lower()': 'Apply lowercase conversion to every text value in the column.',
  'pd.get_dummies': 'Create one binary column for each category.',
  StandardScaler: 'Create a scaler that learns a mean and standard deviation.',
  fit_transform: 'Learn from training data, then transform that same training data.',
  transform: 'Reuse the training rules on different data without learning again.',
  'axis=1': 'Work with a column. Axis 0 would mean rows.',
  'test_size=0.2': 'Reserve 20% of the data for the unseen test set.',
  'random_state=42': 'Keep the random split reproducible.',
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const freshChoices = () => ({
  ...DEFAULT_CHOICES,
  fillMissing: {},
  removeDuplicates: false,
  normalizeCity: false,
  fixInvalidAge: false,
  encoding: null,
  outlier: null,
  scaling: null,
  featureEngineering: false,
  xColumns: [],
  targetColumn: null,
  testSize: null,
})

function Feedback({ tone, children }) {
  const Icon = tone === 'success' ? Check : tone === 'warning' ? TriangleAlert : tone === 'retry' ? RefreshCw : Sparkles
  return <div className={`dr-feedback is-${tone}`} role="status" aria-live="polite"><Icon aria-hidden="true" /><span>{children}</span></div>
}

function CodeDock({ station, code, output, onTip }) {
  const terms = Object.keys(TOKEN_HELP).sort((a, b) => b.length - a.length)
  const matcher = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'g')
  const chunks = String(code).split(matcher)
  return <section className="dr-code-dock" aria-labelledby="dr-code-title">
    <header className="dr-panel-head">
      <span><TerminalSquare aria-hidden="true" /> CODE VIEW</span>
      <small>{CODE_LEVELS[station]}</small>
    </header>
    <div className="dr-code-body">
      <div className="dr-editor-bar"><i /><i /><i /><span>preprocessing.py</span><b><Play /> SYNCED</b></div>
      <pre className="dr-code"><code>{chunks.map((chunk, index) => TOKEN_HELP[chunk]
        ? <button type="button" key={`${chunk}-${index}`} className="dr-code-token" onClick={() => onTip(chunk)} title={`Explain ${chunk}`}>{chunk}</button>
        : <span key={index}>{chunk}</span>)}</code></pre>
      <div className="dr-code-output"><span>OUTPUT</span><p>{output}</p></div>
    </div>
  </section>
}

function DatasetTable({ data, station, choices, highlightColumns, highlightCells, highlightRows, onColumn, onCell, onRow }) {
  const columns = data.columns ?? Object.keys(data.rows?.[0] ?? {}).filter((key) => key !== 'id')
  return <section className="dr-data-panel" aria-labelledby="dr-data-title">
    <header className="dr-panel-head">
      <span id="dr-data-title"><Database aria-hidden="true" /> DATASET VIEW</span>
      <small>{data.rows.length} ROWS · {columns.length} COLUMNS</small>
    </header>
    <div className="dr-table-wrap">
      <table className="dr-table">
        <caption>Customer dataset after the operations completed so far</caption>
        <thead><tr><th scope="col" className="dr-row-number">#</th>{columns.map((column) => <th key={column} scope="col">
          <button type="button" className={highlightColumns.includes(column) ? 'is-selected' : ''} onClick={() => onColumn?.(column)}>{column.replaceAll('_', ' ')}</button>
        </th>)}</tr></thead>
        <tbody>{data.rows.map((row, rowIndex) => {
          const rowId = row.id ?? `row-${rowIndex}`
          return <tr key={rowId} className={`${highlightRows.includes(rowId) ? 'is-highlighted' : ''}${row.Split === 'TEST' ? ' is-test' : ''}`} onClick={() => onRow?.(rowId, row)}>
            <th scope="row" className="dr-row-number">{String(rowIndex + 1).padStart(2, '0')}</th>
            {columns.map((column) => {
              const key = `${rowId}:${column}`
              const value = row[column]
              const broken = value == null
              const outlier = (station === 3 && column === 'Age' && value === 190) || (station === 5 && column === 'Salary' && value === 900000)
              const changed = (choices.fillMissing?.[column] && ['Age', 'Salary'].includes(column)) ||
                (choices.normalizeCity && column === 'City') || (choices.fixInvalidAge && column === 'Age' && rowId === 'kabir') ||
                (choices.encoding && column.startsWith('City_')) || (choices.scaling && ['Age', 'Salary'].includes(column)) ||
                (choices.featureEngineering && column === 'Salary_Per_Experience')
              return <td key={column}>
                <button type="button" className={`dr-cell${broken ? ' is-broken' : ''}${outlier ? ' is-outlier' : ''}${changed ? ' is-changed' : ''}${highlightCells.includes(key) ? ' is-selected' : ''}`}
                  onClick={(event) => { event.stopPropagation(); onCell?.(rowId, column, value, row) }}>
                  {broken ? <><TriangleAlert /><span>NULL</span></> : formatValue(value, column)}
                </button>
              </td>
            })}</tr>
        })}</tbody>
      </table>
    </div>
    <footer className="dr-data-legend"><span><i className="is-alert" /> issue</span><span><i className="is-change" /> transformed</span><span><i className="is-test" /> test data</span></footer>
  </section>
}

function MissionButton({ active = false, success = false, children, className = '', ...props }) {
  return <button type="button" className={`dr-choice${active ? ' is-active' : ''}${success ? ' is-success' : ''} ${className}`} {...props}>{children}</button>
}

export default function DataRescueFactory({ onSaveResult, onUsePython }) {
  const stageRef = useRef(null)
  const [datasetKey, setDatasetKey] = useState('primary')
  const [station, setStation] = useState(0)
  const [completed, setCompleted] = useState([])
  const [choices, setChoices] = useState(freshChoices)
  const [feedback, setFeedback] = useState({ tone: 'info', text: 'Start by finding the column that contains the answer we want to predict.' })
  const [full, setFull] = useState(false)
  const [saved, setSaved] = useState(false)
  const [codeTip, setCodeTip] = useState(null)
  const [showPipeline, setShowPipeline] = useState(false)

  const [detectiveStep, setDetectiveStep] = useState(0)
  const [numericFound, setNumericFound] = useState([])
  const [command, setCommand] = useState(null)
  const [missingFound, setMissingFound] = useState([])
  const [scannerRun, setScannerRun] = useState(false)
  const [duplicateFound, setDuplicateFound] = useState(false)
  const [cityInspected, setCityInspected] = useState(false)
  const [invalidFound, setInvalidFound] = useState(false)
  const [encodingPreview, setEncodingPreview] = useState(null)
  const [outlierFound, setOutlierFound] = useState(false)
  const [outlierInvestigated, setOutlierInvestigated] = useState(false)
  const [scalePreview, setScalePreview] = useState('standard')
  const [forgeParts, setForgeParts] = useState([])
  const [xy, setXy] = useState({ X: [], y: null })
  const [testBatches, setTestBatches] = useState([])
  const [bossOrder, setBossOrder] = useState([])
  const [bossPhase, setBossPhase] = useState('order')
  const [codeBlank, setCodeBlank] = useState(0)

  const raw = RAW_DATASETS[datasetKey]
  const data = useMemo(() => transformDataset(raw, choices), [raw, choices])
  const health = dataHealth(completed.filter((value) => value < 10))
  const cleared = completed.includes(station)
  const maxUnlocked = Math.min(completed.length, STATIONS.length - 1)
  const current = STATIONS[station]
  const ages = raw.filter((row) => row.Age != null && row.Age <= 100).map((row) => row.Age)
  const salaries = raw.filter((row) => row.Salary != null && row.Salary < 100000).map((row) => row.Salary)
  const ageMedian = median(ages)
  const salaryMedian = median(salaries)

  useEffect(() => {
    const changed = () => setFull(fullscreenElement() === stageRef.current)
    document.addEventListener('fullscreenchange', changed)
    document.addEventListener('webkitfullscreenchange', changed)
    return () => {
      document.removeEventListener('fullscreenchange', changed)
      document.removeEventListener('webkitfullscreenchange', changed)
    }
  }, [])

  const tell = (text, tone = 'info') => setFeedback({ text, tone })
  const updateChoices = (next) => {
    setChoices((previous) => ({ ...previous, ...next }))
    setSaved(false)
  }
  const finish = (text) => {
    setCompleted((previous) => previous.includes(station) ? previous : [...previous, station])
    tell(text, 'success')
    setSaved(false)
    sfx.coin()
  }
  const go = (next) => {
    if (next < 0 || next > maxUnlocked || next >= STATIONS.length) return
    setStation(next)
    setCodeTip(null)
    tell(completed.includes(next) ? 'Station already cleared. Revisit the transformation or continue forward.' : STATIONS[next].goal)
    sfx.select()
  }

  const resetAll = (nextDataset = datasetKey) => {
    setDatasetKey(nextDataset)
    setStation(0); setCompleted([]); setChoices(freshChoices()); setSaved(false); setCodeTip(null); setShowPipeline(false)
    setDetectiveStep(0); setNumericFound([]); setCommand(null); setMissingFound([]); setScannerRun(false)
    setDuplicateFound(false); setCityInspected(false); setInvalidFound(false); setEncodingPreview(null)
    setOutlierFound(false); setOutlierInvestigated(false); setScalePreview('standard'); setForgeParts([])
    setXy({ X: [], y: null }); setTestBatches([]); setBossOrder([]); setBossPhase('order'); setCodeBlank(0)
    tell('Fresh shift loaded. Find the target column to begin.', 'info')
    sfx.replay()
  }

  const codeForStation = () => {
    if (station === 0) return detectiveStep >= 4 ? 'df.head()\n# first 5 customer records' : `df.${command ? command : '____'}()\n# choose the command that previews rows`
    if (station === 1) return scannerRun
      ? `df.isnull().sum()\n\ndf["Age"] = df["Age"].fillna(df["Age"].median())\ndf["Salary"] = df["Salary"].fillna(df["Salary"].median())`
      : 'df.isnull().sum()\n# scan every column for missing values'
    if (station === 2) return choices.removeDuplicates ? 'df = df.drop_duplicates()\n# rows: 7 → 6' : 'mask = df.duplicated()\nprint(mask)'
    if (station === 3) return `df["City"] = df["City"].str.lower()\n\ndf.loc[df["Age"] > 100, "Age"] = df["Age"].median()`
    if (station === 4) return choices.encoding === 'onehot' ? 'df = pd.get_dummies(df, columns=["City"])' : 'df["City_code"] = df["City"].astype("category").cat.codes'
    if (station === 5) return choices.outlier === 'remove'
      ? 'df = df[df["Salary"] < 900000]'
      : choices.outlier === 'keep' ? '# KEEP after investigation\n# document why ₹900,000 is plausible' : 'df["Salary"] = df["Salary"].clip(upper=61125)'
    if (station === 6) return scalePreview === 'minmax'
      ? 'from sklearn.preprocessing import MinMaxScaler\nscaler = MinMaxScaler()\nX_train[num] = scaler.fit_transform(X_train[num])'
      : 'from sklearn.preprocessing import StandardScaler\nscaler = StandardScaler()\nX_train[num] = scaler.fit_transform(X_train[num])\nX_test[num] = scaler.transform(X_test[num])'
    if (station === 7) return 'df["Salary_Per_Experience"] = (\n    df["Salary"] / df["Experience"]\n)'
    if (station === 8) return 'X = df.drop("Bought", axis=1)\ny = df["Bought"]'
    if (station === 9) return 'X_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, random_state=42\n)'
    const blank = CODE_BLANKS[Math.min(codeBlank, CODE_BLANKS.length - 1)]
    return bossPhase === 'order' ? bossOrder.map((id, index) => `${index + 1}. ${BOSS_BLOCKS.find((block) => block.id === id)?.label}`).join('\n') || '# Assemble the workflow blocks' : blank.code
  }

  const codeOutput = () => {
    if (codeTip) return `${codeTip} → ${TOKEN_HELP[codeTip]}`
    if (station === 0) return detectiveStep >= 4 ? '5 rows × 6 columns displayed' : 'Waiting for a real Pandas command…'
    if (station === 1) return scannerRun ? `Age → 1 missing · Salary → 1 missing` : 'Scanner idle'
    if (station === 2) return choices.removeDuplicates ? 'Rows before: 7 · rows after: 6' : duplicateFound ? 'Row 4 → duplicate: True' : 'Compare the records'
    if (station === 3) return choices.fixInvalidAge ? 'City labels consistent · invalid age repaired' : 'Repair log awaiting both fixes'
    if (station === 4) return choices.encoding ? '4 city switch columns created' : 'MODEL ERROR · text category received'
    if (station === 5) return outlierInvestigated ? `Decision log: ${choices.outlier ?? 'investigation open'}` : 'Salary distribution awaiting inspection'
    if (station === 6) return choices.scaling ? `${choices.scaling} preview complete · final fit waits for train data` : 'Age 20–24 vs Salary ₹30k–₹900k'
    if (station === 7) return choices.featureEngineering ? 'New feature forged for every retained row' : 'Forge empty'
    if (station === 8) return xy.y ? `X: ${xy.X.length} features · y: ${xy.y}` : 'Sorter waiting'
    if (station === 9) return choices.testSize ? '80 training cards · 20 testing cards' : `${testBatches.length * 10}% selected for testing`
    return bossPhase === 'order' ? `${bossOrder.length} / ${BOSS_ORDER.length} blocks placed` : `${codeBlank} / ${CODE_BLANKS.length} blanks solved`
  }

  const handleColumn = (column) => {
    if (station !== 0 || cleared) return
    if (detectiveStep === 0) {
      if (column === 'Bought') { setDetectiveStep(1); tell('Correct — Bought is the target: the answer the model must learn.', 'success'); sfx.coin() }
      else tell(`${column} describes the customer. It is an input feature, not the answer.`, 'retry')
      return
    }
    if (detectiveStep === 1) {
      if (!NUMERIC_COLUMNS.includes(column)) { tell(`${column} contains ${column === 'City' || column === 'Name' ? 'categories/text' : 'the target'}, not numerical measurements.`, 'retry'); return }
      setNumericFound((previous) => previous.includes(column) ? previous.filter((item) => item !== column) : [...previous, column])
      tell(`${column} selected. Numerical features contain measurable numbers.`)
      return
    }
    if (detectiveStep === 2) {
      if (column === 'City') { setDetectiveStep(3); tell('Exactly — City is categorical. Its values are labels, not quantities.', 'success'); sfx.coin() }
      else tell(`${column} is not the category mission. Look for labels such as Chennai and Delhi.`, 'retry')
    }
  }

  const lockNumeric = () => {
    if (NUMERIC_COLUMNS.every((column) => numericFound.includes(column)) && numericFound.length === NUMERIC_COLUMNS.length) {
      setDetectiveStep(2); tell('All three numerical features locked: Age, Salary, and Experience.', 'success'); sfx.coin()
    } else tell('Select Age, Salary, and Experience — all three are measured with numbers.', 'retry')
  }

  const runHead = () => {
    if (command !== 'head') { tell(`df.${command ?? '____'}() is not the row preview command. Nothing in the dataset changed — try head.`, 'retry'); return }
    setDetectiveStep(4)
    finish('Inspection complete. You connected df.head() to the first five rows on screen.')
  }

  const handleCell = (rowId, column, value) => {
    if (cleared) return
    if (station === 1 && value == null && ['Age', 'Salary'].includes(column)) {
      const key = `${rowId}:${column}`
      setMissingFound((previous) => previous.includes(key) ? previous : [...previous, key])
      tell(`${column} gap found. ${missingFound.includes(key) ? 'You already marked this one.' : `${Math.min(2, missingFound.length + 1)} of 2 missing cells located.`}`, 'success')
      sfx.select()
    }
    if (station === 3 && column === 'City') {
      setCityInspected(true)
      tell('Chennai, chennai, Delhi and DELHI look different to a computer even when they mean the same place.', 'warning')
    }
    if (station === 3 && column === 'Age' && value === 190) {
      setInvalidFound(true)
      tell('Age 190 is possible in pure mathematics, but implausible for this customer dataset. Flag it for repair.', 'warning')
    }
    if (station === 5 && column === 'Salary' && value === 900000) {
      setOutlierFound(true)
      tell('₹900,000 is dramatically larger than every other salary. It is a possible outlier — investigate, do not auto-delete.', 'warning')
      sfx.select()
    }
  }

  const repairMissing = (column, method) => {
    if (method === 'mode') { tell(`Mode is useful for names such as City. ${column} is numeric, so mode could pick an arbitrary repeated value.`, 'retry'); return }
    const rawValues = column === 'Age' ? raw.filter((row) => row.Age != null).map((row) => row.Age) : raw.filter((row) => row.Salary != null).map((row) => row.Salary)
    const meanValue = rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length
    if (method === 'mean') {
      tell(`Mean would fill ${column} with ${formatValue(meanValue, column)}. The extreme value pulls that answer upward, so retry with the robust middle value.`, 'warning')
      return
    }
    const nextFill = { ...(choices.fillMissing ?? {}), [column]: 'median' }
    updateChoices({ fillMissing: nextFill })
    const value = column === 'Age' ? ageMedian : salaryMedian
    tell(`${column} repaired with median ${formatValue(value, column)}. The row stays in the dataset.`, 'success')
    sfx.coin()
    if (nextFill.Age && nextFill.Salary) finish('Both missing values are repaired. No customer record was thrown away.')
  }

  const handleRow = (rowId) => {
    if (station !== 2 || cleared) return
    if (rowId === 'riya-b') { setDuplicateFound(true); tell('Clone detected: this Riya row matches the one directly above it in every column.', 'success'); sfx.coin() }
    else tell('That row has at least one unique value. Compare Name, Age, City, Salary, Experience, and Bought.', 'retry')
  }

  const removeDuplicate = () => {
    updateChoices({ removeDuplicates: true })
    finish('Duplicate extracted from the conveyor. Rows changed from 7 to 6, so Riya no longer gets double influence.')
  }

  const normalizeCities = () => {
    if (!cityInspected) { tell('Inspect a City cell first so you can see why the labels disagree.', 'retry'); return }
    updateChoices({ normalizeCity: true })
    tell('City labels converted to lowercase: Chennai and CHENNAI now become the same category.', 'success')
    sfx.powerUp()
  }

  const fixAge = () => {
    if (!invalidFound) { tell('Find the age that does not make sense for this customer dataset.', 'retry'); return }
    updateChoices({ fixInvalidAge: true })
    if (choices.normalizeCity) finish(`Repair station clear. Age 190 was replaced with the valid median, ${formatValue(ageMedian, 'Age')}.`)
    else tell(`Age 190 replaced with median ${formatValue(ageMedian, 'Age')}. City labels still need one shared format.`, 'success')
  }

  const maybeFinishRepair = () => {
    if (choices.fixInvalidAge) finish('Repair station clear. City labels agree and the impossible age is repaired.')
    else tell('City labels agree. Now find and repair the impossible age.', 'success')
  }

  const applyEncoding = () => {
    if (encodingPreview !== 'onehot') {
      tell('Label numbers can invent an order — Mumbai = 3 is not “more” than Delhi = 2. Preview the independent switches.', 'warning')
      return
    }
    updateChoices({ encoding: 'onehot' })
    finish('Encoder online. Each city now has its own 0/1 switch, with no false ranking.')
  }

  const chooseOutlier = (decision) => {
    if (!outlierInvestigated) { tell('Investigate first. Extreme does not automatically mean wrong.', 'retry'); return }
    updateChoices({ outlier: decision })
    const copy = decision === 'keep'
      ? 'Decision recorded: keep the value with a note. A valid high earner should not be erased just for being unusual.'
      : decision === 'remove'
        ? 'Decision recorded: remove the suspicious record. This loses the other information in Kabir’s row.'
        : 'Decision recorded: cap the salary at the IQR safety fence, keeping the row while limiting its pull.'
    finish(copy)
  }

  const applyScale = () => {
    updateChoices({ scaling: scalePreview })
    finish(`${scalePreview === 'standard' ? 'Standardization' : 'Normalization'} preview complete. The final program will fit this scaler on X_train only, then reuse it on X_test.`)
  }

  const toggleForge = (part) => {
    setForgeParts((previous) => previous.includes(part) ? previous.filter((item) => item !== part) : [...previous, part])
    tell(`${part} ${forgeParts.includes(part) ? 'removed from' : 'dropped into'} the forge.`)
  }

  const forgeFeature = () => {
    if (!(forgeParts.includes('Salary') && forgeParts.includes('Experience')) || forgeParts.length !== 2) {
      tell('Salary per Experience needs exactly two ingredients: Salary ÷ Experience.', 'retry')
      return
    }
    updateChoices({ featureEngineering: true })
    finish('New feature forged: Salary_Per_Experience. It expresses earning level relative to experience.')
  }

  const assignColumn = (column, zone) => {
    if (zone === 'X' && column === 'Bought') {
      tell('Target leakage! Putting Bought in X gives the model the answer before the test. The sorter rejected it.', 'warning')
      return
    }
    if (zone === 'y' && column !== 'Bought') {
      tell(`${column} is evidence about a customer, not the answer. Put it in X.`, 'retry')
      return
    }
    if (zone === 'y') setXy((previous) => ({ ...previous, y: column }))
    else setXy((previous) => ({ ...previous, X: previous.X.includes(column) ? previous.X : [...previous.X, column] }))
    tell(`${column} moved to ${zone}.`, 'success')
  }

  const validateXY = () => {
    if (xy.y !== 'Bought' || !INPUT_COLUMNS.every((column) => xy.X.includes(column))) {
      tell('The sorter still needs all five input groups in X and Bought alone in y.', 'retry')
      return
    }
    updateChoices({ xColumns: xy.X, targetColumn: xy.y })
    finish('Sorter locked. X contains the clues; y contains only the answer, Bought.')
  }

  const toggleBatch = (batch) => {
    setTestBatches((previous) => previous.includes(batch) ? previous.filter((item) => item !== batch) : previous.length < 2 ? [...previous, batch] : previous)
    tell('Choose exactly two of ten batches for the testing vault.')
  }

  const splitData = () => {
    if (testBatches.length !== 2) { tell(`You selected ${testBatches.length * 10}%. Select two batches to reserve 20%.`, 'retry'); return }
    updateChoices({ testSize: 0.2, testBatches })
    finish('Split complete: 80% trains the model and 20% stays unseen. Learned preprocessing rules now fit on train only.')
  }

  const placeBossBlock = (id) => {
    const expected = BOSS_ORDER[bossOrder.length]
    if (id !== expected) { tell(`${BOSS_BLOCKS.find((block) => block.id === id)?.label} cannot go here yet. ${BOSS_WHY[expected]}`, 'warning'); sfx.back(); return }
    const next = [...bossOrder, id]
    setBossOrder(next)
    tell(`${BOSS_BLOCKS.find((block) => block.id === id)?.label} locked into slot ${next.length}.`, 'success')
    sfx.select()
    if (next.length === BOSS_ORDER.length) {
      setBossPhase('code')
      tell('Workflow assembled. Code mode unlocked — repair each blank to start the factory.', 'success')
      sfx.powerUp()
    }
  }

  const answerBlank = (answer) => {
    const blank = CODE_BLANKS[codeBlank]
    if (answer !== blank.answer) { tell(`${answer} does not complete this operation. ${blank.why}`, 'retry'); sfx.back(); return }
    if (codeBlank === CODE_BLANKS.length - 1) {
      setCodeBlank(CODE_BLANKS.length)
      finish('Pipeline executed. The broken customer table is now ready for machine learning.')
      sfx.powerUp()
    } else {
      setCodeBlank((value) => value + 1)
      tell(`${answer} accepted. ${blank.why}`, 'success')
      sfx.coin()
    }
  }

  const saveResult = () => {
    if (!completed.includes(10)) return
    onSaveResult?.({
      title: 'Data Rescue — ML-ready pipeline complete',
      metrics: [
        { label: 'Data health', value: '100%' },
        { label: 'Factory stations', value: '10/10 + final boss' },
        { label: 'Rows retained', value: `${data.rows.length}/${raw.length}` },
        { label: 'Missing values', value: '0' },
        { label: 'Outlier decision', value: choices.outlier ?? 'investigated' },
        { label: 'Encoding / scaling', value: `${choices.encoding} / ${choices.scaling}` },
        { label: 'Train / test', value: '80% / 20%' },
      ],
      explanation: 'Inspected the dataset, repaired missing and inconsistent values, removed a duplicate, encoded categories, investigated an outlier, scaled numeric features, engineered a feature, separated X/y, and protected a held-out test set. The exported program fits learned preprocessing rules on training data only.',
    })
    setSaved(true)
    sfx.coin()
  }

  const openPython = async () => {
    if (fullscreenElement() === stageRef.current) {
      try { await (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document) } catch { tell('Exit fullscreen, then open the code challenge.', 'warning'); return }
    }
    onUsePython?.(buildPythonProgram(choices))
  }

  let highlightColumns = []
  let highlightCells = []
  let highlightRows = []
  if (station === 0) highlightColumns = detectiveStep === 0 ? ['Bought'] : detectiveStep === 1 ? numericFound : detectiveStep === 2 ? ['City'] : []
  if (station === 1) highlightCells = missingFound
  if (station === 2 && duplicateFound) highlightRows = ['riya-a', 'riya-b']
  if (station === 3) highlightColumns = ['City', 'Age']
  if (station === 4) highlightColumns = choices.encoding ? data.columns.filter((column) => column.startsWith('City_')) : ['City']
  if (station === 5) highlightColumns = ['Salary']
  if (station === 6) highlightColumns = ['Age', 'Salary']
  if (station === 7) highlightColumns = ['Salary', 'Experience', ...(choices.featureEngineering ? ['Salary_Per_Experience'] : [])]
  if (station === 8) highlightColumns = [...xy.X, ...(xy.y ? [xy.y] : [])]

  const renderFactory = () => {
    if (station === 0) return <>
      <div className="dr-mission-card"><span>MISSION {Math.min(detectiveStep + 1, 4)} / 4</span><h5>{detectiveStep === 0 ? 'Find the target column' : detectiveStep === 1 ? 'Select every numerical feature' : detectiveStep === 2 ? 'Find the categorical feature' : 'Complete the preview command'}</h5><p>{detectiveStep === 0 ? 'The target is the answer the model will learn to predict.' : detectiveStep === 1 ? 'Click Age, Salary, and Experience, then lock your selection.' : detectiveStep === 2 ? 'Look for a column made of labels rather than measurements.' : 'Pandas needs one real method name.'}</p></div>
      {detectiveStep === 1 && <button type="button" className="dr-run" onClick={lockNumeric}><LockKeyhole /> Lock {numericFound.length}/3 numerical features</button>}
      {detectiveStep === 3 && <div className="dr-command-builder"><code>df.<b>{command ?? '____'}</b>()</code><div>{['head', 'jump', 'open', 'repair'].map((item) => <MissionButton key={item} active={command === item} onClick={() => { setCommand(item); tell(item === 'head' ? 'That command sounds promising. Run it and watch the table.' : `Pandas has no df.${item}() command for previewing rows.`, item === 'head' ? 'success' : 'retry') }}>{item}</MissionButton>)}</div><button type="button" className="dr-run" onClick={runHead}><Play /> Run command</button></div>}
      <div className="dr-concept-strip"><span><b>ROW</b> one record</span><span><b>COLUMN</b> one property</span><span><b>FEATURE</b> model input</span><span><b>TARGET</b> answer</span></div>
    </>

    if (station === 1) {
      const ready = missingFound.length >= 2
      const activeColumn = !choices.fillMissing?.Age ? 'Age' : !choices.fillMissing?.Salary ? 'Salary' : null
      return <>
        {!ready && <div className="dr-scanner-scene"><div className="dr-scan-beam" /><HeartPulse /><h5>2 DATA PIECES ARE MISSING</h5><p>Tap the damaged cells in the dataset.</p><strong>{missingFound.length} / 2 FOUND</strong></div>}
        {ready && !scannerRun && <div className="dr-scanner-scene is-ready"><ScanSearch /><h5>GAPS LOCATED</h5><p>Now let Pandas count them by column.</p><button type="button" className="dr-run" onClick={() => { setScannerRun(true); tell('Scanner complete: Age has 1 missing value; Salary has 1.', 'success'); sfx.powerUp() }}><Zap /> Run missing-value scan</button></div>}
        {scannerRun && activeColumn && <div className="dr-repair-bay"><span className="dr-bay-label">REPAIRING {activeColumn.toUpperCase()}</span><div className="dr-number-line">{(activeColumn === 'Age' ? ages : salaries).map((value, index) => <span key={`${value}-${index}`}>{formatValue(value, activeColumn)}</span>)}<span className="is-gap">?</span></div><p>Choose a replacement rule. Try choices safely — the table changes only after a sensible decision.</p><div className="dr-choice-grid">{['mean', 'median', 'mode'].map((method) => <MissionButton key={method} onClick={() => repairMissing(activeColumn, method)}><b>{method.toUpperCase()}</b><small>{method === 'mean' ? 'average of all values' : method === 'median' ? 'robust middle value' : 'most frequent value'}</small></MissionButton>)}</div>{activeColumn === 'Age' && <div className="dr-calculation"><span>Sorted valid ages</span><b>20 · 21 · 22 · 22 · 24 · 190</b><em>Median = (22 + 22) ÷ 2 = 22</em></div>}</div>}
      </>
    }

    if (station === 2) return <>
      <div className="dr-clone-scene"><div className={`dr-id-card${duplicateFound ? ' is-clone' : ''}`}><span>03</span><b>RIYA</b><small>22 · chennai · ₹42k · 2 · Yes</small></div><div className={`dr-id-card${duplicateFound ? ' is-clone' : ''}`}><span>04</span><b>RIYA</b><small>22 · chennai · ₹42k · 2 · Yes</small></div><div className="dr-clone-link">{duplicateFound ? <><Zap /> EXACT MATCH</> : <><Search /> compare rows</>}</div></div>
      <p className="dr-microcopy">Tap the repeated row in the dataset. A duplicate can make one pattern look more important than it is.</p>
      {duplicateFound && <button type="button" className="dr-run is-danger" onClick={removeDuplicate}><Trash2 /> Execute drop_duplicates()</button>}
      <div className="dr-before-after"><span><small>ROWS BEFORE</small><b>7</b></span><ChevronRight /><span className={choices.removeDuplicates ? 'is-done' : ''}><small>ROWS AFTER</small><b>{choices.removeDuplicates ? 6 : '?'}</b></span></div>
    </>

    if (station === 3) return <>
      <div className="dr-repair-grid"><article className={choices.normalizeCity ? 'is-done' : ''}><span className="dr-machine-icon"><WandSparkles /></span><h5>CASE CALIBRATOR</h5><div className="dr-label-cloud"><i>Chennai</i><i>chennai</i><i>DELHI</i><i>Delhi</i></div><p>Are these really four different places?</p><button type="button" className="dr-run" onClick={() => { normalizeCities(); if (cityInspected) setTimeout(maybeFinishRepair, 0) }} disabled={choices.normalizeCity}>{choices.normalizeCity ? <><Check /> labels aligned</> : 'Convert to lowercase'}</button></article><article className={choices.fixInvalidAge ? 'is-done' : ''}><span className="dr-machine-icon"><TriangleAlert /></span><h5>VALIDITY GATE</h5><div className="dr-age-dial"><span>20</span><span>24</span><strong>190</strong></div><p>Tap Age 190 in the table, then repair it.</p><button type="button" className="dr-run" onClick={fixAge} disabled={choices.fixInvalidAge}>{choices.fixInvalidAge ? <><Check /> age repaired</> : `Replace with median ${ageMedian}`}</button></article></div>
    </>

    if (station === 4) return <>
      <div className="dr-model-error"><Bot /><div><span>ML ROBOT · INPUT ERROR</span><strong>I UNDERSTAND NUMBERS, NOT CITY LABELS.</strong></div></div>
      <div className="dr-encoder-tabs"><MissionButton active={encodingPreview === 'label'} onClick={() => { setEncodingPreview('label'); tell('Label encoding uses one number per city, but those numbers can imply a false order.', 'warning') }}><b>LABEL ENCODING</b><small>Delhi → 0 · Mumbai → 1</small></MissionButton><MissionButton active={encodingPreview === 'onehot'} onClick={() => { setEncodingPreview('onehot'); tell('One-hot encoding gives each city an independent switch.', 'success') }}><b>ONE-HOT SWITCHES</b><small>No category ranks above another</small></MissionButton></div>
      <div className="dr-encoder-machine"><span className="dr-ticket">CHENNAI</span><ChevronRight />{encodingPreview === 'label' ? <div className="dr-label-output"><strong>1</strong><small>But does 1 mean “more city”?</small></div> : <div className="dr-bits">{['bangalore', 'chennai', 'delhi', 'mumbai'].map((city) => <span key={city} className={city === 'chennai' ? 'is-on' : ''}><b>{Number(city === 'chennai')}</b><small>{city}</small></span>)}</div>}</div>
      <button type="button" className="dr-run" onClick={applyEncoding} disabled={!encodingPreview}><Play /> Execute encoder</button>
    </>

    if (station === 5) {
      const values = data.rows.map((row) => ({ id: row.id, name: row.Name, value: row.Salary })).filter((item) => typeof item.value === 'number')
      const max = Math.max(...values.map((item) => item.value), 1)
      return <>
        <div className="dr-towers" aria-label="Salary tower comparison">{values.map((item) => <button type="button" key={item.id} className={item.value === 900000 ? `is-boss${outlierFound ? ' is-found' : ''}` : ''} onClick={() => item.value === 900000 && handleCell(item.id, 'Salary', item.value)}><span>{formatValue(item.value, 'Salary')}</span><i style={{ '--tower': `${Math.max(8, (item.value / max) * 100)}%` }} /><small>{item.name}</small></button>)}</div>
        {!outlierFound ? <p className="dr-microcopy">Which tower looks unusually different? Tap it to inspect.</p> : !outlierInvestigated ? <button type="button" className="dr-run" onClick={() => { setOutlierInvestigated(true); tell('Investigation log: most salaries are ₹30k–₹48k. ₹900k may be genuine or a data-entry error; context decides.', 'success') }}><Search /> Investigate before deciding</button> : <div className="dr-decision-grid"><MissionButton onClick={() => chooseOutlier('keep')}><Search /><b>KEEP</b><small>Valid extreme, document it</small></MissionButton><MissionButton onClick={() => chooseOutlier('remove')}><Trash2 /><b>REMOVE</b><small>Lose the entire row</small></MissionButton><MissionButton onClick={() => chooseOutlier('cap')}><ShieldCheck /><b>CAP</b><small>Limit pull, keep the row</small></MissionButton></div>}
        <details className="dr-iqr"><summary>Optional: see the IQR safety fence</summary><div><span>Q1 ₹36,750</span><span>Median ₹42,000</span><span>Q3 ₹46,500</span><b>Upper fence ≈ ₹61,125</b></div></details>
      </>
    }

    if (station === 6) return <>
      <div className="dr-scale-compare"><article><small>BEFORE</small><div><span>AGE 21</span><i style={{ '--size': '12%' }} /></div><div><span>SALARY ₹48,000</span><i style={{ '--size': '96%' }} /></div></article><div className="dr-scale-core"><Gauge /><b>SCALE</b><span>fit → transform</span></div><article className="is-after"><small>AFTER</small><div><span>AGE ≈ −0.5</span><i style={{ '--size': '48%' }} /></div><div><span>SALARY ≈ 0.4</span><i style={{ '--size': '45%' }} /></div></article></div>
      <div className="dr-encoder-tabs"><MissionButton active={scalePreview === 'standard'} onClick={() => { setScalePreview('standard'); tell('Standardization centers each training feature around 0 with a standard deviation near 1.') }}><b>STANDARDIZATION</b><small>Usually the default</small></MissionButton><MissionButton active={scalePreview === 'minmax'} onClick={() => { setScalePreview('minmax'); tell('Normalization squeezes training values into 0–1, but is sensitive to outliers.') }}><b>NORMALIZATION</b><small>Maps training range to 0–1</small></MissionButton></div>
      <div className="dr-leak-note"><LockKeyhole /><p><b>Leakage shield:</b> this is a visual preview. The final code splits first, fits the scaler on X_train, then only transforms X_test.</p></div>
      <button type="button" className="dr-run" onClick={applyScale}><Zap /> Launch through scale gate</button>
    </>

    if (station === 7) return <>
      <div className="dr-forge"><div className="dr-parts">{['Salary', 'Experience', 'Age'].map((part) => <button type="button" key={part} className={forgeParts.includes(part) ? 'is-selected' : ''} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', part)} onClick={() => toggleForge(part)}><Database /><b>{part}</b><small>tap or drag</small></button>)}</div><div className={`dr-forge-core${forgeParts.length ? ' is-hot' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => toggleForge(event.dataTransfer.getData('text/plain'))}><Hammer /><strong>{forgeParts.length ? forgeParts.join(' ÷ ') : 'DROP FEATURES'}</strong><span>CRAFTING FORGE</span></div><div className={`dr-crafted${choices.featureEngineering ? ' is-ready' : ''}`}><Sparkles /><b>Salary_Per_Experience</b><small>{choices.featureEngineering ? 'new column created' : 'locked recipe'}</small></div></div>
      <p className="dr-microcopy">Recipe: combine Salary and Experience to express earning level per year of experience.</p>
      <button type="button" className="dr-run" onClick={forgeFeature}><Hammer /> Forge selected features</button>
    </>

    if (station === 8) return <>
      <div className="dr-sorter"><div className="dr-column-cards">{[...INPUT_COLUMNS, 'Bought'].map((column) => <button type="button" key={column} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', column)} onClick={() => assignColumn(column, column === 'Bought' ? 'y' : 'X')} disabled={xy.X.includes(column) || xy.y === column}><span>{column}</span><small>drag or tap</small></button>)}</div><div className="dr-drop-zones"><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => assignColumn(event.dataTransfer.getData('text/plain'), 'X')}><b>X · INPUTS</b><p>Clues available to the model</p><span>{xy.X.length ? xy.X.map((column) => <i key={column}>{column}</i>) : 'Drop feature columns here'}</span></div><div className="is-target" onDragOver={(event) => event.preventDefault()} onDrop={(event) => assignColumn(event.dataTransfer.getData('text/plain'), 'y')}><b>y · TARGET</b><p>The answer to predict</p><span>{xy.y ? <i>{xy.y}</i> : 'Drop one target here'}</span></div></div></div>
      <button type="button" className="dr-run" onClick={validateXY}><Target /> Validate X / y</button>
    </>

    if (station === 9) return <>
      <div className="dr-split-room"><article><span>TRAINING ROOM</span><strong>{10 - testBatches.length}0%</strong><div>{Array.from({ length: 10 }, (_, index) => !testBatches.includes(index) && <i key={index}>{index + 1}</i>)}</div><small>Fits the model and preprocessing rules</small></article><div className="dr-split-gate"><Split /><b>80 / 20</b></div><article className="is-vault"><span><LockKeyhole /> TESTING VAULT</span><strong>{testBatches.length}0%</strong><div>{testBatches.map((index) => <i key={index}>{index + 1}</i>)}</div><small>Unseen until final evaluation</small></article></div>
      <div className="dr-batch-picker"><span>Move exactly 2 batches into the test vault</span><div>{Array.from({ length: 10 }, (_, index) => <button type="button" key={index} className={testBatches.includes(index) ? 'is-test' : ''} onClick={() => toggleBatch(index)}>{index + 1}</button>)}</div></div>
      <button type="button" className="dr-run" onClick={splitData}><ShieldCheck /> Execute 80 / 20 split</button>
    </>

    return <>
      {bossPhase === 'order' ? <><div className="dr-boss-head"><Bot /><div><span>FINAL BOSS · NO GUIDED ARROWS</span><h5>Build a sensible preprocessing workflow</h5></div><strong>{bossOrder.length}/{BOSS_ORDER.length}</strong></div><div className="dr-pipeline-slots">{BOSS_ORDER.map((_, index) => <div key={index} className={bossOrder[index] ? 'is-filled' : ''}><span>{index + 1}</span><b>{bossOrder[index] ? BOSS_BLOCKS.find((block) => block.id === bossOrder[index])?.label : 'EMPTY SLOT'}</b></div>)}</div><div className="dr-block-bank">{BOSS_BLOCKS.map(({ id, label, icon: Icon }) => <button type="button" key={id} disabled={bossOrder.includes(id)} onClick={() => placeBossBlock(id)}><Icon /><span>{label}</span></button>)}</div><button type="button" className="dr-undo" disabled={!bossOrder.length} onClick={() => { setBossOrder((value) => value.slice(0, -1)); tell('Last block returned to the bank.') }}><Undo2 /> Undo last block</button></> : <><div className="dr-boss-head"><Code2 /><div><span>FINAL BOSS · CODE MODE</span><h5>Repair the pipeline blanks</h5></div><strong>{Math.min(codeBlank + 1, CODE_BLANKS.length)}/{CODE_BLANKS.length}</strong></div>{!completed.includes(10) && <div className="dr-code-challenge"><code>{CODE_BLANKS[codeBlank].code}</code><div>{CODE_BLANKS[codeBlank].options.map((option) => <MissionButton key={option} onClick={() => answerBlank(option)}>{option}</MissionButton>)}</div><p>Wrong choices explain the consequence and keep the dataset safe.</p></div>}</>}
    </>
  }

  const missionComplete = completed.includes(10)

  return <section ref={stageRef} className={`dr-factory${full ? ' is-fullscreen' : ''}`} aria-label="Data Rescue: The Broken ML Factory simulation">
    <header className="dr-header">
      <div className="dr-brand"><span className="dr-brand-mark"><Factory aria-hidden="true" /><i /></span><div><p>EXPERIMENT 01 · INTERACTIVE SIMULATION</p><h3>DATA RESCUE <em>// THE BROKEN ML FACTORY</em></h3></div></div>
      <div className="dr-health" aria-label={`Data health ${health} percent`}><div className="dr-health-ring" style={{ '--health': `${health * 3.6}deg` }}><strong>{health}%</strong></div><span>DATA HEALTH<small>{health === 100 ? 'ML-READY' : 'REPAIRING'}</small></span></div>
      <button type="button" className="dr-icon-button" aria-label={full ? 'Exit fullscreen' : 'Open fullscreen'} onClick={() => toggleElementFullscreen(stageRef.current)}>{full ? <Minimize2 /> : <Maximize2 />}</button>
    </header>

    <div className="dr-conveyor" aria-hidden="true"><span>RAW_01</span><i /><span>ROW_02</span><i /><span>DATA_03</span><i /><span>FIX_04</span><i /><span>ML_READY</span></div>

    <nav className="dr-stations" aria-label="Factory stations"><ol>{STATIONS.map(({ short, icon: Icon }, index) => {
      const done = completed.includes(index)
      const locked = index > maxUnlocked
      return <li key={short}><button type="button" disabled={locked} aria-current={station === index ? 'step' : undefined} className={done ? 'is-done' : ''} onClick={() => go(index)}><span>{done ? <Check /> : locked ? <LockKeyhole /> : <Icon />}</span><small>{index === 10 ? 'BOSS' : String(index + 1).padStart(2, '0')}</small><b>{short}</b></button>{index < STATIONS.length - 1 && <i />}</li>
    })}</ol></nav>

    {missionComplete ? <div className="dr-complete">
      <div className="dr-complete-burst"><ShieldCheck /><span>MISSION COMPLETE</span></div>
      <p className="dr-kicker">RAW DATA → ML-READY DATA</p>
      <h4>You built a complete<br /><em>preprocessing workflow.</em></h4>
      <p>Every command below comes from a factory action you performed—not a program that appeared from nowhere.</p>
      <div className="dr-replay-strip"><span><Database /><b>RAW</b><small>7 messy rows</small></span><ChevronRight /><span><Wrench /><b>CLEAN</b><small>gaps + clone fixed</small></span><ChevronRight /><span><Binary /><b>ENCODED</b><small>city switches</small></span><ChevronRight /><span><Gauge /><b>SCALED</b><small>balanced inputs</small></span><ChevronRight /><span><Split /><b>SPLIT</b><small>80 / 20</small></span></div>
      {showPipeline && <pre className="dr-final-code"><code>{buildPythonProgram(choices)}</code></pre>}
      <div className="dr-complete-actions"><button type="button" onClick={() => setShowPipeline((value) => !value)}><Code2 /> {showPipeline ? 'Hide my pipeline' : 'View my pipeline'}</button><button type="button" onClick={() => { setCompleted((value) => value.filter((item) => item !== 10)); setStation(10); setBossOrder([]); setBossPhase('order'); setCodeBlank(0); tell('Final boss reset. Earlier factory repairs are still intact.') }}><RotateCcw /> Replay challenge</button><button type="button" onClick={() => resetAll(datasetKey === 'primary' ? 'challenge' : 'primary')}><RefreshCw /> Try new dataset</button><button type="button" className="is-primary" onClick={openPython}><TerminalSquare /> Code challenge</button></div>
      <button type="button" className={`dr-save${saved ? ' is-saved' : ''}`} onClick={saveResult}><Save /> {saved ? 'Saved to Results ✓' : 'Save mission result'}</button>
    </div> : <>
      <div className="dr-stage-heading"><div><p className="dr-kicker">STATION {station === 10 ? 'FINAL' : `${station + 1} OF 10`}</p><h4>{current.title}</h4><p>{current.goal}</p></div><span className={cleared ? 'is-cleared' : ''}>{cleared ? <><Check /> STATION CLEAR</> : 'NO LIVES · SAFE TO TRY'}</span></div>

      <div className="dr-workspace">
        <DatasetTable data={data} station={station} choices={choices} highlightColumns={highlightColumns} highlightCells={highlightCells} highlightRows={highlightRows} onColumn={handleColumn} onCell={handleCell} onRow={handleRow} />
        <section className="dr-factory-panel" aria-labelledby="dr-factory-title"><header className="dr-panel-head"><span id="dr-factory-title"><Factory aria-hidden="true" /> FACTORY VIEW</span><small>INTERACT · OBSERVE</small></header><div className="dr-factory-body">{renderFactory()}</div></section>
        <CodeDock station={station} code={codeForStation()} output={codeOutput()} onTip={(token) => setCodeTip(token)} />
      </div>

      <Feedback tone={feedback.tone}>{feedback.text}</Feedback>
      <footer className="dr-footer"><button type="button" onClick={() => go(station - 1)} disabled={station === 0}><ArrowLeft /> Previous station</button><span><strong>{completed.filter((item) => item < 10).length}/10</strong> factory repairs · {health}% health</span>{station < STATIONS.length - 1 ? <button type="button" className="is-primary" onClick={() => go(station + 1)} disabled={!cleared}>Next station <ArrowRight /></button> : <button type="button" className="is-primary" disabled={!cleared}>Mission complete <Check /></button>}</footer>
    </>}
  </section>
}
