const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'WELCOME',
      'PATIENT_REGISTERED',
      'APPOINTMENT_SCHEDULED',
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_COMPLETED',
      'PRESCRIPTION_CREATED',
      'PRESCRIPTION_CANCELLED',
      'PRESCRIPTION_REFILL',
      'MEDICAL_RECORD_ADDED',
      'SYSTEM_ALERT',
      'GENERAL'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    enum: ['in-app', 'email', 'sms', 'push'],
    default: 'in-app'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
