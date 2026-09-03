const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ---------------------------------------------------------------------------
// Service URLs from environment variables
// ---------------------------------------------------------------------------
const services = {
  auth: {
    name: 'Auth Service',
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    basePath: '/api/auth',
  },
  patients: {
    name: 'Patient Service',
    url: process.env.PATIENT_SERVICE_URL || 'http://localhost:3002',
    basePath: '/api/patients',
  },
  appointments: {
    name: 'Appointment Service',
    url: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003',
    basePath: '/api/appointments',
  },
  prescriptions: {
    name: 'Prescription Service',
    url: process.env.PRESCRIPTION_SERVICE_URL || 'http://localhost:3004',
    basePath: '/api/prescriptions',
  },
  notifications: {
    name: 'Notification Service',
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    basePath: '/api/notifications',
  },
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(morgan('combined'));

// ---------------------------------------------------------------------------
// Rate Limiting (simple in-memory)
// ---------------------------------------------------------------------------
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return next();
  }

  const entry = rateLimitStore.get(ip);

  // Reset window if expired
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return next();
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW_MS / 60000} minutes.`,
      retryAfter: Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
    });
  }

  next();
}

app.use(rateLimiter);

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// ---------------------------------------------------------------------------
// Public routes (no JWT required)
// ---------------------------------------------------------------------------
const publicRoutes = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/refresh-token' },
];

function isPublicRoute(req) {
  // All /health endpoints are public
  if (req.path === '/health' || req.path.endsWith('/health')) {
    return true;
  }

  return publicRoutes.some(
    (route) => route.method === req.method && req.path === route.path
  );
}

// ---------------------------------------------------------------------------
// JWT Verification Middleware
// ---------------------------------------------------------------------------
function jwtVerify(req, res, next) {
  if (isPublicRoute(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    jwt.verify(token, JWT_SECRET);
    // Token is valid -- let the request pass through to the proxy.
    // The downstream service does its own full verification.
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.',
    });
  }
}

app.use(jwtVerify);

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  const serviceHealthChecks = await Promise.all(
    Object.entries(services).map(async ([key, service]) => {
      try {
        // Use dynamic import for fetch (available in Node 18+)
        const response = await fetch(`${service.url}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = await response.json();
        return { service: key, url: service.url, status: 'healthy', details: data };
      } catch (err) {
        return { service: key, url: service.url, status: 'unhealthy', error: err.message };
      }
    })
  );

  const allHealthy = serviceHealthChecks.every((s) => s.status === 'healthy');

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'healthy' : 'degraded',
    gateway: 'running',
    timestamp: new Date().toISOString(),
    services: serviceHealthChecks,
  });
});

// ---------------------------------------------------------------------------
// API Discovery
// ---------------------------------------------------------------------------
app.get('/api/services', (_req, res) => {
  const serviceList = Object.entries(services).map(([key, service]) => ({
    name: service.name,
    key,
    basePath: service.basePath,
    targetUrl: service.url,
  }));

  res.json({
    gateway: 'healthcare-api-gateway',
    services: serviceList,
  });
});

// ---------------------------------------------------------------------------
// Proxy Routes
// ---------------------------------------------------------------------------
function createProxy(targetUrl) {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { '^/api': '' }, // strip /api prefix
    onError(err, req, res) {
      console.error(`Proxy error for ${req.originalUrl}:`, err.message);
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'The downstream service is unavailable.',
      });
    },
  });
}

app.use('/api/auth', createProxy(services.auth.url));
app.use('/api/patients', createProxy(services.patients.url));
app.use('/api/appointments', createProxy(services.appointments.url));
app.use('/api/prescriptions', createProxy(services.prescriptions.url));
app.use('/api/notifications', createProxy(services.notifications.url));

// ---------------------------------------------------------------------------
// Error Handling Middleware
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred.',
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log('Service targets:');
  Object.entries(services).forEach(([key, service]) => {
    console.log(`  ${key}: ${service.url}`);
  });
});
