import { Vehicle, Trip, Driver, Route } from '../../models/postgres';
import { Alert } from '../../models/mongo/Alert';
import { redisClient } from '../../config/redis';
import { getSocketServer } from '../../sockets/socket.gateway';
import { logger } from '../../utils/logger';
import { R04_REAL_OSRM_DETOUR } from './detour-coords';

interface FleetVehicleSim {
  vehicleId: string;
  driverId: string;
  driverName: string;
  routeId: string;
  routeName: string;
  origin: string;
  destination: string;
  destLat: number;
  destLng: number;
  model: string;
  capacityKg: number;
  status: 'moving' | 'stopped' | 'delayed';
  speed: number;
  heading: number;
  fuel: number;
  isRerouted?: boolean;
  rerouteReason?: string;
  rerouteGeometry?: [number, number][];
  waypoints: [number, number][]; // [lat, lng]
  currentIndex: number;
  direction: 1 | -1;
  alertConfig?: {
    id: string;
    title: string;
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    location: string;
    message: string;
  };
}

export class FleetSimulationService {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;
  private static vehiclesSim: FleetVehicleSim[] = [];

  /**
   * Generates linear interpolation waypoints between key coordinates
   */
  private static interpolateWaypoints(coords: [number, number][], stepsPerSegment: number = 20): [number, number][] {
    const waypoints: [number, number][] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const [startLat, startLng] = coords[i];
      const [endLat, endLng] = coords[i + 1];
      for (let s = 0; s < stepsPerSegment; s++) {
        const ratio = s / stepsPerSegment;
        waypoints.push([
          startLat + (endLat - startLat) * ratio,
          startLng + (endLng - startLng) * ratio,
        ]);
      }
    }
    waypoints.push(coords[coords.length - 1]);
    return waypoints;
  }

  /**
   * Initializes fleet vehicle simulation configurations and DB records
   */
  public static async initialize(): Promise<void> {
    try {
      logger.info('Initializing 6-Vehicle Northeast Fleet Simulation...');

      // 1. Fetch real route geometries from PostgreSQL
      const routes = await Route.findAll({
        where: {
          id: ['R-01', 'R-KAMRUP-CACHAR', 'R-04', 'R-02', 'R-03', 'R-05'],
        },
        raw: true,
      });

      const routeGeomMap = new Map<string, [number, number][]>();
      for (const r of routes) {
        let g: any = r.geom;
        if (typeof g === 'string') {
          try { g = JSON.parse(g); } catch {}
        }
        let coords: [number, number][] = [];
        if (Array.isArray(g?.coordinates) && g.coordinates.length > 0) {
          coords = g.coordinates.map((c: any) => [c[1], c[0]]); // [lat, lng]
        } else if (Array.isArray(g) && g.length > 0) {
          coords = g;
        }
        if (coords.length > 0) {
          routeGeomMap.set(r.id, coords);
        }
      }

      // Extract high-resolution waypoints from the real road network geometry
      const extractWaypoints = (routeId: string, sampleCount: number = 260): [number, number][] => {
        const raw = routeGeomMap.get(routeId);
        if (raw && raw.length > 20) {
          const sampleStep = Math.max(1, Math.floor(raw.length / sampleCount));
          const sampled: [number, number][] = [];
          for (let i = 0; i < raw.length; i += sampleStep) {
            sampled.push(raw[i]);
          }
          if (sampled[sampled.length - 1] !== raw[raw.length - 1]) {
            sampled.push(raw[raw.length - 1]);
          }
          return sampled;
        }
        return raw || [];
      };

      const r01Waypoints = extractWaypoints('R-01', 250);
      const rKamrupWaypoints = extractWaypoints('R-KAMRUP-CACHAR', 300);
      const r02Waypoints = extractWaypoints('R-02', 250);
      const r03Waypoints = extractWaypoints('R-03', 280);
      const r05Waypoints = extractWaypoints('R-05', 260);

      // Stationary vehicle 6 sits at the real Banderdewa checkpost along the NH-415 highway
      const checkpostPoint = r05Waypoints.length > 170 ? r05Waypoints[170] : (r05Waypoints[Math.floor(r05Waypoints.length * 0.7)] || [27.0844, 93.6053]);

      // 2. Setup 6 distinct vehicles using 100% real road network geometries
      this.vehiclesSim = [
        // Vehicle 1: Normal Live GPS Tracking along NH-27/37
        {
          vehicleId: 'AURA',
          driverId: 'DRV-01',
          driverName: 'Rakesh Das',
          routeId: 'R-01',
          routeName: 'Guwahati → Tezpur (NH-27/37)',
          origin: 'Guwahati',
          destination: 'Tezpur',
          destLat: 26.6528,
          destLng: 92.7926,
          model: 'TATA 407 Heavy',
          capacityKg: 5000,
          status: 'moving',
          speed: 54,
          heading: 68,
          fuel: 82,
          waypoints: r01Waypoints,
          currentIndex: Math.min(45, r01Waypoints.length - 1),
          direction: 1,
        },
        // Vehicle 2: High Risk Corridor & Landslide Alert along NH-6
        {
          vehicleId: 'AS-01-TX-6014',
          driverId: 'DRV-02',
          driverName: 'Manoj Kalita',
          routeId: 'R-KAMRUP-CACHAR',
          routeName: 'Guwahati → Silchar',
          origin: 'Guwahati',
          destination: 'Silchar',
          destLat: 24.8170,
          destLng: 92.7985,
          model: 'Tata LPT 1613',
          capacityKg: 9000,
          status: 'moving',
          speed: 42,
          heading: 142,
          fuel: 68,
          waypoints: rKamrupWaypoints,
          currentIndex: Math.min(65, rKamrupWaypoints.length - 1),
          direction: 1,
          alertConfig: {
            id: 'alt-sim-landslide-01',
            title: 'High Landslide Risk Warning',
            type: 'landslide',
            severity: 'High',
            location: 'NH-6 / Dima Hasao Sector (Km 114)',
            message: 'Heavy hill soil saturation detected. Speed limit reduced to 35 km/h. Caution advised.',
          },
        },
        // Vehicle 3: Active Dynamic Detour / Safe Reroute along Zubza Bypass Road
        {
          vehicleId: 'AS-01-TX-8916',
          driverId: 'DRV-03',
          driverName: 'Dipankar Bora',
          routeId: 'R-04',
          routeName: 'Dimapur → Kohima → Imphal (NH-2)',
          origin: 'Dimapur',
          destination: 'Imphal',
          destLat: 24.8170,
          destLng: 93.9368,
          model: 'Tata LPT 1613',
          capacityKg: 9000,
          status: 'moving',
          speed: 38,
          heading: 165,
          fuel: 74,
          isRerouted: true,
          rerouteReason: 'NH-2 Km 42 Mudslide — Dynamically rerouted via Zubza Valley Bypass',
          rerouteGeometry: R04_REAL_OSRM_DETOUR,
          waypoints: R04_REAL_OSRM_DETOUR,
          currentIndex: Math.min(60, R04_REAL_OSRM_DETOUR.length - 1),
          direction: 1,
          alertConfig: {
            id: 'alt-sim-reroute-01',
            title: 'Mudslide Road Block — Dynamic Detour Active',
            type: 'blocked_road',
            severity: 'Critical',
            location: 'NH-2 Kohima Mountain Pass',
            message: 'Debris blockage on primary highway. Vehicle rerouted to Zubza Valley safe bypass.',
          },
        },
        // Vehicle 4: Tanker with Dense Fog / Weather Advisory along NH-6 Mountain Ghats
        {
          vehicleId: 'AS-01-QUANT-5406',
          driverId: 'DRV-04',
          driverName: 'Hemanta Deka',
          routeId: 'R-02',
          routeName: 'Guwahati → Shillong (NH-6)',
          origin: 'Guwahati',
          destination: 'Shillong',
          destLat: 25.5788,
          destLng: 91.8933,
          model: 'Ashok Leyland 1618 (Heavy Tanker)',
          capacityKg: 12000,
          status: 'moving',
          speed: 46,
          heading: 172,
          fuel: 86,
          waypoints: r02Waypoints,
          currentIndex: Math.min(50, r02Waypoints.length - 1),
          direction: 1,
          alertConfig: {
            id: 'alt-sim-weather-01',
            title: 'Dense Fog & Low Visibility Advisory',
            type: 'weather',
            severity: 'Medium',
            location: 'NH-6 Nongpoh-Umiam Ghats',
            message: 'Visibility < 40m due to thick mountain fog. Maintain headlights and safe convoy distance.',
          },
        },
        // Vehicle 5: River Valley Corridor & Flash Flood Alert along NH-306
        {
          vehicleId: 'SANJU BAHERIA',
          driverId: 'DRV-804699-81',
          driverName: 'Ajay',
          routeId: 'R-03',
          routeName: 'Silchar → Aizawl (NH-306)',
          origin: 'Silchar',
          destination: 'Aizawl',
          destLat: 23.7271,
          destLng: 92.7176,
          model: 'TATA 407 Heavy',
          capacityKg: 5000,
          status: 'moving',
          speed: 36,
          heading: 195,
          fuel: 62,
          waypoints: r03Waypoints,
          currentIndex: Math.min(40, r03Waypoints.length - 1),
          direction: 1,
          alertConfig: {
            id: 'alt-sim-flood-01',
            title: 'Barak River Flash Flood Advisory',
            type: 'flood',
            severity: 'High',
            location: 'NH-306 Kolasib River Crossing',
            message: 'River discharge elevated. Approach low-lying culverts with extreme caution.',
          },
        },
        // Vehicle 6: Prolonged Stop / Checkpost Delay at Banderdewa Checkpost on NH-415
        {
          vehicleId: 'SWAYAM GAJODHAR',
          driverId: 'DRV-124933-34',
          driverName: 'Sanju Das',
          routeId: 'R-05',
          routeName: 'Guwahati → Itanagar (NH-415)',
          origin: 'Guwahati',
          destination: 'Itanagar',
          destLat: 27.0844,
          destLng: 93.6053,
          model: 'TATA 407 Heavy',
          capacityKg: 5000,
          status: 'stopped',
          speed: 0,
          heading: 45,
          fuel: 55,
          waypoints: [checkpostPoint, checkpostPoint], // Positioned on real NH-415 road
          currentIndex: 0,
          direction: 1,
          alertConfig: {
            id: 'alt-sim-stop-01',
            title: 'Prolonged Stop Alert (>45 min)',
            type: 'prolonged_stop',
            severity: 'Medium',
            location: 'Banderdewa Interstate Checkpost (NH-415)',
            message: 'Vehicle stationary for 48 minutes at cargo inspection gate. Status updated to Delayed.',
          },
        },
      ];

      // 3. Ensure trips, vehicles, and alerts in DB
      for (const sim of this.vehiclesSim) {
        const startPoint = sim.waypoints[sim.currentIndex] || sim.waypoints[0];

        // Ensure Trip is in_transit
        const tripId = `TRIP-SIM-${sim.vehicleId.replace(/[^a-zA-Z0-9]/g, '')}`;
        await Trip.upsert({
          id: tripId,
          vehicle_id: sim.vehicleId,
          driver_id: sim.driverId,
          route_id: sim.routeId,
          transporter_id: 'transporter_01',
          origin: sim.origin,
          destination: sim.destination,
          status: sim.status === 'stopped' ? 'delayed' : 'in_transit',
          progress_percent: 45,
          started_at: new Date(Date.now() - 3600 * 2000),
          eta: new Date(Date.now() + 3600 * 4000),
        });

        // Ensure Driver is assigned
        await Driver.update(
          { vehicle_id: sim.vehicleId, status: 'active' },
          { where: { id: sim.driverId } }
        ).catch(() => {});

        // Ensure Vehicle record is updated
        await Vehicle.update(
          {
            current_lat: startPoint[0],
            current_lng: startPoint[1],
            speed: sim.speed,
            current_heading: sim.heading,
            fuel_percent: sim.fuel,
            current_route: sim.routeName,
            assigned_driver_id: sim.driverId,
            current_trip_id: tripId,
            status: sim.status === 'stopped' ? 'stopped' : 'moving',
            live_status: 'LIVE',
            tracking_active: true,
            last_ping_at: new Date(),
            last_gps_at: new Date(),
            gps_source: 'SIMULATOR_GPS',
          },
          { where: { id: sim.vehicleId } }
        );

        // Seed Alert in MongoDB if configured
        if (sim.alertConfig) {
          await Alert.findOneAndUpdate(
            { id: sim.alertConfig.id },
            {
              id: sim.alertConfig.id,
              title: sim.alertConfig.title,
              type: sim.alertConfig.type,
              severity: sim.alertConfig.severity,
              severityClass: sim.alertConfig.severity.toLowerCase(),
              location: sim.alertConfig.location,
              routeId: sim.routeId,
              time: 'Just now',
              message: sim.alertConfig.message,
              status: 'active',
            },
            { upsert: true, new: true }
          ).catch((e) => logger.warn(`Alert upsert error for ${sim.alertConfig?.id}: ${e}`));
        }

        // Dynamic detour caching in Redis
        if (sim.isRerouted && sim.rerouteGeometry) {
          const detourPayload = {
            vehicleId: sim.vehicleId,
            tripId,
            driverId: sim.driverId,
            transporterId: 'transporter_01',
            hasRoute: true,
            rerouted: true,
            rerouteReason: sim.rerouteReason,
            geometry: sim.rerouteGeometry,
            totalDistanceKm: 231.4,
            riskScore: 28,
            riskLevel: 'low',
            etaMinutes: 255,
            etaLabel: '~4 hrs 15 mins',
            trafficDelayMinutes: 14,
            origin: { name: sim.origin },
            destination: { name: sim.destination, lat: sim.destLat, lng: sim.destLng },
            updatedAt: new Date().toISOString(),
          };
          await redisClient.set(`vehicle:reroute:${sim.vehicleId}`, JSON.stringify(detourPayload), { ex: 7200 }).catch(() => {});
        }
      }

      logger.info('FleetSimulationService: 6 vehicles successfully configured with active corridors.');
    } catch (err: any) {
      logger.error(`FleetSimulationService.initialize error: ${err?.message || err}`);
    }
  }

  /**
   * Performs one tick of simulation: updates coordinates, writes to Redis and DB, emits WebSocket
   */
  public static async tick(): Promise<void> {
    const io = getSocketServer();
    const now = new Date();

    for (const sim of this.vehiclesSim) {
      // Step position along waypoints
      if (sim.status === 'moving' && sim.waypoints.length > 1) {
        sim.currentIndex += sim.direction;
        if (sim.currentIndex >= sim.waypoints.length - 1) {
          sim.currentIndex = sim.waypoints.length - 1;
          sim.direction = -1;
        } else if (sim.currentIndex <= 0) {
          sim.currentIndex = 0;
          sim.direction = 1;
        }
      }

      const [lat, lng] = sim.waypoints[sim.currentIndex] || sim.waypoints[0];
      const speed = sim.status === 'stopped' ? 0 : Math.round(sim.speed + (Math.random() * 4 - 2));

      // Calculate approximate bearing
      let heading = sim.heading;
      if (sim.waypoints.length > 1) {
        const nextIdx = Math.min(sim.waypoints.length - 1, Math.max(0, sim.currentIndex + sim.direction));
        const [nextLat, nextLng] = sim.waypoints[nextIdx];
        const dLat = nextLat - lat;
        const dLng = nextLng - lng;
        if (Math.abs(dLat) > 0.0001 || Math.abs(dLng) > 0.0001) {
          heading = Math.round((Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360);
        }
      }

      const livePayload: any = {
        id: sim.vehicleId,
        vehicleId: sim.vehicleId,
        model: sim.model,
        transporter_id: 'transporter_01',
        lat,
        lng,
        speed,
        fuel: sim.fuel,
        heading,
        accuracy: 4.2,
        accuracyRating: 'high',
        altitude: 120,
        source: 'SIMULATOR_GPS',
        driver: sim.driverName,
        driverId: sim.driverId,
        tripId: `TRIP-SIM-${sim.vehicleId.replace(/[^a-zA-Z0-9]/g, '')}`,
        gpsTimestamp: now.toISOString(),
        timestamp: now.toISOString(),
        receivedAt: now.toISOString(),
        inDeadZone: false,
        fatigueWarning: false,
        continuousDrivingMins: 45,
        status: sim.status === 'stopped' ? 'stopped' : 'moving',
        liveStatus: 'LIVE',
        route: sim.routeName,
        isRerouted: !!sim.isRerouted,
        rerouteReason: sim.rerouteReason || null,
      };

      // 1. Update Redis live key and history trail
      try {
        await redisClient.set(`vehicle:live:${sim.vehicleId}`, JSON.stringify(livePayload), { ex: 300 });
        const historyKey = `vehicle:history:${sim.vehicleId}`;
        const rawHistory = await redisClient.get(historyKey);
        const history: any[] = rawHistory ? (typeof rawHistory === 'string' ? JSON.parse(rawHistory) : rawHistory) : [];
        history.push({ lat, lng, speed, heading, timestamp: now.toISOString() });
        await redisClient.set(historyKey, JSON.stringify(history.slice(-150)), { ex: 7200 });
      } catch {}

      // 2. Update PostgreSQL vehicle state (so table and DB queries reflect fresh GPS)
      await Vehicle.update(
        {
          current_lat: lat,
          current_lng: lng,
          speed,
          current_heading: heading,
          last_ping_at: now,
          last_gps_at: now,
          live_status: 'LIVE',
          tracking_active: true,
          status: sim.status === 'stopped' ? 'stopped' : 'moving',
        },
        { where: { id: sim.vehicleId } }
      ).catch(() => {});

      // 3. Emit real-time Socket.IO events to all rooms
      if (io) {
        const broadcast = {
          ...livePayload,
          ageSeconds: 0,
        };
        io.to('admin:all').emit('vehicle:position', broadcast);
        io.to('admin:all').emit('vehicle.location.updated', broadcast);
        io.to('transporter:transporter_01').emit('vehicle:position', broadcast);
        io.to('transporter:transporter_01').emit('vehicle.location.updated', broadcast);
        io.emit('vehicle:position', broadcast);
        io.emit('vehicle.location.updated', broadcast);
      }
    }
  }

  /**
   * Starts the recurring background simulation loop
   */
  public static async start(intervalMs: number = 3500): Promise<void> {
    if (this.isRunning) return;
    await this.initialize();
    this.isRunning = true;
    logger.info(`FleetSimulationService: Started telemetry loop (every ${intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.tick().catch((e: any) => logger.warn(`Simulation tick error: ${e?.message || e}`));
    }, intervalMs);
  }

  /**
   * Stops the recurring background simulation loop
   */
  public static stop(): void {
    if (!this.isRunning) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('FleetSimulationService: Stopped telemetry loop');
  }

  /**
   * Returns current simulation status
   */
  public static getStatus(): { running: boolean; vehicleCount: number; vehicles: any[] } {
    return {
      running: this.isRunning,
      vehicleCount: this.vehiclesSim.length,
      vehicles: this.vehiclesSim.map((v) => ({
        vehicleId: v.vehicleId,
        route: v.routeName,
        status: v.status,
        speed: v.speed,
        isRerouted: !!v.isRerouted,
        alert: v.alertConfig?.title || null,
      })),
    };
  }
}
