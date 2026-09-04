const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const SERVICE_KEY = 'internal-service-communication';

const authenticate = async (req, res, next) => {
  try {
    // Allow internal service-to-service calls
    const serviceKey = req.headers['x-service-key'];
    if (serviceKey === SERVICE_KEY) {
      req.user = { role: 'service', isInternal: true };
      return next();
    }

    // Check for Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify token with auth service
    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/verify`, {
      headers: { Authorization: authHeader }
    });

    req.user = response.data.user;
    req.user.userId = req.user._id;
    next();
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.isInternal) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

const validateInternalRequest = (req, res, next) => {
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey !== SERVICE_KEY) {
    return res.status(403).json({ error: 'Internal access only.' });
  }
  next();
};

module.exports = { authenticate, authorize, validateInternalRequest };
