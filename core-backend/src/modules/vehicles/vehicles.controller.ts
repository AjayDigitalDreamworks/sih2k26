import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Vehicle } from '../../models/postgres/Vehicle';
import { Driver } from '../../models/postgres/Driver';
import { redisClient } from '../../config/redis';
import { sendSuccess, sendError } from '../../utils/response';
import { getSocketServer } from '../../sockets/socket.gateway';

export class VehiclesController {
  // Authorized hardware / ops GPS ping. Identity comes from the JWT — a caller
  // can ONLY write coordinates for a vehicle they are authorized for (their own
  // assigned vehicle as a driver, their own fleet as a transporter, admin ops).
  // No unauthenticated GPS writes: they would allow live-position spoofing.
  static async pingPosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user: any = (req as any).user;
      const { lat, lng, speed, fuel_percent, status } = req.body;

      const vehicle = await Vehicle.findByPk(String(id));
      if (!vehicle) return sendError(res, 'Vehicle not found', 404);

      // --- Authorization (never trust the payload) ---
      const role = user?.role;
      let allowed = false;
      if (role === 'admin') allowed = true;
      else if (role === 'transporter') {
        allowed = !!vehicle.transporter_id && vehicle.transporter_id === user.transporterId;
      } else if (role === 'driver') {
        const driver = await Driver.findOne({ where: { user_id: user.id } });
        allowed = !!driver && driver.vehicle_id === vehicle.id;
      }
      if (!role || !allowed) {
        return sendError(res, 'You are not authorized to report GPS for this vehicle', role ? 403 : 401);
      }

      // --- Validation (never silently accept bad GPS) ---
      const isNum = (v: any) => typeof v === 'number' && Number.isFinite(v);
      if ((lat === undefined) !== (lng === undefined)) {
        return sendError(res, 'Both latitude and longitude are required together', 400);
      }
      if (lat !== undefined || lng !== undefined) {
        if (!isNum(lat) || !isNum(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return sendError(res, 'Invalid coordinates: lat must be within [-90,90], lng within [-180,180]', 400);
        }
      }
      if (speed !== undefined && (!isNum(speed) || speed < 0)) {
        return sendError(res, 'Invalid speed: must be a non-negative number', 400);
      }

      const updateData: any = {
        last_ping_at: new Date(),
      };
      if (lat !== undefined) updateData.current_lat = lat;
      if (lng !== undefined) updateData.current_lng = lng;
      if (speed !== undefined) updateData.speed = speed;
      if (fuel_percent !== undefined) updateData.fuel_percent = fuel_percent;
      if (status !== undefined) updateData.status = status;

      await vehicle.update(updateData);

      // Cache live position in Redis with 60s TTL
      const livePayload = {
        id: vehicle.id,
        model: vehicle.model,
        transporter_id: vehicle.transporter_id,
        lat: vehicle.current_lat,
        lng: vehicle.current_lng,
        speed: vehicle.speed,
        fuel: vehicle.fuel_percent,
        status: vehicle.status,
        timestamp: new Date().toISOString(),
      };
      await redisClient.set(`vehicle:live:${vehicle.id}`, livePayload, { ex: 60 });

      // Emit live position to Socket.io rooms
      const io = getSocketServer();
      if (io) {
        // Broadcast to Admin room
        io.to('admin:all').emit('vehicle:position', livePayload);
        // Broadcast to Transporter room
        io.to(`transporter:${vehicle.transporter_id}`).emit('vehicle:position', livePayload);
      }

      return sendSuccess(res, livePayload, 'GPS Telemetry ping processed');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // Get all active live positions from Redis or DB
  static async getLivePositions(req: Request, res: Response) {
    try {
      const vehicles = await Vehicle.findAll();
      return sendSuccess(res, vehicles, 'Live vehicle coordinates retrieved');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
}
