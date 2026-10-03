const assert = require('node:assert/strict');
const { test } = require('node:test');
const Patient = require('../src/models/patient.model');

test('requires first name, last name, date of birth, and phone', async () => {
  const patient = new Patient({});

  await assert.rejects(patient.validate(), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.deepEqual(Object.keys(error.errors).sort(), [
      'dateOfBirth',
      'firstName',
      'lastName',
      'phone'
    ]);
    return true;
  });
});

test('rejects unsupported gender and blood type values', async () => {
  const patient = new Patient({
    firstName: 'Alex',
    lastName: 'Rivera',
    dateOfBirth: '1990-01-01',
    phone: '555-0100',
    gender: 'unknown',
    bloodType: 'X+'
  });

  await assert.rejects(patient.validate(), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.ok(error.errors.gender);
    assert.ok(error.errors.bloodType);
    return true;
  });
});

test('normalizes patient names and email and applies the active default', async () => {
  const patient = new Patient({
    firstName: '  Alex ',
    lastName: ' Rivera  ',
    dateOfBirth: '1990-01-01',
    phone: '555-0100',
    email: 'ALEX.RIVERA@example.com'
  });

  await patient.validate();

  assert.equal(patient.firstName, 'Alex');
  assert.equal(patient.lastName, 'Rivera');
  assert.equal(patient.email, 'alex.rivera@example.com');
  assert.equal(patient.isActive, true);
});
