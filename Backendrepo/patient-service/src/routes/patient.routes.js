const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Patient = require('../models/patient.model');
const MedicalRecord = require('../models/medical-record.model');
const { authenticate, authorize, validateInternalRequest } = require('../middleware/auth.middleware');

const router = express.Router();

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
const SERVICE_KEY = 'internal-service-communication';

// Helper: send notification (fire-and-forget)
const sendNotification = (data) => {
  axios.post(`${NOTIFICATION_SERVICE_URL}/notifications`, data, {
    headers: { 'x-service-key': SERVICE_KEY }
  }).catch((err) => {
    console.error('Failed to send notification:', err.message);
  });
};

// ============================================================
// Internal route (must be before /:id routes to avoid conflict)
// ============================================================

// GET /patients/internal/validate/:id - Validate patient exists (internal)
router.get('/internal/validate/:id', validateInternalRequest, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ valid: false, error: 'Invalid patient ID.' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ valid: false, error: 'Patient not found.' });
    }

    return res.json({ valid: true, patient });
  } catch (error) {
    console.error('Validate patient error:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error.' });
  }
});

// ============================================================
// Patient CRUD routes
// ============================================================

// GET /patients - List patients with pagination, search, and filters
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    // Search by name, email, or phone
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Filter by bloodType
    if (req.query.bloodType) {
      filter.bloodType = req.query.bloodType;
    }

    // Filter by gender
    if (req.query.gender) {
      filter.gender = req.query.gender;
    }

    // Filter by isActive
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Patient.countDocuments(filter)
    ]);

    return res.json({
      patients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List patients error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /patients/:id - Get single patient
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID.' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    return res.json(patient);
  } catch (error) {
    console.error('Get patient error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /patients - Create patient
router.post('/', authenticate, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const patientData = {
      ...req.body,
      registeredBy: req.user.userId
    };

    const patient = new Patient(patientData);
    await patient.save();

    // Fire-and-forget notification
    sendNotification({
      type: 'PATIENT_REGISTERED',
      title: 'New Patient Registered',
      message: `New patient registered: ${patient.firstName} ${patient.lastName}`,
      userId: req.user.userId
    });

    return res.status(201).json({ message: 'Patient created successfully.', patient });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A patient with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Create patient error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /patients/:id - Update patient
router.put('/:id', authenticate, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID.' });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    return res.json(patient);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A patient with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Update patient error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /patients/:id - Soft delete (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID.' });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    return res.json({ message: 'Patient deactivated successfully.', patient });
  } catch (error) {
    console.error('Delete patient error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// Medical Record routes
// ============================================================

// GET /patients/:id/medical-records - List medical records for a patient
router.get('/:id/medical-records', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID.' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { patientId: req.params.id };

    if (req.query.type) {
      filter.type = req.query.type;
    }

    const [records, total] = await Promise.all([
      MedicalRecord.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      MedicalRecord.countDocuments(filter)
    ]);

    return res.json({
      records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List medical records error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /patients/:id/medical-records - Add medical record
router.post('/:id/medical-records', authenticate, authorize('doctor', 'nurse'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID.' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const recordData = {
      ...req.body,
      patientId: req.params.id,
      doctorId: req.user.userId,
      doctorName: `${req.user.firstName} ${req.user.lastName}`
    };

    const record = new MedicalRecord(recordData);
    await record.save();

    // Fire-and-forget notification
    sendNotification({
      type: 'MEDICAL_RECORD_ADDED',
      title: 'Medical Record Added',
      message: `New ${record.type} record added for patient ${patient.firstName} ${patient.lastName}`,
      userId: req.user.userId
    });

    return res.status(201).json({ message: 'Medical record added.', record });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Create medical record error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /patients/:id/medical-records/:recordId - Get single medical record
router.get('/:id/medical-records/:recordId', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.recordId)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }

    const record = await MedicalRecord.findOne({
      _id: req.params.recordId,
      patientId: req.params.id
    });

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found.' });
    }

    return res.json(record);
  } catch (error) {
    console.error('Get medical record error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /patients/:id/medical-records/:recordId - Update medical record
router.put('/:id/medical-records/:recordId', authenticate, authorize('doctor', 'nurse'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.recordId)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { _id: req.params.recordId, patientId: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found.' });
    }

    return res.json(record);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Update medical record error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
