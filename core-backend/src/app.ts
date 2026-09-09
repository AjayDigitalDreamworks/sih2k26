import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { rateLimit } from './middleware/security.middleware';
import { logger } from './utils/logger';

// Routes
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import transporterRoutes from './modules/transporter/transporter.routes';
import vehiclesRoutes from './modules/vehicles/vehicles.routes';
import mlProxyRoutes from './modules/ml-proxy/ml-proxy.routes';
import integrationRoutes from './modules/ml-proxy/integration.routes';
import trackingRoutes from './modules/tracking/tracking.routes';
import driverRoutes from './modules/driver/driver.routes';
import gisRoutes from './modules/gis/gis.routes';
import internalRoutes from './modules/internal/internal.routes';
import publicRoutes from './modules/public/public.routes';
import fieldOfficerRoutes from './modules/field-officer/field-officer.routes';
import mediaRoutes from './modules/media/media.routes';
import path from 'path';

const app = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' }, // Anti-Clickjacking: X-Frame-Options: DENY
    noSniff: true,                 // Anti-MIME sniffing: X-Content-Type-Options: nosniff
    xssFilter: true,               // Cross-site scripting (XSS) filter
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,           // Hides Express signature
  })
);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, internal scripts) or matching allowed origins
      if (!origin || allowedOrigins.includes(origin) || env.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Anti-Sniffing & Cache Control for sensitive admin and auth endpoints
app.use('/api/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api/auth/me', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// No global rate limiter — dashboards poll several endpoints every few seconds
// and a shared/NAT IP would trip an aggregate limit and 429 real usage.
// Auth endpoints get their own limiter (see auth.routes.ts).

// Request logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const checks: Record<string, string> = {};

  // Check PostgreSQL
  try {
    const { sequelize } = require('./config/db');
    await sequelize.authenticate();
    checks.postgres = 'connected';
  } catch {
    checks.postgres = 'disconnected';
  }

  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    checks.mongo = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    checks.mongo = 'disconnected';
  }

  // Check Redis
  try {
    const { redisClient } = require('./config/redis');
    checks.redis = redisClient.isConnected() ? 'connected' : 'in-memory-fallback';
  } catch {
    checks.redis = 'disconnected';
  }

  const allHealthy = Object.values(checks).every(v => v === 'connected');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'Raahi Core Backend API',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: checks,
  });
});

// Ready check (for k8s / load balancers)
app.get('/ready', async (req, res) => {
  try {
    const { sequelize } = require('./config/db');
    await sequelize.authenticate();
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

// Static file serving for evidence photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes Mounting
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transporter', transporterRoutes);
app.use('/api/ml', mlProxyRoutes);
app.use('/api/ml', integrationRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/tracking', integrationRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/field-officer', fieldOfficerRoutes);
app.use('/api/media', mediaRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
