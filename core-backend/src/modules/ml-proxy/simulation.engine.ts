/**
 * Disaster Digital Twin Simulation Engine (In-Memory Fallback)
 *
 * Provides comprehensive in-memory "What-If" disaster scenario modeling:
 * - River gauge surge & bridge inundation modeling across Northeast India
 * - Landslide & slope instability modeling across vulnerable mountain passes
 * - Soil saturation & seismic shock (earthquake) triggers
 * - Multi-district supply chain isolation & stockout forecasting
 * - Active fleet stranding impact & emergency diversion planning
 * - Relief staging, Drone drop corridors & BRO (Border Roads Organisation) clearance ops
 * - Automated Situation Report (SITREP) synthesis
 */

export interface BridgeInfo {
  id: string;
  name: string;
  river: string;
  district: string;
  deck_clearance_m: number;
  criticality: 'low' | 'moderate' | 'high' | 'critical';
}

export interface MountainPassInfo {
  id: string;
  name: string;
  highway: string;
  state: string;
  district: string;
  corridorKey: string;
  elevationM: number;
  slopeAngleDeg: number;
  soilType: string;
  saturationTriggerPct: number;
  broTaskForce: string;
  baseDebrisM3: number;
  criticality: 'moderate' | 'high' | 'critical' | 'catastrophic';
  description: string;
}

export interface ReliefAirHub {
  id: string;
  name: string;
  type: string;
  district: string;
  capacity: string;
  readiness: 'standby' | 'ready' | 'active';
}

export interface ScenarioPreset {
  id: string;
  title: string;
  description: string;
  riverSurgeMeters: number;
  rainfallIntensityMm: number;
  soilSaturationPct: number;
  earthquakeMagnitude: number;
  dykeBreach: boolean;
  severedCorridors: string[];
  triggeredLandslidePasses: string[];
  severity: 'moderate' | 'high' | 'critical' | 'catastrophic';
}

export const NER_BRIDGES: BridgeInfo[] = [
  { id: 'BR-01', name: 'Saraighat Bridge (Guwahati)', river: 'Brahmaputra', district: 'kamrup', deck_clearance_m: 2.2, criticality: 'high' },
  { id: 'BR-02', name: 'Kalia Bhomora Bridge (Tezpur)', river: 'Brahmaputra', district: 'sonitpur', deck_clearance_m: 2.0, criticality: 'critical' },
  { id: 'BR-03', name: 'Naranarayan Setu (Jogighopa)', river: 'Brahmaputra', district: 'goalpara', deck_clearance_m: 2.5, criticality: 'high' },
  { id: 'BR-04', name: 'Dhola-Sadiya Bridge (Lohit)', river: 'Lohit', district: 'tinsukia', deck_clearance_m: 3.0, criticality: 'moderate' },
  { id: 'BR-05', name: 'Bogibeel Bridge (Dibrugarh)', river: 'Brahmaputra', district: 'dibrugarh', deck_clearance_m: 2.8, criticality: 'high' },
  { id: 'BR-06', name: 'Jatinga River Causeway', river: 'Jatinga', district: 'dima_hasao', deck_clearance_m: 1.2, criticality: 'critical' },
  { id: 'BR-07', name: 'Barak River Suspension Span', river: 'Barak', district: 'cachar', deck_clearance_m: 1.5, criticality: 'critical' },
  { id: 'BR-08', name: 'Umiam Spillway Bridge', river: 'Umiam', district: 'east_khasi', deck_clearance_m: 1.7, criticality: 'moderate' },
];

export const NER_MOUNTAIN_PASSES: MountainPassInfo[] = [
  {
    id: 'LP-01',
    name: 'NH-6 Sonapur Tunnel & Sinking Zone',
    highway: 'NH-6',
    state: 'Meghalaya / Assam border',
    district: 'east_jaintia_cachar',
    corridorKey: 'kamrup-dima_hasao',
    elevationM: 780,
    slopeAngleDeg: 48,
    soilType: 'Weathered Shale & Fractured Sandstone',
    saturationTriggerPct: 68,
    broTaskForce: 'Project Pushpak (765 BRTF)',
    baseDebrisM3: 8500,
    criticality: 'catastrophic',
    description: 'Primary lifeline connecting Guwahati to Barak Valley, Tripura & Mizoram. Chronic monsoon mudslides bury tunnel portal.',
  },
  {
    id: 'LP-02',
    name: 'NH-27 Jatinga / Haflong Hill Ghat',
    highway: 'NH-27',
    state: 'Assam (Barail Range)',
    district: 'dima_hasao',
    corridorKey: 'dima_hasao-cachar',
    elevationM: 920,
    slopeAngleDeg: 52,
    soilType: 'Unconsolidated Sedimentary Clay',
    saturationTriggerPct: 62,
    broTaskForce: 'Project Vartak (14 BRTF)',
    baseDebrisM3: 12000,
    criticality: 'critical',
    description: 'Crucial East-West corridor traverse through Barail mountains. Severe slope subsidence cuts Southern Assam.',
  },
  {
    id: 'LP-03',
    name: 'NH-2 Kohima - Maram Landslide Zone',
    highway: 'NH-2',
    state: 'Nagaland / Manipur',
    district: 'dimapur',
    corridorKey: 'dimapur-cachar',
    elevationM: 1440,
    slopeAngleDeg: 45,
    soilType: 'Flysch Mudstone & Soil Creep',
    saturationTriggerPct: 75,
    broTaskForce: 'Project Sewak (15 BRTF)',
    baseDebrisM3: 6500,
    criticality: 'high',
    description: 'Vital supply link for Imphal Valley. Sinking zone at KM-15 to KM-22 suffers recurring mass movements.',
  },
  {
    id: 'LP-04',
    name: 'NH-306 Silchar - Kolasib Ridge Incline',
    highway: 'NH-306',
    state: 'Assam / Mizoram border',
    district: 'cachar',
    corridorKey: 'cachar-aizawl',
    elevationM: 610,
    slopeAngleDeg: 40,
    soilType: 'Red Lateritic Soil & Bamboo Silt',
    saturationTriggerPct: 70,
    broTaskForce: 'Project Pushpak (23 BRTF)',
    baseDebrisM3: 5200,
    criticality: 'high',
    description: 'Solitary heavy highway connecting Mizoram to rest of India. Debris deposits obstruct truck convoys at Vairengte.',
  },
  {
    id: 'LP-05',
    name: 'Bhalukpong - Tawang Mountain Pass',
    highway: 'NH-13',
    state: 'Arunachal Pradesh',
    district: 'sonitpur',
    corridorKey: 'sonitpur-dima_hasao',
    elevationM: 2150,
    slopeAngleDeg: 60,
    soilType: 'Gneissic Scree & Boulder Talus',
    saturationTriggerPct: 80,
    broTaskForce: 'Project Vartak (42 BRTF)',
    baseDebrisM3: 9800,
    criticality: 'critical',
    description: 'Strategic Himalayan mountain ascent. Rockfall and mudslides frequently isolate border forward bases.',
  },
  {
    id: 'LP-06',
    name: 'Nongstoin - Rongjeng Escarpment',
    highway: 'NH-127B',
    state: 'Meghalaya (West Khasi)',
    district: 'east_khasi',
    corridorKey: 'kamrup-sonitpur',
    elevationM: 1100,
    slopeAngleDeg: 42,
    soilType: 'High Plasticity Kaolinitic Clay',
    saturationTriggerPct: 72,
    broTaskForce: 'Project Setu (Meghalaya PWD / BRO)',
    baseDebrisM3: 4400,
    criticality: 'moderate',
    description: 'Mountain bypass through central Meghalaya plateau. Mudflows impede heavy vehicle movement.',
  },
];

export const RELIEF_AIR_HUBS: ReliefAirHub[] = [
  { id: 'AIR-01', name: 'Kumbhirgram IAF Airbase (Silchar)', type: 'IAF Airbase', district: 'cachar', capacity: 'Heavy Transport (C-130J, An-32, Mi-17)', readiness: 'ready' },
  { id: 'AIR-02', name: 'Umroi Airport & Helipad (Shillong)', type: 'Regional Airstrip', district: 'east_khasi', capacity: 'Helicopters & ATR-72', readiness: 'standby' },
  { id: 'AIR-03', name: 'Tezpur Air Force Station', type: 'IAF Tactical Base', district: 'sonitpur', capacity: 'Full Fleet Disaster Staging Hub', readiness: 'ready' },
  { id: 'AIR-04', name: 'Lengpui Emergency Airfield (Aizawl)', type: 'Hill Runway', district: 'aizawl', capacity: 'Medium Airlift & Helis', readiness: 'ready' },
  { id: 'AIR-05', name: 'Haflong Hill Helipad', type: 'Disaster Drop Zone', district: 'dima_hasao', capacity: 'Light / Medium Choppers (Dhruv, Cheetah)', readiness: 'active' },
];

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'brahmaputra_catastrophic_flood',
    title: 'Brahmaputra Major Basin Inundation (+2.6m)',
    description: 'Severe monsoon surge causing simultaneous overtopping of middle Brahmaputra bridges and arterial NH-27/NH-37 highway cutoffs.',
    riverSurgeMeters: 2.6,
    rainfallIntensityMm: 175.0,
    soilSaturationPct: 72.0,
    earthquakeMagnitude: 0.0,
    dykeBreach: true,
    severedCorridors: ['kamrup-sonitpur', 'sonitpur-dima_hasao'],
    triggeredLandslidePasses: ['LP-05'],
    severity: 'critical',
  },
  {
    id: 'barail_mountain_severance',
    title: 'Barail Range Mega-Landslide (NH-6 Collapse)',
    description: 'Continuous heavy downpour in Meghalaya and Dima Hasao triggering massive slope failures at Sonapur Tunnel and Jatinga, severing Barak Valley.',
    riverSurgeMeters: 1.4,
    rainfallIntensityMm: 220.0,
    soilSaturationPct: 92.0,
    earthquakeMagnitude: 0.0,
    dykeBreach: false,
    severedCorridors: ['kamrup-dima_hasao', 'cachar-aizawl', 'dima_hasao-cachar'],
    triggeredLandslidePasses: ['LP-01', 'LP-02', 'LP-04'],
    severity: 'critical',
  },
  {
    id: 'zone_v_seismic_deluge',
    title: 'Zone-V Seismic Shock (M6.4) + Monsoon Cloudburst',
    description: 'Simultaneous 6.4 Richter earthquake along Kopili Fault with torrential rain, triggering multiple catastrophic landslides across all hill tracts.',
    riverSurgeMeters: 2.2,
    rainfallIntensityMm: 260.0,
    soilSaturationPct: 96.0,
    earthquakeMagnitude: 6.4,
    dykeBreach: true,
    severedCorridors: ['kamrup-sonitpur', 'kamrup-dima_hasao', 'dima_hasao-cachar', 'cachar-aizawl', 'cachar-west_tripura'],
    triggeredLandslidePasses: ['LP-01', 'LP-02', 'LP-03', 'LP-04', 'LP-05', 'LP-06'],
    severity: 'catastrophic',
  },
  {
    id: 'flash_flood_cloudburst',
    title: 'Barak Basin Flash Flood Cloudburst (180mm/6h)',
    description: 'Sudden cloudburst inundating urban Silchar and Southern Assam connector corridors with swift water currents.',
    riverSurgeMeters: 2.1,
    rainfallIntensityMm: 180.0,
    soilSaturationPct: 65.0,
    earthquakeMagnitude: 0.0,
    dykeBreach: false,
    severedCorridors: ['dima_hasao-cachar', 'cachar-west_tripura'],
    triggeredLandslidePasses: ['LP-04'],
    severity: 'high',
  },
];

export const DISTRICT_SUPPLIES: Record<string, { name: string; pop: number; oxygen_days: number; food_days: number; fuel_days: number; grains_days: number }> = {
  cachar: { name: 'Cachar (Silchar)', pop: 1736000, oxygen_days: 5.0, food_days: 8.0, fuel_days: 4.5, grains_days: 12.0 },
  dima_hasao: { name: 'Dima Hasao (Haflong)', pop: 214000, oxygen_days: 3.0, food_days: 4.0, fuel_days: 3.0, grains_days: 7.0 },
  aizawl: { name: 'Aizawl (Mizoram)', pop: 400000, oxygen_days: 6.0, food_days: 7.0, fuel_days: 5.0, grains_days: 14.0 },
  sonitpur: { name: 'Sonitpur (Tezpur)', pop: 1924000, oxygen_days: 7.0, food_days: 10.0, fuel_days: 6.0, grains_days: 18.0 },
  kamrup: { name: 'Kamrup (Guwahati Hub)', pop: 2500000, oxygen_days: 15.0, food_days: 20.0, fuel_days: 14.0, grains_days: 30.0 },
  east_khasi: { name: 'East Khasi Hills (Shillong)', pop: 825000, oxygen_days: 8.0, food_days: 9.0, fuel_days: 6.5, grains_days: 15.0 },
  west_tripura: { name: 'West Tripura (Agartala)', pop: 918000, oxygen_days: 5.5, food_days: 6.5, fuel_days: 4.0, grains_days: 11.0 },
  dimapur: { name: 'Dimapur (Nagaland Hub)', pop: 378000, oxygen_days: 7.0, food_days: 8.0, fuel_days: 6.0, grains_days: 14.0 },
};

export class LocalDisasterDigitalTwin {
  static getPresets(): ScenarioPreset[] {
    return SCENARIO_PRESETS;
  }

  static getMountainPasses(): MountainPassInfo[] {
    return NER_MOUNTAIN_PASSES;
  }

  static runSimulation(params: {
    riverSurgeMeters?: number;
    rainfallIntensityMm?: number;
    soilSaturationPct?: number;
    earthquakeMagnitude?: number;
    dykeBreach?: boolean;
    severedCorridors?: string[];
    triggeredLandslidePasses?: string[];
    scenarioName?: string;
  }) {
    const river_surge_m = Number(params.riverSurgeMeters ?? 2.0);
    const rainfall_mm = Number(params.rainfallIntensityMm ?? 120.0);
    const soil_saturation_pct = Number(params.soilSaturationPct ?? 65.0);
    const earthquake_magnitude = Number(params.earthquakeMagnitude ?? 0.0);
    const dyke_breach = Boolean(params.dykeBreach);
    const severed = new Set<string>(params.severedCorridors || []);
    const manual_passes = new Set<string>(params.triggeredLandslidePasses || []);
    const scenario_name = params.scenarioName || 'Custom Simulation';
    const sim_timestamp = new Date().toISOString();

    // 1. Hydrology & Bridges
    const effective_surge = river_surge_m + (dyke_breach ? 0.5 : 0.0);
    const submerged_bridges: any[] = [];
    const threatened_bridges: any[] = [];
    const safe_bridges: any[] = [];

    for (const b of NER_BRIDGES) {
      const deck = b.deck_clearance_m;
      const clearance_left = Math.round((deck - effective_surge) * 100) / 100;
      const b_info = {
        id: b.id,
        name: b.name,
        river: b.river,
        district: b.district,
        deckClearanceM: deck,
        surgeLevelM: Math.round(effective_surge * 100) / 100,
        effectiveClearanceM: clearance_left,
        status: clearance_left <= 0 ? 'submerged' : clearance_left < 0.5 ? 'threatened' : 'operational',
      };
      if (clearance_left <= 0) {
        submerged_bridges.push(b_info);
      } else if (clearance_left < 0.5) {
        threatened_bridges.push(b_info);
      } else {
        safe_bridges.push(b_info);
      }
    }

    // 2. Geotechnical & Landslides
    const active_landslides: any[] = [];
    const threatened_passes: any[] = [];
    let total_debris_m3 = 0;
    let max_clearing_hours = 0;

    for (const lp of NER_MOUNTAIN_PASSES) {
      const is_manual = manual_passes.has(lp.id);
      const saturation_exceeded = soil_saturation_pct >= lp.saturationTriggerPct;
      const earthquake_trigger = earthquake_magnitude >= 5.0;
      const heavy_rain_trigger = rainfall_mm >= 170.0 && lp.slopeAngleDeg >= 45;

      const is_active_collapse = is_manual || saturation_exceeded || earthquake_trigger || heavy_rain_trigger;
      const is_threatened = !is_active_collapse && (soil_saturation_pct >= lp.saturationTriggerPct - 12 || rainfall_mm >= 130);

      let multiplier = 1.0;
      if (earthquake_trigger) multiplier += (earthquake_magnitude - 4.5) * 0.8;
      if (soil_saturation_pct > 80) multiplier += ((soil_saturation_pct - 80) / 20.0) * 0.6;
      if (rainfall_mm > 150) multiplier += ((rainfall_mm - 150) / 100.0) * 0.5;

      const debris_m3 = is_active_collapse
        ? Math.round(lp.baseDebrisM3 * multiplier)
        : is_threatened
        ? Math.round(lp.baseDebrisM3 * 0.2)
        : 0;

      const equipment_units = Math.max(2, Math.min(8, Math.floor(debris_m3 / 2000) + 1));
      const clearing_hours = debris_m3 > 0 ? Math.round((debris_m3 / (equipment_units * 120)) * 10) / 10 : 0.0;

      const lp_result = {
        id: lp.id,
        name: lp.name,
        highway: lp.highway,
        state: lp.state,
        district: lp.district,
        elevationM: lp.elevationM,
        slopeAngleDeg: lp.slopeAngleDeg,
        soilType: lp.soilType,
        broTaskForce: lp.broTaskForce,
        corridorKey: lp.corridorKey,
        status: is_active_collapse ? 'collapsed' : is_threatened ? 'high_risk' : 'stable',
        debrisVolumeM3: debris_m3,
        clearingEtaHours: clearing_hours,
        equipmentRequired: `${equipment_units}x Hydraulic Excavators, ${Math.max(1, equipment_units - 1)}x Heavy Dozers, Rock Breaker`,
        triggerCause:
          earthquake_trigger && saturation_exceeded
            ? 'Seismic slip & high saturation'
            : earthquake_trigger
            ? 'Earthquake shock'
            : saturation_exceeded
            ? 'Soil saturation & rain liquefaction'
            : heavy_rain_trigger
            ? 'Heavy rainfall on steep incline'
            : is_manual
            ? 'Manual trigger'
            : 'Pre-saturation risk',
        recommendedAction: 'Immediate road closure. BRO heavy clearing underway. Divert via Ro-Ro or alternative ridge line.',
      };

      if (is_active_collapse) {
        active_landslides.push(lp_result);
        total_debris_m3 += debris_m3;
        if (clearing_hours > max_clearing_hours) max_clearing_hours = clearing_hours;
        if (lp.corridorKey) severed.add(lp.corridorKey);
      } else if (is_threatened) {
        threatened_passes.push(lp_result);
      }
    }

    // 3. Arterial cutoffs
    const auto_cutoffs = new Set(severed);
    for (const sb of submerged_bridges) {
      if (sb.district === 'kamrup') auto_cutoffs.add('kamrup-sonitpur');
      else if (sb.district === 'sonitpur') {
        auto_cutoffs.add('sonitpur-dima_hasao');
        auto_cutoffs.add('kamrup-sonitpur');
      } else if (sb.district === 'dima_hasao') {
        auto_cutoffs.add('kamrup-dima_hasao');
        auto_cutoffs.add('dima_hasao-cachar');
      } else if (sb.district === 'cachar') {
        auto_cutoffs.add('cachar-aizawl');
        auto_cutoffs.add('cachar-west_tripura');
      }
    }

    // 4. District Supplies & Depletion
    const districts_impact: Record<string, any> = {};
    const critical_shortage_districts: string[] = [];
    const depletion_factor = 1.0 + (rainfall_mm / 100.0) * 0.35 + active_landslides.length * 0.15;

    for (const [d_id, stock] of Object.entries(DISTRICT_SUPPLIES)) {
      let is_isolated = false;
      if (d_id === 'dima_hasao' && (auto_cutoffs.has('kamrup-dima_hasao') || auto_cutoffs.has('sonitpur-dima_hasao'))) {
        is_isolated = true;
      } else if (d_id === 'cachar' && (auto_cutoffs.has('kamrup-dima_hasao') || auto_cutoffs.has('dima_hasao-cachar'))) {
        is_isolated = true;
      } else if (d_id === 'aizawl' && auto_cutoffs.has('cachar-aizawl')) {
        is_isolated = true;
      } else if (d_id === 'west_tripura' && auto_cutoffs.has('cachar-west_tripura')) {
        is_isolated = true;
      } else if (d_id === 'sonitpur' && auto_cutoffs.has('kamrup-sonitpur')) {
        is_isolated = true;
      }

      const burn_rate = is_isolated ? depletion_factor : 1.0;
      const ox_rem = Math.max(0.2, Math.round((stock.oxygen_days / burn_rate) * 10) / 10);
      const food_rem = Math.max(0.5, Math.round((stock.food_days / burn_rate) * 10) / 10);
      const fuel_rem = Math.max(0.2, Math.round((stock.fuel_days / burn_rate) * 10) / 10);
      const grain_rem = Math.max(1.0, Math.round((stock.grains_days / burn_rate) * 10) / 10);

      const d_result = {
        id: d_id,
        name: stock.name,
        status: is_isolated ? 'isolated' : auto_cutoffs.size > 2 ? 'partial_access' : 'operational',
        population: stock.pop,
        stockDaysRemaining: {
          medicalOxygen: ox_rem,
          infantFood: food_rem,
          petroleumFuel: fuel_rem,
          essentialGrains: grain_rem,
        },
        alarm: ox_rem <= 2.5 || fuel_rem <= 2.0 ? 'red' : ox_rem <= 4.0 || food_rem <= 4.0 ? 'orange' : 'green',
      };
      districts_impact[d_id] = d_result;
      if (d_result.alarm === 'red') critical_shortage_districts.push(stock.name);
    }

    // 5. Convoy Impact
    const simulated_fleet = [
      { id: 'AS-01-GC-4412', vehicleType: 'heavy_multi_axle', cargo: 'medical_oxygen', currentRoute: 'kamrup-cachar', from: 'kamrup', to: 'cachar' },
      { id: 'AS-11-BC-8921', vehicleType: 'hazardous_tanker', cargo: 'diesel', currentRoute: 'kamrup-dima_hasao', from: 'kamrup', to: 'dima_hasao' },
      { id: 'TR-01-X-3301', vehicleType: 'medium_commercial', cargo: 'infant_food', currentRoute: 'cachar-west_tripura', from: 'cachar', to: 'west_tripura' },
      { id: 'MZ-01-T-7740', vehicleType: 'heavy_multi_axle', cargo: 'grains', currentRoute: 'cachar-aizawl', from: 'cachar', to: 'aizawl' },
      { id: 'AS-03-D-1199', vehicleType: 'light_commercial', cargo: 'medicine', currentRoute: 'kamrup-sonitpur', from: 'kamrup', to: 'sonitpur' },
      { id: 'NL-07-A-5520', vehicleType: 'heavy_multi_axle', cargo: 'diesel', currentRoute: 'dimapur-cachar', from: 'dimapur', to: 'cachar' },
    ];

    const stranded_vehicles: any[] = [];
    const rerouted_vehicles: any[] = [];

    for (const v of simulated_fleet) {
      const is_severed = auto_cutoffs.has(v.currentRoute);
      let blockage_reason = 'Bridge Inundation';
      for (const lp of active_landslides) {
        if (lp.corridorKey === v.currentRoute) {
          blockage_reason = `Landslide: ${lp.name}`;
          break;
        }
      }

      if (is_severed) {
        stranded_vehicles.push({
          ...v,
          impact: `Route Severed (${blockage_reason})`,
          actionRequired: 'Emergency diversion to safe-haven logistics hub or IWAI Ro-Ro barge.',
          recommendedHoldingPoint: 'Nagaon Highway Logistics Depot (KM-120)',
          alternateAction: 'Activate Pandu / Silghat Ro-Ro ferry crossing for heavy commercial trucks',
        });
      } else {
        rerouted_vehicles.push({
          ...v,
          impact: 'Route Clear with Cautionary Advisory',
        });
      }
    }

    // 6. Ro-Ro Waterways & Drones
    const active_roro_bypass: any[] = [];
    if (auto_cutoffs.has('kamrup-sonitpur') || auto_cutoffs.has('sonitpur-dima_hasao')) {
      active_roro_bypass.push({
        service: 'IWAI Pandu - Silghat Ro-Ro',
        waterway: 'National Waterway 2 (Brahmaputra)',
        terminalA: 'Pandu Multi-Modal Port, Guwahati',
        terminalB: 'Silghat IWT Terminal, Nagaon',
        capacity: '20 Heavy Commercial Vehicles / Voyage',
        transitTime: '3h 45m',
        status: 'OPERATIONAL - READY FOR MOBILIZATION',
      });
    }
    if (auto_cutoffs.has('cachar-west_tripura') || auto_cutoffs.has('cachar-aizawl')) {
      active_roro_bypass.push({
        service: 'IWAI Dhubri - Jogighopa Ro-Ro Link',
        waterway: 'National Waterway 2 (Lower Assam)',
        terminalA: 'Dhubri River Terminal',
        terminalB: 'Jogighopa Multi-Modal Logistics Park',
        capacity: '16 Heavy Trucks / Voyage',
        transitTime: '2h 10m',
        status: 'OPERATIONAL - READY FOR MOBILIZATION',
      });
    }

    const drone_drop_zones: any[] = [];
    if (districts_impact['dima_hasao']?.status === 'isolated') {
      drone_drop_zones.push({
        location: 'Haflong Civil Hospital Helipad Ground',
        district: 'Dima Hasao',
        payload: 'High-altitude Blood Units & Snake Antivenom',
        droneModel: 'Heavy-Lift VTOL Logistics Drone (30kg)',
        flightDistanceKm: 68,
        flightTimeMin: 42,
      });
    }
    if (districts_impact['cachar']?.status === 'isolated') {
      drone_drop_zones.push({
        location: 'Silchar Medical College & Hospital (SMCH)',
        district: 'Cachar',
        payload: 'Dialysis Fluids & Critical Antibiotics',
        droneModel: 'Long-Range Hybrid VTOL (25kg)',
        flightDistanceKm: 84,
        flightTimeMin: 54,
      });
    }
    if (districts_impact['aizawl']?.status === 'isolated') {
      drone_drop_zones.push({
        location: 'Kolasib District Civil Hospital Drop Zone',
        district: 'Aizawl border',
        payload: 'Emergency Insulin & Surgical Kits',
        droneModel: 'Long-Range Hybrid VTOL (25kg)',
        flightDistanceKm: 52,
        flightTimeMin: 36,
      });
    }

    // 7. Executive SITREP
    const sitrep = `================================================================================
DISASTER DIGITAL TWIN — EXECUTIVE SITUATION REPORT (SITREP)
================================================================================
Generated Timestamp: ${sim_timestamp}
Scenario Name:       ${scenario_name}
Hydrological State:  River Surge +${Math.round(effective_surge * 100) / 100}m | 24h Rainfall: ${rainfall_mm}mm | Dyke Breach: ${dyke_breach ? 'YES' : 'NO'}
Geotechnical State:  Soil Saturation: ${soil_saturation_pct}% | Seismic Shock: ${earthquake_magnitude} Richter | Active Landslides: ${active_landslides.length}
Total Severed Arteries: ${auto_cutoffs.size} Highway Corridors

1. GEOTECHNICAL & LANDSLIDE DISASTERS:
   - Active Slope Collapses: ${active_landslides.length} mountain pass(es) blocked
     ${active_landslides.length > 0 ? active_landslides.map((lp) => `* [COLLAPSE] ${lp.name} (${lp.highway}): ${lp.debrisVolumeM3} m3 debris, Clearance ETA: ${lp.clearingEtaHours}h by ${lp.broTaskForce}`).join('\n     ') : 'None detected at current saturation'}
   - Total Slope Debris to be Cleared: ${total_debris_m3.toLocaleString()} m3
   - Maximum Road Clearance ETA: ${max_clearing_hours} Hours (${Math.round((max_clearing_hours / 24) * 10) / 10} Days)

2. CRITICAL RIVER BRIDGES & WATERWAYS:
   - Bridges Submerged (Deck Overtopped): ${submerged_bridges.length} (${submerged_bridges.map((b) => b.name).join(', ') || 'None'})
   - Threatened Spans (< 0.5m clearance): ${threatened_bridges.length} (${threatened_bridges.map((b) => b.name).join(', ') || 'None'})
   - Severed Highway Links: ${Array.from(auto_cutoffs).join(', ') || 'None'}

3. DISTRICT SUPPLY CHAIN ISOLATION & VULNERABILITY:
   - Completely Isolated Districts: ${Object.values(districts_impact).filter((d) => d.status === 'isolated').map((d) => d.name).join(', ') || 'None'}
   - Critical Supply Shortage (< 48h Oxygen/Fuel): ${critical_shortage_districts.join(', ') || 'None'}

4. FLEET STRANDING & EMERGENCY DIVERSIONS:
   - En-Route Trucks Trapped: ${stranded_vehicles.length} vehicles
   - Primary Holding Depots: Nagaon Highway Logistics Hub (KM-120) & Guwahati Pandu Port
   - Alternate Multi-Modal Action: Activate IWAI NW-2 Ro-Ro Waterway shuttles to bypass submerged bridges.

5. TACTICAL RELIEF & EVACUATION MOBILIZATION:
   - IAF Tactical Airlift Hubs: Kumbhirgram Airbase, Umroi Airport, Tezpur AFS
   - Drone Medical Drop Corridors: ${drone_drop_zones.length} active routes (Haflong / Silchar / Kolasib)
   - BRO Heavy Machinery Required: ${active_landslides.reduce((acc, lp) => acc + (Math.floor(lp.debrisVolumeM3 / 2000) + 1), 0)} Excavators & Dozers deployed
================================================================================
`;

    return {
      scenarioName: scenario_name,
      simulatedAt: sim_timestamp,
      engineMode: 'hybrid_in_memory',
      inputs: {
        riverSurgeMeters: river_surge_m,
        rainfallIntensityMm: rainfall_mm,
        soilSaturationPct: soil_saturation_pct,
        earthquakeMagnitude: earthquake_magnitude,
        dykeBreach: dyke_breach,
        severedCorridors: Array.from(auto_cutoffs),
        triggeredLandslidePasses: Array.from(manual_passes),
      },
      metrics: {
        submergedBridgesCount: submerged_bridges.length,
        threatenedBridgesCount: threatened_bridges.length,
        activeLandslidesCount: active_landslides.length,
        threatenedPassesCount: threatened_passes.length,
        totalDebrisVolumeM3: total_debris_m3,
        maxClearingHours: max_clearing_hours,
        isolatedDistrictsCount: Object.values(districts_impact).filter((d) => d.status === 'isolated').length,
        criticalAlarmDistrictsCount: critical_shortage_districts.length,
        strandedVehiclesCount: stranded_vehicles.length,
      },
      submergedBridges: submerged_bridges,
      threatenedBridges: threatened_bridges,
      safeBridges: safe_bridges,
      activeLandslides: active_landslides,
      threatenedPasses: threatened_passes,
      districtsImpact: districts_impact,
      criticalShortageDistricts: critical_shortage_districts,
      strandedVehicles: stranded_vehicles,
      activeRoroBypass: active_roro_bypass,
      droneDropZones: drone_drop_zones,
      reliefAirHubs: RELIEF_AIR_HUBS,
      executiveSitrep: sitrep,
    };
  }
}
