import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Filter,
  CheckCircle2,
  Camera,
  AlertTriangle,
  MapPin,
  Map,
  Eye,
  ShieldCheck,
  Shield,
  Layers,
  ChevronRight,
  Clock,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { fieldOfficerApi } from '../api/fieldOfficer';
import { subscribeToFieldTasks, subscribeToAlerts } from '../api/socket';

interface TasksScreenProps {
  onNavigateToGis: (coords?: string) => void;
  onVerifyGroundTruth: (task?: any) => void;
  onInspectCulvert?: (task?: any) => void;
  onStartAudit?: (task?: any) => void;
}

type FilterType = 'ALL' | 'URGENT' | 'ACTIVE' | 'VERIFIED';

const SEVERITY_PRIORITY: Record<string, string> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH RISK',
  HIGH_RISK: 'HIGH RISK',
  MEDIUM: 'MODERATE',
  MODERATE: 'MODERATE',
  LOW: 'ROUTINE',
  ROUTINE: 'ROUTINE',
};

export const TasksScreen: React.FC<TasksScreenProps> = ({
  onNavigateToGis,
  onVerifyGroundTruth,
  onInspectCulvert,
  onStartAudit,
}) => {
  const { officerData, refreshOfficerData } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ assignedTasks: 0, urgentTasks: 0, verifiedToday: 0, fieldReports: 0 });

  const fetchTasks = async () => {
    try {
      const [tasksData, dashboardData] = await Promise.all([
        fieldOfficerApi.getTasks().catch(() => []),
        fieldOfficerApi.getDashboard().catch(() => null),
      ]);
      const loadedTasks = Array.isArray(tasksData) ? tasksData : (((tasksData as any)?.data) || []);
      setTasks(loadedTasks);
      const dash = dashboardData?.stats || dashboardData || {};
      setStats({
        assignedTasks: dash.totalAssigned || dash.assignedTasks || loadedTasks.length,
        urgentTasks: dash.activeTasks || dash.urgentTasks || loadedTasks.filter((t: any) => t.priority === 'CRITICAL' || t.priority === 'HIGH').length,
        verifiedToday: dash.verifiedToday || 0,
        fieldReports: dash.myReportsCount || dash.fieldReports || 0,
      });
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
    const unsubTasks = subscribeToFieldTasks((task: any) => {
      setTasks(prev => [task, ...prev.filter(t => t.id !== task.id)]);
      fetchTasks();
    });
    const unsubAlerts = subscribeToAlerts(() => {
      refreshOfficerData();
      fetchTasks();
    });
    return () => {
      unsubTasks();
      unsubAlerts();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const filteredTasks = tasks.filter(t => {
    const priority = SEVERITY_PRIORITY[t.priority] || SEVERITY_PRIORITY[t.issue_type] || 'ROUTINE';
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'URGENT') return priority === 'CRITICAL' || priority === 'HIGH RISK';
    if (activeFilter === 'ACTIVE') return t.status === 'ASSIGNED' || t.status === 'ACCEPTED' || t.status === 'IN_PROGRESS';
    if (activeFilter === 'VERIFIED') return t.status === 'VERIFIED' || t.status === 'COMPLETED' || t.status === 'RESOLVED';
    return true;
  });

  const getCardCategory = (t: any): string => {
    const priority = t.priority || t.issue_type || '';
    const p = priority.toUpperCase();
    if (p === 'CRITICAL') return 'CRITICAL';
    if (p === 'HIGH' || p === 'HIGH_RISK') return 'HIGH RISK';
    if (p === 'MEDIUM' || p === 'MODERATE') return 'MODERATE';
    return 'ROUTINE';
  };

  const getCategoryColors = (cat: string) => {
    switch (cat) {
      case 'CRITICAL': return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
      case 'HIGH RISK': return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
      case 'MODERATE': return { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' };
      default: return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const getActionType = (t: any): { label: string; action: () => void } => {
    const priority = (t.priority || t.issue_type || '').toUpperCase();
    if (priority === 'CRITICAL' || priority === 'HIGH' || priority === 'HIGH_RISK') {
      return { label: 'Verify Ground Truth', action: () => onVerifyGroundTruth(t) };
    }
    return { label: 'Start Audit', action: () => (onStartAudit ? onStartAudit(t) : onVerifyGroundTruth(t)) };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A382C" />
        <Text style={styles.loadingText}>Loading field tasks...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A382C" />
      }
    >
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricLabel}>ASSIGNED TASKS</Text>
            <View style={styles.funnelIconWrap}><Filter size={13} color="#2563EB" /></View>
          </View>
          <View style={styles.metricMainRow}>
            <Text style={styles.metricNumber}>{stats.assignedTasks || tasks.length}</Text>
            {stats.urgentTasks > 0 && (
              <View style={styles.urgentPill}>
                <Text style={styles.urgentPillText}>{stats.urgentTasks} Urgent</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.metricCard, styles.verifiedCard]}>
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricLabel}>VERIFIED TODAY</Text>
            <View style={styles.checkIconWrap}><CheckCircle2 size={14} color="#16A34A" /></View>
          </View>
          <View style={styles.metricMainRow}>
            <Text style={[styles.metricNumber, { color: '#0F766E' }]}>{stats.verifiedToday}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Field Tasks & Inspections</Text>
        <Text style={styles.sectionCount}>{filteredTasks.length} tasks</Text>
      </View>

      <View style={styles.filterRow}>
        {(['ALL', 'URGENT', 'ACTIVE', 'VERIFIED'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tasksList}>
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Shield size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No field tasks</Text>
            <Text style={styles.emptySub}>Tasks assigned by admin will appear here</Text>
          </View>
        ) : (
          filteredTasks.map((task: any) => {
            const cat = getCardCategory(task);
            const catColors = getCategoryColors(cat);
            const action = getActionType(task);
            const isCritical = cat === 'CRITICAL' || cat === 'HIGH RISK';
            return (
              <View key={task.id || Math.random()} style={[styles.taskCard, isCritical && { borderColor: catColors.border }]}>
                <View style={styles.taskCardHeader}>
                  <View style={[styles.categoryBadge, { backgroundColor: catColors.bg }]}>
                    <AlertTriangle size={10} color={catColors.text} />
                    <Text style={[styles.categoryText, { color: catColors.text }]}>{cat}</Text>
                  </View>
                  <Text style={styles.distanceText}>{task.distance || (task.latitude ? `${task.latitude?.toFixed(4)}, ${task.longitude?.toFixed(4)}` : 'In District')}</Text>
                </View>
                <Text style={styles.taskTitle}>{task.title || task.issue_type || 'Field Verification Task'}</Text>
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {task.description || task.location_name || 'Field verification required'}
                </Text>
                <View style={styles.taskActionsRow}>
                  <TouchableOpacity
                    style={styles.gisLinkBtn}
                    onPress={() => onNavigateToGis(task.latitude ? `${task.latitude},${task.longitude}` : undefined)}
                  >
                    <Map size={14} color="#0A382C" />
                    <Text style={styles.gisLinkText}>View GIS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.verifyBtn} onPress={action.action}>
                    <ShieldCheck size={14} color="#FFFFFF" />
                    <Text style={styles.verifyBtnText}>{action.label}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  contentContainer: { padding: 14, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loadingText: { marginTop: 12, fontSize: 13, fontWeight: '600', color: '#64748B' },
  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  verifiedCard: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  metricCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metricLabel: { fontSize: 9.5, fontWeight: '800', color: '#64748B', letterSpacing: 0.6 },
  funnelIconWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  checkIconWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  metricMainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricNumber: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  urgentPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  urgentPillText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sectionCount: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0A382C', borderColor: '#0A382C' },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },
  tasksList: { gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  emptySub: { fontSize: 12, color: '#94A3B8' },
  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryText: { fontSize: 10, fontWeight: '800' },
  distanceText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  taskTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 6, lineHeight: 20 },
  taskDescription: { fontSize: 12, color: '#475569', lineHeight: 16, marginBottom: 12 },
  taskActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gisLinkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 },
  gisLinkText: { fontSize: 11, fontWeight: '700', color: '#0A382C' },
  verifyBtn: { backgroundColor: '#0A382C', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 20, shadowColor: '#0A382C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 3 },
  verifyBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
