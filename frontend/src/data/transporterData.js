// Navigation configuration for the Transporter dashboard.
// No business records live here — all data comes from the live APIs.

export const sidebarNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'vehicles', label: 'Fleet & Drivers', icon: 'truck' },
  { id: 'consignments', label: 'Consignments & Trips', icon: 'package' },
  { id: 'routes', label: 'Route Planning', icon: 'route' },
  { id: 'tracking', label: 'Live Tracking & GPS', icon: 'map-pin' },
  { id: 'fleet-tracking', label: 'Vehicle Tracking', icon: 'tracker' },
  { id: 'route-optimization', label: 'Risk & Weather Intel', icon: 'route-opt' },
  { id: 'alerts', label: 'Alerts', icon: 'bell' },
  { id: 'history', label: 'Delivery History', icon: 'history' },
  { id: 'reports', label: 'Reports', icon: 'bar-chart' },
];

export const sidebarSecondaryItems = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'help', label: 'Help & Support', icon: 'headset' },
];
