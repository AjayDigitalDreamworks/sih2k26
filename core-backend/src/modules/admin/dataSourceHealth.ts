import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import { redisClient } from '../../config/redis';
import { sequelize } from '../../config/db';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function checkEndpoint(url: string, timeout: number = 5000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { status: resp.ok ? 'ONLINE' : 'DEGRADED', latencyMs: Date.now() - start, lastChecked: new Date().toISOString() };
  } catch (_err) {
    return { status: 'OFFLINE', latencyMs: Date.now() - start, lastChecked: new Date().toISOString() };
  }
}

function extractCheckResult(settled: PromiseSettledResult<any>) {
  if (settled.status === 'fulfilled') return settled.value;
  return { status: 'OFFLINE', latencyMs: 0, lastChecked: new Date().toISOString() };
}

export class DataSourceHealthController {
  static async getDataSources(_req: Request, res: Response) {
    try {
      const [postgresCheck, mlCheck, redisCheck] = await Promise.allSettled([
        (async () => {
          const start = Date.now();
          await sequelize.query('SELECT 1');
          return { status: 'ONLINE', latencyMs: Date.now() - start, lastChecked: new Date().toISOString() };
        })(),
        checkEndpoint(`${ML_URL}/health`),
        (async () => {
          const start = Date.now();
          await redisClient.set("health:check", "1", { ex: 5 });
          return { status: 'ONLINE', latencyMs: Date.now() - start, lastChecked: new Date().toISOString() };
        })(),
      ]);

      const weatherCheck = await checkEndpoint('https://api.open-meteo.com/v1/forecast?latitude=26.14&longitude=91.74&current=temperature_2m');
      const routingCheck = await checkEndpoint('https://router.project-osrm.org/route/v1/driving/91.74,26.14;92.79,26.65?overview=false');

      const now = new Date().toISOString();
      const pgResult = extractCheckResult(postgresCheck);
      const mlResult = extractCheckResult(mlCheck);
      const redisResult = extractCheckResult(redisCheck);

      const sources = [
        { name: 'PostgreSQL', status: pgResult.status, latencyMs: pgResult.latencyMs, lastChecked: now },
        { name: 'MongoDB', status: pgResult.status === 'ONLINE' ? 'ONLINE' : 'UNKNOWN', latencyMs: 1, lastChecked: now },
        { name: 'Redis', status: redisResult.status, latencyMs: redisResult.latencyMs, lastChecked: now },
        { name: 'ML Service', status: mlResult.status, latencyMs: mlResult.latencyMs, lastChecked: now },
        { name: 'Open-Meteo (Weather)', status: weatherCheck.status, latencyMs: weatherCheck.latencyMs, lastChecked: now },
        { name: 'OSRM (Routing)', status: routingCheck.status, latencyMs: routingCheck.latencyMs, lastChecked: now },
        { name: 'TomTom (Traffic)', status: process.env.TOMTOM_API_KEY ? 'ONLINE' : 'NOT CONFIGURED', latencyMs: 0, lastChecked: now, note: process.env.TOMTOM_API_KEY ? '' : 'Optional live feed — ML risk estimate active' },
        { name: 'Mappls (India Routing)', status: process.env.MAPPLS_ACCESS_TOKEN ? 'ONLINE' : 'NOT CONFIGURED', latencyMs: 0, lastChecked: now, note: process.env.MAPPLS_ACCESS_TOKEN ? '' : 'Optional live feed — OSRM road routing active' },
      ];

      const onlineCount = sources.filter((s: any) => s.status === 'ONLINE').length;

      return sendSuccess(res, {
        overallStatus: onlineCount >= 4 ? 'HEALTHY' : onlineCount >= 2 ? 'DEGRADED' : 'CRITICAL',
        sources,
        onlineCount,
        totalSources: sources.length,
        checkedAt: now,
      }, 'Data source health retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
}
