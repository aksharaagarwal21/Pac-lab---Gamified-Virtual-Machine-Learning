// Speed Code typing engine. Pure functions, so every rule can be tested without a browser.
//
// The student types the target code character by character. Rules:
// - After a correct Enter the next line's indentation is filled in (it is not counted as typing).
// - Spaces typed at the start of an auto-indented line are ignored, so habit does not cause errors.
// - Mistakes stay on screen in red; after MAX_ERROR_RUN characters past the first mistake, input
//   stops until the student backspaces to fix it. A part is finished only when it matches exactly.

export const MAX_ERROR_RUN = 8
export const PART_SEPARATOR = '\n\n\n'

export const emptyTyping = () => ({ typed: '', keys: 0, correctKeys: 0, blocked: false })

export const assembleProgram = (speedTest) => speedTest.parts.map((part) => part.code).join(PART_SEPARATOR) + '\n'

export function firstError(typed, target) {
  for (let i = 0; i < typed.length; i++) if (typed[i] !== target[i]) return i
  return -1
}

export function errorRun(typed, target) {
  const first = firstError(typed, target)
  return first < 0 ? 0 : typed.length - first
}

export const isDone = (state, target) => state.typed === target

const indentAt = (target, pos) => /^ */.exec(target.slice(pos))[0]
const onBlankIndent = (typed) => /(^|\n) *$/.test(typed)

// Indentation for the very first line of a part is filled in too.
export function startTyping(target) {
  return { ...emptyTyping(), typed: indentAt(target, 0) }
}

export function typeText(state, text, target) {
  let next = state
  for (const raw of text.replace(/\r\n?/g, '\n')) next = typeChar(next, raw, target)
  return next
}

export function typeChar(state, ch, target) {
  const pos = state.typed.length
  if (pos >= target.length) return state
  if (errorRun(state.typed, target) >= MAX_ERROR_RUN) return { ...state, blocked: true }

  // Tab: jump over the indentation the target expects here (nothing to do otherwise).
  if (ch === '\t') {
    const indent = indentAt(target, pos)
    return indent ? { ...state, typed: state.typed + indent, blocked: false } : state
  }
  // Habitual spaces on an auto-indented line are swallowed.
  if (ch === ' ' && target[pos] !== ' ' && onBlankIndent(state.typed) && firstError(state.typed, target) < 0) return state

  const correct = target[pos] === ch
  let typed = state.typed + ch
  if (ch === '\n' && correct) typed += indentAt(target, pos + 1)
  return { typed, keys: state.keys + 1, correctKeys: state.correctKeys + (correct ? 1 : 0), blocked: false }
}

// Backspace removes one character; on an auto-indented blank line it removes the indent and the
// line break together. With `word`, it removes the previous word (Ctrl + Backspace).
export function backspace(state, word = false) {
  const { typed } = state
  if (!typed) return state
  let cut = typed.length - 1
  const indented = /\n( +)$/.exec(typed)
  if (indented) cut = typed.length - indented[1].length - 1
  else if (word) {
    const match = /(\w+|[^\w\s]+)? *$/.exec(typed)
    cut = typed.length - Math.max(1, match[0].length)
  }
  return { ...state, typed: typed.slice(0, Math.max(0, cut)), blocked: false }
}

// Per-character state for rendering: 'ok', 'bad' or 'todo'.
export function charStates(typed, target) {
  return Array.from(target, (ch, i) => (i >= typed.length ? 'todo' : typed[i] === ch ? 'ok' : 'bad'))
}

// Words per minute counts five correct keystrokes as one word (the usual typing-test convention).
export function wpm(correctKeys, ms) {
  return ms > 0 ? correctKeys / 5 / (ms / 60000) : 0
}

export const accuracy = (keys, correctKeys) => (keys > 0 ? correctKeys / keys : 1)

// Totals across finished parts: [{ keys, correctKeys, ms }].
export function totals(parts) {
  const done = parts.filter(Boolean)
  const keys = done.reduce((s, p) => s + p.keys, 0)
  const correctKeys = done.reduce((s, p) => s + p.correctKeys, 0)
  const ms = done.reduce((s, p) => s + p.ms, 0)
  return { keys, correctKeys, ms, wpm: wpm(correctKeys, ms), accuracy: accuracy(keys, correctKeys) }
}

export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
