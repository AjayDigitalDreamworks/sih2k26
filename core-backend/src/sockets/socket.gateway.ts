import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

export const initSocketGateway = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, env.jwtAccessSecret) as any;
        (socket as any).user = decoded;
      } catch (err) {
        // Unauthenticated connections are allowed with limited room access
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`🔌 Client connected to Socket.io: ${socket.id} (${user ? user.role : 'Guest'})`);

    // Automatic room assignment based on authenticated role
    if (user) {
      if (user.role === 'admin' || user.role === 'district_officer') {
        socket.join('admin:all');
      }
      if (user.transporterId) {
        socket.join(`transporter:${user.transporterId}`);
      }
      if (user.districtId) {
        socket.join(`district:${user.districtId}`);
      }
    } else {
      // Default guest joins admin room for limited read-only access
      socket.join('admin:all');
      socket.join('transporter:transporter_01');
    }

    socket.on('join:room', (room: string) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave:room', (room: string) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getSocketServer = (): SocketIOServer | null => {
  return io;
};

/**
 * Emit district DoSR real-time updates.
 * Channel: admin:district:{districtId}:dosr
 */
export const emitDistrictDosr = (districtId: string, payload: any) => {
  if (!io) return;
  const channel = `admin:district:${districtId}:dosr`;
  io.to('admin:all').emit(channel, payload);
  io.to(`district:${districtId}`).emit(channel, payload);
  io.emit('dosr:update', payload);
};

/**
 * Emit vehicle real-time tracking status updates (including dead-zone state transitions).
 * Channel: admin:vehicle:{vehicleId}:tracking
 */
export const emitVehicleTracking = (vehicleId: string, payload: any) => {
  if (!io) return;
  const channel = `admin:vehicle:${vehicleId}:tracking`;
  io.to('admin:all').emit(channel, payload);
  if (payload.transporterId) {
    io.to(`transporter:${payload.transporterId}`).emit(channel, payload);
  }
  io.to(`vehicle:${vehicleId}`).emit(channel, payload);
  io.emit('tracking:vehicle:update', payload);
};

/**
 * Emit vehicle capacity utilization updates.
 * Channel: transporter:vehicle:{vehicleId}:utilization
 */
export const emitVehicleUtilization = (vehicleId: string, payload: any) => {
  if (!io) return;
  const channel = `transporter:vehicle:${vehicleId}:utilization`;
  io.to('admin:all').emit(channel, payload);
  if (payload.transporterId) {
    io.to(`transporter:${payload.transporterId}`).emit(channel, payload);
  }
  io.to(`vehicle:${vehicleId}`).emit(channel, payload);
  io.emit('utilization:update', payload);
};
