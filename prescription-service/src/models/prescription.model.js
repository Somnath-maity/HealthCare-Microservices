const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  dosage: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    required: true,
    enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'weekly']
  },
  duration: {
    type: String,
    required: true,
    trim: true
  },
  route: {
    type: String,
    enum: ['oral', 'topical', 'injection', 'inhalation', 'intravenous']
  },
  instructions: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number
  }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  doctorId: {
    type: String,
    required: true,
    index: true
  },
  doctorName: {
    type: String,
    required: true,
    trim: true
  },
  appointmentId: {
    type: String,
    index: true
  },
  medications: [medicationSchema],
  diagnosis: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'expired'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  refillsAllowed: {
    type: Number,
    default: 0
  },
  refillsUsed: {
    type: Number,
    default: 0
  },
  pharmacy: {
    name: String,
    address: String,
    phone: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
