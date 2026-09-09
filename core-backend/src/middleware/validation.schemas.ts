import { z } from 'zod';

// === Auth Schemas ===

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['admin', 'district_officer', 'field_officer', 'field_officier', 'field_agent', 'transporter', 'driver', 'viewer', 'user']).optional(),
    district_id: z.string().max(50).optional(),
    transporter_id: z.string().max(50).optional(),
    agency: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// === Tracking Schemas ===

export const gpsPingSchema = z.object({
  body: z.object({
    vehicleId: z.string().min(1, 'Vehicle ID is required'),
    lat: z.number().min(-90).max(90, 'Invalid latitude'),
    lng: z.number().min(-180).max(180, 'Invalid longitude'),
    speed: z.number().min(0).max(300, 'Invalid speed'),
    heading: z.number().min(0).max(360, 'Invalid heading'),
    accuracy: z.number().min(0, 'Invalid accuracy'),
    timestamp: z.string().datetime('Invalid timestamp format'),
    batteryLevel: z.number().min(0).max(100).optional(),
  }),
});

// Real-GPS tracking contract — shared by the web/PWA driver app (WEB_GPS)
// and the future native Android driver app (ANDROID_GPS). vehicle/trip ids are
// optional at the schema level: for role=driver the server derives the vehicle
// and trip from the authenticated session and the assignment tables.
export const trackingLocationSchema = z.object({
  body: z.object({
    vehicle_id: z.string().min(1).nullable().optional(),
    trip_id: z.string().min(1).nullable().optional(),
    latitude: z.number().min(-90).max(90, 'Invalid latitude'),
    longitude: z.number().min(-180).max(180, 'Invalid longitude'),
    accuracy: z.number().min(0, 'Invalid accuracy'),
    // Optional telemetry may legitimately arrive as null when the device has
    // no reading (e.g. browser GPS without speed/heading) — treat null as absent.
    speed: z.number().min(0).max(300).nullable().optional(),
    heading: z.number().min(0).max(360).nullable().optional(),
    altitude: z.number().nullable().optional(),
    gps_timestamp: z.string().min(1, 'gps_timestamp required'),
    source: z.enum(['WEB_GPS', 'ANDROID_GPS', 'FLEET_API', 'SYNC']).nullable().optional(),
  }),
});

// === Admin Schemas ===

export const createAlertSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Alert title is required').max(500),
    type: z.string().max(50).optional(),
    severity: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
    districtId: z.string().max(50).optional(),
    routeId: z.string().max(50).optional(),
    location: z.string().max(200).optional(),
    message: z.string().max(2000).optional(),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['admin', 'district_officer', 'field_officer', 'field_officier', 'field_agent', 'transporter', 'driver', 'viewer', 'user']).optional(),
    district_id: z.string().max(50).optional(),
    transporter_id: z.string().max(50).optional(),
    agency: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

// === Field Report Schemas ===

export const reportIncidentSchema = z.object({
  body: z.object({
    type: z.string().min(1, 'Report type is required').max(50),
    location: z.string().min(1, 'Location is required').max(200),
    districtId: z.string().max(50).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }).optional(),
  }),
});

// === Route Planning Schemas ===

export const routePlanSchema = z.object({
  body: z.object({
    originDistrictId: z.string().min(1, 'Origin district is required'),
    destDistrictId: z.string().min(1, 'Destination district is required'),
    vehicleId: z.string().optional(),
    commodityType: z.enum(['medicine', 'food', 'fuel', 'agri', 'construction', 'general']).optional(),
    priority: z.number().min(1).max(5).optional(),
  }),
});
