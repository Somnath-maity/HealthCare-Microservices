const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true
    },
    patientName: {
      type: String,
      required: true
    },
    doctorId: {
      type: String,
      required: true,
      index: true
    },
    doctorName: {
      type: String,
      required: true
    },
    dateTime: {
      type: Date,
      required: true,
      index: true
    },
    endTime: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'general_checkup',
        'follow_up',
        'specialist',
        'emergency',
        'vaccination',
        'lab_work',
        'imaging',
        'surgery_consultation'
      ]
    },
    status: {
      type: String,
      enum: [
        'scheduled',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show'
      ],
      default: 'scheduled'
    },
    reason: {
      type: String,
      required: true
    },
    notes: {
      type: String
    },
    diagnosis: {
      type: String
    },
    prescription: {
      type: String
    },
    roomNumber: {
      type: String
    },
    cancellationReason: {
      type: String
    },
    cancelledBy: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
