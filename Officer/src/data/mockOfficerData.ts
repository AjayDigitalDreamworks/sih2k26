export interface TaskItem {
  id: string;
  category: 'CRITICAL' | 'HIGH RISK' | 'MODERATE' | 'ROUTINE';
  distance: string;
  title: string;
  subtitle: string;
  highlightText?: string;
  reportedTime?: string;
  coordinates?: string;
  actionType: 'verify' | 'inspect' | 'audit';
  actionLabel: string;
  secondaryLabel?: string;
}

export interface MetricSummary {
  assignedTasks: number;
  urgentTasks: number;
  verifiedToday: number;
  verifiedDiff: string;
  fieldReports: number;
  districtAlerts: number;
  liveSensors: number;
}

export interface GisIncident {
  id: string;
  incidentCode: string;
  status: 'URGENT GROUND TRUTH' | 'MONITORING' | 'RESOLVED';
  eta: string;
  distance: string;
  title: string;
  locationDetails: string;
  debrisEst: string;
  passability: string;
  passabilityPercent: number;
  sarSensorStatus: string;
  coordinates: {
    lat: number;
    lng: number;
    dms: string;
  };
}

export interface AlertItem {
  id: string;
  title: string;
  category: 'Critical' | 'Critical Surge' | 'Advisory' | 'Resolved';
  subCategory?: string;
  location: string;
  sensorNode?: string;
  timeAgo: string;
  aiConfidence?: string;
  waveformType?: 'seismic' | 'hydro' | 'radar';
  coordinates?: string;
  delta?: string;
  baseline?: string;
  activeLevel?: string;
  dangerMark?: string;
  sdrfStatus?: string;
  precipitationRate?: string;
  forecastMinutes?: number;
  resolvedBy?: string;
}

export const OFFICER_PROFILE = {
  name: 'Agent BB (Brijesh Bhatt)',
  role: 'Senior GIS Field Operative',
  organization: 'State Disaster Response Force (SDRF)',
  id: 'SDRF-GIS-8841',
  tier: 'Tier 1 Rapid Response',
  station: 'Sector 4 HQ Patrol',
  status: 'ON DUTY',
  stats: {
    groundVerificationsMonth: 48,
    telemetryPrecision: '99.2%',
    telemetryStatus: 'RTK Locked',
    avgIncidentResponseMinutes: 14,
    responseDelta: '-3m vs target',
  },
  kits: [
    {
      id: 'kit-1',
      name: 'Trimble RTK GNSS Receiver',
      model: '#TR-401 • Dual Frequency',
      battery: '100%',
      icon: 'satellite',
    },
    {
      id: 'kit-2',
      name: 'Mesh Radio Gateway Unit',
      model: '#NRG-08 • 868MHz LoRa',
      status: 'Linked',
      icon: 'radio',
    },
    {
      id: 'kit-3',
      name: 'Ruggedized Thermal Imager',
      model: 'FLIR E8-XT Calibrated',
      status: 'Calibrated',
      icon: 'camera',
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      title: 'Disaster Ground-Truth Specialist',
      level: 'Level III Advanced Evaluator',
      validity: 'Valid 2026',
      icon: 'shield',
    },
    {
      id: 'cert-2',
      title: 'High Altitude Mountain Rescue',
      level: 'Trauma First Aid & Evacuation',
      validity: 'Certified',
      icon: 'cross',
    },
    {
      id: 'cert-3',
      title: 'SDRF Geospatial Node Deployer',
      level: 'Tactical GIS Edge Operator',
      validity: 'Verified',
      icon: 'radar',
    },
  ],
  diagnostics: {
    cacheUsedGb: 1.4,
    cacheTotalGb: 2.0,
    division: 'Uttarakhand Division (Sector 1-4)',
    satelliteUplink: 'IRNSS / NavIC Dual-Band Enabled',
    language: 'EN',
  },
};

export const TASKS_DATA: TaskItem[] = [
  {
    id: 't-1',
    category: 'CRITICAL',
    distance: '1.4 km away',
    title: 'Landslide Debris at NH-58 Km 42',
    subtitle: 'Sensor: Geophone GP-09 triggered',
    coordinates: '30.142°N, 79.299°E',
    actionType: 'verify',
    actionLabel: 'Verify Ground Truth',
    secondaryLabel: 'View GIS (30.142°N, 79.299°E)',
  },
  {
    id: 't-2',
    category: 'HIGH RISK',
    distance: '3.2 km away',
    title: 'Waterlogging near Alaknanda Causeway',
    subtitle: '',
    highlightText: 'Surge: +1.8m stream gauge • Runoff high',
    reportedTime: 'Reported 24m ago by CWC Telemetry',
    actionType: 'inspect',
    actionLabel: 'Inspect Culvert',
  },
  {
    id: 't-3',
    category: 'MODERATE',
    distance: '',
    title: 'Rockfall Barrier Inspection - Bypass Km 12',
    subtitle: 'Check net tensile integrity after heavy rainfall event.',
    reportedTime: 'Due in 2h • Assigned to Team Alpha',
    actionType: 'audit',
    actionLabel: 'Start Audit',
    secondaryLabel: 'Routine Patrol Audit',
  },
];

export const GIS_ACTIVE_INCIDENT: GisIncident = {
  id: 'inc-01',
  incidentCode: 'INC-7704',
  status: 'URGENT GROUND TRUTH',
  eta: '6 mins',
  distance: '1.4 km away',
  title: 'Landslide Corridor Alpha',
  locationDetails: 'National Highway 58 Km 42 • Active Debris Movement Detected',
  debrisEst: '~420 m³',
  passability: '0% (Blocked)',
  passabilityPercent: 0,
  sarSensorStatus: 'Radar High',
  coordinates: {
    lat: 30.3544,
    lng: 78.4367,
    dms: "30°21'44\"N • 78°26'12\"E",
  },
};

export const ALERTS_DATA: AlertItem[] = [
  {
    id: 'alt-1',
    title: 'Seismic Triggered Landslide Advisory',
    category: 'Critical',
    subCategory: 'Pending Verification',
    location: 'Sector 4 – Pine Curve Pass (Km 38.2)',
    sensorNode: 'Ground Geophone Node #GP-09',
    timeAgo: '14 mins ago',
    aiConfidence: 'AI Confidence 94% • Immediate Ground Verification Dispatched',
    waveformType: 'seismic',
    coordinates: '30.3752° N, 79.3319° E',
  },
  {
    id: 'alt-2',
    title: 'Flash Flood Sensor Threshold Exceeded',
    category: 'Critical Surge',
    subCategory: 'Team En Route',
    location: 'Alaknanda Tributary Basin • Sensor #WL-14',
    timeAgo: '32 mins ago',
    delta: '+2.4m Surge',
    baseline: '4.8m',
    activeLevel: '7.2m',
    dangerMark: '6.5m',
    sdrfStatus: 'SDRF Quick Response #04 Deployed',
    waveformType: 'hydro',
  },
  {
    id: 'alt-3',
    title: 'Heavy Precipitation & Mud Flow Risk',
    category: 'Advisory',
    subCategory: 'Monitored',
    location: 'North Valley Ridge • Corridor B',
    precipitationRate: '12 mm/hr',
    forecastMinutes: 18,
    timeAgo: 'Just now',
    waveformType: 'radar',
  },
  {
    id: 'alt-4',
    title: 'Rockfall Corridor Cleared',
    category: 'Resolved',
    subCategory: '08:45 AM Today',
    location: 'Bypass Km 12 • Cleared for transit',
    resolvedBy: 'Agent BB',
    timeAgo: 'Today',
  },
];
