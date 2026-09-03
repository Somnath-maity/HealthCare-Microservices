const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

const authenticate = async (req, res, next) => {
  try {
    // Allow internal service-to-service calls
    const serviceKey = req.headers['x-service-key'];
    if (serviceKey === 'internal-service-communication') {
      req.user = { role: 'service', isInternal: true };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/verify`, {
      headers: {
        Authorization: authHeader
      }
    });

    req.user = response.data.user;
    req.user.userId = req.user._id;
    next();
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    console.error('Auth verification error:', error.message);
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Not authenticated.' });
    }

    if (req.user.isInternal) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

const validateInternalRequest = (req, res, next) => {
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey !== 'internal-service-communication') {
    return res.status(403).json({ error: 'Access denied. Internal route.' });
  }
  next();
};

module.exports = { authenticate, authorize, validateInternalRequest };
