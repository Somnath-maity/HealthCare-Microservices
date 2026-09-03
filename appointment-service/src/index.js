const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const appointmentRoutes = require('./routes/appointment.routes');

const app = express();

const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/appointment-service';

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'appointment-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/appointments', appointmentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB and start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Appointment Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
