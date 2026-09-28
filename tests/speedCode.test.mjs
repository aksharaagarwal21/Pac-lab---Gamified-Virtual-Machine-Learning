import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ERROR_RUN, accuracy, assembleProgram, backspace, charStates, errorRun, isDone, startTyping, totals, typeText, wpm } from '../src/components/lab/speedCode/typingModel.js'
import { speedTest as exp01 } from '../src/experiments/speed/exp01.js'
import { speedTest as exp02 } from '../src/experiments/speed/exp02.js'
import { speedTest as exp03 } from '../src/experiments/speed/exp03.js'

const target = 'def f(x):\n    if x:\n        return 1\n    return 0'

// Types the target the way a person would: never the auto-filled indentation, Enter at line ends.
const typeLikeHuman = (code) => code.split('\n').map((line) => line.trimStart()).join('\n')

test('typing the code with Enter fills indentation and finishes the part', () => {
  const state = typeText(startTyping(target), typeLikeHuman(target), target)
  assert.equal(state.typed, target)
  assert.ok(isDone(state, target))
  assert.equal(state.keys, typeLikeHuman(target).length, 'indentation is not counted as typing')
  assert.equal(state.correctKeys, state.keys)
})

test('habitual indentation spaces are ignored, not counted as mistakes', () => {
  const state = typeText(startTyping(target), 'def f(x):\n    if x:', target)
  assert.equal(state.typed, 'def f(x):\n    if x:')
  assert.equal(errorRun(state.typed, target), 0)
})

test('mistakes stay red and block input after the limit until fixed', () => {
  let state = typeText(startTyping(target), 'dex', target)
  assert.deepEqual(charStates(state.typed, target).slice(0, 4), ['ok', 'ok', 'bad', 'todo'])
  state = typeText(state, 'x'.repeat(20), target)
  assert.equal(errorRun(state.typed, target), MAX_ERROR_RUN)
  assert.equal(state.blocked, true)
  for (let i = 0; i < MAX_ERROR_RUN; i++) state = backspace(state)
  assert.equal(state.typed, 'de')
  assert.equal(state.blocked, false)
  assert.ok(accuracy(state.keys, state.correctKeys) < 1, 'mistakes lower accuracy even after fixing')
})

test('backspace removes an auto-indent together with its line break; ctrl removes a word', () => {
  let state = typeText(startTyping(target), 'def f(x):\n', target)
  assert.equal(state.typed, 'def f(x):\n    ')
  state = backspace(state)
  assert.equal(state.typed, 'def f(x):')
  state = backspace(state, true)
  assert.equal(state.typed, 'def f(x')
})

test('a wrong Enter does not auto-indent and cannot run past the end', () => {
  const state = typeText(startTyping('ab'), 'a\n', 'ab')
  assert.equal(state.typed, 'a\n')
  const done = typeText(startTyping('ab'), 'abcdef', 'ab')
  assert.equal(done.typed, 'ab')
})

test('wpm and totals', () => {
  assert.equal(wpm(250, 60000), 50)
  const t = totals([{ keys: 110, correctKeys: 100, ms: 30000 }, { keys: 100, correctKeys: 100, ms: 30000 }])
  assert.equal(Math.round(t.wpm), 40)
  assert.ok(Math.abs(t.accuracy - 200 / 210) < 1e-12)
})

test('every experiment program is fully typeable', () => {
  for (const speedTest of [exp01, exp02, exp03]) {
    assert.ok(speedTest.parts.length >= 5, 'the whole program, split into parts')
    for (const part of speedTest.parts) {
      assert.match(part.code, /^[\x20-\x7e\n]+$/, `${part.title}: ASCII only, no tabs`)
      assert.doesNotMatch(part.code, / \n| $|^\n|\n$/, `${part.title}: no trailing spaces or blank edges`)
      const state = typeText(startTyping(part.code), typeLikeHuman(part.code), part.code)
      assert.ok(isDone(state, part.code), `${part.title}: typing it line by line finishes it`)
    }
    assert.ok(assembleProgram(speedTest).length > 1000, 'a substantial program, not a snippet')
  }
})

test('experiments 1-3 stay locked behind their speed code; later ones only need the quiz', async () => {
  const { labStatus, lockReason, nextUnlockBlocker } = await import('../src/progress.js')
  const state = (cleared, typed = []) => ({ cleared: Object.fromEntries(cleared.map((id) => [id, { stars: 3 }])), typing: Object.fromEntries(typed.map((id) => [id, { completions: 1 }])) })

  assert.equal(labStatus(state([]), 1), 'ready')
  assert.equal(labStatus(state([1]), 2), 'locked', 'quiz passed but speed code not typed')
  assert.match(lockReason(state([1]), 2), /Speed Code in Experiment 1/)
  assert.equal(labStatus(state([], [1]), 2), 'locked', 'speed code typed but quiz not passed')
  assert.equal(labStatus(state([1], [1]), 2), 'ready')
  assert.equal(labStatus(state([1, 2, 3], [1, 2]), 4), 'locked')
  assert.equal(labStatus(state([1, 2, 3], [1, 2, 3]), 4), 'ready')
  assert.equal(labStatus(state([1, 2, 3, 4], [1, 2, 3]), 5), 'ready', 'experiment 4 has no speed code requirement')
  assert.equal(labStatus(state([1, 2], [1]), 2), 'cleared', 'an already-cleared lab is never re-locked')
  assert.ok(nextUnlockBlocker(state([1]), 1))
  assert.equal(nextUnlockBlocker(state([1], [1]), 1), null)
  assert.equal(nextUnlockBlocker(state([4]), 4), null)
})

test('the server keeps Speed Code progress when it saves a student', async () => {
  const { sanitizeState } = await import('../server/studentSync.js')
  const saved = sanitizeState({
    cleared: { 1: { stars: 3 } },
    typing: {
      1: { completions: 2, best: { wpm: 42.5, accuracy: 0.97, ms: 300000, keys: 2000, correctKeys: 1940, at: 1 }, attempt: null },
      2: { completions: 0, attempt: { parts: [{ keys: 300, correctKeys: 290, ms: 60000 }, null] } },
      99: { completions: 5 },
    },
  })
  assert.equal(saved.typing[1].completions, 2)
  assert.equal(saved.typing[1].best.wpm, 42.5)
  assert.deepEqual(saved.typing[2].attempt.parts, [{ keys: 300, correctKeys: 290, ms: 60000 }, null])
  assert.equal(saved.typing[99], undefined, 'unknown experiments are dropped')
  const { labStatus } = await import('../src/progress.js')
  assert.equal(labStatus(saved, 2), 'ready', 'a student who typed the code keeps Experiment 2 open after a server round trip')
})
