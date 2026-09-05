import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectPostgres } from './config/db';
import { connectMongo } from './config/mongo';
import { initSocketGateway } from './sockets/socket.gateway';
import { logger } from './utils/logger';

const server = http.createServer(app);

// Initialize Socket.io
initSocketGateway(server);

async function startServer() {
  try {
    logger.info('Initializing Raahi Core Backend...');

    // Connect to databases
    await connectPostgres();
    await connectMongo();

    // Live vehicle movement comes ONLY from drivers reporting real GPS via
    // POST /api/tracking/location (web driver app now, native app later).
    // No simulator, no synthetic movement — the server never invents positions.
    logger.info('GPS source: REAL driver tracking (simulator removed).');

    // Vehicle offline detection - check every 60 seconds
    setInterval(async () => {
      try {
        const { Vehicle } = require('./models/postgres');
        const { Op } = require('sequelize');
        const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
        const result = await Vehicle.update(
          { status: 'offline', speed: 0 },
          { where: { status: { [Op.in]: ['moving', 'delayed'] }, last_ping_at: { [Op.lt]: staleThreshold } } }
        );
        if (result[0] > 0) {
          logger.info(`Marked ${result[0]} vehicles offline (no GPS ping for 5+ min)`, { component: 'offline-detector' });
        }
      } catch (e) { /* ignore */ }
    }, 60000);

    server.listen(env.port, () => {
      logger.info('Raahi Core Backend is ACTIVE', {
        port: env.port,
        mode: env.nodeEnv,
        health: `http://localhost:${env.port}/health`,
      });
    });
  } catch (err: any) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

startServer();
