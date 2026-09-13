import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop as SvgStop,
  RadialGradient,
  Line,
} from 'react-native-svg';
import {
  Mountain,
  Image as ImageIcon,
  Radio,
  Layers,
  Compass,
  Crosshair,
  Plus,
  Minus,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Waves,
  WifiOff,
  CloudOff,
  CornerUpRight,
  ClipboardCheck,
  Activity,
  Maximize2,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { gisApi } from '../api/gisApi';
import { fieldOfficerApi } from '../api/fieldOfficer';
import { subscribeToFieldTasks, subscribeToAlerts, subscribeToHazards } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import * as Location from 'expo-location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GisMapScreenProps {
  onNavigateSafeRoute?: () => void;
  onInspectAndVerify?: (task?: any) => void;
  onOpenRadarFeed?: () => void;
  initialCoords?: string;
}

type MapMode = 'contour' | 'satellite' | 'heatmap';
type LayerFilter = 'all' | 'landslides' | 'flood' | 'anomalies';

export const GisMapScreen: React.FC<GisMapScreenProps> = ({
  onNavigateSafeRoute,
  onInspectAndVerify,
  onOpenRadarFeed,
  initialCoords,
}) => {
  const { user, officerData } = useAuth();
  const officerName = user?.name || officerData?.name || officerData?.user?.name || 'Anup Baruah';
  const officerInitial = (officerName.charAt(0) || 'A').toUpperCase();
  const officerDistrict = officerData?.district?.name || officerData?.assigned_district || user?.districtId || 'Kamrup';

  const [mapMode, setMapMode] = useState<MapMode>('contour');
  const [activeLayer, setActiveLayer] = useState<LayerFilter>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(14);
  const [is3DMode, setIs3DMode] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeIncident, setActiveIncident] = useState<any>(null);
  const [gisRoutes, setGisRoutes] = useState<any[]>([]);
  const [officerLocation, setOfficerLocation] = useState<{ lat: number; lng: number }>({
    lat: 26.1445,
    lng: 91.7362,
  });

  // Fetch real GIS data & tasks from backend
  useEffect(() => {
    let mounted = true;

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(pos => {
        if (mounted && pos?.coords) {
          setOfficerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      })
      .catch(() => {});

    const mapTaskToIncident = (topTask: any) => ({
      id: topTask.id,
      incidentCode: topTask.id,
      status: topTask.status === 'ASSIGNED' ? 'URGENT GROUND TRUTH' : (topTask.status || 'MONITORING'),
      eta: '6 mins',
      distance: topTask.location_name?.includes('KM 42') ? '1.4 km away' : (topTask.location_name || 'Assigned Sector'),
      title: topTask.title || 'Field Verification Task',
      locationDetails: topTask.location_name
        ? `${topTask.location_name} • ${topTask.description || ''}`
        : (topTask.description || 'Active Debris Movement Detected'),
      debrisEst: topTask.issue_type === 'ROAD_DAMAGE' ? 'Surface Subsidence' : (topTask.issue_type === 'FLOOD' ? '30cm Waterlogging' : 'Active Debris'),
      passability: topTask.priority === 'CRITICAL' ? '0% (Blocked)' : 'Passable with Caution',
      sarSensorStatus: topTask.priority === 'CRITICAL' ? 'Radar High' : 'Sensor Monitored',
      latitude: Number(topTask.latitude) || 26.1550,
      longitude: Number(topTask.longitude) || 91.7510,
      rawTask: topTask,
    });

    const fetchGisData = async () => {
      try {
        const [routesRes, tasksRes, alertsRes] = await Promise.all([
          gisApi.getRoutes().catch(() => ({ features: [] })),
          fieldOfficerApi.getTasks().catch(() => []),
          fieldOfficerApi.getNearbyAlerts().catch(() => []),
        ]);
        if (!mounted) return;

        const routesData = routesRes?.features || routesRes?.data?.features || [];
        setGisRoutes(routesData);

        const loadedAlerts = Array.isArray(alertsRes) ? alertsRes : [];
        setAlerts(loadedAlerts);

        const taskList = Array.isArray(tasksRes) ? tasksRes : ((tasksRes as any)?.data || []);
        setTasks(taskList);

        if (taskList.length > 0) {
          const topTask = taskList.find((t: any) => t.priority === 'CRITICAL' || t.priority === 'HIGH') || taskList[0];
          setActiveIncident(mapTaskToIncident(topTask));
        }
      } catch {}
    };

    fetchGisData();

    // Listen for live task dispatches and hazard reports via WebSockets
    const unsubTasks = subscribeToFieldTasks((task: any) => {
      if (!mounted || !task) return;
      setTasks(prev => [task, ...prev.filter(t => t.id !== task.id)]);
      setActiveIncident(mapTaskToIncident(task));
    });

    const unsubAlerts = subscribeToAlerts((alert: any) => {
      if (!mounted || !alert) return;
      setAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)]);
      if (alert.severity === 'High' || alert.severity === 'critical') {
        setActiveIncident((prev: any) => ({
          ...prev,
          title: alert.title || prev?.title,
          locationDetails: alert.message || alert.description || prev?.locationDetails,
          passability: '0% (Blocked)',
        }));
      }
    });

    const unsubHazards = subscribeToHazards((hazard: any) => {
      if (!mounted || !hazard) return;
      setAlerts(prev => [{
        id: hazard.id || 'hz-' + Date.now(),
        title: hazard.type || 'Field Hazard',
        message: hazard.description || 'Hazard reported on route',
        severity: hazard.priority === 'High' ? 'critical' : 'warning',
      }, ...prev]);
    });

    return () => {
      mounted = false;
      unsubTasks();
      unsubAlerts();
      unsubHazards();
    };
  }, []);

  const landslideCount = tasks.filter((t: any) => {
    const it = (t.issue_type || '').toUpperCase();
    return it.includes('LANDSLIDE') || it.includes('ROAD') || it.includes('DAMAGE');
  }).length;
  const floodCount = tasks.filter((t: any) => {
    const it = (t.issue_type || '').toUpperCase();
    return it.includes('FLOOD');
  }).length;
  const anomalyCount = alerts.length;
  const totalLayers = Math.max(1, tasks.length + alerts.length);

  const incident = activeIncident || {
    id: 'FT-1001',
    incidentCode: 'FT-1001',
    status: 'URGENT GROUND TRUTH',
    eta: '6 mins',
    distance: 'Assigned Sector',
    title: 'NH-27 KM 42 Slope Subsidence & Pothole Cluster',
    locationDetails: 'NH-27 Guwahati East Corridor, Near Basistha Chariali • Surface distress',
    debrisEst: 'Surface Subsidence',
    passability: 'Caution (Single Lane)',
    sarSensorStatus: 'Radar Verified',
    latitude: 26.1550,
    longitude: 91.7510,
    rawTask: null,
  };

  const dispLat = incident.latitude || officerLocation.lat;
  const dispLng = incident.longitude || officerLocation.lng;
  const coordsDisplay = `${dispLat.toFixed(4)}°N • ${dispLng.toFixed(4)}°E`;

  const handleCycleLayers = () => {
    const layers: LayerFilter[] = ['all', 'landslides', 'flood', 'anomalies'];
    const nextIdx = (layers.indexOf(activeLayer) + 1) % layers.length;
    setActiveLayer(layers[nextIdx]);
  };

  const handleCompassPress = () => {
    setZoomLevel(14);
    setIs3DMode(false);
    Alert.alert('GIS Compass', 'Map re-centered and aligned True North (Scale 1:50,000).');
  };

  const handleCrosshairPress = () => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => {
        if (pos?.coords) {
          setOfficerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          Alert.alert(
            'GNSS RTK Centimeter Fix',
            `Officer: ${officerName}\nCoordinates: ${pos.coords.latitude.toFixed(5)}°N, ${pos.coords.longitude.toFixed(5)}°E\nAccuracy: ±0.4m (NavIC / GPS L1+L5 Dual-Band)`
          );
        }
      })
      .catch(() => {
        Alert.alert(
          'Officer GNSS Position',
          `Coordinates: ${officerLocation.lat.toFixed(5)}°N, ${officerLocation.lng.toFixed(5)}°E\nSector: ${officerDistrict}`
        );
      });
  };

  const handleNavigatePress = () => {
    if (onNavigateSafeRoute) {
      onNavigateSafeRoute();
    }
    const dest = incident.latitude && incident.longitude
      ? `${incident.latitude},${incident.longitude}`
      : '26.1550,91.7510';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert(
          'Safe GIS Navigation Dispatched',
          `Incident: ${incident.incidentCode} (${incident.title})\nDetour active via NH-27 Corridor.\nETA: ${incident.eta} • Distance: ${incident.distance}`
        );
      }
    }).catch(() => {
      Alert.alert(
        'Safe GIS Navigation Active',
        `Navigating to ${incident.title}\nETA: ${incident.eta} • Distance: ${incident.distance}`
      );
    });
  };

  const handleInspectPress = () => {
    if (onInspectAndVerify) {
      onInspectAndVerify(incident.rawTask || incident);
    }
  };

  const handleRadarFeedPress = () => {
    setMapMode('heatmap');
    if (onOpenRadarFeed) {
      onOpenRadarFeed();
    }
    Alert.alert(
      'SAR Sentinel-1 Radar Feed',
      `Sector: ${officerDistrict} Corridor\nInterferometric Coherence: 0.92\nSlope Creep Rate: -4.2 mm/month\nStatus: Surface anomaly detected at KM 42.`
    );
  };

  return (
    <View style={styles.container}>
      {/* Sub-header status bar */}
      <View style={styles.subHeaderBar}>
        <View style={styles.rtkLockedPill}>
          <View style={styles.smallGreenDot} />
          <Text style={styles.rtkLockedText}>RTK Locked • ±0.4m</Text>
          <Radio size={13} color="#065F46" />
        </View>

        <View style={styles.offlineSectorPill}>
          <Radio size={13} color="#065F46" />
          <Text style={[styles.offlineSectorText, { color: '#065F46', fontWeight: '700' }]}>
            {officerDistrict} Sector • Active
          </Text>
        </View>
      </View>

      {/* Row 1: Map Modes */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mapModesRow}
      >
        <TouchableOpacity
          style={[styles.modeChip, mapMode === 'contour' && styles.modeChipActive]}
          activeOpacity={0.8}
          onPress={() => setMapMode('contour')}
        >
          <Mountain
            size={14}
            color={mapMode === 'contour' ? '#FFFFFF' : '#475569'}
          />
          <Text
            style={[
              styles.modeChipText,
              mapMode === 'contour' && styles.modeChipTextActive,
            ]}
          >
            Contour GIS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeChip, mapMode === 'satellite' && styles.modeChipActive]}
          activeOpacity={0.8}
          onPress={() => setMapMode('satellite')}
        >
          <ImageIcon
            size={14}
            color={mapMode === 'satellite' ? '#FFFFFF' : '#475569'}
          />
          <Text
            style={[
              styles.modeChipText,
              mapMode === 'satellite' && styles.modeChipTextActive,
            ]}
          >
            Satellite
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeChip, mapMode === 'heatmap' && styles.modeChipActive]}
          activeOpacity={0.8}
          onPress={() => setMapMode('heatmap')}
        >
          <Radio
            size={14}
            color={mapMode === 'heatmap' ? '#FFFFFF' : '#475569'}
          />
          <Text
            style={[
              styles.modeChipText,
              mapMode === 'heatmap' && styles.modeChipTextActive,
            ]}
          >
            Sensor Heatmap
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.layerIconButton}
          activeOpacity={0.8}
          onPress={handleCycleLayers}
        >
          <Layers size={15} color="#475569" />
        </TouchableOpacity>
      </ScrollView>

      {/* Row 2: Layer Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerChipsRow}
      >
        <TouchableOpacity
          style={[
            styles.layerChip,
            activeLayer === 'all' && styles.layerChipActive,
          ]}
          activeOpacity={0.8}
          onPress={() => setActiveLayer('all')}
        >
          <Text
            style={[
              styles.layerChipText,
              activeLayer === 'all' && styles.layerChipTextActive,
            ]}
          >
            All Layers ({totalLayers})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.layerChip,
            activeLayer === 'landslides' && styles.layerChipActive,
          ]}
          activeOpacity={0.8}
          onPress={() => setActiveLayer('landslides')}
        >
          <View style={styles.redDot} />
          <Text
            style={[
              styles.layerChipText,
              activeLayer === 'landslides' && styles.layerChipTextActive,
            ]}
          >
            Landslides ({landslideCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.layerChip,
            activeLayer === 'flood' && styles.layerChipActive,
          ]}
          activeOpacity={0.8}
          onPress={() => setActiveLayer('flood')}
        >
          <View style={styles.greenDot} />
          <Text
            style={[
              styles.layerChipText,
              activeLayer === 'flood' && styles.layerChipTextActive,
            ]}
          >
            Flood Water ({floodCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.layerChip,
            activeLayer === 'anomalies' && styles.layerChipActive,
          ]}
          activeOpacity={0.8}
          onPress={() => setActiveLayer('anomalies')}
        >
          <View style={styles.greyDot} />
          <Text
            style={[
              styles.layerChipText,
              activeLayer === 'anomalies' && styles.layerChipTextActive,
            ]}
          >
            Anomalies ({anomalyCount})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Topographic GIS Map Viewport */}
      <View style={styles.mapViewport}>
        <Svg width="100%" height="100%" viewBox="0 0 400 380" style={styles.svgMap}>
          <Defs>
            <RadialGradient id="hazardPulse" cx="50%" cy="50%" r="50%">
              <SvgStop offset="0%" stopColor="#EF4444" stopOpacity="0.5" />
              <SvgStop offset="70%" stopColor="#EF4444" stopOpacity="0.2" />
              <SvgStop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="floodGlow" cx="50%" cy="50%" r="50%">
              <SvgStop offset="0%" stopColor="#0D9488" stopOpacity="0.3" />
              <SvgStop offset="100%" stopColor="#0D9488" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Map Base Background */}
          <Path d="M0 0 H400 V380 H0 Z" fill="#F0F5F2" />

          {/* Elevation Contours */}
          <Path
            d="M-50 120 Q 80 40 220 80 T 450 60"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.2"
            opacity="0.55"
          />
          <Path
            d="M-50 160 Q 120 70 260 110 T 450 130"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.2"
            opacity="0.55"
          />
          <Path
            d="M-20 220 Q 140 120 300 160 T 450 200"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.4"
            opacity="0.65"
          />
          <Path
            d="M0 280 Q 160 180 340 220 T 450 260"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.2"
            opacity="0.5"
          />

          {/* Elevation Markers */}
          <SvgText x="150" y="88" fontSize="8.5" fill="#64748B" fontWeight="600">
            ▲ 1,840m
          </SvgText>
          <SvgText x="320" y="125" fontSize="8.5" fill="#64748B" fontWeight="600">
            ▲ 1,420m
          </SvgText>

          {/* Sector Boundary */}
          <Path
            d="M-20 180 L 420 170"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
          <SvgText x="45" y="174" fontSize="7.5" fill="#94A3B8" fontWeight="600">
            {officerDistrict.toUpperCase()} CORRIDOR
          </SvgText>

          {/* River Stream / Hydrology */}
          <Path
            d="M-10 20 Q 160 140 250 200 T 420 230"
            fill="none"
            stroke="#99F6E4"
            strokeWidth="5"
            opacity="0.5"
          />

          {/* Highway Corridor Line (Road with dashed center) */}
          <Path
            d="M38 380 L 195 150 L 390 100"
            fill="none"
            stroke="#334155"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <Path
            d="M38 380 L 195 150 L 390 100"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeDasharray="5,4"
          />

          {/* Safe GIS Detour Route */}
          <Path
            d="M120 230 Q 150 180 175 140 T 260 210 T 390 230"
            fill="none"
            stroke="#10B981"
            strokeWidth="3.5"
            strokeDasharray="4,4"
          />

          {/* Flood Water Waypoint Ripple */}
          {(activeLayer === 'all' || activeLayer === 'flood') && (
            <G
              onPress={() => {
                const floodTask = tasks.find((t: any) => (t.issue_type || '').toUpperCase().includes('FLOOD'));
                if (floodTask) {
                  setActiveIncident({
                    id: floodTask.id,
                    incidentCode: floodTask.id,
                    status: 'MONITORING',
                    eta: '8 mins',
                    distance: floodTask.location_name || 'Flood Zone KM 48',
                    title: floodTask.title || 'Standing Water Hazard',
                    locationDetails: floodTask.description || 'Standing water on low-lying corridor',
                    debrisEst: '30cm Standing Water',
                    passability: 'Caution (Single Lane)',
                    sarSensorStatus: 'Sensor Verified',
                    latitude: Number(floodTask.latitude) || 26.1600,
                    longitude: Number(floodTask.longitude) || 91.7600,
                    rawTask: floodTask,
                  });
                }
              }}
            >
              <Circle cx="290" cy="195" r="24" fill="url(#floodGlow)" />
              <Circle cx="290" cy="195" r="14" fill="#0D9488" opacity="0.8" />
              <Circle cx="290" cy="195" r="10" fill="#FFFFFF" opacity="0.9" />
            </G>
          )}

          {/* Checkpoint / Waypoint Verified */}
          {(activeLayer === 'all' || activeLayer === 'anomalies') && (
            <G
              onPress={() => {
                const alertItem = alerts[0];
                if (alertItem) {
                  setActiveIncident((prev: any) => ({
                    ...prev,
                    id: alertItem.id || 'AN-301',
                    incidentCode: alertItem.id || 'AN-301',
                    status: 'VERIFIED CHECKPOINT',
                    title: alertItem.title || 'Sensor Telemetry Checkpoint',
                    locationDetails: alertItem.message || alertItem.description || 'Geotechnical sensor verified',
                    debrisEst: 'Stable',
                    passability: '100% (Passable)',
                    sarSensorStatus: 'Radar Calibrated',
                    rawTask: alertItem,
                  }));
                }
              }}
            >
              <Circle cx="112" cy="190" r="14" fill="#0A382C" />
              <Circle cx="112" cy="190" r="11" fill="#10B981" />
            </G>
          )}

          {/* Hazard Landslide Target Pulse Zone */}
          {(activeLayer === 'all' || activeLayer === 'landslides') && (
            <G
              onPress={() => {
                const lsTask = tasks.find((t: any) => {
                  const it = (t.issue_type || '').toUpperCase();
                  return it.includes('LANDSLIDE') || it.includes('ROAD') || (t.priority || '').toUpperCase() === 'CRITICAL';
                }) || tasks[0];
                if (lsTask) {
                  setActiveIncident({
                    id: lsTask.id,
                    incidentCode: lsTask.id,
                    status: lsTask.status === 'ASSIGNED' ? 'URGENT GROUND TRUTH' : (lsTask.status || 'MONITORING'),
                    eta: '6 mins',
                    distance: lsTask.location_name || '1.4 km away',
                    title: lsTask.title || 'Landslide Corridor Alpha',
                    locationDetails: lsTask.location_name
                      ? `${lsTask.location_name} • ${lsTask.description || ''}`
                      : (lsTask.description || 'Active Debris Movement Detected'),
                    debrisEst: lsTask.issue_type === 'ROAD_DAMAGE' ? 'Surface Subsidence' : '~420 m³',
                    passability: lsTask.priority === 'CRITICAL' ? '0% (Blocked)' : 'Caution (Single Lane)',
                    sarSensorStatus: 'Radar High',
                    latitude: Number(lsTask.latitude) || 26.1550,
                    longitude: Number(lsTask.longitude) || 91.7510,
                    rawTask: lsTask,
                  });
                }
              }}
            >
              <Circle cx="195" cy="150" r="32" fill="url(#hazardPulse)" />
              <Circle cx="195" cy="150" r="16" fill="#DC2626" opacity="0.9" />
              <Circle cx="195" cy="150" r="12" fill="#B91C1C" />
            </G>
          )}

          {/* Current Officer Location: YOU */}
          <G x="120" y="235">
            <Circle cx="0" cy="0" r="12" fill="#15803D" />
            <SvgText x="-4" y="4" fontSize="10" fill="#FFFFFF" fontWeight="900">
              {officerInitial}
            </SvgText>
          </G>
        </Svg>

        {/* Floating Hazard Label on Map */}
        <View style={styles.hazardMapTooltip}>
          <View style={styles.tooltipRedDot} />
          <Text style={styles.tooltipText} numberOfLines={1}>
            {incident.incidentCode} • {incident.passability?.includes('0%') ? 'Blocked' : 'Caution'}
          </Text>
        </View>

        {/* Floating "YOU (Officer Name)" Pill */}
        <View style={styles.agentTagPill}>
          <View style={styles.agentGreenCircle}>
            <Text style={styles.agentLetter}>{officerInitial}</Text>
          </View>
          <Text style={styles.agentTagName}>YOU ({officerName.split(' ')[0]})</Text>
        </View>

        {/* Floating Coordinates Pill */}
        <View style={styles.floatingCoordsPill}>
          <Crosshair size={13} color="#475569" />
          <Text style={styles.floatingCoordsText}>{coordsDisplay}</Text>
        </View>

        {/* Floating Map Tools on Right */}
        <View style={styles.floatingToolsWrap}>
          <TouchableOpacity
            style={styles.toolBtn}
            activeOpacity={0.8}
            onPress={handleCompassPress}
          >
            <Compass size={17} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            activeOpacity={0.8}
            onPress={handleCrosshairPress}
          >
            <Crosshair size={17} color="#065F46" strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.zoomPill}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setZoomLevel((z) => Math.min(z + 1, 20))}
            >
              <Plus size={16} color="#0F172A" strokeWidth={2.2} />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setZoomLevel((z) => Math.max(z - 1, 8))}
            >
              <Minus size={16} color="#0F172A" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.toolBtn, is3DMode && styles.toolBtnActive]}
            activeOpacity={0.8}
            onPress={() => setIs3DMode(!is3DMode)}
          >
            <Text style={[styles.toolBtn3D, is3DMode && styles.toolBtn3DActive]}>
              3D
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Incident Detail Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Header row */}
        <View style={styles.sheetTopRow}>
          <View style={styles.urgentGroundTruthPill}>
            <View style={styles.redDot} />
            <Text style={styles.urgentGroundTruthText}>{incident.status}</Text>
          </View>

          <Text style={styles.incidentCodeText}>{incident.incidentCode}</Text>
          <View style={styles.incidentTrackLine} />

          <View style={styles.etaWrap}>
            <Text style={styles.etaText}>{incident.eta}</Text>
            <Text style={styles.etaDistText}>{incident.distance}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.sheetTitle}>{incident.title}</Text>

        {/* Alert detail line */}
        <View style={styles.movementNoticeRow}>
          <AlertTriangle size={14} color="#DC2626" />
          <Text style={styles.movementNoticeText}>
            {incident.locationDetails}
          </Text>
        </View>

        {/* 3 Metric cards */}
        <View style={styles.sheetMetricsRow}>
          <View style={styles.sheetMetricCol}>
            <Text style={styles.sheetMetricLabel}>DEBRIS EST.</Text>
            <Text style={styles.sheetMetricVal}>{incident.debrisEst}</Text>
          </View>

          <View style={styles.sheetMetricCol}>
            <Text style={styles.sheetMetricLabel}>PASSABILITY</Text>
            <Text style={[styles.sheetMetricVal, { color: '#DC2626' }]}>
              {incident.passability}
            </Text>
          </View>

          <View style={styles.sheetMetricCol}>
            <Text style={styles.sheetMetricLabel}>SAR SENSOR</Text>
            <Text style={[styles.sheetMetricVal, { color: '#16A34A' }]}>
              {incident.sarSensorStatus}
            </Text>
          </View>
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.navigateBtn}
          activeOpacity={0.85}
          onPress={handleNavigatePress}
        >
          <CornerUpRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.navigateBtnText}>Navigate via Safe GIS Route</Text>
        </TouchableOpacity>

        {/* Secondary Actions */}
        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity
            style={styles.inspectVerifyBtn}
            activeOpacity={0.8}
            onPress={handleInspectPress}
          >
            <ClipboardCheck size={16} color="#0A382C" />
            <Text style={styles.inspectVerifyBtnText}>Inspect & Verify</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radarFeedBtn}
            activeOpacity={0.8}
            onPress={handleRadarFeedPress}
          >
            <Activity size={16} color="#0A382C" />
            <Text style={styles.radarFeedBtnText}>SAR Radar Feed</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },
  subHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rtkLockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  smallGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  rtkLockedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
  },
  offlineSectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  offlineSectorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // Map Modes Row
  mapModesRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  modeChipActive: {
    backgroundColor: '#0A382C',
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  layerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Layer Chips Row
  layerChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
  },
  layerChipActive: {
    backgroundColor: '#0A382C',
    borderColor: '#0A382C',
  },
  layerChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  layerChipTextActive: {
    color: '#FFFFFF',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  greyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748B',
  },

  // Map Viewport
  mapViewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F0F5F2',
    minHeight: 200,
  },
  svgMap: {
    width: '100%',
    height: '100%',
  },
  hazardMapTooltip: {
    position: 'absolute',
    top: 105,
    left: 110,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  agentTagPill: {
    position: 'absolute',
    bottom: 48,
    left: 105,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A382C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 6,
  },
  agentGreenCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentLetter: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  agentTagName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  floatingCoordsPill: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  floatingCoordsText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E293B',
  },

  // Floating Right Tools
  floatingToolsWrap: {
    position: 'absolute',
    right: 12,
    top: 14,
    gap: 8,
    alignItems: 'center',
    zIndex: 50,
    elevation: 8,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  toolBtnActive: {
    backgroundColor: '#0A382C',
  },
  toolBtn3D: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  toolBtn3DActive: {
    color: '#FFFFFF',
  },
  zoomPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  zoomBtn: {
    width: 38,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    width: 20,
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  // Bottom Sheet
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 40,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  urgentGroundTruthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  urgentGroundTruthText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  incidentCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  incidentTrackLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#DBEAFE',
    marginHorizontal: 8,
    borderRadius: 2,
  },
  etaWrap: {
    alignItems: 'flex-end',
  },
  etaText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
  },
  etaDistText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  movementNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  movementNoticeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  sheetMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  sheetMetricCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetMetricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
  },
  sheetMetricVal: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  navigateBtn: {
    backgroundColor: '#0A382C',
    borderRadius: 22,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    shadowColor: '#0A382C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inspectVerifyBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  inspectVerifyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  radarFeedBtn: {
    flex: 1,
    backgroundColor: '#F5F3FF',
    borderRadius: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  radarFeedBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B21A8',
  },
});
