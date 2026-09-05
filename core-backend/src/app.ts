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
import gisRoutes from './modules/gis/gis.routes';
import internalRoutes from './modules/internal/internal.routes';
import publicRoutes from './modules/public/public.routes';

const app = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

// API Routes Mounting
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transporter', transporterRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/ml', mlProxyRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/internal', internalRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
