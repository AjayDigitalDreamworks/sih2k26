import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { env } from '../../config/env';
import { sendError } from '../../utils/response';
import { sequelize } from '../../config/db';
import { District, Road, Bridge, Route } from '../../models/postgres';
import { FieldReport, Alert, ActiveLearningSample } from '../../models/mongo';

const router = Router();

/**
 * Internal service-to-service API. NOT exposed to the browser.
 * Guarded by the shared CORE_BACKEND_INTERNAL_KEY header so the ML service
 * can pull real DB context without a user JWT.
 */
router.use((req: Request, res: Response, next: any) => {
  const key = req.headers['x-internal-key'] as string | undefined;
  const configuredKey = env.coreBackendInternalKey || 'raahi_internal_secret_key_2026';
  if (key && key === configuredKey) {
    return next();
  }
  if (!env.coreBackendInternalKey) {
    // If not set in env, allow internal communication in local development
    return next();
  }
  return sendError(res, 'Forbidden: invalid internal key', 403);
});

/**
 * GET /api/internal/ml/corridor-context
 * Real corridor context used by the ML background pipeline to enrich route
 * risk scores with actual disruption inputs (road/bridge conditions, district
 * connectivity, live alert + field-report counts).
 */
router.get('/ml/corridor-context', async (_req: Request, res: Response) => {
  try {
    const [districts, roads, bridges, routes, activeAlerts, openFieldReports] = await Promise.all([
      District.findAll({ raw: true }),
      Road.findAll({ raw: true }),
      Bridge.findAll({ raw: true }),
      Route.findAll({ raw: true }),
      Alert.find({ status: 'active' }).lean().exec(),
      FieldReport.find({ status: { $in: ['Pending', 'In Progress'] } }).lean().exec(),
    ]);

    // Per-district disruption counts (real, from Mongo)
    const districtCounts: Record<string, { fieldReports: number; alerts: number }> = {};
    const routeAlerts: Record<string, number> = {};

    for (const a of activeAlerts as any[]) {
      if (a.districtId) {
        districtCounts[a.districtId] = districtCounts[a.districtId] || { fieldReports: 0, alerts: 0 };
        districtCounts[a.districtId].alerts += 1;
      } else if (a.routeId) {
        routeAlerts[a.routeId] = (routeAlerts[a.routeId] || 0) + 1;
      }
    }
    for (const fr of openFieldReports as any[]) {
      if (fr.districtId) {
        districtCounts[fr.districtId] = districtCounts[fr.districtId] || { fieldReports: 0, alerts: 0 };
        districtCounts[fr.districtId].fieldReports += 1;
      }
    }

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        districts,
        roads,
        bridges,
        routes,
        disruptions: { districtCounts, routeAlerts },
      },
    });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/internal/ml/active-learning/samples
 * Returns active learning samples (pending or all) for continual retraining.
 */
router.get('/ml/active-learning/samples', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending';
    const filter: any = status === 'all' ? {} : { status };
    const samples = await ActiveLearningSample.find(filter).sort({ createdAt: -1 }).lean().exec();

    return res.json({
      success: true,
      data: samples,
      count: samples.length,
    });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * PATCH /api/internal/ml/active-learning/mark-incorporated
 * Marks samples incorporated with retrainedAt timestamp.
 */
router.patch('/ml/active-learning/mark-incorporated', async (req: Request, res: Response) => {
  try {
    const { sampleIds } = req.body || {};
    const filter = Array.isArray(sampleIds) && sampleIds.length > 0
      ? { sampleId: { $in: sampleIds } }
      : { status: 'pending' };

    const result = await ActiveLearningSample.updateMany(filter, {
      $set: {
        status: 'incorporated',
        retrainedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Active learning samples marked incorporated',
      modifiedCount: result.modifiedCount,
    });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

export default router;
