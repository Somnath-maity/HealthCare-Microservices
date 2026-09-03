const express = require('express');
const axios = require('axios');
const Appointment = require('../models/appointment.model');
const { authenticate, authorize, validateInternalRequest } = require('../middleware/auth.middleware');

const router = express.Router();

const PATIENT_SERVICE_URL = process.env.PATIENT_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

// Helper: send notification (fire-and-forget)
const sendNotification = async (type, data) => {
  try {
    await axios.post(
      `${NOTIFICATION_SERVICE_URL}/notifications`,
      { type, ...data },
      {
        headers: { 'x-service-key': 'internal-service-communication' }
      }
    );
  } catch (error) {
    console.error(`Failed to send ${type} notification:`, error.message);
  }
};

// GET / - List appointments with pagination and filters
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      doctorId,
      patientId,
      dateFrom,
      dateTo
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;

    if (dateFrom || dateTo) {
      filter.dateTime = {};
      if (dateFrom) filter.dateTime.$gte = new Date(dateFrom);
      if (dateTo) filter.dateTime.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      appointments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error listing appointments:', error);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

// GET /stats - Get appointment statistics (admin/doctor only)
router.get('/stats', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const [byStatus, byType, todayCount, weekCount] = await Promise.all([
      Appointment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Appointment.countDocuments({
        dateTime: { $gte: startOfToday, $lt: endOfToday }
      }),
      Appointment.countDocuments({
        dateTime: { $gte: startOfWeek, $lt: endOfWeek }
      })
    ]);

    const statusCounts = {};
    byStatus.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    const typeCounts = {};
    byType.forEach((item) => {
      typeCounts[item._id] = item.count;
    });

    res.json({
      byStatus: statusCounts,
      byType: typeCounts,
      todayCount,
      weekCount
    });
  } catch (error) {
    console.error('Error fetching appointment stats:', error);
    res.status(500).json({ error: 'Failed to fetch appointment statistics' });
  }
});

// GET /doctor/:doctorId - Get appointments for a specific doctor
router.get('/doctor/:doctorId', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, dateFrom, dateTo } = req.query;

    const filter = { doctorId: req.params.doctorId };

    if (dateFrom || dateTo) {
      filter.dateTime = {};
      if (dateFrom) filter.dateTime.$gte = new Date(dateFrom);
      if (dateTo) filter.dateTime.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      appointments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ error: 'Failed to fetch doctor appointments' });
  }
});

// GET /patient/:patientId - Get appointments for a specific patient
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { patientId: req.params.patientId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      appointments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ error: 'Failed to fetch patient appointments' });
  }
});

// GET /internal/validate/:id - Internal validation route
router.get('/internal/validate/:id', validateInternalRequest, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ valid: false, error: 'Appointment not found' });
    }
    res.json({ valid: true, appointment });
  } catch (error) {
    console.error('Error validating appointment:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate appointment' });
  }
});

// GET /:id - Get single appointment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST / - Create appointment
router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, doctorName, dateTime, endTime, type, reason, notes, roomNumber } = req.body;

    if (!patientId || !doctorId || !doctorName || !dateTime || !endTime || !type || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, doctorId, doctorName, dateTime, endTime, type, reason'
      });
    }

    // Validate patient exists via Patient Service
    let patientName;
    try {
      const patientResponse = await axios.get(
        `${PATIENT_SERVICE_URL}/patients/internal/validate/${patientId}`,
        {
          headers: { 'x-service-key': 'internal-service-communication' }
        }
      );
      patientName = patientResponse.data.patient?.name ||
        `${patientResponse.data.patient?.firstName || ''} ${patientResponse.data.patient?.lastName || ''}`.trim();
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(400).json({ error: 'Patient not found' });
      }
      console.error('Patient validation error:', error.message);
      return res.status(503).json({ error: 'Patient service unavailable' });
    }

    // Check for time conflicts (same doctor, overlapping time, non-cancelled status)
    const conflict = await Appointment.findOne({
      doctorId,
      status: { $nin: ['cancelled', 'no_show'] },
      $or: [
        {
          dateTime: { $lt: new Date(endTime) },
          endTime: { $gt: new Date(dateTime) }
        }
      ]
    });

    if (conflict) {
      return res.status(409).json({
        error: 'Time conflict: Doctor already has an appointment during this time slot',
        conflictingAppointment: conflict._id
      });
    }

    const appointment = new Appointment({
      patientId,
      patientName,
      doctorId,
      doctorName,
      dateTime: new Date(dateTime),
      endTime: new Date(endTime),
      type,
      reason,
      notes,
      roomNumber
    });

    await appointment.save();

    sendNotification('APPOINTMENT_SCHEDULED', {
      userId: appointment.doctorId,
      title: 'New Appointment Scheduled',
      message: `Appointment with ${appointment.patientName} on ${appointment.dateTime.toISOString()} - ${appointment.type}`,
      metadata: { appointmentId: appointment._id, patientId: appointment.patientId }
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUT /:id - Update appointment (admin/doctor/receptionist)
router.put('/:id', authenticate, authorize('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const allowedUpdates = [
      'doctorId', 'doctorName', 'dateTime', 'endTime', 'type',
      'reason', 'notes', 'diagnosis', 'prescription', 'roomNumber', 'status'
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.dateTime) updates.dateTime = new Date(updates.dateTime);
    if (updates.endTime) updates.endTime = new Date(updates.endTime);

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// PATCH /:id/status - Update status only
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, cancellationReason } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // If cancelling, require cancellationReason
    if (status === 'cancelled') {
      if (!cancellationReason) {
        return res.status(400).json({ error: 'Cancellation reason is required when cancelling an appointment' });
      }
      appointment.cancellationReason = cancellationReason;
      appointment.cancelledBy = req.user.isInternal ? 'service' : (req.user.userId || req.user.id || 'unknown');
    }

    appointment.status = status;
    await appointment.save();

    // Send notifications based on status change
    if (status === 'cancelled') {
      sendNotification('APPOINTMENT_CANCELLED', {
        userId: appointment.doctorId,
        title: 'Appointment Cancelled',
        message: `Appointment with ${appointment.patientName} has been cancelled. Reason: ${cancellationReason}`,
        metadata: { appointmentId: appointment._id }
      });
    } else if (status === 'confirmed') {
      sendNotification('APPOINTMENT_CONFIRMED', {
        userId: appointment.doctorId,
        title: 'Appointment Confirmed',
        message: `Appointment with ${appointment.patientName} on ${appointment.dateTime.toISOString()} is confirmed.`,
        metadata: { appointmentId: appointment._id }
      });
    } else if (status === 'completed') {
      sendNotification('APPOINTMENT_COMPLETED', {
        userId: appointment.doctorId,
        title: 'Appointment Completed',
        message: `Appointment with ${appointment.patientName} has been completed.`,
        metadata: { appointmentId: appointment._id }
      });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

module.exports = router;
