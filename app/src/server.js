const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Routes
const authRoutes = require('./routes/authRoutes');
const drugRoutes = require('./routes/drugRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const verifyRoutes = require('./routes/verifyRoutes');

// Middleware & Utilities
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Ingress/reverse proxy)

// Health check endpoint (Bypasses rate limiting for Kubernetes probes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'pharma-supply-chain',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------
// Security Middleware
// ---------------------

// Helmet — sets HTTP security headers with strict CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        frameSrc: ["'self'", 'https://accounts.google.com'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

// CORS — configurable cross-origin resource sharing
app.use(cors());

// Rate Limiting — application-level abuse and rate control
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 10000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Body parsing with payload size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ---------------------
// Structured Request Logging (Winston JSON)
// ---------------------
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ---------------------
// Static Files (Frontend Dashboard)
// ---------------------
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to API routes
app.use(limiter);

// ---------------------
// API Routes Mount
// ---------------------
app.use('/auth', authRoutes);
app.use('/drugs', drugRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/shipments', shipmentRoutes);
app.use('/', verifyRoutes); // mounts /verify, /ledger, /api/info

// ---------------------
// 404 Handler
// ---------------------
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ---------------------
// Global Error Handler
// ---------------------
app.use(errorHandler);

module.exports = app;
