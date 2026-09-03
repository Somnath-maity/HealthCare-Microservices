const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Prescription = require('../models/prescription.model');
const { authenticate, authorize, validateInternalRequest } = require('../middleware/auth.middleware');

const router = express.Router();

const PATIENT_SERVICE_URL = process.env.PATIENT_SERVICE_URL || 'http://localhost:3002';
const APPOINTMENT_SERVICE_URL = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const SERVICE_KEY = 'internal-service-communication';

// Helper: send notification (fire-and-forget)
const sendNotification = (data) => {
  axios.post(`${NOTIFICATION_SERVICE_URL}/notifications`, data, {
    headers: { 'x-service-key': SERVICE_KEY }
  }).catch((err) => {
    console.error('Failed to send notification:', err.message);
  });
};

// Helper: validate patient via Patient Service
const validatePatient = async (patientId) => {
  const response = await axios.get(
    `${PATIENT_SERVICE_URL}/patients/internal/validate/${patientId}`,
    { headers: { 'x-service-key': SERVICE_KEY } }
  );
  return response.data;
};

// Helper: validate appointment via Appointment Service
const validateAppointment = async (appointmentId) => {
  const response = await axios.get(
    `${APPOINTMENT_SERVICE_URL}/appointments/internal/validate/${appointmentId}`,
    { headers: { 'x-service-key': SERVICE_KEY } }
  );
  return response.data;
};

// ============================================================
// Stats route (must be before /:id to avoid conflict)
// ============================================================

// GET /prescriptions/stats - Prescription statistics (admin/doctor)
router.get('/stats', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  try {
    // Counts by status
    const statusCounts = await Prescription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const countsByStatus = {};
    statusCounts.forEach((item) => {
      countsByStatus[item._id] = item.count;
    });

    // Total active prescriptions
    const totalActive = countsByStatus.active || 0;

    // Top medications (top 10 most prescribed)
    const topMedications = await Prescription.aggregate([
      { $unwind: '$medications' },
      { $group: { _id: '$medications.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { name: '$_id', count: 1, _id: 0 } }
    ]);

    // Expiring this week
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);

    const expiringThisWeek = await Prescription.countDocuments({
      status: 'active',
      endDate: { $gte: now, $lte: endOfWeek }
    });

    return res.json({
      countsByStatus,
      totalActive,
      topMedications,
      expiringThisWeek
    });
  } catch (error) {
    console.error('Prescription stats error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// Patient and Doctor specific routes (before /:id)
// ============================================================

// GET /prescriptions/patient/:patientId - Get all prescriptions for a patient
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { patientId: req.params.patientId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Prescription.countDocuments(filter)
    ]);

    return res.json({
      prescriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get patient prescriptions error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /prescriptions/doctor/:doctorId - Get all prescriptions by a doctor
router.get('/doctor/:doctorId', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { doctorId: req.params.doctorId };

    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Prescription.countDocuments(filter)
    ]);

    return res.json({
      prescriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get doctor prescriptions error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// Core CRUD routes
// ============================================================

// GET /prescriptions - List prescriptions with pagination and filters
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.doctorId) {
      filter.doctorId = req.query.doctorId;
    }

    if (req.query.patientId) {
      filter.patientId = req.query.patientId;
    }

    // Search by medication name
    if (req.query.medication) {
      filter['medications.name'] = new RegExp(req.query.medication, 'i');
    }

    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Prescription.countDocuments(filter)
    ]);

    return res.json({
      prescriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List prescriptions error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /prescriptions/:id - Get single prescription
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid prescription ID.' });
    }

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found.' });
    }

    return res.json(prescription);
  } catch (error) {
    console.error('Get prescription error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /prescriptions - Create prescription (doctor only)
router.post('/', authenticate, authorize('doctor'), async (req, res) => {
  try {
    const { patientId, medications, diagnosis, startDate, appointmentId } = req.body;

    // Validate required fields
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required.' });
    }
    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ error: 'medications must be a non-empty array.' });
    }
    if (!diagnosis) {
      return res.status(400).json({ error: 'diagnosis is required.' });
    }
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required.' });
    }

    // Validate patient exists via Patient Service
    let patientData;
    try {
      const patientResult = await validatePatient(patientId);
      if (!patientResult.valid) {
        return res.status(400).json({ error: 'Invalid patient. Patient not found.' });
      }
      patientData = patientResult.patient;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(400).json({ error: 'Invalid patient. Patient not found.' });
      }
      console.error('Patient validation error:', err.message);
      return res.status(503).json({ error: 'Patient service unavailable.' });
    }

    // Validate appointment if provided
    if (appointmentId) {
      try {
        const appointmentResult = await validateAppointment(appointmentId);
        if (!appointmentResult.valid) {
          return res.status(400).json({ error: 'Invalid appointment. Appointment not found.' });
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          return res.status(400).json({ error: 'Invalid appointment. Appointment not found.' });
        }
        console.error('Appointment validation error:', err.message);
        return res.status(503).json({ error: 'Appointment service unavailable.' });
      }
    }

    // Build prescription data
    const patientName = patientData.firstName && patientData.lastName
      ? `${patientData.firstName} ${patientData.lastName}`
      : patientData.name || 'Unknown';

    const prescriptionData = {
      ...req.body,
      patientName,
      doctorId: req.user.userId,
      doctorName: req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.name || 'Unknown'
    };

    const prescription = new Prescription(prescriptionData);
    await prescription.save();

    // Fire-and-forget notification
    sendNotification({
      type: 'PRESCRIPTION_CREATED',
      title: 'New Prescription Created',
      message: `New prescription created for patient ${patientName} by Dr. ${prescriptionData.doctorName}`,
      userId: patientId
    });

    return res.status(201).json(prescription);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Create prescription error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /prescriptions/:id - Update prescription (doctor only)
router.put('/:id', authenticate, authorize('doctor'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid prescription ID.' });
    }

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found.' });
    }

    // Cannot update if cancelled or expired
    if (prescription.status === 'cancelled' || prescription.status === 'expired') {
      return res.status(400).json({
        error: `Cannot update a prescription with status '${prescription.status}'.`
      });
    }

    const updated = await Prescription.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    return res.json(updated);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Update prescription error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /prescriptions/:id/status - Change prescription status (doctor/admin)
router.patch('/:id/status', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid prescription ID.' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const validStatuses = ['active', 'completed', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found.' });
    }

    prescription.status = status;
    await prescription.save();

    // Fire notification if cancelled
    if (status === 'cancelled') {
      sendNotification({
        type: 'PRESCRIPTION_CANCELLED',
        title: 'Prescription Cancelled',
        message: `Prescription for patient ${prescription.patientName} has been cancelled`,
        userId: prescription.patientId
      });
    }

    return res.json(prescription);
  } catch (error) {
    console.error('Change prescription status error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /prescriptions/:id/refill - Request a refill
router.post('/:id/refill', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid prescription ID.' });
    }

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found.' });
    }

    if (prescription.status !== 'active') {
      return res.status(400).json({ error: 'Can only refill active prescriptions.' });
    }

    if (prescription.refillsUsed >= prescription.refillsAllowed) {
      return res.status(400).json({
        error: 'No refills remaining.',
        refillsAllowed: prescription.refillsAllowed,
        refillsUsed: prescription.refillsUsed
      });
    }

    prescription.refillsUsed += 1;
    await prescription.save();

    // Fire-and-forget notification
    sendNotification({
      type: 'PRESCRIPTION_REFILL',
      title: 'Prescription Refill Requested',
      message: `Refill ${prescription.refillsUsed}/${prescription.refillsAllowed} for prescription of patient ${prescription.patientName}`,
      userId: prescription.patientId
    });

    return res.json({
      message: 'Refill processed successfully.',
      refillsUsed: prescription.refillsUsed,
      refillsAllowed: prescription.refillsAllowed,
      refillsRemaining: prescription.refillsAllowed - prescription.refillsUsed,
      prescription
    });
  } catch (error) {
    console.error('Prescription refill error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
