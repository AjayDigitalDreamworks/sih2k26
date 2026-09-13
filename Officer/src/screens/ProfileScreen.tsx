import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ShieldCheck,
  Radio,
  Camera,
  CheckCircle2,
  Crosshair,
  Wifi,
  Languages,
  AlertOctagon,
  LogOut,
  RefreshCw,
  Award,
  Zap,
  HardDrive,
  HeartPulse,
  Battery,
  User,
  MapPin,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { fieldOfficerApi } from '../api/fieldOfficer';

interface ProfileScreenProps {
  onSignOut: () => void;
  onEmergencySos?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onSignOut,
  onEmergencySos,
}) => {
  const { user, officerData, isLoading: authLoading } = useAuth();
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [liveStats, setLiveStats] = useState<any>(null);

  React.useEffect(() => {
    fieldOfficerApi.getDashboard().then((data) => {
      setLiveStats(data?.stats || data);
    }).catch(() => {});
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const officerName = user?.name || officerData?.name || officerData?.user?.name || 'Anup Baruah';
  const officerRole = user?.role === 'field_officer' ? 'Senior GIS Field Operative' : (user?.role || 'Field Officer');
  const officerId = user?.id || 'usr_officer_001';
  const officerOrg = user?.agency || officerData?.agency || 'Assam PWD Road Safety & GIS Division';
  const officerDistrict = officerData?.district?.name || user?.districtId || 'Kamrup Metropolitan (Guwahati)';
  const officerEmail = user?.email || 'officer1@raahi.gov.in';
  const officerPhone = user?.phone || '+91 9000000007';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.officerProfileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {officerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <CheckCircle2 size={13} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>
          <View style={styles.profileDetailsCol}>
            <Text style={styles.officerName}>{officerName}</Text>
            <Text style={styles.officerRole}>{officerRole} &bull; {officerOrg}</Text>
            <View style={styles.idBadgesRow}>
              <View style={styles.idBadgePill}>
                <Text style={styles.idBadgeText}>ID: {officerId}</Text>
              </View>
              <View style={styles.tierPill}>
                <Text style={styles.tierText}>{officerDistrict}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.onDutyCard}>
          <View style={styles.onDutyLeft}>
            <View style={styles.dutyTitleRow}>
              <View style={[styles.pulseDot, { backgroundColor: isOnDuty ? '#22C55E' : '#94A3B8' }]} />
              <Text style={styles.dutyTitle}>{isOnDuty ? 'ON DUTY (Active Patrol)' : 'OFF DUTY (Standby)'}</Text>
            </View>
            <Text style={styles.dutySub}>
              {isOnDuty ? `Assigned Sector: ${officerDistrict}` : 'Telemetry suspended'}
            </Text>
          </View>
          <Switch
            value={isOnDuty}
            onValueChange={setIsOnDuty}
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            thumbColor={isOnDuty ? '#FFFFFF' : '#F1F5F9'}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Jurisdiction & Contact</Text>
        <View style={styles.diagRow}>
          <View style={styles.diagLeftHeader}>
            <MapPin size={16} color="#0A382C" />
            <Text style={styles.diagTitle}>District Sector</Text>
          </View>
          <Text style={styles.diagVal}>{officerDistrict}</Text>
        </View>
        <View style={styles.diagRow}>
          <View style={styles.diagLeftHeader}>
            <User size={16} color="#0A382C" />
            <Text style={styles.diagTitle}>Official Email</Text>
          </View>
          <Text style={styles.diagVal}>{officerEmail}</Text>
        </View>
        <View style={styles.diagRow}>
          <View style={styles.diagLeftHeader}>
            <Radio size={16} color="#0A382C" />
            <Text style={styles.diagTitle}>Emergency Comms</Text>
          </View>
          <Text style={styles.diagVal}>{officerPhone}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Operational Statistics</Text>
        <View style={styles.diagRow}>
          <View style={styles.diagLeftHeader}>
            <ShieldCheck size={16} color="#0A382C" />
            <Text style={styles.diagTitle}>Assigned Sector Tasks</Text>
          </View>
          <Text style={styles.diagVal}>{liveStats?.totalAssigned ?? 2}</Text>
        </View>
        <View style={styles.diagRow}>
          <View style={styles.diagLeftHeader}>
            <CheckCircle2 size={16} color="#16A34A" />
            <Text style={styles.diagTitle}>Verified Today</Text>
          </View>
          <Text style={styles.diagVal}>{liveStats?.verifiedToday ?? 0}</Text>
        </View>
        <View style={styles.diagRow}>
          <View style={styles.diagLeftHeader}>
            <HardDrive size={16} color="#0A382C" />
            <Text style={styles.diagTitle}>Submitted Field Reports</Text>
          </View>
          <Text style={styles.diagVal}>{liveStats?.myReportsCount ?? 0}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account &amp; Security</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut}>
          {signingOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <>
              <LogOut size={18} color="#DC2626" />
              <Text style={styles.signOutText}>Sign Out &amp; End Session</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sosCard}>
        <TouchableOpacity style={styles.sosButton} onPress={onEmergencySos}>
          <AlertOctagon size={22} color="#DC2626" />
          <Text style={styles.sosButtonText}>SOS Emergency Broadcast</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.shiftSyncNotice}>Session synced with SDRF GIS Command</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  contentContainer: { padding: 14, paddingBottom: 32 },
  officerProfileCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  profileTopRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0A382C', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 20, fontWeight: '900', color: '#A7F3D0' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  profileDetailsCol: { flex: 1, justifyContent: 'center' },
  officerName: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  officerRole: { fontSize: 12, color: '#475569', marginTop: 1, lineHeight: 16 },
  idBadgesRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  idBadgePill: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  idBadgeText: { fontSize: 9.5, fontWeight: '700', color: '#475569' },
  tierPill: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tierText: { fontSize: 9.5, fontWeight: '700', color: '#065F46' },
  onDutyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  onDutyLeft: { flex: 1 },
  dutyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  dutyTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  dutySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  diagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  diagLeftHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diagTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  diagVal: { fontSize: 12, fontWeight: '800', color: '#475569' },
  cacheTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  cacheFill: { height: '100%', width: '70%', backgroundColor: '#0A382C', borderRadius: 3 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#FECACA' },
  signOutText: { color: '#DC2626', fontSize: 13.5, fontWeight: '900' },
  sosCard: { marginBottom: 14 },
  sosButton: { backgroundColor: '#FEE2E2', borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FECDD3' },
  sosButtonText: { color: '#991B1B', fontSize: 14, fontWeight: '900' },
  shiftSyncNotice: { textAlign: 'center', fontSize: 10.5, color: '#64748B', fontWeight: '500' },
});
