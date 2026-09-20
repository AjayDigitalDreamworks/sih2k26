import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  User,
  Radio,
  Mountain,
  Waves,
  Camera,
  Send,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  X,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { fieldOfficerApi } from '../api/fieldOfficer';
import { requestLocationPermission } from '../utils/locationPermission';
import * as Location from 'expo-location';

interface ReportHazardScreenProps {
  onBack: () => void;
  onSubmitSuccess?: () => void;
  initialTask?: any;
}

type IncidentCategory = 'landslide' | 'flood' | 'road_damage' | 'other';
type SeverityLevel = 'low' | 'medium' | 'critical';

export const ReportHazardScreen: React.FC<ReportHazardScreenProps> = ({
  onBack,
  onSubmitSuccess,
  initialTask,
}) => {
  const { officerData } = useAuth();
  
  const getInitialCategory = (): IncidentCategory => {
    const it = (initialTask?.issue_type || '').toUpperCase();
    if (it.includes('FLOOD')) return 'flood';
    if (it.includes('ROAD') || it.includes('DAMAGE')) return 'road_damage';
    if (it.includes('LANDSLIDE')) return 'landslide';
    return 'landslide';
  };

  const getInitialSeverity = (): SeverityLevel => {
    const prio = (initialTask?.priority || '').toUpperCase();
    if (prio === 'CRITICAL' || prio === 'HIGH') return 'critical';
    if (prio === 'MEDIUM' || prio === 'MODERATE') return 'medium';
    return 'medium';
  };

  const [category, setCategory] = useState<IncidentCategory>(getInitialCategory());
  const [severity, setSeverity] = useState<SeverityLevel>(getInitialSeverity());
  const [description, setDescription] = useState(
    initialTask ? `${initialTask.title || 'Ground verification'}: Observed on-site condition.` : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialTask?.latitude && initialTask?.longitude
      ? { lat: Number(initialTask.latitude), lng: Number(initialTask.longitude) }
      : null
  );

  const fetchLocation = async () => {
    try {
      const perm = await requestLocationPermission(false);
      if (perm.granted) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (loc?.coords) {
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      }
    } catch {}
  };

  React.useEffect(() => {
    if (!coords) {
      fetchLocation();
    }
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter field observation notes / description.');
      return;
    }
    setIsSubmitting(true);
    try {
      const sevParam = severity === 'critical' ? 'CRITICAL' : severity === 'medium' ? 'HIGH' : 'MEDIUM';
      const issueTypeParam = category === 'road_damage' ? 'ROAD_DAMAGE' : category.toUpperCase();
      const finalLat = coords?.lat ?? (initialTask?.latitude != null ? Number(initialTask.latitude) : 26.1445);
      const finalLng = coords?.lng ?? (initialTask?.longitude != null ? Number(initialTask.longitude) : 91.7362);

      if (initialTask?.id) {
        await fieldOfficerApi.verifyTask(initialTask.id, {
          verification_result: 'CONFIRMED',
          observed_severity: sevParam,
          road_passability: severity === 'critical' ? 'IMPASSABLE_ALL' : severity === 'medium' ? 'SINGLE_LANE_ONLY' : 'PASSABLE',
          safety_status: severity === 'critical' ? 'HIGH_DANGER' : 'CAUTION_REQUIRED',
          observation_notes: description.trim(),
          action_recommended: severity === 'critical' ? 'ROAD_CLOSURE' : 'CAUTION_SPEED_LIMIT',
          latitude: finalLat,
          longitude: finalLng,
          coordinates: { lat: finalLat, lng: finalLng },
        });
      } else {
        await fieldOfficerApi.createReport({
          issue_type: issueTypeParam,
          type: issueTypeParam,
          description: description.trim(),
          severity: sevParam,
          latitude: finalLat,
          longitude: finalLng,
          coordinates: { lat: finalLat, lng: finalLng },
          road_status: severity === 'critical' ? 'CLOSED' : severity === 'medium' ? 'PARTIALLY_BLOCKED' : 'OPEN',
          safety_status: severity === 'critical' ? 'HIGH_DANGER' : 'CAUTION_REQUIRED',
        });
      }
      Alert.alert(
        initialTask?.id ? 'Verification Submitted' : 'Hazard Broadcasted',
        initialTask?.id
          ? 'Ground-truth verification has been logged and synchronized.'
          : 'Hazard report has been broadcast to command center and drivers.',
        [{ text: 'OK', onPress: () => onSubmitSuccess && onSubmitSuccess() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#0F172A" />
          <Text style={styles.headerTitle}>Report Hazard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INCIDENT CATEGORY</Text>
          <View style={styles.categoryRow}>
            {[
              { key: 'landslide', label: 'Landslide', icon: Mountain },
              { key: 'flood', label: 'Flood', icon: Waves },
              { key: 'road_damage', label: 'Road Damage', icon: AlertTriangle },
              { key: 'other', label: 'Other', icon: MapPin },
            ].map(({ key, label, icon: Icon }) => (
              <TouchableOpacity
                key={key}
                style={[styles.categoryChip, category === key && styles.categoryChipActive]}
                onPress={() => setCategory(key as IncidentCategory)}
              >
                <Icon size={16} color={category === key ? '#FFFFFF' : '#475569'} />
                <Text style={[styles.categoryLabel, category === key && styles.categoryLabelActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SEVERITY LEVEL</Text>
          <View style={styles.severityRow}>
            {['low', 'medium', 'critical'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.severityChip,
                  severity === s && styles.severityChipActive,
                  severity === s && s === 'critical' && { backgroundColor: '#DC2626' },
                  severity === s && s === 'medium' && { backgroundColor: '#D97706' },
                  severity === s && s === 'low' && { backgroundColor: '#16A34A' },
                ]}
                onPress={() => setSeverity(s as SeverityLevel)}
              >
                <Text style={[styles.severityText, severity === s && { color: '#FFFFFF' }]}>{s.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FIELD DESCRIPTION</Text>
          <TextInput
            style={styles.notesInput}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe the incident..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {coords && (
          <View style={styles.coordBadge}>
            <MapPin size={14} color="#065F46" />
            <Text style={styles.coordText}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Send size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Broadcast Hazard Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.6, marginBottom: 8 },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 10, paddingHorizontal: 14 },
  categoryChipActive: { backgroundColor: '#0A382C', borderColor: '#0A382C' },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  categoryLabelActive: { color: '#FFFFFF' },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  severityChipActive: { backgroundColor: '#0A382C' },
  severityText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  notesInput: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 90, textAlignVertical: 'top' },
  coordBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, marginBottom: 16, alignSelf: 'flex-start' },
  coordText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  submitBtn: { backgroundColor: '#0A382C', borderRadius: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#0A382C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
