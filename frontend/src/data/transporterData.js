// Navigation configuration for the Transporter dashboard.
// Streamlined into 5 core workspaces for zero-confusion dispatching.

export const sidebarNavItems = [
  { id: 'dashboard', label: 'Fleet & Map', icon: 'map-pin', path: '/transporter/dashboard' },
  { id: 'routes', label: 'New Trip / Dispatch', icon: 'route', path: '/transporter/route-planning' },
  { id: 'consignments', label: 'Consignments & Orders', icon: 'package', path: '/transporter/consignments' },
  { id: 'vehicles', label: 'Vehicles & Drivers', icon: 'truck', path: '/transporter/vehicles' },
  { id: 'reports', label: 'Analytics & Reports', icon: 'bar-chart', path: '/transporter/reports' },
];

export const sidebarSecondaryItems = [
  { id: 'alerts', label: 'Corridor Alerts', icon: 'bell', path: '/transporter/alerts' },
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/transporter/settings' },
  { id: 'help', label: 'Help & Support', icon: 'headset', path: '/transporter/help' },
];
