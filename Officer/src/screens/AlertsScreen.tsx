import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  AlertTriangle,
  Radio,
  Activity,
  CloudRain,
  CheckCircle2,
  MapPin,
  TrendingUp,
  Cloud,
  ChevronRight,
  Droplets,
  CornerUpRight,
  Compass,
  BarChart3,
  Wifi,
  Clock,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { fieldOfficerApi } from '../api/fieldOfficer';
import { subscribeToAlerts, subscribeToHazards } from '../api/socket';

interface AlertsScreenProps {
  onAcceptAndRoute?: (alert: any) => void;
  onOpenSensorGraph?: (alertId: string) => void;
}

const formatAlertTime = (alert: any) => {
  const t = alert?.timestamp || alert?.createdAt || alert?.time;
  if (!t) return 'Just now';
  if (typeof t === 'string') {
    if (t.includes('now') || t.includes('Active') || t.includes('ago') || t.includes('Recently')) {
      return t;
    }
  }
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return typeof t === 'string' ? t : 'Recently';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
};

type AlertFilter = 'all' | 'critical' | 'warning' | 'info';

export const AlertsScreen: React.FC<AlertsScreenProps> = ({
  onAcceptAndRoute,
  onOpenSensorGraph,
}) => {
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      const data = await fieldOfficerApi.getNearbyAlerts();
      setAlerts(Array.isArray(data) ? data : []);
      const list = Array.isArray(data) ? data : ((data as any)?.hazards || (data as any)?.alerts || []);
      setAlerts(Array.isArray(list) ? list : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    const unsubAlerts = subscribeToAlerts((alert: any) => {
      setAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)]);
    });
    const unsubHazards = subscribeToHazards((hazard: any) => {
      setAlerts(prev => [{
        id: hazard.id || 'hz-' + Date.now(),
        title: hazard.type || 'Hazard Reported',
        message: hazard.description || 'Field hazard detected',
        severity: hazard.priority === 'High' ? 'critical' : 'warning',
        timestamp: 'Just now',
      }, ...prev]);
    });
    return () => { unsubAlerts(); unsubHazards(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    const sev = (a.severity || a.priority || '').toLowerCase();
    if (filter === 'critical') return sev === 'critical' || sev === 'high';
    if (filter === 'warning') return sev === 'warning' || sev === 'medium';
    if (filter === 'info') return sev === 'info' || sev === 'low' || !sev;
    return true;
  });

  const getSeverityStyle = (severity: string) => {
    const s = (severity || '').toLowerCase();
    if (s === 'critical' || s === 'high') return { border: '#FECACA', bg: '#FFFBFB', icon: '#DC2626', label: 'CRITICAL', labelBg: '#FEE2E2' };
    if (s === 'warning' || s === 'medium') return { border: '#FDE68A', bg: '#FFFDF7', icon: '#D97706', label: 'WARNING', labelBg: '#FEF3C7' };
    return { border: '#BAE6FD', bg: '#F8FCFF', icon: '#2563EB', label: 'INFO', labelBg: '#DBEAFE' };
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#0A382C" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A382C" />}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.pulseDotRow}>
            <View style={styles.pulseRedDot} />
            <Text style={styles.readinessText}>ACTIVE MONITORING</Text>
          </View>
          <Text style={styles.headerTitle}>{alerts.length} Active Alerts</Text>
          <Text style={styles.headerSub}>Field Intelligence Network</Text>
        </View>
        <View style={styles.severityIndexBox}>
          <Text style={styles.severityLabel}>SEVERITY</Text>
          <Text style={styles.severityValue}>
            {alerts.filter(a => (a.severity || '').toLowerCase() === 'critical' || (a.priority || '').toLowerCase() === 'high').length}
            <Text style={styles.severityMax}> / {alerts.length}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'critical', 'warning', 'info'] as AlertFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.alertsList}>
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle2 size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No active alerts</Text>
            <Text style={styles.emptySub}>All clear in your sector</Text>
          </View>
        ) : filteredAlerts.map((alert: any) => {
          const ss = getSeverityStyle(alert.severity || alert.priority);
          return (
            <View key={alert.id || Math.random()} style={[styles.alertCard, { borderColor: ss.border, backgroundColor: ss.bg }]}>
              <View style={styles.alertTopRow}>
                <View style={styles.alertLeft}>
                  <View style={[styles.severityBadge, { backgroundColor: ss.labelBg }]}>
                    <AlertTriangle size={11} color={ss.icon} />
                    <Text style={[styles.severityText, { color: ss.icon }]}>{ss.label}</Text>
                  </View>
                  <Text style={styles.alertTime}>{alert.timestamp || alert.createdAt ? new Date(alert.createdAt || alert.timestamp).toLocaleTimeString() : 'Just now'}</Text>
                  <Text style={styles.alertTime}>{formatAlertTime(alert)}</Text>
                </View>
              </View>
              <Text style={styles.alertTitle}>{alert.title || 'Alert Notification'}</Text>
              <Text style={styles.alertDesc} numberOfLines={2}>{alert.message || alert.description || ''}</Text>
              {onAcceptAndRoute && (
                <View style={styles.alertActions}>
                  <TouchableOpacity style={styles.routeBtn} onPress={() => onAcceptAndRoute(alert)}>
                    <Compass size={14} color="#FFFFFF" />
                    <Text style={styles.routeBtnText}>Accept & Route</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  contentContainer: { padding: 14, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  headerCard: { backgroundColor: '#0A382C', borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerContent: { flex: 1 },
  pulseDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pulseRedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  readinessText: { fontSize: 10, fontWeight: '800', color: '#A7F3D0', letterSpacing: 0.8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#6EE7B7', marginTop: 2 },
  severityIndexBox: { backgroundColor: '#0C2D20', borderRadius: 12, padding: 10, alignItems: 'center' },
  severityLabel: { fontSize: 8.5, fontWeight: '800', color: '#6EE7B7', letterSpacing: 0.5 },
  severityValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  severityMax: { fontSize: 12, fontWeight: '600', color: '#6EE7B7' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterPillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  filterPillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  filterPillTextActive: { color: '#FFFFFF' },
  alertsList: { gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  emptySub: { fontSize: 12, color: '#94A3B8' },
  alertCard: { borderRadius: 14, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  alertTopRow: { marginBottom: 8 },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  severityText: { fontSize: 9, fontWeight: '800' },
  alertTime: { fontSize: 11, color: '#94A3B8' },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  alertDesc: { fontSize: 12, color: '#475569', lineHeight: 16, marginBottom: 10 },
  alertActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  routeBtn: { backgroundColor: '#0A382C', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  routeBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
});
