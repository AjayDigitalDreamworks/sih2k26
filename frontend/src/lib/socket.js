import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let lastToken = null;

export const getSocket = () => {
  const currentToken = localStorage.getItem('ner_access_token') || sessionStorage.getItem('ner_access_token');

  if (socket && currentToken !== lastToken) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: currentToken },
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    lastToken = currentToken;

    socket.on('connect', () => {
      console.log('[RAAHI] Connected to Real-Time Socket Gateway:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[RAAHI] Disconnected from Socket Gateway:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[RAAHI] Socket connection error:', err.message);
    });

    socket.on('reconnect', (attempt) => {
      console.log('[RAAHI] Reconnected after', attempt, 'attempts');
    });
  }

  return socket;
};

export const subscribeToVehiclePositions = (callback) => {
  const s = getSocket();
  s.on('vehicle:position', callback);
  s.on('vehicle.location.updated', callback);
  return () => {
    s.off('vehicle:position', callback);
    s.off('vehicle.location.updated', callback);
  };
};

export const subscribeToAlerts = (callback) => {
  const s = getSocket();
  s.on('alert:broadcast', callback);
  return () => {
    s.off('alert:broadcast', callback);
  };
};

export const subscribeToEmergency = (callback) => {
  const s = getSocket();
  s.on('emergency.sos', callback);
  return () => {
    s.off('emergency.sos', callback);
  };
};

export const subscribeToEmergencyCancelled = (callback) => {
  const s = getSocket();
  s.on('emergency.sos.cancelled', callback);
  return () => {
    s.off('emergency.sos.cancelled', callback);
  };
};

export const subscribeToDynamicReroute = (callback) => {
  const s = getSocket();
  s.on('vehicle:rerouted', callback);
  s.on('route:rerouted', callback);
  return () => {
    s.off('vehicle:rerouted', callback);
    s.off('route:rerouted', callback);
  };
};

export const subscribeToTripUpdates = (callback) => {
  const s = getSocket();
  s.on('trip.status.updated', callback);
  s.on('vehicle.status.updated', callback);
  return () => {
    s.off('trip.status.updated', callback);
    s.off('vehicle.status.updated', callback);
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    lastToken = null;
  }
};
