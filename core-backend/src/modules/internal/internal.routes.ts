import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { env } from '../../config/env';
import { sendError } from '../../utils/response';
import { sequelize } from '../../config/db';
import { District, Road, Bridge, Route } from '../../models/postgres';
import { FieldReport, Alert } from '../../models/mongo';

const router = Router();

/**
 * Internal service-to-service API. NOT exposed to the browser.
 * Guarded by the shared CORE_BACKEND_INTERNAL_KEY header so the ML service
 * can pull real DB context without a user JWT.
 */
router.use((req: Request, res: Response, next: any) => {
  const key = req.headers['x-internal-key'] as string | undefined;
  if (!env.coreBackendInternalKey || key !== env.coreBackendInternalKey) {
    return sendError(res, 'Forbidden: invalid internal key', 403);
  }
  next();
});

/**
 * GET /api/internal/ml/corridor-context
 * Real corridor context used by the ML background pipeline to enrich route
 * risk scores with actual disruption inputs (road/bridge conditions, district
 * connectivity, live alert + field-report counts).
 *
 * Response:
 * {
 *   generatedAt,
 *   districts: [{ id, name, connectivity_status, connectivity_score }],
 *   roads:     [{ id, name, district_id, condition, slope_risk, length_km, road_type }],
 *   bridges:   [{ id, road_id, district_id, status, load_capacity_tons }],
 *   routes:    [{ id, name, origin_district_id, dest_district_id, road_ids, status, current_risk_score }],
 *   disruptions: {
 *     districtCounts: { <districtId>: { fieldReports, alerts } },
 *     routeAlerts:    { <routeId>: alerts }
 *   }
 * }
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
      // Alerts are counted once: at district level when they have a district,
      // otherwise at route level (route-only alerts). No double counting.
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

export default router;
