import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  canReceiveMail,
  classroomError,
  classroomErrors,
  inviteMessage,
  isJoinCode,
  joinPath,
  normalizeClassroom,
  normalizeJoinCode,
  parseEmails,
} from '../src/lib/classrooms.js'

test('join codes are normalised the way students type them', () => {
  assert.equal(normalizeJoinCode(' k7m-2qx p '), 'K7M2QXP')
  assert.equal(normalizeJoinCode(undefined), '')
  assert.ok(isJoinCode('K7M2QXP'))
  assert.equal(joinPath('K7M2QXP'), '/join/K7M2QXP')
})

test('join codes reject look-alike characters and wrong lengths', () => {
  for (const code of ['K7M2QX', 'K7M2QXPP', 'O7M2QXP', 'I7M2QXP', 'L7M2QXP', '07M2QXP', '17M2QXP', 'k7m2qxp']) {
    assert.equal(isJoinCode(code), false, code)
  }
  assert.equal(CODE_LENGTH, 7)
  assert.ok(!/[01ILO]/.test(CODE_ALPHABET))
})

test('classroom details are trimmed and checked', () => {
  const form = normalizeClassroom({ name: '  ML   Lab · A ', description: ' Thursday ', classCode: ' aiml-a ' })
  assert.deepEqual(form, { name: 'ML Lab · A', description: 'Thursday', classCode: 'AIML-A' })
  assert.equal(classroomError(form), null)

  const errors = classroomErrors(normalizeClassroom({ name: 'ab', description: 'x'.repeat(301) }))
  assert.deepEqual(Object.keys(errors).sort(), ['classCode', 'description', 'name'])
  assert.equal(classroomError(normalizeClassroom({ name: 'x'.repeat(81), classCode: 'A' })), 'At most 80 characters.')
})

test('finds email addresses in pasted lists', () => {
  const pasted = `Name, Email
Riya Kapoor <Riya.Kapoor@College.edu>
arjun@college.edu; sneha@college.edu,riya.kapoor@college.edu
mailto:dev@college.edu  broken@  @nope  plain words`
  const { valid, invalid } = parseEmails(pasted)
  assert.deepEqual(valid, ['riya.kapoor@college.edu', 'arjun@college.edu', 'sneha@college.edu', 'dev@college.edu'])
  assert.deepEqual(invalid, ['broken@', '@nope'])
  assert.deepEqual(parseEmails(''), { valid: [], invalid: [] })
})

test('reserved test domains never get email', () => {
  for (const email of ['riya.kapoor@students.paclab.test', 'a@example.com', 'a@mail.example.org', 'a@host.invalid', 'a@localhost']) {
    assert.equal(canReceiveMail(email), false, email)
  }
  for (const email of ['a@college.edu', 'a@gmail.com', 'a@testing.in', 'a@myexample.com']) {
    assert.equal(canReceiveMail(email), true, email)
  }
})

test('the invite names the classroom, link and code', () => {
  const message = inviteMessage({ name: 'ML Lab', section: 'AIML-A', teacher: 'Dr. Kavitha Raman', link: 'https://lab.example/join/K7M2QXP', code: 'K7M2QXP' })
  assert.equal(message.subject, 'Join ML Lab on PAC-LAB')
  assert.match(message.text, /Dr\. Kavitha Raman invited you to join the classroom "ML Lab" \(section AIML-A\)/)
  assert.match(message.text, /Join here: https:\/\/lab\.example\/join\/K7M2QXP/)
  assert.match(message.text, /Class code: K7M2QXP/)
})
