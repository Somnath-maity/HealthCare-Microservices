const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const Patient = require('../src/models/patient.model');

const TEST_DATABASE = 'healthcare_patients_test';
const testUri = process.env.MONGO_TEST_URI;

before(async () => {
  if (!testUri) {
    throw new Error(
      'Set MONGO_TEST_URI to a MongoDB URI using the healthcare_patients_test database.'
    );
  }

  const databaseName = decodeURIComponent(new URL(testUri).pathname.slice(1));
  if (databaseName !== TEST_DATABASE) {
    throw new Error(
      `Refusing to run database tests against "${databaseName || '(no database)'}"; expected "${TEST_DATABASE}".`
    );
  }

  await mongoose.connect(testUri);
});

after(async () => {
  await mongoose.disconnect();
});

test('persists, updates, reads, and deletes a patient record', async () => {
  const email = `db-test-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  let patientId;

  try {
    const patient = await Patient.create({
      firstName: 'Database',
      lastName: 'Test',
      dateOfBirth: '1990-01-01',
      phone: '555-0100',
      email
    });
    patientId = patient._id;

    const persistedPatient = await Patient.findById(patientId);
    assert.ok(persistedPatient);
    assert.equal(persistedPatient.email, email);
    assert.equal(persistedPatient.isActive, true);
    assert.ok(persistedPatient.createdAt);

    await Patient.updateOne({ _id: patientId }, { $set: { isActive: false } });
    const updatedPatient = await Patient.findOne({ email });
    assert.equal(updatedPatient.isActive, false);

    const result = await Patient.deleteOne({ _id: patientId });
    assert.equal(result.deletedCount, 1);
    assert.equal(await Patient.findById(patientId), null);
  } finally {
    if (patientId) {
      await Patient.deleteOne({ _id: patientId });
    }
  }
});
