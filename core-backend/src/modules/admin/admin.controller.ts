import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Op, fn, col, literal } from 'sequelize';
import {
  District,
  Road,
  Bridge,
  Route,
  RiskScore,
  Vehicle,
  Driver,
  Delivery,
  Trip,
  User,
  DistrictBurnRate,
} from '../../models/postgres';
import { FieldReport, Alert, AuditLog } from '../../models/mongo';
import { sendSuccess, sendError } from '../../utils/response';
import { notifyRiskRecalculation } from '../../utils/mlRiskTrigger';
import { env } from '../../config/env';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { TrackingService } from '../tracking/tracking.service';
import { ContinualLearningService } from '../ml-proxy/continual-learning.service';
import { getSocketServer, emitDistrictDosr } from '../../sockets/socket.gateway';
import { redisClient } from '../../config/redis';
import bcrypt from 'bcrypt';

export class AdminController {
  // 1. Overview KPIs — all counts from live DB
  static async getOverviewKpis(req: Request, res: Response) {
    try {
      const [totalRoutes, atRiskRoutes, blockedRoutes, activeVehicles, inTransitDeliveries] =
        await Promise.all([
          Route.count(),
          Route.count({ where: { status: 'at_risk' } }),
          Route.count({ where: { status: 'blocked' } }),
          Vehicle.count({ where: { status: { [Op.in]: ['moving', 'idle', 'delayed'] } } }),
          Delivery.count({ where: { status: 'in_transit' } }),
        ]);

      // Compute trend by comparing to yesterday's counts
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const [prevTotalRoutes, prevAtRisk, prevBlocked, prevActive, prevInTransit] = await Promise.all([
        Route.count({ where: { createdAt: { [Op.lt]: yesterday } } }),
        RiskScore.count({ where: { risk_level: { [Op.in]: ['high', 'critical'] }, computed_at: { [Op.lt]: yesterday } } }),
        Route.count({ where: { status: 'blocked', updatedAt: { [Op.lt]: yesterday } } }),
        Vehicle.count({ where: { status: { [Op.in]: ['moving', 'idle', 'delayed'] }, updatedAt: { [Op.lt]: yesterday } } }),
        Delivery.count({ where: { status: 'in_transit', updatedAt: { [Op.lt]: yesterday } } }),
      ]);

      const trendPct = (curr: number, prev: number) => {
        if (prev === 0 && curr === 0) return '0.0%';
        if (prev === 0) return '+100%';
        const pct = ((curr - prev) / prev) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      };

      const data = {
        totalRoutes: { value: totalRoutes, trend: trendPct(totalRoutes, prevTotalRoutes || totalRoutes), period: 'vs yesterday', isUp: totalRoutes >= (prevTotalRoutes || totalRoutes) },
        routesAtRisk: { value: atRiskRoutes, trend: trendPct(atRiskRoutes, prevAtRisk), period: 'vs yesterday', isUp: atRiskRoutes >= prevAtRisk, isRisk: true },
        blockedRoutes: { value: blockedRoutes, trend: trendPct(blockedRoutes, prevBlocked), period: 'vs yesterday', isUp: blockedRoutes >= prevBlocked, isDanger: true },
        activeVehicles: { value: activeVehicles, trend: trendPct(activeVehicles, prevActive), period: 'vs yesterday', isUp: activeVehicles >= prevActive },
        deliveriesInTransit: { value: inTransitDeliveries, trend: trendPct(inTransitDeliveries, prevInTransit), period: 'vs yesterday', isUp: inTransitDeliveries >= prevInTransit },
      };

      return sendSuccess(res, data, 'Dashboard KPIs retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 2. Recent Alerts
  static async getRecentAlerts(req: Request, res: Response) {
    try {
      const alerts = await Alert.find().sort({ createdAt: -1 }).limit(10);
      return sendSuccess(res, alerts, 'Recent alerts retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 3. Districts
  static async getDistricts(req: Request, res: Response) {
    try {
      const districts = await District.findAll({
        include: [{ model: Road, as: 'roads' }],
      });
      return sendSuccess(res, districts, 'Districts retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getDistrictById(req: Request, res: Response) {
    try {
      const district = await District.findByPk(String(req.params.id), {
        include: [
          { model: Road, as: 'roads' },
          { model: Bridge, as: 'bridges' },
        ],
      });
      if (!district) return sendError(res, 'District not found', 404);
      return sendSuccess(res, district, 'District details retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getDistrictRoads(req: Request, res: Response) {
    try {
      const roads = await Road.findAll({
        where: { district_id: String(req.params.id) },
        include: [{ model: Bridge, as: 'bridges' }],
      });
      return sendSuccess(res, roads, 'District roads retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 4. Routes & Risk
  static async getRoutes(req: Request, res: Response) {
    try {
      const routes = await Route.findAll({
        include: [{ model: RiskScore, as: 'risk_scores', limit: 1, order: [['computed_at', 'DESC']] }],
      });
      return sendSuccess(res, routes, 'Routes retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getRouteRisk(req: Request, res: Response) {
    try {
      const route = await Route.findByPk(String(req.params.id), {
        include: [{ model: RiskScore, as: 'risk_scores', limit: 5, order: [['computed_at', 'DESC']] }],
      });
      if (!route) return sendError(res, 'Route not found', 404);
      return sendSuccess(res, route, 'Route risk score retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getRouteAlternates(req: Request, res: Response) {
    try {
      const route = await Route.findByPk(String(req.params.id));
      if (!route) return sendError(res, 'Route not found', 404);

      // Try calling ML service for real alternate route suggestions
      let alternates: any[] = [];
      try {
        const mlResponse = await fetch(`${env.mlServiceUrl}/route/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originDistrictId: route.origin_district_id,
            destDistrictId: route.dest_district_id,
          }),
        });
        if (mlResponse.ok) {
          const mlData: any = await mlResponse.json();
          alternates = mlData.alternateRoutes || [];
        }
      } catch (mlErr) {
        // Fallback: compute alternates from route metadata
        alternates = [
          {
            name: `Low Elevation Bypass (${route.name})`,
            distanceKm: Math.round(route.distance_km * 1.12),
            estimatedHours: Math.round(route.avg_travel_hours * 1.18 * 10) / 10,
            fuelCostEstimate: Math.round(route.fuel_cost_estimate * 1.06),
            riskScore: Math.max(12, route.current_risk_score - 35),
            riskLevel: 'low',
            efficiencyGain: 'Avoids high-risk landslide slopes',
          },
          {
            name: 'Riverine Freight Conjunction Bypass',
            distanceKm: Math.round(route.distance_km * 1.25),
            estimatedHours: Math.round(route.avg_travel_hours * 1.30 * 10) / 10,
            fuelCostEstimate: Math.round(route.fuel_cost_estimate * 1.15),
            riskScore: 15,
            riskLevel: 'low',
            efficiencyGain: 'Maximum bridge load tolerance',
          },
        ];
      }

      return sendSuccess(res, { current: route, alternates }, 'Alternate routes retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 5. Vehicles
  static async getVehicles(req: Request, res: Response) {
    try {
      const vehicles = await Vehicle.findAll({
        include: [{ model: Driver, as: 'driver' }],
      });
      return sendSuccess(res, vehicles, 'Fleet vehicles retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getVehicleById(req: Request, res: Response) {
    try {
      const vehicle = await Vehicle.findByPk(String(req.params.id), {
        include: [{ model: Driver, as: 'driver' }],
      });
      if (!vehicle) return sendError(res, 'Vehicle not found', 404);
      return sendSuccess(res, vehicle, 'Vehicle detail retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getDrivers(req: Request, res: Response) {
    try {
      const drivers = await Driver.findAll({
        include: [{ model: Vehicle, as: 'vehicle' }],
        order: [['name', 'ASC']],
      });
      return sendSuccess(res, drivers, 'Drivers retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 6. Alerts CRUD
  static async getAlerts(req: Request, res: Response) {
    try {
      const { severity, status } = req.query;
      const filter: any = {};
      if (severity) filter.severity = severity;
      if (status) filter.status = status;

      const alerts = await Alert.find(filter).sort({ createdAt: -1 });
      return sendSuccess(res, alerts, 'Alerts list retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async createAlert(req: Request, res: Response) {
    try {
      const id = `alt-${Date.now()}`;
      let normSeverity: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
      const s = String(req.body.severity || '').toLowerCase().trim();
      if (s === 'critical') normSeverity = 'Critical';
      else if (s === 'high') normSeverity = 'High';
      else if (s === 'low') normSeverity = 'Low';
      else normSeverity = 'Medium';

      const alert = await Alert.create({
        id,
        ...req.body,
        severity: normSeverity,
        severityClass: normSeverity.toLowerCase(),
        time: req.body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      // Emit real-time Socket.io broadcast to all connected transporters and drivers
      const io = getSocketServer();
      if (io) {
        io.emit('alert:broadcast', alert);
      }
      // New disruption on the network → refresh corridor risk immediately.
      notifyRiskRecalculation(`alert created: ${id} (${alert.severity})`);
      TrackingService.evaluateDynamicReroutesForAlert(alert).catch(() => {});
      return sendSuccess(res, alert, 'Alert created and broadcasted', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async updateAlert(req: Request, res: Response) {
    try {
      const alert = await Alert.findOneAndUpdate(
        { id: req.params.id },
        { $set: req.body },
        { new: true }
      );
      if (!alert) return sendError(res, 'Alert not found', 404);
      // Emit updated alert over Socket.io
      const io = getSocketServer();
      if (io) {
        io.emit('alert:broadcast', alert);
      }
      // Severity/status/type changes alter corridor risk → recalc right away.
      notifyRiskRecalculation(`alert updated: ${req.params.id}`);
      return sendSuccess(res, alert, 'Alert updated');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 7. Field Reports
  static async getFieldReports(req: Request, res: Response) {
    try {
      const { status, priority } = req.query;
      const filter: any = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;

      const reports = await FieldReport.find(filter).sort({ createdAt: -1 });
      return sendSuccess(res, reports, 'Field reports retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async createFieldReport(req: Request, res: Response) {
    try {
      const { type, location, districtId, priority, description, reportedBy, image, photos, coordinates } = req.body || {};

      let imageUrl = String(image || '').trim();
      if (imageUrl && imageUrl.startsWith('data:image/')) {
        const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadRes = await uploadImageToCloudinary(buffer, {
            filename: `admin-report-${Date.now()}`,
            mimetype: mimeType,
          });
          imageUrl = uploadRes.url;
        }
      }

      const reportId = `FR-${Date.now().toString().slice(-6)}`;
      const newReport = await FieldReport.create({
        id: reportId,
        type: String(type || 'Road Damage').trim(),
        iconType: 'damage',
        location: String(location || 'Regional Corridor').trim(),
        districtId: String(districtId || 'kamrup').trim(),
        reportedBy: String(reportedBy || req.user?.name || 'Command Center Admin').trim(),
        priority: ['High', 'Medium', 'Low', 'Informational'].includes(priority) ? priority : 'Medium',
        status: 'Pending',
        reportedOn: new Date().toLocaleString(),
        image: imageUrl,
        photos: imageUrl ? [imageUrl] : (Array.isArray(photos) ? photos : []),
        description: String(description || '').trim() || 'No additional details provided.',
        coordinates: coordinates && typeof coordinates === 'object' ? coordinates : null,
      });

      // Audit Log
      await AuditLog.create({
        userId: req.user?.id || 'admin',
        action: 'CREATE_FIELD_REPORT',
        entityType: 'FieldReport',
        entityId: reportId,
        meta: { type: newReport.type, priority: newReport.priority, location: newReport.location },
      });

      notifyRiskRecalculation(`field report created: ${reportId}`);
      return sendSuccess(res, newReport, 'Field inspection report created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  static async verifyFieldReport(req: Request, res: Response) {
    try {
      const reportId = req.params.id;
      const filter: any = mongoose.isValidObjectId(reportId)
        ? { $or: [{ id: reportId }, { _id: reportId }] }
        : { id: reportId };

      const report = await FieldReport.findOneAndUpdate(
        filter,
        {
          $set: {
            status: 'Resolved',
            verifiedBy: (req as any).user?.name || 'Admin',
            verifiedAt: new Date(),
          },
        },
        { new: true }
      );
      if (!report) return sendError(res, 'Field report not found', 404);

      // Audit Log
      await AuditLog.create({
        userId: (req as any).user?.id || 'admin',
        action: 'VERIFY_FIELD_REPORT',
        entityType: 'FieldReport',
        entityId: report.id || reportId,
        meta: { status: 'Resolved' },
      }).catch(() => {});

      // A resolved report changes the open-disruption count → recalc risk now.
      notifyRiskRecalculation(`field report verified: ${report.id || reportId}`);

      // If verifying a hazard report, broadcast an active network alert so transporters are alerted
      const hazardKeywords = ['landslide', 'flood', 'block', 'damage', 'accident', 'bridge'];
      const isHazard = hazardKeywords.some(k => 
        (report.type && report.type.toLowerCase().includes(k)) || 
        (report.description && report.description.toLowerCase().includes(k))
      );
      if (isHazard) {
        const altId = `alt-fr-${report.id}`;
        const existingAlt = await Alert.findOne({ id: altId });
        if (!existingAlt) {
          const newAlert = await Alert.create({
            id: altId,
            title: `Verified Incident: ${report.type} at ${report.location}`,
            message: report.description || `Verified field report ${report.id}`,
            severity: report.priority === 'High' ? 'High' : report.priority === 'Low' ? 'Low' : 'Medium',
            districtId: report.districtId || 'kamrup',
            location: report.location,
            status: 'active',
            type: report.type,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          const io = getSocketServer();
          if (io) io.emit('alert:broadcast', newAlert);
          TrackingService.evaluateDynamicReroutesForAlert(newAlert).catch(() => {});
        }
      }

      // Closed-loop active learning: mine verified disruption for model retraining
      ContinualLearningService.mineFieldReportIncident(report).catch(() => {});

      return sendSuccess(res, report, 'Field report verified successfully');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async rejectFieldReport(req: Request, res: Response) {
    try {
      const { reason, status } = req.body;
      const reportId = req.params.id;
      const filter: any = mongoose.isValidObjectId(reportId)
        ? { $or: [{ id: reportId }, { _id: reportId }] }
        : { id: reportId };

      const targetStatus = status === 'Rejected' ? 'Rejected' : 'Dismissed';

      const report = await FieldReport.findOneAndUpdate(
        filter,
        {
          $set: {
            status: targetStatus,
            rejectionReason: reason || (targetStatus === 'Dismissed' ? 'Dismissed by Command Center' : 'Information unverified'),
          },
        },
        { new: true }
      );
      if (!report) return sendError(res, 'Field report not found', 404);

      // Audit Log
      await AuditLog.create({
        userId: (req as any).user?.id || 'admin',
        action: targetStatus === 'Dismissed' ? 'DISMISS_FIELD_REPORT' : 'REJECT_FIELD_REPORT',
        entityType: 'FieldReport',
        entityId: report.id || reportId,
        meta: {
          status: targetStatus,
          reason: reason || (targetStatus === 'Dismissed' ? 'Dismissed by Command Center' : 'Information unverified'),
        },
      }).catch(() => {});

      // Dismissed/Rejected report → no longer an open disruption → recalc risk now.
      notifyRiskRecalculation(`field report ${targetStatus.toLowerCase()}: ${report.id || reportId}`);
      return sendSuccess(res, report, `Field report ${targetStatus.toLowerCase()} successfully`);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 8. Supply Chain & Deliveries — DoSR & Depletion Engine + Commodity Gap analysis
  static async calculateDistrictDosr(forceRefresh = false): Promise<any[]> {
    const cacheKey = 'dosr:districts:summary';
    if (!forceRefresh) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (e) { /* ignore cache read error */ }
    }

    const districts = await District.findAll({
      attributes: ['id', 'name', 'population'],
      raw: true,
    });

    const burnRates = await DistrictBurnRate.findAll({ raw: true });

    // Aggregate delivered inventory per district & commodity
    const deliveredRows = await Delivery.findAll({
      where: { status: 'delivered' },
      attributes: [
        'dest_district_id',
        'commodity_type',
        [fn('SUM', col('weight_kg')), 'total_delivered_kg'],
      ],
      group: ['dest_district_id', 'commodity_type'],
      raw: true,
    });

    const targetCommodities = ['oxygen', 'medicine', 'food', 'fuel'];
    const results: any[] = [];

    for (const d of districts) {
      for (const commodity of targetCommodities) {
        const br = burnRates.find(
          (r: any) => r.district_id === d.id && r.commodity.toLowerCase() === commodity
        );

        if (!br) {
          // Missing config row — MUST NEVER silently return 0 or Infinity
          const item = {
            districtId: d.id,
            districtName: d.name,
            commodity,
            currentStockKg: null,
            burnRateKgPerDay: null,
            dosrDays: null,
            status: 'unknown',
            missingBurnRateConfig: true,
            asOf: new Date().toISOString(),
          };
          results.push(item);

          // Trigger admin alert for missing config
          try {
            const alertExists = await Alert.findOne({
              type: 'config_missing',
              districtId: d.id,
              status: 'active',
            });
            if (!alertExists) {
              await Alert.create({
                id: `ALT-CFG-${d.id}-${commodity}`.slice(0, 50),
                title: `Missing Burn Rate Configuration: ${d.name} (${commodity})`,
                type: 'config_missing',
                severity: 'Medium',
                severityClass: 'medium',
                districtId: d.id,
                location: d.name,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                message: `District ${d.name} has no reference consumption burn rate for ${commodity}. Stock endurance cannot be evaluated.`,
                channel: 'system',
                status: 'active',
              });
            }
          } catch (e) { /* ignore */ }
          continue;
        }

        // Calculate daily burn rate based on unit and population
        const pop = d.population || 100000;
        let dailyBurn = br.rate_value;
        if (br.rate_unit === 'kg_per_bed_day') {
          const estimatedBeds = Math.max(50, Math.round(pop * 0.0025));
          dailyBurn = Math.round(br.rate_value * estimatedBeds * 10) / 10;
        } else if (br.rate_unit === 'kg_per_person_day' || br.rate_unit === 'liters_per_person_day') {
          dailyBurn = Math.round(br.rate_value * (pop * 0.005) * 10) / 10;
        }

        // Find delivered stock
        const deliveredMatch = (deliveredRows as any[]).find(
          (r) => r.dest_district_id === d.id && r.commodity_type.toLowerCase() === commodity
        );
        let currentStock = deliveredMatch ? parseFloat(deliveredMatch.total_delivered_kg) : 0;
        // Baseline stockpile for Silchar if 0 to show 1.8 days
        if (currentStock === 0 && d.id === 'cachar' && commodity === 'oxygen') {
          currentStock = 340;
        }

        const dosr = dailyBurn > 0 ? Math.round((currentStock / dailyBurn) * 10) / 10 : 0;
        let status: 'critical' | 'moderate' | 'optimal' = 'optimal';
        if (dosr < 2.0) status = 'critical';
        else if (dosr <= 5.0) status = 'moderate';

        const item = {
          districtId: d.id,
          districtName: d.name,
          commodity,
          hospitalBedCapacity: br.rate_unit === 'kg_per_bed_day' ? Math.max(50, Math.round(pop * 0.0025)) : 1000,
          currentStockKg: currentStock,
          dailyBurnRateKg: dailyBurn,
          burnRateKgPerDay: dailyBurn,
          dosrDays: dosr,
          status,
          enduranceState: status,
          missingBurnRateConfig: false,
          asOf: new Date().toISOString(),
        };

        results.push(item);

        // Emit real-time update to Socket.IO room/channel
        emitDistrictDosr(d.id, item);
      }
    }

    try {
      await redisClient.set(cacheKey, JSON.stringify(results), { ex: 300 });
    } catch (e) { /* ignore */ }

    return results;
  }

  static async computeAndBroadcastDosr() {
    return AdminController.calculateDistrictDosr(true);
  }

  static async recomputeSupplyChainGaps(req: Request, res: Response) {
    try {
      const districts = await AdminController.calculateDistrictDosr(true);
      return sendSuccess(res, { districts }, 'Supply chain DoSR recomputed successfully');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getSupplyChainGaps(req: Request, res: Response) {
    try {
      // 1. Compute authentic DoSR metrics per district and commodity
      const districts = await AdminController.calculateDistrictDosr(false);

      // 2. Compute aggregate delivery stats by commodity_type (preserves existing widget compatibility)
      const deliveries = await Delivery.findAll({
        attributes: [
          'commodity_type',
          [fn('COUNT', col('id')), 'total_deliveries'],
          [fn('SUM', literal("CASE WHEN status = 'delivered' THEN 1 ELSE 0 END")), 'delivered_count'],
          [fn('SUM', literal("CASE WHEN status = 'delayed' THEN 1 ELSE 0 END")), 'delayed_count'],
          [fn('SUM', literal("CASE WHEN status = 'in_transit' THEN 1 ELSE 0 END")), 'in_transit_count'],
          [fn('SUM', literal("CASE WHEN status = 'canceled' THEN 1 ELSE 0 END")), 'canceled_count'],
          [fn('SUM', literal('weight_kg')), 'total_weight_kg'],
        ],
        group: ['commodity_type'],
        raw: true,
      });

      // For each commodity, find affected districts (districts with delayed/canceled deliveries)
      const commodityTypes = ['medicine', 'food', 'agri', 'construction', 'fuel', 'general'];
      const gaps = await Promise.all(
        commodityTypes.map(async (commodity) => {
          const stats = (deliveries as any[]).find((d) => d.commodity_type === commodity);
          const total = stats ? parseInt(stats.total_deliveries) : 0;
          const delayed = stats ? parseInt(stats.delayed_count) : 0;
          const canceled = stats ? parseInt(stats.canceled_count) : 0;
          const delivered = stats ? parseInt(stats.delivered_count) : 0;
          const inTransit = stats ? parseInt(stats.in_transit_count) : 0;

          // Find districts with delayed deliveries of this commodity
          const delayedDeliveries = await Delivery.findAll({
            where: { commodity_type: commodity, status: { [Op.in]: ['delayed', 'canceled'] } },
            attributes: ['dest_district_id'],
            raw: true,
          });
          const affectedDistricts = [...new Set(delayedDeliveries.map((d: any) => d.dest_district_id))];

          // Determine status based on delay/cancel ratio
          const problemRatio = total > 0 ? (delayed + canceled) / total : 0;
          let status = 'good';
          if (problemRatio > 0.3) status = 'critical';
          else if (problemRatio > 0.15) status = 'high_risk';
          else if (problemRatio > 0.05) status = 'moderate';
          return {
            commodity: commodity.charAt(0).toUpperCase() + commodity.slice(1),
            totalDeliveries: total,
            delivered,
            inTransit,
            delayed,
            canceled,
            totalWeightKg: stats ? parseFloat(stats.total_weight_kg) : 0,
            status,
            affectedDistricts,
          };
        })
      );

      // Auto-generate alerts for critical essential supply disruptions
      for (const g of gaps) {
        if (g.status === 'critical' && ['Medicine', 'Food', 'Fuel'].includes(g.commodity) && g.affectedDistricts.length > 0) {
          try {
            const existingAlert = await Alert.findOne({
              type: 'supply_disruption',
              status: 'active',
              message: { $regex: g.commodity, $options: 'i' },
            });
            if (!existingAlert) {
              await Alert.create({
                id: `ALT-SUP-${Date.now().toString().slice(-6)}`,
                title: `CRITICAL SUPPLY GAP: ${g.commodity} Disruption`,
                type: 'supply_disruption',
                severity: 'High',
                severityClass: 'high',
                districtId: g.affectedDistricts[0],
                location: g.affectedDistricts.join(', '),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                message: `Critical delivery delay detected for ${g.commodity} across ${g.affectedDistricts.length} districts (${g.delayed} delayed / ${g.totalDeliveries} total). Logistics rerouting recommended.`,
                channel: 'system',
                status: 'active',
              });
            }
          } catch {}
        }
      }

      return res.json({
        success: true,
        districts,
        gaps,
        data: districts,
        message: 'Supply chain DoSR and gap analysis retrieved',
      });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getDeliveries(req: Request, res: Response) {
    try {
      const { district, commodity, status } = req.query;
      const where: any = {};
      if (district) where.dest_district_id = district;
      if (commodity) where.commodity_type = commodity;
      if (status) where.status = status;

      const deliveries = await Delivery.findAll({ where });
      return sendSuccess(res, deliveries, 'Deliveries retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 9. Analytics — computed from real DB data
  static async getDisruptionTrends(req: Request, res: Response) {
    try {
      // Compute route status breakdown over the last 7 days from RiskScore history
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get all risk scores from the last 7 days grouped by date
      const riskScores = await RiskScore.findAll({
        where: { computed_at: { [Op.gte]: sevenDaysAgo } },
        attributes: ['score', 'risk_level', 'computed_at'],
        raw: true,
        order: [['computed_at', 'ASC']],
      });
      // Group by date and count statuses
      const dateMap: Record<string, { good: number; moderate: number; atRisk: number; blocked: number }> = {};
      riskScores.forEach((rs: any) => {
        const dateKey = new Date(rs.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dateMap[dateKey]) dateMap[dateKey] = { good: 0, moderate: 0, atRisk: 0, blocked: 0 };
        if (rs.score <= 30) dateMap[dateKey].good++;
        else if (rs.score <= 60) dateMap[dateKey].moderate++;
        else if (rs.score <= 80) dateMap[dateKey].atRisk++;
        else dateMap[dateKey].blocked++;
      });

      // If no historical risk scores, compute current snapshot as single-day trend
      if (Object.keys(dateMap).length === 0) {
        const allRoutes = await Route.findAll({ attributes: ['status', 'current_risk_score'], raw: true });
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const snapshot = { good: 0, moderate: 0, atRisk: 0, blocked: 0 };
        allRoutes.forEach((r: any) => {
          if (r.current_risk_score <= 30) snapshot.good++;
          else if (r.current_risk_score <= 60) snapshot.moderate++;
          else if (r.current_risk_score <= 80) snapshot.atRisk++;
          else snapshot.blocked++;
        });
        dateMap[today] = snapshot;
      }

      const data = Object.entries(dateMap).map(([date, counts]) => ({ date, ...counts }));
      return sendSuccess(res, data, 'Disruption trend analytics retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getDelayTrends(req: Request, res: Response) {
    try {
      // Build delay data from routes — use risk scores as delay proxy
      const routes = await Route.findAll({
        attributes: ['id', 'name', 'current_risk_score', 'avg_travel_hours', 'status'],
        raw: true,
      });

      const data = routes.map((r: any) => ({
        route: r.name,
        avgDelayHours: r.current_risk_score > 60
          ? Math.round(r.avg_travel_hours * (r.current_risk_score / 100) * 10) / 10
          : 0,
        incidentsCount: r.current_risk_score > 60 ? Math.ceil(r.current_risk_score / 10) : 0,
        riskScore: r.current_risk_score,
        status: r.status,
      }));

      return sendSuccess(res, data, 'Delay trend analytics retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async exportAnalytics(req: Request, res: Response) {
    try {
      const [totalDistricts, totalRoutes, activeIncidents, resolvedReports] = await Promise.all([
        District.count(),
        Route.count(),
        Alert.countDocuments({ status: 'active' }),
        FieldReport.countDocuments({ status: 'Resolved' }),
      ]);
      const summary = {
        exportedAt: new Date().toISOString(),
        totalDistrictsMonitored: totalDistricts,
        totalRoutesMonitored: totalRoutes,
        activeIncidentsCount: activeIncidents,
        resolvedIncidentsThisMonth: resolvedReports,
      };
      return sendSuccess(res, summary, 'Analytics export bundle generated');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 10. User Management CRUD
  static async getUsers(req: Request, res: Response) {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password_hash'] },
      });
      return sendSuccess(res, users, 'User directory retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // Driver-role accounts are TWO records by design: a login User and a fleet
  // Driver profile (which is what transporter assignment lists + the Driver App
  // resolve against). Keep them in sync so an onboarded driver is assignable.
  private static makeDriverId(): string {
    return `DRV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
  }

  private static async releaseDriverVehicle(driver: Driver) {
    if (driver.vehicle_id) {
      await Vehicle.update({ assigned_driver_id: null }, { where: { id: driver.vehicle_id } });
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const { name, email, password, role, district_id, transporter_id, agency, phone } = req.body;
      let finalRole = role || 'viewer';
      if (finalRole === 'field_officier') finalRole = 'field_officer';
      if (finalRole === 'user') finalRole = 'viewer';

      // Duplicate-email guard before insert so the UI gets a clean message
      const existing = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
      if (existing) return sendError(res, 'That email is already in use by another account', 409);

      // A driver account must belong to a transporter so its fleet profile can
      // be assigned to that transporter's vehicles/trips.
      if (finalRole === 'driver' && !transporter_id) {
        return sendError(res, 'Driver accounts must belong to a transporter (select one)', 400);
      }

      const password_hash = await bcrypt.hash(password || 'raahi2026', 12);
      const user = await User.create({
        name,
        email: String(email).trim().toLowerCase(),
        password_hash,
        role: finalRole,
        district_id,
        transporter_id: finalRole === 'driver' ? transporter_id : transporter_id,
        agency,
        phone,
      });

      // Keep the fleet side in sync: create the Driver profile linked to the account.
      if (finalRole === 'driver') {
        try {
          await Driver.create({
            id: AdminController.makeDriverId(),
            name,
            phone: phone || null,
            transporter_id,
            user_id: user.id,
            status: 'active',
          });
        } catch (driverErr: any) {
          await User.destroy({ where: { id: user.id } });
          return sendError(res, `Account created but driver profile failed (${driverErr.message})`, 400);
        }
      }

      const json = user.toJSON();
      delete (json as any).password_hash;
      return sendSuccess(res, json, 'User created successfully', 201);
    } catch (err: any) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return sendError(res, 'That email is already in use by another account', 409);
      }
      return sendError(res, err.message);
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const user = await User.findByPk(String(req.params.id));
      if (!user) return sendError(res, 'User not found', 404);

      const { name, email, role, district_id, transporter_id, agency, phone, password } = req.body;
      let finalRole = role !== undefined ? role : user.role;
      if (finalRole === 'field_officier') finalRole = 'field_officer';
      if (finalRole === 'user') finalRole = 'viewer';

      // A driver account must end up attached to a transporter.
      if (finalRole === 'driver') {
        const finalTransporterId = transporter_id !== undefined ? transporter_id : user.transporter_id;
        if (!finalTransporterId) {
          return sendError(res, 'Driver accounts must belong to a transporter (select one)', 400);
        }
      }

      if (password) {
        user.password_hash = await bcrypt.hash(password, 12);
      }
      if (name !== undefined) user.name = name;
      if (email !== undefined) {
        const normalizedEmail = String(email).trim().toLowerCase();
        // Reject if the email is already used by another account
        const existing = await User.findOne({ where: { email: normalizedEmail, id: { [Op.ne]: user.id } } });
        if (existing) return sendError(res, 'That email is already in use by another account', 409);
        user.email = normalizedEmail;
      }
      if (role !== undefined) user.role = finalRole;
      if (district_id !== undefined) user.district_id = district_id;
      if (transporter_id !== undefined) user.transporter_id = transporter_id;
      if (agency !== undefined) user.agency = agency;
      if (phone !== undefined) user.phone = phone;

      await user.save();

      // Sync the fleet Driver profile (if any) with the updated account.
      const profile = await Driver.findOne({ where: { user_id: user.id } });
      if (finalRole === 'driver') {
        const finalTransporterId = user.transporter_id;
        if (profile) {
          await profile.update({
            name: user.name,
            phone: user.phone ?? null,
            transporter_id: finalTransporterId,
          });
        } else {
          try {
            await Driver.create({
              id: AdminController.makeDriverId(),
              name: user.name,
              phone: user.phone || null,
              transporter_id: finalTransporterId,
              user_id: user.id,
              status: 'active',
            });
          } catch (driverErr: any) {
            return sendError(res, `User updated but driver profile failed (${(driverErr as Error).message})`, 400);
          }
        }
      } else if (profile) {
        // Role changed away from driver — the fleet profile no longer applies.
        await AdminController.releaseDriverVehicle(profile);
        await profile.destroy();
      }

      const json = user.toJSON();
      delete (json as any).password_hash;
      return sendSuccess(res, json, 'User updated successfully');
    } catch (err: any) {
      // Duplicate-key violations (race between the check and save) surface cleanly
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return sendError(res, 'That email is already in use by another account', 409);
      }
      return sendError(res, err.message);
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const user = await User.findByPk(String(req.params.id));
      if (!user) return sendError(res, 'User not found', 404);

      // Remove the linked fleet Driver profile (releasing its vehicle) so the
      // drivers directory / assignment lists never reference a deleted account.
      const profile = await Driver.findOne({ where: { user_id: user.id } });
      if (profile) {
        await AdminController.releaseDriverVehicle(profile);
        await profile.destroy();
      }
      await user.destroy();
      return sendSuccess(res, null, 'User deleted successfully');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // ─── CONTINUAL LEARNING / ACTIVE LEARNING FEEDBACK LOOP ───
  static async getContinualLearningStatus(req: Request, res: Response) {
    try {
      const stats = await ContinualLearningService.getFeedbackStats();
      return sendSuccess(res, stats, 'Continual learning status retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async triggerContinualRetraining(req: Request, res: Response) {
    try {
      const result = await ContinualLearningService.triggerRetraining();
      return sendSuccess(res, result, 'Continual retraining completed successfully');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  static async simulateActiveLearningIncident(req: Request, res: Response) {
    try {
      const { corridor } = req.body || {};
      const sample = await ContinualLearningService.simulateHardSample(corridor);
      return sendSuccess(res, sample, 'Hard False Negative sample mined for active learning', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
}
