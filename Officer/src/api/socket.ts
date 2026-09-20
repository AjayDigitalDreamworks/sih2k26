import { io, Socket } from 'socket.io-client';
import { BACKEND_URL, storage } from './client';

let socket: Socket | null = null;
const connectionListeners: Set<(connected: boolean) => void> = new Set();

export const initSocket = async (): Promise<Socket> => {
  if (socket && socket.connected) return socket;
  const token = await storage.getItem('ner_access_token') || await storage.getItem('accessToken');
  if (socket) socket.disconnect();
  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: token || undefined },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 2000,
    timeout: 10000,
  });
  socket.on('connect', () => {
    socket?.emit('join', 'field_officers');
    socket?.emit('join', 'alerts');
    socket?.emit('join', 'reports');
    socket?.emit('join', 'admin');
    connectionListeners.forEach((fn) => fn(true));
  });
  socket.on('disconnect', () => connectionListeners.forEach((fn) => fn(false)));
  socket.on('connect_error', () => connectionListeners.forEach((fn) => fn(false)));
  return socket;
};

export const getSocket = (): Socket | null => socket;
export const isSocketConnected = (): boolean => !!socket && socket.connected;

export const onSocketConnectionChange = (callback: (connected: boolean) => void): (() => void) => {
  connectionListeners.add(callback);
  callback(isSocketConnected());
  return () => { connectionListeners.delete(callback); };
};

export const subscribeToFieldTasks = (callback: (task: any) => void): (() => void) => {
  if (!socket) return () => {};
  const handler = (data: any) => callback(data);
  socket.on('task:assigned', handler);
  socket.on('task:updated', handler);
  socket.on('field_task:updated', handler);
  socket.on('field-task:created', handler);
  socket.on('field_task:created', handler);
  socket.on('field_task:verified', handler);
  socket.on('task:verified', handler);
  return () => {
    socket?.off('task:assigned', handler);
    socket?.off('task:updated', handler);
    socket?.off('field_task:updated', handler);
    socket?.off('field-task:created', handler);
    socket?.off('field_task:created', handler);
    socket?.off('field_task:verified', handler);
    socket?.off('task:verified', handler);
  };
};

export const subscribeToAlerts = (callback: (alert: any) => void): (() => void) => {
  if (!socket) return () => {};
  const handler = (data: any) => callback(data);
  socket.on('alert.created', handler);
  socket.on('alert:created', handler);
  socket.on('alert:broadcast', handler);
  socket.on('alert:urgent', handler);
  return () => {
    socket?.off('alert.created', handler);
    socket?.off('alert:created', handler);
    socket?.off('alert:broadcast', handler);
    socket?.off('alert:urgent', handler);
  };
};

export const subscribeToHazards = (callback: (report: any) => void): (() => void) => {
  if (!socket) return () => {};
  const handler = (data: any) => callback(data);
  socket.on('field-report:created', handler);
  socket.on('incident:created', handler);
  socket.on('hazard:alert', handler);
  return () => {
    socket?.off('field-report:created', handler);
    socket?.off('incident:created', handler);
    socket?.off('hazard:alert', handler);
  };
};

export const subscribeToEmergency = (callback: (sos: any) => void): (() => void) => {
  if (!socket) return () => {};
  socket.on('emergency.sos', callback);
  return () => { socket?.off('emergency.sos', callback); };
};

export const disconnectSocket = (): void => {
  if (socket) { socket.disconnect(); socket = null; }
};
