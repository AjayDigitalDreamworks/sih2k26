import { Op } from 'sequelize';
import { ActiveLearningSample, IActiveLearningSample } from '../../models/mongo/ActiveLearningSample';
import { Route, District, Road } from '../../models/postgres';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const ML_SERVICE_URL = env.mlServiceUrl;

export class ContinualLearningService {
  /**
   * Evaluates a verified field report or on-road incident.
   * Automated Hard Sample Mining: If the model predicted a safe score (< 40)
   * on a corridor where an incident actually occurred, mine it as a Hard False Negative with 4.0x loss weight.
   */
  static async mineFieldReportIncident(report: any) {
    try {
      const districtId = String(report.districtId || report.district_id || report.district || 'kamrup').toLowerCase();
      const explicitRouteId = report.routeId || report.route_id;

      // Find route associated with this corridor / district
      let route = null;
      if (explicitRouteId) {
        route = await Route.findByPk(explicitRouteId);
      }
      if (!route) {
        route = await Route.findOne({
          where: {
            [Op.or]: [
              { origin_district_id: districtId },
              { dest_district_id: districtId },
            ],
          },
        });
      }

      const predictedRisk = route?.current_risk_score ?? 32;
      const isUnderpredicted = predictedRisk < 40;
      const sampleWeight = isUnderpredicted ? 4.0 : 1.5;

      const normPriority = String(report.priority || '').toUpperCase();
      const actualRiskScore = normPriority.includes('CRIT') ? 95 : normPriority.includes('HIGH') ? 88 : 78;

      // Extract road conditions if available
      const road = await Road.findOne({ where: { district_id: districtId } });

      const isLandslide = String(report.type || '').toLowerCase().includes('landslide');
      const isFlood = String(report.type || '').toLowerCase().includes('flood');

      const sampleId = `als_fr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const sample = await ActiveLearningSample.create({
        sampleId,
        routeId: route?.id || undefined,
        districtId,
        predictedRiskScore: predictedRisk,
        predictedRiskLevel: predictedRisk > 60 ? 'high' : predictedRisk > 30 ? 'medium' : 'low',
        actualOutcome: 'disruption',
        actualRiskScore,
        isFalseNegative: isUnderpredicted,
        isFalsePositive: false,
        sampleWeight,
        features: {
          slope_risk: road?.slope_risk ? road.slope_risk * 100 : isLandslide ? 65.0 : 35.0,
          rainfall_24h_mm: isFlood ? 58.0 : isLandslide ? 45.0 : 30.0,
          road_condition: road?.condition === 'blocked' ? 2.0 : road?.condition === 'damaged' ? 1.0 : 0.0,
          bridge_condition: 1.0,
          historical_disruptions: 4,
          congestion_level: 2.0,
          flood_risk_level: isFlood ? 80.0 : 20.0,
          landslide_probability: isLandslide ? 0.85 : 0.20,
          elevation_m: 450,
          river_proximity: 1.2,
          month: new Date().getMonth() + 1,
          road_distance_km: route?.distance_km ?? 60.0,
        },
        source: 'field_report_verified',
        referenceId: String(report.id || report._id || ''),
        status: 'pending',
        notes: isUnderpredicted
          ? `[HARD SAMPLE MINING] Ground-truth ${report.type || 'hazard'} in ${districtId} where model under-predicted risk (${predictedRisk} < 40). Elevated loss weight to ${sampleWeight}x.`
          : `Verified ground-truth report ${report.id} incorporated as active learning sample.`,
      });

      logger.info(`[ACTIVE LEARNING] Mined field sample ${sampleId} (False Negative: ${isUnderpredicted}, Loss Weight: ${sampleWeight}x)`);
      return sample;
    } catch (err: any) {
      logger.warn(`[ACTIVE LEARNING] Failed to mine field report sample: ${err.message}`);
      return null;
    }
  }

  /**
   * Logs trip feedback:
   * - Smooth run: model correctly allowed transit (sample_weight 1.0)
   * - Stranded/Incident: truck stopped or SOS triggered. If under-predicted (<40), 4.0x hard sample mining.
   */
  static async logTripOutcome(trip: any, outcome: 'smooth_transit' | 'stranded', reason?: string) {
    try {
      const routeId = trip.route_id;
      let predictedRisk = 30;
      let distanceKm = 80;

      if (routeId) {
        const route = await Route.findByPk(routeId);
        if (route) {
          predictedRisk = route.current_risk_score ?? 30;
          distanceKm = route.distance_km ?? 80;
        }
      }

      const isStranded = outcome === 'stranded';
      const isUnderpredicted = isStranded && predictedRisk < 40;
      const sampleWeight = isUnderpredicted ? 4.0 : isStranded ? 2.0 : 1.0;
      const actualRiskScore = isStranded ? 90 : 15;

      const sampleId = `als_trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const sample = await ActiveLearningSample.create({
        sampleId,
        routeId: routeId || undefined,
        districtId: trip.origin_district_id || trip.origin || undefined,
        predictedRiskScore: predictedRisk,
        predictedRiskLevel: predictedRisk > 60 ? 'high' : predictedRisk > 30 ? 'medium' : 'low',
        actualOutcome: outcome,
        actualRiskScore,
        isFalseNegative: isUnderpredicted,
        isFalsePositive: false,
        sampleWeight,
        features: {
          slope_risk: isStranded ? 55.0 : 18.0,
          rainfall_24h_mm: isStranded ? 42.0 : 6.0,
          road_condition: isStranded ? 2.0 : 0.0,
          bridge_condition: isStranded ? 1.0 : 0.0,
          historical_disruptions: isStranded ? 3 : 1,
          congestion_level: isStranded ? 3.0 : 0.0,
          flood_risk_level: isStranded ? 60.0 : 5.0,
          landslide_probability: isStranded ? 0.70 : 0.05,
          elevation_m: 350,
          river_proximity: 1.5,
          month: new Date().getMonth() + 1,
          road_distance_km: distanceKm,
        },
        source: isStranded ? 'trip_stranded' : 'trip_completed',
        referenceId: trip.id,
        status: 'pending',
        notes: isUnderpredicted
          ? `[HARD SAMPLE MINING] Truck ${trip.vehicle_id} stranded on trip ${trip.id} with safe model prediction (${predictedRisk} < 40). Reason: ${reason || 'unforeseen road disruption'}. Weight: ${sampleWeight}x.`
          : isStranded
          ? `Truck stranded on trip ${trip.id}: ${reason || 'interruption'}`
          : `Smooth transit completed on trip ${trip.id}. Ground truth confirmed safe.`,
      });

      logger.info(`[ACTIVE LEARNING] Logged trip outcome ${sampleId} (Outcome: ${outcome}, Weight: ${sampleWeight}x)`);
      return sample;
    } catch (err: any) {
      logger.warn(`[ACTIVE LEARNING] Failed to log trip outcome: ${err.message}`);
      return null;
    }
  }

  /**
   * Get active learning stats & feedback sample counts
   */
  static async getFeedbackStats() {
    const [totalSamples, pendingSamples, falseNegatives, smoothTransits, latestSamples] = await Promise.all([
      ActiveLearningSample.countDocuments(),
      ActiveLearningSample.countDocuments({ status: 'pending' }),
      ActiveLearningSample.countDocuments({ isFalseNegative: true }),
      ActiveLearningSample.countDocuments({ actualOutcome: 'smooth_transit' }),
      ActiveLearningSample.find().sort({ createdAt: -1 }).limit(10).lean().exec(),
    ]);

    let mlStatus: any = null;
    try {
      const mlRes = await fetch(`${ML_SERVICE_URL}/continual-learning/status`);
      if (mlRes.ok) {
        mlStatus = await mlRes.json();
      }
    } catch (e) {
      mlStatus = { status: 'ml_service_offline' };
    }

    return {
      totalSamples,
      pendingSamples,
      falseNegativesMined: falseNegatives,
      smoothTransitsLogged: smoothTransits,
      recentSamples: latestSamples,
      mlEngineStatus: mlStatus,
    };
  }

  /**
   * Trigger retraining via ML microservice
   */
  static async triggerRetraining() {
    const res = await fetch(`${ML_SERVICE_URL}/continual-learning/retrain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ML retraining service returned ${res.status}: ${errText}`);
    }

    return await res.json();
  }

  /**
   * Check drift status
   */
  static async getDriftStatus() {
    try {
      const res = await fetch(`${ML_SERVICE_URL}/continual-learning/drift-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) return await res.json();
    } catch {}
    return { drift_detected: false, status: 'service_offline' };
  }

  /**
   * Periodic scheduler check: If pending samples threshold is reached, automatically trigger retraining
   */
  static async checkAndTriggerScheduledRetraining() {
    try {
      const pendingCount = await ActiveLearningSample.countDocuments({ status: 'pending' });
      if (pendingCount >= 5) {
        logger.info(`[ACTIVE LEARNING] Automated scheduled trigger: ${pendingCount} pending feedback samples found. Invoking ML retraining...`);
        const result: any = await this.triggerRetraining();
        logger.info(`[ACTIVE LEARNING] Automated retraining finished successfully: Iteration #${result?.iteration || 1}`);
        return result;
      }
    } catch (err: any) {
      logger.warn(`[ACTIVE LEARNING] Scheduled retraining check notice: ${err.message}`);
    }
    return null;
  }

  /**
   * Simulation utility to create a synthetic hard false negative sample for testing & demonstrations
   */
  static async simulateHardSample(corridor: string = 'Guwahati → Silchar (NH-27)') {
    const sampleId = `als_sim_${Date.now()}`;
    const sample = await ActiveLearningSample.create({
      sampleId,
      routeId: 'R-01',
      districtId: 'dima_hasao',
      predictedRiskScore: 32,
      predictedRiskLevel: 'low',
      actualOutcome: 'stranded',
      actualRiskScore: 92,
      isFalseNegative: true,
      isFalsePositive: false,
      sampleWeight: 4.5,
      features: {
        slope_risk: 68.0,
        rainfall_24h_mm: 68.0,
        road_condition: 2.0,
        bridge_condition: 2.0,
        historical_disruptions: 5,
        congestion_level: 3.0,
        flood_risk_level: 75.0,
        landslide_probability: 0.88,
        elevation_m: 680,
        river_proximity: 0.8,
        month: new Date().getMonth() + 1,
        road_distance_km: 198.0,
      },
      source: 'simulation_test',
      status: 'pending',
      notes: `[DEMO ACTIVE LEARNING] Simulated mudslide disruption on ${corridor}. Predicted 32 (Safe) vs Actual 92 (Severe Blockage). Loss weight 4.5x.`,
    });

    return sample;
  }
}
