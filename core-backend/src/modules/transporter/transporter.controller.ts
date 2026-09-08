import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  User,
  Vehicle,
  Driver,
  Trip,
  Delivery,
  Route,
} from '../../models/postgres';
import { Alert, FieldReport } from '../../models/mongo';
import { sendSuccess, sendError } from '../../utils/response';
import { notifyRiskRecalculation } from '../../utils/mlRiskTrigger';
import { env } from '../../config/env';

export class TransporterController {
  // 0. Self profile (company display data lives on the account's user row)
  static async updateOwnProfile(req: Request, res: Response) {
    try {
      const user = await User.findByPk(String(req.user?.id));
      if (!user) return sendError(res, 'Account not found', 404);

      const { name, phone, agency } = req.body || {};
      if (name !== undefined) {
        if (!String(name).trim()) return sendError(res, 'Name cannot be empty', 400);
        user.name = String(name).trim();
      }
      if (agency !== undefined) user.agency = String(agency).trim() || null;
      if (phone !== undefined) user.phone = String(phone).trim() || null;

      await user.save();
      const json = user.toJSON();
      delete (json as any).password_hash;
      return sendSuccess(res, json, 'Profile updated successfully');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 1. Overview KPIs
  static async getOverviewKpis(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';

      const [totalVehicles, movingVehicles, deliveriesInTransit, delayedDeliveries, completedDeliveries] =
        await Promise.all([
          Vehicle.count({ where: { transporter_id: transporterId } }),
          Vehicle.count({ where: { transporter_id: transporterId, status: 'moving' } }),
          Delivery.count({ where: { transporter_id: transporterId, status: 'in_transit' } }),
          Delivery.count({ where: { transporter_id: transporterId, status: 'delayed' } }),
          Delivery.count({ where: { transporter_id: transporterId, status: 'delivered' } }),
        ]);

      const totalCompleted = completedDeliveries;
      // Honest on-time rate: delivered vs (delivered + delayed), otherwise null
      const onTimeDenominator = completedDeliveries + delayedDeliveries;
      const onTimeRate = onTimeDenominator > 0
        ? `${Math.round((completedDeliveries / onTimeDenominator) * 100)}%`
        : null;

      const data = {
        totalFleet: totalVehicles,
        movingVehicles,
        deliveriesInTransit,
        delayedDeliveries,
        totalCompletedDeliveries: totalCompleted,
        onTimeRate,
        fuelEfficiencyAvg: null,
      };

      return sendSuccess(res, data, 'Transporter overview KPIs retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 2. Trip Planning & Creation
  static async planTrip(req: Request, res: Response) {
    try {
      const { originDistrictId, destDistrictId, commodityType, weightKg } = req.body;

      if (!originDistrictId || !destDistrictId) {
        return sendError(res, 'originDistrictId and destDistrictId are required', 400);
      }

      if (originDistrictId === destDistrictId) {
        return sendError(res, 'Origin and destination must be different districts.', 400);
      }

      // Query ML engine for real road network routing (Safest vs Shortest)
      let mlPlan: any = null;
      try {
        const mlRes = await fetch(`${env.mlServiceUrl}/route/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originDistrictId,
            destDistrictId,
            prefer: 'safest',
            commodityType: commodityType || 'general',
            weightKg: weightKg || 1000,
          }),
        });
        if (mlRes.ok) {
          const json: any = await mlRes.json();
          if (json.success) mlPlan = json;
        }
      } catch (e) {
        // Best effort ML engine
      }

      // Find or dynamically create Route in PostgreSQL
      let route = await Route.findOne({
        where: {
          origin_district_id: originDistrictId,
          dest_district_id: destDistrictId,
        },
      });

      const originName = mlPlan?.origin?.name || originDistrictId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const destName = mlPlan?.destination?.name || destDistrictId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const routeDistance = mlPlan?.recommended?.totalDistanceKm || mlPlan?.safest?.totalDistanceKm || 175;
      const routeTravelHours = Math.round((routeDistance / 45) * 10) / 10;
      const routeRisk = mlPlan?.recommended?.riskScore || 25;

      if (!route) {
        const oCode = originDistrictId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const dCode = destDistrictId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const routeId = `R-${oCode}-${dCode}`.slice(0, 50);

        const oLng = mlPlan?.origin?.lng || 77.2878;
        const oLat = mlPlan?.origin?.lat || 28.3842;
        const dLng = mlPlan?.destination?.lng || 77.4125;
        const dLat = mlPlan?.destination?.lat || 28.4006;
        const rawCoords = mlPlan?.recommended?.legs?.[0]?.geometry?.coordinates;
        const routeCoords = Array.isArray(rawCoords) && rawCoords.length > 1
          ? rawCoords
          : [[oLng, oLat], [dLng, dLat]];
        const routeGeom = JSON.stringify({ type: 'LineString', coordinates: routeCoords });

        route = await Route.create({
          id: routeId,
          name: `${originName} → ${destName}`,
          origin_district_id: originDistrictId,
          dest_district_id: destDistrictId,
          distance_km: routeDistance,
          avg_travel_hours: routeTravelHours,
          current_risk_score: routeRisk,
          status: routeRisk > 70 ? 'blocked' : routeRisk > 50 ? 'at_risk' : 'good',
          geom: routeGeom,
        });
      }

      const safestOpt = mlPlan?.safest;
      const shortestOpt = mlPlan?.shortest;
      const safestDist = safestOpt?.totalDistanceKm || route.distance_km;
      const shortestDist = shortestOpt?.totalDistanceKm || route.distance_km;

      const suggestion = {
        routeId: route.id,
        name: route.name,
        origin: { districtId: originDistrictId, name: originName },
        destination: { districtId: destDistrictId, name: destName },
        primary: {
          routeId: route.id,
          name: route.name,
          distanceKm: safestDist,
          estimatedHours: Math.round((safestDist / 45) * 10) / 10,
          fuelCostEstimate: Math.round(safestDist * 14.5),
          riskScore: safestOpt?.riskScore ?? route.current_risk_score,
          riskLevel: (safestOpt?.riskScore ?? route.current_risk_score) > 60 ? 'high' : 'low',
          geometry: safestOpt?.geometry || [],
          legs: safestOpt?.legs || [],
        },
        safest: safestOpt ? {
          routeId: route.id,
          name: `Safest Path via ${safestOpt.legs?.[0]?.roadLabel || 'National Highway'}`,
          distanceKm: safestOpt.totalDistanceKm,
          estimatedHours: Math.round((safestOpt.totalDistanceKm / 45) * 10) / 10,
          fuelCostEstimate: Math.round(safestOpt.totalDistanceKm * 14.5),
          riskScore: safestOpt.riskScore,
          riskLevel: safestOpt.riskLevel,
          geometry: safestOpt.geometry,
          legs: safestOpt.legs,
          roadCondition: safestOpt.legs?.[0]?.roadCondition || 'good',
        } : null,
        shortest: shortestOpt ? {
          routeId: route.id,
          name: `Shortest Direct via ${shortestOpt.legs?.[0]?.roadLabel || 'Corridor'}`,
          distanceKm: shortestOpt.totalDistanceKm,
          estimatedHours: Math.round((shortestOpt.totalDistanceKm / 50) * 10) / 10,
          fuelCostEstimate: Math.round(shortestOpt.totalDistanceKm * 14.5),
          riskScore: shortestOpt.riskScore,
          riskLevel: shortestOpt.riskLevel,
          geometry: shortestOpt.geometry,
          legs: shortestOpt.legs,
          roadCondition: shortestOpt.legs?.[0]?.roadCondition || 'good',
        } : null,
        alerts: mlPlan?.alerts || [],
        alternates: [
          ...(shortestOpt && shortestOpt.totalDistanceKm !== safestDist ? [{
            routeId: route.id,
            name: `Shortest Direct Corridor (${originName} → ${destName})`,
            distanceKm: shortestOpt.totalDistanceKm,
            estimatedHours: Math.round((shortestOpt.totalDistanceKm / 50) * 10) / 10,
            fuelCostEstimate: Math.round(shortestOpt.totalDistanceKm * 14.5),
            riskScore: shortestOpt.riskScore,
            riskLevel: shortestOpt.riskLevel,
          }] : []),
        ],
      };

      return sendSuccess(res, suggestion, 'Trip plan generated with real corridor evaluation');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async createTrip(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';

      // Resolve or dynamically create corridor route in PostgreSQL
      let route: Route | null = null;
      if (req.body.routeId) {
        route = await Route.findOne({ where: { id: req.body.routeId } });
      }
      if (!route && req.body.originDistrictId && req.body.destDistrictId) {
        route = await Route.findOne({
          where: {
            origin_district_id: req.body.originDistrictId,
            dest_district_id: req.body.destDistrictId,
          },
        });
        if (!route) {
          const originName = req.body.originDistrictId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const destName = req.body.destDistrictId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const routeGeom = JSON.stringify({
            type: 'LineString',
            coordinates: [[77.2878, 28.3842], [77.4125, 28.4006]],
          });
          route = await Route.create({
            id: req.body.routeId || `R-${Date.now().toString(36).toUpperCase()}`,
            name: `${originName} → ${destName}`,
            origin_district_id: req.body.originDistrictId,
            dest_district_id: req.body.destDistrictId,
            distance_km: req.body.distanceKm || 175,
            avg_travel_hours: req.body.estimatedHours || 4,
            current_risk_score: 25,
            status: 'good',
            geom: routeGeom,
          });
        }
      }
      if (!route) {
        return sendError(res, 'Could not resolve corridor route for this trip', 400);
      }

      // Vehicle + driver verification
      const isTransporterOnly = req.user?.role === 'transporter' && transporterId;
      const vehicle = req.body.vehicleId
        ? await Vehicle.findOne({
            where: isTransporterOnly ? { id: req.body.vehicleId, transporter_id: transporterId } : { id: req.body.vehicleId },
          })
        : null;
      if (!vehicle) return sendError(res, 'Vehicle not found in fleet — select a real vehicle', 400);

      const driver = req.body.driverId
        ? await Driver.findOne({
            where: isTransporterOnly ? { id: req.body.driverId, transporter_id: transporterId } : { id: req.body.driverId },
          })
        : null;
      if (!driver) return sendError(res, 'Driver not found in fleet — select a real driver', 400);

      if (driver.vehicle_id && driver.vehicle_id !== vehicle.id) {
        return sendError(res, `Driver ${driver.name} is already assigned to vehicle ${driver.vehicle_id}`, 409);
      }
      if (vehicle.assigned_driver_id && vehicle.assigned_driver_id !== driver.id) {
        return sendError(res, `Vehicle ${vehicle.id} is already assigned to another driver`, 409);
      }

      const existingTrip = await Trip.findOne({
        where: {
          [Op.or]: [{ vehicle_id: vehicle.id }, { driver_id: driver.id }],
          status: { [Op.in]: ['planned', 'in_transit'] },
        },
      });
      if (existingTrip) {
        return sendError(res, `Vehicle or driver already has an active or planned trip (${existingTrip.id})`, 409);
      }

      const id = `TRIP-${Date.now().toString().slice(-6)}`;
      const trip = await Trip.create({
        id,
        transporter_id: transporterId,
        vehicle_id: vehicle.id,
        driver_id: driver.id,
        route_id: route.id,
        origin: route.name.split('→')[0]?.trim() || req.body.origin || route.origin_district_id,
        destination: route.name.split('→')[1]?.trim() || req.body.destination || route.dest_district_id,
        status: 'planned',
        progress_percent: 0,
        eta: new Date(Date.now() + Math.round(route.avg_travel_hours || 4) * 3600 * 1000),
      });

      // Link delivery / consignment if deliveryId or consignmentId provided
      const deliveryId = req.body.deliveryId || req.body.consignmentId;
      if (deliveryId) {
        const del = await Delivery.findOne({ where: { id: deliveryId, transporter_id: transporterId } });
        if (del) {
          await del.update({ trip_id: trip.id, status: 'in_transit' });
        }
      }

      // Link the assignment so the driver's context resolves vehicle + trip.
      await driver.update({ vehicle_id: vehicle.id, status: 'active' });
      await vehicle.update({
        assigned_driver_id: driver.id,
        current_trip_id: trip.id,
        current_route: `${trip.origin} → ${trip.destination}`,
        tracking_active: false,
        live_status: 'OFFLINE',
      });

      return sendSuccess(res, trip, 'Trip assigned — driver will start it from the Driver App', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getTrips(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const trips = await Trip.findAll({
        where: { transporter_id: transporterId },
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: Driver, as: 'driver' },
        ],
        order: [['createdAt', 'DESC']],
      });
      return sendSuccess(res, trips, 'Trips retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 3. Vehicles CRUD (Transporter & Admin Scoped)
  static async getVehicles(req: Request, res: Response) {
    try {
      const role = req.user?.role;
      const transporterId = req.user?.transporterId;
      const where: any = {};
      if (role === 'transporter' && transporterId) {
        where.transporter_id = transporterId;
      }
      const vehicles = await Vehicle.findAll({
        where,
        include: [{ model: Driver, as: 'driver' }],
        order: [['id', 'ASC']],
      });
      return sendSuccess(res, vehicles, 'Fleet vehicles retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async createVehicle(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      let assignedDriver: Driver | null = null;
      if (req.body.assigned_driver_id) {
        assignedDriver = await Driver.findOne({
          where: { id: req.body.assigned_driver_id, transporter_id: transporterId },
        });
        if (!assignedDriver) {
          return sendError(res, 'Driver not found in your fleet', 400);
        }
        // If this driver was previously assigned to another vehicle, release the old vehicle
        if (assignedDriver.vehicle_id) {
          await Vehicle.update(
            { assigned_driver_id: null },
            { where: { id: assignedDriver.vehicle_id, transporter_id: transporterId } }
          );
        }
      }

      const vehicle = await Vehicle.create({
        ...req.body,
        transporter_id: transporterId,
      });

      if (assignedDriver) {
        await assignedDriver.update({ vehicle_id: vehicle.id });
      }

      return sendSuccess(res, vehicle, 'Vehicle registered to fleet', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async updateVehicle(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const vehicle = await Vehicle.findOne({
        where: { id: req.params.id, transporter_id: transporterId },
      });
      if (!vehicle) return sendError(res, 'Vehicle not found', 404);

      if (req.body.assigned_driver_id !== undefined) {
        const newDriverId = req.body.assigned_driver_id;
        // If unassigning or assigning a different driver, release old driver
        if (vehicle.assigned_driver_id && vehicle.assigned_driver_id !== newDriverId) {
          await Driver.update(
            { vehicle_id: null },
            { where: { id: vehicle.assigned_driver_id, transporter_id: transporterId } }
          );
        }

        if (newDriverId) {
          const newDriver = await Driver.findOne({
            where: { id: newDriverId, transporter_id: transporterId },
          });
          if (!newDriver) return sendError(res, 'Driver not found in your fleet', 400);

          // If new driver was assigned to another vehicle, release that vehicle
          if (newDriver.vehicle_id && newDriver.vehicle_id !== vehicle.id) {
            await Vehicle.update(
              { assigned_driver_id: null },
              { where: { id: newDriver.vehicle_id, transporter_id: transporterId } }
            );
          }

          await newDriver.update({ vehicle_id: vehicle.id });
        }
      }

      await vehicle.update(req.body);
      return sendSuccess(res, vehicle, 'Vehicle updated');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async deleteVehicle(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const vehicle = await Vehicle.findOne({ where: { id: req.params.id, transporter_id: transporterId } });
      if (!vehicle) return sendError(res, 'Vehicle not found', 404);

      // Keep assignments consistent: release the driver, cancel open trips
      // (trips keep their vehicle/driver references for history — FK is NOT NULL)
      await Driver.update({ vehicle_id: null }, { where: { vehicle_id: vehicle.id } });
      await Trip.update(
        { status: 'canceled' },
        { where: { vehicle_id: vehicle.id, status: { [Op.in]: ['planned', 'in_transit'] } } }
      );
      await vehicle.destroy();
      return sendSuccess(res, null, 'Vehicle removed from fleet');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 4. Drivers CRUD (Transporter & Admin Scoped)
  static async getDrivers(req: Request, res: Response) {
    try {
      const role = req.user?.role;
      const transporterId = req.user?.transporterId;
      const where: any = {};
      if (role === 'transporter' && transporterId) {
        where.transporter_id = transporterId;
      }
      const drivers = await Driver.findAll({
        where,
        include: [{ model: Vehicle, as: 'vehicle' }],
        order: [['name', 'ASC']],
      });
      return sendSuccess(res, drivers, 'Drivers retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async createDriver(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const id = `DRV-${Date.now().toString().slice(-4)}`;

      // Keep assignment two-way: driver.vehicle_id ⇄ vehicle.assigned_driver_id
      if (req.body.vehicle_id) {
        const vehicle = await Vehicle.findOne({ where: { id: req.body.vehicle_id, transporter_id: transporterId } });
        if (!vehicle) return sendError(res, 'Vehicle not found in your fleet', 400);
        // Release any driver previously assigned to this vehicle
        if (vehicle.assigned_driver_id) {
          await Driver.update(
            { vehicle_id: null },
            { where: { id: vehicle.assigned_driver_id, transporter_id: transporterId } }
          );
        }
        await vehicle.update({ assigned_driver_id: id });
      }

      const driver = await Driver.create({
        id,
        ...req.body,
        transporter_id: transporterId,
      });
      return sendSuccess(res, driver, 'Driver onboarded', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async updateDriver(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const driver = await Driver.findOne({
        where: { id: req.params.id, transporter_id: transporterId },
      });
      if (!driver) return sendError(res, 'Driver not found', 404);

      // Re-assigning a driver to a different vehicle must keep both sides in sync
      if (req.body.vehicle_id !== undefined && req.body.vehicle_id !== driver.vehicle_id) {
        const newVehicle = req.body.vehicle_id
          ? await Vehicle.findOne({ where: { id: req.body.vehicle_id, transporter_id: transporterId } })
          : null;
        if (req.body.vehicle_id && !newVehicle) return sendError(res, 'Vehicle not found in your fleet', 400);
        // release previous vehicle
        if (driver.vehicle_id) await Vehicle.update({ assigned_driver_id: null }, { where: { id: driver.vehicle_id, transporter_id: transporterId } });
        if (newVehicle) {
          // release previous driver of new vehicle
          if (newVehicle.assigned_driver_id && newVehicle.assigned_driver_id !== driver.id) {
            await Driver.update({ vehicle_id: null }, { where: { id: newVehicle.assigned_driver_id, transporter_id: transporterId } });
          }
          await newVehicle.update({ assigned_driver_id: driver.id });
        }
      }

      await driver.update(req.body);
      return sendSuccess(res, driver, 'Driver updated');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async deleteDriver(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const driver = await Driver.findOne({ where: { id: req.params.id, transporter_id: transporterId } });
      if (!driver) return sendError(res, 'Driver not found', 404);

      // Release the vehicle + cancel any open trips assigned to this driver
      if (driver.vehicle_id) await Vehicle.update({ assigned_driver_id: null }, { where: { id: driver.vehicle_id } });
      await Vehicle.update({ assigned_driver_id: null }, { where: { assigned_driver_id: driver.id } });
      await Trip.update(
        { status: 'canceled' },
        { where: { driver_id: driver.id, status: { [Op.in]: ['planned', 'in_transit'] } } }
      );
      await driver.destroy();
      return sendSuccess(res, null, 'Driver removed');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 5. Relevant Alerts
  static async getAlerts(req: Request, res: Response) {
    try {
      const alerts = await Alert.find({ status: 'active' }).sort({ createdAt: -1 }).limit(10);
      return sendSuccess(res, alerts, 'Corridor alerts for fleet retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 6. Deliveries / Consignments
  static async createDelivery(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const { originDistrictId, destDistrictId, commodityType, priority, consigneeName, consigneePhone, weightKg, status } = req.body;

      if (!originDistrictId || !destDistrictId || !consigneeName || !consigneePhone) {
        return sendError(res, 'originDistrictId, destDistrictId, consigneeName and consigneePhone are required', 400);
      }
      if (originDistrictId === destDistrictId) {
        return sendError(res, 'Origin and destination districts must be different', 400);
      }

      const validCommodities = ['medicine', 'food', 'agri', 'construction', 'fuel', 'general'];
      let normCommodity = String(commodityType || 'general').toLowerCase().trim();
      if (normCommodity.includes('med') || normCommodity.includes('pharma') || normCommodity.includes('health')) normCommodity = 'medicine';
      else if (normCommodity.includes('food') || normCommodity.includes('ration') || normCommodity.includes('grain')) normCommodity = 'food';
      else if (normCommodity.includes('agri') || normCommodity.includes('tea') || normCommodity.includes('produce')) normCommodity = 'agri';
      else if (normCommodity.includes('fuel') || normCommodity.includes('petrol') || normCommodity.includes('diesel') || normCommodity.includes('lpg')) normCommodity = 'fuel';
      else if (normCommodity.includes('construct') || normCommodity.includes('cement') || normCommodity.includes('steel')) normCommodity = 'construction';
      if (!validCommodities.includes(normCommodity)) normCommodity = 'general';

      const validPriorities = ['low', 'medium', 'high', 'critical'];
      const normPriority = validPriorities.includes(String(priority || '').toLowerCase()) ? String(priority).toLowerCase() : 'medium';

      const id = `CON-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const delivery = await Delivery.create({
        id,
        transporter_id: transporterId,
        origin_district_id: originDistrictId,
        dest_district_id: destDistrictId,
        commodity_type: normCommodity as any,
        priority: normPriority as any,
        consignee_name: consigneeName,
        consignee_phone: consigneePhone,
        weight_kg: weightKg || 1000,
        status: status || 'in_transit',
      });

      return sendSuccess(res, delivery, 'Consignment registered for dispatch', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async getDeliveries(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const deliveries = await Delivery.findAll({
        where: { transporter_id: transporterId },
        order: [['createdAt', 'DESC']],
      });
      return sendSuccess(res, deliveries, 'Consignments retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async updateDeliveryStatus(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const delivery = await Delivery.findOne({
        where: { id: req.params.id, transporter_id: transporterId },
      });
      if (!delivery) return sendError(res, 'Consignment not found', 404);

      const { status } = req.body;
      delivery.status = status;
      if (status === 'delivered') {
        delivery.delivered_at = new Date();
      }
      await delivery.save();

      return sendSuccess(res, delivery, 'Consignment status updated');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async uploadProofOfDelivery(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const delivery = await Delivery.findOne({
        where: { id: req.params.id, transporter_id: transporterId },
      });
      if (!delivery) return sendError(res, 'Consignment not found', 404);

      const { podUrl } = req.body;
      if (!podUrl) return sendError(res, 'podUrl is required to attach proof of delivery', 400);
      delivery.pod_url = podUrl;
      delivery.status = 'delivered';
      delivery.delivered_at = new Date();
      await delivery.save();

      return sendSuccess(res, delivery, 'Proof of Delivery attached and delivery marked complete');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 7. Incident / Field Reporting from Transporter
  static async createFieldReport(req: Request, res: Response) {
    try {
      const id = `FR-${Date.now().toString().slice(-6)}`;
      const report = await FieldReport.create({
        id,
        reportedBy: req.user?.name || 'Driver on Route',
        status: 'Pending',
        reportedOn: new Date().toLocaleString(),
        ...req.body,
      });

      // New field report = real disruption input → refresh corridor risk NOW.
      notifyRiskRecalculation(`field report created: ${id}`);
      return sendSuccess(res, report, 'Incident reported successfully to regional command center', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 8. Documents & Compliance — vehicles from the real fleet only
  static async getDocuments(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const vehicles = await Vehicle.findAll({ where: { transporter_id: transporterId } });
      const documents = vehicles.map((v) => ({
        id: `DOC-${v.id}`,
        title: 'Fleet Registration & Compliance Record',
        category: 'Registration',
        expiryDate: null,
        status: 'valid',
        vehicleId: v.id,
      }));
      return sendSuccess(res, documents, 'Fleet compliance records retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // 9. History & Reports Export
  static async getDeliveryHistory(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const history = await Delivery.findAll({
        where: { transporter_id: transporterId },
        order: [['createdAt', 'DESC']],
      });
      return sendSuccess(res, history, 'Delivery history log retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  static async exportReports(req: Request, res: Response) {
    try {
      const transporterId = req.user?.transporterId || 'transporter_01';
      const [totalConsignments, delivered, delayed] = await Promise.all([
        Delivery.count({ where: { transporter_id: transporterId } }),
        Delivery.count({ where: { transporter_id: transporterId, status: 'delivered' } }),
        Delivery.count({ where: { transporter_id: transporterId, status: 'delayed' } }),
      ]);
      const denominator = delivered + delayed;
      const summary = {
        exportedAt: new Date().toISOString(),
        totalConsignments,
        onTimeRate: denominator > 0 ? `${Math.round((delivered / denominator) * 100)}%` : null,
        delivered,
        delayed,
      };
      return sendSuccess(res, summary, 'Transporter performance report export ready');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
}
