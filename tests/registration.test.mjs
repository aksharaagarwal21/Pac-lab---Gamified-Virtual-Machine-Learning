import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRegistration, registrationError, registrationErrors } from '../src/lib/registration.js'

const valid = { studentId: ' ml-2026-123 ', firstName: ' Riya ', lastName: 'Kapoor', email: ' Riya.K@College.EDU ', classCode: 'aiml-a', password: 'secret123' }

test('normalises input the way the server stores it', () => {
  const form = normalizeRegistration(valid)
  assert.equal(form.studentId, 'ML-2026-123')
  assert.equal(form.firstName, 'Riya')
  assert.equal(form.email, 'riya.k@college.edu')
  assert.equal(form.classCode, 'AIML-A')
  assert.equal(registrationError(form), null)
})

test('rejects bad fields with a message per field', () => {
  const errors = registrationErrors(normalizeRegistration({ studentId: 'x!', firstName: '', lastName: '123', email: 'nope', classCode: '', password: 'short' }))
  assert.deepEqual(Object.keys(errors).sort(), ['classCode', 'email', 'firstName', 'lastName', 'password', 'studentId'])
  assert.equal(registrationError(normalizeRegistration({ ...valid, password: 'x'.repeat(73) })), 'At most 72 characters.')
})

test('accepts names with accents, spaces, dots and apostrophes', () => {
  for (const name of ['Zoë', "D'Souza", 'Ana María', 'K. Rao']) {
    assert.equal(registrationErrors(normalizeRegistration({ ...valid, firstName: name })).firstName, undefined, name)
  }
})
